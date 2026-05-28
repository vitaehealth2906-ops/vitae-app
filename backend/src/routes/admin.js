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

// ── GET /admin/medicos-recentes — ultimos N medicos cadastrados ─
// Uso: acompanhar beta. Retorna email/nome/CRM dos N mais recentes.
// Query: ?limit=N (default 10, max 50), ?desde=YYYY-MM-DD (opcional)
router.get('/medicos-recentes', exigirAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const desde = req.query.desde ? new Date(req.query.desde) : null;
    const where = { tipo: 'MEDICO' };
    if (desde && !isNaN(desde.getTime())) {
      where.criadoEm = { gte: desde };
    }
    const medicos = await prisma.usuario.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      take: limit,
      select: {
        id: true,
        email: true,
        nome: true,
        celular: true,
        status: true,
        criadoEm: true,
        ultimoLogin: true,
        medico: {
          select: { crm: true, ufCrm: true, especialidade: true, clinica: true, criadoEm: true },
        },
      },
    });
    res.json({ total: medicos.length, medicos });
  } catch (e) {
    next(e);
  }
});

// ── GET /admin/eventos-medico/:id — timeline de eventos do medico ─
// Query: ?desde=ISO  ?ate=ISO  ?tipo=LOGIN,HEARTBEAT  ?limit=N (max 500)
router.get('/eventos-medico/:id', exigirAdmin, async (req, res, next) => {
  try {
    const medicoId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const tipos = req.query.tipo ? String(req.query.tipo).split(',').map(s => s.trim()).filter(Boolean) : null;
    const desde = req.query.desde ? new Date(req.query.desde) : null;
    const ate = req.query.ate ? new Date(req.query.ate) : null;

    const filtros = ['medico_id = $1'];
    const params = [medicoId];
    let idx = 2;
    if (desde && !isNaN(desde.getTime())) { filtros.push(`criado_em >= $${idx++}`); params.push(desde); }
    if (ate && !isNaN(ate.getTime())) { filtros.push(`criado_em <= $${idx++}`); params.push(ate); }
    if (tipos && tipos.length > 0) {
      const placeholders = tipos.map(() => `$${idx++}`).join(',');
      filtros.push(`tipo IN (${placeholders})`);
      params.push(...tipos);
    }

    const sql = `
      SELECT id, tipo, recurso_tipo, recurso_id, rota, metodo, payload,
             ip_hash, user_agent, duracao_ms, status, criado_em
      FROM eventos_medico
      WHERE ${filtros.join(' AND ')}
      ORDER BY criado_em DESC
      LIMIT ${limit}
    `;
    const eventos = await prisma.$queryRawUnsafe(sql, ...params);
    res.json({ total: eventos.length, eventos });
  } catch (e) {
    // Se tabela ainda nao foi criada (boot do Railway nao rodou migration), responde vazio
    if (e.message?.includes('eventos_medico') || e.code === '42P01') {
      return res.json({ total: 0, eventos: [], aviso: 'Tabela eventos_medico ainda nao foi criada (aguarde redeploy)' });
    }
    next(e);
  }
});

// ── GET /admin/medico-status/:id — agregado de status (online?, ultima acao, stats 24h)
router.get('/medico-status/:id', exigirAdmin, async (req, res, next) => {
  try {
    const medicoId = req.params.id;
    const ONLINE_TTL_SEC = parseInt(req.query.online_ttl, 10) || 90; // online se ultimo evento < 90s

    // Busca em paralelo
    const [usuario, ultimo, stats24h, porTipo24h, ultimos5] = await Promise.all([
      prisma.usuario.findUnique({
        where: { id: medicoId },
        select: { id: true, email: true, nome: true, criadoEm: true, ultimoLogin: true,
                  medico: { select: { crm: true, ufCrm: true, especialidade: true, clinica: true } } },
      }),
      prisma.$queryRawUnsafe(
        `SELECT tipo, criado_em FROM eventos_medico WHERE medico_id = $1 ORDER BY criado_em DESC LIMIT 1`,
        medicoId
      ).catch(() => []),
      prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS n FROM eventos_medico WHERE medico_id = $1 AND criado_em > NOW() - INTERVAL '24 hours'`,
        medicoId
      ).catch(() => [{ n: 0 }]),
      prisma.$queryRawUnsafe(
        `SELECT tipo, COUNT(*)::int AS n FROM eventos_medico WHERE medico_id = $1 AND criado_em > NOW() - INTERVAL '24 hours' GROUP BY tipo ORDER BY n DESC`,
        medicoId
      ).catch(() => []),
      prisma.$queryRawUnsafe(
        `SELECT tipo, rota, criado_em FROM eventos_medico WHERE medico_id = $1 ORDER BY criado_em DESC LIMIT 5`,
        medicoId
      ).catch(() => []),
    ]);

    const ultimaAtividade = ultimo[0]?.criado_em || null;
    const segundosDesdeUltimo = ultimaAtividade
      ? Math.floor((Date.now() - new Date(ultimaAtividade).getTime()) / 1000)
      : null;
    const online = segundosDesdeUltimo !== null && segundosDesdeUltimo <= ONLINE_TTL_SEC;

    res.json({
      usuario,
      online,
      online_ttl_segundos: ONLINE_TTL_SEC,
      ultima_atividade: ultimaAtividade,
      segundos_desde_ultima: segundosDesdeUltimo,
      acoes_24h: stats24h[0]?.n || 0,
      por_tipo_24h: porTipo24h,
      ultimos_5: ultimos5,
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
