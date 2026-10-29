import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getQATickets } from '../api'
import Navbar from '../components/Navbar'

function formatDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ClickUp's 'done' and 'closed' status types both mean the work is finished.
const isClosed = t => ['done', 'closed'].includes(t.live?.statusType)

function Tile({ value, label, warn, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="bg-white rounded-2xl relative overflow-hidden text-left cursor-pointer transition-shadow hover:shadow-md"
      style={{ border: active ? '1px solid var(--ink)' : '1px solid var(--hairline)', boxShadow: active ? '0 0 0 1px var(--ink)' : undefined, padding: '16px 18px' }}
    >
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: warn ? 'var(--rust)' : 'var(--gold)' }} />
      <p className="font-mono text-[28px] font-semibold leading-none" style={{ color: warn ? 'var(--rust)' : 'var(--ink)' }}>{value}</p>
      <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>{label}</p>
    </button>
  )
}

function StatusPill({ live }) {
  if (!live) return <span className="text-xs" style={{ color: 'var(--muted)' }}>Unavailable</span>
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--hairline)' }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: live.statusColor || 'var(--muted)' }} />
      {live.status}
    </span>
  )
}

const PRIORITY_COLOR = { HIGH: 'var(--rust)', MEDIUM: '#c99a00', LOW: 'var(--moss)' }

function Assignees({ people }) {
  if (!people?.length) return <span className="text-xs" style={{ color: 'var(--muted)' }}>Unassigned</span>
  return (
    <div className="flex items-center -space-x-1.5">
      {people.map(p => <Avatar key={p.name} person={p} />)}
    </div>
  )
}

function Avatar({ person, size = 24 }) {
  const cls = 'rounded-full ring-2 ring-white flex-shrink-0'
  const dims = { width: size, height: size }
  return person.picture
    ? <img src={person.picture} alt={person.name} title={person.name} className={`${cls} object-cover`} style={dims} />
    : <span title={person.name} className={`${cls} flex items-center justify-center text-[10px] font-semibold text-white`}
        style={{ ...dims, background: person.color || 'var(--arctic)' }}>{person.initials || person.name.slice(0, 2).toUpperCase()}</span>
}

// Latest comment, clamped, with a toggle for the whole thread underneath.
function LatestComment({ comments, expanded, onToggle }) {
  if (comments === null || comments === undefined) return <span style={{ color: 'var(--muted)' }}>—</span>
  if (!comments.length) return <span className="text-xs" style={{ color: 'var(--muted)' }}>No comments</span>
  const latest = comments[0]
  return (
    <div className="max-w-[280px]">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Avatar person={latest.author} size={20} />
        <span className="text-[11.5px] font-medium truncate" style={{ color: 'var(--ink)' }}>{latest.author.name}</span>
        <span className="font-mono text-[11px] whitespace-nowrap" style={{ color: 'var(--muted)' }}>{formatDate(latest.date)}</span>
      </div>
      <p className="text-[12px] line-clamp-2" style={{ color: 'var(--ink)' }}>{latest.text || '(attachment)'}</p>
      <button onClick={onToggle} className="text-[11.5px] font-semibold mt-1" style={{ color: 'var(--arctic)' }}>
        {expanded ? 'Hide thread' : `${comments.length === 25 ? '25+' : comments.length} comment${comments.length === 1 ? '' : 's'} →`}
      </button>
    </div>
  )
}

// Full thread, oldest first so it reads top-to-bottom like ClickUp.
function Thread({ comments, url }) {
  return (
    <div className="px-4 sm:px-6 py-4" style={{ background: 'var(--paper)' }}>
      <div className="flex flex-col gap-3 max-w-3xl">
        {[...comments].reverse().map(c => (
          <div key={c.id} className="flex gap-2.5">
            <Avatar person={c.author} />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>{c.author.name}</span>
                <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>{formatDate(c.date)}</span>
              </div>
              <p className="text-[13px] whitespace-pre-wrap break-words" style={{ color: 'var(--ink)' }}>{c.text || '(attachment)'}</p>
            </div>
          </div>
        ))}
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block text-[12px] font-semibold mt-3" style={{ color: 'var(--arctic)' }}>
        {comments.length === 25 ? 'Older comments and replies in ClickUp ↗' : 'Reply in ClickUp ↗'}
      </a>
    </div>
  )
}

const STAT_FILTERS = {
  all: () => true,
  open: t => t.live && !isClosed(t),
  closed: isClosed,
  high: t => t.live && !isClosed(t) && t.live.priority === 'HIGH',
}

export default function QATickets({ userInfo, onLogout }) {
  const [tickets, setTickets] = useState([])
  const [liveError, setLiveError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statFilter, setStatFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [openThread, setOpenThread] = useState(null) // ticket id

  useEffect(() => {
    getQATickets()
      .then(res => {
        if (res?.error) setError('Failed to load QA tickets.')
        else { setTickets(res.tickets || []); setLiveError(res.liveError || null) }
      })
      .catch(() => setError('Failed to load QA tickets.'))
      .finally(() => setLoading(false))
  }, [])

  const q = query.trim().toLowerCase()
  const shown = tickets
    .filter(STAT_FILTERS[statFilter])
    .filter(t => !q || [t.name, t.clientName, t.partnerName, t.stepLabel, t.live?.status].some(v => v?.toLowerCase().includes(q)))
    // Open tickets first, then newest raised.
    .sort((a, b) => (isClosed(a) - isClosed(b)) || (b.raisedAt || '').localeCompare(a.raisedAt || ''))

  const openCount = tickets.filter(STAT_FILTERS.open).length
  const highCount = tickets.filter(STAT_FILTERS.high).length

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <Navbar userInfo={userInfo} onLogout={onLogout} title="QA Tickets — Partner Portal" />

      <div className="max-w-7xl mx-auto px-4 sm:px-7 py-7">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-[22px] font-semibold" style={{ color: 'var(--ink)' }}>QA Tickets</h1>
            <p className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>
              ClickUp tickets raised to SDC from QA workbooks — live status and comments from ClickUp.
            </p>
          </div>
          <Link to="/admin" className="text-sm font-medium px-4 py-2 rounded-[10px]" style={{ border: '1px solid var(--hairline)', color: 'var(--ink)' }}>
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
              {[
                ['all', tickets.length, 'Tickets raised', false],
                ['open', openCount, 'Open', false],
                ['closed', tickets.filter(STAT_FILTERS.closed).length, 'Closed', false],
                ['high', highCount, 'Open · High priority', highCount > 0],
              ].map(([key, value, label, warn]) => (
                <Tile key={key} value={value} label={label} warn={warn}
                  active={statFilter === key && key !== 'all'}
                  onClick={() => setStatFilter(statFilter === key ? 'all' : key)} />
              ))}
            </div>

            {liveError && (
              <p className="text-xs mb-3" style={{ color: 'var(--rust)' }}>
                Couldn't reach ClickUp ({liveError}) — showing tickets without live status.
              </p>
            )}

            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search ticket, client, partner, step or status"
              className="w-full max-w-sm rounded-[10px] px-3 py-2 text-sm bg-white focus:outline-none mb-4" style={{ border: '1px solid var(--hairline)' }} />

            {shown.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center text-sm" style={{ border: '1px solid var(--hairline)', color: 'var(--muted)' }}>
                {tickets.length ? 'No tickets match this filter.' : 'No tickets raised yet — use "Raise ticket" on a QA workbook.'}
              </div>
            ) : (
              <div className="bg-white rounded-2xl overflow-x-auto" style={{ border: '1px solid var(--hairline)' }}>
                <table className="w-full text-sm min-w-[1100px]">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--hairline)' }}>
                      <th className="px-4 py-3">Ticket</th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">QA step</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Assignees</th>
                      <th className="px-4 py-3">Latest comment</th>
                      <th className="px-4 py-3">Raised</th>
                      <th className="px-4 py-3">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map(t => (<Fragment key={t.id}>
                      <tr style={{ borderTop: '1px solid var(--hairline)', opacity: isClosed(t) ? 0.6 : 1 }}>
                        <td className="px-4 py-3">
                          <a href={t.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline" style={{ color: 'var(--ink)' }}>
                            {t.name} <span style={{ color: 'var(--arctic)' }}>↗</span>
                          </a>
                          {t.live?.jobType && <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--muted)' }}>{t.live.jobType}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/admin/implementation/${t.implementationId}`} className="hover:underline" style={{ color: 'var(--ink)' }}>{t.clientName}</Link>
                          <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{t.partnerName}</div>
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--ink)' }}>{t.stepLabel}</td>
                        <td className="px-4 py-3"><StatusPill live={t.live} /></td>
                        <td className="px-4 py-3">
                          {t.live?.priority
                            ? <span className="text-[11.5px] font-semibold" style={{ color: PRIORITY_COLOR[t.live.priority] || 'var(--ink)' }}>{t.live.priority}</span>
                            : <span style={{ color: 'var(--muted)' }}>—</span>}
                        </td>
                        <td className="px-4 py-3"><Assignees people={t.live?.assignees} /></td>
                        <td className="px-4 py-3 align-top">
                          <LatestComment comments={t.live?.comments} expanded={openThread === t.id}
                            onToggle={() => setOpenThread(openThread === t.id ? null : t.id)} />
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] whitespace-nowrap" style={{ color: 'var(--muted)' }}>{formatDate(t.raisedAt)}</td>
                        <td className="px-4 py-3 font-mono text-[12px] whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                          {isClosed(t) && t.live.dateClosed ? `Closed ${formatDate(t.live.dateClosed)}` : formatDate(t.live?.dateUpdated)}
                        </td>
                      </tr>
                      {openThread === t.id && t.live?.comments?.length > 0 && (
                        <tr><td colSpan={9} className="p-0"><Thread comments={t.live.comments} url={t.url} /></td></tr>
                      )}
                    </Fragment>))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs mt-3 italic" style={{ color: 'var(--muted)' }}>
              Only tickets raised from BLIMP are listed — anything submitted straight through the ClickUp Work Intake Form won't appear here.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
