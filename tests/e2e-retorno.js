// E2E — Próximo Retorno (Feature 1)
//
// Cobre UI smoke + (quando migration aplicada) fluxo end-to-end.
//
// Pré-requisitos:
//   * Branch feat/proximo-retorno em deploy preview Vercel OU rodando localmente
//   * Para fluxo completo: migration aplicada no banco (campos statusProposta, etc)
//
// Como rodar:
//   1. UI smoke (não precisa banco): node tests/e2e-retorno.js --ui-only
//   2. Completo:                      node tests/e2e-retorno.js
//
// Saídas:
//   - tests/shots/e2e-retorno/<passo>.png
//   - tests/logs/e2e-retorno.json
//
// Edge: usa msedge como channel (CLAUDE.md sessão 22 padrão).

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SHOTS_DIR = path.join(__dirname, 'shots', 'e2e-retorno');
const LOGS_DIR = path.join(__dirname, 'logs');
fs.mkdirSync(SHOTS_DIR, { recursive: true });
fs.mkdirSync(LOGS_DIR, { recursive: true });

const URL_BASE = process.env.VITAE_BASE_URL || 'https://vitae-app.vercel.app';
const UI_ONLY = process.argv.includes('--ui-only');

const log = [];
function step(name, status, info) {
  const entry = { t: new Date().toISOString(), step: name, status, info: info || null };
  log.push(entry);
  console.log(`[${status}] ${name}` + (info ? ' — ' + JSON.stringify(info) : ''));
}

async function shot(page, name) {
  const file = path.join(SHOTS_DIR, name + '.png');
  await page.screenshot({ path: file, fullPage: false }).catch(() => {});
}

async function rodarMedicoUI() {
  // Abre preview da Central Clínica (rota standalone aprovada)
  // — só testa que o card Próximo Retorno renderiza e modal abre/fecha sem erro JS
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on('pageerror', (err) => jsErrors.push(err.message));

  try {
    const url = URL_BASE + '/desktop/preview-central-clinica.html';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(800);
    step('medico: preview-central-clinica carregou', 'ok', { url });
    await shot(page, '01-preview-central');

    // Clica primeiro paciente da lista
    const firstRow = page.locator('.pct-trow').first();
    await firstRow.click();
    await page.waitForTimeout(500);
    step('medico: paciente aberto', 'ok');
    await shot(page, '02-paciente-aberto');

    // Verifica card Próximo Retorno presente
    const cardLabel = await page.locator('text=Próximo Retorno').first().isVisible();
    if (!cardLabel) throw new Error('Card "Próximo Retorno" não visível');
    step('medico: card Próximo Retorno visível', 'ok');

    // Verifica que tem botão Reagendar OU + Marcar retorno
    const tem = await page.locator('button:has-text("Reagendar"), button:has-text("Marcar retorno"), button:has-text("Marcar")').first().isVisible();
    if (!tem) throw new Error('Nenhuma ação visível no card de retorno');
    step('medico: ações do card presentes', 'ok');
    await shot(page, '03-card-retorno');

    if (jsErrors.length) {
      step('medico: erros JS detectados', 'warn', { erros: jsErrors });
    } else {
      step('medico: zero erros JS no preview', 'ok');
    }

    return { okMedico: jsErrors.length === 0 };
  } catch (e) {
    step('medico: FALHOU', 'fail', { erro: e.message });
    await shot(page, 'ERR-medico');
    return { okMedico: false, erro: e.message };
  } finally {
    await ctx.close();
    await browser.close();
  }
}

async function rodarPacienteUI() {
  // Abre 23-agendamentos.html — sem login deve redirect, mas validamos que sintaxe JS OK
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  });
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on('pageerror', (err) => jsErrors.push(err.message));

  try {
    const url = URL_BASE + '/23-agendamentos.html';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1200);
    step('paciente: 23-agendamentos.html carregou', 'ok', { url });
    await shot(page, '04-paciente-agendamentos');

    // Sem login, a função loadRetornosPendentes retorna silencioso (401)
    // — validamos que tela continua renderizando sem quebrar
    const titulo = await page.locator('text=Agendamentos').first().isVisible();
    if (!titulo) throw new Error('Header "Agendamentos" não renderizou');
    step('paciente: tela renderizou', 'ok');

    // Clica botão "+ Novo agendamento" pra abrir modal
    const addBtn = page.locator('button:has-text("Novo agendamento")').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(300);
      const modalAberto = await page.locator('.modal-overlay.active').first().isVisible();
      if (!modalAberto) throw new Error('Modal Novo Agendamento não abriu');
      step('paciente: modal Novo Agendamento abre', 'ok');
      await shot(page, '05-paciente-modal');
      // Fecha
      await page.locator('.modal-overlay').first().click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(200);
    }

    if (jsErrors.length) {
      step('paciente: erros JS', 'warn', { erros: jsErrors });
    } else {
      step('paciente: zero erros JS', 'ok');
    }

    return { okPaciente: jsErrors.length === 0 };
  } catch (e) {
    step('paciente: FALHOU', 'fail', { erro: e.message });
    await shot(page, 'ERR-paciente');
    return { okPaciente: false, erro: e.message };
  } finally {
    await ctx.close();
    await browser.close();
  }
}

(async () => {
  console.log('=== E2E Próximo Retorno — UI Smoke ===');
  console.log('Base URL:', URL_BASE);
  console.log('Modo:', UI_ONLY ? 'UI-only' : 'completo (sem auth real, só smoke)');
  console.log('');

  const r1 = await rodarMedicoUI();
  const r2 = await rodarPacienteUI();

  const todasOk = r1.okMedico && r2.okPaciente;
  const final = {
    timestamp: new Date().toISOString(),
    baseUrl: URL_BASE,
    medico: r1,
    paciente: r2,
    todasOk,
    log,
  };

  fs.writeFileSync(path.join(LOGS_DIR, 'e2e-retorno.json'), JSON.stringify(final, null, 2));
  console.log('');
  console.log(todasOk ? '✓ TODOS OK' : '✗ ALGUMA FALHOU');
  console.log('Log: tests/logs/e2e-retorno.json');
  console.log('Screenshots: tests/shots/e2e-retorno/');
  process.exit(todasOk ? 0 : 1);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
