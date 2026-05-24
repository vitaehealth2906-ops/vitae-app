// CAMADA Z6 — TTS wrap pra V4
// - Aplica dicionario de acentos PT-BR (IA as vezes gera sem acento — ElevenLabs le errado)
// - Pre-processa textoVoz pra TTS falar melhor (datas/numeros/abreviacoes)
// - Chama ElevenLabs (mesmo client da ai.js antiga)
// - Salva no bucket privado (com fallback publico se nao existir)
// - Devolve storagePath pro persistencia.js salvar no banco

const { uploadAudioSeguro } = require('./storageSeguro');

// ============================================================================
// DICIONARIO DE ACENTOS — ~120 palavras criticas em contexto clinico
// IA gera "esforco" → ElevenLabs le "esforKO". Aqui corrigimos pra "esforço".
// Match boundary (\\b) + case-insensitive + preserva capitalizacao da 1a letra.
// ============================================================================
const ACENTOS_PT_BR = [
  // ___ palavras com -ção / -são / -ão ___
  ['avaliacao', 'avaliação'], ['avaliacoes', 'avaliações'],
  ['informacao', 'informação'], ['informacoes', 'informações'],
  ['observacao', 'observação'], ['observacoes', 'observações'],
  ['medicacao', 'medicação'], ['medicacoes', 'medicações'],
  ['situacao', 'situação'], ['situacoes', 'situações'],
  ['atencao', 'atenção'],
  ['ausencia', 'ausência'],
  ['internacao', 'internação'], ['internacoes', 'internações'],
  ['palpitacao', 'palpitação'], ['palpitacoes', 'palpitações'],
  ['contradicao', 'contradição'], ['contradicoes', 'contradições'],
  ['relacao', 'relação'], ['relacoes', 'relações'],
  ['duracao', 'duração'], ['duracoes', 'durações'],
  ['queimacao', 'queimação'],
  ['irradiacao', 'irradiação'],
  ['inflamacao', 'inflamação'],
  ['operacao', 'operação'], ['operacoes', 'operações'],
  ['caracterizacao', 'caracterização'],
  ['regiao', 'região'], ['regioes', 'regiões'],
  ['confirmacao', 'confirmação'],
  ['descricao', 'descrição'],
  ['depressao', 'depressão'],
  ['hipertensao', 'hipertensão'],
  ['hipotensao', 'hipotensão'],
  ['tensao', 'tensão'],
  ['vermelhidao', 'vermelhidão'],
  ['transmissao', 'transmissão'],
  ['compreensao', 'compreensão'],
  ['decisao', 'decisão'],
  ['estimulacao', 'estimulação'],
  ['intoxicacao', 'intoxicação'],
  // ___ c → ç ___
  ['esforco', 'esforço'], ['esforcos', 'esforços'],
  ['cabeca', 'cabeça'], ['cabecas', 'cabeças'],
  ['pescoco', 'pescoço'], ['pescocos', 'pescoços'],
  ['braco', 'braço'], ['bracos', 'braços'],
  ['coracao', 'coração'], ['coracoes', 'corações'],
  ['endereco', 'endereço'],
  ['comeco', 'começo'],
  ['aco', 'aço'],
  ['servico', 'serviço'], ['servicos', 'serviços'],
  // ___ a → á / â ___
  ['torax', 'tórax'], ['toracica', 'torácica'], ['toracico', 'torácico'],
  ['cardiaca', 'cardíaca'], ['cardiaco', 'cardíaco'],
  ['acido', 'ácido'], ['acidos', 'ácidos'], ['acida', 'ácida'],
  ['analgesico', 'analgésico'], ['analgesicos', 'analgésicos'],
  ['anestesico', 'anestésico'],
  ['antibiotico', 'antibiótico'], ['antibioticos', 'antibióticos'],
  ['gastrico', 'gástrico'], ['gastrica', 'gástrica'],
  // ___ e → é / ê ___
  ['historico', 'histórico'], ['historica', 'histórica'], ['historicos', 'históricos'],
  ['clinico', 'clínico'], ['clinica', 'clínica'], ['clinicos', 'clínicos'],
  ['medico', 'médico'], ['medica', 'médica'], ['medicos', 'médicos'], ['medicas', 'médicas'],
  ['referencia', 'referência'], ['referencias', 'referências'],
  ['frequencia', 'frequência'], ['frequencias', 'frequências'],
  ['urgencia', 'urgência'], ['urgencias', 'urgências'],
  ['emergencia', 'emergência'], ['emergencias', 'emergências'],
  ['experiencia', 'experiência'],
  ['ocorrencia', 'ocorrência'],
  ['ciencia', 'ciência'],
  ['paciencia', 'paciência'],
  ['consciencia', 'consciência'],
  ['evidencia', 'evidência'],
  ['cancer', 'câncer'],
  // ___ o → ó / ô ___
  ['nausea', 'náusea'], ['nauseas', 'náuseas'],
  ['vomito', 'vômito'], ['vomitos', 'vômitos'],
  ['oncologica', 'oncológica'], ['oncologico', 'oncológico'],
  ['cardiologica', 'cardiológica'], ['cardiologico', 'cardiológico'],
  ['pneumologica', 'pneumológica'], ['pneumologico', 'pneumológico'],
  ['urologica', 'urológica'], ['urologico', 'urológico'],
  ['nefrologica', 'nefrológica'], ['nefrologico', 'nefrológico'],
  ['endocrinologico', 'endocrinológico'], ['endocrinologica', 'endocrinológica'],
  ['reumatologico', 'reumatológico'], ['reumatologica', 'reumatológica'],
  ['hematologico', 'hematológico'], ['hematologica', 'hematológica'],
  ['psicologico', 'psicológico'], ['psicologica', 'psicológica'],
  ['ginecologico', 'ginecológico'], ['ginecologica', 'ginecológica'],
  ['neurologico', 'neurológico'], ['neurologica', 'neurológica'],
  ['ortopedico', 'ortopédico'], ['ortopedica', 'ortopédica'],
  // ___ u → ú ___
  ['urticaria', 'urticária'], ['urticarias', 'urticárias'],
  ['ultimo', 'último'], ['ultima', 'última'], ['ultimos', 'últimos'], ['ultimas', 'últimas'],
  ['unico', 'único'], ['unica', 'única'],
  // ___ i → í ___
  ['sincope', 'síncope'],
  ['rigida', 'rígida'], ['rigido', 'rígido'],
  // ___ outras comuns ___
  ['porem', 'porém'],
  ['ja', 'já'],
  ['ate', 'até'],
  ['so', 'só'],
  ['tambem', 'também'],
  ['voce', 'você'], ['voces', 'vocês'],
  ['nao', 'não'],
  ['orgao', 'órgão'], ['orgaos', 'órgãos'],
  ['mae', 'mãe'],
  ['amanha', 'amanhã'],
  // ___ termos clinicos pontuais ___
  ['proximo', 'próximo'], ['proxima', 'próxima'],
  ['diaria', 'diária'], ['diarias', 'diárias'],
  ['pascoa', 'Páscoa']
];

/**
 * Aplica dicionario de acentos preservando capitalizacao da 1a letra.
 * Ex: "Esforco" → "Esforço", "esforco" → "esforço".
 */
function aplicarAcentos(texto) {
  if (!texto) return '';
  let t = texto;
  for (const [errado, certo] of ACENTOS_PT_BR) {
    if (errado === certo) continue;
    const re = new RegExp(`\\b${errado}\\b`, 'gi');
    t = t.replace(re, (match) => {
      if (match[0] === match[0].toUpperCase()) {
        return certo.charAt(0).toUpperCase() + certo.slice(1);
      }
      return certo;
    });
  }
  return t;
}

/**
 * Pre-processa textoVoz pra que TTS leia melhor:
 * - corrige acentos (dicionario)
 * - "8/10" → "8 de 10"
 * - "20-30 minutos" → "20 a 30 minutos"
 * - datas DD/MM/AAAA → dia X de [mês] de AAAA
 * - abreviacoes clinicas com acento certo (pressão arterial, frequência cardíaca etc)
 */
function preprocessarTextoVoz(texto) {
  if (!texto) return '';
  // PRIMEIRO acentos (antes das outras transformacoes pra nao corromper)
  let t = aplicarAcentos(texto);

  // Escalas tipo "8/10"
  t = t.replace(/(\d+)\s*\/\s*10\b/g, '$1 de 10');

  // Intervalos com hifen "20-30 minutos"
  t = t.replace(/(\d+)\s*-\s*(\d+)\s*(minutos?|horas?|dias?|semanas?|meses)/gi, '$1 a $2 $3');

  // Datas DD/MM/AAAA pra extenso (mes com acento)
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  t = t.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g, (_, d, m, a) => {
    const mes = meses[parseInt(m, 10) - 1] || m;
    return `${parseInt(d, 10)} de ${mes} de ${a}`;
  });

  // Abreviacoes clinicas (com acento certo desde ja)
  const abrev = [
    [/\bPA\b/g, 'pressão arterial'],
    [/\bFC\b/g, 'frequência cardíaca'],
    [/\bFR\b/g, 'frequência respiratória'],
    [/\bSatO2\b/gi, 'saturação de oxigênio'],
    [/\bECG\b/g, 'eletrocardiograma'],
    [/\bRX\b/g, 'raio X'],
    [/\bRM\b/g, 'ressonância magnética'],
    [/\bTC\b/g, 'tomografia'],
    [/\bHF\b/g, 'histórico familiar'],
    [/\bHPP\b/g, 'histórico patológico pregresso'],
    [/\bIMC\b/g, 'índice de massa corporal'],
    [/\bDUM\b/g, 'data da última menstruação']
  ];
  for (const [re, repl] of abrev) t = t.replace(re, repl);

  // mg → "miligramas"
  t = t.replace(/(\d+)\s*mg\b/gi, '$1 miligramas');

  return t;
}

async function chamarElevenLabs(textoTTS, voiceId) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY ausente');
  const vid = voiceId || process.env.ELEVENLABS_VOICE_ID || 'onwK4e9ZLuTAKqWW03F9';

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({
      text: textoTTS,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs error ${response.status}: ${err}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Gera TTS V4 a partir do textoVoz, salva em bucket privado (com fallback publico),
 * devolve storagePath.
 */
async function gerarTTSV4({ textoVoz, preConsultaId }) {
  const textoTTS = preprocessarTextoVoz(textoVoz);
  const buffer = await chamarElevenLabs(textoTTS);
  const fileName = `${Date.now()}-tts-v4-${preConsultaId}.mp3`;
  const r = await uploadAudioSeguro({
    buffer,
    fileName,
    contentType: 'audio/mpeg'
  });
  return {
    ...r,
    bytes: buffer.length,
    textoTTSProcessado: textoTTS
  };
}

module.exports = {
  gerarTTSV4,
  preprocessarTextoVoz,
  aplicarAcentos
};
