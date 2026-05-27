// Print da seção "O PROBLEMA" pra ver as 3 pilares
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const url = 'file:///' + path.resolve(__dirname, '..', 'site-oficial.html').replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Procura pela seção problema pelo data-screen-label
  await page.evaluate(() => {
    const el = document.querySelector('[data-screen-label="02 problema"]');
    if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  await page.waitForTimeout(2500); // deixa vídeo começar

  const out = path.join(__dirname, '..', 'docs', 'marketing', 'problema-section-preview.png');
  await page.screenshot({ path: out, fullPage: false });
  console.log('✓ saved →', out);

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
