/**
 * api/index.js — Vercel Serverless Function
 * Handles all API routes via ?action= query param.
 * Storage: JSONBin.io (free shared JSON database).
 *
 * Required env vars (set in Vercel dashboard):
 *   JSONBIN_BIN_ID
 *   JSONBIN_API_KEY
 */

const BIN_ID  = process.env.JSONBIN_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;

const ADMINS = [
  { username: "vlad",      password: "vlad2006" },
  { username: "aidarkhan", password: "aidarkhan2006" },
];

// ── DB HELPERS ─────────────────────────────────────────────────────

async function readDB() {
  const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
    headers: { "X-Master-Key": API_KEY, "X-Bin-Meta": "false" },
  });
  if (!res.ok) throw new Error(`DB read failed: ${res.status}`);
  const data = await res.json();
  return {
    users:  Array.isArray(data.users)  ? data.users  : [],
    events: Array.isArray(data.events) ? data.events : [],
  };
}

async function writeDB(data) {
  const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Master-Key": API_KEY, "X-Bin-Meta": "false" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`DB write failed: ${res.status}`);
  return true;
}

// ── UTILS ──────────────────────────────────────────────────────────

function reply(res, status, data) { res.status(status).json(data); }
function isAdmin(u) { return ADMINS.some(a => a.username === u); }
function checkAdmin(u, p) { return ADMINS.some(a => a.username === u && a.password === p); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ── HANDLERS ───────────────────────────────────────────────────────

async function register(req, res) {
  const { username, password } = req.body;
  if (!username || !password)       return reply(res, 400, { error: "Username and password required." });
  if (username.length < 3)          return reply(res, 400, { error: "Username must be at least 3 characters." });
  if (password.length < 4)          return reply(res, 400, { error: "Password must be at least 4 characters." });
  if (isAdmin(username))            return reply(res, 409, { error: "Username already taken." });
  const db = await readDB();
  if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase()))
    return reply(res, 409, { error: "Username already taken." });
  const user = { id: uid(), username, password, createdAt: new Date().toISOString() };
  db.users.push(user);
  await writeDB(db);
  reply(res, 201, { ok: true, user: { id: user.id, username, isAdmin: false } });
}

async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) return reply(res, 400, { error: "Username and password required." });
  if (checkAdmin(username, password))
    return reply(res, 200, { ok: true, user: { id: "admin-" + username, username, isAdmin: true } });
  const db = await readDB();
  const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
  if (!user) return reply(res, 401, { error: "Invalid username or password." });
  reply(res, 200, { ok: true, user: { id: user.id, username: user.username, isAdmin: false } });
}

async function getEvents(req, res) {
  const { username } = req.query;
  const db = await readDB();
  const events = (isAdmin(username) ? db.events : db.events.filter(e => e.status === "approved").reverse())
    .map(e => ({
      id: e.id, title: e.title, status: e.status,
      createdBy: e.createdBy, createdAt: e.createdAt,
      votesFor: e.votes.for, votesAgainst: e.votes.against,
      myVote: username && e.voters ? (e.voters[username] || null) : null,
    }));
  reply(res, 200, { ok: true, events });
}

async function createEvent(req, res) {
  const { username, title } = req.body;
  if (!username)                   return reply(res, 401, { error: "Not authenticated." });
  if (!title || title.trim().length < 3) return reply(res, 400, { error: "Title must be at least 3 characters." });
  const db = await readDB();
  const event = {
    id: uid(), title: title.trim(),
    status: isAdmin(username) ? "approved" : "pending",
    createdBy: username, createdAt: new Date().toISOString(),
    votes: { for: 0, against: 0 }, voters: {},
  };
  db.events.push(event);
  await writeDB(db);
  reply(res, 201, { ok: true, event: { id: event.id, title: event.title, status: event.status } });
}

async function vote(req, res) {
  const { username, eventId, side } = req.body;
  if (!username)                          return reply(res, 401, { error: "Not authenticated." });
  if (!["for","against"].includes(side))  return reply(res, 400, { error: "Invalid side." });
  const db = await readDB();
  const ev = db.events.find(e => e.id === eventId);
  if (!ev)                      return reply(res, 404, { error: "Event not found." });
  if (ev.status !== "approved") return reply(res, 403, { error: "Cannot vote on pending event." });
  const prev = ev.voters[username];
  if (prev === side) { ev.votes[side]--; delete ev.voters[username]; }
  else { if (prev) ev.votes[prev]--; ev.votes[side]++; ev.voters[username] = side; }
  await writeDB(db);
  reply(res, 200, { ok: true, votesFor: ev.votes.for, votesAgainst: ev.votes.against, myVote: ev.voters[username] || null });
}

async function approveEvent(req, res) {
  const { username, eventId } = req.body;
  if (!isAdmin(username)) return reply(res, 403, { error: "Admin only." });
  const db = await readDB();
  const ev = db.events.find(e => e.id === eventId);
  if (!ev) return reply(res, 404, { error: "Event not found." });
  ev.status = "approved";
  await writeDB(db);
  reply(res, 200, { ok: true });
}

async function deleteEvent(req, res) {
  const { username, eventId } = req.body;
  if (!isAdmin(username)) return reply(res, 403, { error: "Admin only." });
  const db = await readDB();
  const idx = db.events.findIndex(e => e.id === eventId);
  if (idx === -1) return reply(res, 404, { error: "Event not found." });
  db.events.splice(idx, 1);
  await writeDB(db);
  reply(res, 200, { ok: true });
}

// ── MAIN ───────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!BIN_ID || !API_KEY)
    return reply(res, 500, { error: "Missing JSONBIN_BIN_ID or JSONBIN_API_KEY env vars." });

  try {
    switch (req.query.action) {
      case "register":     return await register(req, res);
      case "login":        return await login(req, res);
      case "events":       return await getEvents(req, res);
      case "createEvent":  return await createEvent(req, res);
      case "vote":         return await vote(req, res);
      case "approveEvent": return await approveEvent(req, res);
      case "deleteEvent":  return await deleteEvent(req, res);
      default: return reply(res, 404, { error: "Unknown action." });
    }
  } catch (err) {
    console.error(err);
    return reply(res, 500, { error: "Server error. Please try again." });
  }
};
