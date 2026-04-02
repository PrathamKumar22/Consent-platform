/**
 * Jurisdiction-Aware Conflict Resolver
 * Applies strictest-law-selection logic when multiple jurisdictions apply.
 */

const JURISDICTION_RULES = {
  EU: {
    name: 'GDPR (EU)',
    maxRetentionDays: 365 * 2, // 2 years default max
    requiresExplicitConsent: true,
    dataSubjectRights: ['access', 'rectification', 'erasure', 'portability', 'objection'],
    allowsMinorData: false,
    strictness: 3,
    defaultPurposes: ['service', 'legal'],
  },
  India: {
    name: 'DPDP Act (India)',
    maxRetentionDays: 365 * 3,
    requiresExplicitConsent: true,
    dataSubjectRights: ['access', 'correction', 'erasure', 'grievance'],
    allowsMinorData: false,
    strictness: 2,
    defaultPurposes: ['service', 'legal', 'security'],
  },
  US: {
    name: 'CCPA/HIPAA (US)',
    maxRetentionDays: 365 * 7,
    requiresExplicitConsent: false,
    dataSubjectRights: ['access', 'deletion', 'opt-out'],
    allowsMinorData: false,
    strictness: 1,
    defaultPurposes: ['service', 'marketing', 'analytics'],
  },
  UK: {
    name: 'UK GDPR',
    maxRetentionDays: 365 * 2,
    requiresExplicitConsent: true,
    dataSubjectRights: ['access', 'rectification', 'erasure', 'portability', 'objection'],
    allowsMinorData: false,
    strictness: 3,
    defaultPurposes: ['service', 'legal'],
  },
  unknown: {
    name: 'Unknown Jurisdiction',
    maxRetentionDays: 365,
    requiresExplicitConsent: true,
    dataSubjectRights: ['access'],
    allowsMinorData: false,
    strictness: 2,
    defaultPurposes: ['service'],
  },
};

/**
 * Resolve the applicable jurisdiction rules.
 * If multiple jurisdictions detected, pick the strictest.
 */
function resolveJurisdiction(jurisdictions) {
  if (!Array.isArray(jurisdictions)) {
    jurisdictions = [jurisdictions];
  }

  const rules = jurisdictions
    .map(j => JURISDICTION_RULES[j] || JURISDICTION_RULES['unknown'])
    .sort((a, b) => b.strictness - a.strictness);

  return rules[0]; // Strictest first
}

/**
 * Validate a consent payload against jurisdiction rules.
 * Returns { valid, warnings, blockers }
 */
function validateAgainstJurisdiction(consentData, jurisdiction) {
  const rules = JURISDICTION_RULES[jurisdiction] || JURISDICTION_RULES['unknown'];
  const warnings  = [];
  const blockers  = [];

  // Retention check
  if (consentData.retention && consentData.retention !== 'not specified') {
    const retDays = parseRetentionToDays(consentData.retention);
    if (retDays > rules.maxRetentionDays) {
      warnings.push(
        `Retention period (${consentData.retention}) exceeds ${rules.name} maximum ` +
        `(${Math.floor(rules.maxRetentionDays / 365)} years)`
      );
    }
  }

  // Explicit consent required
  if (rules.requiresExplicitConsent && !consentData.legalText) {
    warnings.push(`${rules.name} requires documented explicit consent — legalText field recommended`);
  }

  // Purpose check
  const purpose = consentData.purpose?.toLowerCase();
  if (purpose && !rules.defaultPurposes.includes(purpose)) {
    warnings.push(`Purpose '${purpose}' may require additional legal basis under ${rules.name}`);
  }

  return {
    valid: blockers.length === 0,
    jurisdiction: rules.name,
    strictness:   rules.strictness,
    dataSubjectRights: rules.dataSubjectRights,
    warnings,
    blockers,
  };
}

function parseRetentionToDays(retention) {
  if (!retention) return 0;
  const match = retention.match(/(\d+)\s*(year|month|day)/i);
  if (!match) return 0;
  const num  = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'year')  return num * 365;
  if (unit === 'month') return num * 30;
  return num;
}

module.exports = { resolveJurisdiction, validateAgainstJurisdiction, JURISDICTION_RULES };
