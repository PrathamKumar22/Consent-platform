#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Quick Start — Starts all app services locally
#  CouchDB on port 5985 (Fabric uses 5984)
#  OPA on 8181, OCR on 8000, Backend on 5000
#  Frontend: run separately → cd frontend && npm start
# ═══════════════════════════════════════════════════════════════

set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[START]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Cleanup on exit
trap 'log "Shutting down..."; kill $(jobs -p) 2>/dev/null; docker stop consent-couchdb consent-opa 2>/dev/null; true' EXIT

# ── CouchDB on port 5985 (NOT 5984 — that's reserved for Fabric) ──
log "Starting CouchDB on port 5985..."
docker stop consent-couchdb 2>/dev/null; docker rm consent-couchdb 2>/dev/null; true

docker run -d --name consent-couchdb \
  -e COUCHDB_USER=admin \
  -e COUCHDB_PASSWORD=password \
  -p 5985:5984 \
  couchdb:3.3

sleep 3
log "CouchDB ready at http://localhost:5985/_utils (admin/password)"

# ── OPA ──────────────────────────────────────────────────────
log "Starting OPA..."
docker stop consent-opa 2>/dev/null; docker rm consent-opa 2>/dev/null; true

docker run -d --name consent-opa \
  -p 8181:8181 \
  -v "${PROJECT_DIR}/backend/opa/policies:/policies:ro" \
  openpolicyagent/opa:0.59.0 \
  run --server --addr=0.0.0.0:8181 /policies

sleep 2
log "OPA ready at http://localhost:8181"

# ── OCR Service (Python) ──────────────────────────────────────
log "Starting OCR service..."
if command -v python3 &>/dev/null; then
  cd "${PROJECT_DIR}/ocr-service"
  pip3 install -q fastapi uvicorn python-multipart 2>/dev/null || true
  python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --log-level warning &
  cd "${PROJECT_DIR}"
  sleep 2
  log "OCR service ready at http://localhost:8000"
else
  warn "Python3 not found — OCR will use mock fallback in backend"
fi

# ── Backend ───────────────────────────────────────────────────
log "Starting Node.js backend..."
cd "${PROJECT_DIR}/backend"
npm install --silent 2>/dev/null
node src/index.js &
BACKEND_PID=$!
cd "${PROJECT_DIR}"

sleep 2
log ""
log "═══════════════════════════════════════════════════════"
log " All services started!"
log ""
log "  Frontend:  cd frontend && npm install && npm start"
log "  Backend:   http://localhost:5000"
log "  CouchDB:   http://localhost:5985/_utils (admin/password)"
log "  OPA:       http://localhost:8181"
log "  OCR:       http://localhost:8000"
log ""
log "  To enable Hyperledger Fabric:"
log "  → cd fabric && ./setup-fabric.sh"
log ""
log "  Press Ctrl+C to stop all services"
log "═══════════════════════════════════════════════════════"

wait $BACKEND_PID
