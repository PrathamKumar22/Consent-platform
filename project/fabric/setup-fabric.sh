#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Hyperledger Fabric Setup Script
#  Downloads fresh fabric-samples INTO project/fabric-samples/
#  Creates channel "platform" and deploys consent chaincode
#
#  Run from: project/fabric/
#  Usage:    ./setup-fabric.sh          → full setup
#            ./setup-fabric.sh down     → tear down network
#            ./setup-fabric.sh restart  → down + setup
# ═══════════════════════════════════════════════════════════════

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[FABRIC]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Paths ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
FABRIC_SAMPLES="${PROJECT_DIR}/fabric-samples"
TEST_NETWORK="${FABRIC_SAMPLES}/test-network"
CHAINCODE_PATH="${SCRIPT_DIR}/chaincode/consent"
CHANNEL_NAME="platform"
CHAINCODE_NAME="consent"
BACKEND_ENV="${PROJECT_DIR}/backend/.env"

log "Project dir:   $PROJECT_DIR"
log "Fabric samples: $FABRIC_SAMPLES"
log "Channel:        $CHANNEL_NAME"

# ── Check Docker ──────────────────────────────────────────────
check_docker() {
  command -v docker >/dev/null 2>&1 || err "Docker not installed"
  docker info >/dev/null 2>&1 || err "Docker not running"
  log "Docker OK"
}

# ── Download fabric-samples if not present or broken ──────────
download_fabric() {
  local NEEDS_DOWNLOAD=false

  if [ ! -d "$FABRIC_SAMPLES" ]; then
    NEEDS_DOWNLOAD=true
    log "fabric-samples not found — downloading..."
  elif [ ! -f "$FABRIC_SAMPLES/test-network/network.sh" ]; then
    NEEDS_DOWNLOAD=true
    warn "fabric-samples incomplete — re-downloading..."
    rm -rf "$FABRIC_SAMPLES"
  elif [ ! -f "$FABRIC_SAMPLES/test-network/organizations/fabric-ca/registerEnroll.sh" ]; then
    NEEDS_DOWNLOAD=true
    warn "fabric-samples scripts missing — re-downloading..."
    rm -rf "$FABRIC_SAMPLES"
  fi

  if [ "$NEEDS_DOWNLOAD" = true ]; then
    cd "$PROJECT_DIR"
    log "Downloading Hyperledger Fabric 2.5.0 binaries and samples..."
    log "This may take 5-10 minutes..."
    curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.7
    # Move fabric-samples into project if downloaded to current dir
    if [ -d "${PROJECT_DIR}/fabric-samples" ]; then
      log "fabric-samples downloaded to project folder ✅"
    else
      err "Download failed. Check internet connection."
    fi
  else
    log "fabric-samples already present ✅"
  fi
}

# ── Clean old network ─────────────────────────────────────────
clean_network() {
  log "Cleaning old Fabric network..."
  cd "$TEST_NETWORK"

  # Fix any permission issues from previous sudo runs
  sudo chown -R "$USER:$USER" "$TEST_NETWORK" 2>/dev/null || true

  # Bring down network
  ./network.sh down 2>/dev/null || true

  # Stop and remove all Fabric containers
  docker stop $(docker ps -aq --filter "name=peer0" \
    --filter "name=orderer" \
    --filter "name=ca_org" \
    --filter "name=couchdb" \
    --filter "name=dev-peer") 2>/dev/null || true

  docker rm $(docker ps -aq --filter "name=peer0" \
    --filter "name=orderer" \
    --filter "name=ca_org" \
    --filter "name=couchdb" \
    --filter "name=dev-peer") 2>/dev/null || true

  # Remove volumes
  docker volume rm $(docker volume ls -q --filter "name=compose_") 2>/dev/null || true
  docker volume rm $(docker volume ls -q --filter "name=docker_") 2>/dev/null || true

  # Clean artifacts
  sudo rm -rf organizations/ channel-artifacts/ system-genesis-block/ 2>/dev/null || true
  rm -rf organizations/ channel-artifacts/ system-genesis-block/ 2>/dev/null || true

  log "Network cleaned ✅"
}

# ── Start network ─────────────────────────────────────────────
start_network() {
  cd "$TEST_NETWORK"

  export PATH="${FABRIC_SAMPLES}/bin:$PATH"
  export FABRIC_CFG_PATH="${FABRIC_SAMPLES}/config"

  log "Starting Fabric network with channel '$CHANNEL_NAME'..."
  log "Using CouchDB as state database..."

  ./network.sh up createChannel -c "$CHANNEL_NAME" -s couchdb -ca

  # Verify channel created
  if [ ! -f "./channel-artifacts/${CHANNEL_NAME}.block" ]; then
    err "Channel block not created. Network startup failed."
  fi

  log "Network started and channel '$CHANNEL_NAME' created ✅"

  # List running containers
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "peer|orderer|couchdb|ca_"
}

# ── Install chaincode deps ────────────────────────────────────
install_chaincode_deps() {
  log "Installing chaincode Node.js dependencies..."
  cd "$CHAINCODE_PATH"
  npm install --production
  log "Chaincode deps installed ✅"
}

# ── Deploy chaincode ──────────────────────────────────────────
deploy_chaincode() {
  cd "$TEST_NETWORK"
  export PATH="${FABRIC_SAMPLES}/bin:$PATH"
  export FABRIC_CFG_PATH="${FABRIC_SAMPLES}/config"

  log "Deploying '$CHAINCODE_NAME' chaincode on channel '$CHANNEL_NAME'..."

  ./network.sh deployCC \
    -ccn "$CHAINCODE_NAME" \
    -ccp "$CHAINCODE_PATH" \
    -ccl javascript \
    -ccv 1.0 \
    -ccs 1 \
    -c "$CHANNEL_NAME"

  log "Chaincode deployed ✅"
}

# ── Copy connection profile ───────────────────────────────────
copy_connection_profile() {
  local CP_SRC="${TEST_NETWORK}/organizations/peerOrganizations/org1.example.com/connection-org1.json"
  local CP_DST="${PROJECT_DIR}/backend/fabric-connection.json"

  if [ -f "$CP_SRC" ]; then
    cp "$CP_SRC" "$CP_DST"
    log "Connection profile copied to backend/ ✅"
  else
    warn "Connection profile not found at $CP_SRC"
    warn "Backend will use mock ledger"
  fi
}

# ── Update backend .env ───────────────────────────────────────
update_env() {
  if [ -f "$BACKEND_ENV" ]; then
    sed -i 's/FABRIC_ENABLED=false/FABRIC_ENABLED=true/' "$BACKEND_ENV"
    sed -i "s/FABRIC_CHANNEL=.*/FABRIC_CHANNEL=${CHANNEL_NAME}/" "$BACKEND_ENV"
    log "Backend .env updated — FABRIC_ENABLED=true, CHANNEL=${CHANNEL_NAME} ✅"
  else
    warn "Backend .env not found at $BACKEND_ENV"
  fi
}

# ── Teardown ──────────────────────────────────────────────────
teardown() {
  log "Tearing down Fabric network..."
  clean_network
  # Reset env
  if [ -f "$BACKEND_ENV" ]; then
    sed -i 's/FABRIC_ENABLED=true/FABRIC_ENABLED=false/' "$BACKEND_ENV"
    log "Backend reset to mock mode"
  fi
  log "Teardown complete ✅"
}

# ── Main ──────────────────────────────────────────────────────
case "${1:-setup}" in
  setup)
    check_docker
    download_fabric
    clean_network
    start_network
    install_chaincode_deps
    deploy_chaincode
    copy_connection_profile
    update_env

    log ""
    log "═══════════════════════════════════════════════════════"
    log " Hyperledger Fabric setup COMPLETE!"
    log ""
    log "  Channel:     $CHANNEL_NAME"
    log "  Chaincode:   $CHAINCODE_NAME"
    log "  Peer Org1:   localhost:7051"
    log "  Peer Org2:   localhost:9051"
    log "  Orderer:     localhost:7050"
    log "  CouchDB0:    http://localhost:5984  (Fabric state)"
    log "  CouchDB1:    http://localhost:7984  (Fabric state)"
    log ""
    log "  FABRIC_ENABLED=true set in backend/.env"
    log ""
    log "  Now restart your backend:"
    log "  → cd ../backend && node src/index.js"
    log "═══════════════════════════════════════════════════════"
    ;;

  down)
    teardown
    ;;

  restart)
    teardown
    sleep 2
    $0 setup
    ;;

  *)
    echo "Usage: $0 [setup|down|restart]"
    exit 1
    ;;
esac
