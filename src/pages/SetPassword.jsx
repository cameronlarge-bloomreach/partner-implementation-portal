import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { updatePassword } from '../api'
import bloomreachLogo from '../assets/bloomreach-logo.png'

// Reached two ways: directly at #/set-password while signed in, or via the
// "Forgot password?" recovery email (App.jsx routes here on PASSWORD_RECOVERY).
export default function SetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  async function submit(e) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords don’t match.'); return }
    setSaving(true)
    const res = await updatePassword(password)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: 'var(--paper)' }}>
      <div className="w-full max-w-sm text-center">
        <img src={bloomreachLogo} alt="Bloomreach" className="h-10 mx-auto mb-8" />
        <h1 className="font-display text-3xl font-semibold mb-1" style={{ color: 'var(--ink)' }}>Set your password</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
          You’ll be able to sign in with it from now on — email links keep working too
        </p>

        {error && (
          <div className="text-sm rounded-lg px-4 py-3 mb-6 text-left" style={{ background: 'var(--rust-bg)', border: '1px solid var(--rust)', color: 'var(--rust)' }}>
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3 text-left">
          <input
            type="password"
            required
            autoFocus
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="New password (min 8 characters)"
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{ border: '1px solid var(--hairline)' }}
          />
          <input
            type="password"
            required
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Repeat new password"
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{ border: '1px solid var(--hairline)' }}
          />
          <button
            type="submit"
            disabled={saving}
            className="w-full disabled:opacity-50 text-sm font-medium py-2.5 rounded-lg transition-colors"
            style={{ background: 'var(--ink)', color: '#fff' }}
          >
            {saving ? 'Saving…' : 'Save password'}
          </button>
        </form>
      </div>
    </div>
  )
}
