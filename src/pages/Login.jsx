import { useState } from 'react'
import Logo from '../components/Logo'
import { signInWithMagicLink, signInWithGoogle, signInWithPassword, signUpWithPassword } from '../lib/auth'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

export default function Login({ onNavigate, loginError }) {
  // mode: 'signin' | 'signup' | 'magic-link'
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(loginError || null)
  const [successMsg, setSuccessMsg] = useState(null)

  function switchMode(newMode) {
    setError(null)
    setPassword('')
    setMode(newMode)
  }

  async function handleGoogleSignIn() {
    setLoading(true)
    setError(null)
    const { error: err } = await signInWithGoogle()
    setLoading(false)
    if (err) setError(err.message)
    // On success the browser navigates away — no further state update needed
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError(null)
    if (mode === 'signup') {
      const { error: err } = await signUpWithPassword(email.trim(), password)
      setLoading(false)
      if (err) {
        setError(err.message)
      } else {
        setSuccessMsg({ title: 'Check your email', body: 'We sent a confirmation link to' })
      }
    } else {
      const { error: err } = await signInWithPassword(email.trim(), password)
      setLoading(false)
      if (err) setError(err.message)
    }
  }

  async function handleMagicLink(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const { error: err } = await signInWithMagicLink(email.trim())
    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setSuccessMsg({ title: 'Check your email', body: 'We sent a magic link to' })
    }
  }

  const branding = (
    <div className="flex flex-col items-center mb-8">
      <Logo size="lg" />
      <h1 className="mt-4 text-4xl" style={{ fontFamily: 'var(--font-pixel-ui)', color: 'var(--color-co-primary)' }}>
        LearnLang
      </h1>
      <p className="mt-1 text-sm text-gray-400">your daily language companion</p>
    </div>
  )

  const footer = (
    <button
      onClick={() => onNavigate('privacy')}
      className="mt-6 text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
      style={{ fontFamily: 'var(--font-pixel-ui)' }}
    >
      Privacy Policy
    </button>
  )

  if (successMsg) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ background: '#0d1018' }}>
        {branding}
        <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-xl">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className="w-7 h-7" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-100 text-lg" style={{ fontFamily: 'var(--font-pixel-ui)' }}>
                {successMsg.title}
              </p>
              <p className="mt-1 text-sm text-gray-400">
                {successMsg.body} <span className="text-gray-200">{email}</span>.
              </p>
            </div>
            <button
              onClick={() => { setSuccessMsg(null); setPassword('') }}
              className="text-sm text-gray-400 hover:text-gray-200 underline underline-offset-2 transition-colors cursor-pointer"
            >
              Use a different email
            </button>
          </div>
        </div>
        {footer}
      </div>
    )
  }

  const isMagicLink = mode === 'magic-link'
  const isSignup = mode === 'signup'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ background: '#0d1018' }}>
      {branding}

      <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-xl flex flex-col gap-4">
        {/* Google OAuth */}
        {!isMagicLink && (
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-gray-600 bg-white py-3 text-gray-800 font-semibold text-sm hover:enabled:bg-gray-50 active:enabled:scale-95 disabled:opacity-50 transition-all cursor-pointer disabled:cursor-default"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        )}

        {/* Divider */}
        {!isMagicLink && (
          <div className="flex items-center gap-3">
            <hr className="flex-1 border-gray-700" />
            <span className="text-xs text-gray-500">or</span>
            <hr className="flex-1 border-gray-700" />
          </div>
        )}

        {/* Email / password form */}
        <form onSubmit={isMagicLink ? handleMagicLink : handlePasswordSubmit} className="flex flex-col gap-3">
          <div>
            <p className="text-xl text-gray-100 mb-1" style={{ fontFamily: 'var(--font-pixel-ui)' }}>
              {isSignup ? 'Create account' : isMagicLink ? 'Forgot password' : 'Sign in'}
            </p>
            {isMagicLink && (
              <p className="text-sm text-gray-400">We'll email you a sign-in link.</p>
            )}
          </div>

          <input
            type="email"
            required
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={loading}
            className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FF6B47] focus:border-transparent disabled:opacity-50 transition-shadow"
            style={{ minHeight: '48px' }}
          />

          {!isMagicLink && (
            <input
              type="password"
              required
              placeholder="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FF6B47] focus:border-transparent disabled:opacity-50 transition-shadow"
              style={{ minHeight: '48px' }}
            />
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !email.trim() || (!isMagicLink && !password)}
            className="w-full rounded-xl py-3 text-white font-semibold disabled:opacity-50 hover:enabled:opacity-90 active:enabled:scale-95 transition-all cursor-pointer disabled:cursor-default"
            style={{ background: 'var(--color-co-primary)', fontFamily: 'var(--font-pixel-ui)' }}
          >
            {loading
              ? '…'
              : isMagicLink
              ? 'Send magic link →'
              : isSignup
              ? 'Create account →'
              : 'Sign in →'}
          </button>
        </form>

        {/* Mode-switcher links */}
        <div className="flex flex-col items-center gap-1 text-sm text-gray-400">
          {mode === 'signin' && (
            <>
              <button
                onClick={() => switchMode('signup')}
                className="hover:text-gray-200 transition-colors cursor-pointer"
              >
                Don't have an account?{' '}
                <span className="text-gray-200 underline underline-offset-2">Sign up</span>
              </button>
              <button
                onClick={() => switchMode('magic-link')}
                className="hover:text-gray-200 transition-colors cursor-pointer"
              >
                Forgot password?{' '}
                <span className="text-gray-200 underline underline-offset-2">Send magic link</span>
              </button>
            </>
          )}
          {mode === 'signup' && (
            <button
              onClick={() => switchMode('signin')}
              className="hover:text-gray-200 transition-colors cursor-pointer"
            >
              Already have an account?{' '}
              <span className="text-gray-200 underline underline-offset-2">Sign in</span>
            </button>
          )}
          {mode === 'magic-link' && (
            <button
              onClick={() => switchMode('signin')}
              className="hover:text-gray-200 transition-colors cursor-pointer"
            >
              ← Back to sign in
            </button>
          )}
        </div>
      </div>

      {footer}
    </div>
  )
}
