"""Append-only audit trail of agent-loop activity: output/audit_trail.json.

One JSON object per chat turn (or per blocked request), appended to a JSON array.
Appending only ever replaces the file's final "]" with ",\\n{entry}\\n]", so existing
entries are never rewritten or removed, and the file stays valid JSON throughout.
Nothing here deletes or rotates the file: it is not wiped between runs.

What's logged: time, run id, who (user id or "guest", never names or emails), page,
the *scrubbed* message (sensitive data already removed), model, each step (tool name,
short args, short result, timestamps), stop reason, fact-check results, token usage.
"""

import fcntl
import json
import logging
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pydantic import BaseModel
from pydantic_ai.messages import ModelMessage, ModelRequest, ModelResponse, RetryPromptPart, ToolCallPart, ToolReturnPart

log = logging.getLogger("campus_customs.audit")

ROOT = Path(__file__).resolve().parent.parent
AUDIT_PATH = Path(os.environ.get("AUDIT_TRAIL_PATH", ROOT / "output" / "audit_trail.json"))
SHORT = 160  # max characters for args / results / messages in the trail

_lock = threading.Lock()


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def short(value: Any, limit: int = SHORT) -> str:
    text = value if isinstance(value, str) else json.dumps(value, default=str, ensure_ascii=False, separators=(",", ":"))
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def append(entry: dict[str, Any], path: Path | None = None) -> None:
    """Append one entry to the JSON array at `path`. Never rewrites earlier entries."""
    path = path or AUDIT_PATH
    record = json.dumps(entry, ensure_ascii=False, default=str).encode()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with _lock:
            fd = os.open(path, os.O_RDWR | os.O_CREAT, 0o644)
            with os.fdopen(fd, "r+b") as f:
                fcntl.flock(f, fcntl.LOCK_EX)  # also safe across processes
                size = f.seek(0, os.SEEK_END)
                if size == 0:
                    f.write(b"[\n" + record + b"\n]\n")
                    return
                back = min(size, 64)
                f.seek(size - back)
                tail = f.read(back)
                close = tail.rstrip().rfind(b"]")
                if close == -1:
                    log.error("Audit trail %s doesn't end with ']'; not appending (file left untouched).", path)
                    return
                body = tail[:close].rstrip()
                sep = b"\n" if body.endswith(b"[") else b",\n"
                f.seek(size - back + close)
                f.truncate()
                f.write(sep + record + b"\n]\n")
    except OSError:
        log.exception("Could not write the audit trail")  # never break the chat over logging


# --- Summarizing an agent run ------------------------------------------------------------


def describe_result(content: Any) -> str:
    """A short, human-readable summary of what a tool returned."""
    if isinstance(content, list):
        names = [getattr(c, "name", None) for c in content]
        shown = ", ".join(n for n in names[:4] if n)
        return short(f"{len(content)} result(s): {shown}{', …' if len(content) > 4 else ''}")
    if hasattr(content, "summary"):  # StockReport
        return short(content.summary)
    if hasattr(content, "price_display"):  # PriceQuote
        return short(f"{content.name}: {content.price_display}")
    if hasattr(content, "description") and hasattr(content, "name"):  # ProductDescription
        return short(f"{content.name}: {content.description}")
    if isinstance(content, BaseModel):
        return short(content.model_dump())
    return short(str(content))


def _ts(part: Any, message: ModelMessage) -> str | None:
    t = getattr(part, "timestamp", None) or getattr(message, "timestamp", None)
    return t.isoformat(timespec="milliseconds").replace("+00:00", "Z") if t else None


def steps_from(messages: list[ModelMessage], output_tools: set[str]) -> list[dict[str, Any]]:
    """Turn the run's new messages into an ordered list of loop steps."""
    steps: list[dict[str, Any]] = []
    for m in messages:
        if isinstance(m, ModelResponse):
            for p in m.parts:
                if isinstance(p, ToolCallPart):
                    if p.tool_name in output_tools:
                        steps.append({"time": _ts(p, m), "step": "final_answer", "tool": p.tool_name,
                                      "args": short(p.args_as_dict().get("reply", ""))})
                    else:
                        steps.append({"time": _ts(p, m), "step": "tool_call", "tool": p.tool_name, "args": short(p.args_as_dict())})
        elif isinstance(m, ModelRequest):
            for p in m.parts:
                if isinstance(p, ToolReturnPart):
                    if p.tool_name in output_tools:
                        text = str(p.content)
                        if "Fact-check failed" in text:
                            steps.append({"time": _ts(p, m), "step": "fact_check_retry", "tool": p.tool_name, "result": short(text)})
                        continue
                    steps.append({"time": _ts(p, m), "step": "tool_result", "tool": p.tool_name, "result": describe_result(p.content)})
                elif isinstance(p, RetryPromptPart):
                    steps.append({"time": _ts(p, m), "step": "retry", "tool": p.tool_name, "result": short(str(p.content))})
    return steps
