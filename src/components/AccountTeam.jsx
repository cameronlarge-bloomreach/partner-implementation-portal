import { useState } from 'react'
import { updateAccountContact } from '../api'

// Internal account team for an implementation: Partner Services Manager,
// Customer Success Manager and Account Manager. Internal-only (the API
// doesn't return these to partners); admins edit, SDC/viewers just see.

// PSM is fixed to the two PSMs today — add another { name, email } here if
// a third comes on board. CSM / AM are free text: there's no fixed list.
const PSM_OPTIONS = [
  { name: 'Cameron Large', email: 'cameron.large@bloomreach.com' },
  { name: 'James Tewson', email: 'james.tewson@bloomreach.com' },
]

const ROLES = [
  { key: 'psm', label: 'Partner Services Manager', hint: 'Credited and notified on SDC tickets raised from here' },
  { key: 'csm', label: 'Customer Success Manager' },
  { key: 'am', label: 'Account Manager' },
]

const inputClass = 'rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none min-w-0'
const inputStyle = { border: '1px solid var(--hairline)' }

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function ContactRow({ role, name, email, isAdmin, onSave }) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState({ name: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const err = await onSave(role.key, input.name.trim(), input.email.trim().toLowerCase())
    setSaving(false)
    if (err) setError(err)
    else setEditing(false)
  }

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }} title={role.hint}>{role.label}</span>
        {isAdmin && !editing && (
          <button
            onClick={() => { setInput({ name: name || '', email: email || '' }); setError(null); setEditing(true) }}
            className="text-xs font-medium"
            style={{ color: 'var(--arctic)' }}
          >
            {name ? 'Edit' : 'Set'}
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          {role.key === 'psm' ? (
            <select
              value={input.email}
              onChange={e => {
                const chosen = PSM_OPTIONS.find(p => p.email === e.target.value)
                setInput(chosen ? { name: chosen.name, email: chosen.email } : { name: '', email: '' })
              }}
              className={inputClass}
              style={inputStyle}
            >
              <option value="">Not set</option>
              {PSM_OPTIONS.map(p => <option key={p.email} value={p.email}>{p.name}</option>)}
            </select>
          ) : (
            <>
              <input value={input.name} onChange={e => setInput(i => ({ ...i, name: e.target.value }))} placeholder="Name" className={`${inputClass} w-36`} style={inputStyle} autoFocus />
              <input type="email" value={input.email} onChange={e => setInput(i => ({ ...i, email: e.target.value }))} placeholder="name@bloomreach.com" className={`${inputClass} w-48`} style={inputStyle} />
            </>
          )}
          <button type="submit" disabled={saving} className="text-black text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: 'var(--gold)' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs px-1.5 py-1.5" style={{ color: 'var(--muted)' }}>Cancel</button>
          {name && role.key !== 'psm' && (
            <button
              type="button"
              onClick={() => setInput({ name: '', email: '' })}
              className="text-xs px-1.5 py-1.5 hover:underline"
              style={{ color: 'var(--rust)' }}
            >
              Clear
            </button>
          )}
          {error && <p className="basis-full text-xs" style={{ color: 'var(--rust)' }}>{error}</p>}
        </form>
      ) : name ? (
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[11px] font-semibold shrink-0" style={{ background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--hairline)' }} aria-hidden="true">
            {initials(name)}
          </span>
          <div className="min-w-0">
            <div className="text-[13.5px] truncate" style={{ color: 'var(--ink)' }}>{name}</div>
            {email && <a href={`mailto:${email}`} className="font-mono text-[11.5px] truncate block hover:underline" style={{ color: 'var(--muted)' }}>{email}</a>}
          </div>
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>Not set</p>
      )}
    </div>
  )
}

export default function AccountTeam({ impl, isAdmin, onChange }) {
  async function save(roleKey, name, email) {
    const res = await updateAccountContact(impl.id, roleKey, name, email)
    if (res.error) return res.error
    onChange({ [`${roleKey}Name`]: name, [`${roleKey}Email`]: email })
    return null
  }

  return (
    <div className="divide-y divide-[var(--hairline)]">
      {ROLES.map(role => (
        <ContactRow
          key={role.key}
          role={role}
          name={impl[`${role.key}Name`]}
          email={impl[`${role.key}Email`]}
          isAdmin={isAdmin}
          onSave={save}
        />
      ))}
    </div>
  )
}
