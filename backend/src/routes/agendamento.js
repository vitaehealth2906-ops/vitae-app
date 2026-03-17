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

const criarAgendamentoSchema = z.object({
  titulo: z.string().min(1, 'Titulo obrigatorio'),
  tipo: z.enum(['EXAME', 'CONSULTA', 'RETORNO']),
  local: z.string().optional(),
  medico: z.string().optional(),
  observacoes: z.string().optional(),
  dataHora: z.string().transform((val) => new Date(val)),
  lembrete: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// POST / — Criar agendamento
// ---------------------------------------------------------------------------

router.post('/', validate(criarAgendamentoSchema), async (req, res, next) => {
  try {
    const agendamento = await prisma.agendamento.create({
      data: {
        usuarioId: req.usuario.id,
        ...req.body,
      },
    });

    return res.status(201).json({ agendamento });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET / — Listar agendamentos do usuario
// ---------------------------------------------------------------------------

router.get('/', async (req, res, next) => {
  try {
    const agendamentos = await prisma.agendamento.findMany({
      where: { usuarioId: req.usuario.id },
      orderBy: { dataHora: 'asc' },
    });

    return res.status(200).json({ agendamentos });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /proximo — Proximo agendamento
// ---------------------------------------------------------------------------

router.get('/proximo', async (req, res, next) => {
  try {
    const proximo = await prisma.agendamento.findFirst({
      where: {
        usuarioId: req.usuario.id,
        dataHora: { gte: new Date() },
      },
      orderBy: { dataHora: 'asc' },
    });

    return res.status(200).json({ agendamento: proximo });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /:id — Atualizar agendamento
// ---------------------------------------------------------------------------

router.put('/:id', async (req, res, next) => {
  try {
    const agendamento = await prisma.agendamento.updateMany({
      where: { id: req.params.id, usuarioId: req.usuario.id },
      data: req.body,
    });

    if (agendamento.count === 0) {
      return res.status(404).json({ erro: 'Agendamento nao encontrado' });
    }

    return res.status(200).json({ mensagem: 'Agendamento atualizado' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id — Deletar agendamento
// ---------------------------------------------------------------------------

router.delete('/:id', async (req, res, next) => {
  try {
    const agendamento = await prisma.agendamento.deleteMany({
      where: { id: req.params.id, usuarioId: req.usuario.id },
    });

    if (agendamento.count === 0) {
      return res.status(404).json({ erro: 'Agendamento nao encontrado' });
    }

    return res.status(200).json({ mensagem: 'Agendamento deletado' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
