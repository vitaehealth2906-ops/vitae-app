-- Migration: Documentos Medicos (Fase 2)
-- Data: 2026-05-16
-- Risco: ZERO (CREATE TABLE nova, sem ALTER em tabelas existentes)
-- Reversivel: DROP TABLE documentos_medicos
--
-- Backup logico OBRIGATORIO antes (ja feito em backups/pre-fase-2-26mai-logico.json)
--
-- Aplicacao:
--   npx prisma db execute --file prisma/migrations/20260516_documentos_medicos/migration.sql --schema prisma/schema.prisma

CREATE TABLE IF NOT EXISTS "documentos_medicos" (
  "id" TEXT NOT NULL,
  "medico_id" TEXT NOT NULL,
  "paciente_id" TEXT NOT NULL,
  "agendamento_id" TEXT,
  "tipo" TEXT NOT NULL,
  "nome_arquivo" TEXT NOT NULL,
  "url_arquivo" TEXT NOT NULL,
  "caminho_storage" TEXT,
  "tamanho_bytes" INTEGER NOT NULL,
  "mime_type" TEXT NOT NULL,
  "observacao" TEXT,
  "anexado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "visualizado_em" TIMESTAMP(3),
  "baixado_em" TIMESTAMP(3),
  "deletado_em" TIMESTAMP(3),
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "documentos_medicos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "documentos_medicos_paciente_deletado_idx"
  ON "documentos_medicos" ("paciente_id", "deletado_em");
CREATE INDEX IF NOT EXISTS "documentos_medicos_medico_anexado_idx"
  ON "documentos_medicos" ("medico_id", "anexado_em");
CREATE INDEX IF NOT EXISTS "documentos_medicos_agendamento_idx"
  ON "documentos_medicos" ("agendamento_id");

ALTER TABLE "documentos_medicos"
  ADD CONSTRAINT "documentos_medicos_medico_fk"
  FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documentos_medicos"
  ADD CONSTRAINT "documentos_medicos_paciente_fk"
  FOREIGN KEY ("paciente_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
