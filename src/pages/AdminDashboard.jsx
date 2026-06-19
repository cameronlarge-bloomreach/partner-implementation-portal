import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllImplementations, addImplementation } from '../api'
import Navbar from '../components/Navbar'

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

function getProgress(impl) {
  const tp = impl.touchPoints || {}
  const complete = TP_KEYS.filter(k => tp[k] === 'complete').length
  return Math.round((complete / TP_KEYS.length) * 100)
}

function getQAProgress(impl) {
  const qa = impl.qaSteps || {}
  const complete = QA_KEYS.filter(k => qa[k] === 'complete').length
  return Math.round((complete / QA_KEYS.length) * 100)
}

const EMPTY_FORM = { email: '', partner_name: '', client_name: '' }

export default function AdminDashboard({ credential, userInfo, onLogout }) {
  const [implementations, setImplementations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)

  useEffect(() => {
    getAllImplementations(credential)
      .then(data => setImplementations(data || []))
      .catch(() => setError('Failed to load implementations.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    setAdding(true)
    setAddError(null)
    try {
      const res = await addImplementation(credential, form)
      if (res.error === 'already_exists') {
        setAddError('An implementation with that email already exists.')
      } else {
        setImplementations(prev => [...prev, {
          email: form.email,
          partner_name: form.partner_name,
          client_name: form.client_name,
          touchPoints: {},
          qaSteps: {},
          raid: [],
        }])
        setForm(EMPTY_FORM)
        setShowAdd(false)
      }
    } catch {
      setAddError('Failed to add partner. Please try again.')
    }
    setAdding(false)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar userInfo={userInfo} onLogout={onLogout} title="Admin — Partner Portal" />

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">All Implementations</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {implementations.length} partner{implementations.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => { setShowAdd(v => !v); setAddError(null) }}
            className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Add implementation
          </button>
        </div>

        {/* Add partner form */}
        {showAdd && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Add new partner implementation</h2>
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Partner email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder=""
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Partner name *</label>
                <input
                  type="text"
                  required
                  value={form.partner_name}
                  onChange={e => setForm(f => ({ ...f, partner_name: e.target.value }))}
                  placeholder=""
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Client name *</label>
                <input
                  type="text"
                  required
                  value={form.client_name}
                  onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                  placeholder=""
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              {addError && (
                <div className="sm:col-span-3 text-sm text-red-600">{addError}</div>
              )}
              <div className="sm:col-span-3 flex gap-3">
                <button
                  type="submit"
                  disabled={adding}
                  className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
                >
                  {adding ? 'Adding…' : 'Add implementation'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setForm(EMPTY_FORM); setAddError(null) }}
                  className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="text-slate-400 text-center py-20 text-sm">Loading…</div>
        ) : error ? (
          <div className="text-red-600 text-center py-20 text-sm">{error}</div>
        ) : implementations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
            No implementations yet. Add a partner above to get started.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Partner / Client</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Contract Signed</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Target Completion</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Target Go Live</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Progress</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">QA</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {implementations.map(impl => {
                  const progress = getProgress(impl)
                  const qa = getQAProgress(impl)
                  const openRaid = (impl.raid || []).filter(r => r.status === 'Open' || r.status === 'In Progress').length
                  return (
                    <tr key={impl.email} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">{impl.client_name}</div>
                        <div className="text-xs text-slate-500">{impl.partner_name}</div>
                        <div className="text-xs text-slate-400">{impl.email}</div>
                        {openRaid > 0 && (
                          <span className="inline-block mt-1 text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">
                            {openRaid} open RAID
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(impl.contract_sign_date)}</td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(impl.target_completion_date)}</td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(impl.target_time_to_live)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${progress === 100 ? 'bg-emerald-500' : progress > 0 ? 'bg-violet-500' : 'bg-slate-200'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-slate-500 text-xs w-8">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${qa === 100 ? 'bg-emerald-500' : qa > 0 ? 'bg-blue-500' : 'bg-slate-200'}`}
                              style={{ width: `${qa}%` }}
                            />
                          </div>
                          <span className="text-slate-500 text-xs w-8">{qa}%</span>
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
