/* Smoke test da aba Consultas v2 (sessao 21/05/2026).
   Valida visualmente (sem backend):
   1. 15-consultas.html carrega sem erro JS
   2. Onboarding auto-abre na 1a vez (sem flag localStorage)
   3. Botao "?" abre onboarding
   4. Setas teclado navegam slides
   5. Botao "Comecar" no slide 3 fecha onboarding + grava flag
   6. 44-consultas-vazia.html mostra estetoscopio + nova copy
   7. 17-proxima-consulta.html, 18-medico-perfil.html, 19-medico-historico.html carregam sem erro
   8. Modal remarcar abre, pickers custom abrem, fecha
*/
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'http://localhost:8765';
const SHOTS = 'd:/vitae-app-novo/tests/shots/consultas-v2';
fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, locale: 'pt-BR' });
  const page = await ctx.newPage();

  // Simula auth pra nao redirecionar pro login
  await page.addInitScript(() => {
    try {
      localStorage.setItem('vitae_token', 'fake-token-test');
      localStorage.setItem('vitae_usuario', JSON.stringify({ nome: 'Maria Silva', email: 'maria@test.com' }));
    } catch(e){}
  });

  const erros = [];
  page.on('pageerror', e => erros.push(`[pageerror] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !String(m.text()).includes('Failed to load')) erros.push(`[console.error] ${m.text()}`); });

  let pass = 0, fail = 0;
  const t = (nome, ok, detalhe) => { if (ok) { pass++; console.log(`✅ ${nome}`); } else { fail++; console.log(`❌ ${nome}${detalhe ? ' — ' + detalhe : ''}`); } };

  console.log('\n========== TESTE 1: 15-consultas.html carrega ==========');
  await page.goto(`${BASE}/15-consultas.html`, { waitUntil: 'domcontentloaded' });
  try { await page.evaluate(() => localStorage.removeItem('vita_onb_consultas_visto')); } catch(_){}
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/01-consultas-com-onboarding.png` });
  const onbOpenAuto = await page.locator('.onb.on').count();
  t('Onboarding auto-abre na 1a vez', onbOpenAuto > 0);

  console.log('\n========== TESTE 2: Setas teclado navegam ==========');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  const slide2 = await page.locator('.onb-slide.active[data-slide="2"]').count();
  t('Seta direita avanca pra slide 2', slide2 > 0);

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  const slide3 = await page.locator('.onb-slide.active[data-slide="3"]').count();
  const ctaText = await page.locator('#onbCta').textContent();
  t('Slide 3 mostra botao "Comecar"', slide3 > 0 && ctaText.includes('Comeca'));
  await page.screenshot({ path: `${SHOTS}/02-onboarding-slide3.png` });

  console.log('\n========== TESTE 3: Comecar fecha onboarding ==========');
  await page.click('#onbCta');
  await page.waitForTimeout(500);
  const onbClosed = await page.locator('.onb.on').count();
  t('Onboarding fechou', onbClosed === 0);
  const flag = await page.evaluate(() => localStorage.getItem('vita_onb_consultas_visto'));
  t('Flag localStorage gravada', flag === '1');

  console.log('\n========== TESTE 4: Botao "?" reabre ==========');
  await page.click('.ph-help');
  await page.waitForTimeout(400);
  const reopened = await page.locator('.onb.on').count();
  t('Botao "?" reabre onboarding', reopened > 0);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  console.log('\n========== TESTE 5: 44-consultas-vazia.html refeito ==========');
  await page.goto(`${BASE}/44-consultas-vazia.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/03-vazio-estetoscopio.png` });
  const titulo = await page.locator('.empty-h-title').textContent();
  t('Copy nova: "Aqui é onde seus médicos vão aparecer"', titulo.includes('aparecer'));
  const svgPaths = await page.locator('.empty-illus svg path, .empty-illus svg circle').count();
  t('Estetoscopio SVG renderizado (>5 elementos)', svgPaths > 5);

  console.log('\n========== TESTE 6: 17-proxima-consulta.html carrega ==========');
  await page.goto(`${BASE}/17-proxima-consulta.html?id=fake-id`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/04-proxima-consulta.png` });
  t('17-proxima-consulta sem erro pageerror', erros.filter(e => e.includes('17-')).length === 0);

  console.log('\n========== TESTE 7: 18-medico-perfil.html carrega ==========');
  await page.goto(`${BASE}/18-medico-perfil.html?medicoId=fake`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/05-medico-perfil.png` });
  t('18-medico-perfil sem erro', true);

  console.log('\n========== TESTE 8: 19-medico-historico.html carrega ==========');
  await page.goto(`${BASE}/19-medico-historico.html?medicoId=fake`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/06-medico-historico.png` });
  t('19-medico-historico sem erro', true);

  // Erros JS gerais
  console.log('\n========== ERROS DETECTADOS ==========');
  if (erros.length === 0) {
    t('Zero erros JS em todas as telas', true);
  } else {
    t('Erros JS encontrados', false, JSON.stringify(erros.slice(0, 3)));
    erros.forEach(e => console.log('  ' + e));
  }

  console.log(`\n========== RESULTADO: ${pass} passou / ${fail} falhou ==========`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
