import { Link } from 'react-router-dom'
import { openValet } from '../valet'

// Lost at sea: the 404, with a compass rose pointing home.
export default function NotFound() {
  return (
    <div className="page lost-at-sea">
      <svg className="compass" viewBox="0 0 200 200" width="180" height="180" aria-hidden="true">
        <circle cx="100" cy="100" r="92" fill="none" stroke="#c9a66b" strokeWidth="3" />
        <circle cx="100" cy="100" r="80" fill="none" stroke="#c9a66b" strokeWidth="1" strokeDasharray="2 4" />
        <g className="compass-needle">
          <path d="M100 18 L112 100 L100 182 L88 100 Z" fill="#14213d" />
          <path d="M100 18 L112 100 L88 100 Z" fill="#b23a2e" />
          <path d="M18 100 L100 90 L182 100 L100 110 Z" fill="#14213d" opacity="0.55" />
        </g>
        <circle cx="100" cy="100" r="7" fill="#c9a66b" />
        <text x="100" y="12" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize="12" fill="#b23a2e">N</text>
      </svg>
      <p className="kicker">Error 404</p>
      <h1>Lost at sea.</h1>
      <p className="lede">This page has drifted off the chart. Perhaps it's at the Harvard Coop.</p>
      <div className="hero-actions">
        <Link to="/" className="btn">
          Return to port
        </Link>
        <button className="btn btn-outline" onClick={openValet}>
          Summon the Valet
        </button>
      </div>
    </div>
  )
}
