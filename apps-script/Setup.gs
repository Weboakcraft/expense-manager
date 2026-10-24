/**
 * File: Setup.gs
 * One-time helpers you run manually from the Apps Script editor
 * (Run ▶ pick the function). None of these are exposed over the web API.
 */

/**
 * STEP 1 — set / reset login passwords.
 * Edit the map below, press Run, authorise once. It rewrites only the
 * "Password Hash" column for the matching emails using the same
 * sha256$iter$salt$hash scheme the app verifies against. Nothing else
 * in the sheet is touched. Delete the passwords from this file afterwards.
 */
function seedPasswords() {
  var passwords = {
    'mis@oakcraft.in': 'ChangeMe#Admin1',
    'hroakcraftfurniture@gmail.com': 'ChangeMe#Neetu1',
    'Vishu@oakcraft.in': 'ChangeMe#Vishu1'
  };
  var data = readObjects_(SHEETS.USR, USR_COLS);
  var updated = [];
  data.rows.forEach(function (r) {
    var email = String(r.Email || '').trim().toLowerCase();
    Object.keys(passwords).forEach(function (k) {
      if (k.toLowerCase() === email) {
        updateRow_(SHEETS.USR, r._row, { 'Password Hash': hashPassword_(passwords[k]) });
        updated.push(r.Email);
      }
    });
  });
  Logger.log('Passwords set for: ' + updated.join(', '));
  return updated;
}

/**
 * STEP 2 — create the Drive folder used for proof images (safe to re-run).
 */
function setupDriveFolder() {
  var f = getOrCreateFolder_(UPLOAD_FOLDER_NAME);
  Logger.log('Folder ready: ' + f.getName() + ' (' + f.getId() + ')');
  return f.getId();
}

/**
 * STEP 3 — quick self-test. Confirms every sheet + header is present and
 * that the aggregates compute. Run and read the log; no data is changed.
 */
function selfTest() {
  var problems = [];
  var expect = {};
  expect[SHEETS.TX] = TX_COLS; expect[SHEETS.EMP] = EMP_COLS; expect[SHEETS.CAT] = CAT_COLS;
  expect[SHEETS.APR] = APR_COLS; expect[SHEETS.RCV] = RCV_COLS; expect[SHEETS.USR] = USR_COLS;
  expect[SHEETS.SET] = SET_COLS; expect[SHEETS.AUDIT] = AUDIT_COLS;

  Object.keys(expect).forEach(function (name) {
    try {
      var sh = sheet_(name);
      var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
      expect[name].forEach(function (col) {
        if (headers.indexOf(col) === -1) problems.push(name + ' is missing column "' + col + '"');
      });
    } catch (e) { problems.push(e.message); }
  });

  var admin = { userId: 'TEST', name: 'Self Test', email: 'test', role: 'Admin',
    perms: { add: true, edit: true, del: true, approve: true, export: true, dashboard: true, masters: true } };
  var dash;
  try { dash = dashboard_(admin, {}); } catch (e) { problems.push('dashboard() failed: ' + e.message); }

  Logger.log(problems.length ? ('PROBLEMS:\n- ' + problems.join('\n- ')) : 'All checks passed.');
  if (dash) Logger.log('Cash in hand: ' + dash.kpis.cashInHand + ' | in: ' + dash.kpis.totalIn + ' | out: ' + dash.kpis.totalOut + ' | count: ' + dash.kpis.count);
  return problems;
}

/**
 * Utility — print a fresh hash for a password (to paste manually if needed).
 */
function makeHash() {
  Logger.log(hashPassword_('type-a-password-here'));
}
