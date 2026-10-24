# AI Prompts — Homework 4: Campus Customs Shop + Chatbot

These are the prompts I typed to my AI coding assistant (Claude Code), grouped by problem. Each problem lists my first prompt and any follow-up prompts, with a sentence explaining why each follow-up was needed.

---

## Problem 1: Vibe Coder Prompts

### Initial prompt

> i want to start homework #4

### Follow-up prompts

> here's the initial instructions and files

*What was lacking:* The project folder was empty, so the assistant didn't have the assignment or the data yet. This prompt gave it the scenario and data description, plus the `campus_customs.db` database and `products/` image folder.

> okay - create AI_prompts.md and keep it updated with all of my prompts going forward - this is part of how i get graded. create one section for each problem (this is problem 1). each section has to include the problem number and title, at least one prompt i typed, and (if necessary) any follow-up prompts that were needed to complete the assignment along with an explanatory sentence about what was lacking after the first one.

*What was lacking:* The prompts I give the assistant are part of my grade, so I needed it to keep a record of them in this file for every problem.

> it's called "vibe coder prompts"

*What was lacking:* The assistant didn't know the official problem title and had used a placeholder, so I gave it the real one.

---

## Problem 2: Understand the Database

### Initial prompt

> okay. problem 2: Look at the database data/campus_customs.db and "understand" the fields of each table. You should at least understands catalogue, inventory, and users. start the file output/harness.md. capture each table and its fields, and one short line on why each field matters for the shop or the chatbot. HEADS UP - we're gonna keep growing this "harness" file in later problems (models, tools, safety, specs)....

---

## Problem 3: Scaffold the Front End

### Initial prompt

> okay - #3: scaffold a react + vite + typescript front end for campus customs. put a nav bar at the top that links to the main pages: home; products; about us; log-in; create account. Pull campus-customs-style wording from yalebulldogblue.com for home and about us, but write the pages in a the style of "the preppy handbook" by lisa birnbach. Don't copy the original site text verbatim. on the prodcuts page, show product images from the catalogue (use the image paths in the database) with basic product info (name, price, short description). Make each product open a single-item page (large image on one side, full product text on the other - description, price, sizes/stock when you have them). When a shopper clicks a card on "products" it should take the shopper there. add a chat interface in the bottom right of the site (it can be a floating chat panel). it doesn't need to talk to an agent just yet...a stub that will call the back end later is enough for this problem. I'll need a small API soon to read the database. it's fine to start a simple FastAPI app in backend/main.py just to serve products and images, then grow it into the agent backend in product 5

### Follow-up prompts

> make the front end a little snappier. feel free to go with a Kiel James Patrick vibe for the design aesthetic...

*What was lacking:* The first version worked but felt slow. Every page refetched its data and showed plain "loading" text. The design was a generic navy-and-cream look, and I wanted something with more personality, a nautical New England prep style like Kiel James Patrick.

---

## Problem 4: Accounts and Login

### Initial prompt

> okay - on to problem 4. build a normal create-account /login flow. create account: first name, last name, email, password, and confirm password. log in: email and password. New accounts go into the users table. make sure to store passwords securely so hackers (human or ai) cannot access them. the seed database already has a test user you can use while building: email: test@campuscustoms.yale.edu; password: password; hash function: PBKDF2-HMAC-SHA256, 120,000 iterations (stored as pbkdf2_sha256$salt$hash). Here how login checks a password - you never un-hash the stored value you re-hash what the user typed and compare. read the salt out of the stored string (the middle piece) don't make a new one at login. hash the typed password with that same salt, then compare to the stored hash. use a constant-time compare. signup and login must use the same hash settings (same function, same slat handling, same iteration count). if they differ, even the right password won't match. surest check: log in as the seeded test user AND as a brand-new acct. you just created in the app. Confirm you can log in as that user, and that a brand new account that is created also works. Update output/harness.md with how auth works (what you store for a user and how passwords are protected).

---

## Problem 5: Shop Chatbot Agent

### Initial prompt

> okay - problem 5! build the shop chatbot as a pydanticAI agent behind FASTAPI, plugged into my front-end chat widget. putt the API app in backend/main.py - that's the file you run w/uvicorn. keep the agent as these four files next to it: backend/prompts/prompt.md (system prompt...we'll grow this same file later); backend/agent.py - agent entry/wiring; backend/tools.py - tools the agent can call; backend/models.py - pydantic/pydanticai structured types. In main.py, expose a chat route so a message from the website returns a reply form the agent (and whatever else you need for products/auth). use the API key that my professor gave me that i use for the Woulfe-report. put campus customs voice and safety basics in to prompts/prompt.md (we'll exapnd tools and safety later). start or update in models.py for chat replies/product cards as needed. in output/harness.md, note how the front end talks to fast API and how the agent is loaded (prompt file + model) makt sure the backend runs from the backend/ folder like this: uvicorn main:app --reload --port 8000

### Follow-up prompts

> i dunno what to tell you...figure it out. the woulfe-report program that I have uses an API key that my professor gave me. ya gotta dig around and figure out how to use it.

*What was lacking:* The agent was built, but it couldn't answer live. The API key in my terminal had hit its usage limit, and the assistant wouldn't read my other project's settings file without my say-so. This prompt told it to find and use the API key from my Woulfe Report project.

> open up a popup where i can paste in an openai api key that will go into the .env for this homework...

*What was lacking:* The Woulfe Report's OpenAI key worked, but that account had no credits left, so the chatbot still couldn't answer. I needed a safe way to give the assistant a new OpenAI key without pasting it into the chat.

---

## Problem 6: Database Lookup Tools

### Initial prompt

> okay! problem 6... give the agent tools that look up real information from campus_customs.db: product description; price; how many are in stock (by size when the customer asks) the agent has to use the database - it shouldn't invent prices or quantities. if a size is out of stock, it's gotta say so...clearly. expand prompts/prompt.md so the agent knows to call these tools for price and stock questions. add or update return types in models.py. in output/harness.md, list each tool and explain which model fields you choose for lookup results and why.

---

## Problem 7: Product Cards from Chat

### Initial prompt

> On to problem 7 - let's add another feature to the site. when a customer asks about a type of item (for example - "what hoodies do you have?") the agend should search the catalogue and the website should dynamically show those matching items as product cards (image, name, price, short info). This is an API Contract - the agent should return structured product matches and then the front end renders them on the website. it's supposed to look "really cool." after the dynami product cards are loaded by this new feature, make sure the same single-item page behavior we built in problem 3 still works. each product card (including the ones the chat just put on the page) should still open that detail view (large image + full info) when clicked. update prompts.prompt.md and output/harness.md so it is clear how search results reach the page.

---

## Problem 8: Chat History and Context

### Initial prompt

> Now for problem 8. when a shopper is logged in, save their chat history in the database in an appropriate table and reload it when they return. the agent should know who is chatting (name, email) - put that in agent deps (or an equivalent clear pattern) and/or tools the agent can call. Also, pass enough page context that if someone is on a product page and asks "do you have this in pink?", the agent knows which item they mean. feel free to put code into the agent context. guests can still chat, but history only needs to persist for logged-in users. document in output/harness.md: how user chat history is stored, what customer fields the agents sees, and how page context is passed.

---

## Problem 9: Usability Improvements

### Initial prompt

> aaaand look at us! problem 9! Now that the core shop works, you need to improve it. choose and implement 2 front-end usability improvements (make them wildly pretentious, though) and 2 agent / backend usability improvements (these should actually be good) front end imrrovements are things that make the site look better/easier to use. agent/backend improvements make agent output better, more accurate, safer. write output/usability.md before or as you build. for each of the improvements, say: what you added and why it helps a campus customs shopper or the business. then, make sure all improbements actyally show up in the running app. Graders are gonna read the write-up and look for features, so this shit has to be SMASHING.

---

## Problem 10: Storefront Design

### Initial prompt

> OKay - we're in double digits with 10. Go ALL OUT and make the site feel like a real campus customs storefront, but you've got to lean in HARD to the preppy handbook/KJP aesthetic. it should be pervasive in every element. Go wild with it. I'll be graded on creativity, and innovative design. write output/design.md...it should track what we changed and why it will kep customers stick around and buy. it should be crisp, short, and written in the preppy handbook style.

---

## Problem 11: Live App Check

### Initial prompt

> Wow - 11! Test the live site and document it in output/app_check.html (a page i can double-click open). include clear captions and short cpations for: 1) chat checking the inventory level of an item (honest stock/price form the DB) 2) the dynamic seach-result cards appearing after a category question (e.g. hoodies) 3) one of the usability features added in problem 9. Make the HTML easy to grade: heading for each check, screenshot, one or two sentences on what the screenshot proves, and a compliment in the preppy handbook style. put the screenshot image files in output/app_check_images/ and link them from app_check.html with relative paths (for example app_check_images/inventory.png).

---

## Problem 12: Audit Trail, Safety Rules, and Harness

### Initial prompt

> Number 12...we're cooking with gas now! keep an append-only output/audit_trail.json of agent-loop activity (time, tool name, short args/result, stop reason) Do not wipe it between runs. also think of some pertinent, useful safety rules to give the agent and put them in prompts/prompt.md. finish output/harness.md so it is clear how the system works: model fields in models.py and why you chose em; tools and abilities; safety rules; and specs (loop limits, result caps, models, how to run front + back)

---

## Problem 13: Push to GitHub and submit the URL

### Initial prompt

> okay - here's the instructions for 13...

*(Attached: a screenshot of the Problem 13 instructions. Put the code in a folder named `hw4` and push it to a public GitHub repository. Don't commit `.env`, `campus_customs.db` or product images; use `.gitignore` and include `.env.example` with placeholders. Follow the expected file layout, with a README explaining how to run the front and back end after placing the data pack.)*
