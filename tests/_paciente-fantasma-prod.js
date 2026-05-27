/**
 * Paciente fantasma PRODUCAO — variante do robo que aponta direto pra
 * https://app.vitaidsaude.com em vez de localhost. Usado pra confirmar
 * pos-deploy que a correcao funciona na infraestrutura real do paciente.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// app.vitaidsaude.com tem cert invalido — usamos rota Vercel direta (mesma infra)
const BASE = 'https://vitae-app.vercel.app/app-v3';
const FOTO_PATH = path.resolve(__dirname, 'fixtures/paciente-foto.jpg');
const TIMESTAMP = Date.now();
const EMAIL_TESTE = `robo-prod-${TIMESTAMP}@vitae-teste.local`;
const CELULAR_TESTE = '+5511' + String(900000000 + Math.floor(Math.random()*99999999)).slice(0,9);
const SENHA_TESTE = 'TesteRobo2026!';
const SCREENSHOT_DIR = path.resolve(__dirname, '_screenshots-fantasma');

function gerarCPF() {
  const rnd = () => Math.floor(Math.random()*9);
  const d = Array.from({length:9}, rnd);
  let s = 0; for (let i=0;i<9;i++) s += d[i]*(10-i);
  let dv1 = 11 - (s%11); if (dv1>=10) dv1=0;
  d.push(dv1);
  s = 0; for (let i=0;i<10;i++) s += d[i]*(11-i);
  let dv2 = 11 - (s%11); if (dv2>=10) dv2=0;
  d.push(dv2);
  return d.join('');
}
const CPF_TESTE = gerarCPF();

async function executar() {
  console.log('═════════════════════════════════════════════════════════');
  console.log('PACIENTE FANTASMA — PRODUCAO REAL (app.vitaidsaude.com)');
  console.log('═════════════════════════════════════════════════════════');
  console.log('Email:   ', EMAIL_TESTE);
  console.log('Celular: ', CELULAR_TESTE);
  console.log('CPF:     ', CPF_TESTE);
  console.log('---------------------------------------------------------');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 900 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const page = await ctx.newPage();

  await page.addInitScript(() => {
    localStorage.setItem('vitae_onb_quiz_visto', '1');
    localStorage.setItem('vitae_tipo_escolhido', 'PACIENTE');
  });

  const consoleMsgs = [], pageErrors = [], failedReqs = [], networkOps = [];
  page.on('console', m => consoleMsgs.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', e => pageErrors.push({ message: e.message }));
  page.on('requestfailed', r => failedReqs.push({ url: r.url(), reason: r.failure()?.errorText }));
  page.on('response', r => {
    if (r.url().includes('/perfil') || r.url().includes('/auth') || r.url().includes('/consentimento')) {
      networkOps.push({ url: r.url(), status: r.status(), method: r.request().method() });
    }
  });

  const metricas = { passos: {}, tempoTotal: 0 };
  try {
    console.log('[1/3] Cadastro...');
    await page.goto(`${BASE}/26-cadastro.html`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('.field-input', { timeout: 15000 });
    const inputs = await page.locator('.field-input').all();
    await inputs[0].fill('Maria Teste Prod');
    await inputs[1].fill(CELULAR_TESTE.replace('+55',''));
    await inputs[2].fill(EMAIL_TESTE);
    await page.locator('#passInput').fill(SENHA_TESTE);
    await page.locator('#termsCheck').click();
    await page.locator('#btnCreate').click();
    await page.waitForURL(/30-quiz\.html|28-onboarding\.html/, { timeout: 20000 });
    if (page.url().includes('28-onboarding')) {
      await page.evaluate(() => { localStorage.setItem('vitae_onb_quiz_visto', '1'); window.location.href = '30-quiz.html'; });
      await page.waitForURL(/30-quiz\.html/, { timeout: 15000 });
    }
    await page.waitForSelector('#step0.active', { timeout: 10000 });

    console.log('[2/3] Preenchendo quiz...');
    await page.locator('#sexoField').click();
    await page.waitForSelector('#pickerOverlay.active');
    await page.locator('.picker-option', { hasText: 'Feminino' }).first().click();
    await page.waitForFunction(() => !document.getElementById('pickerOverlay').classList.contains('active'));
    await page.locator('#nascimentoInput').fill('15/03/1990');
    await page.locator('#alturaInput').fill('165');
    await page.locator('#pesoInput').fill('60');
    await page.locator('#cpfInput').fill(CPF_TESTE);
    await page.locator('#step0 .btn-next').click();
    await page.waitForSelector('#step1.active');

    await page.locator('#tipoSangueField').click();
    await page.waitForSelector('#pickerOverlay.active');
    await page.locator('.picker-option', { hasText: /^O\+$/ }).first().click();
    await page.waitForFunction(() => !document.getElementById('pickerOverlay').classList.contains('active'));
    await page.locator('#planoField').click();
    await page.waitForSelector('#pickerOverlay.active');
    await page.locator('.picker-option', { hasText: /^SUS$/ }).first().click();
    await page.waitForFunction(() => !document.getElementById('pickerOverlay').classList.contains('active'));
    await page.locator('#step1 .btn-next').click();
    await page.waitForSelector('#step2.active');

    await page.locator('#emergenciaNome').fill('Joao Teste');
    await page.locator('#emergenciaTel').fill('11999998888');
    await page.locator('#step2 .btn-next').click();
    await page.waitForSelector('#step3.active');

    for (let s of [3,4,5]) {
      await page.locator(`#step${s} .btn-next`).first().click();
      await page.waitForSelector(`#step${s+1}.active`);
    }

    console.log('[3/3] Step 6 — foto + cronometro...');
    await page.locator('#fotoGaleria').setInputFiles(FOTO_PATH);
    await page.waitForSelector('#fotoPreview[src^="data:"]');
    await page.waitForFunction(() => !document.getElementById('btnConcluir').disabled);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'PROD-04-com-foto.png') });

    const tClick = Date.now();
    await page.locator('#btnConcluir').click();
    await page.waitForTimeout(50);
    const estadoBotao = await page.evaluate(() => {
      const b = document.getElementById('btnConcluir');
      return b ? { disabled: b.disabled, text: b.textContent, opacity: b.style.opacity } : null;
    });
    console.log(`  Botao apos clique: disabled=${estadoBotao.disabled} text="${estadoBotao.text}"`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'PROD-04b-salvando.png') });

    await page.waitForURL(/31-pronto\.html|pre-consulta\.html/, { timeout: 15000 });
    const tRedirect = Date.now() - tClick;
    metricas.tempoTotal = tRedirect;
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'PROD-05-pos-conclude.png') });
    console.log(`\n  ✅ REDIRECIONOU em ${tRedirect}ms (${(tRedirect/1000).toFixed(2)}s)`);

    // Verificacao pos-redirect
    await page.waitForTimeout(2500);
    const verif = await page.evaluate(async () => {
      const token = localStorage.getItem('vitae_token');
      const apiUrl = 'https://vitae-app-production.up.railway.app';
      const fetchAuth = (p) => fetch(apiUrl + p, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.ok ? r.json() : { erro: r.status });
      const [perfil, consentimentos] = await Promise.all([fetchAuth('/perfil'), fetchAuth('/consentimento')]);
      return {
        fotoSalva: !!(perfil && perfil.usuario && perfil.usuario.fotoUrl),
        consentimentosCount: consentimentos && consentimentos.consentimentos ? consentimentos.consentimentos.length : 0,
        consentimentosTipos: consentimentos && consentimentos.consentimentos ? consentimentos.consentimentos.map(c => c.tipo) : [],
        perfilDataNasc: perfil && perfil.perfil && perfil.perfil.dataNascimento ? perfil.perfil.dataNascimento.slice(0,10) : null,
      };
    });
    metricas.verificacaoPos = verif;
    console.log('  Foto no banco:', verif.fotoSalva);
    console.log('  Consentimentos:', verif.consentimentosCount, verif.consentimentosTipos);

    console.log('\n--- Network ops ---');
    networkOps.forEach(o => console.log(`  ${o.method} ${o.status} ${o.url.slice(0,80)}`));

  } catch (err) {
    console.log('\n[FATAL]', err.message);
    metricas.erro = err.message;
    try { await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'PROD-FATAL.png'), fullPage: true }); } catch(_){}
  } finally {
    fs.writeFileSync(path.join(SCREENSHOT_DIR, `relatorio-PROD-${TIMESTAMP}.json`),
      JSON.stringify({ base: BASE, metricas, networkOps, failedReqs: failedReqs.slice(0,10), pageErrors }, null, 2));
    await browser.close();
  }
  console.log('\n═════════════════════════════════════════════════════════');
  console.log('RESULTADO PRODUCAO:', metricas.tempoTotal, 'ms');
  console.log('═════════════════════════════════════════════════════════');
  process.exit(metricas.tempoTotal > 5000 || metricas.erro ? 1 : 0);
}

executar().catch(e => { console.error('FATAL:', e); process.exit(2); });
