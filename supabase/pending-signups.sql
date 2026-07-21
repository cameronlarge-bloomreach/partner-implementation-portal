-- ============================================================
-- Pending sign-ups: mirror auth.users into a visible profiles
-- table so admins can approve new accounts from the dashboard.
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, created_at)
  values (new.id, lower(new.email), new.created_at)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Backfill accounts created before this table existed
insert into profiles (id, email, created_at)
select id, lower(email), created_at from auth.users
where email is not null
on conflict (id) do nothing;

alter table profiles enable row level security;

drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select
  using (is_admin() or id = auth.uid());

-- Admins need to read the admin list to filter it out of pending sign-ups
drop policy if exists admin_emails_select on admin_emails;
create policy admin_emails_select on admin_emails for select
  using (is_admin());
