// CAMADA Z6 — TTS wrap pra V4
// - Pre-processa textoVoz pra TTS falar melhor (datas/numeros/abreviacoes)
// - Chama ElevenLabs (mesmo client da ai.js antiga)
// - Salva no bucket privado em vez do publico
// - Devolve storagePath pro persistencia.js salvar no banco

const { uploadAudioSeguro } = require('./storageSeguro');

/**
 * Pre-processa textoVoz pra que TTS leia melhor:
 * - "8/10" -> "8 de 10"
 * - "20-30 minutos" -> "20 a 30 minutos"
 * - datas DD/MM/AAAA -> dia X de [mes] de AAAA
 * - "PA" -> "pressao arterial"
 * - "FC" -> "frequencia cardiaca"
 * - "SatO2" -> "saturacao de oxigenio"
 * - "ECG" -> "eletrocardiograma"
 */
function preprocessarTextoVoz(texto) {
  if (!texto) return '';
  let t = texto;

  // Escalas tipo "8/10" ou "8 / 10"
  t = t.replace(/(\d+)\s*\/\s*10\b/g, '$1 de 10');

  // Intervalos com hifen "20-30 minutos"
  t = t.replace(/(\d+)\s*-\s*(\d+)\s*(minutos?|horas?|dias?|semanas?|meses)/gi, '$1 a $2 $3');

  // Datas DD/MM/AAAA pra extenso curto
  const meses = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
                 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  t = t.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g, (_, d, m, a) => {
    const mes = meses[parseInt(m, 10) - 1] || m;
    return `${parseInt(d, 10)} de ${mes} de ${a}`;
  });

  // Abreviacoes clinicas
  const abrev = [
    [/\bPA\b/g, 'pressao arterial'],
    [/\bFC\b/g, 'frequencia cardiaca'],
    [/\bFR\b/g, 'frequencia respiratoria'],
    [/\bSatO2\b/gi, 'saturacao de oxigenio'],
    [/\bECG\b/g, 'eletrocardiograma'],
    [/\bRX\b/g, 'raio X'],
    [/\bRM\b/g, 'ressonancia magnetica'],
    [/\bTC\b/g, 'tomografia'],
    [/\bHF\b/g, 'historico familiar'],
    [/\bHPP\b/g, 'historico patologico pregresso'],
    [/\bIMC\b/g, 'indice de massa corporal'],
    [/\bDUM\b/g, 'data da ultima menstruacao']
  ];
  for (const [re, repl] of abrev) t = t.replace(re, repl);

  // Tira mg de medicamentos -> "miligramas" (opcional, fica mais natural)
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
 * Gera TTS V4 a partir do textoVoz, salva em bucket privado, devolve storagePath.
 */
async function gerarTTSV4({ textoVoz, preConsultaId }) {
  const textoTTS = preprocessarTextoVoz(textoVoz);
  const buffer = await chamarElevenLabs(textoTTS);
  const fileName = `${Date.now()}-tts-v4-${preConsultaId}.mp3`;
  const { storagePath, bucket } = await uploadAudioSeguro({
    buffer,
    fileName,
    contentType: 'audio/mpeg'
  });
  return {
    storagePath,
    bucket,
    bytes: buffer.length,
    textoTTSProcessado: textoTTS
  };
}

module.exports = {
  gerarTTSV4,
  preprocessarTextoVoz
};
