import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getImplementation, updateTouchPoint, addRaidItem, updateRaidItem, deleteRaidItem, addAccess, getStepDefinitions } from '../api'
import Navbar from '../components/Navbar'
import RolloutRail from '../components/RolloutRail'
import ScopeOfWork from '../components/ScopeOfWork'
import ImplementationDocuments from '../components/ImplementationDocuments'

const TOUCH_POINTS = [
  { key: 'account_creation', label: 'Account Creation' },
  { key: 'frontend_data', label: 'Front End Data' },
  { key: 'backend_data', label: 'Backend Data' },
  { key: 'integration_sms', label: 'SMS Integration' },
  { key: 'integration_email', label: 'Email Integration' },
  { key: 'integration_whatsapp', label: 'WhatsApp Integration' },
  { key: 'use_cases', label: 'Use Cases' },
]

const QA_STEPS = [
  { key: 'qa_peer_review_1', label: 'ID Validation' },
  { key: 'qa_peer_review_2', label: 'Back End Tracking' },
  { key: 'qa_peer_review_3', label: 'Front End Tracking' },
  { key: 'qa_peer_review_4', label: 'Use Cases Data Check & Debugging' },
  { key: 'qa_peer_review_5', label: 'Data Mapping' },
  { key: 'qa_peer_review_6', label: 'Expiration & Data Cleanliness' },
]

const DATE_FIELDS = [
  { key: 'planned_completion_date', label: 'Planned Completion', note: 'Set at start' },
  { key: 'actual_completion_date', label: 'Actual Completion' },
  { key: 'planned_go_live_date', label: 'Planned Go Live', note: 'Set at start' },
  { key: 'actual_time_to_live', label: 'Actual Go Live' },
]

const RAID_TYPES = ['Risk', 'Action', 'Issue', 'Dependency']
const RAID_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed']

const TYPE_CHIP = {
  Risk:       'bg-red-50 text-red-700 ring-1 ring-red-200',
  Action:     'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  Issue:      'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  Dependency: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
}

const STATUS_CHIP = {
  Open:         'bg-red-100 text-red-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Resolved:     'bg-green-100 text-green-700',
  Closed:       'bg-slate-100 text-slate-500',
}

const TP_STATUS_COLORS = {
  complete:     'bg-emerald-500',
  in_progress:  'bg-blue-500',
  not_started:  'bg-slate-200',
  not_required: 'bg-violet-200',
}

function formatDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d) ? val : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const EMPTY_RAID = { type: 'Risk', title: '', description: '', status: 'Open', owner: '' }

function ProgressRing({ pct, size = 64, stroke = 5, color = 'var(--gold)' }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--hairline)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
    </svg>
  )
}

function StatusSelect({ value, onChange, disabled, saving }) {
  return (
    <div className="flex items-center gap-1.5">
      {saving && <span className="text-xs" style={{ color: 'var(--muted)' }}>Saving…</span>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="text-xs rounded-lg px-2 py-1 focus:outline-none disabled:opacity-40 bg-white cursor-pointer"
        style={{ border: '1px solid var(--hairline)', color: 'var(--ink)' }}
      >
        <option value="not_started">Not Started</option>
        <option value="in_progress">In Progress</option>
        <option value="complete">Complete</option>
        <option value="not_required">Not Required</option>
      </select>
    </div>
  )
}

export default function PartnerDashboard({ credential, userInfo, onLogout }) {
  const [stepDefs, setStepDefs] = useState(null)
  useEffect(() => { getStepDefinitions().then(setStepDefs).catch(() => {}) }, [])
  const tpList = stepDefs?.touchpoints || TOUCH_POINTS
  const qaList = stepDefs?.qaSteps || QA_STEPS
  const { id } = useParams()
  const [impl, setImpl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)
  const [raidItems, setRaidItems] = useState([])
  const [showAddRaid, setShowAddRaid] = useState(false)
  const [newRaid, setNewRaid] = useState(EMPTY_RAID)
  const [addingRaid, setAddingRaid] = useState(false)
  const [editingRaid, setEditingRaid] = useState(null)
  const [editRaidData, setEditRaidData] = useState({})

  // QA notes
  const [expandedQANote, setExpandedQANote] = useState(null)
  const [qaNoteText, setQaNoteText] = useState({})
  const [savingQANote, setSavingQANote] = useState(null)

  // Partner invite
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [accessEmails, setAccessEmails] = useState([])

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    setLoading(true)
    try {
      const data = await getImplementation(credential, id)
      if (data.error) {
        setError('You do not have access to this implementation.')
      } else {
        setImpl(data)
        setRaidItems(data.raid || [])
        setAccessEmails(data.accessEmails || [])
        const notes = {}
        Object.keys(data.qaSteps || {}).forEach(k => {
          if (k.endsWith('_notes')) notes[k.replace('_notes', '')] = data.qaSteps[k]
        })
        setQaNoteText(notes)
      }
    } catch {
      setError('Failed to load your implementation. Please refresh.')
    }
    setLoading(false)
  }

  async function handleTPChange(key, status) {
    setSaving(key)
    try {
      await updateTouchPoint(credential, id, key, status)
      setImpl(p => ({ ...p, touchPoints: { ...p.touchPoints, [key]: status } }))
    } catch { setError('Failed to save.') }
    setSaving(null)
  }

  async function handleQAChange(key, status) {
    setSaving(key)
    try {
      await updateTouchPoint(credential, id, key, status)
      setImpl(p => ({ ...p, qaSteps: { ...p.qaSteps, [key]: status } }))
    } catch { setError('Failed to save.') }
    setSaving(null)
  }

  async function handleSaveQANote(stepKey) {
    const text = qaNoteText[stepKey] || ''
    setSavingQANote(stepKey)
    try {
      await updateTouchPoint(credential, id, stepKey + '_notes', text)
      setImpl(p => ({ ...p, qaSteps: { ...p.qaSteps, [stepKey + '_notes']: text } }))
    } catch { setError('Failed to save note.') }
    setSavingQANote(null)
  }

  async function handleAddRaid(e) {
    e.preventDefault()
    if (!newRaid.title.trim()) return
    setAddingRaid(true)
    try {
      const res = await addRaidItem(credential, id, newRaid)
      setRaidItems(p => [...p, { ...newRaid, id: res.id, raised_date: new Date().toISOString().slice(0, 10) }])
      setNewRaid(EMPTY_RAID)
      setShowAddRaid(false)
    } catch { setError('Failed to add item.') }
    setAddingRaid(false)
  }

  async function handleUpdateRaid(raidId) {
    try {
      await updateRaidItem(credential, raidId, editRaidData)
      setRaidItems(p => p.map(r => r.id === raidId ? { ...r, ...editRaidData } : r))
      setEditingRaid(null)
    } catch { setError('Failed to update.') }
  }

  async function handleDeleteRaid(raidId) {
    if (!confirm('Delete this RAID item?')) return
    try {
      await deleteRaidItem(credential, raidId)
      setRaidItems(p => p.filter(r => r.id !== raidId))
    } catch { setError('Failed to delete.') }
  }

  async function handleInvite(e) {
    e.preventDefault()
    const email = inviteEmail.trim().toLowerCase()
    if (!email || accessEmails.includes(email)) return
    setInviting(true)
    try {
      await addAccess(credential, id, email)
      setAccessEmails(p => [...p, email])
      setInviteEmail('')
    } catch { setError('Failed to invite.') }
    setInviting(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)' }}>
      <div className="text-sm" style={{ color: 'var(--muted)' }}>Loading your implementation…</div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <Navbar userInfo={userInfo} onLogout={onLogout} title="Partner Portal" />
      <div className="max-w-2xl mx-auto mt-20 text-center text-sm" style={{ color: 'var(--rust)' }}>{error}</div>
    </div>
  )

  const tp = impl?.touchPoints || {}
  const qa = impl?.qaSteps || {}

  const tpRequired = tpList.filter(x => (tp[x.key] || 'not_started') !== 'not_required')
  const tpCompleted = tpList.filter(x => tp[x.key] === 'complete').length
  const qaRequired = qaList.filter(x => (qa[x.key] || 'not_started') !== 'not_required')
  const qaCompleted = qaList.filter(x => qa[x.key] === 'complete').length
  const tpPct = tpRequired.length === 0 ? 100 : Math.round(tpCompleted / tpRequired.length * 100)
  const qaPct = qaRequired.length === 0 ? 100 : Math.round(qaCompleted / qaRequired.length * 100)
  const openRaid = raidItems.filter(r => r.status === 'Open' || r.status === 'In Progress').length

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <Navbar userInfo={userInfo} onLogout={onLogout} title="Partner Portal" />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Hero header */}
        <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid var(--hairline)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              {userInfo?.implementations?.length > 1 && (
                <Link to="/select" className="text-xs font-medium" style={{ color: 'var(--arctic)' }}>← My implementations</Link>
              )}
              <p className="text-xs font-medium uppercase tracking-widest mb-1 mt-1" style={{ color: 'var(--arctic)' }}>{impl?.partner_name}</p>
              <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--ink)' }}>{impl?.client_name}</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Implementation Overview</p>
            </div>
            <div className="flex items-center gap-8 sm:gap-10">
              <div className="flex flex-col items-center gap-1">
                <div className="relative">
                  <ProgressRing pct={tpPct} size={64} color="var(--gold)" />
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-semibold" style={{ color: 'var(--ink)' }}>{tpPct}%</span>
                </div>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Progress</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="relative">
                  <ProgressRing pct={qaPct} size={64} color="var(--arctic)" />
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-semibold" style={{ color: 'var(--arctic)' }}>{qaPct}%</span>
                </div>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>QA</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-16 h-16 rounded-full flex items-center justify-center font-mono text-xl font-semibold"
                  style={{ background: openRaid > 0 ? 'var(--rust-bg)' : 'var(--moss-bg)', color: openRaid > 0 ? 'var(--rust)' : 'var(--moss)' }}>
                  {openRaid}
                </div>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Open RAID</span>
              </div>
            </div>
          </div>
        </div>

        {/* Invite team members */}
        <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid var(--hairline)' }}>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--ink)' }}>Team Access</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {accessEmails.length === 0 ? (
              <span className="text-sm" style={{ color: 'var(--muted)' }}>No teammates added yet.</span>
            ) : accessEmails.map(email => (
              <span key={email} className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--hairline)' }}>
                {email}
              </span>
            ))}
          </div>
          <form onSubmit={handleInvite} className="flex gap-2 max-w-sm">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="flex-1 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
              style={{ border: '1px solid var(--hairline)' }}
            />
            <button
              type="submit"
              disabled={inviting}
              className="disabled:opacity-50 text-black text-sm font-medium px-4 py-1.5 rounded-lg transition-opacity hover:opacity-90"
              style={{ background: 'var(--gold)' }}
            >
              {inviting ? 'Inviting…' : 'Invite'}
            </button>
          </form>
        </div>

        {/* Row 1: Key Dates + Implementation Progress */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Key Dates */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6" style={{ border: '1px solid var(--hairline)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--ink)' }}>Key Dates</h2>
            <div className="space-y-3">
              {DATE_FIELDS.map(f => (
                <div key={f.key} className="flex items-start justify-between gap-2">
                  <span className="text-xs leading-tight" style={{ color: 'var(--muted)' }}>
                    {f.label}
                    {f.note && <span className="ml-1" style={{ color: 'var(--arctic)' }}>({f.note})</span>}
                  </span>
                  <span className="font-mono text-xs font-medium whitespace-nowrap" style={{ color: impl?.[f.key] ? 'var(--ink)' : 'var(--hairline)' }}>
                    {formatDate(impl?.[f.key])}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Implementation Progress */}
          <div className="lg:col-span-3 bg-white rounded-2xl p-6" style={{ border: '1px solid var(--hairline)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--ink)' }}>Implementation Progress</h2>
              <span className="font-mono text-xs font-semibold text-black px-2 py-0.5 rounded-full" style={{ background: 'var(--gold)' }}>{tpPct}%</span>
            </div>
            <div className="mb-5">
              <RolloutRail total={tpRequired.length} completed={tpCompleted} color="var(--gold)" />
            </div>
            <div className="space-y-0.5">
              {tpList.map(tp_ => {
                const status = tp[tp_.key] || 'not_started'
                return (
                  <div key={tp_.key} className="flex items-center justify-between py-2.5 border-b last:border-0 group" style={{ borderColor: 'var(--paper)' }}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${TP_STATUS_COLORS[status] || 'bg-slate-200'}`} />
                      <span className="text-sm" style={{ color: 'var(--ink)' }}>{tp_.label}</span>
                    </div>
                    <StatusSelect
                      value={status}
                      onChange={v => handleTPChange(tp_.key, v)}
                      disabled={saving === tp_.key}
                      saving={saving === tp_.key}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Scope of Work (read-only) */}
        {((impl?.scope || []).length > 0 || (impl?.documents || []).length > 0) && (
          <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid var(--hairline)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--ink)' }}>Scope of Work</h2>
            {(impl?.documents || []).length > 0 && (
              <div className="mb-5">
                <ImplementationDocuments
                  credential={credential}
                  implementationId={impl.id}
                  documents={impl.documents}
                  editable={false}
                  onChange={() => {}}
                />
              </div>
            )}
            {(impl?.scope || []).length > 0 && (
              <ScopeOfWork
                credential={credential}
                implementationId={impl.id}
                items={impl.scope}
                editable={false}
                onChange={() => {}}
              />
            )}
          </div>
        )}

        {/* Row 2: QA + RAID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* QA Peer Reviews */}
          <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid var(--hairline)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--ink)' }}>QA Peer Reviews</h2>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: qaPct === 100 ? 'var(--moss-bg)' : 'var(--arctic)', color: qaPct === 100 ? 'var(--moss)' : '#fff' }}>{qaPct}%</span>
            </div>
            <div className="mb-5">
              <RolloutRail total={qaRequired.length} completed={qaCompleted} color={qaPct === 100 ? 'var(--moss)' : 'var(--arctic)'} />
            </div>
            <div className="space-y-0.5">
              {qaList.map((step, i) => {
                const status = qa[step.key] || 'not_started'
                const noteExpanded = expandedQANote === step.key
                const currentNote = qaNoteText[step.key] || ''
                return (
                  <div key={step.key} className="border-b last:border-0" style={{ borderColor: 'var(--paper)' }}>
                    <div className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-xs w-4 flex-shrink-0" style={{ color: 'var(--muted)' }}>{i + 1}</span>
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${TP_STATUS_COLORS[status] || 'bg-slate-200'}`} />
                        <span className="text-sm truncate" style={{ color: 'var(--ink)' }}>{step.label}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <button
                          onClick={() => setExpandedQANote(noteExpanded ? null : step.key)}
                          className="text-xs font-medium"
                          style={{ color: currentNote ? 'var(--arctic)' : 'var(--muted)' }}
                        >
                          {currentNote ? 'Note ✓' : 'Note'}
                        </button>
                        <StatusSelect
                          value={status}
                          onChange={v => handleQAChange(step.key, v)}
                          disabled={saving === step.key}
                          saving={saving === step.key}
                        />
                      </div>
                    </div>
                    {noteExpanded && (
                      <div className="pb-3 pl-7">
                        <textarea
                          value={currentNote}
                          onChange={e => setQaNoteText(n => ({ ...n, [step.key]: e.target.value }))}
                          rows={3}
                          placeholder="Add QA feedback or notes…"
                          className="w-full rounded-lg px-3 py-2 text-xs resize-none focus:outline-none"
                          style={{ border: '1px solid var(--hairline)', background: 'var(--paper)', color: 'var(--ink)' }}
                        />
                        <div className="flex items-center gap-2 mt-1.5">
                          <button
                            onClick={() => handleSaveQANote(step.key)}
                            disabled={savingQANote === step.key}
                            className="text-xs font-medium px-3 py-1 rounded-lg disabled:opacity-50 text-black"
                            style={{ background: 'var(--gold)' }}
                          >
                            {savingQANote === step.key ? 'Saving…' : 'Save note'}
                          </button>
                          <button onClick={() => setExpandedQANote(null)} className="text-xs" style={{ color: 'var(--muted)' }}>
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* RAID Log */}
          <div className="bg-white rounded-2xl p-6 flex flex-col" style={{ border: '1px solid var(--hairline)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--ink)' }}>RAID Log</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Risks · Actions · Issues · Dependencies</p>
              </div>
              <button
                onClick={() => setShowAddRaid(v => !v)}
                className="text-xs hover:opacity-90 text-black font-medium px-3 py-1.5 rounded-lg transition-opacity"
                style={{ background: 'var(--gold)' }}
              >
                + Add
              </button>
            </div>

            {showAddRaid && (
              <form onSubmit={handleAddRaid} className="mb-4 p-3 rounded-xl space-y-2.5 text-sm" style={{ background: 'var(--paper)', border: '1px solid var(--hairline)' }}>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Type</label>
                    <select value={newRaid.type} onChange={e => setNewRaid(r => ({ ...r, type: e.target.value }))}
                      className="w-full rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                      style={{ border: '1px solid var(--hairline)' }}>
                      {RAID_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Status</label>
                    <select value={newRaid.status} onChange={e => setNewRaid(r => ({ ...r, status: e.target.value }))}
                      className="w-full rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                      style={{ border: '1px solid var(--hairline)' }}>
                      {RAID_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <input type="text" required value={newRaid.title} onChange={e => setNewRaid(r => ({ ...r, title: e.target.value }))}
                  placeholder="Title *"
                  className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                  style={{ border: '1px solid var(--hairline)' }} />
                <textarea value={newRaid.description} onChange={e => setNewRaid(r => ({ ...r, description: e.target.value }))}
                  rows={2} placeholder="Description"
                  className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none resize-none"
                  style={{ border: '1px solid var(--hairline)' }} />
                <input type="text" value={newRaid.owner} onChange={e => setNewRaid(r => ({ ...r, owner: e.target.value }))}
                  placeholder="Owner"
                  className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                  style={{ border: '1px solid var(--hairline)' }} />
                <div className="flex gap-2">
                  <button type="submit" disabled={addingRaid}
                    className="text-black text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
                    style={{ background: 'var(--gold)' }}>
                    {addingRaid ? 'Adding…' : 'Add'}
                  </button>
                  <button type="button" onClick={() => { setShowAddRaid(false); setNewRaid(EMPTY_RAID) }}
                    className="text-xs px-2 py-1.5" style={{ color: 'var(--muted)' }}>Cancel</button>
                </div>
              </form>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 max-h-96">
              {raidItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                  <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm">No RAID items yet</p>
                </div>
              ) : raidItems.map(item => (
                <div key={item.id} className="rounded-xl p-3" style={{ border: '1px solid var(--hairline)' }}>
                  {editingRaid === item.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <select value={editRaidData.type} onChange={e => setEditRaidData(d => ({ ...d, type: e.target.value }))}
                          className="rounded-lg px-2 py-1 text-xs bg-white focus:outline-none"
                          style={{ border: '1px solid var(--hairline)' }}>
                          {RAID_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                        <select value={editRaidData.status} onChange={e => setEditRaidData(d => ({ ...d, status: e.target.value }))}
                          className="rounded-lg px-2 py-1 text-xs bg-white focus:outline-none"
                          style={{ border: '1px solid var(--hairline)' }}>
                          {RAID_STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <input type="text" value={editRaidData.title} onChange={e => setEditRaidData(d => ({ ...d, title: e.target.value }))}
                        className="w-full rounded-lg px-2 py-1 text-xs focus:outline-none"
                        style={{ border: '1px solid var(--hairline)' }} />
                      <textarea value={editRaidData.description} onChange={e => setEditRaidData(d => ({ ...d, description: e.target.value }))}
                        rows={2} className="w-full rounded-lg px-2 py-1 text-xs focus:outline-none resize-none"
                        style={{ border: '1px solid var(--hairline)' }} />
                      <input type="text" value={editRaidData.owner} onChange={e => setEditRaidData(d => ({ ...d, owner: e.target.value }))}
                        placeholder="Owner" className="w-full rounded-lg px-2 py-1 text-xs focus:outline-none"
                        style={{ border: '1px solid var(--hairline)' }} />
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdateRaid(item.id)}
                          className="text-black text-xs font-medium px-3 py-1 rounded-lg"
                          style={{ background: 'var(--gold)' }}>Save</button>
                        <button onClick={() => setEditingRaid(null)}
                          className="text-xs px-2 py-1" style={{ color: 'var(--muted)' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${TYPE_CHIP[item.type] || 'bg-slate-50 text-slate-600 ring-1 ring-slate-200'}`}>
                            {item.type}
                          </span>
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${STATUS_CHIP[item.status] || 'bg-slate-100 text-slate-600'}`}>
                            {item.status}
                          </span>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => { setEditingRaid(item.id); setEditRaidData({ type: item.type, title: item.title, description: item.description, status: item.status, owner: item.owner }) }}
                            className="text-xs font-medium" style={{ color: 'var(--arctic)' }}>Edit</button>
                          <button onClick={() => handleDeleteRaid(item.id)}
                            className="text-xs text-red-400 hover:text-red-600">Delete</button>
                        </div>
                      </div>
                      <p className="text-sm font-medium mt-1" style={{ color: 'var(--ink)' }}>{item.title}</p>
                      {item.description && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--muted)' }}>{item.description}</p>}
                      <div className="flex items-center gap-3 mt-1.5 text-xs font-mono" style={{ color: 'var(--muted)' }}>
                        {item.owner && <span>Owner: {item.owner}</span>}
                        {item.raised_date && <span>{formatDate(item.raised_date)}</span>}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
