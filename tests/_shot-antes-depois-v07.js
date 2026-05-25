// Tira screenshot da nova seção antes/depois (V07) no site-oficial local.
// Serve o arquivo via http server interno (file:// nao roda bem) e captura.
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');

const SITE = path.join(__dirname, '..', 'site-oficial.html');
const OUT = path.join(__dirname, '..', 'docs', 'marketing', 'site-antes-depois-v07-preview.png');

// micro static server
const server = http.createServer((req, res) => {
  let file = req.url === '/' ? '/site-oficial.html' : req.url;
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
  console.log('serving on', url);

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  console.log('goto site...');
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  // Find the antes/depois section
  const section = await page.$('section[data-screen-label="04 custo real"]');
  if (!section) {
    console.log('FATAL: section not found in DOM');
    console.log('first 2000 chars of body:', (await page.content()).slice(0, 2000));
    process.exit(1);
  }
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await section.screenshot({ path: OUT });
  console.log('screenshot saved:', OUT);

  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
