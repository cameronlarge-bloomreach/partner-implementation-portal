-- ============================================================
-- Partner scope of work per implementation, 2026-07-22.
-- Three categories: in scope / out of scope / assumptions.
-- Admin-editable, partner-visible (read-only for partners).
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

create table if not exists scope_items (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null references implementations(id) on delete cascade,
  category text not null check (category in ('in_scope', 'out_of_scope', 'assumption')),
  title text not null,
  detail text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table scope_items enable row level security;

-- Partners with access read their own; admins read all.
drop policy if exists scope_select on scope_items;
create policy scope_select on scope_items for select
  using (is_admin() or has_access(implementation_id));

-- Only admins write.
drop policy if exists scope_insert on scope_items;
create policy scope_insert on scope_items for insert with check (is_admin());
drop policy if exists scope_update on scope_items;
create policy scope_update on scope_items for update using (is_admin());
drop policy if exists scope_delete on scope_items;
create policy scope_delete on scope_items for delete using (is_admin());
