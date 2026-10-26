import { useEffect, useState } from 'react'
import { updateAccountContact, listBloomreachPeople, inviteUser } from '../api'

// Internal account team for an implementation: Partner Services Manager,
// Customer Success Manager and Account Manager. Internal-only (the API
// doesn't return these to partners); admins edit, SDC/viewers just see.

// PSM is fixed to the two PSMs today — add another { name, email } here if
// a third comes on board. CSM / AM are set by email alone: that's what will
// match them to their accounts once they're invited to BLIMP. Their name is
// taken from their BLIMP profile when they have one, else from the email.
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

// priya.shah@bloomreach.com -> "Priya Shah"
function nameFromEmail(email) {
  return (email || '').split('@')[0].split(/[._-]+/).filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function ContactRow({ role, name, email, isAdmin, people, clientName, onSave }) {
  const [editing, setEditing] = useState(false)
  const [invite, setInvite] = useState(null) // null | 'sending' | 'sent'
  const [input, setInput] = useState({ name: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const cleanEmail = input.email.trim().toLowerCase()
    if (role.key !== 'psm' && cleanEmail && !EMAIL_RE.test(cleanEmail)) {
      setSaving(false)
      return setError('Enter a valid email address.')
    }
    const cleanName = role.key === 'psm' ? input.name.trim()
      : !cleanEmail ? ''
      : people.find(p => p.email === cleanEmail)?.name || nameFromEmail(cleanEmail)
    const err = await onSave(role.key, cleanName, cleanEmail)
    setSaving(false)
    if (err) setError(err)
    else setEditing(false)
  }

  // Assignment is their access (account-team-access.sql), so the invite
  // only has to create the account — no grant needed first.
  async function sendInvite() {
    setInvite('sending')
    setError(null)
    const [firstName, ...rest] = (name || nameFromEmail(email)).split(' ')
    const res = await inviteUser(email, {
      firstName, lastName: rest.join(' '),
      accessLabel: `${clientName} (as ${role.label})`,
    })
    if (res.error) { setInvite(null); setError(res.error) }
    else setInvite('sent')
  }

  const notOnBlimp = isAdmin && role.key !== 'psm' && email && !people.some(p => p.email === email)

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
            {email ? 'Edit' : 'Set'}
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
              <input
                type="email"
                list={`people-${role.key}`}
                value={input.email}
                onChange={e => setInput({ name: '', email: e.target.value })}
                placeholder="name@bloomreach.com"
                className={`${inputClass} w-60`}
                style={inputStyle}
                autoFocus
              />
              <datalist id={`people-${role.key}`}>
                {people.map(p => <option key={p.email} value={p.email}>{p.name}</option>)}
              </datalist>
            </>
          )}
          <button type="submit" disabled={saving} className="text-black text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: 'var(--gold)' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs px-1.5 py-1.5" style={{ color: 'var(--muted)' }}>Cancel</button>
          {email && role.key !== 'psm' && (
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
      ) : email || name ? (
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[11px] font-semibold shrink-0" style={{ background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--hairline)' }} aria-hidden="true">
            {initials(name || nameFromEmail(email))}
          </span>
          <div className="min-w-0">
            <div className="text-[13.5px] truncate" style={{ color: 'var(--ink)' }}>
              {name || nameFromEmail(email)}
              {/* Only admins can list profiles, so only they get the badge */}
              {notOnBlimp && (
                <span className="ml-2 text-[10.5px] font-medium px-1.5 py-0.5 rounded-full align-middle" style={{ background: 'var(--paper)', color: 'var(--muted)', border: '1px solid var(--hairline)' }}>
                  Not on BLIMP yet
                </span>
              )}
            </div>
            {email && <a href={`mailto:${email}`} className="font-mono text-[11.5px] truncate block hover:underline" style={{ color: 'var(--muted)' }}>{email}</a>}
          </div>
          {notOnBlimp && (
            invite === 'sent'
              ? <span className="ml-auto text-xs shrink-0" style={{ color: 'var(--moss)' }}>Invite sent ✓</span>
              : (
                <button
                  onClick={sendInvite}
                  disabled={invite === 'sending'}
                  className="ml-auto shrink-0 disabled:opacity-50 text-xs font-medium px-2.5 py-1 rounded-lg"
                  style={{ background: 'var(--ink)', color: '#fff' }}
                >
                  {invite === 'sending' ? 'Sending…' : 'Invite'}
                </button>
              )
          )}
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>Not set</p>
      )}
      {!editing && error && <p className="text-xs mt-1.5" style={{ color: 'var(--rust)' }}>{error}</p>}
    </div>
  )
}

export default function AccountTeam({ impl, isAdmin, onChange }) {
  const [people, setPeople] = useState([])

  useEffect(() => {
    if (isAdmin) listBloomreachPeople().then(res => setPeople(res.people || [])).catch(() => {})
  }, [isAdmin])

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
          people={people}
          clientName={impl.client_name}
          onSave={save}
        />
      ))}
    </div>
  )
}
