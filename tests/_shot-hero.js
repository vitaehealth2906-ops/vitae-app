// Tira print do composite hero pra Lucas conferir
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const url = 'file:///' + path.resolve(__dirname, '..', 'docs', 'marketing', 'hero-vitaid.html').replace(/\\/g, '/');
  console.log('opening', url);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800); // deixa iframes renderizarem

  const out = path.join(__dirname, '..', 'docs', 'marketing', 'hero-preview.png');
  await page.screenshot({ path: out, fullPage: false });
  console.log('saved →', out);

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
