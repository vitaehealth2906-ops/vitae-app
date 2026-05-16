-- Migration: Proximo Retorno (Fase 1)
-- Data: 2026-05-16
-- Risco: ZERO (ADD COLUMN nullable, sem drop, sem alteracao de dados existentes)
-- Reversivel: sim, via DROP COLUMN dos 6 campos
--
-- Aplicacao MANUAL via Railway CLI:
--   1. railway login
--   2. cd backend
--   3. railway run psql $DATABASE_URL -f prisma/migrations/20260516_proximo_retorno/migration.sql
--   4. railway run npx prisma generate
--
-- Backup OBRIGATORIO antes de aplicar:
--   railway run pg_dump $DATABASE_URL > ../backups/pre-fase-1-26mai.dump

ALTER TABLE "agendamentos"
  ADD COLUMN IF NOT EXISTS "status_proposta" TEXT,
  ADD COLUMN IF NOT EXISTS "proposto_por" TEXT,
  ADD COLUMN IF NOT EXISTS "proposto_por_id" TEXT,
  ADD COLUMN IF NOT EXISTS "confirmado_em" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "data_anterior" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "motivo_status" TEXT;

-- Indice para queries comuns: "retornos pendentes do paciente"
CREATE INDEX IF NOT EXISTS "agendamentos_status_proposta_idx"
  ON "agendamentos" ("usuario_id", "status_proposta")
  WHERE "status_proposta" IS NOT NULL;

-- Verificacao pos-aplicacao (rode no psql apos aplicar):
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name='agendamentos' AND column_name LIKE 'status_%' OR column_name LIKE 'proposto%' OR column_name LIKE 'data_anterior' OR column_name LIKE 'confirmado_em' OR column_name LIKE 'motivo_status';
--
-- Resultado esperado: 6 colunas, todas YES (nullable).
