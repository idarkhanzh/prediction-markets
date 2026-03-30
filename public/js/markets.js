/**
 * markets.js — Loads and renders approved events, handles voting,
 * and manages the "Submit Event" modal.
 */

// ── INIT ──────────────────────────────────────────────────────────

let currentSession = null;

document.addEventListener("DOMContentLoaded", async () => {
  currentSession = requireAuth();
  if (!currentSession) return;
  await loadEvents();
});

// ── ODDS / COEFFICIENT CALCULATIONS ──────────────────────────────

/**
 * Calculate percentage for a side.
 * @returns {number} 0–100
 */
function calcPct(votesFor, votesAgainst, side) {
  const total = votesFor + votesAgainst;
  if (total === 0) return 50; // default 50/50 when no votes
  return side === "for"
    ? Math.round((votesFor / total) * 100)
    : Math.round((votesAgainst / total) * 100);
}

/**
 * Calculate decimal odds coefficient.
 * Coefficient = 1 / probability (like a bookmaker's payout multiplier).
 * We add a small margin (vig) of 5% for realism.
 *
 * If probability is 0 we cap coefficient at 99.
 */
function calcCoeff(pct) {
  if (pct <= 0) return "99.00";
  const prob = pct / 100;
  const rawCoeff = 1 / prob;
  // Apply 5% vigorish margin
  const withVig = rawCoeff * 0.95;
  return withVig.toFixed(2);
}

// ── RENDER ────────────────────────────────────────────────────────

function renderEvents(events) {
  const grid = document.getElementById("eventsGrid");
  const loadingState = document.getElementById("loadingState");
  const emptyState = document.getElementById("emptyState");

  // Remove loader
  if (loadingState) loadingState.remove();

  if (events.length === 0) {
    grid.classList.add("hidden");
    emptyState.classList.remove("hidden");
    return;
  }

  grid.innerHTML = "";
  events.forEach((event) => {
    grid.appendChild(buildEventCard(event));
  });
}

/**
 * Build a single event card DOM element.
 */
function buildEventCard(event) {
  const forPct = calcPct(event.votesFor, event.votesAgainst, "for");
  const againstPct = calcPct(event.votesFor, event.votesAgainst, "against");
  const forCoeff = calcCoeff(forPct);
  const againstCoeff = calcCoeff(againstPct);
  const totalVotes = event.votesFor + event.votesAgainst;

  const card = document.createElement("div");
  card.className = "event-card";
  card.dataset.id = event.id;

  card.innerHTML = `
    <p class="event-title">${escapeHtml(event.title)}</p>

    <div class="event-odds">
      <!-- YES side -->
      <div class="odds-side for">
        <span class="odds-label">YES</span>
        <span class="odds-pct" id="pct-for-${event.id}">${forPct}%</span>
        <span class="odds-coeff" id="coeff-for-${event.id}">×${forCoeff}</span>
      </div>

      <!-- Progress bar in the middle -->
      <div style="flex:1;">
        <div class="event-bar">
          <div class="bar-fill" id="bar-${event.id}" style="width:${forPct}%"></div>
        </div>
      </div>

      <!-- NO side -->
      <div class="odds-side against">
        <span class="odds-label">NO</span>
        <span class="odds-pct" id="pct-against-${event.id}">${againstPct}%</span>
        <span class="odds-coeff" id="coeff-against-${event.id}">×${againstCoeff}</span>
      </div>
    </div>

    <div class="event-actions">
      <button
        class="vote-btn for-btn ${event.myVote === 'for' ? 'voted' : ''}"
        id="btn-for-${event.id}"
        onclick="handleVote('${event.id}', 'for')">
        ▲ YES
      </button>
      <button
        class="vote-btn against-btn ${event.myVote === 'against' ? 'voted' : ''}"
        id="btn-against-${event.id}"
        onclick="handleVote('${event.id}', 'against')">
        ▼ NO
      </button>
    </div>

    <div class="event-meta">
      <span>${totalVotes} vote${totalVotes !== 1 ? "s" : ""}</span>
      <span>by @${escapeHtml(event.createdBy)}</span>
    </div>
  `;

  return card;
}

/**
 * Update an existing card in-place after a vote (no full re-render).
 */
function updateCardStats(eventId, votesFor, votesAgainst, myVote) {
  const forPct = calcPct(votesFor, votesAgainst, "for");
  const againstPct = calcPct(votesFor, votesAgainst, "against");
  const totalVotes = votesFor + votesAgainst;

  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  setTxt(`pct-for-${eventId}`, forPct + "%");
  setTxt(`pct-against-${eventId}`, againstPct + "%");
  setTxt(`coeff-for-${eventId}`, "×" + calcCoeff(forPct));
  setTxt(`coeff-against-${eventId}`, "×" + calcCoeff(againstPct));

  const bar = document.getElementById(`bar-${eventId}`);
  if (bar) bar.style.width = forPct + "%";

  // Update vote count inside the card
  const card = document.querySelector(`.event-card[data-id="${eventId}"]`);
  if (card) {
    const meta = card.querySelector(".event-meta span");
    if (meta) meta.textContent = `${totalVotes} vote${totalVotes !== 1 ? "s" : ""}`;

    const btnFor = document.getElementById(`btn-for-${eventId}`);
    const btnAgainst = document.getElementById(`btn-against-${eventId}`);
    if (btnFor) btnFor.classList.toggle("voted", myVote === "for");
    if (btnAgainst) btnAgainst.classList.toggle("voted", myVote === "against");
  }
}

// ── LOAD EVENTS ───────────────────────────────────────────────────

async function loadEvents() {
  try {
    const data = await apiGetEvents(currentSession.username);
    renderEvents(data.events);
  } catch (err) {
    const grid = document.getElementById("eventsGrid");
    grid.innerHTML = `<p style="color:var(--danger);grid-column:1/-1;padding:2rem;">Failed to load events: ${escapeHtml(err.message)}</p>`;
  }
}

// ── VOTE ──────────────────────────────────────────────────────────

async function handleVote(eventId, side) {
  if (!currentSession) return;

  // Disable both buttons briefly to prevent double-clicks
  const btnFor = document.getElementById(`btn-for-${eventId}`);
  const btnAgainst = document.getElementById(`btn-against-${eventId}`);
  if (btnFor) btnFor.disabled = true;
  if (btnAgainst) btnAgainst.disabled = true;

  try {
    const data = await apiVote(currentSession.username, eventId, side);
    updateCardStats(eventId, data.votesFor, data.votesAgainst, data.myVote);
    showToast(data.myVote ? "Vote recorded ✓" : "Vote removed", "success");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (btnFor) btnFor.disabled = false;
    if (btnAgainst) btnAgainst.disabled = false;
  }
}

// ── SUBMIT EVENT MODAL ─────────────────────────────────────────────

function openSubmitModal() {
  document.getElementById("submitModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("eventTitle").focus(), 100);
}

function closeSubmitModal(e) {
  // If called by clicking the overlay, close only if click was on the overlay itself
  if (e && e.target !== document.getElementById("submitModal")) return;
  document.getElementById("submitModal").classList.add("hidden");
  document.getElementById("eventTitle").value = "";
  document.getElementById("submitError").textContent = "";
}

// Close on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSubmitModal();
});

async function handleSubmitEvent(e) {
  e.preventDefault();
  const title = document.getElementById("eventTitle").value.trim();
  const errEl = document.getElementById("submitError");
  errEl.textContent = "";

  setLoading("submitBtn", true);
  try {
    await apiCreateEvent(currentSession.username, title);
    closeSubmitModal();
    showToast("Event submitted! Awaiting admin approval. ✓", "success");
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    setLoading("submitBtn", false);
  }
}

// ── UTILS ─────────────────────────────────────────────────────────

/** Escape HTML to prevent XSS when injecting user content into innerHTML. */
function escapeHtml(str) {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(str || ""));
  return d.innerHTML;
}
