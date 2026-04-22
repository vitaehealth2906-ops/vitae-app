/**
 * briefing.js — FASE 3
 *
 * Camada intermediaria entre o worker e a IA.
 *
 * 3 responsabilidades:
 * 1. VALIDAR cada peca honestamente (foto, audio, transcricao, queixa)
 * 2. CHAMAR a IA em 3 pecas separadas (queixa fiel + alertas + texto voz) em paralelo
 * 3. CALCULAR nivel de briefing 0-5 baseado no que sobreviveu
 */

const { gerarSummaryPreConsulta } = require('./ai');

// ──────────────────────────────────────────────────────
// VALIDADORES — criterio real, nao so "existe ou nao"
// ──────────────────────────────────────────────────────

/**
 * Transcricao valida: existe, tem conteudo real, nao e placeholder de erro.
 */
function validarTranscricao(transcricao) {
  if (!transcricao || typeof transcricao !== 'string') return { ok: false, motivo: 'ausente' };
  const limpa = transcricao.trim();
  if (limpa.length < 15) return { ok: false, motivo: 'muito_curta' };
  const lower = limpa.toLowerCase();
  // Placeholders comuns de Whisper quando falha
  const placeholders = ['(áudio sem transcrição)', 'audio sem transcricao', '(sem transcrição)', '(inaudível)', '[inaudivel]'];
  if (placeholders.some(p => lower.includes(p))) return { ok: false, motivo: 'placeholder_erro' };
  // Deteccao bruta de lixo repetitivo ("aaaaa", "ababab")
  const unicos = new Set(limpa.replace(/\s+/g, '').slice(0, 50).toLowerCase().split(''));
  if (unicos.size < 4) return { ok: false, motivo: 'lixo_repetitivo' };
  return { ok: true };
}

/**
 * Foto valida: URL existe e nao e vazia/data-url-vazia.
 */
function validarFoto(fotoUrl) {
  if (!fotoUrl || typeof fotoUrl !== 'string') return { ok: false, motivo: 'ausente' };
  const s = fotoUrl.trim();
  if (s.length < 10) return { ok: false, motivo: 'curta_demais' };
  if (s === 'data:,' || s === 'data:') return { ok: false, motivo: 'data_url_vazia' };
  return { ok: true };
}

/**
 * Audio valido: URL existe. Validacao de silencio/duracao fica com Whisper
 * (se ele transcreve nada, a transcricao vira invalida).
 */
function validarAudio(audioUrl) {
  if (!audioUrl || typeof audioUrl !== 'string') return { ok: false, motivo: 'ausente' };
  if (audioUrl.trim().length < 10) return { ok: false, motivo: 'curta_demais' };
  return { ok: true };
}

/**
 * Queixa valida: existe no respostas do paciente, com texto minimo.
 */
function validarQueixa(respostas) {
  if (!respostas) return { ok: false, motivo: 'sem_respostas' };
  const q = (respostas.queixaPrincipal || respostas.queixa || respostas.motivoConsulta || '').trim();
  if (!q) return { ok: false, motivo: 'vazia' };
  if (q.length < 5) return { ok: false, motivo: 'muito_curta' };
  return { ok: true, texto: q };
}

// ──────────────────────────────────────────────────────
// CALCULO DE NIVEL
// ──────────────────────────────────────────────────────

/**
 * Calcula nivel 0-5 baseado no que sobreviveu.
 *
 * 5 — foto OK + audio OK + transcricao OK + resumo IA OK + TTS OK
 * 4 — tudo menos TTS (voz da IA falhou)
 * 3 — transcricao OK + queixa OK mas IA falhou
 * 2 — so audio bruto (transcricao falhou)
 * 1 — so texto (sem audio)
 * 0 — nada respondido
 */
function calcularNivel(status) {
  const fotoOk = status.statusFoto === 'ok';
  const audioOk = status.statusAudio === 'ok';
  const transcOk = status.statusTranscricao === 'ok';
  const resumoOk = status.statusResumoIa === 'ok' || status.statusResumoIa === 'parcial';
  const ttsOk = status.statusAudioResumo === 'ok';

  // 0: nao respondeu
  if (!audioOk && !status.temTexto && !fotoOk) return 0;

  // 5: tudo OK
  if (audioOk && transcOk && resumoOk && ttsOk) return 5;

  // 4: tudo menos TTS
  if (audioOk && transcOk && resumoOk && !ttsOk) return 4;

  // 3: transcricao OK mas IA falhou
  if (audioOk && transcOk && !resumoOk) return 3;

  // 2: audio OK mas transcricao falhou
  if (audioOk && !transcOk) return 2;

  // 1: sem audio, so texto
  if (!audioOk && status.temTexto) return 1;

  return 0;
}

// ──────────────────────────────────────────────────────
// IA EM PECAS
// ──────────────────────────────────────────────────────

/**
 * Wrapper que chama a IA atual (gerarSummaryPreConsulta) dentro de um Promise.race
 * com timeout explicito — protege worker de travar se IA ficar pendurada.
 *
 * Futuro (quando fase 3 amadurecer): quebrar em 3 chamadas separadas pro Gemini/Claude
 * — queixa fiel (curta), alertas (json curto), texto voz (narracao).
 * Por enquanto, a gerarSummaryPreConsulta ja existente faz as 3 num JSON so.
 * O ganho vem da validacao explicita do resultado (abaixo).
 */
async function gerarResumoComValidacao({ pacienteNome, respostas, transcricao, templatePerguntas, timeoutMs = 45000 }) {
  const geracao = gerarSummaryPreConsulta(pacienteNome, respostas, transcricao, templatePerguntas);
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('IA timeout')), timeoutMs));
  const resultado = await Promise.race([geracao, timeout]);

  // Valida o que sobreviveu
  const validacao = validarResultadoIA(resultado);
  return { resultado, validacao };
}

/**
 * Verifica se o resultado da IA esta utilizavel.
 * - textoVoz precisa existir e ter >100 chars (briefing falado minimo)
 * - summaryTexto OU blocos OU alertas devem existir
 * - Retorna { ok, motivo, nivel: 'ok'|'parcial'|'falhou' }
 */
function validarResultadoIA(resultado) {
  if (!resultado || typeof resultado !== 'object') {
    return { ok: false, nivel: 'falhou', motivo: 'resposta_vazia' };
  }
  const textoVoz = (resultado.textoVoz || '').trim();
  const summaryTexto = (resultado.summaryTexto || '').trim();
  const temBlocos = Array.isArray(resultado.blocos) && resultado.blocos.length > 0;
  const temAlertas = Array.isArray(resultado.alertas) && resultado.alertas.length > 0;

  if (textoVoz.length >= 100 && (summaryTexto || temBlocos)) {
    return { ok: true, nivel: 'ok' };
  }
  if (summaryTexto || textoVoz.length >= 50 || temBlocos || temAlertas) {
    return { ok: true, nivel: 'parcial', motivo: 'resultado_incompleto' };
  }
  return { ok: false, nivel: 'falhou', motivo: 'sem_conteudo_util' };
}

module.exports = {
  validarTranscricao,
  validarFoto,
  validarAudio,
  validarQueixa,
  calcularNivel,
  gerarResumoComValidacao,
  validarResultadoIA,
};
