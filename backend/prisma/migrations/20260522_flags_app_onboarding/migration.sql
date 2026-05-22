-- Migration: flags_app na PerfilSaude
-- Data: 22/05/2026
-- Objetivo: persistir flags do app (onboarding visto, exames já avisados) por conta, não por aparelho.
-- Risco: ZERO. ADD COLUMN nullable, idempotente. Reversível com DROP COLUMN flags_app.

ALTER TABLE "perfil_saude"
  ADD COLUMN IF NOT EXISTS "flags_app" JSONB;
