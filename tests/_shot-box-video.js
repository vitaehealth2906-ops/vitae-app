// Print da nova seção box-pre-consulta no site oficial
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const url = 'file:///' + path.resolve(__dirname, '..', 'site-oficial.html').replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  await page.evaluate(() => {
    const el = document.getElementById('box-pre-consulta');
    if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  await page.waitForTimeout(1500); // deixa vídeo carregar e rodar um pouco

  const out = path.join(__dirname, '..', 'docs', 'marketing', 'box-pre-consulta-preview.png');
  await page.screenshot({ path: out, fullPage: false });
  console.log('✓ saved →', out);

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
