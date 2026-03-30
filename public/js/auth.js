/* auth.js — session management, login/register handlers */

// ── TOAST ──────────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, type = "") {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = type + " show";
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

// ── SESSION ────────────────────────────────────────────────────────
const SESSION_KEY = "pm_session";
function getSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } }
function saveSession(user) { localStorage.setItem(SESSION_KEY, JSON.stringify(user)); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }

function requireAuth() {
  const s = getSession();
  if (!s) { window.location.href = "/"; return null; }
  const el = document.getElementById("navUsername");
  if (el) el.textContent = "@" + s.username;
  if (s.isAdmin) {
    const link = document.getElementById("adminLink");
    if (link) link.classList.remove("hidden");
  }
  return s;
}

function requireAdmin() {
  const s = requireAuth();
  if (s && !s.isAdmin) { window.location.href = "/pages/markets.html"; return null; }
  return s;
}

function logout() { clearSession(); window.location.href = "/"; }

// ── TAB SWITCHING ──────────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById("loginForm").classList.toggle("hidden", tab !== "login");
  document.getElementById("registerForm").classList.toggle("hidden", tab !== "register");
  document.getElementById("tabLogin").classList.toggle("active", tab === "login");
  document.getElementById("tabRegister").classList.toggle("active", tab === "register");
  document.getElementById("loginError").textContent = "";
  document.getElementById("registerError").textContent = "";
}

// ── LOADING HELPER ─────────────────────────────────────────────────
function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  const label = btn.querySelector(".btn-label");
  const spinner = btn.querySelector(".btn-spinner");
  if (label) label.classList.toggle("hidden", loading);
  if (spinner) spinner.classList.toggle("hidden", !loading);
}

// ── LOGIN ──────────────────────────────────────────────────────────
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
    window.location.href = "/pages/markets.html";
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    setLoading("loginBtn", false);
  }
}

// ── REGISTER ───────────────────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value;
  const errEl = document.getElementById("registerError");
  errEl.textContent = "";
  setLoading("registerBtn", true);
  try {
    await apiRegister(username, password);
    const loginData = await apiLogin(username, password);
    saveSession(loginData.user);
    window.location.href = "/pages/markets.html";
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    setLoading("registerBtn", false);
  }
}

// ── AUTO-REDIRECT if already logged in ────────────────────────────
(function () {
  if (!document.getElementById("navUsername") && getSession()) {
    window.location.href = "/pages/markets.html";
  }
})();
