// CAMADA Z7 — Persiste resultado do pipeline V4 em PreConsulta
// PRESERVA campos antigos (summaryIA, textoVoz, summaryJson) - nunca sobrescreve direto
// Adiciona dados V4 em summaryJson.v4 + atualiza audioSummaryUrl/textoVoz/summaryIA com novos

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Salva auditoria_acesso pra rastrear que IA V4 rodou.
 */
async function registrarAuditoria({ preConsultaId, medicoId, pacienteId, meta }) {
  try {
    await prisma.auditoriaAcesso.create({
      data: {
        usuarioId: medicoId || pacienteId || preConsultaId,
        atorTipo: 'SISTEMA',
        acao: 'GERAR_BRIEFING_V4',
        recursoTipo: 'PRECONSULTA',
        recursoId: preConsultaId,
        meta: meta || {}
      }
    });
  } catch (e) {
    // Auditoria nao pode quebrar fluxo
    console.warn(`[V4-persist] auditoria falhou: ${e.message}`);
  }
}

/**
 * Persiste resultado V4 em PreConsulta.
 * @param {object} args
 * @param {string} args.preConsultaId
 * @param {object} args.outputIA - output validado da IA (textoVoz, pontos_consolidados, summary_visual, etc)
 * @param {object} args.tts - { storagePath, bucket, bytes }
 * @param {object} args.contexto - { cluster, modo, contradicoes, tentativas, validacao }
 */
async function persistirV4({ preConsultaId, outputIA, tts, contexto }) {
  const pc = await prisma.preConsulta.findUnique({ where: { id: preConsultaId } });
  if (!pc) throw new Error(`PC ${preConsultaId} nao encontrada`);

  // Preserva o summaryJson antigo dentro do novo, em campo paralelo
  const summaryJsonAtual = pc.summaryJson || {};
  const novoSummaryJson = {
    ...summaryJsonAtual,
    _v4_meta: {
      versaoPipeline: 'v4.0.0',
      criadoEm: new Date().toISOString(),
      cluster: contexto.cluster && contexto.cluster.id,
      clusterNome: contexto.cluster && contexto.cluster.nome,
      modo: contexto.modo,
      tentativas: contexto.tentativas,
      contradicoes: contexto.contradicoes,
      validacao: contexto.validacao && {
        ok: contexto.validacao.ok,
        falhasNaUltimaTentativa: contexto.validacao.falhas || []
      },
      requerRevisaoManual: !(contexto.validacao && contexto.validacao.ok)
    },
    v4: {
      textoVoz: outputIA.textoVoz,
      pontos_consolidados: outputIA.pontos_consolidados || [],
      exclusoes_aplicadas: outputIA.exclusoes_aplicadas || [],
      red_flags_capturados: outputIA.red_flags_capturados || [],
      nao_capturado: outputIA.nao_capturado || [],
      summary_visual: outputIA.summary_visual || {},
      tts: tts ? { storagePath: tts.storagePath, bucket: tts.bucket, bytes: tts.bytes } : null
    },
    // Backup do antigo (se nao havia ainda)
    _legacy_summaryTexto: summaryJsonAtual.summaryTexto || summaryJsonAtual.textoVoz || null
  };

  // Backwards-compat: mantem campos diretos com versao nova (frontend antigo continua lendo)
  // mas guarda legado num campo paralelo summaryIA_legacy
  const summaryIA_atual = pc.summaryIA;
  const textoVoz_atual = pc.summaryJson && pc.summaryJson.textoVoz;

  if (!novoSummaryJson._legacy_summaryIA && summaryIA_atual) {
    novoSummaryJson._legacy_summaryIA = summaryIA_atual;
  }
  if (!novoSummaryJson._legacy_textoVoz && textoVoz_atual) {
    novoSummaryJson._legacy_textoVoz = textoVoz_atual;
  }

  // Atualiza tambem textoVoz dentro do summaryJson (mantem onde frontend espera)
  novoSummaryJson.textoVoz = outputIA.textoVoz;

  const updateData = {
    summaryJson: novoSummaryJson,
    summaryIA: outputIA.textoVoz, // texto direto pro medico ler
    statusResumoIa: contexto.validacao && contexto.validacao.ok ? 'ok' : 'requer_revisao_manual'
  };

  // Audio URL — V4 prefere bucket privado (servido via endpoint signed URL),
  // mas se cai no fallback publico, persiste URL direta (compat com V3)
  if (tts && tts.storagePath) {
    if (tts.privado) {
      updateData.audioSummaryUrl = `vitae-priv://${tts.bucket}/${tts.storagePath}`;
    } else if (tts.publicUrl) {
      updateData.audioSummaryUrl = tts.publicUrl;
    }
    updateData.statusAudioResumo = 'ok';
  }

  await prisma.preConsulta.update({
    where: { id: preConsultaId },
    data: updateData
  });

  // Auditoria
  await registrarAuditoria({
    preConsultaId,
    medicoId: pc.medicoId,
    pacienteId: pc.pacienteId,
    meta: {
      cluster: contexto.cluster && contexto.cluster.id,
      modo: contexto.modo,
      tentativas: contexto.tentativas,
      palavras: outputIA.palavras_textoVoz,
      requer_revisao_manual: !(contexto.validacao && contexto.validacao.ok)
    }
  });

  return {
    ok: true,
    preConsultaId,
    audioSummaryUrl: updateData.audioSummaryUrl,
    summaryIA: updateData.summaryIA
  };
}

module.exports = {
  persistirV4,
  registrarAuditoria
};
