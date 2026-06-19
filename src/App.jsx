import { useState } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import PartnerDashboard from './pages/PartnerDashboard'
import AdminDashboard from './pages/AdminDashboard'
import AdminImplementation from './pages/AdminImplementation'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export default function App() {
  // credential = raw Google ID token (JWT string)
  // userInfo = { email, name, picture } decoded from it
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
        <Route
          path="/"
          element={
            !credential
              ? <Navigate to="/login" replace />
              : userInfo?.isAdmin
              ? <Navigate to="/admin" replace />
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
          path="/admin/implementation/:email"
          element={
            !credential
              ? <Navigate to="/login" replace />
              : !userInfo?.isAdmin
              ? <Navigate to="/" replace />
              : <AdminImplementation credential={credential} userInfo={userInfo} onLogout={handleLogout} />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </GoogleOAuthProvider>
  )
}
