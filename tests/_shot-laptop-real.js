/**
 * Captura a tela REAL do app-v2.html (produção) na view "Resumo de 1 minuto",
 * com dados fake injetados via mock de localStorage + interceptação de fetch.
 * Saída: docs/marketing/screens/thumbs/laptop-real.png (1440x900)
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL_PROD = 'https://vitae-app.vercel.app/desktop/app-v2.html';
const OUT = path.join(__dirname, '..', 'docs', 'marketing', 'screens', 'thumbs', 'laptop-real.png');
const THUMBS = path.join(__dirname, '..', 'docs', 'marketing', 'screens', 'thumbs');

// Lê laudos locais e converte pra data URI (assim a página produção consegue exibir)
function toDataUri(name){
  const file = path.join(THUMBS, name + '.jpg');
  const b64 = fs.readFileSync(file).toString('base64');
  // Fragmento `#x.jpg` satisfaz o regex de detecção de imagem no app sem quebrar o data URI
  return 'data:image/jpeg;base64,' + b64 + '#x.jpg';
}
const THUMB_HEMOGRAMA = toDataUri('hemograma');
const THUMB_TSH = toDataUri('tsh');
const THUMB_GLICEMIA = toDataUri('glicemia');
const THUMB_ECG = toDataUri('ecg');

// Paciente fake — Beatriz Oliveira, mesma do composite
const FAKE_PACIENTE_ID = 'fake-pac-beatriz-2026';
const FAKE_PC_ID = 'fake-pc-beatriz-cefaleia';

const FAKE_PC = {
  id: FAKE_PC_ID,
  pacienteId: FAKE_PACIENTE_ID,
  pacienteNome: 'Beatriz Oliveira',
  status: 'RESPONDIDA',
  criadoEm: '2026-05-24T13:30:00Z',
  respondidaEm: '2026-05-24T13:52:00Z',
  audioSummaryUrl: null,
  audioUrl: null,
  respostas: {
    dataNascimento: '1991-08-14',
    tipoSanguineo: 'O+',
    queixaPrincipal: 'Dor de cabeça há 12 dias, lateja do lado direito',
    duracao: '12 dias',
    intensidade: '7 de 10',
  },
  summaryJson: {
    textoVoz: 'A paciente Beatriz, 34 anos, relata cefaleia pulsátil unilateral à direita há 12 dias, com piora ao se abaixar e ausência de alívio com dipirona. Refere uso prévio de analgésicos comuns sem sucesso. Histórico de uso de Losartana 50mg, Sertralina 25mg e Vitamina D. Alergia conhecida à dipirona e penicilina. Nega febre, vômitos ou alterações visuais. Sono fragmentado nas últimas duas semanas.',
    descricaoBreve: 'Cefaleia pulsátil unilateral há 12 dias sem alívio com analgésico comum.',
    queixaPrincipal: 'Cefaleia pulsátil unilateral há 12 dias, sem alívio com analgésico comum.',
    anamneseEstruturada: {
      queixaPrincipal: { valor: 'Cefaleia pulsátil unilateral à direita, há 12 dias, com piora ao se abaixar e sem alívio com analgésico comum.', fonte: 'audio' },
      tempoEvolucao: { valor: '12 dias', fonte: 'audio' },
      intensidade: { valor: '7/10 — interfere no trabalho', fonte: 'audio' },
      fatoresAgravantes: { valor: 'Inclinar a cabeça para baixo, claridade forte', fonte: 'audio' },
      fatoresAtenuantes: { valor: 'Ambiente escuro e silencioso', fonte: 'audio' },
      sintomasAssociados: { valor: 'Sono fragmentado, irritabilidade', fonte: 'audio' },
      tratamentoPrevio: { valor: 'Dipirona 1g — sem alívio', fonte: 'audio' },
      antecedentesPessoais: { valor: 'Hipertensão controlada, episódio depressivo (2024)', fonte: 'formulario' },
      antecedentesFamiliares: { valor: 'Mãe com enxaqueca crônica', fonte: 'audio' },
      habitos: { valor: 'Não fuma · Álcool social · Sedentária', fonte: 'formulario' },
      sono: { valor: '5h/noite · qualidade ruim', fonte: 'audio' },
    },
    alertaProsodico: {
      texto: 'A paciente hesitou 3 vezes ao falar sobre os analgésicos que tomou e demonstrou tensão na voz ao mencionar histórico familiar. Considere investigar uso real de medicação.',
      features: 'pausas: 3 · variação tonal: alta · ritmo: 78 wpm',
    },
    padroesObservados_v2: [
      {
        nome: 'Enxaqueca sem aura', cid10: 'G43.0', score: 78,
        bloco_visual: 'padrao_diferencial',
        prevalencia: { geral: 12 },
        nivel_evidencia: 'A',
      },
      {
        bloco_visual: 'auto_medicacao',
        mensagem: 'Paciente relatou tomar dipirona apesar de alergia registrada.',
        acao_sugerida: 'Confirmar histórico alérgico em consulta e revisar uso real do fármaco.',
      },
    ],
  },
};

const FAKE_PACIENTE_PERFIL = {
  paciente: {
    id: FAKE_PACIENTE_ID,
    nome: 'Beatriz Oliveira',
    dataNascimento: '1991-08-14',
    tipoSanguineo: 'O+',
    alergias: [
      { id: 'a1', nome: 'Dipirona', gravidade: 'GRAVE' },
      { id: 'a2', nome: 'Penicilina', gravidade: 'GRAVE' },
    ],
    medicamentos: [
      { id: 'm1', nome: 'Losartana', dosagem: '50mg', frequencia: '1x/dia', ativo: true },
      { id: 'm2', nome: 'Sertralina', dosagem: '25mg', frequencia: '1x/dia', ativo: true },
      { id: 'm3', nome: 'Vitamina D', dosagem: '2.000UI', frequencia: '1x/dia', ativo: true },
    ],
    exames: [
      { id: 'e1', tipoExame: 'Hemograma',  nomeArquivo: 'Hemograma completo',   dataExame: '2026-05-06', laboratorio: 'Fleury',        arquivoUrl: THUMB_HEMOGRAMA },
      { id: 'e2', tipoExame: 'Hormônios',  nomeArquivo: 'TSH e T4 livre',       dataExame: '2026-05-03', laboratorio: 'Delboni',       arquivoUrl: THUMB_TSH },
      { id: 'e3', tipoExame: 'Bioquímica', nomeArquivo: 'Glicemia em jejum',    dataExame: '2026-05-03', laboratorio: 'Delboni',       arquivoUrl: THUMB_GLICEMIA },
      { id: 'e4', tipoExame: 'Cardiologia', nomeArquivo: 'Eletrocardiograma',   dataExame: '2026-02-17', laboratorio: 'Sírio-Libanês', arquivoUrl: THUMB_ECG },
    ],
    condicoes: [],
  },
};

const FAKE_MEDICO_USUARIO = {
  id: 'fake-med-lucas',
  nome: 'Dr. Lucas Borelli',
  email: 'lucas@vitaidsaude.com',
  tipo: 'MEDICO',
  crm: '09876543',
  uf: 'SP',
  especialidade: 'Clínica Geral',
};

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  // 1) Mock de localStorage ANTES de qualquer script da página rodar (passa pelo auth gate)
  await ctx.addInitScript(({ user, pc, perfil }) => {
    localStorage.setItem('vitae_token', 'fake-jwt-marketing');
    localStorage.setItem('vitae_usuario', JSON.stringify(user));
    // Pré-hidrata cache local de pré-consultas (pra UI rapidamente reconhecer o PC)
    localStorage.setItem('vitae_cache_pcs', JSON.stringify({ ts: Date.now(), data: { [pc.id]: pc } }));
    localStorage.setItem('vitae_cache_pacientes', JSON.stringify({ ts: Date.now(), data: { [perfil.paciente.id]: perfil.paciente } }));
    // Marca onboarding como já feito
    localStorage.setItem('vitae_onb_done', '1');
    // Guarda no window pra usar depois
    window.__FAKE_PC__ = pc;
    window.__FAKE_PERFIL__ = perfil;
  }, { user: FAKE_MEDICO_USUARIO, pc: FAKE_PC, perfil: FAKE_PACIENTE_PERFIL });

  // 2) Intercepta TODAS chamadas pra API e devolve respostas fake
  await ctx.route(/api\.vitaidsaude\.com|vitae-app-production\.up\.railway\.app/, async (route) => {
    const url = route.request().url();
    const u = new URL(url);
    const path = u.pathname;

    let body;
    if (path.startsWith('/pre-consulta/')) {
      body = { preConsulta: FAKE_PC };
    } else if (path.startsWith('/medico/pacientes/')) {
      body = FAKE_PACIENTE_PERFIL;
    } else if (path === '/medico/pre-consultas' || path === '/pre-consulta') {
      body = { preConsultas: [FAKE_PC] };
    } else if (path === '/medico/pacientes') {
      body = { pacientes: [FAKE_PACIENTE_PERFIL.paciente] };
    } else if (path === '/medico/templates') {
      body = { templates: [] };
    } else if (path === '/medico/metricas' || path.startsWith('/medico/metricas')) {
      body = { metricas: {} };
    } else if (path === '/auth/me' || path === '/medico/me') {
      body = { usuario: FAKE_MEDICO_USUARIO };
    } else if (path === '/auth/refresh') {
      body = { token: 'fake-jwt-marketing' };
    } else if (path === '/health') {
      body = { ok: true };
    } else if (path.startsWith('/agenda/')) {
      body = { slots: [], agendamentos: [] };
    } else {
      body = {};
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(body),
    });
  });

  const page = await ctx.newPage();
  page.on('console', m => {
    if (m.type() === 'error' && !m.text().includes('Failed to load resource')) {
      console.log('[browser]', m.text().slice(0, 200));
    }
  });

  console.log('→ navegando pra', URL_PROD);
  await page.goto(URL_PROD, { waitUntil: 'domcontentloaded' });

  // Aguarda o boot da SPA carregar
  await page.waitForFunction(() => typeof window.openSummary === 'function' && typeof window.STATE !== 'undefined', { timeout: 15000 });
  console.log('✓ SPA bootada — openSummary disponível');

  // Espera um pouco a UI estabilizar (cache hydration)
  await page.waitForTimeout(1500);

  // Injeta o PC fake direto no STATE.PCS pra openSummary achar
  await page.evaluate(({ pc }) => {
    if (typeof PCS === 'undefined') window.PCS = {};
    PCS[pc.id] = pc;
  }, { pc: FAKE_PC });

  // Dispara openSummary
  console.log('→ abrindo summary view');
  await page.evaluate((id) => window.openSummary(id), FAKE_PC_ID);

  // Espera o v-summary renderizar (precisa do .resumo-wrap aparecer dentro)
  await page.waitForSelector('#v-summary .resumo-wrap', { timeout: 10000 });
  console.log('✓ v-summary renderizado');

  // Sincroniza captura com mudanças locais ainda não deployadas pra produção.
  // Quando o deploy for feito, esse replace vira no-op (texto já bate).
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => {
      if (b.innerHTML.includes('Exportar iClinic')) {
        b.innerHTML = b.innerHTML.replace('Exportar iClinic', 'Exportar prontuário');
      }
    });
  });

  // Pequeno delay pra fontes/animações estabilizarem
  await page.waitForTimeout(1200);

  await page.screenshot({ path: OUT, fullPage: false });
  console.log('✓ saved →', OUT);

  await browser.close();
})().catch(err => { console.error('✗ erro:', err.message); process.exit(1); });
