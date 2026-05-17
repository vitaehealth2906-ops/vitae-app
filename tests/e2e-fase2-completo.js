// E2E Fase 2 — Documentos (médico anexa PDF → paciente baixa)
//
// Pré-requisitos:
//   tests/.env com MEDICO_EMAIL/SENHA + PACIENTE_EMAIL/SENHA
//   tests/fixtures/receita-mock.pdf (criado via Node 317 bytes)
//   Branch feat/fase-2-documentos deployada em prod (ou preview)

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SHOTS = path.join(__dirname, 'shots', 'fase2');
const LOGS = path.join(__dirname, 'logs');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(LOGS, { recursive: true });

const MED_URL = 'https://vitae-app.vercel.app/desktop/app-v2.html';
const PAC_CADASTRO = 'https://vitae-app.vercel.app/app-v3/26-cadastro.html';
const PAC_CONSULTAS = 'https://vitae-app.vercel.app/app-v3/15-consultas.html';
const PDF_PATH = path.join(__dirname, 'fixtures', 'receita-mock.pdf');
const TARGET_PACIENTE_ID = 'f9df2c03-690b-4bb7-9dc6-59a6f531489b';

const log = [];
function step(name, status, info) {
  log.push({ t: new Date().toISOString(), step: name, status, info: info || null });
  console.log(`[${status}] ${name}` + (info ? ' — ' + JSON.stringify(info).slice(0, 200) : ''));
}
async function shot(page, name) { try { await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } catch (_e) {} }

async function loginMedico(page) {
  await page.goto(MED_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  const url = page.url();
  if (url.includes('login')) {
    await page.locator('input[type="email"], input[name="email"]').first().fill(process.env.MEDICO_EMAIL);
    await page.locator('input[type="password"], input[name="senha"]').first().fill(process.env.MEDICO_SENHA);
    await page.locator('button[type="submit"], button:has-text("Entrar")').first().click();
    await page.waitForTimeout(3500);
  }
  // Garantir que está dentro do app-v2
  if (!page.url().includes('app-v2')) {
    await page.goto(MED_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
  }
}

async function loginPaciente(page, ctx) {
  await ctx.addInitScript(() => { try { sessionStorage.setItem('vitae_prefer_login', '1'); } catch (_e) {} });
  await page.goto(PAC_CADASTRO, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.locator('input[type="email"]').first().fill(process.env.PACIENTE_EMAIL);
  await page.locator('input[type="password"]').first().fill(process.env.PACIENTE_SENHA);
  await page.locator('button:has-text("Entrar"), button[type="submit"]').first().click();
  await page.waitForTimeout(5000);
}

async function medicoAnexarDocumento() {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const jsErrors = [];
  const apiCalls = [];
  page.on('pageerror', err => jsErrors.push(err.message));
  page.on('response', async (res) => {
    if (res.url().includes('/documentos/')) {
      let body = '';
      try { body = await res.text(); } catch (_e) {}
      apiCalls.push({ status: res.status(), url: res.url(), body: body.slice(0, 300) });
    }
  });

  try {
    step('médico: login', 'wait');
    await loginMedico(page);
    step('médico: dentro do app-v2', 'ok', { url: page.url() });
    await shot(page, '01-medico-login');

    // Abre paciente programaticamente
    step('médico: abrir paciente teste', 'wait');
    await page.locator('a:has-text("Pacientes"), .nl:has-text("Pacientes")').first().click();
    await page.waitForTimeout(2000);
    await page.evaluate((pid) => {
      window.STATE = window.STATE || {};
      window.STATE.selectedPaciente = pid;
      if (typeof window.goto === 'function') window.goto('pacientes-detail');
    }, TARGET_PACIENTE_ID);
    await page.waitForTimeout(4000);
    await shot(page, '02-medico-central-clinica');

    // Click "Anexar primeiro documento" ou "Anexar documento"
    step('médico: abrir modal upload', 'wait');
    const btnAnexar = page.locator('button:has-text("Anexar primeiro documento"), button:has-text("Anexar documento"), .doc-add, .doc-empty-cta').first();
    if (!(await btnAnexar.isVisible({ timeout: 5000 }).catch(() => false))) {
      throw new Error('Botão Anexar Documento não encontrado');
    }
    await btnAnexar.click();
    await page.waitForTimeout(1000);
    await shot(page, '03-medico-modal-upload');

    // Modal abre — escolhe tipo + arquivo + observação
    await page.locator('#pdTipoSel').selectOption('RECEITA');
    await page.locator('#pdArquivoInp').setInputFiles(PDF_PATH);
    await page.locator('#pdObsInp').fill('Receita teste autônoma Claude (Playwright Fase 2).');
    await shot(page, '04-medico-modal-preenchido');

    // Submeter
    step('médico: submeter upload', 'wait');
    await page.locator('#pdSubmitBtn').click();
    await page.waitForTimeout(5000);
    await shot(page, '05-medico-pos-upload');

    step('médico: JS errors', jsErrors.length ? 'warn' : 'ok', { count: jsErrors.length });
    step('médico: API calls /documentos/*', 'ok', { count: apiCalls.length });
    apiCalls.forEach(c => console.log('  → ' + c.status + ' ' + c.url.replace('https://vitae-app-production.up.railway.app','') + ' :: ' + c.body.slice(0,150)));

    const upload201 = apiCalls.find(c => c.url.endsWith('/upload') && c.status === 201);
    if (!upload201) throw new Error('POST /upload não retornou 201');

    return { ok: true, apiCalls };
  } catch (e) {
    step('médico: FALHOU', 'fail', { erro: e.message });
    await shot(page, 'ERR-medico');
    return { ok: false, erro: e.message };
  } finally {
    await ctx.close();
    await browser.close();
  }
}

async function pacienteBaixarDocumento() {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  });
  const page = await ctx.newPage();
  const jsErrors = [];
  const apiCalls = [];
  page.on('pageerror', err => jsErrors.push(err.message));
  page.on('response', async (res) => {
    if (res.url().includes('/documentos/')) {
      let body = '';
      try { body = await res.text(); } catch (_e) {}
      apiCalls.push({ status: res.status(), url: res.url(), body: body.slice(0, 200) });
    }
  });

  try {
    step('paciente: login', 'wait');
    await loginPaciente(page, ctx);
    step('paciente: dentro do app-v3', 'ok', { url: page.url() });
    await shot(page, '20-paciente-login');

    // Navega pra Consultas
    await page.goto(PAC_CONSULTAS, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await shot(page, '21-paciente-consultas');

    // Espera seção Documentos aparecer
    step('paciente: procurar seção Documentos', 'wait');
    const docsSec = page.locator('#documentosSection');
    if (!(await docsSec.isVisible({ timeout: 6000 }).catch(() => false))) {
      const body = await page.locator('body').innerText();
      throw new Error('Seção Documentos não apareceu. Body: ' + body.slice(0, 300));
    }
    await shot(page, '22-paciente-secao-docs');

    // Captura o popup quando clica no doc
    const popupPromise = ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null);
    step('paciente: clicar doc', 'wait');
    await page.locator('.doc-row').first().click();
    await page.waitForTimeout(3000);
    const popup = await popupPromise;
    await shot(page, '23-paciente-pos-click');
    step('paciente: popup aberto', popup ? 'ok' : 'warn', { url: popup ? popup.url() : 'nao abriu' });

    step('paciente: JS errors', jsErrors.length ? 'warn' : 'ok', { count: jsErrors.length });
    step('paciente: API calls /documentos/*', 'ok', { count: apiCalls.length });
    apiCalls.forEach(c => console.log('  → ' + c.status + ' ' + c.url.replace('https://vitae-app-production.up.railway.app','') + ' :: ' + c.body.slice(0,120)));

    return { ok: true, apiCalls };
  } catch (e) {
    step('paciente: FALHOU', 'fail', { erro: e.message });
    await shot(page, 'ERR-paciente');
    return { ok: false, erro: e.message };
  } finally {
    await ctx.close();
    await browser.close();
  }
}

(async () => {
  console.log('=== E2E Fase 2 — Documentos ===\n');
  const r1 = await medicoAnexarDocumento();
  if (!r1.ok) { fs.writeFileSync(path.join(LOGS, 'fase2.json'), JSON.stringify({ log, r1 }, null, 2)); process.exit(1); }
  console.log('\n--- aguardando 3s ---\n');
  await new Promise(r => setTimeout(r, 3000));
  const r2 = await pacienteBaixarDocumento();
  const all = { timestamp: new Date().toISOString(), r1, r2, log, ok: r1.ok && r2.ok };
  fs.writeFileSync(path.join(LOGS, 'fase2.json'), JSON.stringify(all, null, 2));
  console.log('');
  console.log(all.ok ? '✓ FASE 2 VERDE' : '✗ FASE 2 com falhas');
  process.exit(all.ok ? 0 : 1);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
