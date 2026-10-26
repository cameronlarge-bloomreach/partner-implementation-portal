import { useEffect, useMemo, useState } from 'react'
import { getAllImplementations, getStepDefinitions, listStaffAvatars, DEFAULT_STEPS } from '../api'
import Navbar from '../components/Navbar'
import ImplCard from '../components/ImplCard'
import { SkeletonBar } from '../components/Skeleton'
import { openRaidCount, isOverdue, viewOf } from '../implStatus'

// Partner home — the same cards as the admin dashboard, scoped by RLS to
// the implementations this person can access. No usage flags: partners
// can't read usage_metrics.

const TABS = [
  ['active', 'Active'],
  ['pending', 'Pending'],
  ['closed', 'Closed'],
]

function Stat({ label, value, tone, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-white rounded-2xl px-4 py-3 transition-shadow hover:shadow-md"
      style={{ border: active ? '1px solid var(--ink)' : '1px solid var(--hairline)' }}
    >
      <div className="font-mono text-2xl font-semibold leading-none" style={{ color: tone === 'rust' && value > 0 ? 'var(--rust)' : 'var(--ink)' }}>{value}</div>
      <div className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>{label}</div>
    </button>
  )
}

export default function PartnerSelect({ userInfo, onLogout }) {
  const [implementations, setImplementations] = useState(null)
  const [error, setError] = useState(null)
  const [steps, setSteps] = useState(DEFAULT_STEPS)
  const [avatars, setAvatars] = useState({})
  const [tab, setTab] = useState('active')
  const [issue, setIssue] = useState(null) // null | 'overdue' | 'raid'
  const [search, setSearch] = useState('')
  const tpKeys = steps.touchpoints.map(s => s.key)
  const qaKeys = steps.qaSteps.map(s => s.key)

  useEffect(() => {
    getAllImplementations()
      .then(data => data?.error ? setError('Failed to load your implementations.') : setImplementations(data || []))
      .catch(() => setError('Failed to load your implementations.'))
    getStepDefinitions().then(setSteps).catch(() => {})
    // Only CSMs / AMs get rows back (RLS); partners see no team stack anyway.
    listStaffAvatars().then(setAvatars).catch(() => {})
  }, [])

  const byTab = useMemo(() => {
    const groups = { active: [], pending: [], closed: [] }
    for (const i of implementations || []) groups[viewOf(i)].push(i)
    return groups
  }, [implementations])

  const partnerNames = Array.from(new Set((implementations || []).map(i => i.partner_name).filter(Boolean))).sort()
  const overdue = byTab.active.filter(isOverdue)
  const openRaid = byTab.active.reduce((sum, i) => sum + openRaidCount(i), 0)

  const q = search.trim().toLowerCase()
  const visible = byTab[tab]
    .filter(i => issue !== 'overdue' || isOverdue(i))
    .filter(i => issue !== 'raid' || openRaidCount(i) > 0)
    .filter(i => !q || [i.client_name, i.partner_name].some(v => v?.toLowerCase().includes(q)))
    .sort((a, b) => (a.partner_name + a.client_name).localeCompare(b.partner_name + b.client_name))

  function pick(nextTab, nextIssue = null) {
    setTab(nextTab)
    setIssue(prev => (nextIssue && prev === nextIssue ? null : nextIssue))
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <Navbar userInfo={userInfo} onLogout={onLogout} title="Partner Portal" />

      <div className="max-w-6xl mx-auto px-4 sm:px-7 py-7">
        <div className="mb-5">
          <h1 className="font-display text-[22px] font-semibold" style={{ color: 'var(--ink)' }}>Your implementations</h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>
            {partnerNames.length ? `${partnerNames.join(', ')} · ` : ''}Select an implementation to see its progress, RAID log and QA.
          </p>
        </div>

        {error ? (
          <div className="text-center py-20 text-sm" style={{ color: 'var(--rust)' }}>{error}</div>
        ) : !implementations ? (
          <div role="status" aria-label="Loading implementations">
            <div className="grid gap-3 mb-6 grid-cols-3">{Array.from({ length: 3 }, (_, i) => <SkeletonBar key={i} className="h-[70px] !rounded-2xl" />)}</div>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
              {Array.from({ length: 6 }, (_, i) => <SkeletonBar key={i} className="h-[150px] !rounded-2xl" />)}
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-3 mb-6 grid-cols-3">
              <Stat label="Active" value={byTab.active.length} active={tab === 'active' && !issue} onClick={() => pick('active')} />
              <Stat label="Overdue" value={overdue.length} tone="rust" active={issue === 'overdue'} onClick={() => pick('active', 'overdue')} />
              <Stat label="Open RAID items" value={openRaid} tone="rust" active={issue === 'raid'} onClick={() => pick('active', 'raid')} />
            </div>

            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div className="inline-flex rounded-xl p-1 bg-white" style={{ border: '1px solid var(--hairline)' }} role="tablist">
                {TABS.filter(([k]) => k === 'active' || byTab[k].length > 0).map(([k, label]) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={tab === k}
                    onClick={() => pick(k)}
                    className="text-[13px] font-medium px-3.5 py-1.5 rounded-lg transition-colors"
                    style={tab === k ? { background: 'var(--ink)', color: '#fff' } : { color: 'var(--ink)' }}
                  >
                    {label} <span style={{ opacity: 0.6 }}>{byTab[k].length}</span>
                  </button>
                ))}
              </div>
              {(implementations.length > 6) && (
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search clients…"
                  className="rounded-lg px-3 py-2 text-[13px] focus:outline-none bg-white w-full sm:w-64"
                  style={{ border: '1px solid var(--hairline)' }}
                />
              )}
            </div>

            {issue && (
              <button
                onClick={() => setIssue(null)}
                className="text-[12.5px] font-medium px-3 py-1.5 rounded-full mb-4"
                style={{ background: 'var(--rust-bg)', color: 'var(--rust)', border: '1px solid #f0c9ba' }}
              >
                {issue === 'overdue' ? 'Overdue' : 'Open RAID'} only ×
              </button>
            )}

            {visible.length === 0 ? (
              <div className="bg-white rounded-2xl py-16 px-6 text-center" style={{ border: '1px dashed var(--hairline)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                  {q ? 'Nothing matches that search.' : issue ? 'Nothing here — all clear.' : `No ${tab} implementations.`}
                </p>
              </div>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                {visible.map((impl, i) => (
                  <ImplCard
                    key={impl.id}
                    impl={impl}
                    to={`/implementation/${impl.id}`}
                    tpKeys={tpKeys}
                    qaKeys={qaKeys}
                    showPartner={partnerNames.length > 1}
                    showUsage={false}
                    avatars={avatars}
                    index={i}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
