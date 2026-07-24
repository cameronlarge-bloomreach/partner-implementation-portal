import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllImplementations } from '../api'
import Navbar from '../components/Navbar'

function fmt(n) {
  return n === null || n === undefined ? '—' : Number(n).toLocaleString()
}

function formatDateTime(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// The client's billing meter and its usage/limit.
function activeUsage(impl) {
  const onEvents = impl.pricingModel === 'events'
  return {
    meter: onEvents ? 'events' : 'profiles',
    count: onEvents ? impl.eventCount : impl.profileCount,
    limit: onEvents ? impl.eventLimit : impl.profileLimit,
    syncedAt: onEvents ? impl.eventCountSyncedAt : impl.profileCountSyncedAt,
    otherLabel: onEvents ? 'profiles' : 'events',
    otherCount: onEvents ? impl.profileCount : impl.eventCount,
  }
}

// Status band by utilisation — reserved status colors, always shown with the % number.
function band(pct) {
  if (pct === null) return { color: 'var(--muted)', label: null }
  if (pct >= 100) return { color: 'var(--rust)', label: 'Over limit' }
  if (pct >= 85) return { color: 'var(--gold)', label: 'Near limit' }
  return { color: 'var(--moss)', label: null }
}

function Tile({ value, label, warn }) {
  return (
    <div className="bg-white rounded-2xl p-4 relative overflow-hidden" style={{ border: '1px solid var(--hairline)' }}>
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: warn ? 'var(--rust)' : 'var(--gold)' }} />
      <p className="font-mono text-2xl font-semibold" style={{ color: warn ? 'var(--rust)' : 'var(--ink)' }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{label}</p>
    </div>
  )
}

const METERS = [['all', 'All'], ['profiles', 'Profiles'], ['events', 'Events']]

export default function Analytics({ credential, userInfo, onLogout }) {
  const [implementations, setImplementations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [meterFilter, setMeterFilter] = useState('all')

  useEffect(() => {
    getAllImplementations(credential)
      .then(data => {
        if (data?.error) setError('Failed to load analytics.')
        else setImplementations(data || [])
      })
      .catch(() => setError('Failed to load analytics.'))
      .finally(() => setLoading(false))
  }, [])

  const linked = implementations.filter(i => i.bloomreachOrgId)
  const unlinkedCount = implementations.length - linked.length

  // Build one row per linked client, with its active-meter usage + utilisation.
  const rows = linked.map(impl => {
    const u = activeUsage(impl)
    const pct = (u.count !== null && u.count !== undefined && u.limit)
      ? Math.round((Number(u.count) / Number(u.limit)) * 100)
      : null
    return { impl, ...u, pct }
  })

  const filtered = meterFilter === 'all' ? rows : rows.filter(r => r.meter === meterFilter)

  // Sort: highest utilisation first; rows without a % (no limit/data) after, by count desc.
  const sorted = [...filtered].sort((a, b) => {
    if (a.pct === null && b.pct === null) return (Number(b.count) || 0) - (Number(a.count) || 0)
    if (a.pct === null) return 1
    if (b.pct === null) return -1
    return b.pct - a.pct
  })

  const totalProfiles = linked.reduce((s, i) => s + (Number(i.profileCount) || 0), 0)
  const totalEvents = linked.reduce((s, i) => s + (Number(i.eventCount) || 0), 0)
  const nearLimit = rows.filter(r => r.pct !== null && r.pct >= 85 && r.pct < 100).length
  const overLimit = rows.filter(r => r.pct !== null && r.pct >= 100).length

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <Navbar userInfo={userInfo} onLogout={onLogout} title="Analytics — Partner Portal" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-xl font-semibold" style={{ color: 'var(--ink)' }}>Usage Analytics</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
              Profile and event usage across all linked implementations, against contracted limits.
            </p>
          </div>
          <Link
            to="/admin"
            className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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
            {/* KPI tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              <Tile value={linked.length} label="Linked clients" />
              <Tile value={fmt(totalProfiles)} label="Total profiles" />
              <Tile value={fmt(totalEvents)} label="Total events" />
              <Tile value={nearLimit} label="Near limit (≥85%)" warn={nearLimit > 0} />
              <Tile value={overLimit} label="Over limit" warn={overLimit > 0} />
            </div>

            {/* Meter filter */}
            <div className="flex items-center gap-2 mb-4">
              {METERS.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setMeterFilter(key)}
                  className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                  style={meterFilter === key
                    ? { background: 'var(--gold)', color: '#000', border: '1px solid var(--gold)' }
                    : { background: '#fff', color: 'var(--muted)', border: '1px solid var(--hairline)' }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Utilisation table */}
            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid var(--hairline)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: '720px' }}>
                  <thead style={{ background: 'var(--paper)', borderBottom: '1px solid var(--hairline)' }}>
                    <tr>
                      {['Partner / Client', 'Meter', 'Usage', 'Utilisation', 'Synced'].map(h => (
                        <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: 'var(--muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--paper)' }}>
                    {sorted.map(r => {
                      const b = band(r.pct)
                      return (
                        <tr key={r.impl.id} className="hover:bg-[var(--paper)] transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-medium" style={{ color: 'var(--ink)' }}>{r.impl.client_name}</div>
                            <div className="text-xs" style={{ color: 'var(--muted)' }}>{r.impl.partner_name}</div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
                              {r.meter === 'events' ? 'Events' : 'Profiles'}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="font-mono" style={{ color: 'var(--ink)' }}>
                              {fmt(r.count)}{r.limit ? <span style={{ color: 'var(--muted)' }}> / {fmt(r.limit)}</span> : ''}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--muted)' }}>{fmt(r.otherCount)} {r.otherLabel}</div>
                          </td>
                          <td className="px-5 py-4" style={{ minWidth: '160px' }}>
                            {r.pct === null ? (
                              <span className="text-xs" style={{ color: 'var(--muted)' }}>{r.limit ? '—' : 'no limit set'}</span>
                            ) : (
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs" style={{ color: b.color }}>{r.pct}%</span>
                                  {b.label && <span className="text-[10px] font-medium" style={{ color: b.color }}>{b.label}</span>}
                                </div>
                                <div className="mt-1 h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--hairline)' }}>
                                  <div className="h-full rounded-full" style={{ width: `${Math.min(r.pct, 100)}%`, background: b.color }} />
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4 text-xs" style={{ color: 'var(--muted)' }}>{formatDateTime(r.syncedAt)}</td>
                        </tr>
                      )
                    })}
                    {sorted.length === 0 && (
                      <tr><td colSpan={5} className="px-5 py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>
                        No linked implementations{meterFilter !== 'all' ? ` on the ${meterFilter} meter` : ''} yet.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {unlinkedCount > 0 && (
              <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
                {unlinkedCount} implementation{unlinkedCount === 1 ? '' : 's'} not linked to a Bloomreach org — no usage data, not shown.
              </p>
            )}
            <p className="text-xs mt-2 italic" style={{ color: 'var(--muted)' }}>
              Indicative usage from Engagement, not billed figures — profiles count all profiles (not just billable), events are cumulative stored (not monthly processed).
            </p>
          </>
        )}
      </div>
    </div>
  )
}
