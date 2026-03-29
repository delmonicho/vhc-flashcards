import { useState } from 'react'
import Logo from '../components/Logo'
import { signInWithMagicLink } from '../lib/auth'

export default function Login({ onNavigate, loginError }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(loginError || null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const { error: err } = await signInWithMagicLink(email.trim())
    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ background: '#0d1018' }}>
      {/* Logo + branding */}
      <div className="flex flex-col items-center mb-8">
        <Logo size="lg" />
        <h1
          className="mt-4 text-4xl"
          style={{ fontFamily: 'var(--font-pixel-ui)', color: '#E8526A' }}
        >
          Cô Ơi
        </h1>
        <p className="mt-1 text-sm text-gray-400">your Vietnamese class companion</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-xl">
        {sent ? (
          /* Success state */
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
                Check your email
              </p>
              <p className="mt-1 text-sm text-gray-400">
                We sent a magic link to <span className="text-gray-200">{email}</span>. Click it to sign in.
              </p>
            </div>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              className="text-sm text-gray-400 hover:text-gray-200 underline underline-offset-2 transition-colors cursor-pointer"
            >
              Use a different email
            </button>
          </div>
        ) : (
          /* Form state */
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <p
                className="text-xl text-gray-100 mb-1"
                style={{ fontFamily: 'var(--font-pixel-ui)' }}
              >
                Sign in
              </p>
              <p className="text-sm text-gray-400">
                We'll send a magic link to your email — no password needed.
              </p>
            </div>

            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8526A] focus:border-transparent disabled:opacity-50 transition-shadow"
              style={{ minHeight: '48px' }}
            />

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full rounded-xl py-3 text-white font-semibold disabled:opacity-50 hover:enabled:opacity-90 active:enabled:scale-95 transition-all cursor-pointer disabled:cursor-default"
              style={{ background: '#E8526A', fontFamily: 'var(--font-pixel-ui)' }}
            >
              {loading ? 'Sending…' : 'Send magic link →'}
            </button>
          </form>
        )}
      </div>

      {/* Footer */}
      <button
        onClick={() => onNavigate('privacy')}
        className="mt-6 text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
        style={{ fontFamily: 'var(--font-pixel-ui)' }}
      >
        Privacy Policy
      </button>
    </div>
  )
}
