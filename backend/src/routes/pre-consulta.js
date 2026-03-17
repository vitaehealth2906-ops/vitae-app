const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const prisma = require('../utils/prisma');
const { verificarAuth, authOpcional } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { gerarSummaryPreConsulta } = require('../services/ai');

const router = express.Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const criarPreConsultaSchema = z.object({
  pacienteNome: z.string().min(2, 'Nome do paciente obrigatorio'),
  pacienteTel: z.string().optional(),
  pacienteEmail: z.string().email().optional(),
});

const responderPreConsultaSchema = z.object({
  respostas: z.object({
    queixaPrincipal: z.string().min(1, 'Queixa principal obrigatoria'),
    sintomas: z.string().optional(),
    duracaoSintomas: z.string().optional(),
    medicamentosEmUso: z.string().optional(),
    alergias: z.string().optional(),
    historicoRelevante: z.string().optional(),
    observacoes: z.string().optional(),
  }),
  transcricao: z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST / — Medico cria link de pre-consulta (autenticado)
// ---------------------------------------------------------------------------

router.post('/', verificarAuth, validate(criarPreConsultaSchema), async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) {
      return res.status(403).json({ erro: 'Apenas medicos podem criar pre-consultas' });
    }

    const { pacienteNome, pacienteTel, pacienteEmail } = req.body;
    const linkToken = crypto.randomBytes(24).toString('hex');

    const preConsulta = await prisma.preConsulta.create({
      data: {
        medicoId: medico.id,
        pacienteNome,
        pacienteTel,
        pacienteEmail,
        linkToken,
        expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
      },
    });

    const baseUrl = process.env.FRONTEND_URL || 'https://vitaehealth2906-ops.github.io/vitae-app';
    const link = `${baseUrl}/pre-consulta.html?token=${linkToken}`;

    return res.status(201).json({
      preConsulta,
      link,
      whatsappLink: pacienteTel
        ? `https://wa.me/${pacienteTel.replace(/\D/g, '')}?text=${encodeURIComponent(
            `Olá ${pacienteNome}! Antes da sua consulta, preencha este formulário: ${link}`
          )}`
        : null,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /t/:token — Buscar pre-consulta por token (publico)
// ---------------------------------------------------------------------------

router.get('/t/:token', async (req, res, next) => {
  try {
    const preConsulta = await prisma.preConsulta.findUnique({
      where: { linkToken: req.params.token },
      include: {
        medico: {
          include: {
            usuario: { select: { nome: true } },
          },
        },
      },
    });

    if (!preConsulta) {
      return res.status(404).json({ erro: 'Pre-consulta nao encontrada' });
    }

    if (preConsulta.expiraEm < new Date()) {
      return res.status(410).json({ erro: 'Link expirado' });
    }

    if (preConsulta.status === 'RESPONDIDA') {
      return res.status(409).json({ erro: 'Pre-consulta ja respondida' });
    }

    return res.status(200).json({
      id: preConsulta.id,
      pacienteNome: preConsulta.pacienteNome,
      medicoNome: preConsulta.medico.usuario.nome,
      especialidade: preConsulta.medico.especialidade,
      status: preConsulta.status,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /t/:token/responder — Paciente responde pre-consulta (publico)
// ---------------------------------------------------------------------------

router.post('/t/:token/responder', validate(responderPreConsultaSchema), async (req, res, next) => {
  try {
    const preConsulta = await prisma.preConsulta.findUnique({
      where: { linkToken: req.params.token },
    });

    if (!preConsulta) {
      return res.status(404).json({ erro: 'Pre-consulta nao encontrada' });
    }

    if (preConsulta.expiraEm < new Date()) {
      return res.status(410).json({ erro: 'Link expirado' });
    }

    if (preConsulta.status === 'RESPONDIDA') {
      return res.status(409).json({ erro: 'Pre-consulta ja respondida' });
    }

    const { respostas, transcricao } = req.body;

    // Gerar summary com IA
    let summaryIA = null;
    let summaryJson = null;
    try {
      const resultado = await gerarSummaryPreConsulta(
        preConsulta.pacienteNome,
        respostas,
        transcricao
      );
      summaryIA = resultado.summaryTexto;
      summaryJson = resultado;
    } catch (aiErr) {
      console.error('[PRE-CONSULTA] Erro ao gerar summary IA:', aiErr.message);
    }

    const atualizada = await prisma.preConsulta.update({
      where: { id: preConsulta.id },
      data: {
        respostas,
        transcricao,
        summaryIA,
        summaryJson,
        status: 'RESPONDIDA',
        respondidaEm: new Date(),
      },
    });

    return res.status(200).json({ preConsulta: atualizada });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET / — Listar pre-consultas do medico (autenticado)
// ---------------------------------------------------------------------------

router.get('/', verificarAuth, async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) {
      return res.status(403).json({ erro: 'Apenas medicos podem listar pre-consultas' });
    }

    const preConsultas = await prisma.preConsulta.findMany({
      where: { medicoId: medico.id },
      orderBy: { criadoEm: 'desc' },
    });

    return res.status(200).json({ preConsultas });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /:id — Detalhe de uma pre-consulta (autenticado — medico)
// ---------------------------------------------------------------------------

router.get('/:id', verificarAuth, async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) {
      return res.status(403).json({ erro: 'Apenas medicos podem ver detalhes' });
    }

    const preConsulta = await prisma.preConsulta.findFirst({
      where: { id: req.params.id, medicoId: medico.id },
    });

    if (!preConsulta) {
      return res.status(404).json({ erro: 'Pre-consulta nao encontrada' });
    }

    return res.status(200).json({ preConsulta });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
