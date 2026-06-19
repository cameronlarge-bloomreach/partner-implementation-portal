import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getImplementation, updateTouchPoint, addRaidItem, updateRaidItem, deleteRaidItem } from '../api'
import Navbar from '../components/Navbar'

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
  { key: 'contract_sign_date', label: 'Contract Signed' },
  { key: 'planned_completion_date', label: 'Planned Completion', note: 'Set at start' },
  { key: 'target_completion_date', label: 'Target Completion', note: 'Updated monthly' },
  { key: 'actual_completion_date', label: 'Actual Completion' },
  { key: 'planned_go_live_date', label: 'Planned Go Live', note: 'Set at start' },
  { key: 'target_time_to_live', label: 'Target Go Live', note: 'Updated monthly' },
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
  Open:        'bg-red-100 text-red-700',
  'In Progress':'bg-blue-100 text-blue-700',
  Resolved:    'bg-green-100 text-green-700',
  Closed:      'bg-slate-100 text-slate-500',
}

const TP_STATUS_COLORS = {
  complete:    'bg-emerald-500',
  in_progress: 'bg-blue-500',
  not_started: 'bg-slate-200',
}

function formatDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d) ? val : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const EMPTY_RAID = { type: 'Risk', title: '', description: '', status: 'Open', owner: '' }

function ProgressRing({ pct, size = 64, stroke = 5, color = '#FFD500' }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
    </svg>
  )
}

function StatusSelect({ value, onChange, disabled, saving }) {
  return (
    <div className="flex items-center gap-1.5">
      {saving && <span className="text-xs text-slate-400">Saving…</span>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#FFD500] disabled:opacity-40 bg-white text-slate-700 cursor-pointer"
      >
        <option value="not_started">Not Started</option>
        <option value="in_progress">In Progress</option>
        <option value="complete">Complete</option>
      </select>
    </div>
  )
}

export default function PartnerDashboard({ credential, userInfo, onLogout }) {
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

  async function handleUpdateRaid(id) {
    try {
      await updateRaidItem(credential, id, editRaidData)
      setRaidItems(p => p.map(r => r.id === id ? { ...r, ...editRaidData } : r))
      setEditingRaid(null)
    } catch { setError('Failed to update.') }
  }

  async function handleDeleteRaid(id) {
    if (!confirm('Delete this RAID item?')) return
    try {
      await deleteRaidItem(credential, id)
      setRaidItems(p => p.filter(r => r.id !== id))
    } catch { setError('Failed to delete.') }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-slate-400 text-sm">Loading your implementation…</div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-slate-50">
      <Navbar userInfo={userInfo} onLogout={onLogout} title="Partner Portal" />
      <div className="max-w-2xl mx-auto mt-20 text-center text-red-500 text-sm">{error}</div>
    </div>
  )

  const tp = impl?.touchPoints || {}
  const qa = impl?.qaSteps || {}

  const tpPct = Math.round(TOUCH_POINTS.filter(x => tp[x.key] === 'complete').length / TOUCH_POINTS.length * 100)
  const qaPct = Math.round(QA_STEPS.filter(x => qa[x.key] === 'complete').length / QA_STEPS.length * 100)
  const openRaid = raidItems.filter(r => r.status === 'Open' || r.status === 'In Progress').length

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar userInfo={userInfo} onLogout={onLogout} title="Partner Portal" />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* ── Hero header ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              {userInfo?.implementations?.length > 1 && (
                <Link to="/select" className="text-xs text-[#019ACE] hover:text-[#017aaa] font-medium">← My implementations</Link>
              )}
              <p className="text-xs font-medium text-[#019ACE] uppercase tracking-widest mb-1 mt-1">{impl?.partner_name}</p>
              <h1 className="text-2xl font-bold text-slate-900">{impl?.client_name}</h1>
              <p className="text-sm text-slate-400 mt-1">Implementation Overview</p>
            </div>
            {/* Summary rings */}
            <div className="flex items-center gap-8 sm:gap-10">
              <div className="flex flex-col items-center gap-1">
                <div className="relative">
                  <ProgressRing pct={tpPct} size={64} color="#FFD500" />
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-800">{tpPct}%</span>
                </div>
                <span className="text-xs text-slate-500">Progress</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="relative">
                  <ProgressRing pct={qaPct} size={64} color="#019ACE" />
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[#019ACE]">{qaPct}%</span>
                </div>
                <span className="text-xs text-slate-500">QA</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold ${
                  openRaid > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                }`}>{openRaid}</div>
                <span className="text-xs text-slate-500">Open RAID</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 1: Key Dates + Implementation Progress ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Key Dates — 2 cols */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">Key Dates</h2>
            <div className="space-y-3">
              {DATE_FIELDS.map(f => (
                <div key={f.key} className="flex items-start justify-between gap-2">
                  <span className="text-xs text-slate-500 leading-tight">
                    {f.label}
                    {f.note && <span className="text-[#019ACE] ml-1">({f.note})</span>}
                  </span>
                  <span className={`text-xs font-medium whitespace-nowrap ${impl?.[f.key] ? 'text-slate-800' : 'text-slate-300'}`}>
                    {formatDate(impl?.[f.key])}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Implementation Touch Points — 3 cols */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Implementation Progress</h2>
              <span className="text-xs font-medium text-black bg-[#FFD500] px-2 py-0.5 rounded-full">{tpPct}%</span>
            </div>
            {/* Mini progress bar */}
            <div className="h-1 bg-slate-100 rounded-full mb-5 overflow-hidden">
              <div className="h-full bg-[#FFD500] rounded-full transition-all" style={{ width: `${tpPct}%` }} />
            </div>
            <div className="space-y-0.5">
              {TOUCH_POINTS.map(tp_ => {
                const status = tp[tp_.key] || 'not_started'
                return (
                  <div key={tp_.key} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0 group">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${TP_STATUS_COLORS[status]}`} />
                      <span className="text-sm text-slate-700">{tp_.label}</span>
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

        {/* ── Row 2: QA + RAID ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* QA Peer Reviews */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">QA Peer Reviews</h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${qaPct === 100 ? 'bg-emerald-50 text-emerald-600' : 'text-white bg-[#019ACE]'}`}>{qaPct}%</span>
            </div>
            <div className="h-1 bg-slate-100 rounded-full mb-5 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${qaPct === 100 ? 'bg-emerald-500' : 'bg-[#019ACE]'}`} style={{ width: `${qaPct}%` }} />
            </div>
            <div className="space-y-0.5">
              {QA_STEPS.map((step, i) => {
                const status = qa[step.key] || 'not_started'
                return (
                  <div key={step.key} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-400 w-4">{i + 1}</span>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${TP_STATUS_COLORS[status]}`} />
                      <span className="text-sm text-slate-700">{step.label}</span>
                    </div>
                    <StatusSelect
                      value={status}
                      onChange={v => handleQAChange(step.key, v)}
                      disabled={saving === step.key}
                      saving={saving === step.key}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* RAID Log */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">RAID Log</h2>
                <p className="text-xs text-slate-400 mt-0.5">Risks · Actions · Issues · Dependencies</p>
              </div>
              <button
                onClick={() => setShowAddRaid(v => !v)}
                className="text-xs bg-[#FFD500] hover:bg-[#e6bf00] text-black font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                + Add
              </button>
            </div>

            {showAddRaid && (
              <form onSubmit={handleAddRaid} className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Type</label>
                    <select value={newRaid.type} onChange={e => setNewRaid(r => ({ ...r, type: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD500]">
                      {RAID_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Status</label>
                    <select value={newRaid.status} onChange={e => setNewRaid(r => ({ ...r, status: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD500]">
                      {RAID_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <input type="text" required value={newRaid.title} onChange={e => setNewRaid(r => ({ ...r, title: e.target.value }))}
                  placeholder="Title *"
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#FFD500]" />
                <textarea value={newRaid.description} onChange={e => setNewRaid(r => ({ ...r, description: e.target.value }))}
                  rows={2} placeholder="Description"
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#FFD500] resize-none" />
                <input type="text" value={newRaid.owner} onChange={e => setNewRaid(r => ({ ...r, owner: e.target.value }))}
                  placeholder="Owner"
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#FFD500]" />
                <div className="flex gap-2">
                  <button type="submit" disabled={addingRaid}
                    className="bg-[#FFD500] hover:bg-[#e6bf00] disabled:opacity-50 text-black text-xs font-medium px-3 py-1.5 rounded-lg">
                    {addingRaid ? 'Adding…' : 'Add'}
                  </button>
                  <button type="button" onClick={() => { setShowAddRaid(false); setNewRaid(EMPTY_RAID) }}
                    className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5">Cancel</button>
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
                <div key={item.id} className="border border-slate-100 rounded-xl p-3">
                  {editingRaid === item.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <select value={editRaidData.type} onChange={e => setEditRaidData(d => ({ ...d, type: e.target.value }))}
                          className="border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD500]">
                          {RAID_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                        <select value={editRaidData.status} onChange={e => setEditRaidData(d => ({ ...d, status: e.target.value }))}
                          className="border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD500]">
                          {RAID_STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <input type="text" value={editRaidData.title} onChange={e => setEditRaidData(d => ({ ...d, title: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#FFD500]" />
                      <textarea value={editRaidData.description} onChange={e => setEditRaidData(d => ({ ...d, description: e.target.value }))}
                        rows={2} className="w-full border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#FFD500] resize-none" />
                      <input type="text" value={editRaidData.owner} onChange={e => setEditRaidData(d => ({ ...d, owner: e.target.value }))}
                        placeholder="Owner" className="w-full border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#FFD500]" />
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdateRaid(item.id)}
                          className="bg-[#FFD500] text-black text-xs font-medium px-3 py-1 rounded-lg">Save</button>
                        <button onClick={() => setEditingRaid(null)}
                          className="text-xs text-slate-500 px-2 py-1">Cancel</button>
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
                            className="text-xs text-[#019ACE] hover:text-[#017aaa]">Edit</button>
                          <button onClick={() => handleDeleteRaid(item.id)}
                            className="text-xs text-red-400 hover:text-red-600">Delete</button>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-slate-800 mt-1">{item.title}</p>
                      {item.description && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
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
