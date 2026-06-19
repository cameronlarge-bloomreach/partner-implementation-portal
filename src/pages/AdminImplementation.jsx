import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getAllImplementations, updateDates } from '../api'
import Navbar from '../components/Navbar'
import StatusBadge from '../components/StatusBadge'

const DATE_FIELDS = [
  { key: 'contract_sign_date', label: 'Contract Sign Date' },
  { key: 'planned_completion_date', label: 'Planned Completion Date', note: 'Set at start' },
  { key: 'target_completion_date', label: 'Target Completion Date', note: 'Updated monthly' },
  { key: 'actual_completion_date', label: 'Actual Completion Date' },
  { key: 'planned_go_live_date', label: 'Planned Go Live Date', note: 'Set at start' },
  { key: 'target_time_to_live', label: 'Target Time to Live', note: 'Updated monthly' },
  { key: 'actual_time_to_live', label: 'Actual Time to Live' },
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

export default function AdminImplementation({ credential, userInfo, onLogout }) {
  const { email } = useParams()
  const decodedEmail = decodeURIComponent(email)

  const [implementation, setImplementation] = useState(null)
  const [dates, setDates] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getAllImplementations(credential).then(data => {
      const impl = (data || []).find(i => i.email === decodedEmail)
      if (impl) {
        setImplementation(impl)
        const d = {}
        DATE_FIELDS.forEach(f => { d[f.key] = impl[f.key] || '' })
        setDates(d)
      }
      setLoading(false)
    })
  }, [decodedEmail])

  async function saveDates(e) {
    e.preventDefault()
    setSaving(true)
    await updateDates(credential, decodedEmail, dates)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-slate-500">Loading...</div>
    </div>
  )

  if (!implementation) return (
    <div className="min-h-screen bg-slate-50">
      <Navbar userInfo={userInfo} onLogout={onLogout} title="Admin — Partner Portal" />
      <div className="p-8 text-slate-500">Implementation not found.</div>
    </div>
  )

  const touchPoints = implementation.touchPoints || {}
  const overallProgress = (() => {
    const complete = TOUCH_POINTS.filter(tp => touchPoints[tp.key] === 'complete').length
    return Math.round((complete / TOUCH_POINTS.length) * 100)
  })()

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar userInfo={userInfo} onLogout={onLogout} title="Admin — Partner Portal" />

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div>
          <Link to="/admin" className="text-sm text-violet-600 hover:text-violet-800">← All partners</Link>
          <div className="flex items-start justify-between mt-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{implementation.partner_name}</h1>
              <p className="text-xs text-slate-400 mt-0.5">{decodedEmail}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-violet-600">{overallProgress}%</div>
              <div className="text-xs text-slate-500">Complete</div>
            </div>
          </div>
          <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${overallProgress}%` }} />
          </div>
        </div>

        {/* Date fields — admin edits these */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Key Dates</h2>
            {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
          </div>
          <form onSubmit={saveDates} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {DATE_FIELDS.map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {field.label}
                    {field.note && <span className="text-xs text-violet-500 ml-1">({field.note})</span>}
                  </label>
                  <input
                    type="date"
                    value={dates[field.key] || ''}
                    onChange={e => setDates(d => ({ ...d, [field.key]: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              ))}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save Dates'}
            </button>
          </form>
        </div>

        {/* Touch points — read-only for admin */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-1">Implementation Progress</h2>
          <p className="text-sm text-slate-500 mb-4">Updated by the partner</p>
          <div className="space-y-1">
            {TOUCH_POINTS.map(tp => (
              <div key={tp.key} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    touchPoints[tp.key] === 'complete' ? 'bg-green-500' :
                    touchPoints[tp.key] === 'in_progress' ? 'bg-blue-500' : 'bg-slate-300'
                  }`} />
                  <span className="text-sm font-medium text-slate-800">{tp.label}</span>
                </div>
                <StatusBadge status={touchPoints[tp.key] || 'not_started'} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
