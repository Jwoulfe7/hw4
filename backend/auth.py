"""Password hashing, sessions, and the /api/auth routes.

Password format (matches the seeded users):
    pbkdf2_sha256$<salt>$<hex digest>
    digest = PBKDF2-HMAC-SHA256(password, salt.encode("utf-8"), 120_000 iterations)

Signup and login share HASH_ALGORITHM / HASH_ITERATIONS and the same salt handling,
so a hash written at signup always verifies at login.
"""

import base64
import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import time
from collections import defaultdict, deque
from collections.abc import Callable
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

HASH_ALGORITHM = "pbkdf2_sha256"
HASH_ITERATIONS = 120_000
SALT_BYTES = 16  # stored as 32 hex characters

SESSION_COOKIE = "cc_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 7  # one week

MAX_FAILED_LOGINS = 5
FAILED_LOGIN_WINDOW = 15 * 60  # seconds

MIN_PASSWORD_LENGTH = 8

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# --- Password hashing -----------------------------------------------------------


def _pbkdf2(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), HASH_ITERATIONS
    ).hex()


def hash_password(password: str) -> str:
    """New random salt per user. Only used at signup."""
    salt = secrets.token_hex(SALT_BYTES)
    return f"{HASH_ALGORITHM}${salt}${_pbkdf2(password, salt)}"


def verify_password(password: str, stored: str) -> bool:
    """Re-hash the typed password with the stored salt and compare in constant time."""
    try:
        algorithm, salt, expected = stored.split("$")
    except ValueError:
        return False
    if algorithm != HASH_ALGORITHM:
        return False
    return hmac.compare_digest(_pbkdf2(password, salt), expected)


# A real hash to check against when the email doesn't exist, so a wrong email
# takes as long as a wrong password and response timing doesn't reveal accounts.
_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


# --- Sessions -------------------------------------------------------------------
# A signed cookie: "<user_id>.<expires>.<HMAC signature>". The browser can't read it
# (HttpOnly) or forge it (no secret), and it holds no password material.


def _load_session_secret(data_dir: Path) -> bytes:
    if env := os.environ.get("SESSION_SECRET"):
        return env.encode()
    path = data_dir / ".session_secret"  # data/ is git-ignored
    if not path.exists():
        path.write_text(secrets.token_hex(32))
        path.chmod(0o600)
    return path.read_text().strip().encode()


class SessionSigner:
    def __init__(self, secret: bytes):
        self._secret = secret

    def _sign(self, payload: str) -> str:
        mac = hmac.new(self._secret, payload.encode(), hashlib.sha256).digest()
        return base64.urlsafe_b64encode(mac).decode().rstrip("=")

    def issue(self, user_id: int) -> str:
        payload = f"{user_id}.{int(time.time()) + SESSION_MAX_AGE}"
        return f"{payload}.{self._sign(payload)}"

    def read(self, token: str | None) -> int | None:
        if not token or token.count(".") != 2:
            return None
        user_id, expires, signature = token.split(".")
        if not hmac.compare_digest(signature, self._sign(f"{user_id}.{expires}")):
            return None
        if not (user_id.isdigit() and expires.isdigit()) or int(expires) < time.time():
            return None
        return int(user_id)


# --- Brute-force protection -----------------------------------------------------


class LoginLimiter:
    """In-memory: after 5 failed logins for an email in 15 minutes, refuse for a while."""

    def __init__(self):
        self._failures: dict[str, deque[float]] = defaultdict(deque)

    def _recent(self, key: str) -> deque[float]:
        q = self._failures[key]
        while q and q[0] < time.time() - FAILED_LOGIN_WINDOW:
            q.popleft()
        return q

    def blocked(self, key: str) -> bool:
        return len(self._recent(key)) >= MAX_FAILED_LOGINS

    def fail(self, key: str) -> None:
        self._recent(key).append(time.time())

    def reset(self, key: str) -> None:
        self._failures.pop(key, None)


# --- Request bodies ---------------------------------------------------------------


class SignupBody(BaseModel):
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    email: str = Field(max_length=254)
    password: str = Field(max_length=256)
    confirm_password: str = Field(max_length=256)


class LoginBody(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=256)


# --- Routes -----------------------------------------------------------------------


def public_user(row: sqlite3.Row) -> dict:
    """The only user fields that ever leave the backend. Never the password hash."""
    return {
        "id": row["id"],
        "first_name": row["first_name"] or row["name"].split(" ")[0],
        "last_name": row["last_name"] or "",
        "email": row["email"],
    }


CurrentUser = Callable[[Request], sqlite3.Row | None]


def build_auth(
    get_conn: Callable[[], sqlite3.Connection], data_dir: Path
) -> tuple[APIRouter, CurrentUser]:
    """The /api/auth routes, plus a current_user(request) lookup for other routes (e.g. chat)."""
    router = APIRouter(prefix="/api/auth", tags=["auth"])
    signer = SessionSigner(_load_session_secret(data_dir))
    limiter = LoginLimiter()

    def set_session(response: Response, request: Request, user_id: int) -> None:
        response.set_cookie(
            SESSION_COOKIE,
            signer.issue(user_id),
            max_age=SESSION_MAX_AGE,
            httponly=True,
            samesite="lax",
            secure=request.url.scheme == "https",
            path="/",
        )

    def find_user(conn: sqlite3.Connection, email: str) -> sqlite3.Row | None:
        return conn.execute(
            "SELECT * FROM users WHERE lower(email) = ?", (email,)
        ).fetchone()

    @router.post("/signup", status_code=201)
    def signup(body: SignupBody, request: Request, response: Response) -> dict:
        email = body.email.strip().lower()
        first, last = body.first_name.strip(), body.last_name.strip()
        if not EMAIL_RE.match(email):
            raise HTTPException(422, "Please enter a valid email address.")
        if not first or not last:
            raise HTTPException(422, "Please enter your first and last name.")
        if len(body.password) < MIN_PASSWORD_LENGTH:
            raise HTTPException(422, f"Password must be at least {MIN_PASSWORD_LENGTH} characters.")
        if body.password != body.confirm_password:
            raise HTTPException(422, "Passwords don't match.")

        with get_conn() as conn:
            if find_user(conn, email):
                raise HTTPException(409, "An account with that email already exists.")
            cur = conn.execute(
                "INSERT INTO users (name, email, password_hash, first_name, last_name)"
                " VALUES (?, ?, ?, ?, ?)",
                (f"{first} {last}", email, hash_password(body.password), first, last),
            )
            row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()

        set_session(response, request, row["id"])
        return public_user(row)

    @router.post("/login")
    def login(body: LoginBody, request: Request, response: Response) -> dict:
        email = body.email.strip().lower()
        if limiter.blocked(email):
            raise HTTPException(429, "Too many attempts. Please wait a few minutes and try again.")

        with get_conn() as conn:
            row = find_user(conn, email)
        ok = verify_password(body.password, row["password_hash"] if row else _DUMMY_HASH)
        if not (row and ok):
            limiter.fail(email)
            # Same message either way, so the response doesn't reveal which emails exist.
            raise HTTPException(401, "Incorrect email or password.")

        limiter.reset(email)
        set_session(response, request, row["id"])
        return public_user(row)

    @router.post("/logout", status_code=204)
    def logout(response: Response) -> None:
        response.delete_cookie(SESSION_COOKIE, path="/")

    def current_user(request: Request) -> sqlite3.Row | None:
        user_id = signer.read(request.cookies.get(SESSION_COOKIE))
        if user_id is None:
            return None
        with get_conn() as conn:
            return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

    @router.get("/me")
    def me(request: Request) -> dict:
        row = current_user(request)
        if row is None:
            raise HTTPException(401, "Not logged in.")
        return public_user(row)

    return router, current_user
