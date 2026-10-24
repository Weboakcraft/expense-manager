/**
 * File: Validate.gs
 * Server-side validation engine. Every rule here is driven by the Settings
 * sheet so the business can tune behaviour without a code change. Mirrors the
 * validation/business logic of the original AppSheet app.
 *
 * Returns { ok:true, warnings:[...] } or { ok:false, error:'...' }.
 * "errors" block the save; "warnings" are surfaced to the user but allowed.
 */

function num_(v, def) {
  var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? (def || 0) : n;
}

function categoryByName_(name) {
  var data = readObjects_(SHEETS.CAT, CAT_COLS);
  name = String(name || '').trim().toLowerCase();
  for (var i = 0; i < data.rows.length; i++) {
    if (String(data.rows[i]['Category Name'] || '').trim().toLowerCase() === name) return data.rows[i];
  }
  return null;
}

/**
 * Validate a transaction payload coming from web/app.
 * `tx` uses the real sheet header keys. `isEdit` relaxes the duplicate check.
 */
function validateTx_(tx, isEdit) {
  var S = settingsMap_();
  var warnings = [];
  var type = String(tx['Type of Transaction'] || '').trim().toUpperCase();
  var method = String(tx['Payment Method'] || '').trim().toUpperCase();
  var amount = num_(tx['Amount']);
  var expDateDMY = isoDateToDMY_(tx['Expense Date']);

  // --- required core fields ---
  if (TX_TYPES.indexOf(type) === -1)
    return err_('Type of Transaction must be one of: ' + TX_TYPES.join(', '));
  if (PAYMENT_METHODS.indexOf(method) === -1)
    return err_('Payment Method must be one of: ' + PAYMENT_METHODS.join(', '));
  if (!(amount > 0))
    return err_('Amount must be greater than 0');
  if (!expDateDMY || dmyToDate_(expDateDMY) === null)
    return err_('A valid Expense Date is required');
  if (!String(tx['Expense Category'] || '').trim())
    return err_('Expense Category is required');

  // --- category exists + conditional customer ---
  var cat = categoryByName_(tx['Expense Category']);
  if (!cat) warnings.push('Category "' + tx['Expense Category'] + '" is not in Category_Master');
  if (cat && truthy_(cat['Needs Customer']) && !String(tx['Customer Name'] || '').trim())
    return err_('Customer Name is required for category "' + cat['Category Name'] + '"');

  // --- party fields by type ---
  if (type === 'PAYMENT RECV') {
    if (!String(tx['Amount Recv By'] || '').trim())
      return err_('"Amount Recv By" (receiver) is required for PAYMENT RECV');
  } else {
    // PAYMENT PAID / RECV FROM EMPLOYEE expect an employee/payee
    if (!String(tx['Employee Name'] || '').trim())
      warnings.push('No Employee / payee name set for this ' + type);
  }

  // --- date window: backdate / future limits ---
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var d = dmyToDate_(expDateDMY);
  var diffDays = Math.round((d - today) / 86400000);
  var backDays = num_(S.ALLOW_BACKDATE_DAYS, 30);
  var futureDays = num_(S.ALLOW_FUTURE_DAYS, 0);
  if (diffDays < -backDays)
    return err_('Expense Date is older than the allowed ' + backDays + ' backdate days');
  if (diffDays > futureDays)
    return err_(futureDays === 0
      ? 'Future-dated entries are not allowed'
      : 'Expense Date is more than ' + futureDays + ' day(s) in the future');

  // --- month lock ---
  if (S.MONTH_LOCK_BEFORE) {
    var lock = dmyToDate_(isoDateToDMY_(S.MONTH_LOCK_BEFORE));
    if (lock && d <= lock)
      return err_('This period is locked. Entries on or before ' +
        isoDateToDMY_(S.MONTH_LOCK_BEFORE) + ' cannot be added or changed');
  }

  // --- proof requirements ---
  var hasProof = !!String(tx['Bill / Payment Proof'] || '').trim();
  var requireOnline = truthy_(S.REQUIRE_PROOF_ONLINE);
  var cashAbove = num_(S.REQUIRE_PROOF_CASH_ABOVE, 0);
  if (method === 'ONLINE TRANSACTION' && requireOnline && !hasProof)
    return err_('A bill / payment proof is required for ONLINE TRANSACTION entries');
  if (method === 'CASH' && cashAbove > 0 && amount >= cashAbove && !hasProof)
    return err_('A proof is required for cash payments of ₹' + cashAbove + ' or more');

  // --- high-value flag (warning, not block) ---
  var highVal = num_(S.HIGH_VALUE_THRESHOLD, 0);
  if (highVal > 0 && amount >= highVal)
    warnings.push('High-value transaction (₹' + amount + ' ≥ ₹' + highVal + ') — please double-check');

  // --- duplicate-submission protection ---
  if (!isEdit) {
    var windowMin = num_(S.DUPLICATE_WINDOW_MIN, 5);
    if (windowMin > 0) {
      var dup = findRecentDuplicate_(type, amount, tx['Employee Name'], tx['Amount Recv By'], windowMin);
      if (dup)
        return err_('Looks like a duplicate: an identical ' + type + ' of ₹' + amount +
          ' was just entered (' + dup['Transaction ID'] + '). If this is intentional, mark it as not-a-duplicate.',
          'DUPLICATE');
    }
  }

  return { ok: true, warnings: warnings };
}

function findRecentDuplicate_(type, amount, employee, recvBy, windowMin) {
  var data = readObjects_(SHEETS.TX, TX_COLS);
  var cutoff = Date.now() - windowMin * 60000;
  var party = String(employee || recvBy || '').trim().toLowerCase();
  for (var i = data.rows.length - 1; i >= 0 && i > data.rows.length - 60; i--) {
    var r = data.rows[i];
    if (String(r['Record Status']) === RECORD_STATUS.DELETED) continue;
    if (String(r['Type of Transaction']).toUpperCase() !== type) continue;
    if (num_(r['Amount']) !== amount) continue;
    var rparty = String(r['Employee Name'] || r['Amount Recv By'] || '').trim().toLowerCase();
    if (rparty !== party) continue;
    var ts = parseTimestamp_(r['Timestamp']);
    if (ts && ts.getTime() >= cutoff) return r;
  }
  return null;
}

function err_(message, code) {
  return { ok: false, error: message, code: code || 'VALIDATION' };
}
