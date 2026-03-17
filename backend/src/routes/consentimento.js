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

const registrarConsentimentoSchema = z.object({
  tipo: z.enum(['TERMOS_USO', 'POLITICA_PRIVACIDADE', 'COMPARTILHAMENTO_MEDICO', 'PROCESSAMENTO_IA']),
  aceito: z.boolean(),
  versao: z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST / — Registrar consentimento
// ---------------------------------------------------------------------------

router.post('/', validate(registrarConsentimentoSchema), async (req, res, next) => {
  try {
    const { tipo, aceito, versao } = req.body;

    const consentimento = await prisma.consentimento.create({
      data: {
        usuarioId: req.usuario.id,
        tipo,
        aceito,
        versao: versao || '1.0',
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
        userAgent: req.headers['user-agent'] || null,
      },
    });

    return res.status(201).json({ consentimento });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET / — Listar consentimentos do usuario
// ---------------------------------------------------------------------------

router.get('/', async (req, res, next) => {
  try {
    const consentimentos = await prisma.consentimento.findMany({
      where: { usuarioId: req.usuario.id },
      orderBy: { criadoEm: 'desc' },
    });

    return res.status(200).json({ consentimentos });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id — Revogar consentimento
// ---------------------------------------------------------------------------

router.delete('/:id', async (req, res, next) => {
  try {
    const consentimento = await prisma.consentimento.findFirst({
      where: { id: req.params.id, usuarioId: req.usuario.id },
    });

    if (!consentimento) {
      return res.status(404).json({ erro: 'Consentimento nao encontrado' });
    }

    await prisma.consentimento.update({
      where: { id: consentimento.id },
      data: { revogadoEm: new Date() },
    });

    return res.status(200).json({ mensagem: 'Consentimento revogado' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /status — Status de todos os consentimentos obrigatorios
// ---------------------------------------------------------------------------

router.get('/status', async (req, res, next) => {
  try {
    const tipos = ['TERMOS_USO', 'POLITICA_PRIVACIDADE', 'COMPARTILHAMENTO_MEDICO', 'PROCESSAMENTO_IA'];

    const consentimentos = await prisma.consentimento.findMany({
      where: {
        usuarioId: req.usuario.id,
        revogadoEm: null,
      },
      orderBy: { criadoEm: 'desc' },
    });

    const status = {};
    for (const tipo of tipos) {
      const ultimo = consentimentos.find((c) => c.tipo === tipo);
      status[tipo] = {
        aceito: ultimo ? ultimo.aceito : false,
        data: ultimo ? ultimo.criadoEm : null,
        versao: ultimo ? ultimo.versao : null,
      };
    }

    return res.status(200).json({ status });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
