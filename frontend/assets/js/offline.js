/* Offline page: shown only when this page is not saved on the device AND the server cannot be reached.
   It checks the connection for real (navigator.onLine is unreliable in installed apps) and reopens the page by itself. */
(function () {
  var btn = document.getElementById('retry'), note = document.getElementById('offNote'), busy = false;
  function reachable() {
    var c = window.AbortController ? new AbortController() : null, t = c && setTimeout(function () { c.abort(); }, 6000);
    return fetch('version.json?_=' + Date.now(), { cache: 'no-store', signal: c ? c.signal : undefined }).then(function () { clearTimeout(t); return true; }, function () { clearTimeout(t); return false; });
  }
  function check(manual) {
    if (busy) return; busy = true;
    if (manual && btn) { btn.disabled = true; btn.textContent = 'Checking…'; }
    reachable().then(function (ok) {
      busy = false;
      if (ok) { location.reload(); return; }
      if (btn) { btn.disabled = false; btn.textContent = 'Try again'; }
      if (manual && note) note.textContent = 'Still no connection. We will open the page automatically as soon as it is back.';
    });
  }
  if (btn) btn.addEventListener('click', function () { check(true); });
  window.addEventListener('online', function () { check(false); });
  setInterval(function () { check(false); }, 5000);
  check(false);
})();
