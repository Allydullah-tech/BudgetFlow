/* Lightweight motion helpers. All honour prefers-reduced-motion. */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fmt(el, v) { el.textContent = el.dataset.fmt === 'int' ? Math.round(v).toLocaleString('en-US') : el.dataset.fmt === 'pct' ? Math.round(v) + '%' : 'TZS ' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/^/, v < 0 ? '-' : ''); }
  function count(el) {
    var to = parseFloat(el.dataset.count); if (!isFinite(to)) return;
    if (reduce || Math.abs(to) < 1) { fmt(el, to); return; }
    var t0 = performance.now(), dur = 900;
    (function tick(t) { var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); fmt(el, to * e); if (p < 1) requestAnimationFrame(tick); else fmt(el, to); })(t0);
  }
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); if (e.target.dataset.count !== undefined) count(e.target); io.unobserve(e.target); } }); }, { threshold: 0.12 }) : null;
  window.Motion = {
    reduce: reduce,
    scan: function (root) {
      root = root || document;
      root.querySelectorAll('[data-count]').forEach(function (el) { if (io && !el.dataset.seen) { el.dataset.seen = 1; io.observe(el); } else count(el); });
      root.querySelectorAll('.reveal').forEach(function (el, i) { if (!el.style.getPropertyValue('--i')) el.style.setProperty('--i', i % 6); if (io) io.observe(el); else el.classList.add('in'); });
      root.querySelectorAll('.stagger').forEach(function (p) { Array.prototype.forEach.call(p.children, function (c, i) { c.style.setProperty('--i', Math.min(i, 10)); }); });
      requestAnimationFrame(function () { root.querySelectorAll('.progress i[data-w]').forEach(function (b) { b.style.width = b.dataset.w + '%'; }); });
    },
    count: count
  };
})();
