/**
 * Grava o motion flow "médico cria → paciente recebe" em WebM
 * Duração: 12.2s (200ms buffer pra animação finalizar)
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const HTML = path.join(__dirname, '..', 'docs', 'marketing', 'videos', '_motion-pre-consulta-flow.html');
const OUT_DIR = path.join(__dirname, '..', 'docs', 'marketing', 'videos');

const VIDEO_W = 1280;
const VIDEO_H = 720;
const DURATION_MS = 12200;

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const ctx = await browser.newContext({
    viewport: { width: VIDEO_W, height: VIDEO_H },
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT_DIR, size: { width: VIDEO_W, height: VIDEO_H } },
  });

  const page = await ctx.newPage();
  const url = 'file:///' + HTML.replace(/\\/g, '/');
  console.log('→ navegando', url);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);

  console.log('→ gravando', DURATION_MS, 'ms...');
  await page.waitForTimeout(DURATION_MS);

  const video = page.video();
  await page.close();
  await ctx.close();
  await browser.close();

  const webmPath = await video.path();
  const final = path.join(OUT_DIR, 'flow-pre-consulta.webm');
  fs.renameSync(webmPath, final);
  console.log('✓ WebM salvo:', final, '·', (fs.statSync(final).size / 1024).toFixed(1), 'KB');
})().catch(e => { console.error('✗', e.message); process.exit(1); });
