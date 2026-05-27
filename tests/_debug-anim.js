const { chromium } = require('playwright');
const path = require('path');
const HTML = path.join(__dirname, '..', 'docs', 'marketing', 'videos', '_motion-box3-flow.html');

(async () => {
  const browser = await chromium.launch({ channel:'msedge', headless:true });
  const ctx = await browser.newContext({ viewport:{width:1280, height:720} });
  const page = await ctx.newPage();
  await page.goto('file:///' + HTML.replace(/\\/g,'/'), { waitUntil:'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  console.log('--- ANTES de .go ---');
  console.log(await page.evaluate(() => document.getAnimations().map(a => ({n:a.animationName, d:a.effect.getTiming().duration, ct:a.currentTime, ps:a.playState}))));
  await page.evaluate(() => document.body.classList.add('go'));
  await page.waitForTimeout(800);
  console.log('--- DEPOIS de 800ms (esperado 10% / 800ms) ---');
  console.log(await page.evaluate(() => document.getAnimations().slice(0,5).map(a => ({n:a.animationName, d:a.effect.getTiming().duration, ct:a.currentTime, ps:a.playState}))));
  await browser.close();
})();
