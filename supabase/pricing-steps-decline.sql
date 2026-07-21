-- ============================================================
-- Three changes, 2026-07-21:
--   1. Per-client pricing model (profiles vs events) + event usage
--   2. Progress steps editable per implementation
--   3. Ability to decline a pending sign-up
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

-- 1. Pricing model + event usage -----------------------------

alter table implementations
  add column if not exists pricing_model text not null default 'profiles';

do $$ begin
  alter table implementations add constraint implementations_pricing_model_check
    check (pricing_model in ('profiles', 'events'));
exception when duplicate_object then null; end $$;

alter table implementations add column if not exists event_count bigint;
alter table implementations add column if not exists event_count_synced_at timestamptz;

-- 2. Steps per implementation --------------------------------
-- implementation_id null = the global default template, used by any
-- implementation that hasn't customised its own list.

alter table step_definitions
  add column if not exists implementation_id uuid references implementations(id) on delete cascade;

-- The old primary key was `key` alone, which blocks the same step key
-- existing for several implementations. Move to a surrogate id.
alter table step_definitions add column if not exists id uuid default gen_random_uuid();
update step_definitions set id = gen_random_uuid() where id is null;

do $$ begin
  alter table step_definitions drop constraint step_definitions_pkey;
  alter table step_definitions add primary key (id);
exception when others then null; end $$;

-- A step key must be unique within its scope (per implementation, or globally).
create unique index if not exists step_definitions_scope_key
  on step_definitions (coalesce(implementation_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

-- 3. Decline a sign-up ---------------------------------------

alter table profiles add column if not exists declined boolean not null default false;
alter table profiles add column if not exists decided_at timestamptz;

-- Admins need to update profiles to mark them declined.
drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update
  using (is_admin()) with check (is_admin());
