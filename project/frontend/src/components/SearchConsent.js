import React, { useState } from "react";
import { getConsent } from "../services/api";

function SearchConsent(){
  const [id,setId] = useState("");
  const [result,setResult] = useState(null);

  const search = async () => {
    try{
      const res = await getConsent(id);
      setResult(res.data);
    }
    catch(err){
      alert("Consent not found");
    }
  };

  return(
    <div>
      <h2>Search Consent</h2>
      <input
        placeholder="Consent ID"
        onChange={(e)=>setId(e.target.value)}
      />
      <button onClick={search}>Search</button>
      {result && (
        <div>
          <p>User: {result.userId}</p>
          <p>Purpose: {result.purpose}</p>
          <p>Status: {result.status}</p>
        </div>
      )}
    </div>
  );
}

export default SearchConsent;

