import { THREADS, type MonogramState, type Thread } from '../monogram'

// Classic three-letter monogram: first, LAST (larger, center), middle.
function arrange(raw: string): [string, string, string] | null {
  const letters = raw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)
  if (letters.length === 3) return [letters[0], letters[2], letters[1]]
  if (letters.length === 2) return [letters[0], letters[1], '']
  if (letters.length === 1) return ['', letters[0], '']
  return null
}

// "The Monogrammer": see your initials stitched on the garment. A preview for the imagination only.
export function MonogramOverlay({ letters, thread }: { letters: string; thread: Thread }) {
  const m = arrange(letters)
  if (!m) return null
  return (
    <span className={`monogram-overlay thread-${thread}`} aria-hidden="true">
      <span>{m[0]}</span>
      <span className="monogram-center">{m[1]}</span>
      <span>{m[2]}</span>
    </span>
  )
}

export default function MonogramControls({
  letters,
  setLetters,
  thread,
  setThread,
}: MonogramState) {
  return (
    <div className="monogrammer">
      <label className="monogrammer-field">
        <span className="monogrammer-label">The Monogrammer</span>
        <input
          value={letters}
          onChange={(e) => setLetters(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))}
          placeholder="Your initials, e.g. JEW"
          maxLength={3}
          aria-label="Your initials (up to three letters)"
        />
      </label>
      <div className="monogrammer-threads" role="radiogroup" aria-label="Thread color">
        {THREADS.map((t) => (
          <button
            key={t.key}
            role="radio"
            aria-checked={thread === t.key}
            className={`thread-swatch thread-${t.key}${thread === t.key ? ' active' : ''}`}
            onClick={() => setThread(t.key)}
            title={t.label}
          >
            <span className="sr-only">{t.label}</span>
          </button>
        ))}
      </div>
      <p className="monogrammer-note">A preview for the imagination. Monogramming isn't offered online; ask the shop about custom pieces.</p>
    </div>
  )
}
