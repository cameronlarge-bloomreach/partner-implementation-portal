-- ============================================================
-- Lock down the documents bucket + legacy qa_checks, 2026-10-02.
-- Found while adding the Viewer role: the 'implementation-docs' bucket
-- is PUBLIC and has three catch-all storage policies granted to the
-- `public` role (which includes anonymous users), so uploaded contracts /
-- scope-of-work files can be read, uploaded and overwritten by anyone who
-- has the (publicly embedded) anon key and a file path. RLS on the
-- `documents` table hides the list from viewers, but not the files.
-- The app only ever downloads via createSignedUrl, which keeps working
-- through the admin / partner / SDC read policies that stay in place.
--
-- Also: legacy table qa_checks (not used by the frontend any more) has
-- read/insert/update/delete policies open to everyone.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

update storage.buckets set public = false where id = 'implementation-docs';

drop policy if exists "Allow public read on implementation-docs" on storage.objects;
drop policy if exists "Allow upload to implementation-docs" on storage.objects;
drop policy if exists "Allow update on implementation-docs" on storage.objects;
-- Kept: "impl docs admin all", "impl docs partner read", "impl docs sdc read".

drop policy if exists "Allow read access to qa_checks" on qa_checks;
drop policy if exists "Allow insert on qa_checks" on qa_checks;
drop policy if exists "Allow update on qa_checks" on qa_checks;
drop policy if exists "Allow delete on qa_checks" on qa_checks;
create policy qa_checks_admin_all on qa_checks for all
  using (is_admin()) with check (is_admin());
