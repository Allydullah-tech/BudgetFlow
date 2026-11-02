/* Shared forms: add/edit income & expense, transfer. Used by the FAB, dashboard and list pages. */
(function () {
  'use strict';
  var U = window.UI, html = U.html, $ = U.$;
  var METHODS = ['Cash', 'M-Pesa', 'Tigo Pesa', 'Airtel Money', 'Bank transfer', 'Card', 'Other'];
  var LK = 'et_lookups';

  /* Accounts + categories, cached so entries can be recorded offline. */
  async function lookups(force) {
    try {
      var r = await Promise.all([Api.get('../api/accounts?active=1'), Api.get('../api/categories')]);
      var d = { accounts: r[0].data.items, categories: r[1].data.items, at: Date.now() };
      try { localStorage.setItem(LK, JSON.stringify(d)); } catch (e) {}
      return d;
    } catch (e) {
      if (e.offline || e.status === 0) { try { var c = JSON.parse(localStorage.getItem(LK) || 'null'); if (c) return c; } catch (x) {} }
      throw e;
    }
  }
  function opts(list, blank) { var o = blank ? [{ value: '', label: blank }] : []; return o.concat(list.map(function (x) { return { value: x.id, label: x.name }; })); }
  function methodOpts() { return [{ value: '', label: 'Not specified' }].concat(METHODS.map(function (m) { return { value: m, label: m }; })); }


  /* ---- Funds guard -------------------------------------------------------------------------------------------
     Shows each account's real balance, and when the chosen account does not hold enough money it blocks saving and
     offers: (1) switch to an account that has enough (the user confirms by tapping it), or
             (2) opt.debt: borrow only the missing part, recorded as a debt the user owes.
     o = { account: 'select name', need: fn(form) -> number, accounts: [...], avail: fn(acc) -> number,
           active: fn(form) -> bool (optional), debt: bool, verb: 'pay' }                                           */
  function fundsGuard(form, o) {
    var sel = $('[name=' + o.account + ']', form); if (!sel) return { refresh: function () {} };
    var byId = {}; o.accounts.forEach(function (a) { byId[a.id] = a; });
    var avail = o.avail || function (a) { return Number(a.balance); };
    var host = document.createElement('div'); host.className = 'funds-box'; host.setAttribute('aria-live', 'polite');
    var grid = form.querySelector('.form-grid'); grid.parentNode.insertBefore(host, grid.nextSibling);
    var btn = form.querySelector('[type=submit]'), borrowing = false, bv = { borrow_party: '', borrow_phone: '', borrow_due_date: '', borrow_interest_rate: '', borrow_notes: '' }, blocked = false;
    function fmt(n) { return U.money(n); }
    function apply() { if (btn) btn.disabled = blocked; }
    function render() {
      var acc = byId[sel.value], need = o.need(form), on = !o.active || o.active(form);
      blocked = false; host.innerHTML = '';
      if (!acc || !on || !(need > 0)) { borrowing = false; apply(); return; }
      var have = Math.max(0, avail(acc)), short = need - have;
      if (short <= 0.004) { borrowing = false; apply(); return; }
      var others = o.accounts.filter(function (a) { return a.id != acc.id && avail(a) >= need; });
      var h = '<div class="banner warn" style="display:block"><b>' + U.esc(acc.name) + (have <= 0 ? ' has no money.' : ' does not have enough money.') + '</b>' +
        '<div class="small" style="margin-top:4px">Balance: ' + fmt(have) + ' · Needed: ' + fmt(need) + ' · Short by: ' + fmt(short) + '</div>';
      if (others.length) {
        h += '<div class="small" style="margin-top:10px">Use another account that has enough money:</div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">' +
          others.map(function (a) { return '<button type="button" class="btn btn-sm btn-ghost" data-use="' + a.id + '">' + U.esc(a.name) + ' · ' + fmt(avail(a)) + '</button>'; }).join('') + '</div>';
      } else {
        h += '<div class="small" style="margin-top:10px">No other account has enough money for this amount.</div>';
      }
      if (o.debt) {
        if (!borrowing) h += '<div style="margin-top:10px"><button type="button" class="btn btn-sm btn-gold" data-borrow>Borrow ' + fmt(short) + ' and record it as a debt</button></div>';
        else {
          var dd = $('[name=txn_date]', form), debtDate = dd && dd.value ? dd.value : U.today();
          h += '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)"><h4 style="margin:0 0 4px">Borrow ' + fmt(short) + ' (recorded as a debt you owe)</h4>' +
            '<p class="small muted" style="margin:0 0 12px">Only the missing ' + fmt(short) + ' is borrowed. It is added to ' + U.esc(acc.name) + ' on ' + U.esc(U.date(debtDate)) + ', then this expense is paid from it. It is not income.</p>' +
            U.fields([
              { name: 'borrow_party', label: 'Borrowing from (person or organisation)', required: true, value: bv.borrow_party, full: true, placeholder: 'e.g. Juma Traders' },
              { name: 'borrow_phone', label: 'Phone (optional)', type: 'tel', value: bv.borrow_phone },
              { name: 'borrow_due_date', label: 'Due date (optional)', type: 'date', value: bv.borrow_due_date, min: debtDate },
              { name: 'borrow_interest_rate', label: 'Interest rate % (optional)', value: bv.borrow_interest_rate, hint: 'For your reference only. Interest is recorded when you make payments.' },
              { name: 'borrow_notes', label: 'Notes (optional)', type: 'textarea', rows: 2, value: bv.borrow_notes, full: true }]).s +
            '<div style="margin-top:8px"><button type="button" class="btn btn-sm btn-ghost" data-noborrow>Cancel borrowing</button></div></div>';
        }
      }
      h += '</div>';
      host.innerHTML = h;
      blocked = !(o.debt && borrowing && bv.borrow_party.trim());
      apply();
    }
    host.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-use')) { sel.value = b.getAttribute('data-use'); borrowing = false; render(); U.toast(byId[sel.value].name + ' selected.'); }
      else if (b.hasAttribute('data-borrow')) { borrowing = true; render(); var i = $('[name=borrow_party]', host); if (i) i.focus(); }
      else if (b.hasAttribute('data-noborrow')) { borrowing = false; render(); }
    });
    function keep(e) { var n = e.target.name; if (n && n.indexOf('borrow_') === 0) { bv[n] = e.target.value; blocked = !bv.borrow_party.trim(); apply(); } }
    host.addEventListener('input', keep); host.addEventListener('change', keep);
    ['input', 'change'].forEach(function (ev) { form.addEventListener(ev, function (e) { if (host.contains(e.target)) return; render(); }); });
    form.addEventListener('submit', function (e) { render(); if (blocked) { e.preventDefault(); e.stopImmediatePropagation(); var i = $('[name=borrow_party]', host); (i || host).scrollIntoView && (i || host).scrollIntoView({ block: 'center' }); if (i) i.focus(); } }, true);
    render();
    return { refresh: render };
  }
  function amountOf(form, name) { var el = $('[name=' + name + ']', form); return el ? parseFloat(String(el.value).replace(/,/g, '')) || 0 : 0; }
  function acctLabel(a, bal) { return a.name + ' · ' + U.money(bal) + (bal <= 0 ? ' (empty)' : ''); }

  async function txn(type, existing, onSaved) {
    var isInc = type === 'income', L;
    try { L = await lookups(); } catch (e) { U.toast(e.message, 'error'); return; }
    var cats = L.categories.filter(function (c) { return c.type === type && (c.is_active == 1 || (existing && c.id == existing.category_id)); });
    if (!L.accounts.length) { U.toast('Create an account first (Accounts page).', 'warn'); return; }
    if (!cats.length) { U.toast('Add a ' + type + ' category first (Categories page).', 'warn'); return; }
    var e = existing || {}, def = L.accounts[0];
    /* Money available in an account for THIS entry. When editing, the expense being edited already left its account, so add it back. */
    function availFor(a) { var b = Number(a.balance); if (!isInc && existing && existing.status !== 'reversed' && a.id == existing.account_id) b += Number(existing.amount); return b; }
    if (!isInc && !existing) { def = L.accounts.slice().sort(function (x, y) { return availFor(y) - availFor(x); })[0]; }
    var form = html`<form id="txnForm" class="stack">
      ${U.fields([
        { name: 'amount', label: 'Amount (TZS)', type: 'amount', required: true, value: e.amount ? Number(e.amount).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '', full: true },
        { name: 'title', label: isInc ? 'What is this income?' : 'What did you spend on?', required: true, value: e.title, placeholder: isInc ? 'e.g. Salary, Sales' : 'e.g. Lunch, Bus fare', full: true },
        { name: 'category_id', label: 'Category', type: 'select', required: true, value: e.category_id, options: opts(cats) },
        { name: 'account_id', label: isInc ? 'Received into' : 'Paid from', type: 'select', required: true, value: e.account_id || def.id, options: L.accounts.map(function (a) { return { value: a.id, label: isInc ? a.name + ' · ' + U.money(a.balance) : acctLabel(a, availFor(a)) }; }), hint: isInc ? '' : 'Only money that is really in the account can be spent.' },
        { name: 'txn_date', label: 'Date', type: 'date', required: true, value: e.txn_date || U.today(), max: U.today() }])}
      <details class="mt"><summary class="link-btn" style="cursor:pointer;display:inline-block">More details (optional)</summary><div style="margin-top:12px">${U.fields([
        { name: 'party', label: isInc ? 'Source' : 'Paid to', value: e.party }, { name: 'payment_method', label: 'Payment method', type: 'select', value: e.payment_method || '', options: methodOpts() },
        { name: 'reference', label: 'Reference number', value: e.reference }, existing ? null : { name: 'receipt', label: 'Receipt (photo or PDF)', type: 'file', attrs: 'accept="image/*,application/pdf"' },
        { name: 'description', label: 'Notes', type: 'textarea', value: e.description, full: true }])}</div></details>
      <div class="modal-foot" style="padding:12px 0 0"><button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">${existing ? 'Save changes' : isInc ? 'Save income' : 'Save expense'}</button></div></form>`;
    var m = U.modal({ title: (existing ? 'Edit ' : 'Add ') + type, body: form });
    var f = $('#txnForm', m.el); $('[name=amount]', f).focus();
    if (!isInc) fundsGuard(f, { account: 'account_id', need: function (fm) { return amountOf(fm, 'amount'); }, accounts: L.accounts, avail: availFor, debt: !existing });
    U.bindForm(f, async function (d) {
      var body = {}; ['title', 'amount', 'category_id', 'account_id', 'txn_date', 'party', 'payment_method', 'reference', 'description', 'borrow_party', 'borrow_phone', 'borrow_due_date', 'borrow_interest_rate', 'borrow_notes'].forEach(function (k) { body[k] = d[k]; });
      var j;
      if (existing) j = await Api.put('../api/' + (isInc ? 'income' : 'expenses') + '/' + existing.id, body);
      else {
        body.client_uuid = Api.uuid(); j = await Api.post('../api/' + (isInc ? 'income' : 'expenses'), body);
        var file = $('[name=receipt]', f) && $('[name=receipt]', f).files[0];
        if (file && !j.queued && j.data && j.data.id) { var fd = new FormData(); fd.append('receipt', file); try { await Api.upload('../api/' + (isInc ? 'income' : 'expenses') + '/' + j.data.id + '/receipt', fd); } catch (x) { U.toast('Saved, but the receipt could not be attached: ' + x.message, 'warn'); } }
        else if (file && j.queued) U.toast('Receipt can be attached after the entry syncs.', 'warn');
      }
      U.mount(m.body, html`<div class="center" style="padding:18px 0">${U.savedCheck()}<h3>${j.queued ? 'Saved on this device' : existing ? 'Changes saved' : isInc ? 'Income recorded' : 'Expense recorded'}</h3><p class="muted">${j.queued ? 'It will sync automatically when you are back online.' : U.money(d.amount)}</p>${d.borrow_party && !j.queued ? html`<p class="small muted">The missing part was borrowed from ${d.borrow_party} and recorded as a debt.</p>` : ''}</div>`);
      var foot = $('.modal-foot', m.el); if (foot) foot.remove();
      setTimeout(function () { m.close(); if (onSaved) onSaved(j); else if (App.refresh && window.__refreshOnSave !== false) App.refresh(); }, j.queued ? 1300 : 750);
    }, { busyText: 'Saving…' });
    return m;
  }

  async function transfer(onSaved) {
    var L; try { L = await lookups(); } catch (e) { U.toast(e.message, 'error'); return; }
    if (L.accounts.length < 2) { U.toast('You need at least two accounts to make a transfer.', 'warn'); return; }
    var acc = function (a) { return { value: a.id, label: acctLabel(a, Number(a.balance)) }; };
    var m = U.modal({ title: 'Transfer between accounts', body: html`<p class="small muted">A transfer moves your own money. It is not counted as income or an expense.</p><form id="trForm" class="stack">${U.fields([
      { name: 'amount', label: 'Amount (TZS)', type: 'amount', required: true, full: true },
      { name: 'from_account_id', label: 'From', type: 'select', required: true, options: L.accounts.map(acc), value: L.accounts[0].id },
      { name: 'to_account_id', label: 'To', type: 'select', required: true, options: L.accounts.map(acc), value: L.accounts[1].id },
      { name: 'txn_date', label: 'Date', type: 'date', required: true, value: U.today(), max: U.today() },
      { name: 'description', label: 'Note (optional)', full: true }])}
      <div class="modal-foot" style="padding:12px 0 0"><button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Transfer</button></div></form>` });
    var trf = $('#trForm', m.el);
    fundsGuard(trf, { account: 'from_account_id', need: function (fm) { return amountOf(fm, 'amount'); }, accounts: L.accounts });
    U.bindForm(trf, async function (d) {
      d.client_uuid = Api.uuid(); await Api.post('../api/accounts/transfer', d);
      U.toast('Transfer saved.'); m.close(); if (onSaved) onSaved(); else if (App.refresh) App.refresh();
    }, { busyText: 'Transferring…' });
  }

  /* Reusable render of one ledger row */
  var ICON = { income: 'arrow-down', expense: 'arrow-up', transfer_in: 'swap', transfer_out: 'swap', debt_borrowed: 'handshake', debt_lent: 'handshake', debt_collected: 'handshake', debt_repaid: 'handshake', savings_contribution: 'piggy', savings_withdrawal: 'piggy' };
  var CLS = { income: 'income', expense: 'expense' };
  var INFLOW = ['income', 'transfer_in', 'debt_borrowed', 'debt_collected', 'savings_withdrawal'];
  function txnRow(t, extra) {
    var inflow = INFLOW.indexOf(t.type) >= 0, cls = CLS[t.type] || 'transfer';
    return html`<div class="txn"><div class="ti ${cls}">${U.icon(ICON[t.type] || 'list')}</div><div class="meta"><b>${t.title}</b><span class="small muted">${[t.category_name, t.account_name, U.date(t.txn_date)].filter(Boolean).join(' · ')}</span></div><div class="amt ${cls === 'income' ? 'pos' : cls === 'expense' ? 'neg' : ''}">${inflow ? '+' : '-'}${U.money(t.amount).replace('TZS ', 'TZS ')}</div>${extra || ''}</div>`;
  }

  window.App = window.App || {};
  App.forms = { fundsGuard: fundsGuard, amountOf: amountOf, acctLabel: acctLabel, txn: txn, transfer: transfer, lookups: lookups, txnRow: txnRow, METHODS: METHODS, methodOpts: methodOpts, opts: opts, INFLOW: INFLOW };
})();
