// Screenshot do card da calculadora apos o fix
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
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const card = await page.$('#calc');
  if (!card) { console.error('FATAL: #calc nao encontrado'); process.exit(1); }
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);

  // screenshot with some breathing room around the card
  const box = await card.boundingBox();
  await page.screenshot({
    path: path.join(__dirname, '..', 'docs', 'marketing', 'calc-card-fix-preview.png'),
    clip: {
      x: Math.max(0, box.x - 24),
      y: Math.max(0, box.y - 40),
      width: Math.min(1440, box.width + 48),
      height: box.height + 60
    }
  });
  console.log('saved: docs/marketing/calc-card-fix-preview.png');

  // also a full-card-only shot
  await card.screenshot({ path: path.join(__dirname, '..', 'docs', 'marketing', 'calc-card-fix-only.png') });
  console.log('saved: docs/marketing/calc-card-fix-only.png');

  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
