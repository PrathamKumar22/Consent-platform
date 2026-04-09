import React, { useState } from "react";
import { dataAccess } from "../services/api";

function DataAccessConsent() {
  const [form, setForm] = useState({ userId: "", dataType: "", sharingParty: "self" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showJson, setShowJson] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setShowJson(false);
    try {
      const res = await dataAccess(form);
      setResult({ ...res.data, allowed: true });
    } catch (err) {
      const data = err.response?.data || {};
      setResult({ ...data, allowed: false });
    }
    setLoading(false);
  };

  const boxStyle = {
    background: '#1e1e2e',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '1rem',
    fontSize: '0.82rem',
    color: '#ffffff',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.8,
    margin: 0,
    maxHeight: '320px',
    overflowY: 'auto',
    fontFamily: 'monospace'
  };

  return (
    <div>
      <h2>Runtime Data Access (Consent Check)</h2>
      <p style={{color:'#94a3b8', marginBottom:'1.5rem'}}>
        Test if user has active consent for dataType + sharingParty via OPA
      </p>

      <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:'12px', maxWidth:'500px'}}>
        <input name="userId" placeholder="User ID (e.g. U_001)" onChange={handleChange} required />
        <input name="dataType" placeholder="Data Type (e.g. email)" onChange={handleChange} required />
        <select name="sharingParty" onChange={handleChange}>
          <option value="self">Self</option>
          <option value="partners">Partners</option>
          <option value="third_parties">3rd Parties</option>
        </select>
        <button type="submit" disabled={loading}>
          {loading ? "Checking..." : "Request Data Access"}
        </button>
      </form>

      {result && (
        <div style={{
          marginTop: '2rem',
          padding: '1.5rem',
          borderRadius: '12px',
          border: result.allowed ? '2px solid #10b981' : '2px solid #ef4444',
          background: result.allowed ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
          maxWidth: '700px'
        }}>

          {/* Header */}
          <div style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'1.5rem'}}>
            <span style={{fontSize:'2.5rem'}}>{result.allowed ? '✅' : '❌'}</span>
            <div>
              <h3 style={{fontSize:'1.2rem', color: result.allowed ? '#10b981' : '#ef4444', margin:0}}>
                {result.allowed ? 'Data Access Granted' : 'Data Access Denied'}
              </h3>
              <p style={{color:'#94a3b8', fontSize:'0.85rem', margin:0}}>
                Consent ID: {result.consentId || 'N/A'} | Decision: {result.decision || (result.allowed ? 'ALLOW' : 'DENY')}
              </p>
            </div>
          </div>

          {/* Summary Grid */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem', marginBottom:'1.5rem', background:'rgba(0,0,0,0.2)', borderRadius:'8px', padding:'1rem'}}>
            {[['USER ID', form.userId], ['DATA TYPE', form.dataType], ['SHARING PARTY', form.sharingParty]].map(([k, v]) => (
              <div key={k}>
                <p style={{fontSize:'0.7rem', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'4px', margin:0}}>{k}</p>
                <p style={{fontSize:'0.95rem', fontWeight:700, margin:0, color:'#ffffff'}}>{v}</p>
              </div>
            ))}
          </div>

          {/* OPA Badge */}
          <div style={{marginBottom:'1.5rem'}}>
            <span style={{background:'rgba(59,130,246,0.15)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.4)', borderRadius:'6px', padding:'4px 12px', fontSize:'0.75rem', fontWeight:600}}>
              🔍 Evaluated by: {result.policyCheck?.source || 'OPA'}
            </span>
          </div>

          {/* Explanation */}
          {result.explanation && (
            <div style={{marginBottom:'1.5rem'}}>
              <p style={{fontSize:'0.75rem', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'8px', fontWeight:700}}>
                📋 OPA Explanation
              </p>
              <pre style={boxStyle}>{result.explanation}</pre>
            </div>
          )}

          {/* JSON Toggle */}
          <button
            onClick={() => setShowJson(!showJson)}
            style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.15)', color:'black', borderRadius:'6px', padding:'6px 16px', fontSize:'0.82rem', cursor:'pointer', marginBottom: showJson ? '10px' : 0}}
          >
            {showJson ? '▲ Hide' : '▼ View'} Full JSON Response
          </button>

          {showJson && (
            <pre style={boxStyle}>{JSON.stringify(result, null, 2)}</pre>
          )}

        </div>
      )}
    </div>
  );
}

export default DataAccessConsent;
