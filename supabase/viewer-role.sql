-- ============================================================
-- Viewer role, 2026-10-02. A fourth permission tier alongside admin,
-- SDC and partner: a viewer can SEE every implementation and most of
-- what's on it (progress, RAID, usage, Workfront hours, meeting notes,
-- scenarios, QA workbooks) but can WRITE nothing, and never sees
-- documents / scope of work / contracts.
--
-- Deliberately NOT granted to viewers (no policy added, so RLS denies):
--   documents, scope_items, storage 'implementation-docs' objects,
--   access (who has partner access), partner_access, profiles.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

-- ---------- Viewer membership ----------

create table if not exists viewer_emails (
  email text primary key
);

alter table viewer_emails enable row level security;

drop policy if exists viewer_emails_select on viewer_emails;
create policy viewer_emails_select on viewer_emails for select
  using (is_admin());
drop policy if exists viewer_emails_insert on viewer_emails;
create policy viewer_emails_insert on viewer_emails for insert
  with check (is_admin());
drop policy if exists viewer_emails_delete on viewer_emails;
create policy viewer_emails_delete on viewer_emails for delete
  using (is_admin());

create or replace function is_viewer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from viewer_emails where email = caller_email());
$$;

-- ---------- Read-only (SELECT) access ----------

drop policy if exists impl_select_viewer on implementations;
create policy impl_select_viewer on implementations for select
  using (is_viewer());

drop policy if exists tp_select_viewer on touch_points;
create policy tp_select_viewer on touch_points for select
  using (is_viewer());

drop policy if exists raid_select_viewer on raid_items;
create policy raid_select_viewer on raid_items for select
  using (is_viewer());

drop policy if exists usage_metrics_select_viewer on usage_metrics;
create policy usage_metrics_select_viewer on usage_metrics for select
  using (is_viewer());

drop policy if exists notes_select_viewer on meeting_notes;
create policy notes_select_viewer on meeting_notes for select
  using (is_viewer());

drop policy if exists scenarios_select_viewer on scenario_sync;
create policy scenarios_select_viewer on scenario_sync for select
  using (is_viewer());

drop policy if exists qa_workbook_select_viewer on qa_workbook_entries;
create policy qa_workbook_select_viewer on qa_workbook_entries for select
  using (is_viewer());

drop policy if exists workfront_hours_select_viewer on workfront_hours;
create policy workfront_hours_select_viewer on workfront_hours for select
  using (is_viewer());

-- No INSERT / UPDATE / DELETE policy mentions is_viewer(), so viewers
-- cannot write anywhere.
