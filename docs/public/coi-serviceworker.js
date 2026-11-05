/*! coi-serviceworker v0.1.7 - Guido Zuidhof and contributors, licensed MIT */
/* Injects Cross-Origin-Opener-Policy: same-origin and
 * Cross-Origin-Embedder-Policy: require-corp on navigation + subresource
 * responses so SharedArrayBuffer works on static hosts (GitHub Pages) that
 * can't set response headers. The page reloads once on first activation. */
if (typeof window === 'undefined') {
  self.addEventListener('install', () => self.skipWaiting());

  self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

  self.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'deregister') {
      self.registration.unregister();
    }
  });

  self.addEventListener('fetch', function (event) {
    const r = event.request;
    if (r.cache === 'only-if-cached' && r.mode !== 'same-origin') return;

    const request = r.mode === 'no-cors'
      ? new Request(r, { credentials: 'same-origin' })
      : r;

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 0) return response;

          const newHeaders = new Headers(response.headers);
          newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
          newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        })
        .catch((e) => console.error(e))
    );
  });
} else {
  (() => {
    const reloadedBySelf = window.sessionStorage.getItem('coiReloadedBySelf');
    window.sessionStorage.removeItem('coiReloadedBySelf');
    const coepDegrading = reloadedBySelf === 'coepdegrade';

    // Already isolated — nothing to do (e.g. headers from the dev server).
    if (crossOriginIsolated) return;

    if (!window.isSecureContext) {
      console.log('COOP/COEP service worker requires a secure context (https/localhost).');
      return;
    }

    if (!navigator.serviceWorker) {
      console.log('No service worker support — SharedArrayBuffer unavailable.');
      return;
    }

    navigator.serviceWorker
      .register(new URL(import.meta?.url ?? document.currentScript.src))
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          console.log('COI: new service worker installing');
        });

        // If the worker is already controlling the page, isolation still
        // failed (no headers path) — nothing more to do.
        if (registration.active && !navigator.serviceWorker.controller) {
          // First activation: reload so the worker can inject headers.
          if (!reloadedBySelf) {
            window.sessionStorage.setItem('coiReloadedBySelf', 'true');
            window.location.reload();
          }
        } else if (registration.active && navigator.serviceWorker.controller && !crossOriginIsolated) {
          if (!reloadedBySelf) {
            window.sessionStorage.setItem('coiReloadedBySelf', 'true');
            window.location.reload();
          }
        }
      })
      .catch((e) => console.error('COI registration failed:', e));
  })();
}
