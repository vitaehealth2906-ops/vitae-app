/**
 * admin.js — endpoints de observabilidade interna
 *
 * Protegido por ADMIN_TOKEN (header x-admin-token).
 * Lucas seta ADMIN_TOKEN no Railway e usa pra acessar o dashboard interno.
 *
 * Zero dado clinico: so contadores, status de fila, tamanhos agregados.
 */

const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { snapshot } = require('../services/observability');

// ── Middleware de admin ────────────────────────────────
function exigirAdmin(req, res, next) {
  const tokenEnviado = req.header('x-admin-token') || req.query.token;
  const tokenEsperado = process.env.ADMIN_TOKEN;

  if (!tokenEsperado) {
    return res.status(503).json({ erro: 'ADMIN_TOKEN nao configurado no servidor.' });
  }
  if (!tokenEnviado || tokenEnviado !== tokenEsperado) {
    return res.status(401).json({ erro: 'Token admin invalido.' });
  }
  next();
}

// ── GET /admin/health — saude geral do sistema ─────────
router.get('/health', exigirAdmin, async (req, res, next) => {
  try {
    // Testa conexao com o banco
    let dbOk = false;
    try {
      await prisma.$queryRawUnsafe('SELECT 1');
      dbOk = true;
    } catch (_e) {
      dbOk = false;
    }

    res.json({
      ok: dbOk,
      db: dbOk ? 'conectado' : 'offline',
      observability: snapshot(),
    });
  } catch (e) {
    next(e);
  }
});

// ── GET /admin/queue — estado da fila TarefaPendente ───
router.get('/queue', exigirAdmin, async (req, res, next) => {
  try {
    // Agregados (sem payload, sem dados clinicos)
    const [pendentes, mortas, processadas24h, porTipo, stuckLongos] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM tarefas_pendentes WHERE processado_em IS NULL AND dead = false`),
      prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM tarefas_pendentes WHERE dead = true`),
      prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM tarefas_pendentes WHERE processado_em > NOW() - INTERVAL '24 hours'`),
      prisma.$queryRawUnsafe(`SELECT tipo, COUNT(*)::int AS n FROM tarefas_pendentes WHERE processado_em IS NULL AND dead = false GROUP BY tipo`),
      prisma.$queryRawUnsafe(`SELECT id, tipo, tentativas, erro, criado_em FROM tarefas_pendentes WHERE dead = false AND processado_em IS NULL AND criado_em < NOW() - INTERVAL '30 minutes' ORDER BY criado_em ASC LIMIT 20`),
    ]);

    res.json({
      pendentes: pendentes[0]?.n || 0,
      mortas: mortas[0]?.n || 0,
      processadas_24h: processadas24h[0]?.n || 0,
      por_tipo: porTipo,
      stuck_30min_ou_mais: stuckLongos,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    next(e);
  }
});

// ── GET /admin/stats — contagem agregada (sem PII) ─────
router.get('/stats', exigirAdmin, async (req, res, next) => {
  try {
    const [usuarios, medicos, preConsultas24h, preConsultasTotal, examesTotal] = await Promise.all([
      prisma.usuario.count(),
      prisma.usuario.count({ where: { tipo: 'MEDICO' } }),
      prisma.preConsulta.count({ where: { criadoEm: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
      prisma.preConsulta.count(),
      prisma.exame.count(),
    ]);

    res.json({
      usuarios,
      medicos,
      pacientes: usuarios - medicos,
      preConsultas_24h: preConsultas24h,
      preConsultas_total: preConsultasTotal,
      exames_total: examesTotal,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    next(e);
  }
});

// ── GET /admin/audit — ultimas N aberturas de briefing (LGPD) ──
router.get('/audit', exigirAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const rows = await prisma.$queryRawUnsafe(
      `SELECT pre_consulta_id, medico_id, acao, criado_em FROM auditoria_briefing ORDER BY criado_em DESC LIMIT ${limit}`
    );
    res.json({ total: rows.length, eventos: rows });
  } catch (e) {
    next(e);
  }
});

// ── POST /admin/backfill-nivel — calcula nivelBriefing pras pre-consultas antigas
// Idempotente: so toca quem esta com nivel_briefing = null.
router.post('/backfill-nivel', exigirAdmin, async (req, res, next) => {
  try {
    const { validarFoto, validarAudio, validarTranscricao, validarResultadoIA, calcularNivel } = require('../services/briefing');
    const antigas = await prisma.preConsulta.findMany({
      where: { nivelBriefing: null },
      select: {
        id: true,
        pacienteFotoUrl: true,
        audioUrl: true,
        transcricao: true,
        summaryJson: true,
        audioSummaryUrl: true,
        respostas: true,
      },
      take: 500, // batch
    });

    let atualizadas = 0;
    for (const pc of antigas) {
      const st = {
        statusFoto: validarFoto(pc.pacienteFotoUrl).ok ? 'ok' : 'ausente',
        statusAudio: validarAudio(pc.audioUrl).ok ? 'ok' : 'ausente',
        statusTranscricao: validarTranscricao(pc.transcricao).ok ? 'ok' : (pc.audioUrl ? 'falhou' : 'sem_audio'),
        statusResumoIa: 'falhou',
        statusAudioResumo: pc.audioSummaryUrl ? 'ok' : 'falhou',
        temTexto: !!(pc.respostas && Object.keys(pc.respostas).length > 1),
      };
      if (pc.summaryJson) {
        const v = validarResultadoIA(pc.summaryJson);
        st.statusResumoIa = v.ok ? (v.nivel === 'parcial' ? 'parcial' : 'ok') : 'falhou';
      }
      const nivel = calcularNivel(st);
      try {
        await prisma.preConsulta.update({
          where: { id: pc.id },
          data: {
            nivelBriefing: nivel,
            statusResumoIa: st.statusResumoIa,
            statusAudioResumo: st.statusAudioResumo,
            statusTranscricao: st.statusTranscricao,
            statusFoto: st.statusFoto,
            statusAudio: st.statusAudio,
          },
        });
        atualizadas++;
      } catch (_e) {/* pula */}
    }

    res.json({ ok: true, encontradas: antigas.length, atualizadas });
  } catch (e) {
    next(e);
  }
});

// ── POST /admin/queue/:id/retry — forca retry de tarefa morta ──
router.post('/queue/:id/retry', exigirAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await prisma.$executeRawUnsafe(
      `UPDATE tarefas_pendentes SET dead = false, tentativas = 0, proxima_tentativa = NOW(), erro = NULL WHERE id = $1`,
      id
    );
    res.json({ ok: true, updated });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
