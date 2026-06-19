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

const EMPTY_FORM = { emails: '', partner_name: '', client_name: '' }

export default function AdminDashboard({ credential, userInfo, onLogout }) {
  const [implementations, setImplementations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)
  const [partnerFilter, setPartnerFilter] = useState('All')
  const [showCompleted, setShowCompleted] = useState(false)

  useEffect(() => {
    getAllImplementations(credential)
      .then(data => {
        if (data?.error) setError('Failed to load implementations.')
        else setImplementations(data || [])
      })
      .catch(() => setError('Failed to load implementations.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    setAdding(true)
    setAddError(null)
    try {
      const res = await addImplementation(credential, form)
      if (res.error) {
        setAddError(res.error)
      } else {
        const emails = form.emails.split(',').map(s => s.trim()).filter(Boolean)
        setImplementations(prev => [...prev, {
          id: res.id,
          partner_name: form.partner_name,
          client_name: form.client_name,
          status: 'active',
          accessEmails: emails,
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
              {implementations.filter(i => i.status !== 'complete').length} active implementation{implementations.filter(i => i.status !== 'complete').length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => { setShowAdd(v => !v); setAddError(null) }}
            className="bg-[#FFD500] hover:bg-[#e6bf00] text-black text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Add implementation
          </button>
        </div>

        {/* Summary stats */}
        {!loading && !error && implementations.length > 0 && (() => {
          const activeImpls = implementations.filter(i => i.status !== 'complete')
          const completeCount = implementations.length - activeImpls.length
          const avgProgress = activeImpls.length
            ? Math.round(activeImpls.reduce((sum, i) => sum + getProgress(i), 0) / activeImpls.length)
            : 0
          const avgQA = activeImpls.length
            ? Math.round(activeImpls.reduce((sum, i) => sum + getQAProgress(i), 0) / activeImpls.length)
            : 0
          const totalOpenRaid = implementations.reduce(
            (sum, i) => sum + (i.raid || []).filter(r => r.status === 'Open' || r.status === 'In Progress').length, 0
          )
          const overdueCount = activeImpls.filter(i => {
            if (!i.target_completion_date) return false
            return new Date(i.target_completion_date) < new Date()
          }).length

          const stats = [
            { label: 'Active', value: activeImpls.length },
            { label: 'Complete', value: completeCount },
            { label: 'Avg Progress', value: `${avgProgress}%` },
            { label: 'Avg QA', value: `${avgQA}%` },
            { label: 'Open RAID', value: totalOpenRaid, warn: totalOpenRaid > 0 },
            { label: 'Overdue', value: overdueCount, warn: overdueCount > 0 },
          ]

          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              {stats.map(s => (
                <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4">
                  <p className={`text-2xl font-bold ${s.warn ? 'text-amber-600' : 'text-slate-900'}`}>{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )
        })()}

        {/* Add partner form */}
        {showAdd && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Add new partner implementation</h2>
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Partner email(s) *</label>
                <input
                  type="text"
                  required
                  value={form.emails}
                  onChange={e => setForm(f => ({ ...f, emails: e.target.value }))}
                  placeholder="jane@partner.com, alex@partner.com"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD500]"
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
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD500]"
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
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD500]"
                />
              </div>
              {addError && (
                <div className="sm:col-span-3 text-sm text-red-600">{addError}</div>
              )}
              <div className="sm:col-span-3 flex gap-3">
                <button
                  type="submit"
                  disabled={adding}
                  className="bg-[#FFD500] hover:bg-[#e6bf00] disabled:opacity-50 text-black text-sm font-medium px-5 py-2 rounded-lg transition-colors"
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
        ) : (() => {
          const activeImpls = implementations.filter(i => i.status !== 'complete')
          const completedImpls = implementations.filter(i => i.status === 'complete')
          const partners = ['All', ...Array.from(new Set(activeImpls.map(i => i.partner_name).filter(Boolean))).sort()]
          const filtered = partnerFilter === 'All' ? activeImpls : activeImpls.filter(i => i.partner_name === partnerFilter)
          return (
          <>
            {/* Partner filter chips */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {partners.map(p => (
                <button
                  key={p}
                  onClick={() => setPartnerFilter(p)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    partnerFilter === p
                      ? 'bg-[#FFD500] text-black border-[#FFD500]'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-[#FFD500] hover:text-black'
                  }`}
                >
                  {p}
                </button>
              ))}
              {partnerFilter !== 'All' && (
                <span className="text-xs text-slate-400 ml-1">{filtered.length} implementation{filtered.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-sm mb-6">
                No active implementations{partnerFilter !== 'All' ? ` for ${partnerFilter}` : ''}.
              </div>
            ) : (
              <ImplTable items={filtered} />
            )}

            {/* Completed — collapsed by default */}
            {completedImpls.length > 0 && (
              <div className="mt-6">
                <button
                  onClick={() => setShowCompleted(v => !v)}
                  className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
                >
                  <span className={`inline-block transition-transform ${showCompleted ? 'rotate-90' : ''}`}>›</span>
                  Completed ({completedImpls.length})
                </button>
                {showCompleted && (
                  <div className="mt-3">
                    <ImplTable items={completedImpls} />
                  </div>
                )}
              </div>
            )}
          </>
        )})()}
      </div>
    </div>
  )
}

function ImplTable({ items }) {
  return (
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
          {items.map(impl => {
            const progress = getProgress(impl)
            const qa = getQAProgress(impl)
            const openRaid = (impl.raid || []).filter(r => r.status === 'Open' || r.status === 'In Progress').length
            return (
              <tr key={impl.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-slate-900">{impl.client_name}</div>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${impl.status === 'complete' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                      {impl.status === 'complete' ? 'Complete' : 'Active'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">{impl.partner_name}</div>
                  <div className="text-xs text-slate-400">{(impl.accessEmails || []).join(', ')}</div>
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
                        className={`h-full rounded-full ${progress === 100 ? 'bg-emerald-500' : progress > 0 ? 'bg-[#FFD500]' : 'bg-slate-200'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-slate-500 text-xs">{progress}%</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${qa === 100 ? 'bg-emerald-500' : qa > 0 ? 'bg-[#019ACE]' : 'bg-slate-200'}`}
                        style={{ width: `${qa}%` }}
                      />
                    </div>
                    <span className="text-slate-500 text-xs">{QA_KEYS.filter(k => (impl.qaSteps || {})[k] === 'complete').length} / {QA_KEYS.length}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <Link
                    to={`/admin/implementation/${impl.id}`}
                    className="text-[#019ACE] hover:text-[#017aaa] font-medium"
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
  )
}
