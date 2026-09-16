/* 飯盆 service worker — 由 sync-pwa.sh 產生，請勿手動編輯 */
const BUILD   = "c1d54485cb";
const CORE    = "fanpen-core-" + BUILD;
const RUNTIME = "fanpen-runtime";
const ASSETS  = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png",
  "./icons/icon-512-maskable.png", "./icons/apple-touch-icon-180.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CORE).then(c => c.addAll(ASSETS)));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => k.startsWith("fanpen-core-") && k !== CORE)
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", e => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

/* 網路優先但有 3 秒逾時，網路慢或離線就吃快取 */
async function networkFirst(req, cacheName, timeout) {
  const cache = await caches.open(cacheName);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), timeout))
    ]);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req) || await cache.match("./index.html");
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) {
    /* 背景默默更新，下次開就是新的 */
    fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); }).catch(() => {});
    return hit;
  }
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate") {
    e.respondWith(networkFirst(req, CORE, 3000));
    return;
  }
  if (url.origin === self.location.origin) {
    e.respondWith(cacheFirst(req, CORE));
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(cacheFirst(req, RUNTIME));
  }
});
