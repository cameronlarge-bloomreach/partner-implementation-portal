import bloomreachLogo from '../assets/bloomreach-logo.png'

export default function Navbar({ userInfo, onLogout, title }) {
  return (
    <nav className="bg-white px-6 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--hairline)' }}>
      <div className="flex items-center gap-3">
        <img src={bloomreachLogo} alt="Bloomreach" className="h-7" />
        <span className="w-px h-5" style={{ background: 'var(--hairline)' }} />
        <span className="font-display font-medium text-sm tracking-tight" style={{ color: 'var(--ink)' }}>{title || 'Partner Portal'}</span>
      </div>
      <div className="flex items-center gap-4">
        {userInfo?.picture && (
          <img src={userInfo.picture} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
        )}
        <span className="text-sm" style={{ color: 'var(--muted)' }}>{userInfo?.name || userInfo?.email}</span>
        <button
          onClick={onLogout}
          className="text-sm hover:opacity-70 transition-opacity"
          style={{ color: 'var(--muted)' }}
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
