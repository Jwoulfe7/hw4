// The house crest: a navy shield, rope-stitched, with a script "Y" and a ribbon reading "Bulldog Blue".
export default function Crest({ size = 46 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 100 115" role="img" aria-label="Yale Bulldog Blue crest" className="crest">
      <path d="M50 4 L92 16 V52 C92 80 72 98 50 108 C28 98 8 80 8 52 V16 Z" fill="#14213d" stroke="#c9a66b" strokeWidth="4" />
      <path d="M50 12 L84 22 V52 C84 75 67 90 50 99 C33 90 16 75 16 52 V22 Z" fill="none" stroke="#c9a66b" strokeWidth="1.2" strokeDasharray="3 2.5" />
      <text x="50" y="68" textAnchor="middle" fontFamily="'Pinyon Script', cursive" fontSize="54" fill="#f5efe2">Y</text>
      <g transform="translate(0 2)">
        <path d="M14 78 H86 L80 86 L86 94 H14 L20 86 Z" fill="#b23a2e" />
        <text x="50" y="89.5" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize="8.5" letterSpacing="1.6" fill="#fff">BULLDOG BLUE</text>
      </g>
      <text x="50" y="30" textAnchor="middle" fill="#c9a66b" fontSize="9">★</text>
    </svg>
  )
}
