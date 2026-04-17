// ============================================================
// Auditoria de acesso a dados sensiveis (LGPD compliance)
// ============================================================
//
// Registra QUEM acessou QUAL dado, QUANDO e DE ONDE.
// Nao bloqueante (fire-and-forget) — falha de log nao quebra a request.
//
// Uso:
//   const { auditar } = require('../utils/auditoria');
//   await auditar(req, {
//     acao: 'VIEW_PACIENTE',
//     recursoTipo: 'PACIENTE',
//     recursoId: pacienteId,
//     alvoId: pacienteId,
//     atorTipo: 'MEDICO',
//   });

const prisma = require('./prisma');

function extrairIp(req) {
  if (!req) return null;
  const xff = req.headers && req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.ip || null;
}

function extrairUserAgent(req) {
  if (!req || !req.headers) return null;
  return req.headers['user-agent'] || null;
}

async function auditar(req, dados) {
  try {
    const atorId = (req && req.usuario && req.usuario.id) || dados.atorId || null;
    await prisma.auditoriaAcesso.create({
      data: {
        atorId,
        atorTipo: dados.atorTipo || 'PUBLICO',
        acao: dados.acao,
        recursoTipo: dados.recursoTipo || null,
        recursoId: dados.recursoId || null,
        alvoId: dados.alvoId || null,
        ipAddress: extrairIp(req),
        userAgent: extrairUserAgent(req),
        metadata: dados.metadata || null,
      },
    });
  } catch (err) {
    // Auditoria nunca quebra a request — apenas loga
    console.error('[AUDITORIA] falha ao registrar:', err.message);
  }
}

module.exports = { auditar };
