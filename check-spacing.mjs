import { chromium } from 'playwright';

const urls = [
  { name: 'paciente', url: 'https://vita-id-paciente-preview.vercel.app/' },
  { name: 'medico', url: 'https://vita-id-paciente-preview.vercel.app/medicos.html' },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, bypassCSP: true });

for (const { name, url } of urls) {
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('section.cta-final').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  const data = await page.evaluate(() => {
    const section = document.querySelector('section.cta-final');
    const eyebrow = section.querySelector('.eyebrow');
    const h2 = section.querySelector('h2');
    const lead = section.querySelector('p.lead');
    const form = section.querySelector('form');
    const er = eyebrow.getBoundingClientRect();
    const hr = h2.getBoundingClientRect();
    const fr = form.getBoundingClientRect();
    const lr = lead ? lead.getBoundingClientRect() : null;
    const h2Style = getComputedStyle(h2);
    const eyebrowStyle = getComputedStyle(eyebrow);
    return {
      eyebrow: { bottom: er.bottom, height: er.height, marginBottom: eyebrowStyle.marginBottom, fontSize: eyebrowStyle.fontSize },
      h2: { top: hr.top, height: hr.height, marginTop: h2Style.marginTop, fontSize: h2Style.fontSize, lineHeight: h2Style.lineHeight },
      lead: lr ? { top: lr.top, height: lr.height } : null,
      form: { top: fr.top, height: fr.height },
      gap_eyebrow_to_h2: hr.top - er.bottom,
      gap_h2_to_next: lr ? (lr.top - (hr.top + hr.height)) : (fr.top - (hr.top + hr.height)),
    };
  });

  console.log(`\n=== ${name.toUpperCase()} (${url}) ===`);
  console.log(JSON.stringify(data, null, 2));
  await page.screenshot({ path: `D:/tmp/deploy/cta-${name}.png`, fullPage: false, clip: { x: 0, y: 0, width: 1280, height: 900 } });
  await page.locator('section.cta-final').screenshot({ path: `D:/tmp/deploy/cta-section-${name}.png` });
  await page.close();
}

await browser.close();
console.log('\nDone. Screenshots saved to D:/tmp/deploy/cta-*.png');
