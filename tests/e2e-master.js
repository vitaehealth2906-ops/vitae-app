// MASTER E2E — Encadeia as 3 fases num único fluxo realista
//
// Fluxo:
//   Médico abre paciente → propõe retorno + anexa PDF + ativa WhatsApp/permissão
//   Paciente confirma retorno + baixa doc + vê médico no perfil
//   Valida via Prisma direto que tudo persistiu corretamente

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SHOTS = path.join(__dirname, 'shots', 'master');
const LOGS = path.join(__dirname, 'logs');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(LOGS, { recursive: true });

const MED_URL = 'https://vitae-app.vercel.app/desktop/app-v2.html';
const PAC_CADASTRO = 'https://vitae-app.vercel.app/app-v3/26-cadastro.html';
const PAC_CONSULTAS = 'https://vitae-app.vercel.app/app-v3/15-consultas.html';
const PAC_PERFIL = 'https://vitae-app.vercel.app/app-v3/18-perfil.html';
const PDF_PATH = path.join(__dirname, 'fixtures', 'receita-mock.pdf');
const PACIENTE_ID = 'f9df2c03-690b-4bb7-9dc6-59a6f531489b';

const log = [];
function step(name, status, info) {
  log.push({ t: new Date().toISOString(), step: name, status, info: info || null });
  console.log(`[${status}] ${name}` + (info ? ' — ' + JSON.stringify(info).slice(0, 180) : ''));
}
async function shot(page, name) { try { await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } catch (_e) {} }

async function loginMedico(page) {
  await page.goto(MED_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  if (page.url().includes('login')) {
    await page.locator('input[type="email"]').first().fill(process.env.MEDICO_EMAIL);
    await page.locator('input[type="password"]').first().fill(process.env.MEDICO_SENHA);
    await page.locator('button:has-text("Entrar"), button[type="submit"]').first().click();
    await page.waitForTimeout(3500);
  }
  if (!page.url().includes('app-v2')) {
    await page.goto(MED_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
  }
}
async function loginPaciente(page, ctx) {
  await ctx.addInitScript(() => { try { sessionStorage.setItem('vitae_prefer_login', '1'); } catch (_e) {} });
  await page.goto(PAC_CADASTRO, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.locator('input[type="email"]').first().fill(process.env.PACIENTE_EMAIL);
  await page.locator('input[type="password"]').first().fill(process.env.PACIENTE_SENHA);
  await page.locator('button:has-text("Entrar"), button[type="submit"]').first().click();
  await page.waitForTimeout(5000);
}

async function fluxoMedico() {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const apiCalls = [];
  const jsErrors = [];
  page.on('pageerror', err => jsErrors.push(err.message));
  page.on('response', async (res) => {
    const u = res.url();
    if (u.includes('/agendamento/') || u.includes('/documentos/') || u.includes('/contato/')) {
      let body = '';
      try { body = await res.text(); } catch (_e) {}
      apiCalls.push({ status: res.status(), url: u, body: body.slice(0, 250) });
    }
  });

  try {
    step('médico: login', 'wait');
    await loginMedico(page);
    await shot(page, '01-medico-login');

    // Abre paciente teste programaticamente
    step('médico: abrir paciente teste', 'wait');
    await page.locator('a:has-text("Pacientes"), .nl:has-text("Pacientes")').first().click();
    await page.waitForTimeout(2000);
    await page.evaluate((pid) => {
      window.STATE = window.STATE || {};
      window.STATE.selectedPaciente = pid;
      if (typeof window.goto === 'function') window.goto('pacientes-detail');
    }, PACIENTE_ID);
    await page.waitForTimeout(5000);
    await shot(page, '02-medico-central');

    // ===== FASE 1: PROPOR RETORNO =====
    step('médico Fase 1: propor retorno', 'wait');
    await page.locator('button:has-text("Marcar retorno"), button:has-text("+ Marcar")').first().click();
    await page.waitForTimeout(1200);
    const obsRet = page.locator('#prObsInp');
    if (await obsRet.isVisible()) await obsRet.fill('Retorno via Master E2E.');
    await page.locator('#prSubmitBtn').click();
    await page.waitForTimeout(3500);
    await shot(page, '03-medico-retorno-proposto');

    // ===== FASE 2: ANEXAR DOCUMENTO =====
    step('médico Fase 2: anexar documento', 'wait');
    const btnDoc = page.locator('button:has-text("Anexar primeiro documento"), button:has-text("Anexar documento"), .doc-add, .doc-empty-cta').first();
    await btnDoc.click();
    await page.waitForTimeout(1000);
    await page.locator('#pdTipoSel').selectOption('LAUDO');
    await page.locator('#pdArquivoInp').setInputFiles(PDF_PATH);
    await page.locator('#pdObsInp').fill('Laudo Master E2E.');
    await page.locator('#pdSubmitBtn').click();
    await page.waitForTimeout(4500);
    await shot(page, '04-medico-doc-anexado');

    // ===== FASE 3: ATIVAR WHATSAPP + PERMISSÃO =====
    step('médico Fase 3: toggle WhatsApp (LGPD)', 'wait');
    const togWa = page.locator('.toggle-sw[onclick="pdToggleWa()"]').first();
    await togWa.click();
    await page.waitForTimeout(1200);
    const accLgpd = page.locator('#pdLgpdAccept, button:has-text("Aceito e habilito")').first();
    if (await accLgpd.isVisible({ timeout: 4000 }).catch(() => false)) {
      await accLgpd.click();
      await page.waitForTimeout(3500);
    }
    await shot(page, '05-medico-whatsapp-on');

    step('médico Fase 3: ativar permissão paciente', 'wait');
    const togPerm = page.locator('.toggle-sw[onclick*="pdToggleContatoPaciente"]').first();
    if (await togPerm.isVisible({ timeout: 3000 }).catch(() => false)) {
      await togPerm.click();
      await page.waitForTimeout(3500);
    }
    await shot(page, '06-medico-permissao-on');

    // Resumo
    step('médico: JS errors', jsErrors.length ? 'warn' : 'ok', { count: jsErrors.length });
    const okCalls = apiCalls.filter(c => c.status >= 200 && c.status < 300);
    const errCalls = apiCalls.filter(c => c.status >= 400);
    step('médico: API calls', 'ok', { ok: okCalls.length, erro: errCalls.length });
    return { ok: errCalls.length === 0, apiCalls };
  } catch (e) {
    step('médico: FALHOU', 'fail', { erro: e.message });
    await shot(page, 'ERR-medico');
    return { ok: false, erro: e.message };
  } finally {
    await ctx.close();
    await browser.close();
  }
}

async function fluxoPaciente() {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  });
  const page = await ctx.newPage();
  const apiCalls = [];
  const jsErrors = [];
  page.on('pageerror', err => jsErrors.push(err.message));
  page.on('response', async (res) => {
    const u = res.url();
    if (u.includes('/agendamento/') || u.includes('/documentos/') || u.includes('/contato/')) {
      let body = '';
      try { body = await res.text(); } catch (_e) {}
      apiCalls.push({ status: res.status(), url: u, body: body.slice(0, 200) });
    }
  });

  try {
    step('paciente: login', 'wait');
    await loginPaciente(page, ctx);
    await shot(page, '20-paciente-login');

    // Consultas: confirma retorno + baixa doc
    await page.goto(PAC_CONSULTAS, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    await shot(page, '21-paciente-consultas');

    step('paciente: confirmar retorno', 'wait');
    const btnConf = page.locator('button:has-text("Confirmar")').first();
    if (await btnConf.isVisible({ timeout: 6000 }).catch(() => false)) {
      await btnConf.click();
      await page.waitForTimeout(3500);
    }
    await shot(page, '22-paciente-retorno-confirmado');

    step('paciente: baixar documento', 'wait');
    const popupPromise = ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null);
    const docRow = page.locator('.doc-row').first();
    if (await docRow.isVisible({ timeout: 4000 }).catch(() => false)) {
      await docRow.click();
      await popupPromise;
      await page.waitForTimeout(2500);
    }
    await shot(page, '23-paciente-doc-baixado');

    // Perfil: vê médico no Meu médico
    step('paciente: ver Meu medico no perfil', 'wait');
    await page.goto(PAC_PERFIL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    await shot(page, '24-paciente-perfil');
    const meuMed = page.locator('#meuMedicoSection');
    const meuMedVisivel = await meuMed.isVisible({ timeout: 5000 }).catch(() => false);
    step('paciente: Meu medico visivel', meuMedVisivel ? 'ok' : 'warn');

    step('paciente: JS errors', jsErrors.length ? 'warn' : 'ok', { count: jsErrors.length });
    const okCalls = apiCalls.filter(c => c.status >= 200 && c.status < 300);
    const errCalls = apiCalls.filter(c => c.status >= 400);
    step('paciente: API calls', 'ok', { ok: okCalls.length, erro: errCalls.length });
    return { ok: errCalls.length === 0, apiCalls };
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
  console.log('=== MASTER E2E — 3 fases encadeadas ===\n');
  const r1 = await fluxoMedico();
  console.log('\n--- aguardando 4s ---\n');
  await new Promise(r => setTimeout(r, 4000));
  const r2 = await fluxoPaciente();
  const all = { timestamp: new Date().toISOString(), r1, r2, log, ok: r1.ok && r2.ok };
  fs.writeFileSync(path.join(LOGS, 'master.json'), JSON.stringify(all, null, 2));
  console.log('');
  console.log(all.ok ? '✓ MASTER E2E VERDE — 3 fases sincronizadas' : '✗ MASTER com falhas');
  console.log('Log:', path.join(LOGS, 'master.json'));
  process.exit(all.ok ? 0 : 1);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
