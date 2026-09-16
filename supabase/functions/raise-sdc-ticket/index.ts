// Raises an SDC "Work Intake Form" ticket directly in ClickUp, from the
// QA workbook's "Raise ticket" button — so SDC never has to leave the
// portal or re-type context ClickUp already has (client, project links).
//
// Requires the CLICKUP_API_TOKEN secret (Project Settings → Edge Functions
// → Secrets in the Supabase dashboard — never committed, never sent to the
// browser). SUPABASE_URL / SUPABASE_ANON_KEY are provided automatically by
// the platform to every Edge Function.
//
// Target: Service Delivery Centre (SDC) space → SDC Tickets folder →
// Backlog list, id 901215192418 — matches where the live "Work Intake
// Form" (https://brprosvcs.clickup.com/forms/9005025283/f/8cbvj03-204492/
// PI2UXQ5RDZ1GOYJFPG) drops new tickets. Field/option ids below were read
// straight off a real submitted ticket (task 869ezcf66), not guessed from
// the list's field list — that list carries several unused legacy fields
// with duplicate names, so guessing from it alone would silently write to
// the wrong field.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const LIST_ID = '901215192418' // SDC Tickets > Backlog
const WORKSPACE_ID = '9005025283'

const FIELDS = {
  jobType: 'cabbe40d-bc88-4cb0-9551-0ed9629908b1',
  customer: 'aa075184-7ffe-4a17-ab03-03b380557327',
  priority: '8e7102ed-3e61-44e3-9918-9ce8e959d7f9',
  sdcAdded: '6fb034b1-6b40-4907-b314-469bd84d29c0',
  workfrontUrl: '431a7985-60e5-42b3-99ae-1dc36ab525aa',
  bloomreachUrl: '4acc8805-db73-4ccd-845b-32a23bebef06',
  estimatedHours: 'e786603b-be90-4b18-ac8e-02a903caf01a',
  // Unused by the live form (its own Requestor is an avatar picker driving
  // the task creator, not this field) — repurposed here to record the
  // account's Partner Services Manager, since who raises a ticket and who
  // owns the account aren't always the same person.
  requestor: '1d451a2d-13b3-4fe2-b852-6ad6e7aff80d',
}

// Job Type dropdown option ids, in the form's display order.
const JOB_TYPE_OPTIONS = {
  'Warmup Scenario': '77dfe44c-66b2-47ae-8ac4-a7efff5fc9f6',
  'Manuel Testing of Use Cases (fixed use cases)': '4c798880-5379-42e6-9979-e1d71353c153',
  'Consent page adjustments': '42ead90f-fd39-4c8e-9520-53e7d24f6af3',
  'Catalog Vadliation and Recs test': 'e55f8872-f1b6-48d8-90c3-bb3dea12fa15',
  'Website/App QA data validation': '8a1f52fe-3251-48dc-a02a-0cc404a84235',
  'Cloning UCC use cases': 'e297a180-a3cc-47c2-b602-e222a1ebee55',
  'New Channel Admin SMS WA': '2f82439b-af39-4aa2-af23-9fc3002f30b1',
  'Data Audits': '17a3c8de-8a3e-4ea0-906d-1b398ce9edb4',
  'Basic Weblayers': 'd6246a43-b4c1-4785-8ebf-48bd3d481893',
  'New market expansion': 'a57f1e95-2729-4a29-8852-305928bcd850',
  'Ad Hoc': '4cd47e8e-36a1-42a9-adfb-d1640496b613',
}

const PRIORITY_OPTIONS = {
  HIGH: 'e6c1653e-efea-4bcc-ba89-2b8877861243',
  MEDIUM: 'ca6d5be1-ded3-46d4-b97b-82a4490e15c3',
  LOW: 'ce32c920-6972-424c-8bcf-e8cab23d8dff',
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const clickupToken = Deno.env.get('CLICKUP_API_TOKEN')
  if (!clickupToken) return json({ error: 'ClickUp is not configured on the server yet.' }, 500)

  // Authenticate + authorize the caller the same way RLS would: only
  // admin or SDC may raise a ticket. Uses the caller's own JWT (forwarded
  // by supabase.functions.invoke) against the anon client, so is_admin()/
  // is_sdc() evaluate for *them*, not for the function's service role.
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)

  const [{ data: isAdmin }, { data: isSDC }] = await Promise.all([
    supabase.rpc('is_admin'),
    supabase.rpc('is_sdc'),
  ])
  if (!isAdmin && !isSDC) return json({ error: 'Only admin or SDC can raise a ticket.' }, 403)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  const taskName = String(body.taskName || '').trim()
  const customer = String(body.customer || '').trim()
  const jobType = String(body.jobType || '')
  const priority = String(body.priority || '')
  if (!taskName) return json({ error: 'Task name is required.' }, 400)
  if (!customer) return json({ error: 'Customer is required.' }, 400)
  if (!(jobType in JOB_TYPE_OPTIONS)) return json({ error: 'Invalid job type.' }, 400)
  if (!(priority in PRIORITY_OPTIONS)) return json({ error: 'Invalid priority.' }, 400)

  // Best-effort: assign the ticket to whoever raised it — matching how the
  // real form assigns the person filling it in — AND to the account's PSM
  // if one is set on the implementation, so ownership isn't lost just
  // because a different SDC member happened to raise this one. Never
  // blocks ticket creation if an email doesn't resolve to a ClickUp member.
  const psmName = String(body.psmName || '').trim()
  const psmEmail = String(body.psmEmail || '').trim().toLowerCase()
  let assignees: number[] = []
  let raiserName = user.email || ''
  try {
    const teamRes = await fetch('https://api.clickup.com/api/v2/team', {
      headers: { Authorization: clickupToken },
    })
    if (teamRes.ok) {
      const teamData = await teamRes.json()
      const team = (teamData.teams || []).find((t: { id: string }) => t.id === WORKSPACE_ID)
      const members = team?.members || []
      const findByEmail = (email: string) => members.find(
        (m: { user: { email?: string } }) => m.user?.email?.toLowerCase() === email,
      )
      const raiserMember = findByEmail(user.email?.toLowerCase() || '')
      if (raiserMember) {
        assignees.push(raiserMember.user.id)
        raiserName = raiserMember.user.username || raiserName
      }
      if (psmEmail) {
        const psmMember = findByEmail(psmEmail)
        if (psmMember && !assignees.includes(psmMember.user.id)) assignees.push(psmMember.user.id)
      }
    }
  } catch { /* non-fatal — ticket still gets created, just unassigned */ }

  const customFields = [
    { id: FIELDS.jobType, value: JOB_TYPE_OPTIONS[jobType as keyof typeof JOB_TYPE_OPTIONS] },
    { id: FIELDS.customer, value: customer },
    { id: FIELDS.priority, value: PRIORITY_OPTIONS[priority as keyof typeof PRIORITY_OPTIONS] },
    { id: FIELDS.sdcAdded, value: body.sdcAdded ? 'true' : 'false' },
    // Falls back to whoever raised it when no PSM is set on the account.
    { id: FIELDS.requestor, value: psmName || raiserName },
  ]
  if (body.workfrontUrl) customFields.push({ id: FIELDS.workfrontUrl, value: String(body.workfrontUrl) })
  if (body.bloomreachUrl) customFields.push({ id: FIELDS.bloomreachUrl, value: String(body.bloomreachUrl) })
  if (body.estimatedHours) customFields.push({ id: FIELDS.estimatedHours, value: String(body.estimatedHours) })

  const descriptionParts = [String(body.description || '')]
  descriptionParts.push(`\n\n**Raised by:** ${raiserName}${psmName ? `\n**Account owner (PSM):** ${psmName}` : ''}`)

  const clickupRes = await fetch(`https://api.clickup.com/api/v2/list/${LIST_ID}/task`, {
    method: 'POST',
    headers: { Authorization: clickupToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: taskName,
      markdown_description: descriptionParts.join(''),
      assignees,
      custom_fields: customFields,
    }),
  })

  if (!clickupRes.ok) {
    const detail = await clickupRes.text().catch(() => '')
    return json({ error: `ClickUp rejected the ticket (${clickupRes.status}).`, detail }, 502)
  }

  const task = await clickupRes.json()
  return json({ ok: true, taskId: task.id, url: task.url })
})
