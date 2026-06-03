-- Sessão 37 (03-jun-2026) — Campos novos do quiz do RG
-- 100% ADITIVO: só ADD COLUMN, nullable, IF NOT EXISTS. Não toca em dado existente.
-- Aplicar à mão no Railway (DB-safe): railway run npx prisma db execute --file <este arquivo>

-- Contato de emergência: parentesco + 2º contato
ALTER TABLE "perfil_saude" ADD COLUMN IF NOT EXISTS "parentesco_emergencia"    TEXT;
ALTER TABLE "perfil_saude" ADD COLUMN IF NOT EXISTS "contato_emergencia_nome2" TEXT;
ALTER TABLE "perfil_saude" ADD COLUMN IF NOT EXISTS "contato_emergencia_tel2"  TEXT;
ALTER TABLE "perfil_saude" ADD COLUMN IF NOT EXISTS "parentesco_emergencia2"   TEXT;

-- Histórico clínico: implantes (marca-passo, prótese, stent...)
ALTER TABLE "perfil_saude" ADD COLUMN IF NOT EXISTS "implantes" TEXT;

-- Alergia: reação (substitui o conceito de gravidade na cara do usuário)
ALTER TABLE "alergias" ADD COLUMN IF NOT EXISTS "reacao" TEXT;
