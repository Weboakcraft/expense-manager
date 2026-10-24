/**
 * File: Masters.gs
 * Read + manage the master sheets and settings, read the audit log, and
 * accept proof-image uploads into the existing Drive folder.
 * Column order is always preserved via objectToRow_/updateRow_.
 */

/* ---------------- Reads used to populate dropdowns ---------------- */

function bootstrap_(principal) {
  // Everything the UI needs to render forms + dropdowns in one round-trip.
  var cats = readObjects_(SHEETS.CAT, CAT_COLS).rows
    .filter(function (r) { return truthy_(r.Active); })
    .sort(function (a, b) { return num_(a['Display Order']) - num_(b['Display Order']); })
    .map(function (r) {
      return { id: r['Category ID'], name: r['Category Name'], type: r['Type'],
        needsCustomer: truthy_(r['Needs Customer']), description: r['Description'] };
    });
  var emps = readObjects_(SHEETS.EMP, EMP_COLS).rows
    .filter(function (r) { return truthy_(r.Active); })
    .map(function (r) { return { id: r['Employee ID'], name: r['Name'], department: r['Department'] }; })
    .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
  var aprs = readObjects_(SHEETS.APR, APR_COLS).rows
    .filter(function (r) { return truthy_(r.Active); })
    .map(function (r) { return { id: r['Approver ID'], name: r['Name'], level: r['Level'] }; });
  var rcvs = readObjects_(SHEETS.RCV, RCV_COLS).rows
    .filter(function (r) { return truthy_(r.Active); })
    .sort(function (a, b) { return num_(a['Display Order']) - num_(b['Display Order']); })
    .map(function (r) { return { id: r['Receiver ID'], name: r['Name'] }; });

  return {
    ok: true,
    user: principal,
    settings: settingsMap_(),
    categories: cats,
    employees: emps,
    approvers: aprs,
    receivers: rcvs,
    txTypes: TX_TYPES,
    paymentMethods: PAYMENT_METHODS
  };
}

/* ---------------- Generic master listing ---------------- */

function listMaster_(principal, which) {
  requirePerm_(principal, 'dashboard');
  var map = {
    employees: [SHEETS.EMP, EMP_COLS], categories: [SHEETS.CAT, CAT_COLS],
    approvers: [SHEETS.APR, APR_COLS], receivers: [SHEETS.RCV, RCV_COLS],
    users: [SHEETS.USR, USR_COLS]
  };
  var def = map[which];
  if (!def) return err_('Unknown master: ' + which);
  var rows = readObjects_(def[0], def[1]).rows;
  if (which === 'users') rows = rows.map(function (r) { var c = {}; USR_COLS.forEach(function (k) { if (k !== 'Password Hash') c[k] = r[k]; }); c._row = r._row; return c; });
  return { ok: true, rows: rows };
}

/* ---------------- Employee / Category / Approver / Receiver writes ---------------- */

function saveEmployee_(principal, emp) {
  requirePerm_(principal, 'masters');
  return withLock_(function () {
    if (emp['Employee ID']) {
      var row = findMasterRow_(SHEETS.EMP, 'Employee ID', emp['Employee ID']);
      if (!row) return err_('Employee not found');
      updateRow_(SHEETS.EMP, row._row, emp);
      audit_(principal.email, principal.name, 'UPDATE', 'employee', emp['Employee ID'], emp['Name'] || '', '', 'web');
      return { ok: true, id: emp['Employee ID'] };
    }
    var id = nextMasterId_(SHEETS.EMP, 'Employee ID', 'EMP-');
    emp['Employee ID'] = id;
    if (emp['Active'] === undefined) emp['Active'] = true;
    if (emp['Approval Limit'] === undefined) emp['Approval Limit'] = 0;
    appendObject_(SHEETS.EMP, emp);
    audit_(principal.email, principal.name, 'CREATE', 'employee', id, emp['Name'] || '', '', 'web');
    return { ok: true, id: id };
  });
}

function saveCategory_(principal, cat) {
  requirePerm_(principal, 'masters');
  return withLock_(function () {
    if (cat['Category ID']) {
      var row = findMasterRow_(SHEETS.CAT, 'Category ID', cat['Category ID']);
      if (!row) return err_('Category not found');
      updateRow_(SHEETS.CAT, row._row, cat);
      audit_(principal.email, principal.name, 'UPDATE', 'category', cat['Category ID'], cat['Category Name'] || '', '', 'web');
      return { ok: true, id: cat['Category ID'] };
    }
    var id = nextMasterId_(SHEETS.CAT, 'Category ID', 'CAT-');
    cat['Category ID'] = id;
    if (cat['Active'] === undefined) cat['Active'] = true;
    appendObject_(SHEETS.CAT, cat);
    audit_(principal.email, principal.name, 'CREATE', 'category', id, cat['Category Name'] || '', '', 'web');
    return { ok: true, id: id };
  });
}

function saveApprover_(principal, apr) {
  requirePerm_(principal, 'masters');
  return withLock_(function () {
    if (apr['Approver ID']) {
      var row = findMasterRow_(SHEETS.APR, 'Approver ID', apr['Approver ID']);
      if (!row) return err_('Approver not found');
      updateRow_(SHEETS.APR, row._row, apr);
      return { ok: true, id: apr['Approver ID'] };
    }
    var id = nextMasterId_(SHEETS.APR, 'Approver ID', 'APR-');
    apr['Approver ID'] = id;
    if (apr['Active'] === undefined) apr['Active'] = true;
    appendObject_(SHEETS.APR, apr);
    audit_(principal.email, principal.name, 'CREATE', 'approver', id, apr['Name'] || '', '', 'web');
    return { ok: true, id: id };
  });
}

function saveReceiver_(principal, rcv) {
  requirePerm_(principal, 'masters');
  return withLock_(function () {
    if (rcv['Receiver ID']) {
      var row = findMasterRow_(SHEETS.RCV, 'Receiver ID', rcv['Receiver ID']);
      if (!row) return err_('Receiver not found');
      updateRow_(SHEETS.RCV, row._row, rcv);
      return { ok: true, id: rcv['Receiver ID'] };
    }
    var id = nextMasterId_(SHEETS.RCV, 'Receiver ID', 'RCV-');
    rcv['Receiver ID'] = id;
    if (rcv['Active'] === undefined) rcv['Active'] = true;
    appendObject_(SHEETS.RCV, rcv);
    audit_(principal.email, principal.name, 'CREATE', 'receiver', id, rcv['Name'] || '', '', 'web');
    return { ok: true, id: id };
  });
}

function findMasterRow_(sheetName, idHeader, id) {
  var cols = sheetName === SHEETS.EMP ? EMP_COLS : sheetName === SHEETS.CAT ? CAT_COLS :
    sheetName === SHEETS.APR ? APR_COLS : sheetName === SHEETS.RCV ? RCV_COLS :
      sheetName === SHEETS.USR ? USR_COLS : [idHeader];
  var data = readObjects_(sheetName, cols);
  for (var i = 0; i < data.rows.length; i++) {
    if (String(data.rows[i][idHeader]) === String(id)) return data.rows[i];
  }
  return null;
}

/* ---------------- Users ---------------- */

function saveUser_(principal, user, newPassword) {
  requirePerm_(principal, 'masters');
  return withLock_(function () {
    var isEdit = !!user['User ID'];
    var payload = {};
    USR_COLS.forEach(function (c) { if (user.hasOwnProperty(c) && c !== 'Password Hash') payload[c] = user[c]; });

    if (newPassword) payload['Password Hash'] = hashPassword_(newPassword);

    if (isEdit) {
      var row = findMasterRow_(SHEETS.USR, 'User ID', user['User ID']);
      if (!row) return err_('User not found');
      updateRow_(SHEETS.USR, row._row, payload);
      audit_(principal.email, principal.name, 'UPDATE', 'user', user['User ID'], user['Email'] || '', '', 'web');
      return { ok: true, id: user['User ID'] };
    }
    if (!newPassword) return err_('A password is required for a new user');
    var id = nextMasterId_(SHEETS.USR, 'User ID', 'USR-');
    payload['User ID'] = id;
    if (payload['Active'] === undefined) payload['Active'] = true;
    appendObject_(SHEETS.USR, payload);
    audit_(principal.email, principal.name, 'CREATE', 'user', id, user['Email'] || '', '', 'web');
    return { ok: true, id: id };
  });
}

/* ---------------- Settings ---------------- */

function saveSetting_(principal, key, value) {
  requirePerm_(principal, 'masters');
  return withLock_(function () {
    var data = readObjects_(SHEETS.SET, SET_COLS);
    for (var i = 0; i < data.rows.length; i++) {
      if (String(data.rows[i].Key) === key) {
        updateRow_(SHEETS.SET, data.rows[i]._row, { 'Value': value });
        audit_(principal.email, principal.name, 'UPDATE', 'setting', key, String(value), '', 'web');
        return { ok: true, key: key };
      }
    }
    return err_('Unknown setting key: ' + key);
  });
}

/* ---------------- Audit log read ---------------- */

function listAudit_(principal, limit) {
  requirePerm_(principal, 'dashboard');
  var data = readObjects_(SHEETS.AUDIT, AUDIT_COLS);
  var rows = data.rows.slice(-(limit || 200)).reverse();
  return { ok: true, rows: rows };
}

/* ---------------- Proof upload to Drive ---------------- */

function uploadProof_(principal, base64Data, mimeType, filename) {
  requirePerm_(principal, 'add');
  var folder = getOrCreateFolder_(UPLOAD_FOLDER_NAME);
  var bytes = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(bytes, mimeType || 'image/jpeg', filename || ('proof-' + Date.now() + '.jpg'));
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  // store the same relative style path the sheet already uses
  var rel = UPLOAD_FOLDER_NAME + '/' + file.getName();
  return { ok: true, path: rel, url: file.getUrl(), fileId: file.getId() };
}

function getOrCreateFolder_(name) {
  var it = DriveApp.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(name);
}
