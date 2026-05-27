// Screenshot da se��o "Numa emerg�ncia" no vitaid-paciente.html
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const HTML = path.resolve('d:/tmp/vitaid-paciente.html');
  if (!fs.existsSync(HTML)) { console.error('FALTOU:', HTML); process.exit(1); }
  const url = 'file:///' + HTML.replace(/\\/g, '/');

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(800);

  // Localiza secao em-section
  const sec = await page.$('.em-section');
  if (!sec) { console.error('FALTOU .em-section'); await browser.close(); process.exit(1); }

  const outDir = path.resolve(__dirname, 'shots/_paciente-emergencia');
  fs.mkdirSync(outDir, { recursive: true });

  await sec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const full = path.join(outDir, 'paciente-emergencia-V07.png');
  await sec.screenshot({ path: full });
  console.log('OK:', full);

  // Tamanho mobile pra ver responsivo
  await page.setViewportSize({ width: 420, height: 900 });
  await sec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const mob = path.join(outDir, 'paciente-emergencia-V07-mobile.png');
  await sec.screenshot({ path: mob });
  console.log('OK:', mob);

  // Tamanho de errors
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  await page.waitForTimeout(200);
  if (errs.length) console.warn('AVISOS:', errs);

  await browser.close();
})();
