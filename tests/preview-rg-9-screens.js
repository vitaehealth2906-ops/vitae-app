const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const outDir = path.join(__dirname, 'shots', 'rg-9');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  const fileUrl = 'file:///' + path.resolve(__dirname, '..', 'app-v3', 'preview-rg-9-variacoes.html').replace(/\\/g, '/');
  console.log('Opening', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Full page screenshot
  await page.screenshot({ path: path.join(outDir, '00-fullpage.png'), fullPage: true });
  console.log('Saved fullpage');

  // Each card individually — find by section and screenshot the card-stage inside
  const sections = await page.locator('section.section').all();
  console.log('Sections found:', sections.length);
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    await sec.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const card = sec.locator('.card, .c-aurora-wrap, .c-quantum-wrap, .c-neuro-wrap').first();
    const n = String(i + 1).padStart(2, '0');
    await card.screenshot({ path: path.join(outDir, `${n}-card.png`) });
    console.log(`Saved card ${n}`);
  }

  await browser.close();
  console.log('Done. Screenshots at', outDir);
})().catch(e => { console.error(e); process.exit(1); });
