/**
 * Rule-Based NLP Parser for Legal Consent Text
 * Extracts structured attributes from human-readable legal clauses.
 * Used before the Policy Generator.
 */

// ── Data Category Keywords ────────────────────────────────────
const DATA_TYPE_PATTERNS = {
  email:       /\b(email|e-mail|electronic mail)\b/i,
  phone:       /\b(phone|mobile|telephone|contact number)\b/i,
  location:    /\b(location|geo|gps|address|whereabouts)\b/i,
  health:      /\b(health|medical|clinical|diagnosis|biometric|genetic)\b/i,
  financial:   /\b(financial|bank|payment|credit|debit|transaction|income)\b/i,
  identity:    /\b(identity|aadhaar|passport|national id|ssn|pan card)\b/i,
  browsing:    /\b(browsing|cookies|tracking|clickstream|web activity)\b/i,
  demographic: /\b(demographic|age|gender|race|ethnicity)\b/i,
  personal:    /\b(personal data|personal information|pii)\b/i,
};

// ── Purpose Keywords ──────────────────────────────────────────
const PURPOSE_PATTERNS = {
  marketing:   /\b(marketing|advertising|promotion|campaign|commercial)\b/i,
  analytics:   /\b(analytics|analysis|research|statistics|insight)\b/i,
  service:     /\b(service delivery|provide service|core service|functionality)\b/i,
  legal:       /\b(legal obligation|comply|regulatory|compliance|law enforcement)\b/i,
  security:    /\b(security|fraud prevention|safety|protect)\b/i,
  sharing:     /\b(sharing|transfer|disclose|third.party|partner)\b/i,
  profiling:   /\b(profil|personaliz|recommend|targeti)\b/i,
};

// ── Retention Patterns ────────────────────────────────────────
const RETENTION_PATTERNS = [
  { regex: /\b(\d+)\s*year[s]?\b/i,  unit: 'year' },
  { regex: /\b(\d+)\s*month[s]?\b/i, unit: 'month' },
  { regex: /\b(\d+)\s*day[s]?\b/i,   unit: 'day' },
  { regex: /\bnot\s+specified\b/i,    unit: null, value: 'not specified' },
  { regex: /\bindefinitely\b/i,       unit: null, value: 'indefinite' },
  { regex: /\buntil\s+withdrawn\b/i,  unit: null, value: 'until withdrawn' },
];

// ── Jurisdiction Patterns ─────────────────────────────────────
const JURISDICTION_PATTERNS = {
  EU:     /\b(gdpr|european union|eu|europe|eea)\b/i,
  India:  /\b(dpdp|india|indian|pdpb|pdpa india)\b/i,
  US:     /\b(ccpa|california|hipaa|us|united states|america)\b/i,
  UK:     /\b(uk gdpr|united kingdom|ico|england)\b/i,
};

// ── Sharing Party Patterns ────────────────────────────────────
const SHARING_PATTERNS = {
  partners:      /\b(partner[s]?|affiliate[s]?|associate[s]?)\b/i,
  third_parties: /\b(third.part|external entit|vendor[s]?|supplier[s]?)\b/i,
};

// ── Clause Extraction ─────────────────────────────────────────

function extractClauses(text) {
  const clauses = [];

  // Split by sentence boundaries, numbered clauses, bullet points
  const sentences = text
    .split(/(?:\n+|\.\s+|;\s+|(?<=\w)\.\s*(?=[A-Z])|\d+\.\s+)/)
    .map(s => s.trim())
    .filter(s => s.length > 10);

  sentences.forEach((sentence, idx) => {
    const clause = { id: `C${idx + 1}`, text: sentence };

    // Tag clause type
    if (/\b(purpose|intend|use.*for|process.*for)\b/i.test(sentence)) clause.type = 'purpose';
    else if (/\b(retain|store|keep|period|duration)\b/i.test(sentence)) clause.type = 'retention';
    else if (/\b(share|transfer|disclose|third.part)\b/i.test(sentence)) clause.type = 'sharing';
    else if (/\b(jurisdiction|govern|law|regulat)\b/i.test(sentence)) clause.type = 'jurisdiction';
    else if (/\b(right[s]?|withdraw|revoke|access|correct|erasure)\b/i.test(sentence)) clause.type = 'rights';
    else clause.type = 'general';

    clauses.push(clause);
  });

  return clauses.slice(0, 10); // max 10 clauses
}

// ── Regulatory Principle Mapping ──────────────────────────────

function mapRegulatoryPrinciples(parsed, jurisdiction) {
  const principles = [];

  const gdpr = jurisdiction === 'EU';
  const dpdp = jurisdiction === 'India';

  if (parsed.purpose) {
    principles.push({
      code: gdpr ? 'GDPR-Art5-1b' : dpdp ? 'DPDP-S4' : 'PRINCIPLE-PURPOSE',
      description: 'Purpose Limitation — data processed only for stated purpose',
    });
  }

  if (parsed.retention && parsed.retention !== 'not specified') {
    principles.push({
      code: gdpr ? 'GDPR-Art5-1e' : dpdp ? 'DPDP-S8' : 'PRINCIPLE-RETENTION',
      description: 'Storage Limitation — data not kept longer than necessary',
    });
  }

  if (parsed.sharingParties && parsed.sharingParties.length > 1) {
    principles.push({
      code: gdpr ? 'GDPR-Art28' : dpdp ? 'DPDP-S9' : 'PRINCIPLE-TRANSFER',
      description: 'Data Transfer — consent covers third-party sharing',
    });
  }

  principles.push({
    code: gdpr ? 'GDPR-Art7' : dpdp ? 'DPDP-S6' : 'PRINCIPLE-CONSENT',
    description: 'Lawful Basis — explicit, informed, and purpose-bound consent obtained',
  });

  return principles;
}

// ── Main Parse Function ───────────────────────────────────────

function parseConsentText(text) {
  if (!text || typeof text !== 'string') {
    return { dataType: null, purpose: null, retention: 'not specified', jurisdiction: 'unknown', sharingParties: ['self'], clauses: [], regulatoryPrinciples: [] };
  }

  const result = {
    dataType:       null,
    purpose:        null,
    retention:      'not specified',
    jurisdiction:   'unknown',
    sharingParties: ['self'],
    clauses:        [],
    regulatoryPrinciples: [],
  };

  // ── Data Type ─────────────────────────────────────────────
  for (const [type, pattern] of Object.entries(DATA_TYPE_PATTERNS)) {
    if (pattern.test(text)) {
      result.dataType = type;
      break;
    }
  }
  if (!result.dataType) result.dataType = 'personal'; // fallback

  // ── Purpose ───────────────────────────────────────────────
  for (const [purpose, pattern] of Object.entries(PURPOSE_PATTERNS)) {
    if (pattern.test(text)) {
      result.purpose = purpose;
      break;
    }
  }
  if (!result.purpose) result.purpose = 'service';

  // ── Retention ─────────────────────────────────────────────
  for (const pat of RETENTION_PATTERNS) {
    const match = text.match(pat.regex);
    if (match) {
      result.retention = pat.value || `${match[1]} ${pat.unit}`;
      break;
    }
  }

  // ── Jurisdiction ──────────────────────────────────────────
  for (const [jur, pattern] of Object.entries(JURISDICTION_PATTERNS)) {
    if (pattern.test(text)) {
      result.jurisdiction = jur;
      break;
    }
  }

  // ── Sharing Parties ───────────────────────────────────────
  const sharing = ['self'];
  if (SHARING_PATTERNS.partners.test(text))      sharing.push('partners');
  if (SHARING_PATTERNS.third_parties.test(text)) sharing.push('third_parties');
  result.sharingParties = sharing;

  // ── Clauses ───────────────────────────────────────────────
  result.clauses = extractClauses(text);

  // ── Regulatory Principles ─────────────────────────────────
  result.regulatoryPrinciples = mapRegulatoryPrinciples(result, result.jurisdiction);

  return result;
}

// ── Policy Generator (JSON Executable Policy) ─────────────────

function generateExecutablePolicy(parsed, consentId, userId, expiry) {
  return {
    id: consentId,
    version: 1,
    userId,
    createdAt: new Date().toISOString(),
    expiry: expiry || null,
    status: 'active',
    rules: {
      allow: {
        dataCategories: [parsed.dataType],
        purposes:       [parsed.purpose],
        sharingParties: parsed.sharingParties,
        jurisdiction:   parsed.jurisdiction,
        retentionUntil: expiry,
      },
      deny: {
        purposes:       ['undisclosed'],
        sharingParties: parsed.sharingParties.includes('third_parties') ? [] : ['third_parties'],
      },
    },
    meta: {
      clauses:              parsed.clauses,
      regulatoryPrinciples: parsed.regulatoryPrinciples,
    },
  };
}

module.exports = { parseConsentText, generateExecutablePolicy, mapRegulatoryPrinciples };
