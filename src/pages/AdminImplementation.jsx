import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getAllImplementations, updateDates, updateTouchPoint, addAccess, removeAccess } from '../api'
import Navbar from '../components/Navbar'

const DATE_FIELDS = [
  { key: 'contract_sign_date', label: 'Contract Signed' },
  { key: 'planned_completion_date', label: 'Planned Completion', note: 'Set at start' },
  { key: 'target_completion_date', label: 'Target Completion', note: 'Updated monthly' },
  { key: 'actual_completion_date', label: 'Actual Completion' },
  { key: 'planned_go_live_date', label: 'Planned Go Live', note: 'Set at start' },
  { key: 'target_time_to_live', label: 'Target Go Live', note: 'Updated monthly' },
  { key: 'actual_time_to_live', label: 'Actual Go Live' },
]

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

const RAID_TYPE_STYLES = {
  Risk:       'bg-red-50 text-red-700 ring-1 ring-red-200',
  Action:     'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  Issue:      'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  Dependency: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
}

const RAID_STATUS_STYLES = {
  Open:          'bg-red-100 text-red-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Resolved:      'bg-green-100 text-green-700',
  Closed:        'bg-slate-100 text-slate-500',
}

const TP_DOT = {
  complete:    'bg-emerald-500',
  in_progress: 'bg-blue-500',
  not_started: 'bg-slate-200',
}

function formatDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d) ? val : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

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

export default function AdminImplementation({ credential, userInfo, onLogout }) {
  const { id } = useParams()

  const [implementation, setImplementation] = useState(null)
  const [dates, setDates] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingDates, setSavingDates] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savingTP, setSavingTP] = useState(null)
  const [newAccessEmail, setNewAccessEmail] = useState('')
  const [addingAccess, setAddingAccess] = useState(false)

  useEffect(() => {
    getAllImplementations(credential).then(data => {
      const impl = (Array.isArray(data) ? data : []).find(i => i.id === id)
      if (impl) {
        setImplementation(impl)
        const d = {}
        DATE_FIELDS.forEach(f => { d[f.key] = impl[f.key] || '' })
        setDates(d)
      }
      setLoading(false)
    })
  }, [id])

  async function saveDates(e) {
    e.preventDefault()
    setSavingDates(true)
    await updateDates(credential, id, dates)
    setSavingDates(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleTPChange(key, status) {
    setSavingTP(key)
    try {
      await updateTouchPoint(credential, id, key, status)
      setImplementation(prev => ({ ...prev, touchPoints: { ...prev.touchPoints, [key]: status } }))
    } catch { /* silent */ }
    setSavingTP(null)
  }

  async function handleQAChange(key, status) {
    setSavingTP(key)
    try {
      await updateTouchPoint(credential, id, key, status)
      setImplementation(prev => ({ ...prev, qaSteps: { ...prev.qaSteps, [key]: status } }))
    } catch { /* silent */ }
    setSavingTP(null)
  }

  async function handleAddAccess(e) {
    e.preventDefault()
    const newEmail = newAccessEmail.trim().toLowerCase()
    if (!newEmail) return
    setAddingAccess(true)
    try {
      await addAccess(credential, id, newEmail)
      setImplementation(prev => ({ ...prev, accessEmails: [...(prev.accessEmails || []), newEmail] }))
      setNewAccessEmail('')
    } catch { /* silent */ }
    setAddingAccess(false)
  }

  async function handleRemoveAccess(emailToRemove) {
    try {
      await removeAccess(credential, id, emailToRemove)
      setImplementation(prev => ({ ...prev, accessEmails: (prev.accessEmails || []).filter(e => e !== emailToRemove) }))
    } catch { /* silent */ }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-slate-400 text-sm">Loading…</div>
    </div>
  )

  if (!implementation) return (
    <div className="min-h-screen bg-slate-50">
      <Navbar userInfo={userInfo} onLogout={onLogout} title="Admin — Partner Portal" />
      <div className="p-8 text-slate-500">Implementation not found.</div>
    </div>
  )

  const tp = implementation.touchPoints || {}
  const qa = implementation.qaSteps || {}
  const raidItems = implementation.raid || []

  const tpPct = Math.round(TOUCH_POINTS.filter(x => tp[x.key] === 'complete').length / TOUCH_POINTS.length * 100)
  const qaPct = Math.round(QA_STEPS.filter(x => qa[x.key] === 'complete').length / QA_STEPS.length * 100)
  const openRaid = raidItems.filter(r => r.status === 'Open' || r.status === 'In Progress').length

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar userInfo={userInfo} onLogout={onLogout} title="Admin — Partner Portal" />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Hero header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <Link to="/admin" className="text-xs text-[#019ACE] hover:text-[#017aaa] font-medium">← All partners</Link>
              <p className="text-xs font-medium text-[#019ACE] uppercase tracking-widest mt-3 mb-1">{implementation.partner_name}</p>
              <h1 className="text-2xl font-bold text-slate-900">{implementation.client_name}</h1>
              <p className="text-sm text-slate-400 mt-1">{(implementation.accessEmails || []).join(', ') || 'No partner access granted yet'}</p>
            </div>
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

        {/* Row 1: Key Dates (editable) + Implementation Progress */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Key Dates — admin edits */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Key Dates</h2>
              {saved && <span className="text-xs text-emerald-600 font-medium">Saved!</span>}
            </div>
            <form onSubmit={saveDates} className="space-y-3">
              {DATE_FIELDS.map(field => (
                <div key={field.key}>
                  <label className="block text-xs text-slate-500 mb-1">
                    {field.label}
                    {field.note && <span className="text-[#019ACE] ml-1">({field.note})</span>}
                  </label>
                  <input
                    type="date"
                    value={dates[field.key] || ''}
                    onChange={e => setDates(d => ({ ...d, [field.key]: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD500] bg-slate-50"
                  />
                </div>
              ))}
              <button type="submit" disabled={savingDates}
                className="w-full mt-2 bg-[#FFD500] hover:bg-[#e6bf00] disabled:opacity-50 text-black text-sm font-medium py-2 rounded-lg transition-colors">
                {savingDates ? 'Saving…' : 'Save Dates'}
              </button>
            </form>
          </div>

          {/* Implementation Touch Points — editable */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Implementation Progress</h2>
              <span className="text-xs font-medium text-black bg-[#FFD500] px-2 py-0.5 rounded-full">{tpPct}%</span>
            </div>
            <div className="h-1 bg-slate-100 rounded-full mb-5 overflow-hidden">
              <div className="h-full bg-[#FFD500] rounded-full transition-all" style={{ width: `${tpPct}%` }} />
            </div>
            <div className="space-y-0.5">
              {TOUCH_POINTS.map(item => {
                const status = tp[item.key] || 'not_started'
                const isSaving = savingTP === item.key
                return (
                  <div key={item.key} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${TP_DOT[status]}`} />
                      <span className="text-sm text-slate-700">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isSaving && <span className="text-xs text-slate-400">Saving…</span>}
                      <select value={status} onChange={e => handleTPChange(item.key, e.target.value)} disabled={isSaving}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#FFD500] disabled:opacity-40 bg-white text-slate-700 cursor-pointer">
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
        </div>

        {/* Partner Access */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">Partner Access</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {(implementation.accessEmails || []).length === 0 ? (
              <span className="text-sm text-slate-400">No partner access granted yet.</span>
            ) : (
              implementation.accessEmails.map(email => (
                <span key={email} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-full">
                  {email}
                  <button onClick={() => handleRemoveAccess(email)} className="text-slate-400 hover:text-red-500 leading-none">×</button>
                </span>
              ))
            )}
          </div>
          <form onSubmit={handleAddAccess} className="flex gap-2 max-w-sm">
            <input
              type="email"
              required
              value={newAccessEmail}
              onChange={e => setNewAccessEmail(e.target.value)}
              placeholder="partner@company.com"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD500]"
            />
            <button
              type="submit"
              disabled={addingAccess}
              className="bg-[#FFD500] hover:bg-[#e6bf00] disabled:opacity-50 text-black text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              {addingAccess ? 'Adding…' : 'Grant access'}
            </button>
          </form>
        </div>

        {/* Row 2: QA + RAID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* QA Steps — editable */}
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
                const isSaving = savingTP === step.key
                return (
                  <div key={step.key} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-400 w-4">{i + 1}</span>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${TP_DOT[status]}`} />
                      <span className="text-sm text-slate-700">{step.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isSaving && <span className="text-xs text-slate-400">Saving…</span>}
                      <select value={status} onChange={e => handleQAChange(step.key, e.target.value)} disabled={isSaving}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#FFD500] disabled:opacity-40 bg-white text-slate-700 cursor-pointer">
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

          {/* RAID Log — read-only */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">RAID Log</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Logged by the partner · {raidItems.length} item{raidItems.length !== 1 ? 's' : ''}
                {openRaid > 0 && <span className="text-amber-500 ml-1">· {openRaid} open</span>}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 max-h-96">
              {raidItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                  <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm">No RAID items logged yet</p>
                </div>
              ) : raidItems.map(item => (
                <div key={item.id} className="border border-slate-100 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${RAID_TYPE_STYLES[item.type] || 'bg-slate-50 text-slate-600 ring-1 ring-slate-200'}`}>
                      {item.type}
                    </span>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${RAID_STATUS_STYLES[item.status] || 'bg-slate-100 text-slate-600'}`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800">{item.title}</p>
                  {item.description && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                    {item.owner && <span>Owner: {item.owner}</span>}
                    {item.raised_date && <span>{formatDate(item.raised_date)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
