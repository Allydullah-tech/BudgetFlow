/* Reports: 16 types, filtered by period, shown on screen, exportable to CSV and PDF, printable. */
(function () {
  'use strict';
  var U = window.UI, html = U.html, $ = U.$;
  var PRESETS = [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This week'], ['last_week', 'Last week'], ['month', 'This month'], ['last_month', 'Last month'], ['year', 'This year'], ['last_year', 'Last year'], ['custom', 'Custom dates']];
  function fmt(v, kind) {
    if (v === null || v === undefined || v === '') return '—';
    if (kind === 'money') return U.money(v); if (kind === 'percent') return Number(v).toFixed(1).replace(/\.0$/, '') + '%'; if (kind === 'number') return Number(v).toLocaleString('en-US');
    return v;
  }
  function chart(host, c) {
    var labels = c.labels.map(function (l) { return String(l).length > 10 && /^\d{4}-\d{2}-\d{2}$/.test(l) ? U.date(l).replace(/ \d{4}$/, '') : l; });
    if (c.type === 'donut') Charts.donut(host, { title: c.title, items: c.labels.map(function (l, i) { return { label: l, value: c.datasets[0].values[i] }; }), centerLabel: 'Total' });
    else if (c.type === 'line') Charts.line(host, { title: c.title, labels: labels, series: c.datasets.map(function (d) { return { name: d.name, values: d.values }; }) });
    else Charts.bars(host, { title: c.title, labels: labels, series: c.datasets.map(function (d, i) { return { name: d.name, values: d.values, color: d.name === 'Expenses' || d.name === 'Spent' ? 'var(--expense)' : d.name === 'Income' ? 'var(--income)' : undefined }; }) });
  }
  async function render(view, App) {
    var types = (await Api.get('../api/reports/types')).data.types;
    var st = { type: App.query().get('type') || 'income_vs_expense', range: 'month', from: '', to: '' };
    U.mount(view, html`${App.pageHead('Reports', 'Pick a report and a period. Only income and expenses count towards totals; transfers, debt principal and savings moves do not.', html`<button class="btn btn-ghost" id="csv">${U.icon('download')} CSV</button><button class="btn btn-ghost" id="pdf">${U.icon('file')} PDF</button><button class="btn btn-ghost" id="print">Print</button>`)}
      <div class="toolbar"><select class="input" id="type" aria-label="Report type" style="min-width:230px">${Object.keys(types).map(function (k) { return html`<option value="${k}" ${k === st.type ? U.raw('selected') : ''}>${types[k]}</option>`; })}</select>
        <select class="input" id="range" aria-label="Period">${PRESETS.map(function (p) { return html`<option value="${p[0]}" ${p[0] === st.range ? U.raw('selected') : ''}>${p[1]}</option>`; })}</select>
        <span class="row hide" id="custom"><input class="input" type="date" id="from" aria-label="From"><input class="input" type="date" id="to" aria-label="To"></span><button class="btn btn-primary" id="run">Show report</button></div>
      <div id="out">${U.skeleton(3)}</div>`);
    function params() { return { type: st.type, range: st.range, from: st.from, to: st.to }; }
    async function run() {
      var out = $('#out'); U.mount(out, U.skeleton(3));
      try {
        var r = (await Api.get('../api/reports/run' + Api.qs(params()))).data;
        U.mount(out, html`<div class="card mb"><div class="row spread"><div><h2 style="margin:0">${r.title}</h2><div class="muted small">${r.range.label} · ${U.date(r.range.from)} – ${U.date(r.range.to)}</div></div></div></div>
          ${r.summary.length ? html`<div class="grid cols-4 mb stagger">${r.summary.map(function (s) { return html`<div class="card stat"><div class="label">${s.label}</div><div class="value">${fmt(s.value, s.kind)}</div></div>`; })}</div>` : ''}
          ${r.charts.length ? html`<div class="grid cols-2 mb">${r.charts.map(function (c, i) { return html`<div class="card"><h3>${c.title}</h3><div data-chart="${i}"></div></div>`; })}</div>` : ''}
          ${r.tables.map(function (t) { return html`<div class="card mb"><h3>${t.title}</h3>${U.table(t.columns.map(function (c) { return { label: c.label, align: c.kind === 'money' || c.kind === 'number' || c.kind === 'percent' ? 'right' : '', render: function (row) { return fmt(row[c.key], c.kind); } }; }), t.rows, { emptyTitle: 'No data for this period', emptyText: 'Try a different period.' })}</div>`; })}
          ${r.notes && r.notes.length ? html`<div class="card small muted">${r.notes.map(function (n) { return html`<p style="margin:0 0 6px">${U.icon('info')} ${n}</p>`; })}</div>` : ''}`);
        r.charts.forEach(function (c, i) { chart($('[data-chart="' + i + '"]', out), c); });
        Motion.scan(out);
      } catch (e) { U.mount(out, e.status === 402 ? App.gate(e.message) : html`<div class="card empty"><h3>Could not build the report</h3><p>${e.message}</p></div>`); }
    }
    $('#type').onchange = function (e) { st.type = e.target.value; run(); };
    $('#range').onchange = function (e) { st.range = e.target.value; $('#custom').classList.toggle('hide', st.range !== 'custom'); if (st.range !== 'custom') run(); };
    $('#from').onchange = function (e) { st.from = e.target.value; }; $('#to').onchange = function (e) { st.to = e.target.value; };
    $('#run').onclick = run;
    $('#csv').onclick = function () { if (!App.has('export')) return U.toast('CSV export needs an active subscription.', 'warn'); window.location = Api.url('../api/reports/csv') + Api.qs(params()); };
    $('#pdf').onclick = function () { if (!App.has('pdf')) return U.toast('PDF export needs an active subscription.', 'warn'); window.location = Api.url('../api/reports/pdf') + Api.qs(params()); };
    $('#print').onclick = function () { window.print(); };
    await run();
  }
  App.page('reports', { title: 'Reports', feature: 'reports', render: render });
})();
