/* Notification centre. */
(function () {
  'use strict';
  var U = window.UI, html = U.html, $ = U.$;
  var ICON = { budget: 'target', debt: 'handshake', savings: 'piggy', subscription: 'card', payment: 'card', security: 'shield', welcome: 'star', recurring: 'repeat' };
  async function render(view, App) {
    var st = { page: 1, unread: false, history: false };
    U.mount(view, html`${App.pageHead('Notifications', 'Alerts about budgets, debts, savings and your subscription.', html`<button class="btn btn-ghost" id="readAll">${U.icon('check')} Mark all read</button>`)}
      <div class="row mb">${U.tabs([{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread' }, { value: 'history', label: 'Including dismissed' }], 'all', 'f')}</div><div class="card" id="nl"></div><div id="pg"></div>`);
    async function load() {
      var j = (await Api.get('../api/notifications' + Api.qs({ page: st.page, per_page: 15, unread: st.unread ? 1 : '', history: st.history ? 1 : '' }))).data;
      App.setUnread(j.unread);
      U.mount($('#nl'), j.items.length ? j.items.map(function (n) {
        var kind = String(n.type).split('_')[0];
        return html`<div class="txn" style="${n.is_read == 1 ? 'opacity:.75' : ''}"><div class="ti">${U.icon(ICON[kind] || 'bell')}</div><div class="meta" style="white-space:normal"><b style="white-space:normal">${n.title} ${n.is_read == 1 ? '' : html`<span class="badge-dot"></span>`}</b><span class="small muted">${n.body}</span><span class="small muted"> · ${U.ago(n.created_at)}</span></div>${n.link ? html`<a class="btn btn-ghost btn-sm" href="${n.link.replace(/^\//, '')}" data-read="${n.id}">Open</a>` : ''}${n.is_read == 1 ? '' : html`<button class="btn btn-ghost btn-sm" data-mark="${n.id}">Mark read</button>`}${n.dismissed ? U.badge('', 'Dismissed') : html`<button class="icon-btn" data-dismiss="${n.id}" aria-label="Dismiss">${U.icon('x')}</button>`}</div>`; })
        : U.empty('You are all caught up', 'New alerts will show up here.'));
      U.mount($('#pg'), U.pager(j.page, j.pages));
    }
    U.on(view, 'click', '[data-f]', function (e, b) { var v = b.dataset.f; st.unread = v === 'unread'; st.history = v === 'history'; st.page = 1; U.$$('[data-f]', view).forEach(function (x) { x.setAttribute('aria-selected', x === b); x.classList.toggle('active', x === b); }); load(); });
    U.on(view, 'click', '[data-page]', function (e, b) { if (!b.disabled) { st.page = +b.dataset.page; load(); } });
    U.on(view, 'click', '[data-mark]', async function (e, b) { await Api.post('../api/notifications/' + b.dataset.mark + '/read'); load(); });
    U.on(view, 'click', '[data-dismiss]', async function (e, b) { await Api.post('../api/notifications/' + b.dataset.dismiss + '/dismiss'); load(); });
    U.on(view, 'click', '[data-read]', function (e, a) { Api.post('../api/notifications/' + a.dataset.read + '/read').catch(function () {}); });
    $('#readAll').onclick = async function () { await Api.post('../api/notifications/read-all'); load(); };
    await load();
  }
  App.page('notifications', { title: 'Notifications', feature: 'notifications', render: render });
})();
