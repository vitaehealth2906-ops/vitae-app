// Lista de espera. Quando slot abre por cancelamento, oferece pro proximo da fila
// que match com criterio (preferencia + prioridade).

const prisma = require('../../utils/prisma');
const tpl = require('./email-templates');
const { hmacToken } = require('./crypto');

async function adicionar(medicoId, payload, criadoPor) {
  return prisma.listaEspera.create({
    data: {
      medicoId,
      pacienteId: payload.pacienteId || null,
      pacienteNome: payload.pacienteNome || null,
      pacienteTel: payload.pacienteTel || null,
      pacienteEmail: payload.pacienteEmail || null,
      motivo: payload.motivo || null,
      preferencia: payload.preferencia || 'QUALQUER',
      prioridade: payload.prioridade || 'NORMAL',
      criadoPor,
    },
  });
}

async function listar(medicoId) {
  return prisma.listaEspera.findMany({
    where: { medicoId, status: { in: ['AGUARDANDO', 'OFERTADO'] } },
    include: { paciente: { select: { id: true, nome: true, fotoUrl: true, email: true, celular: true } } },
    orderBy: [
      // URGENTE > ALTA > NORMAL — mas Prisma nao tem enum order; usamos calculado
      { criadoEm: 'asc' },
    ],
  });
}

async function remover(esperaId) {
  return prisma.listaEspera.update({
    where: { id: esperaId },
    data: { status: 'DESCARTADO', resolvidoEm: new Date() },
  });
}

// Quando um slot abre (por cancelamento), tenta ofertar pra alguem da lista.
async function tentarOfertar(slotId) {
  const slot = await prisma.agendaSlot.findUnique({
    where: { id: slotId },
    include: { medico: { include: { usuario: true, configAgenda: true } }, local: true },
  });
  if (!slot) return { sent: 0 };

  // Determinar turno
  const h = slot.inicio.getHours();
  const turno = h < 12 ? 'MANHA' : 'TARDE';

  // Buscar candidatos AGUARDANDO ordenando por urgencia + criadoEm
  const candidatos = await prisma.listaEspera.findMany({
    where: {
      medicoId: slot.medicoId,
      status: 'AGUARDANDO',
      OR: [
        { preferencia: 'QUALQUER' },
        { preferencia: turno },
      ],
    },
    include: { paciente: { select: { email: true, nome: true } } },
    orderBy: { criadoEm: 'asc' },
  });

  // Ordenar por prioridade
  const prioOrder = { URGENTE: 0, ALTA: 1, NORMAL: 2 };
  candidatos.sort((a, b) => (prioOrder[a.prioridade] || 99) - (prioOrder[b.prioridade] || 99));

  if (candidatos.length === 0) return { sent: 0, reason: 'SEM_CANDIDATOS' };

  const escolhido = candidatos[0];
  const email = escolhido.paciente?.email || escolhido.pacienteEmail;
  if (!email) {
    // Sem email = nao consegue ofertar. Marca pra secretaria ligar?
    return { sent: 0, reason: 'CANDIDATO_SEM_EMAIL', candidato: escolhido };
  }

  const tk = hmacToken(`${escolhido.id}:${slot.id}`);

  await tpl.enviarOfertaVaga({
    emailDestino: email,
    slot,
    medicoNome: slot.medico?.usuario?.nome || 'Medico',
    localNome: slot.local?.nome,
    timezone: slot.medico?.configAgenda?.timezone || 'America/Sao_Paulo',
    listaEsperaToken: `${escolhido.id}:${tk}`,
  });

  await prisma.listaEspera.update({
    where: { id: escolhido.id },
    data: {
      status: 'OFERTADO',
      ofertaSlotId: slot.id,
      ofertaEnviadaEm: new Date(),
    },
  });

  return { sent: 1, esperaId: escolhido.id };
}

// Paciente aceita oferta via link do email
async function aceitarOferta(esperaId, token, pacienteUsuarioId) {
  const espera = await prisma.listaEspera.findUnique({
    where: { id: esperaId },
    include: { medico: true },
  });
  if (!espera || espera.status !== 'OFERTADO' || !espera.ofertaSlotId) {
    return { ok: false, code: 'OFERTA_INDISPONIVEL' };
  }

  const expectedToken = hmacToken(`${esperaId}:${espera.ofertaSlotId}`);
  if (token !== expectedToken) {
    return { ok: false, code: 'TOKEN_INVALIDO' };
  }

  const slot = await prisma.agendaSlot.findUnique({ where: { id: espera.ofertaSlotId } });
  if (!slot || slot.status !== 'CANCELADA' && slot.pacienteId) {
    return { ok: false, code: 'SLOT_NAO_DISPONIVEL' };
  }

  return await prisma.$transaction(async (tx) => {
    // Cria slot novo (em vez de reusar o cancelado)
    const novoSlot = await tx.agendaSlot.create({
      data: {
        medicoId: slot.medicoId,
        pacienteId: pacienteUsuarioId || espera.pacienteId,
        pacienteNomeLivre: pacienteUsuarioId ? null : espera.pacienteNome,
        pacienteTelLivre: pacienteUsuarioId ? null : espera.pacienteTel,
        localId: slot.localId,
        inicio: slot.inicio,
        fim: slot.fim,
        duracaoMin: slot.duracaoMin,
        tipo: slot.tipo,
        status: 'CONFIRMADA',
        motivo: espera.motivo || 'Encaixe lista de espera',
        origem: 'LISTA_ESPERA',
        criadoPor: pacienteUsuarioId || espera.criadoPor,
      },
    });

    await tx.listaEspera.update({
      where: { id: esperaId },
      data: { status: 'CONFIRMADO', resolvidoEm: new Date() },
    });

    return { ok: true, data: novoSlot };
  });
}

module.exports = { adicionar, listar, remover, tentarOfertar, aceitarOferta };
