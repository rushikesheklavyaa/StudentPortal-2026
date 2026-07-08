/**
 * pwa-init.js
 * Registers the service worker and (optionally) surfaces an
 * "Update available" toast when a new version has been cached.
 * Safe to include on every page — silently does nothing on
 * browsers without service worker support.
 */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // A new version has been cached in the background.
            console.log('Eklavyaa Academy Portal: new version available — refresh to update.');
          }
        });
      });
    }).catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
