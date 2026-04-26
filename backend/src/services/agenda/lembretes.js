// Servico que dispara lembretes (email + push) e marca slot.lembrete*Sent.
// Idempotente: rechecha flag antes de enviar; nunca envia 2x.
// Tolerante a falhas: se um canal falha, tenta o outro.

const prisma = require('../../utils/prisma');
const tpl = require('./email-templates');
const pushSvc = require('./push');

// Envia lembrete 24h ou 2h antes do slot.
// tipo: '24h' | '2h'
async function enviar(slotId, tipo) {
  const slot = await prisma.agendaSlot.findUnique({
    where: { id: slotId },
    include: {
      paciente: { select: { id: true, nome: true, email: true } },
      local: { select: { nome: true } },
      medico: {
        select: {
          usuario: { select: { nome: true } },
          configAgenda: { select: { timezone: true, lembrete24h: true, lembrete2h: true } },
        },
      },
    },
  });

  if (!slot) return { sent: false, reason: 'NOT_FOUND' };

  // Pre-conditions: nao envia se cancelada/remarcada, ou se janela de desfazer ainda aberta
  if (['CANCELADA', 'REMARCADA'].includes(slot.status)) {
    return { sent: false, reason: 'STATUS_CANCELADA' };
  }
  if (slot.desfeitoAte && slot.desfeitoAte > new Date()) {
    return { sent: false, reason: 'DENTRO_JANELA_DESFAZER' };
  }

  // Verifica config de lembrete do medico
  const cfg = slot.medico?.configAgenda;
  if (tipo === '24h' && cfg && cfg.lembrete24h === false) {
    return { sent: false, reason: 'DESATIVADO_PELO_MEDICO' };
  }
  if (tipo === '2h' && cfg && cfg.lembrete2h === false) {
    return { sent: false, reason: 'DESATIVADO_PELO_MEDICO' };
  }

  // Idempotencia: ja enviado?
  if (tipo === '24h' && slot.lembrete24Sent) return { sent: false, reason: 'JA_ENVIADO' };
  if (tipo === '2h' && slot.lembrete2Sent) return { sent: false, reason: 'JA_ENVIADO' };

  const ctx = {
    slot,
    paciente: slot.paciente,
    medicoNome: slot.medico?.usuario?.nome || 'Medico',
    localNome: slot.local?.nome,
    timezone: cfg?.timezone || 'America/Sao_Paulo',
  };

  let emailOk = false, pushOk = false, errors = [];

  // Tenta email
  try {
    const r = tipo === '24h' ? await tpl.enviarLembrete24h(ctx) : await tpl.enviarLembrete2h(ctx);
    if (r.sent) emailOk = true;
  } catch (e) {
    errors.push({ canal: 'email', erro: e.message });
  }

  // Tenta push (paralelo, nao bloqueia)
  try {
    if (slot.paciente?.id) {
      const titulo = tipo === '24h' ? 'Sua consulta e amanha' : `Em 2h: ${ctx.medicoNome}`;
      const body = `${require('./timezone').formatHumano(slot.inicio, ctx.timezone)} ${ctx.localNome ? '· ' + ctx.localNome : ''}`;
      const r = await pushSvc.enviarPara(slot.paciente.id, { titulo, body, slotId: slot.id });
      if (r.sent > 0) pushOk = true;
    }
  } catch (e) {
    errors.push({ canal: 'push', erro: e.message });
  }

  // Atualiza flag se pelo menos 1 canal funcionou
  if (emailOk || pushOk) {
    await prisma.agendaSlot.update({
      where: { id: slot.id },
      data: tipo === '24h'
        ? { lembrete24Sent: true, lembrete24SentAt: new Date() }
        : { lembrete2Sent: true, lembrete2SentAt: new Date() },
    });
  }

  return {
    sent: emailOk || pushOk,
    canais: { email: emailOk, push: pushOk },
    errors,
    reason: (emailOk || pushOk) ? 'OK' : 'TODOS_FALHARAM',
  };
}

// Buscar slots que precisam de lembrete agora (chamado pelo worker).
// Retorna lista pra processar.
async function listarLembretes24hPendentes(limiteAgoraMs = 0) {
  const agora = new Date();
  const em24h = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
  return prisma.agendaSlot.findMany({
    where: {
      status: { notIn: ['CANCELADA', 'REMARCADA'] },
      lembrete24Sent: false,
      inicio: { gt: agora, lte: em24h },
    },
    select: { id: true },
    take: 100,
  });
}

async function listarLembretes2hPendentes() {
  const agora = new Date();
  const em2h = new Date(agora.getTime() + 2 * 60 * 60 * 1000);
  return prisma.agendaSlot.findMany({
    where: {
      status: { notIn: ['CANCELADA', 'REMARCADA'] },
      lembrete2Sent: false,
      inicio: { gt: agora, lte: em2h },
    },
    select: { id: true },
    take: 100,
  });
}

module.exports = { enviar, listarLembretes24hPendentes, listarLembretes2hPendentes };
