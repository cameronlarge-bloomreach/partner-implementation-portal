-- ============================================================
-- Sign-in status, 2026-10-30. Lets the Permissions page tell an
-- invited-but-never-logged-in person apart from someone who's actually
-- used the portal. inviteUserByEmail creates the auth.users row (and so
-- the profile) straight away, so "has a profile" alone isn't enough.
--
-- auth.users isn't readable from the client, so this admin-only
-- function hands back just the two timestamps the page needs.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

create or replace function user_sign_ins()
returns table (id uuid, invited_at timestamptz, last_sign_in_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select u.id, u.invited_at, u.last_sign_in_at
  from auth.users u
  where is_admin();
$$;

revoke all on function user_sign_ins() from public, anon;
grant execute on function user_sign_ins() to authenticated;
