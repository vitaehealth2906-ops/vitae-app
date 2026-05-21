-- Migration: Recado pro Paciente + Contador de Trocas (Aba Consultas v2)
-- Data: 2026-05-21
-- Risco: ZERO (ADD COLUMN nullable + default 0, sem drop, sem alteracao de dados existentes)
-- Reversivel: sim, via DROP COLUMN dos 5 campos
--
-- O QUE FAZ:
--   1. agendamentos.recado_paciente (TEXT, nullable) — recado PUBLICO que medico deixa pro paciente ver
--   2. agendamentos.contador_trocas (INT, default 0) — anti-ciclo na remarcacao
--   3. agendamentos.propostas_atuais (JSONB, nullable) — array [{data, hora}] da proposta em andamento
--   4. agenda_slots.recado_paciente (TEXT, nullable) — mesmo campo no modulo Agenda v1
--
-- PORQUE:
--   - Hoje campo "observacoes" e usado pelo medico achando que e privado, mas paciente ve.
--   - Esse e um bug silencioso de privacidade. Separamos em 2 campos:
--     * observacoes (existente) = PRIVADO, so o medico ve
--     * recado_paciente (novo)  = PUBLICO, paciente ve na aba Consultas
--   - contador_trocas evita ciclo infinito de remarcacao (limite 2 idas-e-voltas).
--
-- Aplicacao MANUAL via Railway CLI:
--   1. railway login
--   2. cd backend
--   3. railway run psql $DATABASE_URL -f prisma/migrations/20260521_recado_paciente_e_contador_trocas/migration.sql
--   4. railway run npx prisma generate
--
-- Backup OBRIGATORIO antes de aplicar:
--   railway run pg_dump $DATABASE_URL > ../backups/pre-consultas-v2-21mai.dump

ALTER TABLE "agendamentos"
  ADD COLUMN IF NOT EXISTS "recado_paciente" TEXT,
  ADD COLUMN IF NOT EXISTS "contador_trocas" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "propostas_atuais" JSONB;

ALTER TABLE "agenda_slots"
  ADD COLUMN IF NOT EXISTS "recado_paciente" TEXT;

-- Verificacao pos-aplicacao (rode no psql apos aplicar):
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name IN ('agendamentos', 'agenda_slots')
--     AND column_name IN ('recado_paciente', 'contador_trocas', 'propostas_atuais')
--   ORDER BY table_name, column_name;
--
-- Resultado esperado: 4 linhas (3 em agendamentos + 1 em agenda_slots).
