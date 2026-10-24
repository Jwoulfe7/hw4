import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { categoryOf, fetchProduct, formatPrice, peekProduct, type Product, type ProductDetail } from '../api'
import { openChat } from '../chat'
import { useMonogram } from '../monogram'
import HowToWear from '../components/HowToWear'
import MonogramControls, { MonogramOverlay } from '../components/Monogram'
import SizeLedger from '../components/SizeLedger'
import { recordView, useMySize } from '../prefs'

const LOW_STOCK = 5
const SIZE_PLACEHOLDERS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((size) => ({ size, quantity: 0 }))

export default function ProductPage() {
  const { productId = '' } = useParams()
  // Keying by id gives each product fresh state when navigating between product pages.
  return <ProductView key={productId} productId={productId} />
}

function ProductView({ productId }: { productId: string }) {
  // Render whatever we already know (from the catalogue or a hover prefetch) right away,
  // then swap in the fresh detail with stock when it arrives.
  const [product, setProduct] = useState<ProductDetail | Product | null>(() => peekProduct(productId) ?? null)
  const [error, setError] = useState<string | null>(null)
  const mySize = useMySize()
  const monogram = useMonogram()

  useEffect(() => {
    fetchProduct(productId).then(
      (p) => {
        setProduct(p)
        recordView(p.product_id) // for the Valet's "Recently admired"
      },
      (e: Error) => setError(e.message),
    )
  }, [productId])

  if (error) {
    return (
      <div className="page">
        <p className="error">
          {error.startsWith('404') ? "We don't carry that one." : `Couldn't load this product (${error}).`}
        </p>
        <Link to="/products">← Back to all products</Link>
      </div>
    )
  }
  if (!product) return <ProductSkeleton />

  const category = categoryOf(product.garment_type)
  const stock = 'stock' in product ? product.stock : null
  const soldOut = product.total_stock === 0

  return (
    <div className="page">
      <nav className="breadcrumbs">
        <Link to="/products">Products</Link> ›{' '}
        <Link to={`/products?category=${encodeURIComponent(category)}`}>{category}</Link> ›{' '}
        <span>{product.name}</span>
      </nav>

      <div className="detail">
        <div className="detail-image">
          <span className="detail-stamp" aria-hidden="true">
            Officially
            <br />
            Licensed
          </span>
          <div className="detail-image-frame">
            <img src={product.image_url} alt={product.name} width={600} height={600} fetchPriority="high" />
            <MonogramOverlay letters={monogram.letters} thread={monogram.thread} />
          </div>
          <MonogramControls {...monogram} />
        </div>

        <div className="detail-info">
          <p className="kicker">{product.garment_type}</p>
          <h1>{product.name}</h1>
          <div className="detail-price">{formatPrice(product.price)}</div>
          <p className="detail-desc">{product.description}</p>

          <dl className="detail-facts">
            <dt>Colors</dt>
            <dd>{product.colors.join(', ')}</dd>
          </dl>

          <h2 className="detail-subhead">Sizes &amp; stock</h2>
          {stock && <LedgerVerdict size={mySize} stock={stock} />}
          <ul className="sizes">
            {(stock ?? SIZE_PLACEHOLDERS).map((s) => (
              <li
                key={s.size}
                className={[
                  'size',
                  !stock ? 'loading' : s.quantity === 0 ? 'sold-out' : '',
                  s.size === mySize ? 'mine' : '',
                ].join(' ')}
              >
                {s.size === mySize && <span className="size-mine-tag">Your size</span>}
                <span className="size-label">{s.size}</span>
                <span className="size-qty">
                  {!stock
                    ? 'Checking…'
                    : s.quantity === 0
                    ? 'Sold out'
                    : s.quantity <= LOW_STOCK
                      ? `Only ${s.quantity} left`
                      : `${s.quantity} in stock`}
                </span>
              </li>
            ))}
          </ul>
          <p className="muted">
            {!stock ? '\u00a0' : soldOut ? 'Sold out in every size.' : `${product.total_stock} in stock across all sizes.`}
          </p>

          <SizeLedger compact />

          <HowToWear category={category} />

          <button className="btn btn-outline" onClick={openChat}>
            Ask the Bulldog about this one
          </button>
        </div>
      </div>
    </div>
  )
}

function ProductSkeleton() {
  return (
    <div className="page" aria-busy="true">
      <div className="breadcrumbs skeleton-line short" />
      <div className="detail skeleton">
        <div className="detail-image card-image" />
        <div className="detail-info">
          <div className="skeleton-line short" />
          <div className="skeleton-line tall" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
        </div>
      </div>
    </div>
  )
}

// The Tailor's Ledger, applied: one line on how this item suits the size on file.
function LedgerVerdict({ size, stock }: { size: string | null; stock: { size: string; quantity: number }[] }) {
  if (!size) return null
  const mine = stock.find((s) => s.size === size)
  const qty = mine?.quantity ?? 0
  if (qty === 0) {
    const nearby = stock.filter((s) => s.quantity > 0).map((s) => s.size)
    return (
      <p className="ledger-verdict sold">
        <strong>Your size ({size}) is sold out.</strong>{' '}
        {nearby.length ? `Still available: ${nearby.join(', ')}.` : 'Every size is spoken for.'}
      </p>
    )
  }
  return (
    <p className="ledger-verdict ok">
      <strong>Your size ({size}):</strong>{' '}
      {qty <= LOW_STOCK ? `only ${qty} left. Act with appropriate haste.` : `in stock (${qty} on the shelf).`}
    </p>
  )
}
