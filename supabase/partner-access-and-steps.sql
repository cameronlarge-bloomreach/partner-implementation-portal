-- ============================================================
-- Partner-level access grants, admin management, and editable
-- progress steps. Run once in the Supabase SQL Editor after
-- pending-signups.sql. Safe to re-run.
-- ============================================================

-- 1. Partner-level access: one grant covers every implementation
--    for that partner, including ones created later.
create table if not exists partner_access (
  email text not null,
  partner_name text not null,
  primary key (email, partner_name)
);

alter table partner_access enable row level security;

drop policy if exists partner_access_select on partner_access;
create policy partner_access_select on partner_access for select
  using (is_admin() or email = caller_email());
drop policy if exists partner_access_insert on partner_access;
create policy partner_access_insert on partner_access for insert
  with check (is_admin());
drop policy if exists partner_access_delete on partner_access;
create policy partner_access_delete on partner_access for delete
  using (is_admin());

-- has_access now honours both individual and partner-level grants.
create or replace function has_access(impl_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from access
    where email = caller_email() and implementation_id = impl_id
  ) or exists (
    select 1
    from partner_access pa
    join implementations i on i.id = impl_id
    where pa.email = caller_email()
      and lower(pa.partner_name) = lower(i.partner_name)
  );
$$;

-- 2. Admins can manage the admin list (approve-as-admin from the dashboard).
drop policy if exists admin_emails_insert on admin_emails;
create policy admin_emails_insert on admin_emails for insert
  with check (is_admin());
drop policy if exists admin_emails_delete on admin_emails;
create policy admin_emails_delete on admin_emails for delete
  using (is_admin());

-- 3. Editable progress steps (touch points + QA), seeded with the
--    current hardcoded lists. The UI reads these; admins edit them.
create table if not exists step_definitions (
  key text primary key,
  label text not null,
  category text not null check (category in ('touchpoint', 'qa')),
  position integer not null default 0
);

alter table step_definitions enable row level security;

drop policy if exists steps_select on step_definitions;
create policy steps_select on step_definitions for select
  to authenticated using (true);
drop policy if exists steps_insert on step_definitions;
create policy steps_insert on step_definitions for insert
  with check (is_admin());
drop policy if exists steps_update on step_definitions;
create policy steps_update on step_definitions for update
  using (is_admin());
drop policy if exists steps_delete on step_definitions;
create policy steps_delete on step_definitions for delete
  using (is_admin());

insert into step_definitions (key, label, category, position) values
  ('account_creation',     'Account Creation',                  'touchpoint', 1),
  ('frontend_data',        'Front End Data',                    'touchpoint', 2),
  ('backend_data',         'Backend Data',                      'touchpoint', 3),
  ('integration_sms',      'SMS Integration',                   'touchpoint', 4),
  ('integration_email',    'Email Integration',                 'touchpoint', 5),
  ('integration_whatsapp', 'WhatsApp Integration',              'touchpoint', 6),
  ('use_cases',            'Use Cases',                         'touchpoint', 7),
  ('qa_peer_review_1',     'ID Validation',                     'qa', 1),
  ('qa_peer_review_2',     'Back End Tracking',                 'qa', 2),
  ('qa_peer_review_3',     'Front End Tracking',                'qa', 3),
  ('qa_peer_review_4',     'Use Cases Data Check & Debugging',  'qa', 4),
  ('qa_peer_review_5',     'Data Mapping',                      'qa', 5),
  ('qa_peer_review_6',     'Expiration & Data Cleanliness',     'qa', 6)
on conflict (key) do nothing;
