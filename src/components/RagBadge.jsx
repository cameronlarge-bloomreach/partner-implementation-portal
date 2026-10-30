import { RAG_STATUSES } from '../api'

// RAG health pill — shared by the implementation header and the cards on
// the admin dashboard / partner home, so partners and Bloomreach see it the
// same way. Renders nothing until an admin has set one.
export default function RagBadge({ rag, title }) {
  const meta = RAG_STATUSES[rag?.status]
  if (!meta) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: meta.bg, color: meta.color }} title={title ?? (rag.note || meta.label)}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
      {meta.short} · {meta.label}
    </span>
  )
}
