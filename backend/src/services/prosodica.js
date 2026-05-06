/**
 * VITAE — Análise Prosódica (Fase 9)
 *
 * Detecta sinais sutis na voz do paciente que sugerem urgência clínica:
 * pausa longa ao descrever queixa, voz embargada, fala lenta, tom alterado.
 * Linguagem técnica (jitter, shimmer, F0) NUNCA aparece pro médico — só
 * traduções clínicas em PT-BR.
 *
 * COMPLIANCE:
 * - LGPD: armazena APENAS hash SHA-256 do áudio + features extraídas. NUNCA o áudio em si.
 * - CFM 2.314/2022: retenção 20 anos pra audit trail.
 * - Disclaimer obrigatório em todo alerta.
 *
 * MODO: 'mock' (determinístico, baseado em duração + características do summaryJson)
 *       'real' (futuro: extração via biblioteca DSP — librosa/Praat python wrapper)
 */
const crypto = require('crypto');

const MODO = process.env.PROSODICA_MODO || 'mock';

// Thresholds conservadores (por design — falso negativo é menos grave que falso positivo)
const THRESHOLDS = {
  pausaMinMs: 1500,                // pausa mais longa que 1.5s ao descrever queixa = sinal
  velocidadeFalaWpmMin: 95,        // <95 palavras/min = fala lenta
  jitterMax: 0.04,                 // jitter > 4% = voz tremida
  shimmerMax: 0.10,                // shimmer > 10% = voz embargada
  f0VariacaoMax: 0.25,             // variação de tom > 25% baseline = tom alterado
  duracaoMinSegundos: 30,          // áudios curtos demais não são analisáveis
};

const TEXTOS_CLINICOS = {
  pausa_longa_queixa: 'Pausa longa ao descrever a queixa principal',
  voz_embargada: 'Voz embargada em segmentos da resposta',
  fala_lenta: 'Velocidade de fala abaixo do habitual',
  tom_alterado: 'Variação de tom ao falar de tópico específico',
  carga_emocional: 'Possível carga emocional aparente em segmento curto',
};

function hashAudio(audioBuffer) {
  if (!audioBuffer) return null;
  return crypto.createHash('sha256').update(audioBuffer).digest('hex');
}

function calcRetencaoAte20anos(de = new Date()) {
  const r = new Date(de);
  r.setFullYear(r.getFullYear() + 20);
  return r;
}

/**
 * MODO MOCK — gera features determinísticas a partir de:
 * - Duração do áudio
 * - Tamanho da transcrição
 * - Presença de queixas em campos da anamnese estruturada
 *
 * Não bate em nenhum modelo de IA, não envia áudio pra lugar nenhum.
 * Suficiente pra desenvolver UI + audit trail. Quando trocar pra modo real,
 * só implementar a função `extrairFeaturesReal()`.
 */
function extrairFeaturesMock(input) {
  const { duracaoSegundos = 0, transcricao = '', summaryJson = {} } = input || {};

  if (duracaoSegundos < THRESHOLDS.duracaoMinSegundos) {
    return null; // áudio curto demais
  }

  const palavras = String(transcricao).split(/\s+/).filter(Boolean).length;
  const wpm = duracaoSegundos > 0 ? Math.round((palavras / duracaoSegundos) * 60) : 0;

  // Heurística determinística (não-aleatória) baseada em hashes da transcrição
  const seed = crypto.createHash('md5').update(transcricao || '').digest();
  const noiseFactor = (seed[0] / 255) * 0.5; // 0-0.5

  const features = {
    duracao_segundos: duracaoSegundos,
    palavras_total: palavras,
    velocidade_wpm: wpm,
    pausa_max_ms: Math.round(800 + noiseFactor * 1500), // 800-2300ms
    pausa_media_ms: Math.round(200 + noiseFactor * 400),
    jitter_estimado: Number((0.015 + noiseFactor * 0.04).toFixed(4)),
    shimmer_estimado: Number((0.05 + noiseFactor * 0.08).toFixed(4)),
    f0_mediana_hz: Math.round(160 + noiseFactor * 60), // 160-220
    f0_variacao_pct: Number((0.10 + noiseFactor * 0.20).toFixed(3)),
    modo_extracao: 'mock',
  };

  return features;
}

/**
 * Avalia features contra thresholds e retorna alertas em LINGUAGEM CLÍNICA.
 */
function avaliarFeatures(features) {
  if (!features) return null;

  const alertas = [];
  if (features.pausa_max_ms > THRESHOLDS.pausaMinMs) {
    alertas.push(TEXTOS_CLINICOS.pausa_longa_queixa);
  }
  if (features.velocidade_wpm > 0 && features.velocidade_wpm < THRESHOLDS.velocidadeFalaWpmMin) {
    alertas.push(TEXTOS_CLINICOS.fala_lenta);
  }
  if (features.jitter_estimado > THRESHOLDS.jitterMax || features.shimmer_estimado > THRESHOLDS.shimmerMax) {
    alertas.push(TEXTOS_CLINICOS.voz_embargada);
  }
  if (features.f0_variacao_pct > THRESHOLDS.f0VariacaoMax) {
    alertas.push(TEXTOS_CLINICOS.tom_alterado);
  }

  if (!alertas.length) return null; // nenhum alerta = saudável

  // Severidade conservadora: se ≥2 sinais coincidem, alerta médio; ≥3 = alta
  const severidade = alertas.length >= 3 ? 'alta' : alertas.length === 2 ? 'media' : 'baixa';

  return {
    severidade,
    mensagem: alertas.join(' · '),
    sinais: alertas,
    disclaimer: 'IA pode errar. Esta observação não é diagnóstico — confirme clinicamente. (CFM 2.314/2022)',
  };
}

/**
 * Função principal: recebe áudio (ou transcrição+duração no modo mock),
 * extrai features, avalia, retorna {alerta, features, hash, retencaoAte}.
 *
 * @param {Object} input
 * @param {Buffer} [input.audioBuffer]    — buffer do áudio (modo real)
 * @param {string} [input.transcricao]    — texto da transcrição (sempre disponível)
 * @param {number} [input.duracaoSegundos]
 * @param {Object} [input.summaryJson]    — summaryJson da PC (contexto)
 * @param {number} [input.trechoInicioMs] — opcional, marca o trecho analisado
 * @param {number} [input.trechoFimMs]
 * @returns {Object} { alerta, features, thresholds, hashAudio, retencaoAte, trecho }
 */
function analisar(input) {
  const features = MODO === 'mock'
    ? extrairFeaturesMock(input)
    : extrairFeaturesMock(input); // modo real ainda não implementado — fallback mock

  if (!features) {
    return {
      alerta: null,
      features: null,
      thresholds: THRESHOLDS,
      hashAudio: null,
      retencaoAte: null,
      motivo: 'audio_curto_demais',
    };
  }

  const alerta = avaliarFeatures(features);

  return {
    alerta,
    features,
    thresholds: THRESHOLDS,
    hashAudio: hashAudio(input.audioBuffer),
    retencaoAte: calcRetencaoAte20anos(),
    trecho: {
      inicio_ms: input.trechoInicioMs || 0,
      fim_ms: input.trechoFimMs || (input.duracaoSegundos || 0) * 1000,
    },
    modo: MODO,
  };
}

module.exports = { analisar, extrairFeaturesMock, avaliarFeatures, hashAudio, calcRetencaoAte20anos, THRESHOLDS, TEXTOS_CLINICOS };
