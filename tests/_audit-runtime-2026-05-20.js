/**
 * AUDITORIA DE RUNTIME — 2026-05-20
 *
 * Objetivo: capturar TODOS os arquivos que carregam quando os 5 fluxos críticos
 * do app são acessados. Lista de "arquivos vivos" = não pode apagar.
 *
 * Fluxos:
 *   A) Paciente NOVO (sem token)  → http://localhost:3000/
 *   B) Paciente LOGADO (com token) → http://localhost:3000/
 *   C) Pre-consulta (link médico) → http://localhost:3000/pre-consulta.html?token=fake
 *   D) Desktop médico → http://localhost:3000/desktop/01-login.html
 *   E) App-v3 direto → http://localhost:3000/app-v3/app.html
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const OUT = path.join(__dirname, '_audit-runtime-2026-05-20.json');

const FLUXOS = [
  { id: 'A_paciente_novo', url: BASE + '/', setup: null, navigate: ['01-splash', '02-slides', '03-cadastro'] },
  { id: 'B_paciente_logado', url: BASE + '/', setup: 'logged' },
  { id: 'C_pre_consulta', url: BASE + '/pre-consulta.html?token=fake-test-token' },
  { id: 'D_desktop_medico', url: BASE + '/desktop/01-login.html' },
  { id: 'E_app_v3_direto', url: BASE + '/app-v3/app.html', navigate: ['hash-screens'] },
];

(async () => {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--no-sandbox'],
  });

  const resultado = { iniciado: new Date().toISOString(), fluxos: [] };

  for (const fluxo of FLUXOS) {
    console.log('▶ Fluxo:', fluxo.id);
    const context = await browser.newContext({ viewport: { width: 393, height: 852 } });

    if (fluxo.setup === 'logged') {
      // Simular login: setar token no localStorage antes de navegar
      await context.addInitScript(() => {
        localStorage.setItem('vitae_token', 'fake-jwt-for-audit');
        localStorage.setItem('vitae_refresh_token', 'fake-refresh');
        localStorage.setItem('vitae_user_tipo', 'PACIENTE');
      });
    }

    const page = await context.newPage();
    const requests = [];
    const responses = [];
    const consoleMsgs = [];
    const errors = [];
    const navegacoes = [];

    page.on('request', (req) => {
      requests.push({
        url: req.url(),
        method: req.method(),
        resource: req.resourceType(),
      });
    });
    page.on('response', (res) => {
      responses.push({
        url: res.url(),
        status: res.status(),
      });
    });
    page.on('console', (msg) => {
      consoleMsgs.push({ type: msg.type(), text: msg.text().slice(0, 300) });
    });
    page.on('pageerror', (err) => {
      errors.push(err.message.slice(0, 300));
    });
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        navegacoes.push(frame.url());
      }
    });

    try {
      await page.goto(fluxo.url, { waitUntil: 'networkidle', timeout: 20000 });
      // Aguarda redirects + iframes lazy
      await page.waitForTimeout(3000);

      // Se for app-v3, ativar todas as hashes pra carregar todos os iframes
      if (fluxo.navigate && fluxo.navigate.includes('hash-screens')) {
        const hashes = ['#saude', '#exames', '#qr', '#consultas', '#perfil', '#meds', '#alergias', '#scan'];
        for (const h of hashes) {
          await page.evaluate((hh) => { location.hash = hh; }, h);
          await page.waitForTimeout(800);
        }
      }
    } catch (e) {
      errors.push('NAV ERROR: ' + e.message.slice(0, 300));
    }

    const finalUrl = page.url();
    const arquivosLocais = [
      ...new Set(
        responses
          .filter((r) => r.url.startsWith(BASE))
          .map((r) => r.url.replace(BASE, '').split('?')[0])
      ),
    ];

    resultado.fluxos.push({
      id: fluxo.id,
      urlInicial: fluxo.url,
      urlFinal: finalUrl,
      navegacoes,
      arquivosLocais,
      total_requests: requests.length,
      total_responses: responses.length,
      status_404: responses.filter((r) => r.status === 404).map((r) => r.url),
      console_errors: consoleMsgs.filter((m) => m.type === 'error').slice(0, 10),
      page_errors: errors.slice(0, 5),
    });

    await context.close();
  }

  await browser.close();

  // Consolidação: união de todos arquivos vivos
  const todosArquivosVivos = new Set();
  resultado.fluxos.forEach((f) => {
    f.arquivosLocais.forEach((a) => todosArquivosVivos.add(a));
  });
  resultado.consolidado = {
    total_arquivos_vivos: todosArquivosVivos.size,
    arquivos_vivos: [...todosArquivosVivos].sort(),
  };

  fs.writeFileSync(OUT, JSON.stringify(resultado, null, 2));
  console.log('✓ Auditoria salva em', OUT);
  console.log('  Total arquivos vivos:', todosArquivosVivos.size);
  resultado.fluxos.forEach((f) => {
    console.log(`  ${f.id}: ${f.arquivosLocais.length} arquivos, ${f.status_404.length} 404, urlFinal=${f.urlFinal}`);
  });
})();
