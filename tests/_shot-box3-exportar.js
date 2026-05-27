/**
 * Captura o popup "Exportar para iClinic" do app médico em alta resolução
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'docs', 'marketing', 'screens', 'thumbs');
const APP_BASE = 'file:///' + path.resolve(__dirname, '..').replace(/\\/g, '/');

const FAKE_PACIENTE_ID = 'fake-pac-beatriz-2026';
const FAKE_PC_ID = 'fake-pc-beatriz-cefaleia';
const FAKE_MEDICO = { id:'fake-med-lucas', nome:'Dr. Lucas Borelli', tipo:'MEDICO', crm:'09876543', uf:'SP', especialidade:'Clínica Geral' };
const FAKE_PC = {
  id: FAKE_PC_ID, pacienteId: FAKE_PACIENTE_ID, pacienteNome: 'daniel aaaa',
  status:'RESPONDIDA',
  cobertura:'completa',
  respostas:{ dataNascimento:'1991-08-14', tipoSanguineo:'O+' },
  summaryJson:{
    descricaoBreve:'Dor retro-orbital há 3-4 dias; dor abdominal em pontadas, episódica, intensidade 10/10, lado direito em baixo do suvaco, perto do pâncreas.',
    queixaPrincipal:'Dor retro-orbital há 3-4 dias; dor abdominal em pontadas.',
    hmaTexto:'Paciente refere dor retro-orbital há 3-4 dias; dor abdominal em pontadas, episódica, intensidade 10/10, lado direito em baixo do suvaco, perto do pâncreas ha 3-4 dias (ocular); episódica, 15-20 minutos (abdominal). Intensidade: 10. Piora com Alimentos fortes (abdominal). Melhora com Evacuação/flatulência (abdominal).',
    apTexto:'Diabetes; cirurgia de apendicite. Alergia documentada a dipirona.',
    afTexto:'Nao relatado.',
    medicamentos:'losartana',
    habitos:'Fuma pod.',
  },
};
const FAKE_PERFIL = {
  paciente:{
    id: FAKE_PACIENTE_ID, nome:'daniel aaaa', dataNascimento:'1991-08-14', tipoSanguineo:'O+',
    alergias:[{id:'a1',nome:'Dipirona',gravidade:'GRAVE'}],
    medicamentos:[{id:'m1',nome:'Losartana',dosagem:'50mg',ativo:true}],
    exames:[],
  }
};

(async () => {
  const browser = await chromium.launch({ channel:'msedge', headless:true });
  const ctx = await browser.newContext({ viewport:{ width:1440, height:900 }, deviceScaleFactor:2 });

  await ctx.addInitScript(({user, pc, perfil}) => {
    localStorage.setItem('vitae_token', 'fake-jwt');
    localStorage.setItem('vitae_usuario', JSON.stringify(user));
    localStorage.setItem('vitae_cache_pcs', JSON.stringify({ts:Date.now(), data:{[pc.id]:pc}}));
    localStorage.setItem('vitae_cache_pacientes', JSON.stringify({ts:Date.now(), data:{[perfil.paciente.id]:perfil.paciente}}));
  }, { user: FAKE_MEDICO, pc: FAKE_PC, perfil: FAKE_PERFIL });

  await ctx.route(/api\.vitaidsaude\.com|vitae-app-production\.up\.railway\.app/, async (route) => {
    const u = new URL(route.request().url());
    const p = u.pathname;
    let body = {};
    if (p.startsWith('/pre-consulta/')) body = { preConsulta: FAKE_PC };
    else if (p.startsWith('/medico/pacientes/')) body = FAKE_PERFIL;
    else if (p === '/medico/pre-consultas') body = { preConsultas: [FAKE_PC] };
    else if (p === '/medico/pacientes') body = { pacientes: [FAKE_PERFIL.paciente] };
    else if (p === '/auth/me' || p === '/medico/me') body = { usuario: FAKE_MEDICO };
    else if (p === '/auth/refresh') body = { token:'fake-jwt' };
    await route.fulfill({ status:200, contentType:'application/json', headers:{'Access-Control-Allow-Origin':'*'}, body: JSON.stringify(body) });
  });

  const page = await ctx.newPage();
  await page.goto(APP_BASE + '/desktop/app-v2.html', { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openSummary === 'function', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.evaluate(({pc}) => { if (typeof PCS === 'undefined') window.PCS = {}; PCS[pc.id] = pc; }, { pc: FAKE_PC });
  await page.evaluate((id) => window.openSummary(id), FAKE_PC_ID);
  await page.waitForSelector('#v-summary .resumo-wrap', { timeout: 10000 });
  await page.evaluate(({pc, perfil}) => {
    if (typeof pcState !== 'undefined') {
      pcState.currentPC = pc;
      pcState.currentPacienteData = perfil.paciente;
    }
  }, { pc: FAKE_PC, perfil: FAKE_PERFIL });
  await page.waitForTimeout(600);

  await page.evaluate(() => { try { window.pcOpenIclModal && window.pcOpenIclModal(); } catch(e){ console.error(e); } });
  await page.waitForTimeout(1500);

  const box = await page.evaluate(() => {
    const m = document.querySelector('#pc-modalIcl .pc-icl-card') || document.querySelector('#pc-modalIcl > div') || document.querySelector('#pc-modalIcl');
    if (!m) return null;
    const r = m.getBoundingClientRect();
    if (r.width < 100) return null;
    return { x: Math.max(0, Math.floor(r.left - 20)), y: Math.max(0, Math.floor(r.top - 20)), width: Math.min(1440, Math.ceil(r.width + 40)), height: Math.min(900, Math.ceil(r.height + 40)) };
  });
  console.log('export modal box:', JSON.stringify(box));
  if (box) {
    await page.screenshot({ path: path.join(OUT, 'box3-exportar-modal.png'), clip: box });
    console.log('✓ box3-exportar-modal.png');
  } else {
    await page.screenshot({ path: path.join(OUT, 'box3-exportar-modal.png') });
    console.log('⚠ fallback fullpage');
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
