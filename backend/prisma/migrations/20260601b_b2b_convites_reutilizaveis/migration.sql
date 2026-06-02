-- ============================================================
-- Migration: b2b_convites_reutilizaveis (link 1-pro-time-todo + rastreio de origem)
-- Data: 2026-06-01
-- Risco: ZERO/baixo — additive (CREATE TABLE/COLUMN IF NOT EXISTS) +
--        1 DROP NOT NULL numa coluna da tabela B2B (que esta VAZIA -> nao perde dado).
-- Aplicar MANUAL:
--   railway run npx prisma db execute --file prisma/migrations/20260601b_b2b_convites_reutilizaveis/migration.sql --schema prisma/schema.prisma
-- Reverter:
--   DROP TABLE IF EXISTS convites_empresa CASCADE;  ALTER TABLE vinculos_empresa DROP COLUMN IF EXISTS convite_id;
-- ============================================================

-- ---- LINK REUTILIZAVEL (1 link = time todo; label = origem do convite) ----
CREATE TABLE IF NOT EXISTS "convites_empresa" (
  "id"         TEXT PRIMARY KEY,
  "empresa_id" TEXT NOT NULL,
  "token"      TEXT NOT NULL,
  "label"      TEXT,
  "ativo"      BOOLEAN NOT NULL DEFAULT true,
  "expira_em"  TIMESTAMPTZ,
  "criado_em"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "convites_empresa_token_key" ON "convites_empresa" ("token");
CREATE INDEX IF NOT EXISTS "convites_empresa_empresa_id_idx" ON "convites_empresa" ("empresa_id");
DO $$ BEGIN
  ALTER TABLE "convites_empresa" ADD CONSTRAINT "convites_empresa_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---- RASTREIO: de qual link cada funcionario veio (coluna nova, nullable) ----
ALTER TABLE "vinculos_empresa" ADD COLUMN IF NOT EXISTS "convite_id" TEXT;
DO $$ BEGIN
  ALTER TABLE "vinculos_empresa" ADD CONSTRAINT "vinculos_empresa_convite_id_fkey"
    FOREIGN KEY ("convite_id") REFERENCES "convites_empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---- O token proprio do vinculo virou opcional (o link agora pertence a empresa). Tabela vazia: sem risco. ----
ALTER TABLE "vinculos_empresa" ALTER COLUMN "convite_token" DROP NOT NULL;
