import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  getAllAccess, approveSignup, inviteUser, declineSignup, deleteUserAccount,
  removeAdminAccess, removeSDCAccess, removeViewerAccess, removePartnerAccess,
} from '../api'
import Navbar from '../components/Navbar'
import ModalShell from '../components/ModalShell'
import { SkeletonBar } from '../components/Skeleton'

// Access is granted per partner (every implementation of theirs, now and
// future) or as a Bloomreach role. Single-implementation grants still work
// in the database (has_access) but are no longer offered here.

const ROLES = [
  { key: 'admin', label: 'Admin', hint: 'Full access to everything' },
  { key: 'sdc', label: 'SDC', hint: 'Sees everything, can only edit QA docs' },
  { key: 'viewer', label: 'Viewer', hint: 'Sees most things, can’t edit, no documents' },
]
const ROLE_LABEL = Object.fromEntries(ROLES.map(r => [r.key, r.label]))

// Muted tints that sit on the paper background; picked by hashing the email
// so a person keeps the same colour everywhere.
const AVATAR_TINTS = [
  ['#fff4bf', '#6b5600'], ['#dff1f9', '#015f86'], ['#eef6f0', '#1f7a4d'],
  ['#fbeee9', '#a3391f'], ['#efeaf7', '#5b3f8c'], ['#f1efe8', '#4a4a44'],
]
function tintFor(email) {
  let h = 0
  for (const c of email) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR_TINTS[h % AVATAR_TINTS.length]
}

function initialsFor(person) {
  if (person.firstName || person.lastName) {
    return ((person.firstName?.[0] || '') + (person.lastName?.[0] || '')).toUpperCase()
  }
  return person.email.slice(0, 2).toUpperCase()
}

function accessLabel(target) {
  if (target.type === 'partner') return `all ${target.partnerName} implementations`
  return `BLIMP as ${target.type === 'admin' ? 'an admin' : target.type === 'sdc' ? 'an SDC' : 'a viewer'}`
}

function parseChoice(choice) {
  if (ROLE_LABEL[choice]) return { type: choice }
  return { type: 'partner', partnerName: choice.slice(8) }
}

function Avatar({ person, size = 40 }) {
  const [bg, fg] = tintFor(person.email)
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold shrink-0"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initialsFor(person)}
    </span>
  )
}

function StatusPill({ person }) {
  const [label, bg, fg] = !person.hasAccount
    ? ['No account yet', 'var(--paper)', 'var(--muted)']
    : person.declined
    ? ['Declined', 'var(--rust-bg)', 'var(--rust)']
    : !person.hasAnyAccess
    ? ['Awaiting access', '#fff4bf', '#6b5600']
    : ['Active', 'var(--moss-bg)', 'var(--moss)']
  return (
    <span className="text-[11px] font-medium rounded-full px-2 py-0.5 whitespace-nowrap" style={{ background: bg, color: fg, border: '1px solid var(--hairline)' }}>
      {label}
    </span>
  )
}

function AccessChip({ children, tone = 'partner', onRemove, busy }) {
  const style = tone === 'role'
    ? { background: 'var(--ink)', color: '#fff', border: '1px solid var(--ink)' }
    : { background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--hairline)' }
  return (
    <span className={`inline-flex items-center gap-1 text-xs rounded-full py-1 ${onRemove ? 'pl-2.5 pr-1' : 'px-2.5'}`} style={style}>
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          disabled={busy}
          className="disabled:opacity-50 rounded-full w-5 h-5 flex items-center justify-center hover:opacity-70 leading-none"
          aria-label="Remove access"
        >
          ×
        </button>
      )}
    </span>
  )
}

function AccessSelect({ partners, value, onChange, exclude = [], placeholder = 'Choose access…' }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
      style={{ border: '1px solid var(--hairline)', color: 'var(--ink)', background: '#fff' }}
    >
      <option value="">{placeholder}</option>
      <optgroup label="Partner — all their implementations, now and future">
        {partners.filter(p => !exclude.includes(`partner:${p}`)).map(p => (
          <option key={p} value={`partner:${p}`}>{p}</option>
        ))}
      </optgroup>
      <optgroup label="Bloomreach team">
        {ROLES.filter(r => !exclude.includes(r.key)).map(r => (
          <option key={r.key} value={r.key}>{r.label} — {r.hint}</option>
        ))}
      </optgroup>
    </select>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)' }}>{label}</span>
      {children}
    </label>
  )
}

const inputClass = 'w-full rounded-lg px-3 py-2 text-sm focus:outline-none'
const inputStyle = { border: '1px solid var(--hairline)' }

// ---- Invite / add person ----

function InviteModal({ partners, defaultChoice, onSubmit, onClose }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', choice: defaultChoice || '', sendInvite: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function submit(e, close) {
    e.preventDefault()
    if (!form.email.trim()) return setError('Enter their email.')
    if (!form.choice) return setError('Choose what they should have access to.')
    setBusy(true)
    setError(null)
    const err = await onSubmit(form)
    setBusy(false)
    if (err) setError(err)
    else close()
  }

  return (
    <ModalShell onClose={onClose} panelClassName="max-w-md">
      {close => (
        <form onSubmit={e => submit(e, close)} className="p-6">
          <div className="flex items-start justify-between mb-1">
            <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--ink)' }}>Add a person</h2>
            <button type="button" onClick={close} className="text-xl leading-none hover:opacity-70" style={{ color: 'var(--muted)' }} aria-label="Close">×</button>
          </div>
          <p className="text-[13px] mb-5" style={{ color: 'var(--muted)' }}>
            Grant access now — they don’t need an account yet. With the invite ticked they get a branded email to set a password.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="First name"><input value={form.firstName} onChange={set('firstName')} className={inputClass} style={inputStyle} autoFocus /></Field>
            <Field label="Last name"><input value={form.lastName} onChange={set('lastName')} className={inputClass} style={inputStyle} /></Field>
          </div>
          <div className="mb-3">
            <Field label="Work email">
              <input type="email" required value={form.email} onChange={set('email')} placeholder="person@partner.com" className={inputClass} style={inputStyle} />
            </Field>
          </div>
          <div className="mb-4">
            <Field label="Access">
              <AccessSelect partners={partners} value={form.choice} onChange={v => setForm(f => ({ ...f, choice: v }))} />
            </Field>
          </div>

          <label className="flex items-start gap-2.5 rounded-xl p-3 mb-5 cursor-pointer" style={{ background: 'var(--paper)', border: '1px solid var(--hairline)' }}>
            <input type="checkbox" checked={form.sendInvite} onChange={set('sendInvite')} className="mt-0.5" />
            <span className="text-[13px]" style={{ color: 'var(--ink)' }}>
              <span className="font-medium">Email them an invite</span>
              <span className="block text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Untick if they’ll sign up themselves — the access waits for them either way.</span>
            </span>
          </label>

          {error && <p className="text-xs mb-3" style={{ color: 'var(--rust)' }}>{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} className="text-sm font-medium px-4 py-2 rounded-[10px]" style={{ border: '1px solid var(--hairline)', color: 'var(--ink)' }}>Cancel</button>
            <button type="submit" disabled={busy} className="disabled:opacity-50 text-sm font-medium px-4 py-2 rounded-[10px]" style={{ background: 'var(--ink)', color: '#fff' }}>
              {busy ? 'Saving…' : form.sendInvite ? 'Grant & send invite' : 'Grant access'}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  )
}

// ---- Manage one person ----

function ManageModal({ person, partners, isSelf, onGrant, onRevoke, onInvite, onDecline, onDelete, onClose }) {
  const [choice, setChoice] = useState('')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  async function run(key, fn) {
    setBusy(key)
    setError(null)
    setNotice(null)
    const err = await fn()
    setBusy(null)
    if (err) setError(err)
    return err
  }

  const held = [...person.roles, ...person.partners.map(p => `partner:${p}`)]

  return (
    <ModalShell onClose={onClose} panelClassName="max-w-lg">
      {close => (
        <div className="p-6">
          <div className="flex items-start gap-3 mb-5">
            <Avatar person={person} size={48} />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-semibold truncate" style={{ color: 'var(--ink)' }}>{person.name || person.email}</h2>
              {person.name && <p className="text-[13px] truncate" style={{ color: 'var(--muted)' }}>{person.email}</p>}
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <StatusPill person={person} />
                {(person.jobTitle || person.typedPartner) && (
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    {[person.jobTitle, person.typedPartner && `says they’re with ${person.typedPartner}`].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
            </div>
            <button onClick={close} className="text-xl leading-none hover:opacity-70" style={{ color: 'var(--muted)' }} aria-label="Close">×</button>
          </div>

          <h3 className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>Access</h3>
          <div className="flex flex-wrap gap-1.5 mb-3 min-h-7">
            {person.roles.map(r => (
              <AccessChip key={r} tone="role" busy={busy === r}
                onRemove={isSelf ? undefined : () => confirm(`Remove ${ROLE_LABEL[r]} access for ${person.email}?`) && run(r, () => onRevoke(person.email, r))}>
                {ROLE_LABEL[r]}{isSelf ? ' (you)' : ''}
              </AccessChip>
            ))}
            {person.partners.map(p => (
              <AccessChip key={p} busy={busy === p}
                onRemove={() => confirm(`Remove ${person.email}'s access to ${p}?`) && run(p, () => onRevoke(person.email, 'partner', p))}>
                {p}
              </AccessChip>
            ))}
            {!person.hasAnyAccess && <span className="text-[13px]" style={{ color: 'var(--muted)' }}>No access yet — they’ll see a waiting screen.</span>}
          </div>
          <div className="flex gap-2 mb-6">
            <div className="flex-1"><AccessSelect partners={partners} value={choice} onChange={setChoice} exclude={held} placeholder="Add access…" /></div>
            <button
              onClick={async () => { if (!(await run('grant', () => onGrant(person.email, parseChoice(choice))))) setChoice('') }}
              disabled={!choice || busy === 'grant'}
              className="disabled:opacity-40 text-sm font-medium px-4 rounded-lg shrink-0"
              style={{ background: 'var(--gold)', color: '#000' }}
            >
              {busy === 'grant' ? 'Adding…' : 'Add'}
            </button>
          </div>

          {!person.hasAccount && person.hasAnyAccess && (
            <div className="flex items-center justify-between gap-3 rounded-xl p-3 mb-4" style={{ background: 'var(--paper)', border: '1px solid var(--hairline)' }}>
              <span className="text-[13px]" style={{ color: 'var(--ink)' }}>They haven’t created an account yet.</span>
              <button
                onClick={async () => { if (!(await run('invite', () => onInvite(person)))) setNotice('Invite sent ✓') }}
                disabled={busy === 'invite' || !!notice}
                className="disabled:opacity-50 text-[13px] font-medium px-3 py-1.5 rounded-lg shrink-0"
                style={{ background: 'var(--ink)', color: '#fff' }}
              >
                {busy === 'invite' ? 'Sending…' : 'Send invite email'}
              </button>
            </div>
          )}

          {notice && <p className="text-xs mb-3" style={{ color: 'var(--moss)' }}>{notice}</p>}
          {error && <p className="text-xs mb-3" style={{ color: 'var(--rust)' }}>{error}</p>}

          {person.hasAccount && !isSelf && (
            <div className="flex flex-wrap items-center justify-end gap-4 pt-4" style={{ borderTop: '1px solid var(--hairline)' }}>
              {!person.hasAnyAccess && !person.declined && (
                <button
                  onClick={() => confirm(`Decline ${person.email}? They keep their login but stay on the waiting screen.`) && run('decline', () => onDecline(person)).then(err => !err && close())}
                  disabled={!!busy}
                  className="disabled:opacity-50 text-xs font-medium hover:underline"
                  style={{ color: 'var(--muted)' }}
                >
                  Decline sign-up
                </button>
              )}
              <button
                onClick={() => {
                  if (!confirm(`Permanently delete ${person.email}'s account? They lose their login and every access grant, and would need a new invite or sign-up.`)) return
                  run('delete', () => onDelete(person)).then(err => !err && close())
                }}
                disabled={!!busy}
                className="disabled:opacity-50 text-xs font-medium hover:underline"
                style={{ color: 'var(--rust)' }}
              >
                {busy === 'delete' ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          )}
        </div>
      )}
    </ModalShell>
  )
}

// ---- Person card ----

function PersonCard({ person, index, isSelf, showPartners, partners, onManage, onGrant }) {
  const [busy, setBusy] = useState(false)
  // A sign-up that typed a partner we recognise gets a one-click approve.
  const suggested = !person.hasAnyAccess && !person.declined
    && partners.find(p => p.toLowerCase() === person.typedPartner?.trim().toLowerCase())

  return (
    <div
      className="card-enter bg-white rounded-2xl p-4 flex flex-col gap-3"
      style={{ border: '1px solid var(--hairline)', '--i': Math.min(index, 12) }}
    >
      <div className="flex items-start gap-3">
        <Avatar person={person} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
            {person.name || person.email}{isSelf && <span className="font-normal" style={{ color: 'var(--muted)' }}> (you)</span>}
          </div>
          <div className="text-xs truncate" style={{ color: 'var(--muted)' }}>{person.name ? person.email : person.jobTitle || ' '}</div>
        </div>
        <StatusPill person={person} />
      </div>

      <div className="flex items-end justify-between gap-2 mt-auto">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {person.roles.map(r => <AccessChip key={r} tone="role">{ROLE_LABEL[r]}</AccessChip>)}
          {showPartners && person.partners.map(p => <AccessChip key={p}>{p}</AccessChip>)}
          {!person.hasAnyAccess && person.typedPartner && !suggested && (
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Says they’re with <strong style={{ color: 'var(--ink)' }}>{person.typedPartner}</strong></span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
        {suggested && (
          <button
            onClick={async () => { setBusy(true); await onGrant(person.email, { type: 'partner', partnerName: suggested }); setBusy(false) }}
            disabled={busy}
            className="disabled:opacity-50 text-xs font-medium px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--gold)', color: '#000' }}
          >
            {busy ? 'Approving…' : `Approve · ${suggested}`}
          </button>
        )}
        <button
          onClick={() => onManage(person)}
          className="text-xs font-medium px-3 py-1.5 rounded-lg"
          style={{ border: '1px solid var(--hairline)', color: 'var(--ink)' }}
        >
          Manage
        </button>
        </div>
      </div>
    </div>
  )
}

// ---- Sidebar ----

function NavItem({ active, onClick, label, count, accent }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-2 text-left text-[13px] px-3 py-2 rounded-lg transition-colors"
      style={active
        ? { background: 'var(--ink)', color: '#fff' }
        : { color: 'var(--ink)' }}
      aria-current={active ? 'true' : undefined}
    >
      <span className="truncate">{label}</span>
      {count > 0 && (
        <span
          className="text-[11px] font-semibold rounded-full px-1.5 min-w-5 text-center"
          style={active ? { background: 'rgba(255,255,255,0.2)' } : accent ? { background: 'var(--gold)', color: '#000' } : { background: 'var(--paper)', color: 'var(--muted)' }}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function PermissionsSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]" role="status" aria-label="Loading permissions">
      <div className="space-y-2">{Array.from({ length: 7 }, (_, i) => <SkeletonBar key={i} className="h-8" />)}</div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {Array.from({ length: 6 }, (_, i) => <SkeletonBar key={i} className="h-[150px] !rounded-2xl" />)}
      </div>
    </div>
  )
}

// ---- Page ----

export default function Permissions({ userInfo, onLogout }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  // The dashboard's "waiting for access" banner links here with state.group.
  const [group, setGroup] = useState(useLocation().state?.group || 'all') // 'all' | 'team' | 'awaiting' | 'partner:<name>'
  const [search, setSearch] = useState('')
  const [showEmptyPartners, setShowEmptyPartners] = useState(false)
  const [managing, setManaging] = useState(null) // email
  const [inviting, setInviting] = useState(false)
  const selfEmail = (userInfo?.email || '').trim().toLowerCase()

  function load() {
    return getAllAccess().then(d => {
      if (d?.error) setError('Failed to load permissions.')
      else { setData(d); setError(null) }
    }).catch(() => setError('Failed to load permissions.'))
  }

  useEffect(() => { load() }, [])

  const implCountByPartner = useMemo(() => {
    const counts = {}
    for (const i of data?.implementations || []) if (i.partner_name) counts[i.partner_name] = (counts[i.partner_name] || 0) + 1
    return counts
  }, [data])
  const partners = useMemo(() => Object.keys(implCountByPartner).sort((a, b) => a.localeCompare(b)), [implCountByPartner])

  const people = useMemo(() => {
    if (!data) return []
    const profileByEmail = Object.fromEntries(data.profiles.map(p => [p.email, p]))
    const emails = new Set([
      ...data.profiles.map(p => p.email),
      ...data.admins, ...data.sdc, ...data.viewers,
      ...data.partnerGrants.map(g => g.email),
    ])
    return Array.from(emails).filter(e => e && e.includes('@')).map(email => {
      const profile = profileByEmail[email]
      const roles = ['admin', 'sdc', 'viewer'].filter(r =>
        (r === 'admin' ? data.admins : r === 'sdc' ? data.sdc : data.viewers).includes(email))
      const partnerList = data.partnerGrants.filter(g => g.email === email).map(g => g.partner_name).sort()
      const firstName = profile?.first_name || ''
      const lastName = profile?.last_name || ''
      return {
        email,
        firstName, lastName,
        name: [firstName, lastName].filter(Boolean).join(' '),
        jobTitle: profile?.job_title || '',
        typedPartner: profile?.partner_name || '',
        hasAccount: !!profile,
        declined: !!profile?.declined,
        userId: profile?.id || null,
        createdAt: profile?.created_at || null,
        roles,
        partners: partnerList,
        hasAnyAccess: roles.length > 0 || partnerList.length > 0,
      }
    }).sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email))
  }, [data])

  const awaiting = people.filter(p => p.hasAccount && !p.hasAnyAccess && !p.declined)
  const team = people.filter(p => p.roles.length > 0)
  const peopleByPartner = useMemo(() => {
    const map = {}
    for (const p of people) for (const name of p.partners) (map[name] ||= []).push(p)
    return map
  }, [people])
  const partnersWithPeople = partners.filter(p => peopleByPartner[p]?.length)
  const emptyPartners = partners.filter(p => !peopleByPartner[p]?.length)

  const q = search.trim().toLowerCase()
  const matches = p => !q || [p.email, p.name, p.jobTitle, p.typedPartner, ...p.partners].some(v => v?.toLowerCase().includes(q))

  const groupPartner = group.startsWith('partner:') ? group.slice(8) : null
  const inGroup = group === 'all' ? people
    : group === 'team' ? team
    : group === 'awaiting' ? awaiting
    : peopleByPartner[groupPartner] || []
  const visible = inGroup.filter(matches)

  const title = group === 'all' ? 'Everyone'
    : group === 'team' ? 'Bloomreach team'
    : group === 'awaiting' ? 'Awaiting access'
    : groupPartner
  const subtitle = group === 'all' ? `${people.length} people with an account or access`
    : group === 'team' ? 'Admins, SDCs and viewers — they see every partner'
    : group === 'awaiting' ? 'Signed up, but not linked to a partner yet'
    : `${implCountByPartner[groupPartner] || 0} implementation${implCountByPartner[groupPartner] === 1 ? '' : 's'} · ${inGroup.length} ${inGroup.length === 1 ? 'person' : 'people'} with access`

  async function handleGrant(email, target) {
    const res = await approveSignup(email, target)
    if (res.error) return res.error
    await load()
    return null
  }

  async function handleRevoke(email, kind, partnerName) {
    const res = kind === 'admin' ? await removeAdminAccess(email)
      : kind === 'sdc' ? await removeSDCAccess(email)
      : kind === 'viewer' ? await removeViewerAccess(email)
      : await removePartnerAccess(email, partnerName)
    if (res.error) return res.error
    await load()
    return null
  }

  async function handleInvite(person) {
    const partnerName = person.partners[0]
    const res = await inviteUser(person.email, {
      firstName: person.firstName, lastName: person.lastName, partnerName,
      accessLabel: person.roles[0] ? accessLabel({ type: person.roles[0] }) : partnerName ? accessLabel({ type: 'partner', partnerName }) : null,
    })
    return res.error || null
  }

  async function handleAdd(form) {
    const email = form.email.trim().toLowerCase()
    const target = parseChoice(form.choice)
    const grantErr = await handleGrant(email, target)
    if (grantErr) return grantErr
    if (form.sendInvite) {
      const res = await inviteUser(email, {
        firstName: form.firstName, lastName: form.lastName,
        partnerName: target.partnerName, accessLabel: accessLabel(target),
      })
      // Access is granted either way — report the invite failure without undoing it.
      if (res.error) return `Access granted, but the invite wasn’t sent: ${res.error}`
    }
    return null
  }

  async function handleDecline(person) {
    const res = await declineSignup(person.userId)
    if (res.error) return res.error
    await load()
    return null
  }

  async function handleDelete(person) {
    const res = await deleteUserAccount(person.userId)
    if (res.error) return res.error
    await load()
    return null
  }

  const managed = managing && people.find(p => p.email === managing)

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <Navbar userInfo={userInfo} onLogout={onLogout} title="Permissions — Partner Portal" />

      <div className="max-w-6xl mx-auto px-4 sm:px-7 py-7">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-[22px] font-semibold" style={{ color: 'var(--ink)' }}>Permissions</h1>
            <p className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>
              Access is by partner — everyone at a partner sees all of that partner’s implementations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin" className="text-sm font-medium px-4 py-2 rounded-[10px]" style={{ border: '1px solid var(--hairline)', color: 'var(--ink)' }}>
              ← Dashboard
            </Link>
            <button
              onClick={() => setInviting(true)}
              disabled={!data}
              className="disabled:opacity-50 text-sm font-medium px-4 py-2 rounded-[10px]"
              style={{ background: 'var(--ink)', color: '#fff' }}
            >
              + Add person
            </button>
          </div>
        </div>

        {error ? (
          <div className="text-center py-20 text-sm" style={{ color: 'var(--rust)' }}>{error}</div>
        ) : !data ? (
          <PermissionsSkeleton />
        ) : (
          <div className="grid gap-6 md:grid-cols-[240px_1fr] items-start">
            {/* Phones: the sidebar collapses to search + a group dropdown */}
            <div className="md:hidden flex flex-col gap-2">
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search people…"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
                style={{ border: '1px solid var(--hairline)' }}
              />
              <select
                value={group}
                onChange={e => setGroup(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
                style={{ border: '1px solid var(--hairline)', color: 'var(--ink)' }}
                aria-label="Show group"
              >
                <option value="all">Everyone ({people.length})</option>
                <option value="awaiting">Awaiting access ({awaiting.length})</option>
                <option value="team">Bloomreach team ({team.length})</option>
                <optgroup label="Partners">
                  {partners.map(p => <option key={p} value={`partner:${p}`}>{p} ({peopleByPartner[p]?.length || 0})</option>)}
                </optgroup>
              </select>
            </div>

            {/* Sidebar */}
            <aside className="hidden md:block md:sticky md:top-6 bg-white rounded-2xl p-3" style={{ border: '1px solid var(--hairline)' }}>
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search people…"
                className="w-full rounded-lg px-3 py-2 text-[13px] focus:outline-none mb-2"
                style={{ border: '1px solid var(--hairline)', background: 'var(--paper)' }}
              />
              <nav className="space-y-0.5">
                <NavItem active={group === 'all'} onClick={() => setGroup('all')} label="Everyone" count={people.length} />
                <NavItem active={group === 'awaiting'} onClick={() => setGroup('awaiting')} label="Awaiting access" count={awaiting.length} accent />
                <NavItem active={group === 'team'} onClick={() => setGroup('team')} label="Bloomreach team" count={team.length} />
              </nav>
              <div className="text-[11px] font-semibold uppercase tracking-widest px-3 mt-4 mb-1.5" style={{ color: 'var(--muted)' }}>Partners</div>
              <nav className="space-y-0.5 max-h-[50vh] overflow-y-auto">
                {partnersWithPeople.map(p => (
                  <NavItem key={p} active={group === `partner:${p}`} onClick={() => setGroup(`partner:${p}`)} label={p} count={peopleByPartner[p].length} />
                ))}
                {partnersWithPeople.length === 0 && (
                  <p className="text-xs px-3 py-1" style={{ color: 'var(--muted)' }}>No partner has access yet.</p>
                )}
                {showEmptyPartners && emptyPartners.map(p => (
                  <NavItem key={p} active={group === `partner:${p}`} onClick={() => setGroup(`partner:${p}`)} label={p} count={0} />
                ))}
              </nav>
              {emptyPartners.length > 0 && (
                <button
                  onClick={() => setShowEmptyPartners(s => !s)}
                  className="text-xs font-medium px-3 mt-2 hover:underline"
                  style={{ color: 'var(--arctic-dark)' }}
                >
                  {showEmptyPartners ? 'Hide partners with no one' : `+ ${emptyPartners.length} partners with no one yet`}
                </button>
              )}
            </aside>

            {/* Main */}
            <section>
              <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
                <div>
                  <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--ink)' }}>{title}</h2>
                  <p className="text-[13px]" style={{ color: 'var(--muted)' }}>{subtitle}</p>
                </div>
                {groupPartner && (
                  <button
                    onClick={() => setInviting(true)}
                    className="text-[13px] font-medium px-3 py-1.5 rounded-lg"
                    style={{ background: 'var(--gold)', color: '#000' }}
                  >
                    + Add someone to {groupPartner}
                  </button>
                )}
              </div>

              {visible.length === 0 ? (
                <div className="bg-white rounded-2xl py-16 px-6 text-center" style={{ border: '1px dashed var(--hairline)' }}>
                  <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    {q ? 'No one matches that search.' : group === 'awaiting' ? 'Nobody is waiting — all caught up.' : 'No one here yet.'}
                  </p>
                  {groupPartner && !q && (
                    <p className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>Add someone from {groupPartner} and they’ll see all {implCountByPartner[groupPartner]} of its implementations.</p>
                  )}
                </div>
              ) : (
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                  {visible.map((p, i) => (
                    <PersonCard
                      key={p.email}
                      person={p}
                      index={i}
                      isSelf={p.email === selfEmail}
                      showPartners={!groupPartner}
                      partners={partners}
                      onManage={person => setManaging(person.email)}
                      onGrant={handleGrant}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {inviting && (
        <InviteModal
          partners={partners}
          defaultChoice={groupPartner ? `partner:${groupPartner}` : ''}
          onSubmit={handleAdd}
          onClose={() => setInviting(false)}
        />
      )}
      {managed && (
        <ManageModal
          person={managed}
          partners={partners}
          isSelf={managed.email === selfEmail}
          onGrant={handleGrant}
          onRevoke={handleRevoke}
          onInvite={handleInvite}
          onDecline={handleDecline}
          onDelete={handleDelete}
          onClose={() => setManaging(null)}
        />
      )}
    </div>
  )
}
