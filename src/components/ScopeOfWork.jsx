import { useState } from 'react'
import { addScopeItem, updateScopeItem, deleteScopeItem } from '../api'

const CATEGORIES = [
  { key: 'in_scope', label: 'In scope', accent: 'var(--moss)' },
  { key: 'out_of_scope', label: 'Out of scope', accent: 'var(--rust)' },
  { key: 'assumption', label: 'Assumptions', accent: 'var(--gold)' },
]

// Scope of work for one implementation, in three categories.
// editable=true → admin CRUD; editable=false → partner read-only.
// `items` is the impl.scope array; onChange(nextItems) keeps the parent in sync.
export default function ScopeOfWork({ credential, implementationId, items, editable, onChange }) {
  const byCat = key => items.filter(i => i.category === key).sort((a, b) => a.position - b.position)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {CATEGORIES.map(cat => (
        <ScopeColumn
          key={cat.key}
          cat={cat}
          items={byCat(cat.key)}
          editable={editable}
          credential={credential}
          implementationId={implementationId}
          onChange={onChange}
          allItems={items}
        />
      ))}
    </div>
  )
}

function ScopeColumn({ cat, items, editable, credential, implementationId, onChange, allItems }) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDetail, setEditDetail] = useState('')
  const [busy, setBusy] = useState(false)

  async function add(e) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    const res = await addScopeItem(credential, implementationId, { category: cat.key, title, detail })
    setBusy(false)
    if (res.error) return
    const maxPos = Math.max(0, ...allItems.filter(i => i.category === cat.key).map(i => i.position))
    onChange([...allItems, { id: res.id, category: cat.key, title: title.trim(), detail: detail.trim(), position: maxPos + 1 }])
    setTitle(''); setDetail(''); setAdding(false)
  }

  async function saveEdit(id) {
    setBusy(true)
    const res = await updateScopeItem(credential, id, { title: editTitle.trim(), detail: editDetail.trim() })
    setBusy(false)
    if (res.error) return
    onChange(allItems.map(i => (i.id === id ? { ...i, title: editTitle.trim(), detail: editDetail.trim() } : i)))
    setEditingId(null)
  }

  async function remove(id, itemTitle) {
    if (!confirm(`Remove "${itemTitle}" from scope?`)) return
    const res = await deleteScopeItem(credential, id)
    if (res.error) return
    onChange(allItems.filter(i => i.id !== id))
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--hairline)', borderTop: `3px solid ${cat.accent}` }}>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'var(--paper)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{cat.label}</span>
        <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{items.length}</span>
      </div>
      <ul style={{ borderTop: '1px solid var(--hairline)' }}>
        {items.map(item => (
          <li key={item.id} className="px-4 py-2.5 group" style={{ borderBottom: '1px solid var(--hairline)' }}>
            {editingId === item.id ? (
              <div>
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                  style={{ border: '1px solid var(--hairline)' }}
                  autoFocus
                />
                <textarea
                  value={editDetail}
                  onChange={e => setEditDetail(e.target.value)}
                  placeholder="Detail (optional)"
                  rows={2}
                  className="w-full mt-1.5 rounded-lg px-2 py-1.5 text-xs resize-y focus:outline-none"
                  style={{ border: '1px solid var(--hairline)' }}
                />
                <div className="mt-1.5 flex gap-2">
                  <button disabled={busy} onClick={() => saveEdit(item.id)} className="text-xs font-medium px-3 py-1 rounded-lg text-black disabled:opacity-50" style={{ background: 'var(--gold)' }}>Save</button>
                  <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1" style={{ color: 'var(--muted)' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm" style={{ color: 'var(--ink)' }}>{item.title}</div>
                  {item.detail && <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{item.detail}</div>}
                </div>
                {editable && (
                  <span className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="text-xs px-1"
                      style={{ color: 'var(--arctic)' }}
                      onClick={() => { setEditingId(item.id); setEditTitle(item.title); setEditDetail(item.detail) }}
                    >Edit</button>
                    <button className="text-xs px-1" style={{ color: 'var(--rust)' }} onClick={() => remove(item.id, item.title)}>Remove</button>
                  </span>
                )}
              </div>
            )}
          </li>
        ))}
        {items.length === 0 && !adding && (
          <li className="px-4 py-3 text-xs italic" style={{ color: 'var(--muted)' }}>Nothing recorded.</li>
        )}
      </ul>
      {editable && (
        <div className="p-3">
          {adding ? (
            <form onSubmit={add}>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Item title"
                className="w-full rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                style={{ border: '1px solid var(--hairline)' }}
                autoFocus
              />
              <textarea
                value={detail}
                onChange={e => setDetail(e.target.value)}
                placeholder="Detail (optional)"
                rows={2}
                className="w-full mt-1.5 rounded-lg px-2 py-1.5 text-xs resize-y focus:outline-none"
                style={{ border: '1px solid var(--hairline)' }}
              />
              <div className="mt-1.5 flex gap-2">
                <button type="submit" disabled={busy} className="text-xs font-medium px-3 py-1 rounded-lg text-black disabled:opacity-50" style={{ background: 'var(--gold)' }}>Add</button>
                <button type="button" onClick={() => { setAdding(false); setTitle(''); setDetail('') }} className="text-xs px-2 py-1" style={{ color: 'var(--muted)' }}>Cancel</button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full rounded-lg border border-dashed px-3 py-1.5 text-xs transition-colors"
              style={{ borderColor: 'var(--hairline)', color: 'var(--muted)' }}
            >
              + Add item
            </button>
          )}
        </div>
      )}
    </div>
  )
}
