/* Login, register, forgot password, reset password.
   One animated scene stays on screen while the cards slide between pages (no reload), so the movement is continuous.
   Standalone (no app shell). Transform/opacity animations only. */
(function () {
  'use strict';
  var U = window.UI, html = U.html, $ = U.$, root = document.getElementById('app'), startPage = document.body.dataset.page || 'login', cur = startPage;
  var qp = new URLSearchParams(location.search), pub = {}, busy = false, offlineNote = false;
  var FILE = { login: 'login.html', register: 'register.html', forgot: 'forgot-password.html', reset: 'reset-password.html' };
  var FROM_FILE = { 'login.html': 'login', 'register.html': 'register', 'forgot-password.html': 'forgot', 'reset-password.html': 'reset' };
  var ORDER = { login: 0, register: 1, forgot: 2, reset: 3 };
  var HERO = {
    login: ['Good to see you again', 'Your finances. Your goals. Your control.'],
    register: ['Start in minutes.', 'Create a free account and see where every shilling goes.'],
    forgot: ['No stress.', 'We will email you a link to get back in.'],
    reset: ['Fresh start.', 'Choose a strong new password and you are done.']
  };
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var fine = !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches);

  function logo() { return pub.logo_custom ? 'assets/images/brand/logo.png' : 'assets/images/logo.png'; }

  /* ---------------- Scene + shell ---------------- */
  var SPARKS = [[8, 30, 14, 0, 3.4], [22, 12, 10, 1.2, 4.1], [34, 64, 12, .5, 3.8], [48, 22, 9, 2, 3.2], [58, 82, 14, 1.6, 4.4], [70, 16, 11, .9, 3.6], [82, 48, 13, 2.4, 3.9], [91, 76, 9, .3, 3.3], [14, 86, 12, 1.9, 4.2], [64, 40, 8, 2.8, 3.5], [40, 90, 10, 1.1, 4], [95, 28, 12, .7, 3.7]];
  var COINS = [[8, 20, 54, 0, 7, 5.5], [86, 12, 44, 1.2, 6.2, 4.6], [76, 70, 64, .6, 8, 6.2], [16, 76, 40, 2, 6.6, 5], [44, 6, 34, 1.5, 5.8, 4.2]];
  function sceneHtml() {
    var s = '<div class="au-scene" aria-hidden="true"><div class="au-layer" data-d=".25"><i class="au-blob b1"></i><i class="au-blob b2"></i><i class="au-blob b3"></i></div>';
    s += '<div class="au-layer" data-d=".55"><div class="au-grid"></div>';
    SPARKS.forEach(function (p) { s += '<i class="au-spark" style="--x:' + p[0] + '%;--y:' + p[1] + '%;--s:' + p[2] + 'px;--d:' + p[3] + 's;--t:' + p[4] + 's"></i>'; });
    s += '<i class="au-shoot" style="--x:6%;--y:10%;--d:1s"></i><i class="au-shoot" style="--x:42%;--y:4%;--d:4.5s"></i><i class="au-shoot" style="--x:-4%;--y:48%;--d:7s"></i></div>';
    s += '<div class="au-layer" data-d="1">';
    COINS.forEach(function (c, i) { s += '<div class="au-coin c' + (i + 1) + '" style="--x:' + c[0] + '%;--y:' + c[1] + '%;--s:' + c[2] + 'px;--d:' + c[3] + 's;--t:' + c[4] + 's;--sp:' + c[5] + 's"><i>TSh</i></div>'; });
    s += '</div><div class="au-streaks">';
    [12, 26, 38, 52, 66, 78, 90].forEach(function (y, i) { s += '<i style="--y:' + y + '%;--w:' + (22 + (i % 3) * 10) + 'vw;--i:' + i + '"></i>'; });
    return s + '</div></div>';
  }
  function mascotSvg() {
    return '<svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="mg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9cc8ff"/><stop offset="1" stop-color="#2f74e0"/></linearGradient><radialGradient id="mh" cx=".3" cy=".25" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>' +
      '<circle cx="60" cy="64" r="46" fill="url(#mg)"/><circle cx="60" cy="64" r="46" fill="url(#mh)"/><circle cx="60" cy="64" r="38" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-dasharray="3 5"/>' +
      '<path class="m-spark" d="M96 20l2.6 7 7 2.6-7 2.6-2.6 7-2.6-7-7-2.6 7-2.6z" fill="#fff"/>' +
      '<g class="m-eye"><ellipse cx="44" cy="60" rx="10" ry="12" fill="#fff"/><g class="m-pupil"><circle cx="44" cy="62" r="6" fill="#101828"/><circle cx="46.5" cy="58.5" r="2" fill="#fff"/></g></g>' +
      '<g class="m-eye"><ellipse cx="76" cy="60" rx="10" ry="12" fill="#fff"/><g class="m-pupil"><circle cx="76" cy="62" r="6" fill="#101828"/><circle cx="78.5" cy="58.5" r="2" fill="#fff"/></g></g>' +
      '<ellipse cx="31" cy="78" rx="7" ry="4" fill="#ff9ab5" opacity=".55"/><ellipse cx="89" cy="78" rx="7" ry="4" fill="#ff9ab5" opacity=".55"/>' +
      '<path class="m-mouth m-smile" d="M50 80Q60 91 70 80" fill="none" stroke="#101828" stroke-width="3.2" stroke-linecap="round"/><path class="m-mouth m-sad" d="M51 88Q60 78 69 88" fill="none" stroke="#101828" stroke-width="3.2" stroke-linecap="round"/><ellipse class="m-mouth m-open" cx="60" cy="83" rx="7" ry="8" fill="#101828"/>' +
      '<g class="m-hands"><ellipse cx="38" cy="60" rx="15" ry="12" fill="#cfe3ff" stroke="#2f74e0" stroke-width="2.4"/><ellipse cx="82" cy="60" rx="15" ry="12" fill="#cfe3ff" stroke="#2f74e0" stroke-width="2.4"/></g></svg>';
  }
  function heroHtml() {
    return '<aside class="au-hero"><a class="au-brand" href="index.html" aria-label="BudgetFlow home"><img src="' + logo() + '" alt=""><span>BudgetFlow</span></a>' +
      '<h2 class="au-headline" id="auHead"></h2><p class="au-sub" id="auSub"></p>' +
      '<div class="au-gcards" aria-hidden="true"><div class="au-px" data-px=".7">' +
      '<div class="au-gcard g1"><small>Total balance</small><b>TZS 1,268,500</b><em>+8.2% vs last month</em><svg viewBox="0 0 220 44" preserveAspectRatio="none"><path d="M0 36 C25 30 40 38 62 26 S100 30 122 18 S170 24 190 10 L220 6" fill="none" stroke="#6aa7ff" stroke-width="3" stroke-linecap="round"/></svg></div>' +
      '<div class="au-gcard g2"><small>This week</small><div class="au-bars"><i style="--h:30px;--i:0"></i><i style="--h:46px;--i:1"></i><i style="--h:26px;--i:2"></i><i style="--h:58px;--i:3"></i><i style="--h:40px;--i:4"></i></div></div>' +
      '<div class="au-gcard g3"><i></i>Budget on track</div></div></div></aside>';
  }
  function buildShell() {
    root.innerHTML = '<div class="au-wrap">' + sceneHtml() + '<main class="au-stage">' + heroHtml() +
      '<section class="au-panel"><div class="au-deck"><div class="au-mascot-pos"><div class="au-mascot" id="auMascot">' + mascotSvg() + '</div></div>' +
      '<div class="au-card first" id="auCard"><div class="au-body" id="auBody"><div class="au-load" aria-label="Loading"><i></i><i></i><i></i></div></div>' +
      '<p class="center small muted au-credit">Developed with care by <a class="mt-link" href="https://www.mabumbatech.co.tz" target="_blank" rel="noopener noreferrer">MABUMBATECH</a></p></div></div></section></main></div>';
    scene = $('.au-scene'); layers = [].slice.call(root.querySelectorAll('.au-layer')); pxEls = [].slice.call(root.querySelectorAll('[data-px]'));
    mascot = $('#auMascot'); pupils = [].slice.call(mascot.querySelectorAll('.m-pupil'));
    setHero(cur, 'init'); applyScene();
    setTimeout(function () { var c = $('#auCard'); if (c) c.classList.remove('first'); }, 900);
  }

  /* ---------------- Motion: parallax, camera, mascot ---------------- */
  var scene, layers = [], pxEls = [], mascot, pupils = [], st = { px: 0, py: 0, mx: null, my: null, cam: 0, raf: 0, focused: false };
  function applyScene() {
    st.raf = 0;
    layers.forEach(function (l) { var d = parseFloat(l.dataset.d); l.style.transform = 'translate3d(' + (st.cam * d + st.px * d * -26).toFixed(1) + 'px,' + (st.py * d * -18).toFixed(1) + 'px,0)'; });
    pxEls.forEach(function (e) { var d = parseFloat(e.dataset.px); e.style.transform = 'translate3d(' + (st.px * d * -18).toFixed(1) + 'px,' + (st.py * d * -12).toFixed(1) + 'px,0)'; });
    if (!st.focused && st.mx != null && mascot) {
      var r = mascot.getBoundingClientRect(), vx = st.mx - (r.left + r.width / 2), vy = st.my - (r.top + r.height / 2), dist = Math.hypot(vx, vy) || 1, k = Math.min(1, dist / 260);
      gaze(vx / dist * k * 5, vy / dist * k * 4);
    }
  }
  function schedule() { if (!st.raf) st.raf = requestAnimationFrame(applyScene); }
  function gaze(dx, dy) { pupils.forEach(function (p) { p.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)'; }); }
  function mood(name, ms) { if (!mascot) return; mascot.classList.remove('is-hop', 'is-happy', 'is-sad'); void mascot.offsetWidth; mascot.classList.add('is-' + name); setTimeout(function () { mascot && mascot.classList.remove('is-' + name); }, ms || 900); }
  function sad() { mood('sad', 1500); var c = $('#auCard'); if (c && !reduce) { c.classList.remove('au-shake'); void c.offsetWidth; c.classList.add('au-shake'); setTimeout(function () { c.classList.remove('au-shake'); }, 480); } }
  function happy() { mood('happy', 1600); }
  if (!reduce) {
    document.addEventListener('pointermove', function (e) { if (e.pointerType === 'touch') return; st.px = (e.clientX / innerWidth - .5) * 2; st.py = (e.clientY / innerHeight - .5) * 2; st.mx = e.clientX; st.my = e.clientY; schedule(); }, { passive: true });
  }
  function syncCover() {
    var a = document.activeElement, pw = !!(a && a.tagName === 'INPUT' && a.type === 'password' && a.closest('.au-card'));
    if (mascot) mascot.classList.toggle('is-hide', pw);
  }
  document.addEventListener('focusin', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('.au-card') || t.tagName !== 'INPUT') return;
    st.focused = true; syncCover(); if (t.type !== 'password' && t.type !== 'checkbox') gaze(-3 + Math.min(1, (t.value || '').length / 26) * 7, 4);
  });
  document.addEventListener('focusout', function () { setTimeout(function () { var a = document.activeElement; st.focused = !!(a && a.tagName === 'INPUT' && a.closest && a.closest('.au-card')); syncCover(); if (!st.focused) gaze(0, 0); }, 0); });
  document.addEventListener('input', function (e) { var t = e.target; if (t && t.tagName === 'INPUT' && t.type !== 'password' && t.closest && t.closest('.au-card')) gaze(-3 + Math.min(1, (t.value || '').length / 26) * 7, 4); });

  function setHero(view, dir) {
    var h = $('#auHead'), s = $('#auSub'); if (!h) return;
    var words = HERO[view][0].split(' ');
    h.classList.remove('out'); s.classList.remove('out');
    h.innerHTML = words.map(function (w, i) { return '<span class="w"><b style="--i:' + i + '">' + U.esc(w) + '</b></span>'; }).join(' ');
    s.textContent = HERO[view][1];
  }
  function heroOut() { var h = $('#auHead'), s = $('#auSub'); if (h) h.classList.add('out'); if (s) s.classList.add('out'); }

  /* ---------------- Views ---------------- */
  function strength(pw) { var s = 0; if (pw.length >= 8) s++; if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) s++; if (pw.length >= 12) s++; if (/[^A-Za-z0-9]/.test(pw) && /[A-Z]/.test(pw)) s++; return s; }
  function strengthMeter(form, name) {
    var i = form.querySelector('[name="' + name + '"]'); if (!i) return;
    var wrap = document.createElement('div'); wrap.className = 'hint'; wrap.style.cssText = 'margin-top:6px'; wrap.innerHTML = '<div class="progress" style="height:6px"><i style="width:0"></i></div><span class="small"></span>';
    i.closest('.field').insertBefore(wrap, i.closest('.field').querySelector('.err'));
    i.addEventListener('input', function () { var s = strength(i.value), bar = wrap.querySelector('i'); bar.style.width = (i.value ? Math.max(s, 1) * 25 : 0) + '%'; bar.style.background = ['', 'var(--danger)', 'var(--warning)', 'var(--green-500)', 'var(--success)'][i.value ? Math.max(s, 1) : 0]; wrap.querySelector('span').textContent = i.value ? ['', 'Weak', 'Fair', 'Good', 'Strong'][Math.max(s, 1)] + ' — use 8+ characters with letters and numbers' : ''; });
  }
  function safeNext() { var n = qp.get('next'); return n && /^[a-z0-9-]+\.html(\?[^#]*)?$/i.test(n) ? n : null; }
  function wire(form, handler, opts) {
    U.bindForm(form, async function (d, f) { try { return await handler(d, f); } catch (err) { sad(); throw err; } }, opts);
    form.addEventListener('submit', function () { setTimeout(function () { if (form.querySelector('.field.invalid')) sad(); }, 0); });
  }
  async function welcomeBack(name, dest) {
    happy();
    var o = document.createElement('div'); o.className = 'welcome-back'; o.setAttribute('role', 'status');
    o.innerHTML = '<div><img src="' + logo() + '" alt=""><h2>Welcome back, ' + U.esc(name) + '!</h2><p>Preparing your dashboard…</p><div class="bar"><i></i></div></div>';
    document.body.appendChild(o);
    setTimeout(function () { location.href = dest; }, reduce ? 700 : 1600);
  }

  function resendBox(anchor, email) {
    var old = document.getElementById('resendBox'); if (old) old.remove();
    var box = document.createElement('div'); box.id = 'resendBox'; box.className = 'center mt';
    box.innerHTML = '<button type="button" class="btn btn-ghost" id="resendBtn">Resend verification email</button><p class="muted" id="resendMsg" style="margin-top:8px"></p>';
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
    var btn = box.querySelector('#resendBtn'), msg = box.querySelector('#resendMsg');
    btn.addEventListener('click', async function () {
      btn.disabled = true; msg.textContent = 'Sending…';
      try { var j = await Api.post('../api/auth/resend-verification', { email: email }); msg.textContent = j.message || 'A new link has been sent. Please check your inbox and spam folder.'; }
      catch (e) { msg.textContent = (e && e.message) || 'Could not send the email. Please try again.'; }
      setTimeout(function () { btn.disabled = false; }, 30000);
    });
  }

  var VIEWS = {
    login: function () {
      var msg = qp.get('out') ? html`<div class="banner ok">${U.icon('check')} You have been logged out.</div>` : qp.get('expired') ? html`<div class="banner warn">${U.icon('clock')} Your session expired. Please log in again.</div>` : qp.get('reset') ? html`<div class="banner ok">${U.icon('check')} Password updated. Please log in.</div>` : qp.get('verify') ? html`<div class="banner info" id="verifyMsg">${U.icon('mail')} Verifying your email…</div>` : '';
      return {
        title: 'Log in',
        html: html`<h1>Ready to Dive in?</h1><p class="muted">Enter your credentials to continue</p>${offlineNote ? html`<div class="banner warn">${U.icon('wifi-off')} <span>No internet connection. Logging in needs internet the first time on this device. After that, the app opens and records expenses offline.</span></div>` : ''}${msg}
          <form id="f" class="stack">${U.fields([{ name: 'email', label: 'Email address', type: 'email', required: true, autocomplete: 'username', full: true }, { name: 'password', label: 'Password', type: 'password', required: true, full: true }])}
          <p class="au-forgot"><a href="forgot-password.html">Forgot password?</a></p>
          <button class="btn btn-primary" type="submit">Log in</button>
          <a class="btn btn-ghost" href="index.html">← Back to website</a></form>
          ${pub.registration_open === false ? '' : html`<p class="center mt">New here? <a href="register.html">Create a free account</a></p>`}`,
        after: function () {
          wire($('#f'), async function (d) {
            try { await Api.post('../api/auth/login', { email: d.email, password: d.password }); }
            catch (err) { if (err && err.offline) err.message = 'No internet connection. Logging in needs internet the first time on this device. Once you are logged in, the app works offline.'; if (err && err.code === 'verify') resendBox($('#f'), d.email); throw err; }
            var t = await Api.csrf(), me = (await Api.get('../api/auth/me')).data; Api.setCsrf(me.csrf || t);
            welcomeBack(me.user.name, me.user.role === 'super_admin' ? 'admin-dashboard.html' : (safeNext() || 'dashboard.html'));
          }, { busyText: 'Logging in…' });
          if (qp.get('verify')) Api.post('../api/auth/verify', { token: qp.get('verify') }).then(function (j) { var m = $('#verifyMsg'); if (m) { m.className = 'banner ok'; m.innerHTML = U.icon('check') + ' ' + U.esc(j.message); } }).catch(function (e) { var m = $('#verifyMsg'); if (m) { m.className = 'banner danger'; m.innerHTML = U.icon('alert') + ' ' + U.esc(e.message); } });
        }
      };
    },
    register: function () {
      if (pub.registration_open === false) return { title: 'Registration closed', html: html`<h1>Registration closed</h1><p class="muted">New registrations are temporarily closed. Please check back soon.</p><a class="btn btn-primary" href="login.html" style="margin-top:14px">Back to login</a>` };
      var days = pub.trial_days || 30;
      return {
        title: 'Create account',
        html: html`<h1>Create your account</h1><p class="muted">Start your <b>${days}-day free trial</b>. No card needed.</p>
          <form id="f" class="stack">${U.fields([
            { name: 'full_name', label: 'Full name', required: true, autocomplete: 'name', full: true },
            { name: 'email', label: 'Email address', type: 'email', required: true, autocomplete: 'email', full: true },
            { name: 'phone', label: 'Phone number', type: 'tel', required: true, autocomplete: 'tel', placeholder: '0712 345 678', full: true },
            { name: 'password', label: 'Password', type: 'password', required: true, autocomplete: 'new-password', full: true },
            { name: 'confirm_password', label: 'Confirm password', type: 'password', required: true, autocomplete: 'new-password', full: true },
            { name: 'accept_terms', label: U.raw('I agree to the <a href="terms.html" target="_blank" rel="noopener">Terms</a> and <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>'), type: 'checkbox', full: true }])}
          <button class="btn btn-primary" type="submit">Create account</button></form>
          <p class="center mt">Already registered? <a href="login.html">Log in</a></p>`,
        after: function () {
          var f = $('#f'); strengthMeter(f, 'password');
          wire(f, async function (d) {
            var j = await Api.post('../api/auth/register', d);
            if (j.data && j.data.needs_verification) { happy(); U.mount($('#auBody'), html`<div class="center">${U.savedCheck()}<h1>Check your email</h1><p class="muted">We sent a verification link to <b>${d.email}</b>. Open it to activate your account. Check your spam folder if you do not see it.</p><a class="btn btn-primary" href="login.html" style="margin-top:14px">Go to login</a><div id="resendAnchor"></div></div>`); resendBox($('#resendAnchor'), d.email); return; }
            await Api.post('../api/auth/login', { email: d.email, password: d.password });
            var me = (await Api.get('../api/auth/me')).data; Api.setCsrf(me.csrf);
            welcomeBack(me.user.name, 'dashboard.html');
          }, { busyText: 'Creating account…' });
        }
      };
    },
    forgot: function () {
      return {
        title: 'Forgot password',
        html: html`<h1>Forgot your password?</h1><p class="muted">Enter your email and we will send you a reset link.</p>
          <form id="f" class="stack">${U.fields([{ name: 'email', label: 'Email address', type: 'email', required: true, full: true }])}<button class="btn btn-primary" type="submit">Send reset link</button></form>
          <p class="center mt"><a href="login.html">Back to login</a></p>`,
        after: function () {
          wire($('#f'), async function (d) { await Api.post('../api/auth/forgot', { email: d.email }); happy(); U.mount($('#auBody'), html`<div class="center">${U.savedCheck()}<h1>Check your email</h1><p class="muted">If an account exists for <b>${d.email}</b>, a reset link is on its way. It expires in 1 hour.</p><a class="btn btn-primary" href="login.html" style="margin-top:14px">Back to login</a></div>`); }, { busyText: 'Sending…' });
        }
      };
    },
    reset: function () {
      var token = qp.get('token') || '';
      if (!token) return { title: 'Reset password', html: html`<h1>Invalid link</h1><p class="muted">This reset link is missing or invalid.</p><a class="btn btn-primary" href="forgot-password.html" style="margin-top:14px">Request a new link</a>` };
      return {
        title: 'Reset password',
        html: html`<h1>Choose a new password</h1><p class="muted">Pick something strong that you will remember.</p>
          <form id="f" class="stack">${U.fields([{ name: 'password', label: 'New password', type: 'password', required: true, autocomplete: 'new-password', full: true }, { name: 'confirm_password', label: 'Confirm new password', type: 'password', required: true, autocomplete: 'new-password', full: true }])}<button class="btn btn-primary" type="submit">Update password</button></form>`,
        after: function () {
          var f = $('#f'); strengthMeter(f, 'password');
          wire(f, async function (d) { await Api.post('../api/auth/reset', { token: token, password: d.password, confirm_password: d.confirm_password }); happy(); setTimeout(function () { qp = new URLSearchParams('reset=1'); go('login', true); }, 700); }, { busyText: 'Updating…' });
        }
      };
    }
  };

  function mountView(view, dir) {
    var v = (VIEWS[view] || VIEWS.login)(); cur = view; document.title = v.title + ' · BudgetFlow';
    var body = $('#auBody'); U.mount(body, v.html); setHero(view);
    body.className = 'au-body'; if (!reduce) { void body.offsetWidth; body.classList.add('walk-' + (dir || 'up')); setTimeout(function () { body.classList.remove('walk-up', 'walk-fwd', 'walk-back'); }, 1500); }
    if (v.after) v.after();
    if (fine) { var i = body.querySelector('input:not([type=hidden])'); if (i) try { i.focus({ preventScroll: true }); } catch (e) { i.focus(); } }
  }

  /* Switch pages in place: the card slides away, the camera pans, speed lines streak past, the next card slides in. */
  function go(to, push) {
    if (busy || to === cur) return;
    var dir = ORDER[to] > ORDER[cur] ? 'fwd' : 'back';
    if (push) { try { history.pushState({ v: to }, '', FILE[to]); } catch (e) { location.href = FILE[to]; return; } }
    if (reduce) { mountView(to, dir); return; }
    busy = true; var card = $('#auCard');
    card.classList.remove('first'); card.classList.add('out-' + dir); heroOut(); mood('hop', 700);
    scene.classList.remove('go-fwd', 'go-back'); void scene.offsetWidth; scene.classList.add('go-' + dir); setTimeout(function () { scene.classList.remove('go-' + dir); }, 1000);
    st.cam = ORDER[to] * -80; schedule(); gaze(dir === 'fwd' ? 5 : -5, 0);
    setTimeout(function () {
      mountView(to, dir); card.classList.remove('out-' + dir); card.classList.add('in-' + dir);
      setTimeout(function () { card.classList.remove('in-' + dir); busy = false; }, 700);
    }, 260);
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]'); if (!a || a.target === '_blank' || !a.closest('.au-wrap')) return;
    var to = FROM_FILE[(a.getAttribute('href') || '').split('#')[0].split('?')[0]];
    if (!to || to === 'reset') return;
    e.preventDefault(); qp = new URLSearchParams(''); go(to, true);
  });
  window.addEventListener('popstate', function () { var v = FROM_FILE[location.pathname.split('/').pop() || 'login.html']; if (v) { qp = new URLSearchParams(location.search); go(v, false); } });

  async function init() {
    buildShell();
    st.cam = ORDER[cur] * -80; applyScene();
    var pubReq = Api.get('../api/settings/public').then(function (j) { pub = j.data || {}; }).catch(function () {});
    var meReq = Api.get('../api/auth/me').then(function (me) { Api.setCsrf(me.data.csrf); if (me.data.authenticated && !qp.get('out') && startPage !== 'reset') { location.replace(me.data.user.role === 'super_admin' ? 'admin-dashboard.html' : 'dashboard.html'); return true; } return false; }).catch(function (e) {
      if (!(e && e.offline)) return false;
      // No connection: someone who already signed in on this device goes straight to the app (offline mode); nobody else can be verified.
      var c = null; try { c = JSON.parse(localStorage.getItem('et_me_cache') || 'null'); } catch (x) {}
      if (c && c.user && !qp.get('out') && startPage !== 'reset') { location.replace(c.user.role === 'super_admin' ? 'admin-dashboard.html' : 'dashboard.html'); return true; }
      offlineNote = true; return false;
    });
    await pubReq; if (await meReq) return;
    var lg = $('.au-brand img'); if (lg) lg.src = logo();
    mountView(cur, 'up');
  }
  init();
})();
