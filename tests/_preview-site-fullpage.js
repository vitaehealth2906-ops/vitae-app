const { chromium } = require('playwright');
const path = require('path');

const HTML = path.join(__dirname, '..', 'site-oficial.html');

(async () => {
  const browser = await chromium.launch({ channel:'msedge', headless:true });
  const ctx = await browser.newContext({ viewport:{width:1440, height:900} });
  const page = await ctx.newPage();
  await page.goto('file:///' + HTML.replace(/\\/g,'/'), { waitUntil:'networkidle', timeout:30000 });
  await page.waitForTimeout(2000);
  // Tira print de cada seção
  const sections = ['01 hero médico','02 problema','03 solução','04 custo real','06 faq','07 cta'];
  for (const s of sections) {
    const found = await page.evaluate((label) => {
      const el = document.querySelector(`[data-screen-label="${label}"]`);
      if (!el) return false;
      el.scrollIntoView({ block:'start' });
      return true;
    }, s);
    if (!found) { console.log('⚠ não encontrou', s); continue; }
    await page.waitForTimeout(1000);
    const safe = s.replace(/\s+/g,'-');
    await page.screenshot({ path: path.join(__dirname, '..', 'docs', 'marketing', 'videos', 'site-preview-' + safe + '.png'), fullPage:false });
    console.log('✓', s);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
