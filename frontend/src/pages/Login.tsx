import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Crest from '../components/Crest'
import { useAuth } from '../auth'

const MEMBER_NO = 'Member No. ••• ••'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Send people back where they came from (e.g. a product page), or home.
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (user && !submitting) return <Navigate to={from} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError((err as Error).message)
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page auth">
      <div className="auth-card member-card">
        <div className="member-band" aria-hidden="true">
          <Crest size={34} />
          <span className="member-band-club">The Bulldog Blue Club</span>
          <span className="member-band-no">{MEMBER_NO}</span>
        </div>
        <p className="kicker">Members, welcome back</p>
        <h1>Log in</h1>
        <form onSubmit={handleSubmit} className="form" noValidate>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn" type="submit" disabled={submitting || !email || !password}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="muted">
          New here?{' '}
          <Link to="/signup" state={{ from }}>
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
