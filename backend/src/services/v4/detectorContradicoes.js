// CAMADA Z3 (parte) — Detecta contradicoes internas e divergencias cadastro x audio
// Roda ANTES da IA pra alimentar SECAO D do prompt

function normalizar(s) {
  return (s || '').toString().toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Procura na transcricao do audio palavras que parecem nomes de medicamentos comuns.
 * Heuristica simples — nao pretende ser exaustiva, so flagar divergencia grosseira.
 */
function medsCitadosNoAudio(transcricaoAudio) {
  if (!transcricaoAudio) return [];
  const texto = normalizar(transcricaoAudio);
  // Dicionario rapido de meds + suplementos comuns
  const palavrasCandidatas = [
    'dipirona', 'paracetamol', 'ibuprofeno', 'cetirizina', 'loratadina', 'prednisolona',
    'prednisona', 'omeprazol', 'losartana', 'enalapril', 'metformina', 'insulina',
    'amoxicilina', 'azitromicina', 'rivotril', 'clonazepam', 'sertralina', 'fluoxetina',
    'cannabidiol', 'canabidiol', 'cbd', 'creatina', 'whey', 'aas', 'aspirina',
    'novalgina', 'tylenol', 'aliv', 'allegra', 'omega', 'vitamina'
  ];
  const achados = new Set();
  for (const p of palavrasCandidatas) {
    if (texto.includes(p)) achados.add(p);
  }
  return Array.from(achados);
}

/**
 * Procura indicios de alergias na transcricao.
 */
function alergiaCitadaNoAudio(transcricaoAudio) {
  if (!transcricaoAudio) return false;
  const t = normalizar(transcricaoAudio);
  const marcadores = [
    'alergia', 'alergico', 'alergica', 'urticaria', 'elticaria',
    'anafilaxia', 'choque alergico', 'fui internado', 'inchei'
  ];
  return marcadores.some(m => t.includes(m));
}

/**
 * Extrai valor de uma resposta — funciona pros formatos V4 (_v4) e legados.
 */
function valorDaResposta(resposta) {
  if (!resposta) return null;
  if (typeof resposta === 'string') return resposta;
  if (typeof resposta === 'object') {
    if ('valor' in resposta) return resposta.valor;
    if ('texto' in resposta) return resposta.texto;
  }
  return null;
}

/**
 * Detecta padrao "yesno=Nenhuma" + descricao posterior do sintoma negado.
 * Aplica-se principalmente a cardio (P4="Nenhuma dor toracica" vs P5+ descrevendo dor).
 */
function detectarContradicaoYesNoComDescricao(perguntas, respostasMap) {
  const contradicoes = [];
  if (!Array.isArray(perguntas) || !respostasMap) return contradicoes;

  for (let i = 0; i < perguntas.length; i++) {
    const p = perguntas[i];
    const r = respostasMap[p.id];
    const val = normalizar(valorDaResposta(r));
    if (!val) continue;

    // Pergunta tipo yesno OU texto curto que respondeu "nenhuma/nao/zero"
    const respondeuNegativo = ['nenhuma', 'nenhum', 'nao', 'nao tenho', 'zero', 'nada'].includes(val);
    if (!respondeuNegativo) continue;

    // Olhar proximas perguntas que parecem detalhar o sintoma
    const proxs = perguntas.slice(i + 1).slice(0, 8);
    let descreveu = false;
    let textoAcumulado = '';
    for (const px of proxs) {
      const rx = respostasMap[px.id];
      const vx = (valorDaResposta(rx) || '').toString().trim();
      if (vx && vx.length > 3 && !['nao', 'nenhum', 'nenhuma'].includes(normalizar(vx))) {
        descreveu = true;
        textoAcumulado += vx + ' | ';
      }
    }
    if (descreveu) {
      contradicoes.push(
        `P${i + 1} ("${p.texto || p.text || p.id}") respondida com "${valorDaResposta(r)}", mas perguntas seguintes descrevem o sintoma: ${textoAcumulado.slice(0, 200)}`
      );
    }
  }
  return contradicoes;
}

/**
 * Detecta divergencia entre meds citados no audio e meds ativos no cadastro.
 */
function detectarDivergenciaMeds(transcricaoAudio, medsAtivosCadastro) {
  const audio = medsCitadosNoAudio(transcricaoAudio);
  const cad = (medsAtivosCadastro || []).map(m => normalizar(m.nome || ''));

  const audioExtra = audio.filter(a => !cad.some(c => c.includes(a)));
  const cadastroExtra = cad.filter(c => !audio.some(a => c.includes(a)));

  const linhas = [];
  if (audioExtra.length > 0) {
    linhas.push(`Audio cita medicamentos NAO registrados no cadastro: ${audioExtra.join(', ')}`);
  }
  if (cadastroExtra.length > 0) {
    linhas.push(`Cadastro lista medicamentos NAO citados pelo paciente no audio: ${cadastroExtra.join(', ')}`);
  }
  return linhas;
}

/**
 * Detecta divergencia entre alergia citada no audio e cadastro vazio.
 */
function detectarDivergenciaAlergia(transcricaoAudio, alergiasCadastro) {
  if (alergiaCitadaNoAudio(transcricaoAudio) && (!alergiasCadastro || alergiasCadastro.length === 0)) {
    return ['Cadastro nao registra alergias, mas paciente relata alergia(s) no audio'];
  }
  return [];
}

/**
 * Funcao principal — devolve lista de contradicoes pra alimentar SECAO D do prompt.
 */
function detectarContradicoes({ perguntas, respostas, transcricaoAudio, cadastroFiltrado }) {
  const contradicoes = [];

  // Monta respostasMap por id (suporta formato _v4 e legado)
  let respostasMap = {};
  if (respostas) {
    if (respostas._v4 && typeof respostas._v4 === 'object') {
      // V4 quiz-hibrido: chaves tipo "pergunta_q_queixa"
      for (const k of Object.keys(respostas._v4)) {
        const id = k.replace(/^pergunta_/, '');
        respostasMap[id] = respostas._v4[k];
      }
    } else {
      // Formato legado: chaves diretas
      for (const k of Object.keys(respostas)) {
        if (k.startsWith('_')) continue;
        respostasMap[k] = respostas[k];
      }
    }
  }

  contradicoes.push(...detectarContradicaoYesNoComDescricao(perguntas, respostasMap));
  contradicoes.push(...detectarDivergenciaMeds(transcricaoAudio, cadastroFiltrado && cadastroFiltrado.medsAtivos));
  contradicoes.push(...detectarDivergenciaAlergia(transcricaoAudio, cadastroFiltrado && cadastroFiltrado.alergias));

  return contradicoes;
}

module.exports = {
  detectarContradicoes,
  medsCitadosNoAudio,
  alergiaCitadaNoAudio,
  detectarContradicaoYesNoComDescricao,
  detectarDivergenciaMeds,
  detectarDivergenciaAlergia
};
