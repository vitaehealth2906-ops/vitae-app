/**
 * MASTER E2E — 19/MAI/2026
 * Bateria autônoma cobrindo 4 camadas:
 *   A — Link de pré-consulta (paciente)
 *   B — Aba Pacientes do médico desktop
 *   C — Aba Consultas do paciente v3
 *   D — Cruzados (médico↔paciente — retorno + documentos + WhatsApp)
 *
 * Princípios:
 *   - Roda do início ao fim SEM parar
 *   - Cada cenário tem timeout 90s
 *   - Falha não interrompe — marca ❌ e segue
 *   - Cleanup automático no fim
 *   - Relatório MD + JSON
 *
 * Output:
 *   tests/master-<ts>/relatorio.md
 *   tests/master-<ts>/relatorio.json
 *   tests/master-<ts>/prints/<camada>/<cenario>/<passo>.png
 *   tests/master-<ts>/videos/...
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ============== CONFIG ==============
const APP = 'https://vitae-app.vercel.app';
const API = 'https://vitae-app-production.up.railway.app';
const PREFIX = 'ROBO-MASTER-19MAI';
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = path.join(__dirname, `master-${TS}`);
const PRINTS = path.join(OUT, 'prints');
const VIDEOS = path.join(OUT, 'videos');
fs.mkdirSync(PRINTS, { recursive: true });
fs.mkdirSync(VIDEOS, { recursive: true });

const MED_EMAIL = process.env.MEDICO_EMAIL;
const MED_SENHA = process.env.MEDICO_SENHA;
const PAC_EMAIL = process.env.PACIENTE_EMAIL;
const PAC_SENHA = process.env.PACIENTE_SENHA;

// Estado global de recursos criados (pro cleanup)
const recursosCriados = {
  preConsultas: [],
  agendamentos: [],
  documentos: [],
};

const relatorio = {
  startedAt: new Date().toISOString(),
  endedAt: null,
  cenarios: [],
  resumo: { total: 0, passou: 0, parcial: 0, falhou: 0 },
  recursosCriados,
};

// ============== HELPERS ==============

function log(s) {
  const t = new Date().toLocaleTimeString('pt-BR');
  console.log(`[${t}] ${s}`);
}

function salvarRelatorioJSON() {
  fs.writeFileSync(path.join(OUT, 'relatorio.json'), JSON.stringify(relatorio, null, 2));
}

function emoji(status) {
  return status === 'passou' ? '✅' : status === 'parcial' ? '⚠️' : status === 'falhou' ? '❌' : '⏭️';
}

function logCenario(id, nome, status, tempoMs, erro = null, detalhes = '') {
  const c = { id, nome, status, tempoMs, erro: erro ? String(erro.message || erro) : null, detalhes, finalizadoEm: new Date().toISOString() };
  relatorio.cenarios.push(c);
  relatorio.resumo.total++;
  relatorio.resumo[status] = (relatorio.resumo[status] || 0) + 1;
  log(`  ${emoji(status)} [${id}] ${nome} (${tempoMs}ms)${erro ? ' — ' + (erro.message || erro) : ''}`);
  salvarRelatorioJSON();
}

async function executarCenario(id, nome, fn, timeoutMs = 90000) {
  const start = Date.now();
  log(`▶️  [${id}] ${nome}`);
  try {
    await Promise.race([
      fn(),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout ${timeoutMs / 1000}s`)), timeoutMs)),
    ]);
    logCenario(id, nome, 'passou', Date.now() - start);
  } catch (err) {
    logCenario(id, nome, 'falhou', Date.now() - start, err);
  }
}

// Diretório do cenário pra prints
function dirCenario(id) {
  const safe = id.replace(/[^\w.-]/g, '_');
  const d = path.join(PRINTS, safe);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

async function printPasso(page, id, nome) {
  try {
    const d = dirCenario(id);
    const fname = `${String(Date.now()).slice(-8)}-${nome.replace(/[^\w-]/g, '_')}.png`;
    await page.screenshot({ path: path.join(d, fname), fullPage: true });
  } catch (e) {
    // print falha não derruba teste
  }
}

// ===== API HELPERS (mais rápido que UI pra criação de recursos) =====

async function loginAPI(email, senha) {
  const r = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  });
  if (!r.ok) throw new Error(`login ${email}: ${r.status}`);
  const body = await r.json();
  return { token: body.token, refreshToken: body.refreshToken, usuario: body.usuario };
}

// Cache do templateId default do médico (busca 1x, reusa)
let _templateIdCache = null;
async function getTemplateIdDefault(medToken) {
  if (_templateIdCache) return _templateIdCache;
  const r = await fetch(API + '/templates', { headers: { Authorization: `Bearer ${medToken}` } });
  if (!r.ok) throw new Error(`templates: ${r.status}`);
  const body = await r.json();
  const lista = Array.isArray(body) ? body : body.templates || [];
  if (!lista.length) throw new Error('médico não tem nenhum template — crie um pela UI primeiro');
  // Prefere template com 11 perguntas (anamnese padrão); senão pega o primeiro
  const ideal = lista.find(t => Array.isArray(t.perguntas) && t.perguntas.length >= 11) || lista[0];
  _templateIdCache = ideal.id;
  log(`     · template default: ${ideal.nome} (${ideal.perguntas?.length || '?'} perguntas)`);
  return ideal.id;
}

async function criarPC(medToken, pacienteNome, observacao = 'teste E2E') {
  // dataConsulta obrigatória (schema Zod) — usa 7 dias no futuro
  const data = new Date();
  data.setDate(data.getDate() + 7);
  data.setHours(14, 0, 0, 0);
  // templateId obrigatório pra ter perguntas — busca o default do médico
  const templateId = await getTemplateIdDefault(medToken);
  const payload = {
    pacienteNome,
    pacienteTel: '11999990000',
    dataConsulta: data.toISOString(),
    templateId,
  };
  const r = await fetch(API + '/pre-consulta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${medToken}` },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`criar PC: ${r.status} ${t.slice(0, 200)}`);
  }
  const body = await r.json();
  const pc = body.preConsulta || body;
  recursosCriados.preConsultas.push({ id: pc.id, token: pc.linkToken, nome: pc.pacienteNome });
  return pc;
}

async function getEstadoPC(token) {
  const r = await fetch(`${API}/pre-consulta/t/${token}/estado`);
  if (!r.ok) throw new Error(`estado: ${r.status}`);
  return r.json();
}

async function responderPerguntaTexto(token, perguntaId, valor, attemptId, jwtToken = null) {
  const fd = new FormData();
  fd.append('dados', JSON.stringify({ perguntaId, modo: 'texto', valor, attemptId }));
  const headers = jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {};
  const r = await fetch(`${API}/pre-consulta/t/${token}/responder-pergunta`, {
    method: 'POST',
    body: fd,
    headers,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`responder: ${r.status} ${t.slice(0, 100)}`);
  }
  return r.json();
}

async function finalizarPC(token, jwtToken = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (jwtToken) headers.Authorization = `Bearer ${jwtToken}`;
  const r = await fetch(`${API}/pre-consulta/t/${token}/finalizar`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function listarPacientes(medToken) {
  const r = await fetch(API + '/medico/pacientes', { headers: { Authorization: `Bearer ${medToken}` } });
  if (!r.ok) throw new Error(`pacientes: ${r.status}`);
  return r.json();
}

async function detalhePaciente(medToken, pacienteId) {
  const r = await fetch(`${API}/medico/pacientes/${pacienteId}`, { headers: { Authorization: `Bearer ${medToken}` } });
  if (!r.ok) throw new Error(`paciente:${pacienteId} ${r.status}`);
  return r.json();
}

async function listarAgendamentos(pacToken) {
  const r = await fetch(API + '/agendamento', { headers: { Authorization: `Bearer ${pacToken}` } });
  if (!r.ok) throw new Error(`agendamentos: ${r.status}`);
  return r.json();
}

async function listarRetornosPendentes(pacToken) {
  const r = await fetch(API + '/agendamento/retornos-pendentes', { headers: { Authorization: `Bearer ${pacToken}` } });
  if (!r.ok) throw new Error(`retornos-pendentes: ${r.status}`);
  return r.json();
}

async function proporRetorno(medToken, pacienteId, dataHoraISO, motivo) {
  const r = await fetch(API + '/agendamento/propor-retorno', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${medToken}` },
    body: JSON.stringify({ pacienteId, dataHora: dataHoraISO, motivo }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`propor retorno: ${r.status} ${t.slice(0, 200)}`);
  }
  const body = await r.json();
  const ag = body.agendamento || body;
  if (ag.id) recursosCriados.agendamentos.push({ id: ag.id, pacienteId });
  return ag;
}

async function confirmarRetorno(pacToken, agId) {
  const r = await fetch(`${API}/agendamento/${agId}/confirmar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pacToken}` },
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function recusarRetorno(pacToken, agId, motivo) {
  const r = await fetch(`${API}/agendamento/${agId}/recusar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pacToken}` },
    body: JSON.stringify({ motivo }),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function remarcarRetorno(pacToken, agId, novaDataISO, motivo) {
  // schema backend usa novaDataHora (não dataHora)
  const r = await fetch(`${API}/agendamento/${agId}/remarcar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pacToken}` },
    body: JSON.stringify({ novaDataHora: novaDataISO, motivo }),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function uploadDocumento(medToken, pacienteId, agendamentoId, filePath, tipo) {
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const fd = new FormData();
  const blob = new Blob([fileBuffer], { type: tipo.includes('AUDIO') ? 'audio/wav' : (fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg') });
  fd.append('arquivo', blob, fileName);
  fd.append('pacienteId', pacienteId);
  if (agendamentoId) fd.append('agendamentoId', agendamentoId);
  fd.append('tipo', tipo);
  fd.append('nomeAmigavel', `Teste ${tipo} ${TS}`);

  const r = await fetch(API + '/documentos/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${medToken}` },
    body: fd,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`upload doc: ${r.status} ${t.slice(0, 200)}`);
  }
  const body = await r.json();
  const doc = body.documento || body;
  if (doc.id) recursosCriados.documentos.push({ id: doc.id, pacienteId });
  return doc;
}

async function meusDocumentos(pacToken) {
  const r = await fetch(API + '/documentos/meus', { headers: { Authorization: `Bearer ${pacToken}` } });
  if (!r.ok) throw new Error(`docs/meus: ${r.status}`);
  return r.json();
}

async function baixarDocumento(pacToken, docId) {
  const r = await fetch(`${API}/documentos/${docId}/baixar`, { headers: { Authorization: `Bearer ${pacToken}` } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

// ============== CENÁRIOS ==============

const cenarios = [];

// ----- CAMADA A: Link de pré-consulta -----

cenarios.push({
  id: 'A.1', nome: 'Médico logado via API retorna usuario.tipo MEDICO',
  fn: async ({ medSession }) => {
    if (medSession.usuario.tipo !== 'MEDICO') throw new Error('tipo errado: ' + medSession.usuario.tipo);
  },
});

cenarios.push({
  id: 'A.2', nome: 'Paciente logado via API retorna usuario.tipo PACIENTE',
  fn: async ({ pacSession }) => {
    if (pacSession.usuario.tipo !== 'PACIENTE') throw new Error('tipo errado: ' + pacSession.usuario.tipo);
  },
});

cenarios.push({
  id: 'A.3', nome: 'Criar PC via API gera linkToken válido',
  fn: async ({ medSession, ctx }) => {
    const pc = await criarPC(medSession.token, `${PREFIX} A.3`);
    ctx.pcA3 = pc;
    if (!pc.linkToken || pc.linkToken.length < 10) throw new Error('linkToken inválido: ' + pc.linkToken);
  },
});

cenarios.push({
  id: 'A.4', nome: 'GET /estado retorna PC criada',
  fn: async ({ ctx }) => {
    if (!ctx.pcA3) throw new Error('pré-requisito A.3 falhou');
    const e = await getEstadoPC(ctx.pcA3.linkToken);
    if (!e.preConsulta && !e.pacienteNome) throw new Error('estado vazio: ' + JSON.stringify(e).slice(0, 100));
  },
});

cenarios.push({
  id: 'A.5', nome: 'Token inválido retorna 404',
  fn: async () => {
    const r = await fetch(`${API}/pre-consulta/t/TOKEN-INEXISTENTE-${TS}/estado`);
    if (r.status !== 404) throw new Error('status esperado 404, recebeu ' + r.status);
  },
});

cenarios.push({
  id: 'A.6', nome: 'Responder PC com 11 textos completos → cobertura 11/11',
  fn: async ({ medSession, pacSession, ctx }) => {
    const pc = await criarPC(medSession.token, `${PREFIX} A.6 texto`);
    ctx.pcA6 = pc;
    const estado = await getEstadoPC(pc.linkToken);
    const perguntas = estado.preConsulta?.templatePerguntas || estado.templatePerguntas || [];
    if (perguntas.length < 11) throw new Error('template não tem 11 perguntas: ' + perguntas.length);

    for (let i = 0; i < perguntas.length; i++) {
      const p = perguntas[i];
      await responderPerguntaTexto(pc.linkToken, p.id, `Resposta de teste E2E para pergunta ${i + 1}: ${p.texto || 'sem texto'}`, `att-${TS}-A6-${i}`, pacSession.token);
    }
    const fin = await finalizarPC(pc.linkToken, pacSession.token);
    if (fin.status !== 200) throw new Error(`finalizar status ${fin.status}: ${JSON.stringify(fin.body).slice(0, 100)}`);
    if (fin.body.cobertura && fin.body.cobertura.respondidas < 11) {
      throw new Error('cobertura ' + JSON.stringify(fin.body.cobertura));
    }
  },
});

cenarios.push({
  id: 'A.7', nome: 'Responder com modo "desconhecer" em todas → cobertura 11/11 + finalizar 200',
  fn: async ({ medSession, pacSession }) => {
    const pc = await criarPC(medSession.token, `${PREFIX} A.7 desconhecer`);
    const estado = await getEstadoPC(pc.linkToken);
    const perguntas = estado.preConsulta?.templatePerguntas || estado.templatePerguntas || [];

    for (const p of perguntas) {
      const fd = new FormData();
      fd.append('dados', JSON.stringify({ perguntaId: p.id, modo: 'desconhecer', attemptId: `att-A7-${p.id}` }));
      await fetch(`${API}/pre-consulta/t/${pc.linkToken}/responder-pergunta`, {
        method: 'POST', body: fd,
        headers: { Authorization: `Bearer ${pacSession.token}` },
      });
    }
    const fin = await finalizarPC(pc.linkToken, pacSession.token);
    if (fin.status !== 200) throw new Error(`finalizar status ${fin.status}`);
  },
});

cenarios.push({
  id: 'A.8', nome: 'Texto curto "Bebo" salva sem julgar IA (regressão Sessão 26)',
  fn: async ({ medSession, pacSession }) => {
    const pc = await criarPC(medSession.token, `${PREFIX} A.8 bebo`);
    const estado = await getEstadoPC(pc.linkToken);
    const perguntas = estado.preConsulta?.templatePerguntas || estado.templatePerguntas || [];

    // 10 longas + 1 curta "Bebo" na #10 (índice 9)
    for (let i = 0; i < perguntas.length; i++) {
      const valor = i === 9 ? 'Bebo' : `Resposta longa de teste pra pergunta ${i + 1} com bastante texto pra simular áudio real`;
      await responderPerguntaTexto(pc.linkToken, perguntas[i].id, valor, `att-A8-${i}`, pacSession.token);
    }
    const fin = await finalizarPC(pc.linkToken, pacSession.token);
    if (fin.status !== 200) throw new Error(`finalizar status ${fin.status} (BUG sessão 26 regressão!): ${JSON.stringify(fin.body).slice(0, 100)}`);
  },
});

cenarios.push({
  id: 'A.9', nome: 'Token já respondida retorna duplicate true',
  fn: async ({ pacSession, ctx }) => {
    if (!ctx.pcA6) throw new Error('pré-requisito A.6 falhou');
    const fin2 = await finalizarPC(ctx.pcA6.linkToken, pacSession.token);
    if (fin2.status !== 200 || !fin2.body.duplicate) {
      throw new Error('esperado duplicate:true, recebeu ' + JSON.stringify(fin2));
    }
  },
});

cenarios.push({
  id: 'A.10', nome: 'Cobertura insuficiente bloqueia (PC com 5/11 respostas)',
  fn: async ({ medSession, pacSession }) => {
    const pc = await criarPC(medSession.token, `${PREFIX} A.10 incompleta`);
    const estado = await getEstadoPC(pc.linkToken);
    const perguntas = estado.preConsulta?.templatePerguntas || estado.templatePerguntas || [];

    for (let i = 0; i < 5; i++) {
      await responderPerguntaTexto(pc.linkToken, perguntas[i].id, `apenas 5/11`, `att-A10-${i}`, pacSession.token);
    }
    const fin = await finalizarPC(pc.linkToken, pacSession.token);
    if (fin.status !== 400) throw new Error('esperado 400, recebeu ' + fin.status);
    if (!fin.body.erro || !fin.body.erro.toLowerCase().includes('cobertura')) {
      throw new Error('erro errado: ' + JSON.stringify(fin.body));
    }
  },
});

// ----- CAMADA B: Aba Pacientes do médico -----

cenarios.push({
  id: 'B.1', nome: 'GET /medico/pacientes retorna lista com paciente recém-respondido',
  fn: async ({ medSession, pacSession, ctx }) => {
    const pacientes = await listarPacientes(medSession.token);
    if (!Array.isArray(pacientes) && !Array.isArray(pacientes.pacientes)) {
      throw new Error('formato inesperado: ' + JSON.stringify(pacientes).slice(0, 100));
    }
    const lista = Array.isArray(pacientes) ? pacientes : pacientes.pacientes;
    ctx.pacientes = lista;
    log(`     · ${lista.length} pacientes na lista`);
    // Procura o paciente Lucas (que respondeu A.6, A.8)
    const meu = lista.find(p => p.pacienteId === pacSession.usuario.id || p.pacienteEmail === PAC_EMAIL);
    ctx.meuPaciente = meu;
    if (!meu) log('     ⚠️  paciente real não encontrado na lista (pode ser PC sem vínculo)');
  },
});

cenarios.push({
  id: 'B.2', nome: 'GET /medico/pacientes/:id retorna detalhe completo',
  fn: async ({ medSession, pacSession, ctx }) => {
    const det = await detalhePaciente(medSession.token, pacSession.usuario.id);
    if (!det.paciente && !det.usuario && !det.id) throw new Error('detalhe vazio: ' + JSON.stringify(det).slice(0, 100));
    ctx.detalhePac = det;
    const pc = (det.preConsultas || []).length;
    log(`     · ${pc} pré-consultas no detalhe`);
  },
});

cenarios.push({
  id: 'B.3', nome: 'PC respondidas têm summary (após delay 5s)',
  fn: async ({ medSession, pacSession }) => {
    // Aguarda processamento async do worker (gera summary)
    await new Promise(r => setTimeout(r, 5000));
    const det = await detalhePaciente(medSession.token, pacSession.usuario.id);
    const pcs = det.preConsultas || det.paciente?.preConsultas || [];
    const recente = pcs.find(p => p.pacienteNome && p.pacienteNome.includes(PREFIX));
    if (!recente) {
      log('     ⚠️  PC recente não encontrada em detalhe — pode estar em worker queue');
      return;
    }
    log(`     · PC ${recente.id} status=${recente.status} hasSummary=${!!recente.summaryIA || !!recente.summaryJson}`);
  },
});

cenarios.push({
  id: 'B.4', nome: 'Lista de pacientes filtrável por nome (busca PREFIX)',
  fn: async ({ medSession }) => {
    const todos = await listarPacientes(medSession.token);
    const lista = Array.isArray(todos) ? todos : todos.pacientes || [];
    const comPrefix = lista.filter(p => (p.pacienteNome || p.nome || '').includes(PREFIX));
    log(`     · ${comPrefix.length} pacientes com prefixo ${PREFIX}`);
    if (comPrefix.length === 0) throw new Error('Nenhum paciente com prefixo ROBO encontrado na lista');
  },
});

// ----- CAMADA C: Aba Consultas do paciente -----

cenarios.push({
  id: 'C.1', nome: 'GET /agendamento (paciente) retorna lista (pode ser vazia)',
  fn: async ({ pacSession }) => {
    const ag = await listarAgendamentos(pacSession.token);
    const lista = Array.isArray(ag) ? ag : ag.agendamentos || [];
    log(`     · ${lista.length} agendamentos do paciente`);
  },
});

cenarios.push({
  id: 'C.2', nome: 'GET /agendamento/retornos-pendentes retorna lista',
  fn: async ({ pacSession }) => {
    const rp = await listarRetornosPendentes(pacSession.token);
    const lista = Array.isArray(rp) ? rp : rp.retornos || [];
    log(`     · ${lista.length} retornos pendentes`);
  },
});

cenarios.push({
  id: 'C.3', nome: 'GET /documentos/meus retorna lista (pode ser vazia)',
  fn: async ({ pacSession }) => {
    const ds = await meusDocumentos(pacSession.token);
    const lista = Array.isArray(ds) ? ds : ds.documentos || [];
    log(`     · ${lista.length} documentos do paciente`);
  },
});

// ----- CAMADA D: Cruzados médico↔paciente -----

cenarios.push({
  id: 'D.1', nome: 'Médico propõe retorno em 30 dias',
  fn: async ({ medSession, pacSession, ctx }) => {
    const data = new Date();
    data.setDate(data.getDate() + 30);
    data.setHours(14, 30, 0, 0);
    const ag = await proporRetorno(medSession.token, pacSession.usuario.id, data.toISOString(), 'Teste E2E retorno');
    ctx.retornoD1 = ag;
    if (!ag.id) throw new Error('retorno sem id: ' + JSON.stringify(ag).slice(0, 100));
    log(`     · retorno ${ag.id} status=${ag.statusProposta || ag.status}`);
  },
});

cenarios.push({
  id: 'D.2', nome: 'Paciente vê retorno em /retornos-pendentes',
  fn: async ({ pacSession, ctx }) => {
    if (!ctx.retornoD1) throw new Error('pré-requisito D.1 falhou');
    const rp = await listarRetornosPendentes(pacSession.token);
    const lista = Array.isArray(rp) ? rp : rp.retornos || [];
    const meu = lista.find(r => r.id === ctx.retornoD1.id);
    if (!meu) throw new Error(`retorno ${ctx.retornoD1.id} não aparece em retornos-pendentes (${lista.length} itens)`);
  },
});

cenarios.push({
  id: 'D.3', nome: 'Paciente CONFIRMA retorno → status muda',
  fn: async ({ pacSession, ctx }) => {
    if (!ctx.retornoD1) throw new Error('pré-requisito D.1 falhou');
    const r = await confirmarRetorno(pacSession.token, ctx.retornoD1.id);
    if (r.status !== 200) throw new Error(`confirmar status ${r.status}: ${JSON.stringify(r.body)}`);
    log(`     · confirmar OK, status novo: ${r.body.agendamento?.statusProposta || r.body.statusProposta}`);
  },
});

cenarios.push({
  id: 'D.4', nome: 'Médico propõe retorno 2 — paciente REMARCA com nova data',
  fn: async ({ medSession, pacSession, ctx }) => {
    const data = new Date();
    data.setDate(data.getDate() + 45);
    data.setHours(10, 0, 0, 0);
    const ag = await proporRetorno(medSession.token, pacSession.usuario.id, data.toISOString(), 'Teste E2E remarcar');
    ctx.retornoD4 = ag;

    const novaData = new Date();
    novaData.setDate(novaData.getDate() + 60);
    novaData.setHours(15, 0, 0, 0);
    const r = await remarcarRetorno(pacSession.token, ag.id, novaData.toISOString(), 'Não consigo na data original');
    if (r.status !== 200) throw new Error(`remarcar status ${r.status}: ${JSON.stringify(r.body)}`);
  },
});

cenarios.push({
  id: 'D.5', nome: 'Médico propõe retorno 3 — paciente RECUSA',
  fn: async ({ medSession, pacSession }) => {
    const data = new Date();
    data.setDate(data.getDate() + 20);
    data.setHours(9, 0, 0, 0);
    const ag = await proporRetorno(medSession.token, pacSession.usuario.id, data.toISOString(), 'Teste E2E recusar');
    const r = await recusarRetorno(pacSession.token, ag.id, 'Não preciso mais de retorno');
    if (r.status !== 200) throw new Error(`recusar status ${r.status}: ${JSON.stringify(r.body)}`);
  },
});

cenarios.push({
  id: 'D.6', nome: 'Médico anexa LAUDO (PDF) pra paciente',
  fn: async ({ medSession, pacSession, ctx }) => {
    const doc = await uploadDocumento(medSession.token, pacSession.usuario.id, null, path.join(__dirname, 'fixtures/laudo-mock.pdf'), 'LAUDO');
    ctx.docLaudo = doc;
    if (!doc.id) throw new Error('doc sem id: ' + JSON.stringify(doc).slice(0, 100));
  },
});

cenarios.push({
  id: 'D.7', nome: 'Médico anexa ENCAMINHAMENTO (PDF)',
  fn: async ({ medSession, pacSession }) => {
    // Backend só aceita: RECEITA, LAUDO, ENCAMINHAMENTO, EXAME_PEDIDO, OUTRO
    // Sem tipo ATESTADO específico — usa OUTRO ou ENCAMINHAMENTO
    const doc = await uploadDocumento(medSession.token, pacSession.usuario.id, null, path.join(__dirname, 'fixtures/atestado-mock.pdf'), 'ENCAMINHAMENTO');
    if (!doc.id) throw new Error('encaminhamento sem id');
  },
});

cenarios.push({
  id: 'D.8', nome: 'Médico anexa RECEITA (PDF)',
  fn: async ({ medSession, pacSession }) => {
    const doc = await uploadDocumento(medSession.token, pacSession.usuario.id, null, path.join(__dirname, 'fixtures/receita-mock.pdf'), 'RECEITA');
    if (!doc.id) throw new Error('receita sem id');
  },
});

cenarios.push({
  id: 'D.9', nome: 'Médico anexa EXAME_PEDIDO (JPG)',
  fn: async ({ medSession, pacSession }) => {
    const doc = await uploadDocumento(medSession.token, pacSession.usuario.id, null, path.join(__dirname, 'fixtures/foto-exame-mock.jpg'), 'EXAME_PEDIDO');
    if (!doc.id) throw new Error('exame sem id');
  },
});

cenarios.push({
  id: 'D.9b', nome: 'Médico anexa OUTRO (PDF)',
  fn: async ({ medSession, pacSession }) => {
    const doc = await uploadDocumento(medSession.token, pacSession.usuario.id, null, path.join(__dirname, 'fixtures/atestado-mock.pdf'), 'OUTRO');
    if (!doc.id) throw new Error('outro sem id');
  },
});

cenarios.push({
  id: 'D.10', nome: 'Paciente vê documentos anexados em /documentos/meus',
  fn: async ({ pacSession }) => {
    const ds = await meusDocumentos(pacSession.token);
    const lista = Array.isArray(ds) ? ds : ds.documentos || [];
    const meus = lista.filter(d => (d.nomeAmigavel || '').includes(TS) || (d.nomeArquivo || '').match(/mock\.(pdf|jpg)/));
    if (meus.length < 1) throw new Error(`paciente não vê documentos anexados (${lista.length} total)`);
    log(`     · ${meus.length} documentos vistos pelo paciente`);
  },
});

cenarios.push({
  id: 'D.11', nome: 'Paciente baixa documento (URL assinada)',
  fn: async ({ pacSession, ctx }) => {
    if (!ctx.docLaudo) throw new Error('pré-requisito D.6 falhou');
    const r = await baixarDocumento(pacSession.token, ctx.docLaudo.id);
    if (r.status !== 200) throw new Error(`baixar status ${r.status}: ${JSON.stringify(r.body)}`);
    if (!r.body.url && !r.body.signedUrl && !r.body.urlAssinada) {
      log(`     ⚠️  resposta sem url assinada: ${JSON.stringify(r.body).slice(0, 100)}`);
    }
  },
});

// ----- Camada A2: testes UI Playwright (login → app) -----

cenarios.push({
  id: 'A.11', nome: 'UI: Médico abre app-v2 e chega na Aba Hoje (com auth bypass via localStorage)',
  fn: async ({ browser, medSession }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    // Bypass via localStorage usando addInitScript
    await page.addInitScript(({ token, usuario }) => {
      localStorage.setItem('vitae_token', token);
      localStorage.setItem('vitae_usuario', JSON.stringify(usuario));
    }, { token: medSession.token, usuario: medSession.usuario });
    await page.goto(APP + '/desktop/app-v2.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);
    await printPasso(page, 'A.11', 'app-v2-loaded');
    const url = page.url();
    if (url.includes('01-login.html')) throw new Error('auth gate falhou — voltou pro login');
    await ctx.close();
  },
});

cenarios.push({
  id: 'A.12', nome: 'UI: Médico navega pra aba Pacientes',
  fn: async ({ browser, medSession }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(({ token, usuario }) => {
      localStorage.setItem('vitae_token', token);
      localStorage.setItem('vitae_usuario', JSON.stringify(usuario));
    }, { token: medSession.token, usuario: medSession.usuario });
    await page.goto(APP + '/desktop/app-v2.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => { try { window.goto('pacientes'); } catch (e) {} });
    await page.waitForTimeout(2000);
    await printPasso(page, 'A.12', 'aba-pacientes');
    const heading = await page.locator('h1').first().textContent().catch(() => '');
    if (!heading.toLowerCase().includes('paciente')) {
      log(`     ⚠️  heading: "${heading}"`);
    }
    await ctx.close();
  },
});

cenarios.push({
  id: 'A.13', nome: 'UI: Paciente abre app-v3 e chega na Saúde',
  fn: async ({ browser, pacSession }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(({ token, usuario }) => {
      localStorage.setItem('vitae_token', token);
      localStorage.setItem('vitae_usuario', JSON.stringify(usuario));
    }, { token: pacSession.token, usuario: pacSession.usuario });
    await page.goto(APP + '/app-v3/app.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);
    await printPasso(page, 'A.13', 'app-v3-loaded');
    const url = page.url();
    if (url.includes('login') || url.includes('cadastro')) throw new Error('auth gate paciente falhou: ' + url);
    await ctx.close();
  },
});

cenarios.push({
  id: 'A.14', nome: 'UI: Paciente navega pra aba Consultas',
  fn: async ({ browser, pacSession }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(({ token, usuario }) => {
      localStorage.setItem('vitae_token', token);
      localStorage.setItem('vitae_usuario', JSON.stringify(usuario));
    }, { token: pacSession.token, usuario: pacSession.usuario });
    await page.goto(APP + '/app-v3/app.html#consultas', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);
    await printPasso(page, 'A.14', 'aba-consultas');
    await ctx.close();
  },
});

// ============== CLEANUP ==============

async function cleanup(medToken) {
  log('🧹 Cleanup — apagando recursos criados...');
  let ok = 0, fail = 0;

  // Apagar PCs criadas (DELETE /pre-consulta/:id)
  for (const pc of recursosCriados.preConsultas) {
    try {
      const r = await fetch(`${API}/pre-consulta/${pc.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${medToken}` } });
      r.ok ? ok++ : fail++;
    } catch (e) { fail++; }
  }

  // Apagar documentos
  for (const d of recursosCriados.documentos) {
    try {
      const r = await fetch(`${API}/documentos/${d.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${medToken}` } });
      r.ok ? ok++ : fail++;
    } catch (e) { fail++; }
  }

  // Apagar agendamentos restantes (podem ter virado consulta confirmada — deletar via DELETE)
  for (const a of recursosCriados.agendamentos) {
    try {
      const r = await fetch(`${API}/agendamento/${a.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${medToken}` } });
      r.ok ? ok++ : fail++;
    } catch (e) { fail++; }
  }

  log(`   ✓ ${ok} apagados / ✗ ${fail} falharam`);
  relatorio.cleanup = { ok, fail };
  salvarRelatorioJSON();
}

// ============== RELATÓRIO MD ==============

function gerarRelatorioMD() {
  const r = relatorio;
  const total = r.resumo.total;
  const passou = r.resumo.passou || 0;
  const falhou = r.resumo.falhou || 0;
  const parcial = r.resumo.parcial || 0;
  const pct = total ? Math.round((passou / total) * 100) : 0;

  let md = `# Relatório E2E vita id — 19/mai/2026\n\n`;
  md += `**Início:** ${r.startedAt}\n`;
  md += `**Fim:** ${r.endedAt}\n\n`;
  md += `## Resumo\n\n`;
  md += `| Métrica | Valor |\n|---|---|\n`;
  md += `| Total de cenários | ${total} |\n`;
  md += `| ✅ Passou | ${passou} (${pct}%) |\n`;
  md += `| ⚠️ Parcial | ${parcial} |\n`;
  md += `| ❌ Falhou | ${falhou} |\n`;
  md += `| Recursos criados | ${recursosCriados.preConsultas.length} PCs · ${recursosCriados.agendamentos.length} agendamentos · ${recursosCriados.documentos.length} docs |\n`;
  if (r.cleanup) md += `| Cleanup | ${r.cleanup.ok} apagados / ${r.cleanup.fail} falhas |\n`;
  md += `\n`;

  // Falhas primeiro (priorizar)
  const falhas = r.cenarios.filter(c => c.status === 'falhou');
  if (falhas.length) {
    md += `## ❌ Falhas (${falhas.length})\n\n`;
    for (const c of falhas) {
      md += `### [${c.id}] ${c.nome}\n`;
      md += `- **Erro:** \`${c.erro}\`\n`;
      md += `- **Tempo:** ${c.tempoMs}ms\n\n`;
    }
  }

  // Parciais
  const parciais = r.cenarios.filter(c => c.status === 'parcial');
  if (parciais.length) {
    md += `## ⚠️ Parciais (${parciais.length})\n\n`;
    for (const c of parciais) {
      md += `- [${c.id}] ${c.nome} — ${c.detalhes || ''}\n`;
    }
    md += `\n`;
  }

  // Passou (resumido)
  const passados = r.cenarios.filter(c => c.status === 'passou');
  md += `## ✅ Passou (${passados.length})\n\n`;
  for (const c of passados) {
    md += `- [${c.id}] ${c.nome} (${c.tempoMs}ms)\n`;
  }
  md += `\n`;

  md += `---\n`;
  md += `Gerado por master-e2e-2026-05-19.js\n`;

  fs.writeFileSync(path.join(OUT, 'relatorio.md'), md);
  log(`📄 Relatório MD: ${path.join(OUT, 'relatorio.md')}`);
}

// ============== MAIN ==============

(async () => {
  log('🚀 MASTER E2E — vita id · ' + TS);
  log(`   Output: ${OUT}`);
  log(`   Total de cenários: ${cenarios.length}`);
  log('');

  // 1) Auth via API
  log('🔐 Login API...');
  const medSession = await loginAPI(MED_EMAIL, MED_SENHA);
  const pacSession = await loginAPI(PAC_EMAIL, PAC_SENHA);
  log(`   ✓ médico ${medSession.usuario.tipo} · paciente ${pacSession.usuario.tipo}`);
  log('');

  // 2) Browser
  log('🌐 Iniciando browser Edge...');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  log('   ✓ Edge headless OK');
  log('');

  // 3) Context compartilhado entre cenários (pra recursos criados em cenários anteriores)
  const sharedCtx = {};

  // 4) Loop principal
  log(`▶️  Rodando ${cenarios.length} cenários...\n`);
  for (const c of cenarios) {
    await executarCenario(c.id, c.nome, () => c.fn({
      medSession,
      pacSession,
      browser,
      ctx: sharedCtx,
    }));
  }

  log('');
  log('───────────────────────────────');
  log(`Total: ${relatorio.resumo.total} · ✅ ${relatorio.resumo.passou || 0} · ⚠️ ${relatorio.resumo.parcial || 0} · ❌ ${relatorio.resumo.falhou || 0}`);
  log('───────────────────────────────');
  log('');

  // 5) Cleanup
  await cleanup(medSession.token);

  // 6) Browser fecha
  await browser.close();

  // 7) Relatório final
  relatorio.endedAt = new Date().toISOString();
  salvarRelatorioJSON();
  gerarRelatorioMD();

  log('');
  log(`✅ FIM — ${OUT}`);
  process.exit(0);
})().catch(err => {
  log('💥 ERRO FATAL: ' + err.message);
  console.error(err);
  relatorio.endedAt = new Date().toISOString();
  relatorio.erroFatal = err.message;
  salvarRelatorioJSON();
  gerarRelatorioMD();
  process.exit(1);
});
