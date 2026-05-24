// CAMADA Z1 — Detecta qual cluster comportamental a pre-consulta pertence
// 3 etapas em cascata: nome do template → palavras-chave nas perguntas → IA fallback (Haiku)

const fs = require('fs');
const path = require('path');

const CLUSTERS_PATH = path.join(__dirname, 'clusters.json');
let CLUSTERS = null;

function carregarClusters() {
  if (CLUSTERS) return CLUSTERS;
  const raw = fs.readFileSync(CLUSTERS_PATH, 'utf8');
  CLUSTERS = JSON.parse(raw);
  return CLUSTERS;
}

function normalizar(s) {
  return (s || '').toString().toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Etapa 1 — match exato no nome do template contra os "match[]" de cada cluster.
 */
function matchPorNomeTemplate(nomeTemplate) {
  const clusters = carregarClusters();
  const nome = normalizar(nomeTemplate);
  if (!nome) return null;

  // Itera clusters DEIXANDO C23 (fallback) por ultimo — evita "clinica" capturar "Acupuntura clinica"
  const ids = Object.keys(clusters).filter(k => k !== '_meta' && k !== 'C23');
  ids.push('C23'); // fallback por ultimo
  for (const id of ids) {
    const c = clusters[id];
    // Tenta primeiro palavras mais longas (mais especificas)
    const palavrasOrdenadas = (c.match || []).slice().sort((a, b) => (b || '').length - (a || '').length);
    for (const palavra of palavrasOrdenadas) {
      if (nome.includes(normalizar(palavra))) {
        return { clusterId: id, razao: `match exato em '${palavra}' no nome do template` };
      }
    }
  }
  return null;
}

/**
 * Etapa 2 — match heuristico nas perguntas (procura palavras-chave de cada cluster).
 * Conta quantos clusters tem match e devolve o que mais bateu (top-1 com score >= 2 minimo).
 */
// Palavras tipicas que aparecem em ENUNCIADOS de perguntas (nao no nome do template)
// Mantido aqui pra evitar mudar o JSON — facil de estender
const PERGUNTAS_CHAVE_POR_CLUSTER = {
  C01: ['dor no peito', 'peito', 'dor toracica', 'irradia', 'palpitacao', 'esforco', 'falta de ar', 'pressao alta'],
  C02: ['barriga', 'abdomen', 'abdominal', 'fezes', 'evacua', 'vomito', 'azia', 'queimacao no estomago', 'diarreia'],
  C03: ['articulacao', 'joelho', 'ombro', 'coluna', 'lombar', 'cervical', 'movimentar', 'rigidez'],
  C04: ['cabeca', 'cefaleia', 'tontura', 'desmaio', 'formigamento', 'fraqueza no braco'],
  C05: ['lesao', 'pele', 'mancha', 'coca', 'prurido', 'erupcao', 'vermelhidao'],
  C06: ['tosse', 'respira', 'pulmao', 'falta de ar', 'chiado', 'escarro', 'tabagismo'],
  C07: ['urina muito', 'sede', 'perdeu peso', 'ganhou peso', 'tireoide', 'cansaco', 'sente frio', 'sente calor'],
  C08: ['urinar', 'urina', 'arde para urinar', 'rim', 'inchaco', 'sangue na urina', 'jato urinario'],
  C09: ['menstruacao', 'menstrual', 'gravidez', 'gestante', 'corrimento', 'sangramento vaginal', 'mama', 'seio'],
  C10: ['triste', 'humor', 'ansiedade', 'pensamento', 'sono', 'concentra', 'desanimo'],
  C11: ['filho', 'crianca', 'bebe', 'leite', 'amamenta', 'vacina', 'cresceu'],
  C12: ['recem-nascido', 'recem nascido', 'mamada', 'fralda', 'cordao', 'parto'],
  C13: ['caiu', 'queda', 'esquece', 'memoria', 'remedio', 'sozinho', 'andar'],
  C14: ['cancer', 'tumor', 'quimio', 'radio', 'metastase', 'oncolog'],
  C15: ['febre', 'antibiotico', 'viagem', 'contato com doente', 'vacina'],
  C16: ['sangrou', 'sangramento', 'hematoma', 'cansaco', 'palidez'],
  C17: ['ouvido', 'escuta', 'zumbido', 'vertigem', 'garganta', 'voz', 'rouquidao'],
  C18: ['visao', 'enxerga', 'olho', 'fotofobia', 'borrada', 'oculos'],
  C19: ['alergia', 'urticaria', 'inchei', 'reagiu', 'anafilaxia'],
  C20: ['anestesia', 'cirurgia', 'jejum', 'pre-operatorio', 'pre operatorio', 'anticoagulante'],
  C21: ['perna', 'panturrilha', 'caminhar dores', 'varizes', 'inchaco perna'],
  C22: ['agora', 'urgente', 'forte demais', 'desmaiei', 'sangrando'],
  C24: ['trabalho', 'funcao', 'profissao', 'afasta', 'INSS', 'pericia'],
  C25: ['exame', 'tomografia', 'ressonancia', 'ultrassom', 'raio-x', 'contraste'],
  C26: ['energia', 'meridiano', 'yin', 'yang', 'miasma', 'constituicao'],
  C27: ['estetica', 'cirurgia plastica', 'reduzir', 'aumentar', 'lipo'],
  C28: ['intoxicacao', 'engoliu', 'inalou', 'envenenado', 'overdose']
};

function matchPorPerguntas(perguntas) {
  const clusters = carregarClusters();
  if (!Array.isArray(perguntas) || perguntas.length === 0) return null;

  const textoPerguntas = perguntas
    .map(p => normalizar(p.texto || p.text || ''))
    .join(' ');

  const scores = {};
  for (const id of Object.keys(clusters)) {
    if (id === '_meta' || id === 'C23') continue;
    // Junta match (nome do template) + perguntasChave (enunciado das perguntas)
    const palavras = (clusters[id].match || []).concat(PERGUNTAS_CHAVE_POR_CLUSTER[id] || []);
    let score = 0;
    for (const palavra of palavras) {
      if (textoPerguntas.includes(normalizar(palavra))) score++;
    }
    if (score > 0) scores[id] = score;
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return null;
  const [topId, topScore] = ranked[0];
  if (topScore < 2) return null;
  return { clusterId: topId, razao: `match heuristico em perguntas (score ${topScore})` };
}

/**
 * Etapa 3 — fallback IA. Pergunta pro Claude Haiku qual cluster faz mais sentido.
 */
async function matchPorIA(nomeTemplate, perguntas) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
    const clusters = carregarClusters();
    const opcoes = Object.entries(clusters)
      .filter(([k]) => k !== '_meta')
      .map(([k, v]) => `${k}: ${v.nome}`)
      .join('\n');

    const perguntasTexto = (perguntas || [])
      .map((p, i) => `${i + 1}. ${p.texto || p.text || ''}`)
      .join('\n');

    const resp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Voce e um classificador. Recebe nome de template medico + perguntas e devolve o ID do cluster mais apropriado.

OPCOES:
${opcoes}

TEMPLATE: ${nomeTemplate || '(sem nome)'}
PERGUNTAS:
${perguntasTexto || '(sem perguntas)'}

Devolva APENAS o ID (ex: C01). Se nada bater bem, devolva C23.`
      }]
    });

    const texto = (resp.content && resp.content[0] && resp.content[0].text || '').trim();
    const match = texto.match(/C\d{2}/);
    if (!match) return null;
    const id = match[0];
    if (!clusters[id]) return null;
    return { clusterId: id, razao: 'IA Haiku classificou' };
  } catch (e) {
    console.warn('[V4-cluster] IA fallback falhou:', e.message);
    return null;
  }
}

/**
 * Funcao principal. Tenta as 3 etapas em ordem. Cai em C23 se nada funcionar.
 */
async function detectarCluster({ nomeTemplate, perguntas }) {
  const t1 = matchPorNomeTemplate(nomeTemplate);
  if (t1) return { ...t1, etapa: 1 };

  const t2 = matchPorPerguntas(perguntas);
  if (t2) return { ...t2, etapa: 2 };

  const t3 = await matchPorIA(nomeTemplate, perguntas);
  if (t3) return { ...t3, etapa: 3 };

  return { clusterId: 'C23', razao: 'fallback — nada bateu', etapa: 4 };
}

function obterCluster(clusterId) {
  const clusters = carregarClusters();
  return clusters[clusterId] || clusters['C23'];
}

module.exports = {
  detectarCluster,
  matchPorNomeTemplate,
  matchPorPerguntas,
  matchPorIA,
  obterCluster,
  carregarClusters
};
