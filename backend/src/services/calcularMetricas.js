// ============================================
// MÉTRICAS HONESTAS DO DASHBOARD MÉDICO
// ============================================
// Calcula 3 métricas com base em dados reais (pré-consultas respondidas)
// e nos 5 inputs declarativos do médico no setup (metricasConfig):
//
//  1. Tempo economizado (min)
//     = soma de cada pré-consulta:
//       (tempoAnamneseSemVitae × completude/100 × percentualEconomiaAnamnese/100)
//
//  2. Atendimentos a mais possíveis
//     = floor(tempoEconomizadoMin / tempoMedioConsulta)
//     UI mostra como "tempo livre equivalente a X consultas"
//
//  3. Receita possível (R$)
//     = atendimentosEquivalentes × valorConsulta × (1 − taxaNoShow/100)
//     UI mostra como "receita gerada com VITAE"
//
// Sem multiplicadores hardcoded (5x semana, 21x mês). Soma real do período.
// Sem fator universal (0.7). Cada médico declara seu próprio % de economia.
// ============================================

const { calcularCompletude } = require('./completude');

/**
 * Retorna { dataInicio, dataFim } para o período solicitado.
 * Trabalha com timezone do servidor (assume America/Sao_Paulo no Railway).
 */
function janelaPeriodo(periodo) {
  const agora = new Date();
  const fim = new Date(agora);

  let inicio;
  switch (periodo) {
    case 'hoje': {
      inicio = new Date(agora);
      inicio.setHours(0, 0, 0, 0);
      break;
    }
    case 'semana': {
      // Últimos 7 dias rolling (não semana calendário)
      inicio = new Date(agora);
      inicio.setDate(inicio.getDate() - 7);
      break;
    }
    case 'mes': {
      // Mês corrente (dia 1 ao agora)
      inicio = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
      break;
    }
    case '30dias':
    default: {
      // Rolling 30 dias
      inicio = new Date(agora);
      inicio.setDate(inicio.getDate() - 30);
      break;
    }
  }
  return { dataInicio: inicio, dataFim: fim };
}

/**
 * Calcula nível de confiança da estimativa baseado em volume de dados.
 * Quanto mais pré-consultas medidas, mais confiável o número.
 */
function calcularPrecisao(consultasMedidas) {
  if (consultasMedidas <= 0) return 0;
  if (consultasMedidas < 10) return 50 + Math.round(consultasMedidas * 2); // 50-68%
  if (consultasMedidas < 30) return 70 + Math.round((consultasMedidas - 10) * 0.75); // 70-85%
  if (consultasMedidas < 60) return 85 + Math.round((consultasMedidas - 30) * 0.23); // 85-92%
  return Math.min(95, 92 + Math.round((consultasMedidas - 60) * 0.05)); // 92-95%
}

/**
 * Lê e valida o setup do médico (campo metricasConfig).
 * Retorna { setup, completo, faltando[] }.
 */
function lerSetup(medico) {
  const cfg = medico?.metricasConfig || {};
  const setup = {
    tempoAnamneseSemVitae: Number(cfg.tempoAnamneseSemVitae) || null,
    percentualEconomiaAnamnese: Number(cfg.percentualEconomiaAnamnese) || null,
    tempoMedioConsulta: Number(cfg.tempoMedioConsulta) || Number(medico?.tempoMedioConsulta) || null,
    valorConsulta: Number(cfg.valorConsulta) || Number(medico?.valorConsulta) || null,
    taxaNoShow: cfg.taxaNoShow != null ? Number(cfg.taxaNoShow) : null,
    setupConcluido: !!cfg.setupConcluido,
    calibradoEm: cfg.calibradoEm || null,
  };

  const faltando = [];
  if (!setup.tempoAnamneseSemVitae) faltando.push('tempoAnamneseSemVitae');
  if (!setup.percentualEconomiaAnamnese) faltando.push('percentualEconomiaAnamnese');
  if (!setup.tempoMedioConsulta) faltando.push('tempoMedioConsulta');
  if (setup.valorConsulta == null) faltando.push('valorConsulta');
  if (setup.taxaNoShow == null) faltando.push('taxaNoShow');

  return {
    setup,
    completo: faltando.length === 0,
    faltando,
  };
}

/**
 * Calcula as 3 métricas honestas do dashboard.
 *
 * @param {object} medico - registro Medico do banco (com metricasConfig)
 * @param {Array} preConsultas - pré-consultas RESPONDIDAS do período
 * @param {string} periodo - 'hoje' | 'semana' | 'mes' | '30dias'
 * @returns {object} payload pro frontend
 */
function calcularMetricas(medico, preConsultas, periodo = '30dias') {
  const { setup, completo, faltando } = lerSetup(medico);

  // Setup incompleto — retorna estrutura vazia com alerta claro
  if (!completo) {
    return {
      periodo,
      setupConcluido: false,
      alerta: 'Configure suas informações no perfil pra liberar as métricas.',
      camposFaltando: faltando,
      tempoEconomizadoMin: 0,
      atendimentosEquivalentes: 0,
      receitaPossivel: 0,
      precisao: 0,
      consultasMedidas: 0,
      consultasNoPeriodo: preConsultas?.length || 0,
      detalhe: null,
    };
  }

  const lista = Array.isArray(preConsultas) ? preConsultas : [];

  // Pra cada pré-consulta respondida, calcula contribuição individual.
  // Trabalhamos em CENTÉSIMOS de minuto pra evitar erro de float
  // (ex: 5 × 8.4 = 41.999... que viraria 41 com Math.floor).
  let centésimosTotais = 0;
  let consultasMedidas = 0;
  let somaCompletude = 0;

  for (const pc of lista) {
    if (pc.status !== 'RESPONDIDA') continue;
    const completude = calcularCompletude(pc); // 0-100
    if (completude <= 0) continue; // pré-consulta vazia não conta

    // tempoAnamneseSemVitae × (completude/100) × (percentualEconomiaAnamnese/100) × 100 (centésimos)
    // = tempoAnamneseSemVitae × completude × percentualEconomiaAnamnese / 100
    const centésimosDessaConsulta = Math.round(
      (setup.tempoAnamneseSemVitae * completude * setup.percentualEconomiaAnamnese) / 100
    );

    centésimosTotais += centésimosDessaConsulta;
    consultasMedidas++;
    somaCompletude += completude;
  }

  // Arredonda pra baixo (conservador — preferimos mostrar menos do que real)
  let tempoEconomizadoMin = Math.floor(centésimosTotais / 100);

  const atendimentosEquivalentes = Math.floor(
    tempoEconomizadoMin / setup.tempoMedioConsulta
  );

  // Receita possível — desconta no-show
  const fatorPresenca = (100 - setup.taxaNoShow) / 100;
  const receitaPossivel = Math.floor(
    atendimentosEquivalentes * setup.valorConsulta * fatorPresenca
  );

  const precisao = calcularPrecisao(consultasMedidas);
  const completudeMedia = consultasMedidas > 0
    ? Math.round(somaCompletude / consultasMedidas)
    : 0;

  return {
    periodo,
    setupConcluido: true,
    alerta: null,
    tempoEconomizadoMin,
    atendimentosEquivalentes,
    receitaPossivel,
    precisao,
    consultasMedidas,
    consultasNoPeriodo: lista.length,
    detalhe: {
      tempoAnamneseSemVitae: setup.tempoAnamneseSemVitae,
      percentualEconomiaAnamnese: setup.percentualEconomiaAnamnese,
      tempoMedioConsulta: setup.tempoMedioConsulta,
      valorConsulta: setup.valorConsulta,
      taxaNoShow: setup.taxaNoShow,
      completudeMediaPeriodo: completudeMedia,
      calibradoEm: setup.calibradoEm,
    },
  };
}

module.exports = {
  calcularMetricas,
  calcularPrecisao,
  janelaPeriodo,
  lerSetup,
};
