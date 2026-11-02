/* Super Admin panel. Platform data only: customers' private financial records are never loaded here. */
(function () {
  'use strict';
  var U = window.UI, html = U.html, $ = U.$, API = Api.url('../api/superadmin');
  var RANGES = [['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['last_month', 'Last month'], ['year', 'This year'], ['last_year', 'Last year'], ['custom', 'Custom']];
  function rangeBar(st, run) {
    return html`<div class="toolbar"><select class="input" id="rg" aria-label="Period">${RANGES.map(function (r) { return html`<option value="${r[0]}" ${st.range === r[0] ? U.raw('selected') : ''}>${r[1]}</option>`; })}</select><span class="row ${st.range === 'custom' ? '' : 'hide'}" id="cu"><input class="input" type="date" id="rf" value="${st.from || ''}" aria-label="From"><input class="input" type="date" id="rt" value="${st.to || ''}" aria-label="To"></span><button class="btn btn-ghost" id="rg-go">Apply</button></div>`;
  }
  function bindRange(st, run) {
    $('#rg').onchange = function (e) { st.range = e.target.value; $('#cu').classList.toggle('hide', st.range !== 'custom'); if (st.range !== 'custom') run(); };
    $('#rf').onchange = function (e) { st.from = e.target.value; }; $('#rt').onchange = function (e) { st.to = e.target.value; }; $('#rg-go').onclick = run;
  }
  function stat(label, v, o) { o = o || {}; return html`<div class="card stat ${o.cls || ''}"><div class="label"><span class="ico">${U.icon(o.icon || 'chart')}</span>${label}</div><div class="value num" ${o.count ? U.raw('data-count="' + U.esc(v) + '" data-fmt="' + (o.fmt || 'int') + '"') : ''}>${o.money ? U.money(v) : (v === null || v === undefined ? '—' : v)}${o.pct && v !== null ? '%' : ''}</div>${o.sub ? html`<div class="small muted">${o.sub}</div>` : ''}</div>`; }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function lab(k) { var p = String(k).split('-'); return p.length === 3 ? parseInt(p[2], 10) + ' ' + MON[+p[1] - 1] : p.length === 2 ? MON[+p[1] - 1] + " '" + p[0].slice(2) : k; }

  /* ---------- Dashboard ---------- */
  async function dashboard(view, App) {
    var st = { range: 'year', from: '', to: '' };
    U.mount(view, html`${App.pageHead('Super Admin dashboard', 'Customers, subscriptions and revenue at a glance.')}${rangeBar(st)}<div id="out">${U.skeleton(3)}</div>`);
    async function run() {
      var d = (await Api.get(API + '/dashboard' + Api.qs(st))).data, c = d.cards, ch = d.charts, out = $('#out');
      U.mount(out, html`${c.pending_payments ? html`<div class="banner warn">${U.icon('clock')}<div class="grow"><b>${c.pending_payments} payment${c.pending_payments > 1 ? 's' : ''} waiting for review.</b></div><a class="btn btn-gold btn-sm" href="admin-payments.html">Review now</a></div>` : ''}
        <div class="grid cols-4 mb stagger">
          ${stat('Total customers', c.total_users, { icon: 'users', count: 1 })}${stat('New in period', c.new_registrations, { icon: 'user', count: 1 })}${stat('On free trial', c.on_trial, { icon: 'clock', count: 1 })}${stat('Active subscriptions', c.active_subscriptions, { icon: 'check', cls: 'income', count: 1 })}
          ${stat('Expired', c.expired, { icon: 'alert', cls: 'expense', count: 1 })}${stat('Pending payments', c.pending_payments, { icon: 'card', count: 1 })}${stat('Approved payments', c.approved_payments, { icon: 'check', count: 1 })}${stat('Rejected payments', c.rejected_payments, { icon: 'x', count: 1 })}
          ${stat('Revenue (period)', c.revenue_range, { icon: 'cash', money: 1, count: 1, fmt: 'money', cls: 'income' })}${stat('Revenue this month', c.revenue_this_month, { icon: 'cash', money: 1, count: 1, fmt: 'money' })}${stat('Total revenue', c.revenue_total, { icon: 'cash', money: 1, count: 1, fmt: 'money' })}${stat('Trial conversion', c.trial_conversion_percent, { icon: 'trend-up', pct: 1, sub: 'Customers who ever paid' })}
          ${stat('Renewal rate', c.renewal_rate_percent, { icon: 'repeat', pct: 1, sub: 'Paid more than once' })}${stat('Approval rate', c.approval_rate_percent, { icon: 'shield', pct: 1, sub: 'Approved of decided' })}</div>
        <div class="grid cols-2"><div class="card"><h3>New registrations</h3><div id="c1"></div></div><div class="card"><h3>Revenue in period</h3><div id="c2"></div></div>
          <div class="card"><h3>Revenue by month (last 12)</h3><div id="c3"></div></div><div class="card"><h3>Subscription status</h3><div id="c4"></div></div>
          <div class="card"><h3>Payment decisions</h3><div id="c5"></div></div><div class="card"><h3>Trial to paid</h3><div id="c6"></div></div></div>`);
      Charts.line($('#c1'), { title: 'Registrations', labels: ch.registrations.map(function (r) { return lab(r.k); }), series: [{ name: 'Customers', values: ch.registrations.map(function (r) { return r.n; }) }] });
      Charts.bars($('#c2'), { title: 'Revenue', labels: ch.revenue.map(function (r) { return lab(r.k); }), series: [{ name: 'Revenue', values: ch.revenue.map(function (r) { return r.total; }), color: 'var(--income)' }] });
      Charts.bars($('#c3'), { title: 'Monthly revenue', labels: ch.monthly_revenue.map(function (r) { return lab(r.k); }), series: [{ name: 'Revenue', values: ch.monthly_revenue.map(function (r) { return r.total; }) }] });
      var s = ch.subscription_status; Charts.donut($('#c4'), { title: 'Status', centerLabel: 'Customers', items: [{ label: 'Trial', value: s.trial_active, color: 'var(--info)' }, { label: 'Active', value: s.active, color: 'var(--success)' }, { label: 'Expiring soon', value: s.expiring_soon, color: 'var(--warning)' }, { label: 'Expired', value: s.expired, color: 'var(--danger)' }] });
      Charts.donut($('#c5'), { title: 'Approvals', centerLabel: 'Payments', items: [{ label: 'Approved', value: ch.approval.approved, color: 'var(--success)' }, { label: 'Rejected', value: ch.approval.rejected, color: 'var(--danger)' }, { label: 'Pending', value: ch.approval.pending, color: 'var(--warning)' }] });
      Charts.donut($('#c6'), { title: 'Conversion', centerLabel: 'Customers', items: [{ label: 'Paid at least once', value: ch.conversion.paid, color: 'var(--success)' }, { label: 'Never paid', value: ch.conversion.never_paid, color: 'var(--muted)' }] });
      Motion.scan(out);
    }
    bindRange(st, run); await run();
  }

  /* ---------- Customers ---------- */
  async function customers(view, App) {
    var st = { q: '', sub_status: '', account_status: '', page: 1 };
    U.mount(view, html`${App.pageHead('Customers', 'Account and subscription status. Customers’ private financial records are not visible here.')}
      <div class="toolbar"><div class="search"><span>${U.icon('search')}</span><input class="input" id="q" type="search" placeholder="Search name, email, phone or ID" aria-label="Search customers"></div>
        <select class="input" id="ss" aria-label="Subscription status"><option value="">Any subscription</option><option value="trial_active">On trial</option><option value="active">Active</option><option value="expiring_soon">Expiring soon</option><option value="expired">Expired</option></select>
        <select class="input" id="as" aria-label="Account status"><option value="">Any account</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="pending_verification">Unverified</option></select></div><div id="list">${U.skeleton(3)}</div><div id="pg"></div>`);
    async function load() {
      var d = (await Api.get(API + '/customers' + Api.qs(st))).data;
      U.mount($('#list'), U.table([
        { label: 'Customer', render: function (r) { return html`<b>${r.full_name}</b><div class="small muted">${r.email}${r.phone ? ' · ' + r.phone : ''}</div>`; } },
        { label: 'Subscription', render: function (r) { return html`${U.badge(r.subscription_status, r.subscription_label)}${r.pending_count > 0 ? html` ${U.badge('pending', 'Payment pending')}` : ''}`; } },
        { label: 'Days left', align: 'right', render: function (r) { return r.days_remaining; } }, { label: 'Total paid', align: 'right', render: function (r) { return U.money(r.total_paid); } },
        { label: 'Registered', render: function (r) { return U.date(String(r.created_at).slice(0, 10)); } }, { label: 'Account', render: function (r) { return U.badge(r.status === 'active' ? 'active' : 'danger', U.label(r.status)); } },
        { label: '', cls: 'actions', render: function (r) { return html`<button class="btn btn-ghost btn-sm" data-open="${r.id}">Manage</button>`; } }], d.items, { emptyTitle: 'No customers found', emptyText: 'Try different filters.' }));
      U.mount($('#pg'), U.pager(d.page, d.pages));
    }
    $('#q').addEventListener('input', U.debounce(function (e) { st.q = e.target.value; st.page = 1; load(); }, 350));
    $('#ss').onchange = function (e) { st.sub_status = e.target.value; st.page = 1; load(); }; $('#as').onchange = function (e) { st.account_status = e.target.value; st.page = 1; load(); };
    U.on(view, 'click', '[data-page]', function (e, b) { if (!b.disabled) { st.page = +b.dataset.page; load(); } });
    U.on(view, 'click', '[data-open]', function (e, b) { detail(+b.dataset.open); });
    async function detail(id) {
      var u = (await Api.get(API + '/customers/' + id)).data, s = u.subscription;
      var m = U.modal({ title: u.full_name, size: 'wide', body: html`<dl class="kv"><dt>Email</dt><dd>${u.email}</dd><dt>Phone</dt><dd>${u.phone || '—'}</dd><dt>Registered</dt><dd>${U.datetime(u.created_at)}</dd><dt>Last login</dt><dd>${u.last_login_at ? U.datetime(u.last_login_at) : 'Never'}</dd><dt>Account</dt><dd>${U.badge(u.status === 'active' ? 'active' : 'danger', U.label(u.status))}</dd><dt>Subscription</dt><dd>${U.badge(s.status, s.label)}</dd><dt>Trial ends</dt><dd>${U.date(String(s.trial_ends_at || '').slice(0, 10))}</dd><dt>Access until</dt><dd>${s.ends_at ? U.date(String(s.ends_at).slice(0, 10)) : '—'} (${s.days_remaining} days)</dd></dl>
        <div class="row mt"><button class="btn btn-gold btn-sm" id="ext">Extend access</button><button class="btn btn-ghost btn-sm" id="msg">${U.icon('mail')} Send message</button>${u.status === 'suspended' ? html`<button class="btn btn-ghost btn-sm" id="act">Re-activate account</button>` : html`<button class="btn btn-ghost btn-sm" id="sus" style="color:var(--danger)">Suspend account</button>`}</div>
        <h3 class="mt">Payments</h3>${u.payments.length ? U.table([{ label: 'Date', render: function (p) { return U.date(p.pay_date); } }, { label: 'Method', render: function (p) { return p.method_name; } }, { label: 'Reference', render: function (p) { return p.reference; } }, { label: 'Amount', align: 'right', render: function (p) { return U.money(p.amount); } }, { label: 'Status', render: function (p) { return U.badge(p.status); } }], u.payments) : html`<p class="muted">No payments.</p>`}
        <h3 class="mt">Subscription periods</h3>${u.subscriptions.length ? U.table([{ label: 'From', render: function (p) { return U.date(String(p.starts_at).slice(0, 10)); } }, { label: 'Until', render: function (p) { return U.date(String(p.ends_at).slice(0, 10)); } }, { label: 'Source', render: function (p) { return U.label(p.source); } }, { label: 'Note', render: function (p) { return p.note || ''; } }], u.subscriptions) : html`<p class="muted">None.</p>`}
        <h3 class="mt">Recent activity</h3>${u.activity.length ? html`<ul class="mini-list">${u.activity.map(function (a) { return html`<li><span>${U.label(a.action)}</span><span class="small muted">${U.datetime(a.created_at)}</span></li>`; })}</ul>` : html`<p class="muted">No activity recorded.</p>`}` });
      function mini(title, fields, path, ok, btn) { m.close(); var mm = U.modal({ title: title, size: 'sm', body: html`<form id="mf" class="stack">${U.fields(fields)}<div class="modal-foot" style="padding:12px 0 0"><button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">${btn}</button></div></form>` }); U.bindForm($('#mf', mm.el), async function (v) { await Api.post(API + '/customers/' + id + '/' + path, v); U.toast(ok); mm.close(); load(); }); }
      var ex = $('#ext', m.el); if (ex) ex.onclick = function () { mini('Extend access', [{ name: 'days', label: 'Days to add', type: 'number', required: true, min: 1, max: 1095, value: 30, full: true }, { name: 'note', label: 'Reason (kept in the audit log)', required: true, full: true }], 'extend', 'Access extended.', 'Extend'); };
      var ms = $('#msg', m.el); if (ms) ms.onclick = function () { mini('Message ' + u.full_name, [{ name: 'title', label: 'Title', required: true, full: true }, { name: 'body', label: 'Message', type: 'textarea', required: true, full: true }], 'notify', 'Message sent.', 'Send'); };
      var su = $('#sus', m.el); if (su) su.onclick = function () { mini('Suspend account', [{ name: 'reason', label: 'Reason (optional)', full: true }], 'suspend', 'Account suspended.', 'Suspend'); };
      var ac = $('#act', m.el); if (ac) ac.onclick = async function () { await Api.post(API + '/customers/' + id + '/activate', {}); U.toast('Account activated.'); m.close(); load(); };
    }
    await load();
  }

  /* ---------- Payments ---------- */
  async function payments(view, App) {
    var st = { status: 'pending' };
    U.mount(view, html`${App.pageHead('Payments', 'Review manual payments. Approving activates the subscription; rejecting notifies the customer.')}<div class="mb">${U.tabs([{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }, { value: '', label: 'All' }], st.status, 'st')}</div><div id="list">${U.skeleton(3)}</div>`);
    async function load() {
      var d = (await Api.get(API + '/payments' + Api.qs({ status: st.status }))).data, byId = {}; d.items.forEach(function (p) { byId[p.id] = p; });
      U.mount($('#list'), U.table([
        { label: 'Submitted', render: function (p) { return U.datetime(p.created_at); } }, { label: 'Customer', render: function (p) { return html`<b>${p.full_name}</b><div class="small muted">${p.email}</div>`; } },
        { label: 'Method / reference', render: function (p) { return html`${p.method_name}<div class="small muted">${p.reference} · paid ${U.date(p.pay_date)}</div>`; } },
        { label: 'Amount', align: 'right', render: function (p) { var diff = Number(p.amount) !== Number(p.plan_price); return html`<b>${U.money(p.amount)}</b>${diff ? html`<div class="small" style="color:var(--warning)">Plan price ${U.money(p.plan_price)}</div>` : ''}`; } },
        { label: 'Status', render: function (p) { return html`${U.badge(p.status)}${p.reject_reason ? html`<div class="small muted">${p.reject_reason}</div>` : ''}${p.reviewer ? html`<div class="small muted">by ${p.reviewer}</div>` : ''}`; } },
        { label: '', cls: 'actions', render: function (p) { return html`${p.has_receipt == 1 ? html`<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${API}/payments/${p.id}/receipt">Receipt</a> ` : ''}${p.status === 'pending' ? html`<button class="btn btn-gold btn-sm" data-ok="${p.id}">Approve</button> <button class="btn btn-ghost btn-sm" data-no="${p.id}">Reject</button>` : ''}`; } }], d.items, { emptyTitle: 'Nothing here', emptyText: st.status === 'pending' ? 'No payments are waiting for review.' : 'No payments match this filter.' }));
      U.on($('#list'), 'click', '[data-ok]', async function (e, b) { var p = byId[b.dataset.ok]; if (!(await U.confirm({ title: 'Approve payment?', message: p.full_name + ' paid ' + U.money(p.amount) + ' (ref ' + p.reference + '). Their subscription will be activated.', confirmText: 'Approve' }))) return; try { var j = await Api.post(API + '/payments/' + p.id + '/approve', {}); U.toast(j.message); load(); } catch (er) { U.toast(er.message, 'error'); } });
      U.on($('#list'), 'click', '[data-no]', function (e, b) { var p = byId[b.dataset.no]; var m = U.modal({ title: 'Reject payment', size: 'sm', body: html`<form id="rf" class="stack">${U.fields([{ name: 'reason', label: 'Reason shown to the customer', required: true, placeholder: 'e.g. Reference not found', full: true }])}<div class="modal-foot" style="padding:12px 0 0"><button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Reject</button></div></form>` }); U.bindForm($('#rf', m.el), async function (v) { await Api.post(API + '/payments/' + p.id + '/reject', v); U.toast('Payment rejected.'); m.close(); load(); }); });
    }
    U.on(view, 'click', '[data-st]', function (e, b) { st.status = b.dataset.st; U.$$('[data-st]', view).forEach(function (x) { x.setAttribute('aria-selected', x === b); x.classList.toggle('active', x === b); }); load(); });
    await load();
  }

  /* ---------- Payment methods ---------- */
  async function methods(view, App) {
    var items = (await Api.get(API + '/payment-methods')).data.items, byId = {}; items.forEach(function (m) { byId[m.id] = m; });
    U.mount(view, html`${App.pageHead('Payment methods', 'Numbers and QR codes customers see on the Subscription page.', html`<button class="btn btn-primary" id="add">${U.icon('plus')} Add method</button>`)}
      ${items.length ? html`<div class="grid cols-3 stagger">${items.map(function (m) { return html`<div class="card" ${m.is_active == 1 ? '' : U.raw('style="opacity:.6"')}><div class="row spread"><b>${m.name}</b>${U.badge(m.is_active == 1 ? 'active' : '', m.is_active == 1 ? 'Visible' : 'Hidden')}</div><dl class="kv" style="margin-top:8px"><dt>Number</dt><dd>${m.account_number}</dd>${m.recipient_name ? html`<dt>Name</dt><dd>${m.recipient_name}</dd>` : ''}${m.provider ? html`<dt>Provider</dt><dd>${m.provider}</dd>` : ''}</dl>${m.has_qr == 1 ? html`<div class="center mt"><img src="${API}/payment-methods/${m.id}/qr" alt="QR for ${m.name}" style="width:120px;height:120px;object-fit:contain;background:#fff;border-radius:10px;padding:6px;border:1px solid var(--border)"></div>` : ''}
        <div class="row" style="margin-top:12px"><button class="btn btn-ghost btn-sm" data-edit="${m.id}">${U.icon('edit')} Edit</button><button class="btn btn-ghost btn-sm" data-tg="${m.id}">${m.is_active == 1 ? 'Hide' : 'Show'}</button><button class="btn btn-ghost btn-sm" data-del="${m.id}" aria-label="Delete ${m.name}">${U.icon('trash')}</button></div></div>`; })}</div>` : U.empty('No payment methods yet', 'Add M-Pesa, Tigo Pesa, Airtel Money, a bank account or any other way customers can pay.', html`<button class="btn btn-primary" id="add2">Add a method</button>`)}`);
    function form(m) {
      var mo = U.modal({ title: m ? 'Edit payment method' : 'Add payment method', body: html`<form id="mf" class="stack">${U.fields([{ name: 'name', label: 'Display name', required: true, value: m && m.name, placeholder: 'e.g. M-Pesa, CRDB Bank', full: true },
        { name: 'kind', label: 'Type', type: 'select', value: m ? m.kind : 'mobile_money', options: [{ value: 'mobile_money', label: 'Mobile money' }, { value: 'bank', label: 'Bank' }, { value: 'other', label: 'Other' }] }, { name: 'provider', label: 'Provider / bank (optional)', value: m && m.provider },
        { name: 'account_number', label: 'Phone or account number', required: true, value: m && m.account_number }, { name: 'recipient_name', label: 'Account holder name', value: m && m.recipient_name },
        { name: 'instructions', label: 'Instructions for customers (optional)', type: 'textarea', value: m && m.instructions, full: true },
        { name: 'qr', label: 'QR code image (optional)', type: 'file', attrs: 'accept="image/png,image/jpeg,image/webp"', full: true }, m && m.has_qr == 1 ? { name: 'remove_qr', label: 'Remove the current QR code', type: 'checkbox', full: true } : null])}
        <div class="modal-foot" style="padding:12px 0 0"><button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Save</button></div></form>` });
      var f = $('#mf', mo.el);
      U.bindForm(f, async function (v) { var fd = new FormData(); ['name', 'kind', 'provider', 'account_number', 'recipient_name', 'instructions'].forEach(function (k) { fd.append(k, v[k] || ''); }); if (v.remove_qr) fd.append('remove_qr', '1'); var file = $('[name=qr]', f).files[0]; if (file) fd.append('qr', file); await Api.upload(API + '/payment-methods' + (m ? '/' + m.id : ''), fd); U.toast('Saved.'); mo.close(); App.refresh(); });
    }
    U.on(view, 'click', '#add, #add2', function () { form(null); }); U.on(view, 'click', '[data-edit]', function (e, b) { form(byId[b.dataset.edit]); });
    U.on(view, 'click', '[data-tg]', async function (e, b) { await Api.post(API + '/payment-methods/' + b.dataset.tg + '/toggle', {}); App.refresh(); });
    U.on(view, 'click', '[data-del]', async function (e, b) { var m = byId[b.dataset.del]; if (!(await U.confirm({ title: 'Delete method?', message: 'Delete “' + m.name + '”? Methods with payment records can only be hidden.', confirmText: 'Delete', danger: true }))) return; try { await Api.del(API + '/payment-methods/' + m.id); U.toast('Deleted.'); App.refresh(); } catch (er) { U.toast(er.message, 'error'); } });
  }

  /* ---------- Settings (incl. plans, features, branding) ---------- */
  async function settings(view, App) {
    var r = await Promise.all([Api.get(API + '/settings'), Api.get(API + '/plans')]), d = r[0].data, s = d.settings, plans = r[1].data.items;
    var FL = { expenses: 'Record & view expenses', income: 'Record & view income', transactions: 'All transactions', accounts: 'Accounts & transfers', categories: 'Categories', debts: 'Debts', budgets: 'Budgets', savings: 'Savings goals', recurring: 'Recurring items', analytics: 'Dashboard charts', insights: 'Smart insights', reports: 'Reports', pdf: 'PDF export', export: 'CSV export', dashboard_basic: 'Basic dashboard', notifications: 'Notifications', subscription: 'Subscription page', support: 'Help & support', profile: 'Profile', settings: 'User settings' };
    var LOCK = ['subscription', 'notifications', 'support', 'profile'];
    U.mount(view, html`${App.pageHead('System settings', 'Change pricing, trial length, branding, messages and restrictions without touching code.')}
      <div class="card mb"><h3>Subscription plans</h3><p class="small muted">The default active plan is shown to customers. Price changes apply to future payments only.</p>${U.table([{ label: 'Plan', render: function (p) { return html`<b>${p.name}</b> ${p.is_default == 1 ? U.badge('info', 'Default') : ''}`; } }, { label: 'Price', align: 'right', render: function (p) { return U.money(p.price); } }, { label: 'Months', align: 'right', render: function (p) { return p.period_months; } }, { label: 'Status', render: function (p) { return U.badge(p.is_active == 1 ? 'active' : '', p.is_active == 1 ? 'Active' : 'Hidden'); } }, { label: '', cls: 'actions', render: function (p) { return html`<button class="btn btn-ghost btn-sm" data-plan="${p.id}">Edit</button>`; } }], plans)}<div class="mt"><button class="btn btn-ghost btn-sm" id="addPlan">${U.icon('plus')} Add plan</button></div></div>
      <form id="sf" class="stack"><div class="grid cols-2">
        <div class="card"><h3>Trial &amp; billing</h3>${U.fields([{ name: 'trial_days', label: 'Free trial (days)', type: 'number', min: 0, max: 365, value: s.trial_days, full: true }, { name: 'billing_rule', label: 'Billing period rule', type: 'select', value: s.billing_rule, options: [{ value: 'calendar_month', label: 'Calendar month (e.g. 5 Jan → 5 Feb)' }, { value: 'fixed_30', label: 'Fixed 30 days' }], full: true }, { name: 'reminder_days', label: 'Expiry reminder days', value: s.reminder_days, hint: 'Comma-separated days before expiry, e.g. 7,3,1', full: true }])}</div>
        <div class="card"><h3>When a subscription expires</h3><p class="small muted">Customers keep their data and can always log in. Tick what stays available. Enforced on the server.</p><div class="stack">${d.all_features.map(function (f) { return html`<label class="check"><input type="checkbox" data-feat="${f}" ${s.expired_allowed_features.indexOf(f) >= 0 || LOCK.indexOf(f) >= 0 ? U.raw('checked') : ''} ${LOCK.indexOf(f) >= 0 ? U.raw('disabled') : ''}> <span>${FL[f] || f}${LOCK.indexOf(f) >= 0 ? ' (always on)' : ''}</span></label>`; })}</div></div>
        <div class="card"><h3>Branding &amp; popup</h3>${U.fields([{ name: 'app_name', label: 'App name', value: s.app_name, full: true }, { name: 'welcome_popup_message', label: 'Welcome popup title', value: s.welcome_popup_message, full: true }, { name: 'landing_announcement', label: 'Landing page announcement (optional)', value: s.landing_announcement, full: true }])}</div>
        <div class="card"><h3>Support contacts</h3>${U.fields([{ name: 'support_phone', label: 'Phone', type: 'tel', value: s.support_phone }, { name: 'support_whatsapp', label: 'WhatsApp', type: 'tel', value: s.support_whatsapp }, { name: 'support_email', label: 'Email', type: 'email', value: s.support_email, full: true }, { name: 'support_hours', label: 'Opening hours', value: s.support_hours, full: true }, { name: 'help_text', label: 'Help centre note', type: 'textarea', value: s.help_text, full: true }])}</div>
        <div class="card"><h3>Messages</h3>${U.fields([{ name: 'msg_welcome', label: 'Welcome notification', type: 'textarea', value: s.msg_welcome, full: true }, { name: 'msg_trial', label: 'Trial notification ({days} = trial days)', type: 'textarea', value: s.msg_trial, full: true }, { name: 'msg_approved', label: 'Payment approved', type: 'textarea', value: s.msg_approved, full: true }, { name: 'msg_rejected', label: 'Payment rejected', type: 'textarea', value: s.msg_rejected, full: true }, { name: 'msg_expired', label: 'Expired message', type: 'textarea', value: s.msg_expired, full: true }])}</div>
        <div class="card"><h3>Security &amp; system</h3>${U.fields([{ name: 'registration_open', label: 'Allow new registrations', type: 'checkbox', value: s.registration_open === '1', full: true }, { name: 'require_email_verification', label: 'Require email verification', type: 'checkbox', value: s.require_email_verification === '1', full: true }, { name: 'maintenance_mode', label: 'Maintenance mode (customers see a notice)', type: 'checkbox', value: s.maintenance_mode === '1', full: true },
          { name: 'session_timeout_minutes', label: 'Idle session timeout (minutes)', type: 'number', min: 5, max: 1440, value: s.session_timeout_minutes }, { name: 'max_login_attempts', label: 'Failed logins before lockout', type: 'number', min: 3, max: 20, value: s.max_login_attempts }, { name: 'lockout_minutes', label: 'Lockout length (minutes)', type: 'number', min: 1, max: 1440, value: s.lockout_minutes }, { name: 'backup_retention_days', label: 'Keep backups (days)', type: 'number', min: 1, max: 365, value: s.backup_retention_days }])}</div></div>
        <div><button class="btn btn-primary" type="submit">Save settings</button></div></form>
      <div class="card mt"><h3>Logos</h3><p class="small muted">The original logos are built in. Upload a PNG (transparent works best) to replace one; reset to restore the original.</p><div class="grid cols-2">
        ${[['app', 'App logo', 'assets/images/logo.png', d.logo_custom, '#101828'], ['mabumbatech', 'MABUMBATECH logo', 'assets/images/mabumbatech-logo.png', d.mabumbatech_custom, '#101828']].map(function (L) { return html`<div class="card" style="background:var(--surface-2)"><b>${L[1]}</b> ${L[3] ? U.badge('info', 'Custom') : U.badge('', 'Original')}<div class="center" style="background:${L[4]};border-radius:12px;padding:14px;margin:10px 0"><img src="${L[3] ? 'assets/images/brand/' + (L[0] === 'app' ? 'logo.png' : 'mabumbatech-logo.png') + '?t=' + Date.now() : L[2]}" alt="" style="max-height:90px"></div><div class="row"><label class="btn btn-ghost btn-sm" style="cursor:pointer">Upload new<input type="file" accept="image/png" class="sr-only" data-logo="${L[0]}"></label>${L[3] ? html`<button class="btn btn-ghost btn-sm" data-reset="${L[0]}">Reset to original</button>` : ''}</div></div>`; })}</div></div>`);
    U.bindForm($('#sf'), async function (v) {
      var body = Object.assign({}, v); body.expired_allowed_features = U.$$('[data-feat]:checked', view).map(function (c) { return c.dataset.feat; });
      ['registration_open', 'require_email_verification', 'maintenance_mode'].forEach(function (k) { body[k] = v[k] ? 1 : 0; });
      var j = await Api.put(API + '/settings', body); U.toast(j.message);
    });
    function planForm(p) {
      var m = U.modal({ title: p ? 'Edit plan' : 'New plan', size: 'sm', body: html`<form id="pf" class="stack">${U.fields([{ name: 'name', label: 'Plan name', required: true, value: p && p.name, full: true }, { name: 'price', label: 'Price (TZS)', type: 'amount', required: true, value: p ? Number(p.price).toLocaleString('en-US') : '5,000', full: true }, { name: 'period_months', label: 'Months covered', type: 'number', min: 1, max: 36, required: true, value: p ? p.period_months : 1, full: true }, { name: 'is_active', label: 'Visible to customers', type: 'checkbox', value: p ? p.is_active == 1 : true, full: true }, { name: 'is_default', label: 'Default plan', type: 'checkbox', value: p && p.is_default == 1, full: true }])}<div class="modal-foot" style="padding:12px 0 0"><button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Save</button></div></form>` });
      U.bindForm($('#pf', m.el), async function (v) { v.is_active = v.is_active ? 1 : 0; v.is_default = v.is_default ? 1 : 0; if (p) await Api.put(API + '/plans/' + p.id, v); else await Api.post(API + '/plans', v); U.toast('Plan saved.'); m.close(); App.refresh(); });
    }
    $('#addPlan').onclick = function () { planForm(null); };
    U.on(view, 'click', '[data-plan]', function (e, b) { planForm(plans.filter(function (p) { return p.id == b.dataset.plan; })[0]); });
    U.on(view, 'change', '[data-logo]', async function (e, el) { var f = el.files[0]; if (!f) return; var fd = new FormData(); fd.append('kind', el.dataset.logo); fd.append('logo', f); try { await Api.upload(API + '/settings/logo', fd); U.toast('Logo updated.'); App.refresh(); } catch (er) { U.toast(er.message, 'error'); } });
    U.on(view, 'click', '[data-reset]', async function (e, b) { if (!(await U.confirm({ title: 'Restore original logo?', message: 'Your uploaded logo will be removed.', confirmText: 'Restore' }))) return; await Api.del(API + '/settings/logo/' + b.dataset.reset); U.toast('Original logo restored.'); App.refresh(); });
  }

  /* ---------- Announcements ---------- */
  async function announcements(view, App) {
    var items = (await Api.get(API + '/announcements')).data.items, byId = {}; items.forEach(function (a) { byId[a.id] = a; });
    U.mount(view, html`${App.pageHead('Announcements', 'Send notifications to all customers or a group.', html`<button class="btn btn-primary" id="add">${U.icon('plus')} New announcement</button>`)}
      ${items.length ? U.table([{ label: 'Title', render: function (a) { return html`<b>${a.title}</b><div class="small muted">${String(a.body).slice(0, 90)}</div>`; } }, { label: 'Audience', render: function (a) { return U.label(a.audience); } },
        { label: 'Status', render: function (a) { return a.published_at ? html`${U.badge('success', 'Sent')}<div class="small muted">${U.datetime(a.published_at)}</div>` : a.scheduled_at ? html`${U.badge('pending', 'Scheduled')}<div class="small muted">${U.datetime(a.scheduled_at)}</div>` : U.badge('', 'Draft'); } },
        { label: '', cls: 'actions', render: function (a) { return a.published_at ? '' : html`<button class="btn btn-gold btn-sm" data-pub="${a.id}">Send now</button> <button class="btn btn-ghost btn-sm" data-edit="${a.id}">Edit</button> <button class="icon-btn" data-del="${a.id}" aria-label="Delete">${U.icon('trash')}</button>`; } }], items)
        : U.empty('No announcements', 'Announcements appear as notifications for your customers.')}`);
    function form(a) {
      var m = U.modal({ title: a ? 'Edit announcement' : 'New announcement', body: html`<form id="af" class="stack">${U.fields([{ name: 'title', label: 'Title', required: true, value: a && a.title, full: true }, { name: 'body', label: 'Message', type: 'textarea', required: true, rows: 4, value: a && a.body, full: true },
        { name: 'audience', label: 'Send to', type: 'select', value: a ? a.audience : 'all', options: [{ value: 'all', label: 'All customers' }, { value: 'trial', label: 'Customers on trial' }, { value: 'active', label: 'Active subscribers' }, { value: 'expired', label: 'Expired customers' }] },
        { name: 'scheduled_at', label: 'Schedule for later (optional)', type: 'datetime-local' }, a ? null : { name: 'publish_now', label: 'Send immediately', type: 'checkbox', value: true, full: true }])}<div class="modal-foot" style="padding:12px 0 0"><button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Save</button></div></form>` });
      U.bindForm($('#af', m.el), async function (v) { v.publish_now = v.publish_now ? 1 : 0; var j = a ? await Api.put(API + '/announcements/' + a.id, v) : await Api.post(API + '/announcements', v); U.toast(j.message); m.close(); App.refresh(); });
    }
    U.on(view, 'click', '#add', function () { form(null); }); U.on(view, 'click', '[data-edit]', function (e, b) { form(byId[b.dataset.edit]); });
    U.on(view, 'click', '[data-pub]', async function (e, b) { if (!(await U.confirm({ title: 'Send now?', message: 'This sends a notification to the chosen audience immediately.', confirmText: 'Send' }))) return; try { var j = await Api.post(API + '/announcements/' + b.dataset.pub + '/publish', {}); U.toast(j.message); App.refresh(); } catch (er) { U.toast(er.message, 'error'); } });
    U.on(view, 'click', '[data-del]', async function (e, b) { if (!(await U.confirm({ title: 'Delete announcement?', message: 'Only unsent announcements can be deleted.', confirmText: 'Delete', danger: true }))) return; await Api.del(API + '/announcements/' + b.dataset.del); U.toast('Deleted.'); App.refresh(); });
  }

  /* ---------- Audit logs ---------- */
  async function audit(view, App) {
    var st = { action: '', result: '', from: '', to: '', page: 1 }, actions = [];
    U.mount(view, html`${App.pageHead('Audit logs', 'A permanent record of security and admin actions. Entries cannot be edited or deleted.')}<div class="toolbar"><select class="input" id="ac" aria-label="Action"><option value="">All actions</option></select><select class="input" id="re" aria-label="Result"><option value="">Any result</option><option value="success">Success</option><option value="failure">Failure</option></select><input class="input" type="date" id="fr" aria-label="From"><input class="input" type="date" id="to" aria-label="To"></div><div id="list">${U.skeleton(3)}</div><div id="pg"></div>`);
    async function load() {
      var d = (await Api.get(API + '/audit-logs' + Api.qs(st))).data;
      if (!actions.length) { actions = d.actions; $('#ac').innerHTML = '<option value="">All actions</option>' + actions.map(function (a) { return '<option value="' + U.esc(a) + '">' + U.esc(U.label(a)) + '</option>'; }).join(''); }
      U.mount($('#list'), U.table([{ label: 'When', render: function (l) { return U.datetime(l.created_at); }, cls: 'nowrap' }, { label: 'Who', render: function (l) { return l.actor || (l.actor_id ? '#' + l.actor_id : 'System'); } }, { label: 'Action', render: function (l) { return U.label(l.action); } }, { label: 'Item', render: function (l) { return l.entity ? l.entity + (l.entity_id ? ' #' + l.entity_id : '') : ''; } }, { label: 'Result', render: function (l) { return U.badge(l.result === 'success' ? 'success' : 'danger', U.label(l.result)); } }, { label: 'IP', render: function (l) { return l.ip || ''; } }], d.items, { emptyTitle: 'No log entries', emptyText: 'Nothing matches these filters.' }));
      U.mount($('#pg'), U.pager(d.page, d.pages));
    }
    $('#ac').onchange = function (e) { st.action = e.target.value; st.page = 1; load(); }; $('#re').onchange = function (e) { st.result = e.target.value; st.page = 1; load(); };
    $('#fr').onchange = function (e) { st.from = e.target.value; st.page = 1; load(); }; $('#to').onchange = function (e) { st.to = e.target.value; st.page = 1; load(); };
    U.on(view, 'click', '[data-page]', function (e, b) { if (!b.disabled) { st.page = +b.dataset.page; load(); } });
    await load();
  }

  /* ---------- Backups ---------- */
  async function backups(view, App) {
    var items = (await Api.get(API + '/backup')).data.items;
    U.mount(view, html`${App.pageHead('Backups', 'Database backups are stored outside the public web folders. Download a copy regularly and keep it somewhere safe.', html`<button class="btn btn-primary" id="mk">${U.icon('db')} Create backup now</button>`)}
      <div class="banner info">${U.icon('info')}<div>For automatic daily backups, schedule <code>php backend/cron.php --backup</code> with cron (see the README). To restore, import a backup file with phpMyAdmin or the mysql command.</div></div>
      ${U.table([{ label: 'File', render: function (b) { return b.name; } }, { label: 'Created (UTC)', render: function (b) { return U.datetime(b.created); } }, { label: 'Size', align: 'right', render: function (b) { return (b.size / 1024).toFixed(b.size > 1048576 ? 0 : 1) + ' KB'; } }, { label: '', cls: 'actions', render: function (b) { return html`<a class="btn btn-ghost btn-sm" href="${API}/backup/${b.name}">${U.icon('download')} Download</a>`; } }], items, { emptyTitle: 'No backups yet', emptyText: 'Create your first backup now.' })}`);
    $('#mk').onclick = async function (e) { U.busy(e.currentTarget, true, 'Creating…'); try { var j = await Api.post(API + '/backup', {}); U.toast(j.message); App.refresh(); } catch (er) { U.toast(er.message, 'error'); U.busy(e.currentTarget, false); } };
  }

  /* ---------- Platform payment report ---------- */
  async function reports(view, App) {
    var st = { range: 'month', from: '', to: '' };
    U.mount(view, html`${App.pageHead('Subscription & payment report', 'Platform revenue and payment history.', html`<a class="btn btn-ghost" id="csv" href="#">${U.icon('download')} CSV</a><a class="btn btn-ghost" id="pdf" href="#">${U.icon('file')} PDF</a>`)}${rangeBar(st)}<div id="out">${U.skeleton(3)}</div>`);
    function fmt(v, k) { return v === null || v === undefined ? '—' : k === 'money' ? U.money(v) : k === 'number' ? Number(v).toLocaleString('en-US') : v; }
    async function run() {
      var r = (await Api.get(API + '/reports' + Api.qs(st))).data;
      U.mount($('#out'), html`<div class="grid cols-4 mb stagger">${r.summary.map(function (s) { return html`<div class="card stat"><div class="label">${s.label}</div><div class="value">${fmt(s.value, s.kind)}</div></div>`; })}</div>${r.tables.map(function (t) { return html`<div class="card"><h3>${t.title}</h3>${U.table(t.columns.map(function (c) { return { label: c.label, align: c.kind === 'money' ? 'right' : '', render: function (row) { return fmt(row[c.key], c.kind); } }; }), t.rows, { emptyTitle: 'No payments in this period' })}</div>`; })}<p class="small muted mt">${r.notes.join(' ')}</p>`);
      $('#csv').href = API + '/reports' + Api.qs(Object.assign({ format: 'csv' }, st)); $('#pdf').href = API + '/reports' + Api.qs(Object.assign({ format: 'pdf' }, st));
    }
    bindRange(st, run); await run();
  }

  App.page('admin-dashboard', { title: 'Admin Dashboard', admin: true, render: dashboard });
  App.page('admin-customers', { title: 'Customers', admin: true, render: customers });
  App.page('admin-payments', { title: 'Payments', admin: true, render: payments });
  App.page('admin-methods', { title: 'Payment methods', admin: true, render: methods });
  App.page('admin-settings', { title: 'System settings', admin: true, render: settings });
  App.page('admin-announcements', { title: 'Announcements', admin: true, render: announcements });
  App.page('admin-audit', { title: 'Audit logs', admin: true, render: audit });
  App.page('admin-backups', { title: 'Backups', admin: true, render: backups });
  App.page('admin-reports', { title: 'Reports', admin: true, render: reports });
})();
