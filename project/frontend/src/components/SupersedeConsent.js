import React, { useState } from "react";
import { supersedeConsent, getConsent, parseText } from "../services/api";

function SupersedeConsent() {
  const [oldId, setOldId] = useState("");

const [form, setForm] = useState({
    dataType: "",
    purpose: "",
    retention: "not specified",
    jurisdiction: "unknown",
    sharingParties: '["self"]',
    expiry: "",
    legalText: ""
  });

  const [preview, setPreview] = useState(null);

  const handleOldIdChange = (e) => {
    setOldId(e.target.value);
  };

  const handleChange = (e) => {
    setForm({...form, [e.target.name]: e.target.value});
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


  const previewConsent = async () => {
    try {
      const res = await getConsent(oldId);
      setPreview(res.data);
    } catch (err) {
      alert("Consent not found: " + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!oldId) {
      alert("Enter old consent ID");
      return;
    }

    try {
      const res = await supersedeConsent(oldId, form);
      const newConsent = res.data || {};
      const clauses = newConsent.clauses || [];
      const clauseText = clauses.map(c => c.text).join('. ');
      const principles = newConsent.regulatoryPrinciples || [];
      const principleText = principles.map(p => `${p.code}: ${p.description}`).join('. ');
      
      alert(
        `Superseded Consent New ID: ${newConsent.consentId || res.data.newConsentId || 'N/A'}. ${clauseText} Expiry: ${newConsent.expiry || 'N/A'}. Principles: ${principleText}. Status: ${newConsent.status || 'active'}.`
      );
    } catch (err) {
      alert("Supersede failed: " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div>
      <h2>Supersede Consent (Versioning)</h2>
      
      <div>
        <input
          placeholder="Old Consent ID"
          value={oldId}
          onChange={handleOldIdChange}
        />
        <button onClick={previewConsent}>Preview</button>
      </div>

      {preview && (
        <div style={{background: "#f0f0f0", padding: "10px", margin: "10px 0"}}>
          <strong>Current ({preview.version}):</strong> {preview.dataType}/{preview.purpose} until {preview.expiry}
          <br />Status: {preview.status}
        </div>
      )}

      <form onSubmit={handleSubmit}>

        <input
          name="dataType"
          placeholder="New Data Type (email, phone, location)"
          onChange={handleChange}
          required
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

        <select name="jurisdiction" onChange={handleChange}>
          <option value="unknown">Jurisdiction (Unknown)</option>
          <option value="EU">EU (GDPR)</option>
          <option value="India">India (DPDP)</option>
        </select>
        <input
          name="purpose"
          placeholder="New Purpose (marketing, analytics)"
          onChange={handleChange}
          required
        />
        <input
          name="expiry"
          placeholder="New Expiry (2027-01-01)"
          onChange={handleChange}
          required
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
        <button type="submit">Supersede (Create New Version)</button>
      </form>
    </div>
  );
}

export default SupersedeConsent;
