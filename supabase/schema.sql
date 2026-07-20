-- ============================================================
-- Partner Implementation Portal — Supabase Schema v2
-- Run this FIRST in the Supabase SQL Editor, then migrate-data.sql
--
-- Replaces the Apps Script + Google Sheets backend 1:1:
--   Implementations / TouchPoints / RAID / MeetingNotes /
--   ScenarioSync / Access / Admins sheets.
-- Magic links & sessions are replaced by Supabase Auth (email OTP),
-- so those sheets have no table here.
-- ============================================================

-- ---------- Tables ----------

create table admin_emails (
  email text primary key
);

create table implementations (
  id uuid primary key default gen_random_uuid(),
  partner_name text not null,
  client_name text not null,
  contract_sign_date date,
  planned_completion_date date,
  target_completion_date date,
  actual_completion_date date,
  planned_go_live_date date,
  target_time_to_live date,
  actual_time_to_live date,
  status text not null default 'active',
  slack_channel_id text not null default '',
  bloomreach_org_id text not null default '',
  bloomreach_org_name text not null default '',
  scenarios_synced_at timestamptz,
  profile_count integer,
  profile_count_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- key holds the 7 touch points, 6 QA steps, and free-form companion
-- keys like 'qa_peer_review_1_notes' whose status column carries text —
-- deliberately NO check constraints on key/status (parity with the Sheet).
create table touch_points (
  implementation_id uuid not null references implementations(id) on delete cascade,
  key text not null,
  status text not null default 'not_started',
  updated_at timestamptz not null default now(),
  primary key (implementation_id, key)
);

create table raid_items (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null references implementations(id) on delete cascade,
  type text not null,
  title text not null,
  description text not null default '',
  status text not null default 'open',
  owner text not null default '',
  raised_date date,
  created_at timestamptz not null default now()
);

-- Admin-only (partners never see meeting notes — parity with Apps Script).
create table meeting_notes (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null references implementations(id) on delete cascade,
  title text not null,
  meeting_date date,
  content text not null default '',
  source text not null default 'manual',
  granola_meeting_id text not null default '',
  created_at timestamptz not null default now()
);

-- Admin-only (synced from Loomi/Engagement).
create table scenario_sync (
  implementation_id uuid not null references implementations(id) on delete cascade,
  scenario_id text not null,
  name text not null default '',
  status text not null default '',
  tags text not null default '',
  primary key (implementation_id, scenario_id)
);

-- email -> implementation mapping; many-to-many, works before the
-- partner has ever signed in (keyed by email, not auth user id).
create table access (
  email text not null,
  implementation_id uuid not null references implementations(id) on delete cascade,
  primary key (email, implementation_id)
);

-- ---------- Helper functions (security definer: they bypass RLS) ----------

create or replace function caller_email()
returns text language sql stable security definer set search_path = public as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_emails where email = caller_email());
$$;

create or replace function has_access(impl_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from access
    where email = caller_email() and implementation_id = impl_id
  );
$$;

-- ---------- Row Level Security ----------

alter table admin_emails enable row level security;
alter table implementations enable row level security;
alter table touch_points enable row level security;
alter table raid_items enable row level security;
alter table meeting_notes enable row level security;
alter table scenario_sync enable row level security;
alter table access enable row level security;

-- admin_emails: no policies — only readable via the is_admin() function.

-- implementations: partners read theirs; only admins write.
create policy impl_select on implementations for select
  using (is_admin() or has_access(id));
create policy impl_insert on implementations for insert
  with check (is_admin());
create policy impl_update on implementations for update
  using (is_admin());
create policy impl_delete on implementations for delete
  using (is_admin());

-- touch_points: partners read + upsert on their implementations (parity
-- with updateTouchPoint being partner-callable); only admins delete.
create policy tp_select on touch_points for select
  using (is_admin() or has_access(implementation_id));
create policy tp_insert on touch_points for insert
  with check (is_admin() or has_access(implementation_id));
create policy tp_update on touch_points for update
  using (is_admin() or has_access(implementation_id));
create policy tp_delete on touch_points for delete
  using (is_admin());

-- raid_items: full CRUD for admins and partners with access.
create policy raid_select on raid_items for select
  using (is_admin() or has_access(implementation_id));
create policy raid_insert on raid_items for insert
  with check (is_admin() or has_access(implementation_id));
create policy raid_update on raid_items for update
  using (is_admin() or has_access(implementation_id));
create policy raid_delete on raid_items for delete
  using (is_admin() or has_access(implementation_id));

-- meeting_notes / scenario_sync: admin only.
create policy notes_all on meeting_notes for all
  using (is_admin()) with check (is_admin());
create policy scenarios_all on scenario_sync for all
  using (is_admin()) with check (is_admin());

-- access: partners can see and invite to their own implementations
-- (parity with addAccess); only admins revoke.
create policy access_select on access for select
  using (is_admin() or has_access(implementation_id));
create policy access_insert on access for insert
  with check (is_admin() or has_access(implementation_id));
create policy access_delete on access for delete
  using (is_admin());

-- ---------- updated_at maintenance ----------

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger implementations_touch before update on implementations
  for each row execute procedure touch_updated_at();
create trigger touch_points_touch before update on touch_points
  for each row execute procedure touch_updated_at();
