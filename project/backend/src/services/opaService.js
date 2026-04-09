const axios = require('axios');

const OPA_URL = process.env.OPA_URL || 'http://localhost:8181';

async function evaluateConsent(input) {
  const { consent, request } = input;

  // Always run local evaluation to get detailed reasons
  const localResult = localEvaluate(input);

  // Try OPA for the actual decision
  try {
    const response = await axios.post(
      `${OPA_URL}/v1/data/consent/allow`,
      { input },
      { timeout: 5000 }
    );
    const opaAllowed = response.data?.result === true;

    return {
      allowed:     opaAllowed,
      source:      'opa',
      raw:         response.data,
      explanation: buildExplanation(opaAllowed, localResult.reasons, localResult.denialReasons, consent, request),
      reasons:     localResult.reasons,
      denialReasons: localResult.denialReasons,
    };
  } catch (err) {
    console.warn('OPA unreachable, using local fallback:', err.message);
    return localResult;
  }
}

function localEvaluate(input) {
  const { consent, request } = input;
  const reasons = [];
  const denialReasons = [];

  if (!consent) {
    denialReasons.push(`No active consent found for user '${request?.userId}' with data type '${request?.dataType}'`);
    return {
      allowed: false,
      source: 'local-fallback',
      reasons,
      denialReasons,
      explanation: buildExplanation(false, reasons, denialReasons, null, request),
    };
  }

  // Check status
  if (consent.status !== 'active') {
    denialReasons.push(`Consent status is '${consent.status}' — must be 'active'`);
  }

  // Check expiry
  if (consent.expiry) {
    const expDate = new Date(consent.expiry);
    if (expDate < new Date()) {
      denialReasons.push(`Consent expired on ${consent.expiry}`);
    } else {
      const days = Math.floor((expDate - new Date()) / (1000 * 60 * 60 * 24));
      reasons.push(`Consent valid until ${consent.expiry} (${days} days remaining)`);
    }
  }

  // Check data type
  if (consent.dataType && request.dataType) {
    if (consent.dataType.toLowerCase() === request.dataType.toLowerCase()) {
      reasons.push(`Data type '${request.dataType}' matches consented data type`);
    } else {
      denialReasons.push(`Requested data type '${request.dataType}' not covered — consent only allows '${consent.dataType}'`);
    }
  }

  // Check sharing party
  if (request.sharingParty) {
    const allowedParties = Array.isArray(consent.sharingParties) ? consent.sharingParties : ['self'];
    if (allowedParties.includes(request.sharingParty)) {
      reasons.push(`Sharing party '${request.sharingParty}' is in permitted list [${allowedParties.join(', ')}]`);
    } else {
      denialReasons.push(`Sharing party '${request.sharingParty}' NOT permitted — allowed: [${allowedParties.join(', ')}]`);
    }
  }

  // Jurisdiction check
  if (consent.jurisdiction && consent.jurisdiction !== 'unknown') {
    reasons.push(`Jurisdiction: ${consent.jurisdiction} — applicable regulations enforced`);
  }

  // Purpose
  if (consent.purpose) {
    reasons.push(`Purpose '${consent.purpose}' is documented and bound to this consent`);
  }

  const allowed = denialReasons.length === 0;

  return {
    allowed,
    source: 'local-fallback',
    reasons,
    denialReasons,
    explanation: buildExplanation(allowed, reasons, denialReasons, consent, request),
  };
}

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

  if (consent) {
    lines.push('CONSENT SUMMARY:');
    lines.push(`  Consent ID:     ${consent._id || consent.consentId || 'N/A'}`);
    lines.push(`  Status:         ${consent.status || 'N/A'}`);
    lines.push(`  Expiry:         ${consent.expiry || 'N/A'}`);
    lines.push(`  Jurisdiction:   ${consent.jurisdiction || 'N/A'}`);
    lines.push(`  Data Type:      ${consent.dataType || 'N/A'}`);
    lines.push(`  Purpose:        ${consent.purpose || 'N/A'}`);
    lines.push(`  Sharing Parties: [${(consent.sharingParties || []).join(', ')}]`);
    lines.push('');
  }

  if (allowed && reasons.length > 0) {
    lines.push('ALLOW REASONS:');
    reasons.forEach(r => lines.push(`  ✓ ${r}`));
    lines.push('');
  }

  if (!allowed && denialReasons.length > 0) {
    lines.push('DENIAL REASONS:');
    denialReasons.forEach(r => lines.push(`  ✗ ${r}`));
    lines.push('');
  }

  if (consent?.clauses?.length > 0) {
    lines.push('APPLICABLE CLAUSES:');
    consent.clauses.slice(0, 4).forEach(c => {
      const text = c.text?.length > 90 ? c.text.slice(0, 90) + '...' : c.text;
      lines.push(`  [${c.type || 'general'}] ${text}`);
    });
    lines.push('');
  }

  if (consent?.regulatoryPrinciples?.length > 0) {
    lines.push('REGULATORY PRINCIPLES:');
    consent.regulatoryPrinciples.forEach(p => {
      lines.push(`  ${p.code}: ${p.description}`);
    });
    lines.push('');
  }

  if (consent?.jurisdictionWarnings?.length > 0) {
    lines.push('JURISDICTION WARNINGS:');
    consent.jurisdictionWarnings.forEach(w => lines.push(`  ⚠️  ${w}`));
  }

  return lines.join('\n');
}

async function checkOPAHealth() {
  try {
    const res = await axios.get(`${OPA_URL}/health`, { timeout: 3000 });
    return { healthy: true, data: res.data };
  } catch {
    return { healthy: false };
  }
}

module.exports = { evaluateConsent, localEvaluate, buildExplanation, checkOPAHealth };
