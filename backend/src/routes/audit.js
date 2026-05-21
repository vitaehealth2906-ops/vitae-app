// ============================================================
// /audit — endpoints de auditoria adicionais
// ============================================================
//
// POST /audit/view-cached
//   Registra leitura de dado clínico via cache local (frontend SWR).
//   Compliance CFM: rastreabilidade de acesso mantida mesmo quando
//   o dado vem do localStorage do paciente sem ida ao banco.
//
//   Fire-and-forget. Aceita 401 sem barulho (paciente sem JWT
//   nunca deveria estar acessando dado clínico cacheado).

const express = require('express');
const { verificarAuth } = require('../middleware/auth');
const { auditar } = require('../utils/auditoria');

const router = express.Router();

router.post('/view-cached', verificarAuth, async (req, res) => {
  try {
    const { path, key } = req.body || {};
    if (!path || !key) {
      return res.status(200).json({ ok: true, skipped: true });
    }
    // Auditar sem await — fire-and-forget. Resposta volta imediato.
    auditar(req, {
      acao: 'LEITURA_VIA_CACHE',
      recursoTipo: 'CACHE_SWR',
      recursoId: String(key),
      alvoId: req.usuario && req.usuario.id ? req.usuario.id : null,
      atorTipo: req.usuario && req.usuario.tipo ? req.usuario.tipo : 'PACIENTE',
      metadata: { path: String(path).slice(0, 200), key: String(key).slice(0, 100) },
    }).catch(() => {});
    res.status(200).json({ ok: true });
  } catch (_) {
    res.status(200).json({ ok: true });
  }
});

module.exports = router;
