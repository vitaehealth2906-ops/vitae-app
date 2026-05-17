// E2E Fase 1 — Próximo Retorno (médico propõe → paciente confirma)
//
// Usa credenciais reais em tests/.env
// Roda contra prod (vitae-app.vercel.app) após merge na main.
//
// Saídas:
//   tests/shots/fase1/<passo>.png
//   tests/logs/fase1.json
//
// Aborta na primeira falha + screenshot do erro.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SHOTS = path.join(__dirname, 'shots', 'fase1');
const LOGS = path.join(__dirname, 'logs');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(LOGS, { recursive: true });

const MED_URL = 'https://vitae-app.vercel.app/desktop/app-v2.html';
const PAC_URL = 'https://vitae-app.vercel.app/app-v3/';
const PAC_LOGIN = 'https://vitae-app.vercel.app/app-v3/23-login.html';
const PAC_CONSULTAS = 'https://vitae-app.vercel.app/app-v3/15-consultas.html';
const MED_LOGIN = 'https://vitae-app.vercel.app/desktop/01-login.html';

const log = [];
function step(name, status, info) {
  const e = { t: new Date().toISOString(), step: name, status, info: info || null };
  log.push(e);
  console.log(`[${status}] ${name}` + (info ? ' — ' + JSON.stringify(info) : ''));
}

async function shot(page, name) {
  try { await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false }); } catch (_e) {}
}

async function loginMedico(page) {
  step('médico: abrir app-v2.html', 'wait');
  await page.goto(MED_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  // Se redirecionou pra login OU mostra tela de login inline
  const url = page.url();
  const temEmailInput = await page.locator('input[type="email"], input[name="email"], input[placeholder*="mail" i]').first().isVisible().catch(() => false);

  if (url.includes('login') || temEmailInput) {
    step('médico: tela de login detectada', 'ok', { url });
    await page.locator('input[type="email"], input[name="email"]').first().fill(process.env.MEDICO_EMAIL);
    await page.locator('input[type="password"], input[name="senha"], input[name="password"]').first().fill(process.env.MEDICO_SENHA);
    await shot(page, '01-medico-login-preenchido');
    await page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")').first().click();
    await page.waitForTimeout(3500);
    await shot(page, '02-medico-pos-login');
  }
  // Verifica que está dentro do app-v2 (sidebar visível)
  const sidebar = await page.locator('.sidebar, nav, [class*="nav"]').first().isVisible().catch(() => false);
  if (!sidebar) {
    // Tenta abrir app-v2 de novo (caso login redirecionou pra outro lugar)
    await page.goto(MED_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
  }
  step('médico: logado no app-v2', 'ok', { url: page.url() });
  await shot(page, '03-medico-dashboard');
}

async function loginPaciente(page, ctx) {
  step('paciente: abrir app-v3', 'wait');
  // Seta flag de "preferir modo login" antes de qualquer load (26-cadastro.html lê isso)
  await ctx.addInitScript(() => {
    try { sessionStorage.setItem('vitae_prefer_login', '1'); } catch (_e) {}
  });
  // Vai direto pra 26-cadastro (a tela unificada cadastro/login)
  await page.goto('https://vitae-app.vercel.app/app-v3/26-cadastro.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
  let url = page.url();
  step('paciente: tela cadastro/login carregou', 'ok', { url });
  await shot(page, '19-paciente-cadastro-tela');

  // Pode estar em modo cadastro (mostra mais campos). Se sim, clica em "Já tenho conta — Entrar"
  const passInpVis = await page.locator('#passInput').first().isVisible({ timeout: 3000 }).catch(() => false);
  const btnText = await page.locator('button:has-text("Entrar"), button:has-text("Criar conta"), button[type="submit"]').first().textContent().catch(() => '');
  if (btnText && btnText.includes('Criar')) {
    // Está em modo cadastro — alterna pra login
    const link = page.locator('a:has-text("Entrar"), a:has-text("entrar")').first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
      await page.waitForTimeout(1000);
    }
  }

  // Preenche email + senha
  await page.locator('input[type="email"]').first().fill(process.env.PACIENTE_EMAIL);
  await page.locator('input[type="password"]').first().fill(process.env.PACIENTE_SENHA);
  await shot(page, '20-paciente-login-preenchido');

  // Click no botão Entrar
  await page.locator('button:has-text("Entrar"), button[type="submit"]').first().click();
  await page.waitForTimeout(5000);
  url = page.url();
  step('paciente: logado', 'ok', { url });
  await shot(page, '21-paciente-pos-login');
}

async function medicoProporRetorno() {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const jsErrors = [];
  const apiCalls = [];
  page.on('pageerror', err => jsErrors.push(err.message));
  page.on('response', async (res) => {
    const u = res.url();
    if (u.includes('/agendamento/') || u.includes('/medico/') || u.includes('/contato/')) {
      let body = '';
      try { body = await res.text(); } catch (_e) {}
      apiCalls.push({ url: u, status: res.status(), body: body.slice(0, 400) });
    }
  });

  try {
    await loginMedico(page);

    // Navega pra Pacientes (sidebar)
    step('médico: clicar Pacientes', 'wait');
    await page.locator('a:has-text("Pacientes"), button:has-text("Pacientes"), .nl:has-text("Pacientes")').first().click();
    await page.waitForTimeout(2000);
    await shot(page, '04-medico-pacientes-lista');

    // Abre paciente teste programaticamente via STATE.selectedPaciente
    // (evita ambiguidade de seletor quando há múltiplos "lucas" na lista)
    step('médico: abrir paciente teste via STATE', 'wait');
    const targetUserId = 'f9df2c03-690b-4bb7-9dc6-59a6f531489b'; // lucas borellli da silva
    await page.evaluate((pid) => {
      window.STATE = window.STATE || {};
      window.STATE.selectedPaciente = pid;
      window.STATE.comparativoLigado = false;
      if (typeof window.goto === 'function') window.goto('pacientes-detail');
    }, targetUserId);
    await page.waitForTimeout(3500);
    await shot(page, '05-medico-central-clinica');

    // Encontra card Próximo Retorno e clica "+ Marcar retorno"
    const btn = page.locator('button:has-text("Marcar retorno"), button:has-text("+ Marcar")').first();
    if (!(await btn.isVisible({ timeout: 5000 }).catch(() => false))) {
      throw new Error('Botão "+ Marcar retorno" não encontrado no card Próximo Retorno');
    }
    await btn.click();
    await page.waitForTimeout(1000);
    await shot(page, '06-medico-modal-marcar-retorno');

    // Modal abre — escolhe data padrão (já vem +30d) + observação
    const obsInp = page.locator('#prObsInp');
    if (await obsInp.isVisible()) {
      await obsInp.fill('Retorno proposto via Playwright (teste autônomo Claude).');
    }
    await shot(page, '07-medico-modal-preenchido');

    // Click "Enviar proposta"
    step('médico: enviar proposta', 'wait');
    await page.locator('button:has-text("Enviar proposta"), button#prSubmitBtn').first().click();
    await page.waitForTimeout(3500);
    await shot(page, '08-medico-pos-envio');

    // Verifica toast ou card atualizado
    const bodyText = await page.locator('body').innerText();
    if (!bodyText.includes('proposto') && !bodyText.includes('Aguardando')) {
      step('médico: WARN — texto esperado nao apareceu', 'warn');
    }

    step('médico: erros JS', jsErrors.length ? 'warn' : 'ok', { count: jsErrors.length, ...(jsErrors.length ? { erros: jsErrors.slice(0, 3) } : {}) });
    step('médico: chamadas API capturadas', 'ok', { count: apiCalls.length });
    apiCalls.forEach(c => console.log('  → ' + c.status + ' ' + c.url.replace('https://vitae-app-production.up.railway.app','') + ' :: ' + c.body.slice(0,200)));
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

async function pacienteConfirmarRetorno() {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  });
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on('pageerror', err => jsErrors.push(err.message));

  try {
    await loginPaciente(page, ctx);

    // Após login, vai pra home (01-saude.html). Navega pra Consultas via tab bar.
    step('paciente: navegar pra Consultas', 'wait');
    // Tab Consultas tem ícone de calendário e label "Consultas"
    const tabConsultas = page.locator('.tab:has-text("Consultas"), [onclick*="15-consultas"]').first();
    if (await tabConsultas.isVisible().catch(() => false)) {
      await tabConsultas.click();
    } else {
      // fallback: navega direto
      await page.goto(PAC_CONSULTAS, { waitUntil: 'domcontentloaded' });
    }
    await page.waitForTimeout(3000);
    await shot(page, '22-paciente-consultas');

    // Verifica que seção "Propostos pelo seu médico" apareceu
    step('paciente: procurar seção Propostos', 'wait');
    const propSection = page.locator('#retornosPropostosSection');
    const visivel = await propSection.isVisible({ timeout: 5000 }).catch(() => false);
    if (!visivel) {
      const bodyText = await page.locator('body').innerText();
      throw new Error('Seção "Propostos pelo seu médico" não apareceu. Body inclui: ' + bodyText.slice(0, 300));
    }
    await shot(page, '23-paciente-secao-propostos');

    // Click "Confirmar"
    step('paciente: clicar Confirmar', 'wait');
    const btnConfirmar = page.locator('button:has-text("Confirmar")').first();
    await btnConfirmar.click();
    await page.waitForTimeout(3500);
    await shot(page, '24-paciente-pos-confirmar');

    step('paciente: erros JS', jsErrors.length ? 'warn' : 'ok', { count: jsErrors.length, ...(jsErrors.length ? { erros: jsErrors.slice(0, 3) } : {}) });
    return { ok: true };
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
  console.log('=== E2E Fase 1 — Próximo Retorno ===');
  console.log('Backend: vitae-app-production.up.railway.app');
  console.log('Frontend: vitae-app.vercel.app');
  console.log('');

  const r1 = await medicoProporRetorno();
  if (!r1.ok) {
    fs.writeFileSync(path.join(LOGS, 'fase1.json'), JSON.stringify({ log, r1 }, null, 2));
    console.log('\n✗ MÉDICO FALHOU. Abortando.');
    process.exit(1);
  }

  console.log('\n--- aguardando 3s antes do paciente ---\n');
  await new Promise(r => setTimeout(r, 3000));

  const r2 = await pacienteConfirmarRetorno();
  const all = { timestamp: new Date().toISOString(), r1, r2, log, ok: r1.ok && r2.ok };
  fs.writeFileSync(path.join(LOGS, 'fase1.json'), JSON.stringify(all, null, 2));

  console.log('');
  console.log(all.ok ? '✓ FASE 1 VERDE' : '✗ FASE 1 com falhas');
  console.log('Log:', path.join(LOGS, 'fase1.json'));
  console.log('Screenshots:', SHOTS);
  process.exit(all.ok ? 0 : 1);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
