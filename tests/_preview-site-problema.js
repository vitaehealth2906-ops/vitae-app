const { chromium } = require('playwright');
const path = require('path');

const HTML = path.join(__dirname, '..', 'site-oficial.html');

(async () => {
  const browser = await chromium.launch({ channel:'msedge', headless:true });
  const ctx = await browser.newContext({ viewport:{width:1440, height:900} });
  const page = await ctx.newPage();
  await page.goto('file:///' + HTML.replace(/\\/g,'/'), { waitUntil:'networkidle', timeout:30000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const el = document.querySelector('[data-screen-label="02 problema"]');
    if (el) el.scrollIntoView({ block:'start' });
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(__dirname, '..', 'docs', 'marketing', 'videos', 'site-problema-preview.png'), fullPage:false });
  console.log('✓ site-problema-preview.png');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
