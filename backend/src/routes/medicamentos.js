const express = require('express');
const { z } = require('zod');
const prisma = require('../utils/prisma');
const { verificarAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// Todas as rotas requerem autenticacao
router.use(verificarAuth);

// ---------------------------------------------------------------------------
// Schemas de validacao
// ---------------------------------------------------------------------------

const criarMedicamentoSchema = z.object({
  nome: z.string().min(1, 'Nome do medicamento e obrigatorio').max(200),
  dosagem: z.string().max(100).optional(),
  frequencia: z.string().max(100).optional(),
  horario: z.string().max(50).optional(),
  motivo: z.string().max(500).optional(),
  dataInicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .transform((val) => new Date(val))
    .optional(),
});

const atualizarMedicamentoSchema = z.object({
  nome: z.string().min(1).max(200).optional(),
  dosagem: z.string().max(100).optional(),
  frequencia: z.string().max(100).optional(),
  horario: z.string().max(50).optional(),
  motivo: z.string().max(500).optional(),
  dataInicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .transform((val) => new Date(val))
    .optional(),
  dataFim: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .transform((val) => new Date(val))
    .optional()
    .nullable(),
  ativo: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// GET /
// ---------------------------------------------------------------------------

router.get('/', async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id;

    const medicamentos = await prisma.medicamento.findMany({
      where: {
        usuarioId,
        ativo: true,
      },
      orderBy: { criadoEm: 'desc' },
    });

    return res.status(200).json({ medicamentos });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /
// ---------------------------------------------------------------------------

router.post('/', validate(criarMedicamentoSchema), async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id;
    const { nome, dosagem, frequencia, horario, motivo, dataInicio } = req.body;

    const medicamento = await prisma.medicamento.create({
      data: {
        usuarioId,
        nome,
        dosagem: dosagem || null,
        frequencia: frequencia || null,
        horario: horario || null,
        motivo: motivo || null,
        dataInicio: dataInicio || new Date(),
        ativo: true,
      },
    });

    return res.status(201).json({ medicamento });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /:id
// ---------------------------------------------------------------------------

router.put('/:id', validate(atualizarMedicamentoSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario.id;

    const existente = await prisma.medicamento.findUnique({ where: { id } });

    if (!existente) {
      return res.status(404).json({ erro: 'Medicamento nao encontrado' });
    }

    if (existente.usuarioId !== usuarioId) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const medicamento = await prisma.medicamento.update({
      where: { id },
      data: {
        ...req.body,
        atualizadoEm: new Date(),
      },
    });

    return res.status(200).json({ medicamento });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id
// ---------------------------------------------------------------------------

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario.id;

    const existente = await prisma.medicamento.findUnique({ where: { id } });

    if (!existente) {
      return res.status(404).json({ erro: 'Medicamento nao encontrado' });
    }

    if (existente.usuarioId !== usuarioId) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    await prisma.medicamento.delete({ where: { id } });

    return res.status(200).json({ mensagem: 'Medicamento removido' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
