const express = require('express');
const { z } = require('zod');
const prisma = require('../utils/prisma');
const { verificarAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const scoreEngine = require('../services/score-engine');

const router = express.Router();

// Todas as rotas requerem autenticacao
router.use(verificarAuth);

// ---------------------------------------------------------------------------
// Schemas de validacao
// ---------------------------------------------------------------------------

const criarCheckinSchema = z.object({
  sonoQualidade: z
    .number()
    .int()
    .min(1, 'Qualidade do sono deve ser entre 1 e 5')
    .max(5, 'Qualidade do sono deve ser entre 1 e 5'),
  atividadeFisica: z.enum(
    ['NENHUMA', 'LEVE', 'MODERADA', 'INTENSA'],
    {
      errorMap: () => ({
        message: 'Atividade fisica deve ser NENHUMA, LEVE, MODERADA ou INTENSA',
      }),
    },
  ),
  humor: z
    .number()
    .int()
    .min(1, 'Humor deve ser entre 1 e 5')
    .max(5, 'Humor deve ser entre 1 e 5'),
  dor: z.string().max(500).optional().nullable(),
  produtividade: z
    .number()
    .int()
    .min(1, 'Produtividade deve ser entre 1 e 5')
    .max(5, 'Produtividade deve ser entre 1 e 5'),
  notas: z.string().max(1000).optional().nullable(),
});

// ---------------------------------------------------------------------------
// POST /
// ---------------------------------------------------------------------------

router.post('/', validate(criarCheckinSchema), async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id;
    const { sonoQualidade, atividadeFisica, humor, dor, produtividade, notas } = req.body;

    // Verificar se ja fez check-in esta semana
    const inicioSemana = new Date();
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
    inicioSemana.setHours(0, 0, 0, 0);

    const checkinExistente = await prisma.checkinSemanal.findFirst({
      where: {
        usuarioId,
        criadoEm: { gte: inicioSemana },
      },
    });

    if (checkinExistente) {
      return res.status(409).json({
        erro: 'Voce ja fez o check-in desta semana. Tente novamente na proxima semana.',
      });
    }

    const checkin = await prisma.checkinSemanal.create({
      data: {
        usuarioId,
        sonoQualidade,
        atividadeFisica,
        humor,
        dor: dor || null,
        produtividade,
        notas: notas || null,
      },
    });

    // Recalcular scores apos novo check-in
    scoreEngine.calcularScores(usuarioId).catch((err) => {
      console.error(`[CHECKIN] Erro ao recalcular scores para usuario ${usuarioId}:`, err);
    });

    return res.status(201).json({ checkin });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /historico
// ---------------------------------------------------------------------------

router.get('/historico', async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id;

    const checkins = await prisma.checkinSemanal.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: 'desc' },
      take: 12, // Ultimas 12 semanas (~3 meses)
    });

    return res.status(200).json({ checkins });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
