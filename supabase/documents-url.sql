-- ============================================================
-- Allow a document entry to be a URL link instead of an uploaded
-- file, 2026-07-22. Run once in the Supabase SQL Editor.
-- ============================================================

-- A link row has url set and file_path null; a file row is the reverse.
alter table documents alter column file_path drop not null;
alter table documents add column if not exists url text;

-- Every row must be one or the other.
do $$ begin
  alter table documents add constraint documents_file_or_url
    check (file_path is not null or url is not null);
exception when duplicate_object then null; end $$;
