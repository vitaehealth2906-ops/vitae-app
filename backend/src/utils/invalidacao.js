// ============================================================
// Cadeia de invalidação (Fase 5 perf — 21-mai-2026)
// ============================================================
//
// Quando o paciente atualiza algo importante (alergia, medicamento,
// condição, exame), o summary das pré-consultas ATIVAS dele fica
// desatualizado. Este helper enfileira regeneração em background.
//
// Filosofia: reusa GERAR_SUMMARY_E_TTS (handler do worker já busca
// perfil atual via enriquecerRespostas). Sem novo tipo de tarefa,
// sem novo handler. Apenas enfileira com delay de 60s para agrupar
// múltiplas mudanças seguidas em 1 só regeneração.
//
// Throttle: se PC regenerou nos últimos 15min, pula (evita loop).

const prisma = require('./prisma');

const JANELA_PCS_ATIVAS_DIAS = 30;
const DELAY_PARA_AGRUPAR_MS = 60_000;  // 1 min — agrega mudanças seguidas
const THROTTLE_RECENTE_MS = 15 * 60_000; // 15 min — evita refazer quando acabou de regerar

/**
 * Enfileira regeneração de summary para todas as PCs ativas (respondidas
 * nos últimos 30 dias) do paciente. Sem await — fire-and-forget no caller.
 *
 * @param {string} pacienteId - id do Usuario (paciente)
 * @param {string} motivo - alergia | medicamento | condicao | exame | perfil
 * @param {object} detalhes - opcional (nome do item, id, etc) para log
 * @returns {Promise<{enfileiradas, atualizadas, puladas}>}
 */
async function enfileirarRegeneracaoSummaryPaciente(pacienteId, motivo, detalhes = {}) {
  if (!pacienteId) return { enfileiradas: 0, atualizadas: 0, puladas: 0 };

  try {
    const dataLimite = new Date(Date.now() - JANELA_PCS_ATIVAS_DIAS * 24 * 60 * 60 * 1000);
    const pcs = await prisma.preConsulta.findMany({
      where: {
        pacienteId,
        respondidaEm: { not: null, gte: dataLimite },
      },
      select: { id: true },
    });

    if (pcs.length === 0) return { enfileiradas: 0, atualizadas: 0, puladas: 0 };

    const proximaTentativa = new Date(Date.now() + DELAY_PARA_AGRUPAR_MS);
    const throttleLimite = new Date(Date.now() - THROTTLE_RECENTE_MS);
    let enfileiradas = 0, atualizadas = 0, puladas = 0;

    for (const pc of pcs) {
      // Throttle: regenerou com sucesso há < 15min? pula
      const recente = await prisma.tarefaPendente.findFirst({
        where: {
          tipo: 'GERAR_SUMMARY_E_TTS',
          preConsultaId: pc.id,
          processadoEm: { not: null, gte: throttleLimite },
          dead: false,
        },
      });
      if (recente) { puladas++; continue; }

      // Dedupe: já tem pendente? acumula motivo + adia
      const existente = await prisma.tarefaPendente.findFirst({
        where: {
          tipo: 'GERAR_SUMMARY_E_TTS',
          preConsultaId: pc.id,
          processadoEm: null,
          dead: false,
        },
      });

      if (existente) {
        const payload = existente.payload || {};
        const motivos = Array.isArray(payload.motivos) ? payload.motivos : [];
        if (!motivos.includes(motivo)) motivos.push(motivo);
        await prisma.tarefaPendente.update({
          where: { id: existente.id },
          data: {
            payload: { ...payload, motivos, regeneradaPorMudanca: true, ultimoTrigger: detalhes },
            proximaTentativa,
          },
        });
        atualizadas++;
      } else {
        await prisma.tarefaPendente.create({
          data: {
            tipo: 'GERAR_SUMMARY_E_TTS',
            preConsultaId: pc.id,
            payload: { motivos: [motivo], regeneradaPorMudanca: true, ultimoTrigger: detalhes },
            proximaTentativa,
          },
        });
        enfileiradas++;
      }
    }

    if (enfileiradas + atualizadas > 0) {
      console.log('[INVALIDACAO]', motivo, 'paciente:', pacienteId, '→', { enfileiradas, atualizadas, puladas });
    }
    return { enfileiradas, atualizadas, puladas };
  } catch (err) {
    // Nunca derruba a rota chamadora — apenas loga
    console.error('[INVALIDACAO] falha:', err.message);
    return { enfileiradas: 0, atualizadas: 0, puladas: 0, erro: err.message };
  }
}

/**
 * Variante fire-and-forget para chamar dentro de rotas sem precisar await.
 * Engole erros.
 */
function enfileirarRegeneracaoAsync(pacienteId, motivo, detalhes) {
  enfileirarRegeneracaoSummaryPaciente(pacienteId, motivo, detalhes).catch(() => {});
}

module.exports = {
  enfileirarRegeneracaoSummaryPaciente,
  enfileirarRegeneracaoAsync,
};
