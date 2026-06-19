export default function Navbar({ userInfo, onLogout, title }) {
  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-xs font-bold">BR</span>
        </div>
        <span className="font-semibold text-slate-900">{title || 'Partner Portal'}</span>
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
