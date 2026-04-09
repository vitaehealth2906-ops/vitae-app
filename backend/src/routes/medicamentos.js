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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
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

const criarMedicamentoSchema = z.object({
  nome: z.string().min(1, 'Nome do medicamento e obrigatorio').max(200),
  dosagem: z.string().max(100).optional(),
  frequencia: z.string().max(100).optional(),
  horario: z.string().max(50).optional(),
  motivo: z.string().max(500).optional(),
  observacao: z.string().max(500).optional(),
  medicoPrescritor: z.string().max(200).optional(),
  duracaoDias: z.number().int().min(1).max(365).optional(),
  quantidadeEstoque: z.number().int().min(0).optional(),
  quantidadePorDose: z.number().int().min(1).max(10).optional(),
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
    const { nome, dosagem, frequencia, horario, motivo, dataInicio, dataFim, duracaoDias, quantidadeEstoque, quantidadePorDose, medicoPrescritor, observacao } = req.body;

    // Calculate dataFim from duracaoDias if provided
    let calcDataFim = dataFim || null;
    if (!calcDataFim && duracaoDias) {
      const start = dataInicio || new Date();
      calcDataFim = new Date(start);
      calcDataFim.setDate(calcDataFim.getDate() + duracaoDias);
    }

    const medicamento = await prisma.medicamento.create({
      data: {
        usuarioId,
        nome,
        dosagem: dosagem || null,
        frequencia: frequencia || null,
        horario: horario || null,
        motivo: motivo || null,
        observacao: observacao || null,
        medicoPrescritor: medicoPrescritor || null,
        duracaoDias: duracaoDias || null,
        quantidadeEstoque: quantidadeEstoque || null,
        quantidadePorDose: quantidadePorDose || 1,
        dataInicio: dataInicio || new Date(),
        dataFim: calcDataFim,
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

// ---------------------------------------------------------------------------
// GET /info/:nome — AI-generated info about a medication
// ---------------------------------------------------------------------------

router.get('/info/:nome', async (req, res, next) => {
  try {
    const { nome } = req.params;
    const info = await ai.gerarInfoSubstancia(decodeURIComponent(nome), 'medicamento');
    return res.status(200).json({ info });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /scan — Scan de receita medica (foto/PDF → lista de medicamentos)
// ---------------------------------------------------------------------------

router.post('/scan', uploadScan.single('arquivo'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
    }

    const { buffer, mimetype } = req.file;

    // Use AI to extract medications from the image/PDF
    let resultado;
    try {
      resultado = await ai.scanReceita(buffer, mimetype);
    } catch (aiErr) {
      const msg = String(aiErr.message || aiErr || '');
      if (msg.includes('credit') || msg.includes('balance') || msg.includes('billing')) {
        return res.status(503).json({ erro: 'Servico de identificacao temporariamente indisponivel. Tente novamente em alguns minutos.' });
      }
      if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
        return res.status(504).json({ erro: 'Identificacao demorou mais que o esperado. Tente com uma foto mais simples.' });
      }
      if (msg.includes('too large') || msg.includes('maximum')) {
        return res.status(413).json({ erro: 'Foto muito grande. Tente com uma foto menor ou mais comprimida.' });
      }
      console.error('[SCAN] AI error:', msg);
      return res.status(500).json({ erro: 'Nao foi possivel analisar a foto. Tente novamente.' });
    }

    if (resultado.tipo === 'nao_receita') {
      return res.status(400).json({ erro: resultado.mensagem || 'Documento nao parece ser uma receita medica.' });
    }

    // Check for allergy conflicts
    const usuarioId = req.usuario.id;
    const alergias = await prisma.alergia.findMany({ where: { usuarioId } });
    const alergiasNomes = alergias.map(a => a.nome.toLowerCase());

    const medicamentosComAlerta = (resultado.medicamentos || []).map(med => {
      const conflito = alergiasNomes.some(al =>
        med.nome.toLowerCase().includes(al) || al.includes(med.nome.toLowerCase())
      );
      return { ...med, alertaAlergia: conflito };
    });

    return res.status(200).json({
      tipo: 'receita',
      medico: resultado.medico || null,
      data: resultado.data || null,
      medicamentos: medicamentosComAlerta,
      totalAlertasAlergia: medicamentosComAlerta.filter(m => m.alertaAlergia).length,
    });
  } catch (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ erro: `Erro no envio: ${err.message}` });
    }
    next(err);
  }
});

module.exports = router;
