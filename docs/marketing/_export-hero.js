// Renderiza hero-vitaid.html?clean e exporta a composicao como PNG 100% transparente.
// Usa page.screenshot com clip calculado a partir do bounding box real
// dos elementos + padding pras sombras (assim nada fica cortado).
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({
    viewport: { width: 2200, height: 1500 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  const fileUrl = 'file:///' + path.resolve(__dirname, 'hero-vitaid.html').replace(/\\/g, '/') + '?clean';
  console.log('Abrindo:', fileUrl);

  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);

  // Calcula bounding box que contem TODOS os filhos da composicao
  // (laptop, phone, rgonix) + padding generoso pras drop-shadows
  const SHADOW_PAD = 80;
  const clip = await page.evaluate((pad) => {
    const els = document.querySelectorAll('.composite > *');
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    els.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      minX = Math.min(minX, r.left);
      minY = Math.min(minY, r.top);
      maxX = Math.max(maxX, r.right);
      maxY = Math.max(maxY, r.bottom);
    });
    return {
      x: Math.max(0, minX - pad),
      y: Math.max(0, minY - pad),
      width: (maxX - minX) + (pad * 2),
      height: (maxY - minY) + (pad * 2),
    };
  }, SHADOW_PAD);

  console.log('Clip:', clip);

  const out = path.resolve(__dirname, 'hero-export.png');
  await page.screenshot({
    path: out,
    clip,
    omitBackground: true,
    scale: 'device',
  });

  console.log('PNG salvo:', out);
  console.log('Tamanho:', (fs.statSync(out).size / 1024).toFixed(1), 'KB');

  await browser.close();
})();
