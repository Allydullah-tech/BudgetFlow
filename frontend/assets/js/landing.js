/* Landing page: welcome popup (once per session), rotating logo, counters, reveal animations, live pricing from settings. */
(function () {
  'use strict';
  var U = window.UI, $ = U.$, html = U.html, pub = {};
  var FEATURES = [['arrow-down', 'Income & expenses', 'Record in seconds with categories, receipts and notes. Edit or reverse anytime.'], ['handshake', 'Debt tracking', 'Money you owe and money owed to you, with part-payments and due dates.'], ['target', 'Budgets & alerts', 'Set limits and get gentle warnings at 50%, 75%, 90% and 100%.'], ['piggy', 'Savings goals', 'Save towards what matters and celebrate each milestone.'], ['wallet', 'Accounts & transfers', 'Cash, bank and mobile money. Transfers never count as income or expenses.'], ['chart', 'Reports', 'Sixteen reports with charts, exportable to CSV and PDF.'], ['repeat', 'Recurring items', 'Rent, salary and bills scheduled. You confirm each one, nothing is posted behind your back.'], ['wifi-off', 'Works offline', 'Record expenses without internet. They sync safely when you are back online.'], ['shield', 'Private & secure', 'Your data is yours. Export it or delete it whenever you like.']];
  var FAQ = [['Is the free trial really free?', 'Yes. You get the full app for the trial period with no card needed. If you do not renew, your data stays safe and you can still record expenses.'], ['How do I pay after the trial?', 'Pay by mobile money or bank using the details shown in the app, then submit the transaction reference. A person reviews and approves it, usually quickly.'], ['What happens to my data if I stop paying?', 'Nothing is deleted. You can still log in and record expenses; reports and advanced features unlock again when you renew.'], ['Can I use it on my phone?', 'Yes. It installs like an app on Android, iPhone and computers, and works offline for recording expenses and income.'], ['Is borrowed money counted as my income?', 'No. Loans and transfers between your own accounts are tracked separately so your income and expense reports stay accurate.'], ['Which currency is used?', 'Tanzanian Shillings (TZS).']];

  function logos() {
    if (pub.logo_custom) { U.$$('[data-logo],[data-logo-large]').forEach(function (i) { i.src = 'assets/images/brand/logo.png'; }); }
    if (pub.mabumbatech_logo) U.$$('[data-mt-logo]').forEach(function (i) { i.src = 'assets/images/brand/mabumbatech-logo.png'; });
  }
  function welcome() {
    try { if (sessionStorage.getItem('et_welcomed') === '1') return; sessionStorage.setItem('et_welcomed', '1'); } catch (e) { /* storage blocked: show once per page load */ }
    var mt = pub.mabumbatech_logo ? 'assets/images/brand/mabumbatech-logo.png' : 'assets/images/mabumbatech-logo.png';
    var o = document.createElement('div'); o.className = 'wp-overlay'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Welcome');
    o.innerHTML = '<div class="wp-card"><button class="wp-close" aria-label="Close welcome message">' + U.icon('x') + '</button><div class="wp-logo"><img src="' + mt + '" alt="MABUMBATECH"></div><h2>' + U.esc(pub.welcome_popup_message || 'Welcome to BudgetFlow') + '</h2><p>Developed with care by <a class="wp-brand" href="https://www.mabumbatech.co.tz" target="_blank" rel="noopener noreferrer"><b>MABUMBATECH</b></a></p><button class="btn btn-gold" id="wpGo">Get started</button></div>';
    document.body.appendChild(o); document.body.style.overflow = 'hidden';
    var done = false, t;
    function close() { if (done) return; done = true; clearTimeout(t); document.removeEventListener('keydown', key); o.classList.add('closing'); document.body.style.overflow = ''; setTimeout(function () { o.remove(); }, 380); }
    function key(e) { if (e.key === 'Escape') close(); if (e.key === 'Tab') { e.preventDefault(); $('#wpGo', o).focus(); } }
    document.addEventListener('keydown', key);
    $('.wp-close', o).onclick = close; $('#wpGo', o).onclick = close; o.addEventListener('mousedown', function (e) { if (e.target === o) close(); });
    $('#wpGo', o).focus();
    t = setTimeout(close, Motion.reduce ? 4000 : 7000);
  }
  /* Navigation: solid bar after scrolling, mobile menu, and highlight of the section being read. */
  function chrome() {
    var nav = $('.l-nav'), btn = $('#menuBtn'), links = U.$$('.l-links a');
    function onScroll() { nav.classList.toggle('scrolled', window.scrollY > 24); }
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    function setOpen(o) { nav.classList.toggle('open', o); btn.setAttribute('aria-expanded', o ? 'true' : 'false'); btn.setAttribute('aria-label', o ? 'Close menu' : 'Open menu'); }
    btn.onclick = function () { setOpen(!nav.classList.contains('open')); };
    links.forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    window.addEventListener('resize', function () { if (window.innerWidth > 899) setOpen(false); });
    if (!('IntersectionObserver' in window)) return;
    var spy = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id); }); }); }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (a) { var s = document.getElementById(a.getAttribute('href').slice(1)); if (s) spy.observe(s); });
  }
  function theme() { var b = $('#themeBtn'); function ic() { var p = Theme.get(); b.innerHTML = U.icon(p === 'dark' ? 'moon' : p === 'light' ? 'sun' : 'monitor'); } ic(); b.onclick = function () { Theme.cycle(); ic(); }; }
  function content() {
    U.mount($('#featGrid'), FEATURES.map(function (f) { return html`<div class="card feat reveal"><div class="ico">${U.icon(f[0])}</div><h3>${f[1]}</h3><p>${f[2]}</p></div>`; }));
    U.mount($('#faqList'), FAQ.map(function (f) { return html`<details><summary>${f[0]}</summary><p>${f[1]}</p></details>`; }));
    $('#yr').textContent = new Date().getFullYear();
    Charts.line($('#mockChart'), { title: 'Sample income versus expenses', labels: ['1', '5', '10', '15', '20', '25', '30'], series: [{ name: 'Income', values: [0, 150000, 0, 200000, 0, 100000, 0], color: 'var(--income)' }, { name: 'Expenses', values: [20000, 35000, 28000, 52000, 30000, 41000, 22000], color: 'var(--expense)' }] });
    Charts.donut($('#mockDonut'), { title: 'Sample spending', items: [{ label: 'Food', value: 45 }, { label: 'Transport', value: 25 }, { label: 'Bills', value: 20 }, { label: 'Other', value: 10 }], centerLabel: 'Sample' });
  }
  function pricing() {
    var days = pub.trial_days || 30;
    $('#trialLine').textContent = days + '-day free trial'; $('#trialItem').textContent = days + ' days free, no card needed';
    var pn = pub.plan ? Number(pub.plan.price) : 5000, pm = pub.plan ? (pub.plan.period_months || 1) : 1;
    if (pub.plan) $('#planName').textContent = pub.plan.name + ' plan';
    $('#planPrice').textContent = pn.toLocaleString('en-US', { maximumFractionDigits: 0 });
    $('#planPer').textContent = '/ ' + (pm > 1 ? pm + ' months' : 'month');
    $('#trialBadge').textContent = days + ' days free';
    $('#trialNote').textContent = 'Start with ' + days + ' days on us. No card needed, and you can stop any time.';
    if (pub.landing_announcement) { $('#announce').innerHTML = '<div class="announce">' + U.esc(pub.landing_announcement) + '</div>'; }
    if (pub.registration_open === false) { U.$$('a[href="register.html"]').forEach(function (a) { a.classList.add('hide'); }); }
  }
  function install() {
    var b = $('#installBtn'); if (!b) return;
    function show() { if (!PWA.isStandalone() && PWA.canInstall()) b.classList.remove('hide'); }
    b.onclick = async function () { if (await PWA.install()) b.classList.add('hide'); };
    show(); document.addEventListener('et:installable', show);
  }
  /* Hero headline: rotates the last word with a typewriter effect. Pauses when the tab or the hero is not visible;
     with reduced motion it simply stays on the first word. */
  function U_debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function typer() {
    var el = $('#typeWord'); if (!el) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var words = ['Wellness', 'Clarity', 'Control', 'Freedom', 'Growth'], wi = 0, ci = words[0].length, phase = 'hold', timer = 0, vis = true, paused = false;
    /* The word sits in the sentence, so a long word can wrap the headline onto another line. Reserve the height of the
       tallest case up front so the text below never jumps while words change. */
    function reserve() {
      var h = el.closest('h1'); if (!h) return; var cur = el.textContent; h.style.minHeight = '';
      var max = 0; words.forEach(function (w) { el.textContent = w; max = Math.max(max, h.offsetHeight); });
      el.textContent = cur; h.style.minHeight = max + 'px';
    }
    reserve(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(reserve);
    window.addEventListener('resize', U_debounce(reserve, 200));
    function later(ms) { clearTimeout(timer); timer = setTimeout(step, ms); }
    function step() {
      if (!vis || document.hidden) { paused = true; return; }
      var w = words[wi];
      if (phase === 'hold') { phase = 'delete'; later(0); }
      else if (phase === 'delete') { ci--; el.textContent = w.slice(0, ci); if (ci <= 0) { phase = 'type'; wi = (wi + 1) % words.length; later(380); } else later(42); }
      else { w = words[wi]; ci++; el.textContent = w.slice(0, ci); if (ci >= w.length) { phase = 'hold'; later(1900); } else later(85); }
    }
    function resume() { if (paused && vis && !document.hidden) { paused = false; later(250); } }
    document.addEventListener('visibilitychange', resume);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { vis = es[es.length - 1].isIntersecting; resume(); }).observe(el.parentNode);
    later(2200);
  }
  async function init() {
    // The installed app opens here (start_url). Someone already signed in on this device goes straight into the app, also with no connection.
    try { if (/[?&]source=pwa\b/.test(location.search) && localStorage.getItem('et_me_cache')) { location.replace('dashboard.html'); return; } } catch (e) {}
    theme(); chrome(); content(); install(); typer();
    try { pub = (await Api.get('../api/settings/public')).data || {}; } catch (e) { pub = {}; }
    logos(); pricing(); Motion.scan(document);
    if (pub.maintenance) { var a = $('#announce'); a.innerHTML = '<div class="announce">We are doing some maintenance. Please check back shortly.</div>'; }
    welcome();
  }
  init();
})();
