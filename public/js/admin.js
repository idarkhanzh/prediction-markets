/**
 * admin.js — Admin panel logic.
 *
 * Loads ALL events (pending + approved), lets admins:
 *   - approve pending events
 *   - delete any event
 *   - create new events directly (auto-approved)
 */

let adminSession = null;

document.addEventListener("DOMContentLoaded", async () => {
  adminSession = requireAdmin();
  if (!adminSession) return;
  await loadAdminEvents();
});

// ── LOAD ALL EVENTS ────────────────────────────────────────────────

async function loadAdminEvents() {
  try {
    // Pass username so the API returns ALL events (pending + approved)
    const data = await apiGetEvents(adminSession.username);
    renderAdminLists(data.events);
  } catch (err) {
    showToast("Failed to load events: " + err.message, "error");
  }
}

// ── RENDER ────────────────────────────────────────────────────────

function renderAdminLists(events) {
  const pending = events.filter((e) => e.status === "pending");
  const approved = events.filter((e) => e.status === "approved");

  // Update pending count badge
  const countBadge = document.getElementById("pendingCount");
  if (countBadge) countBadge.textContent = pending.length;

  renderList("pendingList", "pendingEmpty", pending, true);
  renderList("approvedList", "approvedEmpty", approved, false);
}

function renderList(listId, emptyId, events, showApprove) {
  const list = document.getElementById(listId);
  const empty = document.getElementById(emptyId);

  if (events.length === 0) {
    list.innerHTML = "";
    if (empty) empty.classList.remove("hidden");
    return;
  }
  if (empty) empty.classList.add("hidden");

  list.innerHTML = "";
  events.forEach((event) => {
    list.appendChild(buildAdminRow(event, showApprove));
  });
}

function buildAdminRow(event, showApprove) {
  const row = document.createElement("div");
  row.className = "admin-row";
  row.id = `admin-row-${event.id}`;

  const totalVotes = event.votesFor + event.votesAgainst;
  const date = new Date(event.createdAt).toLocaleDateString();

  row.innerHTML = `
    <div class="admin-row-info">
      <div class="admin-row-title">${escapeHtml(event.title)}</div>
      <div class="admin-row-meta">
        by @${escapeHtml(event.createdBy)} · ${date}
        ${totalVotes > 0 ? ` · ${totalVotes} vote${totalVotes !== 1 ? "s" : ""}` : ""}
      </div>
    </div>
    <div class="admin-row-actions">
      ${showApprove ? `<button class="btn-approve" onclick="handleApprove('${event.id}')">✓ Approve</button>` : ""}
      <button class="btn-danger" onclick="handleDelete('${event.id}')">✕ Delete</button>
    </div>
  `;

  return row;
}

// ── APPROVE ───────────────────────────────────────────────────────

async function handleApprove(eventId) {
  try {
    await apiApproveEvent(adminSession.username, eventId);
    showToast("Event approved and published ✓", "success");
    await loadAdminEvents(); // re-render
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ── DELETE ────────────────────────────────────────────────────────

async function handleDelete(eventId) {
  if (!confirm("Delete this event? This cannot be undone.")) return;
  try {
    await apiDeleteEvent(adminSession.username, eventId);
    showToast("Event deleted.", "success");
    await loadAdminEvents();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ── ADMIN CREATE ──────────────────────────────────────────────────

async function handleAdminCreate(e) {
  e.preventDefault();
  const titleInput = document.getElementById("adminEventTitle");
  const title = titleInput.value.trim();
  const errEl = document.getElementById("adminCreateError");
  errEl.textContent = "";

  if (!title) return;

  setLoading("adminCreateBtn", true);
  try {
    await apiCreateEvent(adminSession.username, title);
    titleInput.value = "";
    showToast("Event created and published ✓", "success");
    await loadAdminEvents();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    setLoading("adminCreateBtn", false);
  }
}

// ── UTILS ─────────────────────────────────────────────────────────

function escapeHtml(str) {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(str || ""));
  return d.innerHTML;
}
