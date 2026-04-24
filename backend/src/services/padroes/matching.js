// ═══════════════════════════════════════════════════════════════════
// AGENTE EPIDEMIOLOGISTA — Motor de matching deterministico
// Le a base de conhecimento (backend/knowledge) e calcula score
// de cada condicao candidata baseado na anamnese + perfil.
// 100% sem LLM. Auditavel. Reproduzivel.
// ═══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..', '..', '..', 'knowledge');
let _condicoesCache = null;
let _versionCache = null;

function carregarBase() {
  if (_condicoesCache) return;
  _condicoesCache = {};
  _versionCache = JSON.parse(fs.readFileSync(path.join(BASE_DIR, '_version.json'), 'utf8'));

  for (const queixa of _versionCache.queixas_disponiveis || []) {
    const queixaDir = path.join(BASE_DIR, queixa);
    if (!fs.existsSync(queixaDir)) continue;
    _condicoesCache[queixa] = [];
    for (const file of fs.readdirSync(queixaDir)) {
      if (file.startsWith('_') || !file.endsWith('.json')) continue;
      try {
        const cond = JSON.parse(fs.readFileSync(path.join(queixaDir, file), 'utf8'));
        _condicoesCache[queixa].push(cond);
      } catch (e) {
        console.warn(`[matching] falha ao carregar ${queixa}/${file}:`, e.message);
      }
    }
  }
}

// Detecta qual queixa principal pela anamnese
function detectarQueixa(anamnese) {
  const q = (anamnese.queixa_principal || '').toLowerCase();
  const mapa = {
    cefaleia: ['cefaleia', 'dor de cabeca', 'dor na cabeca', 'dor cabeca', 'enxaqueca'],
    dor_toracica: ['dor no peito', 'dor toracica', 'dor peito'],
    dor_abdominal: ['dor abdominal', 'dor barriga', 'dor na barriga'],
    febre: ['febre', 'febril'],
    tosse: ['tosse', 'tossindo'],
    dispneia: ['falta de ar', 'dispneia'],
    dor_lombar: ['dor nas costas', 'lombalgia', 'dor lombar'],
    tontura: ['tontura', 'vertigem'],
    dor_articular: ['dor articular', 'dor junta', 'dor joelho'],
    diarreia: ['diarreia'],
    vomito: ['vomito', 'nausea persistente'],
    fadiga: ['fadiga', 'cansaco'],
    perda_peso: ['perda de peso', 'emagrecimento'],
    palpitacao: ['palpitacao', 'coracao acelerado'],
    edema: ['inchaco', 'edema'],
    disuria: ['dor ao urinar', 'ardencia ao urinar', 'disuria'],
    prurido: ['coceira', 'prurido'],
    lesao_pele: ['lesao de pele', 'mancha na pele', 'erupcao'],
    ansiedade: ['ansiedade', 'crise de ansiedade'],
    insonia: ['insonia', 'nao durmo'],
  };
  for (const [queixa, termos] of Object.entries(mapa)) {
    if (termos.some(t => q.includes(t))) return queixa;
  }
  return null;
}

// Avalia criterio individual (campo, operador, valor) contra anamnese+perfil
function avaliarCriterio(criterio, contexto) {
  const { campo, operador, valor } = criterio;
  let dado;
  if (campo.startsWith('perfil.')) {
    dado = contexto.perfil?.[campo.slice(7)];
  } else if (campo === 'idade') {
    dado = contexto.idade;
  } else if (campo === 'sexo') {
    dado = contexto.sexo;
  } else {
    dado = contexto.anamnese?.[campo];
  }

  if (dado === null || dado === undefined) return false;
  if (Array.isArray(dado)) dado = dado.map(x => String(x).toLowerCase());
  else dado = String(dado).toLowerCase();

  const valArr = Array.isArray(valor) ? valor : [valor];
  const valLow = valArr.map(v => typeof v === 'string' ? v.toLowerCase() : v);

  switch (operador) {
    case 'equals':
      return Array.isArray(dado) ? dado.includes(valLow[0]) : dado === valLow[0];
    case 'contains':
      if (Array.isArray(dado)) return dado.some(d => d.includes(valLow[0]));
      return dado.includes(valLow[0]);
    case 'contains_any':
      if (Array.isArray(dado)) return dado.some(d => valLow.some(v => d.includes(v)));
      return valLow.some(v => dado.includes(v));
    case 'not_contains_any':
      if (Array.isArray(dado)) return !dado.some(d => valLow.some(v => d.includes(v)));
      return !valLow.some(v => dado.includes(v));
    case '>=':
      return Number(dado) >= Number(valor);
    case '>':
      return Number(dado) > Number(valor);
    case '<=':
      return Number(dado) <= Number(valor);
    case '<':
      return Number(dado) < Number(valor);
    case 'range':
      const n = Number(dado);
      return n >= Number(valor[0]) && n <= Number(valor[1]);
    default:
      return false;
  }
}

function avaliarModificador(mod, contexto) {
  try {
    const expr = mod.condicao;
    const ctx = { sexo: contexto.sexo, idade: contexto.idade };
    // Avaliador simples pra expressões "sexo==feminino && idade>=25 && idade<=55"
    const cleaned = expr
      .replace(/sexo==(\w+)/g, (_, v) => `'${ctx.sexo}' === '${v}'`)
      .replace(/idade([<>=!]+)(\d+)/g, (_, op, v) => `${ctx.idade} ${op} ${v}`);
    return eval(cleaned); // eslint-disable-line no-eval
  } catch (e) {
    return false;
  }
}

function avaliarCondicao(condicao, contexto) {
  // Exclusão: se qualquer critério de exclusão bate, condição eliminada
  for (const exc of (condicao.criterios_exclusao || [])) {
    if (avaliarCriterio(exc, contexto)) {
      return { elegivel: false, motivo_exclusao: exc.motivo };
    }
  }

  // Gestante + contraindicado
  if (contexto.perfil?.gestante && condicao.contraindicacao_gestacao) {
    return { elegivel: false, motivo_exclusao: 'Condicao contraindica em gestacao' };
  }

  const sinaisBateram = [];
  const sinaisAusentes = [];
  let scoreAtual = 0;
  let scoreMax = 0;

  for (const crit of (condicao.criterios_positivos || [])) {
    const bateu = avaliarCriterio(crit, contexto);
    scoreMax += crit.peso || 1;
    if (bateu) {
      scoreAtual += crit.peso || 1;
      sinaisBateram.push({ descricao: crit.descricao || crit.campo, peso: crit.peso });
    } else {
      sinaisAusentes.push({ descricao: crit.descricao || crit.campo, peso: crit.peso });
    }
  }

  // Modificadores demográficos
  let modificador = 0;
  for (const mod of (condicao.modificadores_demograficos || [])) {
    if (avaliarModificador(mod, contexto)) {
      modificador += mod.peso_extra || 0;
    }
  }
  scoreAtual += modificador;

  const scoreFinal = scoreMax > 0 ? Math.round((scoreAtual / scoreMax) * 100) : 0;

  return {
    elegivel: true,
    condicao_id: condicao.id,
    nome: condicao.nome,
    nome_popular: condicao.nome_popular,
    cid10: condicao.cid10,
    score: Math.max(0, Math.min(100, scoreFinal)),
    sinais_bateram: sinaisBateram,
    sinais_ausentes: sinaisAusentes,
    total_criterios: condicao.criterios_positivos?.length || 0,
    prevalencia: condicao.prevalencia,
    fonte: condicao.fonte,
    fonte_complementar: condicao.fonte_complementar,
    nivel_evidencia: condicao.nivel_evidencia,
    proximo_passo: condicao.proximo_passo_template,
    base_version: `${condicao.queixa}/${condicao.id}_v${condicao.versao}`,
    tipo: condicao.tipo || 'diferencial',
    bloco_visual: condicao.bloco_visual || 'principal',
    modificador_aplicado: modificador,
  };
}

function verificarRedFlags(anamnese, contexto) {
  const flags = [];
  const texto = [
    anamnese.queixa_principal,
    anamnese.inicio_dor,
    ...(anamnese.sintomas_associados || []),
    ...(anamnese.fatores_piora || []),
    anamnese.padrao_temporal,
  ].filter(Boolean).join(' ').toLowerCase();

  const mapa = {
    inicio_subito_severo: ['subito', 'pior dor da vida', 'thunderclap', 'em segundos'],
    deficit_neurologico: ['fraqueza braco', 'fraqueza perna', 'fala enrolada', 'desvio boca', 'visao dupla', 'deficit focal', 'dormencia'],
    febre_associada: ['febre'],
    rigidez_nuca: ['rigidez nuca', 'pescoco duro'],
    piora_valsalva: ['valsalva', 'tossir', 'piora ao abaixar'],
    progressiva_semanas: ['progressiva', 'piorando todo dia', 'crescente'],
    idade_primeira_crise_maior_50: contexto.idade >= 50 ? ['primeira vez', 'nunca tive'] : [],
    alteracao_consciencia: ['alteracao consciencia', 'confusao mental', 'desmaio'],
  };

  for (const [flag, termos] of Object.entries(mapa)) {
    if (termos.some(t => texto.includes(t))) flags.push(flag);
  }
  return flags;
}

function rodarMatching({ anamnese, perfil, idade, sexo }) {
  carregarBase();

  const queixa = detectarQueixa(anamnese);
  if (!queixa || !_condicoesCache[queixa]) {
    return {
      queixa_detectada: queixa,
      candidatos: [],
      red_flags: [],
      motivo_sem_candidatos: queixa
        ? 'Queixa detectada mas base nao cobre ainda'
        : 'Nao foi possivel detectar queixa principal',
      versoes_bases: {},
    };
  }

  const contexto = { anamnese, perfil: perfil || {}, idade, sexo };
  const redFlags = verificarRedFlags(anamnese, contexto);

  const avaliadas = _condicoesCache[queixa]
    .map(c => avaliarCondicao(c, contexto))
    .filter(r => r.elegivel);

  // Separa red_flag_consolidado
  const candidatosNormais = avaliadas.filter(a => a.tipo !== 'red_flag_consolidado');
  const candidatosRedFlag = avaliadas.filter(a => a.tipo === 'red_flag_consolidado');

  // Ordena por score
  candidatosNormais.sort((a, b) => b.score - a.score);

  return {
    queixa_detectada: queixa,
    candidatos: candidatosNormais,
    candidatos_red_flag: candidatosRedFlag,
    red_flags: redFlags,
    versoes_bases: {
      [queixa]: _versionCache?.queixas_disponiveis?.includes(queixa) ? '1.0' : null,
      pipeline: _versionCache?.pipeline_version,
    },
  };
}

module.exports = { rodarMatching, carregarBase, detectarQueixa };
