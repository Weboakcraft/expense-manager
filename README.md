# Oakcraft Expense Manager

A professional, responsive expense-management **website + installable Android app**,
backed by your existing **Google Sheets** database — a full replacement for the
original AppSheet application, with no changes to your sheet structure.

> Current ledger snapshot: **1,178 transactions**, cash in hand **−₹937**
> (received ₹5,33,010 / paid out ₹5,33,947). All figures reconcile exactly with
> the sheet's own self-checks.

---

## What's inside

```
oakcraft-expense/
├── web/                     ← the website (static, deploy to GitHub Pages)
│   ├── index.html
│   ├── css/styles.css
│   ├── js/
│   │   ├── config.js        ← EDIT THIS: paste your backend URL here
│   │   ├── api.js           ← live + demo data layer
│   │   ├── app.js           ← SPA: dashboard, forms, reports, masters…
│   │   └── demo-data.js     ← offline preview snapshot (ignored when live)
│   ├── icons/               ← PWA icons
│   ├── manifest.json        ← makes it installable on Android
│   └── sw.js                ← offline service worker
├── apps-script/             ← the backend API (Google Apps Script)
│   ├── Config.gs  Lib.gs  Auth.gs  Audit.gs
│   ├── Validate.gs  Transactions.gs  Masters.gs
│   ├── Api.gs               ← doGet/doPost web-app entry points
│   ├── Setup.gs             ← one-time: seedPasswords(), selfTest()
│   └── appsscript.json      ← manifest + OAuth scopes
├── android/                 ← Capacitor wrapper → builds the APK
└── docs/                    ← deployment, analysis, mapping, testing report
```

## Architecture (why it's built this way)

GitHub Pages can only serve static files — it can't run server code or hold
secrets. So:

- **Frontend** (HTML/CSS/JS) → **GitHub Pages** (free, fast, your live URL).
- **Backend API** → **Google Apps Script Web App** — runs *inside* your Google
  account, reads/writes the sheet directly, needs no server and no extra hosting,
  and matches the `sha256$…` password format already in `User_Master`.
- **Android** → the same `web/` folder, installable as a PWA or compiled to an
  APK with Capacitor.

```
 Browser / Android app  ──HTTPS──►  Apps Script Web App  ──►  Google Sheet
   (GitHub Pages)                   (auth, validation,          (your V2 DB,
                                     audit, writes)              unchanged)
```

## Features

- **Dashboard** — cash-in-hand with critical/warning flags, received vs paid,
  30-day average, today's-spend spike detection, monthly cash-flow chart,
  category donut, top categories & payment-method split.
- **Transactions** — server-side search, filter (type/category/method/date range),
  sort, pagination, CSV export, soft-delete + restore, full detail view.
- **New / Edit entry** — every validation from the `Settings` sheet enforced:
  proof rules, back-date/future limits, duplicate detection, high-value flag,
  conditional "Customer" field, month-lock. Proof images upload to the same
  `Expense_Sheet_Images` Drive folder.
- **Reports** — date-range analytics, category/payee breakdowns, export.
- **Masters** — view Categories, Employees (130), Approvers, Receivers.
- **Users & permissions** — 9 permission flags per user, role-based UI.
- **Audit log** — every login/create/update/delete, timestamped.
- **Settings** — tune all 20 business rules from the UI.
- **PWA** — installable, offline app shell, dark mode, mobile-first.

## Quick start

1. **Preview now** — open `web/index.html` (or deploy it). It runs in **demo mode**
   on a snapshot of your real data. Demo logins:
   `mis@oakcraft.in / admin`, `hroakcraftfurniture@gmail.com / neetu`,
   `vishu@oakcraft.in / vishu`.
2. **Go live** — follow **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** to deploy the
   Apps Script backend, set passwords, paste the backend URL into
   `web/js/config.js`, and publish the site to GitHub Pages.
3. **Android** — see **[android/README.md](android/README.md)**.

## Security notes

- Passwords are salted + iterated SHA-256 hashes (`sha256$5000$salt$hash`);
  plaintext is never stored. Set them with `seedPasswords()` in `Setup.gs`.
- Sessions are server-side tokens honouring `SESSION_DAYS`.
- Role permissions are enforced on the **server**, not just hidden in the UI.
- Writes are serialised with a script lock + a duplicate-window check to prevent
  double submissions.
- Soft-delete only — nothing is ever physically removed from the ledger.

See `docs/` for the full AppSheet analysis, field→column mapping, and test report.
