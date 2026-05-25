/**
 * Inspeciona a seção de funcionalidades do site da Maia.
 * Pega: HTML estrutural, classes, computed styles dos cards, listeners de scroll/animação.
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('https://marketing.healthmaia.com/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Procura por seção que contenha "TRÊS PILARES" ou "prontuário que faz"
  const section = await page.evaluate(() => {
    // Acha a seção pelo headline
    const headings = [...document.querySelectorAll('h1,h2,h3')];
    const target = headings.find(h => /pilares|prontu.{1,3}rio que faz/i.test(h.textContent));
    if (!target) return null;
    let el = target;
    // Sobe pra seção/container
    while (el && el.tagName !== 'SECTION' && el.parentElement && el.parentElement.tagName !== 'BODY') {
      el = el.parentElement;
      if (el.classList.contains('section') || el.tagName === 'SECTION') break;
    }
    return {
      tag: el.tagName,
      classes: el.className,
      id: el.id,
      html: el.outerHTML.slice(0, 10000), // primeiros 10k chars
    };
  });

  console.log('=== SECTION ===');
  console.log(JSON.stringify(section, null, 2).slice(0, 8000));

  // Computed styles dos cards
  const cards = await page.evaluate(() => {
    const headings = [...document.querySelectorAll('h1,h2,h3')];
    const target = headings.find(h => /pilares|prontu.{1,3}rio que faz/i.test(h.textContent));
    if (!target) return [];
    let section = target.closest('section') || target.parentElement;
    const cards = [...section.querySelectorAll('article, [class*="card"], [class*="pillar"], [class*="feature"]')].slice(0, 4);
    return cards.map(c => {
      const s = window.getComputedStyle(c);
      const rect = c.getBoundingClientRect();
      return {
        tag: c.tagName,
        classes: c.className,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        bg: s.backgroundColor,
        borderRadius: s.borderRadius,
        boxShadow: s.boxShadow.slice(0, 200),
        padding: s.padding,
        transition: s.transition.slice(0, 200),
        transform: s.transform,
      };
    });
  });

  console.log('\n=== CARDS (computed styles) ===');
  console.log(JSON.stringify(cards, null, 2));

  // Detecta libs de animação (AOS, GSAP, framer, scroll-trigger, intersection observer)
  const libs = await page.evaluate(() => {
    return {
      AOS: typeof window.AOS !== 'undefined',
      GSAP: typeof window.gsap !== 'undefined',
      ScrollTrigger: typeof window.ScrollTrigger !== 'undefined',
      Lenis: typeof window.Lenis !== 'undefined',
      Framer: typeof window.framer !== 'undefined',
      observers_count_estimate: document.querySelectorAll('[data-aos],[data-scroll],[data-animate]').length,
      images_total: document.querySelectorAll('img').length,
      svgs_total: document.querySelectorAll('svg').length,
    };
  });
  console.log('\n=== LIBS DETECTADAS ===');
  console.log(JSON.stringify(libs, null, 2));

  // Screenshot da seção pra referencia visual
  try {
    const handle = await page.locator('section').filter({ hasText: /prontu.{1,3}rio que faz mais/i }).first();
    await handle.screenshot({ path: 'docs/marketing/_ref-maia-pilares.png' });
    console.log('\n✓ screenshot da seção salvo em docs/marketing/_ref-maia-pilares.png');
  } catch(e) { console.log('screenshot falhou:', e.message); }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
