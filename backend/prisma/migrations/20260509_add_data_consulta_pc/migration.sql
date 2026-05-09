-- Migration: adiciona campo data_consulta em pre_consultas
-- Sessao 22 (09/05/2026) — PORTA DE MAO UNICA
-- Aplicada via psql direto (NUNCA --accept-data-loss)
-- Backup: backups/vitae-pre-data-consulta-2026-05-09.dump
-- Tag git: pre-data-consulta-2026-05-09
--
-- Campo nullable: PCs antigas existentes ficam sem valor.
-- Frontend novo exige preenchimento na criacao manual.
-- Slots do Calendar autopreenchem ao virar PC.

ALTER TABLE pre_consultas
  ADD COLUMN IF NOT EXISTS data_consulta TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS pre_consultas_data_consulta_idx
  ON pre_consultas (data_consulta);
