const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');
const { spawn } = require('child_process'); const path = require('path');
let server;
async function start(port = 8099) {
  server = spawn('node', [path.join(__dirname, 'mock-server.js'), String(port)], { stdio: 'ignore' }); process.on('exit', () => { try { server.kill(); } catch (e) {} });
  for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://localhost:${port}/__mock/state`); if (r.ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 100)); }
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  return { browser, base: `http://localhost:${port}`, stop: async () => { await browser.close(); server.kill(); } };
}
let pass = 0, failN = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('  ok   ' + name); } else { failN++; console.log('  FAIL ' + name + (extra ? ' :: ' + extra : '')); } }
function summary() { console.log(`\n${pass} passed, ${failN} failed`); process.exitCode = failN ? 1 : 0; }
function watch(page, errors) { page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); }); }
module.exports = { start, check, summary, watch };
