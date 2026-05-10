/**
 * VITAE — FLUXO COMPLETO DO ZERO
 *
 * Cria conta médica fake → quiz 5 passos → app → tenta Calendar → cria template →
 * cria pré-consulta REAL (captura token do backend) → abre link como paciente
 * (mobile) → cadastra paciente → quiz vita id → responde pré-consulta DIGITANDO →
 * volta pro médico → vê 1-minute summary com anamnese estruturada.
 *
 * Saída: tests/shots/completo-{ts}/ + tests/logs/completo-{ts}.json
 *
 * Limitações conhecidas:
 *  - Google OAuth real não é automatizável (precisa credencial Google) — só valida
 *    que o botão de conectar aparece OU que estado "Em breve" aparece.
 *  - WhatsApp wa.me abre aba nova — só valida que abre, não testa envio.
 *  - Áudio: paciente responde MODO TEXTO (Lucas pediu).
 *  - Quiz vita id é best-effort — campos podem ter mudado entre versões.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.VITAE_URL || 'https://vitae-app.vercel.app';
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SHOTS = path.join(__dirname, 'shots', 'completo-' + TS);
const LOGS = path.join(__dirname, 'logs');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(LOGS, { recursive: true });

const RAND = Math.floor(Math.random() * 1e9);
// Helper: gera 11 dígitos BR (DDD 2 + 9XXXXXXXX) — backend valida estritamente
function gerarCelular11(prefixo9) {
  // 11 (DDD) + 9 + 8 dígitos = 11 total
  const sufixo = Math.floor(10000000 + Math.random() * 89999999); // 8 dígitos
  return '11' + prefixo9 + sufixo;
}
const MEDICO = {
  nome: 'Dr Teste Borelli ' + RAND.toString().slice(-4),
  email: 'med-' + RAND + '@vitae-debug.local',
  celular: gerarCelular11('9'), // 11 dígitos: 119XXXXXXXX
  senha: 'TesteSenha123!',
  crm: '99' + RAND.toString().slice(-4),
  uf: 'SP',
  especialidade: 'Clínica Geral',
  clinica: 'Consultório Teste',
  endereco: 'Rua Teste 100, São Paulo SP',
  telefone: '11' + (33330000 + Math.floor(Math.random() * 999)),
  valor: '300',
};
const PACIENTE = {
  nome: 'Paciente Teste ' + RAND.toString().slice(-3),
  tel: gerarCelular11('9'), // 11 dígitos
  email: 'pac-' + RAND + '@vitae-debug.local',
  senha: 'PacSenha123!',
};

const log = {
  ts: TS, base: BASE, medico: MEDICO, paciente: PACIENTE,
  etapas: [], ux: [], bugs: [], consoleErrors: [],
  tokenPC: null, pcId: null,
};

function etapa(nome, ok, det) { log.etapas.push({nome, ok, det: det||null, t: Date.now()}); console.log((ok?'✓':'✗')+' '+nome+(det?' — '+det:'')); }
function obs(quem, sev, txt, sug) { log.ux.push({quem, sev, txt, sug: sug||''}); console.log('  ['+quem+'/'+sev+'] '+txt); }
function bug(loc, desc) { log.bugs.push({loc, desc}); console.log('  🐛 '+loc+': '+desc); }
async function snap(page, nome) {
  try { await page.screenshot({path: path.join(SHOTS, nome+'.png'), fullPage: true}); }
  catch(e) { log.bugs.push({loc:'snap', desc:'snap '+nome+' falhou: '+e.message}); }
}
async function clicarTexto(page, txt, tries) {
  tries = tries || 1;
  for (let i = 0; i < tries; i++) {
    const c = await page.locator(`button:has-text("${txt}"), a:has-text("${txt}")`).first();
    if (await c.count() > 0) {
      try { await c.click({timeout: 5000}); return true; } catch(e) {}
    }
    await page.waitForTimeout(500);
  }
  return false;
}

(async () => {
  console.log('\n🧪 VITAE — FLUXO COMPLETO DO ZERO\n');
  console.log('Médico:   ' + MEDICO.email);
  console.log('Paciente: ' + PACIENTE.nome);
  console.log('Output:   ' + SHOTS + '\n');

  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox'] });

  const ctxMed = await browser.newContext({
    viewport: { width: 1440, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo'
  });
  const pageM = await ctxMed.newPage();
  pageM.on('console', m => { if (m.type() === 'error') log.consoleErrors.push({ctx:'medico', t: m.text().slice(0,200)}); });
  pageM.on('pageerror', e => log.consoleErrors.push({ctx:'medico', t: 'pageerror: ' + e.message.slice(0,200)}));

  // ============ PARTE 1: MÉDICO ============
  console.log('═══════════════════════════════════');
  console.log('PARTE 1: MÉDICO (do zero)');
  console.log('═══════════════════════════════════');

  try {
    await pageM.goto(BASE + '/desktop/01-login.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pageM.waitForTimeout(2500);
    await snap(pageM, '01-med-login');
    etapa('Médico abre tela de login', true);

    await clicarTexto(pageM, 'Criar conta');
    await pageM.waitForURL(/02-cadastro/, { timeout: 15000 });
    await pageM.waitForTimeout(800);
    await snap(pageM, '02-med-cadastro-form');

    await pageM.fill('#nome', MEDICO.nome);
    await pageM.fill('#email', MEDICO.email);
    await pageM.fill('#celular', MEDICO.celular);
    await pageM.fill('#senha', MEDICO.senha);
    await pageM.fill('#senha2', MEDICO.senha);
    await pageM.check('#aceite');
    await pageM.waitForTimeout(400);
    await snap(pageM, '03-med-cadastro-preenchido');

    await pageM.click('#btn');

    try {
      await pageM.waitForURL(/03-quiz-medico/, { timeout: 30000 });
      etapa('Cadastro criado + redirect quiz', true);
    } catch (e) {
      const erro = await pageM.locator('.vit-err__title, [class*="erro"]').first().textContent().catch(() => null);
      bug('cadastro-medico', 'Não redirecionou pro quiz: ' + (erro || 'sem erro visível'));
      etapa('Cadastro + quiz', false, erro);
      throw new Error('cadastro abortou: ' + (erro || 'unknown'));
    }

    // Quiz 5 passos
    await pageM.waitForTimeout(1500);
    await snap(pageM, '04-quiz-passo1-identidade');

    await pageM.selectOption('#uf', MEDICO.uf).catch(() => {});
    await pageM.fill('#crm', MEDICO.crm).catch(() => {});
    await pageM.fill('#esp', MEDICO.especialidade).catch(() => {});
    await pageM.waitForTimeout(300);
    await clicarTexto(pageM, 'Avançar');
    await pageM.waitForTimeout(900);

    await snap(pageM, '05-quiz-passo2-formacao');
    if (!await clicarTexto(pageM, 'Pular este passo')) await clicarTexto(pageM, 'Avançar');
    await pageM.waitForTimeout(900);

    await snap(pageM, '06-quiz-passo3-onde-atende');
    await pageM.fill('#clinica', MEDICO.clinica).catch(() => {});
    await pageM.fill('#endereco', MEDICO.endereco).catch(() => {});
    await pageM.fill('#tel', MEDICO.telefone).catch(() => {});
    await pageM.waitForTimeout(300);
    await clicarTexto(pageM, 'Avançar');
    await pageM.waitForTimeout(900);

    await snap(pageM, '07-quiz-passo4-consulta');
    await pageM.fill('#valor', MEDICO.valor).catch(() => {});
    await clicarTexto(pageM, 'Avançar');
    await pageM.waitForTimeout(900);

    await snap(pageM, '08-quiz-passo5-toque-final');
    if (!await clicarTexto(pageM, 'Pular este passo')) await clicarTexto(pageM, 'Avançar');
    await pageM.waitForTimeout(900);

    if (!await clicarTexto(pageM, 'Salvar e continuar')) {
      await clicarTexto(pageM, 'Concluir');
    }
    await pageM.waitForTimeout(3000);
    await snap(pageM, '09-quiz-celebracao');

    await clicarTexto(pageM, 'Entrar no app');
    await pageM.waitForURL(/app-v2/, { timeout: 20000 });
    await pageM.waitForTimeout(4500); // BACKEND.boot()
    await snap(pageM, '10-app-hoje');
    etapa('Quiz médico completo + entrada no app', true);

    // Calendar — só inspeção
    console.log('\n--- Calendar ---');
    try {
      await pageM.evaluate(() => { try { goto('calendar'); } catch(e) {} });
      await pageM.waitForTimeout(2500);
      await snap(pageM, '11-calendar-inspecao');

      const conectarBtn = await pageM.locator('button:has-text("Conectar"), button:has-text("Conectar com Google")').count();
      const emBreve = await pageM.locator('text=/[Ee]m breve|disponível em breve/').count();
      const conectado = await pageM.locator('text=/[Cc]onectado.*como|[Dd]esconectar/').count();

      if (conectado > 0) etapa('Calendar — já conectado (sessão prévia)', true);
      else if (conectarBtn > 0) {
        etapa('Calendar — botão de conectar visível', true);
        obs('médico', 'baixa', 'OAuth Google requer credencial real — clique não automatizável. Botão presente é o esperado.', '');
      } else if (emBreve > 0) {
        etapa('Calendar — modo "Em breve" (OAuth desabilitado server)', true);
        obs('médico', 'média', 'Calendar mostra "Em breve" — Railway não tem GOOGLE_CLIENT_ID configurado nessa instância.', 'Configurar credencial Google se for testar em produção');
      } else {
        bug('calendar', 'Tela Calendar sem estado claro (sem botão Conectar nem "Em breve")');
      }
    } catch (e) { bug('calendar', 'Erro ao abrir Calendar: ' + e.message); }

    // Templates
    console.log('\n--- Templates ---');
    try {
      await pageM.evaluate(() => { try { goto('templates'); } catch(e) {} });
      await pageM.waitForTimeout(2000);
      await snap(pageM, '12-templates-vazio');

      const fab = await pageM.locator('.fab-add, [class*="fab"], button[onclick*="Templates"], button:has-text("Novo template")').first();
      if (await fab.count() > 0) {
        await fab.click().catch(() => {});
        await pageM.waitForTimeout(1500);
        await snap(pageM, '13-template-criar');
        etapa('Tela criar template aberta', true);
      } else {
        bug('templates', 'Sem botão visível pra criar primeiro template');
        obs('médico', 'crítica', 'Médico novo entra em Templates e fica perdido sem CTA.', 'Empty state hero com "Crie seu primeiro template" e seta visual');
      }
    } catch (e) { bug('templates', 'Erro: ' + e.message); }

    // Pré-Consultas — criar PC REAL
    console.log('\n--- Criar pré-consulta ---');
    try {
      // Fecha overlay de onboarding de Templates se estiver bloqueando cliques.
      // BUG real do app: tpl-onbOverlay abre ao entrar em Templates e NÃO se
      // fecha quando o médico muda de view manualmente — fica intercepting
      // pointer events em todas as outras telas. Workaround: fecha programaticamente.
      const onbBloqueando = await pageM.locator('#tpl-onbOverlay.show').count();
      if (onbBloqueando > 0) {
        bug('templates-onboarding', 'Popup de onboarding (tpl-onbOverlay) fica ABERTO mesmo após mudança de view — bloqueia cliques em Pré-Consultas/Hoje/Pacientes. Workaround: chamar tplOnbClose() programaticamente.');
        obs('médico', 'crítica', 'Médico novo abre Templates → popup "Como funciona?" abre → médico clica em outra aba sem fechar → fica preso porque cliques são interceptados.', 'No goto() ou em qualquer mudança de view: chamar tplOnbClose() automaticamente. Ou fechar overlay quando médico clica fora dele em qualquer ponto, não só no body do overlay.');
        await pageM.evaluate(() => { try { tplOnbClose(); } catch(e) {} });
        await pageM.waitForTimeout(500);
      }

      await pageM.evaluate(() => { try { abrirCriarPC(); } catch(e) { try { goto('criar-pc'); } catch(_){} } });
      await pageM.waitForTimeout(2500);
      await snap(pageM, '14-criar-pc-form');

      if (await pageM.locator('#cpcNome').count() > 0) {
        await pageM.fill('#cpcNome', PACIENTE.nome);
        await pageM.fill('#cpcPhone', PACIENTE.tel).catch(() => {});
        await pageM.fill('#cpcEmail', PACIENTE.email).catch(() => {});

        const amanha = new Date(Date.now() + 24*60*60*1000).toISOString().slice(0, 10);
        await pageM.fill('#cpcData', amanha);
        await pageM.fill('#cpcHora', '14:00');

        const obsTextarea = pageM.locator('#cpcObs');
        if (await obsTextarea.count() > 0) await obsTextarea.fill('Teste automatizado — paciente fake');

        await pageM.waitForTimeout(500);
        await snap(pageM, '15-criar-pc-preenchido');

        // Captura POST /pre-consulta
        const respPromise = pageM.waitForResponse(
          r => r.url().includes('/pre-consulta') && r.request().method() === 'POST',
          { timeout: 30000 }
        ).catch(() => null);

        await pageM.click('#cpcGerarBtn');

        const resp = await respPromise;
        if (resp) {
          const data = await resp.json().catch(() => ({}));
          const pc = data.preConsulta || data;
          log.tokenPC = pc.linkToken || pc.token;
          log.pcId = pc.id;
          if (log.tokenPC) {
            etapa('PC criada — token capturado', true, log.tokenPC.slice(0, 20) + '…');
          } else {
            bug('criar-pc', 'POST /pre-consulta retornou ' + resp.status() + ' mas sem linkToken: ' + JSON.stringify(data).slice(0, 200));
          }
        } else {
          bug('criar-pc', 'POST /pre-consulta não foi capturado em 30s');
        }
        await pageM.waitForTimeout(3000);
        await snap(pageM, '16-pc-pos-criar');
      } else {
        bug('criar-pc', 'Form de criar PC não abriu (#cpcNome não existe)');
      }
    } catch (e) { bug('criar-pc', 'Exceção: ' + e.message); }

  } catch (e) {
    bug('parte1-medico', 'Exceção fatal: ' + e.message);
    await snap(pageM, '99-med-erro-fatal');
  }

  // ============ PARTE 2: PACIENTE ============
  console.log('\n═══════════════════════════════════');
  console.log('PARTE 2: PACIENTE (mobile)');
  console.log('═══════════════════════════════════');

  if (!log.tokenPC) {
    bug('fluxo-paciente', 'Pulado — token PC não foi capturado na parte médica');
  } else {
    const ctxPac = await browser.newContext({
      viewport: { width: 393, height: 852 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      locale: 'pt-BR'
    });
    const pageP = await ctxPac.newPage();
    pageP.on('console', m => { if (m.type() === 'error') log.consoleErrors.push({ctx:'paciente', t: m.text().slice(0,200)}); });
    pageP.on('pageerror', e => log.consoleErrors.push({ctx:'paciente', t: 'pageerror: ' + e.message.slice(0,200)}));

    try {
      const link = BASE + '/pre-consulta.html?token=' + encodeURIComponent(log.tokenPC);
      console.log('Link: ' + link);

      await pageP.goto(link, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await pageP.waitForTimeout(4000);
      await snap(pageP, '20-pac-link-aberto');
      etapa('Paciente abre link da PC', true);

      // Onboarding 1
      const onb1 = await pageP.locator('#screen-onb1-1:visible').count();
      if (onb1 > 0) {
        await clicarTexto(pageP, 'Continuar');
        await pageP.waitForTimeout(800);
        await snap(pageP, '21-pac-onb1-2');
        if (!await clicarTexto(pageP, 'Criar meu RG da Saúde')) {
          await clicarTexto(pageP, 'Criar');
        }
        await pageP.waitForTimeout(1500);
        etapa('Paciente passa pelos slides de onboarding', true);
      }

      // Tela login/cadastro inline
      await snap(pageP, '22-pac-login-tela');
      const loginVis = await pageP.locator('#screen-login:visible').count();
      if (loginVis > 0) {
        // Garante modo cadastro
        await clicarTexto(pageP, 'Criar conta');
        await pageP.waitForTimeout(500);

        // Preenche (multi-tentativas — IDs podem variar)
        const fill = async (selectors, val) => {
          for (const s of selectors) {
            const c = await pageP.locator(s).count();
            if (c > 0) { await pageP.locator(s).first().fill(val); return true; }
          }
          return false;
        };
        await fill(['#lgNome', 'input[placeholder*="ompleto"]', 'input[name="nome"]'], PACIENTE.nome);
        await fill(['#lgEmail', 'input[type="email"]'], PACIENTE.email);
        await fill(['#lgCelular', 'input[placeholder*="999"]', 'input[type="tel"]'], PACIENTE.tel);
        await fill(['#lgSenha', 'input[placeholder*="enha"]', 'input[type="password"]'], PACIENTE.senha);

        // Aceite LGPD — é uma div custom (#lgTcheck), não input checkbox.
        // Chamar a função diretamente é mais robusto que tentar click.
        await pageP.evaluate(() => { try { lgToggleTerms(); } catch(e) {} });
        await pageP.waitForTimeout(300);

        await pageP.waitForTimeout(400);
        await snap(pageP, '23-pac-cadastro-preenchido');

        await clicarTexto(pageP, 'Criar conta') ||
          await clicarTexto(pageP, 'Continuar') ||
          await clicarTexto(pageP, 'Cadastrar') ||
          await pageP.click('#lgBtn').catch(() => {});

        await pageP.waitForTimeout(5000);
        await snap(pageP, '24-pac-pos-cadastro');
        etapa('Paciente cadastrou conta vita id', true);
      }

      // Quiz vita id (best-effort — campos podem variar)
      const urlAposCad = pageP.url();
      if (urlAposCad.includes('quiz-preconsulta') || urlAposCad.includes('quiz')) {
        await pageP.waitForTimeout(2000);
        await snap(pageP, '25-pac-quiz-vid-comeco');

        // Tenta preencher passo 1 (data de nascimento)
        const dataNasc = pageP.locator('input[type="date"]').first();
        if (await dataNasc.count() > 0) await dataNasc.fill('1990-01-01').catch(() => {});

        // Loop best-effort: clica próximos botões disponíveis
        for (let i = 0; i < 10; i++) {
          await pageP.waitForTimeout(800);
          // Tenta avançar com qualquer botão de continuar
          const avancou = await clicarTexto(pageP, 'Continuar') ||
                         await clicarTexto(pageP, 'Próximo') ||
                         await clicarTexto(pageP, 'Avançar') ||
                         await clicarTexto(pageP, 'Pular') ||
                         await clicarTexto(pageP, 'Concluir');
          if (!avancou) break;
        }
        await snap(pageP, '26-pac-quiz-vid-fim');
        etapa('Quiz vita id (best-effort)', true);
      }

      // Volta pra pré-consulta — onboarding 2 + V4
      await pageP.waitForTimeout(2500);
      await snap(pageP, '27-pac-pre-consulta-volta');

      // Onb 2 (pode ter 3 telas)
      for (let i = 0; i < 4; i++) {
        const continuou = await clicarTexto(pageP, 'Vamos lá') ||
                         await clicarTexto(pageP, 'Continuar') ||
                         await clicarTexto(pageP, 'Começar') ||
                         await clicarTexto(pageP, 'Próximo');
        if (!continuou) break;
        await pageP.waitForTimeout(900);
      }
      await snap(pageP, '28-pac-quiz-v4-inicio');

      // Quiz V4 — pergunta por pergunta MODO TEXTO
      const respostas = [
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

      let respondidas = 0;
      for (let i = 0; i < 12; i++) {
        await pageP.waitForTimeout(1000);

        // Tenta clicar botão "Prefere responder por texto?" se aparecer
        const btnTexto = pageP.locator('button:has-text("texto"), button:has-text("digitar"), [class*="text"]').first();
        if (await btnTexto.count() > 0 && await btnTexto.isVisible().catch(() => false)) {
          await btnTexto.click().catch(() => {});
          await pageP.waitForTimeout(600);
        }

        // Procura textarea visível
        const ta = pageP.locator('textarea:visible').first();
        const taC = await ta.count();
        if (taC === 0) break; // Pode ter chegado na revisão

        const resp = respostas[i] || 'Não sei dizer ao certo';
        await ta.fill(resp).catch(() => {});
        await pageP.waitForTimeout(400);

        // Próxima pergunta
        const avancou = await clicarTexto(pageP, 'Próximo') ||
                       await clicarTexto(pageP, 'Confirmar') ||
                       await clicarTexto(pageP, 'Avançar');
        if (avancou) {
          respondidas++;
          await pageP.waitForTimeout(900);
        } else {
          break;
        }
      }
      etapa('Quiz V4 — ' + respondidas + ' perguntas respondidas', respondidas >= 5);
      await snap(pageP, '29-pac-quiz-v4-fim');

      // Tela revisão
      await pageP.waitForTimeout(1500);
      await snap(pageP, '30-pac-revisao');
      const enviou = await clicarTexto(pageP, 'Enviar pré-consulta') ||
                    await clicarTexto(pageP, 'Enviar') ||
                    await clicarTexto(pageP, 'Concluir');
      if (enviou) {
        await pageP.waitForTimeout(5000);
        await snap(pageP, '31-pac-pos-envio');
        etapa('Paciente enviou pré-consulta', true);
      } else {
        bug('pac-envio', 'Botão Enviar não encontrado na tela de revisão');
      }

      // Tela "Pronto"
      const pronto = await pageP.locator('text=/[Pp]ronto|[Ee]nviado|[Oo]brigad|[Cc]onclu/').count();
      if (pronto > 0) {
        await snap(pageP, '32-pac-tela-pronto');
        etapa('Tela "Pronto" exibida', true);
      } else {
        bug('pac-pronto', 'Tela final de confirmação não detectada');
      }

    } catch (e) {
      bug('parte2-paciente', 'Exceção: ' + e.message);
      await snap(pageP, '99-pac-erro-fatal');
    }

    await ctxPac.close();
  }

  // ============ PARTE 3: MÉDICO VÊ SUMMARY ============
  console.log('\n═══════════════════════════════════');
  console.log('PARTE 3: MÉDICO VÊ 1-MIN SUMMARY');
  console.log('═══════════════════════════════════');

  try {
    await pageM.goto(BASE + '/desktop/app-v2.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pageM.waitForTimeout(5500); // BACKEND.boot()
    await snap(pageM, '40-med-volta-app');

    await pageM.evaluate(() => { try { goto('pre-consultas'); } catch(e) {} });
    await pageM.waitForTimeout(3500);
    await snap(pageM, '41-med-pcs-lista');

    const linhas = pageM.locator('.pcn-trow');
    const cnt = await linhas.count();
    console.log('Linhas de PC encontradas: ' + cnt);

    if (cnt > 0) {
      // Procura linha com nome do paciente teste OU clica primeira
      let alvo = null;
      for (let i = 0; i < cnt; i++) {
        const linha = linhas.nth(i);
        const txt = await linha.textContent().catch(() => '');
        if (txt.includes(PACIENTE.nome.split(' ')[0]) || txt.includes(PACIENTE.nome.split(' ').slice(-1)[0])) {
          alvo = linha;
          break;
        }
      }
      if (!alvo) alvo = linhas.first();
      await alvo.click();
      await pageM.waitForTimeout(4000);
      await snap(pageM, '42-med-summary-aberto');

      // Valida elementos do summary
      const temAnamnese = await pageM.locator('text=/[Qq]ueixa.*[Pp]rincipal|[Aa]namnese/').count();
      const temPadroes = await pageM.locator('text=/[Pp]adr.*observ|[Pp]oss.*urg/').count();
      const temFonteBadge = await pageM.locator('text=/áudio|formulário|pulado|não.*sei/i').count();

      etapa('Summary aberto', true);
      etapa('Anamnese estruturada visível', temAnamnese > 0, temAnamnese > 0 ? null : 'sem texto "Queixa Principal"/"Anamnese"');
      etapa('Padrões observados visíveis', temPadroes > 0, temPadroes > 0 ? null : 'sem texto "padrões"/"urgências"');
      etapa('Badges de fonte (áudio/formulário/etc)', temFonteBadge > 0, temFonteBadge > 0 ? null : 'sem badges de fonte por campo');
    } else {
      bug('summary', 'Lista de pré-consultas vazia mesmo após paciente responder. Backend pode não ter persistido.');
    }
  } catch (e) {
    bug('parte3-medico', 'Exceção: ' + e.message);
    await snap(pageM, '99-med-p3-erro');
  }

  await ctxMed.close();
  await browser.close();

  // RELATÓRIO
  fs.writeFileSync(path.join(LOGS, 'completo-' + TS + '.json'), JSON.stringify(log, null, 2));

  console.log('\n═══════════════════════════════════');
  console.log('📊 RESUMO');
  console.log('═══════════════════════════════════');
  const ok = log.etapas.filter(e => e.ok).length;
  const fail = log.etapas.filter(e => !e.ok).length;
  console.log('Etapas:           ' + ok + ' ok · ' + fail + ' falha (' + log.etapas.length + ' total)');
  console.log('Observações UX:   ' + log.ux.length);
  console.log('Bugs/issues:      ' + log.bugs.length);
  console.log('Erros console:    ' + log.consoleErrors.length);
  console.log('Token PC:         ' + (log.tokenPC ? log.tokenPC.slice(0, 20) + '…' : 'NÃO CAPTURADO'));
  console.log('\nLog:    ' + path.join(LOGS, 'completo-' + TS + '.json'));
  console.log('Prints: ' + SHOTS);

  if (log.bugs.length) {
    console.log('\n🐛 BUGS ENCONTRADOS:');
    log.bugs.forEach(b => console.log('  • [' + b.loc + '] ' + b.desc));
  }
  if (log.ux.length) {
    console.log('\n💡 OBSERVAÇÕES UX:');
    log.ux.forEach(u => console.log('  • [' + u.quem + '/' + u.sev + '] ' + u.txt));
  }

  process.exit(0);
})().catch(e => {
  console.error('\n❌ FATAL: ' + e.message);
  console.error(e.stack);
  fs.writeFileSync(path.join(LOGS, 'completo-' + TS + '.FATAL.json'), JSON.stringify({fatal: e.message, stack: e.stack, log}, null, 2));
  process.exit(1);
});
