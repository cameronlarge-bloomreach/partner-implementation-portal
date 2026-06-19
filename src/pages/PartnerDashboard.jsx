import { useEffect, useState } from 'react'
import { getMyImplementation, updateTouchPoint } from '../api'
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

const DATE_FIELDS = [
  { key: 'contract_sign_date', label: 'Contract Sign Date' },
  { key: 'planned_completion_date', label: 'Planned Completion Date', note: 'Set at start' },
  { key: 'target_completion_date', label: 'Target Completion Date', note: 'Updated monthly' },
  { key: 'actual_completion_date', label: 'Actual Completion Date' },
  { key: 'planned_go_live_date', label: 'Planned Go Live Date', note: 'Set at start' },
  { key: 'target_time_to_live', label: 'Target Time to Live', note: 'Updated monthly' },
  { key: 'actual_time_to_live', label: 'Actual Time to Live' },
]

function formatDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d) ? val : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PartnerDashboard({ credential, userInfo, onLogout }) {
  const [implementation, setImplementation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const data = await getMyImplementation(credential)
      setImplementation(data)
    } catch {
      setError('Failed to load your implementation. Please refresh.')
    }
    setLoading(false)
  }

  async function handleStatusChange(key, status) {
    setSaving(key)
    try {
      await updateTouchPoint(credential, userInfo.email, key, status)
      setImplementation(prev => ({
        ...prev,
        touchPoints: {
          ...prev.touchPoints,
          [key]: status,
        },
      }))
    } catch {
      setError('Failed to save. Please try again.')
    }
    setSaving(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500">Loading your implementation...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar userInfo={userInfo} onLogout={onLogout} />
        <div className="max-w-2xl mx-auto mt-20 text-center text-red-600">{error}</div>
      </div>
    )
  }

  const touchPoints = implementation?.touchPoints || {}
  const overallProgress = (() => {
    const complete = TOUCH_POINTS.filter(tp => touchPoints[tp.key] === 'complete').length
    return Math.round((complete / TOUCH_POINTS.length) * 100)
  })()

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar userInfo={userInfo} onLogout={onLogout} title="Partner Portal" />

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{implementation?.partner_name}</h1>
              <p className="text-slate-500 text-sm mt-1">Implementation Overview</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-violet-600">{overallProgress}%</div>
              <div className="text-xs text-slate-500">Complete</div>
            </div>
          </div>
          <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* Dates */}
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
                      status === 'complete' ? 'bg-green-500' :
                      status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-300'
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
      </div>
    </div>
  )
}
