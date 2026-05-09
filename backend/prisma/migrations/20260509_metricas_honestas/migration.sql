-- Sessao 22 (2026-05-09) — Metricas Honestas v1
-- Adiciona campo JSON pra armazenar inputs do medico no setup do dashboard.
-- Os 3 metricas (tempo economizado, atendimentos a mais, receita possivel)
-- passam a ser calculadas com base nesses inputs declarados, em vez de
-- multiplicadores hardcoded (0.7, 5x, 21x).
--
-- Estrutura do JSON:
-- {
--   "tempoAnamneseSemVitae": 12,           // minutos (1-60)
--   "percentualEconomiaAnamnese": 70,      // 0-95
--   "tempoMedioConsulta": 30,              // minutos (5-240) — ja existe coluna propria
--   "valorConsulta": 250,                  // reais (0-10000) — ja existe coluna propria
--   "taxaNoShow": 20,                      // 0-50
--   "setupConcluido": true,
--   "calibradoEm": "2026-05-09T..."
-- }
--
-- Risco: BAIXO. ADD COLUMN nullable. Nao toca em dados existentes.
-- Reversivel: ALTER TABLE medicos DROP COLUMN metricas_config;

ALTER TABLE "medicos"
  ADD COLUMN IF NOT EXISTS "metricas_config" JSONB DEFAULT NULL;
