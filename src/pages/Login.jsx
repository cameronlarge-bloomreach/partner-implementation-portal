import { useState } from 'react'
import { requestMagicLink, signInWithPassword, requestPasswordReset } from '../api'
import bloomreachLogo from '../assets/bloomreach-logo.png'

export default function Login() {
  const [mode, setMode] = useState('password') // 'password' | 'link'
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'password') {
        const res = await signInWithPassword(email, password)
        if (res.error) {
          setError(res.error === 'Invalid login credentials'
            ? 'Incorrect email or password. If you haven’t set a password yet, sign in with an email link first, then choose “Set password”.'
            : res.error)
        }
        // On success the auth listener in App.jsx takes over.
      } else {
        const res = await requestMagicLink(email)
        if (res.error) setError(res.error)
        else setNotice(`Check your email — we sent a sign-in link to ${email}. Open it on this device to finish signing in.`)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  async function forgotPassword() {
    if (!email) { setError('Enter your email above first, then click “Forgot password?” again.'); return }
    setError(null)
    const res = await requestPasswordReset(email)
    if (res.error) setError(res.error)
    else setNotice(`Check your email — we sent a password reset link to ${email}. Open it on this device, then choose a new password.`)
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand, with a faint tick texture echoing the rollout rail */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12" style={{ backgroundColor: 'var(--gold)' }}>
        <img src={bloomreachLogo} alt="Bloomreach" className="h-12" />
        <p className="font-display text-black/70 text-sm mt-6 tracking-wide">Partner Implementation Portal</p>
      </div>

      {/* Right panel — sign in */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ background: 'var(--paper)' }}>
        <div className="w-full max-w-sm text-center">
          {/* Mobile logo */}
          <img src={bloomreachLogo} alt="Bloomreach" className="h-10 mx-auto mb-8 lg:hidden" />

          <h1 className="font-display text-3xl font-semibold mb-1" style={{ color: 'var(--ink)' }}>Sign in</h1>
          <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
            {mode === 'password' ? 'Enter your email and password' : 'Enter your email and we’ll send you a sign-in link'}
          </p>

          {error && (
            <div className="text-sm rounded-lg px-4 py-3 mb-6 text-left" style={{ background: 'var(--rust-bg)', border: '1px solid var(--rust)', color: 'var(--rust)' }}>
              {error}
            </div>
          )}

          {notice ? (
            <div className="text-sm rounded-lg px-4 py-3 text-left" style={{ background: 'var(--moss-bg)', border: '1px solid var(--moss)', color: 'var(--moss)' }}>
              {notice}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3 text-left">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ border: '1px solid var(--hairline)' }}
              />
              {mode === 'password' && (
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ border: '1px solid var(--hairline)' }}
                />
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full disabled:opacity-50 text-sm font-medium py-2.5 rounded-lg transition-colors"
                style={{ background: 'var(--ink)', color: '#fff' }}
              >
                {loading ? 'Signing in…' : mode === 'password' ? 'Sign in' : 'Email me a sign-in link'}
              </button>
            </form>
          )}

          <div className="mt-6 space-y-2 text-sm">
            <button
              type="button"
              className="font-medium underline"
              style={{ color: 'var(--ink)' }}
              onClick={() => { setMode(mode === 'password' ? 'link' : 'password'); setError(null); setNotice(null) }}
            >
              {mode === 'password' ? 'Email me a sign-in link instead' : 'Use a password instead'}
            </button>
            {mode === 'password' && !notice && (
              <div>
                <button type="button" className="underline" style={{ color: 'var(--muted)' }} onClick={forgotPassword}>
                  Forgot password?
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
