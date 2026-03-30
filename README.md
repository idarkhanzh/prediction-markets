# ◈ Prediction Markets

A lightweight, community-driven prediction market web app inspired by Polymarket. Users vote YES or NO on real-world outcome questions, see live percentages and odds, and watch the crowd's conviction shift in real time.

**Zero cost. Deploys in minutes on Vercel.**

---

## ✨ Features

- **Register & log in** with just a username and password — no email, no phone
- **Submit events** for admin review
- **Vote YES or NO** on approved events — toggle your vote at any time
- **Live odds & coefficients** updated instantly after each vote
- **Admin panel** — approve pending events, create direct events, delete any event
- **Shared data** — all users see the same events and votes in real time (via JSONBin.io)
- Fully responsive — works on mobile and desktop

---

## 🗂️ Folder Structure

```
prediction-markets/
├── api/
│   └── index.js          ← Vercel serverless function (all API routes)
├── public/
│   ├── index.html         ← Login / Register page
│   ├── css/
│   │   └── main.css       ← All styles
│   ├── js/
│   │   ├── api.js         ← API fetch wrappers
│   │   ├── auth.js        ← Session management, login/register handlers
│   │   ├── markets.js     ← Event listing, voting, submit modal
│   │   └── admin.js       ← Admin panel logic
│   └── pages/
│       ├── markets.html   ← Main market dashboard
│       └── admin.html     ← Admin panel
├── vercel.json            ← Routing config
├── package.json
└── README.md
```

---

## 🏗️ Architecture & Free Stack

### Why this stack?

| Need | Solution | Cost |
|---|---|---|
| Hosting + serverless | Vercel free tier | Free |
| Shared database | JSONBin.io free tier | Free |
| Auth | Username/password in JSONBin | Free |
| Frontend | Vanilla HTML/CSS/JS | Free |

### How it works

```
Browser → Vercel (static HTML/JS) → Vercel Serverless Function → JSONBin.io
```

1. **Frontend** — Static HTML/CSS/JS served by Vercel's CDN.
2. **API** — A single Vercel serverless function (`/api/index.js`) handles all routes via a `?action=` query param. Node.js, no extra dependencies.
3. **Database** — [JSONBin.io](https://jsonbin.io) stores a single JSON "bin" that acts as the entire database: `{ users: [...], events: [...] }`. The serverless function reads and writes it on every request.

### Data shared across users?

✅ **Yes.** All events and votes live in JSONBin.io and are accessed by every user. This is a real shared backend — not localStorage.

### Security note

This is a demo-grade app. Passwords are stored in plain text in JSONBin. For a production app, you'd hash passwords (bcrypt) and use proper JWTs. See the **Upgrade Path** section below.

---

## 🛠️ Setup — JSONBin.io (one-time, 5 minutes)

You need a free JSONBin account to store data.

### Step 1 — Create a JSONBin account

1. Go to [https://jsonbin.io](https://jsonbin.io)
2. Click **Sign Up** — it's free, no credit card
3. Log in and go to **API Keys** in your dashboard
4. Copy your **Master Key** (starts with `$2b$...`)

### Step 2 — Create a bin

1. In JSONBin dashboard, click **+ New Bin**
2. Paste this as the initial content:
   ```json
   { "users": [], "events": [] }
   ```
3. Click **Save**
4. Copy the **Bin ID** from the URL (it looks like `64a3f...`)

You now have:
- `JSONBIN_BIN_ID` = your bin ID
- `JSONBIN_API_KEY` = your master key

---

## 💻 Run Locally

### Prerequisites

- [Node.js](https://nodejs.org) v18+
- [Vercel CLI](https://vercel.com/docs/cli): `npm install -g vercel`

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/prediction-markets.git
cd prediction-markets

# 2. Create a local environment file
cat > .env.local << EOF
JSONBIN_BIN_ID=your_bin_id_here
JSONBIN_API_KEY=your_master_key_here
EOF

# 3. Run with Vercel dev server (handles serverless functions locally)
vercel dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🚀 Deploy to Vercel

### Option A — Vercel Dashboard (easiest)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your repo
3. In **Environment Variables**, add:
   - `JSONBIN_BIN_ID` = your bin ID
   - `JSONBIN_API_KEY` = your master key
4. Click **Deploy** ✓

### Option B — Vercel CLI

```bash
vercel          # follow prompts, add env vars when asked
vercel --prod   # deploy to production
```

---

## 👤 Admin Accounts

Two admin accounts are hard-coded in the server:

| Username | Password |
|---|---|
| `vlad` | `vlad2006` |
| `aidarkhan` | `aidarkhan2006` |

Admins can:
- See and approve pending events
- Create events that go live immediately
- Delete any event

---

## 📊 How Voting & Odds Work

Each event has two counters: `votes.for` and `votes.against`.

- **Percentage** = `votes.for / total * 100` (rounds to whole number)
- **Coefficient** = `1 / probability * 0.95` (5% vig, like a bookmaker)

Example: 60 YES votes, 40 NO votes → YES is 60%, coefficient ×1.58. NO is 40%, coefficient ×2.38.

Voting is **togglable**: clicking the same side removes your vote. Switching sides adjusts both counters.

---

## ⚠️ Limitations

| Limitation | Explanation |
|---|---|
| Plain-text passwords | Acceptable for demo; easy to upgrade (see below) |
| JSONBin free tier: 10,000 requests/month | Fine for small communities; upgrade if you scale |
| No real-time push | Page must be refreshed to see others' new votes |
| Session in localStorage | Not cryptographically signed; server re-validates on writes |
| JSONBin rate limits | Concurrent heavy write bursts may fail |

---

## 🔼 Upgrade Path (when you're ready)

| Feature | Free Upgrade |
|---|---|
| Real database | [Turso](https://turso.tech) (SQLite, free tier) or [Supabase](https://supabase.com) free tier |
| Password hashing | Add `bcryptjs` npm package to the serverless function |
| Real-time updates | Vercel's free [Edge Config](https://vercel.com/docs/storage/edge-config) or Supabase Realtime |
| Proper JWT sessions | `jose` npm package (pure JS, works in serverless) |

All of the above remain free for small projects.

---

## 📄 License

MIT — do whatever you want with it.
