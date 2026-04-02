require('dotenv').config();
const express = require('express');
const cors = require('cors');
const consentRoutes = require('./routes/consent');
const { initDB } = require('./services/couchdb');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Routes ────────────────────────────────────────────────────
app.use('/consent', consentRoutes);

// ── Health ────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Consent Management Backend', timestamp: new Date().toISOString() });
});

// ── Boot ──────────────────────────────────────────────────────
async function start() {
  try {
    await initDB();
    console.log('✅ CouchDB connected and DB ready');
  } catch (err) {
    console.warn('⚠️  CouchDB not reachable — running without persistence:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Consent Backend running on http://localhost:${PORT}`);
    console.log(`   OPA:          ${process.env.OPA_URL}`);
    console.log(`   OCR Service:  ${process.env.OCR_SERVICE_URL}`);
    console.log(`   Fabric:       ${process.env.FABRIC_ENABLED === 'true' ? 'ENABLED' : 'DISABLED'}`);
  });
}

start();
