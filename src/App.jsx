import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { loadUserInfo, signOut } from './api'
import Login from './pages/Login'
import SetPassword from './pages/SetPassword'
import VerifyMagicLink from './pages/VerifyMagicLink'
import PartnerSelect from './pages/PartnerSelect'
import PartnerDashboard from './pages/PartnerDashboard'
import AdminDashboard from './pages/AdminDashboard'
import AdminImplementation from './pages/AdminImplementation'
import ControlCentre from './pages/ControlCentre'

function defaultRouteFor(userInfo) {
  if (userInfo?.isAdmin) return '/admin'
  if (userInfo?.implementations?.length === 1) return `/implementation/${userInfo.implementations[0].id}`
  return '/select'
}

function CenteredMessage({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)' }}>
      <div className="text-center max-w-sm px-6 text-sm" style={{ color: 'var(--muted)' }}>{children}</div>
    </div>
  )
}

export default function App() {
  // session: undefined = still checking storage/URL, null = signed out.
  // userInfo = { email, name, isAdmin, implementations } or { error, email }.
  const [session, setSession] = useState(undefined)
  const [userInfo, setUserInfo] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s ?? null)
      // Arriving via a "Forgot password?" recovery email: send the user
      // straight to the set-password screen.
      if (event === 'PASSWORD_RECOVERY') navigate('/set-password', { replace: true })
    })
    return () => sub.subscription.unsubscribe()
  }, [navigate])

  useEffect(() => {
    let cancelled = false
    if (!session) { setUserInfo(null); return }
    loadUserInfo(session).then(info => { if (!cancelled) setUserInfo(info) })
    return () => { cancelled = true }
  }, [session])

  async function handleLogout() {
    await signOut()
    setUserInfo(null)
  }

  if (session === undefined) return <CenteredMessage>Loading…</CenteredMessage>

  // Signed in, but this email has no implementation access and isn't admin.
  if (session && userInfo?.error) {
    return (
      <CenteredMessage>
        <p className="mb-4">
          <strong>{userInfo.email}</strong> isn’t registered on any implementation.
          Please contact your Bloomreach representative.
        </p>
        <button onClick={handleLogout} className="font-medium underline" style={{ color: 'var(--ink)' }}>
          Sign out
        </button>
      </CenteredMessage>
    )
  }

  if (session && !userInfo) return <CenteredMessage>Signing you in…</CenteredMessage>

  const credential = session?.access_token ?? null

  return (
    <Routes>
      <Route
        path="/login"
        element={
          credential
            ? <Navigate to="/" replace />
            : <Login />
        }
      />
      <Route path="/verify" element={<VerifyMagicLink />} />
      <Route
        path="/set-password"
        element={!credential ? <Navigate to="/login" replace /> : <SetPassword />}
      />
      <Route
        path="/select"
        element={
          !credential
            ? <Navigate to="/login" replace />
            : <PartnerSelect userInfo={userInfo} onLogout={handleLogout} />
        }
      />
      <Route
        path="/implementation/:id"
        element={
          !credential
            ? <Navigate to="/login" replace />
            : <PartnerDashboard credential={credential} userInfo={userInfo} onLogout={handleLogout} />
        }
      />
      <Route
        path="/admin"
        element={
          !credential
            ? <Navigate to="/login" replace />
            : !userInfo?.isAdmin
            ? <Navigate to="/" replace />
            : <AdminDashboard credential={credential} userInfo={userInfo} onLogout={handleLogout} />
        }
      />
      <Route
        path="/admin/implementation/:id"
        element={
          !credential
            ? <Navigate to="/login" replace />
            : !userInfo?.isAdmin
            ? <Navigate to="/" replace />
            : <AdminImplementation credential={credential} userInfo={userInfo} onLogout={handleLogout} />
        }
      />
      <Route
        path="/admin/control-centre"
        element={
          !credential
            ? <Navigate to="/login" replace />
            : !userInfo?.isAdmin
            ? <Navigate to="/" replace />
            : <ControlCentre credential={credential} userInfo={userInfo} onLogout={handleLogout} />
        }
      />
      <Route
        path="/"
        element={
          !credential
            ? <Navigate to="/login" replace />
            : <Navigate to={defaultRouteFor(userInfo)} replace />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
