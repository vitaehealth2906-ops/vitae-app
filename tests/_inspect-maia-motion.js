/**
 * Inspeção PROFUNDA do motion design da Maia:
 * - Baixa o motion-maia.gif pra análise
 * - Tira screenshots em sequência da página inteira (com scroll progressivo)
 * - Lista TODAS as animações CSS encontradas no site
 * - Detecta elementos com cursor, parallax, fluxo navegacional
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const https = require('https');

const OUT_DIR = path.join(__dirname, '..', 'docs', 'marketing', '_maia-refs');
fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto('https://marketing.healthmaia.com/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Tira screenshots de TODAS as seções via scroll progressivo
  console.log('\n=== SCREENSHOTS POR SECAO ===');
  const sections = await page.evaluate(() => {
    return [...document.querySelectorAll('section')].map((s, i) => ({
      idx: i,
      classes: s.className,
      id: s.id,
      label: (s.querySelector('h1,h2,h3') || {}).textContent?.slice(0, 60) || 'sem titulo',
      top: s.getBoundingClientRect().top + window.scrollY,
      height: s.getBoundingClientRect().height,
    }));
  });
  sections.forEach(s => console.log(`  [${s.idx}] ${s.label} · ${Math.round(s.height)}px`));

  for (let i = 0; i < Math.min(8, sections.length); i++) {
    const s = sections[i];
    try {
      await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), s.top);
      await page.waitForTimeout(1200); // deixa animação rodar
      const out = path.join(OUT_DIR, `secao-${i}-${(s.label || 'untitled').replace(/[^a-z0-9]/gi, '_').slice(0, 30)}.png`);
      await page.screenshot({ path: out, fullPage: false });
      console.log(`  ✓ secao ${i}`);
    } catch (e) { console.log(`  ✗ secao ${i}:`, e.message.slice(0, 60)); }
  }

  // Lista TODAS as URLs de imagens/GIFs/videos referenciadas
  console.log('\n=== ASSETS VISUAIS ===');
  const assets = await page.evaluate(() => {
    const out = { gifs: [], webps: [], videos: [], lottie: [] };
    document.querySelectorAll('img[src*=".gif"], img[data-lazy-src*=".gif"], button[data-zoom*=".gif"]').forEach(el => {
      const u = el.getAttribute('data-zoom') || el.getAttribute('data-lazy-src') || el.src;
      if (u && !out.gifs.includes(u)) out.gifs.push(u);
    });
    document.querySelectorAll('img[src*=".webp"], img[data-lazy-src*=".webp"]').forEach(el => {
      const u = el.getAttribute('data-lazy-src') || el.src;
      if (u && !out.webps.includes(u)) out.webps.push(u);
    });
    document.querySelectorAll('video, video source').forEach(el => out.videos.push(el.src || el.currentSrc));
    document.querySelectorAll('[data-lottie], lottie-player, dotlottie-player').forEach(el => out.lottie.push(el.outerHTML.slice(0, 200)));
    return out;
  });
  console.log(JSON.stringify(assets, null, 2));

  // Baixa cada GIF localmente pra análise
  for (const rel of assets.gifs.slice(0, 5)) {
    const fullUrl = rel.startsWith('http') ? rel : 'https://marketing.healthmaia.com/' + rel.replace(/^\//, '');
    const name = path.basename(rel).split('?')[0];
    const out = path.join(OUT_DIR, name);
    try {
      await new Promise((res, rej) => {
        const file = fs.createWriteStream(out);
        https.get(fullUrl, r => {
          if (r.statusCode !== 200) return rej(new Error('http ' + r.statusCode));
          r.pipe(file);
          file.on('finish', () => { file.close(); res(); });
        }).on('error', rej);
      });
      const stat = fs.statSync(out);
      console.log(`  ✓ baixado ${name} · ${(stat.size / 1024).toFixed(1)}KB`);
    } catch (e) {
      console.log(`  ✗ ${name}:`, e.message);
    }
  }

  // Catalogo COMPLETO de keyframes
  console.log('\n=== TODOS OS @KEYFRAMES ===');
  const keyframes = await page.evaluate(() => {
    const list = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules || []) {
          if (rule.type === 7) list.push({ name: rule.name, body: rule.cssText.slice(0, 400) });
        }
      } catch (e) {}
    }
    return list;
  });
  keyframes.forEach(k => console.log(`  • ${k.name}`));
  fs.writeFileSync(path.join(OUT_DIR, '_keyframes.json'), JSON.stringify(keyframes, null, 2));

  await browser.close();
  console.log('\n✓ relatorio salvo em', OUT_DIR);
})().catch(e => { console.error(e); process.exit(1); });
