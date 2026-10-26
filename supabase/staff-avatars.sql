-- ============================================================
-- Staff avatars, 2026-10-26. Slack profile photo per Bloomreach email,
-- shown as the account-team avatar stack on dashboard cards. Filled
-- from Glean's people directory (which mirrors Slack's photoUrl —
-- avatars.slack-edge.com) since BLIMP has no Slack bot token; missing
-- or stale rows just fall back to initials in the app.
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

create table if not exists staff_avatars (
  email text primary key,
  name text not null default '',
  title text not null default '',
  photo_url text not null default '',
  updated_at timestamptz not null default now()
);

alter table staff_avatars enable row level security;

-- Internal people only: admin / SDC / viewer, or anyone on an account team.
drop policy if exists staff_avatars_select on staff_avatars;
create policy staff_avatars_select on staff_avatars for select
  using (
    is_admin() or is_sdc() or is_viewer()
    or exists (select 1 from implementations i where caller_email() in (lower(i.csm_email), lower(i.am_email)))
  );

drop policy if exists staff_avatars_write on staff_avatars;
create policy staff_avatars_write on staff_avatars for all
  using (is_admin()) with check (is_admin());
