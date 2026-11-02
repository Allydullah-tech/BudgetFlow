/* PWA: service worker registration, install prompt, connection indicator, offline-queue sync. */
(function () {
  'use strict';
  var deferred = null, U = window.UI;
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    // When a new version takes over, reload once so the latest files show up automatically.
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || window.__etReloading) return;
      if (window.__etTyping && window.__etTyping()) return; // never lose a form someone is filling in
      window.__etReloading = true; window.location.reload();
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js', { updateViaCache: 'none' }).then(function (reg) {
        function check() { reg.update().catch(function () {}); }
        check();
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); });
        setInterval(check, 5 * 60 * 1000);
      }).catch(function () {});
    });
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; document.dispatchEvent(new CustomEvent('et:installable')); });
  window.addEventListener('appinstalled', function () { deferred = null; try { localStorage.setItem('et_installed', '1'); } catch (e) {} document.dispatchEvent(new CustomEvent('et:installed')); });
  function standalone() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

  function conn(msg, cls) { var c = document.querySelector('.conn'); if (c) c.remove(); if (!msg) return; c = document.createElement('div'); c.className = 'conn ' + cls; c.setAttribute('role', 'status'); c.innerHTML = U.icon(cls === 'offline' ? 'wifi-off' : 'wifi') + '<span>' + U.esc(msg) + '</span>'; document.body.appendChild(c); if (cls !== 'offline') setTimeout(function () { c.remove(); }, 3200); }
  async function sync(manual) {
    var n = window.Api && Api.queue.count(); if (!n) return;
    var r = await Api.queue.sync();
    if (r.synced) { U.toast(r.synced + ' offline entr' + (r.synced > 1 ? 'ies' : 'y') + ' synced.', 'success'); document.dispatchEvent(new CustomEvent('et:synced')); }
    if (r.failed) U.toast(r.failed + ' offline entr' + (r.failed > 1 ? 'ies were' : 'y was') + ' rejected by the server. Check Settings → Offline entries.', 'error');
  }

  /* Keep the account + category lists on this device so the expense/income form also opens when there is no connection. */
  async function prefetch(force) {
    try {
      if (!window.Api || !Api.isOnline()) return;
      var me = window.App && App.me; if (!me || me.offlineMode || me.role === 'super_admin') return;
      var old = JSON.parse(localStorage.getItem('et_lookups') || 'null');
      if (!force && old && old.at && Date.now() - old.at < 10 * 60 * 1000) return;
      var r = await Promise.all([Api.get('../api/accounts?active=1'), Api.get('../api/categories')]);
      localStorage.setItem('et_lookups', JSON.stringify({ accounts: r[0].data.items, categories: r[1].data.items, at: Date.now() }));
    } catch (e) { /* feature not on this plan, or offline: nothing to keep */ }
  }

  /* The "offline" banner is only shown when the server really cannot be reached (checked with a live request),
     never just because the browser says navigator.onLine === false. */
  var offlineShown = false, checking = false, pinger = null;
  function showOffline() {
    if (!offlineShown) { offlineShown = true; conn('You are offline. Expenses and income are saved on this device.', 'offline'); }
    if (!pinger) pinger = setInterval(recheck, 15000);
  }
  function hideOffline() {
    if (pinger) { clearInterval(pinger); pinger = null; }
    if (offlineShown) { offlineShown = false; conn('Back online', 'online'); }
  }
  async function recheck() {
    if (checking) return; checking = true;
    try {
      var ok = await Api.ping();
      if (ok) { hideOffline(); await sync(); if (!Api.isOnline()) showOffline(); else prefetch(); } else showOffline();
    } finally { checking = false; }
  }

  window.PWA = {
    canInstall: function () { return !!deferred; }, isStandalone: standalone, isIOS: isIOS,
    install: async function () { if (!deferred) return false; deferred.prompt(); var c = await deferred.userChoice; deferred = null; return c.outcome === 'accepted'; },
    sync: sync, recheck: recheck,
    initShell: function (App) {
      window.addEventListener('offline', function () { setTimeout(recheck, 800); });
      window.addEventListener('online', function () { recheck(); });
      // Any request that fails (or succeeds) updates the state; a failure is confirmed with a live check before the banner appears.
      Api.onNet(function (ok) { if (ok) { if (offlineShown) { hideOffline(); sync(); prefetch(); } } else recheck(); });
      document.addEventListener('visibilitychange', function () { if (document.hidden) return; if (offlineShown) recheck(); else sync(); });
      if (!navigator.onLine) recheck(); else { sync(); setTimeout(prefetch, 1500); }
      document.addEventListener('et:synced', function () { prefetch(true); });
    }
  };
})();
