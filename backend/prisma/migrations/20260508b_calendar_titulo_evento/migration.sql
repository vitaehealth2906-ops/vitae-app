-- Calendar UX fix (2026-05-08b)
-- Adiciona titulo do evento Google + nome da agenda de origem ao slot,
-- pra medico identificar consulta na lista. Dados ja pertencem ao medico.

ALTER TABLE "agenda_slots"
  ADD COLUMN IF NOT EXISTS "titulo_evento" TEXT,
  ADD COLUMN IF NOT EXISTS "calendar_nome" TEXT;
