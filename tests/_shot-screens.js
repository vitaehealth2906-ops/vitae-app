// Tira print das 3 telas individuais (1:1) pra Lucas conferir
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  // iPhone exames
  const ctxP = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
  const pageP = await ctxP.newPage();
  await pageP.goto('file:///' + path.resolve(__dirname, '..', 'docs', 'marketing', 'screens', 'iphone-exames.html').replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await pageP.waitForTimeout(400);
  await pageP.screenshot({ path: path.join(__dirname, '..', 'docs', 'marketing', 'preview-iphone-exames.png') });

  // iPhone pré-consulta
  const pageQ = await ctxP.newPage();
  await pageQ.goto('file:///' + path.resolve(__dirname, '..', 'docs', 'marketing', 'screens', 'iphone-preconsulta.html').replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await pageQ.waitForTimeout(400);
  await pageQ.screenshot({ path: path.join(__dirname, '..', 'docs', 'marketing', 'preview-iphone-preconsulta.png') });

  // Laptop
  const ctxL = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const pageL = await ctxL.newPage();
  await pageL.goto('file:///' + path.resolve(__dirname, '..', 'docs', 'marketing', 'screens', 'laptop-summary.html').replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await pageL.waitForTimeout(400);
  await pageL.screenshot({ path: path.join(__dirname, '..', 'docs', 'marketing', 'preview-laptop.png') });

  console.log('✓ done');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
