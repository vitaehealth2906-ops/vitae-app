/**
 * AUDITORIA EXAUSTIVA — 2026-05-20
 *
 * Navega CADA tela do projeto, captura tudo: requests, 404s, erros console,
 * erros página, tira screenshot. Output JSON estruturado + PNGs.
 *
 * Pra acelerar: 4 contextos em paralelo.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, '_audit-FULL-2026-05-20');
const OUT_JSON = path.join(OUT_DIR, '_resultado.json');
const SHOTS_DIR = path.join(OUT_DIR, 'shots');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const TELAS = [
  // ─── PACIENTE RAIZ (01-31) ───
  { id: 'P-raiz-01-splash', url: '/01-splash.html', cat: 'paciente-raiz', viewport: 'mobile' },
  { id: 'P-raiz-02-slides-paciente', url: '/02-slides-paciente.html', cat: 'paciente-raiz', viewport: 'mobile' },
  { id: 'P-raiz-03-cadastro', url: '/03-cadastro.html', cat: 'paciente-raiz', viewport: 'mobile' },
  { id: 'P-raiz-04-verificacao', url: '/04-verificacao.html', cat: 'paciente-raiz', viewport: 'mobile' },
  { id: 'P-raiz-05-quiz', url: '/05-quiz.html', cat: 'paciente-raiz', viewport: 'mobile' },
  { id: 'P-raiz-06-concluido', url: '/06-concluido.html', cat: 'paciente-raiz', viewport: 'mobile' },
  { id: 'P-raiz-08-perfil', url: '/08-perfil.html', cat: 'paciente-raiz', viewport: 'mobile', logged: true },
  { id: 'P-raiz-09-dados-pessoais', url: '/09-dados-pessoais.html', cat: 'paciente-raiz', viewport: 'mobile', logged: true },
  { id: 'P-raiz-10-score', url: '/10-score.html', cat: 'paciente-raiz', viewport: 'mobile', logged: true },
  { id: 'P-raiz-11-exames-lista', url: '/11-exames-lista.html', cat: 'paciente-raiz', viewport: 'mobile', logged: true },
  { id: 'P-raiz-14-esqueci-senha', url: '/14-esqueci-senha.html', cat: 'paciente-raiz', viewport: 'mobile' },
  { id: 'P-raiz-15-bioage', url: '/15-bioage-sem-dados.html', cat: 'paciente-raiz', viewport: 'mobile', logged: true },
  { id: 'P-raiz-15-nova-senha', url: '/15-nova-senha.html', cat: 'paciente-raiz', viewport: 'mobile' },
  { id: 'P-raiz-16-medicamentos', url: '/16-medicamentos.html', cat: 'paciente-raiz', viewport: 'mobile', logged: true },
  { id: 'P-raiz-17-alergias', url: '/17-alergias.html', cat: 'paciente-raiz', viewport: 'mobile', logged: true },
  { id: 'P-raiz-30-lembretes', url: '/30-lembretes.html', cat: 'paciente-raiz', viewport: 'mobile', logged: true },
  { id: 'P-raiz-31-revisao-alergias', url: '/31-revisao-alergias.html', cat: 'paciente-raiz', viewport: 'mobile', logged: true },

  // ─── PACIENTE APP-V3 ───
  { id: 'P-v3-shell-app', url: '/app-v3/app.html', cat: 'paciente-v3', viewport: 'mobile', logged: true },
  { id: 'P-v3-index', url: '/app-v3/index.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-20-splash', url: '/app-v3/20-splash.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-21-boas-vindas', url: '/app-v3/21-boas-vindas.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-23-login', url: '/app-v3/23-login.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-24-esqueci-senha', url: '/app-v3/24-esqueci-senha.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-25-nova-senha', url: '/app-v3/25-nova-senha.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-26-cadastro', url: '/app-v3/26-cadastro.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-27-sms', url: '/app-v3/27-sms.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-28-onboarding', url: '/app-v3/28-onboarding.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-30-quiz', url: '/app-v3/30-quiz.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-31-pronto', url: '/app-v3/31-pronto.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-01-saude', url: '/app-v3/01-saude.html', cat: 'paciente-v3', viewport: 'mobile', logged: true },
  { id: 'P-v3-03-medicamentos', url: '/app-v3/03-medicamentos.html', cat: 'paciente-v3', viewport: 'mobile', logged: true },
  { id: 'P-v3-04-med-detalhe', url: '/app-v3/04-med-detalhe.html', cat: 'paciente-v3', viewport: 'mobile', logged: true },
  { id: 'P-v3-05-add-medicamento', url: '/app-v3/05-add-medicamento.html', cat: 'paciente-v3', viewport: 'mobile', logged: true },
  { id: 'P-v3-06-alergias', url: '/app-v3/06-alergias.html', cat: 'paciente-v3', viewport: 'mobile', logged: true },
  { id: 'P-v3-07-alergia-detalhe', url: '/app-v3/07-alergia-detalhe.html', cat: 'paciente-v3', viewport: 'mobile', logged: true },
  { id: 'P-v3-08-add-alergia', url: '/app-v3/08-add-alergia.html', cat: 'paciente-v3', viewport: 'mobile', logged: true },
  { id: 'P-v3-09-exames-lista', url: '/app-v3/09-exames-lista.html', cat: 'paciente-v3', viewport: 'mobile', logged: true },
  { id: 'P-v3-10-exame-detalhe', url: '/app-v3/10-exame-detalhe.html', cat: 'paciente-v3', viewport: 'mobile', logged: true },
  { id: 'P-v3-12-qr-code', url: '/app-v3/12-qr-code.html', cat: 'paciente-v3', viewport: 'mobile', logged: true },
  { id: 'P-v3-14-rg-publico', url: '/app-v3/14-rg-publico.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-15-consultas', url: '/app-v3/15-consultas.html', cat: 'paciente-v3', viewport: 'mobile', logged: true },
  { id: 'P-v3-16-consulta-detalhe', url: '/app-v3/16-consulta-detalhe.html', cat: 'paciente-v3', viewport: 'mobile', logged: true },
  { id: 'P-v3-18-perfil', url: '/app-v3/18-perfil.html', cat: 'paciente-v3', viewport: 'mobile', logged: true },
  { id: 'P-v3-40-saude-vazia', url: '/app-v3/40-saude-vazia.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-41-meds-vazia', url: '/app-v3/41-medicamentos-vazia.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-42-alergias-vazia', url: '/app-v3/42-alergias-vazia.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-43-exames-vazia', url: '/app-v3/43-exames-vazia.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-44-consultas-vazia', url: '/app-v3/44-consultas-vazia.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-52-loading', url: '/app-v3/52-loading-home.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-60-erro-offline', url: '/app-v3/60-erro-offline.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-71-privacidade', url: '/app-v3/71-privacidade.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-preview-cartao-vita-id', url: '/app-v3/preview-cartao-vita-id.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-preview-rg-saude-v2', url: '/app-v3/preview-rg-saude-v2.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-app-esqueleto', url: '/app-v3/app-esqueleto.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-app-galeria', url: '/app-v3/app-galeria.html', cat: 'paciente-v3', viewport: 'mobile' },
  { id: 'P-v3-app-shell-backup', url: '/app-v3/app-shell-backup.html', cat: 'paciente-v3', viewport: 'mobile' },

  // ─── MÉDICO MOBILE (telas 20-27) ───
  { id: 'M-mob-20-cadastro', url: '/20-medico-cadastro.html', cat: 'medico-mobile', viewport: 'mobile' },
  { id: 'M-mob-20-dashboard', url: '/20-medico-dashboard.html', cat: 'medico-mobile', viewport: 'mobile', logged: true, tipo: 'MEDICO' },
  { id: 'M-mob-21-qrcode', url: '/21-qrcode.html', cat: 'medico-mobile', viewport: 'mobile', logged: true },
  { id: 'M-mob-22-autorizacao', url: '/22-autorizacao.html', cat: 'medico-mobile', viewport: 'mobile', logged: true },
  { id: 'M-mob-23-agendamentos', url: '/23-agendamentos.html', cat: 'medico-mobile', viewport: 'mobile', logged: true },
  { id: 'M-mob-25-summary', url: '/25-summary.html', cat: 'medico-mobile', viewport: 'mobile', logged: true, tipo: 'MEDICO' },
  { id: 'M-mob-26-scan', url: '/26-scan-receita.html', cat: 'medico-mobile', viewport: 'mobile', logged: true },
  { id: 'M-mob-27-processando', url: '/27-processando.html', cat: 'medico-mobile', viewport: 'mobile' },

  // ─── MÉDICO DESKTOP ───
  { id: 'M-desk-01-login', url: '/desktop/01-login.html', cat: 'medico-desktop', viewport: 'desktop' },
  { id: 'M-desk-02-cadastro', url: '/desktop/02-cadastro.html', cat: 'medico-desktop', viewport: 'desktop' },
  { id: 'M-desk-03-quiz', url: '/desktop/03-quiz-medico.html', cat: 'medico-desktop', viewport: 'desktop' },
  { id: 'M-desk-app', url: '/desktop/app.html', cat: 'medico-desktop', viewport: 'desktop', logged: true, tipo: 'MEDICO' },
  { id: 'M-desk-app-v2', url: '/desktop/app-v2.html', cat: 'medico-desktop', viewport: 'desktop', logged: true, tipo: 'MEDICO' },
  { id: 'M-desk-dashboard', url: '/desktop/dashboard.html', cat: 'medico-desktop', viewport: 'desktop', logged: true, tipo: 'MEDICO' },
  { id: 'M-desk-crm', url: '/desktop/crm.html', cat: 'medico-desktop', viewport: 'desktop', logged: true, tipo: 'MEDICO' },
  { id: 'M-desk-pacientes', url: '/desktop/pacientes.html', cat: 'medico-desktop', viewport: 'desktop', logged: true, tipo: 'MEDICO' },
  { id: 'M-desk-perfil', url: '/desktop/perfil.html', cat: 'medico-desktop', viewport: 'desktop', logged: true, tipo: 'MEDICO' },
  { id: 'M-desk-pre-consulta', url: '/desktop/pre-consulta.html', cat: 'medico-desktop', viewport: 'desktop', logged: true, tipo: 'MEDICO' },
  { id: 'M-desk-pre-consultas', url: '/desktop/pre-consultas.html', cat: 'medico-desktop', viewport: 'desktop', logged: true, tipo: 'MEDICO' },
  { id: 'M-desk-templates', url: '/desktop/templates.html', cat: 'medico-desktop', viewport: 'desktop', logged: true, tipo: 'MEDICO' },
  { id: 'M-desk-login', url: '/desktop/login.html', cat: 'medico-desktop', viewport: 'desktop' },
  { id: 'M-desk-app-legacy', url: '/desktop/app-legacy-2026-05-05.html', cat: 'medico-desktop', viewport: 'desktop', logged: true, tipo: 'MEDICO' },

  // ─── PÚBLICAS ───
  { id: 'PUB-index', url: '/index.html', cat: 'publica', viewport: 'mobile' },
  { id: 'PUB-rg-publico', url: '/rg-publico.html?id=test', cat: 'publica', viewport: 'mobile' },
  { id: 'PUB-exame-publico', url: '/exame-publico.html?id=test', cat: 'publica', viewport: 'mobile' },
  { id: 'PUB-termos', url: '/termos.html', cat: 'publica', viewport: 'mobile' },
  { id: 'PUB-lgpd', url: '/lgpd.html', cat: 'publica', viewport: 'mobile' },
  { id: 'PUB-pre-consulta', url: '/pre-consulta.html?token=fake', cat: 'publica', viewport: 'mobile' },
  { id: 'PUB-quiz-preconsulta', url: '/quiz-preconsulta.html', cat: 'publica', viewport: 'mobile' },

  // ─── REDESIGN-V2 ───
  { id: 'R2-index', url: '/redesign-v2/index.html', cat: 'redesign-v2', viewport: 'mobile' },
  { id: 'R2-01-home', url: '/redesign-v2/01-home.html', cat: 'redesign-v2', viewport: 'mobile' },
  { id: 'R2-02-saude', url: '/redesign-v2/02-saude.html', cat: 'redesign-v2', viewport: 'mobile' },
  { id: 'R2-03-exames', url: '/redesign-v2/03-exames-lista.html', cat: 'redesign-v2', viewport: 'mobile' },
  { id: 'R2-04-exame-detalhe', url: '/redesign-v2/04-exame-detalhe.html', cat: 'redesign-v2', viewport: 'mobile' },
  { id: 'R2-07-meds', url: '/redesign-v2/07-meds-lista.html', cat: 'redesign-v2', viewport: 'mobile' },
  { id: 'R2-10-alergias', url: '/redesign-v2/10-alergias-condicoes.html', cat: 'redesign-v2', viewport: 'mobile' },
  { id: 'R2-12-consultas', url: '/redesign-v2/12-consultas-lista.html', cat: 'redesign-v2', viewport: 'mobile' },
  { id: 'R2-14-pre-consulta', url: '/redesign-v2/14-pre-consulta-responder.html', cat: 'redesign-v2', viewport: 'mobile' },
  { id: 'R2-15-briefing', url: '/redesign-v2/15-briefing-medico.html', cat: 'redesign-v2', viewport: 'mobile' },
  { id: 'R2-21-eu', url: '/redesign-v2/21-eu.html', cat: 'redesign-v2', viewport: 'mobile' },
  { id: 'R2-22-cartao', url: '/redesign-v2/22-cartao-rg.html', cat: 'redesign-v2', viewport: 'mobile' },

  // ─── REDESIGN-V3 ───
  { id: 'R3-index', url: '/redesign-v3/index.html', cat: 'redesign-v3', viewport: 'mobile' },
  { id: 'R3-01-home', url: '/redesign-v3/01-home.html', cat: 'redesign-v3', viewport: 'mobile' },
  { id: 'R3-02-saude', url: '/redesign-v3/02-saude.html', cat: 'redesign-v3', viewport: 'mobile' },
  { id: 'R3-03-exames', url: '/redesign-v3/03-exames-lista.html', cat: 'redesign-v3', viewport: 'mobile' },
  { id: 'R3-07-meds', url: '/redesign-v3/07-meds-lista.html', cat: 'redesign-v3', viewport: 'mobile' },
  { id: 'R3-10-alergias', url: '/redesign-v3/10-alergias-condicoes.html', cat: 'redesign-v3', viewport: 'mobile' },
  { id: 'R3-21-eu', url: '/redesign-v3/21-eu.html', cat: 'redesign-v3', viewport: 'mobile' },
  { id: 'R3-22-cartao', url: '/redesign-v3/22-cartao-rg.html', cat: 'redesign-v3', viewport: 'mobile' },

  // ─── LEGACY ───
  { id: 'LEG-v2', url: '/legacy/pre-consulta-v2.html?token=fake', cat: 'legacy', viewport: 'mobile' },
  { id: 'LEG-v4', url: '/legacy/pre-consulta-v4.html?token=fake', cat: 'legacy', viewport: 'mobile' },
  { id: 'LEG-slides', url: '/legacy/pre-consulta-slides.html', cat: 'legacy', viewport: 'mobile' },
  { id: 'LEG-backup', url: '/legacy/pre-consulta-backup-pre45s.html?token=fake', cat: 'legacy', viewport: 'mobile' },

  // ─── MAPAS DE TELA + DEV ───
  { id: 'MAP-telas', url: '/mapa-telas.html', cat: 'mapa', viewport: 'desktop' },
  { id: 'MAP-fluxo', url: '/mapa-fluxo-completo.html', cat: 'mapa', viewport: 'desktop' },
  { id: 'MAP-app-paciente', url: '/MAPA-APP-PACIENTE-COMPLETO.html', cat: 'mapa', viewport: 'desktop' },
  { id: 'MAP-paciente-interativo', url: '/mapa-paciente-interativo.html', cat: 'mapa', viewport: 'desktop' },
  { id: 'MAP-identidade', url: '/identidade-visual.html', cat: 'mapa', viewport: 'desktop' },
  { id: 'MAP-fluxo-meds', url: '/fluxo-medicamentos-alergias.html', cat: 'mapa', viewport: 'desktop' },
  { id: 'DBG-scan', url: '/dashboard-scan.html', cat: 'dev', viewport: 'desktop' },
  { id: 'DBG-admin', url: '/dashboard-admin.html', cat: 'dev', viewport: 'desktop' },
  { id: 'DBG-diag-scan', url: '/diag-scan.html', cat: 'dev', viewport: 'desktop' },
  { id: 'DBG-diag-pipeline', url: '/diag-pipeline.html', cat: 'dev', viewport: 'desktop' },
  { id: 'DBG-teste-scan', url: '/teste-scan.html', cat: 'dev', viewport: 'desktop' },
  { id: 'DBG-summary-demo', url: '/summary-demo.html', cat: 'dev', viewport: 'desktop' },
];

const VIEWPORTS = {
  mobile: { width: 393, height: 852 },
  desktop: { width: 1440, height: 900 },
};

async function auditarTela(browser, tela, idx, total) {
  const context = await browser.newContext({
    viewport: VIEWPORTS[tela.viewport],
    deviceScaleFactor: 1,
  });

  if (tela.logged) {
    await context.addInitScript((tipo) => {
      localStorage.setItem('vitae_token', 'fake-jwt-for-audit');
      localStorage.setItem('vitae_refresh_token', 'fake-refresh');
      localStorage.setItem('vitae_user_tipo', tipo || 'PACIENTE');
    }, tela.tipo || 'PACIENTE');
  }

  const page = await context.newPage();
  const requests = [];
  const responses = [];
  const consoleErrors = [];
  const pageErrors = [];

  page.on('request', (req) => {
    requests.push({ url: req.url(), method: req.method(), type: req.resourceType() });
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      responses.push({ url: res.url(), status: res.status() });
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push({ type: msg.type(), text: msg.text().slice(0, 250) });
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message.slice(0, 250));
  });

  const inicio = Date.now();
  let nav_ok = true;
  let nav_erro = null;
  try {
    await page.goto(BASE + tela.url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
  } catch (e) {
    nav_ok = false;
    nav_erro = e.message.slice(0, 200);
  }

  const urlFinal = page.url();
  const titulo = await page.title().catch(() => '');
  const tempo = Date.now() - inicio;

  // Screenshot
  const shotPath = path.join(SHOTS_DIR, tela.id + '.png');
  try {
    await page.screenshot({ path: shotPath, fullPage: false });
  } catch (e) {}

  // Detectar elementos básicos
  const stats = await page.evaluate(() => {
    return {
      total_imgs: document.querySelectorAll('img').length,
      total_links: document.querySelectorAll('a').length,
      total_botoes: document.querySelectorAll('button').length,
      total_inputs: document.querySelectorAll('input,textarea,select').length,
      total_iframes: document.querySelectorAll('iframe').length,
      tem_estilo: document.querySelectorAll('link[rel=stylesheet]').length,
      tem_script: document.querySelectorAll('script[src]').length,
      texto_visivel: document.body.innerText.slice(0, 200),
    };
  }).catch(() => ({}));

  await context.close();

  const resultado = {
    id: tela.id,
    cat: tela.cat,
    viewport: tela.viewport,
    url: tela.url,
    logged: !!tela.logged,
    tipo_user: tela.tipo,
    nav_ok,
    nav_erro,
    titulo,
    urlFinal,
    tempo_ms: tempo,
    total_requests: requests.length,
    erros_404_500: responses,
    erros_console: consoleErrors.slice(0, 15),
    erros_pagina: pageErrors.slice(0, 5),
    stats,
    screenshot: shotPath.replace(__dirname + path.sep, '').replace(/\\/g, '/'),
  };

  console.log(`[${idx+1}/${total}] ${tela.id} — ${responses.length} 404, ${consoleErrors.length} cons-err, ${pageErrors.length} pg-err`);
  return resultado;
}

(async () => {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const resultados = [];

  // 4 paralelos
  const CONCURRENCY = 4;
  const fila = TELAS.slice();
  const workers = [];

  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push((async () => {
      while (fila.length > 0) {
        const tela = fila.shift();
        const idx = TELAS.indexOf(tela);
        try {
          const r = await auditarTela(browser, tela, idx, TELAS.length);
          resultados.push(r);
        } catch (e) {
          resultados.push({ id: tela.id, ERRO_CRITICO: e.message });
          console.log(`[!] ${tela.id} ERRO: ${e.message.slice(0,100)}`);
        }
      }
    })());
  }

  await Promise.all(workers);
  await browser.close();

  // Ordenar pelo id
  resultados.sort((a, b) => (a.id || '').localeCompare(b.id || ''));

  // Sumário
  const sumario = {
    total_telas: TELAS.length,
    total_falhas_nav: resultados.filter((r) => r.nav_ok === false).length,
    total_telas_com_404: resultados.filter((r) => r.erros_404_500 && r.erros_404_500.length > 0).length,
    total_404_acumulado: resultados.reduce((s, r) => s + (r.erros_404_500 ? r.erros_404_500.length : 0), 0),
    total_console_errors: resultados.reduce((s, r) => s + (r.erros_console ? r.erros_console.length : 0), 0),
    total_page_errors: resultados.reduce((s, r) => s + (r.erros_pagina ? r.erros_pagina.length : 0), 0),
    por_categoria: {},
  };

  for (const r of resultados) {
    if (!sumario.por_categoria[r.cat]) {
      sumario.por_categoria[r.cat] = { total: 0, com_404: 0, com_erros: 0 };
    }
    sumario.por_categoria[r.cat].total++;
    if (r.erros_404_500 && r.erros_404_500.length > 0) sumario.por_categoria[r.cat].com_404++;
    if ((r.erros_console && r.erros_console.length > 0) || (r.erros_pagina && r.erros_pagina.length > 0)) {
      sumario.por_categoria[r.cat].com_erros++;
    }
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify({ sumario, telas: resultados }, null, 2));
  console.log('\n═════════════════════════════════════');
  console.log('SUMÁRIO');
  console.log('═════════════════════════════════════');
  console.log('Total de telas:', sumario.total_telas);
  console.log('Falhas de navegação:', sumario.total_falhas_nav);
  console.log('Telas com 404:', sumario.total_telas_com_404);
  console.log('Total 404 acumulado:', sumario.total_404_acumulado);
  console.log('Total erros console:', sumario.total_console_errors);
  console.log('Total erros página:', sumario.total_page_errors);
  console.log('\nPor categoria:');
  for (const [cat, st] of Object.entries(sumario.por_categoria)) {
    console.log(`  ${cat}: ${st.total} telas, ${st.com_404} com 404, ${st.com_erros} com erros`);
  }
  console.log('\nResultado completo em:', OUT_JSON);
})();
