// Captura a seção 4 da Maia INTEIRA (fullPage da seção) pra ver o estilo
const { chromium } = require('playwright');
const path = require('path');
const https = require('https');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto('https://marketing.healthmaia.com/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Captura a seção 4 inteira (a "Tudo o que o consultório precisa")
  const sectionEl = await page.evaluate(() => {
    const h2s = [...document.querySelectorAll('h2')];
    const target = h2s.find(h => /consult.+rio precisa/i.test(h.textContent));
    if (!target) return null;
    const sec = target.closest('section');
    if (!sec) return null;
    sec.scrollIntoView({ block: 'start', behavior: 'instant' });
    return true;
  });
  if (!sectionEl) { console.log('secao não achada'); await browser.close(); return; }
  await page.waitForTimeout(1500);

  // Pega a section pelo locator e captura
  const section = page.locator('section').filter({ has: page.locator('h2', { hasText: /consult.+rio precisa/i }) }).first();
  const out = path.join(__dirname, '..', 'docs', 'marketing', '_maia-refs', 'secao-4-COMPLETA.png');
  await section.screenshot({ path: out });
  console.log('✓ secao 4 completa →', out);

  // Baixa os 5 webps mais relevantes pra ver o estilo
  const webps = [
    'transcricao-feature-v3.webp',
    'acompanhamento-v2.webp',
    'prontuario-base-v2.webp',
    'agenda-v2.webp',
    'receituario-v2.webp',
    'secretaria-v2.webp',
  ];
  for (const w of webps) {
    const url = 'https://marketing.healthmaia.com/assets/ui/' + w;
    const dest = path.join(__dirname, '..', 'docs', 'marketing', '_maia-refs', w);
    try {
      await new Promise((res, rej) => {
        const f = fs.createWriteStream(dest);
        https.get(url, r => { r.pipe(f); f.on('finish', () => { f.close(); res(); }); }).on('error', rej);
      });
      console.log('✓', w, '·', (fs.statSync(dest).size / 1024).toFixed(1), 'KB');
    } catch (e) { console.log('✗', w, e.message); }
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
