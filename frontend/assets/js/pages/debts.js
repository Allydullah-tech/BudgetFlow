/* Debts and debt payments (principal is never income/expense; interest is recorded separately). */
(function () {
  'use strict';
  var U = window.UI, html = U.html, $ = U.$;

  async function render(view, App) {
    var st = { tab: 'owed_by_me', status: '', q: '' }, data;
    var lookups = await App.forms.lookups();
    async function load() { data = (await Api.get('../api/debts')).data; try { lookups = await App.forms.lookups(); } catch (e) {} draw(); }
    function filtered() { return data.items.filter(function (d) { return d.direction === st.tab && (!st.status || d.status === st.status) && (!st.q || (d.party_name + ' ' + (d.description || '')).toLowerCase().indexOf(st.q.toLowerCase()) >= 0); }); }
    function draw() {
      var s = data.summary, items = filtered();
      U.mount(view, html`${App.pageHead('Debts', 'Track money you owe and money owed to you. Borrowing and lending are not counted as income or expenses.', html`<button class="btn btn-primary" id="addDebt">${U.icon('plus')} Record a debt</button>`)}
        <div class="grid cols-4 mb stagger">
          <div class="card stat expense"><div class="label">I owe</div><div class="value">${U.money(s.owed_by_me)}</div></div>
          <div class="card stat income"><div class="label">Owed to me</div><div class="value">${U.money(s.owed_to_me)}</div></div>
          <div class="card stat"><div class="label">Overdue</div><div class="value">${s.overdue_count}</div></div>
          <div class="card stat"><div class="label">Paid off</div><div class="value">${data.items.filter(function (x) { return x.status === 'paid'; }).length}</div></div></div>
        <div class="row spread mb">${U.tabs([{ value: 'owed_by_me', label: 'Money I owe' }, { value: 'owed_to_me', label: 'Owed to me' }, { value: 'payments', label: 'All payments' }], st.tab)}
          ${st.tab !== 'payments' ? html`<div class="toolbar" style="margin:0"><input class="input" id="dq" type="search" placeholder="Search name…" value="${st.q}" aria-label="Search debts"><select class="input" id="ds" aria-label="Status">${[['', 'Any status'], ['unpaid', 'Unpaid'], ['partial', 'Partly paid'], ['overdue', 'Overdue'], ['paid', 'Paid'], ['cancelled', 'Cancelled']].map(function (o) { return html`<option value="${o[0]}" ${st.status === o[0] ? U.raw('selected') : ''}>${o[1]}</option>`; })}</select></div>` : ''}</div>
        <div id="body">${st.tab === 'payments' ? U.skeleton(2) : cards(items)}</div>`);
      Motion.scan(view);
      if (st.tab === 'payments') payments();
      var dq = $('#dq'); if (dq) { dq.oninput = U.debounce(function (e) { st.q = e.target.value; var f = filtered(); U.mount($('#body'), cards(f)); Motion.scan($('#body')); }, 250); }
    }
    function cards(items) {
      if (!items.length) return U.empty(st.tab === 'owed_by_me' ? 'No debts you owe' : 'Nobody owes you money', 'Record a debt to start tracking repayments.', html`<button class="btn btn-primary" id="addDebt2">Record a debt</button>`);
      return html`<div class="grid cols-3 stagger">${items.map(function (d) { var overdue = d.status === 'overdue'; return html`<div class="card" style="${overdue ? 'border-color:var(--danger)' : ''}"><div class="row spread"><b>${d.party_name}</b>${U.badge(d.status)}</div><div class="small muted">${d.description || ''}</div>
        <div class="num" style="font-size:1.3rem;font-weight:700;margin:10px 0 2px">${U.money(d.remaining)}</div><div class="small muted">remaining of ${U.money(d.principal)}</div>${U.progress(d.percent_paid, 'var(--info)')}
        <div class="row spread small muted" style="margin-top:8px"><span>${d.due_date ? 'Due ' + U.date(d.due_date) : 'No due date'}</span><span>${Math.round(d.percent_paid)}% paid</span></div>
        <div class="row" style="margin-top:12px"><button class="btn btn-ghost btn-sm" data-open="${d.id}">Details</button>${d.status !== 'paid' && d.status !== 'cancelled' ? html`<button class="btn btn-gold btn-sm" data-pay="${d.id}">${d.direction === 'owed_by_me' ? 'Pay' : 'Record repayment'}</button>` : ''}</div></div>`; })}</div>`;
    }
    async function payments() {
      var j = (await Api.get('../api/debt-payments')).data;
      U.mount($('#body'), U.table([
        { label: 'Date', render: function (r) { return U.date(r.pay_date); } }, { label: 'Debt', render: function (r) { return html`${r.party_name} <span class="small muted">(${r.direction === 'owed_by_me' ? 'I owe' : 'owes me'})</span>`; } },
        { label: 'Principal', align: 'right', render: function (r) { return U.money(r.principal_amount); } }, { label: 'Interest', align: 'right', render: function (r) { return Number(r.interest_amount) ? U.money(r.interest_amount) : '—'; } },
        { label: 'Account', render: function (r) { return r.account_name; } }, { label: 'Status', render: function (r) { return U.badge(r.status); } }], j.items, { emptyTitle: 'No payments yet', emptyText: 'Repayments you record will be listed here.' }));
    }

    function debtForm(d) {
      var editing = !!d, accOpts = [{ value: '', label: "Don't record cash movement" }].concat(lookups.accounts.map(function (a) { return { value: a.id, label: a.name + ' · ' + U.money(a.balance) }; }));
      var m = U.modal({ title: editing ? 'Edit debt' : 'Record a debt', body: html`<form id="df" class="stack">${U.fields([
        editing ? null : { name: 'direction', label: 'Type', type: 'select', required: true, value: st.tab === 'owed_to_me' ? 'owed_to_me' : 'owed_by_me', options: [{ value: 'owed_by_me', label: 'I borrowed money (I owe)' }, { value: 'owed_to_me', label: 'I lent money (owed to me)' }] },
        { name: 'party_name', label: 'Person or organisation', required: true, value: d && d.party_name, full: true },
        { name: 'principal', label: 'Amount (TZS)', type: 'amount', required: true, value: d ? Number(d.principal).toLocaleString('en-US') : '', hint: editing && d.paid > 0 ? 'Locked because payments exist.' : '' },
        { name: 'start_date', label: 'Debt date', type: 'date', required: true, value: d ? d.start_date : U.today() }, { name: 'due_date', label: 'Due date (optional)', type: 'date', value: d && d.due_date },
        { name: 'interest_rate', label: 'Interest rate % (optional)', type: 'text', value: d && d.interest_rate, hint: 'For your reference only. Interest is recorded when you make payments.' },
        { name: 'phone', label: 'Phone (optional)', type: 'tel', value: d && d.phone },
        editing ? null : { name: 'account_id', label: 'Account affected', type: 'select', options: accOpts, value: lookups.accounts[0] ? lookups.accounts[0].id : '', hint: 'Borrowing adds cash to this account; lending removes it. It is not income or an expense.' },
        { name: 'description', label: 'What is it for? (optional)', value: d && d.description, full: true }, { name: 'notes', label: 'Notes', type: 'textarea', value: d && d.notes, full: true }])}
        <div class="modal-foot" style="padding:12px 0 0"><button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">${editing ? 'Save changes' : 'Save debt'}</button></div></form>` });
      var df = $('#df', m.el);
      if (!editing) App.forms.fundsGuard(df, { account: 'account_id', need: function (fm) { return App.forms.amountOf(fm, 'principal'); }, accounts: lookups.accounts,
        active: function (fm) { var dir = $('[name=direction]', fm); return !!dir && dir.value === 'owed_to_me' && !!$('[name=account_id]', fm).value; } });
      U.bindForm(df, async function (v) {
        if (editing) await Api.put('../api/debts/' + d.id, v); else await Api.post('../api/debts', v);
        U.toast(editing ? 'Debt updated.' : 'Debt recorded.'); m.close(); await load();
      });
    }

    function payForm(d) {
      var byMe = d.direction === 'owed_by_me', rem = Number(d.remaining);
      var m = U.modal({ title: (byMe ? 'Pay ' : 'Repayment from ') + d.party_name, body: html`<p class="small muted">Remaining: <b>${U.money(rem)}</b>. The principal part is not an expense${byMe ? '' : ' or income'}; any interest is recorded separately as ${byMe ? 'an expense' : 'income'}.</p><form id="pf" class="stack">${U.fields([
        { name: 'principal_amount', label: 'Amount towards the debt (TZS)', type: 'amount', required: true, value: rem.toLocaleString('en-US', { maximumFractionDigits: 2 }), full: true },
        { name: 'interest_amount', label: 'Interest included (optional)', type: 'amount', value: '0', hint: 'Extra amount that is interest, on top of the above.' },
        { name: 'account_id', label: byMe ? 'Paid from' : 'Received into', type: 'select', required: true, options: lookups.accounts.map(function (a) { return { value: a.id, label: byMe ? App.forms.acctLabel(a, Number(a.balance)) : a.name + ' · ' + U.money(a.balance) }; }) },
        { name: 'pay_date', label: 'Date', type: 'date', required: true, value: U.today() }, { name: 'method', label: 'Method', type: 'select', options: App.forms.methodOpts() },
        { name: 'reference', label: 'Reference (optional)' }, { name: 'notes', label: 'Notes (optional)' }])}
        <div class="modal-foot" style="padding:12px 0 0"><button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Record payment</button></div></form>` });
      var pf = $('#pf', m.el);
      if (byMe) App.forms.fundsGuard(pf, { account: 'account_id', need: function (fm) { return App.forms.amountOf(fm, 'principal_amount') + App.forms.amountOf(fm, 'interest_amount'); }, accounts: lookups.accounts });
      U.bindForm(pf, async function (v) { v.debt_id = d.id; v.client_uuid = Api.uuid(); var j = await Api.post('../api/debt-payments', v); U.toast(j.message); m.close(); await load(); try { localStorage.removeItem('et_lookups'); } catch (e) {} });
    }

    async function detail(id) {
      var d = (await Api.get('../api/debts/' + id)).data, m;
      function body() {
        return html`<div class="grid cols-3 mb"><div class="stat"><div class="label">Original</div><div class="value">${U.money(d.principal)}</div></div><div class="stat"><div class="label">Paid</div><div class="value">${U.money(d.paid)}</div></div><div class="stat"><div class="label">Remaining</div><div class="value">${U.money(d.remaining)}</div></div></div>
          ${U.progress(d.percent_paid, 'var(--info)')}<dl class="kv mt"><dt>Status</dt><dd>${U.badge(d.status)}</dd><dt>Debt date</dt><dd>${U.date(d.start_date)}</dd><dt>Due date</dt><dd>${d.due_date ? U.date(d.due_date) : '—'}</dd>${Number(d.interest_paid) ? html`<dt>Interest paid so far</dt><dd>${U.money(d.interest_paid)}</dd>` : ''}${d.phone ? html`<dt>Phone</dt><dd>${d.phone}</dd>` : ''}</dl>
          ${d.notes ? html`<p class="small muted mt">${d.notes}</p>` : ''}
          <h3 class="mt">Payment history</h3>${d.payments.length ? U.table([{ label: 'Date', render: function (r) { return U.date(r.pay_date); } }, { label: 'Principal', align: 'right', render: function (r) { return U.money(r.principal_amount); } }, { label: 'Interest', align: 'right', render: function (r) { return Number(r.interest_amount) ? U.money(r.interest_amount) : '—'; } }, { label: 'Status', render: function (r) { return U.badge(r.status); } }, { label: '', cls: 'actions', render: function (r) { return r.status === 'posted' ? html`<button class="btn btn-ghost btn-sm" data-revpay="${r.id}">Reverse</button>` : ''; } }], d.payments) : html`<p class="muted">No payments yet.</p>`}
          <div class="row mt">${d.status !== 'cancelled' ? html`<button class="btn btn-ghost btn-sm" id="dEdit">${U.icon('edit')} Edit</button><button class="btn btn-ghost btn-sm" id="dCancel">Cancel debt</button>` : ''}<a class="btn btn-ghost btn-sm" href="${Api.url('../api/reports/debt-statement')}?id=${d.id}">${U.icon('file')} Statement (PDF)</a>${d.status !== 'paid' && d.status !== 'cancelled' ? html`<button class="btn btn-gold btn-sm" id="dPay">Record payment</button>` : ''}</div>`;
      }
      m = U.modal({ title: d.party_name + (d.direction === 'owed_by_me' ? ' (I owe)' : ' (owes me)'), size: 'wide', body: body() });
      U.on(m.el, 'click', '[data-revpay]', async function (e, b) { if (!(await U.confirm({ title: 'Reverse this payment?', message: 'The debt balance and your account balance will be restored.', confirmText: 'Reverse', danger: true }))) return; try { await Api.del('../api/debt-payments/' + b.dataset.revpay); U.toast('Payment reversed.'); m.close(); await load(); detail(id); } catch (er) { U.toast(er.message, 'error'); } });
      var pay = $('#dPay', m.el); if (pay) pay.onclick = function () { m.close(); payForm(d); };
      var ed = $('#dEdit', m.el); if (ed) ed.onclick = function () { m.close(); debtForm(d); };
      var cn = $('#dCancel', m.el); if (cn) cn.onclick = async function () { if (!(await U.confirm({ title: 'Cancel this debt?', message: 'Use this if it was recorded by mistake. Any cash movement from it is reversed. Debts with payments cannot be cancelled.', confirmText: 'Cancel debt', danger: true }))) return; try { await Api.del('../api/debts/' + id); U.toast('Debt cancelled.'); m.close(); await load(); } catch (er) { U.toast(er.message, 'error'); } };
    }

    U.on(view, 'click', '[data-tab]', function (e, b) { st.tab = b.dataset.tab; draw(); });
    U.on(view, 'click', '#addDebt, #addDebt2', function () { debtForm(null); });
    U.on(view, 'click', '[data-open]', function (e, b) { detail(+b.dataset.open); });
    U.on(view, 'click', '[data-pay]', function (e, b) { var d = data.items.filter(function (x) { return x.id == b.dataset.pay; })[0]; payForm(d); });
    U.on(view, 'change', '#ds', function (e, el) { st.status = el.value; draw(); });
    await load();
    if (App.query().get('new') === '1') { history.replaceState(null, '', location.pathname); debtForm(null); }
  }
  App.page('debts', { title: 'Debts', feature: 'debts', render: render });
})();
