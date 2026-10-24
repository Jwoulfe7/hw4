import type { Category } from '../api'

// "How to wear it, per the Handbook": one firm opinion per kind of garment.
const ADVICE: Record<Category, { rule: string; detail: string }> = {
  'T-Shirts': {
    rule: 'Under an open oxford, or alone after Labor Day',
    detail: 'Never tucked, never ironed. A tee looks best on its third wash and its fourth year.',
  },
  Crewnecks: {
    rule: 'Over a button-down, collar out',
    detail: 'Collar points over the neckline, cuffs pushed up once. Wear it with khakis and loafers, no socks, whatever the weather.',
  },
  Hoodies: {
    rule: 'Strictly for reading period and the walk to the gym',
    detail: 'Hood down indoors. A hoodie under a blazer is a statement; make sure you mean it.',
  },
  'Quarter-Zips': {
    rule: 'Zipped to the sternum, not the chin',
    detail: 'The quarter-zip is a blazer for people who own a boat. Pair it with a gingham shirt and a firm handshake.',
  },
  'Jackets & Full-Zips': {
    rule: 'Over everything, from September to May',
    detail: 'Fleece belongs on the deck and on the walk to Sterling. Leave it unzipped so the crest underneath gets seen.',
  },
  'Long Sleeves': {
    rule: 'For practice, the erg, and early crew',
    detail: 'Performance fabric is for performing. Change before brunch.',
  },
}

export default function HowToWear({ category }: { category: Category }) {
  const advice = ADVICE[category]
  return (
    <aside className="how-to-wear" aria-label="How to wear it, per the Handbook">
      <span className="tack" aria-hidden="true" />
      <p className="how-to-wear-kicker">How to wear it, per the Handbook</p>
      <p className="how-to-wear-rule">{advice.rule}.</p>
      <p className="how-to-wear-detail">{advice.detail}</p>
    </aside>
  )
}
