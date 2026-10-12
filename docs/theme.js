// Light / dark mode button for the Grimoire site. The choice is kept in this browser (localStorage); until it is made the page
// follows the system setting. The head of each page applies a saved choice before the page paints (see the inline script there).
(function () {
  var KEY = 'grimoire-theme';
  var root = document.documentElement;
  var button = document.getElementById('theme-toggle');
  if (!button) return;

  function systemDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function current() {
    var t = root.getAttribute('data-theme');
    return t === 'light' || t === 'dark' ? t : (systemDark() ? 'dark' : 'light');
  }
  function paint() {
    var dark = current() === 'dark';
    // The button names what a click will switch to.
    button.textContent = dark ? '\u2600\uFE0F Light' : '\uD83C\uDF19 Dark';
    button.setAttribute('aria-pressed', dark ? 'true' : 'false');
    button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  }
  button.addEventListener('click', function () {
    var next = current() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (e) { /* private mode: the choice lasts for this page only */ }
    paint();
  });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () { if (!root.getAttribute('data-theme')) paint(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
  }
  paint();
})();
