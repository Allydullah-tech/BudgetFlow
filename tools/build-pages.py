#!/usr/bin/env python3
"""Generates the thin HTML shells in frontend/ (one per page). Each shell loads the shared scripts plus one page script.
Re-run after adding a page:  python3 tools/build-pages.py"""
import os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')
CSS = ['themes', 'style', 'components', 'animations', 'responsive', 'dashboard']
HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title} · Expense Tracker</title>
<meta name="description" content="Expense Tracker by MABUMBATECH: track income, expenses, debts, budgets and savings in Tanzanian Shillings.">
<meta name="theme-color" content="#101828">
<link rel="manifest" href="/manifest.json" crossorigin="use-credentials">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/images/icons/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/assets/images/icons/favicon-16.png">
<link rel="apple-touch-icon" href="/assets/images/icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Expense Tracker">
{css}
<script src="/assets/js/theme.js"></script>
{extra_head}</head>
<body data-page="{page}"{body_cls}>
{body}
<noscript><p style="padding:24px;text-align:center">Expense Tracker needs JavaScript to run. Please enable it and reload.</p></noscript>
{scripts}
</body>
</html>
"""
def css(): return '\n'.join('<link rel="stylesheet" href="/assets/css/%s.css">' % c for c in CSS)
def js(*names): return '\n'.join('<script src="/assets/js/%s.js"></script>' % n for n in names)
APP_BASE = ['ui', 'api', 'charts', 'animations', 'pwa', 'app', 'forms']
APP = {  # page -> (title, script)
 'dashboard': ('Dashboard', 'dashboard'), 'income': ('Income', 'transactions'), 'expenses': ('Expenses', 'transactions'), 'transactions': ('Transactions', 'transactions'),
 'accounts': ('Accounts', 'accounts'), 'categories': ('Categories', 'accounts'), 'debts': ('Debts', 'debts'), 'budgets': ('Budgets', 'budgets'),
 'savings': ('Savings', 'savings'), 'recurring': ('Recurring', 'recurring'), 'reports': ('Reports', 'reports'), 'notifications': ('Notifications', 'notifications'),
 'subscription': ('Subscription', 'subscription'), 'settings': ('Settings', 'settings'), 'profile': ('Profile', 'settings'), 'help': ('Help & Support', 'help'),
 'admin-dashboard': ('Admin Dashboard', 'admin'), 'admin-customers': ('Customers', 'admin'), 'admin-payments': ('Payments', 'admin'), 'admin-methods': ('Payment methods', 'admin'),
 'admin-reports': ('Reports', 'admin'), 'admin-settings': ('System settings', 'admin'), 'admin-announcements': ('Announcements', 'admin'), 'admin-audit': ('Audit logs', 'admin'), 'admin-backups': ('Backups', 'admin'),
}
AUTH = {'login': 'Log in', 'register': 'Create account', 'forgot-password': 'Forgot password', 'reset-password': 'Reset password'}
def write(name, html):
    with open(os.path.join(ROOT, name + '.html'), 'w') as f: f.write(html)
for page, (title, script) in APP.items():
    scripts = js(*APP_BASE, 'pages/' + script)
    write(page, HEAD.format(title=title, css=css(), extra_head='', page=page, body_cls='', body='<div id="app"><div class="spinner" role="status" aria-label="Loading"></div></div>', scripts=scripts))
for page, title in AUTH.items():
    write(page, HEAD.format(title=title, css=css(), extra_head='', page={'forgot-password': 'forgot', 'reset-password': 'reset'}.get(page, page), body_cls='', body='<div id="app"><div class="spinner" role="status" aria-label="Loading"></div></div>', scripts=js('ui', 'api', 'auth')))

LEGAL = {
 'terms': ('Terms of Use', """<h1>Terms of Use</h1><p class="muted">Please read these terms before using Expense Tracker, a service provided by MABUMBATECH.</p>
<h2>1. The service</h2><p>Expense Tracker helps you record and review your own income, expenses, debts, budgets and savings. It is a record-keeping tool and does not provide financial, legal or tax advice.</p>
<h2>2. Your account</h2><p>You are responsible for keeping your password confidential and for activity on your account. Provide accurate details and tell us if you suspect unauthorised access.</p>
<h2>3. Free trial and subscription</h2><p>New accounts receive a free trial. After the trial, continued full access requires a paid subscription at the price shown in the app. Payments are made manually (for example by mobile money or bank transfer) and are activated after review by an administrator. Prices, trial length and payment methods may change; changes apply to future payments.</p>
<h2>4. When a subscription expires</h2><p>Your data is never deleted because a subscription has ended. You can continue to log in and record expenses. Some features, such as reports and analytics, become available again when you renew.</p>
<h2>5. Your data</h2><p>The financial records you enter belong to you. You may export or permanently delete them from your profile at any time. See the Privacy Policy for details.</p>
<h2>6. Acceptable use</h2><p>Do not attempt to access other users' data, disrupt the service, or use it for unlawful purposes. We may suspend accounts that breach these terms.</p>
<h2>7. Availability and accuracy</h2><p>We work to keep the service available and accurate, but it is provided "as is". Always check important figures against your own records. Keep your own backups of data you cannot afford to lose; you can export your data at any time.</p>
<h2>8. Changes and contact</h2><p>We may update these terms; continued use means you accept the changes. For questions, use the contact details on the <a href="/help.html">Help page</a>.</p>"""),
 'privacy': ('Privacy Policy', """<h1>Privacy Policy</h1><p class="muted">How MABUMBATECH handles information in Expense Tracker.</p>
<h2>What we store</h2><p>Your name, email address, phone number and password (stored only as a secure hash), plus the financial records you enter: accounts, transactions, debts, budgets, savings goals and recurring items. If you pay for a subscription we also store the payment reference, date, amount and any receipt image you upload.</p>
<h2>How we use it</h2><p>To provide the service: show your balances and reports, send in-app notifications you have enabled, process subscription payments and keep the service secure. We do not sell your data and we do not use your financial records for advertising.</p>
<h2>Who can see it</h2><p>Your financial records are visible only to you. Administrators can see account details needed to manage subscriptions (name, email, phone, subscription and payment status) but not your private financial records.</p>
<h2>Security</h2><p>Passwords are hashed, sessions are protected, requests are checked against forgery, uploaded files are stored privately, and sensitive actions are recorded in an audit log. No system is perfectly secure; please use a strong, unique password.</p>
<h2>Cookies and device storage</h2><p>We use a session cookie to keep you logged in. Your device may also store your theme preference and, while you are offline, expenses and income waiting to sync.</p>
<h2>Your choices</h2><p>You can update your details, export all your data, or permanently delete your account and financial records from your profile page.</p>
<h2>Contact</h2><p>Use the contact details on the <a href="/help.html">Help page</a>.</p>"""),
}
for page, (title, body) in LEGAL.items():
    inner = '<main class="auth-form" style="min-height:100vh;align-items:start"><article class="card" style="max-width:760px;width:100%;margin:24px auto;padding:28px"><a href="/" class="brand" style="color:var(--heading) !important"><img src="/assets/images/logo.png" alt="" width="46" height="46"><b style="color:var(--heading)">Expense Tracker</b></a>' + body + '<p class="small muted">Last updated: 19 October 2026.</p><!-- Plain-language template: have a legal adviser review it before launch. --></article></main>'
    write(page, HEAD.format(title=title, css=css(), extra_head='', page='legal', body_cls='', body=inner, scripts=''))

print('generated', len(APP) + len(AUTH), 'pages')
