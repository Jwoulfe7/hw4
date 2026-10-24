import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CATEGORIES,
  COLLECTIONS,
  categoryOf,
  fetchProducts,
  isCollectionKey,
  matchesQuery,
  peekProducts,
  type Product,
} from '../api'
import ProductCard, { ProductCardSkeleton } from '../components/ProductCard'
import SizeLedger from '../components/SizeLedger'
import { useMySize } from '../prefs'

const SORTS = {
  '': 'As the Bulldog sees fit',
  'price-asc': 'Price: modest first',
  'price-desc': 'Price: lavish first',
  plentiful: 'Most plentiful',
} as const
type SortKey = keyof typeof SORTS
const isSortKey = (k: string): k is SortKey => k in SORTS

export default function Products() {
  const [products, setProducts] = useState<Product[] | null>(peekProducts)
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()

  const category = params.get('category')
  const collectionParam = params.get('collection')
  const collection = isCollectionKey(collectionParam) ? collectionParam : null
  const query = params.get('q') ?? ''
  const mySize = useMySize()
  const onlyFits = params.get('fits') === '1' && !!mySize
  const sortParam = params.get('sort') ?? ''
  const sort: SortKey = isSortKey(sortParam) ? sortParam : ''

  useEffect(() => {
    fetchProducts().then(setProducts, (e: Error) => setError(e.message))
  }, [])

  const visible = useMemo(() => {
    const list = (products ?? []).filter(
      (p) =>
        (!category || categoryOf(p.garment_type) === category) &&
        (!collection || COLLECTIONS[collection].pattern.test(p.name)) &&
        (!onlyFits || p.sizes_in_stock.includes(mySize!)) &&
        matchesQuery(p, query),
    )
    const fits = (p: Product) => (mySize && p.sizes_in_stock.includes(mySize) ? 1 : 0)
    if (sort === 'price-asc') list.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
    if (sort === 'price-desc') list.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name))
    if (sort === 'plentiful') list.sort((a, b) => fits(b) - fits(a) || b.sizes_in_stock.length - a.sizes_in_stock.length || b.total_stock - a.total_stock)
    return list
  }, [products, category, collection, query, onlyFits, mySize, sort])

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const heading = collection ? COLLECTIONS[collection].label : (category ?? 'The Whole Wardrobe')

  return (
    <div className="page">
      <div className="page-head">
        <p className="kicker">Shop</p>
        <h1>{heading}</h1>
        <p className="lede">
          Crewnecks, hoodies, quarter-zips and tees. Every one is officially licensed, and none of
          them needs explaining at a reunion.
        </p>
      </div>

      <div className="filters">
        <input
          className="search"
          type="search"
          placeholder="Search: Saybrook, hockey, heather gray…"
          value={query}
          onChange={(e) => setParam('q', e.target.value)}
          aria-label="Search products"
        />
        <div className="chips">
          <button
            className={!category && !collection ? 'chip active' : 'chip'}
            onClick={() => setParams({}, { replace: true })}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={category === c ? 'chip active' : 'chip'}
              onClick={() => setParam('category', category === c ? null : c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="chips">
          {Object.entries(COLLECTIONS).map(([key, c]) => (
            <button
              key={key}
              className={collection === key ? 'chip chip-alt active' : 'chip chip-alt'}
              onClick={() => setParam('collection', collection === key ? null : key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ledger-row">
        <SizeLedger />
        <label className={mySize ? 'fits-toggle' : 'fits-toggle disabled'} title={mySize ? undefined : 'Put your size on file first'}>
          <input
            type="checkbox"
            checked={onlyFits}
            disabled={!mySize}
            onChange={(e) => setParam('fits', e.target.checked ? '1' : null)}
          />
          <span className="fits-switch" aria-hidden="true" />
          Only what fits{mySize ? ` (${mySize})` : ''}
        </label>
        <label className="sort-select">
          <span>Arrange by</span>
          <select value={sort} onChange={(e) => setParam('sort', e.target.value || null)}>
            {Object.entries(SORTS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="error">Couldn't load products ({error}). Is the backend running?</p>}
      {!products && !error && (
        <div className="grid">
          {Array.from({ length: 8 }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      )}
      {products && (
        <>
          <p className="muted result-count">
            {visible.length} {visible.length === 1 ? 'item' : 'items'}
          </p>
          {visible.length === 0 ? (
            <p>
              {onlyFits
                ? `Nothing here in ${mySize}, alas. Try switching off "Only what fits".`
                : 'Nothing matches that. Try a broader search.'}
            </p>
          ) : (
            <div className="grid">
              {visible.map((p, i) => (
                <ProductCard key={p.product_id} product={p} eager={i < 8} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
