import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { signInWithPassword, requestPasswordReset, signUp } from '../api'
import bloomreachLogo from '../assets/bloomreach-logo.png'

const SIGNUP_STEPS = [
  ['Tell us who you are', 'Your name, work email and the partner you’re with.'],
  ['Confirm your email', 'We’ll send a link to make sure it’s really you.'],
  ['We approve your access', 'Bloomreach links you to your partner’s implementations so you can get started.'],
]

const EMPTY_FORM = { firstName: '', lastName: '', email: '', partner: '', jobTitle: '', password: '', confirm: '' }

export default function Login() {
  const [mode, setMode] = useState('password') // 'password' | 'signup'
  const location = useLocation()
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))
  const isSignup = mode === 'signup'

  function switchMode(next) {
    setMode(next)
    setError(null)
    setNotice(null)
    setForm(f => ({ ...EMPTY_FORM, email: f.email }))
  }

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (isSignup) {
      if (form.password.length < 8) return setError('Password must be at least 8 characters.')
      if (form.password !== form.confirm) return setError('Passwords don’t match.')
    }

    setLoading(true)
    try {
      if (!isSignup) {
        const res = await signInWithPassword(form.email, form.password)
        if (res.error) {
          setError(res.error === 'Invalid login credentials'
            ? 'Incorrect email or password. If you haven’t set a password yet, use “Forgot password?” to choose one.'
            : res.error)
        }
        // On success the auth listener in App.jsx takes over.
      } else {
        const res = await signUp(form.email, form.password, {
          firstName: form.firstName,
          lastName: form.lastName,
          partnerName: form.partner,
          jobTitle: form.jobTitle,
        })
        if (res.error) setError(res.error)
        else if (res.needsConfirmation) setNotice({
          title: `Thanks, ${form.firstName.trim()} — check your inbox`,
          body: `We’ve sent a confirmation link to ${form.email.trim()}. Open it, then sign in. We’ll approve your access to your partner’s implementations shortly after.`,
        })
        // If confirmation is disabled the auth listener signs them straight in.
      }
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  async function forgotPassword() {
    if (!form.email) { setError('Enter your email above first, then click “Forgot password?” again.'); return }
    setError(null)
    const res = await requestPasswordReset(form.email)
    if (res.error) setError(res.error)
    else setNotice({ title: 'Check your email', body: `We sent a password reset link to ${form.email}. Open it on this device, then choose a new password.` })
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand, with a faint tick texture echoing the rollout rail */}
      <div className="hidden lg:flex lg:w-[44%] relative flex-col justify-between p-12 tick-texture" style={{ backgroundColor: 'var(--gold)' }}>
        <img src={bloomreachLogo} alt="Bloomreach" className="h-12 self-start" />

        <div className="max-w-md">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-black/60 mb-4">Partner Implementation Portal</p>
          <h2 className="font-display text-[40px] leading-[1.08] font-semibold text-black" style={{ textWrap: 'balance' }}>
            {isSignup ? 'Every implementation, one shared view.' : 'Welcome back.'}
          </h2>
          <p className="text-[15px] leading-relaxed text-black/70 mt-4">
            Track rollout progress, usage against contract, QA and RAID items with your Bloomreach team — all in one place.
          </p>

          {isSignup && (
            <ol className="mt-10 space-y-5">
              {SIGNUP_STEPS.map(([title, body], i) => (
                <li key={title} className="flex gap-4">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-black text-[13px] font-semibold flex items-center justify-center" style={{ color: 'var(--gold)' }}>
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-black">{title}</div>
                    <div className="text-sm text-black/65 mt-0.5">{body}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <p className="text-xs text-black/50">Access is approved by Bloomreach Partner Success.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:p-8" style={{ background: 'var(--paper)' }}>
        <div className={`w-full ${isSignup ? 'max-w-md' : 'max-w-sm'}`}>
          {/* Mobile logo */}
          <img src={bloomreachLogo} alt="Bloomreach" className="h-9 mb-8 lg:hidden" />

          <h1 className="font-display text-3xl font-semibold" style={{ color: 'var(--ink)' }}>
            {isSignup ? 'Request access' : 'Sign in'}
          </h1>
          <p className="text-sm mt-1.5 mb-7" style={{ color: 'var(--muted)' }}>
            {isSignup ? 'Takes a minute. We’ll link you to your partner’s implementations once approved.' : 'Enter your email and password.'}
          </p>

          {!error && location.state?.inviteError && (
            // App.jsx lands here when an Invite email link fails (expired or
            // already used). Read per render: Login is often already mounted.
            <div className="text-sm rounded-lg px-4 py-3 mb-6 text-left" style={{ background: 'var(--rust-bg)', border: '1px solid var(--rust)', color: 'var(--rust)' }}>
              That invite link has expired or was already used. If you set a password, sign in below — otherwise use “Forgot password?” to get a fresh link.
            </div>
          )}
          {error && (
            <div role="alert" className="text-sm rounded-lg px-4 py-3 mb-5" style={{ background: 'var(--rust-bg)', border: '1px solid var(--rust)', color: 'var(--rust)' }}>
              {error}
            </div>
          )}

          {notice ? (
            <div className="rounded-xl px-5 py-4" style={{ background: 'var(--moss-bg)', border: '1px solid var(--moss)' }}>
              <div className="text-sm font-semibold" style={{ color: 'var(--moss)' }}>{notice.title}</div>
              <p className="text-sm mt-1" style={{ color: 'var(--moss)' }}>{notice.body}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {isSignup && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="First name">
                    <input required autoComplete="given-name" value={form.firstName} onChange={set('firstName')} className={INPUT} style={INPUT_STYLE} />
                  </Field>
                  <Field label="Last name">
                    <input required autoComplete="family-name" value={form.lastName} onChange={set('lastName')} className={INPUT} style={INPUT_STYLE} />
                  </Field>
                </div>
              )}

              <Field label={isSignup ? 'Work email' : 'Email'}>
                <input type="email" required autoComplete="email" value={form.email} onChange={set('email')} placeholder="you@company.com" className={INPUT} style={INPUT_STYLE} />
              </Field>

              {isSignup && (
                <>
                  <Field label="Partner" hint="The agency or consultancy you work for.">
                    <input required autoComplete="organization" value={form.partner} onChange={set('partner')} placeholder="e.g. Acme Digital" className={INPUT} style={INPUT_STYLE} />
                  </Field>
                  <Field label="Job title" optional>
                    <input autoComplete="organization-title" value={form.jobTitle} onChange={set('jobTitle')} placeholder="e.g. Technical Lead" className={INPUT} style={INPUT_STYLE} />
                  </Field>
                </>
              )}

              <Field label={isSignup ? 'Choose a password' : 'Password'} hint={isSignup ? 'At least 8 characters.' : null}>
                <input type="password" required autoComplete={isSignup ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')} className={INPUT} style={INPUT_STYLE} />
              </Field>
              {isSignup && (
                <Field label="Confirm password">
                  <input type="password" required autoComplete="new-password" value={form.confirm} onChange={set('confirm')} className={INPUT} style={INPUT_STYLE} />
                </Field>
              )}

              <button
                type="submit"
                disabled={loading}
                className="pressable w-full disabled:opacity-50 text-sm font-semibold py-3 rounded-lg transition-opacity hover:opacity-90 mt-2"
                style={isSignup ? { background: 'var(--gold)', color: '#000' } : { background: 'var(--ink)', color: '#fff' }}
              >
                {loading ? 'Working…' : isSignup ? 'Request access' : 'Sign in'}
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 text-sm flex flex-wrap items-center justify-between gap-2" style={{ borderTop: '1px solid var(--hairline)' }}>
            {isSignup ? (
              <>
                <span style={{ color: 'var(--muted)' }}>Already have an account?</span>
                <button type="button" className="font-semibold underline underline-offset-2" style={{ color: 'var(--ink)' }} onClick={() => switchMode('password')}>
                  Sign in
                </button>
              </>
            ) : (
              <>
                {!notice
                  ? <button type="button" className="underline underline-offset-2" style={{ color: 'var(--muted)' }} onClick={forgotPassword}>Forgot password?</button>
                  : <span />}
                <button type="button" className="font-semibold underline underline-offset-2" style={{ color: 'var(--ink)' }} onClick={() => switchMode('signup')}>
                  New here? Request access
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const INPUT = 'w-full rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--gold)] focus:border-transparent'
const INPUT_STYLE = { border: '1px solid var(--hairline)', color: 'var(--ink)' }

function Field({ label, hint, optional, children }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between mb-1.5">
        <span className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{label}</span>
        {optional && <span className="text-xs" style={{ color: 'var(--muted)' }}>Optional</span>}
      </span>
      {children}
      {hint && <span className="block text-xs mt-1" style={{ color: 'var(--muted)' }}>{hint}</span>}
    </label>
  )
}
