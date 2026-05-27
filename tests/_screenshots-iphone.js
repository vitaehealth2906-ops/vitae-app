// Gera screenshots das 4 telas em viewport iPhone 15 Pro real
// Salva em tests/shots-22mai/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const outDir = path.join(__dirname, 'shots-22mai');
  fs.mkdirSync(outDir, { recursive: true });

  const tmp = require('os').tmpdir() + '/pw-shot-' + Date.now();
  const ctx = await chromium.launchPersistentContext(tmp, {
    channel: 'msedge',
    headless: true,
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('vitae_token', 'mock');
    localStorage.setItem('vitae_usuario', JSON.stringify({id:'mock',nome:'TESTE'}));
    localStorage.setItem('vitae_perfil_saude', JSON.stringify({tipoSanguineo:'O_POS', dataNascimento:'2007-03-14'}));
  });

  const telas = [
    { f: '01-saude.html', n: '1-meu-rg' },
    { f: '09-exames-lista.html', n: '2-exames' },
    { f: '12-qr-code.html', n: '3-qr-code' },
    { f: '15-consultas.html', n: '4-consultas' },
  ];

  for (const t of telas) {
    await page.goto('https://vitae-app.vercel.app/app-v3/' + t.f + '?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const file = path.join(outDir, t.n + '.png');
    await page.screenshot({ path: file, fullPage: false });
    console.log('✓', t.n, '→', file);
  }

  // E gera 1 combo lado a lado pra Lucas conferir
  await ctx.close();
})().catch(e => { console.error(e); process.exit(1); });
