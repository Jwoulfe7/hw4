import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { peekProduct } from '../api'
import { useAuth, type User } from '../auth'
import {
  OPEN_CHAT_EVENT,
  clearChatHistory,
  fetchChatHistory,
  pageContext,
  sendChatMessage,
  type ChatMessage,
  type ChatProduct,
} from '../chat'
import { clearResults, showResults } from '../showcase'
import Markdown from './Markdown'

function greetingFor(user: User | null): ChatMessage {
  return {
    role: 'assistant',
    local: true,
    content: user
      ? `Welcome back, ${user.first_name}! I'm the Bulldog. Ask me about sizes, prices, or what's in stock. This chat is saved to your account.`
      : "Hello! I'm the Bulldog, Campus Customs' shop assistant. Ask me about sizes, prices, or the right crewneck for your residential college.",
  }
}

const titleCase = (id: string) => id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

// Rendered with key={user id or "guest"} (see App.tsx), so logging in or out starts a fresh widget:
// a new shopper never sees the previous one's conversation.
export default function ChatWidget() {
  const { user } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(() => [greetingFor(user)])
  const [historyStatus, setHistoryStatus] = useState<'loading' | 'ready' | 'error'>(user ? 'loading' : 'ready')
  const [confirmClear, setConfirmClear] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // A different shopper (log in / log out) starts clean: don't leave the last person's picks on the page.
  useEffect(() => clearResults, [])

  // Logged in: reload the saved conversation from the database.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchChatHistory().then(
      (saved) => {
        if (cancelled) return
        setMessages([...saved, greetingFor(user)])
        setHistoryStatus('ready')
      },
      () => !cancelled && setHistoryStatus('error'),
    )
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener(OPEN_CHAT_EVENT, handler)
    return () => window.removeEventListener(OPEN_CHAT_EVENT, handler)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, sending, open])

  const page = pageContext(location.pathname, location.search)
  const viewing = page.product_id ? (peekProduct(page.product_id)?.name ?? titleCase(page.product_id)) : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || sending) return

    const history = messages
    setMessages([...messages, { role: 'user', content: text }])
    setDraft('')
    setSending(true)
    try {
      const { reply, products, results_heading, checks, notice, redacted_message } = await sendChatMessage(text, history, page)
      const resultsHeading = results_heading ?? "The Bulldog's picks"
      setMessages((m) => {
        // The Bouncer removed something: show the shopper their message as it was actually sent and saved.
        const sent = redacted_message ? m.map((x, i) => (i === m.length - 1 ? { ...x, content: redacted_message } : x)) : m
        return [...sent, { role: 'assistant', content: reply, products, resultsHeading, checks, notice: notice ?? undefined }]
      })
      // The API contract: structured matches go on the page as product cards.
      if (products.length) showResults(resultsHeading, text, products)
    } catch (err) {
      const detail = err instanceof Error && !/^\d{3}\b/.test(err.message) ? err.message : null
      setMessages((m) => [
        ...m,
        { role: 'assistant', local: true, content: detail ?? "Sorry, I couldn't reach the shop just now. Please try again." },
      ])
    } finally {
      setSending(false)
    }
  }

  async function handleClear() {
    if (!confirmClear) return setConfirmClear(true)
    setConfirmClear(false)
    try {
      await clearChatHistory()
      setMessages([greetingFor(user)])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', local: true, content: "Sorry, I couldn't clear your chat just now." }])
    }
  }

  // For "See on the page" on an older reply: the shopper's question just before it.
  const questionFor = (i: number) => messages.slice(0, i).findLast((m) => m.role === 'user')?.content ?? ''

  return (
    <div className="chat">
      {open && (
        <section className="chat-panel" aria-label="Chat with Campus Customs">
          <header className="chat-header">
            <span className="chat-avatar" aria-hidden="true">
              B
            </span>
            <div className="chat-header-title">
              <strong>Ask the Bulldog</strong>
              <span>{user ? 'Saved to your account' : 'Guest chat · log in to save it'}</span>
            </div>
            <div className="chat-header-actions">
              {user && messages.some((m) => !m.local) && (
                <button className="chat-clear" onClick={handleClear} onBlur={() => setConfirmClear(false)}>
                  {confirmClear ? 'Sure? Clear' : 'Clear'}
                </button>
              )}
              <button className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">
                ×
              </button>
            </div>
          </header>
          <div className="chat-messages" ref={listRef}>
            {historyStatus === 'loading' && <div className="chat-status">Loading your saved chat…</div>}
            {historyStatus === 'error' && <div className="chat-status">Couldn't load your saved chat.</div>}
            {messages.map((m, i) => (
              <div key={i} className={`chat-turn ${m.role}`}>
                {m.notice && (
                  <div className="chat-notice" role="note">
                    <span className="chat-notice-icon" aria-hidden="true">⛨</span>
                    {m.notice}
                  </div>
                )}
                <div className={`chat-msg ${m.role}`}>
                  {m.role === 'assistant' ? <Markdown text={m.content} /> : m.content}
                </div>
                {m.checks && m.checks.length > 0 && (
                  <div className="chat-checks" title={m.checks.join(' · ')}>
                    <span className="chat-checks-mark" aria-hidden="true">✓</span> Fact-checked against the stock room
                    <span className="chat-checks-detail"> · {m.checks.join(' · ')}</span>
                  </div>
                )}
                {m.products && m.products.length > 0 && (
                  <ChatProducts
                    products={m.products}
                    onShowOnPage={() => {
                      showResults(m.resultsHeading ?? "The Bulldog's picks", questionFor(i), m.products!)
                      // On small screens the panel covers the page, so get out of the way.
                      if (window.matchMedia('(max-width: 560px)').matches) setOpen(false)
                    }}
                  />
                )}
              </div>
            ))}
            {sending && <div className="chat-msg assistant typing">…</div>}
          </div>
          {viewing && (
            <div className="chat-context" title="The Bulldog knows which item you're looking at">
              Asking about: <strong>{viewing}</strong>
            </div>
          )}
          <form className="chat-input" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={viewing ? 'Do you have this in a medium?' : 'Do you have the Saybrook crewneck in a medium?'}
              aria-label="Message"
            />
            <button className="btn" disabled={sending || !draft.trim()}>
              Send
            </button>
          </form>
        </section>
      )}
      <button
        className="chat-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        {open ? (
          '×'
        ) : (
          <>
            <span className="life-ring" aria-hidden="true" />
            Ask the Bulldog
          </>
        )}
      </button>
    </div>
  )
}

function ChatProducts({ products, onShowOnPage }: { products: ChatProduct[]; onShowOnPage: () => void }) {
  return (
    <div className="chat-products">
      <ul className="chat-thumbs" aria-label="Matching products">
        {products.map((p) => (
          <li key={p.product_id}>
            <Link to={`/products/${p.product_id}`} className="chat-thumb" title={`${p.name}, ${p.price_display}`}>
              <img src={p.image_url} alt={p.name} width={52} height={52} loading="lazy" />
            </Link>
          </li>
        ))}
      </ul>
      <button className="chat-onpage" onClick={onShowOnPage}>
        {products.length === 1 ? 'See it on the page' : `See all ${products.length} on the page`} ↑
      </button>
    </div>
  )
}
