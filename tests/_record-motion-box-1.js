/**
 * Grava a cena animada da Box 1 em vídeo (WebM via Playwright)
 * Depois converte pra MP4 H.264 via ffmpeg do Playwright.
 * Output: docs/marketing/videos/box-1.webm + box-1.mp4
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const HTML = path.join(__dirname, '..', 'docs', 'marketing', 'videos', '_motion-box-1.html');
const OUT_DIR = path.join(__dirname, '..', 'docs', 'marketing', 'videos');
const FFMPEG = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'ffmpeg-1011', 'ffmpeg-win64.exe');

const VIDEO_W = 1280;
const VIDEO_H = 720;
const DURATION_MS = 8200; // 0.2s de buffer pra animação terminar

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const ctx = await browser.newContext({
    viewport: { width: VIDEO_W, height: VIDEO_H },
    deviceScaleFactor: 1, // Playwright recordVideo já é pixel-perfect
    recordVideo: { dir: OUT_DIR, size: { width: VIDEO_W, height: VIDEO_H } },
  });

  const page = await ctx.newPage();
  const url = 'file:///' + HTML.replace(/\\/g, '/');
  console.log('→ navegando', url);
  await page.goto(url, { waitUntil: 'networkidle' });
  // Aguarda fontes
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);

  // Re-inicia animação injetando flag (CSS animations já começam no load — então só espera)
  console.log('→ gravando', DURATION_MS, 'ms...');
  await page.waitForTimeout(DURATION_MS);

  const video = page.video();
  await page.close();
  await ctx.close();
  await browser.close();

  const webmPath = await video.path();
  const webmFinal = path.join(OUT_DIR, 'box-1.webm');
  fs.renameSync(webmPath, webmFinal);
  console.log('✓ WebM salvo:', webmFinal, '·', (fs.statSync(webmFinal).size / 1024).toFixed(1), 'KB');

  // Conversão WebM → MP4 H.264
  if (fs.existsSync(FFMPEG)) {
    const mp4Final = path.join(OUT_DIR, 'box-1.mp4');
    console.log('→ convertendo pra MP4 com', FFMPEG);
    const r = spawnSync(FFMPEG, [
      '-y',
      '-i', webmFinal,
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', '22',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      mp4Final,
    ], { stdio: 'inherit' });
    if (r.status === 0) {
      console.log('✓ MP4 salvo:', mp4Final, '·', (fs.statSync(mp4Final).size / 1024).toFixed(1), 'KB');
    } else {
      console.warn('✗ ffmpeg falhou. WebM fica como fallback.');
    }
  } else {
    console.warn('⚠ ffmpeg não encontrado em', FFMPEG, '— deixando só WebM');
  }
})().catch(e => { console.error('✗', e.message); process.exit(1); });
