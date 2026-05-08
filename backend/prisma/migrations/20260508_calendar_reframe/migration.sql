-- Calendar reframe (2026-05-08)
-- Adiciona suporte a multiplas agendas Google + pausa temporaria + timestamp real de sync.
-- ZERO PERDA DE DADOS: tres colunas novas, todas com default seguro.

ALTER TABLE "medicos"
  ADD COLUMN IF NOT EXISTS "google_calendar_ids" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "google_synced_at"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pausado_ate"         TIMESTAMP(3);

ALTER TABLE "agenda_slots"
  ADD COLUMN IF NOT EXISTS "ignorado" BOOLEAN NOT NULL DEFAULT false;
