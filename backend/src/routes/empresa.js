// ============================================================
// Fundacao B2B — Empresas (dono cria empresa, convida funcionarios)
//
// TODO (borda conhecida): funcionario que JA tem conta + perfil pronto
// nao passa pelo quiz, entao a colagem da etiqueta nao roda automatica.
// Mitigacao futura: chamar vincularEmpresa no boot de 01-saude.html quando
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

// ---------------------------------------------------------------------------
// GET /convite/:token — Valida convite (PUBLICO, sem auth)
// Antes do router.use(verificarAuth) pra nao exigir login.
// ---------------------------------------------------------------------------

router.get('/convite/:token', async (req, res, next) => {
  try {
    const vinculo = await prisma.vinculoEmpresa.findUnique({
      where: { conviteToken: req.params.token },
      include: { empresa: true },
    });

    if (!vinculo || !vinculo.empresa) {
      return res.status(404).json({ erro: 'Convite nao encontrado' });
    }
    if (vinculo.conviteExpiraEm && vinculo.conviteExpiraEm < new Date()) {
      return res.status(410).json({ erro: 'Convite expirado' });
    }
    if (vinculo.empresa.status !== 'ATIVA') {
      return res.status(410).json({ erro: 'Empresa indisponivel' });
    }

    return res.status(200).json({ empresaNome: vinculo.empresa.nome });
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
    const { nome, cnpj } = req.body || {};
    if (!nome || String(nome).trim().length < 2) {
      return res.status(400).json({ erro: 'Nome da empresa obrigatorio' });
    }

    const empresa = await prisma.empresa.create({
      data: { nome: String(nome).trim(), cnpj: cnpj || null, donoId: req.usuario.id },
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
// POST /convite — Dono gera um link de convite (token + link)
// ---------------------------------------------------------------------------

router.post('/convite', async (req, res, next) => {
  try {
    const empresa = await prisma.empresa.findFirst({
      where: { donoId: req.usuario.id },
      orderBy: { criadoEm: 'asc' },
    });
    if (!empresa) {
      return res.status(404).json({ erro: 'Voce ainda nao tem uma empresa' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const conviteExpiraEm = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.vinculoEmpresa.create({
      data: {
        empresaId: empresa.id,
        status: 'CONVIDADO',
        conviteToken: token,
        conviteExpiraEm,
      },
    });

    const link = `${FRONTEND_URL}/app-v3/convite.html?c=${token}`;

    auditar(req, {
      acao: 'GERAR_CONVITE_EMPRESA',
      atorTipo: 'EMPRESA',
      recursoTipo: 'EMPRESA',
      recursoId: empresa.id,
    });

    return res.status(201).json({ token, link });
  } catch (err) {
    if (_moduloIndisponivel(err, res)) return;
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /vincular — Paciente cola a etiqueta (IDEMPOTENTE)
// ---------------------------------------------------------------------------

router.post('/vincular', async (req, res, next) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ erro: 'token obrigatorio' });

    const vinculo = await prisma.vinculoEmpresa.findUnique({
      where: { conviteToken: token },
    });
    if (!vinculo) return res.status(404).json({ erro: 'Convite nao encontrado' });
    if (vinculo.conviteExpiraEm && vinculo.conviteExpiraEm < new Date()) {
      return res.status(410).json({ erro: 'Convite expirado' });
    }

    // Ja existe vinculo ATIVO desse paciente nessa empresa? Idempotente.
    const jaAtivo = await prisma.vinculoEmpresa.findFirst({
      where: { empresaId: vinculo.empresaId, pacienteId: req.usuario.id, status: 'ATIVO' },
    });
    if (jaAtivo) {
      return res.status(200).json({ duplicate: true });
    }

    const r = await prisma.vinculoEmpresa.updateMany({
      where: { conviteToken: token, pacienteId: null },
      data: { pacienteId: req.usuario.id, status: 'ATIVO', entrouEm: new Date() },
    });

    if (r.count === 0) {
      // Token ja foi usado por outra pessoa (ou ja vinculado). Confere de novo.
      const recheck = await prisma.vinculoEmpresa.findFirst({
        where: { empresaId: vinculo.empresaId, pacienteId: req.usuario.id, status: 'ATIVO' },
      });
      if (recheck) return res.status(200).json({ duplicate: true });
      return res.status(409).json({ erro: 'Convite ja utilizado' });
    }

    auditar(req, {
      acao: 'VINCULAR_EMPRESA',
      atorTipo: 'PACIENTE',
      recursoTipo: 'EMPRESA',
      recursoId: vinculo.empresaId,
    });

    return res.status(200).json({ vinculado: true });
  } catch (err) {
    if (_moduloIndisponivel(err, res)) return;
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /me — Dono ve a empresa + contagem de funcionarios ativos
// NENHUM dado individual de funcionario.
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

    return res.status(200).json({ empresa, funcionariosAtivos });
  } catch (err) {
    if (_moduloIndisponivel(err, res)) return;
    next(err);
  }
});

module.exports = router;
