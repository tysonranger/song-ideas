// Song Ideas offline cache. Bump VERSION when the app files change.
const VERSION = 'song-ideas-v6';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The page itself: try the internet for up to 3 seconds so updates show up straight away,
// otherwise (underground, no signal) open the copy saved on the phone.
// Everything else: serve from the phone first and refresh it quietly in the background.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate'){
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const timeout = new Promise((r) => setTimeout(() => r(null), 3000));
      const net = fetch(req, { cache: 'no-store' }).then((res) => { if (res && res.ok){ c.put('./index.html', res.clone()); return res; } return null; }).catch(() => null);
      const res = await Promise.race([net, timeout]);
      return res || (await c.match('./index.html')) || (await net) || new Response('Offline', { status: 503 });
    }));
    return;
  }
  const key = req;
  e.respondWith(
    caches.open(VERSION).then(async (c) => {
      const hit = await c.match(key, { ignoreSearch: true });
      const net = fetch(req).then((res) => {
        if (res && res.ok) c.put(key, res.clone());
        return res;
      }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      const res = await net;
      return res || new Response('Offline', { status: 503 });
    })
  );
});
