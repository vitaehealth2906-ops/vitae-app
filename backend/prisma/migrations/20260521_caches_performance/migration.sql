-- Migration: caches de performance (Fase 2 + Fase 3 do plano profissionalismo 21-mai-2026)
-- Cria 4 tabelas novas. Todas idempotentes (IF NOT EXISTS).
-- ZERO RISCO: só CREATE TABLE/INDEX. Reversível com DROP TABLE.
--
-- Aplicar:
--   railway run psql $DATABASE_URL -f backend/prisma/migrations/20260521_caches_performance/migration.sql
--
-- Verificar:
--   railway run psql $DATABASE_URL -c "\dt cache_*"
--   railway run psql $DATABASE_URL -c "\dt ia_collab_cache"
--
-- Rollback (se necessário):
--   DROP TABLE IF EXISTS ia_collab_cache;
--   DROP TABLE IF EXISTS cache_info_medicamento;
--   DROP TABLE IF EXISTS cache_info_alergia;
--   DROP TABLE IF EXISTS cache_melhorias_score;

-- ============================================================
-- 1) IA Collab Cache (Fase 2 — "caso Daniel")
-- ============================================================
CREATE TABLE IF NOT EXISTS ia_collab_cache (
  id            TEXT NOT NULL PRIMARY KEY,
  paciente_id   TEXT NOT NULL,
  medico_id     TEXT NOT NULL,
  pcs_hash      TEXT NOT NULL,
  versao_prompt TEXT NOT NULL DEFAULT 'v1',
  payload       JSONB NOT NULL,
  gerado_em     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ia_collab_cache_paciente_id_medico_id_key
  ON ia_collab_cache(paciente_id, medico_id);

CREATE INDEX IF NOT EXISTS ia_collab_cache_paciente_id_idx
  ON ia_collab_cache(paciente_id);

-- ============================================================
-- 2) Cache info IA — Medicamento (Fase 3)
-- ============================================================
CREATE TABLE IF NOT EXISTS cache_info_medicamento (
  id               TEXT NOT NULL PRIMARY KEY,
  nome_normalizado TEXT NOT NULL,
  versao_prompt    TEXT NOT NULL,
  payload          JSONB NOT NULL,
  hits             INTEGER NOT NULL DEFAULT 0,
  criado_em        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS cache_info_medicamento_nome_normalizado_versao_prompt_key
  ON cache_info_medicamento(nome_normalizado, versao_prompt);

-- ============================================================
-- 3) Cache info IA — Alergia (Fase 3)
-- ============================================================
CREATE TABLE IF NOT EXISTS cache_info_alergia (
  id               TEXT NOT NULL PRIMARY KEY,
  nome_normalizado TEXT NOT NULL,
  versao_prompt    TEXT NOT NULL,
  payload          JSONB NOT NULL,
  hits             INTEGER NOT NULL DEFAULT 0,
  criado_em        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS cache_info_alergia_nome_normalizado_versao_prompt_key
  ON cache_info_alergia(nome_normalizado, versao_prompt);

-- ============================================================
-- 4) Cache melhorias score (Fase 3)
-- ============================================================
CREATE TABLE IF NOT EXISTS cache_melhorias_score (
  id            TEXT NOT NULL PRIMARY KEY,
  usuario_id    TEXT NOT NULL,
  versao_prompt TEXT NOT NULL,
  score_hash    TEXT NOT NULL,
  payload       JSONB NOT NULL,
  criado_em     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS cache_melhorias_score_usuario_id_versao_prompt_score_hash_key
  ON cache_melhorias_score(usuario_id, versao_prompt, score_hash);

CREATE INDEX IF NOT EXISTS cache_melhorias_score_usuario_id_criado_em_idx
  ON cache_melhorias_score(usuario_id, criado_em);
