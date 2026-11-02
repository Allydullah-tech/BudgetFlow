# Expense Tracker (PWA) — by MABUMBATECH

A Progressive Web App for personal money management in **Tanzanian Shillings (TZS)**: income, expenses, accounts and transfers, debts, budgets, savings goals, recurring items, 16 reports (CSV + PDF), notifications, and a subscription system (30-day free trial, then TZS 5,000/month) approved manually by a Super Admin.

| Tier | Folder | Tech |
|---|---|---|
| Presentation | `frontend/` | HTML5, CSS3, vanilla JavaScript, service worker, manifest |
| Application | `backend/` | PHP 8.1+, PDO prepared statements, JSON API |
| Data | `database/` | MySQL 5.7+/MariaDB 10.4+ (InnoDB, utf8mb4) |

## 1. Requirements
- PHP 8.1+ with `pdo_mysql`, `mbstring`, `fileinfo`, `gd` or `iconv` (recommended)
- MySQL 5.7+ / MariaDB 10.4+
- Apache 2.4 with `mod_rewrite` and `mod_headers` (an `.htaccess` is included). For Nginx see §9.
- **HTTPS in production** (browsers only allow install + service worker on HTTPS; `localhost` is exempt)
- The site must be served from the **domain root** (e.g. `https://tracker.example.com/`), not a sub-folder, because asset URLs are root-relative.

## 2. Install
1. Create an empty database and a user with full rights on it (cPanel → MySQL Databases, or phpMyAdmin).
2. Upload the project so the **document root is this folder** (the one containing `.htaccess`, `frontend/`, `backend/`). On XAMPP: put it in `htdocs/` and create a virtual host with that root.
3. Make `backend/storage/` writable by PHP (`chmod -R 750`). Better: set `STORAGE_PATH` in `.env` to a folder **outside** the web root.
4. Open `https://your-site/backend/install.php`. It shows a one-time token location (`backend/storage/install_token.txt`, proving you have file access), asks for DB details, site URL and **your own Super Admin email and password** — there is **no default password anywhere**.
5. The installer applies `database/schema.sql`, default settings and categories, writes `backend/.env`, and **locks itself** (`backend/storage/installed.lock`).
6. Log in as Super Admin → **Settings** and set the support phone/WhatsApp/email, trial length, price (Plans), payment methods (+ QR codes) and logos.

To run manually instead: import `database/schema.sql`, `database/initial-settings.sql` and `database/seeds/default-categories.sql`, copy `backend/.env.example` to `backend/.env`, edit it.

## 3. Scheduled jobs (cron)
Reminders (subscription expiry, budgets, debts, recurring items) and scheduled announcements run from one script. All steps are idempotent.
```
# every day at 06:00, and a backup every Sunday at 02:00
0 6 * * *  php /path/to/backend/cron.php
0 2 * * 0  php /path/to/backend/cron.php --backup
```
Without cron the app still works; reminders are then only produced when users open it.

## 4. Backups and restore
- Super Admin → **Backups**: create, download, delete. `cron.php --backup` makes one automatically; old ones are pruned after `backup_retention_days`.
- Backups are `.sql` files in `backend/storage/backups/` (not web-accessible). Restore with `mysql -u USER -p DBNAME < backup.sql`.
- Also copy `backend/storage/receipts` and `qr` (uploaded images) — they are not inside the SQL dump.

## 5. Subscription (all editable by Super Admin, no code changes)
- **Trial** length, **plans/price**, billing rule (calendar month or 30 days), reminder days, and which features stay available after expiry are in Settings.
- **Payment methods** (mobile-money numbers, bank accounts, QR codes) are managed in *Payment methods*; users pay outside the app and submit the transaction reference. The Super Admin approves or rejects; approval extends coverage from the current end date.
- **Expired users are restricted on the server** (HTTP 402 `subscription_required`). By default they can still log in, view everything they already have, and record/manage **expenses**; advanced reports and analytics return until they renew. **No data is ever deleted** because of expiry.

## 6. Accounting rules (no double counting)
Everything is one ledger (`transactions`):
- **Income** and **Expense** are the only rows reports count as income/expenses.
- **Transfers** between accounts are two rows (`transfer_out` + `transfer_in`) — they change balances only. Total balance is unchanged.
- **Debts:** borrowing/lending principal and repayments change balances but are not income/expense. **Interest** is recorded separately (expense "Debt interest" / income "Interest").
- **Savings contributions/withdrawals** move money between an account and a goal; not expenses/income.
- "Delete" is a **reversal** (`status = reversed`): history is kept, totals exclude it. Reversing a transfer reverses both legs; debt/savings rows are reversed from their own pages so balances stay right.

## 7. PWA and offline
- Valid manifest, 192/512 icons (any + maskable), service worker `et-v2`, offline page, install button (Chrome/Edge/Android) and an Add-to-Home-Screen hint on iOS.
- The service worker **never caches `/api/`**. Pages are network-first, static files stale-while-revalidate.
- **Offline recording:** expenses and income entered offline are queued on the device with a unique `client_uuid` and sent in order when the connection returns; the server ignores repeats, so no duplicates. Logging out warns if items are unsynced.
- To update the cached app after deploying changes, bump the version in `frontend/service-worker.js`.

## 8. Testing
```
php tests/backend/unit.php            # no database needed (validation, date math, rules, PDF)
php tests/backend/integration.php     # needs a TEST database with schema applied + backend/.env
cd tests/frontend && node 01-auth-dashboard.test.js   # also 02/03/04/05 (Playwright + chromium)
```
Frontend tests run the real pages in headless Chromium against a **mock API** (`mock-server.js`), so they verify the UI, offline queue and PWA behaviour but **not** the PHP/MySQL logic. Backend logic is covered by the two PHP scripts above. Also do the manual checklist in §10 after installing.

## 9. Deployment notes
- Nginx: route `/api/` to `backend/api/index.php` with `fastcgi`, serve `frontend/` as root, deny `backend/storage`, `database/`, dotfiles; add the security headers from `.htaccess` (including the CSP: no inline scripts are used).
- Keep `APP_DEBUG=false`, `ALLOW_UNINSTALL=false`. Delete or block `backend/install.php` and `uninstall.php` after installing if you prefer.
- Sessions use the `ET_SESSION` cookie (HttpOnly, Secure on HTTPS, SameSite). Every state-changing request needs the `X-CSRF-Token` header (handled by `api.js`).

## 10. Manual acceptance checklist
1. Register → welcome-back animation → dashboard; trial shows 30 days.
2. Add account, income, expense; dashboard cards and charts change; transfer between accounts leaves total balance unchanged and income/expenses unchanged.
3. Create a debt, pay part of it; remaining balance falls; income/expense totals unchanged.
4. Budget at 90% shows an alert. Savings goal contribution lowers account balance, not "expenses".
5. Reports: run each type, download CSV and PDF.
6. Subscription: submit a payment → Super Admin approves → coverage extends. Reject path shows the reason.
7. Set a test user's `trial_ends_at` in the past (phpMyAdmin): reports return the "subscription required" message; expenses still work; data intact.
8. Install the app (Chrome menu → Install). Go offline, add an expense, go online: it syncs once.

## 11. Known limits / design decisions
- Single currency (TZS). Not multi-currency.
- Page scripts are grouped per module (`frontend/assets/js/pages/*.js`). Debt payments live inside the Debts page; payment history inside the Subscription page; plans are edited in Admin → Settings.
- The offline queue is kept in the browser's `localStorage` (not encrypted), holds only expense/income entries, and is cleared on logout once synced. Do not enable offline entry on shared devices.
- Announcement audience "selected users" exists in the API but is not exposed in the admin UI.
- Email sending uses PHP `mail()`; configure your host's mail or SMTP relay for password-reset emails.

## 12. Project layout
```
.htaccess            routing + security headers
frontend/            index.html, app pages, assets/{css,js,images}, manifest.json, service-worker.js, offline.html
backend/             api/<module>/, services/, middleware/, helpers/, config/, install.php, cron.php, storage/
database/            schema.sql, initial-settings.sql, seeds/, migrations/
tests/               backend/ (PHP), frontend/ (Playwright + mock API)
tools/build-pages.py regenerates the HTML page shells
```
Logos: `frontend/assets/images/` (from the supplied set; originals in `brand-source/`). Super Admin can upload replacements in Settings.

© MABUMBATECH — Developed with care.
