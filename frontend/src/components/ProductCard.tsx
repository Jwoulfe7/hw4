import { Link } from 'react-router-dom'
import { formatPrice, prefetchProduct, type Product } from '../api'
import { useMySize } from '../prefs'

export default function ProductCard({ product, eager = false }: { product: Product; eager?: boolean }) {
  const prefetch = () => prefetchProduct(product.product_id, product.image_url)
  const mySize = useMySize()
  const fits = mySize ? product.sizes_in_stock.includes(mySize) : null

  return (
    <Link
      to={`/products/${product.product_id}`}
      className={fits === false ? 'card no-fit' : 'card'}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      onTouchStart={prefetch}
    >
      <span className="tag-string" aria-hidden="true" />
      <span className="tag-eyelet" aria-hidden="true" />
      <div className="card-image">
        <img
          src={product.image_url}
          alt={product.name}
          width={400}
          height={400}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
        />
        <span className="card-cta">View</span>
        {fits !== null && (
          <span className={fits ? 'fit-badge fits' : 'fit-badge no-fit'}>
            {fits ? `In your size · ${mySize}` : `Not in ${mySize}, alas`}
          </span>
        )}
      </div>
      <div className="card-body">
        <span className="card-type">{product.garment_type}</span>
        <h3 className="card-title">{product.name}</h3>
        <p className="card-desc">{product.description}</p>
        <div className="card-foot">
          <span className="card-price">{formatPrice(product.price)}</span>
          <span className="card-stitch">Est. New Haven</span>
        </div>
      </div>
    </Link>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="card skeleton" aria-hidden="true">
      <div className="card-image" />
      <div className="card-body">
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
      </div>
    </div>
  )
}
