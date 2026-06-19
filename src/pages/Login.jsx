import { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { getMyImplementation } from '../api'

function parseJwt(token) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(base64))
}

function BloomreachLogo() {
  return (
    <div className="flex items-center gap-3 justify-center">
      <svg width="52" height="52" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
        <circle cx="28" cy="28" r="28" fill="#FFD500"/>
        <line x1="19" y1="16" x2="19" y2="43" stroke="#0a0a0a" strokeWidth="7" strokeLinecap="round"/>
        <path d="M 19 29 A 12 12 0 1 1 19 43" stroke="#0a0a0a" strokeWidth="7" strokeLinecap="round" fill="none"/>
        <circle cx="16" cy="14" r="3.5" fill="#0a0a0a"/>
      </svg>
      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 26, fontWeight: 500, color: '#0a0a0a', letterSpacing: '-0.5px' }}>
        bloomreach
      </span>
    </div>
  )
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
    <div className="min-h-screen flex" style={{ background: '#f8fafc' }}>
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-black flex-col items-center justify-center p-12">
        <BloomreachLogo />
        <p className="text-white/40 text-sm mt-6 text-center max-w-xs leading-relaxed">
          Partner implementation portal — track your Bloomreach integration progress in one place
        </p>
      </div>

      {/* Right panel — sign in */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10">
            <BloomreachLogo />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-1">Sign in</h1>
          <p className="text-slate-500 text-sm mb-8">Use your Google account to access your implementation</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">
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

          <p className="text-center text-xs text-slate-400 mt-8">
            Access is granted by your Bloomreach implementation manager
          </p>
        </div>
      </div>
    </div>
  )
}
