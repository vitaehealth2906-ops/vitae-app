// ═══════════════════════════════════════════════════════════════════
// PIPELINE ORQUESTRADOR
// Ponto de entrada unico do sistema Padroes Observados v2.
// Orquestra Anamnesista → Farmacologista + Epidemiologista → Compliance.
// ═══════════════════════════════════════════════════════════════════

const anamnesista = require('./anamnesista');
const farmacologista = require('./farmacologista');
const matching = require('./matching');
const compliance = require('./compliance');

const PIPELINE_TIMEOUT_MS = 15000;

async function comTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout:${label}`)), ms)),
  ]);
}

// Consolida cards dos diferentes agentes em estrutura final
function consolidarCards({ alertasFarmacologicos, autoMedicacao, matchingResult }) {
  const cards = [];

  // 1. Cards criticos farmacologicos primeiro (topo absoluto)
  for (const alerta of alertasFarmacologicos) {
    cards.push({
      ...alerta,
      bloco_visual: alerta.severidade === 'critica' ? 'critico_topo' : 'alerta_farmaco',
    });
  }

  // 2. Auto-medicacao
  for (const item of autoMedicacao) {
    cards.push({ ...item, bloco_visual: 'auto_medicacao' });
  }

  // 3. Diferenciais epidemiológicos (cap 3)
  const diferenciais = (matchingResult.candidatos || []).slice(0, 3);
  for (const d of diferenciais) {
    cards.push({ ...d, bloco_visual: 'padrao_diferencial' });
  }

  // 4. Red flag consolidado (sempre separado se red flags presentes)
  if (matchingResult.red_flags?.length > 0 && matchingResult.candidatos_red_flag?.length > 0) {
    for (const r of matchingResult.candidatos_red_flag) {
      cards.push({ ...r, red_flags_detectados: matchingResult.red_flags, bloco_visual: 'red_flag_separado' });
    }
  }

  return cards;
}

// Entry point principal
async function rodar({ transcricao, respostas, perfil, idade, sexo }) {
  const inicio = Date.now();
  const audit_trail = [];

  try {
    // Validacoes iniciais
    if (!transcricao && !respostas) {
      return { sucesso: false, motivo: 'sem_dados', padroesObservados_v2: [] };
    }

    // 1. Anamnesista (unica chamada LLM)
    let anamnese;
    try {
      anamnese = await comTimeout(
        anamnesista.extrair({ transcricao, respostas, idade, sexo }),
        8000,
        'anamnesista'
      );
      audit_trail.push({ agente: 'anamnesista', status: 'ok', tempo_ms: Date.now() - inicio });
    } catch (e) {
      audit_trail.push({ agente: 'anamnesista', status: 'erro', erro: e.message });
      return {
        sucesso: false,
        motivo: 'anamnesista_falhou',
        erro: e.message,
        audit_trail,
        padroesObservados_v2: [],
      };
    }

    // 2. Farmacologista + Epidemiologista em paralelo (ambos deterministicos, rapidos)
    const t2 = Date.now();
    const [farmacoResult, matchingResult] = await Promise.all([
      Promise.resolve(farmacologista.analisar({ anamnese, perfil: perfil || {} })),
      Promise.resolve(matching.rodarMatching({ anamnese, perfil: perfil || {}, idade, sexo })),
    ]);
    audit_trail.push({
      agente: 'farmacologista',
      status: 'ok',
      alertas: farmacoResult.alertasFarmacologicos.length,
      auto_medicacao: farmacoResult.autoMedicacao.length,
      tempo_ms: Date.now() - t2,
    });
    audit_trail.push({
      agente: 'epidemiologista',
      status: 'ok',
      queixa: matchingResult.queixa_detectada,
      candidatos: matchingResult.candidatos.length,
      red_flags: matchingResult.red_flags,
      tempo_ms: Date.now() - t2,
    });

    // 3. Consolidacao
    const cardsBrutos = consolidarCards({
      alertasFarmacologicos: farmacoResult.alertasFarmacologicos,
      autoMedicacao: farmacoResult.autoMedicacao,
      matchingResult,
    });

    // 4. Compliance
    const { aprovados, rejeitados } = compliance.processar(cardsBrutos);
    audit_trail.push({
      agente: 'compliance',
      status: 'ok',
      aprovados: aprovados.length,
      rejeitados: rejeitados.length,
      rejeicoes_detalhe: rejeitados,
    });

    // 5. Empacotamento final
    const tempoTotal = Date.now() - inicio;

    return {
      sucesso: true,
      pipeline_version: 'padroes_v2.0',
      anamnese_resumo: {
        queixa_principal: anamnese.queixa_principal,
        queixa_detectada: matchingResult.queixa_detectada,
      },
      padroesObservados_v2: aprovados,
      alertasFarmacologicos: aprovados.filter(c => c.tipo === 'alergia_medicamento'),
      examesRelevantes: [], // reservado pra fase 2
      auditoria: audit_trail,
      base_versions: matchingResult.versoes_bases,
      tempo_ms: tempoTotal,
      red_flags_detectados: matchingResult.red_flags,
    };
  } catch (e) {
    audit_trail.push({ agente: 'pipeline', status: 'erro_global', erro: e.message });
    return {
      sucesso: false,
      motivo: 'pipeline_erro',
      erro: e.message,
      audit_trail,
      padroesObservados_v2: [],
    };
  }
}

module.exports = { rodar };
