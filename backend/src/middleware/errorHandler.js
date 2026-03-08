const { Prisma } = require('@prisma/client');
const { ZodError } = require('zod');

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
function errorHandler(err, req, res, _next) {
  // --- Log em desenvolvimento ---
  if (process.env.NODE_ENV === 'development') {
    console.error('--- ERRO ---');
    console.error('Rota:', req.method, req.originalUrl);
    console.error(err);
    console.error('------------');
  }

  // --- Erros do Prisma (PrismaClientKnownRequestError) ---
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = PRISMA_ERROR_MAP[err.code];
    if (mapped) {
      return res.status(mapped.status).json({ erro: mapped.mensagem });
    }
    return res.status(400).json({ erro: 'Erro no banco de dados.' });
  }

  // --- Erros de validacao do Prisma ---
  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ erro: 'Dados invalidos enviados ao banco de dados.' });
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

  // --- Qualquer outro erro → 500 ---
  return res.status(500).json({ erro: 'Erro interno do servidor. Tente novamente mais tarde.' });
}

module.exports = { errorHandler };
