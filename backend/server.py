from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / '.env')

import os
import json
import uuid
import logging
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

import auth as A
import seed as S

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


# ---------- Models ----------
class RegisterInput(BaseModel):
    email: EmailStr
    password: str
    name: str = "Utente"


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionInput(BaseModel):
    session_id: str


class ForgotInput(BaseModel):
    email: EmailStr


class ResetInput(BaseModel):
    token: str
    password: str


class ChatInput(BaseModel):
    session_id: str
    message: str
    company_id: str | None = None


async def current_user(request: Request):
    return await A.get_current_user(request, db)


# ---------- Auth endpoints ----------
@api_router.post("/auth/register")
async def register(payload: RegisterInput, response: Response):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email già registrata")
    user = {
        "id": f"user_{uuid.uuid4().hex[:12]}",
        "email": email,
        "name": payload.name,
        "password_hash": A.hash_password(payload.password),
        "role": "user",
        "auth_provider": "password",
        "token_version": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    access = A.create_access_token(user["id"], email, 0)
    refresh = A.create_refresh_token(user["id"], 0)
    A.set_auth_cookies(response, access, refresh)
    return A.public_user(user)


@api_router.post("/auth/login")
async def login(payload: LoginInput, request: Request, response: Response):
    email = payload.email.lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    if await A.is_locked_out(db, identifier):
        raise HTTPException(status_code=429, detail="Troppi tentativi. Riprova tra 15 minuti.")
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not A.verify_password(payload.password, user["password_hash"]):
        await A.record_failed_login(db, identifier, email)
        raise HTTPException(status_code=401, detail="Credenziali non valide")
    await A.clear_login_attempts(db, email)
    access = A.create_access_token(user["id"], email, user.get("token_version", 0))
    refresh = A.create_refresh_token(user["id"], user.get("token_version", 0))
    A.set_auth_cookies(response, access, refresh)
    return A.public_user(user)


@api_router.post("/auth/google/session")
async def google_session(payload: GoogleSessionInput, response: Response):
    try:
        data = await A.exchange_google_session(payload.session_id)
    except Exception:
        raise HTTPException(status_code=401, detail="Sessione Google non valida")
    email = data["email"].lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user = {
            "id": f"user_{uuid.uuid4().hex[:12]}",
            "email": email,
            "name": data.get("name", email),
            "picture": data.get("picture"),
            "role": "user",
            "auth_provider": "google",
            "token_version": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(dict(user))
    else:
        await db.users.update_one({"id": user["id"]}, {"$set": {
            "name": data.get("name", user.get("name")), "picture": data.get("picture")}})
    session_token = data["session_token"]
    await db.user_sessions.insert_one({
        "user_id": user["id"],
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    response.set_cookie("session_token", session_token, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")
    return A.public_user(user)


@api_router.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return user


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    A.clear_auth_cookies(response)
    return {"message": "Disconnesso"}


@api_router.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Nessun refresh token")
    try:
        import jwt as _jwt
        payload = _jwt.decode(token, A.get_jwt_secret(), algorithms=[A.JWT_ALGORITHM])
    except Exception:
        raise HTTPException(status_code=401, detail="Refresh token non valido")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Tipo token errato")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user or payload.get("ver", 0) != user.get("token_version", 0):
        raise HTTPException(status_code=401, detail="Sessione scaduta")
    access = A.create_access_token(user["id"], user["email"], user.get("token_version", 0))
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=900, path="/")
    return {"message": "ok"}


GENERIC_RESET = {"message": "Se l'email è registrata, riceverai un link per reimpostare la password."}


@api_router.post("/auth/forgot-password")
async def forgot_password(payload: ForgotInput, background_tasks: BackgroundTasks):
    email = payload.email.lower()
    await db.password_reset_requests.insert_one({"email": email, "created_at": datetime.now(timezone.utc)})
    if await A.reset_requests_over_limit(db, email):
        return GENERIC_RESET
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        return GENERIC_RESET
    token = await A.create_reset_token(db, user)
    background_tasks.add_task(A.send_password_reset_email, user["email"], token)
    return GENERIC_RESET


@api_router.post("/auth/reset-password")
async def reset_password(payload: ResetInput):
    import hashlib
    h = hashlib.sha256(payload.token.encode()).hexdigest()
    now = datetime.now(timezone.utc)
    doc = await db.password_reset_tokens.find_one_and_update(
        {"token_hash": h, "used": False, "expires_at": {"$gt": now}},
        {"$set": {"used": True}})
    if not doc:
        raise HTTPException(status_code=400, detail="Token non valido o scaduto")
    await db.users.update_one({"id": doc["user_id"]}, {
        "$set": {"password_hash": A.hash_password(payload.password)},
        "$inc": {"token_version": 1}})
    await db.password_reset_tokens.delete_many({"user_id": doc["user_id"], "used": False})
    await A.clear_login_attempts(db, doc["email"])
    return {"message": "Password reimpostata"}


# ---------- CRM data endpoints ----------
@api_router.get("/companies")
async def get_companies(user: dict = Depends(current_user)):
    return await db.companies.find({}, {"_id": 0}).to_list(100)


def _invoice_filter(company_id):
    return {} if not company_id or company_id == "all" else {"company_id": company_id}


@api_router.get("/dashboard/summary")
async def dashboard_summary(company_id: str = "all", user: dict = Depends(current_user)):
    invoices = await db.invoices.find(_invoice_filter(company_id), {"_id": 0}).to_list(2000)
    totale_fatturato = sum(i["totale"] for i in invoices)
    incassato = sum(i["incassato"] for i in invoices)
    in_scadenza = sum(i["totale"] for i in invoices if i["stato"] == "da_pagare")
    scaduto = sum(i["totale"] for i in invoices if i["stato"] == "scaduta")
    # monthly trend
    months = {}
    for i in invoices:
        m = i["data_emissione"][:7]
        months.setdefault(m, {"mese": m, "fatturato": 0.0, "incassato": 0.0})
        months[m]["fatturato"] += i["totale"]
        months[m]["incassato"] += i["incassato"]
    trend = sorted(months.values(), key=lambda x: x["mese"])[-8:]
    for t in trend:
        t["fatturato"] = round(t["fatturato"], 2)
        t["incassato"] = round(t["incassato"], 2)
    stato_counts = {}
    for i in invoices:
        stato_counts[i["stato"]] = stato_counts.get(i["stato"], 0) + 1
    return {
        "totale_fatturato": round(totale_fatturato, 2),
        "incassato": round(incassato, 2),
        "in_scadenza": round(in_scadenza, 2),
        "scaduto": round(scaduto, 2),
        "num_fatture": len(invoices),
        "trend": trend,
        "stato_counts": stato_counts,
    }


@api_router.get("/invoices")
async def get_invoices(company_id: str = "all", stato: str = "all", user: dict = Depends(current_user)):
    q = _invoice_filter(company_id)
    if stato and stato != "all":
        q["stato"] = stato
    inv = await db.invoices.find(q, {"_id": 0}).to_list(2000)
    inv.sort(key=lambda x: x["data_emissione"], reverse=True)
    return inv


@api_router.post("/invoices/{invoice_id}/mark-paid")
async def mark_paid(invoice_id: str, user: dict = Depends(current_user)):
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Fattura non trovata")
    await db.invoices.update_one({"id": invoice_id}, {"$set": {
        "stato": "pagata", "incassato": inv["totale"],
        "data_pagamento": datetime.now(timezone.utc).isoformat()}})
    return {"message": "Fattura segnata come pagata"}


@api_router.get("/drive/files")
async def drive_files(company_id: str = "all", user: dict = Depends(current_user)):
    return await db.drive_files.find(_invoice_filter(company_id), {"_id": 0}).to_list(200)


@api_router.post("/drive/files/{file_id}/import")
async def import_drive_file(file_id: str, user: dict = Depends(current_user)):
    f = await db.drive_files.find_one({"id": file_id}, {"_id": 0})
    if not f:
        raise HTTPException(status_code=404, detail="File non trovato")
    await db.drive_files.update_one({"id": file_id}, {"$set": {"importato": True, "stato_import": "importato"}})
    return {"message": "File importato e analizzato"}


@api_router.get("/pec/messages")
async def pec_messages(company_id: str = "all", user: dict = Depends(current_user)):
    msgs = await db.pec_messages.find(_invoice_filter(company_id), {"_id": 0}).to_list(200)
    msgs.sort(key=lambda x: x["data_ricezione"], reverse=True)
    return msgs


@api_router.post("/pec/messages/{msg_id}/read")
async def pec_read(msg_id: str, user: dict = Depends(current_user)):
    await db.pec_messages.update_one({"id": msg_id}, {"$set": {"letto": True}})
    return {"message": "ok"}


class PecSendInput(BaseModel):
    company_id: str
    destinatario: str
    oggetto: str
    corpo: str


@api_router.post("/pec/send")
async def pec_send(payload: PecSendInput, user: dict = Depends(current_user)):
    msg = {
        "id": f"pec_{uuid.uuid4().hex[:8]}",
        "company_id": payload.company_id,
        "mittente": user["email"],
        "destinatario": payload.destinatario,
        "oggetto": payload.oggetto,
        "tipo": "inviato",
        "letto": True,
        "data_ricezione": datetime.now(timezone.utc).isoformat(),
        "anteprima": payload.corpo[:140],
        "allegati": 0,
        "provider": "Aruba PEC",
    }
    await db.pec_messages.insert_one(dict(msg))
    return {"message": "PEC inviata con successo (ricevuta di accettazione generata)", "id": msg["id"]}


@api_router.get("/bilanci")
async def get_bilanci(company_id: str = "all", user: dict = Depends(current_user)):
    b = await db.bilanci.find(_invoice_filter(company_id), {"_id": 0}).to_list(200)
    b.sort(key=lambda x: (x["company_id"], x["anno"]), reverse=True)
    return b


@api_router.get("/sync/status")
async def sync_status(user: dict = Depends(current_user)):
    st = await db.sync_state.find_one({"id": "global"}, {"_id": 0})
    unread = await db.pec_messages.count_documents({"letto": False})
    return {**(st or {}), "pec_unread": unread}


@api_router.post("/sync/teamsystem")
async def sync_teamsystem(user: dict = Depends(current_user)):
    now = datetime.now(timezone.utc).isoformat()
    await db.sync_state.update_one({"id": "global"}, {"$set": {"teamsystem_last_sync": now}}, upsert=True)
    return {"message": "Sincronizzazione TeamSystem completata", "teamsystem_last_sync": now}


# ---------- Copilot ----------
async def build_crm_context(company_id):
    invoices = await db.invoices.find(_invoice_filter(company_id), {"_id": 0}).to_list(2000)
    bilanci = await db.bilanci.find(_invoice_filter(company_id), {"_id": 0}).to_list(50)
    companies = await db.companies.find({}, {"_id": 0}).to_list(50)
    tot = sum(i["totale"] for i in invoices)
    inc = sum(i["incassato"] for i in invoices)
    scaduto = [i for i in invoices if i["stato"] == "scaduta"]
    da_pagare = [i for i in invoices if i["stato"] == "da_pagare"]
    lines = [
        "DATI CRM TEAMSYSTEM (riepilogo aggiornato):",
        f"Aziende: {', '.join(c['name'] + ' (P.IVA ' + c['piva'] + ')' for c in companies)}",
        f"Numero fatture: {len(invoices)}. Totale fatturato: € {tot:,.2f}. Totale incassato: € {inc:,.2f}.",
        f"Fatture scadute: {len(scaduto)} per € {sum(i['totale'] for i in scaduto):,.2f}.",
        f"Fatture da pagare (in scadenza): {len(da_pagare)} per € {sum(i['totale'] for i in da_pagare):,.2f}.",
        "Ultime 15 fatture (numero | cliente | totale | stato | scadenza):",
    ]
    for i in sorted(invoices, key=lambda x: x["data_emissione"], reverse=True)[:15]:
        lines.append(f"- {i['numero']} | {i['cliente']} | € {i['totale']:,.2f} | {i['stato']} | {i['data_scadenza'][:10]}")
    lines.append("BILANCI:")
    for b in bilanci:
        ce = b["conto_economico"]
        lines.append(f"- Azienda {b['company_id']} anno {b['anno']}: ricavi € {ce['ricavi']:,.2f}, EBITDA € {ce['ebitda']:,.2f}, utile netto € {ce['utile_netto']:,.2f}")
    return "\n".join(lines)


@api_router.get("/copilot/history")
async def copilot_history(session_id: str, user: dict = Depends(current_user)):
    msgs = await db.copilot_messages.find(
        {"session_id": session_id, "user_id": user["id"]}, {"_id": 0}).to_list(500)
    msgs.sort(key=lambda x: x["created_at"])
    return msgs


@api_router.post("/copilot/chat")
async def copilot_chat(payload: ChatInput, user: dict = Depends(current_user)):
    now = datetime.now(timezone.utc).isoformat()
    await db.copilot_messages.insert_one({
        "id": f"msg_{uuid.uuid4().hex[:10]}", "session_id": payload.session_id,
        "user_id": user["id"], "role": "user", "content": payload.message, "created_at": now})

    history = await db.copilot_messages.find(
        {"session_id": payload.session_id, "user_id": user["id"]}, {"_id": 0}).to_list(500)
    history.sort(key=lambda x: x["created_at"])
    transcript = "\n".join(f"{m['role']}: {m['content']}" for m in history[-8:])
    crm_context = await build_crm_context(payload.company_id)

    system_message = (
        "Sei il Copilot AI di FinDash CRM, un assistente esperto di contabilità italiana, fatturazione "
        "elettronica, incassi e bilanci. Rispondi SEMPRE in italiano, in modo chiaro e professionale. "
        "Usa i dati CRM forniti qui sotto per rispondere con numeri concreti. Se utile, formatta con "
        "elenchi puntati o brevi tabelle in markdown. Non inventare dati non presenti.\n\n"
        f"{crm_context}\n\nConversazione precedente:\n{transcript}"
    )

    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=payload.session_id,
                   system_message=system_message).with_model("openai", "gpt-5.4")

    async def gen():
        full = ""
        try:
            async for ev in chat.stream_message(UserMessage(text=payload.message)):
                if isinstance(ev, TextDelta):
                    full += ev.content
                    yield f"data: {json.dumps({'delta': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            logger.error(f"Copilot error: {e}")
            if not full:
                full = "Si è verificato un errore nel generare la risposta. Riprova."
                yield f"data: {json.dumps({'delta': full})}\n\n"
        await db.copilot_messages.insert_one({
            "id": f"msg_{uuid.uuid4().hex[:10]}", "session_id": payload.session_id,
            "user_id": user["id"], "role": "assistant", "content": full,
            "created_at": datetime.now(timezone.utc).isoformat()})
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


import hmac


async def _run_periodic_sync():
    now = datetime.now(timezone.utc).isoformat()
    await db.sync_state.update_one({"id": "global"}, {"$set": {"teamsystem_last_sync": now}}, upsert=True)
    logger.info("Cron: periodic TeamSystem sync completed")


@api_router.post("/cron/sync")
async def cron_sync(request: Request, background_tasks: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    auth_header = request.headers.get("Authorization", "")
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    if not auth_header.startswith("Bearer ") or not secret or not hmac.compare_digest(auth_header[7:], secret):
        raise HTTPException(status_code=401, detail="Unauthorized")
    background_tasks.add_task(_run_periodic_sync)
    return {"status": "accepted"}


@api_router.get("/")
async def root():
    return {"message": "FinDash CRM API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in os.environ.get("CORS_ORIGINS", "").split(",") if o] or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": f"user_{uuid.uuid4().hex[:12]}", "email": admin_email,
            "password_hash": A.hash_password(admin_password), "name": "Lorenzo (Admin)",
            "role": "admin", "auth_provider": "password", "token_version": 0,
            "created_at": datetime.now(timezone.utc).isoformat()})
    elif not A.verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": A.hash_password(admin_password)}})


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.password_reset_tokens.create_index("token_hash", unique=True)
    await db.login_attempts.create_index("email")
    await db.login_attempts.create_index("identifier")
    await db.password_reset_requests.create_index("email")
    await db.password_reset_requests.create_index("created_at", expireAfterSeconds=900)
    await db.user_sessions.create_index("session_token")
    await seed_admin()
    await S.seed_all(db)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
