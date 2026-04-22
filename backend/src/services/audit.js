/**
 * audit.js — FASE 7
 * Registro LGPD/CFM de acesso a briefings. Retencao 5 anos (regulacao).
 *
 * ZERO dado clinico: so metadado (quem, quando, o que).
 * IP e user-agent sao HASHADOS antes de salvar (pseudonimizacao).
 */
const crypto = require('crypto');
const prisma = require('../utils/prisma');

function hash(s) {
  if (!s) return null;
  // Salt do JWT_SECRET pra hash ser consistente mas nao reversivel de fora
  const salt = (process.env.JWT_SECRET || 'vitae').slice(0, 16);
  return crypto.createHash('sha256').update(salt + String(s)).digest('hex').substring(0, 24);
}

async function registrarAcessoBriefing({ preConsultaId, medicoId, acao, req }) {
  if (!preConsultaId || !medicoId) return;
  try {
    const ip = (req && (req.headers['x-forwarded-for'] || req.ip)) || '';
    const ua = (req && req.headers['user-agent']) || '';
    await prisma.$executeRawUnsafe(
      `INSERT INTO auditoria_briefing (id, pre_consulta_id, medico_id, acao, ip_hash, user_agent_hash)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      crypto.randomUUID(),
      preConsultaId,
      medicoId,
      acao || 'view',
      hash(ip),
      hash(ua)
    );
  } catch (e) {
    // Auditoria falhar nao pode quebrar o fluxo — so registra warning
    console.warn('[AUDIT] falha ao registrar:', e.message);
  }
}

async function registrarRevogacao({ usuarioId, motivo, tokensInvalidados, req }) {
  if (!usuarioId) return;
  try {
    const ip = (req && (req.headers['x-forwarded-for'] || req.ip)) || '';
    const ua = (req && req.headers['user-agent']) || '';
    console.log(JSON.stringify({
      nivel: 'INFO',
      evento: 'revogacao_consentimento',
      usuarioId,
      motivo,
      tokensInvalidados: tokensInvalidados || 0,
      ip_hash: hash(ip),
      ua_hash: hash(ua),
      timestamp: new Date().toISOString(),
    }));
  } catch (_e) {}
}

module.exports = { registrarAcessoBriefing, registrarRevogacao, hash };
