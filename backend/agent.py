"""The Campus Customs shop agent: model + system prompt + tools, and one entry point, chat().

Model: pick a provider in .env (LLM_PROVIDER), or the first one with a key:
    LLM_PROVIDER      "google", "openai" or "portkey" (optional)
    GEMINI_API_KEY    Google Gemini; GEMINI_MODEL default "gemini-3.8-flash"
    OPENAI_API_KEY    OpenAI directly (Responses API); CHAT_MODEL default "gpt-5.6-luna"
    PORTKEY_API_KEY   Portkey gateway (OpenAI-compatible); CHAT_MODEL, PORTKEY_BASE_URL

Prompt: prompts/prompt.md is re-read on every request, so edits take effect
without restarting the server.
"""

import logging
import os
import re
import time
import uuid
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from google.genai.types import HttpRetryOptions
from openai import AsyncOpenAI
from pydantic_ai import Agent, ModelRetry, RunContext
from pydantic_ai.exceptions import UnexpectedModelBehavior, UsageLimitExceeded
from pydantic_ai.messages import ModelMessage, ModelRequest, ModelResponse, TextPart, ToolCallPart, UserPromptPart
from pydantic_ai.models import Model
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.models.openai import OpenAIChatModel, OpenAIResponsesModel
from pydantic_ai.providers.google import GoogleProvider
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.usage import UsageLimits

from models import SIZE_NAMES, ChatResponse, ChatTurn, PageView, ShopDeps, Shopper, ShopReply
import audit
from tools import MAX_TOOL_CALLS_PER_TURN, SHOP_TOOLS, build_cards

BACKEND_DIR = Path(__file__).resolve().parent
PROMPT_PATH = BACKEND_DIR / "prompts" / "prompt.md"

# .env (project root, then backend/) wins over the shell, so the project's key is
# used even if an older PORTKEY_API_KEY is exported in your terminal.
load_dotenv(BACKEND_DIR.parent / ".env", override=True)
load_dotenv(BACKEND_DIR / ".env", override=True)
os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")

PROVIDERS = ("google", "openai", "portkey")
DEFAULT_MODEL = "gpt-5.6-luna"  # OpenAI / Portkey
DEFAULT_GEMINI_MODEL = "gemini-3.8-flash"  # same Flash model the Woulfe Report uses
DEFAULT_BASE_URL = "https://api.portkey.ai/v1"
MAX_HISTORY_TURNS = 20

# A runaway tool loop costs money; one chat turn never needs more than this.
LIMITS = UsageLimits(request_limit=8, tool_calls_limit=12)


class AgentNotConfigured(RuntimeError):
    pass


def provider() -> str:
    """LLM_PROVIDER if set ("google", "openai" or "portkey"); otherwise the first provider with a key."""
    chosen = os.getenv("LLM_PROVIDER", "").strip().lower()
    if chosen in PROVIDERS:
        return chosen
    if os.getenv("OPENAI_API_KEY"):
        return "openai"
    if os.getenv("GEMINI_API_KEY"):
        return "google"
    return "portkey"


def model_name() -> str:
    if provider() == "google":
        return os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
    return os.getenv("CHAT_MODEL", DEFAULT_MODEL)


def build_model() -> Model:
    if provider() == "google":
        key = os.getenv("GEMINI_API_KEY")
        if not key:
            raise AgentNotConfigured("LLM_PROVIDER=google but GEMINI_API_KEY is not set in .env.")
        # Retry a busy model (503) briefly, then give up so the shopper isn't left waiting for minutes.
        retry = HttpRetryOptions(attempts=2, initial_delay=1, max_delay=4, http_status_codes=[500, 502, 503, 504])
        return GoogleModel(model_name(), provider=GoogleProvider(api_key=key, retry_options=retry))

    if provider() == "openai":
        # Newer OpenAI models only take tools + structured output with reasoning on the Responses API.
        client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"], base_url=os.getenv("OPENAI_BASE_URL") or None)
        return OpenAIResponsesModel(model_name(), provider=OpenAIProvider(openai_client=client))

    key = os.getenv("PORTKEY_API_KEY")
    if not key:
        raise AgentNotConfigured("No AI key: set OPENAI_API_KEY or PORTKEY_API_KEY in .env.")
    client = AsyncOpenAI(
        api_key=key,
        base_url=os.getenv("PORTKEY_BASE_URL", DEFAULT_BASE_URL),
        default_headers={"x-portkey-api-key": key},
    )
    return OpenAIChatModel(model_name(), provider=OpenAIProvider(openai_client=client))


# --- The Fact-Checker -------------------------------------------------------------------
# Registered as the agent's output validator (see get_agent). Verifies every reply against
# what the tools returned this turn, before the shopper sees it: a price no tool returned, or a
# size check_stock said is SOLD OUT but the reply doesn't say so, raises ModelRetry with the
# correct facts and the model must rewrite the reply. Passing replies get a list of checks the
# chat widget shows as "Fact-checked against the stock room".

factcheck_log = logging.getLogger("campus_customs.factcheck")

PRICE_RE = re.compile(r"\$\s?(\d{1,4}(?:,\d{3})*(?:\.\d{1,2})?)")
NUMBER_RE = re.compile(r"\d+(?:\.\d{1,2})?")
SOLD_OUT_RE = re.compile(r"sold[\s-]*out|out of stock|unavailable|not available|none left|no longer (?:in stock|available)", re.I)


def _same(a: float, b: float) -> bool:
    return abs(a - b) < 0.005


def fact_check(ctx: RunContext[ShopDeps], out: ShopReply) -> ShopReply:
    deps = ctx.deps
    checks: list[str] = []

    # 1. Prices: every $ amount must be a catalogue price a tool returned this turn,
    #    or a number the shopper typed themselves (a budget like "under $60").
    quoted = [float(m.replace(",", "")) for m in PRICE_RE.findall(out.reply)]
    prompt = ctx.prompt if isinstance(ctx.prompt, str) else ""
    allowed = list(deps.seen_prices.values()) + [float(n) for n in NUMBER_RE.findall(prompt)]
    wrong = sorted({q for q in quoted if not any(_same(q, a) for a in allowed)})
    if wrong:
        deps.corrections += 1
        known = ", ".join(f"${p:,.2f}" for p in sorted(set(deps.seen_prices.values()))) or "none yet"
        factcheck_log.warning("Fact-check: unverified price(s) %s; tool prices this turn: %s", wrong, known)
        raise ModelRetry(
            f"Fact-check failed: your reply quotes {', '.join(f'${w:,.2f}' for w in wrong)}, but no tool returned "
            f"that price this turn (prices returned: {known}). Quote only prices from get_price or "
            "search_products results; call get_price if you need one."
        )
    matched = {q for q in quoted if any(_same(q, p) for p in deps.seen_prices.values())}
    if matched:
        n = len(matched)
        checks.append(f"{n} price{'s' if n > 1 else ''} matched the catalogue")

    # 2. Sold out: if check_stock said the requested size is sold out, the reply must say so plainly.
    sold = [(name, size) for name, size, status in deps.stock_verdicts if status == "sold_out"]
    if sold and not SOLD_OUT_RE.search(out.reply):
        deps.corrections += 1
        items = "; ".join(f"{SIZE_NAMES[size]} ({size}) of the {name}" for name, size in sold)  # type: ignore[index]
        factcheck_log.warning("Fact-check: reply didn't state sold-out size(s): %s", items)
        raise ModelRetry(
            f"Fact-check failed: check_stock reported SOLD OUT for {items}, but your reply doesn't say so. "
            'Start your reply by saying plainly that the size is sold out (use the words "sold out"), '
            "then offer sizes that are in stock."
        )
    if sold:
        checks.append("Sold-out size stated plainly")
    elif deps.stock_verdicts:
        checks.append("Stock confirmed live")

    if checks and deps.corrections:
        checks.append("Corrected before sending")
    deps.checks = checks
    return out


@lru_cache
def get_agent() -> Agent[ShopDeps, ShopReply]:
    """Built on first use, so the API (products, auth) still starts without a key."""
    agent = Agent(
        build_model(),
        deps_type=ShopDeps,
        output_type=ShopReply,
        tools=SHOP_TOOLS,
        retries=2,
        name="campus_customs_shop",
    )

    # The Fact-Checker: no unverified prices, no hidden sold-out sizes (see fact_check above).
    agent.output_validator(fact_check)

    @agent.instructions
    def system_prompt(ctx: RunContext[ShopDeps]) -> str:
        return "\n\n".join([
            PROMPT_PATH.read_text(encoding="utf-8"),
            shopper_context(ctx.deps.shopper),
            page_context(ctx.deps.page),
        ])

    return agent


def shopper_context(shopper: Shopper | None) -> str:
    """Who is chatting, as text for the agent. Built from ShopDeps.shopper, never from the chat."""
    if shopper is None:
        return (
            "## Who you're talking to\n\n"
            "A **guest** (not logged in). You don't know their name or email. Their chat isn't saved; "
            "if they ask, they can log in or create an account to keep their conversation."
        )
    return (
        "## Who you're talking to\n\n"
        f"A **logged-in customer**: {shopper.first_name} {shopper.last_name}, email {shopper.email}, "
        f"member since {shopper.member_since}. Their conversation is saved to their account, and earlier "
        "messages above may be from previous visits.\n"
        "- Greet them by first name when it fits; don't repeat their name in every message.\n"
        "- Only mention their email if they ask which account they're logged in with. Never read it out otherwise.\n"
        "- You can't see or change orders, passwords, or account settings."
    )


def page_context(page: PageView | None) -> str:
    """Where the shopper is on the site. Lets the agent resolve "this one", "these", etc."""
    if page is None:
        return "## Where they are on the site\n\nUnknown."
    lines = [f"## Where they are on the site\n\nThey're on `{page.path}`"]
    if page.kind == "product" and page.product_id:
        lines[0] += (
            f": the product page for **{page.product_name}** (product_id `{page.product_id}`).\n"
            f'- If they say "this", "it", "this one" or "this hoodie" without naming an item, they mean {page.product_name}. '
            f"Pass `{page.product_id}` straight to get_product_description / get_price / check_stock (no search needed), "
            "and include it in product_ids."
        )
    elif page.kind == "products":
        shown = ", ".join(f"{k} = {v}" for k, v in page.filters.items()) or "all products"
        lines[0] += f": the Products page, showing {shown}. \"These\" likely refers to that selection."
    else:
        lines[0] += f" (the {page.kind} page)."
    if page.preferred_size:
        lines.append(
            f"- Their size on file is **{page.preferred_size}**. If they say \"my size\" or ask whether something "
            f"fits without naming a size, check stock for {page.preferred_size}."
        )
    return "\n".join(lines)


def to_message_history(history: list[ChatTurn]) -> list[ModelMessage]:
    """The widget's recent turns, as PydanticAI messages."""
    messages: list[ModelMessage] = []
    for turn in history[-MAX_HISTORY_TURNS:]:
        if turn.role == "user":
            messages.append(ModelRequest(parts=[UserPromptPart(content=turn.content)]))
        else:
            messages.append(ModelResponse(parts=[TextPart(content=turn.content)]))
    return messages


FALLBACK_CARDS = 4
OUTPUT_TOOL_PREFIX = "final_result"  # PydanticAI's structured-output tool


async def chat(message: str, history: list[ChatTurn], deps: ShopDeps) -> ChatResponse:
    """Run one chat turn. Every run, successful or not, is appended to the audit trail."""
    started = time.perf_counter()
    prior = to_message_history(history)
    run = None
    response: ChatResponse | None = None
    stop_reason = "final_answer"
    try:
        # agent.iter (rather than agent.run) keeps the run's messages reachable even if it
        # fails partway, so the audit trail can show what happened before the stop.
        async with get_agent().iter(message, deps=deps, message_history=prior, usage_limits=LIMITS) as run:
            async for _ in run:
                pass
        out = run.result.output
        # Only show cards for products a tool actually returned this turn, and build
        # them from the database so names, prices, and photos are always real.
        ids = [pid for pid in out.product_ids if pid in deps.seen_product_ids]
        cards = build_cards(deps.db_path, ids)
        heading = (out.results_heading or "The Bulldog's picks").strip() if cards else None
        response = ChatResponse(reply=out.reply, products=cards, results_heading=heading, checks=deps.checks)
        return response
    except UnexpectedModelBehavior:
        # The model couldn't produce a reply that passed the fact-check (or valid output) after retries.
        # Don't show an unverified answer: show what the tools found, with prices from the database.
        stop_reason = "fact_check_failed_fallback"
        found = list(deps.seen_product_ids)[:FALLBACK_CARDS]
        response = ChatResponse(
            reply="I want to be exact with you, so here's what I found. The cards show current prices and sizes in stock.",
            products=build_cards(deps.db_path, found),
            results_heading="What I found" if found else None,
            checks=["Held back an answer that didn't match the catalogue"],
        )
        return response
    except UsageLimitExceeded:
        # The model kept calling tools past the cap. If its searches found anything,
        # show the best of it (first results seen) rather than a dead end.
        stop_reason = "usage_limit"
        if not deps.seen_product_ids:
            raise
        stop_reason = "usage_limit_fallback"
        found = list(deps.seen_product_ids)[:FALLBACK_CARDS]
        response = ChatResponse(
            reply="Here are a few good options I found. Tap one for sizes and details, or tell me more about what you're after.",
            products=build_cards(deps.db_path, found),
            results_heading="A few good options",
        )
        return response
    except Exception as e:
        status = getattr(e, "status_code", None)
        stop_reason = f"error:{type(e).__name__}" + (f":{status}" if status else "")
        raise
    finally:
        try:
            _record_run(message, deps, run, len(prior), stop_reason, response, started)
        except Exception:  # the audit trail must never break a shopper's chat
            audit.log.exception("Could not record the agent run")


def _record_run(message, deps: ShopDeps, run, prior_count: int, stop_reason: str, response, started: float) -> None:
    messages = list(run.ctx.state.message_history[prior_count:]) if run is not None else []
    output_tools = {
        p.tool_name for m in messages if isinstance(m, ModelResponse) for p in m.parts
        if isinstance(p, ToolCallPart) and p.tool_name.startswith(OUTPUT_TOOL_PREFIX)
    }
    steps = audit.steps_from(messages, output_tools)
    tool_calls = sum(1 for s in steps if s["step"] == "tool_call")
    usage = getattr(run, "usage", None)
    usage = usage() if callable(usage) else usage  # a property in PydanticAI 2.x
    finish = next((m.finish_reason for m in reversed(messages) if isinstance(m, ModelResponse)), None)
    audit.append({
        "time": audit.now(),
        "event": "agent_run",
        "run_id": uuid.uuid4().hex[:12],
        "shopper": f"user:{deps.shopper.user_id}" if deps.shopper else "guest",
        "page": deps.page.path if deps.page else None,
        "message": audit.short(message),
        "model": f"{provider()}:{model_name()}",
        "steps": steps,
        "tool_calls": tool_calls,
        "tool_budget_reached": tool_calls >= MAX_TOOL_CALLS_PER_TURN,
        "stop_reason": stop_reason,
        "model_finish_reason": finish,
        "fact_checks": deps.checks,
        "fact_check_corrections": deps.corrections,
        "reply": audit.short(response.reply) if response else None,
        "products_shown": [c.product_id for c in response.products] if response else [],
        "usage": {"requests": usage.requests, "input_tokens": usage.input_tokens, "output_tokens": usage.output_tokens} if usage else None,
        "duration_ms": round((time.perf_counter() - started) * 1000),
    })
