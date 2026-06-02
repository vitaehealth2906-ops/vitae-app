-- ============================================================
-- Indices para ESCALA do painel do gestor B2B (Sessao 36, 02-jun-2026)
-- 100% ADITIVO e IDEMPOTENTE (IF NOT EXISTS). Nao toca em dado.
-- Aplicar A MAO no Railway (nunca db push, nunca --accept-data-loss):
--   cd backend
--   railway run npx prisma db execute --file prisma/migrations/20260602b_indices_b2b_escala/migration.sql --schema prisma/schema.prisma
-- ============================================================

-- 1) Lista/contagem de membros por organizacao (GET /empresa/membros e /me).
--    Cobre o filtro empresa_id + status e ajuda a ordenacao por criado_em.
CREATE INDEX IF NOT EXISTS idx_vinculos_empresa_org_status_criado
  ON vinculos_empresa (empresa_id, status, criado_em DESC);

-- 2) Busca por nome (ILIKE/contains) na lista do gestor.
--    Trigram permite indexar o "contains" (%texto%), nao so prefixo.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_usuarios_nome_trgm
  ON usuarios USING gin (nome gin_trgm_ops);
