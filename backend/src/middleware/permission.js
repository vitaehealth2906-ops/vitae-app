// Middleware RBAC pra modulo Agenda v1.
// Roda DEPOIS de verificarAuth e enriquece req.user com:
//   role:          'MEDICO' | 'PACIENTE' | 'SECRETARIA'
//   medicoId:      id do Medico se role=MEDICO
//   acessaMedicoId: lista de medicoIds que a secretaria tem permissao
//   permissoes:    permissoes da secretaria (CSV)
//
// Padrao copiado do que ja existe no projeto + ISO 14971 (zero confianca: bloqueia por default)

const prisma = require('../utils/prisma');

// Cache 60s pra reduzir queries (pattern do auth.js)
let roleCache = new Map();
const ROLE_TTL_MS = 60 * 1000;

async function carregarRole(usuarioId) {
  const agora = Date.now();
  const cached = roleCache.get(usuarioId);
  if (cached && cached.expira > agora) return cached.dados;

  // 1. Busca usuario base
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, tipo: true, email: true },
  });
  if (!usuario) return null;

  // 2. Se tipo=MEDICO, busca Medico vinculado
  let medicoId = null;
  if (usuario.tipo === 'MEDICO') {
    try {
      const med = await prisma.medico.findUnique({
        where: { usuarioId },
        select: { id: true, ativo: true },
      });
      if (med && med.ativo) medicoId = med.id;
    } catch (_e) { /* tabela ok mas sem registro */ }
  }

  // 3. Busca SecretariaVinculo ativos (pode ser PACIENTE com vinculo de secretaria)
  let vinculos = [];
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, medico_id, permissoes FROM secretaria_vinculos
       WHERE usuario_id = $1 AND ativo = true AND aceito_em IS NOT NULL
         AND (revogado_em IS NULL OR revogado_em > NOW())`,
      usuarioId
    );
    vinculos = Array.isArray(rows) ? rows : [];
  } catch (_e) {
    // Tabela ainda nao criada (boot inicial), tudo bem
  }

  // 4. Determina role efetivo
  // Prioridade: MEDICO > SECRETARIA > PACIENTE
  let role = 'PACIENTE';
  if (medicoId) role = 'MEDICO';
  else if (vinculos.length > 0) role = 'SECRETARIA';

  const dados = {
    role,
    medicoId,
    acessaMedicoId: vinculos.map(v => v.medico_id),
    permissoesPorMedico: Object.fromEntries(
      vinculos.map(v => [v.medico_id, (v.permissoes || '').split(',').map(s => s.trim())])
    ),
  };

  roleCache.set(usuarioId, { dados, expira: agora + ROLE_TTL_MS });
  if (roleCache.size > 1000) roleCache = new Map();
  return dados;
}

// Middleware basico: enriquece req.user com role + medicoId + permissoes
async function carregarPermissoes(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ ok: false, code: 'AUTH_REQUIRED', message: 'Login necessario.' });
    }
    const dados = await carregarRole(req.user.id);
    if (!dados) {
      return res.status(401).json({ ok: false, code: 'USER_NOT_FOUND', message: 'Usuario nao encontrado.' });
    }
    Object.assign(req.user, dados);
    next();
  } catch (err) {
    next(err);
  }
}

// Middleware exigir MEDICO (rejeita secretaria + paciente)
function medicoOnly(req, res, next) {
  if (!req.user || req.user.role !== 'MEDICO') {
    return res.status(403).json({ ok: false, code: 'MEDICO_ONLY', message: 'Apenas medicos podem fazer essa acao.' });
  }
  next();
}

// Middleware exigir MEDICO ou SECRETARIA com permissao especifica em medicoId
// Uso: medicoOuSecretariaCom('AGENDA_ESCREVER')(req,res,next)
// Espera req.params.medicoId OU req.body.medicoId OU usa req.user.medicoId (proprio medico)
function medicoOuSecretariaCom(permissaoNecessaria) {
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ ok: false, code: 'AUTH_REQUIRED' });

    const targetMedicoId =
      req.params.medicoId ||
      req.body?.medicoId ||
      req.query?.medicoId ||
      req.user.medicoId; // medico operando sobre si mesmo

    if (!targetMedicoId) {
      return res.status(400).json({ ok: false, code: 'MEDICO_ID_REQUIRED', message: 'medicoId ausente no contexto.' });
    }

    // Medico operando sobre proprio dado: liberado
    if (req.user.role === 'MEDICO' && req.user.medicoId === targetMedicoId) {
      return next();
    }

    // Secretaria com vinculo ativo + permissao adequada
    if (req.user.role === 'SECRETARIA') {
      const perms = req.user.permissoesPorMedico?.[targetMedicoId] || [];
      if (perms.includes(permissaoNecessaria)) {
        return next();
      }
      return res.status(403).json({
        ok: false,
        code: 'SECRETARIA_SEM_PERMISSAO',
        message: `Voce nao tem a permissao "${permissaoNecessaria}" pra essa agenda.`,
      });
    }

    return res.status(403).json({ ok: false, code: 'ACESSO_NEGADO', message: 'Sem acesso a esta agenda.' });
  };
}

// Middleware exigir PACIENTE (paciente acessando seus proprios slots)
function pacienteOnly(req, res, next) {
  if (!req.user || req.user.role !== 'PACIENTE') {
    return res.status(403).json({ ok: false, code: 'PACIENTE_ONLY', message: 'Apenas pacientes podem fazer essa acao.' });
  }
  next();
}

// Middleware bloqueia secretaria de acessar dados clinicos
// Uso em rotas /pre-consulta/:id/respostas, /exames, /medicamentos, /alergias, /condicoes
function bloquearSecretariaParaClinico(req, res, next) {
  if (req.user && req.user.role === 'SECRETARIA') {
    return res.status(403).json({
      ok: false,
      code: 'SECRETARIA_BLOQUEADA_CLINICO',
      message: 'Secretarias nao podem acessar dados clinicos do paciente (LGPD).',
    });
  }
  next();
}

// Limpa cache de um usuario especifico (usar quando vinculo de secretaria muda)
function invalidarCache(usuarioId) {
  if (usuarioId) roleCache.delete(usuarioId);
  else roleCache = new Map();
}

module.exports = {
  carregarPermissoes,
  medicoOnly,
  medicoOuSecretariaCom,
  pacienteOnly,
  bloquearSecretariaParaClinico,
  invalidarCache,
};
