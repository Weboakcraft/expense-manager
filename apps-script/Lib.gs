/**
 * File: Lib.gs
 * Low-level helpers: sheet<->object mapping, locking, ids, dates, hashing.
 */

/** Read a whole sheet into an array of row-objects keyed by header. */
function readObjects_(sheetName, headerList) {
  var sh = sheet_(sheetName);
  var values = sh.getDataRange().getValues();
  if (values.length < 1) return { headers: headerList.slice(), rows: [] };
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var raw = values[r];
    // Skip fully-empty rows.
    var isEmpty = raw.every(function (c) { return c === '' || c === null; });
    if (isEmpty) continue;
    var obj = { _row: r + 1 }; // 1-based sheet row number
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = cellToText_(raw[c]);
    rows.push(obj);
  }
  return { headers: headers, rows: rows };
}

/**
 * Sheets returns real date cells as Date objects. The app works with
 * 'dd/MM/yyyy' (dates) and 'dd/MM/yyyy HH:mm:ss' (timestamps) text, so
 * convert here once (script time zone = Asia/Kolkata, same as the sheet).
 */
function cellToText_(v) {
  if (!(v instanceof Date) || isNaN(v.getTime())) return v;
  var d = pad2_(v.getDate()) + '/' + pad2_(v.getMonth() + 1) + '/' + v.getFullYear();
  if (v.getHours() === 0 && v.getMinutes() === 0 && v.getSeconds() === 0) return d;
  return d + ' ' + pad2_(v.getHours()) + ':' + pad2_(v.getMinutes()) + ':' + pad2_(v.getSeconds());
}

/** Map an object to a row array following the sheet's real header order. */
function objectToRow_(sheetName, obj) {
  var sh = sheet_(sheetName);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  return headers.map(function (h) {
    return obj.hasOwnProperty(h) && obj[h] !== undefined && obj[h] !== null ? obj[h] : '';
  });
}

/** Append one object as a new row, honouring the exact column order. */
function appendObject_(sheetName, obj) {
  var sh = sheet_(sheetName);
  var row = objectToRow_(sheetName, obj);
  sh.appendRow(row);
  return sh.getLastRow();
}

/** Update an existing row (1-based) from a partial object. */
function updateRow_(sheetName, rowNumber, partial) {
  var sh = sheet_(sheetName);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var current = sh.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  for (var c = 0; c < headers.length; c++) {
    if (partial.hasOwnProperty(headers[c])) current[c] = partial[headers[c]];
  }
  sh.getRange(rowNumber, 1, 1, headers.length).setValues([current]);
}

/** Global document lock to serialise writes (prevents double submission). */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); }
  finally { try { lock.releaseLock(); } catch (e) {} }
}

/** Counters sheet is a simple key/value store used for id sequences. */
function counterGet_(key) {
  var data = readObjects_(SHEETS.COUNTERS, ['Key', 'Value', 'Note']);
  for (var i = 0; i < data.rows.length; i++) {
    if (String(data.rows[i].Key) === key) return data.rows[i];
  }
  return null;
}

/** Next transaction id for an expense DATE: EXP-YYYYMMDD-#### (per day). */
function nextTxId_(expenseDateDMY) {
  var ymd = dmyToYmd_(expenseDateDMY);                 // 20260219
  var prefix = 'EXP-' + ymd + '-';
  var data = readObjects_(SHEETS.TX, TX_COLS);
  var max = 0;
  for (var i = 0; i < data.rows.length; i++) {
    var id = String(data.rows[i]['Transaction ID'] || '');
    if (id.indexOf(prefix) === 0) {
      var n = parseInt(id.substring(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  var seq = ('000' + (max + 1)).slice(-4);
  return prefix + seq;
}

/** Next sequential id like EMP-001, CAT-001 for a master sheet. */
function nextMasterId_(sheetName, idHeader, prefix) {
  var data = readObjects_(sheetName, [idHeader]);
  var max = 0;
  for (var i = 0; i < data.rows.length; i++) {
    var id = String(data.rows[i][idHeader] || '');
    if (id.indexOf(prefix) === 0) {
      var n = parseInt(id.substring(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  return prefix + ('00' + (max + 1)).slice(-3);
}

/* ---------- date helpers (sheet uses dd/MM/yyyy and dd/MM/yyyy HH:mm:ss) ---------- */

function pad2_(n) { return (n < 10 ? '0' : '') + n; }

function nowStampDMY_() {
  var d = new Date();
  return pad2_(d.getDate()) + '/' + pad2_(d.getMonth() + 1) + '/' + d.getFullYear() +
    ' ' + pad2_(d.getHours()) + ':' + pad2_(d.getMinutes()) + ':' + pad2_(d.getSeconds());
}
function nowIso_() { return new Date().toISOString(); }

/** Accepts 'yyyy-MM-dd' (from HTML date input) and returns 'dd/MM/yyyy'. */
function isoDateToDMY_(iso) {
  if (!iso) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso; // already dd/MM/yyyy
  var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return m[3] + '/' + m[2] + '/' + m[1];
}
/** 'dd/MM/yyyy' -> 'yyyyMMdd' */
function dmyToYmd_(dmy) {
  var m = String(dmy).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) { // maybe ISO
    var i = String(dmy).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (i) return i[1] + i[2] + i[3];
    return '00000000';
  }
  return m[3] + pad2_(parseInt(m[2], 10)) + pad2_(parseInt(m[1], 10));
}
/** 'dd/MM/yyyy' -> Date (local midnight) for comparisons. */
function dmyToDate_(dmy) {
  var m = String(dmy).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  var i = String(dmy).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (i) return new Date(parseInt(i[1], 10), parseInt(i[2], 10) - 1, parseInt(i[3], 10));
  return null;
}
/** Parse the transaction Timestamp 'dd/MM/yyyy HH:mm:ss' into a Date. */
function parseTimestamp_(ts) {
  var m = String(ts).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/);
  if (!m) { var d = dmyToDate_(ts); return d; }
  return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);
}

/* ---------- password hashing: sha256$iter$saltHex$b64 ---------- */

function hashPassword_(password, iterations, saltHex) {
  iterations = iterations || 5000;
  saltHex = saltHex || bytesToHex_(randomBytes_(16));
  var data = saltHex + password;
  var digest = data;
  for (var i = 0; i < iterations; i++) {
    var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, digest, Utilities.Charset.UTF_8);
    digest = Utilities.base64Encode(raw);
  }
  return 'sha256$' + iterations + '$' + saltHex + '$' + digest;
}
function verifyPassword_(password, stored) {
  if (!stored) return false;
  var parts = String(stored).split('$');
  if (parts.length !== 4 || parts[0] !== 'sha256') return false;
  var iter = parseInt(parts[1], 10);
  var salt = parts[2];
  var recomputed = hashPassword_(password, iter, salt);
  return constEq_(recomputed, stored);
}
function constEq_(a, b) {
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  return r === 0;
}
function randomBytes_(n) {
  var out = [];
  for (var i = 0; i < n; i++) out.push(Math.floor(Math.random() * 256));
  return out;
}
function bytesToHex_(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

/** Short random token for session ids. */
function randomToken_() {
  return bytesToHex_(randomBytes_(24)) + Date.now().toString(16);
}

function truthy_(v) {
  if (v === true) return true;
  var s = String(v).trim().toUpperCase();
  return s === 'TRUE' || s === 'YES' || s === '1';
}
