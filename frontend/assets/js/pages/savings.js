/* Savings goals: contributions and withdrawals are moves between an account and a goal (not income/expense). */
(function () {
  'use strict';
  var U = window.UI, html = U.html, $ = U.$;
  async function render(view, App) {
    var d = (await Api.get('../api/savings')).data, items = d.items, byId = {}; items.forEach(function (g) { byId[g.id] = g; });
    U.mount(view, html`${App.pageHead('Savings goals', 'Put money aside for what matters.', html`<button class="btn btn-primary" id="addG">${U.icon('plus')} New goal</button>`)}
      <div class="card stat mb"><div class="label"><span class="ico">${U.icon('piggy')}</span>Total saved</div><div class="value num" data-count="${d.total}">${U.money(d.total)}</div></div>
      ${items.length ? html`<div class="grid cols-3 stagger">${items.map(function (g) {
        var pct = Number(g.percent), done = pct >= 100, days = g.target_date ? Math.ceil((new Date(g.target_date) - new Date(U.today())) / 864e5) : null;
        return html`<div class="card" ${g.is_active == 1 ? '' : U.raw('style="opacity:.6"')}><div class="row spread"><b>${g.name}</b>${done ? U.badge('success', 'Goal reached') : g.is_active == 1 ? '' : U.badge('', 'Archived')}</div>
          <div class="num" style="font-size:1.3rem;font-weight:700;margin:10px 0 2px">${U.money(g.balance)}</div><div class="small muted">of ${U.money(g.target_amount)} · ${Number(g.remaining) > 0 ? U.money(g.remaining) + ' to go' : 'fully funded'}</div>
          <div style="margin-top:8px">${U.progress(pct, 'var(--green-500)')}</div><div class="row spread small muted" style="margin-top:6px"><span>${Math.round(pct)}%</span><span>${g.target_date ? (days >= 0 ? days + ' day' + (days === 1 ? '' : 's') + ' left' : 'Target date passed') : 'No target date'}</span></div>
          <div class="row" style="margin-top:12px"><button class="btn btn-gold btn-sm" data-add="${g.id}">Add money</button><button class="btn btn-ghost btn-sm" data-wd="${g.id}">Withdraw</button><button class="btn btn-ghost btn-sm" data-hist="${g.id}">History</button><button class="btn btn-ghost btn-sm" data-edit="${g.id}" aria-label="Edit ${g.name}">${U.icon('edit')}</button></div></div>`; })}</div>`
        : U.empty('No savings goals yet', 'Create a goal such as an emergency fund, school fees or a new phone.', html`<button class="btn btn-primary" id="addG2">Create a goal</button>`)}`);
    Motion.scan(view);
    function goalForm(g) {
      var m = U.modal({ title: g ? 'Edit goal' : 'New savings goal', body: html`<form id="gf" class="stack">${U.fields([{ name: 'name', label: 'Goal name', required: true, value: g && g.name, placeholder: 'e.g. Emergency fund', full: true },
        { name: 'target_amount', label: 'Target (TZS)', type: 'amount', required: true, value: g ? Number(g.target_amount).toLocaleString('en-US') : '' }, { name: 'target_date', label: 'Target date (optional)', type: 'date', value: g && g.target_date },
        g ? { name: 'is_active', label: 'Goal is active', type: 'checkbox', value: g.is_active == 1, full: true } : null, { name: 'notes', label: 'Notes', value: g && g.notes, full: true }])}
        <div class="modal-foot" style="padding:12px 0 0">${g ? html`<button class="btn btn-ghost" type="button" id="delG" style="margin-right:auto">${U.icon('trash')} Delete</button>` : ''}<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Save</button></div></form>` });
      var dg = $('#delG', m.el); if (dg) dg.onclick = async function () { if (!(await U.confirm({ title: 'Delete goal?', message: 'Only goals with no saved money can be deleted. Otherwise withdraw first or archive it.', confirmText: 'Delete', danger: true }))) return; try { await Api.del('../api/savings/' + g.id); U.toast('Goal deleted.'); m.close(); App.refresh(); } catch (e) { U.toast(e.message, 'error'); } };
      U.bindForm($('#gf', m.el), async function (v) { if (g) await Api.put('../api/savings/' + g.id, v); else await Api.post('../api/savings', v); U.toast('Goal saved.'); m.close(); App.refresh(); });
    }
    async function moveForm(g, kind) {
      var L = await App.forms.lookups(), add = kind === 'contribute';
      var m = U.modal({ title: (add ? 'Add money to ' : 'Withdraw from ') + g.name, size: 'sm', body: html`<p class="small muted">${add ? 'Moves money from an account into this goal. It is not an expense.' : 'Moves money from this goal back to an account. It is not income. Saved: ' + U.money(g.balance)}</p><form id="mf" class="stack">${U.fields([
        { name: 'amount', label: 'Amount (TZS)', type: 'amount', required: true, full: true }, { name: 'account_id', label: add ? 'From account' : 'To account', type: 'select', required: true, options: L.accounts.map(function (a) { return { value: a.id, label: App.forms.acctLabel(a, Number(a.balance)) }; }), full: true },
        { name: 'txn_date', label: 'Date', type: 'date', required: true, value: U.today(), max: U.today(), full: true }, { name: 'description', label: 'Note (optional)', full: true }])}
        <div class="modal-foot" style="padding:12px 0 0"><button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">${add ? 'Add money' : 'Withdraw'}</button></div></form>` });
      var mf = $('#mf', m.el);
      if (add) App.forms.fundsGuard(mf, { account: 'account_id', need: function (fm) { return App.forms.amountOf(fm, 'amount'); }, accounts: L.accounts });
      U.bindForm(mf, async function (v) { v.client_uuid = Api.uuid(); var j = await Api.post('../api/savings/' + g.id + '/' + kind, v); U.toast(j.message); m.close(); try { localStorage.removeItem('et_lookups'); } catch (e) {} App.refresh(); });
    }
    async function history(g) {
      var h = (await Api.get('../api/savings/' + g.id + '/history')).data.items;
      var m = U.modal({ title: g.name + ' · history', size: 'wide', body: h.length ? U.table([{ label: 'Date', render: function (r) { return U.date(r.txn_date); } }, { label: 'Type', render: function (r) { return r.type === 'savings_contribution' ? 'Added' : 'Withdrawn'; } }, { label: 'Account', render: function (r) { return r.account_name; } }, { label: 'Amount', align: 'right', render: function (r) { return U.money(r.amount); } }, { label: '', cls: 'actions', render: function (r) { return r.status === 'posted' ? html`<button class="btn btn-ghost btn-sm" data-rev="${r.id}">Reverse</button>` : U.badge('reversed'); } }], h) : html`<p class="muted">No activity yet.</p>` });
      U.on(m.el, 'click', '[data-rev]', async function (e, b) { if (!(await U.confirm({ title: 'Reverse this entry?', message: 'The goal and account balances will be restored.', confirmText: 'Reverse', danger: true }))) return; try { await Api.del('../api/savings/' + g.id + '/history/' + b.dataset.rev); U.toast('Reversed.'); m.close(); App.refresh(); } catch (er) { U.toast(er.message, 'error'); } });
    }
    U.on(view, 'click', '#addG, #addG2', function () { goalForm(null); });
    U.on(view, 'click', '[data-edit]', function (e, b) { goalForm(byId[b.dataset.edit]); });
    U.on(view, 'click', '[data-add]', function (e, b) { moveForm(byId[b.dataset.add], 'contribute'); });
    U.on(view, 'click', '[data-wd]', function (e, b) { moveForm(byId[b.dataset.wd], 'withdraw'); });
    U.on(view, 'click', '[data-hist]', function (e, b) { history(byId[b.dataset.hist]); });
  }
  App.page('savings', { title: 'Savings', feature: 'savings', render: render });
})();
