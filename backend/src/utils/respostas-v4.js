/**
 * Respostas V4 — Helpers pra estrutura nova de pré-consulta (quiz híbrido)
 *
 * Estrutura dentro de PreConsulta.respostas:
 *
 *   respostas = {
 *     _v4: {
 *       pergunta_<id>: {
 *         valor, modo, confianca, transcricaoBruta, audioChunkUrl,
 *         campoAnamnese, criadoEm, confirmadoEm, tentativas
 *       },
 *       ...
 *     },
 *     _versaoFluxo: 'v4-quiz-hibrido',
 *     _iniciadoEm: ISO,
 *     _perguntaAtual: número,
 *     _modoUltimaResposta: 'audio'|'texto'|null,
 *     _attemptId: uuid,
 *
 *     // Dual-write — campos legados que telas antigas esperam:
 *     queixaPrincipal: string,
 *     duracaoSintomas: string,
 *     intensidade: string,
 *     ...
 *   }
 *
 * Zero schema change no Prisma. Tudo cabe no JSON existente.
 */

const VERSAO_V4 = 'v4-quiz-hibrido';
const MODOS_VALIDOS = ['audio', 'texto', 'pulado', 'desconhecer'];
const FONTES_PARA_LEGADO = ['audio', 'texto']; // pulado/desconhecer NÃO populam campo legado

// Mapeamento: campo da anamnese → chaves legadas que telas antigas esperam
const MAPA_LEGADO = {
  queixaPrincipal:        ['queixaPrincipal'],
  tempoEvolucao:          ['duracaoSintomas', 'duracao', 'tempoEvolucao'],
  intensidade:            ['intensidade'],
  fatoresAgravantes:      ['fatoresAgravantes'],
  fatoresAtenuantes:      ['fatoresAtenuantes'],
  sintomasAssociados:     ['sintomas', 'sintomasAssociados'],
  tratamentoPrevio:       ['tratamentoPrevio'],
  antecedentesPessoais:   ['doencasAtuais', 'condicoes', 'antecedentesPessoais'],
  antecedentesFamiliares: ['historicoFamiliar', 'antecedentesFamiliares'],
  habitos:                ['habitos'],
  sono:                   ['sono', 'horasSono'],
};

// Sanitiza string contra XSS básico (medicina não tem HTML legítimo)
function sanitizar(str) {
  if (str == null) return null;
  if (typeof str !== 'string') str = String(str);
  return str
    .replace(/[<>]/g, '')           // remove tags
    .replace(/javascript:/gi, '')    // remove protocolos
    .replace(/\s+/g, ' ')            // normaliza espaços
    .trim()
    .slice(0, 5000);                 // limite razoável
}

// Detecta versão da pré-consulta lendo o `respostas`
function detectarVersao(respostas) {
  if (!respostas || typeof respostas !== 'object') return 'desconhecida';
  if (respostas._versaoFluxo) return respostas._versaoFluxo;
  if (respostas._v4) return VERSAO_V4;
  if (respostas._v2) return 'v2-pergunta-por-pergunta';
  return 'v1-legado';
}

// Cria estrutura V4 vazia (chamada na primeira resposta)
function criarEstruturaV4() {
  return {
    _v4: {},
    _versaoFluxo: VERSAO_V4,
    _iniciadoEm: new Date().toISOString(),
    _perguntaAtual: 0,
    _modoUltimaResposta: null,
  };
}

// Valida estrutura de UMA resposta V4 antes de salvar
function validarRespostaV4(resposta) {
  if (!resposta || typeof resposta !== 'object') return { ok: false, erro: 'resposta vazia' };
  if (!MODOS_VALIDOS.includes(resposta.modo)) return { ok: false, erro: 'modo inválido' };

  // Audio/texto precisam de valor
  if ((resposta.modo === 'audio' || resposta.modo === 'texto') && !resposta.valor) {
    return { ok: false, erro: 'audio/texto exigem valor' };
  }

  // Confiança precisa estar entre 0 e 1 se presente
  if (resposta.confianca != null) {
    const c = Number(resposta.confianca);
    if (isNaN(c) || c < 0 || c > 1) return { ok: false, erro: 'confiança inválida (0-1)' };
  }

  // Limite de tamanho do valor
  if (resposta.valor && String(resposta.valor).length > 5000) {
    return { ok: false, erro: 'valor muito grande (max 5000)' };
  }

  return { ok: true };
}

// Cria resposta individual com defaults seguros
function criarResposta({ valor, modo, confianca, transcricaoBruta, audioChunkUrl, campoAnamnese }) {
  const agora = new Date().toISOString();
  return {
    valor: valor ? sanitizar(String(valor)) : null,
    modo,
    confianca: confianca != null ? Math.max(0, Math.min(1, Number(confianca))) : null,
    transcricaoBruta: transcricaoBruta ? sanitizar(String(transcricaoBruta)) : null,
    audioChunkUrl: audioChunkUrl || null,
    campoAnamnese: campoAnamnese || null,
    criadoEm: agora,
    confirmadoEm: agora,
    tentativas: 1,
  };
}

// Salva uma resposta dentro do respostas, retornando o novo `respostas` modificado
function salvarRespostaNoEstado(respostasAtuais, perguntaId, novaResposta) {
  let estado = respostasAtuais && typeof respostasAtuais === 'object' ? { ...respostasAtuais } : {};
  if (!estado._v4) {
    estado = { ...estado, ...criarEstruturaV4() };
  }
  // Preserva tentativas se já existia
  const anterior = estado._v4['pergunta_' + perguntaId];
  if (anterior) {
    novaResposta.tentativas = (anterior.tentativas || 0) + 1;
    novaResposta.criadoEm = anterior.criadoEm; // mantém o primeiro
  }
  estado._v4['pergunta_' + perguntaId] = novaResposta;
  estado._perguntaAtual = perguntaId; // ou perguntaId+1 se for "próxima"
  if (novaResposta.modo === 'audio' || novaResposta.modo === 'texto') {
    estado._modoUltimaResposta = novaResposta.modo;
  }
  // Re-enriquece campos legados após cada save
  return enriquecerCamposLegados(estado);
}

// Popula os campos legados (queixaPrincipal, duracaoSintomas, etc) baseado em respostas._v4
// Telas antigas (V1/V2/desktop summary) leem desses campos
function enriquecerCamposLegados(respostas) {
  if (!respostas || !respostas._v4) return respostas;
  const out = { ...respostas };

  Object.values(respostas._v4).forEach(r => {
    if (!r || !r.campoAnamnese) return;
    if (!FONTES_PARA_LEGADO.includes(r.modo)) return; // pulado/desconhecer = NÃO popula
    if (!r.valor) return;

    const destinos = MAPA_LEGADO[r.campoAnamnese] || [r.campoAnamnese];
    destinos.forEach(d => {
      // Não sobrescreve campo manualmente preenchido (ex: V1 antiga)
      if (out[d] == null || out[d] === '') out[d] = r.valor;
    });
  });

  return out;
}

// Calcula cobertura: quantas perguntas têm status definido
function calcularCobertura(respostas, totalPerguntas) {
  if (!respostas || !respostas._v4) return { respondidas: 0, cobertura: 0, faltam: totalPerguntas, completa: false };
  const respondidasIds = Object.keys(respostas._v4).filter(k => k.startsWith('pergunta_'));
  const respondidas = respondidasIds.length;
  return {
    respondidas,
    cobertura: respondidas / totalPerguntas,
    faltam: Math.max(0, totalPerguntas - respondidas),
    completa: respondidas >= totalPerguntas,
    detalhes: respostas._v4,
  };
}

// Retorna resumo simplificado pro frontend (sem dados sensíveis)
function resumirParaCliente(respostas, totalPerguntas) {
  const cob = calcularCobertura(respostas, totalPerguntas);
  return {
    perguntaAtual: (respostas && respostas._perguntaAtual) || 0,
    modo: (respostas && respostas._modoUltimaResposta) || 'audio',
    versao: detectarVersao(respostas),
    cobertura: cob,
    respostas: (respostas && respostas._v4) || {},
  };
}

// Para Gemini summary final — popula anamneseEstruturada com fontes V4 reais
// Sobrescreve fontes que Gemini possa ter inferido erradamente
function enriquecerFontesAnamneseV4(anamneseFromGemini, respostasV4) {
  if (!anamneseFromGemini || typeof anamneseFromGemini !== 'object') return anamneseFromGemini;
  if (!respostasV4 || typeof respostasV4 !== 'object') return anamneseFromGemini;

  const out = JSON.parse(JSON.stringify(anamneseFromGemini));

  Object.values(respostasV4).forEach(r => {
    if (!r || !r.campoAnamnese) return;
    const campo = r.campoAnamnese;
    if (!out[campo]) return;

    if (r.modo === 'pulado') {
      out[campo] = { valor: null, fonte: 'pulado' };
    } else if (r.modo === 'desconhecer') {
      out[campo] = { valor: 'Paciente declarou desconhecer', fonte: 'desconhecer' };
    } else if (r.modo === 'audio' && r.valor) {
      out[campo] = { valor: out[campo].valor || r.valor, fonte: 'audio' };
    } else if (r.modo === 'texto' && r.valor) {
      // Texto digitado vira fonte 'formulario' pra retrocompat com badges existentes (audio/formulario/pulado/desconhecer)
      out[campo] = { valor: out[campo].valor || r.valor, fonte: 'formulario' };
    }
  });

  return out;
}

module.exports = {
  VERSAO_V4,
  MODOS_VALIDOS,
  MAPA_LEGADO,
  sanitizar,
  detectarVersao,
  criarEstruturaV4,
  validarRespostaV4,
  criarResposta,
  salvarRespostaNoEstado,
  enriquecerCamposLegados,
  calcularCobertura,
  resumirParaCliente,
  enriquecerFontesAnamneseV4,
};
