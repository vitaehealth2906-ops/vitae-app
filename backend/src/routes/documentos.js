const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const prisma = require('../utils/prisma');
const { verificarAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { auditar } = require('../utils/auditoria');
const storage = require('../services/storage');

const router = express.Router();

router.use(verificarAuth);

// ---------------------------------------------------------------------------
// Config Upload
// ---------------------------------------------------------------------------

const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif'];
const MAX_TAMANHO = 10 * 1024 * 1024; // 10 MB
const TIPOS_DOC_VALIDOS = ['RECEITA', 'LAUDO', 'ENCAMINHAMENTO', 'EXAME_PEDIDO', 'OUTRO'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TAMANHO },
  fileFilter: (_req, file, cb) => {
    if (TIPOS_PERMITIDOS.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de arquivo nao permitido. Envie PDF, JPG, PNG ou HEIC.'));
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function notificarUsuario({ usuarioId, titulo, mensagem, tipo }) {
  try {
    await prisma.notificacao.create({
      data: { usuarioId, tipo: tipo || 'DOCUMENTO', titulo, mensagem },
    });
  } catch (err) {
    console.error('[documentos] falha ao notificar:', err.message);
  }
}

async function validarVinculoMedicoPaciente(medicoId, pacienteId) {
  const autorizacao = await prisma.autorizacaoAcesso.findFirst({
    where: {
      medicoId,
      pacienteId,
      ativo: true,
      OR: [{ expiraEm: null }, { expiraEm: { gt: new Date() } }],
    },
    select: { id: true },
  });
  if (autorizacao) return true;
  const vinculo = await prisma.preConsulta.findFirst({
    where: { medicoId, pacienteId, deletadoEm: null },
    select: { id: true },
  });
  return !!vinculo;
}

function nomeTipo(tipo) {
  return {
    RECEITA: 'Receita',
    LAUDO: 'Laudo',
    ENCAMINHAMENTO: 'Encaminhamento',
    EXAME_PEDIDO: 'Pedido de Exame',
    OUTRO: 'Documento',
  }[tipo] || 'Documento';
}

// ---------------------------------------------------------------------------
// POST /upload — Medico anexa documento pro paciente
// Multipart: arquivo + pacienteId + tipo + observacao? + agendamentoId?
// ---------------------------------------------------------------------------

router.post('/upload', upload.single('arquivo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ erro: 'Arquivo nao enviado' });

    const medico = await prisma.medico.findUnique({
      where: { usuarioId: req.usuario.id },
      include: { usuario: { select: { nome: true } } },
    });
    if (!medico) return res.status(403).json({ erro: 'Perfil medico nao encontrado' });

    const { pacienteId, tipo, observacao, agendamentoId } = req.body;
    if (!pacienteId) return res.status(400).json({ erro: 'pacienteId obrigatorio' });
    if (!tipo || !TIPOS_DOC_VALIDOS.includes(tipo)) {
      return res.status(400).json({ erro: 'tipo invalido. Valores aceitos: ' + TIPOS_DOC_VALIDOS.join(', ') });
    }

    const vinculoOk = await validarVinculoMedicoPaciente(medico.id, pacienteId);
    if (!vinculoOk) return res.status(403).json({ erro: 'Voce nao tem acesso a esse paciente' });

    // Se agendamento informado, valida que e desse paciente
    if (agendamentoId) {
      const ag = await prisma.agendamento.findFirst({ where: { id: agendamentoId, usuarioId: pacienteId }, select: { id: true } });
      if (!ag) return res.status(400).json({ erro: 'Agendamento nao pertence a este paciente' });
    }

    // Sobe arquivo pro Supabase Storage (ou local fallback)
    const { buffer, originalname, mimetype, size } = req.file;
    const upRes = await storage.upload({
      buffer,
      nomeOriginal: originalname,
      mimetype,
      pasta: `documentos/${pacienteId}`,
    });

    const urlArquivo = typeof upRes === 'string' ? upRes : (upRes.url || upRes.publicUrl || '');
    const caminhoStorage = typeof upRes === 'string' ? null : (upRes.caminho || upRes.path || null);
    if (!urlArquivo) return res.status(500).json({ erro: 'Falha ao salvar arquivo' });

    const doc = await prisma.documentoMedico.create({
      data: {
        medicoId: medico.id,
        pacienteId,
        agendamentoId: agendamentoId || null,
        tipo,
        nomeArquivo: originalname,
        urlArquivo,
        caminhoStorage,
        tamanhoBytes: size,
        mimeType: mimetype,
        observacao: observacao || null,
      },
    });

    // Notifica paciente
    const nomeMedico = (medico.usuario && medico.usuario.nome) || 'seu medico';
    await notificarUsuario({
      usuarioId: pacienteId,
      tipo: 'DOCUMENTO',
      titulo: nomeTipo(tipo) + ' anexado',
      mensagem: `${nomeMedico} compartilhou ${nomeTipo(tipo).toLowerCase()} com voce.`,
    });

    auditar(req, {
      acao: 'ANEXAR_DOCUMENTO',
      atorTipo: 'MEDICO',
      recursoTipo: 'DOCUMENTO_MEDICO',
      recursoId: doc.id,
      alvoId: pacienteId,
      metadata: { tipo, tamanhoBytes: size, mimeType: mimetype },
    });

    return res.status(201).json({ documento: doc });
  } catch (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ erro: 'Arquivo grande demais. Limite: 10 MB.' });
      }
    }
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /paciente/:pacienteId — Medico lista docs que ELE anexou pra esse paciente
// ---------------------------------------------------------------------------

router.get('/paciente/:pacienteId', async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id }, select: { id: true } });
    if (!medico) return res.status(403).json({ erro: 'Perfil medico nao encontrado' });

    const { pacienteId } = req.params;
    const vinculoOk = await validarVinculoMedicoPaciente(medico.id, pacienteId);
    if (!vinculoOk) return res.status(403).json({ erro: 'Voce nao tem acesso a esse paciente' });

    const docs = await prisma.documentoMedico.findMany({
      where: { medicoId: medico.id, pacienteId, deletadoEm: null },
      orderBy: { anexadoEm: 'desc' },
    });

    return res.status(200).json({ documentos: docs });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /meus — Paciente lista todos docs que recebeu (qualquer medico)
// ---------------------------------------------------------------------------

router.get('/meus', async (req, res, next) => {
  try {
    const docs = await prisma.documentoMedico.findMany({
      where: { pacienteId: req.usuario.id, deletadoEm: null },
      orderBy: { anexadoEm: 'desc' },
      include: {
        medico: { include: { usuario: { select: { nome: true } } } },
      },
    });

    const documentos = docs.map(d => ({
      id: d.id,
      tipo: d.tipo,
      nomeArquivo: d.nomeArquivo,
      tamanhoBytes: d.tamanhoBytes,
      mimeType: d.mimeType,
      observacao: d.observacao,
      anexadoEm: d.anexadoEm,
      visualizadoEm: d.visualizadoEm,
      baixadoEm: d.baixadoEm,
      agendamentoId: d.agendamentoId,
      medicoNome: (d.medico && d.medico.usuario && d.medico.usuario.nome) || 'Seu medico',
      especialidade: d.medico && d.medico.especialidade,
    }));

    return res.status(200).json({ documentos });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /consulta/:agendamentoId — Lista docs vinculados a uma consulta
// ---------------------------------------------------------------------------

router.get('/consulta/:agendamentoId', async (req, res, next) => {
  try {
    const { agendamentoId } = req.params;
    const ag = await prisma.agendamento.findUnique({ where: { id: agendamentoId } });
    if (!ag) return res.status(404).json({ erro: 'Agendamento nao encontrado' });

    // Paciente dono do agendamento ou medico vinculado podem ver
    const ehDono = ag.usuarioId === req.usuario.id;
    let ehMedicoVinculado = false;
    if (!ehDono) {
      const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id }, select: { id: true } });
      if (medico) ehMedicoVinculado = await validarVinculoMedicoPaciente(medico.id, ag.usuarioId);
    }
    if (!ehDono && !ehMedicoVinculado) return res.status(403).json({ erro: 'Sem acesso a essa consulta' });

    const docs = await prisma.documentoMedico.findMany({
      where: { agendamentoId, deletadoEm: null },
      orderBy: { anexadoEm: 'desc' },
      include: ehDono ? { medico: { include: { usuario: { select: { nome: true } } } } } : undefined,
    });

    return res.status(200).json({ documentos: docs });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /:id — Detalhe do documento. Marca visualizadoEm se for paciente dono.
// ---------------------------------------------------------------------------

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await prisma.documentoMedico.findUnique({
      where: { id: req.params.id },
      include: { medico: { include: { usuario: { select: { nome: true } } } } },
    });
    if (!doc || doc.deletadoEm) return res.status(404).json({ erro: 'Documento nao encontrado' });

    const ehPacienteDono = doc.pacienteId === req.usuario.id;
    let ehMedicoDono = false;
    if (!ehPacienteDono) {
      const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id }, select: { id: true } });
      ehMedicoDono = medico && medico.id === doc.medicoId;
    }
    if (!ehPacienteDono && !ehMedicoDono) return res.status(403).json({ erro: 'Sem acesso a esse documento' });

    if (ehPacienteDono && !doc.visualizadoEm) {
      await prisma.documentoMedico.update({ where: { id: doc.id }, data: { visualizadoEm: new Date() } });
      doc.visualizadoEm = new Date();
      auditar(req, {
        acao: 'VISUALIZAR_DOCUMENTO',
        atorTipo: 'PACIENTE',
        recursoTipo: 'DOCUMENTO_MEDICO',
        recursoId: doc.id,
      });
    }

    return res.status(200).json({ documento: doc });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /:id/baixar — Gera URL assinada (1h) + marca baixadoEm
// ---------------------------------------------------------------------------

router.get('/:id/baixar', async (req, res, next) => {
  try {
    const doc = await prisma.documentoMedico.findUnique({ where: { id: req.params.id } });
    if (!doc || doc.deletadoEm) return res.status(404).json({ erro: 'Documento nao encontrado' });

    // Paciente dono ou medico que anexou
    const ehPacienteDono = doc.pacienteId === req.usuario.id;
    let ehMedicoDono = false;
    if (!ehPacienteDono) {
      const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id }, select: { id: true } });
      ehMedicoDono = medico && medico.id === doc.medicoId;
    }
    if (!ehPacienteDono && !ehMedicoDono) return res.status(403).json({ erro: 'Sem acesso a esse documento' });

    let url = doc.urlArquivo;
    // Se tem caminhoStorage (Supabase), gera URL assinada
    if (doc.caminhoStorage && storage.gerarUrlAssinada) {
      try {
        const assinada = await storage.gerarUrlAssinada(doc.caminhoStorage, 3600);
        if (assinada) url = assinada;
      } catch (_e) { /* mantem urlArquivo original */ }
    }

    if (ehPacienteDono && !doc.baixadoEm) {
      await prisma.documentoMedico.update({ where: { id: doc.id }, data: { baixadoEm: new Date(), visualizadoEm: doc.visualizadoEm || new Date() } });
    }

    auditar(req, {
      acao: 'BAIXAR_DOCUMENTO',
      atorTipo: ehPacienteDono ? 'PACIENTE' : 'MEDICO',
      recursoTipo: 'DOCUMENTO_MEDICO',
      recursoId: doc.id,
    });

    return res.status(200).json({ url, nomeArquivo: doc.nomeArquivo, mimeType: doc.mimeType });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /:id — Medico edita observacao/tipo (nao troca arquivo)
// ---------------------------------------------------------------------------

const patchSchema = z.object({
  tipo: z.enum(TIPOS_DOC_VALIDOS).optional(),
  observacao: z.string().max(2000).optional().nullable(),
});

router.patch('/:id', validate(patchSchema), async (req, res, next) => {
  try {
    const doc = await prisma.documentoMedico.findUnique({ where: { id: req.params.id } });
    if (!doc || doc.deletadoEm) return res.status(404).json({ erro: 'Documento nao encontrado' });

    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id }, select: { id: true } });
    if (!medico || medico.id !== doc.medicoId) return res.status(403).json({ erro: 'Apenas o medico que anexou pode editar' });

    const atualizado = await prisma.documentoMedico.update({
      where: { id: doc.id },
      data: {
        ...(req.body.tipo !== undefined ? { tipo: req.body.tipo } : {}),
        ...(req.body.observacao !== undefined ? { observacao: req.body.observacao } : {}),
      },
    });

    auditar(req, {
      acao: 'EDITAR_DOCUMENTO',
      atorTipo: 'MEDICO',
      recursoTipo: 'DOCUMENTO_MEDICO',
      recursoId: doc.id,
    });

    return res.status(200).json({ documento: atualizado });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id — Medico soft-delete (paciente perde acesso, auditoria preserva)
// ---------------------------------------------------------------------------

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await prisma.documentoMedico.findUnique({ where: { id: req.params.id } });
    if (!doc || doc.deletadoEm) return res.status(404).json({ erro: 'Documento nao encontrado' });

    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id }, select: { id: true } });
    if (!medico || medico.id !== doc.medicoId) return res.status(403).json({ erro: 'Apenas o medico que anexou pode remover' });

    await prisma.documentoMedico.update({ where: { id: doc.id }, data: { deletadoEm: new Date() } });

    auditar(req, {
      acao: 'DELETAR_DOCUMENTO',
      atorTipo: 'MEDICO',
      recursoTipo: 'DOCUMENTO_MEDICO',
      recursoId: doc.id,
    });

    return res.status(200).json({ mensagem: 'Documento removido' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
