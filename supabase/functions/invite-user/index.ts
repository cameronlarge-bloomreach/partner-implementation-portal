// Sends a Supabase "Invite user" email — the branded alternative to asking
// someone to go to the portal and sign up themselves (which still works).
// Inviting needs the service-role key, which the browser must never hold,
// so like delete-user this is server-side only and gated on the caller
// being admin.
//
// Access grants are NOT written here — the Permissions page grants access
// via the existing approveSignup path first, then calls this purely to
// create the account and send the email. Keeps one code path for grants.
//
// Everything passed as `data` lands in the new user's metadata: the
// handle_new_user trigger copies first/last/partner onto profiles, and the
// Invite email template (supabase/email-templates/invite.html) reads
// first_name / invited_by / access_label to personalise the email.

import { createClient } from 'jsr:@supabase/supabase-js@2'

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

function clean(v: unknown) {
  const s = String(v ?? '').trim()
  return s || null
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
  if (!isAdmin) return json({ error: 'Only admin can send invites.' }, 403)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const email = String(body.email || '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'A valid email is required.' }, 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // "Invited by Cameron" reads better than an email address in the template.
  const { data: me } = await admin.from('profiles')
    .select('first_name, last_name').eq('id', callerUser.id).maybeSingle()
  const invitedBy = [me?.first_name, me?.last_name].filter(Boolean).join(' ') || callerUser.email

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: clean(body.redirectTo) ?? undefined,
    data: {
      first_name: clean(body.firstName),
      last_name: clean(body.lastName),
      partner_name: clean(body.partnerName),
      access_label: clean(body.accessLabel),
      invited_by: invitedBy,
    },
  })
  if (error) {
    // Supabase refuses to invite an email that already has an account.
    if (/already been registered|already registered|already exists/i.test(error.message)) {
      return json({ error: 'They already have an account — their access is updated, they can just sign in (or use “Forgot password?”).' }, 409)
    }
    return json({ error: error.message }, 500)
  }
  return json({ ok: true })
})
