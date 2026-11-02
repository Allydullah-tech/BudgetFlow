/* App shell: auth guard, navigation, banners, notifications, feature gating, connection status. */
(function () {
  'use strict';
  var U = window.UI, html = U.html, $ = U.$;
  var NAV = [
    { g: 'Overview', items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'home', f: 'dashboard_basic' },
      { id: 'transactions', label: 'Transactions', icon: 'list', f: 'transactions' }] },
    { g: 'Money', items: [
      { id: 'income', label: 'Income', icon: 'arrow-down', f: 'income' },
      { id: 'expenses', label: 'Expenses', icon: 'arrow-up', f: 'expenses' },
      { id: 'accounts', label: 'Accounts', icon: 'wallet', f: 'accounts' },
      { id: 'debts', label: 'Debts', icon: 'handshake', f: 'debts' },
      { id: 'budgets', label: 'Budgets', icon: 'target', f: 'budgets' },
      { id: 'savings', label: 'Savings', icon: 'piggy', f: 'savings' },
      { id: 'recurring', label: 'Recurring', icon: 'repeat', f: 'recurring' }] },
    { g: 'Insights', items: [
      { id: 'reports', label: 'Reports', icon: 'chart', f: 'reports' },
      { id: 'categories', label: 'Categories', icon: 'tag', f: 'categories' }] },
    { g: 'Account', items: [
      { id: 'subscription', label: 'Subscription', icon: 'card', f: 'subscription' },
      { id: 'notifications', label: 'Notifications', icon: 'bell', f: 'notifications' },
      { id: 'settings', label: 'Settings', icon: 'settings', f: 'settings' },
      { id: 'help', label: 'Help & Support', icon: 'help', f: 'support' }] }
  ];
  var ADMIN_NAV = [
    { g: 'Administration', items: [
      { id: 'admin-dashboard', label: 'Dashboard', icon: 'home' }, { id: 'admin-customers', label: 'Customers', icon: 'users' },
      { id: 'admin-payments', label: 'Payments', icon: 'card' }, { id: 'admin-methods', label: 'Payment methods', icon: 'qr' },
      { id: 'admin-reports', label: 'Reports', icon: 'chart' }] },
    { g: 'System', items: [
      { id: 'admin-settings', label: 'Settings', icon: 'settings' }, { id: 'admin-announcements', label: 'Announcements', icon: 'megaphone' },
      { id: 'admin-audit', label: 'Audit logs', icon: 'file' }, { id: 'admin-backups', label: 'Backups', icon: 'db' },
      { id: 'profile', label: 'My profile', icon: 'user' }] }
  ];

  /* Mobile quick dock: the pages people use most stay one tap away; everything else lives on the orbit dial
     (opened from the centre hub). Slot 2 is always the hub. */
  var DOCK = [['dashboard', 'Home', 'home'], ['transactions', 'Activity', 'list'], null, ['budgets', 'Budgets', 'target'], ['reports', 'Reports', 'chart']];
  var DOCK_ADMIN = [['admin-dashboard', 'Home', 'home'], ['admin-customers', 'Customers', 'users'], null, ['admin-payments', 'Payments', 'card'], ['admin-reports', 'Reports', 'chart']];
  var HUB_SVG = '<svg class="hub-glyph" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle class="hg-orbit" cx="16" cy="16" r="10.5"/><circle class="hg-core" cx="16" cy="16" r="3"/><g class="hg-sat"><circle cx="16" cy="5.5" r="2.4"/></g></svg><svg class="hub-x" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 6L6 18M6 6l12 12"/></svg>';

  var App = { me: null, pub: null, def: null, page: null };

  App.has = function (f) { var a = App.me && App.me.features || []; return !f || a.indexOf('*') >= 0 || a.indexOf(f) >= 0; };
  App.isAdmin = function () { return App.me && App.me.role === 'super_admin' || (App.me && App.me.user && App.me.user.role === 'super_admin'); };
  App.logo = function () { return App.pub && App.pub.logo_custom ? 'assets/images/brand/logo.png?v=' + (App.pub.v || 1) : 'assets/images/logo-small.png'; };
  App.mtLogo = function (dark) { return App.pub && App.pub.mabumbatech_logo ? 'assets/images/brand/mabumbatech-logo.png' : (dark ? 'assets/images/mabumbatech-logo.png' : 'assets/images/mabumbatech-gold.png'); };
  App.query = function () { return new URLSearchParams(location.search); };
  App.go = function (u) { location.href = u; };

  /* Page registration */
  App.register = function (def) { App.def = def; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot(); };

  /* Page scripts group several pages; only the one matching <body data-page> registers. */
  App.page = function (id, def) { if (document.body.dataset.page === id) { def.id = id; App.register(def); } };

  function pageOf(id) { var all = NAV.concat(ADMIN_NAV); for (var i = 0; i < all.length; i++) for (var j = 0; j < all[i].items.length; j++) if (all[i].items[j].id === id) return all[i].items[j]; return null; }

  /* Quick start: the account and public settings are kept for a short time per tab, so moving between pages
     does not wait for the server. The account is re-checked quietly in the background, and every data request
     is still verified by the server. Any change (POST/PUT/DELETE) clears these copies. */
  function fastGet(k) { try { var c = JSON.parse(sessionStorage.getItem(k) || 'null'); if (c && Date.now() - c.t < c.ms) return c.d; } catch (e) {} return null; }
  function fastSet(k, d, ms) { try { sessionStorage.setItem(k, JSON.stringify({ t: Date.now(), ms: ms, d: d })); } catch (e) {} }

  async function loadMe() {
    var hit = fastGet('et_me_fast');
    if (hit && hit.authenticated && hit.user) {
      Api.setCsrf(hit.csrf);
      Api.get('../api/auth/me').then(function (j) {
        if (!j.data.authenticated) { try { sessionStorage.removeItem('et_me_fast'); } catch (e) {} App.go('login.html'); return; }
        Api.setCsrf(j.data.csrf); j.data.role = j.data.user.role; fastSet('et_me_fast', j.data, 90000);
        if (j.data.role !== hit.role) location.reload();
      }).catch(function () {});
      return hit;
    }
    var j;
    try { j = await Api.get('../api/auth/me'); }
    catch (e) { // offline: reopen with the last known (non-sensitive) snapshot so expenses can still be recorded
      if (e.offline) { try { var c = JSON.parse(localStorage.getItem('et_me_cache') || 'null'); if (c) { c.offlineMode = true; c.role = c.user.role; return c; } } catch (x) {} }
      throw e;
    }
    Api.setCsrf(j.data.csrf);
    if (!j.data.authenticated) { try { localStorage.removeItem('et_me_cache'); sessionStorage.removeItem('et_me_fast'); } catch (e) {} return null; }
    var d = j.data; d.role = d.user.role;
    fastSet('et_me_fast', d, 90000);
    try { localStorage.setItem('et_me_cache', JSON.stringify({ authenticated: true, user: { id: d.user.id, name: d.user.name, email: d.user.email, role: d.user.role, has_avatar: false }, settings: d.settings, features: d.features, subscription: d.subscription, unread: 0 })); } catch (e) {}
    return d;
  }
  async function loadPublic() {
    var hit = fastGet('et_pub_fast'); if (hit) return hit;
    try { var j = await Api.get('../api/settings/public'); fastSet('et_pub_fast', j.data, 300000); return j.data; } catch (e) { return {}; }
  }

  async function boot() {
    var def = App.def, root = document.getElementById('app');
    try {
      var r = await Promise.all([loadMe(), loadPublic()]);
      App.me = r[0]; App.pub = r[1] || {};
      if (!App.me && def.public) { renderPublicShell(def); await renderPage(); return; } // e.g. Help opened from the landing page
      if (!App.me) { App.go('login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search)); return; }
      var admin = App.me.role === 'super_admin';
      if (def.admin && !admin) { App.go('dashboard.html'); return; }
      if (admin && !def.admin && !def.shared) { App.go('admin-dashboard.html'); return; }
      if (App.me.settings && App.me.settings.theme && !localStorage.getItem('et_theme')) Theme.set(App.me.settings.theme);
    } catch (e) {
      root.innerHTML = '<div class="empty" style="padding:80px 16px"><h3>Cannot reach the server</h3><p>Check your connection and try again.</p><button class="btn btn-primary" onclick="location.reload()">Retry</button></div>'; return;
    }
    renderShell(def);
    PWA && PWA.initShell && PWA.initShell(App);
    await renderPage();
  }

  /* Minimal shell for pages that logged-out visitors may open (Help & support). */
  function renderPublicShell(def) {
    document.title = def.title + ' · BudgetFlow';
    U.mount(document.getElementById('app'), html`
      <a class="skip-link" href="#main">Skip to content</a>
      <header class="topbar">
        <a class="brand" href="index.html" style="display:flex;align-items:center;gap:10px;color:var(--heading) !important;text-decoration:none"><img src="${App.logo()}" alt="" width="40" height="40"><b style="color:var(--heading)">BudgetFlow</b></a>
        <div class="grow"></div>
        <button class="icon-btn" id="themeBtn" aria-label="Change theme" title="Theme">${U.icon('monitor')}</button>
        <a class="btn btn-ghost btn-sm" href="index.html">Home</a>
        <a class="btn btn-primary btn-sm" href="login.html">Log in</a>
      </header>
      <main class="content" id="main" tabindex="-1" style="max-width:1100px;margin:0 auto"><div id="banners"></div><div id="view"></div></main>
      <footer class="l-footer" style="margin-top:32px"><div class="in" style="justify-content:center;text-align:center"><div><img class="mt" src="${App.mtLogo(true)}" alt="MABUMBATECH"><p style="margin:6px 0 0">Developed with care by <a class="mt-link" href="https://www.mabumbatech.co.tz" target="_blank" rel="noopener noreferrer">MABUMBATECH</a></p></div></div><p class="copy">© ${new Date().getFullYear()} MABUMBATECH. All rights reserved.</p></footer>`);
    var tb = $('#themeBtn');
    function themeIcon() { var p = Theme.get(); tb.innerHTML = U.icon(p === 'dark' ? 'moon' : p === 'light' ? 'sun' : 'monitor'); tb.title = 'Theme: ' + p; }
    themeIcon(); tb.onclick = function () { Theme.cycle(); themeIcon(); };
  }

  function navHtml(admin) {
    var groups = admin ? ADMIN_NAV : NAV;
    return html`<nav class="nav" aria-label="Main"><span class="nav-hov" aria-hidden="true"></span><span class="nav-pill" aria-hidden="true"></span>${groups.map(function (g) {
      return html`<div class="nav-group">${g.g}</div>${g.items.map(function (it) {
        var locked = !admin && it.f && !App.has(it.f);
        return html`<a href="${it.id}.html" ${App.def.id === it.id ? U.raw('aria-current="page"') : ''}>${U.icon(it.icon)}<span>${it.label}</span>${locked ? html`<span style="margin-left:auto;opacity:.7">${U.icon('lock')}</span>` : ''}${it.id === 'notifications' && App.me.unread ? html`<span class="badge-dot" data-unread-dot></span>` : ''}</a>`;
      })}`;
    })}</nav>`;
  }

  /* ==========================================================================================
     Navigation motion
     - Desktop: a gold pill glides between sidebar items (and carries over from the previous page),
       with a soft hover highlight that follows the pointer.
     - Phone/tablet: a quick dock (fluid active indicator) plus the Orbit dial: every page sits on a ring
       that turns under your finger. Whatever is at 12 o'clock is selected.
     Everything is driven by transform/opacity; the dial runs a single requestAnimationFrame loop only while
     it is open and moving, and stops completely when idle or closed.
     ========================================================================================== */
  var RAD = Math.PI / 180;
  function norm180(a) { a = (a + 180) % 360; if (a < 0) a += 360; return a - 180; }
  function reduced() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }

  /* ---- Dock: the indicator slides from the previous tab to the current one, even across page loads ---- */
  function initDock(idx) {
    var dock = $('.dock'); if (!dock) return;
    var ind = $('.dock-ind', dock), prev = -1;
    try { var p = sessionStorage.getItem('et_dock_i'); if (p !== null && p !== '') prev = parseInt(p, 10); } catch (e) {}
    var from = prev >= 0 && prev <= 4 ? prev : idx;
    ind.style.setProperty('--i', from < 0 ? 0 : from);
    ind.classList.toggle('at-hub', from === 2 || idx < 0);
    if (idx >= 0) {
      if (from !== idx && !reduced()) requestAnimationFrame(function () { requestAnimationFrame(function () { ind.style.setProperty('--i', idx); ind.classList.toggle('at-hub', idx === 2); }); });
      else { ind.style.setProperty('--i', idx); ind.classList.toggle('at-hub', idx === 2); }
      try { sessionStorage.setItem('et_dock_i', String(idx)); } catch (e) {}
    }
    /* Respond on touch-down time: the indicator moves as soon as a tab is tapped, before the next page arrives. */
    dock.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[data-di]') : null; if (!a || e.defaultPrevented) return;
      var i = parseInt(a.dataset.di, 10);
      ind.style.setProperty('--i', i); ind.classList.remove('at-hub');
      U.$$('a[aria-current]', dock).forEach(function (x) { x.removeAttribute('aria-current'); }); a.setAttribute('aria-current', 'page');
      try { sessionStorage.setItem('et_dock_i', String(i)); } catch (x) {}
    });
  }

  /* ---- Desktop sidebar: sliding active pill + hover highlight ---- */
  function initSidebarMotion() {
    var nav = $('.sidebar .nav'); if (!nav) return;
    var pill = $('.nav-pill', nav), hov = $('.nav-hov', nav), cur = $('a[aria-current="page"]', nav), curId = App.def && App.def.id, prevId = null;
    nav.classList.add('has-pill');
    function put(el, a) { el.style.height = a.offsetHeight + 'px'; el.style.transform = 'translate3d(0,' + a.offsetTop + 'px,0)'; }
    function byId(id) { return id ? $('a[href="' + id + '.html"]', nav) : null; }
    try { prevId = sessionStorage.getItem('et_nav_prev'); } catch (e) {}
    if (cur) {
      var from = prevId && prevId !== curId ? byId(prevId) : null;
      if (from && !reduced()) {
        pill.style.transition = 'none'; put(pill, from); pill.style.opacity = '1'; void pill.offsetWidth; pill.style.transition = '';
        requestAnimationFrame(function () { put(pill, cur); });
      } else { pill.style.transition = 'none'; put(pill, cur); pill.style.opacity = '1'; void pill.offsetWidth; pill.style.transition = ''; }
      try { sessionStorage.setItem('et_nav_prev', curId); } catch (e) {}
    }
    function over(a) {
      if (!a || a === cur) { hov.classList.remove('on'); return; }
      if (!hov.classList.contains('on')) { hov.style.transition = 'none'; put(hov, a); void hov.offsetWidth; hov.style.transition = ''; }
      else put(hov, a);
      hov.classList.add('on');
    }
    nav.addEventListener('pointerover', function (e) { if (e.pointerType === 'touch') return; over(e.target.closest ? e.target.closest('a') : null); });
    nav.addEventListener('pointerleave', function () { hov.classList.remove('on'); });
    nav.addEventListener('focusin', function (e) { over(e.target.closest ? e.target.closest('a') : null); });
    nav.addEventListener('focusout', function () { hov.classList.remove('on'); });
    window.addEventListener('resize', U.debounce(function () { if (cur) { pill.style.transition = 'none'; put(pill, cur); void pill.offsetWidth; pill.style.transition = ''; } }, 150));
  }

  /* ---- Orbit dial ---- */
  var Orbit = (function () {
    var items = [], hubBtn, root, card, dial, backdrop, ticks, track, halo, core, ceyebrow, ctitle, cgo, ctext, chips = [], nodes = [], S = null, curId = null, lastFocus = null;

    function flatten(admin) {
      var out = [], gi = -1;
      (admin ? ADMIN_NAV : NAV).forEach(function (g) { gi++; g.items.forEach(function (it) { out.push({ id: it.id, label: it.label, icon: it.icon, g: g.g, gi: gi, locked: !admin && !!it.f && !App.has(it.f) }); }); });
      return out;
    }
    function index(id) { for (var i = 0; i < items.length; i++) if (items[i].id === id) return i; return -1; }

    function init(admin, id) {
      items = flatten(admin); curId = id; hubBtn = $('#moreBtn'); if (!hubBtn || !items.length) return;
      hubBtn.addEventListener('click', function () { if (S && S.open) close(); else open(); });
      window.addEventListener('resize', U.debounce(function () { if (!S || !S.open) return; if (window.innerWidth >= 900) { close(true); return; } size(); layout(); }, 120));
    }

    function build() {
      var groups = [];
      items.forEach(function (it, i) { if (!groups.length || groups[groups.length - 1].gi !== it.gi) groups.push({ g: it.g, gi: it.gi, first: i }); });
      var h = html`<div class="orbit" id="orbit" role="dialog" aria-modal="true" aria-label="All sections" hidden>
        <div class="orbit-backdrop" data-orbit-close></div>
        <div class="orbit-card">
          <div class="orbit-groups" role="group" aria-label="Jump to a section">${groups.map(function (g) { return html`<button type="button" class="orbit-chip" data-gi="${g.gi}" data-first="${g.first}">${g.g}</button>`; })}</div>
          <div class="orbit-dial" tabindex="0" role="group" aria-roledescription="rotary dial" aria-label="Page dial. Drag to turn it, or use the arrow keys. Enter opens the selected page.">
            <div class="orbit-track"></div><div class="orbit-ticks"></div><div class="orbit-halo"></div><i class="orbit-notch"></i>
            <div class="orbit-core"><div class="oc-text"><div class="oc-eyebrow"></div><div class="oc-title" aria-live="polite"></div></div><a class="orbit-go" href="#">Open ${U.icon('chevron')}</a></div>
            ${items.map(function (it, i) { return html`<a class="orbit-node${it.id === curId ? ' is-cur' : ''}" href="${it.id}.html" tabindex="-1" data-i="${i}" aria-label="${it.label}">${U.icon(it.icon)}${it.locked ? html`<span class="orbit-lock">${U.icon('lock')}</span>` : ''}${it.id === 'notifications' && App.me.unread ? html`<span class="orbit-pip" data-unread-dot></span>` : ''}</a>`; })}
          </div>
          <p class="orbit-foot">Developed with care by <a class="mt-link" href="https://www.mabumbatech.co.tz" target="_blank" rel="noopener noreferrer">MABUMBATECH</a></p>
        </div></div>`;
      var tmp = document.createElement('div'); tmp.innerHTML = h.toString(); root = tmp.firstElementChild; document.body.appendChild(root);
      card = $('.orbit-card', root); dial = $('.orbit-dial', root); backdrop = $('.orbit-backdrop', root); ticks = $('.orbit-ticks', root); track = $('.orbit-track', root); halo = $('.orbit-halo', root);
      core = $('.orbit-core', root); ceyebrow = $('.oc-eyebrow', root); ctitle = $('.oc-title', root); cgo = $('.orbit-go', root); ctext = $('.oc-text', root);
      chips = U.$$('.orbit-chip', root); nodes = U.$$('.orbit-node', root);
      S = { th: 0, target: 0, v: 0, mode: 'idle', p: 0, dir: 0, raf: 0, last: 0, open: false, drag: false, sel: -1, rm: false, n: items.length, step: 360 / items.length, D: 300, R: 100, ns: 40, hubY: 200 };
      wire();
    }

    /* Geometry: sized from the viewport so the dial always fits, with node size adapted to how many pages there are. */
    function size() {
      var vw = window.innerWidth, vh = window.innerHeight, cardW = Math.min(vw - 20, 520) - 24;
      var D = Math.round(Math.max(236, Math.min(360, cardW, vh - 250))), ns = Math.round(Math.max(32, Math.min(44, D * 0.125))), R = D / 2 - 20 - ns / 2;
      S.D = D; S.R = R; S.ns = ns;
      dial.style.width = dial.style.height = D + 'px'; dial.style.setProperty('--ns', ns + 'px'); dial.style.setProperty('--cw', Math.round(2 * (R - ns * 0.66 - 8)) + 'px');
      track.style.cssText = 'width:' + 2 * R + 'px;height:' + 2 * R + 'px;margin:' + -R + 'px 0 0 ' + -R + 'px';
      var hs = Math.round(ns * 1.62); halo.style.cssText = 'width:' + hs + 'px;height:' + hs + 'px;margin:' + -hs / 2 + 'px 0 0 ' + -hs / 2 + 'px;top:' + (D / 2 - R) + 'px';
      var r2 = D / 2 - 2, rMaj = r2 - 9, rMin = r2 - 5, h = '<svg width="' + D + '" height="' + D + '" viewBox="' + -D / 2 + ' ' + -D / 2 + ' ' + D + ' ' + D + '" aria-hidden="true" focusable="false">';
      for (var i = 0; i < S.n; i++) for (var k = 0; k < 3; k++) {
        var a = (i * S.step + k * S.step / 3) * RAD, r1 = k ? rMin : rMaj, sn = Math.sin(a), cs = -Math.cos(a);
        h += '<line' + (k ? '' : ' class="mj"') + ' x1="' + (sn * r1).toFixed(1) + '" y1="' + (cs * r1).toFixed(1) + '" x2="' + (sn * r2).toFixed(1) + '" y2="' + (cs * r2).toFixed(1) + '"/>';
      }
      ticks.innerHTML = h + '</svg>';
      /* Where the hub sits relative to the dial centre: nodes unfold from there. */
      var hr = $('.hub-ring', hubBtn).getBoundingClientRect(), dr = dial.getBoundingClientRect();
      S.hubY = (hr.top + hr.height / 2) - (dr.top + dr.height / 2);
    }

    /* One pass positions every node on the ring. Transform + opacity only. */
    function layout() {
      var p = S.p, e = 1 - Math.pow(1 - p, 3), spin = (1 - e) * -150, n = S.n, th = S.th, R = S.R, step = S.step;
      for (var i = 0; i < n; i++) {
        var base = i * step + th, phi = norm180(base), a = (base + spin) * RAD, d = Math.abs(phi) / step, lens = d < 1 ? 1 - d : 0, far = Math.abs(phi) / 180;
        var x = Math.sin(a) * R * e, y = S.hubY + (-Math.cos(a) * R - S.hubY) * e;
        var sc = (0.9 + 0.38 * lens - 0.1 * far) * (0.45 + 0.55 * e);
        var el = nodes[i];
        el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + sc.toFixed(3) + ')';
        el.style.opacity = (e * (1 - 0.5 * Math.min(1, Math.abs(phi) / 150))).toFixed(2);
      }
      ticks.style.transform = 'rotate(' + (th + spin).toFixed(2) + 'deg)';
      backdrop.style.opacity = e.toFixed(3);
      card.style.opacity = Math.min(1, e * 1.7).toFixed(3);
      card.style.transform = 'translate3d(0,' + ((1 - e) * 26).toFixed(1) + 'px,0) scale(' + (0.94 + 0.06 * e).toFixed(3) + ')';
      var sel = ((Math.round(-th / step) % n) + n) % n; if (sel !== S.sel) select(sel);
    }

    function select(i) {
      var prev = S.sel; S.sel = i;
      if (prev >= 0 && nodes[prev]) { nodes[prev].classList.remove('is-sel'); nodes[prev].style.zIndex = ''; }
      nodes[i].classList.add('is-sel'); nodes[i].style.zIndex = '3';
      var it = items[i]; ceyebrow.textContent = it.g; ctitle.textContent = it.label + (it.locked ? ' · Locked' : '');
      cgo.setAttribute('href', it.id + '.html'); cgo.setAttribute('aria-label', 'Open ' + it.label);
      chips.forEach(function (c) { c.classList.toggle('is-on', +c.dataset.gi === it.gi); });
      if (prev >= 0 && !S.rm && ctext.animate) { if (S.anim) S.anim.cancel(); S.anim = ctext.animate([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: 170, easing: 'cubic-bezier(.22,.9,.3,1)' }); }
    }

    /* Animation loop: runs only while something is moving. */
    function kick() { if (!S.raf) { S.last = performance.now(); S.raf = requestAnimationFrame(frame); } }
    function frame(t) {
      S.raf = 0; var dt = Math.min(40, Math.max(1, t - S.last)), busy = false; S.last = t;
      if (S.dir) {
        S.p += S.dir * dt / (S.dir > 0 ? 560 : 240);
        if (S.p >= 1) { S.p = 1; S.dir = 0; } else if (S.p <= 0) { S.p = 0; S.dir = 0; layout(); finishClose(); return; } else busy = true;
      }
      if (!S.drag) {
        if (S.mode === 'fling') { S.th += S.v * dt; S.v *= Math.exp(-dt / 240); if (Math.abs(S.v) < 0.02) { S.mode = 'snap'; S.target = Math.round((S.th + S.v * 120) / S.step) * S.step; } busy = true; }
        else if (S.mode === 'snap') { S.th += (S.target - S.th) * (S.rm ? 1 : 1 - Math.exp(-dt / 90)); if (Math.abs(S.target - S.th) < 0.02) { S.th = S.target; S.mode = 'idle'; } else busy = true; }
      }
      layout(); if (busy) S.raf = requestAnimationFrame(frame);
    }
    function turnTo(i) { S.v = 0; S.mode = 'snap'; S.target = S.th + norm180(-i * S.step - S.th); kick(); }
    function turnBy(k) { S.v = 0; S.mode = 'snap'; S.target = Math.round(S.target / S.step) * S.step + k * S.step; kick(); }
    function go(i) { var href = items[i].id + '.html'; close(); App.go(href); }

    function open() {
      if (!root) build(); if (S.open) return;
      lastFocus = document.activeElement; S.rm = reduced();
      root.hidden = false; card.style.transform = ''; card.style.opacity = ''; size();
      var ci = index(curId); S.th = S.target = -(ci < 0 ? 0 : ci) * S.step; S.mode = 'idle'; S.v = 0; S.sel = -1;
      S.open = true; S.p = S.rm ? 1 : 0; S.dir = S.rm ? 0 : 1;
      document.body.classList.add('orbit-open'); hubBtn.setAttribute('aria-expanded', 'true');
      layout(); kick(); try { dial.focus({ preventScroll: true }); } catch (e) {}
    }
    function close(now) {
      if (!S || !S.open) return; S.open = false; S.drag = false; S.mode = 'idle';
      document.body.classList.remove('orbit-open'); hubBtn.setAttribute('aria-expanded', 'false');
      if (S.rm || now) { S.p = 0; S.dir = 0; layout(); finishClose(); } else { S.dir = -1; kick(); }
    }
    function finishClose() { root.hidden = true; if (lastFocus && root.contains(document.activeElement)) { try { hubBtn.focus({ preventScroll: true }); } catch (e) {} } }

    function wire() {
      var drag = null;
      function angle(e) { return Math.atan2(e.clientX - drag.cx, -(e.clientY - drag.cy)) / RAD; }
      root.addEventListener('click', function (e) {
        if (e.target.closest('[data-orbit-close]')) { close(); return; }
        var c = e.target.closest('.orbit-chip'); if (c) { turnTo(+c.dataset.first); return; }
        if (e.target.closest('.orbit-node')) e.preventDefault(); // taps are handled below so a swipe never opens a page
      });
      dial.addEventListener('dragstart', function (e) { e.preventDefault(); }); // nodes are links: stop the browser's native link-drag from cancelling a turn
      dial.addEventListener('pointerdown', function (e) {
        if (e.button > 0 || e.target.closest('.orbit-go')) return;
        var r = dial.getBoundingClientRect();
        drag = { id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2, sx: e.clientX, sy: e.clientY, t: e.timeStamp, v: 0, moved: false, node: e.target.closest('.orbit-node') };
        drag.a = angle(e); S.drag = true; S.mode = 'idle'; S.v = 0;
        try { dial.setPointerCapture(e.pointerId); } catch (x) {}
        dial.classList.add('is-drag');
      });
      dial.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 7) return;
        drag.moved = true;
        var a = angle(e), d = norm180(a - drag.a), dt = Math.max(1, e.timeStamp - drag.t);
        S.th += d; drag.a = a; drag.v = drag.v * 0.6 + (d / dt) * 0.4; drag.t = e.timeStamp; kick();
      });
      function release(e, cancelled) {
        if (!drag || e.pointerId !== drag.id) return;
        var d = drag; drag = null; S.drag = false; dial.classList.remove('is-drag');
        if (!d.moved && !cancelled) { if (d.node) { var i = +d.node.dataset.i; if (i === S.sel) go(i); else turnTo(i); } return; }
        var v = (e.timeStamp - d.t > 90 || cancelled) ? 0 : Math.max(-1.4, Math.min(1.4, d.v));
        S.v = v;
        if (Math.abs(v) > 0.05 && !S.rm) S.mode = 'fling'; else { S.mode = 'snap'; S.target = Math.round(S.th / S.step) * S.step; }
        kick();
      }
      dial.addEventListener('pointerup', function (e) { release(e, false); });
      dial.addEventListener('pointercancel', function (e) { release(e, true); });
      var wheelAt = 0;
      dial.addEventListener('wheel', function (e) { e.preventDefault(); var t = Date.now(); if (t - wheelAt < 110) return; wheelAt = t; turnBy(e.deltaY > 0 ? -1 : 1); }, { passive: false });
      root.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); close(); try { hubBtn.focus({ preventScroll: true }); } catch (x) {} return; }
        if (e.target !== dial) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); turnBy(-1); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); turnBy(1); }
        else if (e.key === 'Home') { e.preventDefault(); turnTo(0); }
        else if (e.key === 'End') { e.preventDefault(); turnTo(S.n - 1); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(S.sel); }
      });
    }

    return { init: init, open: open, close: close };
  })();
  App.orbit = Orbit;

  function renderShell(def) {
    var admin = App.me.role === 'super_admin', u = App.me.user, init = (u.name || '?').trim().charAt(0).toUpperCase();
    document.title = def.title + ' · BudgetFlow';
    var bottom = admin ? DOCK_ADMIN : DOCK, di = -1;
    bottom.forEach(function (b, i) { if (b && b[0] === def.id) di = i; });
    var here = pageOf(def.id), dockIdx = di >= 0 ? di : (here ? 2 : -1), hubLabel = di < 0 && here ? here.label : 'Explore';
    var shell = html`
      <a class="skip-link" href="#main">Skip to content</a>
      <div class="shell">
        <aside class="sidebar" id="sidebar" aria-label="Sidebar">
          <a class="brand" href="${admin ? 'admin-dashboard' : 'dashboard'}.html"><img src="${App.logo()}" alt="" width="46" height="46"><span><b>BudgetFlow</b><small>${admin ? 'Super Admin' : 'Know where your money goes'}</small></span></a>
          ${navHtml(admin)}
          <div class="sidebar-foot"><img src="${App.mtLogo(true)}" alt="MABUMBATECH" width="120"><div>Developed with care by <a class="mt-link" href="https://www.mabumbatech.co.tz" target="_blank" rel="noopener noreferrer">MABUMBATECH</a></div></div>
        </aside>
        <div class="main">
          <header class="topbar">
            <a class="topbar-logo" href="${admin ? 'admin-dashboard' : 'dashboard'}.html" aria-label="BudgetFlow home"><img src="${App.logo()}" alt="" width="36" height="36"></a>
            <div class="grow"><h1>${def.title}</h1><div class="date">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
            <button class="icon-btn" id="themeBtn" aria-label="Change theme" title="Theme">${U.icon('monitor')}</button>
            ${admin ? '' : html`<div class="dropdown"><button class="icon-btn bell" id="bellBtn" aria-label="Notifications" aria-haspopup="true" aria-expanded="false">${U.icon('bell')}${App.me.unread ? html`<span class="count-badge" id="bellCount">${App.me.unread > 99 ? '99+' : App.me.unread}</span>` : ''}</button><div class="panel hide" id="bellPanel"></div></div>`}
            <div class="dropdown"><button class="avatar" id="userBtn" aria-label="Account menu" aria-haspopup="true" aria-expanded="false">${u.has_avatar ? html`<img src="${Api.url('../api/profile/avatar')}?v=${App.me.avatar_v || 1}" alt="">` : init}</button>
              <div class="panel hide menu-list" id="userPanel" style="width:240px"><div class="panel-head"><div><div>${u.name}</div><div class="small muted" style="font-weight:400">${u.email}</div></div></div>
                <a href="profile.html">${U.icon('user')} My profile</a>${admin ? '' : html`<a href="settings.html">${U.icon('settings')} Settings</a><a href="subscription.html">${U.icon('card')} Subscription</a><a href="help.html">${U.icon('help')} Help & support</a>`}
                <button id="logoutBtn">${U.icon('logout')} Log out</button></div></div>
          </header>
          <main class="content" id="main" tabindex="-1"><div id="banners"></div><div id="view"></div></main>
        </div>
      </div>
      ${admin ? '' : html`<button class="fab" id="fab" aria-label="Add transaction" aria-haspopup="true">${U.icon('plus')}</button><div class="panel hide" id="fabMenu" style="position:fixed;right:16px;bottom:160px;top:auto;width:230px"></div>`}
      <nav class="bottom-nav dock" aria-label="Quick navigation"><span class="dock-ind" aria-hidden="true"></span>${bottom.map(function (b, i) {
        if (!b) return html`<button class="dock-hub${di < 0 && here ? ' is-current' : ''}" id="moreBtn" type="button" aria-label="All sections" aria-haspopup="dialog" aria-expanded="false" aria-controls="orbit"><span class="hub-ring">${U.raw(HUB_SVG)}</span><span class="hub-label">${hubLabel}</span></button>`;
        return html`<a href="${b[0]}.html" data-di="${i}" ${di === i ? U.raw('aria-current="page"') : ''}>${U.icon(b[2])}<span>${b[1]}</span></a>`;
      })}</nav>`;
    U.mount(document.getElementById('app'), shell);
    wireShell(admin);
    initDock(dockIdx);
    initSidebarMotion();
    Orbit.init(admin, def.id);
    renderBanners();
  }

  function closePanels(except) { U.$$('.panel').forEach(function (p) { if (p !== except) p.classList.add('hide'); }); U.$$('[aria-expanded="true"]').forEach(function (b) { if (b.id !== 'moreBtn') b.setAttribute('aria-expanded', 'false'); }); }
  function wireShell(admin) {
    var sb = $('#sidebar');
    /* Keep the sidebar where it was between pages (each page reloads the shell). */
    try { var sy = parseInt(sessionStorage.getItem('et_side_y'), 10); if (sy > 0) { sb.style.scrollBehavior = 'auto'; sb.scrollTop = sy; } } catch (e) {}
    sb.addEventListener('scroll', function () { try { sessionStorage.setItem('et_side_y', String(sb.scrollTop)); } catch (e) {} }, { passive: true });
    var tb = $('#themeBtn');
    function themeIcon() { var p = Theme.get(); tb.innerHTML = U.icon(p === 'dark' ? 'moon' : p === 'light' ? 'sun' : 'monitor'); tb.title = 'Theme: ' + p; }
    themeIcon(); tb.onclick = function () { var n = Theme.cycle(); themeIcon(); U.toast('Theme: ' + n, 'success'); if (App.me.settings && App.has('settings')) { App.me.settings.theme = n; Api.put('../api/settings/me', App.me.settings).catch(function () {}); } };
    function toggle(btn, panel, onOpen) { if (!btn) return; btn.onclick = function (e) { e.stopPropagation(); var open = panel.classList.contains('hide'); closePanels(open ? panel : null); panel.classList.toggle('hide', !open); btn.setAttribute('aria-expanded', open); if (open && onOpen) onOpen(); }; }
    toggle($('#userBtn'), $('#userPanel'));
    if (!admin) { toggle($('#bellBtn'), $('#bellPanel'), loadBell); toggle($('#fab'), $('#fabMenu'), fabMenu); }
    document.addEventListener('click', function (e) { if (!e.target.closest('.panel') ) closePanels(null); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanels(null); });
    $('#logoutBtn').onclick = logout;
    U.on(document, 'click', '[data-quick]', function (e, el) { closePanels(null); App.quick(el.dataset.quick); });
  }

  async function logout() {
    var pending = Api.queue.count();
    if (pending && !(await U.confirm({ title: 'Unsynced entries', message: pending + ' entr' + (pending > 1 ? 'ies are' : 'y is') + ' saved on this device and not yet synced. Logging out will discard them. Log out anyway?', confirmText: 'Log out anyway', danger: true }))) return;
    try { await Api.post('../api/auth/logout'); } catch (e) {}
    Api.queue.clear(); try { sessionStorage.clear(); localStorage.removeItem('et_me_cache'); localStorage.removeItem('et_lookups'); } catch (e) {}
    App.go('login.html?out=1');
  }

  function fabMenu() {
    var items = [['expense', 'Add expense', 'arrow-up', 'expenses'], ['income', 'Add income', 'arrow-down', 'income'], ['transfer', 'Transfer money', 'swap', 'accounts'], ['debt', 'Record a debt', 'handshake', 'debts']].filter(function (i) { return App.has(i[3]); });
    U.mount($('#fabMenu'), html`<div class="menu-list">${items.map(function (i) { return html`<button data-quick="${i[0]}">${U.icon(i[2])} ${i[1]}</button>`; })}</div>`);
  }
  App.quick = function (k) { if (!App.forms) return; if (k === 'expense' || k === 'income') App.forms.txn(k); else if (k === 'transfer') App.forms.transfer(); else if (k === 'debt') App.go('debts.html?new=1'); };

  async function loadBell() {
    var p = $('#bellPanel'); U.mount(p, U.skeleton(3));
    try {
      var j = await Api.get('../api/notifications?per_page=8&unread=1'), d = j.data;
      U.mount(p, html`<div class="panel-head"><span>Notifications</span><button class="link-btn" id="readAll">Mark all read</button></div><div class="panel-list">${d.items.length ? d.items.map(function (n) { return html`<a class="notif unread" data-nid="${n.id}" href="${(n.link || 'notifications.html').replace(/^\//, '')}"><b>${n.title}</b><span>${n.body}</span><time>${U.ago(n.created_at)}</time></a>`; }) : U.empty('All caught up', 'No new notifications.')}</div><div style="padding:10px;text-align:center"><a href="notifications.html">View all</a></div>`);
      if (!p._nidBound) { p._nidBound = true; U.on(p, 'click', '[data-nid]', async function (e, a) { e.preventDefault(); try { await Api.post('../api/notifications/' + a.dataset.nid + '/read'); } catch (x) {} location.href = a.getAttribute('href'); }); }
      var ra = $('#readAll'); if (ra) ra.onclick = async function () { await Api.post('../api/notifications/read-all'); setUnread(0); loadBell(); };
    } catch (e) { U.mount(p, html`<div class="empty">Could not load notifications.</div>`); }
  }
  function setUnread(n) { var c = $('#bellCount'); if (!n) { if (c) c.remove(); U.$$('[data-unread-dot]').forEach(function (d) { d.remove(); }); return; } if (c) c.textContent = n > 99 ? '99+' : n; else { var b = $('#bellBtn'); if (b) { b.insertAdjacentHTML('beforeend', '<span class="count-badge" id="bellCount">' + n + '</span>'); b.classList.add('ring'); } } }
  App.setUnread = setUnread;

  /* Subscription / announcement banners */
  function renderBanners() {
    var s = App.me.subscription, host = $('#banners'), h = [];
    if (App.me.role !== 'super_admin' && s) {
      var left = s.days_remaining;
      if (s.status === 'expired') h.push(html`<div class="banner danger" role="alert">${U.icon('alert')}<div class="grow"><b>Your subscription has expired.</b> Your data is safe. You can still record expenses; renew to unlock reports, analytics and everything else.</div><a class="btn btn-gold btn-sm" href="subscription.html">${s.payment_pending ? 'View payment' : 'Renew now'}</a></div>`);
      else if (s.status === 'expiring_soon') h.push(html`<div class="banner warn">${U.icon('clock')}<div class="grow"><b>${s.in_trial ? 'Your free trial ends' : 'Your subscription ends'} in ${left} day${left === 1 ? '' : 's'}.</b> Renew to keep full access.</div><a class="btn btn-gold btn-sm" href="subscription.html">Renew</a></div>`);
      else if (s.in_trial && s.status !== 'active' && App.def.id === 'dashboard') h.push(html`<div class="banner info">${U.icon('star')}<div class="grow"><b>Free trial:</b> ${left} day${left === 1 ? '' : 's'} left. Everything is unlocked.</div></div>`);
      if (s.payment_pending && s.status !== 'expired') h.push(html`<div class="banner info">${U.icon('clock')}<div class="grow">Your payment is awaiting approval. We will notify you once it is reviewed.</div></div>`);
    }
    if (App.pub && App.pub.landing_announcement && App.me.role !== 'super_admin') { /* landing announcement is for the landing page */ }
    U.mount(host, h);
  }

  /* Page rendering with feature gating */
  function gate(msg) {
    return html`<div class="card center" style="max-width:520px;margin:30px auto;padding:34px 22px"><div class="ico" style="width:64px;height:64px;margin:0 auto 12px;border-radius:20px;display:grid;place-items:center;background:var(--warning-bg);color:var(--warning)">${U.icon('lock', '')}</div><h2>This feature needs an active subscription</h2><p class="muted">${msg || 'Your trial or subscription has ended. Your data is safe and nothing has been deleted. Renew to unlock this feature again.'}</p><a class="btn btn-gold" href="subscription.html">See subscription options</a></div>`;
  }
  App.gate = gate;
  async function renderPage() {
    var def = App.def, old = $('#view'), view = old.cloneNode(false); old.replaceWith(view); // fresh node drops stale listeners on refresh
    if (def.feature && App.me && !App.has(def.feature)) { U.mount(view, gate()); view.classList.add('view-enter'); return; }
    U.mount(view, U.skeleton(3));
    try { await def.render(view, App); view.classList.remove('view-enter'); void view.offsetWidth; view.classList.add('view-enter'); Motion.scan(view); }
    catch (e) {
      if (e.status === 402) U.mount(view, gate(e.message));
      else if (e.status === 401) App.go('login.html?expired=1');
      else if (e.offline) U.mount(view, html`<div class="card empty"><h3>You are offline</h3><p>This page needs a connection. You can still record expenses and income; they are saved on this device and sync automatically.</p><div class="row" style="justify-content:center">${App.has('expenses') ? html`<button class="btn btn-primary" data-quick="expense">Add expense</button>` : ''}${App.has('income') ? html`<button class="btn btn-ghost" data-quick="income">Add income</button>` : ''}</div></div>`);
      else U.mount(view, html`<div class="card empty"><h3>Something went wrong</h3><p>${e.message || 'Please try again.'}</p><button class="btn btn-primary" id="retry">Try again</button></div>`);
      var r = $('#retry'); if (r) r.onclick = renderPage;
      if (!(e instanceof Api.ApiError)) console.error(e);
    }
  }
  App.refresh = renderPage;
  App.setTitle = function (t) { var h = $('.topbar h1'); if (h) h.textContent = t; };
  App.pageHead = function (title, sub, actions) { return html`<div class="page-head"><div><h2>${title}</h2>${sub ? html`<p>${sub}</p>` : ''}</div><div class="row">${actions || ''}</div></div>`; };

  window.App = App;
})();
