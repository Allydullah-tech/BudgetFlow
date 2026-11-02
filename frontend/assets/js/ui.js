/* UI toolkit: safe templating, icons, formatting, toasts, modals, forms, tables. No dependencies. */
(function () {
  'use strict';
  function Safe(s) { this.s = s; } Safe.prototype.toString = function () { return this.s; };
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function raw(s) { return new Safe(String(s)); }
  function part(v) { if (v instanceof Safe) return v.s; if (Array.isArray(v)) return v.map(part).join(''); if (v === false || v == null) return ''; return esc(v); }
  function html(strings) { var out = strings[0]; for (var i = 1; i < arguments.length; i++) out += part(arguments[i]) + strings[i]; return new Safe(out); }

  /* Icons (feather-style, 24x24 stroke) */
  var I = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    'arrow-down': '<path d="M12 5v14M6 13l6 6 6-6"/>', 'arrow-up': '<path d="M12 19V5M6 11l6-6 6 6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    handshake: '<path d="M11 17l2 2a1.5 1.5 0 0 0 2-2"/><path d="M14 14l2.5 2.5a1.5 1.5 0 0 0 2-2L14 10l-3 3"/><path d="M3 12l5-5 4 1 3-2 6 6-3 3"/><path d="M3 12l5 5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14.5" r="1"/>',
    piggy: '<path d="M19 11a7 7 0 0 0-13 0c-2 0-3 1-3 3s1 3 3 3v2h3v-2h4v2h3v-2.5c1.5-1 2-2.5 2-3.5"/><path d="M15 8l2-3"/><circle cx="14.5" cy="11" r=".5"/>',
    tag: '<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1"/>',
    repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>', bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.6l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>', logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>', x: '<path d="M18 6L6 18M6 6l12 12"/>', check: '<path d="M20 6L9 17l-5-5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', moon: '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>', monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>', download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>', upload: '<path d="M12 15V3M7 8l5-5 5 5M4 21h16"/>', eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>', 'eye-off': '<path d="M17.9 17.9A10.9 10.9 0 0 1 12 20C5 20 1 12 1 12a18 18 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.2 3.2M1 1l22 22"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>', lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/>', phone: '<path d="M22 17v3a2 2 0 0 1-2.2 2A19 19 0 0 1 2 4.2 2 2 0 0 1 4 2h3l2 5-2.5 1.5a14 14 0 0 0 7 7L15 13l5 2z"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>', alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>', swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>', file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>', 'trend-up': '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>', 'trend-down': '<path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>', db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>', megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h3l8 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M19 8a5 5 0 0 1 0 8"/>', qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h3M20 17v4"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>', filter: '<path d="M3 4h18l-7 9v6l-4 2v-8z"/>', chevron: '<path d="M9 6l6 6-6 6"/>', star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.2 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>', wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01"/>', 'wifi-off': '<path d="M1 1l22 22M16.7 11.1A10 10 0 0 1 19 12.5M5 12.5a10 10 0 0 1 5.2-2.7M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 4.4-2.8M10.7 4.1A15 15 0 0 1 22 9M12 20h.01"/>', refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.3L3 16M3 12a9 9 0 0 1 15.5-6.3L21 8M3 21v-5h5M21 3v5h-5"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'
  };
  function icon(n, cls) { return raw('<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (I[n] || I.info) + '</svg>'); }

  /* Formatting */
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function money(v, opts) { var n = num(v); var s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return (n < 0 ? '-' : '') + 'TZS ' + s; }
  function moneyShort(v) { var n = Math.abs(num(v)); if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'K'; return String(Math.round(n)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return ymd(new Date()); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function date(s) { if (!s) return '—'; var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s)); if (!m) return esc(s); return parseInt(m[3], 10) + ' ' + MON[parseInt(m[2], 10) - 1] + ' ' + m[1]; }
  function datetime(s) { if (!s) return '—'; var d = new Date(String(s).replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z')); if (isNaN(d)) return String(s); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function ago(s) { if (!s) return ''; var d = new Date(String(s).replace(' ', 'T') + 'Z'), sec = Math.round((Date.now() - d) / 1000); if (isNaN(sec)) return ''; if (sec < 60) return 'just now'; if (sec < 3600) return Math.floor(sec / 60) + ' min ago'; if (sec < 86400) return Math.floor(sec / 3600) + ' h ago'; if (sec < 604800) return Math.floor(sec / 86400) + ' d ago'; return date(String(s).slice(0, 10)); }
  function label(s) { s = String(s || '').replace(/_/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); }
  function badge(status, text) { return html`<span class="badge ${String(status || '').replace(/[^a-z_]/g, '')}">${text || label(status)}</span>`; }

  /* DOM helpers */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function on(root, ev, sel, fn) { root.addEventListener(ev, function (e) { var t = e.target.closest ? e.target.closest(sel) : null; if (t && root.contains(t)) fn.call(t, e, t); }); }
  function mount(el, h) { el.innerHTML = part(h); return el; }
  function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms || 300); }; }

  /* Toasts */
  function toast(msg, type) {
    var root = $('.toasts') || (function () { var d = document.createElement('div'); d.className = 'toasts'; d.setAttribute('role', 'status'); d.setAttribute('aria-live', 'polite'); document.body.appendChild(d); return d; })();
    var t = document.createElement('div'); t.className = 'toast ' + (type || 'success');
    t.innerHTML = icon(type === 'error' ? 'alert' : type === 'warn' ? 'info' : 'check') + '<div>' + esc(msg) + '</div>';
    root.appendChild(t);
    setTimeout(function () { t.classList.add('leaving'); setTimeout(function () { t.remove(); }, 260); }, type === 'error' ? 6000 : 3600);
  }

  /* Modal with focus trap + Esc */
  function modal(o) {
    var root = document.createElement('div'); root.className = 'modal-root';
    var prev = document.activeElement;
    root.innerHTML = '<div class="modal ' + (o.size || '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title || '') + '"><div class="modal-head"><h3>' + esc(o.title || '') + '</h3><button type="button" class="icon-btn" data-close aria-label="Close">' + icon('x') + '</button></div><div class="modal-body">' + part(o.body) + '</div>' + (o.foot ? '<div class="modal-foot">' + part(o.foot) + '</div>' : '') + '</div>';
    document.body.appendChild(root); document.body.style.overflow = 'hidden';
    var closed = false;
    function close(v) { if (closed) return; closed = true; document.removeEventListener('keydown', key, true); root.classList.add('closing'); document.body.style.overflow = ''; setTimeout(function () { root.remove(); if (prev && prev.focus) try { prev.focus(); } catch (e) {} }, 190); if (o.onClose) o.onClose(v); }
    function key(e) {
      if (e.key === 'Escape' && !o.persistent) { e.stopPropagation(); close(); }
      if (e.key === 'Tab') { var f = $$('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])', root).filter(function (x) { return !x.disabled && x.offsetParent !== null; }); if (!f.length) return; var a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    }
    document.addEventListener('keydown', key, true);
    root.addEventListener('mousedown', function (e) { if (e.target === root && !o.persistent) close(); });
    root.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close(); });
    var first = $('input:not([type=hidden]),select,textarea', root) || $('button', root); if (first) setTimeout(function () { try { first.focus(); } catch (e) {} }, 60);
    return { el: root, body: $('.modal-body', root), close: close };
  }
  function confirmBox(o) {
    return new Promise(function (res) {
      var m = modal({ title: o.title || 'Are you sure?', size: 'sm', body: html`<p>${o.message || ''}</p>`, onClose: function (v) { res(v === true); },
        foot: html`<button class="btn btn-ghost" data-close>${o.cancelText || 'Cancel'}</button><button class="btn ${o.danger ? 'btn-primary' : 'btn-primary'}" data-ok ${o.danger ? raw('style="background:var(--danger)"') : ''}>${o.confirmText || 'Confirm'}</button>` });
      $('[data-ok]', m.el).addEventListener('click', function () { m.close(true); });
    });
  }
  function savedCheck() { return raw('<svg class="saved-check" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26"/><path d="M20 33l8 8 16-17"/></svg>'); }

  /* Forms */
  function fieldHtml(f) {
    var id = 'f_' + f.name, v = f.value == null ? '' : f.value, req = f.required ? ' <span class="req" aria-hidden="true">*</span>' : '', a = f.attrs || '';
    if (f.type === 'hidden') return html`<input type="hidden" name="${f.name}" value="${v}">`;
    if (f.type === 'checkbox') return html`<div class="field ${f.full ? 'full' : ''}"><label class="check"><input type="checkbox" name="${f.name}" id="${id}" ${v ? raw('checked') : ''}> <span>${f.label}</span></label></div>`;
    var input;
    if (f.type === 'select') input = html`<select name="${f.name}" id="${id}" ${f.required ? raw('required') : ''}>${(f.options || []).map(function (o) { return html`<option value="${o.value}" ${String(o.value) === String(v) ? raw('selected') : ''}>${o.label}</option>`; })}</select>`;
    else if (f.type === 'textarea') input = html`<textarea name="${f.name}" id="${id}" rows="${f.rows || 3}" maxlength="${f.max || 1000}" placeholder="${f.placeholder || ''}">${v}</textarea>`;
    else if (f.type === 'amount') input = html`<input type="text" inputmode="decimal" autocomplete="off" name="${f.name}" id="${id}" value="${v}" placeholder="${f.placeholder || '0'}" ${f.required ? raw('required') : ''} data-amount>`;
    else if (f.type === 'password') input = html`<div class="pw-wrap"><input type="password" name="${f.name}" id="${id}" value="${v}" autocomplete="${f.autocomplete || 'current-password'}" ${f.required ? raw('required') : ''}><button type="button" class="pw-toggle" data-pw aria-label="Show password">${icon('eye')}</button></div>`;
    else input = html`<input type="${f.type || 'text'}" name="${f.name}" id="${id}" value="${v}" placeholder="${f.placeholder || ''}" autocomplete="${f.autocomplete || 'off'}" ${f.required ? raw('required') : ''} ${f.min != null ? raw('min="' + esc(f.min) + '"') : ''} ${f.max != null && f.type !== 'textarea' ? raw('max="' + esc(f.max) + '"') : ''} ${f.step ? raw('step="' + esc(f.step) + '"') : ''} ${raw(a)}>`;
    return html`<div class="field ${f.type === 'amount' ? 'amount' : ''} ${f.full ? 'full' : ''}" data-field="${f.name}"><label for="${id}">${f.label}${raw(req)}</label>${input}${f.hint ? html`<div class="hint">${f.hint}</div>` : ''}<div class="err" role="alert"></div></div>`;
  }
  function fields(list) { return html`<div class="form-grid">${list.filter(Boolean).map(fieldHtml)}</div>`; }
  function read(form) {
    var o = {};
    $$('input,select,textarea', form).forEach(function (el) {
      if (!el.name || el.type === 'file' || el.disabled) return;
      if (el.type === 'checkbox') o[el.name] = el.checked; else if (el.hasAttribute('data-amount')) o[el.name] = el.value.replace(/[,\s]/g, ''); else o[el.name] = el.value;
    });
    return o;
  }
  function showErrors(form, errors) {
    $$('.field.invalid', form).forEach(function (f) { f.classList.remove('invalid'); $('.err', f).textContent = ''; });
    var firstEl = null;
    Object.keys(errors || {}).forEach(function (k) { var f = $('[data-field="' + k + '"]', form); if (f) { f.classList.add('invalid'); var e = $('.err', f); if (e) e.textContent = Array.isArray(errors[k]) ? errors[k][0] : errors[k]; firstEl = firstEl || f; } });
    if (firstEl) { var i = $('input,select,textarea', firstEl); if (i) i.focus(); }
    return !!firstEl;
  }
  function busy(btn, on, text) { if (!btn) return; if (on) { btn.dataset.t = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;margin:0 8px 0 0;display:inline-block;vertical-align:middle"></span>' + esc(text || 'Please wait…'); } else { btn.disabled = false; if (btn.dataset.t) btn.innerHTML = btn.dataset.t; } }
  /* Wire submit with busy state + inline error display. handler(data) may throw ApiError. */
  function bindForm(form, handler, o) {
    o = o || {};
    form.setAttribute('novalidate', '');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = $('[type=submit]', form); if (form.dataset.sending) return;
      var errs = {}; $$('[required]', form).forEach(function (el) { if (el.type === 'checkbox' ? !el.checked : !String(el.value).trim()) errs[el.name] = 'This field is required.'; });
      if (showErrors(form, errs)) return;
      form.dataset.sending = '1'; busy(btn, true, o.busyText);
      try { await handler(read(form), form); }
      catch (err) { if (err.errors && Object.keys(err.errors).length) showErrors(form, err.errors); if (!o.quiet) toast(err.message || 'Could not save.', 'error'); }
      finally { delete form.dataset.sending; busy(btn, false); }
    });
    on(form, 'click', '[data-pw]', function (e, b) { var i = b.parentNode.querySelector('input'); var show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.innerHTML = icon(show ? 'eye-off' : 'eye'); b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); });
    on(form, 'input', '[data-amount]', function (e, el) { el.value = el.value.replace(/[^0-9.,]/g, ''); });
    on(form, 'blur', '[data-amount]', function (e, el) { var n = parseFloat(el.value.replace(/,/g, '')); if (isFinite(n)) el.value = n.toLocaleString('en-US', { maximumFractionDigits: 2 }); }, true);
    form.addEventListener('blur', function (e) { var el = e.target; if (el.matches && el.matches('[data-amount]')) { var n = parseFloat(el.value.replace(/,/g, '')); if (isFinite(n)) el.value = n.toLocaleString('en-US', { maximumFractionDigits: 2 }); } }, true);
    form.addEventListener('focus', function (e) { var el = e.target; if (el.matches && el.matches('[data-amount]')) el.value = el.value.replace(/,/g, ''); }, true);
  }

  /* Tables: columns [{key,label,render(row)->html,cls,align}] ; stacks as cards on phones */
  function table(cols, rows, o) {
    o = o || {};
    if (!rows.length) return emptyState(o.emptyTitle || 'Nothing here yet', o.emptyText || '', o.emptyAction);
    return html`<div class="table-wrap stack-mobile"><table class="table"><thead><tr>${cols.map(function (c) { return html`<th class="${c.align === 'right' ? 'right' : ''}">${c.label}</th>`; })}</tr></thead><tbody>${rows.map(function (r) { return html`<tr>${cols.map(function (c) { return html`<td data-label="${c.label}" class="${c.cls || ''} ${c.align === 'right' ? 'right num' : ''}">${c.render ? c.render(r) : (r[c.key] == null ? '' : r[c.key])}</td>`; })}</tr>`; })}</tbody></table></div>`;
  }
  function emptyState(title, text, action) { return html`<div class="empty"><img src="assets/images/logo-small.png" alt="" width="90" height="90"><h3>${title}</h3>${text ? html`<p>${text}</p>` : ''}${action || ''}</div>`; }
  function skeleton(n) { var a = []; for (var i = 0; i < (n || 3); i++) a.push('<div class="skeleton" style="height:' + (i ? 54 : 90) + 'px;margin-bottom:12px"></div>'); return raw(a.join('')); }
  function pager(page, pages, goAttr) { if (pages <= 1) return ''; var b = []; var s = Math.max(1, page - 2), e = Math.min(pages, s + 4); s = Math.max(1, e - 4); b.push(html`<button data-${goAttr || 'page'}="${page - 1}" ${page <= 1 ? raw('disabled') : ''} aria-label="Previous">‹</button>`); for (var i = s; i <= e; i++) b.push(html`<button data-${goAttr || 'page'}="${i}" ${i === page ? raw('aria-current="page" style="background:var(--green-700);color:#fff"') : ''}>${i}</button>`); b.push(html`<button data-${goAttr || 'page'}="${page + 1}" ${page >= pages ? raw('disabled') : ''} aria-label="Next">›</button>`); return html`<div class="pagination">${b}</div>`; }
  function tabs(items, active, attr) { return html`<div class="tabs" role="tablist">${items.map(function (t) { return html`<button type="button" role="tab" data-${attr || 'tab'}="${t.value}" aria-selected="${t.value === active}" ${t.value === active ? raw('class="active"') : ''}>${t.label}</button>`; })}</div>`; }
  function progress(pct, color) { pct = Math.max(0, Math.min(100, num(pct))); var c = color || (pct >= 100 ? 'var(--danger)' : pct >= 90 ? 'var(--warning)' : ''); return html`<div class="progress" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><i data-w="${pct}" style="${c ? 'background:' + c : ''}"></i></div>`; }
  function download(name, text, type) { var b = new Blob([text], { type: type || 'text/csv' }); var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

  window.UI = { Safe: Safe, esc: esc, raw: raw, html: html, icon: icon, num: num, money: money, moneyShort: moneyShort, date: date, datetime: datetime, ago: ago, today: today, ymd: ymd, label: label, badge: badge, $: $, $$: $$, on: on, mount: mount, debounce: debounce, toast: toast, modal: modal, confirm: confirmBox, savedCheck: savedCheck, fields: fields, field: fieldHtml, read: read, showErrors: showErrors, busy: busy, bindForm: bindForm, table: table, empty: emptyState, skeleton: skeleton, pager: pager, tabs: tabs, progress: progress, download: download };
})();
