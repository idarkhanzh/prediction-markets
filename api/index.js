/**
 * Prediction Markets - Main API (Vercel Serverless Function)
 *
 * All routes are handled here via query param `action`.
 * Storage: JSONBin.io free tier (shared JSON "database").
 *
 * Endpoints:
 *   POST /api?action=register
 *   POST /api?action=login
 *   GET  /api?action=events
 *   POST /api?action=createEvent
 *   POST /api?action=vote
 *   POST /api?action=approveEvent   (admin)
 *   POST /api?action=deleteEvent    (admin)
 */

// ─── CONFIG ─────────────────────────────────────────────────────────────────

// JSONBin.io credentials (set these in Vercel environment variables)
// JSONBIN_BIN_ID  – the ID of your bin (created once, see README)
// JSONBIN_API_KEY – your JSONBin master key
const BIN_ID = process.env.JSONBIN_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

// Hard-coded admin credentials (as specified)
const ADMINS = [
  { username: "vlad", password: "vlad2006" },
  { username: "aidarkhan", password: "aidarkhan2006" },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Read the entire database from JSONBin */
async function readDB() {
  const res = await fetch(`${JSONBIN_URL}/latest`, {
    headers: {
      "X-Master-Key": API_KEY,
      // X-Bin-Meta: false tells JSONBin to return only the record JSON,
      // not the wrapper metadata object. This keeps parsing simple.
      "X-Bin-Meta": "false",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`JSONBin read failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  // Defensive: ensure the DB shape is always valid
  return {
    users: Array.isArray(data.users) ? data.users : [],
    events: Array.isArray(data.events) ? data.events : [],
  };
}

/** Write the entire database back to JSONBin */
async function writeDB(data) {
  const res = await fetch(JSONBIN_URL, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": API_KEY,
      "X-Bin-Meta": "false",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`JSONBin write failed (${res.status}): ${text}`);
  }
  // Response body not needed for writes
  return true;
}

/** Send JSON response */
function json(res, statusCode, data) {
  res.status(statusCode).json(data);
}

/** Check if a username belongs to an admin */
function isAdmin(username) {
  return ADMINS.some((a) => a.username === username);
}

/** Validate admin credentials */
function checkAdminCreds(username, password) {
  return ADMINS.some((a) => a.username === username && a.password === password);
}

/** Generate a simple unique ID */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── INITIAL DB SHAPE ────────────────────────────────────────────────────────
// This is what gets stored in JSONBin.
// {
//   users: [{ id, username, password, createdAt }],
//   events: [{ id, title, status("pending"|"approved"), createdBy, createdAt, votes: { for: 0, against: 0 }, voters: { userId: "for"|"against" } }]
// }

// ─── ROUTE HANDLERS ──────────────────────────────────────────────────────────

async function handleRegister(req, res) {
  const { username, password } = req.body;
  if (!username || !password)
    return json(res, 400, { error: "Username and password are required." });
  if (username.length < 3)
    return json(res, 400, { error: "Username must be at least 3 characters." });
  if (password.length < 4)
    return json(res, 400, { error: "Password must be at least 4 characters." });

  // Admins already exist — don't allow re-registering their usernames
  if (isAdmin(username))
    return json(res, 409, { error: "Username already taken." });

  const db = await readDB();
  const exists = db.users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );
  if (exists) return json(res, 409, { error: "Username already taken." });

  const newUser = {
    id: uid(),
    username,
    password, // NOTE: stored plain-text for simplicity (acceptable for demo-grade project)
    createdAt: new Date().toISOString(),
  };
  db.users.push(newUser);
  await writeDB(db);

  return json(res, 201, {
    ok: true,
    user: { id: newUser.id, username: newUser.username, isAdmin: false },
  });
}

async function handleLogin(req, res) {
  const { username, password } = req.body;
  if (!username || !password)
    return json(res, 400, { error: "Username and password are required." });

  // Check admin accounts first
  if (checkAdminCreds(username, password)) {
    return json(res, 200, {
      ok: true,
      user: { id: "admin-" + username, username, isAdmin: true },
    });
  }

  const db = await readDB();
  const user = db.users.find(
    (u) =>
      u.username.toLowerCase() === username.toLowerCase() &&
      u.password === password
  );
  if (!user) return json(res, 401, { error: "Invalid username or password." });

  return json(res, 200, {
    ok: true,
    user: { id: user.id, username: user.username, isAdmin: false },
  });
}

async function handleGetEvents(req, res) {
  const { username } = req.query;
  const db = await readDB();

  // Admins see all events; regular users only see approved ones
  const adminRequesting = username && isAdmin(username);
  const events = adminRequesting
    ? db.events
    : db.events.filter((e) => e.status === "approved");

  // Strip voter map from response to keep it light; just send vote counts
  const sanitized = events.map((e) => ({
    id: e.id,
    title: e.title,
    status: e.status,
    createdBy: e.createdBy,
    createdAt: e.createdAt,
    votesFor: e.votes.for,
    votesAgainst: e.votes.against,
    // Tell the requesting user how they voted (if any)
    myVote: username && e.voters ? e.voters[username] || null : null,
  }));

  return json(res, 200, { ok: true, events: sanitized });
}

async function handleCreateEvent(req, res) {
  const { username, title } = req.body;
  if (!username) return json(res, 401, { error: "Not authenticated." });
  if (!title || title.trim().length < 3)
    return json(res, 400, { error: "Event title must be at least 3 characters." });

  const db = await readDB();

  // Admins can create events that are immediately approved
  const status = isAdmin(username) ? "approved" : "pending";

  const newEvent = {
    id: uid(),
    title: title.trim(),
    status,
    createdBy: username,
    createdAt: new Date().toISOString(),
    votes: { for: 0, against: 0 },
    voters: {}, // { username: "for" | "against" }
  };

  db.events.push(newEvent);
  await writeDB(db);

  return json(res, 201, {
    ok: true,
    event: {
      id: newEvent.id,
      title: newEvent.title,
      status: newEvent.status,
      votesFor: 0,
      votesAgainst: 0,
    },
  });
}

async function handleVote(req, res) {
  const { username, eventId, side } = req.body; // side: "for" | "against"
  if (!username) return json(res, 401, { error: "Not authenticated." });
  if (!["for", "against"].includes(side))
    return json(res, 400, { error: 'Side must be "for" or "against".' });

  const db = await readDB();
  const event = db.events.find((e) => e.id === eventId);
  if (!event) return json(res, 404, { error: "Event not found." });
  if (event.status !== "approved")
    return json(res, 403, { error: "Cannot vote on a pending event." });

  const previousVote = event.voters[username];

  if (previousVote === side) {
    // Clicking the same side again removes the vote (toggle)
    event.votes[side]--;
    delete event.voters[username];
  } else {
    if (previousVote) {
      // Switch vote
      event.votes[previousVote]--;
    }
    event.votes[side]++;
    event.voters[username] = side;
  }

  await writeDB(db);

  return json(res, 200, {
    ok: true,
    votesFor: event.votes.for,
    votesAgainst: event.votes.against,
    myVote: event.voters[username] || null,
  });
}

async function handleApproveEvent(req, res) {
  const { username, eventId } = req.body;
  if (!isAdmin(username))
    return json(res, 403, { error: "Admin access required." });

  const db = await readDB();
  const event = db.events.find((e) => e.id === eventId);
  if (!event) return json(res, 404, { error: "Event not found." });

  event.status = "approved";
  await writeDB(db);

  return json(res, 200, { ok: true });
}

async function handleDeleteEvent(req, res) {
  const { username, eventId } = req.body;
  if (!isAdmin(username))
    return json(res, 403, { error: "Admin access required." });

  const db = await readDB();
  const idx = db.events.findIndex((e) => e.id === eventId);
  if (idx === -1) return json(res, 404, { error: "Event not found." });

  db.events.splice(idx, 1);
  await writeDB(db);

  return json(res, 200, { ok: true });
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  // CORS – allow requests from any origin (needed for static frontend on Vercel)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // Guard: require env vars
  if (!BIN_ID || !API_KEY) {
    return json(res, 500, {
      error:
        "Server misconfigured: JSONBIN_BIN_ID and JSONBIN_API_KEY env vars are missing.",
    });
  }

  const action = req.query.action;

  try {
    switch (action) {
      case "register":
        return await handleRegister(req, res);
      case "login":
        return await handleLogin(req, res);
      case "events":
        return await handleGetEvents(req, res);
      case "createEvent":
        return await handleCreateEvent(req, res);
      case "vote":
        return await handleVote(req, res);
      case "approveEvent":
        return await handleApproveEvent(req, res);
      case "deleteEvent":
        return await handleDeleteEvent(req, res);
      default:
        return json(res, 404, { error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error("API error:", err);
    return json(res, 500, { error: "Server error. Please try again." });
  }
}
