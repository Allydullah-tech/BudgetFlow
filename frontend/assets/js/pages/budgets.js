/* Budgets with progress and configurable alert thresholds. */
(function () {
  'use strict';
  var U = window.UI, html = U.html, $ = U.$;
  async function render(view, App) {
    var items = (await Api.get('../api/budgets')).data.items, byId = {}; items.forEach(function (b) { byId[b.id] = b; });
    var L = await App.forms.lookups(), cats = L.categories.filter(function (c) { return c.type === 'expense'; });
    var active = items.filter(function (b) { return b.is_active == 1; });
    U.mount(view, html`${App.pageHead('Budgets', 'Set spending limits and get alerts as you approach them.', html`<button class="btn btn-primary" id="addB">${U.icon('plus')} New budget</button>`)}
      ${items.length ? html`<div class="grid cols-3 stagger">${items.map(function (b) {
        var pct = b.percent_used === null ? 0 : Number(b.percent_used), over = Number(b.remaining) < 0;
        return html`<div class="card" ${b.is_active == 1 ? '' : U.raw('style="opacity:.6"')}><div class="row spread"><b>${b.name}</b>${U.badge(b.status === 'exceeded' ? 'danger' : b.status === 'warning' ? 'warn' : 'success', b.is_active == 1 ? (b.status === 'exceeded' ? 'Exceeded' : b.status === 'warning' ? 'Warning' : 'On track') : 'Paused')}</div>
          <div class="small muted">${b.category_name || 'All spending'} · ${U.label(b.period)} · ${U.date(b.period_from)} – ${U.date(b.period_to)}</div>
          <div class="num" style="font-size:1.25rem;font-weight:700;margin:10px 0 4px">${U.money(b.spent)} <span class="small muted" style="font-weight:400">of ${U.money(b.amount)}</span></div>${U.progress(pct)}
          <div class="row spread small" style="margin-top:8px"><span class="${over ? 'neg' : 'muted'}">${over ? 'Over by ' + U.money(Math.abs(b.remaining)) : U.money(b.remaining) + ' left'}</span><span>${Math.round(pct)}%</span></div>
          <div class="row" style="margin-top:12px"><button class="btn btn-ghost btn-sm" data-edit="${b.id}">${U.icon('edit')} Edit</button><button class="btn btn-ghost btn-sm" data-pause="${b.id}">${b.is_active == 1 ? 'Pause' : 'Resume'}</button><button class="btn btn-ghost btn-sm" data-del="${b.id}" aria-label="Delete ${b.name}">${U.icon('trash')}</button></div></div>`; })}</div>`
        : U.empty('No budgets yet', 'Create a monthly budget to see how much you have left to spend.', html`<button class="btn btn-primary" id="addB2">Create a budget</button>`)}`);
    Motion.scan(view);
    function form(b) {
      var m = U.modal({ title: b ? 'Edit budget' : 'New budget', body: html`<form id="bf" class="stack">${U.fields([
        { name: 'name', label: 'Budget name', required: true, value: b && b.name, placeholder: 'e.g. Monthly food', full: true },
        { name: 'amount', label: 'Limit (TZS)', type: 'amount', required: true, value: b ? Number(b.amount).toLocaleString('en-US') : '' },
        { name: 'period', label: 'Period', type: 'select', required: true, value: b ? b.period : 'monthly', options: [{ value: 'monthly', label: 'Monthly (calendar month)' }, { value: 'weekly', label: 'Weekly (Mon–Sun)' }, { value: 'custom', label: 'Custom dates' }] },
        { name: 'category_id', label: 'Category', type: 'select', value: b && b.category_id || '', options: [{ value: '', label: 'All spending' }].concat(cats.map(function (c) { return { value: c.id, label: c.name }; })), full: true },
        { name: 'start_date', label: 'Start date', type: 'date', value: b && b.start_date }, { name: 'end_date', label: 'End date', type: 'date', value: b && b.end_date },
        { name: 'alert_thresholds', label: 'Alert me at (% used)', value: b ? b.alert_thresholds : '50,75,90,100', hint: 'Comma-separated. Default 50, 75, 90 and 100.', full: true }])}
        <div class="modal-foot" style="padding:12px 0 0"><button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">${b ? 'Save' : 'Create budget'}</button></div></form>` });
      var f = $('#bf', m.el), per = $('[name=period]', f);
      function sync() { var c = per.value === 'custom'; ['start_date', 'end_date'].forEach(function (n) { $('[data-field=' + n + ']', f).classList.toggle('hide', !c); }); } per.onchange = sync; sync();
      U.bindForm(f, async function (v) { if (b) await Api.put('../api/budgets/' + b.id, v); else await Api.post('../api/budgets', v); U.toast('Budget saved.'); m.close(); App.refresh(); });
    }
    U.on(view, 'click', '#addB, #addB2', function () { form(null); });
    U.on(view, 'click', '[data-edit]', function (e, b) { form(byId[b.dataset.edit]); });
    U.on(view, 'click', '[data-pause]', async function (e, b) { var x = byId[b.dataset.pause]; try { await Api.put('../api/budgets/' + x.id, { is_active: x.is_active == 1 ? 0 : 1 }); App.refresh(); } catch (er) { U.toast(er.message, 'error'); } });
    U.on(view, 'click', '[data-del]', async function (e, b) { var x = byId[b.dataset.del]; if (!(await U.confirm({ title: 'Delete budget?', message: 'Delete “' + x.name + '”? Your transactions are not affected.', confirmText: 'Delete', danger: true }))) return; try { await Api.del('../api/budgets/' + x.id); U.toast('Budget deleted.'); App.refresh(); } catch (er) { U.toast(er.message, 'error'); } });
  }
  App.page('budgets', { title: 'Budgets', feature: 'budgets', render: render });
})();
