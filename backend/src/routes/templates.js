const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { verificarAuth } = require('../middleware/auth');
const ai = require('../services/ai');

// ---- Question classification logic ----
const KEYWORDS = {
  yesno: ['fuma', 'fumante', 'grávida', 'gestante', 'diabético', 'hipertenso', 'tem ', 'possui', 'já teve', 'já fez', 'sente', 'usa ', 'toma ', 'bebe', 'pratica'],
  scale: ['intensidade', 'escala', 'nível', 'grau', 'nota de', 'de 0 a', 'de 1 a'],
  location: ['onde dói', 'onde é', 'local da', 'região', 'parte do corpo', 'localização'],
  duration: ['quanto tempo', 'há quanto', 'desde quando', 'quando começou', 'quando iniciou', 'duração'],
  frequency: ['frequência', 'com que frequência', 'quantas vezes', 'por semana', 'por dia', 'por mês'],
  upload: ['foto', 'imagem', 'anexar', 'enviar arquivo', 'documento', 'exame'],
  date: ['data', 'quando foi', 'qual data'],
};

const OPTION_PRESETS = {
  location: [
    { value: 'cabeca', label: 'Cabeça' },
    { value: 'pescoco', label: 'Pescoço' },
    { value: 'peito', label: 'Peito' },
    { value: 'abdomen', label: 'Abdômen' },
    { value: 'costas', label: 'Costas' },
    { value: 'braco_dir', label: 'Braço direito' },
    { value: 'braco_esq', label: 'Braço esquerdo' },
    { value: 'perna_dir', label: 'Perna direita' },
    { value: 'perna_esq', label: 'Perna esquerda' },
    { value: 'outro', label: 'Outro' },
  ],
  duration: [
    { value: 'dias', label: 'Menos de 1 semana' },
    { value: 'semanas', label: '1–4 semanas' },
    { value: 'meses_1_3', label: '1–3 meses' },
    { value: 'meses_3_6', label: '3–6 meses' },
    { value: 'mais_6m', label: 'Mais de 6 meses' },
    { value: 'mais_1a', label: 'Mais de 1 ano' },
  ],
  frequency: [
    { value: 'nunca', label: 'Nunca' },
    { value: 'raramente', label: 'Raramente' },
    { value: 'as_vezes', label: 'Às vezes' },
    { value: 'frequentemente', label: 'Frequentemente' },
    { value: 'diariamente', label: 'Diariamente' },
  ],
  smoking: [
    { value: 'nunca', label: 'Nunca fumei' },
    { value: 'ex', label: 'Ex-fumante' },
    { value: 'ocasional', label: 'Fumo ocasionalmente' },
    { value: 'diario', label: 'Fumo diariamente' },
  ],
  alcohol: [
    { value: 'nunca', label: 'Nunca' },
    { value: 'social', label: 'Socialmente' },
    { value: 'semanal', label: 'Semanalmente' },
    { value: 'diario', label: 'Diariamente' },
  ],
  yesno: [
    { value: 'sim', label: 'Sim' },
    { value: 'nao', label: 'Não' },
  ],
};

function classifyQuestion(text) {
  const lower = text.toLowerCase().trim();

  // Scale (1-10)
  for (const kw of KEYWORDS.scale) {
    if (lower.includes(kw)) return { tipo: 'scale', min: 0, max: 10 };
  }

  // Location
  for (const kw of KEYWORDS.location) {
    if (lower.includes(kw)) return { tipo: 'single_select', opcoes: OPTION_PRESETS.location };
  }

  // Duration
  for (const kw of KEYWORDS.duration) {
    if (lower.includes(kw)) return { tipo: 'single_select', opcoes: OPTION_PRESETS.duration };
  }

  // Frequency
  for (const kw of KEYWORDS.frequency) {
    if (lower.includes(kw)) return { tipo: 'single_select', opcoes: OPTION_PRESETS.frequency };
  }

  // Upload
  for (const kw of KEYWORDS.upload) {
    if (lower.includes(kw)) return { tipo: 'upload' };
  }

  // Date
  for (const kw of KEYWORDS.date) {
    if (lower.includes(kw)) return { tipo: 'date' };
  }

  // Smoking specific
  if (lower.includes('fuma') || lower.includes('tabag') || lower.includes('cigarro')) {
    return { tipo: 'single_select', opcoes: OPTION_PRESETS.smoking };
  }

  // Alcohol specific
  if (lower.includes('álcool') || lower.includes('alcool') || lower.includes('bebe') || lower.includes('bebida')) {
    return { tipo: 'single_select', opcoes: OPTION_PRESETS.alcohol };
  }

  // Yes/No
  for (const kw of KEYWORDS.yesno) {
    if (lower.includes(kw)) return { tipo: 'yesno', opcoes: OPTION_PRESETS.yesno };
  }

  // Default: free text
  return { tipo: 'text' };
}

function classifyAllQuestions(rawText) {
  const lines = rawText
    .split('\n')
    .map(l => l.replace(/^\d+[\.\)\-]\s*/, '').trim())
    .filter(l => l.length > 3);

  if (lines.length === 0) return null;

  // Mandatory questions always first
  const mandatory = [
    { id: 'q_queixa', tipo: 'text', texto: 'Qual o motivo da sua consulta?', obrigatoria: true },
    { id: 'q_medicamentos', tipo: 'text', texto: 'Quais medicamentos você toma atualmente? (incluindo suplementos e vitaminas)', obrigatoria: true },
    { id: 'q_alergias', tipo: 'text', texto: 'Tem alergia a algum medicamento, alimento ou substância?', obrigatoria: true },
  ];

  const custom = lines.map((line, i) => {
    const classification = classifyQuestion(line);
    return {
      id: `q_custom_${i + 1}`,
      texto: line.endsWith('?') ? line : line + '?',
      obrigatoria: false,
      ...classification,
    };
  });

  return [...mandatory, ...custom];
}

// ---- ROUTES ----

// GET /templates/preview-publico/:id — public, no auth, returns perguntas only (for iframe preview)
router.get('/preview-publico/:id', async (req, res) => {
  try {
    const template = await prisma.formTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) return res.status(404).json({ erro: 'Template não encontrado.' });
    res.json({ nome: template.nome, perguntas: template.perguntas });
  } catch (e) {
    res.status(500).json({ erro: 'Erro ao buscar template.' });
  }
});

// POST /templates/gerar — generate questions via AI from instruction
router.post('/gerar', verificarAuth, async (req, res) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) return res.status(403).json({ erro: 'Apenas médicos podem gerar templates.' });

    const { instrucao } = req.body;
    if (!instrucao || instrucao.trim().length < 5) {
      return res.status(400).json({ erro: 'Instrução muito curta. Descreva o tipo de formulário que deseja.' });
    }

    const textoPerguntas = await ai.gerarPerguntasTemplate(instrucao);
    const perguntas = classifyAllQuestions(textoPerguntas);

    if (!perguntas || perguntas.length <= 3) {
      return res.status(400).json({ erro: 'A IA não gerou perguntas suficientes. Tente reformular a instrução.' });
    }

    res.json({ perguntas });
  } catch (e) {
    console.error('[TEMPLATE] Erro gerar:', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao gerar perguntas com IA.' });
  }
});

// POST /templates/classificar — classify raw questions into structured form
router.post('/classificar', verificarAuth, async (req, res) => {
  try {
    const { texto } = req.body;
    if (!texto || texto.trim().length < 5) {
      return res.status(400).json({ erro: 'Texto muito curto. Escreva pelo menos uma pergunta.' });
    }

    const perguntas = classifyAllQuestions(texto);
    if (!perguntas || perguntas.length <= 3) {
      return res.status(400).json({ erro: 'Não consegui identificar perguntas. Escreva cada pergunta em uma linha separada.' });
    }

    res.json({ perguntas });
  } catch (e) {
    console.error('[TEMPLATE] Erro classificar:', e.message);
    res.status(500).json({ erro: 'Erro ao classificar perguntas.' });
  }
});

// GET /templates — list all templates for logged-in doctor
router.get('/', verificarAuth, async (req, res) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) return res.status(403).json({ erro: 'Apenas médicos podem acessar templates.' });

    const templates = await prisma.formTemplate.findMany({
      where: { medicoId: medico.id },
      orderBy: { criadoEm: 'desc' },
    });

    res.json({ templates });
  } catch (e) {
    console.error('[TEMPLATE] Erro listar:', e.message);
    res.status(500).json({ erro: 'Erro ao listar templates.' });
  }
});

// GET /templates/:id — get single template by ID
router.get('/:id', verificarAuth, async (req, res) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) return res.status(403).json({ erro: 'Apenas médicos podem acessar templates.' });

    const template = await prisma.formTemplate.findUnique({ where: { id: req.params.id } });
    if (!template || template.medicoId !== medico.id) {
      return res.status(404).json({ erro: 'Template não encontrado.' });
    }

    res.json({ template });
  } catch (e) {
    console.error('[TEMPLATE] Erro buscar:', e.message);
    res.status(500).json({ erro: 'Erro ao buscar template.' });
  }
});

// POST /templates — create new template
router.post('/', verificarAuth, async (req, res) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) return res.status(403).json({ erro: 'Apenas médicos podem criar templates.' });

    const { nome, perguntas, permitirAudio } = req.body;

    if (!nome || nome.trim().length < 2) return res.status(400).json({ erro: 'Nome do template é obrigatório.' });
    if (!perguntas || !Array.isArray(perguntas) || perguntas.length < 4) {
      return res.status(400).json({ erro: 'Template deve ter pelo menos 4 perguntas (3 obrigatórias + 1 sua).' });
    }
    if (perguntas.length > 25) {
      return res.status(400).json({ erro: 'Máximo de 25 perguntas. Formulários longos reduzem a taxa de resposta.' });
    }

    const template = await prisma.formTemplate.create({
      data: {
        medicoId: medico.id,
        nome: nome.trim(),
        perguntas,
        permitirAudio: permitirAudio !== false,
      },
    });

    res.json({ template });
  } catch (e) {
    console.error('[TEMPLATE] Erro criar:', e.message);
    res.status(500).json({ erro: 'Erro ao criar template.' });
  }
});

// PUT /templates/:id — update template
router.put('/:id', verificarAuth, async (req, res) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) return res.status(403).json({ erro: 'Apenas médicos podem editar templates.' });

    const existing = await prisma.formTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.medicoId !== medico.id) {
      return res.status(404).json({ erro: 'Template não encontrado.' });
    }

    const { nome, perguntas, permitirAudio, ativo } = req.body;
    const updateData = {};

    if (nome !== undefined) updateData.nome = nome.trim();
    if (perguntas !== undefined) {
      if (!Array.isArray(perguntas) || perguntas.length < 4) {
        return res.status(400).json({ erro: 'Template deve ter pelo menos 4 perguntas.' });
      }
      if (perguntas.length > 25) {
        return res.status(400).json({ erro: 'Máximo de 25 perguntas.' });
      }
      updateData.perguntas = perguntas;
      updateData.versao = existing.versao + 1;
    }
    if (permitirAudio !== undefined) updateData.permitirAudio = permitirAudio;
    if (ativo !== undefined) updateData.ativo = ativo;

    const template = await prisma.formTemplate.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({ template });
  } catch (e) {
    console.error('[TEMPLATE] Erro editar:', e.message);
    res.status(500).json({ erro: 'Erro ao editar template.' });
  }
});

// DELETE /templates/:id — delete template
router.delete('/:id', verificarAuth, async (req, res) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) return res.status(403).json({ erro: 'Apenas médicos podem apagar templates.' });

    const existing = await prisma.formTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.medicoId !== medico.id) {
      return res.status(404).json({ erro: 'Template não encontrado.' });
    }

    // Check pending pre-consultas
    const pending = await prisma.preConsulta.count({
      where: { templateId: req.params.id, status: { in: ['PENDENTE', 'ABERTO'] } },
    });

    await prisma.formTemplate.delete({ where: { id: req.params.id } });

    res.json({ ok: true, aviso: pending > 0 ? `Template apagado. ${pending} pré-consulta(s) pendente(s) continuarão funcionando.` : undefined });
  } catch (e) {
    console.error('[TEMPLATE] Erro apagar:', e.message);
    res.status(500).json({ erro: 'Erro ao apagar template.' });
  }
});

module.exports = router;
