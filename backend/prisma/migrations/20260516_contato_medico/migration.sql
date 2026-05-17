-- Migration: Contato Direto WhatsApp (Fase 3)
-- Data: 2026-05-16
-- Risco: ZERO (CREATE TABLE novas, sem ALTER em tabelas existentes)
-- Reversivel: DROP TABLE config_contato_medico + permissao_contato_paciente

CREATE TABLE IF NOT EXISTS "config_contato_medico" (
  "id" TEXT NOT NULL,
  "medico_id" TEXT NOT NULL,
  "whatsapp_habilitado" BOOLEAN NOT NULL DEFAULT false,
  "whatsapp_numero" TEXT,
  "dias_disponiveis" INTEGER[] DEFAULT ARRAY[1,2,3,4,5]::INTEGER[],
  "hora_inicio" TEXT NOT NULL DEFAULT '08:00',
  "hora_fim" TEXT NOT NULL DEFAULT '18:00',
  "mensagem_pre_formatada" TEXT,
  "consent_lgpd_aceito" BOOLEAN NOT NULL DEFAULT false,
  "consent_lgpd_em" TIMESTAMP(3),
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "config_contato_medico_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "config_contato_medico_medico_id_key"
  ON "config_contato_medico" ("medico_id");

ALTER TABLE "config_contato_medico"
  ADD CONSTRAINT "config_contato_medico_medico_fk"
  FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "permissao_contato_paciente" (
  "id" TEXT NOT NULL,
  "medico_id" TEXT NOT NULL,
  "paciente_id" TEXT NOT NULL,
  "habilitado" BOOLEAN NOT NULL DEFAULT false,
  "habilitado_em" TIMESTAMP(3),
  "revogado_em" TIMESTAMP(3),
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "permissao_contato_paciente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "permissao_contato_paciente_medico_paciente_key"
  ON "permissao_contato_paciente" ("medico_id", "paciente_id");
CREATE INDEX IF NOT EXISTS "permissao_contato_paciente_medico_habilitado_idx"
  ON "permissao_contato_paciente" ("medico_id", "habilitado");

ALTER TABLE "permissao_contato_paciente"
  ADD CONSTRAINT "permissao_contato_paciente_medico_fk"
  FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "permissao_contato_paciente"
  ADD CONSTRAINT "permissao_contato_paciente_paciente_fk"
  FOREIGN KEY ("paciente_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
