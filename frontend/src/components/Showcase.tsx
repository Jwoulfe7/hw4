import { useEffect, useRef, type CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { prefetchProduct } from '../api'
import type { ChatProduct } from '../chat'
import { clearResults, setCollapsed, useShowcase } from '../showcase'

// The chat agent's product matches, rendered on the page under the nav bar.
// Each card links to the same /products/:id detail page as the Products grid.
export default function Showcase() {
  const showcase = useShowcase()
  const { pathname } = useLocation()
  const lastPath = useRef(pathname)

  // When the shelf opens (new results, or "Show" on the slim bar), bring it into view.
  const openId = showcase && !showcase.collapsed ? showcase.id : null
  useEffect(() => {
    if (openId === null) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Next tick, so the new shelf is in the page before scrolling to it.
    const timer = window.setTimeout(() => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }))
    return () => window.clearTimeout(timer)
  }, [openId])

  // Opening a product from the shelf: fold the shelf into a slim bar so the detail view leads.
  useEffect(() => {
    if (pathname !== lastPath.current) {
      lastPath.current = pathname
      setCollapsed(true)
    }
  }, [pathname])

  if (!showcase) return null
  const { heading, query, products, collapsed } = showcase

  if (collapsed) {
    return (
      <div className="showcase-bar" role="region" aria-label="The Bulldog's picks">
        <div className="showcase-bar-inner">
          <span className="showcase-bar-label">
            <em>The Bulldog's picks</em> {heading} · {products.length}
          </span>
          <span className="showcase-bar-thumbs" aria-hidden="true">
            {products.slice(0, 6).map((p) => (
              <img key={p.product_id} src={p.image_url} alt="" width={28} height={28} />
            ))}
          </span>
          <button className="showcase-bar-btn" onClick={() => setCollapsed(false)}>
            Show
          </button>
          <button className="showcase-x" onClick={clearResults} aria-label="Clear the Bulldog's picks">
            ×
          </button>
        </div>
      </div>
    )
  }

  return (
    <section className="showcase" aria-label={`The Bulldog's picks: ${heading}`} aria-live="polite">
      <div className="showcase-inner">
        <header className="showcase-head">
          <div>
            <p className="showcase-kicker">The Bulldog fetched {products.length === 1 ? 'one pick' : `${products.length} picks`}</p>
            <h2 className="showcase-title">{heading}</h2>
            {query && <p className="showcase-query">You asked: “{query}”</p>}
          </div>
          <div className="showcase-actions">
            <button className="showcase-btn" onClick={() => setCollapsed(true)}>
              Minimize
            </button>
            <button className="showcase-x" onClick={clearResults} aria-label="Clear the Bulldog's picks">
              ×
            </button>
          </div>
        </header>
        <ol className="showcase-grid" key={showcase.id}>
          {products.map((p, i) => (
            <li key={p.product_id} style={{ '--i': i } as CSSProperties}>
              <ShowcaseCard product={p} rank={i + 1} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function ShowcaseCard({ product: p, rank }: { product: ChatProduct; rank: number }) {
  const prefetch = () => prefetchProduct(p.product_id, p.image_url)
  const lowStock = p.low_stock_sizes.length > 0 && !p.sold_out

  return (
    <Link
      to={`/products/${p.product_id}`}
      className={p.sold_out ? 'pick sold-out' : 'pick'}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      onTouchStart={prefetch}
    >
      <span className="pick-rank" aria-hidden="true">
        No. {rank}
      </span>
      {p.sold_out && <span className="pick-ribbon">Sold out</span>}
      <span className="pick-image">
        <img src={p.image_url} alt={p.name} width={300} height={300} decoding="async" />
      </span>
      <span className="pick-body">
        <span className="pick-type">{p.garment_type}</span>
        <span className="pick-name">{p.name}</span>
        <span className="pick-desc">{p.short_description}</span>
        <span className="pick-foot">
          <span className="pick-price">{p.price_display}</span>
          <span className="pick-sizes" aria-label={`In stock: ${p.sizes_in_stock.join(', ') || 'none'}`}>
            {p.sizes_in_stock.map((s) => (
              <span key={s} className={p.low_stock_sizes.includes(s) ? 'pick-size low' : 'pick-size'}>
                {s}
              </span>
            ))}
          </span>
        </span>
        {lowStock && <span className="pick-note">Only a few left in {p.low_stock_sizes.join(', ')}</span>}
        <span className="pick-cta">View details →</span>
      </span>
    </Link>
  )
}
