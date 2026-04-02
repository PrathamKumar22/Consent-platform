# Adaptive Machine-Readable Consent Intelligence Platform
### Explainable Enforcement · Blockchain Auditability · OCR Digitization

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend  :3000                     │
│   Create │ Search │ Revoke │ Supersede │ Data Access │ OCR   │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────────┐
│              Node.js + Express Backend  :5000                │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ NLP Parser  │  │ Policy Engine│  │ Jurisdiction       │  │
│  │ (rule-based)│  │     (OPA)    │  │ Resolver           │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
└──────┬────────────────┬──────────────────┬───────────────────┘
       │                │                  │
┌──────▼──────┐  ┌──────▼──────┐  ┌───────▼────────────────┐
│  CouchDB    │  │    OPA      │  │  Hyperledger Fabric     │
│  :5984      │  │    :8181    │  │  (Blockchain Audit)     │
│  (Documents)│  │  (Policies) │  │  :7051 / mock-ledger    │
└─────────────┘  └─────────────┘  └────────────────────────┘
                                           ▲
┌──────────────────────────────────────────┘
│  PaddleOCR Service  :8000
│  (Document Digitization)
└──────────────────────────────────────────
```

---

## Project Structure

```
project/
├── backend/
│   ├── src/
│   │   ├── index.js                  ← Express entry point
│   │   ├── routes/
│   │   │   └── consent.js            ← All API routes
│   │   ├── parsers/
│   │   │   └── nlpParser.js          ← Rule-based NLP parser
│   │   ├── services/
│   │   │   ├── couchdb.js            ← CouchDB CRUD
│   │   │   ├── opaService.js         ← OPA enforcement + explainability
│   │   │   ├── fabricService.js      ← Blockchain audit (Fabric + mock)
│   │   │   └── jurisdictionService.js← GDPR/DPDP conflict resolver
│   │   └── opa/policies/
│   │       └── consent.rego          ← OPA Rego enforcement policy
│   ├── Dockerfile
│   └── package.json
│
├── ocr-service/
│   ├── main.py                       ← FastAPI + PaddleOCR
│   ├── requirements.txt
│   └── Dockerfile
│
├── fabric/
│   ├── chaincode/consent/
│   │   ├── index.js
│   │   ├── lib/consentContract.js    ← Fabric smart contract
│   │   └── package.json
│   ├── setup-network.sh              ← Automated Fabric setup
│   └── connection-profile-template.json
│
├── frontend/                         ← Your React frontend (unchanged)
│   ├── src/
│   │   ├── components/
│   │   │   ├── CreateConsent.js
│   │   │   ├── ListUserConsents.js
│   │   │   ├── RevokeWithList.js
│   │   │   ├── SupersedeConsent.js
│   │   │   ├── DataAccessConsent.js
│   │   │   └── UploadDocument.js
│   │   └── services/api.js
│   ├── Dockerfile
│   └── nginx.conf
│
├── docker-compose.yml                ← Full stack orchestration
├── start-local.sh                    ← Quick local start (no Docker)
└── README.md
```

---

## Quick Start

### Option A — Docker Compose (Recommended)

```bash
# 1. Copy your frontend into project/frontend/
cp -r /path/to/your/frontend/* project/frontend/

# 2. Start everything
cd project
docker-compose up --build

# Services:
#   Frontend  → http://localhost:3000
#   Backend   → http://localhost:5000
#   CouchDB   → http://localhost:5984/_utils  (admin/password)
#   OPA       → http://localhost:8181
#   OCR       → http://localhost:8000
```

### Option B — Local (No Docker for app services)

```bash
# Requires: Node.js 18+, Python 3.10+, Docker (for CouchDB + OPA only)

cd project
chmod +x start-local.sh
./start-local.sh

# Then in a new terminal:
cd frontend
npm install
npm start
```

---

## API Reference

All endpoints are served at `http://localhost:5000`.

### `POST /consent/create`
Create a new consent record.

**Body:**
```json
{
  "userId": "U_001",
  "dataType": "email",
  "purpose": "marketing",
  "retention": "1 year",
  "expiry": "2027-01-01",
  "jurisdiction": "EU",
  "sharingParties": "[\"self\",\"partners\"]",
  "legalText": "Optional — raw legal clause text for NLP parsing"
}
```

**Response:** `{ consentId, consent: { clauses, regulatoryPrinciples, ... } }`

---

### `GET /consent/:id`
Fetch a single consent by ID.

---

### `POST /consent/revoke/:id`
Revoke an active consent. Records revocation event on blockchain.

---

### `POST /consent/supersede/:oldId`
Create a new consent version superseding the old one.

---

### `POST /consent/data-access`
Runtime OPA enforcement check.

**Body:**
```json
{ "userId": "U_001", "dataType": "email", "sharingParty": "partners" }
```

**Response (allow):** `200 { allowed: true, explanation: "...", policyCheck: {...} }`  
**Response (deny):** `403 { allowed: false, explanation: "...", denialReasons: [...] }`

---

### `POST /consent/document/upload`
Upload scanned image/PDF → OCR → parse → create consent.

**Form Data:** `file` (image or PDF), `userId`

---

### `POST /consent/parse-text`
Parse legal consent text without creating a consent record.

**Body:** `{ "text": "raw legal consent text..." }`

---

### `GET /consent/consents/user/:userId`
List all consents for a user with status enrichment (isExpired, daysToExpiry).

---

### `GET /consent/audit/:consentId`
Retrieve blockchain audit trail for a consent ID.

---

## Hyperledger Fabric — Enable Real Blockchain

By default the system uses an **in-memory mock ledger** so everything works without Fabric. To enable the real blockchain:

```bash
# 1. Install fabric-samples
curl -sSL https://bit.ly/2ysbOFE | bash -s

# 2. Run setup script
cd project/fabric
export FABRIC_SAMPLES_PATH=$HOME/fabric-samples
chmod +x setup-network.sh
./setup-network.sh setup

# 3. In backend/.env, FABRIC_ENABLED is automatically set to true

# 4. Restart backend
cd ../backend && npm start

# Teardown
./setup-network.sh down
```

The Fabric chaincode (`consentContract.js`) supports:
- `RecordConsentEvent` — write audit event with payload hash
- `StoreConsentPolicy` — store executable policy on-chain
- `GetConsentHistory` — full immutable history for a consent ID
- `VerifyConsentIntegrity` — cryptographic hash verification
- `RevokeConsent` — on-chain revocation record

---

## OPA Policy Enforcement

OPA runs at `http://localhost:8181`. The Rego policy at `backend/opa/policies/consent.rego` evaluates:

| Rule | Description |
|------|-------------|
| `consent_exists` | Active consent found for user |
| `consent_active` | Status is `active` |
| `consent_expired` | Expiry date not passed |
| `data_type_matches` | Requested data type covered |
| `sharing_party_permitted` | Requester in allowed sharing parties |
| `gdpr_marketing_violation` | EU requires explicit marketing consent |
| `dpdp_sharing_violation` | India requires explicit third-party sharing |

If OPA is unreachable, the backend **automatically falls back** to a local JavaScript rule engine that mirrors the same logic — so the system never breaks.

---

## PaddleOCR Pipeline

```
Upload (image/PDF)
       ↓
OCR Service (FastAPI :8000)
       ↓
Text Extraction (PaddleOCR / PDF text layer)
       ↓
Section Detection (regex-based):
  - Purpose of Processing
  - Data Categories
  - Retention Period
  - Jurisdiction References
  - Data Subject Rights
  - Third-Party Sharing
       ↓
NLP Parser (backend)
       ↓
Consent Record Created → OPA Check → Blockchain Recorded
```

The OCR service gracefully falls back to a **mock extraction** when PaddleOCR is not installed, so you can demo the full flow without the heavy ML dependency.

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React + React Router + Axios |
| Backend | Node.js + Express |
| NLP Parsing | Custom rule-based parser (nlpParser.js) |
| Policy Engine | Open Policy Agent (OPA) + Rego |
| Database | Apache CouchDB (document store) |
| Blockchain | Hyperledger Fabric 2.5 (or mock ledger) |
| OCR | PaddleOCR 2.7 + FastAPI |
| Containerization | Docker + Docker Compose |
| Jurisdiction | Rule-based GDPR/DPDP/CCPA resolver |

---

## Environment Variables (backend/.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Backend server port |
| `COUCHDB_URL` | `http://admin:password@localhost:5984` | CouchDB connection |
| `COUCHDB_NAME` | `consent_db` | Database name |
| `OPA_URL` | `http://localhost:8181` | OPA server URL |
| `OCR_SERVICE_URL` | `http://localhost:8000` | OCR microservice URL |
| `FABRIC_ENABLED` | `false` | Enable real Hyperledger Fabric |
| `FABRIC_CHANNEL` | `mychannel` | Fabric channel name |
| `FABRIC_CHAINCODE` | `consent` | Chaincode name |

---

## Regulatory Compliance Coverage

| Regulation | Jurisdiction | Principles Enforced |
|-----------|-------------|-------------------|
| GDPR | EU | Art.5 Purpose Limitation, Art.5 Storage Limitation, Art.7 Consent, Art.28 Processor |
| DPDP Act | India | S.4 Purpose, S.6 Consent, S.8 Retention, S.9 Transfer |
| CCPA | US | Right to Know, Right to Delete, Opt-Out |
| UK GDPR | UK | Same as EU GDPR |

---

*Built for the Adaptive Machine-Readable Consent Intelligence Platform project.*
