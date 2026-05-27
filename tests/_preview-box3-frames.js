/**
 * Captura frames do motion box 3 em momentos-chave pra validar visualmente
 */
const { chromium } = require('playwright');
const path = require('path');

const HTML = path.join(__dirname, '..', 'docs', 'marketing', 'videos', '_motion-box3-flow.html');
const OUT_DIR = path.join(__dirname, '..', 'docs', 'marketing', 'videos');

(async () => {
  const browser = await chromium.launch({ channel:'msedge', headless:true });
  const ctx = await browser.newContext({ viewport:{width:1280, height:720} });
  const url = 'file:///' + HTML.replace(/\\/g, '/');

  const moments = [
    { t:  700, name: 'box3-frame-1-btn-exportar' },
    { t: 1300, name: 'box3-frame-2-clicando-exportar' },
    { t: 2400, name: 'box3-frame-3-popup' },
    { t: 3400, name: 'box3-frame-4-popup-cursor' },
    { t: 3700, name: 'box3-frame-5-check-verificado' },
    { t: 5000, name: 'box3-frame-6-btn-marcar' },
    { t: 5800, name: 'box3-frame-7-aguardando' },
    { t: 6800, name: 'box3-frame-8-aguardando-pisca' },
    { t: 7700, name: 'box3-frame-9-iphone' },
    { t: 8400, name: 'box3-frame-10-finger' },
  ];

  for (const m of moments) {
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.evaluate(() => document.body.classList.add('go'));
    await page.waitForTimeout(m.t);
    await page.screenshot({ path: path.join(OUT_DIR, m.name + '.png'), clip:{x:0,y:0,width:1280,height:720} });
    console.log('✓', m.name);
    await page.close();
  }
  await ctx.close();
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
