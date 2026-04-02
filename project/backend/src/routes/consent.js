/**
 * Consent Routes
 * All endpoints consumed by the React frontend.
 *
 * POST /consent/create
 * GET  /consent/:id
 * POST /consent/revoke/:id
 * POST /consent/supersede/:oldId
 * POST /consent/data-access
 * POST /consent/document/upload
 * POST /consent/parse-text
 * GET  /consent/consents/user/:userId
 * GET  /consent/audit/:consentId
 */

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const { v4: uuidv4 } = require('uuid');
const axios    = require('axios');
const FormData = require('form-data');
const fs       = require('fs');

const { parseConsentText, generateExecutablePolicy, mapRegulatoryPrinciples } = require('../parsers/nlpParser');
const { evaluateConsent } = require('../services/opaService');
const { recordConsentEvent, getConsentHistory } = require('../services/fabricService');
const { validateAgainstJurisdiction } = require('../services/jurisdictionService');
const db = require('../services/couchdb');

// Multer — store uploads in memory for forwarding to OCR service
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── Helper ────────────────────────────────────────────────────

function daysToExpiry(expiryStr) {
  if (!expiryStr) return 0;
  const diff = new Date(expiryStr) - new Date();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function isExpired(expiryStr) {
  if (!expiryStr) return false;
  return new Date(expiryStr) < new Date();
}

// ── POST /consent/parse-text ──────────────────────────────────

router.post('/parse-text', (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const parsed = parseConsentText(text);
  res.json({ parsed });
});

// ── POST /consent/create ──────────────────────────────────────

router.post('/create', async (req, res) => {
  try {
    const {
      userId, dataType, purpose, retention = 'not specified',
      expiry, jurisdiction = 'unknown', sharingParties, legalText,
    } = req.body;

    if (!userId || !dataType || !purpose) {
      return res.status(400).json({ message: 'userId, dataType, and purpose are required' });
    }

    // Parse legalText if provided
    let parsedFromText = {};
    if (legalText && legalText.trim()) {
      parsedFromText = parseConsentText(legalText);
    }

    // Jurisdiction validation
    const jurisValidation = validateAgainstJurisdiction(req.body, jurisdiction);

    const consentId = `C_${uuidv4().slice(0, 8).toUpperCase()}`;

    // Merge parsed + form data (form data takes priority)
    const finalDataType    = dataType    || parsedFromText.dataType    || 'personal';
    const finalPurpose     = purpose     || parsedFromText.purpose     || 'service';
    const finalJurisdiction= jurisdiction!== 'unknown' ? jurisdiction : (parsedFromText.jurisdiction || 'unknown');
    const finalRetention   = retention  !== 'not specified' ? retention : (parsedFromText.retention || 'not specified');

    let parsedSharing = ['self'];
    try { parsedSharing = JSON.parse(sharingParties); } catch (_) {}
    const finalSharing = parsedSharing.length > 1 ? parsedSharing : (parsedFromText.sharingParties || ['self']);

    // Build clauses & regulatory principles
    const clauses = parsedFromText.clauses || [];
    const regulatoryPrinciples = mapRegulatoryPrinciples(
      { dataType: finalDataType, purpose: finalPurpose, retention: finalRetention, sharingParties: finalSharing },
      finalJurisdiction
    );

    // Build executable policy
    const policy = generateExecutablePolicy(
      { dataType: finalDataType, purpose: finalPurpose, retention: finalRetention, jurisdiction: finalJurisdiction, sharingParties: finalSharing },
      consentId,
      userId,
      expiry
    );

    const consentDoc = {
      _id:                consentId,
      type:               'consent',
      consentId,
      userId,
      dataType:           finalDataType,
      purpose:            finalPurpose,
      retention:          finalRetention,
      expiry:             expiry || null,
      jurisdiction:       finalJurisdiction,
      sharingParties:     finalSharing,
      status:             'active',
      version:            1,
      legalText:          legalText || null,
      clauses,
      regulatoryPrinciples,
      executablePolicy:   policy,
      jurisdictionWarnings: jurisValidation.warnings,
      createdAt:          new Date().toISOString(),
    };

    // Save to CouchDB
    try {
      await db.saveDocument(consentDoc);
    } catch (dbErr) {
      console.warn('CouchDB save failed (running without DB):', dbErr.message);
    }

    // Record on blockchain
    await recordConsentEvent('CONSENT_CREATED', consentId, {
      userId, dataType: finalDataType, purpose: finalPurpose, expiry, jurisdiction: finalJurisdiction,
    });

    res.json({
      consentId,
      consent: {
        consentId,
        userId,
        dataType:           finalDataType,
        purpose:            finalPurpose,
        retention:          finalRetention,
        expiry:             expiry || null,
        jurisdiction:       finalJurisdiction,
        sharingParties:     finalSharing,
        status:             'active',
        version:            1,
        clauses,
        regulatoryPrinciples,
        jurisdictionWarnings: jurisValidation.warnings,
      },
    });
  } catch (err) {
    console.error('Create consent error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /consent/consents/user/:userId ───────────────────────
// MUST come before /:id to avoid route collision

router.get('/consents/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    let consents = [];

    try {
      consents = await db.queryByUserId(userId);
    } catch (dbErr) {
      console.warn('CouchDB query failed:', dbErr.message);
      return res.json([]);
    }

    const enriched = consents.map(c => ({
      ...c,
      daysToExpiry: daysToExpiry(c.expiry),
      isExpired:    isExpired(c.expiry),
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /consent/:id ──────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const consent = await db.getDocument(req.params.id);
    res.json({
      ...consent,
      daysToExpiry: daysToExpiry(consent.expiry),
      isExpired:    isExpired(consent.expiry),
    });
  } catch (err) {
    res.status(404).json({ message: 'Consent not found', error: err.message });
  }
});

// ── POST /consent/revoke/:id ──────────────────────────────────

router.post('/revoke/:id', async (req, res) => {
  try {
    const consentDoc = await db.getDocument(req.params.id);
    if (consentDoc.status === 'revoked') {
      return res.status(400).json({ message: 'Consent already revoked' });
    }

    consentDoc.status    = 'revoked';
    consentDoc.revokedAt = new Date().toISOString();
    await db.updateDocument(consentDoc);

    await recordConsentEvent('CONSENT_REVOKED', req.params.id, {
      userId: consentDoc.userId, revokedAt: consentDoc.revokedAt,
    });

    res.json({ message: 'Consent revoked', consentId: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /consent/supersede/:oldId ───────────────────────────

router.post('/supersede/:oldId', async (req, res) => {
  try {
    const oldConsent = await db.getDocument(req.params.oldId);

    // Mark old as superseded
    oldConsent.status      = 'superseded';
    oldConsent.supersededAt = new Date().toISOString();
    await db.updateDocument(oldConsent);

    const {
      dataType, purpose, retention = 'not specified',
      expiry, jurisdiction = 'unknown', sharingParties, legalText,
    } = req.body;

    // Parse legalText if provided
    let parsedFromText = {};
    if (legalText && legalText.trim()) {
      parsedFromText = parseConsentText(legalText);
    }

    const newConsentId = `C_${uuidv4().slice(0, 8).toUpperCase()}`;
    const newVersion   = (oldConsent.version || 1) + 1;

    let parsedSharing = ['self'];
    try { parsedSharing = JSON.parse(sharingParties); } catch (_) {}

    const finalDataType     = dataType     || parsedFromText.dataType     || oldConsent.dataType;
    const finalPurpose      = purpose      || parsedFromText.purpose      || oldConsent.purpose;
    const finalJurisdiction = jurisdiction !== 'unknown' ? jurisdiction : (parsedFromText.jurisdiction || oldConsent.jurisdiction);
    const finalRetention    = retention   !== 'not specified' ? retention : (parsedFromText.retention || oldConsent.retention);
    const finalSharing      = parsedSharing.length > 1 ? parsedSharing : (parsedFromText.sharingParties || oldConsent.sharingParties);

    const clauses = parsedFromText.clauses || [];
    const regulatoryPrinciples = mapRegulatoryPrinciples(
      { dataType: finalDataType, purpose: finalPurpose, retention: finalRetention, sharingParties: finalSharing },
      finalJurisdiction
    );

    const newConsentDoc = {
      _id:                newConsentId,
      type:               'consent',
      consentId:          newConsentId,
      userId:             oldConsent.userId,
      dataType:           finalDataType,
      purpose:            finalPurpose,
      retention:          finalRetention,
      expiry:             expiry || null,
      jurisdiction:       finalJurisdiction,
      sharingParties:     finalSharing,
      status:             'active',
      version:            newVersion,
      supersedes:         req.params.oldId,
      legalText:          legalText || null,
      clauses,
      regulatoryPrinciples,
      createdAt:          new Date().toISOString(),
    };

    try {
      await db.saveDocument(newConsentDoc);
    } catch (dbErr) {
      console.warn('CouchDB save failed:', dbErr.message);
    }

    await recordConsentEvent('CONSENT_SUPERSEDED', newConsentId, {
      oldConsentId: req.params.oldId,
      userId:       oldConsent.userId,
      version:      newVersion,
    });

    res.json({
      consentId:          newConsentId,
      oldConsentId:       req.params.oldId,
      userId:             oldConsent.userId,
      dataType:           finalDataType,
      purpose:            finalPurpose,
      retention:          finalRetention,
      expiry:             expiry || null,
      jurisdiction:       finalJurisdiction,
      sharingParties:     finalSharing,
      status:             'active',
      version:            newVersion,
      clauses,
      regulatoryPrinciples,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /consent/data-access ─────────────────────────────────

router.post('/data-access', async (req, res) => {
  try {
    const { userId, dataType, sharingParty = 'self' } = req.body;

    if (!userId || !dataType) {
      return res.status(400).json({ message: 'userId and dataType are required' });
    }

    // Find active consent
    let activeConsents = [];
    try {
      activeConsents = await db.queryActiveConsents(userId, dataType);
    } catch (dbErr) {
      console.warn('CouchDB query failed:', dbErr.message);
    }

    const consent = activeConsents.find(c => !isExpired(c.expiry)) || null;

    // Evaluate via OPA (or local fallback)
    const opaInput  = { consent, request: { userId, dataType, sharingParty } };
    const decision  = await evaluateConsent(opaInput);

    // Record enforcement event on blockchain
    await recordConsentEvent('DATA_ACCESS_CHECK', consent?._id || 'NO_CONSENT', {
      userId, dataType, sharingParty, decision: decision.allowed ? 'ALLOW' : 'DENY',
    });

    // Save audit event
    await db.saveAuditEvent({
      eventType:  'DATA_ACCESS_CHECK',
      userId,
      dataType,
      sharingParty,
      consentId:  consent?._id || null,
      decision:   decision.allowed ? 'ALLOW' : 'DENY',
      explanation: decision.explanation,
    });

    if (decision.allowed) {
      res.json({
        allowed:     true,
        consentId:   consent._id,
        decision:    'ALLOW',
        explanation: decision.explanation,
        policyCheck: decision,
      });
    } else {
      res.status(403).json({
        allowed:     false,
        decision:    'DENY',
        message:     'Access denied by consent policy',
        explanation: decision.explanation,
        policyCheck: decision,
      });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /consent/document/upload ─────────────────────────────

router.post('/document/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId  = req.body.userId || 'anonymous';
    const OCR_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8000';

    // Forward to OCR microservice
    let ocrResult;
    try {
      const formData = new FormData();
      formData.append('file', req.file.buffer, {
        filename:    req.file.originalname,
        contentType: req.file.mimetype,
      });

      const ocrResponse = await axios.post(`${OCR_URL}/ocr/extract`, formData, {
        headers: formData.getHeaders(),
        timeout: 60000,
      });
      ocrResult = ocrResponse.data;
    } catch (ocrErr) {
      console.warn('OCR service unavailable, using mock:', ocrErr.message);
      // Mock OCR result for demo
      ocrResult = {
        text: `This consent form grants permission to process health data for medical analytics 
               under GDPR regulation. Data shall be retained for 1 year and not shared with 
               third parties. The user has the right to withdraw consent at any time.`,
        sections: [
          { title: 'Purpose', content: ['medical analytics', 'service delivery'] },
          { title: 'Retention', content: ['1 year retention period'] },
          { title: 'Jurisdiction', content: ['GDPR compliant', 'European Union'] },
          { title: 'Sharing', content: ['No third-party sharing'] },
        ],
        confidence: 0.92,
        source: 'mock-ocr',
      };
    }

    const extractedText = ocrResult.text || '';

    // Parse extracted text
    const parsed = parseConsentText(extractedText);

    // Build consent document
    const consentId = `C_OCR_${uuidv4().slice(0, 8).toUpperCase()}`;
    const expiry    = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const regulatoryPrinciples = mapRegulatoryPrinciples(parsed, parsed.jurisdiction);

    const consentDoc = {
      _id:                consentId,
      type:               'consent',
      consentId,
      userId,
      dataType:           parsed.dataType,
      purpose:            parsed.purpose,
      retention:          parsed.retention,
      expiry,
      jurisdiction:       parsed.jurisdiction,
      sharingParties:     parsed.sharingParties,
      status:             'active',
      version:            1,
      legalText:          extractedText,
      clauses:            parsed.clauses,
      regulatoryPrinciples,
      source:             'ocr-digitized',
      ocrConfidence:      ocrResult.confidence || null,
      createdAt:          new Date().toISOString(),
    };

    try {
      await db.saveDocument(consentDoc);
    } catch (dbErr) {
      console.warn('CouchDB save failed:', dbErr.message);
    }

    // OPA check
    const opaInput = { consent: consentDoc, request: { userId, dataType: parsed.dataType, sharingParty: 'self' } };
    const policyCheck = await evaluateConsent(opaInput);

    // Blockchain record
    await recordConsentEvent('CONSENT_DIGITIZED', consentId, {
      userId, source: 'ocr', dataType: parsed.dataType,
    });

    res.json({
      consentId,
      userId,
      text:        extractedText,
      sections:    ocrResult.sections || [],
      parsed,
      transformed: consentDoc.executablePolicy || null,
      policyCheck,
      ocrSource:   ocrResult.source || 'paddleocr',
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /consent/audit/:consentId ─────────────────────────────

router.get('/audit/:consentId', async (req, res) => {
  try {
    const history = await getConsentHistory(req.params.consentId);
    res.json({ consentId: req.params.consentId, history });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
