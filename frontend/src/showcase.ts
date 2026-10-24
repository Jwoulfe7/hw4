// The "Bulldog's Picks" shelf: product matches the chat agent found, shown on the page.
// A tiny shared store so the chat widget can publish results and any page can show them.

import { useSyncExternalStore } from 'react'
import type { ChatProduct } from './chat'

export type Showcase = {
  /** Changes with every new result set, so the cards' entrance animation replays. */
  id: number
  heading: string
  /** What the shopper asked, shown as "You asked: …". */
  query: string
  products: ChatProduct[]
  collapsed: boolean
}

let current: Showcase | null = null
const listeners = new Set<() => void>()

function set(next: Showcase | null) {
  current = next
  listeners.forEach((notify) => notify())
}

export function showResults(heading: string, query: string, products: ChatProduct[]) {
  set({ id: Date.now(), heading, query, products, collapsed: false })
}

export function setCollapsed(collapsed: boolean) {
  if (current && current.collapsed !== collapsed) set({ ...current, collapsed })
}

export function clearResults() {
  set(null)
}

const subscribe = (notify: () => void) => {
  listeners.add(notify)
  return () => listeners.delete(notify)
}

export function useShowcase(): Showcase | null {
  return useSyncExternalStore(subscribe, () => current)
}
