/* Income, Expenses and the unified Transactions list. */
(function () {
  'use strict';
  var U = window.UI, html = U.html, $ = U.$;
  var TYPES = [['', 'All types'], ['income', 'Income'], ['expense', 'Expenses'], ['transfer', 'Transfers'], ['debt', 'Debts'], ['savings', 'Savings']];

  function range(preset) {
    var d = new Date(), y = d.getFullYear(), m = d.getMonth(), t = U.today();
    if (preset === 'today') return [t, t];
    if (preset === 'week') { var s = new Date(d); s.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return [U.ymd(s), t]; }
    if (preset === 'month') return [U.ymd(new Date(y, m, 1)), t];
    if (preset === 'lastmonth') return [U.ymd(new Date(y, m - 1, 1)), U.ymd(new Date(y, m, 0))];
    if (preset === 'year') return [y + '-01-01', t];
    return ['', ''];
  }

  function make(kind) {
    return async function render(view, App) {
      var st = { page: 1, q: '', preset: 'month', from: '', to: '', category_id: '', account_id: '', payment_method: '', type: '', sort: 'date', dir: 'desc' };
      var L = null; try { L = await App.forms.lookups(); } catch (e) { L = null; }
      var singular = kind === 'income' ? 'income' : kind === 'expenses' ? 'expense' : null;
      var base = Api.url('../api/' + kind);

      function params() {
        var r = st.preset === 'custom' ? [st.from, st.to] : range(st.preset);
        var p = { q: st.q, from: r[0], to: r[1], category_id: st.category_id, account_id: st.account_id, payment_method: st.payment_method, sort: st.sort, dir: st.dir, page: st.page };
        if (kind === 'transactions') p.type = st.type; return p;
      }
      function skeleton() {
        var cats = L ? L.categories.filter(function (c) { return !singular || c.type === singular; }) : [];
        U.mount(view, html`
          ${App.pageHead(kind === 'income' ? 'Income' : kind === 'expenses' ? 'Expenses' : 'All transactions', kind === 'transactions' ? 'Every movement of money in one place.' : 'Record and review everything you ' + (kind === 'income' ? 'earn.' : 'spend.'),
            html`${App.has('export') ? html`<a class="btn btn-ghost" id="exportBtn" href="#">${U.icon('download')} Export CSV</a>` : ''}${singular ? html`<button class="btn btn-primary" id="addBtn">${U.icon('plus')} Add ${singular}</button>` : html`<button class="btn btn-primary" data-quick="expense">${U.icon('plus')} Add expense</button>`}`)}
          <div id="pending"></div>
          <div class="toolbar">
            <div class="search"><span>${U.icon('search')}</span><input class="input" id="q" type="search" placeholder="Search title, note, amount, date…" aria-label="Search" value="${st.q}"></div>
            <select class="input" id="preset" aria-label="Period">${[['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['lastmonth', 'Last month'], ['year', 'This year'], ['all', 'All time'], ['custom', 'Custom']].map(function (o) { return html`<option value="${o[0]}" ${st.preset === o[0] ? U.raw('selected') : ''}>${o[1]}</option>`; })}</select>
            <span id="custom" class="row ${st.preset === 'custom' ? '' : 'hide'}"><input class="input" type="date" id="from" aria-label="From" value="${st.from}"><input class="input" type="date" id="to" aria-label="To" value="${st.to}"></span>
            ${kind === 'transactions' ? html`<select class="input" id="type" aria-label="Type">${TYPES.map(function (o) { return html`<option value="${o[0]}">${o[1]}</option>`; })}</select>` : ''}
            <select class="input" id="cat" aria-label="Category"><option value="">All categories</option>${cats.map(function (c) { return html`<option value="${c.id}">${c.name}</option>`; })}</select>
            <select class="input" id="acc" aria-label="Account"><option value="">All accounts</option>${(L ? L.accounts : []).map(function (a) { return html`<option value="${a.id}">${a.name}</option>`; })}</select>
            <select class="input" id="meth" aria-label="Payment method"><option value="">Any method</option>${App.forms.METHODS.map(function (m) { return html`<option>${m}</option>`; })}</select>
            <select class="input" id="sort" aria-label="Sort"><option value="date:desc">Newest first</option><option value="date:asc">Oldest first</option><option value="amount:desc">Highest amount</option><option value="amount:asc">Lowest amount</option><option value="title:asc">Title A–Z</option></select>
          </div>
          <div class="grid cols-3 mb stagger" id="sums"></div>
          <div id="list">${U.skeleton(3)}</div><div id="pager"></div>`);
        var ex = $('#exportBtn'); if (ex) ex.onclick = function (e) { e.preventDefault(); window.location = base + '/export' + Api.qs(Object.assign(params(), { page: '' })); };
        var add = $('#addBtn'); if (add) add.onclick = function () { App.forms.txn(singular); };
        $('#q').addEventListener('input', U.debounce(function (e) { st.q = e.target.value; st.page = 1; load(); }, 350));
        $('#preset').onchange = function (e) { st.preset = e.target.value; $('#custom').classList.toggle('hide', st.preset !== 'custom'); st.page = 1; if (st.preset !== 'custom') load(); };
        ['from', 'to'].forEach(function (k) { $('#' + k).onchange = function (e) { st[k] = e.target.value; st.page = 1; load(); }; });
        [['cat', 'category_id'], ['acc', 'account_id'], ['meth', 'payment_method'], ['type', 'type']].forEach(function (p) { var el = $('#' + p[0]); if (el) el.onchange = function (e) { st[p[1]] = e.target.value; st.page = 1; load(); }; });
        $('#sort').onchange = function (e) { var s = e.target.value.split(':'); st.sort = s[0]; st.dir = s[1]; st.page = 1; load(); };
        $('#preset').value = st.preset;
        U.on(view, 'click', '[data-page]', function (e, b) { if (b.disabled) return; st.page = +b.dataset.page; load(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
        U.on(view, 'click', '[data-edit]', function (e, b) { var row = rows[b.dataset.edit]; if (row) App.forms.txn(row.type, row); });
        U.on(view, 'click', '[data-rev]', async function (e, b) {
          var row = rows[b.dataset.rev];
          if (!(await U.confirm({ title: 'Reverse this entry?', message: '“' + row.title + '” (' + U.money(row.amount) + ') will be removed from your balances and reports. A record of the reversal is kept for your history.', confirmText: 'Reverse', danger: true }))) return;
          try { await Api.del('../api/' + (kind === 'transactions' ? 'transactions' : kind) + '/' + row.id); U.toast('Entry reversed.'); load(); } catch (err) { U.toast(err.message, 'error'); }
        });
        pendingBox();
      }
      var rows = {};
      function pendingBox() {
        var q = Api.queue.all(), h = $('#pending'); if (!h) return;
        if (!q.length) { h.innerHTML = ''; return; }
        U.mount(h, html`<div class="banner warn">${U.icon('wifi-off')}<div class="grow"><b>${q.length} entr${q.length > 1 ? 'ies' : 'y'} waiting to sync.</b> ${q.map(function (x) { return x.body.title + ' (' + U.money(x.body.amount) + ')' + (x.rejected ? ' — rejected: ' + x.error : ''); }).join(', ')}</div><button class="btn btn-sm btn-ghost" id="syncNow">Sync now</button></div>`);
        var s = $('#syncNow'); if (s) s.onclick = async function () { await PWA.sync(true); pendingBox(); load(); };
      }
      async function load() {
        var list = $('#list'); if (!list) return;
        try {
          var j = await Api.get(base + Api.qs(params())), d = j.data; rows = {}; d.items.forEach(function (r) { rows[r.id] = r; });
          var sm = d.summary;
          U.mount($('#sums'), html`${kind !== 'expenses' ? html`<div class="card stat income"><div class="label">Income</div><div class="value">${U.money(sm.income)}</div></div>` : ''}${kind !== 'income' ? html`<div class="card stat expense"><div class="label">Expenses</div><div class="value">${U.money(sm.expenses)}</div></div>` : ''}<div class="card stat"><div class="label">Records</div><div class="value">${sm.total}</div></div>`);
          var cols = [
            { label: 'Date', render: function (r) { return U.date(r.txn_date); }, cls: 'nowrap' },
            { label: 'Title', render: function (r) { return html`<b>${r.title}</b>${r.party ? html`<div class="small muted">${r.party}</div>` : ''}${r.recurring_id ? html` <span class="badge info">Recurring</span>` : ''}`; } },
            { label: 'Category', render: function (r) { return r.category_name || '—'; } },
            { label: 'Account', render: function (r) { return r.account_name; } }];
          if (kind === 'transactions') cols.splice(1, 0, { label: 'Type', render: function (r) { return U.badge(App.forms.INFLOW.indexOf(r.type) >= 0 ? 'income' : r.type === 'expense' ? 'expense' : 'transfer', U.label(r.type)); } });
          cols.push({ label: 'Amount', align: 'right', render: function (r) { var inflow = App.forms.INFLOW.indexOf(r.type) >= 0; return html`<span class="${r.type === 'income' ? 'pos' : r.type === 'expense' ? 'neg' : ''}">${inflow ? '+' : '−'}${U.money(r.amount)}</span>`; } });
          cols.push({ label: 'Actions', cls: 'actions', render: function (r) {
            var editable = (r.type === 'income' || r.type === 'expense') && r.status === 'posted' && !r.debt_id && !r.goal_id;
            return html`${r.has_receipt == 1 ? html`<a class="icon-btn" style="display:inline-grid" target="_blank" rel="noopener" href="${Api.url('../api/' + (r.type === 'income' ? 'income' : 'expenses') + '/receipt/' + r.id)}" aria-label="View receipt" title="Receipt">${U.icon('receipt')}</a> ` : ''}${editable ? html`<button class="icon-btn" data-edit="${r.id}" aria-label="Edit ${r.title}" title="Edit">${U.icon('edit')}</button> ` : ''}${r.status === 'posted' ? html`<button class="icon-btn" data-rev="${r.id}" aria-label="Reverse ${r.title}" title="Reverse">${U.icon('undo')}</button>` : U.badge('reversed')}`; } });
          U.mount(list, U.table(cols, d.items, { emptyTitle: 'No records found', emptyText: st.q || st.category_id || st.account_id ? 'Try changing your search or filters.' : 'Add your first ' + (singular || 'transaction') + ' to see it here.', emptyAction: singular ? html`<button class="btn btn-primary" data-quick="${singular}">Add ${singular}</button>` : '' }));
          U.mount($('#pager'), U.pager(d.page, d.pages));
        } catch (e) {
          if (e.offline) { U.mount(list, html`<div class="card empty"><h3>You are offline</h3><p>You can still record ${singular || 'expenses'}; they sync when you are back online.</p></div>`); }
          else U.mount(list, html`<div class="card empty"><h3>Could not load records</h3><p>${e.message}</p></div>`);
        }
      }
      skeleton(); await load();
      if (!window.__txnSynced) { window.__txnSynced = true; document.addEventListener('et:synced', function () { if ($('#list')) { pendingBox(); load(); } }); }
      if (singular && App.query().get('new') === '1') { history.replaceState(null, '', location.pathname); App.forms.txn(singular); }
    };
  }

  App.page('income', { title: 'Income', feature: 'income', render: make('income') });
  App.page('expenses', { title: 'Expenses', feature: 'expenses', render: make('expenses') });
  App.page('transactions', { title: 'Transactions', feature: 'transactions', render: make('transactions') });
})();
