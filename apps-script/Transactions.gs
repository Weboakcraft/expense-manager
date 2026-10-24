/**
 * File: Transactions.gs
 * Ledger operations: list (with server-side filtering), create, edit,
 * soft-delete, restore, plus the dashboard aggregate builder.
 * Soft-delete only — rows are never physically removed, matching the
 * Record Status / Deleted By / Deleted At design already in the sheet.
 */

/** Public shape returned to the client (keeps real headers + a few helpers). */
function txToClient_(r) {
  return {
    id: r['Transaction ID'],
    timestamp: r['Timestamp'],
    expenseDate: r['Expense Date'],
    type: r['Type of Transaction'],
    recvBy: r['Amount Recv By'],
    category: r['Expense Category'],
    customer: r['Customer Name'],
    employee: r['Employee Name'],
    method: r['Payment Method'],
    amount: num_(r['Amount']),
    approvedBy: r['Approved By'],
    billProof: r['Bill / Payment Proof'],
    refProof: r['Expense Reference Proof'],
    purpose: r['Purpose / Remarks'],
    status: r['Status'],
    enteredBy: r['Entered By'],
    userEmail: r['User Email'],
    recordStatus: r['Record Status'] || RECORD_STATUS.ACTIVE,
    updatedAt: r['Updated At'],
    updatedBy: r['Updated By'],
    _row: r._row
  };
}

function listTransactions_(principal, filters) {
  requirePerm_(principal, 'dashboard');
  filters = filters || {};
  var data = readObjects_(SHEETS.TX, TX_COLS);
  var rows = data.rows.filter(function (r) {
    return String(r['Transaction ID'] || '').trim() !== '';
  });

  var includeDeleted = !!filters.includeDeleted;
  var q = String(filters.q || '').trim().toLowerCase();
  var fromD = filters.from ? dmyToDate_(isoDateToDMY_(filters.from)) : null;
  var toD = filters.to ? dmyToDate_(isoDateToDMY_(filters.to)) : null;

  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var deleted = String(r['Record Status']) === RECORD_STATUS.DELETED;
    if (deleted && !includeDeleted) continue;

    if (filters.type && String(r['Type of Transaction']).toUpperCase() !== String(filters.type).toUpperCase()) continue;
    if (filters.category && String(r['Expense Category']) !== filters.category) continue;
    if (filters.method && String(r['Payment Method']).toUpperCase() !== String(filters.method).toUpperCase()) continue;
    if (filters.employee && String(r['Employee Name']) !== filters.employee) continue;

    if (fromD || toD) {
      var d = dmyToDate_(r['Expense Date']);
      if (d) {
        if (fromD && d < fromD) continue;
        if (toD && d > toD) continue;
      }
    }
    if (q) {
      var hay = [r['Transaction ID'], r['Expense Category'], r['Customer Name'], r['Employee Name'],
        r['Purpose / Remarks'], r['Amount Recv By'], r['Approved By'], r['Amount']].join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) continue;
    }
    out.push(txToClient_(r));
  }

  // newest first by timestamp
  out.sort(function (a, b) {
    var ta = parseTimestamp_(a.timestamp), tb = parseTimestamp_(b.timestamp);
    return (tb ? tb.getTime() : 0) - (ta ? ta.getTime() : 0);
  });

  // pagination
  var page = parseInt(filters.page, 10) || 1;
  var size = parseInt(filters.pageSize, 10) || 50;
  var total = out.length;
  var start = (page - 1) * size;
  var pageRows = out.slice(start, start + size);

  return { ok: true, total: total, page: page, pageSize: size, rows: pageRows };
}

/**
 * The web/app client sends short keys (type, amount, billProof...). Convert
 * them to the real sheet headers. Only keys that are present are copied, so
 * partial edits keep the other columns as they are.
 */
var CLIENT_TX_KEYS_ = {
  expenseDate: 'Expense Date', type: 'Type of Transaction', recvBy: 'Amount Recv By',
  category: 'Expense Category', customer: 'Customer Name', employee: 'Employee Name',
  method: 'Payment Method', amount: 'Amount', approvedBy: 'Approved By',
  billProof: 'Bill / Payment Proof', refProof: 'Expense Reference Proof',
  purpose: 'Purpose / Remarks', status: 'Status'
};
function normalizeTx_(tx) {
  tx = tx || {};
  var out = {};
  Object.keys(tx).forEach(function (k) {
    var col = CLIENT_TX_KEYS_[k] || k;
    out[col] = tx[k];
  });
  return out;
}

function createTransaction_(principal, tx, options) {
  requirePerm_(principal, 'add');
  tx = normalizeTx_(tx);
  options = options || {};
  // allow an explicit duplicate override
  var v = validateTx_(tx, false);
  if (!v.ok) {
    if (v.code === 'DUPLICATE' && options.allowDuplicate) { /* proceed */ }
    else return v;
  }

  return withLock_(function () {
    var expDMY = isoDateToDMY_(tx['Expense Date']);
    var id = nextTxId_(expDMY);
    var row = {
      'Transaction ID': id,
      'Timestamp': nowStampDMY_(),
      'Expense Date': expDMY,
      'Type of Transaction': String(tx['Type of Transaction']).toUpperCase(),
      'Amount Recv By': tx['Amount Recv By'] || '',
      'Expense Category': tx['Expense Category'] || '',
      'Customer Name': tx['Customer Name'] || '',
      'Employee Name': tx['Employee Name'] || '',
      'Payment Method': String(tx['Payment Method']).toUpperCase(),
      'Amount': num_(tx['Amount']),
      'Approved By': tx['Approved By'] || '',
      'Bill / Payment Proof': tx['Bill / Payment Proof'] || '',
      'Expense Reference Proof': tx['Expense Reference Proof'] || '',
      'Purpose / Remarks': tx['Purpose / Remarks'] || '',
      'Status': tx['Status'] || 'PAID',
      'Entered By': principal.name,
      'User Email': principal.email,
      'Record Status': RECORD_STATUS.ACTIVE,
      'Updated At': '', 'Updated By': '',
      'Deleted By': '', 'Deleted At': '', 'Delete Reason': ''
    };
    appendObject_(SHEETS.TX, row);
    audit_(principal.email, principal.name, 'CREATE', 'transaction', id,
      row['Type of Transaction'] + ' ₹' + row['Amount'] + ' ' + row['Expense Category'], '', 'web');
    return { ok: true, id: id, warnings: v.warnings || [] };
  });
}

function findTxRow_(id) {
  var data = readObjects_(SHEETS.TX, TX_COLS);
  for (var i = 0; i < data.rows.length; i++) {
    if (String(data.rows[i]['Transaction ID']) === String(id)) return data.rows[i];
  }
  return null;
}

function updateTransaction_(principal, id, tx) {
  requirePerm_(principal, 'edit');
  tx = normalizeTx_(tx);
  var existing = findTxRow_(id);
  if (!existing) return err_('Transaction ' + id + ' not found');
  if (String(existing['Record Status']) === RECORD_STATUS.DELETED)
    return err_('Cannot edit a deleted transaction. Restore it first.');

  var merged = {};
  TX_COLS.forEach(function (c) { merged[c] = existing[c]; });
  ['Expense Date', 'Type of Transaction', 'Amount Recv By', 'Expense Category', 'Customer Name',
    'Employee Name', 'Payment Method', 'Amount', 'Approved By', 'Bill / Payment Proof',
    'Expense Reference Proof', 'Purpose / Remarks', 'Status'].forEach(function (c) {
      if (tx.hasOwnProperty(c)) merged[c] = tx[c];
    });
  merged['Expense Date'] = isoDateToDMY_(merged['Expense Date']);

  var v = validateTx_(merged, true);
  if (!v.ok) return v;

  return withLock_(function () {
    updateRow_(SHEETS.TX, existing._row, {
      'Expense Date': merged['Expense Date'],
      'Type of Transaction': String(merged['Type of Transaction']).toUpperCase(),
      'Amount Recv By': merged['Amount Recv By'],
      'Expense Category': merged['Expense Category'],
      'Customer Name': merged['Customer Name'],
      'Employee Name': merged['Employee Name'],
      'Payment Method': String(merged['Payment Method']).toUpperCase(),
      'Amount': num_(merged['Amount']),
      'Approved By': merged['Approved By'],
      'Bill / Payment Proof': merged['Bill / Payment Proof'],
      'Expense Reference Proof': merged['Expense Reference Proof'],
      'Purpose / Remarks': merged['Purpose / Remarks'],
      'Status': merged['Status'],
      'Updated At': nowIso_(),
      'Updated By': principal.name
    });
    audit_(principal.email, principal.name, 'UPDATE', 'transaction', id, '', '', 'web');
    return { ok: true, id: id, warnings: v.warnings || [] };
  });
}

function deleteTransaction_(principal, id, reason) {
  requirePerm_(principal, 'del');
  var existing = findTxRow_(id);
  if (!existing) return err_('Transaction ' + id + ' not found');
  return withLock_(function () {
    updateRow_(SHEETS.TX, existing._row, {
      'Record Status': RECORD_STATUS.DELETED,
      'Deleted By': principal.name,
      'Deleted At': nowIso_(),
      'Delete Reason': reason || ''
    });
    audit_(principal.email, principal.name, 'DELETE', 'transaction', id, reason || '', '', 'web');
    return { ok: true, id: id };
  });
}

function restoreTransaction_(principal, id) {
  requirePerm_(principal, 'del');
  var existing = findTxRow_(id);
  if (!existing) return err_('Transaction ' + id + ' not found');
  return withLock_(function () {
    updateRow_(SHEETS.TX, existing._row, {
      'Record Status': RECORD_STATUS.ACTIVE,
      'Deleted By': '', 'Deleted At': '', 'Delete Reason': ''
    });
    audit_(principal.email, principal.name, 'RESTORE', 'transaction', id, '', '', 'web');
    return { ok: true, id: id };
  });
}

/* ---------------- Dashboard aggregates ---------------- */

function dashboard_(principal, filters) {
  requirePerm_(principal, 'dashboard');
  filters = filters || {};
  var S = settingsMap_();
  var data = readObjects_(SHEETS.TX, TX_COLS);

  var opening = num_(S.OPENING_BALANCE, 0);
  var totalIn = 0, totalOut = 0, count = 0;
  var byCategory = {}, byMonth = {}, byMethod = {};
  var recent = [];
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var days30 = today.getTime() - 30 * 86400000;
  var spend30 = 0, spendDays = {};

  data.rows.forEach(function (r) {
    if (String(r['Transaction ID'] || '').trim() === '') return;
    if (String(r['Record Status']) === RECORD_STATUS.DELETED) return;
    var amt = num_(r['Amount']);
    var type = String(r['Type of Transaction']).toUpperCase();
    count++;
    if (type === 'PAYMENT RECV') totalIn += amt;
    else if (type === 'RECV FROM EMPLOYEE') totalIn += amt;
    else totalOut += amt; // PAYMENT PAID

    if (type === 'PAYMENT PAID') {
      var cat = r['Expense Category'] || 'Uncategorised';
      byCategory[cat] = (byCategory[cat] || 0) + amt;
      var mk = String(r['Method']);
    }
    var method = String(r['Payment Method']).toUpperCase() || 'OTHER';
    byMethod[method] = (byMethod[method] || 0) + (type === 'PAYMENT PAID' ? amt : 0);

    var d = dmyToDate_(r['Expense Date']);
    if (d) {
      var monKey = d.getFullYear() + '-' + pad2_(d.getMonth() + 1);
      if (!byMonth[monKey]) byMonth[monKey] = { in: 0, out: 0 };
      if (type === 'PAYMENT PAID') byMonth[monKey].out += amt; else byMonth[monKey].in += amt;
      if (type === 'PAYMENT PAID' && d.getTime() >= days30) {
        spend30 += amt;
        var dk = d.getFullYear() + '-' + pad2_(d.getMonth() + 1) + '-' + pad2_(d.getDate());
        spendDays[dk] = (spendDays[dk] || 0) + amt;
      }
    }
  });

  var cashInHand = opening + totalIn - totalOut;
  var avgDaily = spend30 / 30;
  var spikeMult = num_(S.SPIKE_MULTIPLIER, 2);

  // cash status
  var critical = num_(S.CASH_CRITICAL_BELOW, 0);
  var warning = num_(S.CASH_WARNING_BELOW, 0);
  var cashStatus = 'ok';
  if (cashInHand < critical) cashStatus = 'critical';
  else if (cashInHand < warning) cashStatus = 'warning';

  // today's spend spike
  var todayKey = today.getFullYear() + '-' + pad2_(today.getMonth() + 1) + '-' + pad2_(today.getDate());
  var todaySpend = spendDays[todayKey] || 0;
  var spike = avgDaily > 0 && todaySpend > avgDaily * spikeMult;

  function toSortedArr(obj) {
    return Object.keys(obj).map(function (k) { return { key: k, value: obj[k] }; })
      .sort(function (a, b) { return b.value - a.value; });
  }
  var monthsArr = Object.keys(byMonth).sort().map(function (k) {
    return { month: k, in: byMonth[k].in, out: byMonth[k].out };
  });

  return {
    ok: true,
    currency: S.CURRENCY_SYMBOL || '₹',
    orgName: S.ORG_NAME || 'Oakcraft',
    kpis: {
      cashInHand: cashInHand, cashStatus: cashStatus,
      totalIn: totalIn, totalOut: totalOut, count: count,
      openingBalance: opening,
      avgDailySpend: Math.round(avgDaily),
      todaySpend: todaySpend, spike: spike,
      criticalBelow: critical, warningBelow: warning
    },
    byCategory: toSortedArr(byCategory),
    byMethod: toSortedArr(byMethod),
    byMonth: monthsArr
  };
}
