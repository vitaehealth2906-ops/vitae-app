// UX TEST — Helena Volume estressando IA Collab
// Helena: cardiologista, 50 pacientes/dia, impaciente, faz duplo/triplo clique se nao tem feedback
// Mede: tempo de loading, double-click race, mensagem de erro, retry, estados visuais

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SHOTS = path.join(__dirname, 'shots', 'ux-helena-ia');
fs.mkdirSync(SHOTS, { recursive: true });
const MED_URL = 'https://vitae-app.vercel.app/desktop/app-v2.html';
const PACIENTE = 'f9df2c03-690b-4bb7-9dc6-59a6f531489b';

const findings = [];
function log(kind, msg, data) {
  findings.push({ kind, msg, data });
  console.log(`[${kind}] ${msg}` + (data ? ' :: ' + JSON.stringify(data).slice(0, 200) : ''));
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const calls = [];
  page.on('response', async r => {
    if (r.url().includes('/ia-collab')) {
      const tElapsed = Date.now() - tStart;
      calls.push({ status: r.status(), t: tElapsed, url: r.url() });
    }
  });

  // Login + abre paciente
  await page.goto(MED_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
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
  await page.locator('a:has-text("Pacientes"), .nl:has-text("Pacientes")').first().click();
  await page.waitForTimeout(2000);
  await page.evaluate(pid => { window.STATE.selectedPaciente = pid; window.goto('pacientes-detail'); }, PACIENTE);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(SHOTS, '00-pos-load-paciente.png') });

  // ═══ CENÁRIO A — CLICK ÚNICO (Helena calma) ═══
  log('CENARIO', 'A — click unico Helena calma');
  let tStart = Date.now();
  const btn = page.locator('button:has-text("Comparar")').first();
  if (!(await btn.isVisible({ timeout: 5000 }).catch(() => false))) {
    log('FAIL', 'Botao Comparar nao aparece em 5s');
    process.exit(2);
  }
  await page.screenshot({ path: path.join(SHOTS, 'A-01-antes-click.png') });
  // Mede tempo até botão ficar disabled (deveria ficar pra evitar double-click)
  await btn.click();
  const tClicado = Date.now();
  await page.waitForTimeout(50);
  const disabledAfter50ms = await btn.isDisabled().catch(() => false);
  await page.waitForTimeout(150);
  const disabledAfter200ms = await btn.isDisabled().catch(() => false);
  log('UX-CLICK', 'Botao disabled apos click', { '50ms': disabledAfter50ms, '200ms': disabledAfter200ms });

  // Espera loading aparecer
  let loadingApareceuEm = null;
  for (let i = 0; i < 30; i++) {
    const has = await page.locator('.ia-load, .compare-card, .compare-cta').count();
    const hasLoad = await page.locator('.ia-load').isVisible().catch(() => false);
    if (hasLoad) { loadingApareceuEm = Date.now() - tClicado; break; }
    await page.waitForTimeout(100);
  }
  log('UX-LOAD', 'Loading apareceu em ms', { ms: loadingApareceuEm });
  await page.screenshot({ path: path.join(SHOTS, 'A-02-durante-load.png') });

  // Espera resultado/erro
  await page.waitForTimeout(7000);
  await page.screenshot({ path: path.join(SHOTS, 'A-03-pos-resultado.png') });
  const cardText = await page.locator('.compare-card .compare-b').first().innerText().catch(() => '(card nao encontrado)');
  log('UX-RESULTADO', 'Texto do card apos request', { texto: cardText.slice(0, 200) });
  const tempoTotal = Date.now() - tClicado;
  log('UX-TEMPO', 'Tempo total click->resultado', { ms: tempoTotal });

  // Tem botão "Tentar de novo"?
  const temRetry = await page.locator('.compare-card button, .compare-card a').count();
  log('UX-RETRY', 'Botoes/links dentro do compare-card', { count: temRetry });

  // ═══ CENÁRIO B — TRIPLO CLICK (Helena impaciente) ═══
  log('CENARIO', 'B — triplo click rapido Helena impaciente');
  // Reseta clicando "Comparar" se ainda aparecer (sumiu apos sucesso?)
  await page.evaluate(() => {
    if (window.STATE) { window.STATE.comparativoLigado = false; window.STATE.comparativoLoading = false; }
    if (window.COMPARE_MOCK) Object.keys(window.COMPARE_MOCK).forEach(k => delete window.COMPARE_MOCK[k]);
    if (typeof renderPacienteDetail === 'function') renderPacienteDetail();
  });
  await page.waitForTimeout(800);
  const btn2 = page.locator('button:has-text("Comparar")').first();
  const btn2Vis = await btn2.isVisible({ timeout: 3000 }).catch(() => false);
  log('UX-RESET', 'Botao Comparar visivel apos reset', { visivel: btn2Vis });
  if (btn2Vis) {
    tStart = Date.now();
    calls.length = 0;
    // 3 cliques em 200ms (simula Helena martelando)
    await btn2.click();
    await page.waitForTimeout(80);
    await btn2.click().catch(() => log('NOTE', 'segundo click rejeitado (provavelmente disabled)'));
    await page.waitForTimeout(80);
    await btn2.click().catch(() => log('NOTE', 'terceiro click rejeitado'));
    await page.waitForTimeout(5500);
    const numRequests = calls.length;
    log('UX-DOUBLECLICK', 'Quantas requests /ia-collab disparou apos 3 cliques rapidos', { count: numRequests, expected: 1 });
    if (numRequests > 1) log('BUG', 'DOUBLE-CLICK BUG — backend recebeu ' + numRequests + ' chamadas pra uma intencao do usuario');
    await page.screenshot({ path: path.join(SHOTS, 'B-01-pos-triplo-click.png') });
  }

  // ═══ CENÁRIO C — Tentar reabrir após erro (Helena: "deve ter sido só agora") ═══
  log('CENARIO', 'C — reabrir card apos ver erro');
  const cardErroVisivel = await page.locator('.compare-card').isVisible().catch(() => false);
  log('UX-ESTADO', 'Card com mensagem de erro visivel?', { visivel: cardErroVisivel });
  if (cardErroVisivel) {
    // Helena tenta clicar no card pra ver se reabre o flow
    await page.locator('.compare-card').click().catch(() => {});
    await page.waitForTimeout(1000);
    const reabriu = await page.locator('.compare-cta').isVisible().catch(() => false);
    log('UX-RECOVERY', 'Click no card de erro reabre opcao de tentar', { reabriu });
    if (!reabriu) log('FRUSTRACAO', 'Sem caminho visivel pra tentar de novo apos ver erro. Helena pensa: APP ESTA QUEBRADO');
  }

  // ═══ CENÁRIO D — F5 (Helena desesperada) ═══
  log('CENARIO', 'D — F5 / reload (Helena desistiu, comeca do zero)');
  await page.reload();
  await page.waitForTimeout(4000);
  await page.locator('a:has-text("Pacientes"), .nl:has-text("Pacientes")').first().click();
  await page.waitForTimeout(2000);
  await page.evaluate(pid => { window.STATE.selectedPaciente = pid; window.goto('pacientes-detail'); }, PACIENTE);
  await page.waitForTimeout(6000);
  const btnAposReload = await page.locator('button:has-text("Comparar")').first().isVisible().catch(() => false);
  log('UX-PERSIST', 'Apos F5+abrir paciente, botao Comparar volta?', { visivel: btnAposReload });
  await page.screenshot({ path: path.join(SHOTS, 'D-01-apos-reload.png') });

  // Final
  fs.writeFileSync(path.join(__dirname, 'logs', 'ux-helena-ia.json'), JSON.stringify({ findings, calls }, null, 2));
  console.log('\n=== RESUMO ===');
  findings.forEach(f => console.log(f.kind, '-', f.msg));
  await ctx.close();
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
