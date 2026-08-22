/*
 * Sets the theme before the first paint so the page does not flash in the light
 * variant.
 *
 * It is a standalone file rather than an inline script in index.html: the
 * production CSP only allows `script-src 'self'`, so an inline script would be
 * blocked. Relaxing it with `unsafe-inline` for the sake of one line would mean
 * opening the door to genuine XSS as well.
 */
(function () {
  try {
    var stored = localStorage.getItem('gameshelf:theme');
    var dark = stored
      ? stored === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  } catch {
    // Storage disabled or private mode - the light theme stays.
  }
})();
