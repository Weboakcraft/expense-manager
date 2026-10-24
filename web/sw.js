/* Service worker — offline app shell for the PWA.
   Network-first for the app's own files, so every redeploy shows up right
   away; the cached copy is used only when the device is offline.
   Cross-origin requests (Apps Script API, fonts) pass straight through. */
var CACHE = "oakcraft-exp-v2";
var SHELL = [
  "./", "./index.html",
  "./css/styles.css",
  "./js/config.js", "./js/demo-data.js", "./js/api.js", "./js/app.js",
  "./manifest.json",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png"
];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return; // never cache POSTs / API writes
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) { return hit || caches.match("./index.html"); });
    })
  );
});
