// Finalizacao de atendimento (com ou sem retorno).
// Transacao atomica: PreConsulta.status=FINALIZADA + cria/atualiza AgendaSlot retorno se aplicavel.

const prisma = require('../../utils/prisma');
const slotsSvc = require('./slots');

// finalizar(preConsultaId, { comRetorno, slotInicio?, slotFim?, slotDuracaoMin?, slotLocalId?, slotMotivo?, attemptId? }, usuarioId)
async function finalizar(preConsultaId, opts, usuarioId) {
  const pc = await prisma.preConsulta.findUnique({
    where: { id: preConsultaId },
    select: { id: true, medicoId: true, pacienteId: true, pacienteNome: true,
              pacienteTel: true, pacienteEmail: true, status: true, finalizadaEm: true },
  });
  if (!pc) return { ok: false, code: 'NOT_FOUND', message: 'Pre-consulta nao encontrada.' };
  if (pc.status === 'FINALIZADA') {
    return { ok: false, code: 'JA_FINALIZADA', message: 'Pre-consulta ja foi finalizada.' };
  }
  if (pc.status !== 'RESPONDIDA') {
    return { ok: false, code: 'STATUS_INVALIDO',
      message: 'Apenas pre-consultas respondidas podem ser finalizadas.' };
  }

  return await prisma.$transaction(async (tx) => {
    // Atualiza PreConsulta
    let retornoSlotId = null;

    if (opts.comRetorno) {
      // Validacao basica
      if (!opts.slotInicio || !opts.slotFim || !opts.slotDuracaoMin) {
        return { ok: false, code: 'PAYLOAD_INVALIDO',
          message: 'Pra marcar retorno, precisa slotInicio/slotFim/slotDuracaoMin.' };
      }

      // Cria slot via service (ja tem lock+conflito+idempotencia)
      // Como estamos em tx, chamar slotsSvc.criarSlot inicia outra tx? Nao — Prisma aninha.
      // Pra simplificar: cria direto aqui (sem o lock pq estamos em tx ja).
      // Conflito: faz busca direto.
      const conflito = await tx.agendaSlot.findFirst({
        where: {
          medicoId: pc.medicoId,
          status: { notIn: ['CANCELADA', 'REMARCADA'] },
          AND: [
            { inicio: { lt: new Date(opts.slotFim) } },
            { fim: { gt: new Date(opts.slotInicio) } },
          ],
        },
      });
      if (conflito) {
        return { ok: false, code: 'CONFLITO_AGENDA',
          message: 'Conflito com outro horario.', slotConflitante: conflito };
      }

      const slot = await tx.agendaSlot.create({
        data: {
          medicoId: pc.medicoId,
          pacienteId: pc.pacienteId,
          pacienteNomeLivre: pc.pacienteId ? null : pc.pacienteNome,
          pacienteTelLivre: pc.pacienteId ? null : pc.pacienteTel,
          localId: opts.slotLocalId || null,
          inicio: new Date(opts.slotInicio),
          fim: new Date(opts.slotFim),
          duracaoMin: opts.slotDuracaoMin,
          tipo: 'RETORNO',
          status: 'AGUARDANDO_CONFIRMACAO',
          motivo: opts.slotMotivo || 'Retorno',
          origem: 'RETORNO_PRE_CONSULTA',
          preConsultaId: pc.id,
          attemptId: opts.attemptId || null,
          criadoPor: usuarioId,
        },
      });
      retornoSlotId = slot.id;
    }

    const pcAtualizada = await tx.preConsulta.update({
      where: { id: preConsultaId },
      data: {
        status: 'FINALIZADA',
        finalizadaEm: new Date(),
        finalizadaPor: usuarioId,
        retornoSlotId,
      },
    });

    return { ok: true, data: { preConsulta: pcAtualizada, retornoSlotId } };
  });
}

// Desfazer finalizacao (sem janela rigida — medico pode reverter ate 24h)
async function desfazerFinalizacao(preConsultaId, usuarioId) {
  const pc = await prisma.preConsulta.findUnique({
    where: { id: preConsultaId },
    select: { id: true, status: true, finalizadaEm: true, retornoSlotId: true, medicoId: true },
  });
  if (!pc) return { ok: false, code: 'NOT_FOUND' };
  if (pc.status !== 'FINALIZADA') {
    return { ok: false, code: 'NAO_FINALIZADA' };
  }

  // Aceita desfazer ate 24h depois (alem do toast 10s, recovery longo se medico esquecer)
  const dias1 = 24 * 60 * 60 * 1000;
  if (pc.finalizadaEm && Date.now() - pc.finalizadaEm.getTime() > dias1) {
    return { ok: false, code: 'JANELA_EXPIROU',
      message: 'Janela de desfazer expirou (24h). Marque retorno como nova consulta se precisar.' };
  }

  return await prisma.$transaction(async (tx) => {
    // Cancela slot de retorno se existir
    if (pc.retornoSlotId) {
      await tx.agendaSlot.update({
        where: { id: pc.retornoSlotId },
        data: {
          status: 'CANCELADA',
          cancelamentoMotivo: 'Finalizacao desfeita',
          cancelamentoPor: usuarioId,
          cancelamentoEm: new Date(),
        },
      });
    }

    const pcAtualizada = await tx.preConsulta.update({
      where: { id: preConsultaId },
      data: {
        status: 'RESPONDIDA',
        finalizadaEm: null,
        finalizadaPor: null,
        retornoSlotId: null,
      },
    });

    return { ok: true, data: pcAtualizada };
  });
}

// Algoritmo de sugestao de slot retorno.
// Score: prefere mesmo dia da semana, mesmo turno (manha/tarde), evita historico de falta.
async function sugerirRetorno(medicoId, pacienteId, prazoDias = 15) {
  const config = await prisma.configAgenda.findUnique({ where: { medicoId } });
  const duracao = config?.duracaoPadraoMin || 30;
  const horaIni = config?.horarioInicio || '08:00';
  const horaFim = config?.horarioFim || '18:00';
  const almocoIni = config?.almocoInicio || '12:00';
  const almocoFim = config?.almocoFim || '13:30';

  // Buscar ultima consulta do paciente pra herdar dia da semana e turno
  let dowPreferido = null;
  let turnoPreferido = null;
  if (pacienteId) {
    const ultima = await prisma.agendaSlot.findFirst({
      where: { pacienteId, medicoId, status: { in: ['COMPARECEU', 'CONFIRMADA'] } },
      orderBy: { inicio: 'desc' },
      select: { inicio: true },
    });
    if (ultima) {
      dowPreferido = ultima.inicio.getDay();
      const h = ultima.inicio.getHours();
      turnoPreferido = h < 12 ? 'MANHA' : 'TARDE';
    }
  }

  // Janela: prazoDias - 3 ate prazoDias + 3
  const inicio = new Date(Date.now() + (prazoDias - 3) * 24 * 60 * 60 * 1000);
  const fim = new Date(Date.now() + (prazoDias + 3) * 24 * 60 * 60 * 1000);

  // Listar todos os slots ocupados nesse range
  const ocupados = await prisma.agendaSlot.findMany({
    where: {
      medicoId,
      inicio: { gte: inicio, lte: fim },
      status: { notIn: ['CANCELADA', 'REMARCADA'] },
    },
    select: { inicio: true, fim: true },
    orderBy: { inicio: 'asc' },
  });

  const diasAtendimento = (config?.diasAtendimento || '1,2,3,4,5').split(',').map(s => parseInt(s));

  // Gerar candidatos: pra cada dia no range, gerar slots de duracao em duracao
  const candidatos = [];
  const cur = new Date(inicio);
  cur.setSeconds(0, 0);

  while (cur <= fim) {
    // ISO weekday: 1=seg..7=dom. JS getDay: 0=dom..6=sab
    const isoDow = cur.getDay() === 0 ? 7 : cur.getDay();
    if (diasAtendimento.includes(isoDow)) {
      const [hi, mi] = horaIni.split(':').map(Number);
      const [hf, mf] = horaFim.split(':').map(Number);
      const inicioDia = new Date(cur); inicioDia.setHours(hi, mi, 0, 0);
      const fimDia = new Date(cur); fimDia.setHours(hf, mf, 0, 0);

      const tInicio = new Date(inicioDia);
      while (tInicio < fimDia) {
        const tFim = new Date(tInicio.getTime() + duracao * 60 * 1000);
        if (tFim > fimDia) break;

        // Pula almoco
        const [ai, am] = (almocoIni || '00:00').split(':').map(Number);
        const [afh, afm] = (almocoFim || '00:00').split(':').map(Number);
        const almocoIniHoje = new Date(cur); almocoIniHoje.setHours(ai, am, 0, 0);
        const almocoFimHoje = new Date(cur); almocoFimHoje.setHours(afh, afm, 0, 0);
        const noAlmoco = tInicio < almocoFimHoje && tFim > almocoIniHoje;

        if (!noAlmoco) {
          // Verifica se ocupado
          const conflita = ocupados.some(o => o.inicio < tFim && o.fim > tInicio);
          if (!conflita && tInicio > new Date()) {
            // Score
            let score = 0;
            if (dowPreferido !== null && tInicio.getDay() === dowPreferido) score += 30;
            if (turnoPreferido) {
              const t = tInicio.getHours() < 12 ? 'MANHA' : 'TARDE';
              if (t === turnoPreferido) score += 20;
            }
            // Penaliza distancia do prazo ideal
            const diasReal = (tInicio.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
            score -= Math.abs(diasReal - prazoDias) * 5;

            candidatos.push({
              inicio: tInicio.toISOString(),
              fim: tFim.toISOString(),
              duracaoMin: duracao,
              score,
            });
          }
        }
        tInicio.setMinutes(tInicio.getMinutes() + duracao);
      }
    }
    cur.setDate(cur.getDate() + 1);
    cur.setHours(0, 0, 0, 0);
  }

  candidatos.sort((a, b) => b.score - a.score);
  const melhor = candidatos[0] || null;
  const alternativos = candidatos.slice(1, 6); // 5 alternativas

  return { ok: true, data: { sugerido: melhor, alternativos } };
}

module.exports = { finalizar, desfazerFinalizacao, sugerirRetorno };
