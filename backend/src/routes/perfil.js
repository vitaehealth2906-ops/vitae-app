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

const atualizarPerfilSchema = z.object({
  genero: z.enum(['MASCULINO', 'FEMININO', 'OUTRO', 'NAO_INFORMADO']).optional(),
  dataNascimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .transform((val) => new Date(val))
    .optional(),
  alturaCm: z
    .number()
    .int()
    .min(50, 'Altura minima: 50cm')
    .max(300, 'Altura maxima: 300cm')
    .optional(),
  pesoKg: z
    .number()
    .min(1, 'Peso minimo: 1kg')
    .max(500, 'Peso maximo: 500kg')
    .optional(),
  tipoSanguineo: z
    .enum(['A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG'])
    .optional(),
  historicoFamiliar: z.array(z.string()).optional(),
  nivelAtividade: z
    .enum(['SEDENTARIO', 'LEVE', 'MODERADO', 'ATIVO', 'MUITO_ATIVO'])
    .optional(),
  horasSono: z
    .number()
    .min(0, 'Horas de sono minimo: 0')
    .max(24, 'Horas de sono maximo: 24')
    .optional(),
  fuma: z.boolean().optional(),
  alcool: z.enum(['NUNCA', 'RARAMENTE', 'SOCIALMENTE', 'FREQUENTEMENTE', 'DIARIAMENTE']).optional(),
});

// ---------------------------------------------------------------------------
// GET /
// ---------------------------------------------------------------------------

router.get('/', async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      select: {
        id: true,
        nome: true,
        email: true,
        celular: true,
        fotoUrl: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({ erro: 'Usuario nao encontrado' });
    }

    const perfil = await prisma.perfilSaude.findUnique({
      where: { usuarioId: req.usuario.id },
    });

    return res.status(200).json({
      usuario,
      perfil: perfil || {},
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /
// ---------------------------------------------------------------------------

router.put('/', validate(atualizarPerfilSchema), async (req, res, next) => {
  try {
    const dados = req.body;
    const usuarioId = req.usuario.id;

    const perfil = await prisma.perfilSaude.upsert({
      where: { usuarioId },
      update: {
        ...dados,
        atualizadoEm: new Date(),
      },
      create: {
        usuarioId,
        ...dados,
      },
    });

    return res.status(200).json({ perfil });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /foto
// ---------------------------------------------------------------------------

router.post('/foto', async (req, res, next) => {
  try {
    // TODO: Implementar upload com multer + servico de storage (S3/GCS)
    // Por enquanto, placeholder que aceita URL direta
    const { fotoUrl } = req.body;

    if (!fotoUrl) {
      return res.status(400).json({ erro: 'URL da foto e obrigatoria' });
    }

    await prisma.usuario.update({
      where: { id: req.usuario.id },
      data: { fotoUrl },
    });

    return res.status(200).json({ fotoUrl });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
