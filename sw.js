"use strict";

// Only public app files. Never cache form values, results, clipboard or APIs.
const VERSION = "3.7.0-7eab8df6128a";
const PREFIX = "medical-calculators::" + self.registration.scope + "::";
const CACHE = PREFIX + VERSION;
const SHELL = new URL("index.html", self.registration.scope).href;
const FILES = ["index.html", "assets/app-7a53f8f987.js", "assets/app-55c4c0f4b4.css", "assets/avatar-2fc3a937.jpg"]
  .map(path => new URL(path, self.registration.scope).href);

self.addEventListener("install", event => {
  // Installation is atomic. A failed download leaves the current worker active.
  // No automatic skipWaiting: a new version must not discard patient inputs.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(url => new Request(url, { cache: "reload" })))));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type !== "ACTIVATE_UPDATE" || !event.source?.url) return;
  const source = new URL(event.source.url);
  const scope = new URL(self.registration.scope);
  if (source.origin === scope.origin && source.pathname.startsWith(scope.pathname)) event.waitUntil(self.skipWaiting());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin) return;
  const isShell = event.request.mode === "navigate" && [scope.pathname, new URL(SHELL).pathname].includes(url.pathname);
  const key = isShell ? SHELL : url.origin + url.pathname;
  if (!isShell && !FILES.includes(key)) return;
  event.respondWith((async () => {
    const cached = await (await caches.open(CACHE)).match(key);
    // No runtime writes: query strings, navigation state and patient data never
    // become cache entries. External source links still require the internet.
    return cached || fetch(event.request);
  })());
});
