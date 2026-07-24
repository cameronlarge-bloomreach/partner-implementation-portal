-- ============================================================
-- Four Bloomreach billing meters per implementation, 2026-07-24.
-- Events model:   processed_events (PE), max_event_storage (MES)
-- Profiles model: billable_profiles, muv (Monthly Unique Visitors)
-- Usage + limit are entered manually (dashboard-sourced) — these
-- meters aren't reliably exposed by the API. Admin-only.
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

create table if not exists usage_metrics (
  implementation_id uuid not null references implementations(id) on delete cascade,
  metric_key text not null check (metric_key in (
    'billable_profiles', 'muv', 'processed_events', 'max_event_storage'
  )),
  usage_value bigint,   -- current usage (manual, from the usage dashboard)
  usage_limit bigint,   -- contracted allowance (manual, from the order form)
  updated_at timestamptz not null default now(),
  primary key (implementation_id, metric_key)
);

alter table usage_metrics enable row level security;

-- Internal Bloomreach data — admin only (partners don't see usage/limits).
drop policy if exists usage_metrics_select on usage_metrics;
create policy usage_metrics_select on usage_metrics for select using (is_admin());
drop policy if exists usage_metrics_write on usage_metrics;
create policy usage_metrics_write on usage_metrics for all
  using (is_admin()) with check (is_admin());
