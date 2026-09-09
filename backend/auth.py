"""Unified auth: JWT email/password + Emergent Google Auth session tokens."""
import os
import uuid
import hashlib
import secrets
import logging
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
import httpx
from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"
EMAIL_BASE_URL = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip().rstrip("/") or "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME") or "FinDash CRM"


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, token_version: int = 0) -> str:
    payload = {"sub": user_id, "email": email, "ver": token_version,
               "exp": datetime.now(timezone.utc) + timedelta(minutes=15), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str, token_version: int = 0) -> str:
    payload = {"sub": user_id, "ver": token_version,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response, access_token: str, refresh_token: str):
    response.set_cookie("access_token", access_token, httponly=True, secure=True,
                        samesite="none", max_age=900, path="/")
    response.set_cookie("refresh_token", refresh_token, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")


def clear_auth_cookies(response):
    for c in ("access_token", "refresh_token", "session_token"):
        response.delete_cookie(c, path="/")


def public_user(user: dict) -> dict:
    return {
        "id": user.get("id"),
        "email": user.get("email"),
        "name": user.get("name"),
        "role": user.get("role", "user"),
        "picture": user.get("picture"),
        "auth_provider": user.get("auth_provider", "password"),
    }


async def get_current_user(request: Request, db) -> dict:
    # 1) JWT access token (email/password auth)
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if token:
        try:
            payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
            if payload.get("type") == "access":
                user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
                if user and payload.get("ver", 0) == user.get("token_version", 0):
                    return public_user(user)
        except jwt.ExpiredSignatureError:
            pass
        except jwt.InvalidTokenError:
            pass

    # 2) Google session token
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    if session_token:
        session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if session:
            expires_at = session["expires_at"]
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at >= datetime.now(timezone.utc):
                user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
                if user:
                    return public_user(user)

    raise HTTPException(status_code=401, detail="Non autenticato")


async def exchange_google_session(session_id: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    resp.raise_for_status()
    return resp.json()


# ---- Brute force ----
async def is_locked_out(db, identifier: str) -> bool:
    doc = await db.login_attempts.find_one({"identifier": identifier})
    if not doc:
        return False
    if doc.get("count", 0) >= 5:
        locked_until = doc.get("locked_until")
        if locked_until:
            if isinstance(locked_until, str):
                locked_until = datetime.fromisoformat(locked_until)
            if locked_until.tzinfo is None:
                locked_until = locked_until.replace(tzinfo=timezone.utc)
            return locked_until > datetime.now(timezone.utc)
    return False


async def record_failed_login(db, identifier: str, email: str):
    now = datetime.now(timezone.utc)
    doc = await db.login_attempts.find_one({"identifier": identifier})
    count = (doc.get("count", 0) if doc else 0) + 1
    update = {"identifier": identifier, "email": email, "count": count}
    if count >= 5:
        update["locked_until"] = (now + timedelta(minutes=15)).isoformat()
    await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)


async def clear_login_attempts(db, email: str):
    await db.login_attempts.delete_many({"email": email})


# ---- Password reset ----
async def create_reset_token(db, user: dict) -> str:
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    await db.password_reset_tokens.insert_one({
        "token_hash": token_hash,
        "user_id": user["id"],
        "email": user["email"],
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)),
        "used": False,
    })
    return token


async def reset_requests_over_limit(db, email: str) -> bool:
    since = datetime.now(timezone.utc) - timedelta(minutes=15)
    count = await db.password_reset_requests.count_documents({
        "email": email, "created_at": {"$gte": since}})
    return count >= 5


async def send_password_reset_email(to_email: str, token: str) -> bool:
    from urllib.parse import urlparse
    from html import escape
    base = os.environ.get("FRONTEND_URL", "").rstrip("/")
    link = f"{base}/reset-password?token={token}"
    if not EMAIL_KEY or EMAIL_KEY.startswith("{") or not base.startswith("https://"):
        if urlparse(base).hostname in ("localhost", "127.0.0.1", "::1"):
            logger.warning("Email not configured; password reset link: %s", link)
        else:
            logger.error("Password reset email not configured (EMERGENT_EMAIL_KEY / FRONTEND_URL)")
        return False
    brand = escape(EMAIL_FROM_NAME)
    html = (
        f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif">'
        f'<p>Abbiamo ricevuto una richiesta di reimpostazione della password {brand}.</p>'
        f'<p><a href="{escape(link)}">Reimposta la password</a></p>'
        f'<p>Il link scade tra 1 ora ed è utilizzabile una sola volta. Se non hai richiesto tu, ignora questa email.</p>'
        f'<p style="font-size:12px;color:#888">Inviato da {brand}.</p></td></tr></table>'
    )
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json={"to": [to_email], "subject": f"Reimposta la password {EMAIL_FROM_NAME}",
                      "html": html, "from_name": EMAIL_FROM_NAME},
            )
        resp.raise_for_status()
        return True
    except Exception as e:
        logger.error(f"Password reset email failed: {e}")
        return False
