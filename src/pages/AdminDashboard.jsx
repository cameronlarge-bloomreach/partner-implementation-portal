import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getAllImplementations, addImplementation, getPendingSignups,
  getStepDefinitions, DEFAULT_STEPS, IMPLEMENTATION_STATUSES, USAGE_METERS,
} from '../api'
import Navbar from '../components/Navbar'
import RolloutRail from '../components/RolloutRail'
import ModalShell from '../components/ModalShell'
import { SkeletonBar } from '../components/Skeleton'

function stepsDone(map, keys) {
  return keys.filter(k => (map || {})[k] === 'complete').length
}

function openRaidCount(impl) {
  return (impl.raid || []).filter(r => r.status === 'Open' || r.status === 'In Progress').length
}

function daysUntil(date) {
  if (!date) return null
  const ms = new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  return Math.round(ms / 86400000)
}

function isOverdue(impl) {
  const d = daysUntil(impl.planned_completion_date)
  return d != null && d < 0
}

// Contracted billing meters are manual entry (no API source) — flag when
// they're missing, look mismatched for the client's pricing model, or
// haven't been touched in a while, so someone goes and checks them.
const STALE_USAGE_DAYS = 60

function usageIssue(impl) {
  const required = USAGE_METERS[impl.pricingModel] || USAGE_METERS.profiles
  const other = USAGE_METERS[impl.pricingModel === 'profiles' ? 'events' : 'profiles']
  const metrics = impl.usageMetrics || {}

  const missing = required.filter(m => metrics[m.key]?.value == null || metrics[m.key]?.limit == null)
  if (missing.length) return `missing ${missing.map(m => m.label).join(', ')}`

  const wrongModel = other.filter(m => metrics[m.key]?.value != null)
  if (wrongModel.length) return `has ${impl.pricingModel === 'profiles' ? 'event' : 'profile'} data despite being on the ${impl.pricingModel} model`

  const stalest = required.map(m => metrics[m.key]?.updatedAt).filter(Boolean).sort()[0]
  if (stalest && (Date.now() - new Date(stalest)) / 86400000 > STALE_USAGE_DAYS) return `stale (last updated over ${STALE_USAGE_DAYS} days ago)`

  return null
}

const ISSUES = {
  raid: { label: 'Open RAID', test: i => openRaidCount(i) > 0 },
  overdue: { label: 'Overdue', test: isOverdue },
  usage: { label: 'Usage data', test: i => !!usageIssue(i) },
}
const needsAttention = i => Object.values(ISSUES).some(x => x.test(i))

const VIEWS = {
  active: { label: 'Active', subtitle: 'Signed and in progress' },
  attention: { label: 'Needs attention', subtitle: 'Active implementations with open RAID items, overdue dates or usage data to review' },
  pending: { label: 'Pending', subtitle: 'Set up in the portal, not yet signed with Bloomreach' },
  closed: { label: 'Closed', subtitle: 'Finished implementations' },
}

function viewOf(impl) {
  return impl.status === 'pending' ? 'pending' : impl.status === 'complete' ? 'closed' : 'active'
}

// ---- Cards ----

function Flag({ tone, children, title }) {
  const styles = {
    rust: { background: 'var(--rust-bg)', color: 'var(--rust)' },
    amber: { background: '#FFFCE8', color: '#8A7A00' },
    muted: { background: 'var(--paper)', color: 'var(--muted)' },
  }
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={styles[tone]} title={title}>
      {children}
    </span>
  )
}

function DueLabel({ impl }) {
  const d = daysUntil(impl.planned_completion_date)
  if (d == null) return null
  const date = new Date(impl.planned_completion_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  if (d < 0) return <Flag tone="rust" title={`Planned completion ${date}`}>Overdue {-d}d</Flag>
  if (d <= 14) return <Flag tone="amber" title={`Planned completion ${date}`}>Due in {d}d</Flag>
  return <Flag tone="muted">Due {date}</Flag>
}

function Rail({ label, done, total, color }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>{label}</span>
        <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>{done}/{total}</span>
      </div>
      <RolloutRail total={total} completed={done} color={total && done === total ? 'var(--moss)' : color} size="sm" />
    </div>
  )
}

function ImplCard({ impl, tpKeys, qaKeys, showPartner, index = 0 }) {
  const view = viewOf(impl)
  const openRaid = openRaidCount(impl)
  const usageProblem = view === 'active' && usageIssue(impl)
  const status = IMPLEMENTATION_STATUSES[impl.status] ?? IMPLEMENTATION_STATUSES.active

  return (
    <Link
      to={`/admin/implementation/${impl.id}`}
      className="impl-card pressable card-enter flex flex-col bg-white rounded-2xl p-4"
      style={{ border: '1px solid var(--hairline)', '--i': Math.min(index, 10) }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[14.5px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{impl.client_name}</div>
          {showPartner && <div className="text-xs truncate" style={{ color: 'var(--muted)' }}>{impl.partner_name}</div>}
        </div>
        {view === 'active'
          ? <DueLabel impl={impl} />
          : <Flag tone="muted"><span style={{ color: status.color }}>{status.label}</span></Flag>}
      </div>

      {view === 'active' && (openRaid > 0 || usageProblem) && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {openRaid > 0 && <Flag tone="rust">{openRaid} open RAID</Flag>}
          {usageProblem && <Flag tone="amber" title={`Usage data ${usageProblem}`}>Usage data</Flag>}
        </div>
      )}

      {view !== 'pending' && (
        <div className="space-y-2.5 mt-auto pt-4">
          <Rail label="Rollout" done={stepsDone(impl.touchPoints, tpKeys)} total={tpKeys.length} color="var(--gold)" />
          <Rail label="QA" done={stepsDone(impl.qaSteps, qaKeys)} total={qaKeys.length} color="var(--arctic)" />
        </div>
      )}
    </Link>
  )
}

// ---- Sidebar ----

function NavItem({ active, onClick, label, count, tone }) {
  const badge = active ? { background: 'rgba(255,255,255,0.2)' }
    : tone === 'rust' ? { background: 'var(--rust-bg)', color: 'var(--rust)' }
    : { background: 'var(--paper)', color: 'var(--muted)' }
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-2 text-left text-[13px] px-3 py-2 rounded-lg transition-colors"
      style={active ? { background: 'var(--ink)', color: '#fff' } : { color: 'var(--ink)' }}
      aria-current={active ? 'true' : undefined}
    >
      <span className="truncate">{label}</span>
      <span className="text-[11px] font-semibold rounded-full px-1.5 min-w-5 text-center" style={badge}>{count}</span>
    </button>
  )
}

function Stat({ label, value, tone, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-white rounded-2xl px-4 py-3 transition-shadow hover:shadow-md"
      style={{ border: '1px solid var(--hairline)' }}
    >
      <div className="font-mono text-2xl font-semibold leading-none" style={{ color: tone === 'rust' && value > 0 ? 'var(--rust)' : 'var(--ink)' }}>{value}</div>
      <div className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>{label}</div>
    </button>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]" role="status" aria-label="Loading implementations">
      <div className="space-y-2">{Array.from({ length: 9 }, (_, i) => <SkeletonBar key={i} className="h-8" />)}</div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {Array.from({ length: 9 }, (_, i) => <SkeletonBar key={i} className="h-[150px] !rounded-2xl" />)}
      </div>
    </div>
  )
}

// ---- Add implementation ----

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)' }}>{label}</span>
      {children}
    </label>
  )
}

const EMPTY_FORM = { emails: '', partner_name: '', client_name: '', slackChannelId: '' }

function AddImplementationModal({ partners, onAdd, onClose }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))
  const inputClass = 'w-full rounded-lg px-3 py-2 text-sm focus:outline-none'
  const inputStyle = { border: '1px solid var(--hairline)' }

  async function submit(e, close) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await onAdd(form)
    setBusy(false)
    if (err) setError(err)
    else close()
  }

  return (
    <ModalShell onClose={onClose} panelClassName="max-w-md">
      {close => (
        <form onSubmit={e => submit(e, close)} className="p-6">
          <div className="flex items-start justify-between mb-1">
            <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--ink)' }}>Add implementation</h2>
            <button type="button" onClick={close} className="text-xl leading-none hover:opacity-70" style={{ color: 'var(--muted)' }} aria-label="Close">×</button>
          </div>
          <p className="text-[13px] mb-5" style={{ color: 'var(--muted)' }}>
            Starts as Pending — mark it Active from the implementation’s Setup tab once the client has signed.
          </p>
          <div className="space-y-3 mb-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Partner *">
                <input required list="known-partners" value={form.partner_name} onChange={set('partner_name')} className={inputClass} style={inputStyle} autoFocus />
                <datalist id="known-partners">{partners.map(p => <option key={p} value={p} />)}</datalist>
              </Field>
              <Field label="Client *">
                <input required value={form.client_name} onChange={set('client_name')} className={inputClass} style={inputStyle} />
              </Field>
            </div>
            <Field label="Partner email(s) *">
              <input required value={form.emails} onChange={set('emails')} placeholder="jane@partner.com, alex@partner.com" className={inputClass} style={inputStyle} />
            </Field>
            <Field label="Slack channel ID">
              <input value={form.slackChannelId} onChange={set('slackChannelId')} placeholder="C0123ABCD (optional)" className={inputClass} style={inputStyle} />
            </Field>
          </div>
          {error && <p className="text-xs mb-3" style={{ color: 'var(--rust)' }}>{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} className="text-sm font-medium px-4 py-2 rounded-[10px]" style={{ border: '1px solid var(--hairline)', color: 'var(--ink)' }}>Cancel</button>
            <button type="submit" disabled={busy} className="disabled:opacity-50 text-sm font-semibold px-4 py-2 rounded-[10px]" style={{ background: 'var(--gold)', color: '#000' }}>
              {busy ? 'Adding…' : 'Add implementation'}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  )
}

// ---- Page ----

export default function AdminDashboard({ credential, userInfo, onLogout }) {
  // Reachable by SDC and Viewer too (they see every implementation), but
  // implementation management (add implementation, sign-up approvals) stays
  // admin-only — isAdmin here is the true-admin flag, not "can view".
  const isAdmin = !!userInfo?.isAdmin
  const [implementations, setImplementations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [view, setView] = useState('active') // keyof VIEWS
  const [issue, setIssue] = useState('all') // within 'attention': 'all' | keyof ISSUES
  const [partner, setPartner] = useState(null)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
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
    if (isAdmin) getPendingSignups().then(p => setPendingCount(p.length)).catch(() => {})
    getStepDefinitions().then(setSteps).catch(() => {})
  }, [])

  async function handleAdd(form) {
    try {
      const res = await addImplementation(credential, form)
      if (res.error) return res.error
      setImplementations(prev => [...prev, {
        id: res.id,
        partner_name: form.partner_name.trim(),
        client_name: form.client_name.trim(),
        status: 'pending',
        accessEmails: form.emails.split(',').map(s => s.trim()).filter(Boolean),
        slackChannelId: form.slackChannelId.trim(),
        touchPoints: {},
        qaSteps: {},
        raid: [],
      }])
      setView('pending')
      setPartner(null)
      return null
    } catch {
      return 'Failed to add implementation. Please try again.'
    }
  }

  const byView = useMemo(() => {
    const groups = { active: [], attention: [], pending: [], closed: [] }
    for (const i of implementations) {
      const v = viewOf(i)
      groups[v].push(i)
      if (v === 'active' && needsAttention(i)) groups.attention.push(i)
    }
    return groups
  }, [implementations])

  const issueCounts = Object.fromEntries(Object.entries(ISSUES).map(([k, x]) => [k, byView.active.filter(x.test).length]))
  const totalOpenRaid = byView.active.reduce((sum, i) => sum + openRaidCount(i), 0)

  const q = search.trim().toLowerCase()
  const inView = byView[view]
    .filter(i => view !== 'attention' || issue === 'all' || ISSUES[issue].test(i))
    .filter(i => !q || [i.client_name, i.partner_name].some(v => v?.toLowerCase().includes(q)))

  // Partner list reflects the current view, so counts always add up.
  const partnerCounts = {}
  for (const i of inView) if (i.partner_name) partnerCounts[i.partner_name] = (partnerCounts[i.partner_name] || 0) + 1
  const partnerNames = Object.keys(partnerCounts).sort((a, b) => a.localeCompare(b))
  const allPartners = Array.from(new Set(implementations.map(i => i.partner_name).filter(Boolean))).sort()

  const visible = inView
    .filter(i => !partner || i.partner_name === partner)
    .sort((a, b) => (a.partner_name + a.client_name).localeCompare(b.partner_name + b.client_name))

  function pickView(v) {
    setView(v)
    setIssue('all')
    setPartner(null)
  }

  const title = partner ? `${partner}` : VIEWS[view].label
  const subtitle = partner
    ? `${visible.length} ${VIEWS[view].label.toLowerCase()} implementation${visible.length === 1 ? '' : 's'}`
    : VIEWS[view].subtitle

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <div className="no-print">
        <Navbar userInfo={userInfo} onLogout={onLogout} title={userInfo?.isViewer && !userInfo?.isAdmin && !userInfo?.isSDC ? 'Viewer — Partner Portal' : 'Admin — Partner Portal'} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-7 py-7">
        {/* Print-only header, shown when exported to PDF */}
        <div className="print-only mb-6">
          <h1 className="font-display text-xl font-semibold" style={{ color: 'var(--ink)' }}>Bloomreach Partner Portal — {title}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Exported {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        {/* Header */}
        <div className="no-print flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-[22px] font-semibold" style={{ color: 'var(--ink)' }}>Implementations</h1>
            <p className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>
              {byView.active.length} active across {new Set(byView.active.map(i => i.partner_name)).size} partners
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <Link to="/admin/analytics" className="text-sm font-medium px-4 py-2 rounded-[10px]" style={{ border: '1px solid var(--hairline)', color: 'var(--ink)' }}>
                Analytics
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin/permissions" className="text-sm font-medium px-4 py-2 rounded-[10px]" style={{ border: '1px solid var(--hairline)', color: 'var(--ink)' }}>
                Permissions
              </Link>
            )}
            <button onClick={() => window.print()} className="text-sm font-medium px-4 py-2 rounded-[10px]" style={{ border: '1px solid var(--hairline)', background: '#fff', color: 'var(--ink)' }}>
              Export to PDF
            </button>
            {isAdmin && (
              <button onClick={() => setAdding(true)} className="text-sm font-semibold px-4 py-2 rounded-[10px]" style={{ background: 'var(--gold)', color: '#000' }}>
                + Add implementation
              </button>
            )}
          </div>
        </div>

        {/* Sign-ups now live on the Permissions page — just point there */}
        {isAdmin && pendingCount > 0 && (
          <Link
            to="/admin/permissions"
            state={{ group: 'awaiting' }}
            className="no-print flex items-center justify-between gap-3 rounded-2xl px-4 py-3 mb-5 hover:opacity-90"
            style={{ background: '#FFFCE8', border: '1px solid var(--gold)' }}
          >
            <span className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
              {pendingCount} {pendingCount === 1 ? 'person is' : 'people are'} waiting for access
            </span>
            <span className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Review →</span>
          </Link>
        )}

        {loading ? (
          <DashboardSkeleton />
        ) : error ? (
          <div className="text-center py-20 text-sm" style={{ color: 'var(--rust)' }}>{error}</div>
        ) : (
          <>
            {/* At-a-glance numbers — each one jumps to its view */}
            <div className="no-print grid gap-3 mb-6 grid-cols-2 sm:grid-cols-4">
              <Stat label="Active" value={byView.active.length} onClick={() => pickView('active')} />
              <Stat label="Need attention" value={byView.attention.length} tone="rust" onClick={() => pickView('attention')} />
              <Stat label="Overdue" value={issueCounts.overdue} tone="rust" onClick={() => { pickView('attention'); setIssue('overdue') }} />
              <Stat label="Open RAID items" value={totalOpenRaid} tone="rust" onClick={() => { pickView('attention'); setIssue('raid') }} />
            </div>

            <div className="grid gap-6 md:grid-cols-[240px_1fr] items-start print:block">
              {/* Phones: search + dropdowns instead of the sidebar */}
              <div className="no-print md:hidden flex flex-col gap-2">
                <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients or partners…"
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none bg-white" style={{ border: '1px solid var(--hairline)' }} />
                <div className="grid grid-cols-2 gap-2">
                  <select value={view} onChange={e => pickView(e.target.value)} aria-label="View"
                    className="rounded-lg px-3 py-2 text-sm focus:outline-none bg-white" style={{ border: '1px solid var(--hairline)', color: 'var(--ink)' }}>
                    {Object.entries(VIEWS).map(([k, v]) => <option key={k} value={k}>{v.label} ({byView[k].length})</option>)}
                  </select>
                  <select value={partner || ''} onChange={e => setPartner(e.target.value || null)} aria-label="Partner"
                    className="rounded-lg px-3 py-2 text-sm focus:outline-none bg-white" style={{ border: '1px solid var(--hairline)', color: 'var(--ink)' }}>
                    <option value="">All partners</option>
                    {partnerNames.map(p => <option key={p} value={p}>{p} ({partnerCounts[p]})</option>)}
                  </select>
                </div>
              </div>

              {/* Sidebar */}
              <aside className="no-print hidden md:block md:sticky md:top-6 bg-white rounded-2xl p-3" style={{ border: '1px solid var(--hairline)' }}>
                <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients or partners…"
                  className="w-full rounded-lg px-3 py-2 text-[13px] focus:outline-none mb-2" style={{ border: '1px solid var(--hairline)', background: 'var(--paper)' }} />
                <nav className="space-y-0.5">
                  <NavItem active={view === 'active' && !partner} onClick={() => pickView('active')} label="Active" count={byView.active.length} />
                  <NavItem active={view === 'attention' && !partner} onClick={() => pickView('attention')} label="Needs attention" count={byView.attention.length} tone={byView.attention.length ? 'rust' : undefined} />
                  <NavItem active={view === 'pending' && !partner} onClick={() => pickView('pending')} label="Pending" count={byView.pending.length} />
                  <NavItem active={view === 'closed' && !partner} onClick={() => pickView('closed')} label="Closed" count={byView.closed.length} />
                </nav>
                <div className="text-[11px] font-semibold uppercase tracking-widest px-3 mt-4 mb-1.5" style={{ color: 'var(--muted)' }}>
                  Partners · {VIEWS[view].label.toLowerCase()}
                </div>
                <nav className="space-y-0.5 max-h-[50vh] overflow-y-auto">
                  {partnerNames.map(p => (
                    <NavItem key={p} active={partner === p} onClick={() => setPartner(partner === p ? null : p)} label={p} count={partnerCounts[p]} />
                  ))}
                  {partnerNames.length === 0 && <p className="text-xs px-3 py-1" style={{ color: 'var(--muted)' }}>None in this view.</p>}
                </nav>
              </aside>

              {/* Main */}
              <section>
                <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
                  <div>
                    <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--ink)' }}>{title}</h2>
                    <p className="text-[13px]" style={{ color: 'var(--muted)' }}>{subtitle}</p>
                  </div>
                  {partner && (
                    <button onClick={() => setPartner(null)} className="no-print text-[13px] font-medium hover:underline" style={{ color: 'var(--arctic-dark)' }}>
                      ← All partners
                    </button>
                  )}
                </div>

                {view === 'attention' && (
                  <div className="no-print flex flex-wrap gap-2 mb-4">
                    {[['all', 'All issues', byView.attention.length], ...Object.entries(ISSUES).map(([k, x]) => [k, x.label, issueCounts[k]])].map(([k, label, n]) => (
                      <button
                        key={k}
                        onClick={() => setIssue(k)}
                        disabled={n === 0}
                        className="disabled:opacity-40 text-[12.5px] font-medium px-3 py-1.5 rounded-full transition-colors"
                        style={issue === k
                          ? { background: 'var(--ink)', color: '#fff', border: '1px solid var(--ink)' }
                          : { background: '#fff', color: 'var(--ink)', border: '1px solid var(--hairline)' }}
                      >
                        {label} <span style={{ opacity: 0.6 }}>{n}</span>
                      </button>
                    ))}
                  </div>
                )}

                {visible.length === 0 ? (
                  <div className="bg-white rounded-2xl py-16 px-6 text-center" style={{ border: '1px dashed var(--hairline)' }}>
                    <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                      {q ? 'Nothing matches that search.' : view === 'attention' ? 'Nothing needs attention — all clear.' : `No ${VIEWS[view].label.toLowerCase()} implementations.`}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                    {visible.map((impl, i) => (
                      <ImplCard key={impl.id} impl={impl} tpKeys={tpKeys} qaKeys={qaKeys} showPartner={!partner} index={i} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>

      {adding && <AddImplementationModal partners={allPartners} onAdd={handleAdd} onClose={() => setAdding(false)} />}
    </div>
  )
}
