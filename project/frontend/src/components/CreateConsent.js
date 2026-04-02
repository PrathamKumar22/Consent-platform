import React, { useState } from "react";
import { createConsent, parseText } from "../services/api";

function CreateConsent() {

const [form, setForm] = useState({
    userId: "",
    dataType: "",
    purpose: "",
    retention: "not specified",
    expiry: "",
    jurisdiction: "unknown",
    sharingParties: '["self"]',
    legalText: ""
  });

  const handleChange = (e) => {
    setForm({...form,[e.target.name]:e.target.value});
  };

const handleParse = async () => {
    if (!form.legalText.trim()) {
      alert('Please enter legal consent text first');
      return;
    }
    try {
      const res = await parseText(form.legalText);
      const parsed = res.data.parsed;
      setForm(prev => ({
        ...prev,
        dataType: parsed.dataType || prev.dataType,
        purpose: parsed.purpose || prev.purpose,
        jurisdiction: parsed.jurisdiction || prev.jurisdiction,
        retention: parsed.retention || prev.retention
      }));
      alert('Text parsed successfully and fields auto-filled!');
    } catch (err) {
      alert('Parsing failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await createConsent(form);
      const consent = res.data.consent || {};
      const clauses = consent.clauses || [];
      const principles = consent.regulatoryPrinciples || [];
      const clausesText = clauses.map(c => `  - ${c.text}`).join('\\n') || '  - Default consent clause';
      const principlesText = principles.map(p => `  - ${p.code}: ${p.description}`).join('\\n') || '  - N/A';
      
      alert(
        `Consent Created: ${res.data.consentId}\\n\\n` +
        `Data Type: ${consent.dataType || 'N/A'}\\n` +
        `Purpose: ${consent.purpose || 'N/A'}\\n` +
        `Expiry: ${consent.expiry || 'N/A'}\\n\\n` +
        `Clauses:\\n${clausesText}\\n\\n` +
        `Regulatory Principles:\\n${principlesText}\\n\\n` +
        `Status: ${consent.status || 'active'}`
      );
    } catch (err) {
      alert("Error creating consent: " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div>
      <h2>Create Consent</h2>

      <form onSubmit={handleSubmit}>

        <input
          name="userId"
          placeholder="User ID"
          onChange={handleChange}
        />

        <input
          name="dataType"
          placeholder="Data Type"
          onChange={handleChange}
        />

        <select name="jurisdiction" onChange={handleChange}>
          <option value="unknown">Jurisdiction (Unknown)</option>
          <option value="EU">EU (GDPR)</option>
          <option value="India">India (DPDP)</option>
        </select>

        <input
          name="purpose"
          placeholder="Purpose"
          onChange={handleChange}
        />

        <select name="retention" onChange={handleChange}>
          <option value="not specified">Not specified</option>
          <option value="6 month">6 months</option>
          <option value="1 year">1 year</option>
          <option value="2 year">2 years</option>
        </select>

         <select name="sharingParties" onChange={handleChange}>
          <option value='["self"]'>Self Only</option>
          <option value='["self","partners"]'>Self + Partners</option>
          <option value='["self","third_parties"]'>Self + 3rd Parties</option>
          <option value='["self","partners","third_parties"]'>All</option>
        </select>

        <input
          name="expiry"
          placeholder="Expiry Date"
          onChange={handleChange}
        />

        <textarea
          name="legalText"
          placeholder="Paste legal consent text here (optional - auto-parsed on submit or Parse button)"
          value={form.legalText}
          onChange={handleChange}
          rows={6}
          style={{width: '100%', margin: '10px 0'}}
        />

        <button type="button" onClick={handleParse}>Parse Text & Auto-fill Fields</button>
        <br /><br />

        <button type="submit">Create Consent</button>

      </form>
    </div>
  );
}

export default CreateConsent;
