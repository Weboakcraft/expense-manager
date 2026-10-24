# Deployment Guide

Two parts: **(A)** the backend (Google Apps Script), then **(B)** the website
(GitHub Pages). Budget ~20 minutes. Do them in order.

---

## Part A — Backend (Google Apps Script Web App)

### A1. Create the script bound to your sheet
1. Open your Google Sheet:
   `https://docs.google.com/spreadsheets/d/1agh1tzPAM14b7mBUfAhzZIHjVH0YLo4rE-vcfZmJIqk/edit`
2. **Extensions → Apps Script**. A new script project opens.
3. Delete the default `Code.gs`.

### A2. Add the backend files
For each file in `apps-script/` (`Config.gs`, `Lib.gs`, `Auth.gs`, `Audit.gs`,
`Validate.gs`, `Transactions.gs`, `Masters.gs`, `Api.gs`, `Setup.gs`):
- In Apps Script: **＋ → Script**, name it the same (without `.gs`), paste the contents.
- For `appsscript.json`: **⚙ Project Settings → “Show appsscript.json manifest file”**,
  then paste it into the `appsscript.json` tab.

### A3. Configure
In `Config.gs`:
- `SPREADSHEET_ID` is already set to your sheet. (Leave as-is.)
- *(Optional, recommended later)* change `API_SHARED_KEY` to a long random string.
  If you do, put the same value in `web/js/config.js → API_KEY`.

### A4. Set login passwords (one time)
1. Open `Setup.gs`, edit the `passwords` map in `seedPasswords()` to the passwords
   you want for each email.
2. Select **`seedPasswords`** in the function dropdown → **Run**.
3. Approve the OAuth consent (your own Google account). Check **Execution log**
   for “Passwords set for: …”.
4. **Delete the plaintext passwords from `Setup.gs`** and save.
5. *(Optional)* Run **`setupDriveFolder`** (creates `Expense_Sheet_Images`) and
   **`selfTest`** (verifies every sheet/column and prints the cash total).

### A5. Deploy as a Web App
1. **Deploy → New deployment → ⚙ → Web app**.
2. **Execute as:** *Me*.
3. **Who has access:** *Anyone*.  ⚠️ This means "anyone with the link can reach the
   API URL" — but every action still requires a valid login token, so it's the
   session + password that protect your data, not the URL's secrecy.
4. **Deploy**, approve, and **copy the Web app URL** — it ends in `/exec`.

> Re-deploying after code changes: **Deploy → Manage deployments → edit (✏) →
> Version: New version → Deploy**. The `/exec` URL stays the same.

---

## Part B — Website (GitHub Pages)

### B1. Point the site at your backend
Edit `web/js/config.js`:
```js
window.APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfyc...XXXX/exec",  // from A5
  API_KEY: "",            // only if you changed API_SHARED_KEY in Config.gs
  ORG_NAME: "Oakcraft",
  CURRENCY: "₹",
  APP_VERSION: "1.0.0"
};
```
Leaving `API_URL` empty keeps the site in demo/preview mode.

### B2. Push to GitHub
```bash
cd oakcraft-expense
git init
git add .
git commit -m "Oakcraft Expense Manager"
git branch -M main
git remote add origin https://github.com/<your-username>/oakcraft-expense.git
git push -u origin main
```

### B3. Turn on GitHub Pages
On GitHub: **Settings → Pages**
- **Source:** *Deploy from a branch*
- **Branch:** `main`, **Folder:** `/web`  ← important (the site lives in `/web`)
- **Save**. After a minute your live URL appears:
  `https://<your-username>.github.io/oakcraft-expense/`

> Prefer the repo root? Move everything inside `web/` to the repo root and set the
> Pages folder to `/ (root)`. Keep `apps-script/`, `android/`, `docs/` out of what
> Pages serves, or just keep the `/web` layout as shipped.

### B4. Verify
Open the live URL, sign in with a real user (password from A4). You should see the
live dashboard reading your sheet, and new entries should appear in the
`Transactions` tab of the Google Sheet.

---

## Custom domain (optional)
In **Settings → Pages → Custom domain**, add e.g. `expense.oakcraft.in`, then add
a `CNAME` DNS record pointing to `<your-username>.github.io`. HTTPS is automatic.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Login always fails | Run `seedPasswords()` (A4); confirm the email matches `User_Master`. |
| "Session expired" immediately | Re-deploy the web app (A5) and confirm the `/exec` URL in `config.js`. |
| CORS / network error | Ensure you used the `/exec` URL (not `/dev`), and access = *Anyone*. |
| Entries not saving | Check the user's `Can Add` flag; check Apps Script **Executions** for errors. |
| Proof upload fails | Run `setupDriveFolder()`; confirm the `drive` scope was approved. |
