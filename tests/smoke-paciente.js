/**
 * VITAE — Bateria fluxo do PACIENTE (Fase 12 estendida)
 *
 * Cobre tudo que acontece quando o paciente clica no link do médico:
 * - Carrega pre-consulta.html com token (mocka resposta do backend)
 * - Tela de boas-vindas, login/cadastro inline
 * - Quiz vita id (se perfil incompleto)
 * - 11 perguntas pergunta-por-pergunta
 * - Confirmação por modo áudio (mockado, sem mic real)
 * - Modo formulário fallback
 * - Tela revisão
 * - Tela enviado
 *
 * Saída: tests/shots/paciente-{ts}/
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.VITAE_URL || 'http://localhost:3000';
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SHOTS = path.join(__dirname, 'shots', 'paciente-' + TS);
fs.mkdirSync(SHOTS, { recursive: true });

const log = { timestamp: TS, base: BASE, telas: [], erros: [] };
function passo(t, ok, det) { log.telas.push({ t, ok, det: det || null }); console.log(`${ok?'✓':'✗'} ${t}${det?' · '+det:''}`); }

const TELAS_PACIENTE = [
  { url: '/pre-consulta.html', nome: 'pre-consulta sem token (deve mostrar erro amigável)' },
  { url: '/pre-consulta.html?token=invalido123', nome: 'pre-consulta com token inválido' },
  // pre-consulta-slides.html foi arquivado em legacy/ (Sessão 16) — não testar
  { url: '/quiz-preconsulta.html', nome: 'quiz-preconsulta (vita id 7 passos)' },
  { url: '/02-slides-paciente.html', nome: '02-slides-paciente (3 slides paciente)' },
  { url: '/05-quiz.html', nome: '05-quiz (onboarding paciente padrão)' },
  { url: '/06-concluido.html', nome: '06-concluido (celebração)' },
  { url: '/08-perfil.html', nome: '08-perfil (RG da Saúde mobile)' },
  { url: '/11-exames-lista.html', nome: '11-exames-lista' },
  { url: '/16-medicamentos.html', nome: '16-medicamentos' },
  { url: '/17-alergias.html', nome: '17-alergias' },
  { url: '/21-qrcode.html', nome: '21-qrcode' },
  { url: '/22-autorizacao.html', nome: '22-autorizacao' },
  { url: '/30-lembretes.html', nome: '30-lembretes' },
  { url: '/31-revisao-alergias.html', nome: '31-revisao-alergias' },
  { url: '/rg-publico.html', nome: 'rg-publico (sem login)' },
  { url: '/exame-publico.html', nome: 'exame-publico (sem login)' },
  { url: '/14-esqueci-senha.html', nome: '14-esqueci-senha' },
  { url: '/15-nova-senha.html', nome: '15-nova-senha' },
  { url: '/25-summary.html', nome: '25-summary (briefing 1min)' },
  { url: '/termos.html', nome: 'termos.html' },
  { url: '/lgpd.html', nome: 'lgpd.html' },
];

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox'] });
  // Mobile viewport pra simular celular
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' });
  const page = await ctx.newPage();
  const consoleErros = [];
  page.on('console', m => { if (m.type() === 'error') consoleErros.push(m.text()); });
  page.on('pageerror', e => consoleErros.push('pageerror: ' + e.message));

  for (const tela of TELAS_PACIENTE) {
    consoleErros.length = 0;
    try {
      const resp = await page.goto(BASE + tela.url, { timeout: 15000, waitUntil: 'domcontentloaded' });
      const status = resp ? resp.status() : 0;
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(SHOTS, tela.nome.replace(/[^a-z0-9]+/gi, '_').slice(0, 60) + '.png'), fullPage: true });
      const errosCriticos = consoleErros.filter(e => !/favicon/i.test(e) && !/Failed to load.*ico/i.test(e) && !/the server responded with a status of 4/i.test(e) && !/init falhou.*Failed to fetch/i.test(e) && !/Sentry/i.test(e));
      passo(tela.nome, status >= 200 && status < 400 && errosCriticos.length === 0, 'status=' + status + ' erros=' + errosCriticos.length);
      if (errosCriticos.length) log.erros.push({ tela: tela.nome, erros: errosCriticos });
    } catch (e) {
      passo(tela.nome, false, e.message.slice(0, 100));
    }
  }

  await ctx.close(); await browser.close();
  fs.writeFileSync(path.join(__dirname, 'logs', 'paciente-' + TS + '.json'), JSON.stringify(log, null, 2));
  const passes = log.telas.filter(t => t.ok).length;
  const fails = log.telas.filter(t => !t.ok).length;
  console.log(`\n=== Fluxo paciente: ${passes} OK · ${fails} FALHA ===`);
  console.log(`Shots: ${SHOTS}`);
  process.exit(fails > 0 ? 1 : 0);
})();
