import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllImplementations } from '../api'
import Navbar from '../components/Navbar'

const TOUCH_POINT_KEYS = [
  'account_creation', 'frontend_data', 'backend_data',
  'integration_sms', 'integration_email', 'integration_whatsapp', 'use_cases'
]

function formatDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d) ? val : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getProgress(impl) {
  const tp = impl.touchPoints || {}
  const complete = TOUCH_POINT_KEYS.filter(k => tp[k] === 'complete').length
  return Math.round((complete / TOUCH_POINT_KEYS.length) * 100)
}

export default function AdminDashboard({ credential, userInfo, onLogout }) {
  const [implementations, setImplementations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getAllImplementations(credential)
      .then(data => setImplementations(data || []))
      .catch(() => setError('Failed to load implementations.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar userInfo={userInfo} onLogout={onLogout} title="Admin — Partner Portal" />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">All Implementations</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {implementations.length} partner{implementations.length !== 1 ? 's' : ''} — manage data in the{' '}
              <a
                href={`https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_SHEET_ID}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-600 hover:underline"
              >
                Google Sheet
              </a>
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-slate-500 text-center py-20">Loading...</div>
        ) : error ? (
          <div className="text-red-600 text-center py-20">{error}</div>
        ) : implementations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            No implementations yet. Add a row to the Google Sheet to get started.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Partner</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Contract Signed</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Target Completion</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Target Go Live</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Progress</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {implementations.map(impl => {
                  const progress = getProgress(impl)
                  return (
                    <tr key={impl.email} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">{impl.client_name}</div>
                        <div className="text-xs text-slate-500">{impl.partner_name}</div>
                        <div className="text-xs text-slate-400">{impl.email}</div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(impl.contract_sign_date)}</td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(impl.target_completion_date)}</td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(impl.target_time_to_live)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${progress === 100 ? 'bg-green-500' : progress > 0 ? 'bg-blue-500' : 'bg-slate-300'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-slate-600 text-xs">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          to={`/admin/implementation/${encodeURIComponent(impl.email)}`}
                          className="text-violet-600 hover:text-violet-800 font-medium"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
