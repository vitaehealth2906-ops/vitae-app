const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const prisma = require('../utils/prisma');
const { verificarAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const ai = require('../services/ai');

const router = express.Router();

const uploadScan = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Envie uma foto (JPG/PNG) ou PDF.'));
  },
});

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

// ---------------------------------------------------------------------------
// POST /scan — Scan de resultado de exame alergico (foto/PDF → lista de alergias)
// ---------------------------------------------------------------------------

router.post('/scan', uploadScan.single('arquivo'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
    }

    const { buffer, mimetype } = req.file;
    const resultado = await ai.scanAlergia(buffer, mimetype);

    if (resultado.tipo === 'nao_exame') {
      return res.status(400).json({ erro: resultado.mensagem || 'Documento nao parece ser um resultado de exame alergico.' });
    }

    // Check which allergies already exist for this user
    const usuarioId = req.usuario.id;
    const existentes = await prisma.alergia.findMany({ where: { usuarioId } });
    const existentesNomes = existentes.map(a => a.nome.toLowerCase());

    const alergiasComStatus = (resultado.alergias || []).map(al => {
      const jaExiste = existentesNomes.some(e =>
        al.nome.toLowerCase().includes(e) || e.includes(al.nome.toLowerCase())
      );
      return { ...al, existing: jaExiste };
    });

    return res.status(200).json({
      tipo: 'exame_alergico',
      alergias: alergiasComStatus,
      totalNovas: alergiasComStatus.filter(a => !a.existing).length,
      totalExistentes: alergiasComStatus.filter(a => a.existing).length,
    });
  } catch (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ erro: `Erro no envio: ${err.message}` });
    }
    next(err);
  }
});

module.exports = router;
