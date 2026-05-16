const express = require('express');
const { z } = require('zod');
const prisma = require('../utils/prisma');
const { verificarAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { auditar } = require('../utils/auditoria');

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

const proporRetornoSchema = z.object({
  pacienteId: z.string().uuid('pacienteId invalido'),
  dataHora: z.string().transform((val) => new Date(val)),
  observacoes: z.string().max(500).optional(),
  titulo: z.string().min(1).max(120).optional(),
  local: z.string().max(200).optional(),
});

const remarcarSchema = z.object({
  novaDataHora: z.string().transform((val) => new Date(val)),
  motivo: z.string().max(500).optional(),
});

const recusarOuCancelarSchema = z.object({
  motivo: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Helper: cria notificacao in-app (push fica como upgrade futuro)
// ---------------------------------------------------------------------------

async function notificarUsuario({ usuarioId, titulo, mensagem, tipo }) {
  try {
    await prisma.notificacao.create({
      data: {
        usuarioId,
        tipo: tipo || 'RETORNO',
        titulo,
        mensagem,
      },
    });
  } catch (err) {
    console.error('[agendamento] falha ao criar notificacao:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Helper: valida vinculo medico <-> paciente (mesmo padrao do medico.js)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// POST / — Criar agendamento (uso original, paciente cria livre)
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
// GET /proximo — Proximo agendamento do paciente
// Inclui retornos AGUARDANDO_PACIENTE e CONFIRMADO
// ---------------------------------------------------------------------------

router.get('/proximo', async (req, res, next) => {
  try {
    const proximo = await prisma.agendamento.findFirst({
      where: {
        usuarioId: req.usuario.id,
        dataHora: { gte: new Date() },
        OR: [
          { statusProposta: null }, // agendamento "normal" sem fluxo proposta
          { statusProposta: 'CONFIRMADO' },
          { statusProposta: 'AGUARDANDO_PACIENTE' },
          { statusProposta: 'AGUARDANDO_MEDICO' },
        ],
      },
      orderBy: { dataHora: 'asc' },
    });

    return res.status(200).json({ agendamento: proximo });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /retornos-pendentes — Lista de retornos com status nao final (paciente)
// ---------------------------------------------------------------------------

router.get('/retornos-pendentes', async (req, res, next) => {
  try {
    const retornos = await prisma.agendamento.findMany({
      where: {
        usuarioId: req.usuario.id,
        tipo: 'RETORNO',
        statusProposta: { in: ['AGUARDANDO_PACIENTE', 'AGUARDANDO_MEDICO', 'CONFIRMADO'] },
      },
      orderBy: { dataHora: 'asc' },
    });

    return res.status(200).json({ retornos });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /paciente/:pacienteId/retornos — Medico ve retornos de um paciente
// ---------------------------------------------------------------------------

router.get('/paciente/:pacienteId/retornos', async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({
      where: { usuarioId: req.usuario.id },
      select: { id: true },
    });
    if (!medico) return res.status(403).json({ erro: 'Perfil medico nao encontrado' });

    const { pacienteId } = req.params;
    const ok = await validarVinculoMedicoPaciente(medico.id, pacienteId);
    if (!ok) return res.status(403).json({ erro: 'Voce nao tem acesso a esse paciente' });

    const retornos = await prisma.agendamento.findMany({
      where: { usuarioId: pacienteId, tipo: 'RETORNO' },
      orderBy: [{ statusProposta: 'asc' }, { dataHora: 'asc' }],
    });

    return res.status(200).json({ retornos });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /propor-retorno — Medico propoe retorno para um paciente
// ---------------------------------------------------------------------------

router.post('/propor-retorno', validate(proporRetornoSchema), async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({
      where: { usuarioId: req.usuario.id },
      include: { usuario: { select: { nome: true } } },
    });
    if (!medico) return res.status(403).json({ erro: 'Perfil medico nao encontrado' });

    const { pacienteId, dataHora, observacoes, titulo, local } = req.body;

    if (dataHora <= new Date()) {
      return res.status(400).json({ erro: 'Data do retorno deve ser no futuro' });
    }

    const ok = await validarVinculoMedicoPaciente(medico.id, pacienteId);
    if (!ok) return res.status(403).json({ erro: 'Voce nao tem acesso a esse paciente' });

    const nomeMedico = medico.usuario?.nome || 'seu medico';

    const agendamento = await prisma.agendamento.create({
      data: {
        usuarioId: pacienteId,
        titulo: titulo || `Retorno com ${nomeMedico}`,
        tipo: 'RETORNO',
        local: local || null,
        medico: nomeMedico,
        observacoes: observacoes || null,
        dataHora,
        statusProposta: 'AGUARDANDO_PACIENTE',
        propostoPor: 'MEDICO',
        propostoPorId: req.usuario.id,
        lembrete: true,
      },
    });

    await notificarUsuario({
      usuarioId: pacienteId,
      titulo: 'Retorno proposto',
      mensagem: `${nomeMedico} propos um retorno para ${dataHora.toLocaleDateString('pt-BR')}.`,
      tipo: 'RETORNO',
    });

    auditar(req, {
      acao: 'PROPOR_RETORNO',
      atorTipo: 'MEDICO',
      recursoTipo: 'AGENDAMENTO',
      recursoId: agendamento.id,
      alvoId: pacienteId,
      metadata: { medicoId: medico.id, dataHora: dataHora.toISOString() },
    });

    return res.status(201).json({ agendamento });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:id/confirmar — Paciente (ou medico em remarcacao) confirma proposta
// ---------------------------------------------------------------------------

router.post('/:id/confirmar', async (req, res, next) => {
  try {
    const ag = await prisma.agendamento.findUnique({ where: { id: req.params.id } });
    if (!ag) return res.status(404).json({ erro: 'Retorno nao encontrado' });

    const ehDonoPaciente = ag.usuarioId === req.usuario.id;
    let ehMedicoVinculado = false;

    if (!ehDonoPaciente) {
      const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
      if (medico) {
        ehMedicoVinculado = await validarVinculoMedicoPaciente(medico.id, ag.usuarioId);
      }
    }

    if (!ehDonoPaciente && !ehMedicoVinculado) {
      return res.status(403).json({ erro: 'Voce nao pode confirmar este retorno' });
    }

    // Paciente so confirma quando esta AGUARDANDO_PACIENTE
    // Medico so confirma quando esta AGUARDANDO_MEDICO (apos paciente remarcar)
    if (ehDonoPaciente && ag.statusProposta !== 'AGUARDANDO_PACIENTE') {
      return res.status(409).json({ erro: 'Este retorno nao esta aguardando sua confirmacao' });
    }
    if (ehMedicoVinculado && ag.statusProposta !== 'AGUARDANDO_MEDICO') {
      return res.status(409).json({ erro: 'Este retorno nao esta aguardando sua confirmacao' });
    }

    const atualizado = await prisma.agendamento.update({
      where: { id: ag.id },
      data: { statusProposta: 'CONFIRMADO', confirmadoEm: new Date() },
    });

    // Notifica o outro lado
    if (ehDonoPaciente && ag.propostoPorId) {
      await notificarUsuario({
        usuarioId: ag.propostoPorId,
        titulo: 'Retorno confirmado',
        mensagem: `O paciente confirmou o retorno para ${ag.dataHora.toLocaleDateString('pt-BR')}.`,
        tipo: 'RETORNO',
      });
    } else if (ehMedicoVinculado) {
      await notificarUsuario({
        usuarioId: ag.usuarioId,
        titulo: 'Retorno confirmado',
        mensagem: `Seu retorno foi confirmado para ${ag.dataHora.toLocaleDateString('pt-BR')}.`,
        tipo: 'RETORNO',
      });
    }

    auditar(req, {
      acao: 'CONFIRMAR_RETORNO',
      atorTipo: ehDonoPaciente ? 'PACIENTE' : 'MEDICO',
      recursoTipo: 'AGENDAMENTO',
      recursoId: ag.id,
      alvoId: ag.usuarioId,
    });

    return res.status(200).json({ agendamento: atualizado });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:id/recusar — Paciente recusa proposta
// ---------------------------------------------------------------------------

router.post('/:id/recusar', validate(recusarOuCancelarSchema), async (req, res, next) => {
  try {
    const ag = await prisma.agendamento.findUnique({ where: { id: req.params.id } });
    if (!ag) return res.status(404).json({ erro: 'Retorno nao encontrado' });
    if (ag.usuarioId !== req.usuario.id) {
      return res.status(403).json({ erro: 'Voce nao pode recusar este retorno' });
    }
    if (ag.statusProposta !== 'AGUARDANDO_PACIENTE') {
      return res.status(409).json({ erro: 'Este retorno nao esta aguardando sua resposta' });
    }

    const atualizado = await prisma.agendamento.update({
      where: { id: ag.id },
      data: { statusProposta: 'RECUSADO', motivoStatus: req.body.motivo || null },
    });

    if (ag.propostoPorId) {
      await notificarUsuario({
        usuarioId: ag.propostoPorId,
        titulo: 'Retorno recusado',
        mensagem: req.body.motivo
          ? `O paciente recusou o retorno: "${req.body.motivo}"`
          : 'O paciente recusou o retorno proposto.',
        tipo: 'RETORNO',
      });
    }

    auditar(req, {
      acao: 'RECUSAR_RETORNO',
      atorTipo: 'PACIENTE',
      recursoTipo: 'AGENDAMENTO',
      recursoId: ag.id,
    });

    return res.status(200).json({ agendamento: atualizado });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:id/remarcar — Paciente propoe nova data (medico precisa aprovar)
// ---------------------------------------------------------------------------

router.post('/:id/remarcar', validate(remarcarSchema), async (req, res, next) => {
  try {
    const ag = await prisma.agendamento.findUnique({ where: { id: req.params.id } });
    if (!ag) return res.status(404).json({ erro: 'Retorno nao encontrado' });
    if (ag.usuarioId !== req.usuario.id) {
      return res.status(403).json({ erro: 'Voce nao pode remarcar este retorno' });
    }
    if (!['AGUARDANDO_PACIENTE', 'CONFIRMADO'].includes(ag.statusProposta)) {
      return res.status(409).json({ erro: 'Este retorno nao pode ser remarcado agora' });
    }

    const { novaDataHora, motivo } = req.body;
    if (novaDataHora <= new Date()) {
      return res.status(400).json({ erro: 'Nova data deve ser no futuro' });
    }

    const atualizado = await prisma.agendamento.update({
      where: { id: ag.id },
      data: {
        dataAnterior: ag.dataHora,
        dataHora: novaDataHora,
        statusProposta: 'AGUARDANDO_MEDICO',
        propostoPor: 'PACIENTE',
        propostoPorId: req.usuario.id,
        motivoStatus: motivo || null,
        confirmadoEm: null,
      },
    });

    if (ag.propostoPorId) {
      await notificarUsuario({
        usuarioId: ag.propostoPorId,
        titulo: 'Retorno remarcado pelo paciente',
        mensagem: `O paciente sugeriu ${novaDataHora.toLocaleDateString('pt-BR')}. Confirme ou proponha outra data.`,
        tipo: 'RETORNO',
      });
    }

    auditar(req, {
      acao: 'REMARCAR_RETORNO',
      atorTipo: 'PACIENTE',
      recursoTipo: 'AGENDAMENTO',
      recursoId: ag.id,
      metadata: { dataAnterior: ag.dataHora.toISOString(), novaDataHora: novaDataHora.toISOString() },
    });

    return res.status(200).json({ agendamento: atualizado });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:id/cancelar — Medico ou paciente cancela retorno
// ---------------------------------------------------------------------------

router.post('/:id/cancelar', validate(recusarOuCancelarSchema), async (req, res, next) => {
  try {
    const ag = await prisma.agendamento.findUnique({ where: { id: req.params.id } });
    if (!ag) return res.status(404).json({ erro: 'Retorno nao encontrado' });

    const ehDonoPaciente = ag.usuarioId === req.usuario.id;
    let ehMedicoVinculado = false;

    if (!ehDonoPaciente) {
      const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
      if (medico) {
        ehMedicoVinculado = await validarVinculoMedicoPaciente(medico.id, ag.usuarioId);
      }
    }

    if (!ehDonoPaciente && !ehMedicoVinculado) {
      return res.status(403).json({ erro: 'Voce nao pode cancelar este retorno' });
    }
    if (ag.statusProposta === 'CANCELADO') {
      return res.status(409).json({ erro: 'Retorno ja cancelado' });
    }

    const atualizado = await prisma.agendamento.update({
      where: { id: ag.id },
      data: { statusProposta: 'CANCELADO', motivoStatus: req.body.motivo || null },
    });

    // Notifica o outro lado
    const idOutroLado = ehDonoPaciente ? ag.propostoPorId : ag.usuarioId;
    if (idOutroLado) {
      const quemCancelou = ehDonoPaciente ? 'O paciente' : 'O medico';
      await notificarUsuario({
        usuarioId: idOutroLado,
        titulo: 'Retorno cancelado',
        mensagem: req.body.motivo
          ? `${quemCancelou} cancelou: "${req.body.motivo}"`
          : `${quemCancelou} cancelou o retorno.`,
        tipo: 'RETORNO',
      });
    }

    auditar(req, {
      acao: 'CANCELAR_RETORNO',
      atorTipo: ehDonoPaciente ? 'PACIENTE' : 'MEDICO',
      recursoTipo: 'AGENDAMENTO',
      recursoId: ag.id,
    });

    return res.status(200).json({ agendamento: atualizado });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /:id — Atualizar agendamento (legado, usado por paciente em agend nao-retorno)
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
// DELETE /:id — Deletar agendamento (apenas paciente dono)
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
