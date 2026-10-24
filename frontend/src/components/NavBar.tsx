import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { openValet } from '../valet'
import Crest from './Crest'

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/products', label: 'Products', end: false },
  { to: '/about', label: 'About Us', end: false },
]

// The ticker: house rules and true facts only. No invented sales.
const TICKER = [
  'Officially licensed Yale merchandise',
  'Navy is a neutral',
  'New Haven, Connecticut',
  'Returns within 30 days, tags on',
  'Press / to summon the Valet',
  'A crewneck is never "just a sweatshirt"',
  'The Bulldog answers questions at any hour',
  'Wear your residential college. Forever.',
]

const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'nav-link active' : 'nav-link')

const initials = (first: string, last: string) => `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()

export default function NavBar() {
  const { user, ready, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // After logging in, come back to the page you were on (not the auth pages themselves).
  const onAuthPage = location.pathname === '/login' || location.pathname === '/signup'
  const returnState = onAuthPage ? location.state : { from: location.pathname + location.search }

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <header className="site-header">
      <div className="ticker" aria-label="House notes">
        <div className="ticker-track">
          {[0, 1].map((copy) => (
            <span key={copy} className="ticker-run" aria-hidden={copy === 1}>
              {TICKER.map((t) => (
                <span key={t} className="ticker-item">
                  <span className="ticker-star">★</span> {t}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
      <nav className="nav">
        <Link to="/" className="brand" aria-label="Yale Bulldog Blue home">
          <Crest size={40} />
          <span className="brand-words">
            <span className="brand-name">Yale Bulldog Blue</span>
            <span className="brand-sub">by Campus Customs · New Haven</span>
          </span>
        </Link>
        <ul className="nav-links">
          {LINKS.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} end={l.end} className={navClass}>
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <button className="valet-btn" onClick={openValet} aria-label="Summon the Valet (search, Command K)">
          <span className="valet-btn-label">Summon the Valet</span>
          <kbd>⌘K</kbd>
        </button>
        <div className={ready ? 'nav-account' : 'nav-account nav-account-pending'}>
          {user ? (
            <>
              <span className="nav-member" title={`Member: ${user.first_name} ${user.last_name}`}>
                <span className="monogram-roundel" aria-hidden="true">
                  {initials(user.first_name, user.last_name)}
                </span>
                <span className="nav-greeting">
                  Ahoy, <strong>{user.first_name}</strong>
                </span>
              </span>
              <button className="btn btn-small btn-outline" onClick={handleLogout}>
                Log Out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" state={returnState} className={navClass}>
                Log In
              </NavLink>
              <NavLink to="/signup" state={returnState} className="btn btn-small">
                Create Account
              </NavLink>
            </>
          )}
        </div>
      </nav>
      <div className="rope" aria-hidden="true" />
    </header>
  )
}
