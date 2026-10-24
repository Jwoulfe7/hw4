"""Saved chat history for logged-in shoppers, in the chat_messages table.

One row per message:
    user rows:       role='user',      content=what they typed,  products_json=NULL
    assistant rows:  role='assistant', content=the reply (Markdown), products_json=JSON list of
                     product cards shown with it ('[]' when none)

This matches the rows already in the seed database. On reload, cards are rebuilt from the
database by product_id, so prices and stock shown are current, not as they were when saved.
"""

import json
import sqlite3
from collections.abc import Callable
from pathlib import Path

from models import ChatHistoryMessage, ChatResponse, ChatTurn
from tools import build_cards

GetConn = Callable[[], sqlite3.Connection]

AGENT_HISTORY_TURNS = 20  # recent messages the agent sees as conversation history
UI_HISTORY_MESSAGES = 60  # recent messages the widget shows after a reload


def _recent_rows(get_conn: GetConn, user_id: int, limit: int) -> list[sqlite3.Row]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT role, content, products_json, created_at FROM chat_messages"
            " WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    return list(reversed(rows))


def _product_ids(products_json: str | None) -> list[str]:
    """Ids from a saved products_json list. Tolerates the older full-product format and bad JSON."""
    try:
        items = json.loads(products_json or "[]")
    except json.JSONDecodeError:
        return []
    return [i["product_id"] for i in items if isinstance(i, dict) and isinstance(i.get("product_id"), str)]


def load_turns(get_conn: GetConn, user_id: int) -> list[ChatTurn]:
    """The shopper's recent conversation, as history for the agent."""
    return [
        ChatTurn(role=r["role"], content=r["content"][:4000])
        for r in _recent_rows(get_conn, user_id, AGENT_HISTORY_TURNS)
        if r["role"] in ("user", "assistant")
    ]


def load_messages(get_conn: GetConn, db_path: Path, user_id: int) -> list[ChatHistoryMessage]:
    """The shopper's recent messages for the widget, with product cards rebuilt from the database."""
    messages = []
    for r in _recent_rows(get_conn, user_id, UI_HISTORY_MESSAGES):
        if r["role"] not in ("user", "assistant"):
            continue
        ids = _product_ids(r["products_json"]) if r["role"] == "assistant" else []
        messages.append(
            ChatHistoryMessage(
                role=r["role"],
                content=r["content"],
                products=build_cards(db_path, ids) if ids else [],
                created_at=r["created_at"],
            )
        )
    return messages


def save_exchange(get_conn: GetConn, user_id: int, message: str, response: ChatResponse) -> None:
    """Store the shopper's message and the agent's reply together (one transaction)."""
    cards = json.dumps([card.model_dump() for card in response.products])
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, 'user', ?, NULL)",
            (user_id, message),
        )
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, 'assistant', ?, ?)",
            (user_id, response.reply, cards),
        )


def clear(get_conn: GetConn, user_id: int) -> int:
    with get_conn() as conn:
        return conn.execute("DELETE FROM chat_messages WHERE user_id = ?", (user_id,)).rowcount
