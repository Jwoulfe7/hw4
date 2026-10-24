"""Campus Customs backend: the FastAPI app the React site talks to.

Routes: product catalogue + images, account signup/login (auth.py), the shop
chatbot (agent.py, with tools.py, models.py and prompts/prompt.md), and saved chat
history for logged-in shoppers (history.py, in the chat_messages table).

Run from the backend/ folder:
    uvicorn main:app --reload --port 8000
"""

import json
import logging
import os
import sqlite3
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from pydantic_ai.exceptions import ModelHTTPError, UsageLimitExceeded

from agent import AgentNotConfigured, chat
from auth import build_auth
import audit
import history
from guardrails import ChatRateLimiter, notice_for, scrub
from models import ChatHistory, ChatRequest, ChatResponse, ShopDeps, Shopper
from tools import resolve_page

log = logging.getLogger("campus_customs")

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("CAMPUS_DATA_DIR", ROOT / "data"))
DB_PATH = DATA_DIR / "campus_customs.db"
IMAGES_DIR = DATA_DIR / "products"

SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"]

IMAGE_CACHE_SECONDS = 60 * 60 * 24  # product photos rarely change

app = FastAPI(title="Campus Customs API")
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class CachedStaticFiles(StaticFiles):
    """Static files with a Cache-Control header, so the browser keeps images between pages."""

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = f"public, max-age={IMAGE_CACHE_SECONDS}"
        return response


# Only the image folder is public. Never mount DATA_DIR itself: it holds the database.
app.mount("/images", CachedStaticFiles(directory=IMAGES_DIR), name="images")


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


auth_router, current_user = build_auth(get_conn, DATA_DIR)
app.include_router(auth_router)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    # FastAPI's default echoes the submitted values back, which would include passwords.
    fields = sorted({str(e["loc"][-1]) for e in exc.errors() if e.get("loc")})
    message = "Please check: " + ", ".join(f.replace("_", " ") for f in fields) if fields else "Invalid request."
    return JSONResponse(status_code=422, content={"detail": message})


def image_url(image_file_path: str) -> str:
    # Catalogue paths look like "products/foo.jpg"; images are served at /images/foo.jpg.
    return f"/images/{Path(image_file_path).name}"


def product_from_row(row: sqlite3.Row) -> dict:
    return {
        "product_id": row["product_id"],
        "name": row["name"],
        "garment_type": row["garment_type"],
        "description": row["description"],
        "colors": json.loads(row["colors"]),
        "search_tags": json.loads(row["search_tags"]),
        "price": row["price"],
        "image_url": image_url(row["image_file_path"]),
    }


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/products")
def list_products() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT c.*, COALESCE(SUM(i.quantity), 0) AS total_stock,
                   GROUP_CONCAT(CASE WHEN i.quantity > 0 THEN i.size END) AS sizes_csv
            FROM catalogue c
            LEFT JOIN inventory i ON i.product_id = c.product_id
            GROUP BY c.product_id
            ORDER BY c.name
            """
        ).fetchall()
    def in_stock(csv: str | None) -> list[str]:
        sizes = set((csv or "").split(",")) - {""}
        return [s for s in SIZE_ORDER if s in sizes]

    return [
        {**product_from_row(r), "total_stock": r["total_stock"], "sizes_in_stock": in_stock(r["sizes_csv"])}
        for r in rows
    ]


@app.get("/api/products/{product_id}")
def get_product(product_id: str) -> dict:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM catalogue WHERE product_id = ?", (product_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Product not found")
        stock_rows = conn.execute(
            "SELECT size, quantity FROM inventory WHERE product_id = ?", (product_id,)
        ).fetchall()

    stock = sorted(
        ({"size": s["size"], "quantity": s["quantity"]} for s in stock_rows),
        key=lambda s: SIZE_ORDER.index(s["size"]) if s["size"] in SIZE_ORDER else len(SIZE_ORDER),
    )
    return {
        **product_from_row(row),
        "stock": stock,
        "total_stock": sum(s["quantity"] for s in stock),
        "sizes_in_stock": [s["size"] for s in stock if s["quantity"] > 0],
    }


def shopper_from(user: sqlite3.Row) -> Shopper:
    """The customer fields the agent may see: name, email, member-since. Never the password hash."""
    first = user["first_name"] or user["name"].split(" ")[0]
    last = user["last_name"] or " ".join(user["name"].split(" ")[1:])
    return Shopper(
        user_id=user["id"],
        first_name=first,
        last_name=last,
        email=user["email"],
        member_since=(user["created_at"] or "")[:10],
    )


# The Bouncer's fair-use limits: per shopper (or per IP for guests).
chat_limiter = ChatRateLimiter(per_minute=8, per_day=200)


@app.post("/api/chat")
async def chat_route(body: ChatRequest, request: Request) -> ChatResponse:
    user = current_user(request)

    # The Bouncer, part 1: fair use. A friendly 429 instead of draining the AI quota for everyone.
    key = f"user:{user['id']}" if user else f"ip:{request.client.host if request.client else 'unknown'}"
    if wait := chat_limiter.check(key):
        audit.append({
            "time": audit.now(), "event": "blocked", "shopper": f"user:{user['id']}" if user else "guest",
            "stop_reason": "rate_limited", "retry_after_s": wait,
        })
        raise HTTPException(
            429,
            f"The Bulldog needs a breather: that's a lot of messages in a short time. Try again in about {wait} seconds.",
            headers={"Retry-After": str(wait)},
        )

    # The Bouncer, part 2: privacy. Card numbers, SSNs and passwords never reach the model or the database.
    message, found = scrub(body.message)
    if found:
        log.warning("Scrubbed %s from a chat message", ", ".join(found))

    # Logged in: the saved conversation in the database is the history (the client's copy is ignored).
    # Guest: nothing is saved, so the widget sends its recent turns (scrubbed too).
    if user:
        history_turns = history.load_turns(get_conn, user["id"])
    else:
        history_turns = [t.model_copy(update={"content": scrub(t.content)[0]}) for t in body.history]
    deps = ShopDeps(
        db_path=DB_PATH,
        shopper=shopper_from(user) if user else None,
        page=resolve_page(DB_PATH, body.page),
    )
    try:
        response = await chat(message, history_turns, deps)
    except AgentNotConfigured as e:
        log.error("Chat unavailable: %s", e)
        raise HTTPException(503, "The Bulldog is off duty right now (the chat isn't configured).")
    except UsageLimitExceeded:
        response = ChatResponse(reply="That one took me in circles. Could you ask it a little more simply?")
    except ModelHTTPError as e:
        # e.g. a provider quota or a bad model name: one clear log line, no traceback.
        log.error("Model call failed (%s, model=%s): %s", e.status_code, e.model_name, e.body)
        raise HTTPException(502, "The Bulldog couldn't fetch an answer just now. Please try again in a moment.")
    except Exception:
        log.exception("Chat failed")
        raise HTTPException(502, "The Bulldog couldn't fetch an answer just now. Please try again in a moment.")

    if found:
        response.notice = notice_for(found)
        response.redacted_message = message
    if user:
        history.save_exchange(get_conn, user["id"], message, response)
    return response


@app.get("/api/chat/history")
def chat_history(request: Request) -> ChatHistory:
    user = current_user(request)
    if user is None:
        raise HTTPException(401, "Log in to see saved chats.")
    return ChatHistory(messages=history.load_messages(get_conn, DB_PATH, user["id"]))


@app.delete("/api/chat/history", status_code=204)
def clear_chat_history(request: Request) -> None:
    user = current_user(request)
    if user is None:
        raise HTTPException(401, "Log in to manage saved chats.")
    history.clear(get_conn, user["id"])
