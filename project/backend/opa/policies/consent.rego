package consent

# ─────────────────────────────────────────────────────────────────
#  Adaptive Consent Enforcement Policy
#  Evaluated by OPA at runtime for every data access request.
#
#  Input shape:
#  {
#    "consent": {
#      "_id": "C_ABC123",
#      "userId": "U_001",
#      "dataType": "email",
#      "purpose": "marketing",
#      "sharingParties": ["self", "partners"],
#      "status": "active",
#      "expiry": "2027-01-01",
#      "jurisdiction": "EU"
#    },
#    "request": {
#      "userId": "U_001",
#      "dataType": "email",
#      "sharingParty": "partners"
#    }
#  }
# ─────────────────────────────────────────────────────────────────

default allow = false

# Allow if ALL conditions pass
allow {
    consent_exists
    consent_active
    not consent_expired
    data_type_matches
    sharing_party_permitted
}

# ── Condition Checks ──────────────────────────────────────────

consent_exists {
    input.consent != null
    input.consent._id != ""
}

consent_active {
    input.consent.status == "active"
}

consent_expired {
    input.consent.expiry != null
    input.consent.expiry != ""
    time.parse_rfc3339_ns(concat("T00:00:00Z", [input.consent.expiry])) < time.now_ns()
}

data_type_matches {
    lower(input.consent.dataType) == lower(input.request.dataType)
}

sharing_party_permitted {
    party := input.request.sharingParty
    party == input.consent.sharingParties[_]
}

# ── Denial Reasons (for explainability) ──────────────────────

deny_reasons[reason] {
    not consent_exists
    reason := "no_active_consent"
}

deny_reasons[reason] {
    consent_exists
    not consent_active
    reason := concat("", ["consent_status_invalid:", input.consent.status])
}

deny_reasons[reason] {
    consent_expired
    reason := concat("", ["consent_expired:", input.consent.expiry])
}

deny_reasons[reason] {
    consent_exists
    not data_type_matches
    reason := concat("", ["data_type_mismatch:requested=", input.request.dataType, ",consented=", input.consent.dataType])
}

deny_reasons[reason] {
    consent_exists
    not sharing_party_permitted
    reason := concat("", ["sharing_party_not_permitted:", input.request.sharingParty])
}

# ── Jurisdiction Override Rules ────────────────────────────────

# EU GDPR: Marketing requires explicit opt-in
gdpr_marketing_violation {
    input.consent.jurisdiction == "EU"
    input.request.purpose == "marketing"
    not input.consent.purpose == "marketing"
}

# India DPDP: Third-party sharing needs explicit mention
dpdp_sharing_violation {
    input.consent.jurisdiction == "India"
    input.request.sharingParty == "third_parties"
    not "third_parties" == input.consent.sharingParties[_]
}

# Composite jurisdiction deny
deny_reasons[reason] {
    gdpr_marketing_violation
    reason := "gdpr_marketing_requires_explicit_consent"
}

deny_reasons[reason] {
    dpdp_sharing_violation
    reason := "dpdp_third_party_sharing_not_consented"
}
