/**
 * trackerMedico.js — middleware que captura comportamento do medico
 *
 * Roda DEPOIS do auth (precisa de req.user pra saber o id).
 * Fire-and-forget no res.on('finish') — zero impacto na latencia da resposta.
 * So registra eventos pra usuarios tipo MEDICO (cacheado em memoria).
 *
 * Ignora rotas administrativas/sistema/publicas.
 */

const {
  registrarEventoMedico,
  ehMedico,
  hashIp,
  curtarUserAgent,
  inferirTipoEvento,
} = require('../services/eventosMedico');

// Rotas que NUNCA tracketamos (admin/sistema/publicas)
const ROTAS_IGNORADAS = [
  '/admin',
  '/health',
  '/healthz',
  '/favicon.ico',
  '/audit/view-cached', // audit interna, ja tem registro proprio
  '/empresa',           // painel do gestor (tipo EMPRESA) — nunca gera evento de medico
];

function deveIgnorar(url) {
  if (!url) return true;
  const u = String(url).toLowerCase();
  return ROTAS_IGNORADAS.some(r => u.startsWith(r));
}

function trackerMedico(req, res, next) {
  // Bypass total se nao tem req.user (rota publica)
  if (!req.user || !req.user.id) return next();
  if (deveIgnorar(req.originalUrl || req.url)) return next();

  const inicio = Date.now();
  const metodo = req.method;
  const url = req.originalUrl || req.url || '';
  const rotaLimpa = url.split('?')[0]; // sem query string
  const userId = req.user.id;

  // Tenta inferir tipo do evento ANTES (rapido — so regex)
  const inferido = inferirTipoEvento(metodo, rotaLimpa, req.params || {});
  if (!inferido) return next(); // rota nao mapeada, ignora

  // Captura metadados imediatos (rotas reais)
  const ipRaw = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  const ipHash = hashIp(ipRaw);
  const ua = curtarUserAgent(req.headers['user-agent']);

  res.on('finish', () => {
    const duracaoMs = Date.now() - inicio;
    const status = res.statusCode;

    // Verifica se e medico (assincrono, cacheado)
    ehMedico(userId)
      .then(isMedico => {
        if (!isMedico) return;
        registrarEventoMedico({
          medicoId: userId,
          tipo: inferido.tipo,
          recursoTipo: inferido.recursoTipo || null,
          recursoId: inferido.recursoId || null,
          rota: `${metodo} ${rotaLimpa}`,
          metodo,
          payload: null, // nao logar payload por padrao (PII risk)
          ipHash,
          userAgent: ua,
          duracaoMs,
          status,
        });
      })
      .catch(() => { /* nunca quebra */ });
  });

  next();
}

module.exports = trackerMedico;
