import { Navigate } from 'react-router-dom'

// Legacy route kept so old bookmarked /verify links don't 404.
// With Supabase Auth (PKCE), the sign-in link redirects to the app root
// with ?code=..., which supabaseClient handles automatically — there is
// no manual verification step anymore.
export default function VerifyMagicLink() {
  return <Navigate to="/" replace />
}
