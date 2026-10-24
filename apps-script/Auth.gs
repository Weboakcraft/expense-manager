/**
 * File: Auth.gs
 * Login, session tokens, permission checks. Sessions are stored in the
 * script cache + properties so they survive between calls without adding a
 * sheet. Session length honours the SESSION_DAYS setting.
 */

function settingsMap_() {
  var data = readObjects_(SHEETS.SET, SET_COLS);
  var map = {};
  data.rows.forEach(function (r) { map[String(r.Key)] = r.Value; });
  return map;
}

function sessionTtlSeconds_() {
  var s = settingsMap_();
  var days = parseInt(s.SESSION_DAYS, 10);
  if (isNaN(days) || days <= 0) days = 30;
  return days * 24 * 60 * 60;
}

function findUserByEmail_(email) {
  var data = readObjects_(SHEETS.USR, USR_COLS);
  email = String(email || '').trim().toLowerCase();
  for (var i = 0; i < data.rows.length; i++) {
    if (String(data.rows[i].Email || '').trim().toLowerCase() === email) return data.rows[i];
  }
  return null;
}

function userToPrincipal_(u) {
  return {
    userId: u['User ID'],
    name: u.Name,
    email: u.Email,
    role: u.Role,
    department: u.Department,
    perms: {
      add: truthy_(u['Can Add']),
      edit: truthy_(u['Can Edit']),
      del: truthy_(u['Can Delete']),
      approve: truthy_(u['Can Approve']),
      export: truthy_(u['Can Export']),
      dashboard: truthy_(u['Can View Dashboard']),
      masters: truthy_(u['Can Manage Masters'])
    }
  };
}

function login_(email, password, source, ip) {
  var u = findUserByEmail_(email);
  if (!u || !truthy_(u.Active)) return { ok: false, error: 'Invalid email or password' };
  if (!verifyPassword_(password, u['Password Hash'])) {
    return { ok: false, error: 'Invalid email or password' };
  }
  var principal = userToPrincipal_(u);
  var token = randomToken_();
  var ttl = sessionTtlSeconds_();
  var payload = JSON.stringify({ p: principal, exp: Date.now() + ttl * 1000 });
  CacheService.getScriptCache().put('sess_' + token, payload, Math.min(ttl, 21600));
  PropertiesService.getScriptProperties().setProperty('sess_' + token, payload);

  // stamp last login + audit
  withLock_(function () {
    updateRow_(SHEETS.USR, u._row, { 'Last Login': nowIso_() });
  });
  audit_(principal.email, principal.name, 'LOGIN', 'users', principal.userId, '', ip, source);
  return { ok: true, token: token, user: principal };
}

function sessionFromToken_(token) {
  if (!token) return null;
  var key = 'sess_' + token;
  var raw = CacheService.getScriptCache().get(key);
  if (!raw) raw = PropertiesService.getScriptProperties().getProperty(key);
  if (!raw) return null;
  var obj;
  try { obj = JSON.parse(raw); } catch (e) { return null; }
  if (!obj.exp || Date.now() > obj.exp) { logout_(token); return null; }
  // refresh sliding window in cache
  CacheService.getScriptCache().put(key, raw, 21600);
  return obj.p;
}

function logout_(token) {
  var key = 'sess_' + token;
  CacheService.getScriptCache().remove(key);
  PropertiesService.getScriptProperties().deleteProperty(key);
  return { ok: true };
}

function requirePerm_(principal, perm) {
  if (!principal) throw new Error('Not signed in');
  if (perm && !principal.perms[perm]) throw new Error('You do not have permission for this action');
}
