import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

export default function AuthCallback({ onNavigate }) {
  useEffect(() => {
    supabase.auth
      .exchangeCodeForSession(window.location.search)
      .then(({ error }) => {
        if (error) {
          onNavigate('login', null, 'Sign in link expired or already used. Please request a new one.')
        } else {
          onNavigate('home')
        }
      })
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#0d1018' }}>
      <Logo size="md" />
      <p
        className="text-gray-300 animate-pulse"
        style={{ fontFamily: 'var(--font-pixel-ui)' }}
      >
        Signing you in…
      </p>
    </div>
  )
}
