import { useState } from 'react'
import { requestMagicLink } from '../api'
import bloomreachLogo from '../assets/bloomreach-logo.png'

export default function Login() {
  const [error, setError] = useState(null)
  const [email, setEmail] = useState('')
  const [magicSent, setMagicSent] = useState(false)
  const [magicLoading, setMagicLoading] = useState(false)

  async function handleMagicLink(e) {
    e.preventDefault()
    setMagicLoading(true)
    setError(null)
    try {
      const res = await requestMagicLink(email)
      if (res.error) {
        setError(res.error)
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
            Enter your email and we&rsquo;ll send you a sign-in link
          </p>

          {error && (
            <div className="text-sm rounded-lg px-4 py-3 mb-6 text-left" style={{ background: 'var(--rust-bg)', border: '1px solid var(--rust)', color: 'var(--rust)' }}>
              {error}
            </div>
          )}

          {magicSent ? (
            <div className="text-sm rounded-lg px-4 py-3 text-left" style={{ background: 'var(--moss-bg)', border: '1px solid var(--moss)', color: 'var(--moss)' }}>
              Check your email — we sent a sign-in link to <strong>{email}</strong>.
              Open it on this device to finish signing in.
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-3 text-left">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ border: '1px solid var(--hairline)' }}
              />
              <button
                type="submit"
                disabled={magicLoading}
                className="w-full disabled:opacity-50 text-sm font-medium py-2.5 rounded-lg transition-colors"
                style={{ background: 'var(--ink)', color: '#fff' }}
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
