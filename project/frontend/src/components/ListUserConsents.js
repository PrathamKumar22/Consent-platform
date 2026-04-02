import React, { useState } from "react";
import { listUserConsents } from "../services/api";

function ListUserConsents() {
  const [userId, setUserId] = useState("");
  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [selectedConsent, setSelectedConsent] = useState(null);

  const fetchConsents = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await listUserConsents(userId);
      setConsents(res.data);
    } catch (err) {
      alert("Error fetching consents: " + err.message);
    }
    setLoading(false);
  };

  const filteredConsents = consents.filter(c => {
    if (filter === "all") return true;
    if (filter === "active") return c.status === "active" && !c.isExpired;
    if (filter === "expired") return c.isExpired;
    if (filter === "revoked") return c.status === "revoked";
    if (filter === "superseded") return c.status === "superseded";
    return true;
  });

  const getStatusBadge = (consent) => {
    if (consent.isExpired) return <span style={{color: "orange"}}>Expired</span>;
    if (consent.status === "revoked") return <span style={{color: "red"}}>Revoked</span>;
    if (consent.status === "superseded") return <span style={{color: "purple"}}>Superseded</span>;
    return <span style={{color: "green"}}>Active</span>;
  };

  return (
    <div>
      <h2>Search & List User Consents</h2>
      <div>
        <input
          placeholder="User ID (e.g., U_123)"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <button onClick={fetchConsents} disabled={loading}>
          {loading ? "Loading..." : "List Consents"}
        </button>
      </div>
      <div>
        <label>Filter: </label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
          <option value="superseded">Superseded</option>
        </select>
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredConsents.map((consent, idx) => (
              <tr key={idx} style={{borderBottom: "1px solid #ccc"}}>
                <td>{consent.consentId}</td>
                <td>{consent.version || 1}</td>
                <td>{getStatusBadge(consent)}</td>
                <td>{consent.daysToExpiry || 0}</td>
                <td>{consent.dataType}</td>
                <td>{consent.purpose}</td>
                <td>
                  <button onClick={() => setSelectedConsent(consent)}>View</button>
                  <button onClick={() => {/* revoke logic */}}>Revoke</button>
                  <button onClick={() => {/* supersede */}}>Supersede</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {selectedConsent && (
        <div style={{marginTop: "20px", padding: "10px", border: "1px solid #ddd"}}>
          <h3>Consent Details</h3>
          <pre>{JSON.stringify(selectedConsent, null, 2)}</pre>
          <button onClick={() => setSelectedConsent(null)}>Close</button>
        </div>
      )}
    </div>
  );
}

export default ListUserConsents;
