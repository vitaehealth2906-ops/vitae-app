/**
 * Captura todas as telas REAIS necessárias pra Box 3:
 *  - retorno-modal.png    : modal "Marcar retorno" aberto (médico)
 *  - documento-modal.png  : modal "Anexar documento" aberto (médico)
 *  - pac-consultas.png    : iPhone — aba consultas com retorno marcado
 *  - pac-doc-detalhe.png  : iPhone — detalhe consulta com documentos
 *  - pac-medicamentos.png : iPhone — aba medicamentos
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'docs', 'marketing', 'screens', 'thumbs');
// USA ARQUIVOS LOCAIS — Vercel ativou proteção anti-bot
const APP_BASE = 'file:///' + path.resolve(__dirname, '..').replace(/\\/g, '/');

// Paciente fictícia consistente com as outras boxes
const FAKE_PACIENTE_ID = 'fake-pac-beatriz-2026';
const FAKE_PC_ID = 'fake-pc-beatriz-cefaleia';
const FAKE_MEDICO = {
  id:'fake-med-lucas', nome:'Dr. Lucas Borelli',
  tipo:'MEDICO', crm:'09876543', uf:'SP', especialidade:'Clínica Geral'
};
const FAKE_PC = {
  id: FAKE_PC_ID, pacienteId: FAKE_PACIENTE_ID, pacienteNome: 'Beatriz Oliveira',
  status:'RESPONDIDA',
  respostas:{ dataNascimento:'1991-08-14', tipoSanguineo:'O+' },
  summaryJson:{ descricaoBreve:'Cefaleia pulsátil unilateral há 12 dias.', queixaPrincipal:'Cefaleia pulsátil unilateral há 12 dias.' },
};
const FAKE_PERFIL = {
  paciente:{
    id: FAKE_PACIENTE_ID, nome:'Beatriz Oliveira', dataNascimento:'1991-08-14', tipoSanguineo:'O+',
    alergias:[{id:'a1',nome:'Dipirona',gravidade:'GRAVE'},{id:'a2',nome:'Penicilina',gravidade:'GRAVE'}],
    medicamentos:[{id:'m1',nome:'Losartana',dosagem:'50mg',ativo:true}],
    exames:[],
  }
};

(async () => {
  const browser = await chromium.launch({ channel:'msedge', headless:true });

  // ════════════════════════════════════════════════════════════════
  // 1+2: MODAIS DO MÉDICO (Marcar retorno + Anexar documento)
  // ════════════════════════════════════════════════════════════════
  const ctxMed = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  await ctxMed.addInitScript(({user, pc, perfil}) => {
    localStorage.setItem('vitae_token', 'fake-jwt');
    localStorage.setItem('vitae_usuario', JSON.stringify(user));
    localStorage.setItem('vitae_cache_pcs', JSON.stringify({ts:Date.now(), data:{[pc.id]:pc}}));
    localStorage.setItem('vitae_cache_pacientes', JSON.stringify({ts:Date.now(), data:{[perfil.paciente.id]:perfil.paciente}}));
  }, { user: FAKE_MEDICO, pc: FAKE_PC, perfil: FAKE_PERFIL });

  await ctxMed.route(/api\.vitaidsaude\.com|vitae-app-production\.up\.railway\.app/, async (route) => {
    const u = new URL(route.request().url());
    const p = u.pathname;
    let body = {};
    if (p.startsWith('/pre-consulta/')) body = { preConsulta: FAKE_PC };
    else if (p.startsWith('/medico/pacientes/')) body = FAKE_PERFIL;
    else if (p === '/medico/pre-consultas') body = { preConsultas: [FAKE_PC] };
    else if (p === '/medico/pacientes') body = { pacientes: [FAKE_PERFIL.paciente] };
    else if (p === '/medico/templates') body = { templates: [] };
    else if (p.startsWith('/medico/metricas')) body = { metricas: {} };
    else if (p === '/auth/me' || p === '/medico/me') body = { usuario: FAKE_MEDICO };
    else if (p === '/auth/refresh') body = { token:'fake-jwt' };
    else if (p.startsWith('/agenda/')) body = { slots:[], agendamentos:[] };
    await route.fulfill({ status:200, contentType:'application/json', headers:{'Access-Control-Allow-Origin':'*'}, body: JSON.stringify(body) });
  });

  const pageMed = await ctxMed.newPage();
  await pageMed.goto(APP_BASE + '/desktop/app-v2.html', { waitUntil:'domcontentloaded' });
  await pageMed.waitForFunction(() => typeof window.openSummary === 'function', { timeout: 30000 });
  await pageMed.waitForTimeout(1200);
  await pageMed.evaluate(({pc}) => { if (typeof PCS === 'undefined') window.PCS = {}; PCS[pc.id] = pc; }, { pc: FAKE_PC });
  await pageMed.evaluate((id) => window.openSummary(id), FAKE_PC_ID);
  await pageMed.waitForSelector('#v-summary .resumo-wrap', { timeout: 10000 });
  // Garante pcState populado pros modais
  await pageMed.evaluate(({pc, perfil}) => {
    if (typeof pcState !== 'undefined') {
      pcState.currentPC = pc;
      pcState.currentPacienteData = perfil.paciente;
    }
  }, { pc: FAKE_PC, perfil: FAKE_PERFIL });
  await pageMed.waitForTimeout(500);

  // === Base: V-Summary do paciente (sem modal) ===
  console.log('\n=== Base summary médico ===');
  await pageMed.screenshot({ path: path.join(OUT, 'box3-med-summary.png'), fullPage: false });
  console.log('✓ box3-med-summary.png');

  // === Modal 1: Marcar retorno ===
  console.log('\n=== Modal Marcar Retorno ===');
  await pageMed.evaluate((id) => {
    try { window.prAbrirMarcarRetorno && window.prAbrirMarcarRetorno(id); } catch(e) { console.error(e); }
  }, FAKE_PACIENTE_ID);
  await pageMed.waitForTimeout(1200);
  const retornoBox = await pageMed.evaluate(() => {
    const m = document.querySelector('.modal-bg.show .modal') || document.querySelector('#modalCard');
    if (!m) return null;
    const r = m.getBoundingClientRect();
    if (r.width < 100) return null;
    return { x: Math.max(0, Math.floor(r.left - 30)), y: Math.max(0, Math.floor(r.top - 30)), width: Math.min(1440, Math.ceil(r.width + 60)), height: Math.min(900, Math.ceil(r.height + 60)) };
  });
  console.log('retorno modal box:', JSON.stringify(retornoBox));
  if (retornoBox) {
    await pageMed.screenshot({ path: path.join(OUT, 'box3-retorno-modal.png'), clip: retornoBox });
    console.log('✓ box3-retorno-modal.png');
  } else {
    await pageMed.screenshot({ path: path.join(OUT, 'box3-retorno-modal.png') });
    console.log('⚠ fallback fullpage retorno');
  }

  // Fecha modal
  await pageMed.evaluate(() => { try { window.closeModal && window.closeModal(); } catch(e){} });
  await pageMed.waitForTimeout(500);

  // === Modal 2: Anexar documento ===
  console.log('\n=== Modal Anexar Documento ===');
  await pageMed.evaluate((id) => {
    try { window.pdAnexarDocumento && window.pdAnexarDocumento(id); } catch(e) { console.error(e); }
  }, FAKE_PACIENTE_ID);
  await pageMed.waitForTimeout(1200);
  const docBox = await pageMed.evaluate(() => {
    const m = document.querySelector('.modal-bg.show .modal') || document.querySelector('#modalCard');
    if (!m) return null;
    const r = m.getBoundingClientRect();
    if (r.width < 100) return null;
    return { x: Math.max(0, Math.floor(r.left - 30)), y: Math.max(0, Math.floor(r.top - 30)), width: Math.min(1440, Math.ceil(r.width + 60)), height: Math.min(900, Math.ceil(r.height + 60)) };
  });
  console.log('documento modal box:', JSON.stringify(docBox));
  if (docBox) {
    await pageMed.screenshot({ path: path.join(OUT, 'box3-documento-modal.png'), clip: docBox });
    console.log('✓ box3-documento-modal.png');
  } else {
    await pageMed.screenshot({ path: path.join(OUT, 'box3-documento-modal.png') });
    console.log('⚠ fallback fullpage documento');
  }

  await ctxMed.close();

  // ════════════════════════════════════════════════════════════════
  // 3+4+5: TELAS DO PACIENTE (iPhone — abrir HTML local)
  // ════════════════════════════════════════════════════════════════
  const ctxPac = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  // Mock COMPLETO do app paciente — intercepta vitaeAPI quando api.js cria
  await ctxPac.addInitScript(() => {
    localStorage.setItem('vitae_token', 'mock-jwt');
    localStorage.setItem('vitae_usuario', JSON.stringify({id:'mock-pac', nome:'Beatriz Oliveira', dataNascimento:'1991-08-14'}));
    localStorage.setItem('vitae_perfil_saude', JSON.stringify({tipoSanguineo:'O_POS', dataNascimento:'1991-08-14'}));

    // Agendamento de retorno proposto pelo médico (sem Z = horário local)
    const AG = {
      id:'ag-retorno-jun',
      dataHora:'2026-06-24T09:00:00',
      medico:'Dr. Lucas Borelli',
      titulo:'Dr. Lucas Borelli',
      tipo:'Clínica Geral',
      local:'Av. Paulista 1500 — sala 408',
      statusProposta:'AGUARDANDO_PACIENTE',
      contadorTrocas:0,
      recadoPaciente:'Trazer exames recentes pra avaliarmos juntos.',
    };
    const MEDICO = {
      id:'med-lucas', nome:'Dr. Lucas Borelli', crm:'09876543', uf:'SP',
      especialidade:'Clínica Geral',
      contato:{ numero:'5511987654321', whatsapp:'5511987654321' },
      retornoPendente:true,
      agendamentos:[AG],
      documentos:[
        {id:'d1', nome:'Receita — Losartana 50mg', tipoDocumento:'RECEITA', criadoEm:'2026-05-25T10:52:00', medicoNome:'Dr. Lucas Borelli', tamanhoBytes:120000},
        {id:'d2', nome:'Laudo — Hemograma completo', tipoDocumento:'LAUDO',   criadoEm:'2026-05-25T10:52:00', medicoNome:'Dr. Lucas Borelli', tamanhoBytes:340000},
      ],
    };

    const MOCKS = {
      isLoggedIn: () => true,
      getToken: () => 'mock-jwt',
      getUsuario: () => ({id:'mock-pac', nome:'Beatriz Oliveira'}),
      listarAgendamentos: async () => ({ agendamentos: [AG] }),
      listarMeusMedicos: async () => ({ medicos: [MEDICO] }),
      listarMedicamentos: async () => ({ medicamentos: [
        {id:'m1', nome:'Losartana', dosagem:'50mg', frequencia:'1x/dia', ativo:true, prescritoPor:'Dr. Lucas Borelli', dataInicio:'2026-05-25'},
        {id:'m2', nome:'Sertralina', dosagem:'25mg', frequencia:'1x/dia', ativo:true},
        {id:'m3', nome:'Vitamina D', dosagem:'2.000UI', frequencia:'1x/dia', ativo:true},
      ]}),
      listarDocumentosConsulta: async () => ({ documentos: MEDICO.documentos }),
      listarDocumentos: async () => ({ documentos: MEDICO.documentos }),
      getFlagsApp: async () => ({
        onboardingConsultasVisto:'2026-05-01',
        onboardingExamesVisto:'2026-05-01',
        onboardingHomeVisto:'2026-05-01',
        onboardingMedicamentosVisto:'2026-05-01',
      }),
      setFlagsApp: async () => ({}),
      getPreConsultaEmAndamento: async () => null,
      confirmarRetorno: async () => ({ok:true}),
      propostaRemarcacao: async () => ({ok:true}),
      listarExames: async () => ({ exames: [] }),
      getPerfilSaude: async () => ({tipoSanguineo:'O_POS', dataNascimento:'1991-08-14'}),
      _telemetryDocumentView: async () => ({ok:true}),
    };

    // Captura o vitaeAPI quando api.js setar, e injeta os mocks
    let _api;
    Object.defineProperty(window, 'vitaeAPI', {
      configurable: true,
      get() { return _api; },
      set(v) { _api = Object.assign(v || {}, MOCKS); }
    });

    // Esconde o banner "Sem conexão" via CSS (api.js injeta no carregamento)
    const css = document.createElement('style');
    css.textContent = `
      .vitae-banner-host, .vitae-banner, [id^="vbanner_"] { display:none !important; }
    `;
    if (document.head) document.head.appendChild(css);
    else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(css), { once:true });
  });

  const screens = [
    { html: '17-proxima-consulta.html?id=ag-retorno-jun', out: 'box3-pac-proxima.png',     label: 'próxima consulta (retorno)' },
    { html: '16-consulta-detalhe.html?id=ag-retorno-jun', out: 'box3-pac-consulta-doc.png', label: 'detalhe consulta + docs' },
    { html: '03-medicamentos.html',                       out: 'box3-pac-medicamentos.png', label: 'medicamentos' },
    { html: '15-consultas.html',                          out: 'box3-pac-consultas.png',    label: 'lista consultas' },
  ];

  for (const s of screens) {
    const pagePac = await ctxPac.newPage();
    pagePac.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log('  [' + s.out + ' ' + msg.type() + ']', msg.text().slice(0, 200));
      }
    });
    pagePac.on('pageerror', err => {
      console.log('  [' + s.out + ' PAGEERROR]', err.message.slice(0, 200));
    });
    try {
      await pagePac.goto(APP_BASE + '/app-v3/' + s.html, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await pagePac.waitForTimeout(2500); // deixa onboarding/loading passar
      // Garante banner escondido caso CSS tenha sido inserido depois
      await pagePac.evaluate(() => {
        document.querySelectorAll('.vitae-banner-host, .vitae-banner, [id^="vbanner_"]').forEach(el => el.style.display = 'none');
      });
      await pagePac.screenshot({ path: path.join(OUT, s.out), fullPage: false });
      console.log('✓', s.out, '·', s.label);
    } catch(e) {
      console.log('✗', s.out, ':', e.message.slice(0, 100));
    }
    await pagePac.close();
  }

  await ctxPac.close();
  await browser.close();
  console.log('\n✓ DONE');
})().catch(e => { console.error('✗', e.message); process.exit(1); });
