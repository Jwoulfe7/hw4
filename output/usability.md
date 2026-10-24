# Campus Customs: Usability Improvements (Problem 9)

Four improvements: two to the front end (useful, and dressed in all the pretension a Yale shop can carry) and two to the agent and backend (no pretension, just more accurate and safer answers). All four are live in the running app, and each section below says exactly where to see it.

| # | Improvement | Layer | In one line |
|---|---|---|---|
| 1 | **The Valet** | Front end | Press ⌘K, Ctrl+K or `/` anywhere for instant search across all 102 items, plus your recently viewed items |
| 2 | **The Tailor's Ledger** | Front end | Save your size once; the whole shop then shows what's in your size, and the Bulldog knows it |
| 3 | **The Fact-Checker** | Agent / backend | Every price and sold-out claim in a chat reply is checked against the database before you see it |
| 4 | **The Bouncer** | Agent / backend | Card numbers, SSNs and passwords are removed from chats before the AI or the database sees them; chat is rate-limited |

---

## 1. The Valet: instant search, at your service

> *"What may I fetch for you?"*

### What we added

- **A search window over any page.** It opens from:
  - the **"Summon the Valet ⌘K"** button in the nav bar,
  - the **⌘K / Ctrl+K** keyboard shortcut,
  - or by pressing **`/`**.
- **Instant results.** As you type, up to 8 ranked matches appear, each with photo, garment type, price and availability.
  - With a size on file (see #2), each result also says **"In your size (M)"** or **"Not in M"**.
  - Ranking puts an exact name match first, then name matches, then everything else.
- **Keyboard control:** ↑↓ to peruse, ↵ to proceed (opens the product page), Esc to dismiss the Valet. Hovering a result preloads its product page, so it opens instantly.
- **Before you type:**
  - **Recently admired:** your last 6 product pages, saved on this device.
  - **The departments:** one-click links to all 6 garment categories and 4 collections.
- **No-match message:** "Alas, nothing answers to '…'", with a link to the full catalogue filtered by your search.
- **Files:** `frontend/src/components/Valet.tsx`, `frontend/src/prefs.ts` ("Recently admired"), `frontend/src/valet.ts`, and the "The Valet" section of `index.css`.

### Why it helps

- **The shopper:** a returning student who knows exactly what they want ("the Saybrook crewneck") gets there in about 3 keystrokes from any page, with no scrolling through 102 cards and no wait for the AI. "Recently admired" gets them back to the hoodie they were considering yesterday.
- **The business:** search is the highest-intent action on a shop site. Making it instant and always available sends more people to product pages. Unlike the chatbot, it costs **zero AI calls**, which matters on a rate-limited free-tier key.

### See it in the app

Press `/` on any page and type **saybrook**. Use ↓ and Enter to open a result, then press ⌘K again and it's listed under "Recently admired".

**Verified in the browser:**
- `/` opened the Valet with the cursor in the search box. "saybrook" returned all 3 Saybrook items ($58.00, $32.00, $98.00), each with "5 sizes in stock".
- ↓ then Enter opened `/products/saybrook-logo-t-shirt`.
- ⌘K reopened it with that tee under "Recently admired", plus 10 department links. Esc closed it.

---

## 2. The Tailor's Ledger: your size, on file

> *"Your size, on file." "Not in M, alas." "Only 5 left. Act with appropriate haste."*

### What we added

- **Your size, saved.** A **"The Tailor's Ledger · Your size, on file"** picker (XS–XXL) on the Products page, with a compact version on each product page. It's remembered on this device.
- **Products page:**
  - Every card shows **"In your size · M"** (a navy tag) or **"Not in M, alas"**, and the photo fades when your size isn't available.
  - An **"Only what fits (M)"** switch hides everything not in stock in your size.
  - **"Arrange by":** *As the Bulldog sees fit*, *Price: modest first*, *Price: lavish first*, or *Most plentiful* (puts items in your size first, then those with the most sizes in stock).
  - The filter and sort are kept in the URL, so a filtered view can be bookmarked or shared.
- **Product page:**
  - Your size's box gets a gold ring and a **"Your size"** tag.
  - A verdict line: **"Your size (M): only 5 left. Act with appropriate haste."**, or **"Your size (M) is sold out. Still available: XS, S, XXL."**
- **The chat:** the Bulldog gets your size in its page context. "Is this in my size?" just works, and it may mention your usual size.
- **Files:** `frontend/src/components/SizeLedger.tsx`, `frontend/src/prefs.ts`, `pages/Products.tsx`, `components/ProductCard.tsx`, `pages/ProductPage.tsx`, and `sizes_in_stock` added to `GET /api/products` and `GET /api/products/{id}` in `backend/main.py`. The chat side is in `backend/tools.resolve_page` and `backend/agent.page_context`.

### Why it helps

- **The shopper:**
  - **145 of the shop's 612 size slots are sold out**, and 22 of 102 products have no medium at all. Clothes shopping goes wrong when you fall for something that isn't in your size.
  - The Ledger answers "is it in my size?" on every card before you click.
  - "Only what fits" turns 102 items into the 80 you can actually buy.
- **The business:**
  - Fewer dead-end product visits and fewer "do you have this in a medium?" chats, which saves AI cost.
  - Shoppers get steered to inventory that's actually in stock, which is what sells.
  - "Most plentiful" helps move stock the shop has lots of.

### See it in the app

1. Go to **Products** and click **M** in the Ledger. Every card now has a fit tag.
2. Flip **"Only what fits"** and pick **"Price: modest first"**.
3. Open the **Yale Dad Crewneck** (sold out in M) and the **Basic Hoodie Big Yale** (only 5 in M).

**Verified in the browser:**
- Before you pick a size, there are no tags and the switch is disabled.
- After choosing M: **80 "In your size" and 22 "Not in M"**, which matches the database exactly (80 products have M in stock, 22 don't).
- "Only what fits" showed **80 items** with no misfits, and the URL became `?fits=1`.
- "Price: modest first" sorted $32 to $98 (`?fits=1&sort=price-asc`).
- On the Dad crewneck page: "Your size (M) is sold out. Still available: XS, S, XXL." On the Basic Hoodie page: "Your size (M): only 5 left. Act with appropriate haste." In both cases the M box is ringed and tagged.
- **In chat (live):** the Bulldog said "…we do have XS through XL in stock (**your usual M is here**)".

---

## 3. The Fact-Checker: no made-up prices, no hidden sold-outs

### What we added

A check that runs on **every** chat reply after the model writes it and **before the shopper sees it**. It's a PydanticAI output validator, `fact_check` in `backend/agent.py`.

**Collecting evidence:** the tools record what they actually returned this turn, in `ShopDeps`:
- every price from `search_products` or `get_price`,
- every per-size result from `check_stock`.

**The rules:**
1. **Prices.** Every dollar amount in the reply must equal a catalogue price a tool returned this turn, or a number the shopper typed (so "under your $60 budget" is fine). If not, the reply goes back to the model with: *"Fact-check failed: your reply quotes $65.00, but no tool returned that price this turn (prices returned: $68.00)…"*, and the model must rewrite it.
2. **Sold out.** If `check_stock` said the requested size is **sold out**, the reply must say so plainly ("sold out", "out of stock", "unavailable"…). Otherwise it goes back to the model: *"check_stock reported SOLD OUT for XX-Large (XXL) of the Saybrook College Crewneck, but your reply doesn't say so…"*
3. **Fallback.** If the model still can't get it right after its retries, the shopper doesn't get an unverified answer. They get "I want to be exact with you, so here's what I found", with product cards built from the database.

**Visible in the chat:** checked replies show a small green note: **"✓ Fact-checked against the stock room · 1 price matched the catalogue · Sold-out size stated plainly"**. It adds "Corrected before sending" if a retry was needed.

**Related fix found while testing:** colors are matched by family. The agent had told a shopper "we don't have any pink items", but the catalogue has a **dusty coral** tee. `search_products` now understands color families (pink includes coral, rose and salmon; gray includes heather and charcoal; and so on). "Do you have anything in pink?" now gets *"We don't carry classic pink, but our dusty coral Big Yale Tri Blend T Shirt has a lovely pinkish tone. It's $32.00."*

### Why it helps

- **The shopper:** they can trust the chatbot. If it says $58 and "in stock", that's true. A shopper told something is in their size, who then finds it sold out, doesn't come back.
- **The business:** a wrong price quoted by the shop's own assistant leads to complaints, refund requests and possibly a pricing obligation. Before, "never invent prices" was a request in the prompt. Now it's **enforced in code on every reply**, and the "✓ Fact-checked" note makes that trust visible.

### See it in the app

Open the chat and ask: **"How much is the Saybrook College Crewneck, and do you have it in XXL?"**

**Verified:**
- **Offline,** with scripted model mistakes:
  - A wrong price ($65 instead of $68): the checker sent the correct price back, and the final reply said **$68.00**, with "Corrected before sending".
  - A hidden XXL sell-out ("Great news, we have it!"): sent back, and the final reply said **"XX-Large is sold out"**.
  - A model that kept inventing $59.99: held back, and the shopper got the safe fallback with database cards.
  - A shopper's own "$60" budget was allowed. An honest in-stock answer passed with "Stock confirmed live".
- **Live** (`gemini-3.5-flash-lite`): *"The Saybrook College Crewneck is **$58.00**. **XXL is sold out**…"*, with **"✓ Fact-checked against the stock room · 1 price matched the catalogue · Sold-out size stated plainly"**. The database agrees: $58, XXL = 0.

---

## 4. The Bouncer: privacy scrubbing and fair-use limits

### What we added

**Privacy scrubbing** (`backend/guardrails.py`). Before a chat message reaches the AI model **or** the `chat_messages` table, the backend removes:
- **payment card numbers**: 13–19 digits, with or without spaces or dashes, **and passing the card-number checksum (Luhn)**, so order numbers and phone numbers are left alone,
- **Social Security numbers** (`123-45-6789`),
- **card security codes** ("cvv 123"),
- **password values** ("my password is …", "pwd: …"). Just mentioning a password, as in "I forgot my password yesterday", isn't touched.

What the shopper sees:
- their own message as it was actually sent and saved, e.g. *"My card is [card number removed]"*,
- a gold notice: *"For your security, I removed a payment card number from your message before it went anywhere. Campus Customs will never ask for this in chat…"*.

Guest history sent from the browser is scrubbed too.

**Fair-use limits.** Chat is capped at **8 messages a minute and 200 a day**, per logged-in shopper (or per network address for guests). Going over gets a friendly *"The Bulldog needs a breather: that's a lot of messages in a short time. Try again in about 42 seconds."*, an HTTP 429 with a `Retry-After` header, instead of a server error. Wired into `/api/chat` in `backend/main.py`.

### Why it helps

- **The shopper:** people paste card numbers into chat boxes, especially in a chat that sounds like a shop clerk. Now that number never leaves the browser request: it isn't sent to a third-party AI provider, and it isn't stored in the shop's database.
- **The business:**
  - Card data in chat logs creates PCI-compliance and breach risk. Scrubbing at the door removes it.
  - The rate limit protects the AI budget and the shared free-tier quota (15 requests a minute on our key) from one runaway script or one bored student. That keeps the chat working for everyone else.

### See it in the app

Log in, open any product page and ask: **"How much is this one? Can you hold it for me? My card is 4111 1111 1111 1111"**.

**Verified:**
- **Live:** the message displayed as *"…My card is [card number removed]"*, the gold privacy notice appeared, and the Bulldog added "We can't hold items or take payment in chat… please don't share card numbers here."
- **Database:** **0 rows** in `chat_messages` contain the number. The saved row reads `[card number removed]`.
- **Offline:**
  - The model received `my card is [card number removed] cvv [removed]`.
  - Firing 9 messages in a minute gave **200 ×8, then 429** with `Retry-After: 60`. A guest on another key was unaffected.
  - The scrubber left alone an order number (`1234567890123`, which fails the checksum), a phone number, and "$58 crewneck".
