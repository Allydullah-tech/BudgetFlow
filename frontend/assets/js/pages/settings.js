/* Settings (preferences, install, offline entries) and Profile (details, photo, password, export, delete). */
(function () {
  'use strict';
  var U = window.UI, html = U.html, $ = U.$;

  async function settings(view, App) {
    var s = (await Api.get('../api/settings/me')).data, zones = ['Africa/Dar_es_Salaam', 'Africa/Nairobi', 'Africa/Kampala', 'Africa/Kigali', 'Africa/Johannesburg', 'UTC'];
    if (zones.indexOf(s.timezone) < 0) zones.unshift(s.timezone);
    var q = Api.queue.all();
    U.mount(view, html`${App.pageHead('Settings', 'Make the app work the way you like.')}
      <div class="grid cols-2"><div class="card"><h3>Preferences</h3><form id="sf" class="stack">${U.fields([
        { name: 'theme', label: 'Appearance', type: 'select', value: s.theme, options: [{ value: 'system', label: 'Match my device' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }], full: true },
        { name: 'date_format', label: 'Date format', type: 'select', value: s.date_format, options: [{ value: 'd M Y', label: '19 Oct 2026' }, { value: 'd/m/Y', label: '19/10/2026' }, { value: 'Y-m-d', label: '2026-10-19' }, { value: 'm/d/Y', label: '10/19/2026' }], full: true },
        { name: 'timezone', label: 'Time zone', type: 'select', value: s.timezone, options: zones.map(function (z) { return { value: z, label: z.replace('_', ' ') }; }), full: true },
        { name: 'notify_budget', label: 'Budget alerts', type: 'checkbox', value: s.notify_budget == 1, full: true }, { name: 'notify_debt', label: 'Debt due-date reminders', type: 'checkbox', value: s.notify_debt == 1, full: true },
        { name: 'notify_recurring', label: 'Recurring item reminders', type: 'checkbox', value: s.notify_recurring == 1, full: true }, { name: 'notify_savings', label: 'Savings milestones', type: 'checkbox', value: s.notify_savings == 1, full: true }])}
        <button class="btn btn-primary" type="submit">Save settings</button></form></div>
      <div class="stack"><div class="card" id="installCard"><h3>Install the app</h3><div id="installBody"></div></div>
        <div class="card"><h3>Offline entries</h3>${q.length ? html`<p class="small muted">These entries are saved on this device and will sync when you are online.</p><ul class="mini-list">${q.map(function (x) { return html`<li><span>${x.body.title}<br><span class="small muted">${x.rejected ? 'Rejected: ' + x.error : 'Waiting to sync'}</span></span><b class="num">${U.money(x.body.amount)}</b></li>`; })}</ul><div class="row"><button class="btn btn-gold btn-sm" id="syncBtn">Sync now</button><button class="btn btn-ghost btn-sm" id="clearQ">Discard all</button></div>` : html`<p class="muted">Nothing waiting. Entries recorded while offline appear here until they sync.</p>`}</div></div></div>`);
    function drawInstall() {
      var b = $('#installBody'); if (!b) return;
      if (PWA.isStandalone()) U.mount(b, html`<p>${U.icon('check')} The app is installed on this device.</p>`);
      else if (PWA.canInstall()) U.mount(b, html`<p class="muted">Get quick, full-screen access from your home screen or desktop, even offline.</p><button class="btn btn-gold" id="inst">${U.icon('download')} Install BudgetFlow</button>`);
      else if (PWA.isIOS) U.mount(b, html`<p class="muted">On iPhone or iPad: tap the <b>Share</b> button, then <b>Add to Home Screen</b>.</p>`);
      else U.mount(b, html`<p class="muted">Your browser will offer to install the app when it is ready (look for an install icon in the address bar, or “Add to Home screen” in the menu). Installing requires a secure (HTTPS) connection.</p>`);
      var i = $('#inst'); if (i) i.onclick = async function () { await PWA.install(); drawInstall(); };
    }
    drawInstall(); document.addEventListener('et:installable', drawInstall, { once: true });
    U.bindForm($('#sf'), async function (v) { await Api.put('../api/settings/me', v); App.me.settings = v; Theme.set(v.theme); U.toast('Settings saved.'); });
    var sy = $('#syncBtn'); if (sy) sy.onclick = async function () { await PWA.sync(true); App.refresh(); };
    var cq = $('#clearQ'); if (cq) cq.onclick = async function () { if (await U.confirm({ title: 'Discard offline entries?', message: 'These entries have not reached the server and will be lost.', confirmText: 'Discard', danger: true })) { Api.queue.clear(); App.refresh(); } };
  }

  async function profile(view, App) {
    var p = (await Api.get('../api/profile')).data, admin = p.role === 'super_admin';
    U.mount(view, html`${App.pageHead('My profile', 'Your personal details and security.')}
      <div class="grid cols-2"><div class="stack"><div class="card"><div class="row"><div class="avatar" style="width:64px;height:64px;font-size:1.4rem" id="av">${App.me.user.has_avatar ? html`<img src="${Api.url('../api/profile/avatar')}?t=${Date.now()}" alt="">` : p.full_name.charAt(0).toUpperCase()}</div><div class="grow"><b>${p.full_name}</b><div class="small muted">Member since ${U.date(String(p.created_at).slice(0, 10))}</div></div><label class="btn btn-ghost btn-sm" for="avf" style="cursor:pointer">Change photo</label><input type="file" id="avf" accept="image/png,image/jpeg,image/webp" class="sr-only"></div></div>
        <div class="card"><h3>Personal details</h3><form id="pf" class="stack">${U.fields([{ name: 'full_name', label: 'Full name', required: true, value: p.full_name, full: true }, { name: 'email', label: 'Email address', type: 'email', required: true, value: p.email, full: true }, { name: 'phone', label: 'Phone number', type: 'tel', required: true, value: p.phone, full: true }, { name: 'current_password', label: 'Current password (only needed to change your email)', type: 'password', full: true }])}<button class="btn btn-primary" type="submit">Save details</button></form></div></div>
      <div class="stack"><div class="card"><h3>Change password</h3><form id="pw" class="stack">${U.fields([{ name: 'current_password', label: 'Current password', type: 'password', required: true, full: true }, { name: 'new_password', label: 'New password', type: 'password', required: true, autocomplete: 'new-password', full: true, hint: 'At least 8 characters with letters and numbers.' }, { name: 'confirm_password', label: 'Confirm new password', type: 'password', required: true, autocomplete: 'new-password', full: true }])}<button class="btn btn-primary" type="submit">Update password</button></form></div>
        ${admin ? '' : html`<div class="card"><h3>Your data</h3><p class="small muted">Download everything stored for your account, or permanently delete it.</p><div class="row"><a class="btn btn-ghost" href="${Api.url('../api/profile/export')}">${U.icon('download')} Export my data</a><button class="btn btn-ghost" id="delAcc" style="color:var(--danger)">${U.icon('trash')} Delete my account</button></div></div>`}</div></div>`);
    U.bindForm($('#pf'), async function (v) { await Api.put('../api/profile', v); U.toast('Profile saved.'); App.me.user.name = v.full_name; });
    U.bindForm($('#pw'), async function (v, f) { await Api.post('../api/profile/password', v); U.toast('Password changed.'); f.reset(); });
    $('#avf').onchange = async function (e) { var f = e.target.files[0]; if (!f) return; var fd = new FormData(); fd.append('image', f); try { await Api.upload('../api/profile/avatar', fd); U.toast('Photo updated.'); location.reload(); } catch (er) { U.toast(er.message, 'error'); } };
    var del = $('#delAcc'); if (del) del.onclick = function () {
      var m = U.modal({ title: 'Delete your account', body: html`<p class="small">This permanently erases your accounts, transactions, debts, budgets and savings. <b>This cannot be undone.</b> Consider exporting your data first.</p><form id="df" class="stack">${U.fields([{ name: 'password', label: 'Your password', type: 'password', required: true, full: true }, { name: 'confirm', label: 'Type DELETE to confirm', required: true, full: true }])}<div class="modal-foot" style="padding:12px 0 0"><button class="btn btn-ghost" type="button" data-close>Keep my account</button><button class="btn btn-primary" type="submit" style="background:var(--danger)">Delete everything</button></div></form>` });
      U.bindForm($('#df', m.el), async function (v) { await Api.post('../api/profile/delete', v); Api.queue.clear(); location.href = 'index.html?deleted=1'; });
    };
  }

  App.page('settings', { title: 'Settings', feature: 'settings', render: settings });
  App.page('profile', { title: 'My profile', feature: 'profile', shared: true, render: profile });
})();
