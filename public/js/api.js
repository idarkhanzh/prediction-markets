/* api.js — fetch wrappers for all backend calls */

const API_BASE = "/api";

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

async function apiGet(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${API_BASE}?${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function apiRegister(username, password) { return apiPost("register", { username, password }); }
function apiLogin(username, password)    { return apiPost("login",    { username, password }); }
function apiGetEvents(username)          { return apiGet("events", username ? { username } : {}); }
function apiCreateEvent(username, title) { return apiPost("createEvent", { username, title }); }
function apiVote(username, eventId, side){ return apiPost("vote", { username, eventId, side }); }
function apiApproveEvent(username, eventId) { return apiPost("approveEvent", { username, eventId }); }
function apiDeleteEvent(username, eventId)  { return apiPost("deleteEvent",  { username, eventId }); }
