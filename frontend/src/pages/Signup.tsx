import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Crest from '../components/Crest'
import { useAuth, type SignupInput } from '../auth'

const MIN_PASSWORD = 8

const MEMBER_NO = 'Member No. pending'

export default function Signup() {
  const { user, signup } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState<SignupInput>({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm_password: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (user && !submitting) return <Navigate to={from} replace />

  const update = (field: keyof SignupInput) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value })

  const mismatch = form.confirm_password.length > 0 && form.password !== form.confirm_password
  const tooShort = form.password.length > 0 && form.password.length < MIN_PASSWORD

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (form.password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters.`)
    if (form.password !== form.confirm_password) return setError("Those passwords don't match.")

    setSubmitting(true)
    try {
      await signup(form)
      navigate(from, { replace: true })
    } catch (err) {
      setError((err as Error).message)
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
        <p className="kicker">Apply for membership</p>
        <h1>Create an account</h1>
        <p className="muted">No legacy needed. You don't even need an interview.</p>
        <form onSubmit={handleSubmit} className="form" noValidate>
          <div className="form-row">
            <label>
              First name
              <input autoComplete="given-name" required value={form.first_name} onChange={update('first_name')} />
            </label>
            <label>
              Last name
              <input autoComplete="family-name" required value={form.last_name} onChange={update('last_name')} />
            </label>
          </div>
          <label>
            Email
            <input type="email" autoComplete="email" required value={form.email} onChange={update('email')} />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="new-password"
              required
              value={form.password}
              onChange={update('password')}
              aria-invalid={tooShort}
            />
            <span className={tooShort ? 'field-hint field-hint-error' : 'field-hint'}>
              At least {MIN_PASSWORD} characters.
            </span>
          </label>
          <label>
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              required
              value={form.confirm_password}
              onChange={update('confirm_password')}
              aria-invalid={mismatch}
            />
            {mismatch && <span className="field-hint field-hint-error">Passwords don't match yet.</span>}
          </label>
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="btn"
            type="submit"
            disabled={submitting || !form.first_name || !form.last_name || !form.email || !form.password}
          >
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="muted">
          Already have one?{' '}
          <Link to="/login" state={{ from }}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
