// Offline support for the app's own files only. Supabase API calls (other origin) are never
// cached, so dashboards always show live data. Own files are network-first, so updates
// appear immediately when online and the cached copy is used when offline.
const CACHE_NAME = "lnct-campusone-v5";
const APP_SHELL = ["./", "./index.html", "./login.html", "./faculty.html", "./admin.html", "./reset.html",
  "./styles.css", "./config.js", "./auth.js", "./icons.js", "./app.js", "./timetable.js",
  "./login.js", "./student.js", "./faculty.js", "./admin.js", "./reset.js",
  "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if(event.request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request).then(response => {
      if(response.ok){ const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)); }
      return response;
    }).catch(() => caches.match(event.request, {ignoreSearch:true}).then(hit => hit || caches.match("./login.html")))
  );
});
