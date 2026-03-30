/* admin.js — admin panel: approve, delete, create events */

let adminSession = null;

document.addEventListener("DOMContentLoaded", async () => {
  adminSession = requireAdmin();
  if (!adminSession) return;
  await loadAdminEvents();
});

async function loadAdminEvents() {
  try {
    const data = await apiGetEvents(adminSession.username);
    renderAdminLists(data.events);
  } catch (err) {
    showToast("Failed to load: " + err.message, "error");
  }
}

function renderAdminLists(events) {
  const pending  = events.filter(e => e.status === "pending");
  const approved = events.filter(e => e.status === "approved");
  const badge = document.getElementById("pendingCount");
  if (badge) badge.textContent = pending.length;
  renderList("pendingList",  "pendingEmpty",  pending,  true);
  renderList("approvedList", "approvedEmpty", approved, false);
}

function renderList(listId, emptyId, events, showApprove) {
  const list  = document.getElementById(listId);
  const empty = document.getElementById(emptyId);
  if (events.length === 0) { list.innerHTML = ""; if (empty) empty.classList.remove("hidden"); return; }
  if (empty) empty.classList.add("hidden");
  list.innerHTML = "";
  events.forEach(e => list.appendChild(buildRow(e, showApprove)));
}

function buildRow(event, showApprove) {
  const row = document.createElement("div");
  row.className = "admin-row";
  row.id = "row-" + event.id;
  const total = event.votesFor + event.votesAgainst;
  const date  = new Date(event.createdAt).toLocaleDateString();
  row.innerHTML = `
    <div class="admin-row-info">
      <div class="admin-row-title">${esc(event.title)}</div>
      <div class="admin-row-meta">by @${esc(event.createdBy)} · ${date}${total > 0 ? ` · ${total} votes` : ""}</div>
    </div>
    <div class="admin-row-actions">
      ${showApprove ? `<button class="btn-approve" onclick="handleApprove('${event.id}')">✓ Approve</button>` : ""}
      <button class="btn-danger" onclick="handleDelete('${event.id}')">✕ Delete</button>
    </div>`;
  return row;
}

async function handleApprove(eventId) {
  try {
    await apiApproveEvent(adminSession.username, eventId);
    showToast("Event approved ✓", "success");
    await loadAdminEvents();
  } catch (err) { showToast(err.message, "error"); }
}

async function handleDelete(eventId) {
  if (!confirm("Delete this event? Cannot be undone.")) return;
  try {
    await apiDeleteEvent(adminSession.username, eventId);
    showToast("Event deleted.", "success");
    await loadAdminEvents();
  } catch (err) { showToast(err.message, "error"); }
}

async function handleAdminCreate(e) {
  e.preventDefault();
  const input = document.getElementById("adminEventTitle");
  const title = input.value.trim();
  const errEl = document.getElementById("adminCreateError");
  errEl.textContent = "";
  setLoading("adminCreateBtn", true);
  try {
    await apiCreateEvent(adminSession.username, title);
    input.value = "";
    showToast("Event created and published ✓", "success");
    await loadAdminEvents();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    setLoading("adminCreateBtn", false);
  }
}

function esc(str) {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(str || ""));
  return d.innerHTML;
}
