"""Realistic Italian CRM demo data generator (TeamSystem-style)."""
import random
import uuid
from datetime import datetime, timezone, timedelta

random.seed(42)

COMPANIES = [
    {"id": "cmp_001", "name": "Rossi Costruzioni S.r.l.", "piva": "IT01234567890", "city": "Milano", "sdi": "M5UXCR1", "settore": "Costruzioni"},
    {"id": "cmp_002", "name": "Bianchi Logistica S.p.A.", "piva": "IT09876543210", "city": "Bologna", "sdi": "USAL8PV", "settore": "Trasporti e Logistica"},
    {"id": "cmp_003", "name": "Verdi Consulting S.r.l.", "piva": "IT05556667770", "city": "Roma", "sdi": "KRRH6B9", "settore": "Consulenza"},
]

# Benchmark di settore: medie e aziende comparabili (dati di mercato realistici).
SECTOR_BENCHMARKS = {
    "Costruzioni": {
        "media": {"ricavi": 2100000, "ebitda_margin_pct": 11.5, "roe_pct": 9.2, "indice_liquidita": 1.25, "indebitamento": 2.1},
        "peers": [
            {"nome": "Edil Nord S.p.A.", "ricavi": 3200000, "ebitda_margin_pct": 13.1, "roe_pct": 11.0, "indice_liquidita": 1.35, "indebitamento": 1.8},
            {"nome": "Costruzioni Adriatiche S.r.l.", "ricavi": 1500000, "ebitda_margin_pct": 9.8, "roe_pct": 7.5, "indice_liquidita": 1.10, "indebitamento": 2.4},
            {"nome": "Gruppo Muratori Italia", "ricavi": 2600000, "ebitda_margin_pct": 12.0, "roe_pct": 10.1, "indice_liquidita": 1.28, "indebitamento": 2.0},
        ],
    },
    "Trasporti e Logistica": {
        "media": {"ricavi": 3400000, "ebitda_margin_pct": 9.0, "roe_pct": 8.1, "indice_liquidita": 1.15, "indebitamento": 2.6},
        "peers": [
            {"nome": "Veloce Logistics S.r.l.", "ricavi": 4100000, "ebitda_margin_pct": 10.2, "roe_pct": 9.4, "indice_liquidita": 1.22, "indebitamento": 2.3},
            {"nome": "TransItalia Cargo S.p.A.", "ricavi": 2900000, "ebitda_margin_pct": 7.8, "roe_pct": 6.9, "indice_liquidita": 1.05, "indebitamento": 3.0},
            {"nome": "Adria Spedizioni", "ricavi": 3200000, "ebitda_margin_pct": 8.9, "roe_pct": 8.0, "indice_liquidita": 1.18, "indebitamento": 2.5},
        ],
    },
    "Consulenza": {
        "media": {"ricavi": 1200000, "ebitda_margin_pct": 18.5, "roe_pct": 15.0, "indice_liquidita": 1.60, "indebitamento": 1.2},
        "peers": [
            {"nome": "Advisory Partners S.r.l.", "ricavi": 1600000, "ebitda_margin_pct": 21.0, "roe_pct": 18.2, "indice_liquidita": 1.75, "indebitamento": 0.9},
            {"nome": "Studio Associato Meridiano", "ricavi": 900000, "ebitda_margin_pct": 16.2, "roe_pct": 12.8, "indice_liquidita": 1.45, "indebitamento": 1.4},
            {"nome": "NextGen Consulting Italia", "ricavi": 1300000, "ebitda_margin_pct": 19.1, "roe_pct": 15.6, "indice_liquidita": 1.62, "indebitamento": 1.1},
        ],
    },
}

CLIENTS = [
    "ACME Italia S.p.A.", "Delta Servizi S.r.l.", "Ferramenta Lombarda", "Studio Tecnico Neri",
    "Ediltecnica S.r.l.", "GreenPower Energia", "Marittima Trasporti", "Officine Meccaniche Po",
    "Alimentari Sud S.r.l.", "TechnoWeb Digital", "Immobiliare Aurora", "Farmacia Centrale",
    "Ristorazione Bella Vita", "AutoRicambi Veloce", "Tessuti Pregiati S.r.l.",
]

PAYMENT_METHODS = ["Bonifico SEPA", "RIBA", "Contanti", "Carta di Credito", "Assegno"]


def _iso(dt):
    return dt.isoformat()


def generate_invoices():
    invoices = []
    today = datetime.now(timezone.utc)
    num = 1
    for company in COMPANIES:
        for _ in range(random.randint(14, 20)):
            issue = today - timedelta(days=random.randint(0, 300))
            due = issue + timedelta(days=random.choice([30, 30, 60, 90]))
            imponibile = round(random.uniform(800, 42000), 2)
            iva = round(imponibile * 0.22, 2)
            totale = round(imponibile + iva, 2)
            # status logic
            r = random.random()
            if r < 0.55:
                status = "pagata"
                paid_date = _iso(due - timedelta(days=random.randint(0, 20)))
                incassato = totale
            elif due < today:
                status = "scaduta"
                paid_date = None
                incassato = 0.0
            else:
                status = "da_pagare"
                paid_date = None
                incassato = 0.0
            invoices.append({
                "id": f"inv_{num:04d}",
                "company_id": company["id"],
                "numero": f"{today.year}/{num:04d}",
                "cliente": random.choice(CLIENTS),
                "data_emissione": _iso(issue),
                "data_scadenza": _iso(due),
                "imponibile": imponibile,
                "iva": iva,
                "totale": totale,
                "incassato": incassato,
                "stato": status,
                "data_pagamento": paid_date,
                "metodo_pagamento": random.choice(PAYMENT_METHODS),
                "tipo": "fattura_elettronica",
                "source": "TeamSystem",
                "created_at": _iso(today),
            })
            num += 1
    return invoices


PEC_SUBJECTS = [
    "Trasmissione fattura elettronica n.",
    "Sollecito di pagamento fattura n.",
    "Ricevuta di consegna - SDI",
    "Comunicazione contratto di fornitura",
    "Notifica scarto Sistema di Interscambio",
    "Conferma ordine e condizioni di pagamento",
]


def generate_pec():
    msgs = []
    today = datetime.now(timezone.utc)
    for i in range(1, 16):
        company = random.choice(COMPANIES)
        received = today - timedelta(days=random.randint(0, 60), hours=random.randint(0, 23))
        kind = random.choice(["ricevuta_consegna", "ricevuta_accettazione", "messaggio", "notifica_scarto"])
        msgs.append({
            "id": f"pec_{i:04d}",
            "company_id": company["id"],
            "mittente": random.choice([
                "sistemadiinterscambio@pec.fatturapa.it",
                f"{random.choice(CLIENTS).split()[0].lower()}@pec.it",
                "amministrazione@pec.aruba.it",
            ]),
            "oggetto": f"{random.choice(PEC_SUBJECTS)} {today.year}/{random.randint(1,60):04d}",
            "tipo": kind,
            "letto": random.random() < 0.5,
            "data_ricezione": _iso(received),
            "anteprima": "Messaggio di posta elettronica certificata ricevuto tramite gestore Aruba PEC S.p.A.",
            "allegati": random.randint(0, 2),
            "provider": "Aruba PEC",
        })
    return sorted(msgs, key=lambda m: m["data_ricezione"], reverse=True)


def generate_drive_files():
    files = []
    today = datetime.now(timezone.utc)
    for i in range(1, 13):
        company = random.choice(COMPANIES)
        ext = random.choice(["xml", "pdf", "xml", "pdf"])
        imported = random.random() < 0.6
        files.append({
            "id": f"drv_{i:04d}",
            "company_id": company["id"],
            "nome_file": f"IT{company['piva'][2:]}_{random.randint(10000,99999)}.{ext}",
            "mime": "application/xml" if ext == "xml" else "application/pdf",
            "dimensione_kb": random.randint(12, 480),
            "cartella": "/Fatture Emesse/2025",
            "modificato": _iso(today - timedelta(days=random.randint(0, 90))),
            "importato": imported,
            "stato_import": "importato" if imported else "in_attesa",
        })
    return files


def generate_bilanci():
    bilanci = []
    for company in COMPANIES:
        for year in [2023, 2024]:
            ricavi = round(random.uniform(800000, 4500000), 2)
            costi = round(ricavi * random.uniform(0.62, 0.85), 2)
            ammortamenti = round(ricavi * random.uniform(0.03, 0.07), 2)
            ebitda = round(ricavi - costi, 2)
            ebit = round(ebitda - ammortamenti, 2)
            oneri_fin = round(ricavi * random.uniform(0.01, 0.03), 2)
            utile_lordo = round(ebit - oneri_fin, 2)
            imposte = round(max(utile_lordo, 0) * 0.24, 2)
            utile_netto = round(utile_lordo - imposte, 2)
            attivo_corrente = round(random.uniform(400000, 1800000), 2)
            attivo_immob = round(random.uniform(300000, 2200000), 2)
            passivo_corrente = round(random.uniform(200000, 1200000), 2)
            debiti_ml = round(random.uniform(100000, 900000), 2)
            patrimonio_netto = round(attivo_corrente + attivo_immob - passivo_corrente - debiti_ml, 2)
            bilanci.append({
                "id": f"bil_{company['id']}_{year}",
                "company_id": company["id"],
                "anno": year,
                "conto_economico": {
                    "ricavi": ricavi,
                    "costi_produzione": costi,
                    "ammortamenti": ammortamenti,
                    "ebitda": ebitda,
                    "ebit": ebit,
                    "oneri_finanziari": oneri_fin,
                    "utile_lordo": utile_lordo,
                    "imposte": imposte,
                    "utile_netto": utile_netto,
                },
                "stato_patrimoniale": {
                    "attivo_corrente": attivo_corrente,
                    "attivo_immobilizzato": attivo_immob,
                    "totale_attivo": round(attivo_corrente + attivo_immob, 2),
                    "passivo_corrente": passivo_corrente,
                    "debiti_medio_lungo": debiti_ml,
                    "patrimonio_netto": patrimonio_netto,
                },
                "indici": {
                    "mol_pct": round(ebitda / ricavi * 100, 1),
                    "ebitda_margin_pct": round(ebitda / ricavi * 100, 1),
                    "roe_pct": round(utile_netto / patrimonio_netto * 100, 1) if patrimonio_netto else 0,
                    "indice_liquidita": round(attivo_corrente / passivo_corrente, 2) if passivo_corrente else 0,
                    "indice_indebitamento": round((passivo_corrente + debiti_ml) / patrimonio_netto, 2) if patrimonio_netto else 0,
                },
                "fonte": "TeamSystem",
            })
    return bilanci


async def seed_all(db):
    if await db.companies.count_documents({}) == 0:
        await db.companies.insert_many([dict(c) for c in COMPANIES])
    for c in COMPANIES:
        await db.companies.update_one({"id": c["id"]}, {"$set": {"settore": c["settore"]}})
    if await db.invoices.count_documents({}) == 0:
        await db.invoices.insert_many(generate_invoices())
    if await db.pec_messages.count_documents({}) == 0:
        await db.pec_messages.insert_many(generate_pec())
    if await db.drive_files.count_documents({}) == 0:
        await db.drive_files.insert_many(generate_drive_files())
    if await db.bilanci.count_documents({}) == 0:
        await db.bilanci.insert_many(generate_bilanci())
    if await db.sync_state.count_documents({}) == 0:
        await db.sync_state.insert_one({
            "id": "global",
            "teamsystem_last_sync": _iso(datetime.now(timezone.utc) - timedelta(minutes=12)),
            "drive_connected": True,
            "pec_connected": True,
        })
