const { start, check, summary, watch } = require('./lib');
(async () => {
  const { browser, base, stop } = await start(8098);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const errors = []; watch(page, errors);
  await fetch(base + '/__mock/login');
  const go = async (p, sel) => { await page.goto(base + '/' + p + '.html'); await page.waitForSelector(sel || '#view > *', { timeout: 8000 }); };
  console.log('Pages render with real-shaped data');
  for (const [p, sel, text] of [['income', '#list', ''], ['expenses', '#list', ''], ['transactions', '#list', ''], ['accounts', '.grid.cols-3 .card', 'M-Pesa'], ['categories', '.grid.cols-2 .card', 'Food'], ['debts', '.grid.cols-3 .card', 'Juma Traders'], ['budgets', '.grid.cols-3 .card', 'Food budget'], ['savings', '.grid.cols-3 .card', 'Emergency fund'], ['recurring', '.card', 'Rent'], ['reports', '#out .card', 'Income vs Expenses'], ['subscription', '.card', 'M-Pesa'], ['settings', '#sf', ''], ['profile', '#pf', ''], ['help', '.faq', 'Frequently asked'], ['notifications', '#nl .txn', 'Welcome']]) {
    await go(p, sel); const t = await page.textContent('#view'); check(p + ' renders' + (text ? ' (' + text + ')' : ''), !text || t.includes(text), t.slice(0, 120));
  }
  console.log('Debts');
  await go('debts', '.grid.cols-3 .card'); await page.click('[data-pay="1"]'); await page.waitForSelector('#pf');
  await page.$eval('[name=principal_amount]', (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, '90000'); await page.click('#pf [type=submit]'); await page.waitForSelector('.field.invalid .err:not(:empty)');
  check('over-payment error shown inline', /more than the remaining/.test(await page.textContent('.field.invalid .err')));
  await page.$eval('[name=principal_amount]', (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, '10000'); await page.click('#pf [type=submit]'); await page.waitForSelector('.toast:has-text("Payment recorded")');
  check('payment saved toast', true);
  await page.click('[data-open="1"]'); await page.waitForSelector('.modal'); check('debt detail shows payment history + statement link', (await page.textContent('.modal')).includes('Payment history') && !!(await page.$('.modal a[href*="debt-statement"]')));
  await page.keyboard.press('Escape'); await page.waitForSelector('.modal-root', { state: 'detached' });
  console.log('Accounts / budgets / savings / recurring');
  await go('accounts', '.grid.cols-3 .card'); await page.click('#addAcc'); await page.fill('[name=name]', 'Cash'); await page.click('#af [type=submit]'); await page.waitForSelector('.field.invalid');
  check('duplicate account name error inline', /already have/.test(await page.textContent('.field.invalid .err'))); await page.keyboard.press('Escape');
  await go('budgets', '.grid.cols-3 .card'); check('budget shows 80% warning', (await page.textContent('#view')).includes('Warning') && (await page.textContent('#view')).includes('80%'));
  await go('savings', '.grid.cols-3 .card'); await page.click('[data-add="1"]'); await page.fill('[name=amount]', '5000'); await page.click('#mf [type=submit]'); await page.waitForSelector('.toast'); check('savings contribution saved', /Savings added/.test(await page.textContent('.toast')));
  await go('recurring', '.card'); check('due recurring item offers Record/Skip', !!(await page.$('[data-confirm="1"]')) && !!(await page.$('[data-skip="1"]')));
  console.log('Spending needs real money');
  await go('expenses', '#list'); await page.click('#addBtn'); await page.waitForSelector('#txnForm');
  await page.$eval('[name=amount]', (e) => { e.value = '80000'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.selectOption('[name=account_id]', '2');
  check('short account shows a warning and blocks saving', (await page.textContent('#txnForm .funds-box')).includes('does not have enough') && await page.$eval('#txnForm [type=submit]', (b) => b.disabled));
  check('account with enough money is suggested', !!(await page.$('#txnForm [data-use="1"]')));
  await page.click('#txnForm [data-use="1"]');
  check('choosing the suggested account unblocks saving', (await page.$eval('[name=account_id]', (e) => e.value)) === '1' && !(await page.$eval('#txnForm [type=submit]', (b) => b.disabled)));
  await page.$eval('[name=amount]', (e) => { e.value = '200000'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('#txnForm [data-borrow]');
  check('borrow form has the debt details (name, phone, due date, interest, notes)', !!(await page.$('#txnForm [name=borrow_party]')) && !!(await page.$('#txnForm [name=borrow_phone]')) && !!(await page.$('#txnForm [name=borrow_due_date]')) && !!(await page.$('#txnForm [name=borrow_interest_rate]')) && !!(await page.$('#txnForm [name=borrow_notes]')));
  check('borrow option asks who lends and blocks until named', await page.$eval('#txnForm [type=submit]', (b) => b.disabled));
  await page.fill('#txnForm [name=borrow_party]', 'Juma');
  check('naming the lender allows saving', !(await page.$eval('#txnForm [type=submit]', (b) => b.disabled)));
  await page.keyboard.press('Escape');
  console.log('Subscription / profile');
  await go('subscription', '#pf'); await page.fill('[name=reference]', 'XYZ999'); await page.click('#pf [type=submit]'); await page.waitForSelector('.toast:has-text("submitted")'); check('payment submission accepted', true);
  check('rejected payment shows reason', (await page.textContent('#view')).includes('Reference not found'));
  await go('profile', '#pw'); await page.fill('#pw [name=current_password]', 'bad'); await page.fill('#pw [name=new_password]', 'Newpass123'); await page.fill('#pw [name=confirm_password]', 'Newpass123'); await page.click('#pw [type=submit]');
  await page.waitForSelector('#pw .field.invalid'); check('wrong current password flagged', /incorrect/.test(await page.textContent('#pw .field.invalid .err')));
  console.log('Expired user');
  await fetch(base + '/__mock/expire');
  for (const p of ['budgets', 'debts', 'reports', 'savings', 'recurring', 'income', 'transactions']) { await page.goto(base + '/' + p + '.html'); await page.waitForSelector('#view .card.center'); check(p + ' is gated for expired users', /needs an active subscription/.test(await page.textContent('#view'))); }
  for (const p of ['expenses', 'accounts', 'subscription', 'help', 'settings']) { await go(p); check(p + ' still available when expired', !/needs an active subscription/.test(await page.textContent('#view'))); }
  await fetch(base + '/__mock/unexpire');
  console.log('Dark mode / admin redirect');
  await page.goto(base + '/dashboard.html'); await page.waitForSelector('.stat'); await page.click('#themeBtn'); await page.click('#themeBtn');
  check('theme cycles to dark', (await page.getAttribute('html', 'data-theme')) === 'dark' || (await page.getAttribute('html', 'data-theme-pref')) === 'dark');
  check('no JS errors', errors.length === 0, errors.join(' | '));
  await stop(); summary();
})().catch(e => { console.error(e); process.exit(1); });
