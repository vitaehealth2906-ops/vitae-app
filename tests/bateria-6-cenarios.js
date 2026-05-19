/**
 * BATERIA 6 CENARIOS — Testa pre-consulta ponta a ponta em 6 perfis diferentes
 *
 * Roda SEQUENCIAL (1 por vez) usando contas reais do Lucas.
 *
 * Cenarios:
 *  1. texto-completo    — 11 respostas longas em texto
 *  2. texto-curto       — 11 respostas curtas/vagas
 *  3. pulador           — usa "Nao sei" em varias
 *  4. bebo-bug          — reproduz cenario Lucas (10 longas + 1 curta "Bebo")
 *  5. clique-multiplo   — preenche tudo, clica Enviar 5x rapido (testa bug do loop)
 *  6. rede-lenta        — simula 3G lento durante envio
 *
 * Output:
 *  - tests/shots/bateria-{ts}/cenario-N/  (prints de cada passo)
 *  - tests/logs/bateria-{ts}.json         (relatorio estruturado)
 *  - tests/videos/cenario-N.webm          (video da sessao)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const BASE = 'https://vitae-app.vercel.app';
const MED_URL = BASE + '/desktop/app-v2.html';
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SHOTS_ROOT = path.join(__dirname, 'shots', 'bateria-' + TS);
const LOGS = path.join(__dirname, 'logs');
const VIDEOS = path.join(__dirname, 'videos', 'bateria-' + TS);
fs.mkdirSync(SHOTS_ROOT, { recursive: true });
fs.mkdirSync(LOGS, { recursive: true });
fs.mkdirSync(VIDEOS, { recursive: true });

const MED_EMAIL = process.env.MEDICO_EMAIL;
const MED_SENHA = process.env.MEDICO_SENHA;
const PAC_EMAIL = process.env.PACIENTE_EMAIL;
const PAC_SENHA = process.env.PACIENTE_SENHA;

const RESPOSTAS_LONGAS = [
  'Tô com dor de cabeça forte do lado direito faz uns 3 dias',
  'Começou na segunda-feira pela manhã, há 3 dias',
  'A dor é forte, uns 8 de 10',
  'Piora quando olho pra tela do celular ou levanto rápido',
  'Melhora quando deito num quarto escuro',
  'Tô com náusea junto e sensibilidade à luz',
  'Não tomei nenhum remédio ainda, queria conversar com médico antes',
  'Já tive enxaqueca antes mas faz uns 6 meses sem crise',
  'Minha mãe também tem enxaqueca crônica',
  'Tomo só rivotril pra ansiedade ocasional, mais nada',
  'Durmo umas 5 horas por noite, irregular ultimamente'
];

const RESPOSTAS_CURTAS = [
  'Dor de cabeça', 'Faz dias', 'Forte', 'Tela', 'Escuro',
  'Sim', 'Não', 'Já tive', 'Mãe', 'Rivotril', 'Pouco'
];

const CENARIOS = [
  { id: 1, nome: 'texto-completo', tipoResposta: 'longa', enviarVezes: 1, rede: 'normal' },
  { id: 2, nome: 'texto-curto',    tipoResposta: 'curta', enviarVezes: 1, rede: 'normal' },
  { id: 3, nome: 'pulador',        tipoResposta: 'pular', enviarVezes: 1, rede: 'normal' },
  { id: 4, nome: 'bebo-bug',       tipoResposta: 'bebo', enviarVezes: 1, rede: 'normal' },
  { id: 5, nome: 'clique-multiplo',tipoResposta: 'longa', enviarVezes: 5, rede: 'normal' },
  { id: 6, nome: 'rede-lenta',     tipoResposta: 'longa', enviarVezes: 1, rede: 'lenta' },
];

const relatorio = {
  ts: TS, base: BASE,
  inicio: new Date().toISOString(),
  fim: null,
  medico: MED_EMAIL,
  paciente: PAC_EMAIL,
  cenarios: [],
  tokensCriados: [],
  resumoFinal: null,
};

function log(msg) { console.log(msg); }
async function snap(page, dir, nome) {
  try { await page.screenshot({ path: path.join(dir, nome + '.png'), fullPage: true }); }
  catch (e) { log('  ! snap falhou: ' + nome); }
}
async function clicarTexto(page, txt, tries) {
  tries = tries || 1;
  for (let i = 0; i < tries; i++) {
    const c = page.locator(`button:has-text("${txt}"), a:has-text("${txt}")`).first();
    if (await c.count() > 0) {
      try { await c.click({ timeout: 4000 }); return true; } catch (e) {}
    }
    await page.waitForTimeout(400);
  }
  return false;
}

async function loginMedico(page) {
  await page.goto(MED_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  if (page.url().includes('login')) {
    await page.locator('input[type="email"]').first().fill(MED_EMAIL);
    await page.locator('input[type="password"]').first().fill(MED_SENHA);
    await page.locator('button:has-text("Entrar"), button[type="submit"]').first().click();
    await page.waitForTimeout(5000);
  }
  if (!page.url().includes('app-v2')) {
    await page.goto(MED_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  }
}

async function criarPCComToken(pageM, scen) {
  // Fecha onboarding template se aberto
  await pageM.evaluate(() => { try { tplOnbClose(); } catch (e) {} }).catch(() => {});
  await pageM.waitForTimeout(400);

  // Abre formulario criar PC
  await pageM.evaluate(() => { try { abrirCriarPC(); } catch (e) { try { goto('criar-pc'); } catch (_) {} } });
  await pageM.waitForTimeout(2200);

  // Verifica que o form abriu
  const temForm = await pageM.locator('#cpcNome').count();
  if (temForm === 0) {
    return { erro: 'Form criar PC nao abriu (#cpcNome ausente)' };
  }

  // Preenche — paciente fake mas com cenario no nome pra identificacao
  const nomeFake = 'ROBO-C' + scen.id + '-' + scen.nome;
  await pageM.fill('#cpcNome', nomeFake);
  // Telefone: usa o telefone REAL do Lucas pra que o link vincule ao paciente real
  // (vincular acontece por login do paciente, nao por matching telefone — Sessao 21)
  await pageM.fill('#cpcPhone', '11987654321').catch(() => {});
  await pageM.fill('#cpcEmail', PAC_EMAIL).catch(() => {});

  const amanha = new Date(Date.now() + 24*60*60*1000).toISOString().slice(0, 10);
  await pageM.fill('#cpcData', amanha).catch(() => {});
  await pageM.fill('#cpcHora', '14:00').catch(() => {});

  const obsCampo = pageM.locator('#cpcObs');
  if (await obsCampo.count() > 0) {
    await obsCampo.fill('BATERIA ROBO ' + TS + ' cenario ' + scen.id).catch(() => {});
  }

  await pageM.waitForTimeout(400);

  // Captura resposta POST /pre-consulta
  const respPromise = pageM.waitForResponse(
    r => r.url().includes('/pre-consulta') && r.request().method() === 'POST',
    { timeout: 30000 }
  ).catch(() => null);

  await pageM.click('#cpcGerarBtn');
  const resp = await respPromise;
  if (!resp) return { erro: 'POST /pre-consulta nao foi capturado em 30s' };

  const data = await resp.json().catch(() => ({}));
  const pc = data.preConsulta || data;
  const token = pc.linkToken || pc.token;
  if (!token) return { erro: 'POST 200 mas sem linkToken: ' + JSON.stringify(data).slice(0, 200) };

  await pageM.waitForTimeout(1500);
  return { token, pcId: pc.id, nomeFake };
}

async function rodarPaciente(browser, scen, token, dirShots) {
  const log = [];
  const bugs = [];
  function add(nome, ok, det) { log.push({ nome, ok, det: det || null, t: Date.now() }); console.log(`  ${ok ? '✓' : '✗'} ${nome}` + (det ? ' — ' + det : '')); }
  function bug(loc, desc) { bugs.push({ loc, desc }); console.log(`  🐛 ${loc}: ${desc}`); }

  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    locale: 'pt-BR',
    recordVideo: { dir: VIDEOS, size: { width: 393, height: 852 } },
  });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('vitae_prefer_login', '1'); } catch (e) {} });

  const page = await ctx.newPage();
  const consoleErrors = [];
  const apiCalls = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message.slice(0, 200)));
  page.on('response', async (r) => {
    const u = r.url();
    if (u.includes('/responder') || u.includes('/finalizar') || u.includes('/pre-consulta/t/')) {
      let body = '';
      try { body = await r.text(); } catch (e) {}
      apiCalls.push({ status: r.status(), method: r.request().method(), url: u.slice(-90), body: body.slice(0, 200) });
    }
  });

  // Simula 3G lento se cenario for rede-lenta
  if (scen.rede === 'lenta') {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 300,
      downloadThroughput: 50 * 1024,
      uploadThroughput: 20 * 1024,
    });
  }

  try {
    const link = BASE + '/pre-consulta.html?token=' + encodeURIComponent(token);
    await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4500);
    await snap(page, dirShots, '01-link-aberto');
    add('Abre link da PC', true);

    // Onboarding 1 — pode aparecer ou nao (so primeira visita)
    const onb1 = await page.locator('#screen-onb1-1:visible').count();
    if (onb1 > 0) {
      await clicarTexto(page, 'Continuar');
      await page.waitForTimeout(700);
      await clicarTexto(page, 'Criar meu RG da Saúde') || await clicarTexto(page, 'Criar') || await clicarTexto(page, 'Vamos');
      await page.waitForTimeout(1200);
      add('Passa onboarding 1', true);
    }

    // Tela login inline — tenta login com conta real
    await page.waitForTimeout(800);
    const loginVis = await page.locator('#screen-login:visible').count();
    if (loginVis > 0) {
      // Tela abre em modo CADASTRO por padrao. Troca pra LOGIN chamando funcao direto.
      const tituloAntes = await page.locator('#lgTi').textContent().catch(() => '');
      if (tituloAntes && tituloAntes.toLowerCase().includes('criar')) {
        await page.evaluate(() => { try { window.lgToggleMode(); } catch (e) {} });
        await page.waitForTimeout(600);
      }
      const tituloDepois = await page.locator('#lgTi').textContent().catch(() => '');
      add('Toggle pra modo login (titulo: "' + tituloDepois.trim() + '")', tituloDepois.toLowerCase().includes('entrar'));

      // Preenche email e senha (campos sao os mesmos nos 2 modos)
      await page.fill('#lgEmail', PAC_EMAIL);
      await page.fill('#lgSenha', PAC_SENHA);
      await page.waitForTimeout(400);
      await snap(page, dirShots, '02-login-preenchido');

      // Captura POST /auth/login pra confirmar
      const loginRespPromise = page.waitForResponse(
        r => r.url().includes('/auth/login') && r.request().method() === 'POST',
        { timeout: 15000 }
      ).catch(() => null);

      // Chama funcao de submit direto (evita ambiguidade de clique)
      await page.evaluate(() => { try { window.lgSubmit(); } catch (e) {} });

      const loginResp = await loginRespPromise;
      if (loginResp) {
        const okStatus = loginResp.status();
        const body = await loginResp.text().catch(() => '');
        add('POST /auth/login retornou ' + okStatus, okStatus === 200, body.slice(0, 150));
        if (okStatus !== 200) {
          bug('login', 'Login falhou: HTTP ' + okStatus + ' — ' + body.slice(0, 150));
        }
      } else {
        bug('login', 'POST /auth/login nao foi capturado em 15s');
      }

      await page.waitForTimeout(5000);
      await snap(page, dirShots, '03-pos-login');

      // Confirma que saiu da tela de login
      const aindaLogin = await page.locator('#screen-login:visible').count();
      if (aindaLogin > 0) {
        const erroVisivel = await page.locator('#lgErrorMsg:visible').textContent().catch(() => '');
        bug('login', 'Ainda na tela de login apos submit. Erro: ' + (erroVisivel || 'nenhum visivel'));
      } else {
        add('Saiu da tela de login (logou OK)', true);
      }
    } else {
      add('Login ja estava feito (cookie persistido)', true);
    }

    // Quiz vita id — Lucas ja tem perfil completo, deve pular automaticamente
    // Mas se aparecer, best-effort avancar
    await page.waitForTimeout(2000);
    const urlAgora = page.url();
    if (urlAgora.includes('quiz-preconsulta')) {
      add('Caiu no quiz vita id (perfil incompleto?)', false);
      for (let i = 0; i < 8; i++) {
        const avancou = await clicarTexto(page, 'Próximo') ||
                       await clicarTexto(page, 'Continuar') ||
                       await clicarTexto(page, 'Avançar') ||
                       await clicarTexto(page, 'Concluir');
        if (!avancou) break;
        await page.waitForTimeout(800);
      }
      // Volta pra pre-consulta apos retornar
      await page.waitForTimeout(3000);
    }

    // Onboarding 2 — 3 telas. Chama funcoes direto pra evitar ambiguidade de clique.
    const temOnb2 = await page.locator('#screen-onb2-1').count();
    if (temOnb2 > 0) {
      await page.evaluate(() => { try { window.onb2Ir(2); } catch (e) {} });
      await page.waitForTimeout(800);
      await page.evaluate(() => { try { window.onb2Ir(3); } catch (e) {} });
      await page.waitForTimeout(800);
      await page.evaluate(() => { try { window.onb2Concluir(); } catch (e) {} });
      await page.waitForTimeout(1500);
      add('Passa onboarding 2 (3 telas)', true);
    }
    await snap(page, dirShots, '04-pre-quiz-v4');

    // Quiz V4 — pergunta por pergunta
    let respondidas = 0;
    let perguntas = 11;
    for (let i = 0; i < perguntas + 2; i++) {
      await page.waitForTimeout(900);

      // Forca modo texto se aparecer o botao
      const btnTexto = page.locator('button:has-text("texto"), button:has-text("digitar")').first();
      if (await btnTexto.count() > 0 && await btnTexto.isVisible().catch(() => false)) {
        await btnTexto.click().catch(() => {});
        await page.waitForTimeout(500);
      }

      // Textarea especifico do quiz V4
      const ta = page.locator('#textareaInput');
      const taVis = await ta.isVisible().catch(() => false);
      if (!taVis) {
        // Pode ter chegado na tela de revisao
        const temRev = await page.locator('#screen-revisao:visible').count();
        if (temRev > 0) break;
        // Ou pode estar em outra tela — tenta forcar modo texto
        const btnTextoForc = page.locator('button:has-text("digitar"), button:has-text("texto")').first();
        if (await btnTextoForc.count() > 0) {
          await btnTextoForc.click().catch(() => {});
          await page.waitForTimeout(800);
        }
        if (!await ta.isVisible().catch(() => false)) break;
      }

      // Decide resposta conforme cenario
      let resp;
      if (scen.tipoResposta === 'longa') {
        resp = RESPOSTAS_LONGAS[i] || 'Resposta extra';
      } else if (scen.tipoResposta === 'curta') {
        resp = RESPOSTAS_CURTAS[i] || 'sim';
      } else if (scen.tipoResposta === 'pular') {
        // alterna entre longa e "nao sei" — testa botao Nao sei
        if (i % 2 === 0) {
          resp = RESPOSTAS_LONGAS[i] || 'Sei la';
        } else {
          // Tenta clicar "Não sei" se existir
          const ns = await clicarTexto(page, 'Não sei') || await clicarTexto(page, 'Pular');
          if (ns) { respondidas++; await page.waitForTimeout(900); continue; }
          resp = 'Não sei dizer';
        }
      } else if (scen.tipoResposta === 'bebo') {
        // 10 longas + 1 curta "Bebo" na pergunta de habitos (#10 normalmente)
        if (i === 9) {
          resp = 'Bebo';
        } else {
          resp = RESPOSTAS_LONGAS[i] || 'Resposta extra';
        }
      }

      await ta.fill(resp).catch(() => {});
      // Dispara onTextoChange pra app habilitar botao Continuar
      await page.evaluate(() => { try { window.onTextoChange(); } catch (e) {} });
      await page.waitForTimeout(500);

      // Clica botao Continuar especifico do quiz (id=btnContinuar)
      const btn = page.locator('#btnContinuar');
      const btnVis = await btn.isVisible().catch(() => false);
      if (btnVis) {
        await btn.click().catch(() => {});
        respondidas++;
        await page.waitForTimeout(1200);
      } else {
        // Fallback: chama enviarTexto direto
        await page.evaluate(() => { try { window.enviarTexto(); } catch (e) {} });
        respondidas++;
        await page.waitForTimeout(1200);
      }
    }
    add(`Quiz V4 — ${respondidas} respostas dadas`, respondidas >= 5);
    await snap(page, dirShots, '05-quiz-fim');

    // Tela revisao
    await page.waitForTimeout(2000);
    await snap(page, dirShots, '06-revisao');

    // BUG REPRODUCAO: clica botao "Enviar pro medico" N vezes rapido
    let cliques = 0;
    const btnEnviar = page.locator('button:has-text("Enviar pro médico"), button:has-text("Enviar pro medico"), button:has-text("Enviar pré-consulta")').first();
    for (let i = 0; i < scen.enviarVezes; i++) {
      try {
        if (await btnEnviar.count() > 0 && await btnEnviar.isVisible().catch(() => false)) {
          await btnEnviar.click({ timeout: 3000, force: i > 0 }).catch(() => {});
          cliques++;
          if (scen.enviarVezes > 1) {
            await page.waitForTimeout(120);
          }
        } else if (i === 0) {
          // Fallback: chama finalizarPreConsulta direto
          await page.evaluate(() => { try { window.finalizarPreConsulta(); } catch (e) {} });
          cliques++;
        }
      } catch (e) {}
    }
    add(`Clicou em Enviar ${cliques} vez(es)`, cliques > 0);

    // Espera resposta do servidor
    await page.waitForTimeout(scen.rede === 'lenta' ? 18000 : 8000);
    await snap(page, dirShots, '07-pos-enviar');

    // Detecta tela "Pronto"
    const pronto = await page.locator('text=/[Pp]ronto.*briefing|[Ee]nviado|[Bb]riefing.*chegou|[Cc]onclu/').count();
    if (pronto > 0) {
      enviouOk = true;
      add(`Tela "Pronto" exibida (${cliques} cliques)`, true);
    } else {
      // Bug do loop: botao virou "Tentar enviar de novo"?
      const tentarDeNovo = await page.locator('text=/[Tt]entar.*enviar|[Tt]ente.*novamente/').count();
      if (tentarDeNovo > 0) {
        bug('enviar', 'BUG DO LOOP: botao virou "Tentar enviar de novo" — fix nao funcionou');
      }
      // Banner de erro visivel?
      const erro = await page.locator('text=/[Ee]rro|[Ff]alh|[Nn]ao.*foi.*possivel/').count();
      if (erro > 0) {
        const txtErro = await page.locator('text=/[Ee]rro|[Ff]alh/').first().textContent().catch(() => '');
        bug('enviar', 'Banner de erro visivel: ' + txtErro.slice(0, 100));
      }
      add('Tela "Pronto" NAO exibida apos enviar', false);
    }

  } catch (e) {
    bug('paciente-fluxo', 'Excecao: ' + e.message);
    await snap(page, dirShots, '99-erro-fatal');
  }

  await page.close();
  await ctx.close();

  return { etapas: log, bugs, consoleErrors, apiCalls };
}

(async () => {
  log('\n══════════════════════════════════════════════════');
  log('🤖 BATERIA 6 CENARIOS — VITAE pre-consulta');
  log('══════════════════════════════════════════════════');
  log(`Medico:    ${MED_EMAIL}`);
  log(`Paciente:  ${PAC_EMAIL}`);
  log(`Output:    ${SHOTS_ROOT}`);
  log(`Videos:    ${VIDEOS}`);
  log(`Inicio:    ${new Date().toLocaleTimeString('pt-BR')}\n`);

  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox'] });

  // FASE A — Medico loga e cria 6 PCs
  log('═══ FASE A — MEDICO CRIA 6 PCs ═══\n');
  const ctxMed = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const pageM = await ctxMed.newPage();
  const errosM = [];
  pageM.on('pageerror', e => errosM.push(e.message));

  try {
    await loginMedico(pageM);
    log(`✓ Medico logado`);
    await snap(pageM, SHOTS_ROOT, 'med-A1-logado');

    for (const scen of CENARIOS) {
      log(`\n  → Criando PC cenario ${scen.id} (${scen.nome})`);
      const res = await criarPCComToken(pageM, scen);
      if (res.erro) {
        log(`  ✗ ${res.erro}`);
        relatorio.tokensCriados.push({ cenarioId: scen.id, erro: res.erro });
      } else {
        log(`  ✓ Token ${res.token.slice(0, 16)}... pcId=${res.pcId}`);
        relatorio.tokensCriados.push({ cenarioId: scen.id, token: res.token, pcId: res.pcId, nomeFake: res.nomeFake });
      }
      await snap(pageM, SHOTS_ROOT, `med-A2-pc${scen.id}-criada`);

      // Fecha modal/tela e volta pro dashboard pra criar a proxima
      await pageM.evaluate(() => { try { goto('hoje'); } catch (e) {} });
      await pageM.waitForTimeout(1500);
    }
  } catch (e) {
    log(`✗ Erro fatal fase A: ${e.message}`);
  }

  log(`\nFase A finalizada — ${relatorio.tokensCriados.filter(t => t.token).length}/6 tokens criados\n`);

  // FASE B — Paciente roda 6 cenarios sequencialmente
  log('═══ FASE B — PACIENTE RODA 6 CENARIOS ═══\n');
  for (const scen of CENARIOS) {
    const tk = relatorio.tokensCriados.find(t => t.cenarioId === scen.id);
    if (!tk || !tk.token) {
      log(`Cenario ${scen.id} (${scen.nome}) — PULADO, token nao foi criado`);
      relatorio.cenarios.push({ ...scen, status: 'pulado-sem-token' });
      continue;
    }

    log(`\n─── Cenario ${scen.id}: ${scen.nome} ───`);
    const dirCenario = path.join(SHOTS_ROOT, `cenario-${scen.id}-${scen.nome}`);
    fs.mkdirSync(dirCenario, { recursive: true });

    const inicio = Date.now();
    const resultado = await rodarPaciente(browser, scen, tk.token, dirCenario);
    const duracao = Math.round((Date.now() - inicio) / 1000);

    const okEtapas = resultado.etapas.filter(e => e.ok).length;
    const failEtapas = resultado.etapas.filter(e => !e.ok).length;
    log(`  → ${okEtapas} ok / ${failEtapas} falha / ${resultado.bugs.length} bugs / ${duracao}s`);

    relatorio.cenarios.push({
      ...scen,
      token: tk.token,
      pcId: tk.pcId,
      duracaoSeg: duracao,
      etapasOk: okEtapas,
      etapasFalha: failEtapas,
      bugs: resultado.bugs,
      consoleErrors: resultado.consoleErrors.slice(0, 20),
      apiCalls: resultado.apiCalls.slice(0, 20),
      etapas: resultado.etapas,
    });
  }

  // FASE C — Medico abre app e confere quais chegaram
  log('\n═══ FASE C — MEDICO CONFERE QUAIS CHEGARAM ═══\n');
  try {
    await pageM.goto(MED_URL, { waitUntil: 'domcontentloaded' });
    await pageM.waitForTimeout(5000);
    await pageM.evaluate(() => { try { goto('pre-consultas'); } catch (e) {} });
    await pageM.waitForTimeout(3500);
    await snap(pageM, SHOTS_ROOT, 'med-C1-lista-pcs');

    const linhas = pageM.locator('.pcn-trow');
    const cnt = await linhas.count();
    log(`Lista de PCs do medico: ${cnt} linhas visiveis`);

    let chegaram = 0;
    for (const scen of CENARIOS) {
      const tk = relatorio.tokensCriados.find(t => t.cenarioId === scen.id);
      if (!tk || !tk.nomeFake) continue;
      let achou = false;
      for (let i = 0; i < cnt; i++) {
        const txt = await linhas.nth(i).textContent().catch(() => '');
        if (txt.includes('C' + scen.id + '-')) {
          achou = true;
          // Tenta detectar status (Respondida/Pendente)
          const respondida = txt.toLowerCase().includes('respondida') || txt.toLowerCase().includes('pronta');
          log(`  C${scen.id} ${scen.nome}: ${achou ? '✓ aparece' : '✗ sumiu'} ${respondida ? '(respondida)' : '(pendente)'}`);
          if (respondida) chegaram++;
          break;
        }
      }
      if (!achou) log(`  C${scen.id} ${scen.nome}: ✗ NAO APARECE na lista do medico`);
    }
    relatorio.resumoFinal = { totalLinhas: cnt, chegaramRespondidas: chegaram };
  } catch (e) {
    log(`Erro fase C: ${e.message}`);
  }

  await ctxMed.close();
  await browser.close();

  relatorio.fim = new Date().toISOString();
  const logPath = path.join(LOGS, 'bateria-' + TS + '.json');
  fs.writeFileSync(logPath, JSON.stringify(relatorio, null, 2));

  log('\n══════════════════════════════════════════════════');
  log('📊 RELATORIO FINAL');
  log('══════════════════════════════════════════════════');
  for (const c of relatorio.cenarios) {
    const status = c.status === 'pulado-sem-token' ? 'PULADO' :
                   c.bugs && c.bugs.length > 0 ? `${c.bugs.length} BUG(S)` :
                   c.etapasFalha === 0 ? 'OK' : `${c.etapasFalha} FALHA(S)`;
    log(`  C${c.id} ${c.nome.padEnd(20)} → ${status} (${c.duracaoSeg || 0}s)`);
    if (c.bugs && c.bugs.length > 0) {
      c.bugs.forEach(b => log(`       🐛 ${b.loc}: ${b.desc.slice(0, 100)}`));
    }
  }
  log(`\nRelatorio:  ${logPath}`);
  log(`Prints:     ${SHOTS_ROOT}`);
  log(`Videos:     ${VIDEOS}`);
})();
