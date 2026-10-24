"""The Bouncer: privacy scrubbing and fair-use limits for the chat.

scrub()        removes payment card numbers (Luhn-checked), SSNs, card security codes and
               "my password is ..." values from a message *before* it reaches the AI model
               or the chat_messages table.
ChatRateLimiter  caps messages per shopper (or per IP for guests): a burst limit per minute
               and a daily ceiling, so one script can't drain the AI quota for everyone.
"""

import re
import time
from collections import defaultdict, deque

# --- Privacy scrubbing ------------------------------------------------------------------

CARD_RE = re.compile(r"(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)")
SSN_RE = re.compile(r"(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)")
CVV_RE = re.compile(r"(?i)\b(cvv2?|cvc|csc|security code)\b(\s*(?:is|:|=|#)?\s*)\d{3,4}\b")
PASSWORD_RE = re.compile(r"(?i)\b(pass(?:word|code|wd)?|pwd)\b(\s*(?:is|:|=)\s*)(?!\[)(\S+)")

LABELS = {
    "card": "a payment card number",
    "ssn": "a Social Security number",
    "cvv": "a card security code",
    "password": "a password",
}


def _luhn_ok(digits: str) -> bool:
    total, double = 0, False
    for ch in reversed(digits):
        d = int(ch)
        if double:
            d = d * 2 - 9 if d > 4 else d * 2
        total += d
        double = not double
    return total % 10 == 0


def scrub(text: str) -> tuple[str, list[str]]:
    """Return (text with sensitive data removed, kinds of data found)."""
    found: list[str] = []

    def card(m: re.Match) -> str:
        digits = re.sub(r"\D", "", m.group())
        if 13 <= len(digits) <= 19 and _luhn_ok(digits):
            found.append("card")
            return "[card number removed]"
        return m.group()

    text = CARD_RE.sub(card, text)
    text, n = SSN_RE.subn("[SSN removed]", text)
    found += ["ssn"] * n
    text, n = CVV_RE.subn(lambda m: f"{m.group(1)}{m.group(2)}[removed]", text)
    found += ["cvv"] * n
    text, n = PASSWORD_RE.subn(lambda m: f"{m.group(1)}{m.group(2)}[removed]", text)
    found += ["password"] * n
    return text, list(dict.fromkeys(found))


def notice_for(found: list[str]) -> str:
    what = " and ".join(LABELS[k] for k in found)
    return (
        f"For your security, I removed {what} from your message before it went anywhere. "
        "Campus Customs will never ask for this in chat. For order help, email orderdept@campuscustoms.com."
    )


# --- Fair-use limits ------------------------------------------------------------------------


class ChatRateLimiter:
    """Sliding-window limits per key (user id, or IP for guests). In memory; resets on restart."""

    def __init__(self, per_minute: int = 8, per_day: int = 200):
        self.limits = ((60, per_minute), (24 * 60 * 60, per_day))
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> int | None:
        """Record a message. Returns seconds to wait if over a limit (the message is not counted)."""
        now = time.time()
        hits = self._hits[key]
        while hits and hits[0] <= now - self.limits[-1][0]:
            hits.popleft()
        for window, limit in self.limits:
            recent = [t for t in hits if t > now - window]
            if len(recent) >= limit:
                return max(1, int(recent[0] + window - now) + 1)
        hits.append(now)
        return None
