const nano = require('nano');

const COUCHDB_URL  = process.env.COUCHDB_URL  || 'http://admin:password@localhost:5984';
const COUCHDB_NAME = process.env.COUCHDB_NAME || 'consent_db';

const couch = nano(COUCHDB_URL);
let db;

// ── Init ──────────────────────────────────────────────────────
async function initDB() {
  const dbList = await couch.db.list();
  if (!dbList.includes(COUCHDB_NAME)) {
    await couch.db.create(COUCHDB_NAME);
    console.log(`📦 Created CouchDB database: ${COUCHDB_NAME}`);
  }
  db = couch.use(COUCHDB_NAME);

  // Create indexes for fast lookup
  await _createIndexes();
}

async function _createIndexes() {
  try {
    await db.createIndex({ index: { fields: ['userId', 'status'] }, name: 'userId-status-index' });
    await db.createIndex({ index: { fields: ['type', 'userId'] }, name: 'type-userId-index' });
  } catch (_) { /* indexes may already exist */ }
}

function getDB() {
  if (!db) throw new Error('CouchDB not initialized. Call initDB() first.');
  return db;
}

// ── CRUD ──────────────────────────────────────────────────────

async function saveDocument(doc) {
  const database = getDB();
  const result = await database.insert(doc);
  return result;
}

async function getDocument(id) {
  const database = getDB();
  return await database.get(id);
}

async function updateDocument(doc) {
  const database = getDB();
  return await database.insert(doc); // CouchDB upsert with _rev
}

async function queryByUserId(userId) {
  const database = getDB();
  const result = await database.find({
    selector: { type: 'consent', userId: userId },
    
  });
  return result.docs;
}

async function queryByUserIdAndStatus(userId, status) {
  const database = getDB();
  const result = await database.find({
    selector: { type: 'consent', userId, status },
  });
  return result.docs;
}

async function queryActiveConsents(userId, dataType) {
  const database = getDB();
  const result = await database.find({
    selector: {
      type: 'consent',
      userId,
      dataType,
      status: 'active',
    },
  });
  return result.docs;
}

// Save audit event
async function saveAuditEvent(event) {
  try {
    const database = getDB();
    await database.insert({
      type: 'audit',
      ...event,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Audit save failed (non-fatal):', err.message);
  }
}

module.exports = {
  initDB,
  getDB,
  saveDocument,
  getDocument,
  updateDocument,
  queryByUserId,
  queryByUserIdAndStatus,
  queryActiveConsents,
  saveAuditEvent,
};
