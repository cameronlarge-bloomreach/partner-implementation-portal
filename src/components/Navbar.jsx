import bloomreachLogo from '../assets/bloomreach-logo.png'

export default function Navbar({ userInfo, onLogout, title }) {
  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src={bloomreachLogo} alt="Bloomreach" className="h-7" />
        <span className="w-px h-5 bg-slate-200" />
        <span className="font-semibold text-slate-700 text-sm">{title || 'Partner Portal'}</span>
      </div>
      <div className="flex items-center gap-4">
        {userInfo?.picture && (
          <img src={userInfo.picture} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
        )}
        <span className="text-sm text-slate-500">{userInfo?.name || userInfo?.email}</span>
        <button
          onClick={onLogout}
          className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
