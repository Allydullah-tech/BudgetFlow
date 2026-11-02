const { start, check, summary, watch } = require('./lib');
(async () => {
  const { browser, base, stop } = await start(8097);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const errors = []; watch(page, errors);
  await fetch(base + '/__mock/login'); await fetch(base + '/__mock/admin');
  console.log('Role separation');
  await page.goto(base + '/dashboard.html'); await page.waitForURL('**/admin-dashboard.html'); check('super admin is redirected to admin area', true);
  await page.waitForSelector('.grid.cols-4 .stat');
  check('admin dashboard has 14 KPI cards', (await page.$$('.grid.cols-4 .stat')).length === 14); check('6 admin charts drawn', (await page.$$('.chart svg')).length === 6);
  check('pending payments banner', /1 payment/.test(await page.textContent('.banner.warn')));
  await page.screenshot({ path: (process.env.SHOTS || '/tmp') + '/admin-dash.png', fullPage: true });
  check('admin nav shows admin items only', /Customers/.test(await page.textContent('.sidebar')) && !/Budgets/.test(await page.textContent('.sidebar')));
  console.log('Payments approval');
  await page.goto(base + '/admin-payments.html'); await page.waitForSelector('[data-ok="1"]'); await page.click('[data-ok="1"]'); await page.click('.modal [data-ok]');
  await page.waitForSelector('.toast:has-text("activated")'); check('payment approved via confirm dialog', true);
  console.log('Other admin pages');
  for (const [p, sel, text] of [['admin-customers', '[data-open]', 'Neema'], ['admin-methods', '.grid.cols-3 .card', 'M-Pesa'], ['admin-settings', '#sf', 'Subscription plans'], ['admin-announcements', '#add', ''], ['admin-audit', '#list table', 'Login'], ['admin-backups', '#mk', 'backup-2026'], ['admin-reports', '#out .stat', 'Approved revenue']]) {
    await page.goto(base + '/' + p + '.html'); await page.waitForSelector(sel); check(p + ' renders', !text || (await page.textContent('#view')).includes(text));
  }
  await page.goto(base + '/admin-customers.html'); await page.click('[data-open="5"]'); await page.waitForSelector('.modal'); await page.click('#ext'); await page.fill('[name=note]', 'Goodwill'); await page.click('#mf [type=submit]');
  await page.waitForSelector('.toast:has-text("extended")'); check('extend access flow', true);
  await page.goto(base + '/admin-settings.html'); await page.waitForSelector('#sf'); await page.fill('[name=trial_days]', '45'); await page.check('[data-feat="income"]'); await page.click('#sf [type=submit]'); await page.waitForSelector('.toast:has-text("Settings saved")');
  const last = await (await fetch(base + '/__mock/last')).json().catch(() => null);
  check('mandatory features cannot be unticked', await page.isDisabled('[data-feat="subscription"]'));
  console.log('Normal user is kept out');
  await fetch(base + '/__mock/user'); await page.goto(base + '/admin-customers.html'); await page.waitForURL('**/dashboard.html'); check('normal user cannot open admin pages', true);
  check('no JS errors', errors.length === 0, errors.join(' | '));
  await stop(); summary();
})().catch(e => { console.error(e); process.exit(1); });
