// Chat client: sends the shopper's message (plus recent turns) to the FastAPI
// /api/chat route, which runs the PydanticAI shop agent.

import { getMySize } from './prefs'

/** A product match the agent picked; built by the backend from the database (models.ProductCard). */
export type ChatProduct = {
  product_id: string
  name: string
  garment_type: string
  price: number
  price_display: string
  image_url: string
  main_color: string | null
  colors: string[]
  short_description: string
  sizes_in_stock: string[]
  low_stock_sizes: string[]
  sold_out: boolean
}

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  products?: ChatProduct[]
  /** Title for this reply's products when shown on the page. */
  resultsHeading?: string
  /** UI-only (e.g. the greeting): never sent to the agent or saved. */
  local?: boolean
  /** The Fact-Checker's verdicts for this reply. */
  checks?: string[]
  /** The Bouncer's privacy notice for this reply. */
  notice?: string
}

/** Where the shopper is, so "this one" means something (models.PageContext). */
export type PageContext = {
  path: string
  product_id: string | null
  category: string | null
  collection: string | null
  search: string | null
  /** The Tailor's Ledger: the shopper's size on file, so "my size" means something. */
  preferred_size: string | null
}

export function pageContext(pathname: string, search: string): PageContext {
  const params = new URLSearchParams(search)
  return {
    preferred_size: getMySize(),
    path: pathname + search,
    product_id: pathname.match(/^\/products\/([^/]+)$/)?.[1] ?? null,
    category: params.get('category'),
    collection: params.get('collection'),
    search: params.get('q'),
  }
}

/** The /api/chat response (models.ChatResponse). */
export type ChatReply = {
  reply: string
  products: ChatProduct[]
  results_heading: string | null
  checks: string[]
  notice: string | null
  redacted_message: string | null
}

const MAX_HISTORY = 20

export async function sendChatMessage(
  message: string,
  history: ChatMessage[],
  page: PageContext,
): Promise<ChatReply> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      // Text only, and only used for guests: for logged-in shoppers the server
      // reads the saved conversation from the database instead.
      history: history
        .filter((m) => !m.local)
        .slice(-MAX_HISTORY)
        .map(({ role, content }) => ({ role, content })),
      page,
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(typeof data?.detail === 'string' ? data.detail : `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<ChatReply>
}

type SavedMessage = { role: 'user' | 'assistant'; content: string; products: ChatProduct[]; created_at: string }

/** A logged-in shopper's saved conversation (GET /api/chat/history). */
export async function fetchChatHistory(): Promise<ChatMessage[]> {
  const res = await fetch('/api/chat/history')
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const data = (await res.json()) as { messages: SavedMessage[] }
  return data.messages.map(({ role, content, products }) => ({ role, content, products }))
}

export async function clearChatHistory(): Promise<void> {
  const res = await fetch('/api/chat/history', { method: 'DELETE' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
}

// Lets any page open the chat panel, e.g. a "Ask the Bulldog" button on Home.
export const OPEN_CHAT_EVENT = 'campus-customs:open-chat'
export const openChat = () => window.dispatchEvent(new Event(OPEN_CHAT_EVENT))
