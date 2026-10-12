// Service worker for the hosted web app. The in-browser database (wa-sqlite) needs the page to be cross-origin isolated
// (COOP same-origin + COEP require-corp), and a static host such as GitHub Pages cannot send those headers, so this worker
// adds them to every response it serves. Everything the app loads is same-origin, so nothing is blocked by COEP.
// It also makes a refresh on an inner route (/Grimoire/app/homebrew) work: a static host answers that with its 404 page, so a
// navigation that gets a 404 is answered with the app's index.html instead and the router takes it from there.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

function withIsolationHeaders(response) {
  if (response.status === 0) return response;
  const headers = new Headers(response.headers);
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;
  event.respondWith(
    fetch(request).then(response => {
      if (request.mode === 'navigate' && response.status === 404) {
        const index = new URL('index.html', self.registration.scope).href;
        return fetch(index).then(withIsolationHeaders);
      }
      return withIsolationHeaders(response);
    }),
  );
});
