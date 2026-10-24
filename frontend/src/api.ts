// Types and fetch helpers for the FastAPI backend (backend/main.py).

export type Product = {
  product_id: string
  name: string
  garment_type: string
  description: string
  colors: string[]
  search_tags: string[]
  price: number
  image_url: string
  total_stock: number
  sizes_in_stock: string[]
}

export type SizeStock = { size: string; quantity: number }

export type ProductDetail = Product & { stock: SizeStock[] }

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

// --- Caching -----------------------------------------------------------------
// The catalogue is fetched once per visit and shared by every page. Product
// details (which include stock) are reused for a short window so a hover
// prefetch makes the click instant, without showing stock that's long stale.

const DETAIL_TTL_MS = 30_000

let productsPromise: Promise<Product[]> | null = null
let productsSnapshot: Product[] | null = null

const detailRequests = new Map<string, { promise: Promise<ProductDetail>; at: number }>()
const detailSnapshots = new Map<string, ProductDetail>()

export function fetchProducts(): Promise<Product[]> {
  productsPromise ??= getJson<Product[]>('/api/products').then(
    (list) => (productsSnapshot = list),
    (err) => {
      productsPromise = null // let the next caller retry
      throw err
    },
  )
  return productsPromise
}

/** Products already in memory, for rendering without a loading state. */
export const peekProducts = () => productsSnapshot

export function fetchProduct(id: string): Promise<ProductDetail> {
  const cached = detailRequests.get(id)
  if (cached && Date.now() - cached.at < DETAIL_TTL_MS) return cached.promise

  const promise = getJson<ProductDetail>(`/api/products/${encodeURIComponent(id)}`).then(
    (detail) => {
      detailSnapshots.set(id, detail)
      return detail
    },
    (err) => {
      detailRequests.delete(id)
      throw err
    },
  )
  detailRequests.set(id, { promise, at: Date.now() })
  return promise
}

/** The freshest detail we have for a product, or its catalogue entry (no stock yet). */
export function peekProduct(id: string): ProductDetail | Product | undefined {
  return detailSnapshots.get(id) ?? productsSnapshot?.find((p) => p.product_id === id)
}

/** Warm the caches before a click, e.g. on hover. Errors are ignored here. */
export function prefetchProduct(id: string, imageUrl?: string) {
  fetchProduct(id).catch(() => {})
  if (imageUrl) new Image().src = imageUrl
}

export const formatPrice = (price: number) =>
  price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

// The catalogue has ~22 inconsistent garment_type labels; fold them into shop categories.
export const CATEGORIES = [
  'T-Shirts',
  'Crewnecks',
  'Hoodies',
  'Quarter-Zips',
  'Jackets & Full-Zips',
  'Long Sleeves',
] as const

export type Category = (typeof CATEGORIES)[number]

export function categoryOf(garmentType: string): Category {
  const t = garmentType.toLowerCase()
  if (t.includes('quarter-zip')) return 'Quarter-Zips'
  if (t.includes('t-shirt')) return 'T-Shirts'
  if (t.includes('jacket') || t.includes('full-zip')) return 'Jackets & Full-Zips'
  if (t.includes('hood')) return 'Hoodies'
  if (t.includes('crew') || t.includes('mockneck')) return 'Crewnecks'
  return 'Long Sleeves'
}

// Shop collections, matched on product name (the tags don't group these consistently).
const words = (list: string[]) => new RegExp(`\\b(${list.join('|')})\\b`, 'i')

export const COLLECTIONS = {
  colleges: {
    label: 'Residential Colleges',
    pattern: words([
      'Benjamin Franklin', 'Berkeley', 'Branford', 'Davenport', 'Ezra Stiles', 'Grace Hopper',
      'Jonathan Edwards', 'Morse', 'Pauli Murray', 'Pierson', 'Saybrook', 'Silliman',
      'Timothy Dwight', 'Trumbull',
    ]),
  },
  varsity: {
    label: 'Varsity',
    pattern: words([
      'Baseball', 'Basketball', 'Crew', 'Diving', 'Fencing', 'Football', 'Golf', 'Hockey',
      'Lacrosse', 'Sailing', 'Soccer', 'Squash', 'Swimming', 'Tennis', 'Track', 'Volleyball',
    ]),
  },
  family: {
    label: 'Family',
    pattern: words(['Mom', 'Dad', 'Grandma', 'Grandpa', 'Aunt', 'Uncle', 'Brother', 'Sister', 'Cousin']),
  },
  schools: {
    label: 'Graduate & Professional Schools',
    pattern: words(['School', 'Divinity']),
  },
} as const

export type CollectionKey = keyof typeof COLLECTIONS

export const isCollectionKey = (k: string | null): k is CollectionKey =>
  k !== null && k in COLLECTIONS

export function matchesQuery(p: Product, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [p.name, p.description, p.garment_type, ...p.colors, ...p.search_tags]
    .join(' ')
    .toLowerCase()
  return q.split(/\s+/).every((word) => haystack.includes(word))
}
