// PIPELINE V4 — orquestra Z0 -> Z7 pra uma PreConsulta
// Entry point: executarPipelineV4(preConsultaId)
// Devolve: { ok, audioSummaryUrl, summaryIA, cluster, modo, tentativas, requerRevisaoManual }

const { PrismaClient } = require('@prisma/client');
const { higienizar } = require('./higienizacao');
const { detectarCluster, obterCluster } = require('./detectorCluster');
const { detectarModo, limitePalavras } = require('./detectorModo');
const { detectarContradicoes } = require('./detectorContradicoes');
const { montarUserPrompt, montarRespostasMap } = require('./montagemContexto');
const { gerarTextoVoz } = require('./promptV4');
const { validar, formatarCorrecao } = require('./validador');
const { gerarTTSV4 } = require('./tts');
const { persistirV4 } = require('./persistencia');

const prisma = new PrismaClient();

const MAX_TENTATIVAS = parseInt(process.env.V4_MAX_TENTATIVAS || '3', 10);
const GERAR_TTS = process.env.V4_GERAR_TTS !== 'false'; // default true

/**
 * Pipeline principal V4.
 */
async function executarPipelineV4(preConsultaId, opcoes = {}) {
  const log = (...args) => console.log('[V4]', ...args);
  log(`pipeline iniciado pc=${preConsultaId}`);

  // ====================== CARREGAR DADOS ======================
  const pc = await prisma.preConsulta.findUnique({ where: { id: preConsultaId } });
  if (!pc) throw new Error(`PC ${preConsultaId} nao encontrada`);

  const [paciente, perfilSaude, medicamentos, alergias, exames, template, medico] = await Promise.all([
    pc.pacienteId ? prisma.usuario.findUnique({ where: { id: pc.pacienteId } }) : null,
    pc.pacienteId ? prisma.perfilSaude.findUnique({ where: { usuarioId: pc.pacienteId } }) : null,
    pc.pacienteId ? prisma.medicamento.findMany({ where: { usuarioId: pc.pacienteId } }) : [],
    pc.pacienteId ? prisma.alergia.findMany({ where: { usuarioId: pc.pacienteId } }) : [],
    pc.pacienteId ? prisma.exame.findMany({ where: { usuarioId: pc.pacienteId } }) : [],
    pc.templateId ? prisma.formTemplate.findUnique({ where: { id: pc.templateId } }) : null,
    pc.medicoId ? prisma.medico.findUnique({ where: { id: pc.medicoId }, include: { usuario: { select: { nome: true } } } }) : null
  ]);

  const hoje = opcoes.hoje || new Date();

  // ====================== Z0 — HIGIENIZACAO ======================
  const cadastroFiltrado = higienizar({ usuario: paciente, perfilSaude, medicamentos, alergias, exames }, hoje);
  log(`Z0 ok | meds=${cadastroFiltrado.medsAtivos.length} desc=${cadastroFiltrado.medsDescontinuadosRecentes.length} alg=${cadastroFiltrado.alergias ? cadastroFiltrado.alergias.length : 0} examesErr=${cadastroFiltrado.examesConcluidos.ignoradosPorErro}`);

  // ====================== Z1 — CLUSTER ======================
  const perguntas = (template && template.perguntas) || pc.templatePerguntas || [];
  const cd = await detectarCluster({ nomeTemplate: template && template.nome, perguntas });
  const cluster = obterCluster(cd.clusterId);
  log(`Z1 cluster=${cluster.id} (${cd.razao})`);

  // ====================== Z2 — MODO ======================
  const md = detectarModo({ cluster, idadeAnos: cadastroFiltrado.identificacao.idadeAnos, respostas: pc.respostas });
  const limitePalavrasNum = limitePalavras(md.modo);
  log(`Z2 modo=${md.modo} (${md.razao}) limite=${limitePalavrasNum}`);

  // ====================== Z3 — CONTRADICOES + CONTEXTO ======================
  const respostasMap = montarRespostasMap(pc.respostas);
  const contradicoes = detectarContradicoes({
    perguntas,
    respostas: pc.respostas,
    transcricaoAudio: pc.transcricao,
    cadastroFiltrado
  });
  log(`Z3 contradicoes=${contradicoes.length}`);

  const userPrompt = montarUserPrompt({
    paciente, cadastroFiltrado, cluster,
    modo: md.modo, modoRazao: md.razao, clusterRazao: cd.razao,
    perguntas, respostasMap,
    transcricaoCombinada: pc.transcricao, contradicoes,
    templateNome: template && template.nome,
    medicoNome: medico && medico.usuario && medico.usuario.nome,
    hoje, limitePalavrasNum
  });

  // ====================== Z4-Z5 — GERAR + VALIDAR + RETRY ======================
  const ctx = {
    modo: md.modo, limitePalavrasNum, contradicoes,
    cadastroFiltrado, transcricaoCombinada: pc.transcricao
  };

  let tentativa = 1, resultado = null, validacao = null, instrucaoCorrecao = null;
  while (tentativa <= MAX_TENTATIVAS) {
    try {
      resultado = await gerarTextoVoz({ userPrompt, instrucaoCorrecao });
    } catch (e) {
      log(`Z4 tentativa ${tentativa} EXCECAO: ${e.message}`);
      tentativa++;
      continue;
    }
    if (!resultado.parsed) {
      log(`Z4 tentativa ${tentativa}: JSON nao parseado`);
      instrucaoCorrecao = 'Resposta nao foi JSON valido. Retorne APENAS JSON sem markdown, conforme schema do system.';
      tentativa++;
      continue;
    }
    validacao = validar(resultado.parsed, ctx);
    if (validacao.ok) {
      log(`Z5 tentativa ${tentativa} VALIDADA (palavras=${resultado.parsed.palavras_textoVoz})`);
      break;
    }
    log(`Z5 tentativa ${tentativa} REPROVADA: ${validacao.falhas.length} falhas`);
    validacao.falhas.forEach(f => log(`    - ${f.motivo}`));
    instrucaoCorrecao = formatarCorrecao(validacao.falhas);
    tentativa++;
  }

  const requerRevisaoManual = !validacao || !validacao.ok;
  if (requerRevisaoManual) {
    log(`pipeline FALHOU validacao em ${MAX_TENTATIVAS} tentativas — marcando REVISAR_MANUAL`);
  }

  if (!resultado || !resultado.parsed) {
    throw new Error('Pipeline V4 falhou: IA nao devolveu output parseavel apos retries');
  }

  // ====================== Z6 — TTS ======================
  let tts = null;
  if (GERAR_TTS) {
    try {
      tts = await gerarTTSV4({ textoVoz: resultado.parsed.textoVoz, preConsultaId });
      log(`Z6 TTS ok bytes=${tts.bytes}`);
    } catch (e) {
      log(`Z6 TTS FALHOU: ${e.message} — segue sem TTS`);
    }
  }

  // ====================== Z7 — PERSISTIR ======================
  const persistido = await persistirV4({
    preConsultaId,
    outputIA: resultado.parsed,
    tts,
    contexto: {
      cluster,
      modo: md.modo,
      contradicoes,
      tentativas: tentativa - 1,
      validacao
    }
  });
  log(`Z7 persistido ok`);

  return {
    ok: !requerRevisaoManual,
    requerRevisaoManual,
    preConsultaId,
    cluster: cluster.id,
    clusterNome: cluster.nome,
    modo: md.modo,
    tentativas: tentativa - 1,
    palavras: resultado.parsed.palavras_textoVoz,
    audioSummaryUrl: persistido.audioSummaryUrl,
    summaryIA: persistido.summaryIA,
    textoVoz: resultado.parsed.textoVoz
  };
}

module.exports = { executarPipelineV4 };
