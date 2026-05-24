// CAMADA Z2 — Detecta o modo de operacao (padrao, cuidador, sensivel, urgencia, etc)
// Herda do cluster + aplica overrides por contexto (idade extrema, 3a pessoa, urgencia textual)

function normalizar(s) {
  return (s || '').toString().toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Detecta se as respostas indicam que quem falou foi cuidador (3a pessoa).
 * Heuristica simples: procura ele/ela/meu filho/minha mae/meu pai em respostas longas.
 */
function pareceCuidador(respostas) {
  if (!respostas) return false;
  const textoTotal = JSON.stringify(respostas).toLowerCase();
  const marcadores3p = [
    'meu filho', 'minha filha',
    'meu pai', 'minha mae', 'minha mãe',
    'meu marido', 'minha esposa',
    'ele esta', 'ela esta', 'ele sente', 'ela sente',
    'ele tem', 'ela tem'
  ];
  let hits = 0;
  for (const m of marcadores3p) {
    if (textoTotal.includes(m)) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

/**
 * Detecta urgencia textual nas respostas (paciente fala em alta intensidade).
 */
function pareceUrgencia(respostas) {
  if (!respostas) return false;
  const textoTotal = normalizar(JSON.stringify(respostas));
  const marcadores = [
    'muito forte', 'pior dor', 'nao aguento', 'nao consigo',
    'agora mesmo', 'urgente', 'emergencia', 'desmaiei', 'desmaio',
    'sangrando muito', 'falta de ar grave'
  ];
  for (const m of marcadores) {
    if (textoTotal.includes(m)) return true;
  }
  return false;
}

/**
 * Detecta se >50% das respostas estao vazias/curtas (possivel sensivel).
 */
function pareceRetraido(respostas) {
  if (!respostas) return false;
  let total = 0, curtas = 0;
  const inspecionar = obj => {
    if (!obj || typeof obj !== 'object') return;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v && typeof v === 'object' && 'valor' in v) {
        total++;
        const val = (v.valor || '').toString().trim();
        if (!val || val.length < 5) curtas++;
      } else if (v && typeof v === 'object') {
        inspecionar(v);
      }
    }
  };
  inspecionar(respostas);
  if (total < 3) return false;
  return (curtas / total) > 0.5;
}

/**
 * Decide o modo final.
 * Prioridade: cluster.modoEspecial > overrides de contexto > 'padrao'.
 *
 * Casos especiais:
 * - cluster=cuidador (peds, neo) sempre vence
 * - cluster=cuidador_parcial vira cuidador se pareceCuidador OR idade<12 OR idade>=80
 * - cluster=sensivel_parcial vira sensivel se pareceRetraido
 * - cluster sem modoEspecial: urgencia se pareceUrgencia
 * - paciente jovem em template padrao + parece cuidador: vira cuidador
 */
function detectarModo({ cluster, idadeAnos, respostas }) {
  const modoBase = (cluster && cluster.modoEspecial) || null;
  const cuidador = pareceCuidador(respostas);
  const urgencia = pareceUrgencia(respostas);
  const retraido = pareceRetraido(respostas);

  // Modo cuidador absoluto (peds, neo)
  if (modoBase === 'cuidador') return { modo: 'cuidador', razao: 'cluster pediatrico/neonatal' };

  // Cuidador parcial (geriatria, etc)
  if (modoBase === 'cuidador_parcial') {
    if (cuidador || (typeof idadeAnos === 'number' && (idadeAnos >= 80 || idadeAnos < 12))) {
      return { modo: 'cuidador', razao: 'cuidador_parcial promovido — idade extrema ou 3a pessoa detectada' };
    }
    return { modo: 'padrao', razao: 'cuidador_parcial nao ativado' };
  }

  // Sensivel absoluto (psiq)
  if (modoBase === 'sensivel') return { modo: 'sensivel', razao: 'cluster psiquiatrico' };

  // Sensivel parcial
  if (modoBase === 'sensivel_parcial') {
    if (retraido) return { modo: 'sensivel', razao: 'sensivel_parcial promovido — paciente retraido' };
    return { modo: 'sensivel_parcial', razao: 'sensivel_parcial mantido' };
  }

  // Urgencia
  if (modoBase === 'urgencia') return { modo: 'urgencia', razao: 'cluster de emergencia' };

  // Modos especificos sem promocao
  if (modoBase === 'pericia') return { modo: 'pericia', razao: 'cluster pericial' };
  if (modoBase === 'rastreio_ou_solicitado') return { modo: 'rastreio', razao: 'cluster diagnostico/laboratorial' };
  if (modoBase === 'alternativa') return { modo: 'alternativa', razao: 'cluster medicina integrativa' };

  // Sem modo base — checar overrides contextuais
  if (urgencia) return { modo: 'urgencia', razao: 'queixa contem marcadores de urgencia' };
  if (cuidador && typeof idadeAnos === 'number' && (idadeAnos < 12 || idadeAnos >= 80)) {
    return { modo: 'cuidador', razao: 'idade extrema + 3a pessoa nas respostas' };
  }

  return { modo: 'padrao', razao: 'sem override' };
}

/**
 * Limite de palavras pro textoVoz segundo o modo.
 */
function limitePalavras(modo) {
  switch (modo) {
    case 'urgencia': return 90;
    case 'sensivel': return 140;
    case 'sensivel_parcial': return 160;
    case 'cuidador':
    case 'padrao':
    case 'pericia':
    case 'rastreio':
    case 'alternativa':
    default:
      return 180;
  }
}

module.exports = {
  detectarModo,
  limitePalavras,
  pareceCuidador,
  pareceUrgencia,
  pareceRetraido
};
