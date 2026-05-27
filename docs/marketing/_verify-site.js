const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const url = 'file:///' + path.resolve(__dirname, '../../site-oficial.html').replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const el = page.locator('.sol-right').first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const out = path.resolve(__dirname, '_verify-site.png');
  // Captura a section inteira em volta da hero pra ver layout completo
  const section = page.locator('section').filter({ has: page.locator('.sol-right') }).first();
  await section.screenshot({ path: out });
  console.log('Screenshot:', out);
  await browser.close();
})();
