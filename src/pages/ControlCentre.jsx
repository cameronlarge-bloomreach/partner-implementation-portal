import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllImplementations, addMeetingNote, deleteMeetingNote, updateBloomreachOrgLink, getStepDefinitions } from '../api'
import Navbar from '../components/Navbar'
import RolloutRail from '../components/RolloutRail'
import ProgressRing from '../components/ProgressRing'

const TP_KEYS = [
  'account_creation', 'frontend_data', 'backend_data',
  'integration_sms', 'integration_email', 'integration_whatsapp', 'use_cases'
]

const QA_KEYS = [
  'qa_peer_review_1', 'qa_peer_review_2', 'qa_peer_review_3',
  'qa_peer_review_4', 'qa_peer_review_5', 'qa_peer_review_6'
]

function formatDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d) ? val : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d) ? val : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const SCENARIO_STATUS_STYLES = {
  active: { background: 'var(--moss-bg)', color: 'var(--moss)' },
  draft: { background: 'var(--hairline)', color: 'var(--muted)' },
  inactive: { background: 'var(--hairline)', color: 'var(--muted)' },
}

function pct(stepMap, keys) {
  const required = keys.filter(k => stepMap[k] !== 'not_required')
  if (required.length === 0) return 100
  const done = required.filter(k => stepMap[k] === 'complete').length
  return Math.round((done / required.length) * 100)
}

const EMPTY_NOTE = { title: '', meeting_date: new Date().toISOString().slice(0, 10), content: '' }

export default function ControlCentre({ credential, userInfo, onLogout }) {
  const [stepDefs, setStepDefs] = useState(null)
  useEffect(() => { getStepDefinitions().then(setStepDefs).catch(() => {}) }, [])
  const tpKeys = stepDefs ? stepDefs.touchpoints.map(s_ => s_.key) : TP_KEYS
  const qaKeys = stepDefs ? stepDefs.qaSteps.map(s_ => s_.key) : QA_KEYS
  const [implementations, setImplementations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')

  const [expandedNote, setExpandedNote] = useState(null)
  const [showAddNote, setShowAddNote] = useState(false)
  const [newNote, setNewNote] = useState(EMPTY_NOTE)
  const [addingNote, setAddingNote] = useState(false)
  const [deletingNoteId, setDeletingNoteId] = useState(null)

  const [editingOrgLink, setEditingOrgLink] = useState(false)
  const [orgLinkInput, setOrgLinkInput] = useState({ orgId: '', orgName: '' })
  const [savingOrgLink, setSavingOrgLink] = useState(false)

  useEffect(() => {
    getAllImplementations(credential)
      .then(data => {
        if (data?.error) setError('Failed to load implementations.')
        else {
          const list = data || []
          setImplementations(list)
          if (list.length > 0) setSelectedId(list[0].id)
        }
      })
      .catch(() => setError('Failed to load implementations.'))
      .finally(() => setLoading(false))
  }, [])

  const selected = implementations.find(i => i.id === selectedId) || null

  const filtered = implementations.filter(i => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (i.client_name || '').toLowerCase().includes(q) || (i.partner_name || '').toLowerCase().includes(q)
  })

  async function handleAddNote(e) {
    e.preventDefault()
    if (!selected || !newNote.title.trim()) return
    setAddingNote(true)
    try {
      const res = await addMeetingNote(credential, selected.id, newNote)
      const saved = { ...newNote, id: res.id, source: 'manual' }
      setImplementations(prev => prev.map(impl =>
        impl.id === selected.id
          ? { ...impl, meetingNotes: [saved, ...(impl.meetingNotes || [])] }
          : impl
      ))
      setNewNote(EMPTY_NOTE)
      setShowAddNote(false)
    } catch { /* silent */ }
    setAddingNote(false)
  }

  async function handleDeleteNote(noteId) {
    if (!confirm('Delete this meeting note?')) return
    setDeletingNoteId(noteId)
    try {
      await deleteMeetingNote(credential, noteId)
      setImplementations(prev => prev.map(impl =>
        impl.id === selected.id
          ? { ...impl, meetingNotes: (impl.meetingNotes || []).filter(n => n.id !== noteId) }
          : impl
      ))
    } catch { /* silent */ }
    setDeletingNoteId(null)
  }

  async function handleSaveOrgLink(e) {
    e.preventDefault()
    if (!selected) return
    setSavingOrgLink(true)
    try {
      await updateBloomreachOrgLink(credential, selected.id, orgLinkInput.orgId.trim(), orgLinkInput.orgName.trim())
      setImplementations(prev => prev.map(impl =>
        impl.id === selected.id
          ? { ...impl, bloomreachOrgId: orgLinkInput.orgId.trim(), bloomreachOrgName: orgLinkInput.orgName.trim() }
          : impl
      ))
      setEditingOrgLink(false)
    } catch { /* silent */ }
    setSavingOrgLink(false)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <Navbar userInfo={userInfo} onLogout={onLogout} title="Control Centre — Partner Portal" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <Link to="/admin" className="text-xs font-medium" style={{ color: 'var(--arctic)' }}>← Admin Dashboard</Link>
          <h1 className="font-display text-xl font-semibold mt-2" style={{ color: 'var(--ink)' }}>Implementation Control Centre</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
            Select any implementation to review status and meeting notes. Data here is also queryable by the Loomi MCP.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-sm" style={{ color: 'var(--muted)' }}>Loading…</div>
        ) : error ? (
          <div className="text-center py-20 text-sm" style={{ color: 'var(--rust)' }}>{error}</div>
        ) : implementations.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-sm" style={{ border: '1px solid var(--hairline)', color: 'var(--muted)' }}>
            No implementations yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Left: selectable implementation list */}
            <div className="lg:col-span-4">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search implementations…"
                className="w-full rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none bg-white"
                style={{ border: '1px solid var(--hairline)' }}
              />
              <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid var(--hairline)' }}>
                {filtered.length === 0 ? (
                  <div className="p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>No matches.</div>
                ) : filtered.map(impl => {
                  const tpDone = tpKeys.filter(k => (impl.touchPoints || {})[k] === 'complete').length
                  const progress = pct(impl.touchPoints || {}, tpKeys)
                  const isSelected = impl.id === selectedId
                  return (
                    <button
                      key={impl.id}
                      onClick={() => setSelectedId(impl.id)}
                      className="w-full text-left px-4 py-3 border-b last:border-0 transition-colors"
                      style={{
                        borderColor: 'var(--paper)',
                        background: isSelected ? 'var(--paper)' : '#fff',
                        borderLeft: isSelected ? '3px solid var(--gold)' : '3px solid transparent',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate" style={{ color: 'var(--ink)' }}>{impl.client_name}</span>
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: impl.status === 'complete' ? 'var(--moss-bg)' : 'var(--hairline)', color: impl.status === 'complete' ? 'var(--moss)' : 'var(--muted)' }}>
                          {impl.status === 'complete' ? 'Complete' : 'Active'}
                        </span>
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{impl.partner_name}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <RolloutRail total={tpKeys.length} completed={tpDone} color={progress === 100 ? 'var(--moss)' : 'var(--gold)'} size="sm" />
                        <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>{progress}%</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Right: selected implementation detail */}
            <div className="lg:col-span-8">
              {!selected ? (
                <div className="bg-white rounded-2xl p-12 text-center text-sm" style={{ border: '1px solid var(--hairline)', color: 'var(--muted)' }}>
                  Select an implementation.
                </div>
              ) : (() => {
                const tpPct = pct(selected.touchPoints || {}, tpKeys)
                const qaPct = pct(selected.qaSteps || {}, qaKeys)
                const openRaid = (selected.raid || []).filter(r => r.status === 'Open' || r.status === 'In Progress').length
                const notes = selected.meetingNotes || []

                return (
                  <div className="space-y-6">
                    {/* Summary */}
                    <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid var(--hairline)' }}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--arctic)' }}>{selected.partner_name}</p>
                          <h2 className="font-display text-xl font-semibold mt-1" style={{ color: 'var(--ink)' }}>{selected.client_name}</h2>
                          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                            Planned go-live: {formatDate(selected.planned_go_live_date)}
                          </p>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="flex flex-col items-center gap-1">
                            <div className="relative">
                              <ProgressRing pct={tpPct} size={56} color="var(--gold)" />
                              <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-semibold" style={{ color: 'var(--ink)' }}>{tpPct}%</span>
                            </div>
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>Progress</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="relative">
                              <ProgressRing pct={qaPct} size={56} color="var(--arctic)" />
                              <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-semibold" style={{ color: 'var(--arctic)' }}>{qaPct}%</span>
                            </div>
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>QA</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-14 h-14 rounded-full flex items-center justify-center font-mono text-lg font-semibold"
                              style={{ background: openRaid > 0 ? 'var(--rust-bg)' : 'var(--moss-bg)', color: openRaid > 0 ? 'var(--rust)' : 'var(--moss)' }}>
                              {openRaid}
                            </div>
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>Open RAID</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bloomreach Org link */}
                    <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid var(--hairline)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--ink)' }}>Bloomreach Org</h2>
                        {!editingOrgLink && (
                          <button
                            onClick={() => { setOrgLinkInput({ orgId: selected.bloomreachOrgId || '', orgName: selected.bloomreachOrgName || '' }); setEditingOrgLink(true) }}
                            className="text-xs font-medium" style={{ color: 'var(--arctic)' }}
                          >
                            {selected.bloomreachOrgId ? 'Edit' : 'Link org'}
                          </button>
                        )}
                      </div>

                      {editingOrgLink ? (
                        <form onSubmit={handleSaveOrgLink} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input type="text" value={orgLinkInput.orgName}
                            onChange={e => setOrgLinkInput(v => ({ ...v, orgName: e.target.value }))}
                            placeholder="Org name (e.g. Dormeo)"
                            className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                            style={{ border: '1px solid var(--hairline)' }} />
                          <input type="text" value={orgLinkInput.orgId}
                            onChange={e => setOrgLinkInput(v => ({ ...v, orgId: e.target.value }))}
                            placeholder="Org ID"
                            className="w-full font-mono rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                            style={{ border: '1px solid var(--hairline)' }} />
                          <div className="flex gap-2 sm:col-span-2">
                            <button type="submit" disabled={savingOrgLink}
                              className="text-black text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
                              style={{ background: 'var(--gold)' }}>
                              {savingOrgLink ? 'Saving…' : 'Save'}
                            </button>
                            <button type="button" onClick={() => setEditingOrgLink(false)}
                              className="text-xs px-2 py-1.5" style={{ color: 'var(--muted)' }}>Cancel</button>
                          </div>
                        </form>
                      ) : selected.bloomreachOrgId ? (
                        <div>
                          <div className="text-sm" style={{ color: 'var(--ink)' }}>
                            {selected.bloomreachOrgName}
                            <span className="font-mono text-xs ml-2" style={{ color: 'var(--muted)' }}>{selected.bloomreachOrgId}</span>
                          </div>
                          {(() => {
                            // Lead with the metric this client is billed on.
                            const onEvents = selected.pricingModel === 'events'
                            const primary = onEvents
                              ? { value: selected.eventCount, unit: 'events', at: selected.eventCountSyncedAt, limit: selected.eventLimit }
                              : { value: selected.profileCount, unit: 'profiles', at: selected.profileCountSyncedAt, limit: selected.profileLimit }
                            const secondary = onEvents
                              ? { value: selected.profileCount, unit: 'profiles' }
                              : { value: selected.eventCount, unit: 'events' }
                            const has = v => v !== null && v !== undefined
                            if (!has(primary.value) && !has(secondary.value)) return null
                            const pct = has(primary.value) && primary.limit
                              ? Math.round((Number(primary.value) / Number(primary.limit)) * 100)
                              : null
                            const barColor = pct === null ? 'var(--arctic)'
                              : pct >= 100 ? 'var(--rust)' : pct >= 85 ? 'var(--gold)' : 'var(--moss)'
                            return (
                              <div className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                                {has(primary.value) && (
                                  <>
                                    <span className="font-mono font-semibold" style={{ color: 'var(--arctic)' }}>
                                      {Number(primary.value).toLocaleString()}
                                    </span>
                                    {primary.limit && (
                                      <span> / <span className="font-mono">{Number(primary.limit).toLocaleString()}</span></span>
                                    )} {primary.unit}
                                    {pct !== null && (
                                      <span className="font-mono ml-1" style={{ color: barColor }}>· {pct}%</span>
                                    )}
                                    <span
                                      className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                                      style={{ background: 'var(--paper)', color: 'var(--muted)' }}
                                      title="This client's billing meter"
                                    >billing meter</span>
                                  </>
                                )}
                                {pct !== null && (
                                  <div className="mt-1.5 h-1.5 w-full max-w-xs rounded-full overflow-hidden" style={{ background: 'var(--hairline)' }}>
                                    <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
                                  </div>
                                )}
                                {has(secondary.value) && (
                                  <span className="block mt-1">{Number(secondary.value).toLocaleString()} {secondary.unit}</span>
                                )}
                                {primary.at && <span className="block">synced {formatDateTime(primary.at)}</span>}
                                <div className="mt-1 italic">
                                  Indicative usage from Engagement, not the billed figure —
                                  {onEvents
                                    ? ' events shown are cumulative stored, not monthly processed.'
                                    : ' counts all profiles, not just billable ones.'}
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      ) : (
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>Not linked yet — ask Claude to match this implementation to its Bloomreach org, or link it manually above.</p>
                      )}
                    </div>

                    {/* Use Cases (Bloomreach scenarios) */}
                    <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid var(--hairline)' }}>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--ink)' }}>Use Cases</h2>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                            {(selected.scenarios || []).length} scenario{(selected.scenarios || []).length !== 1 ? 's' : ''}
                            {selected.scenariosSyncedAt && <span> · Last synced {formatDateTime(selected.scenariosSyncedAt)}</span>}
                          </p>
                        </div>
                      </div>

                      {(selected.scenarios || []).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10" style={{ color: 'var(--hairline)' }}>
                          <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <p className="text-sm" style={{ color: 'var(--muted)' }}>
                            {selected.scenariosSyncedAt
                              ? 'Synced, but no scenarios found in the Production project'
                              : 'Not synced yet — ask Claude to sync use cases for this implementation'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selected.scenarios.map(sc => {
                            const style = SCENARIO_STATUS_STYLES[(sc.status || '').toLowerCase()] || { background: 'var(--hairline)', color: 'var(--muted)' }
                            return (
                              <div key={sc.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5" style={{ border: '1px solid var(--hairline)' }}>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{sc.name}</p>
                                  {sc.tags && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{sc.tags}</p>}
                                </div>
                                <span className="text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0" style={style}>{sc.status}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Meeting Notes */}
                    <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid var(--hairline)' }}>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--ink)' }}>Meeting Notes</h2>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
                        </div>
                        <button
                          onClick={() => setShowAddNote(v => !v)}
                          className="text-xs hover:opacity-90 text-black font-medium px-3 py-1.5 rounded-lg transition-opacity"
                          style={{ background: 'var(--gold)' }}
                        >
                          + Add note
                        </button>
                      </div>

                      {showAddNote && (
                        <form onSubmit={handleAddNote} className="mb-4 p-3 rounded-xl space-y-2.5 text-sm" style={{ background: 'var(--paper)', border: '1px solid var(--hairline)' }}>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input type="text" required value={newNote.title}
                              onChange={e => setNewNote(n => ({ ...n, title: e.target.value }))}
                              placeholder="Title *"
                              className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-white"
                              style={{ border: '1px solid var(--hairline)' }} />
                            <input type="date" value={newNote.meeting_date}
                              onChange={e => setNewNote(n => ({ ...n, meeting_date: e.target.value }))}
                              className="w-full font-mono rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-white"
                              style={{ border: '1px solid var(--hairline)' }} />
                          </div>
                          <textarea value={newNote.content}
                            onChange={e => setNewNote(n => ({ ...n, content: e.target.value }))}
                            rows={4} placeholder="Notes…"
                            className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none resize-none bg-white"
                            style={{ border: '1px solid var(--hairline)' }} />
                          <div className="flex gap-2">
                            <button type="submit" disabled={addingNote}
                              className="text-black text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
                              style={{ background: 'var(--gold)' }}>
                              {addingNote ? 'Adding…' : 'Add'}
                            </button>
                            <button type="button" onClick={() => { setShowAddNote(false); setNewNote(EMPTY_NOTE) }}
                              className="text-xs px-2 py-1.5" style={{ color: 'var(--muted)' }}>Cancel</button>
                          </div>
                        </form>
                      )}

                      {notes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10" style={{ color: 'var(--hairline)' }}>
                          <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-sm" style={{ color: 'var(--muted)' }}>No meeting notes yet</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {notes.map(note => {
                            const isExpanded = expandedNote === note.id
                            return (
                              <div key={note.id} className="rounded-xl p-3" style={{ border: '1px solid var(--hairline)' }}>
                                <div className="flex items-start justify-between gap-2">
                                  <button
                                    onClick={() => setExpandedNote(isExpanded ? null : note.id)}
                                    className="text-left flex-1 min-w-0"
                                  >
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{note.title}</span>
                                      {note.source && note.source !== 'manual' && (
                                        <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--moss-bg)', color: 'var(--moss)' }}>{note.source}</span>
                                      )}
                                    </div>
                                    <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--muted)' }}>{formatDate(note.meeting_date)}</div>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteNote(note.id)}
                                    disabled={deletingNoteId === note.id}
                                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 flex-shrink-0"
                                  >
                                    {deletingNoteId === note.id ? 'Deleting…' : 'Delete'}
                                  </button>
                                </div>
                                {isExpanded && note.content && (
                                  <p className="text-xs mt-2 leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--muted)' }}>{note.content}</p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
