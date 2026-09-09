# FinDash CRM — PRD

## Problem Statement (original, IT)
Web app con dashboard su fatture e incassi di una società. Dati da CRM tipo TeamSystem, collegamento a PEC Aruba, lettura fatture da Google Drive, storicizzazione dati nel DB, chatbot Copilot per interrogare il CRM, ed estrazione bilanci società.

## User Choices
- Dati DEMO realistici (mock realistici salvati in DB).
- Chatbot: GPT-5.4 (Emergent Universal Key).
- Auth: email/password (JWT) **e** Google login (Emergent-managed).
- Persistenza: DB MongoDB + sincronizzazione automatica periodica (cron orario).
- UI interamente in italiano.

## Architecture
- Backend: FastAPI (`server.py`, `auth.py`, `seed.py`), MongoDB (motor). All routes under `/api`.
- Frontend: React 19 + Tailwind + shadcn/ui, recharts, Plus Jakarta Sans / Inter fonts. Sidebar+header layout.
- Auth: unified JWT (httpOnly cookies) + Google session tokens; get_current_user accepts either.
- Copilot: emergentintegrations LlmChat GPT-5.4, SSE streaming, history persisted in `copilot_messages`.
- Periodic sync: `.emergent/crons.yml` → hourly POST `/api/cron/sync` (Bearer WEBHOOK_CRON_SECRET).

## Personas
- Titolare/Amministratore (admin) — lorello97@gmail.com.
- Collaboratore amministrativo — registrazione self-service.

## Core Requirements (static)
1. Dashboard fatturato & incassi (KPI, trend, tabella).
2. Gestione fatture con filtri e incasso.
3. Lettura/import fatture da Google Drive (simulato).
4. PEC Aruba inbox + invio (simulato).
5. Copilot AI sul CRM (GPT-5.4).
6. Estrazione bilanci (stato patrimoniale, conto economico, indici).
7. Auth email/password + Google. Reset password.

## Implemented (2026-06-09)
- All 7 core areas implemented and tested (backend 19/19 pytest, frontend E2E 100%).
- Seeded demo: 3 aziende, 47 fatture, PEC, file Drive, bilanci 2023/24.
- JWT + Google auth, password reset flow, brute-force protection.
- Hourly TeamSystem sync cron (verified 401/accepted).

## Backlog / Remaining
- P1: Real TeamSystem / Aruba PEC / Google Drive API integration (needs user credentials).
- P2: Export XML/PDF fatture and bilancio CEE (currently toast placeholder).
- P2: Copilot answers rendering as real interactive tables.
- P2: Multi-user roles/permissions per azienda.

## Next Tasks
- Collect real API credentials to replace simulated connectors.
- Implement real document export.
