import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchProducts, formatPrice, peekProducts, type Product } from '../api'
import { openChat, type ChatProduct } from '../chat'
import Belt from '../components/Belt'
import Crest from '../components/Crest'
import ProductCard from '../components/ProductCard'
import { showResults } from '../showcase'
import { UNIFORMS, type Uniform } from '../uniforms'

const FEATURED_IDS = [
  'super-heavyweight-crewneck-arched-yale-crest',
  'basic-hoodie-big-yale',
  'saybrook-college-crewneck',
  '2025-yale-vs-harvard-t-shirt',
]

const RULES = [
  'Navy goes with everything. So does more navy.',
  'A crewneck is not "a sweatshirt." It is a crewneck, and it will outlast your thesis.',
  'Wear your residential college. Loyalty was assigned to you at random, and it is still forever.',
  'Buy it a little roomy. It should look borrowed, ideally from someone who rowed.',
  'Only mention the score of The Game if Yale won. In that case, mention it often.',
  'Every relative gets a sweatshirt. A Yale Mom should be recognizable from across the Old Campus.',
]

const PENNANTS = [
  { collection: 'colleges', felt: 'navy', title: 'Colleges', label: 'Residential Colleges', note: 'There are fourteen of them, and yours is the best. Everybody agrees, quietly.' },
  { collection: 'varsity', felt: 'red', title: 'Varsity', label: 'Varsity Athletics', note: 'For athletes, and for the people who stand in the cold in New Haven cheering for them.' },
  { collection: 'family', felt: 'green', title: 'Family', label: 'For the Family', note: 'Mom, Dad, Grandpa, even Cousin. Pride runs in the family. So does the tuition bill.' },
  { collection: 'schools', felt: 'gold', title: 'Grad Schools', label: 'Graduate & Professional', note: 'Law, Medicine, Management, Art. An advanced degree calls for advanced fleece.' },
]

const byId = (all: Product[] | null) => new Map((all ?? []).map((p) => [p.product_id, p]))

function asCard(p: Product): ChatProduct {
  return {
    product_id: p.product_id,
    name: p.name,
    garment_type: p.garment_type,
    price: p.price,
    price_display: formatPrice(p.price),
    image_url: p.image_url,
    main_color: p.colors[0] ?? null,
    colors: p.colors,
    short_description: p.description.length > 110 ? `${p.description.slice(0, 107).replace(/\s+\S*$/, '')}…` : p.description,
    sizes_in_stock: p.sizes_in_stock,
    low_stock_sizes: [],
    sold_out: p.sizes_in_stock.length === 0,
  }
}

export default function Home() {
  const [catalogue, setCatalogue] = useState(() => byId(peekProducts()))

  useEffect(() => {
    // Also warms the catalogue cache, so Products opens instantly.
    fetchProducts().then((all) => setCatalogue(byId(all)), () => {})
  }, [])

  const featured = FEATURED_IDS.map((id) => catalogue.get(id)).filter((p): p is Product => !!p)

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <p className="kicker">Yale Bulldog Blue · by Campus Customs</p>
            <h1>Look as though your grandfather went here. Perhaps he did.</h1>
            <p className="lede">
              Officially licensed Yale apparel from New Haven, for students, alumni, and the relatives who come up
              for Parents' Weekend.
            </p>
            <div className="hero-actions">
              <Link to="/products" className="btn">
                Shop the Wardrobe
              </Link>
              <button className="btn btn-ghost" onClick={openChat}>
                Ask the Bulldog
              </button>
            </div>
          </div>
          <div className="hero-medallion" aria-hidden="true">
            <Crest size={150} />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <p className="kicker">Know your tribe</p>
          <h2>Shop by affiliation</h2>
        </div>
        <div className="pennants">
          {PENNANTS.map((p) => (
            <Link key={p.collection} to={`/products?collection=${p.collection}`} className={`pennant-tile felt-${p.felt}`}>
              <span className="pennant" aria-hidden="true">
                <span className="pennant-word">{p.title}</span>
              </span>
              <span className="pennant-title">{p.label}</span>
              <span className="pennant-note">{p.note}</span>
              <span className="pennant-link">Browse →</span>
            </Link>
          ))}
        </div>
      </section>

      <Belt variant="red" />

      <section className="section">
        <div className="section-head">
          <p className="kicker">Dressed for the occasion</p>
          <h2>The Uniforms</h2>
          <p className="lede">Four outfits the Handbook would approve of. Lay one out, then pick it up piece by piece.</p>
        </div>
        <div className="uniforms">
          {UNIFORMS.map((u) => (
            <UniformCard key={u.key} uniform={u} catalogue={catalogue} />
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="section">
          <div className="section-head">
            <p className="kicker">The essentials</p>
            <h2>What everyone on Cross Campus is wearing</h2>
          </div>
          <div className="grid">
            {featured.map((p) => (
              <ProductCard key={p.product_id} product={p} />
            ))}
          </div>
        </section>
      )}

      <section className="section rules">
        <article className="handbook-page" aria-label="The rules of dressing Bulldog">
          <header className="handbook-running">
            <span>The Bulldog Handbook</span>
            <span>Chapter IV</span>
          </header>
          <p className="handbook-chapter">Chapter the Fourth</p>
          <h2 className="handbook-title">On Dressing Bulldog</h2>
          <ol className="rules-list">
            {RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
          <p className="handbook-aside">
            Questions of etiquette, sizing, or stock?{' '}
            <button className="link-button" onClick={openChat}>
              Ask the Bulldog.
            </button>
          </p>
          <footer className="handbook-folio">— 64 —</footer>
        </article>
      </section>
    </div>
  )
}

function UniformCard({ uniform, catalogue }: { uniform: Uniform; catalogue: Map<string, Product> }) {
  const pieces = uniform.productIds.map((id) => catalogue.get(id)).filter((p): p is Product => !!p)
  const total = pieces.reduce((sum, p) => sum + p.price, 0)
  const ready = pieces.length === uniform.productIds.length

  return (
    <article className="uniform">
      <p className="uniform-occasion">{uniform.occasion}</p>
      <h3 className="uniform-title">{uniform.title}</h3>
      <div className="uniform-flatlay" aria-hidden="true">
        {pieces.map((p, i) => (
          <img key={p.product_id} src={p.image_url} alt="" style={{ zIndex: 3 - i }} width={120} height={120} loading="lazy" />
        ))}
      </div>
      <p className="uniform-note">{uniform.note}</p>
      <ul className="uniform-pieces">
        {pieces.map((p) => (
          <li key={p.product_id}>
            <Link to={`/products/${p.product_id}`}>{p.name}</Link>
            <span>{formatPrice(p.price)}</span>
          </li>
        ))}
      </ul>
      <div className="uniform-foot">
        <span className="uniform-total">
          <em>The full uniform</em> {ready ? formatPrice(total) : '…'}
        </span>
        <button
          className="btn btn-small"
          disabled={!ready}
          onClick={() => showResults(`The Uniform: ${uniform.title}`, '', pieces.map(asCard))}
        >
          Lay it out
        </button>
      </div>
    </article>
  )
}
