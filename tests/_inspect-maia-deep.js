/**
 * Inspeção DEEP: extrai TUDO de animação/CSS/JS da seção pilares da Maia.
 * Captura: keyframes, custom properties, transitions, JS de reveal/lightbox,
 * observers, easings, scroll behaviors.
 */
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('https://marketing.healthmaia.com/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // ───── 1. EXTRAI TODOS OS @KEYFRAMES E CSS RELEVANTE ─────
  const animationCSS = await page.evaluate(() => {
    const out = { keyframes: [], rulesRelevantes: [] };
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules || []) {
          // Keyframes
          if (rule.type === 7 /* @keyframes */) {
            out.keyframes.push({
              name: rule.name,
              text: rule.cssText,
            });
          }
          // Regras que mencionam reveal, stagger, pillar, show-card, badge, dot, mock, lightbox
          if (rule.cssText && /reveal|stagger|pillar|show-card|show-mock|badge|\.dot|lightbox|zoom-hint|\.in\b|\.is-in\b|cubic-bezier/i.test(rule.cssText)) {
            out.rulesRelevantes.push(rule.cssText.slice(0, 600));
          }
        }
      } catch (e) { /* CORS */ }
    }
    return out;
  });

  // ───── 2. EXTRAI JS INLINE QUE TRATA SCROLL/OBSERVER/REVEAL ─────
  const inlineJS = await page.evaluate(() => {
    const scripts = [...document.querySelectorAll('script:not([src])')];
    return scripts.map(s => s.textContent).filter(t => t && /IntersectionObserver|reveal|stagger|scroll|requestAnimationFrame|lightbox|zoom/i.test(t)).map(t => t.slice(0, 4000));
  });

  // ───── 3. EXTRAI HREFS DOS SCRIPTS EXTERNOS PRA INSPEÇÃO ─────
  const externalScripts = await page.evaluate(() => {
    return [...document.querySelectorAll('script[src]')].map(s => s.src).filter(s => !s.includes('gtag') && !s.includes('google'));
  });

  // ───── 4. ESTADOS DE TRANSITION REAL DOS CARDS (antes vs depois de scroll) ─────
  const cardStates = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.show-card')].slice(0, 3);
    return cards.map(c => {
      const s = window.getComputedStyle(c);
      return {
        classes: c.className,
        transition: s.transition,
        transform: s.transform,
        opacity: s.opacity,
        boxShadow: s.boxShadow,
        // Cores dos badges/dots/cores dos cards
      };
    });
  });

  // ───── 5. DETECTA HOVER NOS CARDS (simula hover, mede transform/shadow) ─────
  const hoverStates = await page.evaluate(async () => {
    const cards = [...document.querySelectorAll('.show-card')].slice(0, 1);
    if (!cards.length) return null;
    const c = cards[0];
    // Aplica hover via dispatchEvent
    c.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    c.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
    const s = window.getComputedStyle(c);
    return {
      transform: s.transform,
      boxShadow: s.boxShadow,
    };
  });

  // ───── 6. DETECTA EFEITOS GLOBAIS — scroll smooth, easings custom ─────
  const globalEffects = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    return {
      scrollBehavior: window.getComputedStyle(html).scrollBehavior,
      htmlClasses: html.className,
      bodyClasses: body.className,
      hasReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  });

  // ───── 7. CONTAGEM DE OBSERVERS / RAFS / EVENT LISTENERS ─────
  const rafCount = await page.evaluate(() => {
    // Tenta detectar se há scroll listener no window
    let scrollHandlers = 0;
    const origAdd = window.addEventListener;
    return {
      // Aproximação — quanto mais .reveal elements, mais observers ele tem
      revealElements: document.querySelectorAll('.reveal, [data-stagger], [data-aos], [data-scroll]').length,
      svgInline: document.querySelectorAll('svg').length,
      imagesLazy: document.querySelectorAll('img[loading="lazy"], img[data-lazy-src]').length,
    };
  });

  // ───── 8. SCROLL & RE-CAPTURA: força reveal de cards (rola até a seção) ─────
  await page.evaluate(() => {
    const target = [...document.querySelectorAll('h2,h3')].find(h => /prontu.*faz mais por voc/i.test(h.textContent));
    if (target) target.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await page.waitForTimeout(800);

  const cardStatesAfterScroll = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.show-card')].slice(0, 3);
    return cards.map(c => {
      const s = window.getComputedStyle(c);
      return {
        classes: c.className,
        transform: s.transform,
        opacity: s.opacity,
      };
    });
  });

  // ───── 9. GIF DE REFERÊNCIA: tenta baixar URL ─────
  const gifUrls = await page.evaluate(() => {
    return [...document.querySelectorAll('img[data-lazy-src*=".gif"], img[src*=".gif"], button[data-zoom*=".gif"]')]
      .map(el => el.getAttribute('data-zoom') || el.getAttribute('data-lazy-src') || el.src);
  });

  // ───── DUMP FINAL ─────
  const report = {
    animationCSS,
    inlineJS_count: inlineJS.length,
    inlineJS_samples: inlineJS.slice(0, 3),
    externalScripts,
    cardStates,
    hoverStates,
    globalEffects,
    rafCount,
    cardStatesAfterScroll,
    gifUrls,
  };

  fs.writeFileSync('tests/_maia-deep-report.json', JSON.stringify(report, null, 2));
  console.log('✓ relatório salvo em tests/_maia-deep-report.json');
  console.log('\n=== RESUMO ===');
  console.log('Keyframes encontrados:', animationCSS.keyframes.length);
  console.log('Regras CSS relevantes:', animationCSS.rulesRelevantes.length);
  console.log('Scripts inline com animação:', inlineJS.length);
  console.log('Scripts externos:', externalScripts.length);
  console.log('Elements com .reveal/data-stagger:', rafCount.revealElements);
  console.log('GIFs encontrados:', gifUrls);

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
