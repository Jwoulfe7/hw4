import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CATEGORIES, COLLECTIONS, fetchProducts, formatPrice, matchesQuery, peekProducts, prefetchProduct, type Product } from '../api'
import { useMySize, useRecentlyViewed } from '../prefs'
import { VALET_EVENT } from '../valet'

const MAX_RESULTS = 8

// Best matches first: exact name start, then name contains the words, then anywhere.
function rank(products: Product[], query: string): Product[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const words = q.split(/\s+/)
  return products
    .filter((p) => matchesQuery(p, q))
    .map((p) => {
      const name = p.name.toLowerCase()
      const score = (name.startsWith(q) ? 100 : 0) + words.filter((w) => name.includes(w)).length * 10 + (p.total_stock > 0 ? 1 : 0)
      return { p, score }
    })
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
    .slice(0, MAX_RESULTS)
    .map(({ p }) => p)
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)

// "The Valet": a search palette summoned with ⌘K / Ctrl+K or "/" from any page.
export default function Valet() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [products, setProducts] = useState<Product[] | null>(peekProducts)
  const recentIds = useRecentlyViewed()
  const mySize = useMySize()
  const navigate = useNavigate()
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const summon = () => {
      setQuery('')
      setActive(0)
      setOpen(true)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
        setQuery('')
        setActive(0)
      } else if (e.key === '/' && !isTyping(e.target)) {
        e.preventDefault()
        summon()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(VALET_EVENT, summon)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(VALET_EVENT, summon)
    }
  }, [])

  useEffect(() => {
    if (open && !products) fetchProducts().then(setProducts, () => {})
  }, [open, products])

  const results = useMemo(() => rank(products ?? [], query), [products, query])
  const recent = useMemo(
    () => recentIds.map((id) => products?.find((p) => p.product_id === id)).filter((p): p is Product => !!p),
    [recentIds, products],
  )
  const items = query.trim() ? results : recent

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const close = () => setOpen(false)
  const go = (p: Product) => {
    close()
    navigate(`/products/${p.product_id}`)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') close()
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && items[active]) {
      e.preventDefault()
      go(items[active])
    }
  }

  return (
    <div className="valet-backdrop" onMouseDown={close}>
      <div className="valet" role="dialog" aria-modal="true" aria-label="The Valet: search the shop" onMouseDown={(e) => e.stopPropagation()}>
        <div className="valet-head">
          <span className="valet-crest" aria-hidden="true">V</span>
          <input
            className="valet-input"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            placeholder="What may I fetch for you?"
            aria-label="Search products"
            aria-activedescendant={items[active] ? `valet-${items[active].product_id}` : undefined}
          />
          <kbd className="valet-kbd">esc</kbd>
        </div>

        {items.length > 0 && (
          <p className="valet-section">{query.trim() ? `${results.length === MAX_RESULTS ? 'The finest' : 'All'} ${results.length} matches` : 'Recently admired'}</p>
        )}
        <ul className="valet-results" ref={listRef} role="listbox">
          {items.map((p, i) => {
            const fits = mySize ? p.sizes_in_stock.includes(mySize) : null
            return (
              <li key={p.product_id} id={`valet-${p.product_id}`} role="option" aria-selected={i === active} data-index={i}>
                <button
                  className={i === active ? 'valet-item active' : 'valet-item'}
                  onMouseEnter={() => {
                    setActive(i)
                    prefetchProduct(p.product_id, p.image_url)
                  }}
                  onClick={() => go(p)}
                >
                  <img src={p.image_url} alt="" width={48} height={48} />
                  <span className="valet-item-text">
                    <span className="valet-item-name">{p.name}</span>
                    <span className="valet-item-meta">
                      {p.garment_type}
                      {' · '}
                      {fits === null ? (
                        p.sizes_in_stock.length ? `${p.sizes_in_stock.length} sizes in stock` : 'Sold out'
                      ) : fits ? (
                        <span className="fits">In your size ({mySize})</span>
                      ) : (
                        <span className="no-fit">Not in {mySize}</span>
                      )}
                    </span>
                  </span>
                  <span className="valet-item-price">{formatPrice(p.price)}</span>
                </button>
              </li>
            )
          })}
        </ul>

        {query.trim() && products && results.length === 0 && (
          <p className="valet-empty">
            Alas, nothing answers to “{query}”. Perhaps{' '}
            <Link to={`/products?q=${encodeURIComponent(query)}`} onClick={close}>
              browse the full wardrobe
            </Link>
            , or ask the Bulldog.
          </p>
        )}

        {!query.trim() && (
          <div className="valet-departments">
            <p className="valet-section">The departments</p>
            <div className="valet-chips">
              {CATEGORIES.map((c) => (
                <Link key={c} to={`/products?category=${encodeURIComponent(c)}`} onClick={close} className="chip">
                  {c}
                </Link>
              ))}
              {Object.entries(COLLECTIONS).map(([key, c]) => (
                <Link key={key} to={`/products?collection=${key}`} onClick={close} className="chip chip-alt">
                  {c.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        <footer className="valet-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> to peruse</span>
          <span><kbd>↵</kbd> to proceed</span>
          <span><kbd>esc</kbd> to dismiss the Valet</span>
        </footer>
      </div>
    </div>
  )
}
