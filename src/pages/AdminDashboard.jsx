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

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <div className="no-print">
        <Navbar userInfo={userInfo} onLogout={onLogout} title="Admin — Partner Portal" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Print-only header, shown when exported to PDF */}
        <div className="print-only mb-6">
          <h1 className="font-display text-xl font-semibold" style={{ color: 'var(--ink)' }}>Bloomreach Partner Portal — All Implementations</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Exported {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        {/* Header */}
        <div className="no-print flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-xl font-semibold" style={{ color: 'var(--ink)' }}>All Implementations</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
              {implementations.filter(i => i.status !== 'complete').length} active implementation{implementations.filter(i => i.status !== 'complete').length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/admin/control-centre"
              className="no-print text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              style={{ border: '1px solid var(--hairline)', color: 'var(--ink)' }}
            >
              Control Centre
            </Link>
            <button
              onClick={() => window.print()}
              className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              style={{ border: '1px solid var(--hairline)', color: 'var(--ink)' }}
            >
              Export to PDF
            </button>
            <button
              onClick={() => { setShowAdd(v => !v); setAddError(null) }}
              className="text-black text-sm font-medium px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
              style={{ background: 'var(--gold)' }}
            >
              + Add implementation
            </button>
          </div>
        </div>

        {/* Pending sign-ups awaiting approval */}
        {pending.length > 0 && (
          <div className="no-print bg-white rounded-2xl p-6 mb-6" style={{ border: '1px solid var(--gold)' }}>
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

        {/* Summary stats */}
        {!loading && !error && implementations.length > 0 && (() => {
          const activeImpls = implementations.filter(i => i.status !== 'complete')
          const completeCount = implementations.length - activeImpls.length
          const avgProgress = activeImpls.length
            ? Math.round(activeImpls.reduce((sum, i) => sum + getProgress(i, tpKeys), 0) / activeImpls.length)
            : 0
          const avgQA = activeImpls.length
            ? Math.round(activeImpls.reduce((sum, i) => sum + getQAProgress(i, qaKeys), 0) / activeImpls.length)
            : 0
          const totalOpenRaid = implementations.reduce(
            (sum, i) => sum + (i.raid || []).filter(r => r.status === 'Open' || r.status === 'In Progress').length, 0
          )
          const overdueCount = activeImpls.filter(i => {
            if (!i.planned_completion_date) return false
            return new Date(i.planned_completion_date) < new Date()
          }).length

          const stats = [
            { label: 'Active', value: activeImpls.length },
            { label: 'Complete', value: completeCount },
            { label: 'Avg Progress', value: `${avgProgress}%` },
            { label: 'Avg QA', value: `${avgQA}%` },
            { label: 'Open RAID', value: totalOpenRaid, warn: totalOpenRaid > 0 },
            { label: 'Overdue', value: overdueCount, warn: overdueCount > 0 },
          ]

          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              {stats.map(s => (
                <div key={s.label} className="bg-white rounded-2xl p-4 relative overflow-hidden" style={{ border: '1px solid var(--hairline)' }}>
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: s.warn ? 'var(--rust)' : 'var(--gold)' }} />
                  <p className="font-mono text-2xl font-semibold" style={{ color: s.warn ? 'var(--rust)' : 'var(--ink)' }}>{s.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{s.label}</p>
                </div>
              ))}
            </div>
          )
        })()}

        {/* Add partner form */}
        {showAdd && (
          <div className="no-print bg-white rounded-2xl p-6 mb-6" style={{ border: '1px solid var(--hairline)' }}>
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
                  placeholder=""
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
                  placeholder=""
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

        {/* Table */}
        {loading ? (
          <div className="text-center py-20 text-sm" style={{ color: 'var(--muted)' }}>Loading…</div>
        ) : error ? (
          <div className="text-center py-20 text-sm" style={{ color: 'var(--rust)' }}>{error}</div>
        ) : implementations.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-sm" style={{ border: '1px solid var(--hairline)', color: 'var(--muted)' }}>
            No implementations yet. Add a partner above to get started.
          </div>
        ) : (() => {
          const activeImpls = implementations.filter(i => i.status !== 'complete')
          const completedImpls = implementations.filter(i => i.status === 'complete')
          const partners = ['All', ...Array.from(new Set(activeImpls.map(i => i.partner_name).filter(Boolean))).sort()]
          const filtered = partnerFilter === 'All' ? activeImpls : activeImpls.filter(i => i.partner_name === partnerFilter)
          return (
          <>
            {/* Partner filter chips */}
            <div className="no-print flex items-center gap-2 mb-4 flex-wrap">
              {partners.map(p => (
                <button
                  key={p}
                  onClick={() => setPartnerFilter(p)}
                  className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                  style={partnerFilter === p
                    ? { background: 'var(--gold)', color: '#000', border: '1px solid var(--gold)' }
                    : { background: '#fff', color: 'var(--muted)', border: '1px solid var(--hairline)' }}
                >
                  {p}
                </button>
              ))}
              {partnerFilter !== 'All' && (
                <span className="text-xs ml-1" style={{ color: 'var(--muted)' }}>{filtered.length} implementation{filtered.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center text-sm mb-6" style={{ border: '1px solid var(--hairline)', color: 'var(--muted)' }}>
                No active implementations{partnerFilter !== 'All' ? ` for ${partnerFilter}` : ''}.
              </div>
            ) : (
              <ImplTable items={filtered} tpKeys={tpKeys} qaKeys={qaKeys} />
            )}

            {/* Completed — collapsed by default */}
            {completedImpls.length > 0 && (
              <div className="mt-6">
                <button
                  onClick={() => setShowCompleted(v => !v)}
                  className="no-print flex items-center gap-2 text-sm font-medium hover:opacity-70"
                  style={{ color: 'var(--muted)' }}
                >
                  <span className={`inline-block transition-transform ${showCompleted ? 'rotate-90' : ''}`}>›</span>
                  Completed ({completedImpls.length})
                </button>
                {showCompleted && (
                  <div className="mt-3">
                    <ImplTable items={completedImpls} tpKeys={tpKeys} qaKeys={qaKeys} />
                  </div>
                )}
              </div>
            )}
          </>
        )})()}
      </div>
    </div>
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

function ImplTable({ items, tpKeys, qaKeys }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid var(--hairline)' }}>
      <table className="w-full text-sm">
        <thead style={{ background: 'var(--paper)', borderBottom: '1px solid var(--hairline)' }}>
          <tr>
            <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--muted)' }}>Partner / Client</th>
            <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--muted)' }}>Progress</th>
            <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--muted)' }}>QA</th>
            <th className="no-print px-5 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: 'var(--paper)' }}>
          {items.map(impl => {
            const tpDone = tpKeys.filter(k => (impl.touchPoints || {})[k] === 'complete').length
            const qaDone = qaKeys.filter(k => (impl.qaSteps || {})[k] === 'complete').length
            const progress = getProgress(impl, tpKeys)
            const qa = getQAProgress(impl, qaKeys)
            const openRaid = (impl.raid || []).filter(r => r.status === 'Open' || r.status === 'In Progress').length
            return (
              <tr key={impl.id} className="hover:bg-[var(--paper)] transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="font-medium" style={{ color: 'var(--ink)' }}>{impl.client_name}</div>
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ background: impl.status === 'complete' ? 'var(--moss-bg)' : 'var(--paper)', color: impl.status === 'complete' ? 'var(--moss)' : 'var(--muted)' }}>
                      {impl.status === 'complete' ? 'Complete' : 'Active'}
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>{impl.partner_name}</div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>{(impl.accessEmails || []).join(', ')}</div>
                  {openRaid > 0 && (
                    <span className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--rust-bg)', color: 'var(--rust)' }}>
                      {openRaid} open RAID
                    </span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2 w-28">
                    <RolloutRail total={tpKeys.length} completed={tpDone} color={progress === 100 ? 'var(--moss)' : 'var(--gold)'} size="sm" />
                    <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>{progress}%</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2 w-28">
                    <RolloutRail total={qaKeys.length} completed={qaDone} color={qa === 100 ? 'var(--moss)' : 'var(--arctic)'} size="sm" />
                    <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>{qaDone}/{qaKeys.length}</span>
                  </div>
                </td>
                <td className="no-print px-5 py-4 text-right">
                  <Link
                    to={`/admin/implementation/${impl.id}`}
                    className="font-medium hover:opacity-70"
                    style={{ color: 'var(--arctic)' }}
                  >
                    View →
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
