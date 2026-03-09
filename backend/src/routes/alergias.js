const express = require('express');
const { z } = require('zod');
const prisma = require('../utils/prisma');
const { verificarAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const ai = require('../services/ai');

const router = express.Router();

// Todas as rotas requerem autenticacao
router.use(verificarAuth);

// ---------------------------------------------------------------------------
// Schemas de validacao
// ---------------------------------------------------------------------------

const criarAlergiaSchema = z.object({
  nome: z.string().min(1, 'Nome da alergia e obrigatorio').max(200),
  tipo: z
    .enum(['MEDICAMENTO', 'ALIMENTO', 'AMBIENTAL', 'CONTATO', 'OUTRO'], {
      errorMap: () => ({
        message: 'Tipo deve ser MEDICAMENTO, ALIMENTO, AMBIENTAL, CONTATO ou OUTRO',
      }),
    })
    .optional(),
  gravidade: z
    .enum(['LEVE', 'MODERADA', 'GRAVE', 'ANAFILAXIA'], {
      errorMap: () => ({
        message: 'Gravidade deve ser LEVE, MODERADA, GRAVE ou ANAFILAXIA',
      }),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// GET /
// ---------------------------------------------------------------------------

router.get('/', async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id;

    const alergias = await prisma.alergia.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: 'desc' },
    });

    return res.status(200).json({ alergias });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /
// ---------------------------------------------------------------------------

router.post('/', validate(criarAlergiaSchema), async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id;
    const { nome, tipo, gravidade } = req.body;

    // Verificar se ja existe alergia com mesmo nome para o usuario
    const existente = await prisma.alergia.findFirst({
      where: {
        usuarioId,
        nome: { equals: nome, mode: 'insensitive' },
      },
    });

    if (existente) {
      return res.status(409).json({ erro: 'Voce ja cadastrou esta alergia' });
    }

    const alergia = await prisma.alergia.create({
      data: {
        usuarioId,
        nome,
        tipo: tipo || null,
        gravidade: gravidade || null,
      },
    });

    return res.status(201).json({ alergia });
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

    const existente = await prisma.alergia.findUnique({ where: { id } });

    if (!existente) {
      return res.status(404).json({ erro: 'Alergia nao encontrada' });
    }

    if (existente.usuarioId !== usuarioId) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    await prisma.alergia.delete({ where: { id } });

    return res.status(200).json({ mensagem: 'Alergia removida' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /info/:nome — AI-generated info about an allergy
// ---------------------------------------------------------------------------

router.get('/info/:nome', async (req, res, next) => {
  try {
    const { nome } = req.params;
    const info = await ai.gerarInfoSubstancia(decodeURIComponent(nome), 'alergia');
    return res.status(200).json({ info });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
