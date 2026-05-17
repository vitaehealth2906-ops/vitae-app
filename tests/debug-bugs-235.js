// Debug Playwright pra Bugs 2, 3, 5
// - Bug 2: por que MEDS_MOCK[pid] mostra Creatina 5x ao inves dos meds reais
// - Bug 3: por que upload de documento falha silenciosamente
// - Bug 5: por que pd.perfilSaude vem vazio
//
// Loga: console.log do browser, API calls, valores de MEDS_MOCK e pcState

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SHOTS = path.join(__dirname, 'shots', 'debug-bugs');
fs.mkdirSync(SHOTS, { recursive: true });

const MED_URL = 'https://vitae-app.vercel.app/desktop/app-v2.html';
const PDF_PATH = path.join(__dirname, 'fixtures', 'receita-mock.pdf');
const PACIENTE_ID_TESTE = 'f9df2c03-690b-4bb7-9dc6-59a6f531489b';
const PACIENTE_ID_DANIEL = '555a048e-d985-422e-9bd4-25903eb0003e';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const apiCalls = [];
  const consoleLogs = [];
  page.on('pageerror', err => consoleLogs.push({ type: 'pageerror', msg: err.message }));
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('vitae') || text.includes('paciente') || text.includes('docum') || text.includes('upload') || msg.type() === 'error') {
      consoleLogs.push({ type: msg.type(), msg: text.slice(0, 300) });
    }
  });
  page.on('response', async (res) => {
    const u = res.url();
    if (u.includes('/medico/pacientes/') || u.includes('/documentos/') || u.includes('/contato/')) {
      let body = '';
      try { body = await res.text(); } catch (_e) {}
      apiCalls.push({ status: res.status(), url: u, body: body.slice(0, 500) });
    }
  });

  console.log('=== Login medico ===');
  await page.goto(MED_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  if (page.url().includes('login')) {
    await page.locator('input[type="email"]').first().fill(process.env.MEDICO_EMAIL);
    await page.locator('input[type="password"]').first().fill(process.env.MEDICO_SENHA);
    await page.locator('button[type="submit"], button:has-text("Entrar")').first().click();
    await page.waitForTimeout(4000);
  }
  if (!page.url().includes('app-v2')) {
    await page.goto(MED_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
  }
  console.log('Logado em:', page.url());

  // ABRE PACIENTE TESTE (lucas borellli)
  console.log('\n=== Abrindo paciente teste lucasborelli096 (id f9df2c03) ===');
  await page.locator('a:has-text("Pacientes"), .nl:has-text("Pacientes")').first().click();
  await page.waitForTimeout(2500);
  await page.evaluate((pid) => {
    window.STATE = window.STATE || {};
    window.STATE.selectedPaciente = pid;
    if (typeof window.goto === 'function') window.goto('pacientes-detail');
  }, PACIENTE_ID_TESTE);
  await page.waitForTimeout(8000); // espera loadPacienteDetalhe
  await page.screenshot({ path: path.join(SHOTS, 'paciente-teste-aberto.png'), fullPage: true });

  // Inspeciona estado interno do JS
  console.log('\n=== Estado interno apos abrir paciente ===');
  const estado = await page.evaluate((pid) => {
    return {
      selectedPaciente: window.STATE && window.STATE.selectedPaciente,
      view: window.STATE && window.STATE.view,
      pcStateCurrent: window.pcState && window.pcState.currentPacienteData ? {
        id: window.pcState.currentPacienteData.id,
        nome: window.pcState.currentPacienteData.nome,
        email: window.pcState.currentPacienteData.email,
        perfilSaudeExiste: !!window.pcState.currentPacienteData.perfilSaude,
        perfilSaudeCpf: window.pcState.currentPacienteData.perfilSaude && window.pcState.currentPacienteData.perfilSaude.cpf,
        perfilSaudePlano: window.pcState.currentPacienteData.perfilSaude && window.pcState.currentPacienteData.perfilSaude.planoSaude,
        perfilSaudeHistFam: window.pcState.currentPacienteData.perfilSaude && window.pcState.currentPacienteData.perfilSaude.historicoFamiliar,
        medicamentosLen: (window.pcState.currentPacienteData.medicamentos || []).length,
        alergiasLen: (window.pcState.currentPacienteData.alergias || []).length,
        examesLen: (window.pcState.currentPacienteData.exames || []).length,
      } : null,
      medsMockExiste: typeof window.MEDS_MOCK !== 'undefined',
      medsMockPaciente: window.MEDS_MOCK && window.MEDS_MOCK[pid] ? window.MEDS_MOCK[pid] : null,
      medsMockKeys: window.MEDS_MOCK ? Object.keys(window.MEDS_MOCK).slice(0,10) : [],
      examesMockPaciente: window.EXAMES_MOCK && window.EXAMES_MOCK[pid] ? window.EXAMES_MOCK[pid] : null,
      pacientesGlobalSelecionado: (window.PACIENTES || []).find(x => x.id === pid),
    };
  }, PACIENTE_ID_TESTE);
  console.log(JSON.stringify(estado, null, 2));

  // Tenta upload de documento
  console.log('\n=== Tentando upload documento ===');
  const btnDoc = page.locator('button:has-text("Anexar primeiro documento"), button:has-text("Anexar documento"), .doc-add, .doc-empty-cta').first();
  const btnVis = await btnDoc.isVisible({ timeout: 5000 }).catch(() => false);
  if (btnVis) {
    await btnDoc.click();
    await page.waitForTimeout(1500);
    await page.locator('#pdTipoSel').selectOption('RECEITA');
    await page.locator('#pdArquivoInp').setInputFiles(PDF_PATH);
    await page.locator('#pdObsInp').fill('Debug bugs 235.');
    await page.screenshot({ path: path.join(SHOTS, 'upload-modal-preenchido.png') });
    console.log('Clicando submit...');
    await page.locator('#pdSubmitBtn').click();
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(SHOTS, 'upload-pos-submit.png') });
  } else {
    console.log('Botao Anexar nao apareceu — provavelmente lista ja tem docs ou empty state nao renderizou');
  }

  console.log('\n=== TODAS API calls capturadas ===');
  apiCalls.forEach(c => console.log('  ' + c.status + ' ' + c.url.replace('https://vitae-app-production.up.railway.app','') + ' :: ' + c.body.slice(0, 250)));

  console.log('\n=== Console logs do browser ===');
  consoleLogs.slice(-20).forEach(c => console.log('  [' + c.type + '] ' + c.msg));

  fs.writeFileSync(path.join(__dirname, 'logs', 'debug-bugs-235.json'), JSON.stringify({ estado, apiCalls, consoleLogs }, null, 2));
  console.log('\nLog salvo em tests/logs/debug-bugs-235.json');

  await ctx.close();
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
