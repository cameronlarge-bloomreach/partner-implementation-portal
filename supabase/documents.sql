-- ============================================================
-- Uploaded documents per implementation (e.g. partner SOW),
-- 2026-07-22. Files live in a private Storage bucket; this table
-- holds the metadata. Admin-upload, partner-visible (download).
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

-- 1. Metadata table
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  implementation_id uuid not null references implementations(id) on delete cascade,
  file_path text not null unique,     -- path within the storage bucket
  file_name text not null,            -- original filename, for display
  file_size bigint,
  content_type text,
  uploaded_at timestamptz not null default now()
);

alter table documents enable row level security;

drop policy if exists documents_select on documents;
create policy documents_select on documents for select
  using (is_admin() or has_access(implementation_id));
drop policy if exists documents_insert on documents;
create policy documents_insert on documents for insert with check (is_admin());
drop policy if exists documents_delete on documents;
create policy documents_delete on documents for delete using (is_admin());

-- 2. Private storage bucket
insert into storage.buckets (id, name, public)
values ('implementation-docs', 'implementation-docs', false)
on conflict (id) do nothing;

-- 3. Storage access policies. Object path is "{implementation_id}/{filename}",
--    so the first folder segment identifies the implementation.
drop policy if exists "impl docs admin all" on storage.objects;
create policy "impl docs admin all" on storage.objects for all
  using (bucket_id = 'implementation-docs' and is_admin())
  with check (bucket_id = 'implementation-docs' and is_admin());

drop policy if exists "impl docs partner read" on storage.objects;
create policy "impl docs partner read" on storage.objects for select
  using (
    bucket_id = 'implementation-docs'
    and has_access(((storage.foldername(name))[1])::uuid)
  );
