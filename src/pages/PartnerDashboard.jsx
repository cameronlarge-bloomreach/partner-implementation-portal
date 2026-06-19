import { useEffect, useState } from 'react'
import { getMyImplementation, updateTouchPoint, addRaidItem, updateRaidItem, deleteRaidItem } from '../api'
import Navbar from '../components/Navbar'
import StatusBadge from '../components/StatusBadge'

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
  { key: 'qa_peer_review_1', label: 'QA Peer Review 1: ID Validation' },
  { key: 'qa_peer_review_2', label: 'QA Peer Review 2: Back End Tracking' },
  { key: 'qa_peer_review_3', label: 'QA Peer Review 3: Front End Tracking' },
  { key: 'qa_peer_review_4', label: 'QA Peer Review 4: Use Cases Data Check and Debugging' },
  { key: 'qa_peer_review_5', label: 'QA Peer Review 5: Data Mapping' },
  { key: 'qa_peer_review_6', label: 'QA Peer Review 6: Expiration & Data Cleanliness' },
]

const DATE_FIELDS = [
  { key: 'contract_sign_date', label: 'Contract Sign Date' },
  { key: 'planned_completion_date', label: 'Planned Completion Date', note: 'Set at start' },
  { key: 'target_completion_date', label: 'Target Completion Date', note: 'Updated monthly' },
  { key: 'actual_completion_date', label: 'Actual Completion Date' },
  { key: 'planned_go_live_date', label: 'Planned Go Live Date', note: 'Set at start' },
  { key: 'target_time_to_live', label: 'Target Time to Live', note: 'Updated monthly' },
  { key: 'actual_time_to_live', label: 'Actual Time to Live' },
]

const RAID_TYPES = ['Risk', 'Action', 'Issue', 'Dependency']
const RAID_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed']

const RAID_TYPE_STYLES = {
  Risk: 'bg-red-50 text-red-700 border-red-200',
  Action: 'bg-blue-50 text-blue-700 border-blue-200',
  Issue: 'bg-amber-50 text-amber-700 border-amber-200',
  Dependency: 'bg-purple-50 text-purple-700 border-purple-200',
}

const RAID_STATUS_STYLES = {
  Open: 'bg-red-100 text-red-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Resolved: 'bg-green-100 text-green-700',
  Closed: 'bg-slate-100 text-slate-500',
}

function formatDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d) ? val : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const EMPTY_RAID = { type: 'Risk', title: '', description: '', status: 'Open', owner: '' }

export default function PartnerDashboard({ credential, userInfo, onLogout }) {
  const [implementation, setImplementation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)

  const [raidItems, setRaidItems] = useState([])
  const [showAddRaid, setShowAddRaid] = useState(false)
  const [newRaid, setNewRaid] = useState(EMPTY_RAID)
  const [addingRaid, setAddingRaid] = useState(false)
  const [editingRaid, setEditingRaid] = useState(null)
  const [editRaidData, setEditRaidData] = useState({})

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    try {
      const data = await getMyImplementation(credential)
      setImplementation(data)
      setRaidItems(data.raid || [])
    } catch {
      setError('Failed to load your implementation. Please refresh.')
    }
    setLoading(false)
  }

  async function handleStatusChange(key, status) {
    setSaving(key)
    try {
      await updateTouchPoint(credential, userInfo.email, key, status)
      setImplementation(prev => ({ ...prev, touchPoints: { ...prev.touchPoints, [key]: status } }))
    } catch {
      setError('Failed to save. Please try again.')
    }
    setSaving(null)
  }

  async function handleQAChange(key, status) {
    setSaving(key)
    try {
      await updateTouchPoint(credential, userInfo.email, key, status)
      setImplementation(prev => ({ ...prev, qaSteps: { ...prev.qaSteps, [key]: status } }))
    } catch {
      setError('Failed to save. Please try again.')
    }
    setSaving(null)
  }

  async function handleAddRaid(e) {
    e.preventDefault()
    if (!newRaid.title.trim()) return
    setAddingRaid(true)
    try {
      const res = await addRaidItem(credential, userInfo.email, newRaid)
      setRaidItems(prev => [...prev, { ...newRaid, id: res.id, raised_date: new Date().toISOString().slice(0, 10) }])
      setNewRaid(EMPTY_RAID)
      setShowAddRaid(false)
    } catch {
      setError('Failed to add item.')
    }
    setAddingRaid(false)
  }

  async function handleUpdateRaid(id) {
    try {
      await updateRaidItem(credential, id, editRaidData)
      setRaidItems(prev => prev.map(r => r.id === id ? { ...r, ...editRaidData } : r))
      setEditingRaid(null)
    } catch {
      setError('Failed to update item.')
    }
  }

  async function handleDeleteRaid(id) {
    if (!confirm('Delete this RAID item?')) return
    try {
      await deleteRaidItem(credential, id)
      setRaidItems(prev => prev.filter(r => r.id !== id))
    } catch {
      setError('Failed to delete item.')
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-slate-500">Loading your implementation...</div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-slate-50">
      <Navbar userInfo={userInfo} onLogout={onLogout} />
      <div className="max-w-2xl mx-auto mt-20 text-center text-red-600">{error}</div>
    </div>
  )

  const touchPoints = implementation?.touchPoints || {}
  const qaSteps = implementation?.qaSteps || {}

  const overallProgress = Math.round(
    (TOUCH_POINTS.filter(tp => touchPoints[tp.key] === 'complete').length / TOUCH_POINTS.length) * 100
  )

  const qaProgress = Math.round(
    (QA_STEPS.filter(s => qaSteps[s.key] === 'complete').length / QA_STEPS.length) * 100
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar userInfo={userInfo} onLogout={onLogout} title="Partner Portal" />

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{implementation?.client_name}</h1>
              <p className="text-slate-500 text-sm mt-1">{implementation?.partner_name} — Implementation Overview</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-violet-600">{overallProgress}%</div>
              <div className="text-xs text-slate-500">Complete</div>
            </div>
          </div>
          <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${overallProgress}%` }} />
          </div>
        </div>

        {/* Key Dates */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Key Dates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {DATE_FIELDS.map(field => (
              <div key={field.key}>
                <span className="text-xs text-slate-500">
                  {field.label}
                  {field.note && <span className="text-violet-400 ml-1">({field.note})</span>}
                </span>
                <div className="text-sm font-medium text-slate-900 mt-0.5">
                  {formatDate(implementation?.[field.key])}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Touch Points */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Implementation Progress</h2>
          <div className="space-y-1">
            {TOUCH_POINTS.map(tp => {
              const status = touchPoints[tp.key] || 'not_started'
              const isSaving = saving === tp.key
              return (
                <div key={tp.key} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      status === 'complete' ? 'bg-green-500' : status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-300'
                    }`} />
                    <span className="text-sm font-medium text-slate-800">{tp.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSaving && <span className="text-xs text-slate-400">Saving...</span>}
                    <select
                      value={status}
                      onChange={e => handleStatusChange(tp.key, e.target.value)}
                      disabled={isSaving}
                      className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 bg-white"
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="complete">Complete</option>
                    </select>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* QA Peer Reviews */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">QA Peer Reviews</h2>
              <p className="text-xs text-slate-500 mt-0.5">{qaProgress}% complete</p>
            </div>
            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${qaProgress === 100 ? 'bg-green-500' : 'bg-violet-400'}`}
                style={{ width: `${qaProgress}%` }}
              />
            </div>
          </div>
          <div className="space-y-1">
            {QA_STEPS.map(step => {
              const status = qaSteps[step.key] || 'not_started'
              const isSaving = saving === step.key
              return (
                <div key={step.key} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      status === 'complete' ? 'bg-green-500' : status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-300'
                    }`} />
                    <span className="text-sm font-medium text-slate-800">{step.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSaving && <span className="text-xs text-slate-400">Saving...</span>}
                    <select
                      value={status}
                      onChange={e => handleQAChange(step.key, e.target.value)}
                      disabled={isSaving}
                      className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 bg-white"
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="complete">Complete</option>
                    </select>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RAID Log */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">RAID Log</h2>
              <p className="text-xs text-slate-500 mt-0.5">Risks · Actions · Issues · Dependencies</p>
            </div>
            <button
              onClick={() => setShowAddRaid(v => !v)}
              className="text-sm bg-violet-600 hover:bg-violet-700 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              + Add item
            </button>
          </div>

          {showAddRaid && (
            <form onSubmit={handleAddRaid} className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                  <select value={newRaid.type} onChange={e => setNewRaid(r => ({ ...r, type: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
                    {RAID_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                  <select value={newRaid.status} onChange={e => setNewRaid(r => ({ ...r, status: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
                    {RAID_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
                <input type="text" required value={newRaid.title} onChange={e => setNewRaid(r => ({ ...r, title: e.target.value }))}
                  placeholder="Brief summary"
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea value={newRaid.description} onChange={e => setNewRaid(r => ({ ...r, description: e.target.value }))}
                  rows={2} placeholder="Details, impact, mitigation..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Owner</label>
                <input type="text" value={newRaid.owner} onChange={e => setNewRaid(r => ({ ...r, owner: e.target.value }))}
                  placeholder="Name or team"
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={addingRaid}
                  className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
                  {addingRaid ? 'Adding...' : 'Add'}
                </button>
                <button type="button" onClick={() => { setShowAddRaid(false); setNewRaid(EMPTY_RAID) }}
                  className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {raidItems.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No RAID items logged yet.</p>
          ) : (
            <div className="space-y-2">
              {raidItems.map(item => (
                <div key={item.id} className="border border-slate-100 rounded-xl p-4">
                  {editingRaid === item.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                          <select value={editRaidData.type} onChange={e => setEditRaidData(d => ({ ...d, type: e.target.value }))}
                            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
                            {RAID_TYPES.map(t => <option key={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                          <select value={editRaidData.status} onChange={e => setEditRaidData(d => ({ ...d, status: e.target.value }))}
                            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
                            {RAID_STATUSES.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                      <input type="text" value={editRaidData.title} onChange={e => setEditRaidData(d => ({ ...d, title: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                      <textarea value={editRaidData.description} onChange={e => setEditRaidData(d => ({ ...d, description: e.target.value }))}
                        rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
                      <input type="text" value={editRaidData.owner} onChange={e => setEditRaidData(d => ({ ...d, owner: e.target.value }))}
                        placeholder="Owner" className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdateRaid(item.id)}
                          className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg">Save</button>
                        <button onClick={() => setEditingRaid(null)}
                          className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded border ${RAID_TYPE_STYLES[item.type] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            {item.type}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${RAID_STATUS_STYLES[item.status] || 'bg-slate-100 text-slate-600'}`}>
                            {item.status}
                          </span>
                          <span className="text-sm font-medium text-slate-900">{item.title}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => { setEditingRaid(item.id); setEditRaidData({ type: item.type, title: item.title, description: item.description, status: item.status, owner: item.owner }) }}
                            className="text-xs text-violet-600 hover:text-violet-800">Edit</button>
                          <button onClick={() => handleDeleteRaid(item.id)}
                            className="text-xs text-red-500 hover:text-red-700">Delete</button>
                        </div>
                      </div>
                      {item.description && <p className="text-sm text-slate-600 mt-2">{item.description}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                        {item.owner && <span>Owner: {item.owner}</span>}
                        {item.raised_date && <span>Raised: {formatDate(item.raised_date)}</span>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
