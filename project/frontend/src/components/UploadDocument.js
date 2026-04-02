import { useState } from 'react';
import { uploadDocument } from '../services/api';

const UploadDocument = () => {
  const [file, setFile] = useState(null);
  const [userId, setUserId] = useState('');
  const [status, setStatus] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => setFile(e.target.files[0]);

  const upload = async () => {
    if (!file) { alert('Please select a file'); return; }
    if (!userId.trim()) { alert('Please enter a User ID'); return; }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", userId.trim());

    try {
      const res = await uploadDocument(formData);
      setResults(res.data);
      setStatus('Upload complete');
    } catch (err) {
      alert("Upload failed: " + err.message);
      setStatus('Upload failed');
    } finally {
      setLoading(false);
    }
  };

  if (results) {
    return (
      <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxWidth: '800px' }}>
        <h2>✅ Document Digitization Results</h2>
        <button onClick={() => {setResults(null); setFile(null); setStatus(''); setUserId('');}}>New Upload</button>
        <h3>Consent ID: {results.consentId || 'Policy denied'}</h3>
        <h3>User ID: {results.userId}</h3>
        <h3>Policy Allowed: {results.policyCheck?.allowed ? '✅ YES' : '❌ NO'}</h3>
        {results.policyCheck?.explanation && (
          <details>
            <summary>Explanation</summary>
            <pre>{results.policyCheck.explanation}</pre>
          </details>
        )}
        {results.text && (
          <details open>
            <summary>📄 Extracted Full Text ({results.text.length} chars)</summary>
            <pre style={{background:'#f5f5f5',padding:'10px',maxHeight:'200px',overflow:'auto'}}>{results.text}</pre>
          </details>
        )}
        {results.sections && results.sections.length > 0 && (
          <details open>
            <summary>📐 Detected Layout Sections ({results.sections.length})</summary>
            <ul>
              {results.sections.map((sec, i) => (
                <li key={i}>
                  <strong>{sec.title}</strong>
                  <ul>{sec.content?.slice(0,10).map((c,j) => <li key={j}>{c}</li>)}</ul>
                </li>
              ))}
            </ul>
          </details>
        )}
        {results.parsed && (
          <details>
            <summary>🔍 Parsed Clauses</summary>
            <pre>{JSON.stringify(results.parsed, null, 2)}</pre>
          </details>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2>📤 Upload Scanned Consent Form</h2>
      <p>Supports images/PDFs → OCR extraction → Layout detection → Clause parsing</p>
      <input
        placeholder="User ID (e.g. U_001)"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        style={{display:'block', marginBottom:'10px', padding:'5px'}}
      />
      <input type="file" accept="image/*,.pdf" onChange={handleFileChange} disabled={loading} />
      <br/><br/>
      <button onClick={upload} disabled={!file || loading || !userId.trim()}>
        {loading ? '🚀 Processing OCR...' : '🚀 Digitize Document'}
      </button>
      <p>{status}</p>
    </div>
  );
};

export default UploadDocument;
