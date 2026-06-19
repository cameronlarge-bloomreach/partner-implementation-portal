import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'

export default function PartnerSelect({ userInfo, onLogout }) {
  const implementations = userInfo?.implementations || []

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar userInfo={userInfo} onLogout={onLogout} title="Partner Portal" />

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-xl font-semibold text-slate-900 mb-1">Your implementations</h1>
        <p className="text-sm text-slate-500 mb-6">Select an implementation to view its progress.</p>

        <div className="grid gap-3">
          {implementations.map(impl => (
            <Link
              key={impl.id}
              to={`/implementation/${impl.id}`}
              className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between hover:border-[#FFD500] transition-colors"
            >
              <div>
                <p className="text-xs font-medium text-[#019ACE] uppercase tracking-widest mb-1">{impl.partner_name}</p>
                <p className="text-base font-semibold text-slate-900">{impl.client_name}</p>
              </div>
              <span className="text-slate-400">→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
