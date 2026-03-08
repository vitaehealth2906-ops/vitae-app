const jwt = require('jsonwebtoken');

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

/**
 * Middleware de autenticacao obrigatoria.
 * Rejeita a requisicao com 401 se o token for ausente ou invalido.
 * Anexa { id, email } em req.user.
 */
function verificarAuth(req, res, next) {
  try {
    const decoded = extrairToken(req);
    if (!decoded) {
      return res.status(401).json({ erro: 'Token de autenticacao nao fornecido.' });
    }
    req.user = { id: decoded.id, email: decoded.email };
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
