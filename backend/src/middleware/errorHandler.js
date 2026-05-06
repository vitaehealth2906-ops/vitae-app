const { Prisma } = require('@prisma/client');
const { ZodError } = require('zod');
const { capturarExcecao } = require('../services/observability');

/**
 * Mapeia codigos de erro conhecidos do Prisma para status HTTP e mensagens em portugues.
 */
const PRISMA_ERROR_MAP = {
  P2002: { status: 409, mensagem: 'Registro duplicado. Esse dado ja existe no sistema.' },
  P2025: { status: 404, mensagem: 'Registro nao encontrado.' },
  P2003: { status: 400, mensagem: 'Referencia invalida. O registro relacionado nao existe.' },
  P2014: { status: 400, mensagem: 'Operacao viola uma restricao de integridade.' },
};

/**
 * Middleware global de tratamento de erros.
 * Deve ser registrado como o ultimo middleware no Express.
 */
const isDev = process.env.NODE_ENV === 'development';

function errorHandler(err, req, res, _next) {
  // --- Log sempre (Railway captura stderr) — NUNCA logar payload/body/query ---
  // req.body/query pode conter dados clinicos (queixa, medicamentos, CPF). LGPD.
  console.error(`[ERROR] ${req.method} ${req.originalUrl} — ${err.message}`);
  if (isDev) {
    console.error(err.stack);
  }

  // --- Erros do Prisma (PrismaClientKnownRequestError) ---
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // em dev: loga code+meta. em prod: so code (meta pode ter valores do usuario).
    console.error('[PRISMA_CODE]', err.code);
    if (isDev) console.error('[PRISMA_META]', JSON.stringify(err.meta || {}));
    const mapped = PRISMA_ERROR_MAP[err.code];
    if (mapped) {
      return res.status(mapped.status).json({ erro: mapped.mensagem });
    }
    const body = { erro: 'Erro no banco de dados.' };
    if (isDev) {
      body.debug_code = err.code;
      body.debug_meta = err.meta;
      body.debug_message = err.message ? err.message.substring(0, 500) : null;
    }
    return res.status(400).json(body);
  }

  // --- Erros de validacao do Prisma ---
  if (err instanceof Prisma.PrismaClientValidationError) {
    if (isDev) console.error('[PRISMA_VALIDATION]', err.message);
    const body = { erro: 'Dados invalidos enviados ao banco de dados.' };
    if (isDev && err.message) body.debug_message = err.message.substring(0, 800);
    return res.status(400).json(body);
  }

  // --- Erros de inicializacao do Prisma (DB down, schema mismatch) ---
  if (err instanceof Prisma.PrismaClientInitializationError || err instanceof Prisma.PrismaClientUnknownRequestError) {
    console.error('[PRISMA_INIT_OR_UNKNOWN]', err.message);
    const body = { erro: 'Banco de dados indisponivel ou fora de sincronia.' };
    if (isDev && err.message) body.debug_message = err.message.substring(0, 800);
    return res.status(500).json(body);
  }

  // --- Erros do JWT ---
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ erro: 'Token expirado. Faca login novamente.' });
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
    return res.status(401).json({ erro: 'Token de autenticacao invalido.' });
  }

  // --- Erros do Zod ---
  if (err instanceof ZodError) {
    const detalhes = err.errors.map((e) => {
      const campo = e.path.length > 0 ? e.path.join('.') : 'valor';
      return `${campo}: ${e.message}`;
    });
    return res.status(400).json({
      erro: 'Dados invalidos. Verifique os campos e tente novamente.',
      detalhes,
    });
  }

  // --- Erros com status personalizado (throw com statusCode) ---
  if (err.statusCode && typeof err.statusCode === 'number') {
    return res.status(err.statusCode).json({ erro: err.message || 'Erro na requisicao.' });
  }

  // --- Qualquer outro erro → 500 — captura no Sentry se ativo ---
  try { capturarExcecao(err, req); } catch (_e) { /* nunca deixar observabilidade quebrar handler */ }
  return res.status(500).json({ erro: 'Erro interno do servidor. Tente novamente mais tarde.' });
}

module.exports = { errorHandler };
