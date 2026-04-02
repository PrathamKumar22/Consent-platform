const fs = require('fs');
const path = require('path');

const TEST_NETWORK = '/home/pratham/Documents/consent-platform-fixed/project/fabric-samples/test-network';
const WALLET_PATH  = '/home/pratham/Documents/consent-platform-fixed/project/backend/fabric-wallet';

const certPath = path.join(TEST_NETWORK,
  'organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/Admin@org1.example.com-cert.pem');

const keyDir = path.join(TEST_NETWORK,
  'organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore');

const keyFile = fs.readdirSync(keyDir)[0];
const keyPath = path.join(keyDir, keyFile);

const cert = fs.readFileSync(certPath).toString();
const key  = fs.readFileSync(keyPath).toString();

const identity = {
  credentials: { certificate: cert, privateKey: key },
  mspId: 'Org1MSP',
  type: 'X.509',
};

// Save as file-based wallet manually
fs.mkdirSync(WALLET_PATH, { recursive: true });
fs.writeFileSync(
  path.join(WALLET_PATH, 'appUser.id'),
  JSON.stringify(identity, null, 2)
);

console.log('✅ appUser identity saved to wallet!');
console.log('   Cert:', certPath);
console.log('   Key: ', keyPath);
