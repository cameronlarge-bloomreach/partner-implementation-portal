import { useState } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import VerifyMagicLink from './pages/VerifyMagicLink'
import PartnerSelect from './pages/PartnerSelect'
import PartnerDashboard from './pages/PartnerDashboard'
import AdminDashboard from './pages/AdminDashboard'
import AdminImplementation from './pages/AdminImplementation'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

function defaultRouteFor(userInfo) {
  if (userInfo?.isAdmin) return '/admin'
  if (userInfo?.implementations?.length === 1) return `/implementation/${userInfo.implementations[0].id}`
  return '/select'
}

export default function App() {
  // credential = auth token (Google ID token or magic-link session token)
  // userInfo = { email, name, picture, isAdmin, implementations: [{id, partner_name, client_name}] }
  const [credential, setCredential] = useState(null)
  const [userInfo, setUserInfo] = useState(null)

  function handleLogin(cred, info) {
    setCredential(cred)
    setUserInfo(info)
  }

  function handleLogout() {
    setCredential(null)
    setUserInfo(null)
  }

  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <Routes>
        <Route
          path="/login"
          element={
            credential
              ? <Navigate to="/" replace />
              : <Login onLogin={handleLogin} />
          }
        />
        <Route path="/verify" element={<VerifyMagicLink onLogin={handleLogin} />} />
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
          path="/"
          element={
            !credential
              ? <Navigate to="/login" replace />
              : <Navigate to={defaultRouteFor(userInfo)} replace />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </GoogleOAuthProvider>
  )
}
