import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllAccess, approveSignup, removeAccess, removeAdminAccess, removeSDCAccess, removePartnerAccess, deleteUserAccount } from '../api'
import Navbar from '../components/Navbar'

function Chip({ children, onRemove, removing }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs rounded-full pl-2.5 pr-1.5 py-1"
      style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
    >
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          disabled={removing}
          className="disabled:opacity-50 rounded-full w-4 h-4 flex items-center justify-center hover:opacity-70 leading-none"
          style={{ color: 'var(--muted)' }}
          aria-label="Remove access"
        >
          ×
        </button>
      )}
    </span>
  )
}

// Same "grant access to…" select used for sign-up approval, reused here for
// both adding more access to an existing row and granting to a brand-new
// email that hasn't shown up anywhere yet.
function GrantSelect({ partners, implementations, onGrant, busy }) {
  const [choice, setChoice] = useState('')
  const sorted = [...implementations].sort((a, b) =>
    (a.partner_name + a.client_name).localeCompare(b.partner_name + b.client_name))

  async function grant() {
    if (!choice) return
    const target = choice === 'admin'
      ? { type: 'admin' }
      : choice === 'sdc'
      ? { type: 'sdc' }
      : choice.startsWith('partner:')
      ? { type: 'partner', partnerName: choice.slice(8) }
      : { type: 'implementation', id: choice.slice(5) }
    const err = await onGrant(target)
    if (!err) setChoice('')
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={choice}
        onChange={e => setChoice(e.target.value)}
        className="rounded-lg px-3 py-1.5 text-xs focus:outline-none"
        style={{ border: '1px solid var(--hairline)', color: 'var(--ink)', background: '#fff' }}
      >
        <option value="">Grant access to…</option>
        <optgroup label="Partner — all their implementations, now and future">
          {partners.map(p => (
            <option key={p} value={`partner:${p}`}>{p} (all implementations)</option>
          ))}
        </optgroup>
        <optgroup label="Single implementation">
          {sorted.map(i => (
            <option key={i.id} value={`impl:${i.id}`}>{i.partner_name} × {i.client_name}</option>
          ))}
        </optgroup>
        <optgroup label="Bloomreach">
          <option value="admin">Make admin — full access to everything</option>
          <option value="sdc">Make SDC — sees everything, can only edit QA docs</option>
        </optgroup>
      </select>
      <button
        onClick={grant}
        disabled={busy || !choice}
        className="disabled:opacity-50 text-xs font-medium px-3 py-1.5 rounded-lg transition-opacity hover:opacity-90"
        style={{ background: 'var(--gold)', color: '#000' }}
      >
        {busy ? 'Adding…' : '+ Add'}
      </button>
    </div>
  )
}

function UserRow({ row, partners, implementations, selfEmail, onGrant, onRevoke, onDelete }) {
  const [removing, setRemoving] = useState(null)
  const [granting, setGranting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const isSelf = row.email === selfEmail
  const hasAnyAccess = row.isAdmin || row.isSDC || row.partners.length > 0 || row.implementations.length > 0

  async function revoke(kind, label, extra) {
    if (!confirm(`Remove ${label} for ${row.email}?`)) return
    setRemoving(kind + (extra || ''))
    setError(null)
    const err = await onRevoke(row.email, kind, extra)
    if (err) setError(err)
    setRemoving(null)
  }

  async function grant(target) {
    setGranting(true)
    setError(null)
    const err = await onGrant(row.email, target)
    setGranting(false)
    return err
  }

  async function handleDelete() {
    if (!confirm(`Permanently delete ${row.email}'s account? This can't be undone — they'll lose their login and all access, and would need to sign up again from scratch.`)) return
    if (!confirm(`Really sure? This deletes the account itself, not just their access.`)) return
    setDeleting(true)
    setError(null)
    const err = await onDelete(row.userId)
    if (err) { setError(err); setDeleting(false) }
  }

  return (
    <div className="py-4" style={{ borderBottom: '1px solid var(--hairline)' }}>
      <div className="flex flex-wrap items-baseline gap-2 mb-2.5">
        <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{row.email}</span>
        {!row.hasAccount && <span className="text-xs" style={{ color: 'var(--muted)' }}>no account yet</span>}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {row.isAdmin && (
          <Chip
            removing={removing === 'admin'}
            onRemove={isSelf ? undefined : () => revoke('admin', 'admin access')}
          >
            Admin{isSelf ? ' (you)' : ''}
          </Chip>
        )}
        {row.isSDC && (
          <Chip
            removing={removing === 'sdc'}
            onRemove={isSelf ? undefined : () => revoke('sdc', 'SDC access')}
          >
            SDC{isSelf ? ' (you)' : ''}
          </Chip>
        )}
        {row.partners.map(p => (
          <Chip key={`p:${p}`} removing={removing === `partner${p}`} onRemove={() => revoke('partner', `partner-wide access to ${p}`, p)}>
            {p} (all)
          </Chip>
        ))}
        {row.implementations.map(i => (
          <Chip key={`i:${i.id}`} removing={removing === `impl${i.id}`} onRemove={() => revoke('implementation', `access to ${i.partner_name} × ${i.client_name}`, i.id)}>
            {i.partner_name} × {i.client_name}
          </Chip>
        ))}
        {!hasAnyAccess && <span className="text-xs" style={{ color: 'var(--muted)' }}>No access granted</span>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <GrantSelect partners={partners} implementations={implementations} onGrant={grant} busy={granting} />
        {row.hasAccount && !isSelf && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="disabled:opacity-50 text-xs font-medium hover:underline"
            style={{ color: 'var(--rust)' }}
          >
            {deleting ? 'Deleting…' : 'Delete account'}
          </button>
        )}
      </div>
      {error && <p className="text-xs mt-1.5" style={{ color: 'var(--rust)' }}>{error}</p>}
    </div>
  )
}

function AddPersonCard({ partners, implementations, onGrant }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  async function grant(target) {
    if (!email.trim()) { setError('Enter an email first.'); return 'Enter an email first.' }
    setBusy(true)
    setError(null)
    const err = await onGrant(email.trim().toLowerCase(), target)
    setBusy(false)
    if (err) { setError(err); return err }
    setDone(true)
    setEmail('')
    setTimeout(() => setDone(false), 2000)
    return null
  }

  return (
    <div className="bg-white rounded-2xl p-6 mb-5" style={{ border: '1px solid var(--hairline)' }}>
      <h2 className="font-display text-base font-semibold" style={{ color: 'var(--ink)' }}>Grant access to someone new</h2>
      <p className="text-xs mt-0.5 mb-4" style={{ color: 'var(--muted)' }}>
        They don't need an account yet — this works the same whether they've signed up or not.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="person@partner.com"
          className="rounded-lg px-3 py-2 text-sm focus:outline-none min-w-56"
          style={{ border: '1px solid var(--hairline)' }}
        />
        <GrantSelect partners={partners} implementations={implementations} onGrant={grant} busy={busy} />
        {done && <span className="text-xs" style={{ color: 'var(--moss)' }}>Granted ✓</span>}
      </div>
      {error && <p className="text-xs mt-1.5" style={{ color: 'var(--rust)' }}>{error}</p>}
    </div>
  )
}

export default function Permissions({ userInfo, onLogout }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const selfEmail = (userInfo?.email || '').trim().toLowerCase()

  function load() {
    getAllAccess().then(d => {
      if (d?.error) setError('Failed to load permissions.')
      else { setData(d); setError(null) }
    }).catch(() => setError('Failed to load permissions.')).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const partners = useMemo(() => (
    data ? Array.from(new Set(data.implementations.map(i => i.partner_name).filter(Boolean))).sort() : []
  ), [data])

  const rows = useMemo(() => {
    if (!data) return []
    const implMap = Object.fromEntries(data.implementations.map(i => [i.id, i]))
    const profileByEmail = Object.fromEntries(data.profiles.map(p => [p.email, p]))
    const emails = new Set([
      ...data.profiles.map(p => p.email),
      ...data.access.map(a => a.email),
      ...data.admins,
      ...data.sdc,
      ...data.partnerGrants.map(g => g.email),
    ])
    return Array.from(emails).sort().map(email => ({
      email,
      hasAccount: !!profileByEmail[email],
      userId: profileByEmail[email]?.id || null,
      isAdmin: data.admins.includes(email),
      isSDC: data.sdc.includes(email),
      partners: data.partnerGrants.filter(g => g.email === email).map(g => g.partner_name),
      implementations: data.access.filter(a => a.email === email).map(a => implMap[a.implementation_id]).filter(Boolean),
    }))
  }, [data])

  const filteredRows = rows.filter(r => r.email.includes(search.trim().toLowerCase()))

  async function handleGrant(email, target) {
    const res = await approveSignup(email, target)
    if (res.error) return res.error
    load()
    return null
  }

  async function handleRevoke(email, kind, extra) {
    const res = kind === 'admin' ? await removeAdminAccess(email)
      : kind === 'sdc' ? await removeSDCAccess(email)
      : kind === 'partner' ? await removePartnerAccess(email, extra)
      : await removeAccess(null, extra, email)
    if (res.error) return res.error
    load()
    return null
  }

  async function handleDelete(userId) {
    const res = await deleteUserAccount(userId)
    if (res.error) return res.error
    load()
    return null
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <Navbar userInfo={userInfo} onLogout={onLogout} title="Permissions — Partner Portal" />

      <div className="max-w-5xl mx-auto px-7 py-7">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-[22px] font-semibold" style={{ color: 'var(--ink)' }}>Permissions</h1>
            <p className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>
              Who can see what — {rows.length} known {rows.length === 1 ? 'person' : 'people'}.
            </p>
          </div>
          <Link
            to="/admin"
            className="text-sm font-medium px-4 py-2 rounded-[10px] transition-colors"
            style={{ border: '1px solid var(--hairline)', color: 'var(--ink)' }}
          >
            ← Dashboard
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-20 text-sm" style={{ color: 'var(--muted)' }}>Loading…</div>
        ) : error ? (
          <div className="text-center py-20 text-sm" style={{ color: 'var(--rust)' }}>{error}</div>
        ) : (
          <>
            <AddPersonCard partners={partners} implementations={data.implementations} onGrant={handleGrant} />

            <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid var(--hairline)' }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by email…"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none mb-1"
                style={{ border: '1px solid var(--hairline)' }}
              />
              <div>
                {filteredRows.length === 0 ? (
                  <p className="text-sm text-center py-10" style={{ color: 'var(--muted)' }}>No one matches that search.</p>
                ) : (
                  filteredRows.map(row => (
                    <UserRow
                      key={row.email}
                      row={row}
                      partners={partners}
                      implementations={data.implementations}
                      selfEmail={selfEmail}
                      onGrant={handleGrant}
                      onRevoke={handleRevoke}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
