"""Emergent-managed email (Resend) — credential-free, works autonomously for all clients."""
import os
import re
import ipaddress
import logging
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()
logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME") or "FinDash CRM"
FRONTEND_URL = (os.environ.get("FRONTEND_URL", "") or "").rstrip("/")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened/numeric/credential URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> str | None:
    _assert_safe_email(subject, html)
    if not EMAIL_KEY or EMAIL_KEY.startswith("{"):
        logger.error("Email non configurata (EMERGENT_EMAIL_KEY mancante)")
        raise HTTPException(status_code=500, detail="Servizio email non configurato")
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                     headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail="Invio email non riuscito")
    except Exception as e:
        logger.error(f"Email send error: {e}")
        raise HTTPException(status_code=500, detail="Invio email non riuscito")


def _wrap(inner: str) -> str:
    return (f'<table role="presentation" width="100%"><tr><td style="padding:24px;'
            f'font-family:Arial,sans-serif;color:#0F172A">{inner}'
            f'<p style="font-size:12px;color:#888;margin-top:24px">Inviato da {escape(EMAIL_FROM_NAME)}. '
            f'Non chiediamo mai la tua password via email.</p></td></tr></table>')


async def send_collaborator_invite(to_email: str, name: str) -> str | None:
    link = f"{FRONTEND_URL}/login"
    inner = (f'<h2 style="font-family:Arial,sans-serif">Benvenuto in {escape(EMAIL_FROM_NAME)}</h2>'
             f'<p>Ciao {escape(name)}, sei stato aggiunto come collaboratore su {escape(EMAIL_FROM_NAME)}.</p>'
             f'<p>Accedi con la tua email <strong>{escape(to_email)}</strong>. Se non hai ancora una password, '
             f'usa "Password dimenticata" nella schermata di accesso.</p>'
             f'<p><a href="{escape(link)}" style="background:#2563EB;color:#fff;padding:10px 18px;'
             f'border-radius:8px;text-decoration:none;display:inline-block">Accedi ora</a></p>')
    return await send_email(to=to_email, subject=f"Sei stato aggiunto a {EMAIL_FROM_NAME}", html=_wrap(inner))


async def send_invoice_reminder(to_email: str, owner_name: str, inv: dict, company: dict) -> str | None:
    tot = f"{inv['totale']:,.2f}"
    inner = (f'<h2 style="font-family:Arial,sans-serif">Sollecito di pagamento</h2>'
             f'<p>Ciao {escape(owner_name or "")}, ecco il promemoria per la fattura in scadenza/scaduta:</p>'
             f'<ul>'
             f'<li>Azienda: <strong>{escape(company.get("name",""))}</strong></li>'
             f'<li>Fattura n.: <strong>{escape(inv.get("numero",""))}</strong></li>'
             f'<li>Cliente: {escape(inv.get("cliente",""))}</li>'
             f'<li>Importo: <strong>&euro; {tot}</strong></li>'
             f'<li>Scadenza: {escape(str(inv.get("data_scadenza",""))[:10])}</li>'
             f'</ul>'
             f'<p>Puoi inoltrare questo sollecito al cliente o gestirlo dalla dashboard.</p>'
             f'<p><a href="{escape(FRONTEND_URL + "/fatture")}" style="background:#2563EB;color:#fff;'
             f'padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Apri le fatture</a></p>')
    return await send_email(to=to_email, subject=f"Sollecito fattura {inv.get('numero','')} - {EMAIL_FROM_NAME}",
                            html=_wrap(inner))
