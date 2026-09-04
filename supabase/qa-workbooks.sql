-- ============================================================
-- QA Workbook entries — one row per (implementation, QA step),
-- 2026-09-04. Replaces the static QA Peer Review dropdown with a
-- live, in-portal version of the SDC "QA Workbook" review docs
-- (checklist per step, pass/fail + severity + notes per check,
-- action list, partner response, sign-off). Admin (SDC) edits the
-- checks/notes/actions/SDC sign-off; the partner can edit their
-- own response + sign-off and reads the rest.
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

create table if not exists qa_workbook_entries (
  implementation_id uuid not null references implementations(id) on delete cascade,
  step_key text not null,               -- e.g. 'qa_peer_review_1'
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (implementation_id, step_key)
);

alter table qa_workbook_entries enable row level security;

-- Same shape as touch_points/raid_items: partners with access can read and
-- write (they own the "Partner response" + "Partner sign-off" fields, same
-- parity as updateTouchPoint being partner-callable); only admins delete.
drop policy if exists qa_workbook_select on qa_workbook_entries;
create policy qa_workbook_select on qa_workbook_entries for select
  using (is_admin() or has_access(implementation_id));
drop policy if exists qa_workbook_insert on qa_workbook_entries;
create policy qa_workbook_insert on qa_workbook_entries for insert
  with check (is_admin() or has_access(implementation_id));
drop policy if exists qa_workbook_update on qa_workbook_entries;
create policy qa_workbook_update on qa_workbook_entries for update
  using (is_admin() or has_access(implementation_id));
drop policy if exists qa_workbook_delete on qa_workbook_entries;
create policy qa_workbook_delete on qa_workbook_entries for delete
  using (is_admin());
