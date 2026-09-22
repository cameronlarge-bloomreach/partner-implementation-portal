// Fetches Clari Copilot calls in a date range, with participants + transcript
// summary, for the weekly `sync-meeting-notes` automation to match against
// implementations and save into `meeting_notes`. Keeps the Clari API key off
// the automation script entirely — same reasoning as raise-sdc-ticket/index.ts
// for CLICKUP_API_TOKEN: the credential lives only as a server-side secret.
//
// Requires CLARI_API_KEY and CLARI_API_PASSWORD secrets (Project Settings →
// Edge Functions → Secrets). Cameron generates these himself in Clari Copilot
// under workspace settings > integrations > Clari Copilot API.
//
// API reference confirmed directly against https://api-doc.copilot.clari.com/
// (2026-09-22) — auth headers, endpoints, and the /call-details response
// shape below are copied from the real spec, not guessed. The /calls list
// endpoint's per-item shape was NOT fully visible in the fetched docs (the
// schema was collapsed), so this function calls /call-details for every call
// id to get a shape we've actually confirmed (title, time, participants,
// transcript, summary) rather than assume the list item already has them.
// `summary`/`transcript`'s own sub-fields were also not documented in what
// we could read — the extraction below is defensive/best-effort and should
// be checked against real output before this is trusted for the digest.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CLARI_BASE = 'https://rest-api.copilot.clari.com'

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

function extractParticipantEmails(call: Record<string, unknown>): string[] {
  const emails = new Set<string>()
  for (const key of ['users', 'externalParticipants', 'joinedParticipants']) {
    const list = call[key]
    if (Array.isArray(list)) {
      for (const p of list) {
        const email = typeof p === 'string' ? p : (p as Record<string, unknown>)?.email
        if (typeof email === 'string' && email.includes('@')) emails.add(email.toLowerCase())
      }
    }
  }
  return [...emails]
}

// Best-effort — Clari's docs didn't expose summary/transcript sub-fields in
// what we could read from the page. Falls back to a trimmed JSON dump so
// nothing is silently dropped; verify against real data (see plan step 2)
// and tighten this once the real shape is known.
function extractSummaryText(call: Record<string, unknown>): string {
  const summary = call.summary as Record<string, unknown> | undefined
  if (!summary) return ''
  const candidate = summary.text ?? summary.overview ?? summary.short_summary ?? summary.summary
  if (typeof candidate === 'string') return candidate
  try { return JSON.stringify(summary).slice(0, 4000) } catch { return '' }
}

function extractTranscriptText(call: Record<string, unknown>): string {
  const transcript = call.transcript
  if (!Array.isArray(transcript)) return ''
  const lines = transcript.map((seg) => {
    const s = seg as Record<string, unknown>
    const speaker = s.speaker ?? s.speaker_name ?? s.user ?? ''
    const text = s.text ?? s.transcript ?? s.sentence ?? ''
    return speaker ? `${speaker}: ${text}` : String(text)
  }).filter(Boolean)
  return lines.join('\n').slice(0, 8000)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const apiKey = Deno.env.get('CLARI_API_KEY')
  const apiPassword = Deno.env.get('CLARI_API_PASSWORD')
  if (!apiKey || !apiPassword) return json({ error: 'Clari Copilot is not configured on the server yet.' }, 500)

  // Internal automation tool — admin only (the weekly sync always runs
  // authenticated as Cameron, same as the other scheduled tasks).
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return json({ error: 'Only admin can fetch Clari calls.' }, 403)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  const since = String(body.since || '').trim()
  const until = String(body.until || '').trim()
  if (!since || !until) return json({ error: 'since and until (ISO date-time) are required.' }, 400)

  const clariHeaders = { 'X-Api-Key': apiKey, 'X-Api-Password': apiPassword }

  const listUrl = new URL(`${CLARI_BASE}/calls`)
  listUrl.searchParams.set('filterTimeGt', since)
  listUrl.searchParams.set('filterTimeLt', until)
  listUrl.searchParams.set('includePagination', 'false')
  listUrl.searchParams.set('limit', '100')
  listUrl.searchParams.set('sortTime', 'asc')

  const listRes = await fetch(listUrl, { headers: clariHeaders })
  if (!listRes.ok) {
    const detail = await listRes.text().catch(() => '')
    return json({ error: `Clari rejected the calls list (${listRes.status}).`, detail }, 502)
  }
  const { calls: callStubs } = await listRes.json() as { calls: Array<Record<string, unknown>> }

  const results: Array<Record<string, unknown>> = []
  const errors: Array<{ id: unknown; error: string }> = []

  // Sequential with a small delay — well within the 10 req/sec limit, and
  // simpler to reason about than a queue for what's realistically a few
  // dozen calls a week.
  for (const stub of callStubs || []) {
    const id = stub.id
    try {
      const detailsUrl = new URL(`${CLARI_BASE}/call-details`)
      detailsUrl.searchParams.set('id', String(id))
      const detailsRes = await fetch(detailsUrl, { headers: clariHeaders })
      if (!detailsRes.ok) {
        errors.push({ id, error: `HTTP ${detailsRes.status}` })
        continue
      }
      const { call } = await detailsRes.json() as { call: Record<string, unknown> }
      results.push({
        id: call.id,
        title: call.title,
        time: call.time,
        status: call.status,
        participants: extractParticipantEmails(call),
        summary: extractSummaryText(call),
        transcriptExcerpt: extractTranscriptText(call),
        callReviewPageUrl: call.call_review_page_url,
      })
      await new Promise((r) => setTimeout(r, 110)) // ~9/sec, under the 10/sec limit
    } catch (e) {
      errors.push({ id, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return json({ ok: true, calls: results, errors })
})
