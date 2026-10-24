"""Tools the shop agent can call. Every description, price, and stock number comes from the database.

The agent never writes SQL; it can only call these functions, which run fixed,
parameterized, read-only queries against the catalogue and inventory tables (never users).

    search_products          find items (keywords + garment/color/size/price filters)
    get_product_description  what one item looks like
    get_price                one item's catalogue price
    check_stock              one item's live stock, by size, with an explicit sold-out status
"""

import json
import re
import sqlite3
from dataclasses import replace
from pathlib import Path
from typing import Literal

from pydantic_ai import ModelRetry, RunContext, Tool
from pydantic_ai.tools import ToolDefinition

from models import (
    SIZE_NAMES,
    SIZE_ORDER,
    CatalogueRecord,
    PageContext,
    PageView,
    PriceQuote,
    ProductCard,
    ProductDescription,
    ProductSummary,
    ShopDeps,
    SizeAvailability,
    SizeCode,
    SizeStock,
    StockReport,
    stock_status,
)

Garment = Literal["t-shirt", "crewneck", "hoodie", "quarter-zip", "jacket", "long-sleeve"]

MAX_RESULTS = 10
# After this many tool calls in one chat turn, the tools are withdrawn so the model must answer
# with what it found (smaller models otherwise keep searching for synonyms). Four covers the
# longest normal question: search -> description -> price -> stock.
MAX_TOOL_CALLS_PER_TURN = 4
STOPWORDS = {
    "a", "an", "the", "and", "or", "for", "with", "in", "of", "to", "on", "my", "me", "i",
    "do", "you", "have", "any", "some", "something", "yale", "show", "want", "looking",
}
SYNONYMS = {"tee": "t shirt", "tshirt": "t shirt", "grey": "gray", "quarterzip": "quarter zip", "sweater": "sweatshirt"}

# Shoppers name colors loosely; the catalogue names them precisely ("dusty coral", "heather charcoal").
COLOR_FAMILIES: dict[str, tuple[str, ...]] = {
    "pink": ("pink", "coral", "rose", "salmon", "blush"),
    "red": ("red", "crimson", "maroon", "cardinal"),
    "blue": ("blue", "navy", "royal"),
    "gray": ("gray", "heather", "charcoal", "silver"),
    "white": ("white", "cream", "ivory", "natural"),
    "cream": ("cream", "ivory", "natural"),
    "yellow": ("yellow", "gold"),
    "gold": ("gold", "yellow"),
    "black": ("black", "charcoal"),
}


def _color_words(color: str) -> tuple[str, ...]:
    return COLOR_FAMILIES.get(color, (color,))


SIZE_ALIASES: dict[str, SizeCode] = {
    "xs": "XS", "x small": "XS", "xsmall": "XS", "extra small": "XS",
    "s": "S", "sm": "S", "small": "S",
    "m": "M", "med": "M", "medium": "M",
    "l": "L", "lg": "L", "large": "L",
    "xl": "XL", "x large": "XL", "xlarge": "XL", "extra large": "XL",
    "xxl": "XXL", "2xl": "XXL", "xx large": "XXL", "xxlarge": "XXL", "double xl": "XXL", "extra extra large": "XXL",
}


# --- Database access ------------------------------------------------------------------


def _connect(db_path: Path) -> sqlite3.Connection:
    # Read-only: the agent's tools can never change the shop's data.
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def _image_url(image_file_path: str) -> str:
    return f"/images/{Path(image_file_path).name}"


def _in_clause(ids: list[str]) -> str:
    return f"({','.join('?' * len(ids))})"


def load_products(db_path: Path, product_ids: list[str] | None = None) -> dict[str, CatalogueRecord]:
    """Catalogue rows joined with per-size stock, keyed by product_id (optionally just some ids)."""
    where, params = "", ()
    if product_ids is not None:
        if not product_ids:
            return {}
        where, params = f" WHERE product_id IN {_in_clause(product_ids)}", tuple(product_ids)

    with _connect(db_path) as conn:
        rows = conn.execute(f"SELECT * FROM catalogue{where}", params).fetchall()
        stock_rows = conn.execute(f"SELECT product_id, size, quantity FROM inventory{where}", params).fetchall()

    stock: dict[str, dict[str, int]] = {}
    for s in stock_rows:
        stock.setdefault(s["product_id"], {})[s["size"]] = s["quantity"]

    products = {}
    for r in rows:
        # Every size we make, in order; a size with no inventory row counts as 0 on hand.
        on_hand = stock.get(r["product_id"], {})
        sizes = [SizeStock(size=size, quantity=on_hand.get(size, 0)) for size in SIZE_ORDER]
        colors = json.loads(r["colors"])
        products[r["product_id"]] = CatalogueRecord(
            product_id=r["product_id"],
            name=r["name"],
            garment_type=r["garment_type"],
            price=r["price"],
            main_color=colors[0] if colors else None,
            colors=colors,
            description=r["description"],
            search_tags=json.loads(r["search_tags"]),
            stock=sizes,
            sizes_in_stock=[s.size for s in sizes if s.quantity > 0],
        )
    return products


def image_paths(db_path: Path, product_ids: list[str]) -> dict[str, str]:
    if not product_ids:
        return {}
    with _connect(db_path) as conn:
        rows = conn.execute(
            f"SELECT product_id, image_file_path FROM catalogue WHERE product_id IN {_in_clause(product_ids)}",
            tuple(product_ids),
        ).fetchall()
    return {r["product_id"]: _image_url(r["image_file_path"]) for r in rows}


def build_cards(db_path: Path, product_ids: list[str]) -> list[ProductCard]:
    """Cards for the chat widget, in the agent's order, built only from database rows."""
    ids = list(dict.fromkeys(product_ids))  # de-duplicate, keep order
    products = load_products(db_path, ids)
    images = image_paths(db_path, ids)
    return [
        ProductCard(
            product_id=p.product_id,
            name=p.name,
            garment_type=p.garment_type,
            price=p.price,
            price_display=f"${p.price:,.2f}",
            image_url=images[p.product_id],
            main_color=p.main_color,
            colors=p.colors,
            short_description=_shorten(p.description),
            sizes_in_stock=p.sizes_in_stock,
            low_stock_sizes=[s.size for s in p.stock if stock_status(s.quantity) == "low_stock"],
            sold_out=not p.sizes_in_stock,
        )
        for pid in ids
        if (p := products.get(pid))
    ]


def _shorten(text: str, limit: int = 110) -> str:
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0].rstrip(",;:") + "…"


# --- Matching helpers ---------------------------------------------------------------------


def garment_of(garment_type: str) -> Garment:
    """Fold the catalogue's ~22 garment_type labels into six kinds (same rules as the website)."""
    t = garment_type.lower()
    if "quarter-zip" in t:
        return "quarter-zip"
    if "t-shirt" in t:
        return "t-shirt"
    if "jacket" in t or "full-zip" in t:
        return "jacket"
    if "hood" in t:
        return "hoodie"
    if "crew" in t or "mockneck" in t:
        return "crewneck"
    return "long-sleeve"


def _normalize(text: str) -> str:
    text = re.sub(r"[-/_]", " ", text.lower())
    return " ".join(SYNONYMS.get(w, w) for w in text.split())


def _query_terms(query: str) -> list[str]:
    terms = []
    for word in re.findall(r"[a-z0-9']+", _normalize(query)):
        if word in STOPWORDS or len(word) < 2:
            continue
        if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
            word = word[:-1]  # hoodies -> hoodie, shirts -> shirt
        terms.append(word)
    return terms


def normalize_size(raw: str) -> SizeCode | None:
    """'medium' -> 'M', 'x-large' -> 'XL', '2XL' -> 'XXL'. None for sizes we don't make (e.g. '3XL')."""
    key = re.sub(r"[\s_-]+", " ", raw.strip().lower()).removesuffix(" size").strip()
    return SIZE_ALIASES.get(key) or SIZE_ALIASES.get(key.replace(" ", ""))


def _record(ctx: RunContext[ShopDeps], product_id: str) -> CatalogueRecord:
    record = load_products(ctx.deps.db_path, [product_id]).get(product_id)
    if record is None:
        raise ModelRetry(f"No product has id {product_id!r}. Use search_products to find the right id.")
    ctx.deps.saw(product_id)
    return record


def _stock_summary(record: CatalogueRecord, sizes: list[SizeAvailability], asked: str | None, size: SizeCode | None) -> str:
    parts = []
    if asked is not None and size is None:
        parts.append(f"We don't make the {record.name} in size {asked!r}; our sizes run XS to XXL.")
    elif size is not None:
        s = next(a for a in sizes if a.size == size)
        label = f"{SIZE_NAMES[size]} ({size})"
        parts.append(
            f"{label} is SOLD OUT." if s.status == "sold_out"
            else f"{label}: only {s.quantity} left." if s.status == "low_stock"
            else f"{label}: in stock ({s.quantity} on hand)."
        )
    in_stock = [a for a in sizes if a.quantity > 0]
    sold_out = [a.size for a in sizes if a.quantity == 0]
    if not in_stock:
        parts.append("Sold out in every size.")
    else:
        parts.append("In stock: " + ", ".join(f"{a.size} ({a.quantity})" for a in in_stock) + ".")
        if sold_out:
            parts.append("Sold out: " + ", ".join(sold_out) + ".")
    return " ".join(parts)


def resolve_page(db_path: Path, page: PageContext | None) -> PageView | None:
    """Turn what the website says about the current page into a verified PageView.

    On a product page the id comes from the /products/{id} path and is checked against the
    catalogue, so a stale or tampered value can't point the agent at a product that doesn't exist.
    """
    if page is None:
        return None
    size = normalize_size(page.preferred_size) if page.preferred_size else None
    view = _resolve_route(db_path, page)
    return replace(view, preferred_size=size)


def _resolve_route(db_path: Path, page: PageContext) -> PageView:
    path = page.path.split("#")[0][:200] or "/"
    route = path.split("?")[0].rstrip("/") or "/"
    if m := re.fullmatch(r"/products/([\w-]+)", route):
        product_id = m.group(1)  # the URL is the source of truth for which product is open
        record = load_products(db_path, [product_id]).get(product_id)
        if record:
            return PageView(path=path, kind="product", product_id=record.product_id, product_name=record.name)
        return PageView(path=path, kind="other")
    if route == "/products":
        filters = {k: v for k, v in (("category", page.category), ("collection", page.collection), ("q", page.search)) if v}
        return PageView(path=path, kind="products", filters=filters)
    kinds = {"/": "home", "/about": "about", "/login": "login", "/signup": "signup"}
    return PageView(path=path, kind=kinds.get(route, "other"))


# --- Tools ------------------------------------------------------------------------------------


def search_products(
    ctx: RunContext[ShopDeps],
    query: str = "",
    garment: Garment | None = None,
    color: str | None = None,
    size: SizeCode | None = None,
    max_price: float | None = None,
    limit: int = 6,
) -> list[ProductSummary]:
    """Find products in the Campus Customs catalogue. Use this before naming or recommending any product.

    Results include each item's product_id, price, colors, and sizes in stock, which is
    enough for browsing questions; reply right away if they answer the question.

    Args:
        query: Free-text keywords, e.g. "Saybrook", "hockey", "dad", "Harvard Yale", "fleece".
            Leave empty to browse using only the filters.
        garment: Limit to one kind of garment.
        color: Limit to items whose garment (body) color is this, e.g. "navy", "gray", "white".
        size: Limit to items with this size in stock right now.
        max_price: Limit to items at or under this price in US dollars.
        limit: How many results to return (1-10). Best matches come first.
    """
    terms = _query_terms(query)
    wanted_color = _normalize(color) if color else None
    scored: list[tuple[int, CatalogueRecord]] = []

    for p in load_products(ctx.deps.db_path).values():
        if garment and garment_of(p.garment_type) != garment:
            continue
        # Match the garment's own color, not lettering ("navy hoodie" shouldn't return a gray
        # hoodie with navy text). A few items list no colors; use the description's opening.
        if wanted_color and not any(w in _normalize(p.main_color or p.description[:40]) for w in _color_words(wanted_color)):
            continue
        if size and size not in p.sizes_in_stock:
            continue
        if max_price is not None and p.price > max_price:
            continue
        haystack = _normalize(" ".join([p.name, p.garment_type, p.description, *p.colors, *p.search_tags]))
        score = sum(any(w in haystack for w in _color_words(term)) for term in terms) + sum(
            2 for term in terms if term in _normalize(p.name)
        )
        if terms and score == 0:
            continue
        scored.append((score, p))

    scored.sort(key=lambda sp: (-sp[0], sp[1].name))
    results = [
        ProductSummary(**p.model_dump(include=set(ProductSummary.model_fields)))
        for _, p in scored[: max(1, min(limit, MAX_RESULTS))]
    ]
    ctx.deps.saw(*(r.product_id for r in results))
    ctx.deps.seen_prices.update({r.product_id: r.price for r in results})
    return results


def get_product_description(ctx: RunContext[ShopDeps], product_id: str) -> ProductDescription:
    """What one product looks like: garment type, colors, and the catalogue description.

    Use this when the shopper asks what an item looks like, what's on it, or what it's made like.

    Args:
        product_id: An id from search_products, e.g. "saybrook-college-crewneck".
    """
    record = _record(ctx, product_id)
    return ProductDescription(**record.model_dump(include=set(ProductDescription.model_fields)))


def get_price(ctx: RunContext[ShopDeps], product_id: str) -> PriceQuote:
    """The exact catalogue price of one product, in US dollars.

    Use this whenever the shopper asks how much a specific item costs. Never estimate a price.

    Args:
        product_id: An id from search_products, e.g. "saybrook-college-crewneck".
    """
    record = _record(ctx, product_id)
    ctx.deps.seen_prices[record.product_id] = record.price
    return PriceQuote(
        product_id=record.product_id,
        name=record.name,
        price=record.price,
        price_display=f"${record.price:,.2f}",
    )


def check_stock(ctx: RunContext[ShopDeps], product_id: str, size: str | None = None) -> StockReport:
    """Live stock for one product: units on hand in every size, and whether each is sold out.

    Use this whenever the shopper asks if an item is available, in stock, or how many are left,
    especially in a particular size. If the report says a size is SOLD OUT, tell the shopper plainly.

    Args:
        product_id: An id from search_products, e.g. "saybrook-college-crewneck".
        size: The size the shopper asked about, if any, as they said it ("M", "medium", "XL",
            "2XL"...). Leave empty to get every size.
    """
    record = _record(ctx, product_id)
    sizes = [SizeAvailability(size=s.size, quantity=s.quantity, status=stock_status(s.quantity)) for s in record.stock]
    code = normalize_size(size) if size else None
    chosen = next((a for a in sizes if a.size == code), None)
    if chosen:
        ctx.deps.stock_verdicts.append((record.name, chosen.size, chosen.status))
    return StockReport(
        product_id=record.product_id,
        name=record.name,
        requested_size=code,
        requested_size_offered=None if size is None else code is not None,
        requested_size_quantity=chosen.quantity if chosen else None,
        requested_size_status=chosen.status if chosen else None,
        sizes=sizes,
        in_stock_sizes=[a.size for a in sizes if a.quantity > 0],
        sold_out_sizes=[a.size for a in sizes if a.quantity == 0],
        total_units=sum(a.quantity for a in sizes),
        summary=_stock_summary(record, sizes, size, code),
    )


async def _within_budget(ctx: RunContext[ShopDeps], tool_def: ToolDefinition) -> ToolDefinition | None:
    return tool_def if ctx.usage.tool_calls < MAX_TOOL_CALLS_PER_TURN else None


SHOP_TOOLS = [
    Tool(fn, prepare=_within_budget)
    for fn in (search_products, get_product_description, get_price, check_stock)
]
