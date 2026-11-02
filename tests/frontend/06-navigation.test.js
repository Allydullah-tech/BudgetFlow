/* Navigation: mobile dock + orbit dial, desktop sliding sidebar. Run: node 06-navigation.test.js (SHOTS=/dir for screenshots) */
const { start, check, summary, watch } = require('./lib');
const OUT = process.env.SHOTS || '/tmp';
(async () => {
  const { browser, base, stop } = await start(8095);
  await fetch(base + '/__mock/login');
  const errors = [];
  console.log('Phone: dock and orbit dial');
  const m = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true }); const p = await m.newPage(); watch(p, errors);
  await p.goto(base + '/savings.html'); await p.waitForSelector('.dock');
  check('hamburger button is gone', (await p.$('#menuBtn')) === null);
  check('sidebar hidden on phone', !(await p.isVisible('.sidebar')));
  check('dock shows 4 priority tabs + hub', (await p.$$('.dock > a')).length === 4 && !!(await p.$('#moreBtn')));
  check('hub names the current page when it is not a dock tab', /Savings/.test(await p.textContent('#moreBtn')));
  check('orbit not built until needed', (await p.$('#orbit')) === null);
  await p.screenshot({ path: OUT + '/nav-dock.png' });
  await p.click('#moreBtn'); await p.waitForSelector('#orbit:not([hidden])'); await p.waitForTimeout(900);
  const n = await p.$$eval('.orbit-node', a => a.length); check('every page is on the ring (' + n + ')', n >= 14);
  check('current page is selected on open', (await p.textContent('.oc-title')).trim() === 'Savings');
  check('hub toggles to close state', (await p.getAttribute('#moreBtn', 'aria-expanded')) === 'true');
  const pos = await p.$$eval('.orbit-node', els => els.map(e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }));
  const dr = await p.$eval('.orbit-dial', e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const radii = pos.map(([x, y]) => Math.hypot(x - dr[0], y - dr[1])); const spread = Math.max(...radii) - Math.min(...radii);
  check('nodes sit on a circle (radius spread ' + spread.toFixed(1) + 'px)', spread < 14);
  check('dial fits the screen', await p.$eval('.orbit-card', e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0; }));
  await p.screenshot({ path: OUT + '/nav-orbit-open.png' });
  // drag the ring: quarter turn clockwise starting at 12 o'clock
  const R = Math.hypot(pos[0][0] - dr[0], pos[0][1] - dr[1]);
  const before = (await p.textContent('.oc-title')).trim();
  await p.mouse.move(dr[0], dr[1] - R * 0.8); await p.mouse.down();
  const steps = 14; for (let i = 1; i <= steps; i++) { const a = (i / steps) * (Math.PI / 3); await p.mouse.move(dr[0] + Math.sin(a) * R * 0.8, dr[1] - Math.cos(a) * R * 0.8); await p.waitForTimeout(16); }
  await p.screenshot({ path: OUT + '/nav-orbit-drag.png' });
  await p.mouse.up(); await p.waitForTimeout(900);
  const after = (await p.textContent('.oc-title')).trim(); check('dragging turns the dial (' + before + ' -> ' + after + ')', before !== after);
  const snapped = await p.$eval('.orbit-node.is-sel', e => { const r = e.getBoundingClientRect(), d = document.querySelector('.orbit-dial').getBoundingClientRect(); return Math.abs((r.left + r.width / 2) - (d.left + d.width / 2)); });
  check('dial snaps so the selection is at 12 o\'clock (offset ' + snapped.toFixed(1) + 'px)', snapped < 2);
  await p.screenshot({ path: OUT + '/nav-orbit-settled.png' });
  await p.waitForTimeout(1500); // let the fling finish
  const idle = await p.evaluate(() => new Promise(res => { let n = 0; const o = window.requestAnimationFrame; window.requestAnimationFrame = f => { n++; return o.call(window, f); }; setTimeout(() => { window.requestAnimationFrame = o; res(n); }, 700); }));
  check('no animation loop runs while the dial is at rest (' + idle + ' frames requested)', idle === 0);
  // chips jump to a section
  await p.click('.orbit-chip:nth-child(3)'); await p.waitForTimeout(700);
  check('section chip jumps to its first page', /Insights/i.test(await p.textContent('.oc-eyebrow')));
  // keyboard
  await p.focus('.orbit-dial'); const t0 = (await p.textContent('.oc-title')).trim(); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(500);
  check('arrow key advances one page', (await p.textContent('.oc-title')).trim() !== t0);
  await p.keyboard.press('Escape'); await p.waitForTimeout(500); check('Escape closes the orbit', await p.$eval('#orbit', e => e.hidden));
  // tap a node to select, tap again to open
  await p.click('#moreBtn'); await p.waitForTimeout(900);
  const target = await p.$$eval('.orbit-node', els => els.map(e => e.getAttribute('aria-label')));
  const ti = target.indexOf('Budgets'); const tpos = await p.$$eval('.orbit-node', (els, i) => { const r = els[i].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, ti);
  await p.mouse.click(tpos[0], tpos[1]); await p.waitForTimeout(700);
  check('tapping a page turns the dial to it', (await p.textContent('.oc-title')).trim() === 'Budgets');
  await Promise.all([p.waitForURL('**/budgets.html'), p.click('.orbit-go')]);
  await p.waitForSelector('.dock');
  check('opened page marks its dock tab', /Budgets/.test(await p.textContent('.dock > a[aria-current="page"]')));
  await p.screenshot({ path: OUT + '/nav-dock-budgets.png' });
  // tablet
  const tb = await browser.newContext({ viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true }); const tp = await tb.newPage(); watch(tp, errors);
  await tp.goto(base + '/dashboard.html'); await tp.waitForSelector('.dock'); await tp.click('#moreBtn'); await tp.waitForTimeout(900);
  check('tablet: dock + dial used below 900px', await tp.isVisible('.orbit-dial') && !(await tp.isVisible('.sidebar')));
  await tp.screenshot({ path: OUT + '/nav-orbit-tablet.png' });
  // reduced motion: instant open
  const rm = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }); const rp = await rm.newPage(); watch(rp, errors);
  await rp.goto(base + '/dashboard.html'); await rp.waitForSelector('.dock'); await rp.click('#moreBtn');
  check('reduced motion: dial is in place immediately', (await rp.$eval('.orbit-card', e => getComputedStyle(e).opacity)) === '1');
  console.log('Admin');
  await fetch(base + '/__mock/admin');
  const a = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true }); const ap = await a.newPage(); watch(ap, errors);
  await ap.goto(base + '/admin-dashboard.html'); await ap.waitForSelector('.dock'); await ap.click('#moreBtn'); await ap.waitForTimeout(900);
  const al = await ap.$$eval('.orbit-node', els => els.map(e => e.getAttribute('aria-label')));
  check('admin dial lists admin pages (Audit logs, Backups reachable)', al.includes('Audit logs') && al.includes('Backups') && !al.includes('Budgets'));
  await ap.screenshot({ path: OUT + '/nav-orbit-admin.png' });
  console.log('Desktop');
  const d = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const dp = await d.newPage(); watch(dp, errors);
  await dp.goto(base + '/admin-customers.html'); await dp.waitForSelector('.sidebar .nav-pill');
  check('desktop keeps the sidebar', await dp.isVisible('.sidebar')); check('desktop has no dock', !(await dp.isVisible('.dock')));
  const py = await dp.$eval('.nav-pill', e => e.style.transform), ay = await dp.$eval('.sidebar a[aria-current="page"]', e => e.offsetTop);
  check('sliding pill sits on the active item', py.includes(ay + 'px'));
  await dp.hover('.sidebar a[href="admin-audit.html"]'); await dp.waitForTimeout(350);
  check('hover highlight follows the pointer', await dp.$eval('.nav-hov', e => e.classList.contains('on')));
  await dp.screenshot({ path: OUT + '/nav-desktop.png' });
  check('no JS errors', errors.length === 0, errors.join(' | '));
  await stop(); summary();
})().catch(e => { console.error(e); process.exit(1); });
