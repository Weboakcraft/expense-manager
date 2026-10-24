# Testing Report

Date: 2026-10-24 · Build: v1.0.0

## 1. Data reconciliation (backend logic vs. the sheet's own self-checks)
The dashboard aggregation was run over the full real dataset (1,178 rows) and
compared to the `Counters` self-check formulas in the sheet.

| Metric | App computed | Sheet self-check | Result |
|---|---|---|---|
| Transactions with an ID | 1,178 | 1,178 | ✅ match |
| Total received | ₹5,33,010 | 533010 | ✅ match |
| Total paid out | ₹5,33,947 | 533947 | ✅ match |
| Cash in hand (opening 0) | −₹937 | −937 | ✅ match |

Category breakdown spot-check (PAYMENT PAID): Porter Payment ₹2,94,376 ·
Office Utilities ₹1,72,235 · Raw Material ₹56,149 — consistent with source.

## 2. Static checks
- `node --check` on `config.js`, `demo-data.js`, `api.js`, `app.js`, `sw.js` — all **OK**.
- Column maps in `Config.gs` verified against the live headers of all 9 sheets.

## 3. Headless browser smoke test (Playwright, Chromium)
| Test | Result |
|---|---|
| Page loads, no JS runtime/page errors | ✅ (only external Google-Fonts request blocked by the test sandbox proxy — loads normally on GitHub Pages) |
| Login (demo admin) → dashboard | ✅ |
| KPI values render correctly | ✅ `["-₹937","₹5,33,010","₹5,33,947","₹0"]` |
| Role-based nav (admin sees 8 items) | ✅ |
| Transactions list + pagination | ✅ 50 rows, "Showing 1–50 of 1,178" |
| Charts (monthly bars, donut, bar lists) render | ✅ |
| New-entry form renders with dynamic fields | ✅ |
| Reports view renders | ✅ |
| Dark mode toggle | ✅ |

## 4. Validation rules exercised (demo engine mirrors server)
- Amount ≤ 0 → blocked. ✅
- Online transaction with no proof → blocked (`REQUIRE_PROOF_ONLINE`). ✅
- Cash ≥ ₹5,000 with no proof → blocked. ✅
- Future-dated / older than 30 days → blocked. ✅
- Category with `Needs Customer` and empty customer → blocked. ✅
- Duplicate within 5 min → confirm prompt. ✅
- High-value ≥ ₹25,000 → warning (not blocked). ✅

## 5. Responsive / PWA
- Layouts verified at 1280px, tablet, and ≤480px (sidebar collapses to drawer).
- `manifest.json` + icons (192/512/maskable) + `sw.js` present; app installable;
  offline shell cached.

## 6. Not tested here (requires your live deployment)
These need the Apps Script Web App deployed + Sheets authorized, which happens on
your account (see `DEPLOYMENT.md`):
- Real writes to the Google Sheet (create/edit/soft-delete round-trip).
- Real login against the hashed passwords set by `seedPasswords()`.
- Proof image upload to the `Expense_Sheet_Images` Drive folder.
- APK build on a machine with the Android SDK.

**Recommended acceptance test after deploy:** sign in as each of the 3 users,
create one entry each (online+proof, cash<5000, a PAYMENT RECV), confirm they land
in the sheet with correct IDs, edit one, soft-delete + restore one, and export CSV.

## 7. Known limitations
- Apps Script web apps have quotas (fine for this team's volume); heavy concurrent
  use may hit the 6-min execution limit on very large reads — paginated reads keep
  this well within limits.
- The offline PWA can browse the cached shell offline but needs connectivity to
  read/write the live sheet.
