/* markets.js — event listing, voting, odds, submit modal */

let currentSession = null;

document.addEventListener("DOMContentLoaded", async () => {
  currentSession = requireAuth();
  if (!currentSession) return;
  await loadEvents();
});

// ── ODDS MATH ──────────────────────────────────────────────────────
function calcPct(forV, againstV, side) {
  const total = forV + againstV;
  if (total === 0) return 50;
  return side === "for" ? Math.round((forV / total) * 100) : Math.round((againstV / total) * 100);
}
function calcCoeff(pct) {
  if (pct <= 0) return "99.00";
  return (1 / (pct / 100) * 0.95).toFixed(2);
}

// ── RENDER ─────────────────────────────────────────────────────────
function renderEvents(events) {
  const grid = document.getElementById("eventsGrid");
  const loading = document.getElementById("loadingState");
  const empty = document.getElementById("emptyState");
  if (loading) loading.remove();
  if (events.length === 0) {
    grid.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  grid.innerHTML = "";
  events.forEach(e => grid.appendChild(buildCard(e)));
}

function buildCard(event) {
  const fp = calcPct(event.votesFor, event.votesAgainst, "for");
  const ap = calcPct(event.votesFor, event.votesAgainst, "against");
  const total = event.votesFor + event.votesAgainst;
  const card = document.createElement("div");
  card.className = "event-card";
  card.dataset.id = event.id;
  card.innerHTML = `
    <p class="event-title">${esc(event.title)}</p>
    <div class="event-odds">
      <div class="odds-side for">
        <span class="odds-label">YES</span>
        <span class="odds-pct" id="pf-${event.id}">${fp}%</span>
        <span class="odds-coeff" id="cf-${event.id}">×${calcCoeff(fp)}</span>
      </div>
      <div style="flex:1">
        <div class="event-bar">
          <div class="bar-fill" id="bar-${event.id}" style="width:${fp}%"></div>
        </div>
      </div>
      <div class="odds-side against">
        <span class="odds-label">NO</span>
        <span class="odds-pct" id="pa-${event.id}">${ap}%</span>
        <span class="odds-coeff" id="ca-${event.id}">×${calcCoeff(ap)}</span>
      </div>
    </div>
    <div class="event-actions">
      <button class="vote-btn for-btn ${event.myVote==='for'?'voted':''}" id="bf-${event.id}" onclick="handleVote('${event.id}','for')">▲ YES</button>
      <button class="vote-btn against-btn ${event.myVote==='against'?'voted':''}" id="ba-${event.id}" onclick="handleVote('${event.id}','against')">▼ NO</button>
    </div>
    <div class="event-meta">
      <span id="tv-${event.id}">${total} vote${total!==1?'s':''}</span>
    </div>`;
  return card;
}

function updateCard(id, votesFor, votesAgainst, myVote) {
  const fp = calcPct(votesFor, votesAgainst, "for");
  const ap = calcPct(votesFor, votesAgainst, "against");
  const total = votesFor + votesAgainst;
  const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.textContent = val; };
  set(`pf-${id}`, fp + "%");
  set(`pa-${id}`, ap + "%");
  set(`cf-${id}`, "×" + calcCoeff(fp));
  set(`ca-${id}`, "×" + calcCoeff(ap));
  set(`tv-${id}`, `${total} vote${total!==1?'s':''}`);
  const bar = document.getElementById(`bar-${id}`);
  if (bar) bar.style.width = fp + "%";
  const bf = document.getElementById(`bf-${id}`);
  const ba = document.getElementById(`ba-${id}`);
  if (bf) bf.classList.toggle("voted", myVote === "for");
  if (ba) ba.classList.toggle("voted", myVote === "against");
}

// ── LOAD ───────────────────────────────────────────────────────────
async function loadEvents() {
  try {
    const data = await apiGetEvents(currentSession.username);
    renderEvents(data.events);
  } catch (err) {
    document.getElementById("eventsGrid").innerHTML =
      `<p style="color:var(--danger);grid-column:1/-1;padding:2rem">Failed to load: ${esc(err.message)}</p>`;
  }
}

// ── VOTE ───────────────────────────────────────────────────────────
async function handleVote(eventId, side) {
  const bf = document.getElementById(`bf-${eventId}`);
  const ba = document.getElementById(`ba-${eventId}`);
  if (bf) bf.disabled = true;
  if (ba) ba.disabled = true;
  try {
    const data = await apiVote(currentSession.username, eventId, side);
    updateCard(eventId, data.votesFor, data.votesAgainst, data.myVote);
    showToast(data.myVote ? "Vote recorded ✓" : "Vote removed", "success");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (bf) bf.disabled = false;
    if (ba) ba.disabled = false;
  }
}

// ── SUBMIT MODAL ───────────────────────────────────────────────────
function openSubmitModal() {
  document.getElementById("submitModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("eventTitle").focus(), 100);
}
function closeSubmitModal(e) {
  if (e && e.target !== document.getElementById("submitModal")) return;
  document.getElementById("submitModal").classList.add("hidden");
  document.getElementById("eventTitle").value = "";
  document.getElementById("submitError").textContent = "";
}
document.addEventListener("keydown", e => { if (e.key === "Escape") closeSubmitModal(); });

async function handleSubmitEvent(e) {
  e.preventDefault();
  const title = document.getElementById("eventTitle").value.trim();
  const errEl = document.getElementById("submitError");
  errEl.textContent = "";
  setLoading("submitBtn", true);
  try {
    await apiCreateEvent(currentSession.username, title);
    closeSubmitModal();
    showToast("Submitted! Awaiting admin approval ✓", "success");
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    setLoading("submitBtn", false);
  }
}

function esc(str) {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(str || ""));
  return d.innerHTML;
}
