-- ============================================================
-- Partner Services Manager (internal owner) per implementation,
-- 2026-09-16. Free-text name + email, admin-set — same pattern as
-- the Bloomreach Org link (bloomreach_org_id/name). Internal-only
-- (not returned to partners), used so a ClickUp ticket raised by
-- whichever SDC member happens to be on shift still credits and
-- notifies the actual account owner, not just the raiser.
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

alter table implementations add column if not exists psm_name text not null default '';
alter table implementations add column if not exists psm_email text not null default '';
