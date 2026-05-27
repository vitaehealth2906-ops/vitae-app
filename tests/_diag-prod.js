// Carrega o site EM PRODUÇÃO (Vercel) e captura erros
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const consoleMsgs = [];
  const pageErrors = [];
  const failedReqs = [];
  page.on('console', m => consoleMsgs.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', e => pageErrors.push({ message: e.message }));
  page.on('requestfailed', r => failedReqs.push({ url: r.url(), reason: r.failure()?.errorText }));
  page.on('response', r => { if (r.status() >= 400) failedReqs.push({ url: r.url(), status: r.status() }); });

  console.log('Loading https://vitae-app.vercel.app/site-oficial.html ...');
  await page.goto('https://vitae-app.vercel.app/site-oficial.html', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(3000);

  console.log('\n=== CONSOLE MESSAGES (' + consoleMsgs.length + ') ===');
  consoleMsgs.slice(0, 30).forEach(m => console.log(`[${m.type}]`, m.text.slice(0, 400)));

  console.log('\n=== PAGE ERRORS (' + pageErrors.length + ') ===');
  pageErrors.forEach(e => console.log('!', e.message.slice(0, 500)));

  console.log('\n=== FAILED REQUESTS / 4xx-5xx (' + failedReqs.length + ') ===');
  failedReqs.slice(0, 30).forEach(r => console.log('×', r.status || r.reason, '->', r.url.slice(0, 200)));

  const errDump = await page.evaluate(() => {
    const el = document.getElementById('__bundler_err');
    return el ? el.innerText : null;
  });
  console.log('\n=== __bundler_err DOM ===');
  console.log(errDump || '(no __bundler_err element)');

  const has = await page.evaluate(() => ({
    vs7Wrap: !!document.querySelector('.vs7-wrap'),
    custoSection: !!document.querySelector('[data-screen-label="04 custo real"]'),
    sectionsCount: document.querySelectorAll('section').length,
    imagesBroken: Array.from(document.querySelectorAll('img')).filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src.slice(0, 100)).slice(0, 10)
  }));
  console.log('\n=== DOM CHECK ===');
  console.log(has);

  await page.screenshot({ path: 'docs/marketing/_diag-prod-full.png', fullPage: true });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
