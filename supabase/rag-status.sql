-- RAG status (applied 2026-10-30). Set by Bloomreach admins, shown to
-- partners too. '' = not set yet. Writes go through the existing
-- impl_update policy (is_admin()).
alter table implementations add column if not exists rag_status text not null default ''
  check (rag_status in ('', 'green', 'amber', 'red'));
alter table implementations add column if not exists rag_note text not null default '';
alter table implementations add column if not exists rag_updated_at timestamptz;
alter table implementations add column if not exists rag_updated_by text not null default '';
