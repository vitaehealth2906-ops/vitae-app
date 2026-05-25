// Captura a seção de pilares completa (já com .in aplicada pra ver tudo revelado)
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const url = 'file:///' + path.resolve(__dirname, '..', 'docs', 'marketing', 'pilares.html').replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'networkidle' });
  // Espera entrada + 1 ciclo de animação interna pra screenshots estáticas pegarem meio do movimento
  await page.waitForTimeout(2800);

  const out = path.join(__dirname, '..', 'docs', 'marketing', 'pilares-preview.png');
  await page.screenshot({ path: out, fullPage: true });
  console.log('✓ saved →', out);

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
