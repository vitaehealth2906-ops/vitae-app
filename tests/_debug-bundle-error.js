// Captura o console do site pra ver o erro exato do bundle
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const messages = [];
  page.on('console', m => messages.push(m.type() + ': ' + m.text()));
  page.on('pageerror', e => messages.push('PAGEERROR: ' + e.message));
  const url = 'file:///' + path.resolve(__dirname, '..', 'site-oficial.html').replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log('--- CONSOLE ---');
  messages.slice(0, 20).forEach(m => console.log(' ', m.slice(0, 200)));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
