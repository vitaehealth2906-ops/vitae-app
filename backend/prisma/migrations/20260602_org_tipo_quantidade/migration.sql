-- ============================================================
-- Migration ADITIVA — Empresa: campos `tipo` e `quantidade`
--
-- Adiciona 2 colunas opcionais (nullable) na tabela `empresas`:
--   - tipo       (TEXT)    campo livre: empresa/escola/universidade/etc
--   - quantidade (INTEGER) quantas pessoas a organizacao tem
--
-- 100% ADITIVA E IDEMPOTENTE:
--   - usa ADD COLUMN IF NOT EXISTS (nao falha se rodar 2x)
--   - colunas nullable, NAO altera nem remove dado existente
--   - reversivel com: ALTER TABLE "empresas" DROP COLUMN "tipo", DROP COLUMN "quantidade";
--
-- APLICAR MANUALMENTE (regra db-safety pos-incidente 17-abr — nunca no build):
--   cd backend
--   railway run psql $DATABASE_URL -f prisma/migrations/20260602_org_tipo_quantidade/migration.sql
-- OU colar no Supabase Dashboard -> SQL Editor -> Run.
-- ============================================================

ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "tipo" TEXT;
ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "quantidade" INTEGER;
