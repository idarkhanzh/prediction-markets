/**
 * auth.js — Session management + login/register handlers.
 *
 * Session is stored in localStorage as a JSON object:
 * { id, username, isAdmin }
 *
 * This is a client-side "token" — it's simple and fine for a
 * demo-grade app. The server re-validates credentials on every
 * write operation.
 */

// ── TOAST NOTIFICATION ─────────────────────────────────────────────

let _toastTimer = null;

/**
 * Show a brief notification toast.
 * @param {string} msg
 * @param {'success'|'error'|''} type
 */
function showToast(msg, type = "") {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = type + " show";
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { toast.classList.remove("show"); }, 2800);
}

// ── SESSION ────────────────────────────────────────────────────────

const SESSION_KEY = "pm_session";

/** Get the stored session or null. */
function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

/** Save a session. */
function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

/** Clear the session (log out). */
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/** Redirect to login if not logged in. Call at top of protected pages. */
function requireAuth() {
  const session = getSession();
  if (!session) {
    window.location.href = "/";
    return null;
  }
  // Show username in nav
  const el = document.getElementById("navUsername");
  if (el) el.textContent = "@" + session.username;

  // Show admin link for admins
  if (session.isAdmin) {
    const adminLink = document.getElementById("adminLink");
    if (adminLink) adminLink.classList.remove("hidden");
  }

  return session;
}

/** Require admin — redirect to markets if not admin. */
function requireAdmin() {
  const session = requireAuth();
  if (session && !session.isAdmin) {
    window.location.href = "/pages/markets.html";
    return null;
  }
  return session;
}

/** Log out and redirect to home. */
function logout() {
  clearSession();
  window.location.href = "/";
}

// ── TAB SWITCHING (index.html) ─────────────────────────────────────

function switchTab(tab) {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const tabLogin = document.getElementById("tabLogin");
  const tabRegister = document.getElementById("tabRegister");
  const loginErr = document.getElementById("loginError");
  const regErr = document.getElementById("registerError");

  if (tab === "login") {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
  } else {
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
  }
  // Clear any previous errors
  if (loginErr) loginErr.textContent = "";
  if (regErr) regErr.textContent = "";
}

// ── FORM HELPERS ──────────────────────────────────────────────────

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const label = btn.querySelector(".btn-label");
  const spinner = btn.querySelector(".btn-spinner");
  btn.disabled = loading;
  if (label) label.classList.toggle("hidden", loading);
  if (spinner) spinner.classList.toggle("hidden", !loading);
}

// ── LOGIN HANDLER ─────────────────────────────────────────────────

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("loginError");
  errEl.textContent = "";

  setLoading("loginBtn", true);
  try {
    const data = await apiLogin(username, password);
    saveSession(data.user);
    // Redirect based on role
    window.location.href = "/pages/markets.html";
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    setLoading("loginBtn", false);
  }
}

// ── REGISTER HANDLER ──────────────────────────────────────────────

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value;
  const errEl = document.getElementById("registerError");
  errEl.textContent = "";

  setLoading("registerBtn", true);
  try {
    await apiRegister(username, password);
    // Auto-login after registration
    const loginData = await apiLogin(username, password);
    saveSession(loginData.user);
    window.location.href = "/pages/markets.html";
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    setLoading("registerBtn", false);
  }
}

// ── AUTO-REDIRECT if already logged in (on index page) ──────────

(function redirectIfLoggedIn() {
  // Only redirect on the auth page (no navUsername el means we're on index)
  if (!document.getElementById("navUsername") && getSession()) {
    window.location.href = "/pages/markets.html";
  }
})();
