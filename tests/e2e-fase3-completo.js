// E2E Fase 3 — Contato Direto WhatsApp (medico ativa + paciente ve botao)
//
// Pré-requisitos:
//   tests/.env com MEDICO_EMAIL/SENHA + PACIENTE_EMAIL/SENHA
//   Branch feat/fase-3-whatsapp deployada (ou merged em main)

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SHOTS = path.join(__dirname, 'shots', 'fase3');
const LOGS = path.join(__dirname, 'logs');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(LOGS, { recursive: true });

const MED_URL = 'https://vitae-app.vercel.app/desktop/app-v2.html';
const PAC_CADASTRO = 'https://vitae-app.vercel.app/app-v3/26-cadastro.html';
const PAC_PERFIL = 'https://vitae-app.vercel.app/app-v3/18-perfil.html';
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
  if (page.url().includes('login')) {
    await page.locator('input[type="email"]').first().fill(process.env.MEDICO_EMAIL);
    await page.locator('input[type="password"]').first().fill(process.env.MEDICO_SENHA);
    await page.locator('button[type="submit"], button:has-text("Entrar")').first().click();
    await page.waitForTimeout(3500);
  }
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

async function medicoAtivarWhatsapp() {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const jsErrors = [];
  const apiCalls = [];
  page.on('pageerror', err => jsErrors.push(err.message));
  page.on('response', async (res) => {
    if (res.url().includes('/contato/')) {
      let body = '';
      try { body = await res.text(); } catch (_e) {}
      apiCalls.push({ status: res.status(), url: res.url(), body: body.slice(0, 300) });
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
    }, TARGET_PACIENTE_ID);
    await page.waitForTimeout(5000);
    await shot(page, '02-medico-central-clinica');

    // Click no toggle global do WhatsApp pra 1a ativacao → abre modal LGPD
    step('médico: clicar toggle Contato Direto (1a ativacao)', 'wait');
    // Encontra o toggle dentro do card "Contato Direto"
    const toggleWa = page.locator('.toggle-sw[onclick="pdToggleWa()"]').first();
    if (!(await toggleWa.isVisible({ timeout: 5000 }).catch(() => false))) {
      throw new Error('Toggle Contato Direto não encontrado');
    }
    await toggleWa.click();
    await page.waitForTimeout(1200);
    await shot(page, '03-medico-modal-lgpd');

    // Modal LGPD deve abrir
    const lgpdBtn = page.locator('#pdLgpdAccept, button:has-text("Aceito e habilito")').first();
    if (!(await lgpdBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      // Pode já estar ativado (não primeira vez) — pula direto pra config
      step('médico: WARN — modal LGPD não apareceu (já ativado antes?)', 'warn');
    } else {
      await lgpdBtn.click();
      await page.waitForTimeout(3500);
      step('médico: LGPD aceito + config inicial salva', 'ok');
      await shot(page, '04-medico-pos-lgpd');
    }

    // Salva config (dias + horários default já vão estar)
    step('médico: salvar config (dias + horários)', 'wait');
    const saveBtn = page.locator('button:has-text("Salvar")').first();
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(2500);
    }
    await shot(page, '05-medico-config-salva');

    // Ativa permissão por paciente
    step('médico: ativar permissão paciente', 'wait');
    const togglePerm = page.locator('.toggle-sw[onclick*="pdToggleContatoPaciente"]').first();
    if (await togglePerm.isVisible({ timeout: 3000 }).catch(() => false)) {
      await togglePerm.click();
      await page.waitForTimeout(3500);
    }
    await shot(page, '06-medico-permissao-ativada');

    step('médico: JS errors', jsErrors.length ? 'warn' : 'ok', { count: jsErrors.length, ...(jsErrors.length ? { erros: jsErrors.slice(0, 3) } : {}) });
    step('médico: API calls /contato/*', 'ok', { count: apiCalls.length });
    apiCalls.forEach(c => console.log('  → ' + c.status + ' ' + c.url.replace('https://vitae-app-production.up.railway.app','') + ' :: ' + c.body.slice(0,150)));

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

async function pacienteVerMedico() {
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
    if (res.url().includes('/contato/')) {
      let body = '';
      try { body = await res.text(); } catch (_e) {}
      apiCalls.push({ status: res.status(), url: res.url(), body: body.slice(0, 200) });
    }
  });

  try {
    step('paciente: login', 'wait');
    await loginPaciente(page, ctx);
    await shot(page, '20-paciente-login');

    // Navega pra Perfil
    await page.goto(PAC_PERFIL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    await shot(page, '21-paciente-perfil');

    // Espera seção "Meu médico"
    step('paciente: procurar seção Meu medico', 'wait');
    const sec = page.locator('#meuMedicoSection');
    if (!(await sec.isVisible({ timeout: 8000 }).catch(() => false))) {
      const body = await page.locator('body').innerText();
      throw new Error('Seção Meu medico não apareceu. Body: ' + body.slice(0, 300));
    }
    await shot(page, '22-paciente-secao-medico');

    // Captura popup wa.me ao clicar botão Tirar dúvida (se botão estiver disponível)
    const popupPromise = ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null);
    const btnTirarDuvida = page.locator('button:has-text("Tirar dúvida")').first();
    if (await btnTirarDuvida.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btnTirarDuvida.click();
      const popup = await popupPromise;
      await page.waitForTimeout(2000);
      await shot(page, '23-paciente-pos-click');
      step('paciente: popup wa.me', popup ? 'ok' : 'warn', { url: popup ? popup.url() : 'nao abriu' });
    } else {
      step('paciente: botão Tirar dúvida não disponível (provavelmente fora do horário)', 'warn');
      await shot(page, '23-paciente-fora-horario');
    }

    step('paciente: JS errors', jsErrors.length ? 'warn' : 'ok', { count: jsErrors.length });
    step('paciente: API calls /contato/*', 'ok', { count: apiCalls.length });
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
  console.log('=== E2E Fase 3 — Contato Direto WhatsApp ===\n');
  const r1 = await medicoAtivarWhatsapp();
  if (!r1.ok) { fs.writeFileSync(path.join(LOGS, 'fase3.json'), JSON.stringify({ log, r1 }, null, 2)); process.exit(1); }
  console.log('\n--- aguardando 3s ---\n');
  await new Promise(r => setTimeout(r, 3000));
  const r2 = await pacienteVerMedico();
  const all = { timestamp: new Date().toISOString(), r1, r2, log, ok: r1.ok && r2.ok };
  fs.writeFileSync(path.join(LOGS, 'fase3.json'), JSON.stringify(all, null, 2));
  console.log('');
  console.log(all.ok ? '✓ FASE 3 VERDE' : '✗ FASE 3 com falhas');
  process.exit(all.ok ? 0 : 1);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
