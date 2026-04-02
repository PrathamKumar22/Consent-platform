import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000",
});

export const createConsent = (data) =>
  API.post("/consent/create", data);

export const getConsent = (id) =>
  API.get(`/consent/${id}`);

export const revokeConsent = (id) =>
  API.post(`/consent/revoke/${id}`);

export const supersedeConsent = (oldId, data) =>
  API.post(`/consent/supersede/${oldId}`, data);

export const dataAccess = (data) =>
  API.post("/consent/data-access", data);

export const uploadDocument = (formData) =>
  API.post("/consent/document/upload", formData);

export const parseText = (text) =>
  API.post("/consent/parse-text", { text });

export const listUserConsents = (userId) =>
  API.get(`/consent/consents/user/${userId}`);
