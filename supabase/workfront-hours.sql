-- Consultant hours synced from Workfront (applied 2026-10-02).
alter table implementations add column if not exists workfront_project_id text not null default '';

create table if not exists workfront_hours (
  implementation_id uuid not null references implementations(id) on delete cascade,
  task_kind text not null check (task_kind in ('activation_services', 'activation_support')),
  planned_hours numeric,
  actual_hours numeric,
  workfront_task_id text not null default '',
  synced_at timestamptz not null default now(),
  primary key (implementation_id, task_kind)
);

alter table workfront_hours enable row level security;
create policy workfront_hours_select on workfront_hours for select
  using (is_admin() or is_sdc() or has_access(implementation_id));
create policy workfront_hours_insert on workfront_hours for insert with check (is_admin());
create policy workfront_hours_update on workfront_hours for update using (is_admin());
create policy workfront_hours_delete on workfront_hours for delete using (is_admin());

-- 2026-10-02: third kind for additional consultancy hours
alter table workfront_hours drop constraint if exists workfront_hours_task_kind_check;
alter table workfront_hours add constraint workfront_hours_task_kind_check
  check (task_kind in ('activation_services', 'activation_support', 'consulting_services'));
