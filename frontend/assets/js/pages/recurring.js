/* Recurring items. Scheduled is not posted: nothing is recorded until you confirm each occurrence. */
(function () {
  'use strict';
  var U = window.UI, html = U.html, $ = U.$;
  var FREQ = [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly'], ['custom', 'Every N days']];
  async function render(view, App) {
    var items = (await Api.get('../api/recurring')).data.items, byId = {}; items.forEach(function (r) { byId[r.id] = r; });
    var L = await App.forms.lookups();
    var due = items.filter(function (r) { return r.is_due == 1; });
    U.mount(view, html`${App.pageHead('Recurring', 'Salaries, rent, subscriptions and other repeating items. Nothing is recorded until you confirm it.', html`<button class="btn btn-primary" id="addR">${U.icon('plus')} New recurring item</button>`)}
      ${due.length ? html`<div class="card mb" style="border-color:var(--gold-500)"><h3>${U.icon('bell')} Due now</h3>${due.map(function (r) { return html`<div class="txn"><div class="ti ${r.type}">${U.icon(r.type === 'income' ? 'arrow-down' : 'arrow-up')}</div><div class="meta"><b>${r.title}</b><span class="small muted">Due ${U.date(r.next_due)} · ${r.account_name}</span></div><div class="amt">${U.money(r.amount)}</div><button class="btn btn-gold btn-sm" data-confirm="${r.id}">Record</button><button class="btn btn-ghost btn-sm" data-skip="${r.id}">Skip</button></div>`; })}</div>` : ''}
      ${items.length ? U.table([
        { label: 'Item', render: function (r) { return html`<b>${r.title}</b><div class="small muted">${r.category_name} · ${r.account_name}</div>`; } }, { label: 'Type', render: function (r) { return U.badge(r.type); } },
        { label: 'Amount', align: 'right', render: function (r) { return U.money(r.amount); } }, { label: 'Repeats', render: function (r) { return r.frequency === 'custom' ? 'Every ' + r.interval_days + ' days' : U.label(r.frequency); } },
        { label: 'Next due', render: function (r) { return r.is_active == 1 ? U.date(r.next_due) : U.badge('', 'Paused / ended'); } },
        { label: 'Actions', cls: 'actions', render: function (r) { return html`<button class="icon-btn" data-edit="${r.id}" aria-label="Edit ${r.title}">${U.icon('edit')}</button> <button class="btn btn-ghost btn-sm" data-pause="${r.id}">${r.is_active == 1 ? 'Pause' : 'Resume'}</button> <button class="icon-btn" data-del="${r.id}" aria-label="Delete ${r.title}">${U.icon('trash')}</button>`; } }], items)
        : U.empty('Nothing scheduled', 'Add repeating items like rent or salary so you never forget them.', html`<button class="btn btn-primary" id="addR2">Add one</button>`)}`);
    function form(r) {
      var m = U.modal({ title: r ? 'Edit recurring item' : 'New recurring item', body: html`<form id="rf" class="stack">${U.fields([
        { name: 'type', label: 'Type', type: 'select', required: true, value: r ? r.type : 'expense', options: [{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }] },
        { name: 'title', label: 'Title', required: true, value: r && r.title, placeholder: 'e.g. Rent, Salary' }, { name: 'amount', label: 'Amount (TZS)', type: 'amount', required: true, value: r ? Number(r.amount).toLocaleString('en-US') : '' },
        { name: 'category_id', label: 'Category', type: 'select', required: true, options: [] }, { name: 'account_id', label: 'Account', type: 'select', required: true, value: r ? r.account_id : L.accounts[0] && L.accounts[0].id, options: L.accounts.map(function (a) { return { value: a.id, label: a.name }; }) },
        { name: 'frequency', label: 'Repeats', type: 'select', required: true, value: r ? r.frequency : 'monthly', options: FREQ.map(function (f) { return { value: f[0], label: f[1] }; }) }, { name: 'interval_days', label: 'Every how many days?', type: 'number', min: 1, value: r && r.interval_days },
        { name: 'start_date', label: 'First date', type: 'date', required: true, value: r ? r.start_date : U.today() }, { name: 'end_date', label: 'End date (optional)', type: 'date', value: r && r.end_date }])}
        <div class="modal-foot" style="padding:12px 0 0"><button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Save</button></div></form>` });
      var f = $('#rf', m.el), type = $('[name=type]', f), cat = $('[name=category_id]', f), fr = $('[name=frequency]', f);
      function cats() { cat.innerHTML = L.categories.filter(function (c) { return c.type === type.value; }).map(function (c) { return '<option value="' + c.id + '"' + (r && r.category_id == c.id ? ' selected' : '') + '>' + U.esc(c.name) + '</option>'; }).join(''); }
      function fq() { $('[data-field=interval_days]', f).classList.toggle('hide', fr.value !== 'custom'); }
      type.onchange = cats; fr.onchange = fq; cats(); fq();
      U.bindForm(f, async function (v) { if (r) await Api.put('../api/recurring/' + r.id, v); else await Api.post('../api/recurring', v); U.toast('Saved.'); m.close(); App.refresh(); });
    }
    U.on(view, 'click', '#addR, #addR2', function () { form(null); });
    U.on(view, 'click', '[data-edit]', function (e, b) { form(byId[b.dataset.edit]); });
    U.on(view, 'click', '[data-pause]', async function (e, b) { var x = byId[b.dataset.pause]; try { await Api.put('../api/recurring/' + x.id, { is_active: x.is_active == 1 ? 0 : 1 }); App.refresh(); } catch (er) { U.toast(er.message, 'error'); } });
    U.on(view, 'click', '[data-del]', async function (e, b) { var x = byId[b.dataset.del]; if (!(await U.confirm({ title: 'Delete recurring item?', message: 'Future occurrences stop. Records you already confirmed are kept.', confirmText: 'Delete', danger: true }))) return; try { await Api.del('../api/recurring/' + x.id); U.toast('Deleted.'); App.refresh(); } catch (er) { U.toast(er.message, 'error'); } });
    U.on(view, 'click', '[data-skip]', async function (e, b) { try { await Api.post('../api/recurring/' + b.dataset.skip + '/skip'); U.toast('Skipped.'); App.refresh(); } catch (er) { U.toast(er.message, 'error'); } });
    U.on(view, 'click', '[data-confirm]', function (e, b) {
      var x = byId[b.dataset.confirm];
      var m = U.modal({ title: 'Record ' + x.title, size: 'sm', body: html`<p class="small muted">Confirm the actual amount and date. You can change them if this occurrence was different.</p><form id="cf" class="stack">${U.fields([{ name: 'amount', label: 'Amount (TZS)', type: 'amount', required: true, value: Number(x.amount).toLocaleString('en-US'), full: true }, { name: 'txn_date', label: 'Date', type: 'date', required: true, value: x.next_due > U.today() ? U.today() : x.next_due, max: U.today(), full: true }])}<div class="modal-foot" style="padding:12px 0 0"><button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Record</button></div></form>` });
      U.bindForm($('#cf', m.el), async function (v) { await Api.post('../api/recurring/' + x.id + '/confirm', v); U.toast('Recorded.'); m.close(); App.refresh(); });
    });
  }
  App.page('recurring', { title: 'Recurring', feature: 'recurring', render: render });
})();
