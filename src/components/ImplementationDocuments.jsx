import { useRef, useState } from 'react'
import { uploadDocument, addDocumentLink, getDocumentUrl, deleteDocument } from '../api'

function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Uploaded documents (e.g. partner SOW) for one implementation.
// editable=true → admin upload/delete; editable=false → partner download only.
export default function ImplementationDocuments({ credential, implementationId, documents, editable, onChange }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [opening, setOpening] = useState(null)
  const [addingLink, setAddingLink] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [savingLink, setSavingLink] = useState(false)

  async function onPick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    if (file.size > 25 * 1024 * 1024) { setError('File is larger than 25 MB.'); return }
    setUploading(true)
    const res = await uploadDocument(credential, implementationId, file)
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    if (res.error) { setError(res.error); return }
    onChange([res.doc, ...documents])
  }

  async function open(doc) {
    if (doc.url) { window.open(doc.url, '_blank', 'noopener'); return } // link entry
    setOpening(doc.id)
    const res = await getDocumentUrl(credential, doc.file_path)
    setOpening(null)
    if (res.error) { setError(res.error); return }
    window.open(res.url, '_blank', 'noopener')
  }

  async function saveLink(e) {
    e.preventDefault()
    if (!linkUrl.trim()) return
    setSavingLink(true)
    const res = await addDocumentLink(credential, implementationId, { url: linkUrl, label: linkLabel })
    setSavingLink(false)
    if (res.error) { setError(res.error); return }
    onChange([res.doc, ...documents])
    setLinkUrl(''); setLinkLabel(''); setAddingLink(false)
  }

  async function remove(doc) {
    if (!confirm(`Delete "${doc.file_name}"? This removes the file permanently.`)) return
    const res = await deleteDocument(credential, doc)
    if (res.error) { setError(res.error); return }
    onChange(documents.filter(d => d.id !== doc.id))
  }

  return (
    <div>
      {error && <div className="text-xs mb-2" style={{ color: 'var(--rust)' }}>{error}</div>}
      {documents.length === 0 ? (
        <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
          {editable ? 'No documents uploaded yet.' : 'No documents.'}
        </p>
      ) : (
        <ul className="mb-2" style={{ border: '1px solid var(--hairline)', borderRadius: '0.5rem', overflow: 'hidden' }}>
          {documents.map(doc => (
            <li key={doc.id} className="flex items-center gap-3 px-3 py-2" style={{ borderBottom: '1px solid var(--hairline)' }}>
              <span className="text-sm">{doc.url ? '🔗' : '📄'}</span>
              <button
                onClick={() => open(doc)}
                disabled={opening === doc.id}
                className="min-w-0 text-left text-sm truncate hover:underline disabled:opacity-50"
                style={{ color: 'var(--arctic)' }}
                title={doc.url || doc.file_name}
              >
                {opening === doc.id ? 'Opening…' : doc.file_name}
              </button>
              <span className="ml-auto shrink-0 font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
                {doc.url ? 'link' : fmtSize(doc.file_size)}
              </span>
              {editable && (
                <button className="shrink-0 text-xs" style={{ color: 'var(--rust)' }} onClick={() => remove(doc)}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={onPick}
            className="hidden"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-sm font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              style={{ border: '1px solid var(--hairline)', color: 'var(--ink)' }}
            >
              {uploading ? 'Uploading…' : 'Upload document'}
            </button>
            <button
              onClick={() => setAddingLink(v => !v)}
              className="text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
              style={{ border: '1px solid var(--hairline)', color: 'var(--ink)' }}
            >
              Add link
            </button>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>PDF or Word up to 25 MB, or a link to a doc</span>
          </div>
          {addingLink && (
            <form onSubmit={saveLink} className="mt-2 flex flex-col gap-2 max-w-md">
              <input
                type="text"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://docs.google.com/…"
                className="rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                style={{ border: '1px solid var(--hairline)' }}
                autoFocus
              />
              <input
                type="text"
                value={linkLabel}
                onChange={e => setLinkLabel(e.target.value)}
                placeholder="Label (optional, e.g. Everyman SOW — Google Doc)"
                className="rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                style={{ border: '1px solid var(--hairline)' }}
              />
              <div className="flex gap-2">
                <button type="submit" disabled={savingLink} className="text-black text-sm font-medium px-4 py-1.5 rounded-lg disabled:opacity-50" style={{ background: 'var(--gold)' }}>
                  {savingLink ? 'Saving…' : 'Add link'}
                </button>
                <button type="button" onClick={() => { setAddingLink(false); setLinkUrl(''); setLinkLabel('') }} className="text-sm px-3 py-1.5" style={{ color: 'var(--muted)' }}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
