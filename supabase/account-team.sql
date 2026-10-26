-- ============================================================
-- Account team per implementation, 2026-10-26. Adds a Customer
-- Success Manager and an Account Manager alongside the PSM
-- (psm-owner.sql) — same free-text name + email pattern, admin-set,
-- internal-only (not returned to partners).
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

alter table implementations add column if not exists csm_name text not null default '';
alter table implementations add column if not exists csm_email text not null default '';
alter table implementations add column if not exists am_name text not null default '';
alter table implementations add column if not exists am_email text not null default '';
