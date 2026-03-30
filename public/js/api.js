/**
 * api.js — Thin wrapper around all backend API calls.
 * Every function returns { ok, ...data } or throws on network failure.
 */

// The API lives at /api on the same Vercel domain.
const API_BASE = "/api";

/**
 * Generic POST helper.
 * @param {string} action - query param passed to the serverless function
 * @param {object} body   - JSON body
 */
async function apiPost(action, body) {
  const res = await fetch(`${API_BASE}?action=${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

/**
 * Generic GET helper.
 * @param {string} action
 * @param {object} params - query string params
 */
async function apiGet(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${API_BASE}?${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

/* ── Auth ── */

function apiRegister(username, password) {
  return apiPost("register", { username, password });
}

function apiLogin(username, password) {
  return apiPost("login", { username, password });
}

/* ── Events ── */

function apiGetEvents(username) {
  return apiGet("events", username ? { username } : {});
}

function apiCreateEvent(username, title) {
  return apiPost("createEvent", { username, title });
}

/* ── Voting ── */

function apiVote(username, eventId, side) {
  return apiPost("vote", { username, eventId, side });
}

/* ── Admin ── */

function apiApproveEvent(username, eventId) {
  return apiPost("approveEvent", { username, eventId });
}

function apiDeleteEvent(username, eventId) {
  return apiPost("deleteEvent", { username, eventId });
}
