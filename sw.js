/* ================================================================
   Bhojpuri Gym Beats — Service Worker
   Offline caching strategy:
   - App shell (HTML/CSS/JS/manifest/icons) → cache-first, so the
     site's structure, player UI, and last-loaded playlist screen
     open instantly even with zero/patchy gym network.
   - YouTube iframe/API and audio/video streaming are always fetched
     from network (can't be cached — that's YouTube's live stream),
     so playback itself still needs internet, but the site around it
     never shows a blank/broken page offline.
   ================================================================ */

const CACHE_NAME = 'gym-beats-shell-v1';

/* Files that make up the "shell" of the site (not the songs/streams) */
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './gym_clean_jpeg.png',
  './hero-1.webp',
  './hero-2.webp',
  './hero-3.webp',
  './hero-4.webp',
  './hero-5.webp',
  './hero-6.webp'
];

/* Install: pre-cache the shell. Ignore any single file that 404s
   so one missing image doesn't break the whole install. */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        SHELL_ASSETS.map((url) =>
          cache.add(url).catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

/* Activate: clear out old cache versions */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* Fetch strategy:
   - Never touch YouTube requests (iframe api, oembed, youtube.com,
     ytimg, googlevideo streams) — always go to network.
   - For everything same-origin (our shell files), try cache first,
     then fall back to network, and cache whatever network returns
     for next time.
   - For navigation requests (e.g. opening the site itself) when
     fully offline, fall back to the cached index.html so the app
     still opens instead of showing the browser's offline page. */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  const isYouTube =
    url.hostname.includes('youtube.com') ||
    url.hostname.includes('ytimg.com') ||
    url.hostname.includes('googlevideo.com') ||
    url.hostname.includes('ggpht.com');

  if (isYouTube || req.method !== 'GET') {
    return; // let the browser handle it normally (always network)
  }

  if (url.origin !== self.location.origin) {
    return; // don't try to cache other third-party/cross-origin stuff
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached || caches.match('./index.html'));
      return cached || network;
    })
  );
});
