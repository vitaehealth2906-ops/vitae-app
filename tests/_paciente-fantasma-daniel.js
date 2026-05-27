/**
 * REPRODUZ O BUG DO DANIEL (Sessao 27/05):
 * Paciente preenche alergias e medicamentos no quiz, conclui rapido,
 * mas na proxima tela (01-saude.html) elas nao aparecem.
 *
 * Este teste confirma se as POSTs /alergias e /medicamentos chegam no banco
 * ou sao abortadas pelo redirect (sem keepalive=true).
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'https://vitae-app.vercel.app/app-v3';
const FOTO_PATH = path.resolve(__dirname, 'fixtures/paciente-foto.jpg');
const TIMESTAMP = Date.now();
const EMAIL_TESTE = `robo-daniel-${TIMESTAMP}@vitae-teste.local`;
const CELULAR_TESTE = '+5511' + String(900000000 + Math.floor(Math.random()*99999999)).slice(0,9);
const SENHA_TESTE = 'TesteRobo2026!';
const SCREENSHOT_DIR = path.resolve(__dirname, '_screenshots-fantasma');

// Daniel preencheu: "Dipirona, Penicilina" como alergias
// e "Losartana, Metformina" como medicamentos
const ALERGIAS_TESTE = 'Dipirona, Penicilina';
const MEDICAMENTOS_TESTE = 'Losartana, Metformina';

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

const NET = (process.argv.find(a => a.startsWith('--net=')) || '--net=normal').split('=')[1];
const NET_PROFILES = {
  normal:  null,
  fast4g:  { downloadThroughput: 4*1024*1024/8, uploadThroughput: 3*1024*1024/8, latency: 20 },
  slow:    { downloadThroughput: 400*1024/8,    uploadThroughput: 400*1024/8,    latency: 400 },
  awful:   { downloadThroughput: 200*1024/8,    uploadThroughput: 100*1024/8,    latency: 800 },
};

async function executar() {
  console.log('═════════════════════════════════════════════════════════');
  console.log('REPRODUCAO BUG DANIEL — alergias/meds apos quiz');
  console.log('═════════════════════════════════════════════════════════');
  console.log('Rede:            ', NET);
  console.log('Email:           ', EMAIL_TESTE);
  console.log('Alergias quiz:   ', ALERGIAS_TESTE);
  console.log('Medicamentos:    ', MEDICAMENTOS_TESTE);
  console.log('---------------------------------------------------------');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 900 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const page = await ctx.newPage();
  if (NET_PROFILES[NET]) {
    const client = await ctx.newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', { offline: false, ...NET_PROFILES[NET] });
    console.log('[NET] throttle aplicado:', NET_PROFILES[NET]);
  }

  await page.addInitScript(() => {
    localStorage.setItem('vitae_onb_quiz_visto', '1');
    localStorage.setItem('vitae_tipo_escolhido', 'PACIENTE');
  });

  const consoleMsgs = [], networkOps = [];
  page.on('console', m => consoleMsgs.push({ type: m.type(), text: m.text() }));
  page.on('response', r => {
    const u = r.url();
    if (u.includes('/alergias') || u.includes('/medicamentos') || u.includes('/perfil') || u.includes('/auth')) {
      networkOps.push({ method: r.request().method(), status: r.status(), url: u });
    }
  });
  page.on('requestfailed', r => {
    const u = r.url();
    if (u.includes('/alergias') || u.includes('/medicamentos')) {
      networkOps.push({ method: r.method(), status: 'FAILED', url: u, reason: r.failure()?.errorText });
    }
  });

  try {
    // ====== Cadastro ======
    console.log('[1] Cadastro...');
    await page.goto(`${BASE}/26-cadastro.html`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('.field-input');
    const inputs = await page.locator('.field-input').all();
    await inputs[0].fill('Daniel Teste Robo');
    await inputs[1].fill(CELULAR_TESTE.replace('+55',''));
    await inputs[2].fill(EMAIL_TESTE);
    await page.locator('#passInput').fill(SENHA_TESTE);
    await page.locator('#termsCheck').click();
    await page.locator('#btnCreate').click();
    await page.waitForURL(/30-quiz\.html|28-onboarding\.html/, { timeout: 20000 });
    if (page.url().includes('28-onboarding')) {
      await page.evaluate(() => { localStorage.setItem('vitae_onb_quiz_visto', '1'); window.location.href = '30-quiz.html'; });
      await page.waitForURL(/30-quiz\.html/);
    }
    await page.waitForSelector('#step0.active');

    // ====== Quiz ======
    console.log('[2] Quiz com alergias e medicamentos preenchidos...');
    // Step 0
    await page.locator('#sexoField').click();
    await page.waitForSelector('#pickerOverlay.active');
    await page.locator('.picker-option', { hasText: 'Masculino' }).first().click();
    await page.waitForFunction(() => !document.getElementById('pickerOverlay').classList.contains('active'));
    await page.locator('#nascimentoInput').fill('20/06/1985');
    await page.locator('#alturaInput').fill('178');
    await page.locator('#pesoInput').fill('82');
    await page.locator('#cpfInput').fill(CPF_TESTE);
    await page.locator('#step0 .btn-next').click();
    await page.waitForSelector('#step1.active');

    // Step 1
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

    // Step 2
    await page.locator('#emergenciaNome').fill('Maria Teste');
    await page.locator('#emergenciaTel').fill('11988887777');
    await page.locator('#step2 .btn-next').click();
    await page.waitForSelector('#step3.active');

    // Step 3 — ALERGIAS (Daniel preenche aqui)
    await page.locator('#alergiasInput').fill(ALERGIAS_TESTE);
    console.log('    Alergias preenchidas:', ALERGIAS_TESTE);
    await page.locator('#step3 .btn-next').click();
    await page.waitForSelector('#step4.active');

    // Step 4 — MEDICAMENTOS
    // Aba app-v3 tem formulario estruturado: precisa adicionar 1 por 1 via botao
    for (const med of MEDICAMENTOS_TESTE.split(',').map(s => s.trim())) {
      await page.locator('#medNomeInput').fill(med);
      await page.locator('#medDoseInput').fill('500mg');
      await page.locator('button', { hasText: /Adicionar/ }).first().click();
      await page.waitForTimeout(200);
    }
    // Conferir que medicamentos foram registrados no input hidden
    const medsInputVal = await page.locator('#medicamentosInput').inputValue();
    console.log('    Medicamentos preenchidos (input hidden):', medsInputVal);

    await page.locator('#step4 .btn-next').click();
    await page.waitForSelector('#step5.active');
    await page.locator('#step5 .btn-next').first().click();
    await page.waitForSelector('#step6.active');

    // Step 6 — Foto
    console.log('[3] Foto + click conclude...');
    await page.locator('#fotoGaleria').setInputFiles(FOTO_PATH);
    await page.waitForSelector('#fotoPreview[src^="data:"]');
    await page.waitForFunction(() => !document.getElementById('btnConcluir').disabled);

    const tClick = Date.now();
    await page.locator('#btnConcluir').click();
    await page.waitForURL(/31-pronto\.html|01-saude\.html/, { timeout: 15000 });
    const tRedirect = Date.now() - tClick;
    console.log(`    Redirect em ${tRedirect}ms`);

    // ====== Verificacao 1: imediatamente apos redirect ======
    console.log('\n[4] Verificando 1s apos redirect...');
    await page.waitForTimeout(1000);
    const verif1s = await page.evaluate(async () => {
      const token = localStorage.getItem('vitae_token');
      const apiUrl = 'https://vitae-app-production.up.railway.app';
      const fetchAuth = (p) => fetch(apiUrl + p, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.ok ? r.json() : { erro: r.status });
      const [alergias, medicamentos] = await Promise.all([fetchAuth('/alergias'), fetchAuth('/medicamentos')]);
      return {
        alergiasCount: Array.isArray(alergias) ? alergias.length : (alergias.alergias ? alergias.alergias.length : 0),
        medsCount: Array.isArray(medicamentos) ? medicamentos.length : (medicamentos.medicamentos ? medicamentos.medicamentos.length : 0),
        alergiasNomes: Array.isArray(alergias) ? alergias.map(a=>a.nome) : (alergias.alergias ? alergias.alergias.map(a=>a.nome) : []),
        medsNomes: Array.isArray(medicamentos) ? medicamentos.map(m=>m.nome) : (medicamentos.medicamentos ? medicamentos.medicamentos.map(m=>m.nome) : []),
      };
    });
    console.log('    1s pos-redirect: alergias=', verif1s.alergiasCount, verif1s.alergiasNomes);
    console.log('    1s pos-redirect: meds=    ', verif1s.medsCount, verif1s.medsNomes);

    // ====== Verificacao 2: 5s depois ======
    console.log('\n[5] Verificando 5s apos redirect...');
    await page.waitForTimeout(4000);
    const verif5s = await page.evaluate(async () => {
      const token = localStorage.getItem('vitae_token');
      const apiUrl = 'https://vitae-app-production.up.railway.app';
      const fetchAuth = (p) => fetch(apiUrl + p, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.ok ? r.json() : { erro: r.status });
      const [alergias, medicamentos] = await Promise.all([fetchAuth('/alergias'), fetchAuth('/medicamentos')]);
      return {
        alergiasCount: Array.isArray(alergias) ? alergias.length : (alergias.alergias ? alergias.alergias.length : 0),
        medsCount: Array.isArray(medicamentos) ? medicamentos.length : (medicamentos.medicamentos ? medicamentos.medicamentos.length : 0),
        alergiasNomes: Array.isArray(alergias) ? alergias.map(a=>a.nome) : (alergias.alergias ? alergias.alergias.map(a=>a.nome) : []),
        medsNomes: Array.isArray(medicamentos) ? medicamentos.map(m=>m.nome) : (medicamentos.medicamentos ? medicamentos.medicamentos.map(m=>m.nome) : []),
      };
    });
    console.log('    5s pos-redirect: alergias=', verif5s.alergiasCount, verif5s.alergiasNomes);
    console.log('    5s pos-redirect: meds=    ', verif5s.medsCount, verif5s.medsNomes);

    // ====== Resultado ======
    console.log('\n═════════════════════════════════════════════════════════');
    console.log('VERIFICACAO BUG DANIEL:');
    console.log('Esperado: 2 alergias (Dipirona, Penicilina) + 2 meds (Losartana, Metformina)');
    console.log('Recebido apos 1s: ', verif1s.alergiasCount, 'alergias, ', verif1s.medsCount, 'meds');
    console.log('Recebido apos 5s: ', verif5s.alergiasCount, 'alergias, ', verif5s.medsCount, 'meds');
    console.log('═════════════════════════════════════════════════════════');

    console.log('\n--- Network ops (POSTs /alergias e /medicamentos) ---');
    networkOps.filter(o => (o.url.includes('/alergias') || o.url.includes('/medicamentos')) && o.method === 'POST').forEach(o => {
      console.log(`  POST ${o.status} ${o.url.slice(0,80)} ${o.reason ? '(' + o.reason + ')' : ''}`);
    });

    fs.writeFileSync(path.join(SCREENSHOT_DIR, `relatorio-DANIEL-${TIMESTAMP}.json`),
      JSON.stringify({ verif1s, verif5s, networkOps, timing: tRedirect }, null, 2));

    // ===== ETAPA EXTRA: seguir o fluxo real ate 01-saude.html =====
    console.log('\n[6] Aguardando navegacao automatica pra 01-saude.html (~5s)...');
    try {
      await page.waitForURL(/01-saude\.html/, { timeout: 12000 });
      console.log('    Chegou em 01-saude.html');
      await page.waitForTimeout(2500); // da tempo do SWR renderizar
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `DANIEL-01-saude-${NET}.png`), fullPage: true });

      // Capturar o que aparece nos componentes
      const uiState = await page.evaluate(() => {
        return {
          alergiasResumo: (document.getElementById('alergiasResumo') || {}).textContent || '(elemento nao existe)',
          medsTituloHoje: (document.getElementById('medsTituloHoje') || {}).textContent || '(elemento nao existe)',
          rgVersoAlergias: (document.getElementById('rgVersoAlergias') || {}).textContent || '(elemento nao existe)',
          rgVersoMeds: (document.getElementById('rgVersoMeds') || {}).textContent || '(elemento nao existe)',
        };
      });
      console.log('    UI alergias:        ', uiState.alergiasResumo);
      console.log('    UI medicamentos:    ', uiState.medsTituloHoje);
      console.log('    UI RG verso alergia:', uiState.rgVersoAlergias);
      console.log('    UI RG verso meds:   ', uiState.rgVersoMeds);
    } catch (navErr) {
      console.log('    Erro chegando em 01-saude.html:', navErr.message);
    }

  } catch (err) {
    console.log('\n[FATAL]', err.message);
    try { await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DANIEL-FATAL.png'), fullPage: true }); } catch(_){}
  } finally {
    await browser.close();
  }
}

executar().catch(e => { console.error('FATAL:', e); process.exit(2); });
