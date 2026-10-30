-- ============================================================
-- Sign-in status, 2026-10-30. Lets the Permissions page tell an
-- invited-but-never-logged-in person apart from someone who's actually
-- used the portal. inviteUserByEmail creates the auth.users row (and so
-- the profile) straight away, so "has a profile" alone isn't enough.
--
-- auth.users isn't readable from the client, so this admin-only
-- function hands back just the timestamps the page needs.
--
-- last_active_at: the latest refresh across the person's sessions. The
-- client refreshes its token roughly hourly while the portal is open, so
-- this tracks real use (to the hour) even when they haven't typed their
-- password in weeks. Null once every session is signed out.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

drop function if exists user_sign_ins();

create function user_sign_ins()
returns table (id uuid, invited_at timestamptz, last_sign_in_at timestamptz, last_active_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select u.id, u.invited_at, u.last_sign_in_at,
    (select max(coalesce(s.refreshed_at, s.updated_at)) from auth.sessions s where s.user_id = u.id)
  from auth.users u
  where is_admin();
$$;

revoke all on function user_sign_ins() from public, anon;
grant execute on function user_sign_ins() to authenticated;
