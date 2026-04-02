import React, { useState } from "react";
import { dataAccess } from "../services/api";

function DataAccessConsent() {
  const [form, setForm] = useState({
    userId: "",
    dataType: "",
    sharingParty: "self"
  });

  const handleChange = (e) => {
    setForm({...form, [e.target.name]: e.target.value});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await dataAccess(form);
      alert("✅ Data Access Granted!\n" + JSON.stringify(res.data, null, 2));
    } catch (err) {
      alert("❌ Access Denied: " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div>
      <h2>Runtime Data Access (Consent Check)</h2>
      <p>Test if user has active consent for dataType + sharingParty</p>
      
      <form onSubmit={handleSubmit}>
        <input
          name="userId"
          placeholder="User ID (e.g. U_OCR)"
          onChange={handleChange}
          required
        />
        <input
          name="dataType"
          placeholder="Data Type (e.g. email)"
          onChange={handleChange}
          required
        />
        <select name="sharingParty" onChange={handleChange} required>
          <option value="self">Self</option>
          <option value="partners">Partners</option>
          <option value="third_parties">3rd Parties</option>
        </select>
        <button type="submit">Request Data Access</button>
      </form>
    </div>
  );
}

export default DataAccessConsent;

