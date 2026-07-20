import { createClient } from '@supabase/supabase-js'

// The URL and anon key are public by design (they ship in the client bundle;
// row-level security is what protects the data). Env vars override for dev.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cibfhxjnfvdyjupgkbdl.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpYmZoeGpuZnZkeWp1cGdrYmRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNjk0MDgsImV4cCI6MjA5OTg0NTQwOH0.XmKYbt1ft0A7tMagjQV5a7GfHPp3CU7uTBvXaT9S-bM'

// PKCE flow: the magic-link email redirects back with ?code=... in the
// query string (not #access_token in the hash), which is required here
// because the app uses HashRouter — hash tokens would fight the router.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
  },
})
