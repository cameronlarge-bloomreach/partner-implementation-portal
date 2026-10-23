-- ============================================================
-- Richer sign-up: capture name, partner and job title at sign-up
-- (passed as auth user metadata) so admins can see who someone is
-- and which partner they're from before approving them.
-- Run once in the Supabase SQL Editor after pending-signups.sql.
-- Safe to re-run.
-- ============================================================

alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name text;
alter table profiles add column if not exists partner_name text;
alter table profiles add column if not exists job_title text;

-- Copies the sign-up form's metadata into profiles. Every field is
-- optional here — a missing or blank value must never block account creation.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, created_at, first_name, last_name, partner_name, job_title)
  values (
    new.id,
    lower(new.email),
    new.created_at,
    nullif(trim(new.raw_user_meta_data->>'first_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'last_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'partner_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'job_title'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Partner is a free-text field, so no public partner list is exposed.
drop function if exists list_partner_names();
