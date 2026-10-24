/* ============================================================
   api.js — unified data layer.
   Live mode  : posts JSON (as text/plain, CORS-safe) to Apps Script.
   Demo mode  : runs an in-browser engine over demo-data.js, mirroring
                the server's validation + aggregation so the preview is faithful.
   ============================================================ */
(function () {
  var cfg = window.APP_CONFIG || {};
  var LIVE = !!(cfg.API_URL && cfg.API_URL.trim());

  /* ---------------- LIVE transport ---------------- */
  function liveCall(action, payload) {
    var body = Object.assign({ action: action, token: Store.token, apiKey: cfg.API_KEY || "" }, payload || {});
    return fetch(cfg.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids CORS preflight
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); })
      .catch(function (e) { return { ok: false, error: "Network error: " + e.message, code: "NETWORK" }; });
  }

  /* ---------------- shared helpers ---------------- */
  function num(v) { var n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; }
  function truthy(v) { var s = String(v).trim().toUpperCase(); return v === true || s === "TRUE" || s === "YES" || s === "1"; }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function isoToDMY(iso) {
    if (!iso) return "";
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso;
    var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + "/" + m[2] + "/" + m[1] : iso;
  }
  function dmyToDate(dmy) {
    var m = String(dmy).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    var i = String(dmy).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (i) return new Date(+i[1], +i[2] - 1, +i[3]);
    return null;
  }
  function parseTs(ts) {
    var m = String(ts).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);
    return dmyToDate(ts);
  }
  function nowStampDMY() { var d = new Date(); return pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear() + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds()); }

  window.FMT = { num: num, truthy: truthy, isoToDMY: isoToDMY, dmyToDate: dmyToDate, parseTs: parseTs };

  /* ============================================================
     DEMO ENGINE
     ============================================================ */
  var Demo = (function () {
    var D = window.DEMO_DATA || { transactions: [], categories: [], employees: [], approvers: [], receivers: [], settings: {} };
    // clone so edits in the preview don't mutate the bundle permanently on reload
    var tx = D.transactions.map(function (t) { return Object.assign({}, t); });
    var S = D.settings || {};
    var users = [
      { userId: "USR-001", name: "Administrator", email: "mis@oakcraft.in", role: "Admin", department: "MIS", pwd: "admin",
        perms: { add: true, edit: true, del: true, approve: true, export: true, dashboard: true, masters: true } },
      { userId: "USR-002", name: "NEETU TRIPATHI", email: "hroakcraftfurniture@gmail.com", role: "Data Entry", department: "Accounts", pwd: "neetu",
        perms: { add: true, edit: true, del: false, approve: false, export: false, dashboard: true, masters: false } },
      { userId: "USR-003", name: "VISHU SIR", email: "vishu@oakcraft.in", role: "Approver", department: "Management", pwd: "vishu",
        perms: { add: true, edit: true, del: false, approve: true, export: true, dashboard: true, masters: true } }
    ];
    var audit = [{ At: new Date().toISOString(), "User Email": "mis@oakcraft.in", "User Name": "Administrator", Action: "LOGIN", Entity: "users", "Record ID": "USR-001", Details: "", Source: "demo" }];
    var seq = {};

    function catByName(n) { n = String(n || "").trim().toLowerCase(); return D.categories.filter(function (c) { return c.name.toLowerCase() === n; })[0] || null; }

    function validate(t, isEdit) {
      var warnings = [], type = String(t.type || "").toUpperCase(), method = String(t.method || "").toUpperCase(), amount = num(t.amount), ed = isoToDMY(t.expenseDate);
      var TYPES = ["PAYMENT PAID", "PAYMENT RECV", "RECV FROM EMPLOYEE"], METHODS = ["ONLINE TRANSACTION", "CASH"];
      if (TYPES.indexOf(type) < 0) return { ok: false, error: "Type must be one of: " + TYPES.join(", ") };
      if (METHODS.indexOf(method) < 0) return { ok: false, error: "Payment Method must be one of: " + METHODS.join(", ") };
      if (!(amount > 0)) return { ok: false, error: "Amount must be greater than 0" };
      if (!ed || !dmyToDate(ed)) return { ok: false, error: "A valid Expense Date is required" };
      if (!String(t.category || "").trim()) return { ok: false, error: "Expense Category is required" };
      var cat = catByName(t.category);
      if (cat && cat.needsCustomer && !String(t.customer || "").trim()) return { ok: false, error: 'Customer Name is required for category "' + cat.name + '"' };
      if (type === "PAYMENT RECV" && !String(t.recvBy || "").trim()) return { ok: false, error: '"Amount Recv By" is required for PAYMENT RECV' };
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var diff = Math.round((dmyToDate(ed) - today) / 86400000);
      var back = num(S.ALLOW_BACKDATE_DAYS || 30), fut = num(S.ALLOW_FUTURE_DAYS || 0);
      if (diff < -back) return { ok: false, error: "Expense Date is older than the allowed " + back + " backdate days" };
      if (diff > fut) return { ok: false, error: fut === 0 ? "Future-dated entries are not allowed" : "Date is more than " + fut + " day(s) ahead" };
      if (S.MONTH_LOCK_BEFORE) { var lk = dmyToDate(isoToDMY(S.MONTH_LOCK_BEFORE)); if (lk && dmyToDate(ed) <= lk) return { ok: false, error: "This period is locked (" + isoToDMY(S.MONTH_LOCK_BEFORE) + ")" }; }
      if (!isEdit && !String(t.refProof || "").trim()) return { ok: false, error: "Payment Amount proof is required" };
      if (!isEdit && !String(t.purpose || "").trim()) return { ok: false, error: "Purpose / Remarks is required" };
      var hasProof = !!String(t.billProof || "").trim() || !!String(t.refProof || "").trim();
      if (method === "ONLINE TRANSACTION" && truthy(S.REQUIRE_PROOF_ONLINE) && !hasProof) return { ok: false, error: "A bill / payment proof is required for ONLINE TRANSACTION entries" };
      var cashAbove = num(S.REQUIRE_PROOF_CASH_ABOVE || 0);
      if (method === "CASH" && cashAbove > 0 && amount >= cashAbove && !hasProof) return { ok: false, error: "A proof is required for cash payments of ₹" + cashAbove + " or more" };
      var hv = num(S.HIGH_VALUE_THRESHOLD || 0);
      if (hv > 0 && amount >= hv) warnings.push("High-value transaction (₹" + amount + " ≥ ₹" + hv + ") — please double-check");
      return { ok: true, warnings: warnings };
    }

    function dashboard(f) {
      f = f || {};
      var fromD = f.from ? dmyToDate(isoToDMY(f.from)) : null, toD = f.to ? dmyToDate(isoToDMY(f.to)) : null;
      var opening = num(S.OPENING_BALANCE || 0), tin = 0, tout = 0, allIn = 0, allOut = 0, count = 0, byCat = {}, byMethod = {}, byMonth = {}, byDay = {}, spendDays = {};
      var today = new Date(); today.setHours(0, 0, 0, 0); var d30 = today.getTime() - 30 * 86400000;
      tx.forEach(function (r) {
        if (r.recordStatus === "Deleted") return;
        var amt = num(r.amount), type = String(r.type).toUpperCase();
        var d0 = dmyToDate(r.expenseDate);
        if (type === "PAYMENT PAID") allOut += amt; else allIn += amt;
        if (d0 && type === "PAYMENT PAID" && d0.getTime() >= d30) { var k30 = d0.getFullYear() + "-" + pad2(d0.getMonth() + 1) + "-" + pad2(d0.getDate()); spendDays[k30] = (spendDays[k30] || 0) + amt; }
        if ((fromD || toD) && (!d0 || (fromD && d0 < fromD) || (toD && d0 > toD))) return;
        count++;
        if (type === "PAYMENT PAID") tout += amt; else tin += amt;
        if (type === "PAYMENT PAID") { byCat[r.category || "Uncategorised"] = (byCat[r.category || "Uncategorised"] || 0) + amt; byMethod[String(r.method).toUpperCase() || "OTHER"] = (byMethod[String(r.method).toUpperCase() || "OTHER"] || 0) + amt; }
        var dt = dmyToDate(r.expenseDate);
        if (dt) { var mk = dt.getFullYear() + "-" + pad2(dt.getMonth() + 1); byMonth[mk] = byMonth[mk] || { in: 0, out: 0 }; if (type === "PAYMENT PAID") byMonth[mk].out += amt; else byMonth[mk].in += amt; var dk = mk + "-" + pad2(dt.getDate()); byDay[dk] = byDay[dk] || { in: 0, out: 0 }; if (type === "PAYMENT PAID") byDay[dk].out += amt; else byDay[dk].in += amt; }
      });
      var cash = opening + allIn - allOut, crit = num(S.CASH_CRITICAL_BELOW || 0), warn = num(S.CASH_WARNING_BELOW || 0);
      var status = cash < crit ? "critical" : (cash < warn ? "warning" : "ok");
      var spend30 = Object.keys(spendDays).reduce(function (a, k) { return a + spendDays[k]; }, 0), avg = spend30 / 30;
      var tk = today.getFullYear() + "-" + pad2(today.getMonth() + 1) + "-" + pad2(today.getDate());
      var todaySpend = spendDays[tk] || 0;
      function arr(o) { return Object.keys(o).map(function (k) { return { key: k, value: o[k] }; }).sort(function (a, b) { return b.value - a.value; }); }
      return {
        ok: true, currency: S.CURRENCY_SYMBOL || "₹", orgName: S.ORG_NAME || "Oakcraft",
        kpis: { cashInHand: cash, cashStatus: status, totalIn: tin, totalOut: tout, count: count, openingBalance: opening, avgDailySpend: Math.round(avg), todaySpend: todaySpend, spike: avg > 0 && todaySpend > avg * num(S.SPIKE_MULTIPLIER || 2), criticalBelow: crit, warningBelow: warn },
        byCategory: arr(byCat), byMethod: arr(byMethod),
        byMonth: Object.keys(byMonth).sort().map(function (k) { return { month: k, in: byMonth[k].in, out: byMonth[k].out }; }),
        byDay: Object.keys(byDay).sort().map(function (k) { return { day: k, in: byDay[k].in, out: byDay[k].out }; }),
        range: { from: f.from || "", to: f.to || "" }
      };
    }

    function handle(action, p) {
      p = p || {};
      switch (action) {
        case "health": return { ok: true, demo: true };
        case "login": {
          var u = users.filter(function (x) { return x.email.toLowerCase() === String(p.email || "").toLowerCase(); })[0];
          if (!u || u.pwd !== p.password) return { ok: false, error: "Invalid email or password" };
          audit.unshift({ At: new Date().toISOString(), "User Email": u.email, "User Name": u.name, Action: "LOGIN", Entity: "users", "Record ID": u.userId, Source: "demo" });
          return { ok: true, token: "demo-" + u.userId, user: { userId: u.userId, name: u.name, email: u.email, role: u.role, department: u.department, perms: u.perms } };
        }
        case "me": return { ok: true, user: Store.user };
        case "logout": return { ok: true };
        case "bootstrap": return { ok: true, user: Store.user, settings: S, categories: D.categories, employees: D.employees, approvers: D.approvers, receivers: D.receivers, txTypes: ["PAYMENT PAID", "PAYMENT RECV", "RECV FROM EMPLOYEE"], paymentMethods: ["ONLINE TRANSACTION", "CASH"] };
        case "dashboard": return dashboard(p.filters || {});
        case "listTransactions": {
          var f = p.filters || p, rows = tx.slice();
          if (!f.includeDeleted) rows = rows.filter(function (r) { return r.recordStatus !== "Deleted"; });
          if (f.type) rows = rows.filter(function (r) { return String(r.type).toUpperCase() === String(f.type).toUpperCase(); });
          if (f.category) rows = rows.filter(function (r) { return r.category === f.category; });
          if (f.method) rows = rows.filter(function (r) { return String(r.method).toUpperCase() === String(f.method).toUpperCase(); });
          if (f.employee) rows = rows.filter(function (r) { return r.employee === f.employee; });
          if (f.from) { var fd = dmyToDate(isoToDMY(f.from)); rows = rows.filter(function (r) { var d = dmyToDate(r.expenseDate); return !d || d >= fd; }); }
          if (f.to) { var td = dmyToDate(isoToDMY(f.to)); rows = rows.filter(function (r) { var d = dmyToDate(r.expenseDate); return !d || d <= td; }); }
          if (f.q) { var q = String(f.q).toLowerCase(); rows = rows.filter(function (r) { return [r.id, r.category, r.customer, r.employee, r.purpose, r.recvBy, r.approvedBy, r.amount].join(" ").toLowerCase().indexOf(q) >= 0; }); }
          rows.sort(function (a, b) { var ta = parseTs(a.timestamp), tb = parseTs(b.timestamp); return (tb ? tb.getTime() : 0) - (ta ? ta.getTime() : 0); });
          var page = parseInt(f.page, 10) || 1, size = parseInt(f.pageSize, 10) || 50, total = rows.length;
          return { ok: true, total: total, page: page, pageSize: size, rows: rows.slice((page - 1) * size, (page - 1) * size + size) };
        }
        case "createTransaction": {
          var t = p.tx || {}, v = validate(t, false);
          if (!v.ok) return v;
          var ed = isoToDMY(t.expenseDate), ymd = ed.split("/").reverse().join(""); seq[ymd] = (seq[ymd] || countForDay(ymd)) + 1;
          var id = "EXP-" + ymd + "-" + ("000" + seq[ymd]).slice(-4);
          var rec = { id: id, timestamp: nowStampDMY(), expenseDate: ed, type: String(t.type).toUpperCase(), recvBy: t.recvBy || "", category: t.category || "", customer: t.customer || "", employee: t.employee || "", method: String(t.method).toUpperCase(), amount: num(t.amount), approvedBy: t.approvedBy || "", billProof: t.billProof || "", refProof: t.refProof || "", purpose: t.purpose || "", status: t.status || "PAID", enteredBy: Store.user.name, userEmail: Store.user.email, recordStatus: "Active" };
          tx.unshift(rec); audit.unshift({ At: new Date().toISOString(), "User Email": Store.user.email, "User Name": Store.user.name, Action: "CREATE", Entity: "transaction", "Record ID": id, Details: rec.type + " ₹" + rec.amount, Source: "demo" });
          return { ok: true, id: id, warnings: v.warnings };
        }
        case "updateTransaction": {
          var r0 = tx.filter(function (x) { return x.id === p.id; })[0]; if (!r0) return { ok: false, error: "Not found" };
          var merged = Object.assign({}, r0, p.tx); merged.expenseDate = isoToDMY(merged.expenseDate);
          var vv = validate(merged, true); if (!vv.ok) return vv;
          Object.assign(r0, { expenseDate: merged.expenseDate, type: String(merged.type).toUpperCase(), recvBy: merged.recvBy, category: merged.category, customer: merged.customer, employee: merged.employee, method: String(merged.method).toUpperCase(), amount: num(merged.amount), approvedBy: merged.approvedBy, billProof: merged.billProof, refProof: merged.refProof, purpose: merged.purpose, status: merged.status, updatedAt: new Date().toISOString(), updatedBy: Store.user.name });
          audit.unshift({ At: new Date().toISOString(), "User Email": Store.user.email, "User Name": Store.user.name, Action: "UPDATE", Entity: "transaction", "Record ID": p.id, Source: "demo" });
          return { ok: true, id: p.id, warnings: vv.warnings };
        }
        case "deleteTransaction": {
          var rd = tx.filter(function (x) { return x.id === p.id; })[0]; if (!rd) return { ok: false, error: "Not found" };
          rd.recordStatus = "Deleted"; rd.deletedBy = Store.user.name; rd.deletedAt = new Date().toISOString(); rd.deleteReason = p.reason || "";
          audit.unshift({ At: new Date().toISOString(), "User Email": Store.user.email, "User Name": Store.user.name, Action: "DELETE", Entity: "transaction", "Record ID": p.id, Details: p.reason || "", Source: "demo" });
          return { ok: true, id: p.id };
        }
        case "restoreTransaction": {
          var rr = tx.filter(function (x) { return x.id === p.id; })[0]; if (!rr) return { ok: false, error: "Not found" };
          rr.recordStatus = "Active"; rr.deletedBy = ""; rr.deletedAt = ""; rr.deleteReason = "";
          return { ok: true, id: p.id };
        }
        case "listMaster": {
          var m = { employees: D.employees, categories: D.categories, approvers: D.approvers, receivers: D.receivers, users: users.map(function (u) { return { "User ID": u.userId, Name: u.name, Email: u.email, Role: u.role, Department: u.department, Active: true }; }) };
          return { ok: true, rows: m[p.which] || [] };
        }
        case "listAudit": return { ok: true, rows: audit.slice(0, p.limit || 200) };
        case "saveSetting": S[p.key] = p.value; return { ok: true, key: p.key };
        case "saveEmployee": case "saveCategory": case "saveApprover": case "saveReceiver": case "saveUser": case "deleteUser":
          return { ok: true, id: "DEMO", warnings: ["Saved in preview memory only — deploy the backend to persist to the Sheet"] };
        case "uploadProof": return { ok: true, path: "Expense_Sheet_Images/demo-proof.jpg", url: "#", fileId: "demo" };
        default: return { ok: false, error: "Unknown action: " + action };
      }
    }
    function countForDay(ymd) { var n = 0; tx.forEach(function (t) { if (String(t.id).indexOf("EXP-" + ymd + "-") === 0) { var k = parseInt(String(t.id).split("-")[2], 10); if (k > n) n = k; } }); return n; }

    return { handle: handle };
  })();

  /* ---------------- speed: response cache ----------------
     Read responses are remembered (memory + localStorage) so a screen can
     paint instantly from the last result while the fresh one loads in the
     background. Any write (save/delete/restore/...) clears the cache. */
  var READS = { bootstrap: 1, dashboard: 1, listTransactions: 1, listMaster: 1, listAudit: 1 };
  var CACHE_KEY = "oc_swr_v1", MAX_ENTRIES = 40;
  var mem = (function () { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") || {}; } catch (e) { return {}; } })();
  var saveT = null;
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      try {
        var keys = Object.keys(mem).sort(function (a, b) { return mem[b].t - mem[a].t; });
        keys.slice(MAX_ENTRIES).forEach(function (k) { delete mem[k]; });
        localStorage.setItem(CACHE_KEY, JSON.stringify(mem));
      } catch (e) { try { localStorage.removeItem(CACHE_KEY); } catch (x) {} }
    }, 300);
  }
  function ckey(action, payload) {
    return action + ":" + JSON.stringify(payload || {}, function (k, v) { return (k === "rows" || k === "total") ? undefined : v; });
  }
  function cacheable(action, payload) {
    if (!READS[action]) return false;
    var f = payload && (payload.filters || payload);
    return !(f && parseInt(f.pageSize, 10) > 200); // never cache full exports
  }
  function clearCache() { mem = {}; try { localStorage.removeItem(CACHE_KEY); } catch (e) {} }
  function rawCall(action, payload) {
    if (LIVE) return liveCall(action, payload);
    return new Promise(function (res) { setTimeout(function () { res(Demo.handle(action, payload)); }, 120); });
  }

  /* ---------------- public API ---------------- */
  window.API = {
    isDemo: function () { return !LIVE; },
    mode: function () { return LIVE ? "live" : "demo"; },
    call: function (action, payload) {
      return rawCall(action, payload).then(function (r) {
        if (READS[action]) { if (r && r.ok && cacheable(action, payload)) { mem[ckey(action, payload)] = { t: Date.now(), r: r }; persist(); } }
        else if (action !== "health" && action !== "me" && action !== "uploadProof") clearCache();
        return r;
      });
    },
    /** Last good response for this exact request, or null. */
    peek: function (action, payload) { var e = mem[ckey(action, payload)]; return e ? e.r : null; },
    /** Stale-while-revalidate: cb(cached) right away if we have it, then cb(fresh) when it differs. */
    swr: function (action, payload, cb) {
      var cached = this.peek(action, payload), shown = cached ? JSON.stringify(cached) : null;
      if (cached) cb(cached, true);
      return this.call(action, payload).then(function (r) {
        if (!shown || !r || !r.ok || JSON.stringify(r) !== shown) cb(r, false);
        return r;
      });
    },
    clearCache: clearCache
  };
})();
