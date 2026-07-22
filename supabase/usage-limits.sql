-- ============================================================
-- Contracted usage limits per implementation, 2026-07-22.
-- One limit per meter; the Control Centre shows usage against
-- whichever matches the client's pricing_model. Run once.
-- ============================================================

alter table implementations add column if not exists profile_limit bigint;
alter table implementations add column if not exists event_limit bigint;
