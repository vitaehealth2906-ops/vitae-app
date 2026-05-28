-- ============================================================
-- Migration: eventos_medico (telemetria comportamental do beta)
-- Data: 2026-05-28
-- Risco: ZERO — CREATE TABLE IF NOT EXISTS, idempotente
-- Reverter: DROP TABLE IF EXISTS eventos_medico CASCADE;
-- ============================================================

CREATE TABLE IF NOT EXISTS eventos_medico (
  id            TEXT PRIMARY KEY,
  medico_id     TEXT NOT NULL,
  tipo          TEXT NOT NULL,
  recurso_tipo  TEXT,
  recurso_id    TEXT,
  rota          TEXT,
  metodo        TEXT,
  payload       JSONB,
  ip_hash       TEXT,
  user_agent    TEXT,
  duracao_ms    INTEGER,
  status        INTEGER,
  criado_em     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS eventos_medico_medico_criado_idx
  ON eventos_medico (medico_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS eventos_medico_tipo_criado_idx
  ON eventos_medico (tipo, criado_em DESC);

CREATE INDEX IF NOT EXISTS eventos_medico_criado_idx
  ON eventos_medico (criado_em DESC);
