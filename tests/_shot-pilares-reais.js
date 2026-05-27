/**
 * Captura as 3 telas REAIS do app pra usar nos 3 cards da seção pilares.
 *  Pilar 1 → iPhone do paciente respondendo pré-consulta (iphone-preconsulta.html local)
 *  Pilar 2 → desktop com Resumo de 1 minuto completo (re-aproveita laptop-real.png já capturado)
 *  Pilar 3 → desktop com modal "Exportar prontuário" aberto (pcOpenIclModal disparado)
 *
 * Saída:
 *  docs/marketing/screens/thumbs/pilar-1-preconsulta.png
 *  docs/marketing/screens/thumbs/pilar-2-briefing.png  (cópia/recorte de laptop-real)
 *  docs/marketing/screens/thumbs/pilar-3-export.png
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PROD_URL = 'https://vitae-app.vercel.app/desktop/app-v2.html';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'marketing', 'screens', 'thumbs');
const THUMBS_DIR = OUT_DIR;

function toDataUri(name){
  const file = path.join(THUMBS_DIR, name + '.jpg');
  const b64 = fs.readFileSync(file).toString('base64');
  return 'data:image/jpeg;base64,' + b64 + '#x.jpg';
}

const FAKE_PACIENTE_ID = 'fake-pac-beatriz-2026';
const FAKE_PC_ID = 'fake-pc-beatriz-cefaleia';

const FAKE_MEDICO = {
  id:'fake-med-lucas', nome:'Dr. Lucas Borelli', email:'lucas@vitaidsaude.com',
  tipo:'MEDICO', crm:'09876543', uf:'SP', especialidade:'Clínica Geral'
};

const FAKE_PC = {
  id: FAKE_PC_ID,
  pacienteId: FAKE_PACIENTE_ID,
  pacienteNome: 'Beatriz Oliveira',
  status: 'RESPONDIDA',
  criadoEm: '2026-05-24T13:30:00Z',
  respondidaEm: '2026-05-24T13:52:00Z',
  respostas: { dataNascimento:'1991-08-14', tipoSanguineo:'O+', queixaPrincipal:'Dor de cabeça há 12 dias' },
  summaryJson: {
    textoVoz: 'A paciente Beatriz, 34 anos, relata cefaleia pulsátil unilateral à direita há 12 dias, com piora ao se abaixar e ausência de alívio com dipirona. Refere uso prévio de analgésicos comuns sem sucesso. Histórico de uso de Losartana 50mg, Sertralina 25mg e Vitamina D. Alergia conhecida à dipirona e penicilina. Nega febre, vômitos ou alterações visuais. Sono fragmentado nas últimas duas semanas.',
    descricaoBreve: 'Cefaleia pulsátil unilateral há 12 dias sem alívio com analgésico comum.',
    queixaPrincipal: 'Cefaleia pulsátil unilateral há 12 dias, sem alívio com analgésico comum.',
    anamneseEstruturada: {
      queixaPrincipal: { valor:'Cefaleia pulsátil unilateral à direita, há 12 dias, com piora ao se abaixar e sem alívio com analgésico comum.', fonte:'audio' },
      tempoEvolucao: { valor:'12 dias', fonte:'audio' },
      intensidade: { valor:'7/10', fonte:'audio' },
      fatoresAgravantes: { valor:'Inclinar cabeça, claridade', fonte:'audio' },
      fatoresAtenuantes: { valor:'Ambiente escuro', fonte:'audio' },
      sintomasAssociados: { valor:'Sono fragmentado, irritabilidade', fonte:'audio' },
      tratamentoPrevio: { valor:'Dipirona 1g — sem alívio', fonte:'audio' },
      antecedentesPessoais: { valor:'Hipertensão controlada', fonte:'formulario' },
      antecedentesFamiliares: { valor:'Mãe com enxaqueca crônica', fonte:'audio' },
      habitos: { valor:'Não fuma · Álcool social', fonte:'formulario' },
      sono: { valor:'5h/noite · qualidade ruim', fonte:'audio' },
    },
    alertaProsodico: { texto:'Hesitou 3x sobre analgésicos. Tensão na voz ao falar do histórico familiar.', features:'pausas:3 · ritmo:78wpm' },
  },
};

const FAKE_PERFIL = {
  paciente: {
    id: FAKE_PACIENTE_ID, nome:'Beatriz Oliveira', dataNascimento:'1991-08-14', tipoSanguineo:'O+',
    alergias:[
      { id:'a1', nome:'Dipirona', gravidade:'GRAVE' },
      { id:'a2', nome:'Penicilina', gravidade:'GRAVE' },
    ],
    medicamentos:[
      { id:'m1', nome:'Losartana', dosagem:'50mg', frequencia:'1x/dia', ativo:true },
      { id:'m2', nome:'Sertralina', dosagem:'25mg', frequencia:'1x/dia', ativo:true },
      { id:'m3', nome:'Vitamina D', dosagem:'2.000UI', frequencia:'1x/dia', ativo:true },
    ],
    exames:[],  // preenchido abaixo com data URIs reais
    condicoes:[],
  },
};

// Carrega as miniaturas reais como data URI
FAKE_PERFIL.paciente.exames = [
  { id:'e1', tipoExame:'Hemograma',   nomeArquivo:'Hemograma completo',   dataExame:'2026-05-06', laboratorio:'Fleury',        arquivoUrl: toDataUri('hemograma') },
  { id:'e2', tipoExame:'Hormônios',   nomeArquivo:'TSH e T4 livre',       dataExame:'2026-05-03', laboratorio:'Delboni',       arquivoUrl: toDataUri('tsh') },
  { id:'e3', tipoExame:'Bioquímica',  nomeArquivo:'Glicemia em jejum',    dataExame:'2026-05-03', laboratorio:'Delboni',       arquivoUrl: toDataUri('glicemia') },
  { id:'e4', tipoExame:'Cardiologia', nomeArquivo:'Eletrocardiograma',    dataExame:'2026-02-17', laboratorio:'Sírio-Libanês', arquivoUrl: toDataUri('ecg') },
];

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  // ════════════════════════════════════════════════════════════════
  // PILAR 1 — iPhone do paciente respondendo pré-consulta
  // ════════════════════════════════════════════════════════════════
  console.log('\n=== PILAR 1: iPhone pré-consulta ===');
  {
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 852 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    const url = 'file:///' + path.resolve(__dirname, '..', 'docs', 'marketing', 'screens', 'iphone-preconsulta.html').replace(/\\/g, '/');
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const out = path.join(OUT_DIR, 'pilar-1-preconsulta.png');
    await page.screenshot({ path: out });
    console.log('✓', out);
    await ctx.close();
  }

  // ════════════════════════════════════════════════════════════════
  // PILAR 2 — desktop com Resumo de 1 minuto completo
  // Re-captura completa pra ter dimensões consistentes com pilar 3
  // ════════════════════════════════════════════════════════════════
  console.log('\n=== PILAR 2: desktop briefing ===');
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });

    await ctx.addInitScript(({ user, pc, perfil }) => {
      localStorage.setItem('vitae_token', 'fake-jwt');
      localStorage.setItem('vitae_usuario', JSON.stringify(user));
      localStorage.setItem('vitae_cache_pcs', JSON.stringify({ ts: Date.now(), data: { [pc.id]: pc } }));
      localStorage.setItem('vitae_cache_pacientes', JSON.stringify({ ts: Date.now(), data: { [perfil.paciente.id]: perfil.paciente } }));
    }, { user: FAKE_MEDICO, pc: FAKE_PC, perfil: FAKE_PERFIL });

    await ctx.route(/api\.vitaidsaude\.com|vitae-app-production\.up\.railway\.app/, async (route) => {
      const u = new URL(route.request().url());
      const p = u.pathname;
      let body = {};
      if (p.startsWith('/pre-consulta/')) body = { preConsulta: FAKE_PC };
      else if (p.startsWith('/medico/pacientes/')) body = FAKE_PERFIL;
      else if (p === '/medico/pre-consultas' || p === '/pre-consulta') body = { preConsultas: [FAKE_PC] };
      else if (p === '/medico/pacientes') body = { pacientes: [FAKE_PERFIL.paciente] };
      else if (p === '/medico/templates') body = { templates: [] };
      else if (p.startsWith('/medico/metricas')) body = { metricas: {} };
      else if (p === '/auth/me' || p === '/medico/me') body = { usuario: FAKE_MEDICO };
      else if (p === '/auth/refresh') body = { token: 'fake-jwt' };
      else if (p.startsWith('/agenda/')) body = { slots:[], agendamentos:[] };
      await route.fulfill({ status:200, contentType:'application/json', headers:{'Access-Control-Allow-Origin':'*'}, body: JSON.stringify(body) });
    });

    const page = await ctx.newPage();
    await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.openSummary === 'function', { timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.evaluate(({ pc }) => { if (typeof PCS === 'undefined') window.PCS = {}; PCS[pc.id] = pc; }, { pc: FAKE_PC });
    await page.evaluate((id) => window.openSummary(id), FAKE_PC_ID);
    await page.waitForSelector('#v-summary .resumo-wrap', { timeout: 10000 });
    // Aplica o swap de copy "Exportar iClinic" → "Exportar prontuário"
    await page.evaluate(() => {
      document.querySelectorAll('button').forEach(b => {
        if (b.innerHTML.includes('Exportar iClinic')) b.innerHTML = b.innerHTML.replace('Exportar iClinic', 'Exportar prontuário');
      });
    });
    await page.waitForTimeout(1200);

    // PILAR 2: captura SÓ a área de conteúdo central (sem sidebar) + crop pra parte que importa
    // .content tem padding 26 28, max-width 1320 — pego a área visível do resumo
    const out = path.join(OUT_DIR, 'pilar-2-briefing.png');
    const contentBox = await page.evaluate(() => {
      const el = document.querySelector('.content');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      // Foca na parte que contém pac-card + audio + queixa + right-col (alergias/meds/exames)
      return { x: Math.max(0, r.left + 8), y: Math.max(0, r.top + 90), width: Math.min(1100, r.width - 16), height: 720 };
    });
    if (contentBox) {
      await page.screenshot({ path: out, clip: contentBox });
    } else {
      await page.screenshot({ path: out, fullPage: false });
    }
    console.log('✓', out);

    // ════════════════════════════════════════════════════════════════
    // PILAR 3 — usa o MESMO contexto: dispara modal export e captura
    // ════════════════════════════════════════════════════════════════
    console.log('\n=== PILAR 3: desktop com modal Exportar ===');

    // FIX: força pcState.currentPC + pcState.currentPacienteData antes de chamar pcOpenIclModal
    // (race condition — openSummary populou globals mas pcState pode ter sido resetado)
    await page.evaluate(({ pc, perfil }) => {
      if (typeof pcState !== 'undefined') {
        pcState.currentPC = pc;
        pcState.currentPacienteData = perfil.paciente;
      }
      // Garante que PCS global também tem o PC
      if (typeof PCS !== 'undefined') PCS[pc.id] = pc;
    }, { pc: FAKE_PC, perfil: FAKE_PERFIL });
    await page.waitForTimeout(300);

    const preState = await page.evaluate(() => ({
      hasFn: typeof window.pcOpenIclModal === 'function',
      pcStateCurrentPC: typeof pcState !== 'undefined' && pcState.currentPC ? pcState.currentPC.pacienteNome : null,
      pcStateCurrentPacienteData: typeof pcState !== 'undefined' && pcState.currentPacienteData ? (pcState.currentPacienteData.alergias||[]).length + ' alergias' : null,
    }));
    console.log('preState:', JSON.stringify(preState));

    await page.evaluate(() => {
      try { window.pcOpenIclModal && window.pcOpenIclModal(); } catch (e) { console.error('erro:', e.message); }
    });
    await page.waitForTimeout(1500);

    // ▼ Modal CORRETO: #pc-modalIcl (.pc-icl-overlay), criado dinamicamente em document.body
    const modalInfo = await page.evaluate(() => {
      const m = document.querySelector('#pc-modalIcl');
      return {
        exists: !!m,
        classes: m ? m.className : 'NULL',
        hasShow: m ? m.classList.contains('show') : false,
        innerHTMLLength: m ? m.innerHTML.length : 0,
        noteText: document.getElementById('pc-iclNote') ? document.getElementById('pc-iclNote').textContent.slice(0, 120) : 'NULL',
      };
    });
    console.log('modal info:', JSON.stringify(modalInfo));

    // Aplica swap de copy "iClinic" → "prontuário"
    await page.evaluate(() => {
      document.querySelectorAll('*').forEach(el => {
        if (el.children.length === 0 && el.textContent.includes('iClinic')) {
          el.textContent = el.textContent.replace(/iClinic/g, 'prontuário');
        }
      });
    });
    // PILAR 3: captura SÓ o body do modal pc-icl-overlay (centralizado)
    const out3 = path.join(OUT_DIR, 'pilar-3-export.png');
    const modalBox = await page.evaluate(() => {
      const m = document.querySelector('#pc-modalIcl .pc-icl-body') || document.querySelector('#pc-modalIcl');
      if (!m) return null;
      const r = m.getBoundingClientRect();
      if (r.width < 100 || r.height < 100) return null;
      return {
        x: Math.max(0, Math.floor(r.left - 24)),
        y: Math.max(0, Math.floor(r.top - 24)),
        width: Math.min(1440, Math.ceil(r.width + 48)),
        height: Math.min(900, Math.ceil(r.height + 48)),
      };
    });
    console.log('modal box:', JSON.stringify(modalBox));
    if (modalBox) {
      await page.screenshot({ path: out3, clip: modalBox });
    } else {
      console.warn('modal não capturado — usando viewport inteiro como fallback');
      await page.screenshot({ path: out3, fullPage: false });
    }
    console.log('✓', out3);

    await ctx.close();
  }

  await browser.close();
  console.log('\n✓ DONE — 3 capturas reais em', OUT_DIR);
})().catch(e => { console.error('✗', e.message); process.exit(1); });
