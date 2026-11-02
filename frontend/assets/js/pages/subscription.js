/* Subscription: status, manual payment instructions (methods + QR), payment submission, history. */
(function () {
  'use strict';
  var U = window.UI, html = U.html, $ = U.$;
  async function render(view, App) {
    var r = await Promise.all([Api.get('../api/subscriptions/status'), Api.get('../api/payments')]), d = r[0].data, pays = r[1].data.items, s = d.subscription;
    var plan = d.plans[0] || s.plan, banner = '';
    if (s.status === 'expired') banner = html`<div class="banner danger">${U.icon('alert')}<div class="grow"><b>Your subscription has expired.</b> ${d.expired_message || 'Renew to restore full access. Your data is safe.'}</div></div>`;
    var pending = pays.filter(function (p) { return p.status === 'pending'; }).length;
    U.mount(view, html`${App.pageHead('Subscription', 'Your plan, payments and billing history.')}${banner}
      <div class="grid cols-3 mb stagger">
        <div class="card stat"><div class="label">Status</div><div class="value" style="white-space:normal">${U.badge(s.display_status || s.status, s.label)}</div><div class="small muted">${s.in_trial && s.status !== 'active' ? 'Free trial' : 'Paid plan'}${pending ? ' · ' + pending + ' payment awaiting review' : ''}</div></div>
        <div class="card stat"><div class="label">${s.status === 'expired' ? 'Expired on' : 'Valid until'}</div><div class="value">${s.ends_at ? U.date(String(s.ends_at).slice(0, 10)) : '—'}</div><div class="small muted">${s.status === 'expired' ? 'Data kept safely' : s.days_remaining + ' day' + (s.days_remaining === 1 ? '' : 's') + ' remaining'}</div></div>
        <div class="card stat"><div class="label">${plan ? plan.name + ' plan' : 'Plan'}</div><div class="value">${plan ? U.money(plan.price) : '—'}</div><div class="small muted">per ${plan && plan.period_months > 1 ? plan.period_months + ' months' : 'month'}</div></div></div>
      <div class="grid cols-2">
        <div class="card"><h3>1. Send your payment</h3><p class="small muted">Pay <b>${plan ? U.money(plan.price) : ''}</b> using any method below, then tell us about it in step 2.</p>
          ${d.methods.length ? d.methods.map(function (m) { return html`<div class="card" style="margin-top:12px;background:var(--surface-2)"><div class="row spread"><b>${m.name}</b>${U.badge('info', U.label(m.kind))}</div>
            <dl class="kv" style="margin-top:8px">${m.provider ? html`<dt>Provider</dt><dd>${m.provider}</dd>` : ''}${m.recipient_name ? html`<dt>Account name</dt><dd>${m.recipient_name}</dd>` : ''}<dt>Number</dt><dd><span class="copy-box">${m.account_number}</span> <button class="icon-btn" style="width:34px;height:34px;display:inline-grid" data-copy="${m.account_number}" aria-label="Copy number">${U.icon('copy')}</button></dd></dl>
            ${m.instructions ? html`<p class="small muted" style="margin:8px 0 0">${m.instructions}</p>` : ''}${m.has_qr == 1 ? html`<div class="center" style="margin-top:10px"><img src="${Api.url('../api/subscriptions/qr/' + m.id)}" alt="QR code for ${m.name}" style="width:170px;height:170px;object-fit:contain;background:#fff;border-radius:12px;padding:8px;border:1px solid var(--border)"></div>` : ''}</div>`; })
          : html`<div class="empty">Payment methods have not been set up yet. Please contact support from the Help page.</div>`}</div>
        <div class="card"><h3>2. Tell us you paid</h3>${d.methods.length ? html`<form id="pf" class="stack">${U.fields([
          { name: 'plan_id', label: 'Plan', type: 'select', required: true, options: d.plans.map(function (p) { return { value: p.id, label: p.name + ' · ' + U.money(p.price) }; }) },
          { name: 'method_id', label: 'Method used', type: 'select', required: true, options: d.methods.map(function (m) { return { value: m.id, label: m.name }; }) },
          { name: 'amount', label: 'Amount paid (TZS)', type: 'amount', required: true, value: plan ? Number(plan.price).toLocaleString('en-US') : '' },
          { name: 'reference', label: 'Transaction reference / code', required: true, placeholder: 'e.g. the M-Pesa confirmation code' },
          { name: 'pay_date', label: 'Payment date', type: 'date', required: true, value: U.today(), max: U.today() },
          { name: 'receipt', label: 'Screenshot or receipt (optional)', type: 'file', attrs: 'accept="image/*,application/pdf"' },
          { name: 'notes', label: 'Notes (optional)', type: 'textarea', full: true }])}
          <button class="btn btn-gold" type="submit">Submit payment details</button><p class="small muted">Payments are checked manually and normally approved quickly. You will get a notification when it is reviewed.</p></form>` : html`<p class="muted">Unavailable until payment methods are configured.</p>`}</div></div>
      <div class="card mt"><h3>Payment history</h3>${U.table([
        { label: 'Submitted', render: function (p) { return U.datetime(p.created_at); } }, { label: 'Plan', render: function (p) { return p.plan_name; } }, { label: 'Method', render: function (p) { return p.method_name; } }, { label: 'Reference', render: function (p) { return p.reference; } },
        { label: 'Amount', align: 'right', render: function (p) { return U.money(p.amount); } },
        { label: 'Status', render: function (p) { return html`${U.badge(p.status)}${p.status === 'rejected' && p.reject_reason ? html`<div class="small muted">${p.reject_reason}</div>` : ''}`; } },
        { label: '', cls: 'actions', render: function (p) { return p.has_receipt == 1 ? html`<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${Api.url('../api/payments/receipt/' + p.id)}">Receipt</a>` : ''; } }], pays, { emptyTitle: 'No payments yet', emptyText: 'Payments you submit will appear here with their review status.' })}</div>
      ${d.history.length ? html`<div class="card mt"><h3>Subscription periods</h3>${U.table([{ label: 'From', render: function (h) { return U.date(String(h.starts_at).slice(0, 10)); } }, { label: 'Until', render: function (h) { return U.date(String(h.ends_at).slice(0, 10)); } }, { label: 'Plan', render: function (h) { return h.plan_name || '—'; } }, { label: 'Source', render: function (h) { return U.label(h.source); } }, { label: 'Note', render: function (h) { return h.note || ''; } }], d.history)}</div>` : ''}`);
    Motion.scan(view);
    U.on(view, 'click', '[data-copy]', async function (e, b) { try { await navigator.clipboard.writeText(b.dataset.copy); U.toast('Number copied.'); } catch (er) { U.toast('Select the number and copy it manually.', 'warn'); } });
    var f = $('#pf', view);
    if (f) U.bindForm(f, async function (v) {
      var fd = new FormData(); ['plan_id', 'method_id', 'amount', 'reference', 'pay_date', 'notes'].forEach(function (k) { fd.append(k, v[k] || ''); });
      var file = $('[name=receipt]', f).files[0]; if (file) fd.append('receipt', file);
      var j = await Api.upload('../api/payments', fd); U.toast(j.message); App.refresh();
    }, { busyText: 'Submitting…' });
  }
  App.page('subscription', { title: 'Subscription', feature: 'subscription', render: render });
})();
