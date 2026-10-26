-- ============================================================
-- Account team read access, 2026-10-26. A Customer Success Manager
-- or Account Manager (account-team.sql) automatically gets READ-ONLY
-- access to the implementations they're assigned to by email — so
-- inviting them to BLIMP is all that's needed, no separate grant.
--
-- Same reach as the Viewer role (viewer-role.sql), scoped to their
-- assigned implementations: SELECT policies only, never insert /
-- update / delete, and deliberately nothing on documents, scope_items,
-- access or the docs storage bucket. has_access() is NOT touched —
-- it also gates partner writes (RAID, touch points, QA), which the
-- account team must not get.
-- Run once in the Supabase SQL Editor after account-team.sql. Safe to re-run.
-- ============================================================

create or replace function is_account_team(impl_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select caller_email() <> '' and exists (
    select 1 from implementations
    where id = impl_id
      and caller_email() in (lower(csm_email), lower(am_email))
  );
$$;

drop policy if exists impl_select_team on implementations;
create policy impl_select_team on implementations for select
  using (caller_email() <> '' and caller_email() in (lower(csm_email), lower(am_email)));

drop policy if exists tp_select_team on touch_points;
create policy tp_select_team on touch_points for select
  using (is_account_team(implementation_id));

drop policy if exists raid_select_team on raid_items;
create policy raid_select_team on raid_items for select
  using (is_account_team(implementation_id));

drop policy if exists usage_metrics_select_team on usage_metrics;
create policy usage_metrics_select_team on usage_metrics for select
  using (is_account_team(implementation_id));

drop policy if exists notes_select_team on meeting_notes;
create policy notes_select_team on meeting_notes for select
  using (is_account_team(implementation_id));

drop policy if exists scenarios_select_team on scenario_sync;
create policy scenarios_select_team on scenario_sync for select
  using (is_account_team(implementation_id));

drop policy if exists qa_workbook_select_team on qa_workbook_entries;
create policy qa_workbook_select_team on qa_workbook_entries for select
  using (is_account_team(implementation_id));

drop policy if exists workfront_hours_select_team on workfront_hours;
create policy workfront_hours_select_team on workfront_hours for select
  using (is_account_team(implementation_id));
