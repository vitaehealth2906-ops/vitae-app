/**
 * PACIENTE FANTASMA COMPLETO — testa o quiz com formulario estruturado de
 * alergias e medicamentos. Garante que:
 *   1. Quiz aceita dados estruturados (gravidade, frequencia, etc.)
 *   2. Click "Salvar" mantem < 5s
 *   3. Dados chegam no banco completos
 *   4. Aba Saude (01-saude.html) renderiza alergias E medicamentos nos
 *      dois componentes — bug do Daniel nao acontece mais.
 *
 * Uso:
 *   node tests/_paciente-fantasma-completo.js                  # rede normal
 *   node tests/_paciente-fantasma-completo.js --net=slow       # 3G lento
 *   node tests/_paciente-fantasma-completo.js --base=PROD      # prod Vercel
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const NET  = (args.find(a => a.startsWith('--net='))  || '--net=normal').split('=')[1];
const BASE_FLAG = (args.find(a => a.startsWith('--base=')) || '--base=local').split('=')[1];
const HEADED = args.includes('--headed');

const BASE = BASE_FLAG === 'PROD'
  ? 'https://vitae-app.vercel.app/app-v3'
  : 'http://localhost:3000/app-v3';
const FOTO_PATH = path.resolve(__dirname, 'fixtures/paciente-foto.jpg');
const TIMESTAMP = Date.now();
const EMAIL_TESTE = `robo-completo-${TIMESTAMP}@vitae-teste.local`;
const CELULAR_TESTE = '+5511' + String(900000000 + Math.floor(Math.random()*99999999)).slice(0,9);
const SENHA_TESTE = 'TesteRobo2026!';
const SCREENSHOT_DIR = path.resolve(__dirname, '_screenshots-fantasma');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// 2 alergias com gravidades diferentes
const ALERGIAS_TESTE = [
  { nome: 'Dipirona',  tipo: 'MEDICAMENTO', gravidade: 'GRAVE'    },
  { nome: 'Penicilina',tipo: 'MEDICAMENTO', gravidade: 'MODERADA' },
];
// 2 medicamentos com dados completos
const MEDS_TESTE = [
  { nome: 'Losartana', dose: '50mg',  horario: '08:00', motivo: 'pressao alta',  freq: 'diário' },
  { nome: 'Metformina',dose: '500mg', horario: '20:00', motivo: 'diabetes tipo 2',freq: '2x ao dia' },
];

const NET_PROFILES = {
  normal:  null,
  fast4g:  { downloadThroughput: 4*1024*1024/8, uploadThroughput: 3*1024*1024/8, latency: 20 },
  slow:    { downloadThroughput: 400*1024/8,    uploadThroughput: 400*1024/8,    latency: 400 },
};

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
  console.log('PACIENTE FANTASMA COMPLETO — Quiz + Alergias/Meds + Saude');
  console.log('═════════════════════════════════════════════════════════');
  console.log('Base:    ', BASE);
  console.log('Rede:    ', NET);
  console.log('Email:   ', EMAIL_TESTE);
  console.log('Alergias:', ALERGIAS_TESTE.map(a=>`${a.nome}(${a.gravidade})`).join(', '));
  console.log('Meds:    ', MEDS_TESTE.map(m=>`${m.nome} ${m.dose} ${m.horario}`).join(', '));
  console.log('---------------------------------------------------------');

  const browser = await chromium.launch({ headless: !HEADED });
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 900 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const page = await ctx.newPage();
  if (NET_PROFILES[NET]) {
    const client = await ctx.newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', { offline: false, ...NET_PROFILES[NET] });
    console.log('[NET] throttle:', NET_PROFILES[NET]);
  }
  await page.addInitScript(() => {
    localStorage.setItem('vitae_onb_quiz_visto', '1');
    localStorage.setItem('vitae_tipo_escolhido', 'PACIENTE');
  });

  const networkOps = [];
  page.on('response', r => {
    const u = r.url();
    if (u.includes('/alergias') || u.includes('/medicamentos') || u.includes('/perfil') || u.includes('/auth') || u.includes('/consentimento')) {
      networkOps.push({ method: r.request().method(), status: r.status(), url: u });
    }
  });

  const metricas = { passos: {} };

  try {
    // ====== Cadastro ======
    console.log('[1] Cadastro...');
    const t0 = Date.now();
    await page.goto(`${BASE}/26-cadastro.html`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('.field-input');
    const inputs = await page.locator('.field-input').all();
    await inputs[0].fill('Daniel Teste Completo');
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
    metricas.passos.cadastro = Date.now() - t0;

    // ====== Step 0: dados basicos ======
    console.log('[2] Quiz - dados basicos...');
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

    // ====== Step 1: saude geral ======
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

    // ====== Step 2: contato emergencia ======
    await page.locator('#emergenciaNome').fill('Maria Teste');
    await page.locator('#emergenciaTel').fill('11988887777');
    await page.locator('#step2 .btn-next').click();
    await page.waitForSelector('#step3.active');

    // ====== Step 3: ALERGIAS ESTRUTURADAS ======
    console.log('[3] Step 3 - alergias estruturadas (nome+tipo+gravidade)...');
    for (const a of ALERGIAS_TESTE) {
      await page.locator('#alergiaNomeInput').fill(a.nome);
      await page.locator('#alergiaTipoInput').selectOption(a.tipo);
      // Click na pilula de gravidade
      await page.locator(`#alergiaGravidadeGroup button[data-gravidade="${a.gravidade}"]`).click();
      await page.locator('#step3 #alergiaFormBox button', { hasText: /\+ Adicionar/ }).click();
      await page.waitForTimeout(150);
    }
    // Conferir que ALERGIAS_QUIZ tem 2 entries
    const alergiasNoQuiz = await page.evaluate(() => (window.ALERGIAS_QUIZ || []).slice());
    console.log('    ALERGIAS_QUIZ:', JSON.stringify(alergiasNoQuiz));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `step3-alergias-${NET}.png`) });
    await page.locator('#step3 .btn-next').click();
    await page.waitForSelector('#step4.active');

    // ====== Step 4: MEDICAMENTOS COMPLETOS ======
    console.log('[4] Step 4 - medicamentos completos (nome+dose+freq+horario+motivo)...');
    for (const m of MEDS_TESTE) {
      await page.locator('#medNomeInput').fill(m.nome);
      await page.locator('#medDoseInput').fill(m.dose);
      await page.locator('#medHoraInput').fill(m.horario);
      await page.locator('#medFreqInput').selectOption(m.freq);
      await page.locator('#medMotivoInput').fill(m.motivo);
      await page.locator('#step4 #medFormBox button', { hasText: /\+ Adicionar/ }).click();
      await page.waitForTimeout(150);
    }
    const medsNoQuiz = await page.evaluate(() => (window.MEDS_QUIZ || []).slice());
    console.log('    MEDS_QUIZ:', JSON.stringify(medsNoQuiz));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `step4-meds-${NET}.png`) });
    await page.locator('#step4 .btn-next').click();
    await page.waitForSelector('#step5.active');

    // ====== Step 5: pular exames ======
    await page.locator('#step5 .btn-next').first().click();
    await page.waitForSelector('#step6.active');

    // ====== Step 6: foto + conclude ======
    console.log('[5] Foto + conclude (cronometrando)...');
    await page.locator('#fotoGaleria').setInputFiles(FOTO_PATH);
    await page.waitForSelector('#fotoPreview[src^="data:"]');
    await page.waitForFunction(() => !document.getElementById('btnConcluir').disabled);

    const tClick = Date.now();
    await page.locator('#btnConcluir').click();
    await page.waitForURL(/31-pronto\.html|pre-consulta\.html/, { timeout: 15000 });
    const tRedirect = Date.now() - tClick;
    metricas.passos.cliqueAteRedirect = tRedirect;
    console.log(`    Redirect em ${tRedirect}ms`);

    // ====== Verificacao 1: dados no banco ======
    console.log('[6] Verificando dados no banco...');
    await page.waitForTimeout(2500);
    const verifBanco = await page.evaluate(async () => {
      const token = localStorage.getItem('vitae_token');
      const apiUrl = 'https://vitae-app-production.up.railway.app';
      const fetchAuth = (p) => fetch(apiUrl + p, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.ok ? r.json() : { erro: r.status });
      const [alergias, meds, perfil] = await Promise.all([
        fetchAuth('/alergias'),
        fetchAuth('/medicamentos'),
        fetchAuth('/perfil'),
      ]);
      const alList = alergias.alergias || alergias || [];
      const mdList = meds.medicamentos || meds || [];
      return {
        alergiasCount: alList.length,
        alergias: alList.map(a => ({ nome: a.nome, tipo: a.tipo, gravidade: a.gravidade })),
        medsCount: mdList.length,
        meds: mdList.map(m => ({ nome: m.nome, dosagem: m.dosagem, horario: m.horario, frequencia: m.frequencia, motivo: m.motivo })),
        fotoSalva: !!(perfil.usuario && perfil.usuario.fotoUrl),
      };
    });
    metricas.verifBanco = verifBanco;
    console.log('    Alergias no banco:', verifBanco.alergiasCount, JSON.stringify(verifBanco.alergias));
    console.log('    Meds no banco:    ', verifBanco.medsCount, JSON.stringify(verifBanco.meds));
    console.log('    Foto salva:       ', verifBanco.fotoSalva);

    // ====== Verificacao 2: navegacao automatica pra 01-saude.html ======
    console.log('[7] Aguardando 01-saude.html (5s do 31-pronto)...');
    await page.waitForURL(/01-saude\.html/, { timeout: 12000 });
    await page.waitForTimeout(2500); // SWR render
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `aba-saude-${NET}-${TIMESTAMP}.png`), fullPage: true });

    const uiState = await page.evaluate(() => {
      const get = (id) => {
        const el = document.getElementById(id);
        return el ? (el.textContent || '').trim() : '(nao existe)';
      };
      const getList = (id) => {
        const el = document.getElementById(id);
        if (!el) return '(nao existe)';
        return el.innerText.trim().split('\n').map(s => s.trim()).filter(Boolean);
      };
      return {
        alergiasResumo: get('alergiasResumo'),
        medsTituloHoje: get('medsTituloHoje'),
        alergiasHomeList: getList('alergiasHomeList'),
        medsHomeList: getList('medsHomeList'),
      };
    });
    metricas.uiSaude = uiState;
    console.log('    [UI] Resumo alergias:    ', uiState.alergiasResumo);
    console.log('    [UI] Lista alergias home:', JSON.stringify(uiState.alergiasHomeList));
    console.log('    [UI] Titulo meds:        ', uiState.medsTituloHoje);
    console.log('    [UI] Lista meds home:    ', JSON.stringify(uiState.medsHomeList));

    // ====== AVALIACAO FINAL ======
    const okBancoAlergias = verifBanco.alergiasCount === ALERGIAS_TESTE.length;
    const okBancoMeds     = verifBanco.medsCount === MEDS_TESTE.length;
    const okGravidades    = verifBanco.alergias.every(a => a.gravidade);
    const okHorarios      = verifBanco.meds.every(m => m.horario);
    const okUIAlergias    = !uiState.alergiasHomeList.includes('Nenhuma alergia cadastrada. Adicionar');
    const okUIMeds        = uiState.medsHomeList.some(l => /Losartana|Metformina/i.test(l));
    const okTempo         = tRedirect < 5000;

    console.log('\n═════════════════════════════════════════════════════════');
    console.log('AVALIACAO:');
    console.log('  Tempo <5s:                ', okTempo ? '✅' : '❌', `(${tRedirect}ms)`);
    console.log('  Alergias no banco (2):    ', okBancoAlergias ? '✅' : '❌');
    console.log('  Meds no banco (2):        ', okBancoMeds ? '✅' : '❌');
    console.log('  Gravidades preenchidas:   ', okGravidades ? '✅' : '❌');
    console.log('  Horarios preenchidos:     ', okHorarios ? '✅' : '❌');
    console.log('  UI alergias aparece:      ', okUIAlergias ? '✅' : '❌');
    console.log('  UI meds aparece com nome: ', okUIMeds ? '✅' : '❌');
    console.log('═════════════════════════════════════════════════════════');

    const passou = okTempo && okBancoAlergias && okBancoMeds && okGravidades && okHorarios && okUIAlergias && okUIMeds;
    metricas.passou = passou;

    fs.writeFileSync(path.join(SCREENSHOT_DIR, `relatorio-COMPLETO-${NET}-${TIMESTAMP}.json`),
      JSON.stringify({ base: BASE, net: NET, email: EMAIL_TESTE, metricas, networkOps }, null, 2));
    console.log('\nRelatorio:', `relatorio-COMPLETO-${NET}-${TIMESTAMP}.json`);

    await browser.close();
    process.exit(passou ? 0 : 1);

  } catch (err) {
    console.log('\n[FATAL]', err.message);
    try { await page.screenshot({ path: path.join(SCREENSHOT_DIR, `COMPLETO-FATAL-${NET}.png`), fullPage: true }); } catch(_){}
    await browser.close();
    process.exit(2);
  }
}

executar().catch(e => { console.error('FATAL:', e); process.exit(2); });
