import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllImplementations, USAGE_METERS } from '../api'
import Navbar from '../components/Navbar'

function fmt(n) {
  return n === null || n === undefined ? '—' : Number(n).toLocaleString()
}

function formatDateTime(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Status band by utilisation — reserved status colors, always shown with the % number.
function band(pct) {
  if (pct === null) return { color: 'var(--muted)', label: null }
  if (pct >= 100) return { color: 'var(--rust)', label: 'Over limit' }
  if (pct >= 85) return { color: '#c99a00', label: 'Near limit' }
  return { color: 'var(--moss)', label: null }
}

function Tile({ value, label, warn }) {
  return (
    <div className="bg-white rounded-2xl relative overflow-hidden" style={{ border: '1px solid var(--hairline)', padding: '16px 18px' }}>
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: warn ? 'var(--rust)' : 'var(--gold)' }} />
      <p className="font-mono text-[28px] font-semibold leading-none" style={{ color: warn ? 'var(--rust)' : 'var(--ink)' }}>{value}</p>
      <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>{label}</p>
    </div>
  )
}

// One billing meter inside a client card.
function MeterLine({ meter }) {
  const b = band(meter.pct)
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-y-0.5 mb-2">
        <span className="text-[12.5px] font-medium" style={{ color: 'var(--ink)' }}>{meter.label}</span>
        <span className="font-mono text-[11.5px] whitespace-nowrap" style={{ color: meter.pct !== null ? b.color : 'var(--muted)' }}>
          {fmt(meter.value)}{meter.limit ? ` / ${fmt(meter.limit)}` : ''} · {meter.pct !== null ? `${meter.pct}%` : (meter.limit ? 'no usage' : 'no limit')}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--hairline)' }}>
        <div className="h-full rounded-full" style={{ width: `${meter.pct === null ? 0 : Math.min(meter.pct, 100)}%`, background: b.color }} />
      </div>
    </div>
  )
}

const MODEL_FILTERS = [['all', 'All'], ['profiles', 'Profiles'], ['events', 'Events']]

export default function Analytics({ credential, userInfo, onLogout }) {
  const [implementations, setImplementations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modelFilter, setModelFilter] = useState('all')

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

  // One entry per client, carrying its model's two meters.
  const clients = linked.map(impl => {
    const model = impl.pricingModel || 'profiles'
    const meters = USAGE_METERS[model].map(meter => {
      const m = (impl.usageMetrics || {})[meter.key] || {}
      const value = m.value ?? null
      const limit = m.limit ?? null
      const pct = (value !== null && limit) ? Math.round((Number(value) / Number(limit)) * 100) : null
      return { key: meter.key, label: meter.label, value, limit, pct, updatedAt: m.updatedAt }
    })
    const worst = meters.reduce((mx, m) => (m.pct !== null && (mx === null || m.pct > mx) ? m.pct : mx), null)
    const updated = meters.map(m => m.updatedAt).filter(Boolean).sort().slice(-1)[0] || null
    return { impl, model, meters, worst, updated }
  })

  const filtered = modelFilter === 'all' ? clients : clients.filter(c => c.model === modelFilter)

  // Clients with the highest single-meter utilisation first; untracked after.
  const sorted = [...filtered].sort((a, b) => {
    if (a.worst === null && b.worst === null) return a.impl.client_name.localeCompare(b.impl.client_name)
    if (a.worst === null) return 1
    if (b.worst === null) return -1
    return b.worst - a.worst
  })

  const allMeters = clients.flatMap(c => c.meters)
  const metersTracked = allMeters.filter(m => m.limit).length
  const nearLimit = allMeters.filter(m => m.pct !== null && m.pct >= 85 && m.pct < 100).length
  const overLimit = allMeters.filter(m => m.pct !== null && m.pct >= 100).length

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <Navbar userInfo={userInfo} onLogout={onLogout} title="Analytics — Partner Portal" />

      <div className="max-w-7xl mx-auto px-7 py-7">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-[22px] font-semibold" style={{ color: 'var(--ink)' }}>Usage Analytics</h1>
            <p className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>
              Billing meters against contracted limits — Profiles &amp; Events models.
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
            <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              <Tile value={linked.length} label="Linked clients" />
              <Tile value={metersTracked} label="Meters with a limit" />
              <Tile value={nearLimit} label="Near limit (≥85%)" warn={nearLimit > 0} />
              <Tile value={overLimit} label="Over limit" warn={overLimit > 0} />
            </div>

            <div className="flex items-center gap-2" style={{ marginBottom: '18px' }}>
              {MODEL_FILTERS.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setModelFilter(key)}
                  className="text-[12.5px] font-medium px-3.5 py-1.5 rounded-full transition-colors"
                  style={modelFilter === key
                    ? { background: 'var(--gold)', color: '#000', border: '1px solid var(--gold)' }
                    : { background: '#fff', color: 'var(--muted)', border: '1px solid var(--hairline)' }}
                >
                  {label}
                </button>
              ))}
            </div>

            {sorted.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center text-sm" style={{ border: '1px solid var(--hairline)', color: 'var(--muted)' }}>
                No {modelFilter !== 'all' ? modelFilter + '-model ' : ''}clients recorded yet — set limits from the Internal tab on an implementation.
              </div>
            ) : (
              <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {sorted.map(c => (
                  <div key={c.impl.id} className="bg-white rounded-2xl" style={{ border: '1px solid var(--hairline)', padding: '18px' }}>
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[14.5px] font-semibold" style={{ color: 'var(--ink)' }}>{c.impl.client_name}</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
                        {c.model === 'events' ? 'Events' : 'Profiles'}
                      </span>
                    </div>
                    <p className="text-xs mb-3.5" style={{ color: 'var(--muted)' }}>{c.impl.partner_name}</p>
                    <div className="flex flex-col gap-3">
                      {c.meters.map(m => <MeterLine key={m.key} meter={m} />)}
                    </div>
                    <p className="font-mono text-[11px] mt-3.5" style={{ color: 'var(--muted)' }}>Updated {formatDateTime(c.updated)}</p>
                  </div>
                ))}
              </div>
            )}

            {unlinkedCount > 0 && (
              <p className="text-xs mt-4" style={{ color: 'var(--muted)' }}>
                {unlinkedCount} implementation{unlinkedCount === 1 ? '' : 's'} not linked to a Bloomreach org — not shown.
              </p>
            )}
            <p className="text-xs mt-2 italic" style={{ color: 'var(--muted)' }}>
              Usage and limits are entered manually from the order form and the Bloomreach usage dashboard — these billing meters aren't exposed by the API.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
