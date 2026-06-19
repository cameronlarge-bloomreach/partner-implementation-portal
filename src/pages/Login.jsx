import { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { getMyImplementation, requestMagicLink } from '../api'
import bloomreachLogo from '../assets/bloomreach-logo.png'

function parseJwt(token) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(base64))
}

export default function Login({ onLogin }) {
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [magicSent, setMagicSent] = useState(false)
  const [magicLoading, setMagicLoading] = useState(false)

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

  async function handleMagicLink(e) {
    e.preventDefault()
    setMagicLoading(true)
    setError(null)
    try {
      const res = await requestMagicLink(email)
      if (res.error) {
        setError('That email is not registered as a partner. Please contact your Bloomreach representative.')
      } else {
        setMagicSent(true)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setMagicLoading(false)
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
            <div className="flex justify-center mb-6">
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

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">OR</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {magicSent ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3 text-left">
              Check your email — we sent a sign-in link to <strong>{email}</strong>. It expires in 15 minutes.
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-3 text-left">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD500]"
              />
              <button
                type="submit"
                disabled={magicLoading}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                {magicLoading ? 'Sending…' : 'Email me a sign-in link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
