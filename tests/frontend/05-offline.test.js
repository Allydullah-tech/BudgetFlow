const { start, check, summary, watch } = require('./lib');
(async () => {
  const { browser, base, stop } = await start(8095);
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'allow' });
  const page = await ctx.newPage(); watch(page, errors);
  await fetch(base + '/__mock/login');
  console.log('Offline boot + queue');
  await page.goto(base + '/expenses.html'); await page.waitForSelector('.table-wrap, .empty, table', { timeout: 8000 });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForTimeout(1500);
  check('me snapshot cached', await page.evaluate(() => !!localStorage.getItem('et_me_cache')));
  await ctx.setOffline(true);
  await page.reload().catch(() => {}); await page.waitForTimeout(1500);
  const body = await page.textContent('body');
  check('expenses page boots offline (not browser error)', /Expense|offline/i.test(body));
  const offlineCard = /You are offline/i.test(body);
  const hasAdd = !!(await page.$('button:has-text("Add expense"), button:has-text("Add Expense")'));
  check('offline: add expense available (page or offline card)', hasAdd, body.slice(0, 200));
  if (hasAdd) {
    await page.click('button:has-text("Add expense"), button:has-text("Add Expense")');
    await page.waitForSelector('.modal', { timeout: 4000 }).catch(() => {});
    check('form modal opens offline', !!(await page.$('.modal')));
    const amt = await page.$('.modal [name=amount]');
    if (amt) {
      await amt.fill('12000'); await page.fill('.modal [name=title]', 'Offline lunch');
      const sel = await page.$('.modal [name=category_id]'); if (sel) { const o = await sel.$$('option'); if (o.length > 1) await sel.selectOption({ index: 1 }); }
      const acc = await page.$('.modal [name=account_id]'); if (acc) { const o = await acc.$$('option'); if (o.length > 1) await acc.selectOption({ index: 1 }); }
      await page.click('.modal [type=submit]'); await page.waitForTimeout(800);
    }
  }
  const q = await page.evaluate(() => JSON.parse(localStorage.getItem('et_offline_queue') || '[]').length);
  check('expense queued with exactly one entry', q === 1, 'queue=' + q);
  await ctx.setOffline(false); await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(2500);
  const q2 = await page.evaluate(() => JSON.parse(localStorage.getItem('et_offline_queue') || '[]').length);
  const st = await (await fetch(base + '/__mock/state')).json();
  check('queue drained after reconnect', q2 === 0, 'queue=' + q2);
  check('no duplicate server records', st.queueDupes === 0, JSON.stringify(st));
  check('no JS errors', errors.length === 0, errors.join(' | '));
  await stop(); summary();
})().catch(e => { console.error(e); process.exit(1); });
