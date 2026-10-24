"""Pydantic / PydanticAI types shared by the API, the agent, and its tools."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

SizeCode = Literal["XS", "S", "M", "L", "XL", "XXL"]
SIZE_ORDER: list[SizeCode] = ["XS", "S", "M", "L", "XL", "XXL"]
SIZE_NAMES: dict[SizeCode, str] = {
    "XS": "Extra Small", "S": "Small", "M": "Medium", "L": "Large", "XL": "Extra Large", "XXL": "XX-Large",
}

StockStatus = Literal["in_stock", "low_stock", "sold_out"]
LOW_STOCK_THRESHOLD = 5  # 1-5 units left counts as "low stock"


def stock_status(quantity: int) -> StockStatus:
    if quantity <= 0:
        return "sold_out"
    return "low_stock" if quantity <= LOW_STOCK_THRESHOLD else "in_stock"


# --- Internal record: one catalogue row joined with its inventory ------------------


class SizeStock(BaseModel):
    size: SizeCode
    quantity: int


class CatalogueRecord(BaseModel):
    """Everything the database knows about one product. The tools return slices of this."""

    product_id: str
    name: str
    garment_type: str
    price: float
    main_color: str | None
    colors: list[str]
    description: str
    search_tags: list[str]
    stock: list[SizeStock]
    sizes_in_stock: list[SizeCode]


# --- What the tools hand the agent (one model per tool) ----------------------------


class ProductSummary(BaseModel):
    """search_products: one hit. Enough to pick and recommend items; use the lookup tools for specifics."""

    product_id: str = Field(description="Pass this to the other tools and list it in product_ids.")
    name: str
    garment_type: str
    price: float = Field(description="US dollars, from the catalogue.")
    main_color: str | None = Field(description="The garment's own color. None if the catalogue doesn't say.")
    colors: list[str] = Field(description="Every color on the item: the garment first, then lettering and graphics.")
    description: str
    sizes_in_stock: list[SizeCode] = Field(description="Sizes with at least one unit on hand right now.")


class ProductDescription(BaseModel):
    """get_product_description: what the item looks like. No price or stock."""

    product_id: str
    name: str
    garment_type: str = Field(description="e.g. 'crewneck sweatshirt', 'pullover hoodie'.")
    main_color: str | None = Field(description="The garment's own color. None if the catalogue doesn't say.")
    colors: list[str] = Field(description="Every color on the item: the garment first, then lettering and graphics.")
    description: str = Field(description="The catalogue's description. Quote or paraphrase it; don't add details.")


class PriceQuote(BaseModel):
    """get_price: the catalogue price for one product."""

    product_id: str
    name: str
    price: float = Field(description="The exact catalogue price in US dollars.")
    currency: Literal["USD"] = "USD"
    price_display: str = Field(description='Ready to quote to the shopper, e.g. "$58.00".')


class SizeAvailability(BaseModel):
    size: SizeCode
    quantity: int = Field(description="Units on hand right now.")
    status: StockStatus = Field(description="sold_out = 0 units; low_stock = 1-5; in_stock = more than 5.")


class StockReport(BaseModel):
    """check_stock: live inventory for one product, optionally focused on one size."""

    product_id: str
    name: str
    requested_size: SizeCode | None = Field(
        description="The size the shopper asked about, normalized (e.g. 'medium' -> 'M'). None if no size, or a size we don't make."
    )
    requested_size_offered: bool | None = Field(
        description="False if the shopper asked for a size this shop doesn't make (we only make XS-XXL). None if no size was asked."
    )
    requested_size_quantity: int | None = Field(description="Units on hand in the requested size.")
    requested_size_status: StockStatus | None = Field(description="Status of the requested size.")
    sizes: list[SizeAvailability] = Field(description="Every size, XS to XXL, with quantity and status.")
    in_stock_sizes: list[SizeCode] = Field(description="Sizes with at least one unit (in_stock or low_stock).")
    sold_out_sizes: list[SizeCode] = Field(description="Sizes with zero units.")
    total_units: int = Field(description="Units on hand across all sizes.")
    summary: str = Field(description="A plain-English summary to base your answer on, e.g. 'Medium (M) is SOLD OUT. In stock: XS, S, L.'")


# --- What the agent hands back -------------------------------------------------


class ShopReply(BaseModel):
    """The agent's structured output for one chat turn."""

    reply: str = Field(
        description="Your message to the shopper, in Markdown. Short and friendly, in the Campus Customs voice."
    )
    product_ids: list[str] = Field(
        default_factory=list,
        max_length=6,
        description=(
            "product_id values to show on the website as product cards, best match first. "
            "Only ids returned by your tools this turn. Empty when no product fits."
        ),
    )
    results_heading: str | None = Field(
        default=None,
        max_length=60,
        description=(
            "A short title for the cards shown on the page, naming what was found, e.g. "
            "'Navy hoodies', 'Gifts for Dad under $60', 'Saybrook College'. Null when product_ids is empty."
        ),
    )


# --- Per-request context the tools can see ------------------------------------------


@dataclass(frozen=True)
class Shopper:
    """The logged-in customer, as the agent sees them. Never includes the password hash."""

    user_id: int
    first_name: str
    last_name: str
    email: str
    member_since: str  # YYYY-MM-DD


@dataclass(frozen=True)
class PageView:
    """Where the shopper is on the site right now, resolved by the backend from the request."""

    path: str
    kind: Literal["home", "products", "product", "about", "login", "signup", "other"]
    product_id: str | None = None  # set (and verified to exist) on a product page
    product_name: str | None = None
    filters: dict[str, str] = field(default_factory=dict)  # Products page: category / collection / q
    preferred_size: SizeCode | None = None  # the shopper's size on file (The Tailor's Ledger)


@dataclass
class ShopDeps:
    db_path: Path
    shopper: Shopper | None = None  # None for guests
    page: PageView | None = None
    # Every product id a tool returned this turn, in the order first seen. Cards are
    # only built from these, so the agent can't put an invented product on the page.
    seen_product_ids: dict[str, None] = field(default_factory=dict)
    # The Fact-Checker's evidence: what the tools actually returned this turn.
    seen_prices: dict[str, float] = field(default_factory=dict)  # product_id -> catalogue price
    stock_verdicts: list[tuple[str, str, str]] = field(default_factory=list)  # (name, size, status) from check_stock
    checks: list[str] = field(default_factory=list)  # what the fact-check confirmed (shown in the chat)
    corrections: int = 0  # replies sent back to the model for fixing

    def saw(self, *product_ids: str) -> None:
        for pid in product_ids:
            self.seen_product_ids.setdefault(pid, None)


# --- The /api/chat contract with the React app ------------------------------------------


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class PageContext(BaseModel):
    """What the website reports about the page the shopper is on. Verified by the backend."""

    path: str = Field(max_length=200, description='e.g. "/products/basic-hoodie-big-yale" or "/products?category=Hoodies".')
    product_id: str | None = Field(default=None, max_length=120, description="Set on a product page.")
    category: str | None = Field(default=None, max_length=60)
    collection: str | None = Field(default=None, max_length=60)
    search: str | None = Field(default=None, max_length=120)
    preferred_size: str | None = Field(default=None, max_length=10, description="The shopper's size on file, if they set one.")


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    # Used for guests only. For logged-in shoppers the server loads history from the database.
    history: list[ChatTurn] = Field(default_factory=list, max_length=40)
    page: PageContext | None = None


class ProductCard(BaseModel):
    """One product match for the website to render. Built from the database, never from model text."""

    product_id: str = Field(description="Links to the product page: /products/{product_id}.")
    name: str
    garment_type: str
    price: float
    price_display: str = Field(description='Formatted price, e.g. "$58.00".')
    image_url: str = Field(description="Served by the backend at /images/{file}.")
    main_color: str | None
    colors: list[str]
    short_description: str = Field(description="The catalogue description, trimmed to about 110 characters.")
    sizes_in_stock: list[SizeCode]
    low_stock_sizes: list[SizeCode] = Field(description="Sizes with 1-5 left.")
    sold_out: bool = Field(description="True when every size is at 0.")


class ChatResponse(BaseModel):
    """The /api/chat reply: the agent's message plus structured product matches for the page."""

    reply: str = Field(description="Markdown for the chat bubble.")
    products: list[ProductCard] = Field(default_factory=list, description="Matches to render as cards, best first.")
    results_heading: str | None = Field(default=None, description="Title for the cards on the page.")
    checks: list[str] = Field(default_factory=list, description="Fact-checks this reply passed, e.g. 'Prices match the catalogue'.")
    notice: str | None = Field(default=None, description="A safety notice for the shopper (e.g. sensitive data was removed).")
    redacted_message: str | None = Field(default=None, description="The shopper's message as saved, if anything was removed from it.")


class ChatHistoryMessage(BaseModel):
    """One saved message, as the widget shows it after a reload."""

    role: Literal["user", "assistant"]
    content: str
    products: list[ProductCard] = Field(default_factory=list)
    created_at: str


class ChatHistory(BaseModel):
    messages: list[ChatHistoryMessage]
