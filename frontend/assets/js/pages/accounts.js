/* Accounts (with transfers) and Categories. */
(function () {
  'use strict';
  var U = window.UI, html = U.html, $ = U.$;
  var ATYPES = [['cash', 'Cash'], ['bank', 'Bank account'], ['mobile_money', 'Mobile money'], ['savings', 'Savings account'], ['other', 'Other']];
  var AICON = { cash: 'cash', bank: 'card', mobile_money: 'phone', savings: 'piggy', other: 'wallet' };

  async function accounts(view, App) {
    var d = (await Api.get('../api/accounts')).data, items = d.items, byId = {}; items.forEach(function (a) { byId[a.id] = a; });
    U.mount(view, html`${App.pageHead('Accounts', 'Where your money is kept. Balances update automatically.', html`<button class="btn btn-ghost" id="trBtn">${U.icon('swap')} Transfer</button><button class="btn btn-primary" id="addAcc">${U.icon('plus')} Add account</button>`)}
      <div class="card stat mb"><div class="label"><span class="ico">${U.icon('wallet')}</span>Total balance (active accounts)</div><div class="value num" data-count="${d.total_balance}">${U.money(d.total_balance)}</div></div>
      <div class="grid cols-3 stagger">${items.map(function (a) { return html`<div class="card" ${a.is_active == 1 ? '' : U.raw('style="opacity:.65"')}><div class="row spread"><div class="row"><span class="ico" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--surface-3)">${U.icon(AICON[a.type] || 'wallet')}</span><div><b>${a.name}</b><div class="small muted">${U.label(a.type)}${a.is_active == 1 ? '' : ' · Archived'}</div></div></div></div>
        <div class="value num" style="font-size:1.4rem;font-weight:700;margin:12px 0 10px;color:${Number(a.balance) < 0 ? 'var(--danger)' : 'var(--heading)'}">${U.money(a.balance)}</div>
        <div class="row"><button class="btn btn-ghost btn-sm" data-edit="${a.id}">${U.icon('edit')} Edit</button><button class="btn btn-ghost btn-sm" data-toggle="${a.id}">${a.is_active == 1 ? 'Archive' : 'Reactivate'}</button><button class="btn btn-ghost btn-sm" data-del="${a.id}" aria-label="Delete ${a.name}">${U.icon('trash')}</button></div></div>`; })}</div>`);
    Motion.scan(view);
    function form(a) {
      var m = U.modal({ title: a ? 'Edit account' : 'Add account', body: html`<form id="af" class="stack">${U.fields([{ name: 'name', label: 'Account name', required: true, value: a && a.name, placeholder: 'e.g. CRDB Bank, M-Pesa', full: true },
        { name: 'type', label: 'Type', type: 'select', value: a ? a.type : 'cash', options: ATYPES.map(function (t) { return { value: t[0], label: t[1] }; }) },
        { name: 'opening_balance', label: 'Opening balance (TZS)', type: 'amount', value: a ? Number(a.opening_balance).toLocaleString('en-US') : '0', hint: 'What this account held when you started using the app.' }])}
        <div class="modal-foot" style="padding:12px 0 0"><button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">${a ? 'Save' : 'Create account'}</button></div></form>` });
      U.bindForm($('#af', m.el), async function (v) { if (a) await Api.put('../api/accounts/' + a.id, v); else await Api.post('../api/accounts', v); U.toast('Account saved.'); m.close(); App.refresh(); });
    }
    $('#addAcc').onclick = function () { form(null); };
    $('#trBtn').onclick = function () { App.forms.transfer(); };
    U.on(view, 'click', '[data-edit]', function (e, b) { form(byId[b.dataset.edit]); });
    U.on(view, 'click', '[data-toggle]', async function (e, b) { try { var j = await Api.post('../api/accounts/' + b.dataset.toggle + '/toggle'); U.toast(j.message); App.refresh(); } catch (er) { U.toast(er.message, 'error'); } });
    U.on(view, 'click', '[data-del]', async function (e, b) { var a = byId[b.dataset.del]; if (!(await U.confirm({ title: 'Delete account?', message: 'Delete “' + a.name + '”? This is only possible for accounts with no history. Otherwise archive it.', confirmText: 'Delete', danger: true }))) return; try { await Api.del('../api/accounts/' + a.id); U.toast('Account deleted.'); App.refresh(); } catch (er) { U.toast(er.message, 'error'); } });
    if (App.query().get('new') === '1') form(null);
  }

  async function categories(view, App) {
    var items = (await Api.get('../api/categories?all=1')).data.items, byId = {}; items.forEach(function (c) { byId[c.id] = c; });
    function col(type, title) {
      var list = items.filter(function (c) { return c.type === type; });
      return html`<div class="card"><div class="row spread"><h3 style="margin:0">${title}</h3><button class="btn btn-ghost btn-sm" data-add="${type}">${U.icon('plus')} Add</button></div><div class="mt">${list.length ? list.map(function (c) { return html`<div class="txn" ${c.is_active == 1 ? '' : U.raw('style="opacity:.6"')}><div class="meta"><b>${c.name}</b><span class="small muted">${c.uses} record${c.uses == 1 ? '' : 's'}${c.is_active == 1 ? '' : ' · Hidden'}</span></div><button class="icon-btn" data-edit="${c.id}" aria-label="Rename ${c.name}">${U.icon('edit')}</button><button class="icon-btn" data-del="${c.id}" aria-label="Delete ${c.name}">${U.icon('trash')}</button></div>`; }) : U.empty('No categories', 'Add one to get started.')}</div></div>`;
    }
    U.mount(view, html`${App.pageHead('Categories', 'Organise your income and expenses. Renaming never changes past records.')}<div class="grid cols-2">${col('expense', 'Expense categories')}${col('income', 'Income categories')}</div>`);
    function form(c, type) {
      var m = U.modal({ title: c ? 'Rename category' : 'New ' + type + ' category', size: 'sm', body: html`<form id="cf" class="stack">${U.fields([{ name: 'name', label: 'Name', required: true, value: c && c.name, full: true }])}<div class="modal-foot" style="padding:12px 0 0"><button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Save</button></div></form>` });
      U.bindForm($('#cf', m.el), async function (v) { if (c) await Api.put('../api/categories/' + c.id, v); else await Api.post('../api/categories', { name: v.name, type: type }); U.toast('Category saved.'); m.close(); try { localStorage.removeItem('et_lookups'); } catch (e) {} App.refresh(); });
    }
    U.on(view, 'click', '[data-add]', function (e, b) { form(null, b.dataset.add); });
    U.on(view, 'click', '[data-edit]', function (e, b) { form(byId[b.dataset.edit]); });
    U.on(view, 'click', '[data-del]', async function (e, b) { var c = byId[b.dataset.del]; if (!(await U.confirm({ title: 'Delete category?', message: c.uses ? '“' + c.name + '” is used by ' + c.uses + ' record(s), so it will be hidden instead of deleted. Your records keep it.' : 'Delete “' + c.name + '”?', confirmText: c.uses ? 'Hide' : 'Delete', danger: true }))) return; try { var j = await Api.del('../api/categories/' + c.id); U.toast(j.message); App.refresh(); } catch (er) { U.toast(er.message, 'error'); } });
  }

  App.page('accounts', { title: 'Accounts', feature: 'accounts', render: accounts });
  App.page('categories', { title: 'Categories', feature: 'categories', render: categories });
})();
