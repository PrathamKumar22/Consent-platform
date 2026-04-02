import React, { useState } from "react";
import { listUserConsents, revokeConsent } from "../services/api";

function RevokeWithList() {
  const [userId, setUserId] = useState("");
  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedConsent, setSelectedConsent] = useState(null);
  const [revoking, setRevoking] = useState(false);

  const fetchConsents = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await listUserConsents(userId);
      // Filter active only for revoke
      const active = res.data.filter(c => c.status === 'active' && !c.isExpired);
      setConsents(active);
    } catch (err) {
      alert("Error: " + err.message);
    }
    setLoading(false);
  };

  const handleRevoke = async () => {
    if (!selectedConsent) return;
    setRevoking(true);
    try {
      await revokeConsent(selectedConsent.consentId);
      alert("Consent revoked successfully!");
      setSelectedConsent(null);
      fetchConsents(); // Refresh list
    } catch (err) {
      alert("Revoke failed: " + err.message);
    }
    setRevoking(false);
  };

  const getStatusBadge = (consent) => (
    <span style={{color: "green"}}>Active</span>
  );

  return (
    <div>
      <h2>Revoke Consent (Active Only)</h2>
      <div>
        <input
          placeholder="User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <button onClick={fetchConsents} disabled={loading}>
          {loading ? "Loading..." : "List Active Consents"}
        </button>
      </div>
      {consents.length > 0 && (
        <table style={{width: "100%", borderCollapse: "collapse", marginTop: "20px"}}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Version</th>
              <th>Status</th>
              <th>Expiry (days)</th>
              <th>DataType</th>
              <th>Purpose</th>
              <th>Select</th>
            </tr>
          </thead>
          <tbody>
            {consents.map((consent, idx) => (
              <tr key={idx} style={{borderBottom: "1px solid #ccc"}}>
                <td>{consent.consentId}</td>
                <td>{consent.version || 1}</td>
                <td>{getStatusBadge(consent)}</td>
                <td>{consent.daysToExpiry || 0}</td>
                <td>{consent.dataType}</td>
                <td>{consent.purpose}</td>
                <td>
                  <button onClick={() => setSelectedConsent(consent)}>Select</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {selectedConsent && (
        <div style={{marginTop: "20px", padding: "20px", border: "2px solid #ff6b6b", background: "#ffe6e6"}}>
          <h3>Preview Consent to Revoke</h3>
          <p><strong>ID:</strong> {selectedConsent.consentId}</p>
          <p><strong>User:</strong> {selectedConsent.userId}</p>
          <p><strong>DataType:</strong> {selectedConsent.dataType}</p>
          <p><strong>Purpose:</strong> {selectedConsent.purpose}</p>
          <p><strong>Expiry:</strong> {selectedConsent.expiry} ({selectedConsent.daysToExpiry} days left)</p>
          <pre style={{background: "#f5f5f5", padding: "10px", maxHeight: "200px", overflow: "auto"}}>
{JSON.stringify(selectedConsent, null, 2)}
          </pre>
          <div style={{marginTop: "15px"}}>
            <button onClick={handleRevoke} disabled={revoking} style={{background: "#ff4444", color: "white", padding: "10px"}}>
              {revoking ? "Revoking..." : "CONFIRM REVOKE"}
            </button>
            <button onClick={() => setSelectedConsent(null)} style={{marginLeft: "10px", padding: "10px"}}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default RevokeWithList;
