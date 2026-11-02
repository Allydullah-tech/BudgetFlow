/* Dashboard: summary cards (real data), quick actions, charts, insights. */
(function () {
  'use strict';
  var U = window.UI, html = U.html, $ = U.$;
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function lab(k) { var p = String(k).split('-'); if (p.length === 3) return parseInt(p[2], 10) + ' ' + MON[parseInt(p[1], 10) - 1]; if (p.length === 2) return MON[parseInt(p[1], 10) - 1] + " '" + p[0].slice(2); return k; }
  function card(cls, icon, label, val, sub) { return html`<div class="card stat ${cls}"><div class="label"><span class="ico">${U.icon(icon)}</span>${label}</div><div class="value num" data-count="${val}">${U.money(val)}</div>${sub ? html`<div class="small muted">${sub}</div>` : ''}</div>`; }

  async function render(view, App) {
    var j = await Api.get('../api/dashboard/summary'), d = j.data, name = App.me.user.name.split(' ')[0];
    var hr = new Date().getHours(), greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    var canTxn = function (f) { return App.has(f); };
    var quick = [['expense', 'Add expense', 'arrow-up', 'expenses'], ['income', 'Add income', 'arrow-down', 'income'], ['transfer', 'Transfer', 'swap', 'accounts']].filter(function (q) { return canTxn(q[3]); });
    var links = [['debts.html', 'Debts', 'handshake', 'debts'], ['budgets.html', 'Budgets', 'target', 'budgets'], ['savings.html', 'Savings', 'piggy', 'savings'], ['reports.html', 'Reports', 'chart', 'reports']].filter(function (q) { return canTxn(q[3]); });
    var empty = d.recent.length === 0 && Number(d.total_income) === 0 && Number(d.total_expenses) === 0;
    U.mount(view, html`
      <div class="hello"><div><h2>${greet}, ${name}!</h2><p>${d.range.label}: here is where your money stands today.</p></div><div class="row">${quick.length ? html`<button class="btn btn-gold" data-quick="${quick[0][0]}">${U.icon('plus')} ${quick[0][1]}</button>` : ''}</div><img class="deco" src="assets/images/logo.png" alt=""></div>
      <div id="installSlot"></div>
      <div class="quick stagger">${quick.map(function (q) { return html`<button data-quick="${q[0]}">${U.icon(q[2])}${q[1]}</button>`; })}${links.map(function (q) { return html`<a href="${q[0]}">${U.icon(q[2])}${q[1]}</a>`; })}</div>
      <div class="grid cols-4 stagger">
        ${card('', 'wallet', 'Current balance', d.current_balance, 'Across all accounts')}
        ${card('income', 'arrow-down', 'Income this month', d.total_income)}
        ${card('expense', 'arrow-up', 'Expenses this month', d.total_expenses)}
        ${card('', 'trend-up', 'Net cash flow', d.net_cash_flow, 'Income − expenses')}
        ${card('expense', 'handshake', 'Debts I owe', d.outstanding_debts, 'Outstanding principal')}
        ${card('income', 'handshake', 'Owed to me', d.debts_owed_to_me, 'Outstanding principal')}
        ${card('', 'piggy', 'Savings balance', d.savings_balance, 'All active goals')}
        ${d.remaining_budget === null ? html`<div class="card stat"><div class="label"><span class="ico">${U.icon('target')}</span>Remaining budget</div><div class="value">Not set</div><a class="small" href="budgets.html">Create a monthly budget</a></div>` : card('', 'target', 'Remaining budget', d.remaining_budget, 'This month')}
      </div>
      ${empty ? html`<div class="card mt center" style="padding:30px">${U.savedCheck()}<h3>Let's record your first transaction</h3><p class="muted">Everything on this page fills in automatically as you add income and expenses.</p>${quick.length ? html`<button class="btn btn-primary" data-quick="${quick[0][0]}">${quick[0][1]}</button>` : ''}</div>` : ''}
      <div class="dash-grid">
        <div class="card"><div class="row spread"><h3 style="margin:0">Income vs expenses</h3><div id="periodTabs"></div></div><div id="flowChart" class="mt">${U.skeleton(1)}</div></div>
        <div class="card"><h3>Recent transactions</h3><div id="recent">${d.recent.length ? d.recent.map(function (t) { return App.forms.txnRow(Object.assign({ category_name: t.category_name }, t)); }) : U.empty('No transactions yet', 'Your latest activity will appear here.')}</div><div class="center mt"><a href="transactions.html">View all</a></div></div>
        <div class="card"><h3>Smart insights</h3><div id="insights">${U.skeleton(1)}</div></div>
        <div class="card"><h3>Upcoming debt deadlines</h3>${d.upcoming_debts.length ? html`<ul class="mini-list">${d.upcoming_debts.map(function (x) { return html`<li><span>${x.party_name}<br><span class="small muted">${x.direction === 'borrowed' ? 'I owe' : 'Owes me'} · due ${U.date(x.due_date)}</span></span><b class="num">${U.money(x.remaining)}</b></li>`; })}</ul>` : U.empty('No deadlines', 'You have no upcoming debt due dates.')}</div>
        <div class="card"><h3>Spending</h3><div id="spendTabs" style="margin-bottom:10px"></div><div id="spendChart">${U.skeleton(1)}</div></div>
        <div class="card"><h3>Where your money goes</h3><div id="catChart">${U.skeleton(1)}</div></div>
        <div class="card"><h3>Income sources</h3><div id="srcChart">${U.skeleton(1)}</div></div>
        <div class="card"><h3>Budgets, debts &amp; savings</h3><div id="progressBox">${U.skeleton(1)}</div></div>
      </div>`);
    Motion.scan(view);
    installCard(view);
    insights(App);
    if (d.analytics_available) charts(App, 'month', 'day'); else lockCharts(App);
  }

  function installCard(view) {
    function show() {
      var slot = $('#installSlot'); if (!slot || PWA.isStandalone()) return; try { if (localStorage.getItem('et_install_dismiss') === '1') return; } catch (e) {}
      if (PWA.canInstall()) U.mount(slot, html`<div class="install-card"><img src="assets/images/icons/icon-192.png" width="44" height="44" alt="" style="border-radius:12px"><div class="grow"><b>Install BudgetFlow</b><div class="small" style="opacity:.85">Add it to your home screen for quick, full-screen access, even offline.</div></div><button class="btn btn-gold btn-sm" id="doInstall">Install</button><button class="btn btn-ghost btn-sm" id="noInstall" style="color:#fff;border-color:rgba(255,255,255,.4)">Not now</button></div>`);
      else if (PWA.isIOS) U.mount(slot, html`<div class="install-card"><div class="grow"><b>Install on iPhone or iPad</b><div class="small" style="opacity:.85">Tap the Share button, then “Add to Home Screen”.</div></div><button class="btn btn-ghost btn-sm" id="noInstall" style="color:#fff;border-color:rgba(255,255,255,.4)">Got it</button></div>`);
      var b = $('#doInstall'); if (b) b.onclick = async function () { if (await PWA.install()) $('#installSlot').innerHTML = ''; };
      var n = $('#noInstall'); if (n) n.onclick = function () { try { localStorage.setItem('et_install_dismiss', '1'); } catch (e) {} $('#installSlot').innerHTML = ''; };
    }
    show(); document.addEventListener('et:installable', show, { once: true });
  }

  async function insights(App) {
    var host = $('#insights'); if (!host) return;
    if (!App.has('insights')) { U.mount(host, html`<p class="muted">${U.icon('lock')} Smart insights are part of the full plan. <a href="subscription.html">Renew</a> to unlock.</p>`); return; }
    try { var j = await Api.get('../api/dashboard/insights'); U.mount(host, j.data.sentences.length ? j.data.sentences.map(function (s) { return html`<div class="insight">${U.icon('bulb')}<div>${s}</div></div>`; }) : html`<p class="muted">Insights appear once you have some activity.</p>`); }
    catch (e) { U.mount(host, html`<p class="muted">${e.message}</p>`); }
  }

  function lockCharts() {
    ['flowChart', 'spendChart', 'catChart', 'srcChart', 'progressBox'].forEach(function (id) { var h = $('#' + id); if (h) U.mount(h, html`<div class="center" style="padding:18px"><div style="color:var(--warning)">${U.icon('lock')}</div><p class="muted small">Charts and analytics are available with an active subscription.</p><a class="btn btn-gold btn-sm" href="subscription.html">Renew</a></div>`); });
    var t = $('#spendTabs'); if (t) t.remove();
  }

  async function charts(App, period, spend) {
    var j = await Api.get('../api/dashboard/charts' + Api.qs({ period: period, spend: spend })), d = j.data;
    $('#periodTabs').innerHTML = U.tabs([{ value: 'week', label: '7 days' }, { value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }, { value: 'years', label: '5 years' }], period, 'period');
    $('#spendTabs').innerHTML = U.tabs([{ value: 'day', label: 'Daily' }, { value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }, { value: 'year', label: 'Yearly' }], spend, 'spend');
    var flow = d.flow;
    Charts.line($('#flowChart'), { title: 'Income versus expenses', labels: flow.map(function (r) { return lab(r.key); }), series: [{ name: 'Income', values: flow.map(function (r) { return r.income; }), color: 'var(--income)' }, { name: 'Expenses', values: flow.map(function (r) { return r.expenses; }), color: 'var(--expense)' }] });
    var sp = d.spending.series;
    Charts.bars($('#spendChart'), { title: 'Spending', labels: sp.map(function (r) { return lab(r.key); }), series: [{ name: 'Expenses', values: sp.map(function (r) { return r.expenses; }), color: 'var(--expense)' }] });
    Charts.donut($('#catChart'), { title: 'Expense categories', items: d.expense_categories.map(function (c) { return { label: c.name, value: c.total }; }), centerLabel: 'Spent' });
    Charts.donut($('#srcChart'), { title: 'Income sources', items: d.income_sources.map(function (c) { return { label: c.name, value: c.total }; }), centerLabel: 'Earned' });
    var rows = [];
    d.budgets.forEach(function (b) { rows.push(html`<div class="mt"><div class="row spread small"><b>${b.name}</b><span class="num">${U.money(b.spent)} / ${U.money(b.budget)}</span></div>${U.progress(b.percent || 0)}</div>`); });
    d.savings.forEach(function (g) { rows.push(html`<div class="mt"><div class="row spread small"><b>${U.icon('piggy')} ${g.name}</b><span class="num">${Math.round(g.percent || 0)}%</span></div>${U.progress(g.percent || 0, 'var(--green-500)')}</div>`); });
    d.debts.filter(function (x) { return x.status !== 'paid'; }).slice(0, 4).forEach(function (x) { rows.push(html`<div class="mt"><div class="row spread small"><b>${U.icon('handshake')} ${x.party} <span class="muted">(${x.direction === 'borrowed' ? 'I owe' : 'owes me'})</span></b><span class="num">${Math.round(x.percent || 0)}% paid</span></div>${U.progress(x.percent || 0, 'var(--info)')}</div>`); });
    U.mount($('#progressBox'), rows.length ? rows : U.empty('Nothing to track yet', 'Budgets, savings goals and debts will show progress here.'));
    Motion.scan($('#progressBox'));
    var v = $('#view');
    if (!v.dataset.bound) {
      v.dataset.bound = 1;
      U.on(v, 'click', '[data-period]', function (e, b) { charts(App, b.dataset.period, $('#spendTabs [aria-selected=true]') ? $('#spendTabs [aria-selected=true]').dataset.spend : 'day'); });
      U.on(v, 'click', '[data-spend]', function (e, b) { charts(App, $('#periodTabs [aria-selected=true]').dataset.period, b.dataset.spend); });
    }
  }

  App.page('dashboard', { title: 'Dashboard', feature: 'dashboard_basic', render: render });
})();
