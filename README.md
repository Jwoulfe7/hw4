# Yale Bulldog Blue by Campus Customs: Shop + Chatbot (HW4)

A Campus Customs storefront built with **React + Vite (TypeScript)** on the front end and **FastAPI** on the back end. The shopping assistant, "the Bulldog", is a **PydanticAI agent** that answers questions about prices and stock straight from the shop's SQLite database and puts matching products on the page as cards.

- **Shop:** browse, search (the Valet, ⌘K or `/`), save your size on file, and open any product's page with live stock by size.
- **Accounts:** sign up and log in, with PBKDF2-hashed passwords and signed session cookies. Logged-in chats are saved and come back next visit.
- **Chat:** honest answers on price and stock, every reply fact-checked against the database, sensitive data scrubbed, rate-limited, and logged to an append-only audit trail.

## Layout

```
hw4/
├── AI_prompts.md            # every prompt used to build this, by problem
├── requirements.txt         # backend Python dependencies
├── .env.example             # copy to .env and add an API key
├── .gitignore
├── README.md
├── frontend/                # Vite React TypeScript app
├── backend/
│   ├── main.py              # FastAPI app; run with: uvicorn main:app --reload
│   ├── agent.py             # the agent: model, prompt, tools, fact-check, chat()
│   ├── models.py            # Pydantic / PydanticAI types
│   ├── tools.py             # the agent's database tools
│   ├── prompts/prompt.md    # system prompt (voice, tool rules, safety rules)
│   ├── auth.py              # signup / login / sessions
│   ├── history.py           # saved chats for logged-in shoppers
│   ├── guardrails.py        # privacy scrubbing + chat rate limits
│   └── audit.py             # append-only output/audit_trail.json
└── output/
    ├── harness.md           # how the whole system works (start here)
    ├── design.md            # the house style, and why it sells
    ├── usability.md         # four usability improvements
    ├── app_check.html       # live app check with screenshots (open in a browser)
    ├── app_check_images/
    └── audit_trail.json     # agent-loop activity, appended every chat turn
```

The agent itself is four files under `backend/`: `prompts/prompt.md`, `agent.py`, `tools.py` and `models.py`.

## 1. Place the data pack (not in git)

Unzip the course data pack so the project has:

```
data/
├── campus_customs.db
└── products/          # images referenced by the catalogue
```

`data/` is git-ignored. The database and product images are never committed.

## 2. One-time setup

Requires Python 3.12+ and Node 20+.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm --prefix frontend install
cp .env.example .env
```

Then edit `.env` and add **one** API key. Gemini is set by default; OpenAI and Portkey also work:

```
LLM_PROVIDER=google
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-3.5-flash-lite
```

`.env` is git-ignored. The site and accounts work without a key; only the chat needs one.

## 3. Run it (two terminals)

**Back end** (FastAPI, from the `backend/` folder):

```bash
cd backend && ../.venv/bin/uvicorn main:app --reload --port 8000
```

**Front end** (Vite):

```bash
npm --prefix frontend run dev
```

Open **http://localhost:5173**. Vite forwards `/api` and `/images` to the backend on port 8000.

**Port 8000 busy?** Run the backend on another port and tell Vite where it is:

```bash
cd backend && ../.venv/bin/uvicorn main:app --reload --port 8010
```

```bash
BACKEND_URL=http://127.0.0.1:8010 npm --prefix frontend run dev
```

## 4. Try it

- **Log in** with the seeded test user from the data pack: `test@campuscustoms.yale.edu` / `password`. Or create an account.
- **Ask the Bulldog** (bottom-right):
  - *"What hoodies do you have?"* puts cards on the page.
  - On a product page, *"Do you have this in XL?"* gets live stock by size.
  - *"Anything in pink?"* gets an honest closest match.
- **Press `/`** anywhere to summon the Valet, and pick a size in the Tailor's Ledger on the Products page.

## Documentation

| File | What's in it |
|---|---|
| `output/harness.md` | The full system: data, auth, API, agent loading, tools, model fields and why, safety rules, audit trail, and specs (limits, caps, models, how to run) |
| `output/usability.md` | The Valet, the Tailor's Ledger, the Fact-Checker, the Bouncer |
| `output/design.md` | The preppy house style, Handbook-style |
| `output/app_check.html` | Live checks with screenshots |
| `AI_prompts.md` | The prompts used for each problem |
