-- ============================================================
-- SDC role, 2026-09-08. A third permission tier alongside admin
-- and partner: SDC can see every implementation and every tab
-- (same read access as admin), but can only WRITE to QA workbook
-- entries — everything else (touch points, RAID, documents, dates,
-- Slack config, org link, pricing, usage meters, meeting notes,
-- progress steps, partner access, implementation actions) stays
-- admin-only to write.
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

-- ---------- SDC membership ----------

create table if not exists sdc_emails (
  email text primary key
);

alter table sdc_emails enable row level security;

drop policy if exists sdc_emails_select on sdc_emails;
create policy sdc_emails_select on sdc_emails for select
  using (is_admin());
drop policy if exists sdc_emails_insert on sdc_emails;
create policy sdc_emails_insert on sdc_emails for insert
  with check (is_admin());
drop policy if exists sdc_emails_delete on sdc_emails;
create policy sdc_emails_delete on sdc_emails for delete
  using (is_admin());

create or replace function is_sdc()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from sdc_emails where email = caller_email());
$$;

-- ---------- Read access: add is_sdc() everywhere is_admin() already
-- ---------- granted full visibility, so SDC sees every implementation
-- ---------- and every tab exactly like admin does.

drop policy if exists impl_select_sdc on implementations;
create policy impl_select_sdc on implementations for select
  using (is_sdc());

drop policy if exists tp_select_sdc on touch_points;
create policy tp_select_sdc on touch_points for select
  using (is_sdc());

drop policy if exists raid_select_sdc on raid_items;
create policy raid_select_sdc on raid_items for select
  using (is_sdc());

drop policy if exists access_select_sdc on access;
create policy access_select_sdc on access for select
  using (is_sdc());

drop policy if exists documents_select_sdc on documents;
create policy documents_select_sdc on documents for select
  using (is_sdc());

drop policy if exists scope_select_sdc on scope_items;
create policy scope_select_sdc on scope_items for select
  using (is_sdc());

drop policy if exists usage_metrics_select_sdc on usage_metrics;
create policy usage_metrics_select_sdc on usage_metrics for select
  using (is_sdc());

-- meeting_notes / scenario_sync were "for all using(is_admin())" — a
-- single admin-only policy covering select+insert+update+delete. Split
-- each into its own select/insert/update/delete so SDC can be added to
-- select only, without touching write.
drop policy if exists notes_all on meeting_notes;
drop policy if exists notes_select on meeting_notes;
create policy notes_select on meeting_notes for select
  using (is_admin() or is_sdc());
drop policy if exists notes_insert on meeting_notes;
create policy notes_insert on meeting_notes for insert
  with check (is_admin());
drop policy if exists notes_update on meeting_notes;
create policy notes_update on meeting_notes for update
  using (is_admin());
drop policy if exists notes_delete on meeting_notes;
create policy notes_delete on meeting_notes for delete
  using (is_admin());

drop policy if exists scenarios_all on scenario_sync;
drop policy if exists scenarios_select on scenario_sync;
create policy scenarios_select on scenario_sync for select
  using (is_admin() or is_sdc());
drop policy if exists scenarios_insert on scenario_sync;
create policy scenarios_insert on scenario_sync for insert
  with check (is_admin());
drop policy if exists scenarios_update on scenario_sync;
create policy scenarios_update on scenario_sync for update
  using (is_admin());
drop policy if exists scenarios_delete on scenario_sync;
create policy scenarios_delete on scenario_sync for delete
  using (is_admin());

-- Storage: SDC gets the same read-only download access as a partner
-- with has_access, but for every implementation's docs.
drop policy if exists "impl docs sdc read" on storage.objects;
create policy "impl docs sdc read" on storage.objects for select
  using (bucket_id = 'implementation-docs' and is_sdc());

-- ---------- Write access: QA workbooks only ----------

drop policy if exists qa_workbook_select on qa_workbook_entries;
create policy qa_workbook_select on qa_workbook_entries for select
  using (is_admin() or is_sdc() or has_access(implementation_id));
drop policy if exists qa_workbook_insert on qa_workbook_entries;
create policy qa_workbook_insert on qa_workbook_entries for insert
  with check (is_admin() or is_sdc() or has_access(implementation_id));
drop policy if exists qa_workbook_update on qa_workbook_entries;
create policy qa_workbook_update on qa_workbook_entries for update
  using (is_admin() or is_sdc() or has_access(implementation_id));
-- qa_workbook_delete stays admin-only (unchanged from qa-workbooks.sql).
