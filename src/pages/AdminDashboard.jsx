import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getAllImplementations, addImplementation, getPendingSignups, approveSignup,
  declineSignup, getStepDefinitions, DEFAULT_STEPS,
} from '../api'
import Navbar from '../components/Navbar'
import RolloutRail from '../components/RolloutRail'

function getProgress(impl, tpKeys) {
  if (!tpKeys.length) return 0
  const tp = impl.touchPoints || {}
  const complete = tpKeys.filter(k => tp[k] === 'complete').length
  return Math.round((complete / tpKeys.length) * 100)
}

function getQAProgress(impl, qaKeys) {
  if (!qaKeys.length) return 0
  const qa = impl.qaSteps || {}
  const complete = qaKeys.filter(k => qa[k] === 'complete').length
  return Math.round((complete / qaKeys.length) * 100)
}

function openRaidCount(impl) {
  return (impl.raid || []).filter(r => r.status === 'Open' || r.status === 'In Progress').length
}

function isOverdue(impl) {
  if (!impl.planned_completion_date) return false
  return new Date(impl.planned_completion_date) < new Date()
}

const EMPTY_FORM = { emails: '', partner_name: '', client_name: '', slackChannelId: '' }

export default function AdminDashboard({ credential, userInfo, onLogout }) {
  const [implementations, setImplementations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)
  const [partnerFilter, setPartnerFilter] = useState('All')
  const [showCompleted, setShowCompleted] = useState(false)
  const [pending, setPending] = useState([])
  const [steps, setSteps] = useState(DEFAULT_STEPS)
  const tpKeys = steps.touchpoints.map(s => s.key)
  const qaKeys = steps.qaSteps.map(s => s.key)

  useEffect(() => {
    getAllImplementations(credential)
      .then(data => {
        if (data?.error) setError('Failed to load implementations.')
        else setImplementations(data || [])
      })
      .catch(() => setError('Failed to load implementations.'))
      .finally(() => setLoading(false))
    getPendingSignups().then(setPending).catch(() => {})
    getStepDefinitions().then(setSteps).catch(() => {})
  }, [])

  async function approvePending(profile, target) {
    const res = await approveSignup(profile.email, target)
    if (res.error) return res.error
    setPending(prev => prev.filter(p => p.id !== profile.id))
    if (target.type === 'implementation') {
      setImplementations(prev => prev.map(impl => impl.id === target.id
        ? { ...impl, accessEmails: [...(impl.accessEmails || []), profile.email] }
        : impl))
    }
    if (target.type === 'partner') {
      setImplementations(prev => prev.map(impl => impl.partner_name === target.partnerName
        ? { ...impl, accessEmails: [...(impl.accessEmails || []), `${profile.email} (partner-wide)`] }
        : impl))
    }
    return null
  }

  async function declinePending(profile) {
    const res = await declineSignup(profile.id)
    if (res.error) return res.error
    setPending(prev => prev.filter(p => p.id !== profile.id))
    return null
  }

  async function handleAdd(e) {
    e.preventDefault()
    setAdding(true)
    setAddError(null)
    try {
      const res = await addImplementation(credential, form)
      if (res.error) {
        setAddError(res.error)
      } else {
        const emails = form.emails.split(',').map(s => s.trim()).filter(Boolean)
        setImplementations(prev => [...prev, {
          id: res.id,
          partner_name: form.partner_name,
          client_name: form.client_name,
          status: 'active',
          accessEmails: emails,
          slackChannelId: form.slackChannelId.trim(),
          touchPoints: {},
          qaSteps: {},
          raid: [],
        }])
        setForm(EMPTY_FORM)
        setShowAdd(false)
      }
    } catch {
      setAddError('Failed to add partner. Please try again.')
    }
    setAdding(false)
  }

  const activeImpls = implementations.filter(i => i.status !== 'complete')
  const completedImpls = implementations.filter(i => i.status === 'complete')
  const partners = Array.from(new Set(activeImpls.map(i => i.partner_name).filter(Boolean))).sort()
  const avgProgress = activeImpls.length ? Math.round(activeImpls.reduce((sum, i) => sum + getProgress(i, tpKeys), 0) / activeImpls.length) : 0
  const avgQA = activeImpls.length ? Math.round(activeImpls.reduce((sum, i) => sum + getQAProgress(i, qaKeys), 0) / activeImpls.length) : 0
  const totalOpenRaid = implementations.reduce((sum, i) => sum + openRaidCount(i), 0)
  const overdueCount = activeImpls.filter(isOverdue).length
  const hasAttention = overdueCount > 0 || totalOpenRaid > 0

  const filteredActive = partnerFilter === 'All' ? activeImpls : activeImpls.filter(i => i.partner_name === partnerFilter)
  const groupNames = partnerFilter === 'All' ? partners : [partnerFilter]
  const partnerGroups = groupNames.map(name => {
    const impls = filteredActive.filter(i => i.partner_name === name)
    const avg = impls.length ? Math.round(impls.reduce((sum, i) => sum + getProgress(i, tpKeys), 0) / impls.length) : 0
    return { name, impls, avg }
  }).filter(g => g.impls.length > 0)

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <div className="no-print">
        <Navbar userInfo={userInfo} onLogout={onLogout} title="Admin — Partner Portal" />
      </div>

      <div className="max-w-7xl mx-auto px-7 py-7">

        {/* Print-only header, shown when exported to PDF */}
        <div className="print-only mb-6">
          <h1 className="font-display text-xl font-semibold" style={{ color: 'var(--ink)' }}>Bloomreach Partner Portal — All Implementations</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Exported {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        {/* Header */}
        <div className="no-print flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-[22px] font-semibold" style={{ color: 'var(--ink)' }}>All Implementations</h1>
            <p className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>
              {activeImpls.length} active implementation{activeImpls.length !== 1 ? 's' : ''} across {partners.length} partner{partners.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2.5">
            <Link
              to="/admin/analytics"
              className="text-sm font-medium px-4 py-2 rounded-[10px] transition-colors"
              style={{ border: '1px solid var(--hairline)', color: 'var(--ink)' }}
            >
              Analytics
            </Link>
            <button
              onClick={() => window.print()}
              className="text-sm font-medium px-4 py-2 rounded-[10px] transition-colors"
              style={{ border: '1px solid var(--hairline)', background: '#fff', color: 'var(--ink)' }}
            >
              Export to PDF
            </button>
            <button
              onClick={() => { setShowAdd(v => !v); setAddError(null) }}
              className="text-black text-sm font-semibold px-4 py-2 rounded-[10px] transition-opacity hover:opacity-90"
              style={{ background: 'var(--gold)' }}
            >
              + Add implementation
            </button>
          </div>
        </div>

        {/* Pending sign-ups awaiting approval */}
        {pending.length > 0 && (
          <div className="no-print bg-white rounded-2xl p-6 mb-5" style={{ border: '1px solid var(--gold)' }}>
            <h2 className="font-display text-base font-semibold" style={{ color: 'var(--ink)' }}>
              Pending sign-ups <span className="font-mono text-sm" style={{ color: 'var(--muted)' }}>({pending.length})</span>
            </h2>
            <p className="text-xs mt-0.5 mb-4" style={{ color: 'var(--muted)' }}>
              These people created an account but can't see anything yet. Assign them to an engagement to let them in.
            </p>
            <div className="space-y-3">
              {pending.map(p => (
                <PendingRow key={p.id} profile={p} implementations={implementations} onApprove={approvePending} onDecline={declinePending} />
              ))}
            </div>
          </div>
        )}

        {/* Add partner form */}
        {showAdd && (
          <div className="no-print bg-white rounded-2xl p-6 mb-5" style={{ border: '1px solid var(--hairline)' }}>
            <h2 className="font-display text-base font-semibold mb-4" style={{ color: 'var(--ink)' }}>Add new partner implementation</h2>
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Partner email(s) *</label>
                <input
                  type="text"
                  required
                  value={form.emails}
                  onChange={e => setForm(f => ({ ...f, emails: e.target.value }))}
                  placeholder="jane@partner.com, alex@partner.com"
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ border: '1px solid var(--hairline)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Partner name *</label>
                <input
                  type="text"
                  required
                  value={form.partner_name}
                  onChange={e => setForm(f => ({ ...f, partner_name: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ border: '1px solid var(--hairline)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Client name *</label>
                <input
                  type="text"
                  required
                  value={form.client_name}
                  onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ border: '1px solid var(--hairline)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Slack channel ID</label>
                <input
                  type="text"
                  value={form.slackChannelId}
                  onChange={e => setForm(f => ({ ...f, slackChannelId: e.target.value }))}
                  placeholder="C0123ABCD (optional)"
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ border: '1px solid var(--hairline)' }}
                />
              </div>
              {addError && (
                <div className="sm:col-span-4 text-sm" style={{ color: 'var(--rust)' }}>{addError}</div>
              )}
              <div className="sm:col-span-4 flex gap-3">
                <button
                  type="submit"
                  disabled={adding}
                  className="disabled:opacity-50 text-black text-sm font-medium px-5 py-2 rounded-lg transition-opacity hover:opacity-90"
                  style={{ background: 'var(--gold)' }}
                >
                  {adding ? 'Adding…' : 'Add implementation'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setForm(EMPTY_FORM); setAddError(null) }}
                  className="text-sm px-4 py-2"
                  style={{ color: 'var(--muted)' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-sm" style={{ color: 'var(--muted)' }}>Loading…</div>
        ) : error ? (
          <div className="text-center py-20 text-sm" style={{ color: 'var(--rust)' }}>{error}</div>
        ) : implementations.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-sm" style={{ border: '1px solid var(--hairline)', color: 'var(--muted)' }}>
            No implementations yet. Add a partner above to get started.
          </div>
        ) : (
          <>
            {/* Attention strip */}
            {hasAttention && (
              <div className="no-print flex items-center gap-3 rounded-2xl mb-5" style={{ background: '#fbeee9', border: '1px solid #f0c9ba', padding: '14px 18px' }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--rust)' }} />
                <p className="text-[13.5px] font-medium m-0" style={{ color: '#8a3018' }}>
                  {overdueCount} overdue implementation{overdueCount !== 1 ? 's' : ''} · {totalOpenRaid} open RAID item{totalOpenRaid !== 1 ? 's' : ''} need attention
                </p>
              </div>
            )}

            {/* Primary stats */}
            <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              {[
                { label: 'Active', value: activeImpls.length },
                { label: 'Avg Progress', value: `${avgProgress}%` },
                { label: 'Avg QA', value: `${avgQA}%` },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl relative overflow-hidden" style={{ border: '1px solid var(--hairline)', padding: '18px 20px' }}>
                  <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'var(--gold)' }} />
                  <p className="font-mono text-[32px] font-semibold leading-none" style={{ color: 'var(--ink)' }}>{s.value}</p>
                  <p className="text-[12.5px] mt-1.5" style={{ color: 'var(--muted)' }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Secondary stats */}
            <div className="grid gap-2.5 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
              {[
                { label: 'Complete', value: completedImpls.length, warn: false },
                { label: 'Open RAID', value: totalOpenRaid, warn: totalOpenRaid > 0 },
                { label: 'Overdue', value: overdueCount, warn: overdueCount > 0 },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl flex items-center justify-between" style={{ border: '1px solid var(--hairline)', padding: '12px 16px' }}>
                  <span className="text-[12.5px]" style={{ color: 'var(--muted)' }}>{s.label}</span>
                  <span className="font-mono text-[15px] font-semibold" style={{ color: s.warn ? 'var(--rust)' : 'var(--ink)' }}>{s.value}</span>
                </div>
              ))}
            </div>

            {/* Partner filter chips */}
            <div className="no-print flex items-center gap-2 mb-5 flex-wrap">
              {['All', ...partners].map(p => (
                <button
                  key={p}
                  onClick={() => setPartnerFilter(p)}
                  className="text-[12.5px] font-medium px-3.5 py-1.5 rounded-full transition-colors"
                  style={partnerFilter === p
                    ? { background: 'var(--gold)', color: '#000', border: '1px solid var(--gold)' }
                    : { background: '#fff', color: 'var(--muted)', border: '1px solid var(--hairline)' }}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Partner-grouped implementation cards */}
            {partnerGroups.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center text-sm mb-6" style={{ border: '1px solid var(--hairline)', color: 'var(--muted)' }}>
                No active implementations{partnerFilter !== 'All' ? ` for ${partnerFilter}` : ''}.
              </div>
            ) : (
              partnerGroups.map(group => (
                <div key={group.name} className="mb-8">
                  <div className="flex items-baseline justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-display text-base font-semibold" style={{ color: 'var(--ink)' }}>{group.name}</h3>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>{group.impls.length} implementation{group.impls.length !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>avg progress {group.avg}%</span>
                  </div>
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                    {group.impls.map(impl => (
                      <ImplCard key={impl.id} impl={impl} tpKeys={tpKeys} qaKeys={qaKeys} />
                    ))}
                  </div>
                </div>
              ))
            )}

            {/* Completed — collapsed by default */}
            {completedImpls.length > 0 && (
              <div>
                <button
                  onClick={() => setShowCompleted(v => !v)}
                  className="no-print flex items-center gap-2 text-sm font-medium hover:opacity-70"
                  style={{ color: 'var(--muted)' }}
                >
                  <span className={`inline-block transition-transform ${showCompleted ? 'rotate-90' : ''}`}>›</span>
                  Completed ({completedImpls.length})
                </button>
                {showCompleted && (
                  <div className="grid gap-3 mt-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                    {completedImpls.map(impl => (
                      <CompletedCard key={impl.id} impl={impl} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ImplCard({ impl, tpKeys, qaKeys }) {
  const tpDone = tpKeys.filter(k => (impl.touchPoints || {})[k] === 'complete').length
  const qaDone = qaKeys.filter(k => (impl.qaSteps || {})[k] === 'complete').length
  const progress = getProgress(impl, tpKeys)
  const qa = getQAProgress(impl, qaKeys)
  const openRaid = openRaidCount(impl)
  return (
    <Link
      to={`/admin/implementation/${impl.id}`}
      className="block bg-white rounded-2xl p-4 transition-shadow"
      style={{ border: '1px solid var(--hairline)' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 18px rgba(10,10,10,0.08)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14.5px] font-semibold" style={{ color: 'var(--ink)' }}>{impl.client_name}</span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: impl.status === 'complete' ? 'var(--moss-bg)' : 'var(--paper)', color: impl.status === 'complete' ? 'var(--moss)' : 'var(--muted)' }}>
          {impl.status === 'complete' ? 'Complete' : 'Active'}
        </span>
      </div>
      {openRaid > 0 && (
        <span className="inline-block mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded" style={{ background: 'var(--rust-bg)', color: 'var(--rust)' }}>
          {openRaid} open RAID
        </span>
      )}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Progress</span>
          <span className="font-mono text-[11.5px]" style={{ color: 'var(--muted)' }}>{progress}%</span>
        </div>
        <RolloutRail total={tpKeys.length} completed={tpDone} color={progress === 100 ? 'var(--moss)' : 'var(--gold)'} size="sm" />
      </div>
      <div className="mt-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>QA</span>
          <span className="font-mono text-[11.5px]" style={{ color: 'var(--muted)' }}>{qa}%</span>
        </div>
        <RolloutRail total={qaKeys.length} completed={qaDone} color={qa === 100 ? 'var(--moss)' : 'var(--arctic)'} size="sm" />
      </div>
      <div className="flex justify-end mt-3">
        <span className="text-xs font-medium" style={{ color: 'var(--arctic)' }}>View →</span>
      </div>
    </Link>
  )
}

function CompletedCard({ impl }) {
  return (
    <Link
      to={`/admin/implementation/${impl.id}`}
      className="block bg-white rounded-2xl p-4"
      style={{ border: '1px solid var(--hairline)', opacity: 0.85 }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14.5px] font-semibold" style={{ color: 'var(--ink)' }}>{impl.client_name}</span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--moss-bg)', color: 'var(--moss)' }}>Complete</span>
      </div>
      <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{impl.partner_name}</div>
    </Link>
  )
}

function PendingRow({ profile, implementations, onApprove, onDecline }) {
  const [choice, setChoice] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const sorted = [...implementations].sort((a, b) =>
    (a.partner_name + a.client_name).localeCompare(b.partner_name + b.client_name))
  const partners = Array.from(new Set(implementations.map(i => i.partner_name).filter(Boolean))).sort()

  async function approve() {
    if (!choice) { setError('Choose what to grant first.'); return }
    setBusy(true)
    setError(null)
    const target = choice === 'admin'
      ? { type: 'admin' }
      : choice.startsWith('partner:')
      ? { type: 'partner', partnerName: choice.slice(8) }
      : { type: 'implementation', id: choice.slice(5) }
    const err = await onApprove(profile, target)
    if (err) { setError(err); setBusy(false) }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-48">
        <div className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{profile.email}</div>
        <div className="text-xs" style={{ color: 'var(--muted)' }}>
          signed up {new Date(profile.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </div>
      </div>
      <select
        value={choice}
        onChange={e => setChoice(e.target.value)}
        className="rounded-lg px-3 py-2 text-sm focus:outline-none"
        style={{ border: '1px solid var(--hairline)', color: 'var(--ink)', background: '#fff' }}
        aria-label={`Grant access for ${profile.email}`}
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
        </optgroup>
      </select>
      <button
        onClick={approve}
        disabled={busy}
        className="disabled:opacity-50 text-black text-sm font-medium px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
        style={{ background: 'var(--gold)' }}
      >
        {busy ? 'Approving…' : 'Approve'}
      </button>
      <button
        onClick={async () => {
          if (!confirm(`Decline ${profile.email}? They keep their account but stay locked out until you approve them later.`)) return
          setBusy(true)
          setError(null)
          const err = await onDecline(profile)
          if (err) { setError(err); setBusy(false) }
        }}
        disabled={busy}
        className="disabled:opacity-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        style={{ border: '1px solid var(--hairline)', color: 'var(--rust)' }}
      >
        Decline
      </button>
      {error && <span className="text-xs" style={{ color: 'var(--rust)' }}>{error}</span>}
    </div>
  )
}
