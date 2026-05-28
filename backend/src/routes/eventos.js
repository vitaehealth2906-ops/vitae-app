/**
 * eventos.js — rotas publicas (autenticadas) pra telemetria comportamental
 *
 * - POST /eventos/ping  — heartbeat do app do medico. Registra HEARTBEAT no banco.
 * - POST /eventos/view  — opcional: medico avisa que abriu uma view especifica.
 *
 * Tudo passa pelo trackerMedico global que ja registra. /ping existe so pra
 * dar o evento HEARTBEAT explicito (rota dedicada — fica facil filtrar).
 */

const express = require('express');
const router = express.Router();
const { verificarAuth } = require('../middleware/auth');

// ── POST /eventos/ping — heartbeat ─────────────────────
// Chamado pelo app-v2.html a cada 30s. O tracker global ja registra
// o evento HEARTBEAT automaticamente (rota /eventos/ping mapeada).
router.post('/ping', verificarAuth, (_req, res) => {
  res.json({ ok: true, t: Date.now() });
});

// ── POST /eventos/view — registra abertura de view especifica ──
// Opcional. Body: { view: "hoje" | "pre-consultas" | "pacientes" | etc }
// Tracker global registra como NAVEGACAO; body fica em payload via service direto.
const { registrarEventoMedico, ehMedico, hashIp, curtarUserAgent } = require('../services/eventosMedico');
router.post('/view', verificarAuth, async (req, res) => {
  const view = String(req.body?.view || '').slice(0, 50);
  if (!view) return res.status(400).json({ erro: 'view obrigatoria' });
  // Bypass do tracker (que ja registra como NAVEGACAO generica) — aqui registramos com payload
  const userId = req.user.id;
  if (await ehMedico(userId)) {
    const ipRaw = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    registrarEventoMedico({
      medicoId: userId,
      tipo: 'NAVEGACAO',
      recursoTipo: 'VIEW',
      recursoId: view,
      rota: 'POST /eventos/view',
      metodo: 'POST',
      payload: { view },
      ipHash: hashIp(ipRaw),
      userAgent: curtarUserAgent(req.headers['user-agent']),
      status: 200,
    });
  }
  res.json({ ok: true });
});

module.exports = router;
