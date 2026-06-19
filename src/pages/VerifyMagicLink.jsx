import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { verifyMagicLink, getMyImplementations } from '../api'

export default function VerifyMagicLink({ onLogin }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    const email = params.get('email')
    const token = params.get('token')

    if (!email || !token) {
      setError('This sign-in link is invalid.')
      return
    }

    verifyMagicLink(email, token)
      .then(async data => {
        if (data.error || !data.sessionToken) {
          setError('This link is invalid or has expired. Please request a new one.')
          return
        }
        const info = await getMyImplementations(data.sessionToken)
        if (info.error) {
          setError('This link is invalid or has expired. Please request a new one.')
          return
        }
        onLogin(data.sessionToken, {
          email: data.email,
          name: data.email,
          isAdmin: info.isAdmin,
          implementations: info.implementations,
        })
        navigate('/', { replace: true })
      })
      .catch(() => setError('Something went wrong. Please try again.'))
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-sm px-6">
        {error ? (
          <>
            <p className="text-red-600 text-sm mb-4">{error}</p>
            <a href="#/login" className="text-sm text-[#019ACE] hover:text-[#017aaa] font-medium">
              Back to sign in
            </a>
          </>
        ) : (
          <p className="text-slate-500 text-sm">Signing you in…</p>
        )}
      </div>
    </div>
  )
}
