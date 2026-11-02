/* Dependency-free SVG charts with tooltips, accessible summaries and entry animations. */
(function () {
  'use strict';
  var U = window.UI, W = 640, H = 260, M = { t: 14, r: 12, b: 28, l: 48 };
  var COLORS = [1, 2, 3, 4, 5, 6, 7, 8].map(function (i) { return 'var(--chart-' + i + ')'; });

  function niceMax(v) { if (v <= 0) return 1; var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
  function wrap(host, svg, legend, summary) {
    host.classList.add('chart');
    host.innerHTML = '<div role="img" aria-label="' + U.esc(summary || 'Chart') + '">' + svg + '</div>' + (legend || '') + '<div class="chart-tip"></div>';
    var tip = host.querySelector('.chart-tip');
    function show(e, t) { var r = host.getBoundingClientRect(); tip.innerHTML = t; tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px'; tip.classList.add('show'); }
    host.querySelectorAll('[data-tip]').forEach(function (n) {
      n.addEventListener('mousemove', function (e) { show(e, n.getAttribute('data-tip')); });
      n.addEventListener('mouseleave', function () { tip.classList.remove('show'); });
      n.addEventListener('touchstart', function (e) { var t = e.touches[0]; show(t, n.getAttribute('data-tip')); setTimeout(function () { tip.classList.remove('show'); }, 2200); }, { passive: true });
    });
    host.querySelectorAll('path.line').forEach(function (p) { try { p.style.setProperty('--len', Math.ceil(p.getTotalLength()) + 2); } catch (e) {} });
    return host;
  }
  function legendHtml(series) { if (series.length < 2) return ''; return '<div class="legend">' + series.map(function (s, i) { return '<span><i style="background:' + (s.color || COLORS[i % 8]) + '"></i>' + U.esc(s.name) + '</span>'; }).join('') + '</div>'; }
  function axes(labels, max, ticks) {
    var s = '', iw = W - M.l - M.r, ih = H - M.t - M.b;
    for (var i = 0; i <= ticks; i++) { var y = M.t + ih - (ih * i / ticks), v = max * i / ticks; s += '<line class="grid-line" x1="' + M.l + '" x2="' + (W - M.r) + '" y1="' + y + '" y2="' + y + '"/><g class="axis"><text x="' + (M.l - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + U.moneyShort(v) + '</text></g>'; }
    var step = Math.ceil(labels.length / 8);
    labels.forEach(function (l, i) { if (i % step) return; var x = labels.length === 1 ? M.l + iw / 2 : M.l + iw * i / (labels.length - 1); s += '<g class="axis"><text x="' + x + '" y="' + (H - 8) + '" text-anchor="middle">' + U.esc(l) + '</text></g>'; });
    return s;
  }
  /* line({labels, series:[{name, values, color}]}) */
  function line(host, d) {
    var series = d.series, labels = d.labels, n = labels.length, iw = W - M.l - M.r, ih = H - M.t - M.b;
    if (!n || !series.length) { host.classList.add('chart'); host.innerHTML = '<div class="empty" style="padding:18px">No data for this period.</div>'; return host; }
    var max = niceMax(Math.max.apply(null, [0].concat.apply([], series.map(function (s) { return s.values.map(Number); }))));
    function X(i) { return n === 1 ? M.l + iw / 2 : M.l + iw * i / (n - 1); } function Y(v) { return M.t + ih - ih * Number(v) / max; }
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' + axes(labels, max, 4);
    series.forEach(function (s, si) {
      var c = s.color || COLORS[si % 8], pts = s.values.map(function (v, i) { return [X(i), Y(v)]; });
      var path = pts.map(function (p, i) { if (!i) return 'M' + p[0] + ',' + p[1]; var q = pts[i - 1], cx = (q[0] + p[0]) / 2; return 'C' + cx + ',' + q[1] + ' ' + cx + ',' + p[1] + ' ' + p[0] + ',' + p[1]; }).join('');
      if (series.length <= 2) svg += '<path class="area" d="' + path + 'L' + pts[pts.length - 1][0] + ',' + (M.t + ih) + 'L' + pts[0][0] + ',' + (M.t + ih) + 'Z" fill="' + c + '" fill-opacity=".10"/>';
      svg += '<path class="line" d="' + path + '" stroke="' + c + '"/>';
      pts.forEach(function (p, i) { svg += '<circle class="dot" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (n > 40 ? 0 : 3.5) + '" fill="var(--surface)" stroke="' + c + '" stroke-width="2" data-tip="' + U.esc(labels[i] + ' · ' + s.name + ': ' + U.money(s.values[i])) + '"/>'; });
    });
    svg += '</svg>';
    return wrap(host, svg, legendHtml(series), (d.title || 'Line chart') + ': ' + series.map(function (s) { return s.name + ' total ' + U.money(s.values.reduce(function (a, b) { return a + Number(b); }, 0)); }).join('; '));
  }
  /* bars({labels, series}) grouped */
  function bars(host, d) {
    var series = d.series, labels = d.labels, n = labels.length, iw = W - M.l - M.r, ih = H - M.t - M.b, ns = series.length;
    if (!n || !series.length) { host.classList.add('chart'); host.innerHTML = '<div class="empty" style="padding:18px">No data for this period.</div>'; return host; }
    var max = niceMax(Math.max.apply(null, [0].concat.apply([], series.map(function (s) { return s.values.map(Number); }))));
    var group = iw / Math.max(n, 1), bw = Math.min(34, group * 0.7 / ns);
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '">' + axes([], max, 4);
    var step = Math.ceil(n / 8);
    labels.forEach(function (l, i) {
      var gx = M.l + group * i + group / 2;
      if (!(i % step)) svg += '<g class="axis"><text x="' + gx + '" y="' + (H - 8) + '" text-anchor="middle">' + U.esc(l) + '</text></g>';
      series.forEach(function (s, si) { var v = Number(s.values[i]), h = ih * v / max, x = gx - (bw * ns) / 2 + bw * si; svg += '<rect class="bar" x="' + x + '" y="' + (M.t + ih - h) + '" width="' + (bw - 2) + '" height="' + Math.max(h, 0) + '" rx="4" fill="' + (s.color || COLORS[si % 8]) + '" style="animation-delay:' + (i * 25) + 'ms" data-tip="' + U.esc(l + ' · ' + s.name + ': ' + U.money(v)) + '"/>'; });
    });
    svg += '</svg>';
    return wrap(host, svg, legendHtml(series), (d.title || 'Bar chart'));
  }
  /* donut({items:[{label,value,color}], center}) */
  function donut(host, d) {
    var items = d.items.filter(function (i) { return Number(i.value) > 0; }), total = items.reduce(function (a, i) { return a + Number(i.value); }, 0), R = 80, r = 52, cx = 100, cy = 100;
    if (!total) { host.classList.add('chart'); host.innerHTML = '<div class="empty" style="padding:18px">No data for this period.</div>'; return host; }
    var a0 = -Math.PI / 2, svg = '<svg viewBox="0 0 200 200" style="max-width:220px;margin:auto">';
    items.forEach(function (it, i) {
      var frac = Number(it.value) / total, a1 = a0 + frac * Math.PI * 2 - (items.length > 1 ? 0.012 : 0), big = a1 - a0 > Math.PI ? 1 : 0, c = it.color || COLORS[i % 8];
      if (frac > 0.9999) { svg += '<circle class="seg" cx="' + cx + '" cy="' + cy + '" r="' + ((R + r) / 2) + '" fill="none" stroke="' + c + '" stroke-width="' + (R - r) + '" data-tip="' + U.esc(it.label + ': ' + U.money(it.value) + ' (100%)') + '"/>'; }
      else svg += '<path class="seg" style="animation-delay:' + (i * 80) + 'ms" fill="' + c + '" d="M' + (cx + R * Math.cos(a0)) + ',' + (cy + R * Math.sin(a0)) + 'A' + R + ',' + R + ' 0 ' + big + ' 1 ' + (cx + R * Math.cos(a1)) + ',' + (cy + R * Math.sin(a1)) + 'L' + (cx + r * Math.cos(a1)) + ',' + (cy + r * Math.sin(a1)) + 'A' + r + ',' + r + ' 0 ' + big + ' 0 ' + (cx + r * Math.cos(a0)) + ',' + (cy + r * Math.sin(a0)) + 'Z" data-tip="' + U.esc(it.label + ': ' + U.money(it.value) + ' (' + Math.round(frac * 100) + '%)') + '"/>';
      a0 += frac * Math.PI * 2;
    });
    svg += '<text x="100" y="96" text-anchor="middle" style="fill:var(--muted);font-size:10px">' + U.esc(d.centerLabel || 'Total') + '</text><text x="100" y="114" text-anchor="middle" style="fill:var(--heading);font-size:13px;font-weight:700">' + U.moneyShort(total) + '</text></svg>';
    var leg = '<div class="legend" style="justify-content:center">' + items.slice(0, 8).map(function (it, i) { return '<span><i style="background:' + (it.color || COLORS[i % 8]) + '"></i>' + U.esc(it.label) + ' ' + Math.round(Number(it.value) / total * 100) + '%</span>'; }).join('') + '</div>';
    return wrap(host, svg, leg, (d.title || 'Breakdown') + ': ' + items.map(function (i) { return i.label + ' ' + U.money(i.value); }).join(', '));
  }
  window.Charts = { line: line, bars: bars, donut: donut, colors: COLORS };
})();
