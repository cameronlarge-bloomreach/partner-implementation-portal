// Reads an already-uploaded contract PDF (from the implementation-docs
// Storage bucket) and proposes usage_metrics limits — via free, rule-based
// text extraction against Bloomreach's own Sales Order template, not an
// LLM. Deliberately proposes LIMITS ONLY — never a usage_value, never a
// pricing_model change — and never writes to the database itself. The
// caller (ContractReviewModal.jsx) shows every proposed value next to its
// raw printed text for a human to confirm before anything is saved, via
// the existing upsertUsageMetric.
//
// Patterns below were derived directly from a real Sales Order (Dubai
// Racing, a "profiles" pricing model contract) — verified against its raw
// extracted text before being written as regexes, not guessed. That's also
// this approach's real limitation: it only reliably covers the shape of
// contract it was built against. `processed_events`/`max_event_storage`
// (events-model fields) and a few edge cases have no verified pattern yet
// — they intentionally return found:false rather than a guessed regex, so
// an untested case fails safe instead of silently wrong. Extend the
// patterns once a real events-model contract (or other shape) is seen,
// the same way these were built: extract its raw text first, look at it,
// then write the pattern — don't write one blind.
//
// Previously called the Anthropic API for this (understood context, more
// robust to template variation, but had a per-call cost) — replaced
// 2026-09-22 at Cameron's request to eliminate that cost. If extraction
// quality on new contract shapes turns out too unreliable, that's the
// natural fallback to revisit, not a dead end.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { extractText, getDocumentProxy } from 'npm:unpdf@1'

const DOCS_BUCKET = 'implementation-docs'
const MAX_PDF_BYTES = 20 * 1024 * 1024

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

type Metric = {
  metricKey: string | null
  label: string | null
  found: boolean
  rawText: string | null
  interpretedValue: number | null
  interpretationNote: string
  sourceQuote: string
}

function notFound(metricKey: string): Metric {
  return { metricKey, label: null, found: false, rawText: null, interpretedValue: null, interpretationNote: '', sourceQuote: '' }
}

// Billable Profiles / MUV Licensed Limits are always printed in CPQ
// thousands-shorthand in this table ("Up to 325" means 325,000) — a fixed
// convention Cameron confirmed directly, not a per-value heuristic guess.
function extractLicensedLimit(text: string, metricKey: string, label: string): Metric {
  const re = new RegExp(`${label}\\s*:?\\s*Up to\\s+([\\d,]+)`, 'i')
  const m = text.match(re)
  if (!m) return notFound(metricKey)
  const raw = m[1]
  const value = Number(raw.replace(/,/g, '')) * 1000
  return {
    metricKey, label: null, found: true, rawText: `Up to ${raw}`, interpretedValue: value,
    interpretationNote: 'CPQ shorthand: Licensed Limits are printed in thousands',
    sourceQuote: m[0].replace(/\s+/g, ' ').trim(),
  }
}

// Platform Allowances table rows: "<Metric> Year <n> <per-profile> <total, in millions> <period>".
// Period is restricted to the two values the contract's own terms name
// ("Monthly Entitlement"/"Annual Entitlement") rather than a generic \w+ —
// a real run against the Dubai Racing contract showed \w+ greedily bleeding
// into the next page's "Docusign Envelope ID" footer with no whitespace
// between them in the extracted text ("AnnualDocusign").
function extractAllowance(text: string, metricKey: string, label: string): Metric {
  const re = new RegExp(`${label}\\s+Year\\s+\\d+\\s+\\d+\\s+([\\d.]+)\\s+(Monthly|Annual)`, 'i')
  const m = text.match(re)
  if (!m) return notFound(metricKey)
  const raw = m[1]
  const period = m[2]
  const value = Number(raw) * 1_000_000
  return {
    metricKey, label: null, found: true, rawText: raw, interpretedValue: value,
    interpretationNote: `Table column is "Total Allowance (in millions)", ${period} entitlement period`,
    sourceQuote: m[0].replace(/\s+/g, ' ').trim(),
  }
}

// Communications table: "Email-Email Committed Usage ... 1000\nEmails\n<qty> $x.xx $y.yy".
function extractCommittedEmailUsage(text: string): Metric {
  const re = /Email-Email Committed Usage.*?1000\s*Emails\s*([\d,]+)/is
  const m = text.match(re)
  if (!m) return notFound('committed_email_usage')
  const raw = m[1]
  const value = Number(raw.replace(/,/g, '')) * 1000
  return {
    metricKey: 'committed_email_usage', label: null, found: true, rawText: `${raw} x 1000 Emails`, interpretedValue: value,
    interpretationNote: 'Qty x 1000-email unit of measure',
    sourceQuote: m[0].replace(/\s+/g, ' ').trim(),
  }
}

function extractAll(text: string): Metric[] {
  return [
    extractLicensedLimit(text, 'billable_profiles', 'Billable\\s*Profiles'),
    extractLicensedLimit(text, 'muv', 'MUV'),
    // No verified pattern yet for an events-model Sales Order — see file header.
    notFound('processed_events'),
    notFound('max_event_storage'),
    extractAllowance(text, 'profile_updates', 'Profile Updates'),
    extractAllowance(text, 'monthly_event_storage', 'Event storage'),
    extractAllowance(text, 'email_orchestrations', 'Email Orchestrations'),
    extractAllowance(text, 'mobile_message_orchestrations', 'Mobile Message\\s*Orchestrations'),
    extractCommittedEmailUsage(text),
  ]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

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
  if (!filePath.startsWith(`${implementationId}/`)) return json({ error: 'filePath does not belong to this implementation.' }, 400)

  const { data: fileBlob, error: dlErr } = await supabase.storage.from(DOCS_BUCKET).download(filePath)
  if (dlErr || !fileBlob) return json({ error: `Could not read the document (${dlErr?.message || 'not found'}).` }, 404)
  if (fileBlob.size > MAX_PDF_BYTES) {
    return json({ error: `Document is too large to auto-extract (${Math.round(fileBlob.size / 1024 / 1024)} MB, limit ${MAX_PDF_BYTES / 1024 / 1024} MB).` }, 413)
  }

  let text: string
  try {
    const bytes = new Uint8Array(await fileBlob.arrayBuffer())
    const doc = await getDocumentProxy(bytes)
    const result = await extractText(doc, { mergePages: true })
    text = result.text
  } catch (e) {
    return json({ error: `Could not read text from this PDF (${e instanceof Error ? e.message : String(e)}).` }, 502)
  }

  const metrics = extractAll(text).filter((m) => m.metricKey || m.label)
  return json({ ok: true, metrics })
})
