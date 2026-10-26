// Actually deletes a Supabase auth user — not just revoking access grants
// (which the Permissions page's chips already do via plain table
// deletes). Real account deletion needs the service-role key, which the
// browser must never hold (same reason "Decline" on a pending signup only
// flags the profile instead of deleting it), so this is the one place that
// key is used, server-side only, gated on the caller being admin.
//
// auth.users -> profiles cascades on delete (confirmed via the FK's
// ON DELETE CASCADE), but the grant tables are keyed by email with no FK
// to auth.users — clean those up explicitly too, or someone signing up (or
// being invited) again under the same email silently inherits the deleted
// person's old grants. GRANT_TABLES must list every one of them: viewer_emails
// was missing after the Viewer role was added, and a re-invited test
// account inherited a stale Viewer grant (2026-10-26).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const GRANT_TABLES = ['access', 'partner_access', 'admin_emails', 'sdc_emails', 'viewer_emails']

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

  const authHeader = req.headers.get('Authorization') ?? ''
  const caller = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user: callerUser } } = await caller.auth.getUser()
  if (!callerUser) return json({ error: 'unauthorized' }, 401)
  const { data: isAdmin } = await caller.rpc('is_admin')
  if (!isAdmin) return json({ error: 'Only admin can delete accounts.' }, 403)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const userId = String(body.userId || '').trim()
  if (!userId) return json({ error: 'userId is required.' }, 400)
  if (userId === callerUser.id) return json({ error: "You can't delete your own account from here." }, 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: lookup, error: lookupErr } = await admin.auth.admin.getUserById(userId)
  if (lookupErr || !lookup?.user) return json({ error: 'User not found.' }, 404)
  const email = lookup.user.email?.toLowerCase()

  const { error: delErr } = await admin.auth.admin.deleteUser(userId)
  if (delErr) return json({ error: delErr.message }, 500)

  if (email) {
    const results = await Promise.all(
      GRANT_TABLES.map(t => admin.from(t).delete().eq('email', email)),
    )
    const failed = results.map((r, i) => r.error && GRANT_TABLES[i]).filter(Boolean)
    if (failed.length) {
      return json({ error: `Account deleted, but access grants in ${failed.join(', ')} couldn't be removed — remove them from Permissions.` }, 500)
    }
  }

  return json({ ok: true })
})
