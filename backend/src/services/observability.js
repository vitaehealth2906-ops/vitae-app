/**
 * observability.js — telemetria interna minima viavel
 *
 * 3 camadas:
 * 1. Sentry — captura erros (opcional, so ativa se SENTRY_DSN setado e pacote instalado)
 * 2. Contador de falhas — tracking em memoria de falhas de IA / TTS / Whisper pra alerta
 * 3. Structured log — saida em JSON quando falhas atingem threshold
 *
 * Zero dado clinico nos logs (LGPD).
 */

// ── SENTRY (opcional) ──────────────────────────────────
let Sentry = null;
try {
  if (process.env.SENTRY_DSN) {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1, // 10% das requests, suficiente pra diagnostico
      // Scrub dados sensiveis antes de enviar pro Sentry
      beforeSend(event) {
        // Nunca mandar body/query/headers do request (pode ter dado clinico)
        if (event.request) {
          delete event.request.data;
          delete event.request.query_string;
          delete event.request.cookies;
          if (event.request.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
          }
        }
        return event;
      },
    });
    console.log('[OBSERVABILITY] Sentry ativado');
  }
} catch (e) {
  // Sentry nao instalado ou falhou — segue sem
  Sentry = null;
  if (process.env.SENTRY_DSN) {
    console.warn('[OBSERVABILITY] SENTRY_DSN setado mas @sentry/node nao instalado (npm install @sentry/node)');
  }
}

// ── CONTADOR DE FALHAS EM MEMORIA ──────────────────────
// Resetado ao reiniciar o servidor. Suficiente pra pegar surtos.
const contadores = {
  ia_gemini_falha: 0,
  ia_claude_falha: 0,
  ia_ambos_falharam: 0,
  tts_falha: 0,
  whisper_falha: 0,
  upload_falha: 0,
  ultima_reset: Date.now(),
};

const THRESHOLDS = {
  ia_ambos_falharam: 3, // 3 falhas de ambas IAs = alerta
  tts_falha: 5,
  whisper_falha: 5,
  upload_falha: 10,
};

function reset() {
  Object.keys(contadores).forEach(k => {
    if (k !== 'ultima_reset') contadores[k] = 0;
  });
  contadores.ultima_reset = Date.now();
}

// Reset automatico a cada hora pra nao acumular alertas antigos
setInterval(reset, 60 * 60 * 1000).unref();

/**
 * Registra uma falha. Se atingir threshold, emite alerta estruturado.
 * @param {string} tipo — ia_gemini_falha, ia_claude_falha, tts_falha, whisper_falha, upload_falha
 * @param {object} contexto — sem dados clinicos. Ex: { preConsultaId, motivo: 'rate_limit' }
 */
function registrarFalha(tipo, contexto = {}) {
  if (!(tipo in contadores)) return;
  contadores[tipo] = (contadores[tipo] || 0) + 1;

  // Log estruturado (Railway captura)
  console.warn(JSON.stringify({
    nivel: 'WARN',
    evento: 'falha_registrada',
    tipo,
    contador_atual: contadores[tipo],
    threshold: THRESHOLDS[tipo] || null,
    contexto: sanitizarContexto(contexto),
    timestamp: new Date().toISOString(),
  }));

  // Alerta se threshold atingido
  const threshold = THRESHOLDS[tipo];
  if (threshold && contadores[tipo] === threshold) {
    emitirAlerta(tipo, contadores[tipo], contexto);
  }
}

/**
 * Remove campos que podem ter dado clinico do contexto antes de logar.
 */
function sanitizarContexto(ctx) {
  const BLOQUEADOS = ['queixa', 'respostas', 'transcricao', 'summary', 'cpf', 'email', 'celular', 'nome', 'medicamentos', 'alergias'];
  const limpo = {};
  for (const k in ctx) {
    if (BLOQUEADOS.includes(k.toLowerCase())) continue;
    const v = ctx[k];
    if (typeof v === 'string' && v.length > 100) {
      limpo[k] = '[truncado]';
    } else if (typeof v === 'object') {
      limpo[k] = '[objeto]';
    } else {
      limpo[k] = v;
    }
  }
  return limpo;
}

function emitirAlerta(tipo, contador, contexto) {
  console.error(JSON.stringify({
    nivel: 'ALERTA',
    evento: 'threshold_atingido',
    tipo,
    contador,
    mensagem: `${tipo} atingiu threshold de alerta (${contador} em ~1h)`,
    contexto: sanitizarContexto(contexto),
    timestamp: new Date().toISOString(),
  }));

  // Envia pro Sentry se ativo
  if (Sentry) {
    Sentry.captureMessage(`VITAE alerta: ${tipo} atingiu threshold`, {
      level: 'warning',
      tags: { tipo_alerta: tipo, contador_str: String(contador) },
      extra: sanitizarContexto(contexto),
    });
  }
}

/**
 * Captura excecao nao-tratada — usado no errorHandler.
 */
function capturarExcecao(err, req) {
  if (Sentry) {
    Sentry.withScope(scope => {
      if (req) {
        scope.setTag('method', req.method);
        scope.setTag('path', req.path);
      }
      Sentry.captureException(err);
    });
  }
}

/**
 * Snapshot do estado atual — usado pelo endpoint /admin/observability
 */
function snapshot() {
  return {
    contadores: { ...contadores },
    thresholds: { ...THRESHOLDS },
    uptime_segundos: Math.floor(process.uptime()),
    memoria_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    sentry_ativo: !!Sentry,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  registrarFalha,
  capturarExcecao,
  snapshot,
  reset,
  Sentry, // exposto pro index.js usar handlers se quiser
};
