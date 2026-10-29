import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getAllImplementations, addImplementation, getPendingSignups, getStepDefinitions, listStaffAvatars, DEFAULT_STEPS,
} from '../api'
import Navbar from '../components/Navbar'
import ImplCard from '../components/ImplCard'
import { openRaidCount, isOverdue, setupTodos, viewOf, nameFromEmail, teamEmails } from '../implStatus'
import ModalShell from '../components/ModalShell'
import { SkeletonBar } from '../components/Skeleton'
import { SidebarPanel, CollapsibleList } from '../components/Sidebar'

const ISSUES = {
  raid: { label: 'Open RAID', test: i => openRaidCount(i) > 0 },
  overdue: { label: 'Overdue', test: isOverdue },
  todos: { label: 'Setup to-dos', test: i => setupTodos(i, i.documents).some(t => !t.done) },
}
const needsAttention = i => Object.values(ISSUES).some(x => x.test(i))

const VIEWS = {
  active: { label: 'Active', subtitle: 'Signed and in progress' },
  attention: { label: 'Needs attention', subtitle: 'Active implementations with open RAID items, overdue dates or setup still to do' },
  pending: { label: 'Pending', subtitle: 'Set up in the portal, not yet signed with Bloomreach' },
  closed: { label: 'Closed', subtitle: 'Finished implementations' },
}

// ---- Sidebar ----

function NavItem({ active, onClick, label, count, tone, icon }) {
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
      <span className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="text-[11px] font-semibold rounded-full px-1.5 min-w-5 text-center" style={badge}>{count}</span>
    </button>
  )
}

const NOBODY = '__nobody'

function MiniAvatar({ name, photo }) {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full overflow-hidden text-[8.5px] font-semibold shrink-0"
      style={{ background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--hairline)' }} aria-hidden="true">
      {photo
        ? <img src={photo} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
        : name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
    </span>
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
  const [person, setPerson] = useState(null) // team email | NOBODY | null
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [steps, setSteps] = useState(DEFAULT_STEPS)
  const [avatars, setAvatars] = useState({})
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
    listStaffAvatars().then(setAvatars).catch(() => {})
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

  const matchesPartner = i => !partner || i.partner_name === partner
  const matchesPerson = i => !person || (person === NOBODY ? teamEmails(i).length === 0 : teamEmails(i).includes(person))

  // Partner and person lists reflect the current view and each other's
  // filter, so the counts always add up to what's shown.
  const partnerCounts = {}
  for (const i of inView.filter(matchesPerson)) if (i.partner_name) partnerCounts[i.partner_name] = (partnerCounts[i.partner_name] || 0) + 1
  // Busiest partners first; alphabetical among partners with the same count.
  const partnerNames = Object.keys(partnerCounts).sort((a, b) => partnerCounts[b] - partnerCounts[a] || a.localeCompare(b))
  const allPartners = Array.from(new Set(implementations.map(i => i.partner_name).filter(Boolean))).sort()

  const selfEmail = (userInfo?.email || '').toLowerCase()
  const personCounts = {}
  const personNames = {}
  let nobodyCount = 0
  for (const i of inView.filter(matchesPartner)) {
    const emails = teamEmails(i)
    if (!emails.length) nobodyCount++
    for (const e of emails) {
      personCounts[e] = (personCounts[e] || 0) + 1
      personNames[e] ||= avatars[e]?.name || ['psm', 'csm', 'am'].map(k => (i[`${k}Email`] || '').toLowerCase() === e && i[`${k}Name`]).find(Boolean) || nameFromEmail(e)
    }
  }
  // Keep the selected person listed even when the view has none of theirs.
  if (person && person !== NOBODY && !personCounts[person]) { personCounts[person] = 0; personNames[person] = avatars[person]?.name || nameFromEmail(person) }
  const personEmails = Object.keys(personCounts)
    .sort((a, b) => (b === selfEmail) - (a === selfEmail) || personNames[a].localeCompare(personNames[b]))
  const personLabel = e => e === NOBODY ? 'Nobody assigned' : e === selfEmail ? 'You' : personNames[e] || nameFromEmail(e)

  const visible = inView
    .filter(matchesPartner)
    .filter(matchesPerson)
    .sort((a, b) => (a.partner_name + a.client_name).localeCompare(b.partner_name + b.client_name))

  function pickView(v) {
    setView(v)
    setIssue('all')
    setPartner(null)
  }

  const title = partner || (person ? (person === NOBODY ? 'Nobody assigned' : person === selfEmail ? 'Your accounts' : personLabel(person)) : VIEWS[view].label)
  const subtitle = partner || person
    ? [
        `${visible.length} ${VIEWS[view].label.toLowerCase()} implementation${visible.length === 1 ? '' : 's'}`,
        partner && person && (person === NOBODY ? 'with nobody assigned' : `assigned to ${personLabel(person) === 'You' ? 'you' : personLabel(person)}`),
      ].filter(Boolean).join(' ')
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
              <Link to="/admin/qa-tickets" className="text-sm font-medium px-4 py-2 rounded-[10px]" style={{ border: '1px solid var(--hairline)', color: 'var(--ink)' }}>
                QA Tickets
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
                  {(personEmails.length > 0 || nobodyCount > 0) && (
                    <select value={person || ''} onChange={e => setPerson(e.target.value || null)} aria-label="Assigned to"
                      className="col-span-2 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white" style={{ border: '1px solid var(--hairline)', color: 'var(--ink)' }}>
                      <option value="">Anyone assigned</option>
                      {personEmails.map(e => <option key={e} value={e}>{personLabel(e)} ({personCounts[e]})</option>)}
                      {nobodyCount > 0 && <option value={NOBODY}>Nobody assigned ({nobodyCount})</option>}
                    </select>
                  )}
                </div>
              </div>

              {/* Sidebar */}
              <SidebarPanel>
                <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients or partners…"
                  className="w-full rounded-lg px-3 py-2 text-[13px] focus:outline-none mb-2" style={{ border: '1px solid var(--hairline)', background: 'var(--paper)' }} />
                <nav className="space-y-0.5">
                  <NavItem active={view === 'active'} onClick={() => pickView('active')} label="Active" count={byView.active.length} />
                  <NavItem active={view === 'attention'} onClick={() => pickView('attention')} label="Needs attention" count={byView.attention.length} tone={byView.attention.length ? 'rust' : undefined} />
                  <NavItem active={view === 'pending'} onClick={() => pickView('pending')} label="Pending" count={byView.pending.length} />
                  <NavItem active={view === 'closed'} onClick={() => pickView('closed')} label="Closed" count={byView.closed.length} />
                </nav>
                <div className="text-[11px] font-semibold uppercase tracking-widest px-3 mt-4 mb-1.5" style={{ color: 'var(--muted)' }}>
                  Partners · {VIEWS[view].label.toLowerCase()}
                </div>
                <nav className="space-y-0.5">
                  <CollapsibleList items={partnerNames} limit={8} pinned={p => p === partner} noun="partners">
                    {p => (
                      <NavItem key={p} active={partner === p} onClick={() => setPartner(partner === p ? null : p)} label={p} count={partnerCounts[p]} />
                    )}
                  </CollapsibleList>
                  {partnerNames.length === 0 && <p className="text-xs px-3 py-1" style={{ color: 'var(--muted)' }}>None in this view.</p>}
                </nav>
                {(personEmails.length > 0 || nobodyCount > 0) && (
                  <>
                    <div className="text-[11px] font-semibold uppercase tracking-widest px-3 mt-4 mb-1.5" style={{ color: 'var(--muted)' }}>
                      Assigned to
                    </div>
                    <nav className="space-y-0.5">
                      <CollapsibleList items={personEmails} limit={6} pinned={e => e === person || e === selfEmail} noun="people">
                        {e => (
                          <NavItem
                            key={e}
                            active={person === e}
                            onClick={() => setPerson(person === e ? null : e)}
                            label={personLabel(e)}
                            count={personCounts[e]}
                            icon={<MiniAvatar name={personNames[e]} photo={avatars[e]?.photoUrl} />}
                          />
                        )}
                      </CollapsibleList>
                      {nobodyCount > 0 && (
                        <NavItem active={person === NOBODY} onClick={() => setPerson(person === NOBODY ? null : NOBODY)} label="Nobody assigned" count={nobodyCount} />
                      )}
                    </nav>
                  </>
                )}
              </SidebarPanel>

              {/* Main */}
              <section>
                <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
                  <div>
                    <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--ink)' }}>{title}</h2>
                    <p className="text-[13px]" style={{ color: 'var(--muted)' }}>{subtitle}</p>
                  </div>
                  {(partner || person) && (
                    <button onClick={() => { setPartner(null); setPerson(null) }} className="no-print text-[13px] font-medium hover:underline" style={{ color: 'var(--arctic-dark)' }}>
                      Clear filters
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
                      <ImplCard key={impl.id} impl={impl} to={`/admin/implementation/${impl.id}`} tpKeys={tpKeys} qaKeys={qaKeys} showPartner={!partner} avatars={avatars} index={i} />
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
