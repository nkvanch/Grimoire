// Runs before the app. The first visit has no service worker yet, so the page is not cross-origin isolated: register the worker
// (coi-sw.js, next to this file) and reload once so the page is served through it. A flag stops this ever looping.
(function () {
  // A first visit straight to an inner route (a bookmark, a shared link) is answered by the site's 404 page, which stores the
  // path and sends the browser to the app's start. Put the path back before the app reads the address.
  try {
    var saved = sessionStorage.getItem('grimoire-deeplink');
    if (saved) {
      sessionStorage.removeItem('grimoire-deeplink');
      var base = new URL('./', document.currentScript.src).pathname;
      if (window.location.pathname === base && saved.indexOf(base) === 0) window.history.replaceState(null, '', saved);
    }
  } catch (e) { /* no storage: the app simply opens at its start */ }

  if (window.crossOriginIsolated) return;
  if (!('serviceWorker' in navigator)) {
    console.warn('Grimoire: this browser has no service workers, so the local database cannot start.');
    return;
  }
  var KEY = 'grimoire-coi-reload';
  var swUrl = new URL('coi-sw.js', document.currentScript.src).href;
  navigator.serviceWorker.register(swUrl).then(function (registration) {
    var reloadOnce = function () {
      try {
        if (sessionStorage.getItem(KEY)) return;
        sessionStorage.setItem(KEY, '1');
      } catch (e) { /* no storage: reload anyway, once per page load */ }
      window.location.reload();
    };
    if (registration.active && !navigator.serviceWorker.controller) { reloadOnce(); return; }
    registration.addEventListener('updatefound', function () {
      var worker = registration.installing;
      if (worker) worker.addEventListener('statechange', function () { if (worker.state === 'activated') reloadOnce(); });
    });
  }, function (error) { console.error('Grimoire: could not start the service worker', error); });
})();
