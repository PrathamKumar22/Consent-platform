import React from "react";
import { BrowserRouter,Routes,Route,Link } from "react-router-dom";

import CreateConsent from "./components/CreateConsent";
import ListUserConsents from "./components/ListUserConsents";
import RevokeWithList from "./components/RevokeWithList";
import SupersedeConsent from "./components/SupersedeConsent";
import DataAccessConsent from "./components/DataAccessConsent";
import UploadDocument from "./components/UploadDocument";

function App(){

return(

<BrowserRouter>

<h1>Consent Management System</h1>

<nav>

<Link to="/">Create</Link> |
<Link to="/search">Search</Link> |
<Link to="/revoke">Revoke</Link> |
<Link to="/supersede">Supersede</Link> |
<Link to="/data-access">Data Access</Link> |
<Link to="/upload">Upload</Link>

</nav>

<Routes>

<Route path="/" element={<CreateConsent/>}/>
<Route path="/search" element={<ListUserConsents/>}/>
<Route path="/revoke" element={<RevokeWithList/>}/>
<Route path="/supersede" element={<SupersedeConsent/>}/>
<Route path="/data-access" element={<DataAccessConsent/>}/>
<Route path="/upload" element={<UploadDocument/>}/>

</Routes>

</BrowserRouter>

);

}

export default App;