const express = require('express');
const prisma = require('../utils/prisma');
const { verificarAuth } = require('../middleware/auth');

const router = express.Router();

router.use(verificarAuth);

// ---------------------------------------------------------------------------
// GET / — Timeline completa de saude do usuario
// ---------------------------------------------------------------------------

router.get('/', async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id;

    const [exames, medicamentos, alergias, agendamentos, checkins] = await Promise.all([
      prisma.exame.findMany({
        where: { usuarioId },
        select: {
          id: true, tipoExame: true, laboratorio: true, dataExame: true,
          statusGeral: true, resumoIA: true, criadoEm: true,
        },
        orderBy: { dataExame: 'desc' },
        take: 50,
      }),
      prisma.medicamento.findMany({
        where: { usuarioId },
        select: { id: true, nome: true, dosagem: true, dataInicio: true, ativo: true, criadoEm: true },
        orderBy: { criadoEm: 'desc' },
      }),
      prisma.alergia.findMany({
        where: { usuarioId },
        select: { id: true, nome: true, tipo: true, gravidade: true, criadoEm: true },
        orderBy: { criadoEm: 'desc' },
      }),
      prisma.agendamento.findMany({
        where: { usuarioId },
        select: { id: true, titulo: true, tipo: true, dataHora: true, local: true, medico: true },
        orderBy: { dataHora: 'desc' },
        take: 20,
      }),
      prisma.checkinSemanal.findMany({
        where: { usuarioId },
        select: { id: true, sonoQualidade: true, humor: true, criadoEm: true },
        orderBy: { criadoEm: 'desc' },
        take: 12,
      }),
    ]);

    // Montar timeline unificada
    const eventos = [];

    exames.forEach((e) => {
      eventos.push({
        tipo: 'EXAME',
        id: e.id,
        titulo: e.tipoExame || 'Exame',
        subtitulo: e.laboratorio,
        status: e.statusGeral,
        resumo: e.resumoIA,
        data: e.dataExame || e.criadoEm,
      });
    });

    medicamentos.forEach((m) => {
      eventos.push({
        tipo: 'MEDICAMENTO',
        id: m.id,
        titulo: m.nome,
        subtitulo: m.dosagem,
        status: m.ativo ? 'ATIVO' : 'INATIVO',
        data: m.dataInicio || m.criadoEm,
      });
    });

    alergias.forEach((a) => {
      eventos.push({
        tipo: 'ALERGIA',
        id: a.id,
        titulo: a.nome,
        subtitulo: a.tipo,
        status: a.gravidade,
        data: a.criadoEm,
      });
    });

    agendamentos.forEach((a) => {
      eventos.push({
        tipo: 'AGENDAMENTO',
        id: a.id,
        titulo: a.titulo,
        subtitulo: `${a.tipo} — ${a.local || ''}`,
        status: a.dataHora > new Date() ? 'FUTURO' : 'PASSADO',
        data: a.dataHora,
      });
    });

    checkins.forEach((c) => {
      eventos.push({
        tipo: 'CHECKIN',
        id: c.id,
        titulo: 'Check-in Semanal',
        subtitulo: `Sono: ${c.sonoQualidade || '-'} | Humor: ${c.humor || '-'}`,
        data: c.criadoEm,
      });
    });

    // Ordenar por data desc
    eventos.sort((a, b) => new Date(b.data) - new Date(a.data));

    return res.status(200).json({ timeline: eventos });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
