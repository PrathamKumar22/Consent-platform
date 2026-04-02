'use strict';

const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');

/**
 * ConsentContract — Hyperledger Fabric Smart Contract
 *
 * Provides tamper-proof, immutable audit trail for:
 *   - Consent creation, revocation, supersession
 *   - Data access enforcement events
 *   - OCR digitization events
 *
 * State design:
 *   Key: CONSENT_{consentId}          → ConsentRecord
 *   Key: EVENT_{consentId}_{txTimestamp} → AuditEvent
 *   Key: POLICY_{consentId}           → ExecutablePolicy (JSON)
 */
class ConsentContract extends Contract {

  constructor() {
    super('ConsentContract');
  }

  // ── Init ────────────────────────────────────────────────────

  async initLedger(ctx) {
    console.log('ConsentContract ledger initialized');
    const meta = {
      type:        'ledger_meta',
      name:        'Consent Management Ledger',
      version:     '1.0.0',
      createdAt:   new Date().toISOString(),
      description: 'Immutable audit trail for Adaptive Consent Intelligence Platform',
    };
    await ctx.stub.putState('LEDGER_META', Buffer.from(JSON.stringify(meta)));
    return meta;
  }

  // ── Record Consent Event (called by Node backend) ──────────

  async RecordConsentEvent(ctx, consentId, eventType, payloadJSON, payloadHash) {
    const txId        = ctx.stub.getTxID();
    const txTimestamp = ctx.stub.getTxTimestamp();
    const timestamp   = new Date(txTimestamp.seconds.low * 1000).toISOString();
    const submitter   = ctx.clientIdentity.getID();

    // Validate hash
    const computedHash = crypto
      .createHash('sha256')
      .update(payloadJSON)
      .digest('hex');

    if (computedHash !== payloadHash) {
      throw new Error(`Payload integrity check failed. Expected ${payloadHash}, got ${computedHash}`);
    }

    const auditEvent = {
      type:        'audit_event',
      txId,
      consentId,
      eventType,
      payload:     JSON.parse(payloadJSON),
      payloadHash,
      timestamp,
      submitter,
    };

    // Store event keyed by txId for immutability
    const eventKey = ctx.stub.createCompositeKey('EVENT', [consentId, txId]);
    await ctx.stub.putState(eventKey, Buffer.from(JSON.stringify(auditEvent)));

    // Emit event for listeners
    ctx.stub.setEvent('ConsentEvent', Buffer.from(JSON.stringify({
      txId, consentId, eventType, timestamp,
    })));

    console.log(`[Fabric] Event recorded: ${eventType} for ${consentId} | tx: ${txId}`);
    return JSON.stringify({ txId, consentId, eventType, timestamp });
  }

  // ── Store Consent Policy ───────────────────────────────────

  async StoreConsentPolicy(ctx, consentId, policyJSON) {
    const txId      = ctx.stub.getTxID();
    const submitter = ctx.clientIdentity.getID();
    const timestamp = new Date().toISOString();

    // Validate JSON
    let policy;
    try {
      policy = JSON.parse(policyJSON);
    } catch {
      throw new Error('Invalid policy JSON');
    }

    const policyRecord = {
      type:       'consent_policy',
      consentId,
      policy,
      policyHash: crypto.createHash('sha256').update(policyJSON).digest('hex'),
      storedAt:   timestamp,
      storedBy:   submitter,
      txId,
    };

    await ctx.stub.putState(`POLICY_${consentId}`, Buffer.from(JSON.stringify(policyRecord)));
    return JSON.stringify({ consentId, policyHash: policyRecord.policyHash, txId });
  }

  // ── Get Consent History ────────────────────────────────────

  async GetConsentHistory(ctx, consentId) {
    const iterator = await ctx.stub.getStateByPartialCompositeKey('EVENT', [consentId]);
    const events   = [];

    while (true) {
      const result = await iterator.next();
      if (result.done) break;
      if (result.value && result.value.value) {
        try {
          const event = JSON.parse(result.value.value.toString('utf8'));
          events.push(event);
        } catch (_) {}
      }
    }
    await iterator.close();

    // Sort by timestamp
    events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return JSON.stringify(events);
  }

  // ── Get Policy ─────────────────────────────────────────────

  async GetConsentPolicy(ctx, consentId) {
    const data = await ctx.stub.getState(`POLICY_${consentId}`);
    if (!data || data.length === 0) {
      throw new Error(`Policy not found for consent: ${consentId}`);
    }
    return data.toString('utf8');
  }

  // ── Verify Integrity ───────────────────────────────────────

  async VerifyConsentIntegrity(ctx, consentId, policyJSON) {
    const storedData = await ctx.stub.getState(`POLICY_${consentId}`);
    if (!storedData || storedData.length === 0) {
      return JSON.stringify({ valid: false, reason: 'Policy not found on ledger' });
    }

    const stored       = JSON.parse(storedData.toString('utf8'));
    const computedHash = crypto.createHash('sha256').update(policyJSON).digest('hex');
    const valid        = computedHash === stored.policyHash;

    return JSON.stringify({
      valid,
      consentId,
      storedHash:   stored.policyHash,
      computedHash,
      storedAt:     stored.storedAt,
      reason:       valid ? 'Integrity verified' : 'Hash mismatch — policy may have been tampered',
    });
  }

  // ── Query All Events by Type ───────────────────────────────

  async QueryEventsByType(ctx, eventType) {
    // Rich query — requires CouchDB state database on peer
    const queryString = JSON.stringify({
      selector: { type: 'audit_event', eventType },
      sort: [{ timestamp: 'desc' }],
    });

    const iterator = await ctx.stub.getQueryResult(queryString);
    const results  = [];

    while (true) {
      const result = await iterator.next();
      if (result.done) break;
      if (result.value?.value) {
        try { results.push(JSON.parse(result.value.value.toString('utf8'))); } catch (_) {}
      }
    }
    await iterator.close();
    return JSON.stringify(results);
  }

  // ── Revoke on Chain ────────────────────────────────────────

  async RevokeConsent(ctx, consentId, revokedBy, reason) {
    return this.RecordConsentEvent(
      ctx,
      consentId,
      'CONSENT_REVOKED',
      JSON.stringify({ revokedBy, reason, timestamp: new Date().toISOString() }),
      crypto.createHash('sha256').update(JSON.stringify({ revokedBy, reason })).digest('hex')
    );
  }
}

module.exports = ConsentContract;
