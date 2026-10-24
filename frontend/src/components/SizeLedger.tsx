import { SIZES, setMySize, useMySize } from '../prefs'

// "The Tailor's Ledger": pick your size once; the shop remembers it on this device.
export default function SizeLedger({ compact = false }: { compact?: boolean }) {
  const mySize = useMySize()
  return (
    <div className={compact ? 'ledger compact' : 'ledger'} role="group" aria-label="Your size on file">
      <span className="ledger-label">
        <em>The Tailor's Ledger</em>
        {compact ? (mySize ? 'Your size, on file' : 'Put your size on file') : 'Your size, on file'}
      </span>
      <span className="ledger-sizes">
        {SIZES.map((s) => (
          <button
            key={s}
            className={s === mySize ? 'ledger-size active' : 'ledger-size'}
            aria-pressed={s === mySize}
            onClick={() => setMySize(s === mySize ? null : s)}
            title={s === mySize ? 'Remove from the ledger' : `Put ${s} on file`}
          >
            {s}
          </button>
        ))}
      </span>
    </div>
  )
}
