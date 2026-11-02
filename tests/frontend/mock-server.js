/* Test harness ONLY: serves frontend/ and a tiny in-memory fake of the JSON API so UI behaviour can be exercised in a headless
 * browser without PHP/MySQL. It does NOT test backend logic (see tests/backend for that). Usage: node mock-server.js [port] */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', 'frontend');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
const today = new Date().toISOString().slice(0, 10);
const S = { logged: false, role: 'user', id: 1, expired: false, queueDupes: 0,
  accounts: [{ id: 1, name: 'Cash', type: 'cash', balance: '150000.00', opening_balance: '0.00', is_active: 1 }, { id: 2, name: 'M-Pesa', type: 'mobile_money', balance: '50000.00', opening_balance: '0.00', is_active: 1 }],
  categories: [{ id: 1, type: 'expense', name: 'Food', is_active: 1, uses: 0 }, { id: 2, type: 'expense', name: 'Transport', is_active: 1, uses: 0 }, { id: 3, type: 'income', name: 'Salary', is_active: 1, uses: 0 }],
  txns: [], seen: new Set(), nextId: 1 };
const ok = (data, message = 'OK', status = 200) => ({ status, body: { success: true, message, data } });
const fail = (message, status = 422, errors = {}, code = '') => ({ status, body: { success: false, message, errors, code } });
const me = () => ({ authenticated: S.logged, csrf: 'tok', user: { id: 1, name: 'Amina Test', email: 'amina@example.com', phone: '0712345678', role: S.role, has_avatar: false },
  settings: { theme: 'system' }, features: S.expired && S.role !== 'super_admin' ? ['expenses', 'accounts', 'categories', 'dashboard_basic', 'notifications', 'subscription', 'support', 'profile', 'settings'] : ['*'], unread: 2,
  subscription: S.expired ? { status: 'expired', display_status: 'expired', label: 'Expired', in_trial: false, full_access: false, payment_pending: false, days_remaining: 0, plan: { name: 'Monthly', price: '5000.00', period_months: 1 } } : { status: 'trial_active', display_status: 'trial_active', label: 'Trial Active', in_trial: true, full_access: true, payment_pending: false, days_remaining: 22, ends_at: '2026-12-01 00:00:00', plan: { name: 'Monthly', price: '5000.00', period_months: 1 } } });
const flow = Array.from({ length: 14 }, (_, i) => { const d = new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10); return { key: d, income: i % 4 === 0 ? '80000.00' : '0.00', expenses: String(5000 + i * 900) + '.00', net: '0.00' }; });
const routes = {
  'GET /api/auth/csrf': () => ok({ csrf: 'tok' }), 'GET /api/auth/me': () => ok(me()),
  'POST /api/auth/login': (b) => b.password === 'Passw0rd!' ? (S.logged = true, ok({ name: 'Amina Test' })) : fail('Invalid email or password.', 401),
  'POST /api/auth/register': (b) => b.email === 'dup@example.com' ? fail('Please correct the highlighted fields.', 422, { email: 'An account with this email already exists.' }) : (S.logged = true, ok({ needs_verification: false }, 'Account created.', 201)),
  'POST /api/auth/logout': () => (S.logged = false, ok(null)), 'POST /api/auth/forgot': () => ok(null),
  'GET /api/settings/public': () => ok({ app_name: 'Expense Tracker', trial_days: 30, plan: { name: 'Monthly', price: '5000.00', period_months: 1 }, registration_open: true, logo_custom: false, mabumbatech_logo: false, landing_announcement: '', support: { phone: '+255 700 000 000', email: 'help@example.com', whatsapp: '', hours: 'Mon–Fri 8–17', help_text: '' } }),
  'GET /api/dashboard/summary': () => ok({ range: { label: 'This month' }, total_income: '240000.00', total_expenses: '88000.00', net_cash_flow: '152000.00', current_balance: '200000.00', outstanding_debts: '30000.00', debts_owed_to_me: '10000.00', savings_balance: '45000.00', remaining_budget: '62000.00',
    subscription: me().subscription, recent: S.txns.slice(-6).reverse().map(t => ({ ...t, category_name: 'Food' })), upcoming_debts: [], analytics_available: !S.expired }),
  'GET /api/dashboard/insights': () => ok({ sentences: ['You spend the most on Food (45% of this month\'s spending).'], metrics: {}, has_enough_data: true }),
  'GET /api/dashboard/charts': () => ok({ period: 'month', flow, spending: { granularity: 'day', series: flow }, expense_categories: [{ name: 'Food', total: '40000.00', percent: 45 }, { name: 'Transport', total: '48000.00', percent: 55 }], income_sources: [{ name: 'Salary', total: '240000.00', percent: 100 }], budgets: [{ name: 'Monthly budget', budget: '150000.00', spent: '88000.00', percent: 58.6 }], debts: [], savings: [{ name: 'Emergency', saved: '45000.00', target: '100000.00', percent: 45 }] }),
  'GET /api/accounts': () => ok({ items: S.accounts, total_balance: '200000.00' }),
  'GET /api/categories': () => ok({ items: S.categories }),
  'GET /api/notifications': () => ok({ items: [{ id: 1, type: 'welcome', title: 'Welcome', body: 'Hello', link: 'dashboard.html', is_read: 0, created_at: '2026-10-19 05:00:00' }], total: 1, pages: 1, page: 1, unread: 1 }),
  'POST /api/notifications/read-all': () => ok(null),
};
function txnApi(type) {
  routes['POST /api/' + type] = (b) => { if (b.client_uuid && S.seen.has(b.client_uuid)) { S.queueDupes++; return ok({ id: 0, duplicate: true }, 'Already saved.'); }
    if (!b.amount || Number(b.amount) <= 0) return fail('Please correct the highlighted fields.', 422, { amount: 'Amount must be greater than zero.' });
    if (b.client_uuid) S.seen.add(b.client_uuid); const t = { id: S.nextId++, type: type === 'income' ? 'income' : 'expense', title: b.title, amount: Number(b.amount).toFixed(2), txn_date: b.txn_date, account_id: +b.account_id, category_id: +b.category_id }; S.txns.push(t); return ok({ id: t.id, duplicate: false }, 'Saved.', 201); };
  routes['GET /api/' + type] = () => { const items = S.txns.filter(t => t.type === (type === 'income' ? 'income' : 'expense')).map(t => ({ ...t, category_name: 'Food', account_name: 'Cash', status: 'posted', party: '', payment_method: '', reference: '', description: '' })); return ok({ items, summary: { total: items.length, income: '0.00', expenses: '0.00' }, page: 1, per_page: 20, pages: 1 }); };
}
txnApi('income'); txnApi('expenses');
try { require('./mock-routes.js')(routes, S, ok, fail); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/__mock/')) { const k = u.pathname.slice(8); if (k === 'state') { res.end(JSON.stringify({ queueDupes: S.queueDupes, txns: S.txns.length })); return; } if (k === 'expire') S.expired = true; if (k === 'unexpire') S.expired = false; if (k === 'admin') S.role = 'super_admin'; if (k === 'user') S.role = 'user'; if (k === 'logout') S.logged = false; if (k === 'login') S.logged = true; res.end('ok'); return; }
  if (u.pathname.startsWith('/api/')) {
    let data = ''; req.on('data', c => data += c); req.on('end', () => {
      let b = {}; try { b = JSON.parse(data || '{}'); } catch (e) {}
      const key = req.method + ' ' + u.pathname.replace(/\/$/, ''); let h = routes[key];
      if (!h) { for (const k of Object.keys(routes)) { if (k.includes(':')) { const re = new RegExp('^' + k.replace(/:[a-z]+/g, '([^/]+)') + '$'); const m = re.exec(key); if (m) { h = (bb) => routes[k](bb, m.slice(1), u.searchParams); break; } } } }
      const r = h ? (h.length > 1 ? h(b, [], u.searchParams) : h(b)) : fail('Not mocked: ' + key, 404);
      if (S.logged === false && !/\/auth\/|settings\/public/.test(key)) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, message: 'Please log in.' })); return; }
      res.writeHead(r.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(r.body));
    }); return;
  }
  let p = u.pathname === '/' ? '/index.html' : u.pathname; let f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(+process.argv[2] || 8099, () => console.log('mock on', process.argv[2] || 8099));
