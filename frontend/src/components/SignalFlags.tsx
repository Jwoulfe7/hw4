import type { ReactNode } from 'react'

// "YALE" in International Code of Signals flags, because a nautical shop signs its name properly.
const FLAGS: Record<string, { label: string; svg: ReactNode }> = {
  Y: {
    label: 'Yankee',
    svg: (
      <>
        <defs>
          <pattern id="flag-y" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="10" fill="#e8b923" />
            <rect x="5" width="5" height="10" fill="#b23a2e" />
          </pattern>
        </defs>
        <rect width="48" height="32" fill="url(#flag-y)" />
      </>
    ),
  },
  A: {
    label: 'Alfa',
    svg: (
      <>
        <rect width="20" height="32" fill="#fff" />
        <path d="M20 0 H48 L36 16 L48 32 H20 Z" fill="#1f4e9c" />
      </>
    ),
  },
  L: {
    label: 'Lima',
    svg: (
      <>
        <rect width="24" height="16" fill="#e8b923" />
        <rect x="24" width="24" height="16" fill="#111" />
        <rect y="16" width="24" height="16" fill="#111" />
        <rect x="24" y="16" width="24" height="16" fill="#e8b923" />
      </>
    ),
  },
  E: {
    label: 'Echo',
    svg: (
      <>
        <rect width="48" height="16" fill="#1f4e9c" />
        <rect y="16" width="48" height="16" fill="#b23a2e" />
      </>
    ),
  },
}

export default function SignalFlags({ word = 'YALE' }: { word?: string }) {
  return (
    <div className="signal-flags" role="img" aria-label={`${word} in maritime signal flags`}>
      <span className="signal-halyard" aria-hidden="true" />
      {word.split('').map((letter, i) => (
        <figure key={i} className="signal-flag" style={{ animationDelay: `${i * 0.35}s` }}>
          <svg viewBox="0 0 48 32" width="48" height="32" aria-hidden="true">
            {FLAGS[letter].svg}
            <rect width="48" height="32" fill="none" stroke="rgba(0,0,0,0.25)" />
          </svg>
          <figcaption>
            <strong>{letter}</strong> {FLAGS[letter].label}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
