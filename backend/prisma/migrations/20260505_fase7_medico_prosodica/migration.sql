-- VITAE Fase 7 — Schema migration 2026-05-05
-- Adiciona 8 colunas em medicos + cria tabela analise_prosodica_arquive
-- Backup feito antes: vitae-pre-fase7-2026-05-05.dump (MD5 53697cb7dd1f073006ba75f199260e4c)

-- ============ 1. Colunas novas em medicos ============
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "tempo_medio_consulta" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "tempo_anamnese_atual" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "mensagem_lembrete_padrao" TEXT NOT NULL DEFAULT 'Olá {{nome}}, aqui é {{medico}}. Sua consulta está marcada para {{data}} às {{hora}}. Por favor, responda sua pré-consulta antes pelo link: {{link}}';
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "ia_collab_ativado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "analise_prosodica_ativada" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "modo_simples" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "modo_volume" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "modo_sus" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "excluido_em" TIMESTAMP(3);
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "exclusao_agendada_para" TIMESTAMP(3);

-- ============ 2. Tabela analise_prosodica_arquive ============
CREATE TABLE IF NOT EXISTS "analise_prosodica_arquive" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pre_consulta_id" TEXT,
    "medico_id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "features" JSONB NOT NULL,
    "thresholds" JSONB NOT NULL,
    "trecho_inicio_ms" INTEGER NOT NULL,
    "trecho_fim_ms" INTEGER NOT NULL,
    "hash_audio" TEXT NOT NULL,
    "retencao_ate" TIMESTAMP(3) NOT NULL,
    "alerta_severidade" TEXT,
    "alerta_mensagem" TEXT,
    "auditado_em" TIMESTAMP(3),
    "auditado_por" TEXT,

    CONSTRAINT "analise_prosodica_arquive_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_apa_medico" FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_apa_pre_consulta" FOREIGN KEY ("pre_consulta_id") REFERENCES "pre_consultas"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- ============ 3. Índices ============
CREATE INDEX IF NOT EXISTS "apa_medico_criado_idx" ON "analise_prosodica_arquive"("medico_id", "criado_em" DESC);
CREATE INDEX IF NOT EXISTS "apa_paciente_criado_idx" ON "analise_prosodica_arquive"("paciente_id", "criado_em" DESC);
CREATE INDEX IF NOT EXISTS "apa_pre_consulta_idx" ON "analise_prosodica_arquive"("pre_consulta_id");
CREATE INDEX IF NOT EXISTS "apa_retencao_idx" ON "analise_prosodica_arquive"("retencao_ate") WHERE "retencao_ate" IS NOT NULL;

-- ============ 4. Tabela notificacao_disparo (histórico WhatsApp) ============
CREATE TABLE IF NOT EXISTS "notificacao_disparos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "medico_id" TEXT NOT NULL,
    "paciente_id" TEXT,
    "destinatario" TEXT NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'whatsapp',
    "mensagem" TEXT NOT NULL,
    "template_sid" TEXT,
    "status" TEXT NOT NULL DEFAULT 'enfileirado',
    "modo" TEXT NOT NULL DEFAULT 'simulacao',
    "agendado_para" TIMESTAMP(3),
    "enviado_em" TIMESTAMP(3),
    "entregue_em" TIMESTAMP(3),
    "erro" TEXT,
    "twilio_sid" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacao_disparos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_nd_medico" FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "nd_medico_criado_idx" ON "notificacao_disparos"("medico_id", "criado_em" DESC);
CREATE INDEX IF NOT EXISTS "nd_status_idx" ON "notificacao_disparos"("status");
CREATE INDEX IF NOT EXISTS "nd_agendado_idx" ON "notificacao_disparos"("agendado_para") WHERE "agendado_para" IS NOT NULL;

-- ============ 5. Comentários ============
COMMENT ON TABLE "analise_prosodica_arquive" IS 'CFM 2.314/2022 - retenção 20 anos, hash do áudio (não áudio em si) por LGPD';
COMMENT ON TABLE "notificacao_disparos" IS 'Histórico de disparos WhatsApp/SMS — modo: simulacao | real';
COMMENT ON COLUMN "medicos"."excluido_em" IS 'LGPD - soft-delete, hard-delete agendado para excluido_em + 30 dias';

-- ============ FIM ============
