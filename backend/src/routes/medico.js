const express = require('express');
const { z } = require('zod');
const prisma = require('../utils/prisma');
const { verificarAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(verificarAuth);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const cadastroMedicoSchema = z.object({
  crm: z.string().min(4, 'CRM invalido').max(20),
  ufCrm: z.string().length(2, 'UF deve ter 2 caracteres'),
  especialidade: z.string().min(2, 'Especialidade obrigatoria'),
  clinica: z.string().optional(),
  enderecoClinica: z.string().optional(),
  telefoneClinica: z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST / — Cadastrar perfil medico
// ---------------------------------------------------------------------------

router.post('/', validate(cadastroMedicoSchema), async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id;
    const { crm, ufCrm, especialidade, clinica, enderecoClinica, telefoneClinica } = req.body;

    // Verificar se ja tem perfil medico
    const existente = await prisma.medico.findUnique({ where: { usuarioId } });
    if (existente) {
      return res.status(409).json({ erro: 'Perfil medico ja existe' });
    }

    // Atualizar tipo do usuario
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { tipo: 'MEDICO' },
    });

    const medico = await prisma.medico.create({
      data: {
        usuarioId,
        crm,
        ufCrm: ufCrm.toUpperCase(),
        especialidade,
        clinica,
        enderecoClinica,
        telefoneClinica,
      },
    });

    return res.status(201).json({ medico });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET / — Obter perfil medico
// ---------------------------------------------------------------------------

router.get('/', async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({
      where: { usuarioId: req.usuario.id },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true, celular: true, fotoUrl: true },
        },
      },
    });

    if (!medico) {
      return res.status(404).json({ erro: 'Perfil medico nao encontrado' });
    }

    return res.status(200).json({ medico });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT / — Atualizar perfil medico
// ---------------------------------------------------------------------------

router.put('/', async (req, res, next) => {
  try {
    const { especialidade, clinica, enderecoClinica, telefoneClinica } = req.body;

    const medico = await prisma.medico.update({
      where: { usuarioId: req.usuario.id },
      data: {
        ...(especialidade && { especialidade }),
        ...(clinica !== undefined && { clinica }),
        ...(enderecoClinica !== undefined && { enderecoClinica }),
        ...(telefoneClinica !== undefined && { telefoneClinica }),
      },
    });

    return res.status(200).json({ medico });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /pacientes — Listar pacientes que autorizaram acesso
// ---------------------------------------------------------------------------

router.get('/pacientes', async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) {
      return res.status(403).json({ erro: 'Perfil medico nao encontrado' });
    }

    const autorizacoes = await prisma.autorizacaoAcesso.findMany({
      where: { medicoId: medico.id, ativo: true },
      include: {
        paciente: {
          select: {
            id: true,
            nome: true,
            email: true,
            celular: true,
            fotoUrl: true,
            perfilSaude: true,
          },
        },
      },
    });

    const pacientes = autorizacoes.map((a) => ({
      autorizacaoId: a.id,
      tipoAcesso: a.tipoAcesso,
      categorias: a.categorias,
      expiraEm: a.expiraEm,
      ...a.paciente,
    }));

    return res.status(200).json({ pacientes });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /dashboard — Stats do medico
// ---------------------------------------------------------------------------

router.get('/dashboard', async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) {
      return res.status(403).json({ erro: 'Perfil medico nao encontrado' });
    }

    const [totalPacientes, preConsultasPendentes, preConsultasRespondidas] = await Promise.all([
      prisma.autorizacaoAcesso.count({ where: { medicoId: medico.id, ativo: true } }),
      prisma.preConsulta.count({ where: { medicoId: medico.id, status: 'PENDENTE' } }),
      prisma.preConsulta.count({ where: { medicoId: medico.id, status: 'RESPONDIDA' } }),
    ]);

    return res.status(200).json({
      totalPacientes,
      preConsultasPendentes,
      preConsultasRespondidas,
      totalPreConsultas: preConsultasPendentes + preConsultasRespondidas,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
