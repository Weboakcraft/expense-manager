/**
 * File: Audit.gs
 * Timestamped audit log. Every create/update/delete/login/export lands here.
 */
function audit_(email, name, action, entity, recordId, details, ip, source) {
  try {
    appendObject_(SHEETS.AUDIT, {
      'At': nowIso_(),
      'User Email': email || '',
      'User Name': name || '',
      'Action': action || '',
      'Entity': entity || '',
      'Record ID': recordId || '',
      'Details': details || '',
      'IP': ip || '',
      'Source': source || 'web'
    });
  } catch (e) {
    // Never let audit failures block the main operation.
  }
}
