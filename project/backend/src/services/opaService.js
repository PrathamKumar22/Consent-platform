/**
 * OPA (Open Policy Agent) Integration Service
 * Sends consent + request data to OPA for allow/deny evaluation.
 * Also generates explainable decisions.
 */

const axios = require('axios');

const OPA_URL = process.env.OPA_URL || 'http://localhost:8181';
const OPA_POLICY_PATH = '/v1/data/consent/allow';

// ── Query OPA ─────────────────────────────────────────────────

async function evaluateConsent(input) {
  try {
    const response = await axios.post(
      `${OPA_URL}${OPA_POLICY_PATH}`,
      { input },
      { timeout: 5000 }
    );
    return {
      allowed: response.data?.result === true,
      source: 'opa',
      raw: response.data,
    };
  } catch (err) {
    // OPA unreachable — fall back to local rule engine
    console.warn('⚠️  OPA unreachable, using local fallback evaluator:', err.message);
    return localEvaluate(input);
  }
}

// ── Local Fallback Rule Engine (mirrors OPA Rego logic) ───────

function localEvaluate(input) {
  const { consent, request } = input;
  const reasons = [];
  const denialReasons = [];

  if (!consent) {
    return { allowed: false, source: 'local', explanation: 'No active consent found for this user and data type.' };
  }

  // Check status
  if (consent.status !== 'active') {
    denialReasons.push(`Consent status is '${consent.status}', not 'active'`);
  }

  // Check expiry
  if (consent.expiry) {
    const expDate = new Date(consent.expiry);
    if (expDate < new Date()) {
      denialReasons.push(`Consent expired on ${consent.expiry}`);
    } else {
      reasons.push(`Consent valid until ${consent.expiry}`);
    }
  }

  // Check data type
  if (consent.dataType && request.dataType) {
    if (consent.dataType.toLowerCase() === request.dataType.toLowerCase()) {
      reasons.push(`Data type '${request.dataType}' matches consent`);
    } else {
      denialReasons.push(`Requested data type '${request.dataType}' not covered (consent covers '${consent.dataType}')`);
    }
  }

  // Check sharing party
  if (request.sharingParty) {
    const allowedParties = Array.isArray(consent.sharingParties) ? consent.sharingParties : ['self'];
    if (allowedParties.includes(request.sharingParty)) {
      reasons.push(`Sharing party '${request.sharingParty}' is permitted`);
    } else {
      denialReasons.push(`Sharing party '${request.sharingParty}' not in allowed list: [${allowedParties.join(', ')}]`);
    }
  }

  const allowed = denialReasons.length === 0;

  return {
    allowed,
    source: 'local-fallback',
    explanation: buildExplanation(allowed, reasons, denialReasons, consent, request),
    reasons,
    denialReasons,
  };
}

// ── Explainability Builder ─────────────────────────────────────

function buildExplanation(allowed, reasons, denialReasons, consent, request) {
  const lines = [];
  lines.push(`DECISION: ${allowed ? '✅ ALLOW' : '❌ DENY'}`);
  lines.push(`TIMESTAMP: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('REQUEST SUMMARY:');
  lines.push(`  User ID:        ${request?.userId || 'N/A'}`);
  lines.push(`  Data Type:      ${request?.dataType || 'N/A'}`);
  lines.push(`  Sharing Party:  ${request?.sharingParty || 'N/A'}`);
  lines.push('');
  lines.push('CONSENT SUMMARY:');
  lines.push(`  Consent ID:     ${consent?._id || 'N/A'}`);
  lines.push(`  Status:         ${consent?.status || 'N/A'}`);
  lines.push(`  Expiry:         ${consent?.expiry || 'N/A'}`);
  lines.push(`  Jurisdiction:   ${consent?.jurisdiction || 'N/A'}`);
  lines.push('');

  if (reasons.length > 0) {
    lines.push('ALLOW REASONS:');
    reasons.forEach(r => lines.push(`  ✓ ${r}`));
    lines.push('');
  }

  if (denialReasons.length > 0) {
    lines.push('DENIAL REASONS:');
    denialReasons.forEach(r => lines.push(`  ✗ ${r}`));
    lines.push('');
  }

  if (consent?.clauses?.length > 0) {
    lines.push('APPLICABLE CLAUSES:');
    consent.clauses.slice(0, 3).forEach(c => lines.push(`  [${c.type || 'general'}] ${c.text?.slice(0, 100)}...`));
    lines.push('');
  }

  if (consent?.regulatoryPrinciples?.length > 0) {
    lines.push('REGULATORY PRINCIPLES:');
    consent.regulatoryPrinciples.forEach(p => lines.push(`  ${p.code}: ${p.description}`));
  }

  return lines.join('\n');
}

// ── Health Check ──────────────────────────────────────────────

async function checkOPAHealth() {
  try {
    const res = await axios.get(`${OPA_URL}/health`, { timeout: 3000 });
    return { healthy: true, data: res.data };
  } catch {
    return { healthy: false };
  }
}

module.exports = { evaluateConsent, localEvaluate, buildExplanation, checkOPAHealth };
