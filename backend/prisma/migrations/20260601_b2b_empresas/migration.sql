-- ============================================================
-- Migration: b2b_empresas (Fundacao B2B — empresa + vinculo por convite)
-- Data: 2026-06-01
-- Risco: ZERO — additive-only, CREATE TABLE/INDEX IF NOT EXISTS, idempotente.
--        FKs em blocos DO $$ ... EXCEPTION WHEN duplicate_object — re-executavel.
-- Aplicar MANUAL (NUNCA --accept-data-loss, NUNCA no build do Railway):
--   cd backend
--   railway run psql $DATABASE_URL -f prisma/migrations/20260601_b2b_empresas/migration.sql
-- Reverter:
--   DROP TABLE IF EXISTS vinculos_empresa CASCADE; DROP TABLE IF EXISTS empresas CASCADE;
-- ============================================================

-- ---- EMPRESAS ----
CREATE TABLE IF NOT EXISTS "empresas" (
  "id"            TEXT PRIMARY KEY,
  "nome"          TEXT NOT NULL,
  "cnpj"          TEXT,
  "dono_id"       TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'ATIVA',
  "criado_em"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- VINCULOS EMPRESA <-> PACIENTE ----
CREATE TABLE IF NOT EXISTS "vinculos_empresa" (
  "id"                TEXT PRIMARY KEY,
  "empresa_id"        TEXT NOT NULL,
  "paciente_id"       TEXT,
  "status"            TEXT NOT NULL DEFAULT 'CONVIDADO',
  "convite_token"     TEXT NOT NULL,
  "convite_expira_em" TIMESTAMPTZ,
  "entrou_em"         TIMESTAMPTZ,
  "saiu_em"           TIMESTAMPTZ,
  "criado_em"         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- INDICES UNICOS (idempotentes) ----
CREATE UNIQUE INDEX IF NOT EXISTS "empresas_cnpj_key"
  ON "empresas" ("cnpj");

CREATE UNIQUE INDEX IF NOT EXISTS "vinculos_empresa_convite_token_key"
  ON "vinculos_empresa" ("convite_token");

CREATE UNIQUE INDEX IF NOT EXISTS "vinculos_empresa_empresa_id_paciente_id_key"
  ON "vinculos_empresa" ("empresa_id", "paciente_id");

-- ---- INDICES DE BUSCA ----
CREATE INDEX IF NOT EXISTS "empresas_dono_id_idx"
  ON "empresas" ("dono_id");

CREATE INDEX IF NOT EXISTS "vinculos_empresa_convite_token_idx"
  ON "vinculos_empresa" ("convite_token");

-- ---- FOREIGN KEYS (cada uma em bloco re-executavel) ----
DO $$ BEGIN
  ALTER TABLE "empresas"
    ADD CONSTRAINT "empresas_dono_id_fkey"
    FOREIGN KEY ("dono_id") REFERENCES "usuarios" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "vinculos_empresa"
    ADD CONSTRAINT "vinculos_empresa_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "vinculos_empresa"
    ADD CONSTRAINT "vinculos_empresa_paciente_id_fkey"
    FOREIGN KEY ("paciente_id") REFERENCES "usuarios" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
