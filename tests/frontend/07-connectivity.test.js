const { start, check, summary, watch } = require('./lib');
(async () => {
  const { browser, base, stop } = await start(8094);
  const errors = [];
  console.log('Online but the browser says offline (navigator.onLine is wrong)');
  let ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false }); });
  let page = await ctx.newPage(); watch(page, errors);
  await fetch(base + '/__mock/login');
  await page.goto(base + '/dashboard.html'); await page.waitForSelector('#view > *', { timeout: 8000 }); await page.waitForTimeout(2500);
  check('no "offline" banner while the server is reachable', !(await page.$('.conn.offline')));
  await ctx.close();

  console.log('Really offline, then back online');
  ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'allow' }); page = await ctx.newPage(); watch(page, errors);
  await page.goto(base + '/dashboard.html'); await page.waitForSelector('#view > *', { timeout: 8000 });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await page.waitForTimeout(2500);
  check('account snapshot and form lists are kept for offline use', await page.evaluate(() => !!localStorage.getItem('et_me_cache') && !!localStorage.getItem('et_lookups')));
  await ctx.setOffline(true); await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.waitForSelector('.conn.offline', { timeout: 6000 }).catch(() => {});
  check('banner appears when the connection is really gone', !!(await page.$('.conn.offline')));
  await ctx.setOffline(false); await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForSelector('.conn.online', { timeout: 6000 }).catch(() => {});
  check('banner clears by itself when the connection returns', !(await page.$('.conn.offline')) && !!(await page.$('.conn.online')));

  console.log('Opening the app with no connection');
  await ctx.setOffline(true);
  await page.goto(base + '/login.html?x=1').catch(() => {}); await page.waitForTimeout(2500);
  check('login page is available offline and sends a signed-in device into the app', /dashboard\.html/.test(page.url()));
  await page.goto(base + '/categories.html').catch(() => {}); await page.waitForTimeout(1500);
  check('any app page opens offline (not the browser error page)', /Categories|categories/i.test(await page.title()) || (await page.textContent('body')).length > 200);
  await ctx.setOffline(false);
  await page.evaluate(() => localStorage.removeItem('et_me_cache')); await ctx.setOffline(true);
  await page.goto(base + '/login.html').catch(() => {}); await page.waitForSelector('.banner.warn', { timeout: 6000 }).catch(() => {});
  check('new device offline: clear message about first login needing internet', /first time on this device/.test(await page.textContent('body')));
  check('no JS errors', errors.length === 0, errors.join(' | '));
  await stop(); summary();
})().catch(e => { console.error(e); process.exit(1); });
