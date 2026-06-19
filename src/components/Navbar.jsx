function BrMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
      <circle cx="28" cy="28" r="28" fill="#FFD500"/>
      <line x1="19" y1="16" x2="19" y2="43" stroke="#0a0a0a" strokeWidth="7" strokeLinecap="round"/>
      <path d="M 19 29 A 12 12 0 1 1 19 43" stroke="#0a0a0a" strokeWidth="7" strokeLinecap="round" fill="none"/>
      <circle cx="16" cy="14" r="3.5" fill="#0a0a0a"/>
    </svg>
  )
}

export default function Navbar({ userInfo, onLogout, title }) {
  return (
    <nav className="bg-black px-6 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <BrMark size={32} />
        <span className="text-white font-semibold text-sm tracking-wide">{title || 'Partner Portal'}</span>
      </div>
      <div className="flex items-center gap-4">
        {userInfo?.picture && (
          <img src={userInfo.picture} alt="" className="w-7 h-7 rounded-full opacity-90" referrerPolicy="no-referrer" />
        )}
        <span className="text-sm text-white/60">{userInfo?.name || userInfo?.email}</span>
        <button
          onClick={onLogout}
          className="text-sm text-white/60 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
