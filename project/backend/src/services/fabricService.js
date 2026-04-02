const crypto = require('crypto');
const path   = require('path');
const fs     = require('fs');
const grpc   = require('@grpc/grpc-js');
const { connect, hash, signers } = require('@hyperledger/fabric-gateway');
const crypto2 = require('crypto');

const FABRIC_ENABLED   = process.env.FABRIC_ENABLED === 'true';
const FABRIC_CHANNEL   = process.env.FABRIC_CHANNEL || 'platform';
const FABRIC_CHAINCODE = process.env.FABRIC_CHAINCODE || 'consent';

const TEST_NETWORK = '/home/pratham/Documents/consent-platform-fixed/project/fabric-samples/test-network';
const WALLET_PATH  = path.join(__dirname, '../../fabric-wallet');

const TLS_CERT = path.join(TEST_NETWORK,
  'organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt');

const CERT_PATH = path.join(TEST_NETWORK,
  'organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/Admin@org1.example.com-cert.pem');

const KEY_DIR = path.join(TEST_NETWORK,
  'organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore');

// ── Hash ──────────────────────────────────────────────────────
function hashPayload(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

// ── Mock Ledger ───────────────────────────────────────────────
const mockLedger = [];

function mockSubmit(eventType, consentId, payload) {
  const entry = {
    txId:        `MOCK_TX_${Date.now()}_${Math.random().toString(36).slice(2,8).toUpperCase()}`,
    eventType, consentId,
    payloadHash: hashPayload(payload),
    timestamp:   new Date().toISOString(),
    source:      'mock-ledger',
  };
  mockLedger.push(entry);
  return entry;
}

// ── Real Fabric Submit ────────────────────────────────────────
async function fabricSubmit(eventType, consentId, payload) {
  try {
    // Load TLS cert
    const tlsCert = fs.readFileSync(TLS_CERT);
    const creds   = grpc.credentials.createSsl(tlsCert);
    const client  = new grpc.Client('localhost:7051', creds, {
      'grpc.ssl_target_name_override': 'peer0.org1.example.com',
    });

    // Load identity
    const cert    = fs.readFileSync(CERT_PATH);
    const keyFile = fs.readdirSync(KEY_DIR)[0];
    const keyPem  = fs.readFileSync(path.join(KEY_DIR, keyFile));
    const privateKey = crypto2.createPrivateKey(keyPem);

    const gateway = connect({
      client,
      identity: { mspId: 'Org1MSP', credentials: cert },
      signer: signers.newPrivateKeySigner(privateKey),
    });

    try {
      const network  = gateway.getNetwork(FABRIC_CHANNEL);
      const contract = network.getContract(FABRIC_CHAINCODE);

      const payloadJSON = JSON.stringify(payload);
      const payloadHash = hashPayload(payload);

      await contract.submitTransaction(
        'RecordConsentEvent',
        consentId,
        eventType,
        payloadJSON,
        payloadHash
      );

      return {
        txId:        `TX_${Date.now()}`,
        eventType, consentId,
        payloadHash,
        timestamp:   new Date().toISOString(),
        source:      'hyperledger-fabric',
        channel:     FABRIC_CHANNEL,
      };
    } finally {
      gateway.close();
      client.close();
    }
  } catch (err) {
    console.error('⚠️  Fabric submit error — falling back to mock:', err.message);
    return mockSubmit(eventType, consentId, payload);
  }
}

// ── Public API ────────────────────────────────────────────────
async function recordConsentEvent(eventType, consentId, payload) {
  if (!FABRIC_ENABLED) {
    const entry = mockSubmit(eventType, consentId, payload);
    console.log(`📝 [MockLedger] ${eventType} → ${consentId} | tx: ${entry.txId}`);
    return entry;
  }
  const entry = await fabricSubmit(eventType, consentId, payload);
  console.log(`⛓️  [${entry.source}] ${eventType} → ${consentId} | tx: ${entry.txId}`);
  return entry;
}

async function getConsentHistory(consentId) {
  return mockLedger.filter(e => e.consentId === consentId);
}

module.exports = { recordConsentEvent, getConsentHistory, hashPayload, getMockLedger: () => mockLedger };
