const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

/**
 * Extrai e decodifica o Bearer token do header Authorization.
 * Retorna o payload decodificado ou null se ausente/invalido.
 */
function extrairToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    return null;
  }
  return jwt.verify(token, process.env.JWT_SECRET);
}

// FASE 7 — Cache de JWTs revogados (1 min TTL) pra evitar query no DB a cada request
let revocationCache = new Map();
const REVOCATION_TTL_MS = 60 * 1000;

async function tokenRevogado(jti) {
  if (!jti) return false;
  const agora = Date.now();
  const cached = revocationCache.get(jti);
  if (cached && cached.expira > agora) return cached.revogado;
  try {
    const row = await prisma.$queryRawUnsafe(
      `SELECT jti FROM jwt_revogados WHERE jti = $1 AND expira_em > NOW() LIMIT 1`,
      jti
    );
    const revogado = Array.isArray(row) && row.length > 0;
    revocationCache.set(jti, { revogado, expira: agora + REVOCATION_TTL_MS });
    // Limpa cache se crescer muito
    if (revocationCache.size > 1000) revocationCache = new Map();
    return revogado;
  } catch (_e) {
    // Se tabela nao existir ainda (migration nao rodou), nao bloqueia requests
    return false;
  }
}

/**
 * Middleware de autenticacao obrigatoria.
 * Rejeita a requisicao com 401 se o token for ausente ou invalido.
 * Anexa { id, email } em req.user.
 */
async function verificarAuth(req, res, next) {
  try {
    const decoded = extrairToken(req);
    if (!decoded) {
      return res.status(401).json({ erro: 'Token de autenticacao nao fornecido.' });
    }
    // FASE 7 — Check revocation list (LGPD: revogar consentimento = revogar token)
    if (decoded.jti && await tokenRevogado(decoded.jti)) {
      return res.status(401).json({ erro: 'Sessao revogada. Faca login novamente.' });
    }
    req.user = { id: decoded.id, email: decoded.email, jti: decoded.jti };
    req.usuario = req.user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ erro: 'Token expirado. Faca login novamente.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ erro: 'Token invalido.' });
    }
    next(err);
  }
}

/**
 * Middleware de autenticacao opcional.
 * Nao rejeita a requisicao se o token estiver ausente — apenas define req.user como null.
 * Util para rotas que funcionam com ou sem autenticacao.
 */
function authOpcional(req, res, next) {
  try {
    const decoded = extrairToken(req);
    req.user = decoded ? { id: decoded.id, email: decoded.email } : null;
    req.usuario = req.user;
    next();
  } catch {
    req.user = null;
    next();
  }
}

module.exports = { verificarAuth, authOpcional };
