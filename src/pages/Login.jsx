import { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { getMyImplementation } from '../api'
import bloomreachLogo from '../assets/bloomreach-logo.png'

function parseJwt(token) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(base64))
}

export default function Login({ onLogin }) {
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSuccess(response) {
    setLoading(true)
    setError(null)
    try {
      const decoded = parseJwt(response.credential)
      const data = await getMyImplementation(response.credential)

      if (data.error === 'unauthorized') {
        setError('Your Google account is not registered as a partner. Please contact your Bloomreach representative.')
        setLoading(false)
        return
      }

      onLogin(response.credential, {
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        isAdmin: data.isAdmin,
      })
    } catch (e) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12" style={{ background: '#FFD500' }}>
        <img src={bloomreachLogo} alt="Bloomreach" className="h-12" />
      </div>

      {/* Right panel — sign in */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-sm text-center">
          {/* Mobile logo */}
          <img src={bloomreachLogo} alt="Bloomreach" className="h-10 mx-auto mb-8 lg:hidden" />

          <h1 className="text-2xl font-bold text-slate-900 mb-1">Sign in</h1>
          <p className="text-slate-500 text-sm mb-8">Use the login options below to update your Bloomreach Implementation Progress</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6 text-left">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center text-slate-500 text-sm py-2">Signing you in…</div>
          ) : (
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={() => setError('Google sign-in failed. Please try again.')}
                theme="outline"
                size="large"
                text="signin_with"
                shape="rectangular"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
