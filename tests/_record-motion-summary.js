/**
 * Grava o motion summary flow (8.2s) em WebM
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const HTML = path.join(__dirname, '..', 'docs', 'marketing', 'videos', '_motion-summary-flow.html');
const OUT_DIR = path.join(__dirname, '..', 'docs', 'marketing', 'videos');
const VIDEO_W = 1280;
const VIDEO_H = 720;
const DURATION_MS = 8200;

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({
    viewport: { width: VIDEO_W, height: VIDEO_H },
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT_DIR, size: { width: VIDEO_W, height: VIDEO_H } },
  });
  const page = await ctx.newPage();
  const url = 'file:///' + HTML.replace(/\\/g, '/');
  console.log('→', url);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  console.log('→ gravando', DURATION_MS, 'ms...');
  await page.waitForTimeout(DURATION_MS);
  const video = page.video();
  await page.close();
  await ctx.close();
  await browser.close();
  const webm = await video.path();
  const final = path.join(OUT_DIR, 'flow-summary.webm');
  fs.renameSync(webm, final);
  console.log('✓', final, '·', (fs.statSync(final).size / 1024).toFixed(1), 'KB');
})().catch(e => { console.error(e); process.exit(1); });
