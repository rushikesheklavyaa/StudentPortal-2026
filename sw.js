/**
 * sw.js — Eklavyaa Academy Attendance Portal
 *
 * Strategy:
 * - App shell (HTML/CSS/JS/icons): cache-first, falls back to network,
 *   and refreshes the cache in the background on every successful fetch.
 * - Anything going to script.google.com (the Apps Script backend) is
 *   NEVER cached — attendance/marks/fees/notices must always be live.
 * - Navigations (typing the URL / opening from home screen) fall back
 *   to the cached page if there's no network at all.
 *
 * IMPORTANT: bump CACHE_VERSION every time you push new CSS/JS so
 * returning visitors actually get the update instead of a stale cache.
 */

const CACHE_VERSION = 'ea-portal-v1';

const APP_SHELL = [
  './',
  './index.html',
  './dashboard.html',
  './student.html',
  './manifest.json',
  './assets/css/style.css?v=2',
  './assets/css/components.css?v=2',
  './assets/css/dashboard.css?v=2',
  './assets/css/student.css?v=2',
  './assets/js/config.js?v=2',
  './assets/js/utils.js?v=2',
  './assets/js/api.js?v=2',
  './assets/js/login.js?v=2',
  './assets/js/dashboard.js?v=2',
  './assets/js/students.js?v=2',
  './assets/js/attendance.js?v=2',
  './assets/js/tests.js?v=2',
  './assets/js/fees.js?v=2',
  './assets/js/notices.js?v=2',
  './assets/js/student.js?v=2',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/img/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => {
      // If a single asset 404s during install, don't block the whole SW.
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache calls to the Apps Script backend — always hit network.
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Only handle same-origin GET requests for the app shell.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // offline: fall back to whatever we have cached

      return cached || networkFetch;
    })
  );
});
