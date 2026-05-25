// Tira print da seção #como (A SOLUÇÃO) do site-oficial.html pra confirmar a troca
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const url = 'file:///' + path.resolve(__dirname, '..', 'site-oficial.html').replace(/\\/g, '/');
  console.log('→', url);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500); // espera o bundler decodificar manifest e renderizar

  // Rola até #como
  await page.evaluate(() => {
    const el = document.querySelector('#como');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await page.waitForTimeout(800);

  const out = path.join(__dirname, '..', 'docs', 'marketing', 'site-solucao-preview.png');
  await page.screenshot({ path: out, fullPage: false });
  console.log('✓ saved →', out);

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
