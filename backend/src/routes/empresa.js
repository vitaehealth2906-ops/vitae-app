// ============================================================
// Fundacao B2B — Empresas (dono cria empresa, convida funcionarios)
//
// Link de convite REUTILIZAVEL: 1 link serve pro time todo. Cada funcionario
// que abre cria a PROPRIA etiqueta (VinculoEmpresa), idempotente via
// @@unique([empresaId, pacienteId]). Rastreio: cada etiqueta guarda QUEM
// (pacienteId), QUANDO (entrouEm) e POR QUAL LINK (conviteId) a pessoa veio.
//
// TODO (borda conhecida): funcionario que JA tem conta + perfil pronto nao
// passa pelo quiz, entao a colagem nao roda automatica. Mitigacao futura:
// chamar vincularEmpresa no boot de 01-saude.html quando
// localStorage.vitae_convite_empresa existir.
// ============================================================

const express = require('express');
const crypto = require('crypto');
const prisma = require('../utils/prisma');
const { verificarAuth } = require('../middleware/auth');
const { auditar } = require('../utils/auditoria');

const router = express.Router();

// Guarda defensiva: se as tabelas B2B ainda nao existem (migration nao rodou),
// responde 503 gracioso em vez de 500. Espelha o guard P2021/P2022 do projeto.
function _moduloIndisponivel(err, res) {
  if (err && (err.code === 'P2021' || err.code === 'P2022')) {
    res.status(503).json({ erro: 'Modulo Empresas indisponivel no momento. Tente mais tarde.' });
    return true;
  }
  return false;
}

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://vitae-app.vercel.app';

// Acha a empresa do dono logado (1 dono = 1 empresa por enquanto; pega a mais antiga).
async function _empresaDoDono(req) {
  return prisma.empresa.findFirst({
    where: { donoId: req.usuario.id },
    orderBy: { criadoEm: 'asc' },
  });
}

// Idade em anos a partir da data de nascimento (null se faltar/invalida).
function _idade(dataNascimento) {
  if (!dataNascimento) return null;
  const d = new Date(dataNascimento);
  if (isNaN(d.getTime())) return null;
  const h = new Date();
  let i = h.getFullYear() - d.getFullYear();
  const m = h.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && h.getDate() < d.getDate())) i--;
  return i;
}

// ---------------------------------------------------------------------------
// GET /convite/:token — Valida convite (PUBLICO, sem auth)
// Antes do router.use(verificarAuth) pra nao exigir login.
// ---------------------------------------------------------------------------

router.get('/convite/:token', async (req, res, next) => {
  try {
    const convite = await prisma.conviteEmpresa.findUnique({
      where: { token: req.params.token },
      include: { empresa: true },
    });

    if (!convite || !convite.empresa) {
      return res.status(404).json({ erro: 'Convite nao encontrado' });
    }
    if (!convite.ativo) {
      return res.status(410).json({ erro: 'Convite desativado' });
    }
    if (convite.expiraEm && convite.expiraEm < new Date()) {
      return res.status(410).json({ erro: 'Convite expirado' });
    }
    if (convite.empresa.status !== 'ATIVA') {
      return res.status(410).json({ erro: 'Empresa indisponivel' });
    }

    return res.status(200).json({ empresaNome: convite.empresa.nome });
  } catch (err) {
    if (_moduloIndisponivel(err, res)) return;
    next(err);
  }
});

// Todas as rotas abaixo requerem autenticacao
router.use(verificarAuth);

// ---------------------------------------------------------------------------
// POST / — Cria empresa + promove o tipo do dono (sem rebaixar medico)
// ---------------------------------------------------------------------------

router.post('/', async (req, res, next) => {
  try {
    const { nome, cnpj, tipo, quantidade } = req.body || {};
    if (!nome || String(nome).trim().length < 2) {
      return res.status(400).json({ erro: 'Nome da empresa obrigatorio' });
    }

    const empresa = await prisma.empresa.create({
      data: {
        nome: String(nome).trim(),
        cnpj: cnpj || null,
        donoId: req.usuario.id,
        tipo: tipo || null,
        quantidade: Number.isFinite(+quantidade) ? parseInt(quantidade, 10) : null,
      },
    });

    // Promove pra EMPRESA SEM rebaixar quem ja e MEDICO.
    await prisma.usuario.updateMany({
      where: { id: req.usuario.id, tipo: { in: ['PACIENTE', 'PENDENTE'] } },
      data: { tipo: 'EMPRESA' },
    });

    auditar(req, {
      acao: 'CRIAR_EMPRESA',
      atorTipo: 'EMPRESA',
      recursoTipo: 'EMPRESA',
      recursoId: empresa.id,
    });

    return res.status(201).json({ empresa });
  } catch (err) {
    if (_moduloIndisponivel(err, res)) return;
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /convite — Dono pega o link REUTILIZAVEL da empresa (cria se nao existe)
// Body opcional: { novo: true, label: "Grupo WhatsApp" } pra gerar um link extra (rastreio de origem).
// ---------------------------------------------------------------------------

router.post('/convite', async (req, res, next) => {
  try {
    const { novo, label } = req.body || {};
    const empresa = await prisma.empresa.findFirst({
      where: { donoId: req.usuario.id },
      orderBy: { criadoEm: 'asc' },
    });
    if (!empresa) {
      return res.status(404).json({ erro: 'Voce ainda nao tem uma empresa' });
    }

    // 1 link reutilizavel por empresa: reaproveita o ativo (a menos que peca um novo).
    let convite = null;
    if (!novo) {
      convite = await prisma.conviteEmpresa.findFirst({
        where: { empresaId: empresa.id, ativo: true },
        orderBy: { criadoEm: 'desc' },
      });
    }
    if (!convite) {
      convite = await prisma.conviteEmpresa.create({
        data: {
          empresaId: empresa.id,
          token: crypto.randomBytes(24).toString('hex'),
          label: label ? String(label).slice(0, 60) : null,
          ativo: true,
        },
      });
    }

    const link = `${FRONTEND_URL}/app-v3/convite.html?c=${convite.token}`;

    auditar(req, {
      acao: 'GERAR_CONVITE_EMPRESA',
      atorTipo: 'EMPRESA',
      recursoTipo: 'EMPRESA',
      recursoId: empresa.id,
    });

    return res.status(201).json({ token: convite.token, link, label: convite.label || null });
  } catch (err) {
    if (_moduloIndisponivel(err, res)) return;
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /vincular — Funcionario cola a PROPRIA etiqueta (REUTILIZAVEL + IDEMPOTENTE)
// O mesmo link serve pra varios funcionarios. Guarda o rastreio (conviteId, entrouEm).
// ---------------------------------------------------------------------------

router.post('/vincular', async (req, res, next) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ erro: 'token obrigatorio' });

    const convite = await prisma.conviteEmpresa.findUnique({ where: { token } });
    if (!convite) return res.status(404).json({ erro: 'Convite nao encontrado' });
    if (!convite.ativo) return res.status(410).json({ erro: 'Convite desativado' });
    if (convite.expiraEm && convite.expiraEm < new Date()) {
      return res.status(410).json({ erro: 'Convite expirado' });
    }

    // Ja e membro dessa empresa? Idempotente (nao duplica; reativa se tinha saido).
    const ja = await prisma.vinculoEmpresa.findFirst({
      where: { empresaId: convite.empresaId, pacienteId: req.usuario.id },
    });
    if (ja) {
      if (ja.status !== 'ATIVO') {
        await prisma.vinculoEmpresa.update({
          where: { id: ja.id },
          data: { status: 'ATIVO', entrouEm: ja.entrouEm || new Date(), saiuEm: null, conviteId: convite.id },
        });
      }
      return res.status(200).json({ duplicate: true });
    }

    await prisma.vinculoEmpresa.create({
      data: {
        empresaId: convite.empresaId,
        pacienteId: req.usuario.id,
        conviteId: convite.id,
        status: 'ATIVO',
        entrouEm: new Date(),
      },
    });

    auditar(req, {
      acao: 'VINCULAR_EMPRESA',
      atorTipo: 'PACIENTE',
      recursoTipo: 'EMPRESA',
      recursoId: convite.empresaId,
    });

    return res.status(200).json({ vinculado: true });
  } catch (err) {
    // Corrida de 2 requests do mesmo paciente: @@unique([empresaId, pacienteId]) -> P2002.
    if (err && err.code === 'P2002') return res.status(200).json({ duplicate: true });
    if (_moduloIndisponivel(err, res)) return;
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /me — Dono ve a empresa + contagem de funcionarios ativos
// NENHUM dado individual de funcionario. (A lista detalhada fica pro painel.)
// ---------------------------------------------------------------------------

router.get('/me', async (req, res, next) => {
  try {
    const empresa = await prisma.empresa.findFirst({
      where: { donoId: req.usuario.id },
      orderBy: { criadoEm: 'asc' },
    });
    if (!empresa) {
      return res.status(200).json({ empresa: null, funcionariosAtivos: 0 });
    }

    const funcionariosAtivos = await prisma.vinculoEmpresa.count({
      where: { empresaId: empresa.id, status: 'ATIVO' },
    });

    // Metrica do painel (decisao Lucas): conta so quem JA PREENCHEU o RG
    // (tem data de nascimento no perfil), nao so quem entrou no time.
    const comRgPreenchido = await prisma.vinculoEmpresa.count({
      where: {
        empresaId: empresa.id,
        status: 'ATIVO',
        paciente: { perfilSaude: { dataNascimento: { not: null } } },
      },
    });

    return res.status(200).json({ empresa, funcionariosAtivos, comRgPreenchido });
  } catch (err) {
    if (_moduloIndisponivel(err, res)) return;
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /membros — Lista PAGINADA + busca por nome (painel do gestor)
// Leve de proposito (so o essencial da linha). Paginacao por CURSOR pra escalar
// pra milhares de membros. Query: ?q=nome&limit=50&cursor=<vinculoId>
// ---------------------------------------------------------------------------

router.get('/membros', async (req, res, next) => {
  try {
    const empresa = await _empresaDoDono(req);
    if (!empresa) return res.status(404).json({ erro: 'Voce ainda nao tem uma empresa' });

    const q = String(req.query.q || '').trim();
    let limit = parseInt(req.query.limit, 10);
    if (!Number.isFinite(limit) || limit < 1) limit = 50;
    if (limit > 100) limit = 100;
    const cursor = String(req.query.cursor || '');

    const where = { empresaId: empresa.id, status: 'ATIVO' };
    if (q) where.paciente = { nome: { contains: q, mode: 'insensitive' } };

    const args = {
      where,
      // Ordenacao COMPOSTA (criadoEm + id) pra cursor estavel mesmo se varios
      // vinculos tiverem o mesmo timestamp (ex.: 10k semeados em lote no teste).
      orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
      take: limit + 1, // 1 a mais pra saber se ha proxima pagina
      select: {
        id: true,
        paciente: {
          select: {
            id: true,
            nome: true,
            fotoUrl: true,
            perfilSaude: { select: { dataNascimento: true, genero: true } },
          },
        },
      },
    };
    if (cursor) { args.cursor = { id: cursor }; args.skip = 1; }

    const rows = await prisma.vinculoEmpresa.findMany(args);
    const temMais = rows.length > limit;
    const pagina = temMais ? rows.slice(0, limit) : rows;
    const nextCursor = temMais ? pagina[pagina.length - 1].id : null;

    const membros = pagina
      .filter((r) => r.paciente)
      .map((r) => {
        const ps = r.paciente.perfilSaude;
        const idade = _idade(ps && ps.dataNascimento);
        return {
          id: r.paciente.id,
          nome: r.paciente.nome,
          fotoUrl: r.paciente.fotoUrl || null,
          idade,
          genero: (ps && ps.genero) || null,
          menor: idade != null && idade < 18,
        };
      });

    return res.status(200).json({ membros, nextCursor });
  } catch (err) {
    if (_moduloIndisponivel(err, res)) return;
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /membro/:pacienteId — RG do membro (cartao + ficha) pro gestor
// PORTEIRO: o membro PRECISA pertencer (ATIVO) a empresa desse dono.
// Mesmo molde do medico (GET /medico/pacientes/:id), SEM exames (escopo B2B).
// Registra auditoria do acesso (rastro pro LGPD).
// ---------------------------------------------------------------------------

router.get('/membro/:pacienteId', async (req, res, next) => {
  try {
    const empresa = await _empresaDoDono(req);
    if (!empresa) return res.status(404).json({ erro: 'Voce ainda nao tem uma empresa' });

    const { pacienteId } = req.params;

    const vinculo = await prisma.vinculoEmpresa.findFirst({
      where: { empresaId: empresa.id, pacienteId, status: 'ATIVO' },
      select: { id: true },
    });
    if (!vinculo) {
      return res.status(403).json({ erro: 'Esse membro nao e da sua equipe' });
    }

    auditar(req, {
      acao: 'VIEW_MEMBRO_EMPRESA',
      atorTipo: 'EMPRESA',
      recursoTipo: 'PACIENTE',
      recursoId: pacienteId,
      alvoId: pacienteId,
      metadata: { empresaId: empresa.id },
    });

    const membro = await prisma.usuario.findUnique({
      where: { id: pacienteId },
      select: {
        id: true,
        nome: true,
        email: true,
        celular: true,
        fotoUrl: true,
        perfilSaude: true,
        medicamentos: { orderBy: { criadoEm: 'desc' } },
        alergias: { orderBy: { criadoEm: 'desc' } },
        // SEM exames de proposito (escopo aprovado: ficha de emergencia/dados,
        // nao laudos) — e tambem mais leve por clique em escala.
      },
    });
    if (!membro) return res.status(404).json({ erro: 'Membro nao encontrado' });

    return res.status(200).json({ membro });
  } catch (err) {
    if (_moduloIndisponivel(err, res)) return;
    next(err);
  }
});

module.exports = router;
