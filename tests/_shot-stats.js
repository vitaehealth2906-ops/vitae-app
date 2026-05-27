// Print da seção de stats do hero pra confirmar troca
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const url = 'file:///' + path.resolve(__dirname, '..', 'site-oficial.html').replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Rola até onde aparece "perdidos por consulta"
  const box = await page.evaluate(() => {
    const wrapper = document.querySelector('.hero-stats');
    if (!wrapper) return null;
    wrapper.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = wrapper.getBoundingClientRect();
    return { x: Math.max(0, r.left - 20), y: Math.max(0, r.top - 20), width: Math.min(1440, r.width + 40), height: Math.min(900, r.height + 40) };
  });
  await page.waitForTimeout(400);

  const out = path.join(__dirname, '..', 'docs', 'marketing', 'stats-preview.png');
  if (box) await page.screenshot({ path: out, clip: box });
  else await page.screenshot({ path: out });
  console.log('✓ saved →', out);

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
