/* Theme: light | dark | system. Loaded in <head> to avoid a flash of the wrong theme. */
(function () {
  var KEY = 'et_theme';
  function get() { try { return localStorage.getItem(KEY) || 'system'; } catch (e) { return 'system'; } }
  function resolve(p) { return p === 'system' ? (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : p; }
  function apply(p, animate) {
    var r = document.documentElement;
    if (animate) { r.classList.add('theme-anim'); setTimeout(function () { r.classList.remove('theme-anim'); }, 450); }
    r.setAttribute('data-theme', resolve(p)); r.setAttribute('data-theme-pref', p);
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = resolve(p) === 'dark' ? '#0a1220' : '#101828';
  }
  window.Theme = {
    get: get,
    set: function (p) { try { localStorage.setItem(KEY, p); } catch (e) {} apply(p, true); },
    cycle: function () { var o = ['light', 'dark', 'system'], n = o[(o.indexOf(get()) + 1) % 3]; this.set(n); return n; }
  };
  apply(get(), false);
  if (window.matchMedia) { var mq = matchMedia('(prefers-color-scheme: dark)'); var h = function () { if (get() === 'system') apply('system', true); }; mq.addEventListener ? mq.addEventListener('change', h) : mq.addListener(h); }
})();

/* Automatic updates: version.json holds one version number. It is checked live every time a page opens
   (and when the app returns to the foreground). When it changes, the saved copies are cleared and the page
   reloads by itself, so nobody has to refresh or clear browsing data. */
(function () {
  var VKEY = 'et_app_version';
  function typing() {
    var els = document.querySelectorAll('input, textarea');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (/^(hidden|file|button|submit)$/.test(el.type)) continue;
      if (el.type === 'checkbox' || el.type === 'radio') { if (el.checked !== el.defaultChecked) return true; }
      else if (el.value !== el.defaultValue) return true;
    }
    return false;
  }
  window.__etTyping = typing;
  function purge() {
    if (!('caches' in window)) return Promise.resolve();
    return caches.keys().then(function (k) { return Promise.all(k.map(function (n) { return caches.delete(n); })); }).catch(function () {});
  }
  function check() {
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) {
        if (!v || !v.version) return;
        var cur = null; try { cur = localStorage.getItem(VKEY); } catch (e) {}
        if (cur === v.version) return;
        try { localStorage.setItem(VKEY, v.version); } catch (e) {}
        if (cur === null) return; // first visit: just remember it
        purge().then(function () {
          if (window.__etReloading || typing()) return; // someone is typing: the new version loads on their next page
          window.__etReloading = true; location.reload();
        });
      }).catch(function () {});
  }
  check();
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); });
  setInterval(check, 5 * 60 * 1000);
})();
