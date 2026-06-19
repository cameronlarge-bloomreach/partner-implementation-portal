import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'

export default function PartnerSelect({ userInfo, onLogout }) {
  const implementations = userInfo?.implementations || []

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <Navbar userInfo={userInfo} onLogout={onLogout} title="Partner Portal" />

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display text-xl font-semibold mb-1" style={{ color: 'var(--ink)' }}>Your implementations</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>Select an implementation to view its progress.</p>

        <div className="grid gap-3">
          {implementations.map(impl => (
            <Link
              key={impl.id}
              to={`/implementation/${impl.id}`}
              className="bg-white rounded-2xl p-5 flex items-center justify-between transition-colors"
              style={{ border: '1px solid var(--hairline)' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--hairline)'}
            >
              <div>
                <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: 'var(--arctic)' }}>{impl.partner_name}</p>
                <p className="font-display text-base font-medium" style={{ color: 'var(--ink)' }}>{impl.client_name}</p>
              </div>
              <span style={{ color: 'var(--muted)' }}>→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
