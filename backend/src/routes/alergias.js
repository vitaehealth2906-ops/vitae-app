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

    // FASE 6 — Se ja existe, ATUALIZA com os novos campos (promove leve->grave, adiciona tipo).
    // Antes retornava 409 — gerava frustracao no paciente. Agora merge inteligente.
    if (existente) {
      const alergia = await prisma.alergia.update({
        where: { id: existente.id },
        data: {
          tipo: tipo || existente.tipo,
          gravidade: gravidade || existente.gravidade,
        },
      });
      return res.status(200).json({ alergia, duplicadoAtualizado: true });
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
// Fase 3 perf: cache em banco por (nomeNormalizado, versaoPrompt).
// Guard P2021: funciona antes da migration rodar (fallback Claude).
// ---------------------------------------------------------------------------

const VERSAO_PROMPT_INFO_ALERGIA = 'v1-2026-05';

function _normalizarNomeIA(nome) {
  return String(nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, ' ');
}

router.get('/info/:nome', async (req, res, next) => {
  try {
    const nomeOriginal = decodeURIComponent(req.params.nome);
    const nomeNorm = _normalizarNomeIA(nomeOriginal);

    try {
      const cached = await prisma.cacheInfoAlergia.findUnique({
        where: { nomeNormalizado_versaoPrompt: { nomeNormalizado: nomeNorm, versaoPrompt: VERSAO_PROMPT_INFO_ALERGIA } },
      });
      if (cached) {
        prisma.cacheInfoAlergia.update({
          where: { id: cached.id },
          data: { hits: { increment: 1 } },
        }).catch(() => {});
        return res.status(200).json({ info: cached.payload, _cached: true });
      }
    } catch (err) {
      if (err && err.code !== 'P2021') {
        console.warn('[CACHE_INFO_ALERGIA] lookup falhou:', err.message);
      }
    }

    const info = await ai.gerarInfoSubstancia(nomeOriginal, 'alergia');

    try {
      await prisma.cacheInfoAlergia.create({
        data: { nomeNormalizado: nomeNorm, versaoPrompt: VERSAO_PROMPT_INFO_ALERGIA, payload: info },
      });
    } catch (err) {
      if (err && err.code !== 'P2021' && err.code !== 'P2002') {
        console.warn('[CACHE_INFO_ALERGIA] save falhou:', err.message);
      }
    }

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

    let resultado;
    try {
      resultado = await ai.scanAlergia(buffer, mimetype);
    } catch (aiErr) {
      const msg = String(aiErr.message || aiErr || '');
      if (msg.includes('credit') || msg.includes('balance') || msg.includes('billing')) {
        return res.status(503).json({ erro: 'Servico de identificacao temporariamente indisponivel.' });
      }
      if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
        return res.status(504).json({ erro: 'Identificacao demorou mais que o esperado.' });
      }
      console.error('[SCAN-ALERGIA] AI error:', msg);
      return res.status(500).json({ erro: 'Nao foi possivel analisar a foto.' });
    }

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
