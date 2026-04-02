import React,{useState} from "react";
import { revokeConsent } from "../services/api";

function RevokeConsent(){

  const [id,setId] = useState("");

  const revoke = async ()=>{

    try{

      await revokeConsent(id);
      alert("Consent revoked");

    }
    catch(err){

      alert("Error revoking consent");

    }

  };

  return(

    <div>

      <h2>Revoke Consent</h2>

      <input
        placeholder="Consent ID"
        onChange={(e)=>setId(e.target.value)}
      />

      <button onClick={revoke}>Revoke</button>

    </div>

  );

}

export default RevokeConsent;