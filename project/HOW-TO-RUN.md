# How to Run — Consent Management Platform

## STEP 1 — Start App Services (Always do this first)

```bash
cd ~/Downloads/consent-platform/project
./start-local.sh
```

This starts:
- CouchDB on **port 5985** (your app data)
- OPA on port 8181
- OCR service on port 8000
- Backend on port 5000

---

## STEP 2 — Start Frontend (New terminal)

```bash
cd ~/Downloads/consent-platform/project/frontend
npm install
npm start
```

Open: http://localhost:3000

---

## STEP 3 — Setup Hyperledger Fabric (One time only)

```bash
cd ~/Downloads/consent-platform/project/fabric
./setup-fabric.sh
```

This automatically:
1. Downloads fresh fabric-samples into project/fabric-samples/
2. Starts Fabric network (peer, orderer, CA, CouchDB on 5984)
3. Creates channel "platform"
4. Deploys consent chaincode
5. Sets FABRIC_ENABLED=true in backend/.env

After this, **restart the backend**:
```bash
# Stop current backend (Ctrl+C), then:
cd ~/Downloads/consent-platform/project/backend
node src/index.js
```

---

## STEP 4 — Verify Fabric is working

```bash
# Create a consent from the UI, then check audit trail:
curl http://localhost:5000/consent/audit/YOUR_CONSENT_ID
```

Response will show `"source": "hyperledger-fabric"` ✅

---

## Port Summary

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 3000 | React UI |
| Backend | 5000 | Node.js API |
| Your CouchDB | **5985** | App consent data |
| OPA | 8181 | Policy enforcement |
| OCR | 8000 | Document digitization |
| Fabric CouchDB0 | 5984 | Fabric peer state |
| Fabric CouchDB1 | 7984 | Fabric peer state |
| Fabric Peer Org1 | 7051 | Blockchain peer |
| Fabric Peer Org2 | 9051 | Blockchain peer |
| Fabric Orderer | 7050 | Blockchain orderer |

---

## Tear down Fabric

```bash
cd ~/Downloads/consent-platform/project/fabric
./setup-fabric.sh down
```

## Restart everything fresh

```bash
cd ~/Downloads/consent-platform/project/fabric
./setup-fabric.sh restart
```
