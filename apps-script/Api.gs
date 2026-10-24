/**
 * File: Api.gs
 * Web-app entry points and action router.
 *
 * Browsers cannot send a custom Content-Type to an Apps Script web app
 * without triggering a CORS pre-flight that Apps Script will not answer.
 * The client therefore POSTs JSON as text/plain (a "simple" request) and we
 * parse e.postData.contents here. GET is used for a health check and simple
 * reads. All responses are JSON via ContentService.
 */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'health';
  if (action === 'health') {
    return json_({ ok: true, service: 'Oakcraft Expense API', time: nowIso_(),
      version: '1.0.0' });
  }
  // allow token-authenticated simple reads over GET too
  return handle_(action, e.parameter || {}, (e.parameter && e.parameter.token) || '', clientIp_(e));
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); }
  catch (err) { return json_({ ok: false, error: 'Bad JSON body' }); }

  // optional shared-key gate (only enforced if changed from the default)
  if (API_SHARED_KEY && API_SHARED_KEY !== 'CHANGE_ME_TO_A_LONG_RANDOM_STRING') {
    if (String(body.apiKey || '') !== API_SHARED_KEY)
      return json_({ ok: false, error: 'Unauthorized client' });
  }
  return handle_(body.action, body, body.token || '', clientIp_(e));
}

function clientIp_(e) {
  try { return (e && e.parameter && e.parameter.ip) || ''; } catch (x) { return ''; }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Central dispatcher. Public actions: login, health. Everything else needs a token. */
function handle_(action, data, token, ip) {
  try {
    switch (action) {
      case 'health':
        return json_({ ok: true, time: nowIso_() });

      case 'login':
        return json_(login_(data.email, data.password, data.source || 'web', ip));
    }

    // --- authenticated from here on ---
    var principal = sessionFromToken_(token);
    if (!principal) return json_({ ok: false, error: 'Session expired. Please sign in again.', code: 'AUTH' });

    switch (action) {
      case 'logout':        return json_(logout_(token));
      case 'me':            return json_({ ok: true, user: principal });
      case 'bootstrap':     return json_(bootstrap_(principal));

      case 'listTransactions': return json_(listTransactions_(principal, data.filters || data));
      case 'createTransaction': return json_(createTransaction_(principal, data.tx || {}, data.options || {}));
      case 'updateTransaction': return json_(updateTransaction_(principal, data.id, data.tx || {}));
      case 'deleteTransaction': return json_(deleteTransaction_(principal, data.id, data.reason));
      case 'restoreTransaction': return json_(restoreTransaction_(principal, data.id));

      case 'dashboard':     return json_(dashboard_(principal, data.filters || {}));

      case 'listMaster':    return json_(listMaster_(principal, data.which));
      case 'saveEmployee':  return json_(saveEmployee_(principal, data.employee || {}));
      case 'saveCategory':  return json_(saveCategory_(principal, data.category || {}));
      case 'saveApprover':  return json_(saveApprover_(principal, data.approver || {}));
      case 'saveReceiver':  return json_(saveReceiver_(principal, data.receiver || {}));
      case 'saveUser':      return json_(saveUser_(principal, data.user || {}, data.newPassword));
      case 'saveSetting':   return json_(saveSetting_(principal, data.key, data.value));

      case 'listAudit':     return json_(listAudit_(principal, data.limit));
      case 'uploadProof':   return json_(uploadProof_(principal, data.base64, data.mimeType, data.filename));

      default:
        return json_({ ok: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}
