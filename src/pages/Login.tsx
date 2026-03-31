import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { LogIn, UserPlus, Loader2, AlertCircle } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setMessage('Check your email for a confirmation link.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      }
    }

    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div
        className="w-full max-w-sm rounded-lg border p-6"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
      >
        <div className="text-center mb-6">
          <div
            className="text-sm font-bold tracking-wide mb-1"
            style={{ color: 'var(--text-primary)' }}
          >
            TICKET TRADING
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            AI Suite
          </div>
        </div>

        <h2
          className="text-lg font-semibold mb-4 text-center"
          style={{ color: 'var(--text-primary)' }}
        >
          {isSignUp ? 'Create Account' : 'Sign In'}
        </h2>

        {error && (
          <div
            className="flex items-center gap-2 rounded px-3 py-2 mb-4 text-sm"
            style={{ background: 'var(--sell-bg)', color: 'var(--sell-text)' }}
          >
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {message && (
          <div
            className="flex items-center gap-2 rounded px-3 py-2 mb-4 text-sm"
            style={{ background: 'var(--buy-bg)', color: 'var(--buy-text)' }}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label
              className="block text-xs font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded border px-3 py-2 text-sm outline-none focus:ring-1"
              style={{
                background: 'var(--bg-primary)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
              }}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              className="block text-xs font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded border px-3 py-2 text-sm outline-none focus:ring-1"
              style={{
                background: 'var(--bg-primary)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
              }}
              placeholder="Min 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded py-2.5 text-sm font-medium transition-colors"
            style={{
              background: 'var(--accent-green)',
              color: '#000',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isSignUp ? (
              <UserPlus size={16} />
            ) : (
              <LogIn size={16} />
            )}
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <button
          onClick={() => {
            setIsSignUp(!isSignUp)
            setError(null)
            setMessage(null)
          }}
          className="w-full text-center text-xs mt-4 hover:underline"
          style={{ color: 'var(--text-muted)' }}
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  )
}
