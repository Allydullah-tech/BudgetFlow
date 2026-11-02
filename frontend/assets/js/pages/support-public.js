/* Public Help & support desk: opens for anyone (no account needed). Contact details come from the Super Admin settings. */
(function () {
  'use strict';
  var U = window.UI, html = U.html;
  var FAQ = [
    ['How do I create an account?', 'Tap “Create account”, enter your details and you can start recording right away. New accounts get a free trial.'],
    ['What happens when my free trial ends?', 'You can still log in and record expenses, and none of your data is deleted. Reports, analytics and other advanced features unlock again when you renew.'],
    ['How do I pay for a subscription?', 'Log in, open Subscription, send the payment using one of the listed methods, then submit the transaction reference. Payments are reviewed and approved manually; you will be notified.'],
    ['Can I use the app without internet?', 'Yes for recording expenses and income. They are saved on your device and sync automatically when you are back online. Reports and other pages need a connection.'],
    ['How do I install the app on my phone?', 'Open Settings → Install the app. On Android tap Install; on iPhone use Share → Add to Home Screen.'],
    ['I forgot my password.', 'Use “Forgot password?” on the login page and we will email you a reset link.']
  ];
  function logo() { return 'assets/images/logo.png'; }
  async function load() {
    try { return (await Api.get('../api/support')).data || {}; } catch (e) { return null; }
  }
  async function boot() {
    var root = document.getElementById('app');
    var c = await load();
    var has = c && (c.phone || c.email || c.whatsapp), wa = String((c && c.whatsapp) || '').replace(/[^0-9]/g, '');
    U.mount(root, html`
      <header class="topbar">
        <a class="brand" href="index.html" style="display:flex;align-items:center;gap:10px;color:var(--heading) !important;text-decoration:none"><img src="${logo()}" alt="" width="40" height="40"><b style="color:var(--heading)">BudgetFlow</b></a>
        <div class="grow"></div>
        <a class="btn btn-ghost btn-sm" href="index.html">Home</a>
        <a class="btn btn-ghost btn-sm" href="register.html">Create account</a>
        <a class="btn btn-primary btn-sm" href="login.html">Log in</a>
      </header>
      <main class="content" id="main" style="max-width:1100px;margin:0 auto">
        <div class="page-head"><div><h2>Help &amp; support</h2><p>Answers to common questions and ways to reach us. No account needed.</p></div></div>
        <div class="grid cols-2"><div class="card"><h3>Contact support</h3>${c === null ? html`<p class="muted">Could not load the contact details. Check your connection and try again.</p><button class="btn btn-primary btn-sm" onclick="location.reload()">Retry</button>` : has ? html`<div class="stack">
          ${c.phone ? html`<div class="txn"><div class="ti">${U.icon('phone')}</div><div class="meta"><b>Phone</b><span class="small muted">${c.phone}</span></div><a class="btn btn-ghost btn-sm" href="tel:${c.phone.replace(/\s/g, '')}">Call</a></div>` : ''}
          ${wa ? html`<div class="txn"><div class="ti">${U.icon('mail')}</div><div class="meta"><b>WhatsApp</b><span class="small muted">${c.whatsapp}</span></div><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://wa.me/${wa}">Chat</a></div>` : ''}
          ${c.email ? html`<div class="txn"><div class="ti">${U.icon('mail')}</div><div class="meta"><b>Email</b><span class="small muted">${c.email}</span></div><a class="btn btn-ghost btn-sm" href="mailto:${c.email}">Write</a></div>` : ''}</div>${c.hours ? html`<p class="small muted mt">${U.icon('clock')} ${c.hours}</p>` : ''}` : html`<p class="muted">Support contact details have not been added yet.</p>`}
          ${c && c.help_text ? html`<p class="mt">${c.help_text}</p>` : ''}</div>
        <div class="card"><h3>New here?</h3><p class="muted">You do not need an account to ask for help. If you would like to try BudgetFlow, creating an account is free to start.</p><div class="row"><a class="btn btn-gold" href="register.html">Create account</a><a class="btn btn-ghost" href="login.html">Log in</a></div></div></div>
        <div class="card mt faq"><h3>Frequently asked questions</h3>${FAQ.map(function (f) { return html`<details><summary>${f[0]}</summary><p>${f[1]}</p></details>`; })}</div>
      </main>
      <footer class="l-footer" style="margin-top:32px"><div class="in" style="justify-content:center;text-align:center"><div><img class="mt" src="assets/images/mabumbatech-logo.png" alt="MABUMBATECH"><p style="margin:6px 0 0">Developed with care by <a class="mt-link" href="https://www.mabumbatech.co.tz" target="_blank" rel="noopener noreferrer">MABUMBATECH</a></p></div></div><p class="copy">© ${new Date().getFullYear()} MABUMBATECH. All rights reserved.</p></footer>`);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
