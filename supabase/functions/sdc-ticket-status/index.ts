// Reads live ClickUp state (status, assignees, priority, closed date,
// comments) for the QA tickets raised from BLIMP's workbooks, so the admin
// "QA Tickets" page can track them without opening each one in ClickUp.
//
// Shares the CLICKUP_API_TOKEN secret with raise-sdc-ticket. Admin-only —
// unlike raising, SDC and viewers don't get the cross-client ticket list.

import { createClient } from 'jsr:@supabase/supabase-js@2'

// Same custom fields raise-sdc-ticket writes — read back by id so the
// legacy duplicate-named fields on the list are never picked up.
const FIELDS = {
  jobType: 'cabbe40d-bc88-4cb0-9551-0ed9629908b1',
  priority: '8e7102ed-3e61-44e3-9918-9ce8e959d7f9',
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

type Field = { id: string, value?: unknown, type_config?: { options?: { id: string, name: string, orderindex: number }[] } }

// Dropdown custom fields come back as the option's orderindex (or id on
// some workspaces) — resolve either to the option's display name.
function dropdownName(fields: Field[], fieldId: string) {
  const f = fields.find(x => x.id === fieldId)
  if (!f || f.value === undefined || f.value === null) return null
  const opt = (f.type_config?.options || []).find(o => o.orderindex === Number(f.value) || o.id === f.value)
  return opt?.name ?? null
}

const toIso = (ms: string | null) => (ms ? new Date(Number(ms)).toISOString() : null)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const clickupToken = Deno.env.get('CLICKUP_API_TOKEN')
  if (!clickupToken) return json({ error: 'ClickUp is not configured on the server yet.' }, 500)

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return json({ error: 'Only admins can view QA tickets.' }, 403)

  let body: { taskIds?: unknown }
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const taskIds = Array.isArray(body.taskIds)
    ? [...new Set(body.taskIds.map(String).filter(id => /^[a-z0-9]+$/i.test(id)))].slice(0, 200)
    : []

  // Two GETs per task (task + comments), in parallel — a few dozen tickets
  // is well under ClickUp's 100 req/min, and a failed lookup just leaves
  // that row blank. Comments failing alone still returns the task.
  const tasks: Record<string, unknown> = {}
  await Promise.all(taskIds.map(async id => {
    try {
      const headers = { Authorization: clickupToken }
      const [res, commentsRes] = await Promise.all([
        fetch(`https://api.clickup.com/api/v2/task/${id}`, { headers }),
        fetch(`https://api.clickup.com/api/v2/task/${id}/comment`, { headers }).catch(() => null),
      ])
      if (!res.ok) { tasks[id] = { error: res.status === 404 ? 'not_found' : `clickup_${res.status}` }; return }
      const t = await res.json()
      const rawComments = commentsRes?.ok ? ((await commentsRes.json()).comments || []) : null
      // ClickUp returns the newest 25, newest first.
      const comments = rawComments?.map((c: { id: string, comment_text?: string, date?: string, user?: { username?: string, email?: string, initials?: string, color?: string, profilePicture?: string } }) => ({
        id: c.id,
        text: (c.comment_text || '').trim(),
        date: toIso(c.date ?? null),
        author: {
          name: c.user?.username || c.user?.email || '',
          initials: c.user?.initials || '',
          color: c.user?.color || null,
          picture: c.user?.profilePicture || null,
        },
      })) ?? null
      const fields: Field[] = t.custom_fields || []
      tasks[id] = {
        status: t.status?.status ?? null,
        statusColor: t.status?.color ?? null,
        statusType: t.status?.type ?? null, // 'open' | 'custom' | 'done' | 'closed'
        assignees: (t.assignees || []).map((a: { username?: string, email?: string, initials?: string, color?: string, profilePicture?: string }) => ({
          name: a.username || a.email || '',
          initials: a.initials || '',
          color: a.color || null,
          picture: a.profilePicture || null,
        })),
        priority: dropdownName(fields, FIELDS.priority),
        jobType: dropdownName(fields, FIELDS.jobType),
        list: t.list?.name ?? null,
        dateUpdated: toIso(t.date_updated),
        dateClosed: toIso(t.date_closed || t.date_done),
        dueDate: toIso(t.due_date),
        comments, // null when ClickUp's comments call failed, [] when there are none
      }
    } catch {
      tasks[id] = { error: 'fetch_failed' }
    }
  }))

  return json({ ok: true, tasks })
})
