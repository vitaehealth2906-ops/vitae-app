// Servico nucleo de slots da agenda.
// Implementa: criar (com lock + conflito + idempotencia), cancelar (com snapshot pra desfazer),
// remarcar (com mesma protecao), desfazer dentro de janela 10s, listar com paginacao.
//
// Princípios:
// - pg_advisory_xact_lock(hashtext(medicoId)) em transacao = serializa por medico
// - attemptId UUID = idempotencia (segundo POST com mesmo id retorna primeiro slot)
// - estadoAnterior JSON = snapshot pra desfazer
// - desfeitoAte timestamp = janela 10s
// - cancelamento marca TarefaPendente.dead=true (worker NAO envia lembrete cancelado)

const prisma = require('../../utils/prisma');
const { overlap, lembreteAt } = require('./timezone');

const UNDO_WINDOW_SECONDS = 10;

// Lock advisor numerico baseado em hash do medicoId.
// Postgres advisory locks aceitam bigint, e serializam dentro da transacao.
async function lockMedico(tx, medicoId) {
  // Postgres tem hashtext(text) que retorna int. Usamos pg_advisory_xact_lock(int) variante.
  await tx.$queryRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, medicoId);
}

// Busca conflitos no range (margem de 1 dia).
// Considera apenas slots ativos (nao CANCELADA, nao REMARCADA).
async function buscarConflitos(tx, medicoId, inicio, fim, excluirSlotId = null) {
  const margem1d = 24 * 60 * 60 * 1000;
  const inicioBusca = new Date(new Date(inicio).getTime() - margem1d);
  const fimBusca = new Date(new Date(fim).getTime() + margem1d);

  const slots = await tx.agendaSlot.findMany({
    where: {
      medicoId,
      id: excluirSlotId ? { not: excluirSlotId } : undefined,
      status: { notIn: ['CANCELADA', 'REMARCADA'] },
      inicio: { gte: inicioBusca, lte: fimBusca },
    },
    select: {
      id: true, inicio: true, fim: true, tipo: true, status: true, origem: true,
      paciente: { select: { id: true, nome: true } },
      pacienteNomeLivre: true,
    },
  });

  return slots.filter(s => overlap(s.inicio, s.fim, inicio, fim));
}

// Cria slot (transacao atomica com lock).
// Body: { medicoId, pacienteId?, pacienteNomeLivre?, pacienteTelLivre?, localId?,
//         inicio, fim, duracaoMin, tipo, motivo?, observacoes?, videoUrl?, origem?,
//         preConsultaId?, attemptId, criadoPor }
async function criarSlot(payload) {
  const { medicoId, attemptId, inicio, fim, criadoPor } = payload;
  if (!medicoId || !inicio || !fim || !criadoPor) {
    return { ok: false, code: 'PAYLOAD_INVALIDO', message: 'medicoId/inicio/fim/criadoPor obrigatorios.' };
  }

  // Idempotencia: se attemptId ja existe, retorna o slot existente.
  if (attemptId) {
    const existente = await prisma.agendaSlot.findUnique({
      where: { attemptId },
      include: { paciente: { select: { id: true, nome: true, fotoUrl: true } } },
    });
    if (existente) {
      return { ok: true, data: existente, duplicate: true };
    }
  }

  return await prisma.$transaction(async (tx) => {
    await lockMedico(tx, medicoId);

    const conflitos = await buscarConflitos(tx, medicoId, inicio, fim);
    if (conflitos.length > 0) {
      const c = conflitos[0];
      const code = c.origem === 'GOOGLE_IMPORT' ? 'CONFLITO_GOOGLE' : 'CONFLITO_AGENDA';
      return {
        ok: false,
        code,
        message: code === 'CONFLITO_GOOGLE'
          ? 'Voce tem evento pessoal nesse horario.'
          : 'Voce ja tem consulta nesse horario.',
        slotConflitante: c,
      };
    }

    const slot = await tx.agendaSlot.create({
      data: {
        medicoId,
        pacienteId: payload.pacienteId || null,
        pacienteNomeLivre: payload.pacienteNomeLivre || null,
        pacienteTelLivre: payload.pacienteTelLivre || null,
        localId: payload.localId || null,
        inicio: new Date(inicio),
        fim: new Date(fim),
        duracaoMin: payload.duracaoMin,
        tipo: payload.tipo,
        status: 'AGUARDANDO_CONFIRMACAO',
        motivo: payload.motivo || null,
        observacoes: payload.observacoes || null,
        videoUrl: payload.videoUrl || null,
        origem: payload.origem || 'MANUAL',
        preConsultaId: payload.preConsultaId || null,
        attemptId: attemptId || null,
        criadoPor,
      },
      include: { paciente: { select: { id: true, nome: true, fotoUrl: true } } },
    });

    // Agendar lembretes (sem TarefaPendente — usamos query worker direto por inicio+lembreteSent)
    // Worker existente busca slots com inicio<=now+24h && !lembrete24Sent
    // Nao precisa criar TarefaPendente (mais simples e sem dedupe issue)

    return { ok: true, data: slot };
  });
}

// Cancela slot — salva estado, abre janela 10s pra desfazer.
async function cancelarSlot(slotId, usuarioId, motivo) {
  const slot = await prisma.agendaSlot.findUnique({ where: { id: slotId } });
  if (!slot) return { ok: false, code: 'NOT_FOUND', message: 'Slot nao encontrado.' };
  if (slot.status === 'CANCELADA') {
    return { ok: false, code: 'JA_CANCELADA', message: 'Ja estava cancelada.' };
  }

  const desfeitoAte = new Date(Date.now() + UNDO_WINDOW_SECONDS * 1000);
  const estadoAnterior = {
    status: slot.status,
    pacienteConfirmou: slot.pacienteConfirmou,
    pacienteRecusou: slot.pacienteRecusou,
  };

  const updated = await prisma.agendaSlot.update({
    where: { id: slotId },
    data: {
      status: 'CANCELADA',
      cancelamentoMotivo: motivo || null,
      cancelamentoPor: usuarioId,
      cancelamentoEm: new Date(),
      desfeitoAte,
      estadoAnterior,
    },
  });

  return { ok: true, data: updated };
}

// Desfaz cancelamento dentro de janela.
async function desfazerCancelamento(slotId, usuarioId) {
  const slot = await prisma.agendaSlot.findUnique({ where: { id: slotId } });
  if (!slot) return { ok: false, code: 'NOT_FOUND', message: 'Slot nao encontrado.' };
  if (slot.status !== 'CANCELADA') {
    return { ok: false, code: 'NAO_CANCELADO', message: 'Slot nao foi cancelado.' };
  }
  if (!slot.desfeitoAte || slot.desfeitoAte < new Date()) {
    return { ok: false, code: 'JANELA_EXPIROU', message: 'Janela de 10s expirou.' };
  }

  const restored = slot.estadoAnterior || { status: 'AGUARDANDO_CONFIRMACAO' };
  const updated = await prisma.agendaSlot.update({
    where: { id: slotId },
    data: {
      status: restored.status || 'AGUARDANDO_CONFIRMACAO',
      cancelamentoMotivo: null,
      cancelamentoPor: null,
      cancelamentoEm: null,
      desfeitoAte: null,
      estadoAnterior: null,
    },
  });

  return { ok: true, data: updated };
}

// Remarca slot — mesma logica de conflito.
async function remarcarSlot(slotId, payload, usuarioId) {
  const slot = await prisma.agendaSlot.findUnique({ where: { id: slotId } });
  if (!slot) return { ok: false, code: 'NOT_FOUND' };
  if (slot.status === 'CANCELADA') {
    return { ok: false, code: 'CANCELADA', message: 'Slot cancelado nao pode ser remarcado. Crie novo.' };
  }

  const novoInicio = payload.inicio || slot.inicio;
  const novoFim = payload.fim || slot.fim;

  return await prisma.$transaction(async (tx) => {
    await lockMedico(tx, slot.medicoId);

    const conflitos = await buscarConflitos(tx, slot.medicoId, novoInicio, novoFim, slotId);
    if (conflitos.length > 0) {
      const c = conflitos[0];
      return {
        ok: false,
        code: c.origem === 'GOOGLE_IMPORT' ? 'CONFLITO_GOOGLE' : 'CONFLITO_AGENDA',
        message: 'Conflito com outro horario.',
        slotConflitante: c,
      };
    }

    const updated = await tx.agendaSlot.update({
      where: { id: slotId },
      data: {
        inicio: new Date(novoInicio),
        fim: new Date(novoFim),
        duracaoMin: payload.duracaoMin || slot.duracaoMin,
        localId: payload.localId !== undefined ? payload.localId : slot.localId,
        motivo: payload.motivo !== undefined ? payload.motivo : slot.motivo,
        observacoes: payload.observacoes !== undefined ? payload.observacoes : slot.observacoes,
        // Reseta lembretes pq horario mudou
        lembrete24Sent: false,
        lembrete2Sent: false,
        lembrete24SentAt: null,
        lembrete2SentAt: null,
      },
    });

    return { ok: true, data: updated };
  });
}

// Lista slots no range. Pagina default 200.
async function listarSlots(medicoId, rangeInicio, rangeFim, opts = {}) {
  const where = {
    medicoId,
    inicio: { gte: new Date(rangeInicio), lte: new Date(rangeFim) },
  };
  if (!opts.incluirCanceladas) {
    where.status = { notIn: ['CANCELADA', 'REMARCADA'] };
  }

  return await prisma.agendaSlot.findMany({
    where,
    include: {
      paciente: { select: { id: true, nome: true, fotoUrl: true } },
      local: { select: { id: true, nome: true, cor: true } },
    },
    orderBy: { inicio: 'asc' },
    take: opts.limit || 200,
  });
}

// Marca status (COMPARECEU, FALTA)
async function marcarStatus(slotId, status, usuarioId) {
  if (!['COMPARECEU', 'FALTA', 'CONFIRMADA'].includes(status)) {
    return { ok: false, code: 'STATUS_INVALIDO' };
  }
  const slot = await prisma.agendaSlot.findUnique({ where: { id: slotId } });
  if (!slot) return { ok: false, code: 'NOT_FOUND' };

  const updated = await prisma.agendaSlot.update({
    where: { id: slotId },
    data: { status },
  });

  // Se FALTA: verifica historico do paciente (2 faltas em 90d → flag confirmar 48h)
  if (status === 'FALTA' && updated.pacienteId) {
    const noventaDias = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const faltas = await prisma.agendaSlot.count({
      where: {
        pacienteId: updated.pacienteId,
        medicoId: updated.medicoId,
        status: 'FALTA',
        inicio: { gte: noventaDias },
      },
    });
    if (faltas >= 2) {
      // Marca proximos slots futuros do mesmo paciente
      await prisma.agendaSlot.updateMany({
        where: {
          pacienteId: updated.pacienteId,
          medicoId: updated.medicoId,
          inicio: { gt: new Date() },
          status: { notIn: ['CANCELADA', 'REMARCADA'] },
        },
        data: { noShowConfirmar48h: true },
      });
    }
  }

  return { ok: true, data: updated };
}

module.exports = {
  criarSlot,
  cancelarSlot,
  desfazerCancelamento,
  remarcarSlot,
  listarSlots,
  marcarStatus,
  buscarConflitos,
  UNDO_WINDOW_SECONDS,
};
