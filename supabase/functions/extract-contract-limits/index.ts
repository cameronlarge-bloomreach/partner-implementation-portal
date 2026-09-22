// Reads an already-uploaded contract PDF (from the implementation-docs
// Storage bucket) and proposes usage_metrics limits via the Anthropic API.
// Deliberately proposes LIMITS ONLY — never a usage_value, never a
// pricing_model change — and never writes to the database itself. The
// caller (ContractReviewModal.jsx) shows every proposed value next to its
// raw printed text for a human to confirm before anything is saved, via
// the existing upsertUsageMetric. Treat this function's own LLM output as
// untrusted: it's validated against the known metric_key enum below before
// being returned to the frontend at all.
//
// Requires the ANTHROPIC_API_KEY secret (Project Settings → Edge Functions
// → Secrets in the Supabase dashboard — never committed, never sent to the
// browser). Cameron generates this himself at console.anthropic.com.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'

const DOCS_BUCKET = 'implementation-docs'
const MAX_PDF_BYTES = 20 * 1024 * 1024 // stay well under Anthropic's document limits

const KNOWN_METRIC_KEYS = [
  'billable_profiles', 'muv', 'processed_events', 'max_event_storage',
  'profile_updates', 'monthly_event_storage', 'email_orchestrations',
  'mobile_message_orchestrations', 'committed_email_usage',
]

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

const EXTRACTION_PROMPT = `You are extracting contracted usage limits from a Bloomreach Sales Order / contract PDF, for a partner-implementation tracking tool. Return ONLY valid JSON (no markdown fences, no commentary) matching exactly this schema:

{
  "metrics": [
    {
      "metric_key": "<one of: billable_profiles, muv, processed_events, max_event_storage, profile_updates, monthly_event_storage, email_orchestrations, mobile_message_orchestrations, committed_email_usage — or null if this metric doesn't match any of those>",
      "label": "<required only when metric_key is null — a short human label for what this contracted metric is>",
      "found": true or false,
      "raw_text": "<the exact text as printed in the document for this figure, verbatim, or null if not found>",
      "interpreted_value": <the number this represents, or null if not found or genuinely unclear>,
      "interpretation_note": "<explain any conversion you applied, e.g. 'CPQ shorthand: printed value is in thousands'; empty string if no conversion was needed>",
      "source_quote": "<a short surrounding quote from the document giving context for this figure>"
    }
  ]
}

Rules:
1. Always include exactly one entry for each of the 9 known metric_key values above, even if not found in the document (set found:false, raw_text:null, interpreted_value:null in that case).
2. Additionally include one entry per any OTHER contracted usage/allowance metric you find in the document that doesn't match any of the 9 known keys — set metric_key:null and fill in label instead.
3. IMPORTANT — known convention: Bloomreach Sales Orders sometimes state the "Billable Profiles" and "MUV" Licensed Limits in CPQ shorthand where the printed number is in thousands (e.g. a printed "Up to 250" means 250,000; "Up to 325" means 325,000). If you see a suspiciously small number (under roughly 10,000) specifically for billable_profiles or muv in a "Licensed Limits" / "Platform" table, treat it as likely stated in thousands: set interpreted_value to raw × 1000, and clearly say so in interpretation_note. Still put the literal unconverted text in raw_text.
4. For metrics whose "Total Allowance" is already stated "in millions" (a common table format for allowances like Profile Updates, Event Storage, Email/Mobile Orchestrations), interpreted_value should be the actual number (e.g. a table value of "4.875" under a "(in millions)" column header means interpreted_value: 4875000).
5. Do not guess when a figure's meaning is genuinely ambiguous — set found:false and interpreted_value:null rather than fabricate a number.
6. Never propose a pricing model or anything other than usage limits.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) return json({ error: 'Contract extraction is not configured on the server yet.' }, 500)

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return json({ error: 'Only admin can extract contract limits.' }, 403)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  const implementationId = String(body.implementationId || '').trim()
  const filePath = String(body.filePath || '').trim()
  if (!implementationId || !filePath) return json({ error: 'implementationId and filePath are required.' }, 400)
  // The path's first segment must match implementationId — same convention
  // Storage RLS itself enforces, checked again here defensively.
  if (!filePath.startsWith(`${implementationId}/`)) return json({ error: 'filePath does not belong to this implementation.' }, 400)

  const { data: fileBlob, error: dlErr } = await supabase.storage.from(DOCS_BUCKET).download(filePath)
  if (dlErr || !fileBlob) return json({ error: `Could not read the document (${dlErr?.message || 'not found'}).` }, 404)
  if (fileBlob.size > MAX_PDF_BYTES) {
    return json({ error: `Document is too large to auto-extract (${Math.round(fileBlob.size / 1024 / 1024)} MB, limit ${MAX_PDF_BYTES / 1024 / 1024} MB).` }, 413)
  }

  const bytes = new Uint8Array(await fileBlob.arrayBuffer())
  const base64Pdf = encodeBase64(bytes) // chunked encoder — plain btoa(String.fromCharCode(...)) throws on files this size

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf } },
          { type: 'text', text: EXTRACTION_PROMPT },
        ],
      }],
    }),
  })

  if (!anthropicRes.ok) {
    const detail = await anthropicRes.text().catch(() => '')
    return json({ error: `Extraction failed (${anthropicRes.status}).`, detail }, 502)
  }

  const anthropicData = await anthropicRes.json()
  const rawText = anthropicData?.content?.[0]?.text || ''
  let parsed: { metrics?: unknown[] }
  try {
    // Strip a stray ```json fence if the model added one despite instructions.
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    return json({ error: 'Extraction did not return valid JSON — try again or enter limits manually.' }, 502)
  }

  // Validate every entry before it ever reaches the frontend — the model's
  // JSON is untrusted output, same as any other external input.
  const metrics = (Array.isArray(parsed.metrics) ? parsed.metrics : [])
    .map((m) => {
      const row = m as Record<string, unknown>
      const metricKey = typeof row.metric_key === 'string' && KNOWN_METRIC_KEYS.includes(row.metric_key) ? row.metric_key : null
      const interpretedValue = typeof row.interpreted_value === 'number' && Number.isFinite(row.interpreted_value) && row.interpreted_value >= 0
        ? row.interpreted_value : null
      return {
        metricKey,
        label: typeof row.label === 'string' ? row.label : null,
        found: !!row.found,
        rawText: typeof row.raw_text === 'string' ? row.raw_text : null,
        interpretedValue,
        interpretationNote: typeof row.interpretation_note === 'string' ? row.interpretation_note : '',
        sourceQuote: typeof row.source_quote === 'string' ? row.source_quote : '',
      }
    })
    .filter((m) => m.metricKey || m.label) // drop anything with neither a known key nor a label — nothing useful to show

  return json({ ok: true, metrics })
})
