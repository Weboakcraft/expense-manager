/* ============================================================
   app.js — SPA shell, router, views, charts.
   No framework, no build step. Vanilla ES5-friendly JS.
   ============================================================ */
(function () {
  "use strict";
  var cfg = window.APP_CONFIG || {};
  var CUR = cfg.CURRENCY || "₹";

  /* ---------------- tiny DOM helpers ---------------- */
  function el(id) { return document.getElementById(id); }
  function h(tag, attrs, kids) {
    var n = document.createElement(tag); attrs = attrs || {};
    for (var k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k.slice(0, 2) === "on" && typeof attrs[k] === "function") n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c == null) return; n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------------- formatting ---------------- */
  function money(n, withSym) { var v = Math.round(Number(n) || 0); var s = Math.abs(v).toLocaleString("en-IN"); return (v < 0 ? "-" : "") + (withSym === false ? "" : CUR) + s; }
  function money0(n) { return money(n, true); }

  /* ---------------- persistent store ---------------- */
  var LS = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  window.Store = {
    token: LS.get("oc_token") || "",
    user: (function () { try { return JSON.parse(LS.get("oc_user") || "null"); } catch (e) { return null; } })(),
    boot: null,
    view: "dashboard",
    save: function () { if (this.token) { LS.set("oc_token", this.token); LS.set("oc_user", JSON.stringify(this.user)); } },
    clear: function () { this.token = ""; this.user = null; LS.del("oc_token"); LS.del("oc_user"); }
  };

  /* ---------------- icons (feather-style, 24px) ---------------- */
  var I = {
    grid: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    layers: '<path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    wallet: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h3v-4z"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>', down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    tag: '<path d="M20.59 13.41 13.42 20.59a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><path d="M7 7h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>'
  };
  function icon(name, cls) { return '<svg class="ic ' + (cls || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (I[name] || "") + "</svg>"; }

  /* ---------------- toast + modal ---------------- */
  function toast(msg, kind, title) {
    var box = el("toasts") || (function () { var t = h("div", { id: "toasts", class: "toasts" }); document.body.appendChild(t); return t; })();
    var t = h("div", { class: "toast " + (kind || "ok"), html: (title ? "<b>" + esc(title) + "</b>" : "") + esc(msg) });
    box.appendChild(t); setTimeout(function () { t.style.opacity = "0"; t.style.transform = "translateX(20px)"; setTimeout(function () { t.remove(); }, 200); }, kind === "err" ? 5200 : 3200);
  }
  function modal(opts) {
    var bg = h("div", { class: "modal-bg", onclick: function (e) { if (e.target === bg && !opts.sticky) close(); } });
    var m = h("div", { class: "modal " + (opts.size || "") });
    var head = h("div", { class: "modal-h" }, [h("h3", { grow: "" }, [opts.title]), h("button", { class: "icon-btn", onclick: function () { close(); } , html: icon("x") })]);
    head.firstChild.className = "grow";
    var body = h("div", { class: "modal-b" }); if (typeof opts.body === "string") body.innerHTML = opts.body; else if (opts.body) body.appendChild(opts.body);
    m.appendChild(head); m.appendChild(body);
    if (opts.footer) { var f = h("div", { class: "modal-f" }); opts.footer.forEach(function (b) { f.appendChild(b); }); m.appendChild(f); }
    bg.appendChild(m); document.body.appendChild(bg);
    function close() { bg.remove(); if (opts.onClose) opts.onClose(); }
    return { close: close, body: body, root: m };
  }
  function confirmBox(title, message, onYes, danger) {
    var mo = modal({
      size: "sm", title: title, body: h("p", { class: "muted" }, [message]),
      footer: [
        h("button", { class: "btn ghost", onclick: function () { mo.close(); } }, ["Cancel"]),
        h("button", { class: "btn " + (danger ? "danger" : "primary"), onclick: function () { mo.close(); onYes(); } }, ["Confirm"])
      ]
    });
  }

  /* ---------------- theme ---------------- */
  function initTheme() {
    var saved = LS.get("oc_theme"); if (saved) document.documentElement.setAttribute("data-theme", saved);
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme");
    var isDark = cur === "dark" || (!cur && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next); LS.set("oc_theme", next);
  }

  /* ============================================================
     AUTH
     ============================================================ */
  function renderLogin(errMsg) {
    var root = el("root"); root.className = ""; root.innerHTML = "";
    var demoNote = API.isDemo()
      ? h("div", { class: "hint", style: "margin-top:18px;padding:12px;background:var(--accent-soft);border-radius:10px;color:var(--ink-2)" , html:
          '<b style="color:var(--accent)">Preview mode</b><br>Backend not connected yet. Sign in with a demo account:<br>' +
          '<span class="mono">mis@oakcraft.in / admin</span> (Admin)<br>' +
          '<span class="mono">hroakcraftfurniture@gmail.com / neetu</span> (Data Entry)<br>' +
          '<span class="mono">vishu@oakcraft.in / vishu</span> (Approver)' })
      : null;
    var email = h("input", { class: "input", type: "email", placeholder: "you@oakcraft.in", autocomplete: "username" });
    var pwd = h("input", { class: "input", type: "password", placeholder: "Password", autocomplete: "current-password" });
    var btn = h("button", { class: "btn primary block", style: "margin-top:6px" }, ["Sign in"]);
    var errEl = h("div", { class: "err-text", style: "min-height:18px;margin-bottom:6px" }, [errMsg || ""]);
    function submit() {
      btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px"></span> Signing in…';
      API.call("login", { email: email.value.trim(), password: pwd.value, source: API.mode() }).then(function (r) {
        btn.disabled = false; btn.textContent = "Sign in";
        if (!r.ok) { errEl.textContent = r.error || "Login failed"; return; }
        Store.token = r.token; Store.user = r.user; Store.save(); boot();
      });
    }
    btn.addEventListener("click", submit);
    [email, pwd].forEach(function (i) { i.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); }); });
    var card = h("div", { class: "login-card" }, [
      h("div", { class: "brand-mark" }, ["O"]),
      h("h1", {}, [cfg.ORG_NAME || "Oakcraft"]),
      h("div", { class: "sub" }, ["Expense Manager — sign in to continue"]),
      h("div", { class: "field" }, [h("label", {}, ["Email"]), email]),
      h("div", { class: "field" }, [h("label", {}, ["Password"]), pwd]),
      errEl, btn, demoNote
    ]);
    root.appendChild(h("div", { class: "login-wrap" }, [card]));
    setTimeout(function () { email.focus(); }, 60);
  }

  /* ============================================================
     SHELL
     ============================================================ */
  var NAV = [
    { id: "dashboard", label: "Dashboard", icon: "grid", perm: "dashboard" },
    { id: "transactions", label: "Transactions", icon: "list", perm: "dashboard" },
    { id: "add", label: "New Entry", icon: "plus", perm: "add" },
    { id: "reports", label: "Reports", icon: "chart", perm: "dashboard" },
    { sep: true },
    { id: "masters", label: "Masters", icon: "layers", perm: "masters" },
    { id: "users", label: "Users", icon: "users", perm: "masters" },
    { id: "audit", label: "Audit Log", icon: "shield", perm: "dashboard" },
    { id: "settings", label: "Settings", icon: "gear", perm: "masters" }
  ];
  function can(perm) { return !perm || (Store.user && Store.user.perms && Store.user.perms[perm]); }

  function renderShell() {
    var root = el("root"); root.className = ""; root.innerHTML = "";
    var app = h("div", { class: "app", id: "app" });
    // sidebar
    var side = h("aside", { class: "sidebar" });
    side.appendChild(h("div", { class: "brand" }, [
      h("div", { class: "mk" }, ["O"]),
      h("div", { class: "nm", html: esc(cfg.ORG_NAME || "Oakcraft") + "<small>Expense Manager</small>" })
    ]));
    NAV.forEach(function (n) {
      if (n.sep) { side.appendChild(h("div", { class: "nav-sep" })); return; }
      if (!can(n.perm)) return;
      var item = h("div", { class: "nav-item" + (Store.view === n.id ? " active" : ""), "data-view": n.id, html: icon(n.icon) + "<span>" + esc(n.label) + "</span>", onclick: function () { go(n.id); } });
      side.appendChild(item);
    });
    side.appendChild(h("div", { class: "spacer" }));
    side.appendChild(h("div", { class: "side-user", html: "<b>" + esc(Store.user.name) + "</b><span class='role'>" + esc(Store.user.role) + " · " + esc(Store.user.email) + "</span>" }));
    side.appendChild(h("button", { class: "btn ghost sm", style: "justify-content:flex-start;margin-top:8px", html: icon("logout") + " Sign out", onclick: logout }));
    app.appendChild(side);
    app.appendChild(h("div", { class: "backdrop", onclick: function () { app.classList.remove("nav-open"); } }));

    // main
    var main = h("div", { class: "main" });
    var top = h("div", { class: "topbar" }, [
      h("button", { class: "icon-btn hamburger", html: icon("menu"), onclick: function () { app.classList.toggle("nav-open"); } }),
      h("h2", { id: "page-title", class: "grow" }, ["Dashboard"]),
      h("button", { class: "icon-btn", html: icon("sun"), title: "Toggle theme", onclick: toggleTheme })
    ]);
    main.appendChild(top);
    if (API.isDemo()) main.appendChild(h("div", { class: "demo-banner", html: icon("alert") + " <span><b>Preview mode</b> — showing a snapshot of your real data. Changes stay in memory. Connect the backend (edit <span class='mono'>js/config.js</span>) to go live.</span>" }));
    main.appendChild(h("div", { class: "content", id: "view" }));
    app.appendChild(main);
    // mobile / APK: bottom tab bar so the main screens are one tap away (no sidebar needed)
    function tab(view, label, ic, perm) {
      if (perm && !can(perm)) return h("span", {});
      return h("button", { type: "button", class: "bn-item" + (Store.view === view ? " active" : ""), "data-view": view, onclick: function () { go(view); } , html: icon(ic) + "<span>" + esc(label) + "</span>" });
    }
    var bnav = h("nav", { class: "bottom-nav" }, [
      tab("dashboard", "Home", "grid", "dashboard"),
      tab("transactions", "Records", "list", "dashboard"),
      can("add") ? h("button", { type: "button", class: "bn-item bn-fab" + (Store.view === "add" ? " active" : ""), "data-view": "add", onclick: function () { go("add"); }, html: '<span class="fab">' + icon("plus") + "</span><span>New</span>" }) : h("span", {}),
      tab("reports", "Reports", "chart", "dashboard"),
      h("button", { type: "button", class: "bn-item bn-more", onclick: function () { app.classList.toggle("nav-open"); }, html: icon("menu") + "<span>More</span>" })
    ]);
    app.appendChild(bnav);
    root.appendChild(app);
  }

  function go(view) {
    Store.view = view;
    document.querySelectorAll(".nav-item, .bn-item[data-view]").forEach(function (n) { n.classList.toggle("active", n.getAttribute("data-view") === view); });
    var more = document.querySelector(".bn-more"); if (more) more.classList.toggle("active", ["masters", "users", "audit", "settings"].indexOf(view) >= 0);
    window.scrollTo(0, 0);
    var titles = { dashboard: "Dashboard", transactions: "Transactions", add: "New Entry", reports: "Reports & Analytics", masters: "Master Data", users: "Users & Permissions", audit: "Audit Log", settings: "Settings" };
    if (el("page-title")) el("page-title").textContent = titles[view] || view;
    var app = el("app"); if (app) app.classList.remove("nav-open");
    var v = el("view"); if (v) { v.innerHTML = ""; (Views[view] || Views.dashboard)(v); }
  }

  function logout() { API.call("logout", {}); API.clearCache(); LS.del("oc_boot"); Store.clear(); renderLogin(); }

  function loader(container) { container.appendChild(h("div", { class: "loading-full" }, [h("div", { class: "spinner" })])); }

  /* ============================================================
     VIEWS
     ============================================================ */
  var Views = {};

  /* ----- Dashboard ----- */
  Views.dashboard = function (v) {
    // ---- date range picker: Today / This Week / This Month / All Time / Custom ----
    function iso(d) { return d.getFullYear() + "-" + (d.getMonth() < 9 ? "0" : "") + (d.getMonth() + 1) + "-" + (d.getDate() < 10 ? "0" : "") + d.getDate(); }
    function rangeFor(key) {
      var t = new Date(); t.setHours(0, 0, 0, 0);
      if (key === "today") return { from: iso(t), to: iso(t) };
      if (key === "week") { var w = new Date(t); w.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return { from: iso(w), to: iso(t) }; } // Monday start
      if (key === "month") return { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(t) };
      if (key === "custom") return { from: LS.get("oc_dash_from") || iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: LS.get("oc_dash_to") || iso(t) };
      return { from: "", to: "" }; // all time
    }
    var keys = [["today", "Today"], ["week", "This Week"], ["month", "This Month"], ["all", "All Time"], ["custom", "Custom"]];
    var cur = LS.get("oc_dash_range") || "month";
    var pills = h("div", { class: "pill-tabs" });
    var fromI = h("input", { class: "input", type: "date", style: "width:160px;flex:none" });
    var toI = h("input", { class: "input", type: "date", style: "width:160px;flex:none" });
    var applyB = h("button", { class: "btn sm primary", style: "flex:none" }, ["Apply"]);
    var customBox = h("div", { class: "row", style: "gap:8px;flex-wrap:wrap;align-items:center;width:auto" }, [fromI, h("span", { class: "muted" }, ["to"]), toI, applyB]);
    var rangeLbl = h("div", { class: "muted", style: "font-size:13px" });
    var updated = h("span", { class: "muted", style: "font-size:12px" });
    var refreshB = h("button", { class: "btn sm ghost", title: "Refresh now" }, ["↻ Refresh"]);
    keys.forEach(function (k) { pills.appendChild(h("button", { "data-k": k[0], onclick: function () { cur = k[0]; LS.set("oc_dash_range", cur); sync(); load(); } }, [k[1]])); });
    applyB.addEventListener("click", function () { if (fromI.value && toI.value && fromI.value > toI.value) { toast("From date is after To date", "err"); return; } LS.set("oc_dash_from", fromI.value); LS.set("oc_dash_to", toI.value); load(); });
    refreshB.addEventListener("click", function () { load(); });
    var bar = h("div", { class: "toolbar" }, [pills, customBox]);
    var infoRow = h("div", { class: "row", style: "gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 12px" }, [h("div", { class: "grow" }, [rangeLbl]), updated, refreshB]);
    var body = h("div", {});
    v.appendChild(bar); v.appendChild(infoRow); v.appendChild(body);

    function fmtD(isoStr) { if (!isoStr) return ""; var p = isoStr.split("-"); var m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+p[1] - 1]; return +p[2] + " " + m + " " + p[0]; }
    function sync() {
      Array.prototype.forEach.call(pills.children, function (b) { b.classList.toggle("active", b.getAttribute("data-k") === cur); });
      customBox.style.display = cur === "custom" ? "" : "none";
      if (cur === "custom") { var r = rangeFor("custom"); fromI.value = r.from; toI.value = r.to; }
    }
    function current() { return cur === "custom" ? { from: fromI.value, to: toI.value } : rangeFor(cur); }

    var seq = 0;
    function load(silent) {
      var r = current(), my = ++seq;
      rangeLbl.textContent = r.from || r.to ? "Showing " + (r.from === r.to ? fmtD(r.from) : fmtD(r.from) + " – " + fmtD(r.to)) + " (by Expense Date)" : "Showing all time";
      var dq = { filters: r }, lq = { filters: { page: 1, pageSize: 8, from: r.from, to: r.to } };
      var cd = API.peek("dashboard", dq), cl = API.peek("listTransactions", lq), shown = null;
      if (cd && cl) { paint(cd, cl, true); shown = JSON.stringify([cd, cl]); }
      else if (!silent) { body.innerHTML = ""; loader(body); }
      Promise.all([API.call("dashboard", dq), API.call("listTransactions", lq)]).then(function (res) {
        if (my !== seq) return; // a newer request is on its way
        if (shown && res[0].ok && JSON.stringify(res) === shown) { updated.textContent = "Live · updated " + new Date().toLocaleTimeString("en-IN"); return; }
        paint(res[0], res[1], false);
      });
      function paint(d, list, fromCache) {
        body.innerHTML = "";
        if (!d.ok) return body.appendChild(errorCard(d.error));
        var k = d.kpis;
        updated.textContent = fromCache ? "Updating…" : "Live · updated " + new Date().toLocaleTimeString("en-IN");
        body.appendChild(h("div", { class: "kpis" }, [
          kpi("Cash in Hand", money0(k.cashInHand), k.cashStatus, (k.cashStatus === "critical" ? "Below critical ₹" + k.criticalBelow : k.cashStatus === "warning" ? "Below warning ₹" + k.warningBelow : "Healthy") + " · overall balance", "wallet"),
          kpi("Received", money0(k.totalIn), "in", "In selected period", "down"),
          kpi("Paid Out", money0(k.totalOut), "out", k.count + " transactions in period", "up"),
          kpi("Today's Spend", money0(k.todaySpend), k.spike ? "warn" : "", k.spike ? "⚠ Unusual vs 30-day avg" : "Avg/day (30d): " + money0(k.avgDailySpend), "chart")
        ]));
        var span = r.from && r.to ? (FMT.dmyToDate(FMT.isoToDMY(r.to)) - FMT.dmyToDate(FMT.isoToDMY(r.from))) / 86400000 : 999;
        var flow = span <= 62
          ? card("Cash flow by day", flowChart((d.byDay || []).map(function (x) { return { label: x.day.slice(8) + "/" + x.day.slice(5, 7), in: x.in, out: x.out }; }), 62))
          : card("Cash flow by month", flowChart((d.byMonth || []).map(function (x) { return { label: x.month.slice(2).replace("-", "/"), in: x.in, out: x.out }; }), 12));
        var grid = h("div", { class: "grid-2" }, [flow, card("Expense by category", donutBlock(d.byCategory))]);
        body.appendChild(grid);
        body.appendChild(h("div", { class: "grid-2", style: "margin-top:16px" }, [
          card("Top spending categories", barsBlock(d.byCategory.slice(0, 7))),
          card("Payment method split", barsBlock(d.byMethod, true))
        ]));
        var recentCard = h("div", { class: "card", style: "margin-top:16px" });
        recentCard.appendChild(h("div", { class: "card-h" }, [h("h3", { class: "grow" }, ["Recent transactions in period"]), h("button", { class: "btn sm", onclick: function () { txState.from = r.from; txState.to = r.to; txState.page = 1; go("transactions"); }, html: "View all" })]));
        recentCard.appendChild(list.ok && list.rows.length ? txTable(list.rows, { compact: true }) : h("div", { class: "empty muted" }, ["No transactions in this period"]));
        body.appendChild(recentCard);
      }
    }
    sync(); load();
    // live: refresh every 60 s while the dashboard is on screen
    var timer = setInterval(function () { if (!v.isConnected || Store.view !== "dashboard" || !body.isConnected) { clearInterval(timer); return; } if (!document.hidden) load(true); }, 60000);
  };
  function flowChart(items, maxBars) {
    if (!items || !items.length) return h("div", { class: "empty muted" }, ["No data in this period"]);
    var data = items.slice(-maxBars);
    var W = 560, H = 210, pad = 30, bw = (W - pad * 2) / data.length;
    var max = Math.max.apply(null, data.map(function (m) { return Math.max(m.in, m.out); })) || 1;
    function y(val) { return H - pad - (val / max) * (H - pad * 2); }
    var every = Math.ceil(data.length / 12), bars = "", labels = "";
    data.forEach(function (m, i) {
      var x = pad + i * bw, gap = bw * 0.18, each = (bw - gap * 2) / 2;
      bars += '<rect x="' + (x + gap) + '" y="' + y(m.in) + '" width="' + each + '" height="' + (H - pad - y(m.in)) + '" rx="2" fill="#1f8a54"><title>' + esc(m.label) + ' · In ' + money0(m.in) + '</title></rect>';
      bars += '<rect x="' + (x + gap + each) + '" y="' + y(m.out) + '" width="' + each + '" height="' + (H - pad - y(m.out)) + '" rx="2" fill="#b5742a"><title>' + esc(m.label) + ' · Out ' + money0(m.out) + '</title></rect>';
      if (i % every === 0) labels += '<text x="' + (x + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="var(--ink-3)">' + esc(m.label) + '</text>';
    });
    var gl = ""; for (var g = 0; g <= 3; g++) { var gy = pad + (H - pad * 2) * g / 3; gl += '<line x1="' + pad + '" y1="' + gy + '" x2="' + (W - pad) + '" y2="' + gy + '" stroke="var(--border)" stroke-width="1"/>'; }
    var box = h("div", {});
    box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" preserveAspectRatio="xMidYMid meet">' + gl + bars + labels + '</svg>';
    box.appendChild(h("div", { class: "legend" }, [
      h("span", { class: "li", html: '<span class="sw" style="background:#1f8a54"></span>Received' }),
      h("span", { class: "li", html: '<span class="sw" style="background:#b5742a"></span>Paid out' })
    ]));
    return box;
  }
  function kpi(label, val, cls, sub, ic) {
    return h("div", { class: "kpi " + (cls || "") }, [
      h("div", { class: "k-strip" }),
      h("div", { class: "k-label" }, [label]),
      h("div", { class: "k-val" }, [val]),
      h("div", { class: "k-sub" }, [sub])
    ]);
  }
  function card(title, bodyNode, headRight) {
    var c = h("div", { class: "card" });
    c.appendChild(h("div", { class: "card-h" }, [h("h3", { class: "grow" }, [title]), headRight || null]));
    var b = h("div", { class: "card-b" }); if (bodyNode) b.appendChild(bodyNode); c.appendChild(b); return c;
  }
  function errorCard(msg) { return h("div", { class: "card pad" }, [h("div", { class: "empty", html: icon("alert") + "<div>" + esc(msg || "Something went wrong") + "</div>" })]); }

  /* ----- charts (SVG) ----- */
  var PALETTE = ["#0f6e5c", "#b5742a", "#2b6cb0", "#8a5cf6", "#d9534f", "#1f8a54", "#c9a227", "#5b6b73", "#d16ba5", "#4cc3a7"];
  function donutBlock(data) {
    var total = data.reduce(function (a, b) { return a + b.value; }, 0) || 1;
    var top = data.slice(0, 8);
    var others = data.slice(8).reduce(function (a, b) { return a + b.value; }, 0);
    if (others > 0) top = top.concat([{ key: "Others", value: others }]);
    var R = 70, r = 44, cx = 90, cy = 90, acc = 0;
    var segs = top.map(function (d, i) {
      var frac = d.value / total, a0 = acc * 2 * Math.PI - Math.PI / 2; acc += frac; var a1 = acc * 2 * Math.PI - Math.PI / 2;
      var large = frac > 0.5 ? 1 : 0;
      var x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0), x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
      var xi1 = cx + r * Math.cos(a1), yi1 = cy + r * Math.sin(a1), xi0 = cx + r * Math.cos(a0), yi0 = cy + r * Math.sin(a0);
      return '<path d="M' + x0 + ' ' + y0 + ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + x1 + ' ' + y1 + ' L' + xi1 + ' ' + yi1 + ' A' + r + ' ' + r + ' 0 ' + large + ' 0 ' + xi0 + ' ' + yi0 + ' Z" fill="' + PALETTE[i % PALETTE.length] + '"/>';
    }).join("");
    var wrap = h("div", { class: "row", style: "gap:22px;align-items:center;flex-wrap:wrap" });
    wrap.appendChild(h("div", { html: '<svg width="180" height="180" viewBox="0 0 180 180" class="chart" style="max-width:180px">' + segs + '<text x="90" y="86" text-anchor="middle" font-size="12" fill="var(--ink-3)">Total</text><text x="90" y="104" text-anchor="middle" font-size="15" font-weight="700" fill="var(--ink)">' + money0(total) + '</text></svg>' }));
    var leg = h("div", { class: "legend grow" });
    top.forEach(function (d, i) { leg.appendChild(h("div", { class: "li", html: '<span class="sw" style="background:' + PALETTE[i % PALETTE.length] + '"></span>' + esc(d.key) + ' · <b style="color:var(--ink)">' + Math.round(d.value / total * 100) + '%</b>' })); });
    wrap.appendChild(leg);
    return wrap;
  }
  function barsBlock(data, methodColors) {
    if (!data.length) return h("div", { class: "empty muted" }, ["No data"]);
    var max = Math.max.apply(null, data.map(function (d) { return d.value; })) || 1;
    var wrap = h("div", {});
    data.forEach(function (d, i) {
      var pct = Math.max(2, d.value / max * 100);
      var color = methodColors ? (i === 0 ? "var(--primary)" : "var(--accent)") : "";
      wrap.appendChild(h("div", { class: "bar-row", html:
        '<div class="lbl" title="' + esc(d.key) + '">' + esc(d.key) + '</div>' +
        '<div class="track"><div class="fill" style="width:' + pct + '%' + (color ? ';background:' + color : "") + '"></div></div>' +
        '<div class="v">' + money0(d.value) + '</div>' }));
    });
    return wrap;
  }
  function monthlyChart(months, currency) {
    if (!months || !months.length) return h("div", { class: "empty muted" }, ["No data"]);
    var data = months.slice(-12);
    var W = 560, H = 210, pad = 30, bw = (W - pad * 2) / data.length;
    var max = Math.max.apply(null, data.map(function (m) { return Math.max(m.in, m.out); })) || 1;
    function y(val) { return H - pad - (val / max) * (H - pad * 2); }
    var bars = "", labels = "";
    data.forEach(function (m, i) {
      var x = pad + i * bw, gap = bw * 0.18, each = (bw - gap * 2) / 2;
      bars += '<rect x="' + (x + gap) + '" y="' + y(m.in) + '" width="' + each + '" height="' + (H - pad - y(m.in)) + '" rx="2" fill="#1f8a54"><title>In ' + money0(m.in) + '</title></rect>';
      bars += '<rect x="' + (x + gap + each) + '" y="' + y(m.out) + '" width="' + each + '" height="' + (H - pad - y(m.out)) + '" rx="2" fill="#b5742a"><title>Out ' + money0(m.out) + '</title></rect>';
      var lbl = m.month.slice(2).replace("-", "/");
      labels += '<text x="' + (x + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="var(--ink-3)">' + lbl + '</text>';
    });
    var gl = ""; for (var g = 0; g <= 3; g++) { var gy = pad + (H - pad * 2) * g / 3; gl += '<line x1="' + pad + '" y1="' + gy + '" x2="' + (W - pad) + '" y2="' + gy + '" stroke="var(--border)" stroke-width="1"/>'; }
    var box = h("div", {});
    box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" preserveAspectRatio="xMidYMid meet">' + gl + bars + labels + '</svg>';
    box.appendChild(h("div", { class: "legend" }, [
      h("span", { class: "li", html: '<span class="sw" style="background:#1f8a54"></span>Received' }),
      h("span", { class: "li", html: '<span class="sw" style="background:#b5742a"></span>Paid out' })
    ]));
    return box;
  }

  /* ----- Transactions ----- */
  var txState = { page: 1, pageSize: 50, q: "", type: "", category: "", method: "", from: "", to: "", includeDeleted: false, sortKey: "timestamp", sortDir: -1, rows: [], total: 0 };
  Views.transactions = function (v) {
    var tb = h("div", {});
    // toolbar
    var search = h("input", { class: "input", placeholder: "Search ID, category, employee, purpose, amount…", value: txState.q });
    var typeSel = selectFrom(["", "PAYMENT PAID", "PAYMENT RECV", "RECV FROM EMPLOYEE"], txState.type, "All types");
    var catSel = selectFrom([""].concat((Store.boot.categories || []).map(function (c) { return c.name; })), txState.category, "All categories");
    var methodSel = selectFrom(["", "ONLINE TRANSACTION", "CASH"], txState.method, "All methods");
    var from = h("input", { class: "input", type: "date", value: txState.from, style: "max-width:160px" });
    var to = h("input", { class: "input", type: "date", value: txState.to, style: "max-width:160px" });
    var delChk = h("label", { class: "switch" }, [h("input", { type: "checkbox" }), "Show deleted"]);
    if (txState.includeDeleted) delChk.firstChild.checked = true;
    var apply = debounce(function () {
      txState.q = search.value; txState.type = typeSel.value; txState.category = catSel.value; txState.method = methodSel.value;
      txState.from = from.value; txState.to = to.value; txState.includeDeleted = delChk.firstChild.checked; txState.page = 1; load();
    }, 280);
    [search].forEach(function (i) { i.addEventListener("input", apply); });
    [typeSel, catSel, methodSel, from, to].forEach(function (i) { i.addEventListener("change", apply); });
    delChk.firstChild.addEventListener("change", apply);

    var bar1 = h("div", { class: "toolbar" }, [
      h("div", { class: "search grow", html: icon("search") }, [search]),
      can("add") ? h("button", { class: "btn primary", html: icon("plus") + " New", onclick: function () { go("add"); } }) : null,
      can("export") ? h("button", { class: "btn", html: icon("download") + " Export CSV", onclick: exportCsv }) : null
    ]);
    bar1.children[0].appendChild(search);
    var bar2 = h("div", { class: "toolbar" }, [typeSel, catSel, methodSel, h("span", { class: "muted", style: "font-size:13px" }, ["From"]), from, h("span", { class: "muted", style: "font-size:13px" }, ["To"]), to, delChk]);
    tb.appendChild(bar1); tb.appendChild(bar2);
    var tableCard = h("div", { class: "card" }); var tbody = h("div", { id: "tx-table" }); tableCard.appendChild(tbody); tb.appendChild(tableCard);
    var pager = h("div", { class: "pager", id: "tx-pager" }); tb.appendChild(pager);
    v.appendChild(tb);

    function load() {
      tbody.innerHTML = ""; loader(tbody);
      API.swr("listTransactions", { filters: txState }, function (r) {
        tbody.innerHTML = "";
        if (!r.ok) { tbody.appendChild(errorCard(r.error)); return; }
        txState.rows = r.rows; txState.total = r.total;
        tbody.appendChild(txTable(r.rows, {}));
        renderPager(pager, r, function (p) { txState.page = p; load(); });
      });
    }
    load();
    function exportCsv() {
      API.call("listTransactions", { filters: Object.assign({}, txState, { page: 1, pageSize: 100000 }) }).then(function (r) {
        if (!r.ok) return toast(r.error, "err");
        downloadCsv(r.rows);
        toast(r.rows.length + " rows exported", "ok");
      });
    }
  };

  function txTable(rows, opts) {
    opts = opts || {};
    if (!rows || !rows.length) return h("div", { class: "empty", html: icon("inbox") + "<div>No transactions found</div>" });
    var cols = [
      { k: "expenseDate", t: "Date" }, { k: "id", t: "ID" }, { k: "type", t: "Type" },
      { k: "category", t: "Category" }, { k: "employee", t: "Party" }, { k: "method", t: "Method" },
      { k: "amount", t: "Amount", right: true }, { k: "purpose", t: "Purpose" }
    ];
    var table = h("table", { class: "data" });
    var thead = h("tr", {});
    cols.forEach(function (c) { thead.appendChild(h("th", { class: (txState.sortKey === c.k ? "sorted " : "") + (c.right ? "right" : ""), html: c.t + '<span class="sort">' + (txState.sortKey === c.k ? (txState.sortDir > 0 ? "▲" : "▼") : "↕") + "</span>", onclick: function () { sortBy(c.k); } })); });
    if (!opts.compact) thead.appendChild(h("th", { class: "right" }, [""]));
    table.appendChild(h("thead", {}, [thead]));
    var tb = h("tbody", {});
    rows.forEach(function (r) {
      var isDel = r.recordStatus === "Deleted";
      var tr = h("tr", { class: isDel ? "deleted" : "" });
      tr.appendChild(h("td", { class: "nowrap" }, [r.expenseDate || ""]));
      tr.appendChild(h("td", { class: "mono", style: "font-size:12px;color:var(--ink-3)" }, [r.id]));
      tr.appendChild(h("td", {}, [typeBadge(r.type)]));
      tr.appendChild(h("td", {}, [r.category || ""]));
      tr.appendChild(h("td", {}, [r.employee || r.recvBy || "—"]));
      tr.appendChild(h("td", {}, [methodBadge(r.method)]));
      var out = String(r.type).toUpperCase() === "PAYMENT PAID";
      tr.appendChild(h("td", { class: "right" }, [h("span", { class: "amt " + (out ? "out" : "in") }, [(out ? "" : "+") + money0(r.amount)])]));
      tr.appendChild(h("td", { class: "muted", style: "max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap", title: r.purpose || "" }, [r.purpose || (isDel ? "🗑 " + (r.deleteReason || "deleted") : "")]));
      if (!opts.compact) {
        var acts = h("td", { class: "right" });
        var wrap = h("div", { class: "row-actions", style: "justify-content:flex-end" });
        if (isDel) { if (can("del")) wrap.appendChild(h("button", { class: "icon-btn", title: "Restore", html: icon("undo"), onclick: function () { restoreTx(r); } })); }
        else {
          if (can("edit")) wrap.appendChild(h("button", { class: "icon-btn", title: "Edit", html: icon("edit"), onclick: function () { openTxForm(r); } }));
          if (can("del")) wrap.appendChild(h("button", { class: "icon-btn", title: "Delete", html: icon("trash"), onclick: function () { deleteTx(r); } }));
        }
        acts.appendChild(wrap); tr.appendChild(acts);
      }
      tr.addEventListener("click", function (e) { if (e.target.closest(".row-actions")) return; showTxDetail(r); });
      tr.style.cursor = "pointer";
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    return h("div", { class: "table-wrap" }, [table]);
  }
  function sortBy(k) {
    if (txState.sortKey === k) txState.sortDir *= -1; else { txState.sortKey = k; txState.sortDir = 1; }
    var rows = txState.rows.slice().sort(function (a, b) {
      var av = a[k], bv = b[k];
      if (k === "amount") { av = Number(av); bv = Number(bv); }
      else if (k === "expenseDate") { av = FMT.dmyToDate(av) || 0; bv = FMT.dmyToDate(bv) || 0; }
      else if (k === "timestamp") { av = FMT.parseTs(av) || 0; bv = FMT.parseTs(bv) || 0; }
      else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
      return (av < bv ? -1 : av > bv ? 1 : 0) * txState.sortDir;
    });
    var tbody = el("tx-table"); if (tbody) { tbody.innerHTML = ""; tbody.appendChild(txTable(rows, {})); }
  }
  function typeBadge(t) { t = String(t).toUpperCase(); var cls = t === "PAYMENT RECV" ? "recv" : t === "RECV FROM EMPLOYEE" ? "emp" : "paid"; var lbl = t === "PAYMENT PAID" ? "Paid" : t === "PAYMENT RECV" ? "Received" : "Emp. Return"; return h("span", { class: "badge " + cls }, [lbl]); }
  function methodBadge(m) { m = String(m).toUpperCase(); return h("span", { class: "badge " + (m === "CASH" ? "cash" : "online") }, [m === "CASH" ? "Cash" : "Online"]); }

  function showTxDetail(r) {
    var rows = [
      ["Transaction ID", r.id], ["Timestamp", r.timestamp], ["Expense Date", r.expenseDate],
      ["Type", r.type], ["Category", r.category], ["Customer", r.customer || "—"],
      ["Party / Employee", r.employee || "—"], ["Received By", r.recvBy || "—"],
      ["Payment Method", r.method], ["Amount", money0(r.amount)], ["Approved By", r.approvedBy || "—"],
      ["Purpose / Remarks", r.purpose || "—"], ["Status", r.status], ["Entered By", r.enteredBy || "—"],
      ["Record Status", r.recordStatus]
    ];
    if (r.recordStatus === "Deleted") rows.push(["Deleted By", r.deletedBy || "—"], ["Delete Reason", r.deleteReason || "—"]);
    var body = h("div", {});
    rows.forEach(function (p) { body.appendChild(h("div", { class: "row", style: "padding:7px 0;border-bottom:1px solid var(--border);gap:16px" }, [h("div", { class: "muted", style: "width:150px;flex:none;font-size:13px" }, [p[0]]), h("div", { style: "font-weight:550", class: p[0] === "Amount" ? "amt" : "" }, [String(p[1])])])); });
    [["Bill Amount proof", r.billProof], ["Payment Amount proof", r.refProof]].forEach(function (pp) {
      if (pp[1]) body.appendChild(h("div", { style: "margin-top:12px" }, [h("div", { class: "muted", style: "font-size:13px;margin-bottom:4px" }, [pp[0]]), h("div", { class: "mono", style: "font-size:12px;word-break:break-all;color:var(--primary)" }, [pp[1]])]));
    });
    var foot = [];
    if (can("edit") && r.recordStatus !== "Deleted") foot.push(h("button", { class: "btn primary", html: icon("edit") + " Edit", onclick: function () { mo.close(); openTxForm(r); } }));
    foot.push(h("button", { class: "btn ghost", onclick: function () { mo.close(); } }, ["Close"]));
    var mo = modal({ title: "Transaction " + r.id, body: body, footer: foot });
  }

  function restoreTx(r) { confirmBox("Restore transaction", "Restore " + r.id + " back to active?", function () { API.call("restoreTransaction", { id: r.id }).then(function (res) { if (res.ok) { toast("Restored " + r.id, "ok"); go("transactions"); } else toast(res.error, "err"); }); }); }
  function deleteTx(r) {
    var reason = h("input", { class: "input", placeholder: "Reason (optional)" });
    var mo = modal({ size: "sm", title: "Delete transaction", body: h("div", {}, [h("p", { class: "muted" }, ["Soft-delete " + r.id + " (" + money0(r.amount) + ")? It can be restored later."]), h("div", { class: "field" }, [h("label", {}, ["Reason"]), reason])]), footer: [h("button", { class: "btn ghost", onclick: function () { mo.close(); } }, ["Cancel"]), h("button", { class: "btn danger", html: icon("trash") + " Delete", onclick: function () { API.call("deleteTransaction", { id: r.id, reason: reason.value }).then(function (res) { mo.close(); if (res.ok) { toast("Deleted " + r.id, "ok"); go("transactions"); } else toast(res.error, "err"); }); } })] });
  }

  /* ----- Add / Edit form ----- */
  Views.add = function (v) { v.appendChild(txFormNode(null)); };
  function openTxForm(r) {
    var mo = modal({ title: r ? "Edit " + r.id : "New transaction", size: "", body: txFormNode(r, function () { mo.close(); go("transactions"); }) });
  }
  function txFormNode(existing, onDone) {
    var b = Store.boot;
    var card = h("div", { class: "card pad", style: "max-width:720px" });
    var f = {};
    function field(label, node, req, hint) { var d = h("div", { class: "field" }, [h("label", { html: esc(label) + (req ? ' <span class="req">*</span>' : "") }), node, hint ? h("div", { class: "hint" }, [hint]) : null]); return d; }
    var today = new Date().toISOString().slice(0, 10);
    f.type = selectFrom(b.txTypes, existing ? existing.type : "PAYMENT PAID");
    f.date = h("input", { class: "input", type: "date", value: existing ? (FMT.isoToDMY(existing.expenseDate).split("/").reverse().join("-")) : today });
    f.category = selectFrom((b.categories || []).map(function (c) { return c.name; }), existing ? existing.category : "");
    f.customer = h("input", { class: "input", placeholder: "Customer name", value: existing ? existing.customer || "" : "" });
    f.employee = h("input", { class: "input", placeholder: "Employee / payee name", value: existing ? existing.employee || "" : "", autocomplete: "off" });
    f.recvBy = selectFrom([""].concat((b.receivers || []).map(function (r) { return r.name; })), existing ? existing.recvBy || "" : "", "Select receiver");
    f.method = selectFrom(b.paymentMethods, existing ? existing.method : "ONLINE TRANSACTION");
    f.amount = h("input", { class: "input", type: "number", step: "0.01", min: "0", placeholder: "0.00", value: existing ? existing.amount : "" });
    f.approvedBy = selectFrom([""].concat((b.approvers || []).map(function (a) { return a.name; })), existing ? existing.approvedBy || "" : "", "Approved by");
    f.purpose = h("textarea", { class: "input", rows: "2", placeholder: "What is this for?" }); f.purpose.value = existing ? existing.purpose || "" : "";
    f.billProof = proofPicker(existing ? existing.billProof : "");
    f.payProof = proofPicker(existing ? existing.refProof : "");
    // 1. automatic, read-only timestamp (server stamps the real value on save)
    f.timestamp = h("input", { class: "input", type: "text", readonly: "readonly", tabindex: "-1", style: "background:var(--bg-2,#f1efea);cursor:not-allowed" });
    function nowStamp() { var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; }; return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()); }
    if (existing) f.timestamp.value = existing.timestamp || "";
    else {
      f.timestamp.value = nowStamp();
      var tsShown = false, tsTimer = setInterval(function () {
        if (f.timestamp.isConnected) tsShown = true;
        else if (tsShown) { clearInterval(tsTimer); return; } // form closed
        f.timestamp.value = nowStamp();
      }, 1000);
    }

    var grid = h("div", { class: "form-grid" });
    var customerField = field("Customer Name", f.customer, false);
    var recvField = field("Amount Received By", f.recvBy, false, "Who received the money");
    var empField = field("Employee / Payee", f.employee, false);
    var tsField = field("Timestamp", f.timestamp, false, existing ? "Recorded when the entry was created" : "Set automatically when you save"); tsField.className = "field full";
    grid.appendChild(tsField);
    grid.appendChild(field("Type of Transaction", f.type, true));
    grid.appendChild(field("Expense Date", f.date, true));
    grid.appendChild(field("Expense Category", f.category, true));
    grid.appendChild(customerField);
    grid.appendChild(empField);
    grid.appendChild(recvField);
    grid.appendChild(field("Payment Method", f.method, true));
    grid.appendChild(field("Amount (" + CUR + ")", f.amount, true));
    grid.appendChild(field("Approved By", f.approvedBy, false));
    var proofRow = h("div", { class: "full form-grid" });
    proofRow.appendChild(field("Bill Amount", f.billProof.node, false, "Bill proof — take a photo or pick from gallery"));
    proofRow.appendChild(field("Payment Amount", f.payProof.node, true, "Payment proof — take a photo or pick from gallery"));
    grid.appendChild(proofRow);
    var purposeF = field("Purpose / Remarks", f.purpose, true); purposeF.className = "field full";
    grid.appendChild(purposeF);

    // dynamic: show customer only when category needs it; show recvBy for PAYMENT RECV
    function refresh() {
      var cat = (b.categories || []).filter(function (c) { return c.name === f.category.value; })[0];
      var needsCust = cat && cat.needsCustomer;
      customerField.style.display = needsCust ? "" : "none";
      customerField.querySelector("label").innerHTML = "Customer Name <span class='req'>*</span>";
      var isRecv = f.type.value === "PAYMENT RECV";
      recvField.style.display = isRecv ? "" : "none";
      empField.style.display = isRecv ? "none" : "";
    }
    f.type.addEventListener("change", refresh); f.category.addEventListener("change", refresh); refresh();

    var errEl = h("div", { class: "err-text", style: "min-height:18px" });
    var warnEl = h("div", {});
    var saveBtn = h("button", { class: "btn primary", html: icon("check") + (existing ? " Save changes" : " Create entry") });

    function collect() {
      return { expenseDate: f.date.value, type: f.type.value, recvBy: f.recvBy.value, category: f.category.value, customer: f.customer.value, employee: f.employee.value, method: f.method.value, amount: f.amount.value, approvedBy: f.approvedBy.value, purpose: f.purpose.value, billProof: existing ? existing.billProof || "" : "", refProof: existing ? existing.refProof || "" : "" };
    }
    function doSave(allowDup) {
      errEl.textContent = ""; saveBtn.disabled = true;
      var payload = collect();
      if (!f.payProof.file() && !payload.refProof) { errEl.textContent = "Payment Amount proof is required — take a photo or upload one"; saveBtn.disabled = false; return; }
      if (!String(payload.purpose || "").trim()) { errEl.textContent = "Purpose / Remarks is required"; saveBtn.disabled = false; f.purpose.focus(); return; }
      var chain = Promise.resolve();
      function upload(picker, key) {
        var file = picker.file();
        if (!file) return;
        if (API.isDemo()) { payload[key] = "Expense_Sheet_Images/" + file.name; return; }
        chain = chain.then(function () { return compressToBase64(file); })
          .then(function (b64) { var nm = (file.name || "photo").replace(/\.[^.]+$/, "") + (b64.mime === "image/jpeg" ? ".jpg" : (file.name.match(/\.[^.]+$/) || [".jpg"])[0]); return API.call("uploadProof", { base64: b64.data, mimeType: b64.mime, filename: nm }); })
          .then(function (up) { if (up && up.ok) payload[key] = up.path; else throw new Error((up && up.error) || "Proof upload failed"); });
      }
      upload(f.billProof, "billProof");
      upload(f.payProof, "refProof");
      chain.then(function () {
        var action = existing ? "updateTransaction" : "createTransaction";
        var args = existing ? { id: existing.id, tx: payload } : { tx: payload, options: { allowDuplicate: allowDup } };
        return API.call(action, args);
      }).then(function (res) {
        saveBtn.disabled = false;
        if (!res.ok) {
          if (res.code === "DUPLICATE") { confirmBox("Possible duplicate", res.error, function () { doSave(true); }); return; }
          errEl.textContent = res.error; return;
        }
        (res.warnings || []).forEach(function (w) { toast(w, "warn", "Heads up"); });
        toast(existing ? "Updated " + existing.id : "Saved " + res.id, "ok", "Done");
        if (onDone) onDone(); else { resetForm(); if (Store.view === "add") go("transactions"); }
      }).catch(function (e) { saveBtn.disabled = false; errEl.textContent = e.message || String(e); });
    }
    function resetForm() { [f.amount, f.purpose, f.customer].forEach(function (i) { i.value = ""; }); f.billProof.clear(); f.payProof.clear(); f.employee.value = ""; }
    saveBtn.addEventListener("click", function () { doSave(false); });

    card.appendChild(h("div", { class: "section-title" }, [h("div", {}, [h("h3", {}, [existing ? "Edit transaction" : "New transaction"]), h("div", { class: "sub" }, ["All validations run server-side before saving"])])]));
    card.appendChild(grid); card.appendChild(errEl);
    card.appendChild(h("div", { class: "row", style: "margin-top:10px" }, [saveBtn, onDone ? h("button", { class: "btn ghost", onclick: function () { onDone(); } }, ["Cancel"]) : null]));
    return card;
  }

  /* ----- Reports ----- */
  Views.reports = function (v) {
    var from = h("input", { class: "input", type: "date", style: "max-width:170px" });
    var to = h("input", { class: "input", type: "date", style: "max-width:170px" });
    var holder = h("div", {});
    var bar = h("div", { class: "toolbar" }, [h("span", { class: "muted" }, ["Range"]), from, h("span", { class: "muted" }, ["to"]), to, h("button", { class: "btn", onclick: run }, ["Apply"]), h("button", { class: "btn ghost", onclick: function () { from.value = ""; to.value = ""; run(); } }, ["All time"]), h("div", { class: "grow" }), can("export") ? h("button", { class: "btn", html: icon("download") + " Export filtered", onclick: function () { API.call("listTransactions", { filters: { from: from.value, to: to.value, page: 1, pageSize: 100000 } }).then(function (r) { if (r.ok) { downloadCsv(r.rows); toast(r.rows.length + " rows exported", "ok"); } }); } }) : null]);
    v.appendChild(bar); v.appendChild(holder);
    function run() {
      holder.innerHTML = ""; loader(holder);
      // reports uses the full dashboard (date filter applied client-side on category/month via listTransactions)
      Promise.all([API.call("dashboard", {}), API.call("listTransactions", { filters: { from: from.value, to: to.value, page: 1, pageSize: 100000 } })]).then(function (res) {
        var d = res[0], list = res[1]; holder.innerHTML = "";
        if (!d.ok) return holder.appendChild(errorCard(d.error));
        // recompute breakdown within range from list
        var byCat = {}, byMethod = {}, byEmp = {}, tin = 0, tout = 0;
        (list.rows || []).forEach(function (r) {
          if (r.recordStatus === "Deleted") return;
          var amt = Number(r.amount), t = String(r.type).toUpperCase();
          if (t === "PAYMENT PAID") { tout += amt; byCat[r.category || "Uncat"] = (byCat[r.category || "Uncat"] || 0) + amt; byMethod[String(r.method).toUpperCase()] = (byMethod[String(r.method).toUpperCase()] || 0) + amt; byEmp[r.employee || "—"] = (byEmp[r.employee || "—"] || 0) + amt; }
          else tin += amt;
        });
        function arr(o) { return Object.keys(o).map(function (k) { return { key: k, value: o[k] }; }).sort(function (a, b) { return b.value - a.value; }); }
        var kp = h("div", { class: "kpis" }, [
          kpi("Received (range)", money0(tin), "in", (list.rows || []).length + " records", "down"),
          kpi("Paid out (range)", money0(tout), "out", "", "up"),
          kpi("Net (range)", money0(tin - tout), (tin - tout) < 0 ? "critical" : "ok", "", "wallet"),
          kpi("Records", (list.total || (list.rows || []).length).toLocaleString("en-IN"), "", "in range", "list")
        ]);
        holder.appendChild(kp);
        var g = h("div", { class: "grid-2" }, [card("Cash flow by month", monthlyChart(d.byMonth, d.currency)), card("Category split", donutBlock(arr(byCat)))]);
        holder.appendChild(g);
        var g2 = h("div", { class: "grid-2", style: "margin-top:16px" }, [card("Spending by category", barsBlock(arr(byCat).slice(0, 10))), card("Top payees", barsBlock(arr(byEmp).slice(0, 10)))]);
        holder.appendChild(g2);
      });
    }
    run();
  };

  /* ----- Masters ----- */
  Views.masters = function (v) {
    var tabs = ["categories", "employees", "approvers", "receivers"];
    var labels = { categories: "Categories", employees: "Employees", approvers: "Approvers", receivers: "Receivers" };
    var active = "categories";
    var pills = h("div", { class: "pill-tabs" }); var holder = h("div", { style: "margin-top:14px" });
    tabs.forEach(function (t) { pills.appendChild(h("button", { class: t === active ? "active" : "", onclick: function () { active = t; render(); } }, [labels[t]])); });
    v.appendChild(h("div", { class: "section-title" }, [pills])); v.appendChild(holder);
    function render() {
      Array.prototype.forEach.call(pills.children, function (b) { b.classList.toggle("active", b.textContent === labels[active]); });
      holder.innerHTML = ""; loader(holder);
      API.swr("listMaster", { which: active }, function (r) {
        holder.innerHTML = "";
        if (!r.ok) return holder.appendChild(errorCard(r.error));
        var c = h("div", { class: "card" });
        c.appendChild(h("div", { class: "card-h" }, [h("h3", { class: "grow" }, [labels[active] + " (" + r.rows.length + ")"]), API.isDemo() ? h("span", { class: "muted", style: "font-size:12px" }, ["read-only in preview"]) : null]));
        var keys = r.rows.length ? Object.keys(r.rows[0]).filter(function (k) { return k !== "_row"; }) : [];
        var table = h("table", { class: "data" });
        table.appendChild(h("thead", {}, [h("tr", {}, keys.map(function (k) { return h("th", {}, [k]); }))]));
        var tb = h("tbody", {});
        r.rows.forEach(function (row) { tb.appendChild(h("tr", {}, keys.map(function (k) { var val = row[k]; if (val === true || String(val).toUpperCase() === "TRUE") return h("td", {}, [h("span", { class: "badge paid" }, ["Yes"])]); if (val === false || String(val).toUpperCase() === "FALSE") return h("td", {}, [h("span", { class: "badge cash" }, ["No"])]); return h("td", {}, [String(val == null ? "" : val)]); }))); });
        table.appendChild(tb); c.appendChild(h("div", { class: "table-wrap" }, [table])); holder.appendChild(c);
      });
    }
    render();
  };

  /* ----- Users ----- */
  var ROLE_PRESETS = {
    "Admin":      { add: 1, edit: 1, del: 1, approve: 1, export: 1, dashboard: 1, masters: 1 },
    "Approver":   { add: 1, edit: 1, del: 0, approve: 1, export: 1, dashboard: 1, masters: 0 },
    "Data Entry": { add: 1, edit: 1, del: 0, approve: 0, export: 1, dashboard: 1, masters: 0 },
    "Viewer":     { add: 0, edit: 0, del: 0, approve: 0, export: 1, dashboard: 1, masters: 0 }
  };
  var PERM_COLS = [["add", "Can Add"], ["edit", "Can Edit"], ["del", "Can Delete"], ["approve", "Can Approve"], ["export", "Can Export"], ["dashboard", "Can View Dashboard"], ["masters", "Can Manage Masters"]];
  function isTrue(v) { return v === true || String(v).toUpperCase() === "TRUE"; }
  Views.users = function (v) {
    loader(v);
    API.swr("listMaster", { which: "users" }, function (r) {
      v.innerHTML = "";
      if (!r.ok) return v.appendChild(errorCard(r.error));
      var c = h("div", { class: "card" });
      c.appendChild(h("div", { class: "card-h" }, [
        h("h3", { class: "grow" }, ["Users & permissions (" + r.rows.length + ")"]),
        h("button", { class: "btn primary sm", html: icon("plus") + " Add user", onclick: function () { userForm(null); } })
      ]));
      var table = h("table", { class: "data" });
      table.appendChild(h("thead", {}, [h("tr", {}, ["User ID", "Name", "Email", "Role", "Department", "Active"].concat(PERM_COLS.map(function (p) { return p[1].replace("Can ", ""); })).concat([""]).map(function (k) { return h("th", {}, [k]); }))]));
      var tb = h("tbody", {});
      function tick(val) { return h("td", {}, [h("span", { class: "badge " + (isTrue(val) ? "paid" : "cash") }, [isTrue(val) ? "✓" : "—"])]); }
      r.rows.forEach(function (row) {
        var me = Store.user && String(row["User ID"]) === String(Store.user.userId);
        var actions = h("td", { class: "nowrap" }, [
          h("button", { class: "btn sm", html: icon("edit") + " Edit", onclick: function () { userForm(row); } }),
          " ",
          me ? h("span", { class: "muted", style: "font-size:12px" }, ["(you)"]) : h("button", { class: "btn sm danger", html: icon("trash") + " Remove", onclick: function () { removeUser(row); } })
        ]);
        tb.appendChild(h("tr", {}, [
          h("td", { class: "mono", style: "font-size:12px" }, [String(row["User ID"] || "")]),
          h("td", {}, [String(row.Name || "")]), h("td", {}, [String(row.Email || "")]),
          h("td", {}, [h("span", { class: "badge online" }, [String(row.Role || "—")])]), h("td", {}, [String(row.Department || "")]),
          tick(row.Active)
        ].concat(PERM_COLS.map(function (p) { return tick(row[p[1]]); })).concat([actions])));
      });
      table.appendChild(tb); c.appendChild(h("div", { class: "table-wrap" }, [table]));
      v.appendChild(c);
      v.appendChild(h("p", { class: "hint", style: "margin-top:10px" }, ["Choosing a role fills in its permissions; you can still tick/untick each one. Permission changes apply the next time that user signs in. Passwords are stored hashed and never shown."]));
    });
  };
  function removeUser(row) {
    confirmBox("Remove user", "Remove " + (row.Name || row.Email) + " (" + row.Email + ")? They will no longer be able to sign in.", function () {
      API.call("deleteUser", { userId: row["User ID"] }).then(function (res) {
        if (res.ok) { toast("Removed " + (row.Name || row.Email), "ok"); go("users"); } else toast(res.error, "err");
      });
    }, true);
  }
  function userForm(row) {
    var isNew = !row; row = row || {};
    function field(label, node, req, hint) { return h("div", { class: "field" }, [h("label", { html: esc(label) + (req ? ' <span class="req">*</span>' : "") }), node, hint ? h("div", { class: "hint" }, [hint]) : null]); }
    var name = h("input", { class: "input", value: row.Name || "", placeholder: "Full name" });
    var email = h("input", { class: "input", type: "email", value: row.Email || "", placeholder: "name@oakcraft.in", autocomplete: "off" });
    var mobile = h("input", { class: "input", value: row.Mobile || "", placeholder: "Mobile" });
    var dept = h("input", { class: "input", value: row.Department || "", placeholder: "Department" });
    var roles = Object.keys(ROLE_PRESETS);
    if (row.Role && roles.indexOf(row.Role) === -1) roles.push(row.Role);
    var role = selectFrom(roles, row.Role || "Data Entry");
    var pwd = h("input", { class: "input", type: "password", placeholder: isNew ? "Set a password" : "Leave blank to keep current", autocomplete: "new-password" });
    function chk(checked) { var i = h("input", { type: "checkbox", style: "width:18px;height:18px;accent-color:var(--primary)" }); i.checked = !!checked; return i; }
    var active = chk(isNew ? true : isTrue(row.Active));
    var boxes = {};
    var permGrid = h("div", { class: "form-grid", style: "gap:8px 18px" });
    PERM_COLS.forEach(function (p) {
      boxes[p[0]] = chk(isNew ? ROLE_PRESETS["Data Entry"][p[0]] : isTrue(row[p[1]]));
      permGrid.appendChild(h("label", { class: "row", style: "gap:8px;align-items:center;font-size:14px;cursor:pointer" }, [boxes[p[0]], p[1]]));
    });
    role.addEventListener("change", function () { var pr = ROLE_PRESETS[role.value]; if (pr) PERM_COLS.forEach(function (p) { boxes[p[0]].checked = !!pr[p[0]]; }); });
    var grid = h("div", { class: "form-grid" }, [
      field("Name", name, true), field("Email (login)", email, true),
      field("Role", role, true), field("Department", dept, false),
      field("Mobile", mobile, false), field(isNew ? "Password" : "New password", pwd, isNew)
    ]);
    var errEl = h("div", { class: "err-text", style: "min-height:18px" });
    var body = h("div", {}, [grid,
      h("label", { class: "row", style: "gap:8px;align-items:center;margin:4px 0 14px;font-weight:600;cursor:pointer" }, [active, "Active (can sign in)"]),
      h("div", { style: "font-weight:600;margin-bottom:8px" }, ["Permissions"]), permGrid, errEl]);
    var saveB = h("button", { class: "btn primary", html: icon("check") + (isNew ? " Add user" : " Save changes") });
    var mo = modal({ title: isNew ? "Add user" : "Edit " + (row.Name || row.Email), body: body, footer: [h("button", { class: "btn ghost", onclick: function () { mo.close(); } }, ["Cancel"]), saveB] });
    saveB.addEventListener("click", function () {
      errEl.textContent = "";
      if (!name.value.trim()) { errEl.textContent = "Name is required"; return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) { errEl.textContent = "Enter a valid email"; return; }
      if (isNew && pwd.value.length < 6) { errEl.textContent = "Password must be at least 6 characters"; return; }
      if (!isNew && pwd.value && pwd.value.length < 6) { errEl.textContent = "New password must be at least 6 characters"; return; }
      var u = { Name: name.value.trim(), Email: email.value.trim(), Mobile: mobile.value.trim(), Role: role.value, Department: dept.value.trim(), Active: active.checked };
      PERM_COLS.forEach(function (p) { u[p[1]] = boxes[p[0]].checked; });
      if (!isNew) u["User ID"] = row["User ID"];
      saveB.disabled = true;
      API.call("saveUser", { user: u, newPassword: pwd.value || "" }).then(function (res) {
        saveB.disabled = false;
        if (!res.ok) { errEl.textContent = res.error || "Could not save"; return; }
        toast(isNew ? "User added" : "User updated", "ok"); mo.close(); go("users");
      });
    });
  }

  /* ----- Audit ----- */
  Views.audit = function (v) {
    loader(v);
    API.swr("listAudit", { limit: 300 }, function (r) {
      v.innerHTML = "";
      if (!r.ok) return v.appendChild(errorCard(r.error));
      var c = h("div", { class: "card" });
      c.appendChild(h("div", { class: "card-h" }, [h("h3", { class: "grow" }, ["Audit log — last " + r.rows.length + " actions"])]));
      if (!r.rows.length) { c.appendChild(h("div", { class: "empty muted" }, ["No audit entries yet"])); v.appendChild(c); return; }
      var table = h("table", { class: "data" });
      table.appendChild(h("thead", {}, [h("tr", {}, ["When", "User", "Action", "Entity", "Record", "Details", "Source"].map(function (k) { return h("th", {}, [k]); }))]));
      var tb = h("tbody", {});
      r.rows.forEach(function (row) {
        var atD = row.At ? new Date(row.At) : null; if (atD && isNaN(atD.getTime())) atD = FMT.parseTs(row.At);
        var when = atD ? atD.toLocaleString("en-IN") : (row.At || "");
        tb.appendChild(h("tr", {}, [
          h("td", { class: "nowrap", style: "font-size:12px" }, [when]),
          h("td", {}, [row["User Name"] || row["User Email"] || ""]),
          h("td", {}, [h("span", { class: "badge " + actionCls(row.Action) }, [row.Action || ""])]),
          h("td", {}, [row.Entity || ""]), h("td", { class: "mono", style: "font-size:12px" }, [row["Record ID"] || ""]),
          h("td", { class: "muted" }, [row.Details || ""]), h("td", { class: "muted", style: "font-size:12px" }, [row.Source || ""])
        ]));
      });
      table.appendChild(tb); c.appendChild(h("div", { class: "table-wrap" }, [table])); v.appendChild(c);
    });
  };
  function actionCls(a) { a = String(a).toUpperCase(); if (a === "DELETE") return "deleted"; if (a === "CREATE") return "paid"; if (a === "LOGIN") return "online"; return "cash"; }

  /* ----- Settings ----- */
  Views.settings = function (v) {
    loader(v);
    API.call("bootstrap", {}).then(function (b) {
      v.innerHTML = "";
      var S = b.settings || {};
      var groups = {};
      var meta = settingsMeta();
      Object.keys(S).forEach(function (k) { var g = (meta[k] && meta[k].group) || "Other"; (groups[g] = groups[g] || []).push(k); });
      Object.keys(groups).forEach(function (g) {
        var c = h("div", { class: "card", style: "margin-bottom:16px" });
        c.appendChild(h("div", { class: "card-h" }, [h("h3", {}, [g])]));
        var body = h("div", { class: "card-b" });
        groups[g].forEach(function (k) {
          var m = meta[k] || {}; var input;
          if (m.type === "bool") { input = h("label", { class: "switch" }, [h("input", { type: "checkbox" }), "Enabled"]); if (FMT.truthy(S[k])) input.firstChild.checked = true; }
          else input = h("input", { class: "input", value: S[k] == null ? "" : S[k], style: "max-width:260px" });
          var saveB = h("button", { class: "btn sm", html: "Save", onclick: function () {
            var val = m.type === "bool" ? (input.firstChild.checked ? "TRUE" : "FALSE") : input.value;
            API.call("saveSetting", { key: k, value: val }).then(function (res) { toast(res.ok ? "Saved " + k : res.error, res.ok ? "ok" : "err"); });
          } });
          if (!can("masters")) saveB.disabled = true;
          body.appendChild(h("div", { style: "display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid var(--border)" }, [
            h("div", {}, [h("div", { style: "font-weight:600;font-size:13.5px" }, [k]), h("div", { class: "muted", style: "font-size:12.5px" }, [m.desc || ""])]),
            input, saveB
          ]));
        });
        c.appendChild(body); v.appendChild(c);
      });
      v.appendChild(h("div", { class: "card pad" }, [h("div", { class: "row wrap", style: "gap:18px" }, [
        h("div", { class: "grow" }, [h("div", { style: "font-weight:600" }, ["Backend"]), h("div", { class: "muted", style: "font-size:13px" }, [API.isDemo() ? "Preview mode — not connected to Google Sheets" : "Live — connected to Apps Script"])]),
        h("div", { class: "badge " + (API.isDemo() ? "emp" : "paid") }, [API.isDemo() ? "DEMO" : "LIVE"]),
        h("div", { class: "muted mono", style: "font-size:12px" }, ["v" + (cfg.APP_VERSION || "1.0.0")])
      ])]));
    });
  };
  function settingsMeta() {
    return {
      ORG_NAME: { group: "General", desc: "Name shown in headers and exports" },
      CURRENCY_SYMBOL: { group: "General", desc: "Currency symbol across the UI" },
      FY_START_MONTH: { group: "General", desc: "Financial year start month (4 = April)" },
      AUTO_REFRESH_SEC: { group: "General", desc: "Dashboard auto-refresh seconds (0 = off)" },
      LEDGER_SOURCE: { group: "General", desc: "Provenance of the ledger data" },
      SESSION_DAYS: { group: "General", desc: "Days a login stays remembered" },
      OPENING_BALANCE: { group: "Finance", desc: "Cash in hand before the first entry" },
      OPENING_BALANCE_DATE: { group: "Finance", desc: "Date the opening balance applies from" },
      CASH_CRITICAL_BELOW: { group: "Finance", desc: "Cash below this is flagged critical (red)" },
      CASH_WARNING_BELOW: { group: "Finance", desc: "Cash below this is flagged warning (amber)" },
      HIGH_VALUE_THRESHOLD: { group: "Finance", desc: "Single txn at/above this is high-value" },
      SPIKE_MULTIPLIER: { group: "Finance", desc: "Daily spend above this × 30-day avg is unusual" },
      REQUIRE_PROOF_ONLINE: { group: "Controls", type: "bool", desc: "Proof mandatory for ONLINE entries" },
      REQUIRE_PROOF_CASH_ABOVE: { group: "Controls", desc: "Cash at/above this needs proof (0 = off)" },
      ALLOW_BACKDATE_DAYS: { group: "Controls", desc: "How many days back an entry may be dated" },
      ALLOW_FUTURE_DAYS: { group: "Controls", desc: "How many days ahead an entry may be dated" },
      DUPLICATE_WINDOW_MIN: { group: "Controls", desc: "Identical entry within N minutes = duplicate" },
      MONTH_LOCK_BEFORE: { group: "Controls", desc: "Entries on/before this date are locked" },
      SHEET_SYNC_SEC: { group: "Sync", desc: "How often the server re-reads the sheet" }
    };
  }

  /* ---------------- shared widgets ---------------- */
  function selectFrom(opts, val, placeholder) {
    var s = h("select", { class: "select" });
    if (placeholder) s.appendChild(h("option", { value: "" }, [placeholder]));
    opts.forEach(function (o) { if (o === "" && placeholder) return; s.appendChild(h("option", { value: o }, [o === "" ? "—" : o])); });
    if (val != null) s.value = val; return s;
  }
  function inputList(opts, val, placeholder) {
    var id = "dl-" + Math.random().toString(36).slice(2, 8);
    var inp = h("input", { class: "input", list: id, placeholder: placeholder || "", value: val || "", autocomplete: "off" });
    var dl = h("datalist", { id: id }); opts.slice(0, 500).forEach(function (o) { dl.appendChild(h("option", { value: o })); });
    document.body.appendChild(dl); // datalist just needs to exist in the DOM with a matching id
    return inp; // a real <input>, so .value and events work directly
  }
  function renderPager(container, r, onPage) {
    container.innerHTML = "";
    var pages = Math.max(1, Math.ceil(r.total / r.pageSize));
    container.appendChild(h("div", { class: "pginfo" }, ["Showing " + (r.rows.length ? ((r.page - 1) * r.pageSize + 1) : 0) + "–" + ((r.page - 1) * r.pageSize + r.rows.length) + " of " + r.total.toLocaleString("en-IN")]));
    var nav = h("div", { class: "row", style: "gap:6px" });
    nav.appendChild(h("button", { class: "btn sm", disabled: r.page <= 1 ? "" : null, onclick: function () { onPage(r.page - 1); } }, ["‹ Prev"]));
    nav.appendChild(h("span", { class: "muted", style: "font-size:13px;padding:0 6px" }, ["Page " + r.page + " / " + pages]));
    nav.appendChild(h("button", { class: "btn sm", disabled: r.page >= pages ? "" : null, onclick: function () { onPage(r.page + 1); } }, ["Next ›"]));
    container.appendChild(nav);
  }

  /* ---------------- utils ---------------- */
  function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }
  /* Proof picker: "Camera" opens the camera directly, "Gallery" picks an existing photo/file. */
  function proofPicker(currentPath) {
    var chosen = null;
    function mkInput(capture) {
      var i = h("input", { type: "file", accept: "image/*", style: "display:none" });
      if (capture) i.setAttribute("capture", "environment");
      i.addEventListener("change", function () { if (i.files && i.files[0]) set(i.files[0]); i.value = ""; });
      return i;
    }
    var cam = mkInput(true), gal = mkInput(false);
    var camB = h("button", { type: "button", class: "btn sm", html: "📷 Camera", onclick: function () { cam.click(); } });
    var galB = h("button", { type: "button", class: "btn sm", html: "🖼️ Gallery", onclick: function () { gal.click(); } });
    var info = h("div", { class: "muted", style: "font-size:12px;word-break:break-all;flex:1;min-width:0" }, [currentPath ? "Current: " + currentPath : "No photo yet"]);
    var thumb = h("img", { alt: "", style: "display:none;width:44px;height:44px;object-fit:cover;border-radius:8px;border:1px solid var(--border)" });
    var rm = h("button", { type: "button", class: "icon-btn", title: "Remove photo", style: "display:none", html: "✕", onclick: function () { set(null); } });
    var node = h("div", { class: "input", style: "display:flex;flex-direction:column;gap:8px;height:auto;padding:8px" }, [
      h("div", { class: "row", style: "gap:8px;flex-wrap:wrap" }, [camB, galB]),
      h("div", { class: "row", style: "gap:8px;align-items:center" }, [thumb, info, rm]),
      cam, gal
    ]);
    function set(file) {
      chosen = file;
      if (thumb.src) { try { URL.revokeObjectURL(thumb.src); } catch (e) {} }
      if (file) {
        thumb.src = URL.createObjectURL(file); thumb.style.display = "";
        info.textContent = (file.name || "photo.jpg") + " · " + Math.max(1, Math.round(file.size / 1024)) + " KB";
        rm.style.display = "";
      } else {
        thumb.removeAttribute("src"); thumb.style.display = "none"; rm.style.display = "none";
        info.textContent = currentPath ? "Current: " + currentPath : "No photo yet";
      }
    }
    return { node: node, file: function () { return chosen; }, clear: function () { set(null); } };
  }
  /* Shrink big camera photos (often 3–8 MB) to ~1600px JPEG before upload — much faster on mobile data. */
  function compressToBase64(file) {
    if (!/^image\//.test(file.type || "") || /gif|svg/.test(file.type) || file.size < 350 * 1024) return toBase64(file);
    return new Promise(function (res) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        try {
          var max = 1600, w = img.naturalWidth, hgt = img.naturalHeight, k = Math.min(1, max / Math.max(w, hgt));
          var c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(hgt * k);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          var dataUrl = c.toDataURL("image/jpeg", 0.8);
          res({ data: dataUrl.split(",")[1], mime: "image/jpeg" });
        } catch (e) { URL.revokeObjectURL(url); toBase64(file).then(res); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); toBase64(file).then(res); };
      img.src = url;
    });
  }
  function toBase64(file) { return new Promise(function (res) { var rd = new FileReader(); rd.onload = function () { var s = rd.result.split(","); res({ data: s[1], mime: (s[0].match(/:(.*?);/) || [])[1] || file.type }); }; rd.readAsDataURL(file); }); }
  function downloadCsv(rows) {
    var cols = ["id", "timestamp", "expenseDate", "type", "recvBy", "category", "customer", "employee", "method", "amount", "approvedBy", "purpose", "status", "enteredBy", "recordStatus"];
    var head = ["Transaction ID", "Timestamp", "Expense Date", "Type", "Amount Recv By", "Category", "Customer", "Employee", "Method", "Amount", "Approved By", "Purpose", "Status", "Entered By", "Record Status"];
    var lines = [head.join(",")];
    rows.forEach(function (r) { lines.push(cols.map(function (c) { var val = r[c] == null ? "" : String(r[c]); if (/[",\n]/.test(val)) val = '"' + val.replace(/"/g, '""') + '"'; return val; }).join(",")); });
    var blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var a = h("a", { href: URL.createObjectURL(blob), download: "oakcraft-transactions-" + new Date().toISOString().slice(0, 10) + ".csv" });
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ============================================================
     BOOT
     ============================================================ */
  function boot() {
    renderShell();
    var v = el("view");
    var cached = null; try { cached = JSON.parse(LS.get("oc_boot") || "null"); } catch (e) {}
    if (cached && cached.user && Store.user && cached.user.email === Store.user.email) {
      Store.boot = cached; go(Store.view || "dashboard"); // instant start from last session
    } else loader(v);
    API.call("bootstrap", {}).then(function (b) {
      if (!b.ok) {
        if (b.code === "AUTH") { API.clearCache(); LS.del("oc_boot"); Store.clear(); return renderLogin("Session expired. Please sign in again."); }
        if (!cached) { v.innerHTML = ""; v.appendChild(errorCard(b.error)); }
        return;
      }
      Store.boot = b; if (b.user) Store.user = b.user;
      try { LS.set("oc_boot", JSON.stringify(b)); } catch (e) {}
      if (!cached) go(Store.view || "dashboard");
    });
  }

  function start() {
    initTheme();
    if (Store.token && Store.user) boot();
    else renderLogin();
    // register service worker for PWA
    if ("serviceWorker" in navigator) { navigator.serviceWorker.register("sw.js").catch(function () {}); }
  }
  window.addEventListener("DOMContentLoaded", start);
})();
