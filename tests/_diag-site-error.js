// Carrega o site local no Playwright, captura console + erros e dumpa o que falhou.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');

const server = http.createServer((req, res) => {
  const file = req.url === '/' ? '/site-oficial.html' : req.url;
  const p = path.join(__dirname, '..', file);
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end('404'); }
  const ext = path.extname(p);
  const mime = ext === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(p).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const consoleMsgs = [];
  const pageErrors = [];
  page.on('console', m => consoleMsgs.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', e => pageErrors.push({ message: e.message, stack: e.stack }));

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);

  console.log('=== CONSOLE MESSAGES ===');
  consoleMsgs.forEach(m => console.log(`[${m.type}]`, m.text.slice(0, 500)));
  console.log('\n=== PAGE ERRORS ===');
  pageErrors.forEach(e => console.log('!', e.message));

  // Check the bundler error sink
  const errDump = await page.evaluate(() => {
    const el = document.getElementById('__bundler_err');
    return el ? el.innerText.slice(0, 3000) : '(no __bundler_err element)';
  });
  console.log('\n=== __bundler_err DOM ===');
  console.log(errDump);

  // Check section presence
  const has = await page.evaluate(() => {
    return {
      vs7Wrap: !!document.querySelector('.vs7-wrap'),
      custoSection: !!document.querySelector('[data-screen-label="04 custo real"]'),
      grad: !!document.querySelector('.vs7-divider'),
      bodyTextSnippet: document.body.innerText.slice(0, 400)
    };
  });
  console.log('\n=== DOM CHECK ===');
  console.log(has);

  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
