"""
FinDash CRM backend tests - covers auth, CRM data endpoints (invoices/drive/pec/bilanci),
sync, copilot (history + streaming), and cron webhook.
"""
import os
import json
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://invoice-hub-1264.preview.emergentagent.com"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "lorello97@gmail.com"
ADMIN_PASSWORD = "Admin123!"
CRON_SECRET = "c7f4a9e2b16d84035ea1c9f7d2b8460af35d1e9c4a7b20f8"


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["email"] == ADMIN_EMAIL
    assert data["role"] == "admin"
    return s


# ---------- Auth ----------
class TestAuth:
    def test_login_success(self, admin_session):
        r = admin_session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code in (401, 429)

    def test_register_and_me(self):
        s = requests.Session()
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "TestPass123!", "name": "Test User"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["email"] == email
        me = s.get(f"{API}/auth/me", timeout=15)
        assert me.status_code == 200
        assert me.json()["email"] == email

    def test_forgot_password_generic(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": "unknown_xyz@example.com"}, timeout=15)
        assert r.status_code == 200
        assert "email" in r.json().get("message", "").lower() or "riceverai" in r.json().get("message", "").lower()

    def test_logout(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200
        r = s.post(f"{API}/auth/logout", timeout=15)
        assert r.status_code == 200
        r = s.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401


# ---------- CRM data ----------
class TestCRM:
    def test_companies(self, admin_session):
        r = admin_session.get(f"{API}/companies", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        assert "id" in data[0] and "name" in data[0]

    def test_dashboard_summary(self, admin_session):
        r = admin_session.get(f"{API}/dashboard/summary?company_id=all", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("totale_fatturato", "incassato", "in_scadenza", "scaduto", "num_fatture", "trend"):
            assert k in d
        assert d["num_fatture"] > 0

    def test_invoices_and_filter(self, admin_session):
        r = admin_session.get(f"{API}/invoices?company_id=all", timeout=15)
        assert r.status_code == 200
        inv = r.json()
        assert isinstance(inv, list) and len(inv) > 0

        r2 = admin_session.get(f"{API}/invoices?stato=pagata", timeout=15)
        assert r2.status_code == 200
        for i in r2.json():
            assert i["stato"] == "pagata"

    def test_mark_invoice_paid_persists(self, admin_session):
        # Find a non-paid invoice
        r = admin_session.get(f"{API}/invoices?stato=da_pagare", timeout=15)
        assert r.status_code == 200
        pending = r.json()
        if not pending:
            r = admin_session.get(f"{API}/invoices?stato=scaduta", timeout=15)
            pending = r.json()
        assert pending, "No non-paid invoices for testing"
        inv_id = pending[0]["id"]
        r = admin_session.post(f"{API}/invoices/{inv_id}/mark-paid", timeout=15)
        assert r.status_code == 200
        # Verify persisted
        r = admin_session.get(f"{API}/invoices?company_id=all", timeout=15)
        row = next((x for x in r.json() if x["id"] == inv_id), None)
        assert row and row["stato"] == "pagata"

    def test_drive_files_and_import(self, admin_session):
        r = admin_session.get(f"{API}/drive/files", timeout=15)
        assert r.status_code == 200
        files = r.json()
        assert isinstance(files, list) and len(files) > 0
        fid = files[0]["id"]
        r = admin_session.post(f"{API}/drive/files/{fid}/import", timeout=15)
        assert r.status_code == 200
        r = admin_session.get(f"{API}/drive/files", timeout=15)
        row = next((x for x in r.json() if x["id"] == fid), None)
        assert row and row.get("importato") is True

    def test_pec_messages_and_read(self, admin_session):
        r = admin_session.get(f"{API}/pec/messages", timeout=15)
        assert r.status_code == 200
        msgs = r.json()
        assert isinstance(msgs, list) and len(msgs) > 0
        unread = [m for m in msgs if not m.get("letto")]
        if unread:
            mid = unread[0]["id"]
            r = admin_session.post(f"{API}/pec/messages/{mid}/read", timeout=15)
            assert r.status_code == 200

    def test_pec_send(self, admin_session):
        r = admin_session.get(f"{API}/companies", timeout=15)
        cid = r.json()[0]["id"]
        payload = {"company_id": cid, "destinatario": "test@pec.it", "oggetto": "Test", "corpo": "corpo test"}
        r = admin_session.post(f"{API}/pec/send", json=payload, timeout=15)
        assert r.status_code == 200
        assert "id" in r.json()

    def test_bilanci(self, admin_session):
        r = admin_session.get(f"{API}/bilanci", timeout=15)
        assert r.status_code == 200
        b = r.json()
        assert isinstance(b, list) and len(b) > 0
        assert "conto_economico" in b[0] and "stato_patrimoniale" in b[0]

    def test_sync_status_and_teamsystem(self, admin_session):
        r = admin_session.post(f"{API}/sync/teamsystem", timeout=15)
        assert r.status_code == 200
        assert "teamsystem_last_sync" in r.json()
        r = admin_session.get(f"{API}/sync/status", timeout=15)
        assert r.status_code == 200
        assert "teamsystem_last_sync" in r.json()


# ---------- Copilot ----------
class TestCopilot:
    def test_history_empty_for_new_session(self, admin_session):
        sid = f"test_{uuid.uuid4().hex[:8]}"
        r = admin_session.get(f"{API}/copilot/history?session_id={sid}", timeout=15)
        assert r.status_code == 200
        assert r.json() == []

    def test_chat_stream_and_history_persist(self, admin_session):
        sid = f"test_{uuid.uuid4().hex[:8]}"
        payload = {"session_id": sid, "message": "Ciao, quanti sono i clienti totali?", "company_id": "all"}
        r = admin_session.post(f"{API}/copilot/chat", json=payload, timeout=90, stream=True)
        assert r.status_code == 200, r.text
        got_delta = False
        got_done = False
        content = ""
        for line in r.iter_lines(decode_unicode=True):
            if not line or not line.startswith("data:"):
                continue
            try:
                obj = json.loads(line[5:].strip())
            except Exception:
                continue
            if "delta" in obj:
                got_delta = True
                content += obj["delta"]
            if obj.get("done"):
                got_done = True
                break
        assert got_delta and got_done, f"SSE stream incomplete. content={content!r}"
        # History persists
        import time as _t
        _t.sleep(1)
        h = admin_session.get(f"{API}/copilot/history?session_id={sid}", timeout=15)
        assert h.status_code == 200
        hist = h.json()
        assert len(hist) >= 2
        assert any(m["role"] == "assistant" and m["content"] for m in hist)


# ---------- Cron ----------
class TestCron:
    def test_cron_unauthorized(self):
        r = requests.post(f"{API}/cron/sync", timeout=15)
        assert r.status_code == 401

    def test_cron_wrong_secret(self):
        r = requests.post(f"{API}/cron/sync", headers={"Authorization": "Bearer wrong"}, timeout=15)
        assert r.status_code == 401

    def test_cron_authorized(self):
        r = requests.post(f"{API}/cron/sync", headers={"Authorization": f"Bearer {CRON_SECRET}"}, timeout=15)
        assert r.status_code in (200, 202)
        assert r.json().get("status") == "accepted"
