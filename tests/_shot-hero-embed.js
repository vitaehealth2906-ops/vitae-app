// Captura o hero "embed" (só devices, fundo transparente) — pra usar no site
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  // ViewPort um pouco mais alto pra dar espaço pros iPhones sairem por baixo do laptop
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const url = 'file:///' + path.resolve(__dirname, '..', 'docs', 'marketing', 'hero-vitaid-embed.html').replace(/\\/g, '/');
  console.log('opening', url);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Recorta exatamente o composite (ignora padding do stage)
  const box = await page.evaluate(() => {
    const el = document.querySelector('.composite');
    const r = el.getBoundingClientRect();
    // Adiciona margem pra incluir sombras + iPhones que ficam pra baixo
    return {
      x: Math.max(0, r.left - 60),
      y: Math.max(0, r.top - 30),
      width: r.width + 120,
      height: r.height + 100,
    };
  });

  const out = path.join(__dirname, '..', 'docs', 'marketing', 'hero-embed.png');
  await page.screenshot({
    path: out,
    omitBackground: true, // PNG transparente
    clip: box,
  });
  console.log('✓ saved transparent PNG →', out);
  console.log('  dimensões:', box.width, 'x', box.height);

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
