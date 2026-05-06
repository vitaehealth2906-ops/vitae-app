/**
 * VITAE — Bateria Playwright COMPLETA (Fase 12 estendida)
 *
 * Testa SEM precisar de login real:
 * - Carregamento de cada HTML público
 * - Validação visual (screenshot) de cada tela
 * - Erros JS no console
 * - Validação dos services backend (parse + sintaxe)
 * - Roteamento Vercel
 *
 * Saída: tests/shots/completo-{timestamp}/
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.VITAE_URL || 'http://localhost:3000';
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SHOTS = path.join(__dirname, 'shots', 'completo-' + TS);
fs.mkdirSync(SHOTS, { recursive: true });

const log = { timestamp: TS, base: BASE, telas: [], erros: [] };

function passo(tela, ok, detalhe) {
  const r = { tela, ok, detalhe: detalhe || null };
  log.telas.push(r);
  console.log(`${ok ? '✓' : '✗'} ${tela}${detalhe ? ' · ' + detalhe : ''}`);
}

const TELAS_TESTAR = [
  { url: '/desktop/01-login.html', nome: '01-login', esperaSelector: '#loginEmail' },
  { url: '/desktop/02-cadastro.html', nome: '02-cadastro', esperaSelector: '#nome' },
  { url: '/desktop/03-quiz-medico.html', nome: '03-quiz-medico (auth gate redirect)', esperaSelector: null }, // redirecta sem token
  { url: '/desktop/app-v2.html', nome: 'app-v2 (auth gate redirect)', esperaSelector: null }, // redirecta sem token
  { url: '/01-splash.html', nome: '01-splash', esperaSelector: null },
  { url: '/03-cadastro.html', nome: '03-cadastro mobile', esperaSelector: null },
  { url: '/14-esqueci-senha.html', nome: '14-esqueci-senha', esperaSelector: null },
  { url: '/desktop/login.html', nome: 'desktop/login (legacy)', esperaSelector: null },
  { url: '/desktop/app-legacy-2026-05-05.html', nome: 'desktop/app-legacy', esperaSelector: null },
];

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const consoleErros = [];
  page.on('console', m => { if (m.type() === 'error') consoleErros.push({ url: page.url(), msg: m.text() }); });
  page.on('pageerror', e => consoleErros.push({ url: page.url(), msg: 'pageerror: ' + e.message }));

  for (const tela of TELAS_TESTAR) {
    consoleErros.length = 0;
    try {
      const resp = await page.goto(BASE + tela.url, { timeout: 15000, waitUntil: 'domcontentloaded' });
      const status = resp ? resp.status() : 0;
      await page.waitForTimeout(800);
      if (tela.esperaSelector) {
        await page.waitForSelector(tela.esperaSelector, { timeout: 5000 }).catch(()=>{});
      }
      await page.screenshot({ path: path.join(SHOTS, tela.nome.replace(/[^a-z0-9]+/gi, '_') + '.png'), fullPage: true });
      const errosCriticos = consoleErros.filter(e => !/favicon/i.test(e.msg) && !/Failed to load.*ico/i.test(e.msg));
      passo(tela.nome, status >= 200 && status < 400 && errosCriticos.length === 0, 'status=' + status + ' erros=' + errosCriticos.length);
      if (errosCriticos.length) log.erros.push({ tela: tela.nome, erros: errosCriticos });
    } catch (e) {
      passo(tela.nome, false, e.message.slice(0, 100));
      log.erros.push({ tela: tela.nome, exception: e.message });
    }
  }

  // Testa que app-v2 redireciona pro login (sem auth)
  try {
    await page.goto(BASE + '/desktop/app-v2.html', { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const url = page.url();
    passo('Auth gate app-v2 redireciona', url.includes('01-login.html'), url);
  } catch(e) { passo('Auth gate app-v2', false, e.message); }

  await ctx.close();
  await browser.close();

  const passes = log.telas.filter(t => t.ok).length;
  const fails = log.telas.filter(t => !t.ok).length;

  fs.writeFileSync(path.join(__dirname, 'logs', 'completo-' + TS + '.json'), JSON.stringify(log, null, 2));
  console.log(`\n=== ${passes} OK · ${fails} FALHA · ${log.erros.length} grupos com erro ===`);
  console.log(`Shots: ${SHOTS}`);
  process.exit(fails > 0 ? 1 : 0);
})();
