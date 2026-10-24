// Shopper preferences kept on this device (localStorage): the size on file
// ("The Tailor's Ledger") and recently viewed products ("Recently admired").

import { useSyncExternalStore } from 'react'

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const
export type Size = (typeof SIZES)[number]

const SIZE_KEY = 'cc:my-size'
const RECENT_KEY = 'cc:recently-viewed'
const MAX_RECENT = 6

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

function createStore<T>(key: string, fallback: T) {
  let value = read(key, fallback)
  const listeners = new Set<() => void>()
  const subscribe = (notify: () => void) => {
    listeners.add(notify)
    return () => listeners.delete(notify)
  }
  return {
    get: () => value,
    set(next: T) {
      value = next
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Private mode / storage full: keep it for this visit only.
      }
      listeners.forEach((notify) => notify())
    },
    use: () => useSyncExternalStore(subscribe, () => value),
  }
}

// --- Size on file ----------------------------------------------------------

const sizeStore = createStore<Size | null>(SIZE_KEY, null)
export const useMySize = sizeStore.use
export const getMySize = sizeStore.get
export const setMySize = (size: Size | null) => sizeStore.set(size)

// --- Recently viewed -------------------------------------------------------

const recentStore = createStore<string[]>(RECENT_KEY, [])
export const useRecentlyViewed = recentStore.use
export function recordView(productId: string) {
  const current = recentStore.get()
  if (current[0] === productId) return
  recentStore.set([productId, ...current.filter((id) => id !== productId)].slice(0, MAX_RECENT))
}
