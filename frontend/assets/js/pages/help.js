/* Help centre. Contact details come from the Super Admin settings; nothing is hard-coded. */
(function () {
  'use strict';
  var U = window.UI, html = U.html;
  var FAQ = [
    ['How do I record an expense or income?', 'Tap the + button (or “Add expense” on the dashboard), enter the amount and a short title, choose a category and account, then save. Everything else is optional.'],
    ['Is a transfer between my accounts counted as income or expense?', 'No. Transfers only move money between your own accounts, so your income and expense reports are not affected.'],
    ['How are debts counted?', 'Borrowing or lending money changes your account balance but is not income or an expense. When you repay a debt, only the interest part is counted as an expense (or as income if you received interest).'],
    ['What happens when my free trial ends?', 'You can still log in and record expenses, and none of your data is deleted. Reports, analytics and other advanced features unlock again when you renew.'],
    ['How do I pay for a subscription?', 'Open Subscription, send the payment using one of the listed methods, then submit the transaction reference. Payments are reviewed and approved manually; you will be notified.'],
    ['Can I use the app without internet?', 'Yes for recording expenses and income. They are saved on your device and sync automatically when you are back online. Reports and other pages need a connection.'],
    ['How do I install the app on my phone?', 'Open Settings → Install the app. On Android tap Install; on iPhone use Share → Add to Home Screen.'],
    ['I made a mistake. Can I delete an entry?', 'Entries are reversed rather than erased, so your history stays accurate. The reversed entry no longer counts in your balances or reports.'],
    ['I forgot my password.', 'Use “Forgot password?” on the login page and we will email you a reset link.']
  ];
  async function render(view, App) {
    var c = (await Api.get('../api/support')).data, has = c.phone || c.email || c.whatsapp, wa = String(c.whatsapp || '').replace(/[^0-9]/g, '');
    U.mount(view, html`${App.pageHead('Help & support', 'Answers to common questions and ways to reach us.')}
      <div class="grid cols-2"><div class="card"><h3>Contact support</h3>${has ? html`<div class="stack">
        ${c.phone ? html`<div class="txn"><div class="ti">${U.icon('phone')}</div><div class="meta"><b>Phone</b><span class="small muted">${c.phone}</span></div><a class="btn btn-ghost btn-sm" href="tel:${c.phone.replace(/\s/g, '')}">Call</a></div>` : ''}
        ${wa ? html`<div class="txn"><div class="ti">${U.icon('mail')}</div><div class="meta"><b>WhatsApp</b><span class="small muted">${c.whatsapp}</span></div><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://wa.me/${wa}">Chat</a></div>` : ''}
        ${c.email ? html`<div class="txn"><div class="ti">${U.icon('mail')}</div><div class="meta"><b>Email</b><span class="small muted">${c.email}</span></div><a class="btn btn-ghost btn-sm" href="mailto:${c.email}">Write</a></div>` : ''}</div>${c.hours ? html`<p class="small muted mt">${U.icon('clock')} ${c.hours}</p>` : ''}` : html`<p class="muted">Support contact details have not been added yet.</p>`}
        ${c.help_text ? html`<p class="mt">${c.help_text}</p>` : ''}</div>
      <div class="card"><h3>Quick start</h3><ol style="padding-left:18px;margin:0"><li style="margin-bottom:8px">Check your accounts (a Cash account is created for you).</li><li style="margin-bottom:8px">Add your first expense or income with the + button.</li><li style="margin-bottom:8px">Create a monthly budget to get spending alerts.</li><li style="margin-bottom:8px">Set a savings goal and add money to it over time.</li><li>Open Reports to see where your money goes.</li></ol></div></div>
      <div class="card mt faq"><h3>Frequently asked questions</h3>${FAQ.map(function (f) { return html`<details><summary>${f[0]}</summary><p>${f[1]}</p></details>`; })}</div>`);
  }
  App.page('help', { title: 'Help & support', feature: 'support', shared: true, public: true, render: render });
})();
