require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./middleware/errorHandler');

// ── Rotas ──────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const perfilRoutes = require('./routes/perfil');
const examesRoutes = require('./routes/exames');
const medicamentosRoutes = require('./routes/medicamentos');
const alergiasRoutes = require('./routes/alergias');
const scoresRoutes = require('./routes/scores');
const checkinRoutes = require('./routes/checkin');
const notificacoesRoutes = require('./routes/notificacoes');
const pdfRoutes = require('./routes/pdf');
const medicoRoutes = require('./routes/medico');
const preConsultaRoutes = require('./routes/pre-consulta');
const agendamentoRoutes = require('./routes/agendamento');
const autorizacaoRoutes = require('./routes/autorizacao');
const consentimentoRoutes = require('./routes/consentimento');
const timelineRoutes = require('./routes/timeline');
const templatesRoutes = require('./routes/templates');
const adminRoutes = require('./routes/admin');
const agendaRoutes = require('./routes/agenda');

// Observabilidade — inicializa Sentry se SENTRY_DSN setado
require('./services/observability');

// ── App ────────────────────────────────────────────────
const app = express();

// ── CORS ───────────────────────────────────────────────
// Em dev, aceita qualquer origin (file://, localhost, etc.)
// Em producao, restringir para o dominio real
const allowedOrigins = [
  'https://vitaehealth2906-ops.github.io',
  'https://vitae-app.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
];
const isDevelopment = process.env.NODE_ENV !== 'production';
app.use(
  cors({
    origin: function(origin, callback) {
      // Sem origin: so permitir em dev (curl, Postman) — em prod, rejeitar file:// e requests sem origin
      if (!origin) return callback(null, isDevelopment);
      if (allowedOrigins.some(o => origin.startsWith(o))) return callback(null, true);
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Body parsers ───────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Cookie parser (necessario pro OAuth state da Agenda Google) ──
try { app.use(require('cookie-parser')()); } catch (_e) { /* lib opcional */ }

// ── Trust proxy (Railway/Vercel) — pra rate limit pegar IP real ──
app.set('trust proxy', 1);

// ── Rate limiting (defesa basica contra abuso) ──────────
const rateLimit = require('express-rate-limit');

// Limite geral pra rotas autenticadas — generoso pro uso real (300 req/min por IP)
const limiterGeral = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisicoes. Aguarde um momento.' },
});

// Limite mais apertado pra rotas publicas (60 req/min por IP)
const limiterPublico = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde um momento.' },
});

// Limite ESPECIFICO pra login/cadastro (defesa contra brute force) — 20 por 15min
const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de login. Aguarde 15 minutos.' },
});

// ── Health check ───────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Version check endpoint
app.get('/version', (_req, res) => res.json({ version: '3.1-gemini', timestamp: new Date().toISOString() }));

// ── DIAGNOSTICO: teste do scan — APENAS em dev (sem auth = vetor DoS em prod) ──
if (isDevelopment) {
  app.post('/test-scan', require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 10*1024*1024 } }).single('arquivo'), async (req, res) => {
    const log = [];
    log.push('Request received');
    log.push('File: ' + (req.file ? `${req.file.mimetype} ${req.file.size} bytes` : 'NENHUM'));

    if (!req.file) {
      return res.json({ ok: false, log, erro: 'Nenhum arquivo' });
    }

    try {
      const ai = require('./services/ai');
      log.push('AI module loaded');
      log.push('Calling scanReceita...');

      const result = await ai.scanReceita(req.file.buffer, req.file.mimetype);
      log.push('Result: ' + JSON.stringify(result).substring(0, 200));

      return res.json({ ok: true, log, result });
    } catch(e) {
      log.push('ERROR: ' + e.message);
      return res.json({ ok: false, log, erro: e.message });
    }
  });
}

// ── Montagem das rotas ─────────────────────────────────
// Auth: brute-force protection mais agressiva
app.use('/auth', limiterAuth, authRoutes);
// Pre-consulta: tem rotas publicas (responder, GET por token) — limite publico
app.use('/pre-consulta', limiterPublico, preConsultaRoutes);
// Autorizacao: tem rotas publicas (rg-publico, exame-publico) — limite publico
app.use('/autorizacao', limiterPublico, autorizacaoRoutes);
// Demais rotas: limite geral (300/min)
app.use('/perfil', limiterGeral, perfilRoutes);
app.use('/exames', limiterGeral, examesRoutes);
app.use('/medicamentos', limiterGeral, medicamentosRoutes);
app.use('/alergias', limiterGeral, alergiasRoutes);
app.use('/scores', limiterGeral, scoresRoutes);
app.use('/checkin', limiterGeral, checkinRoutes);
app.use('/notificacoes', limiterGeral, notificacoesRoutes);
app.use('/pdf', limiterGeral, pdfRoutes);
app.use('/medico', limiterGeral, medicoRoutes);
app.use('/agendamento', limiterGeral, agendamentoRoutes);
app.use('/consentimento', limiterGeral, consentimentoRoutes);
app.use('/templates', limiterGeral, templatesRoutes);
app.use('/timeline', limiterGeral, timelineRoutes);
// Admin — protegido por ADMIN_TOKEN header (rate limit apertado)
app.use('/admin', limiterPublico, adminRoutes);
// Agenda v1 — feature flag dentro da rota controla 503; google callback usa cookie
app.use('/agenda', limiterGeral, agendaRoutes);

// ── 404 para rotas nao encontradas ────────────────────
app.use((_req, res) => {
  res.status(404).json({ erro: 'Rota nao encontrada.' });
});

// ── Error handler global (deve ser o ultimo) ──────────
app.use(errorHandler);

// ── Inicializacao do servidor ─────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 3001;

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[VITAE] Servidor rodando na porta ${PORT}`);
  console.log(`[VITAE] Ambiente: ${process.env.NODE_ENV || 'development'}`);

  // ── MIGRACAO AUTO: garante colunas novas no banco (idempotente) ──
  try {
    const prisma = require('./utils/prisma');
    // Adiciona paciente_id se nao existir (segura — IF NOT EXISTS)
    await prisma.$executeRawUnsafe(`ALTER TABLE "pre_consultas" ADD COLUMN IF NOT EXISTS "paciente_id" TEXT`);
    console.log('[MIGRATE] coluna pre_consultas.paciente_id OK');
    // Indice pra acelerar joins do medico -> paciente
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pre_consultas_paciente_id_idx" ON "pre_consultas"("paciente_id")`);
    console.log('[MIGRATE] indice paciente_id OK');
    // Foreign key (com SET NULL para manter historico se usuario deletar)
    // Usa DO block pra ser idempotente no Postgres
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'pre_consultas_paciente_id_fkey'
        ) THEN
          ALTER TABLE "pre_consultas"
          ADD CONSTRAINT "pre_consultas_paciente_id_fkey"
          FOREIGN KEY ("paciente_id") REFERENCES "usuarios"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
    console.log('[MIGRATE] foreign key paciente_id OK');

    // ETAPA 5 — Cria tabela tarefas_pendentes se nao existir (fila de processamento)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "tarefas_pendentes" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "tipo" TEXT NOT NULL,
        "pre_consulta_id" TEXT,
        "payload" JSONB,
        "tentativas" INTEGER NOT NULL DEFAULT 0,
        "proxima_tentativa" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "processado_em" TIMESTAMP(3),
        "erro" TEXT,
        "dead" BOOLEAN NOT NULL DEFAULT false,
        "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[MIGRATE] tabela tarefas_pendentes OK');
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tarefas_pendentes_processado_proxima_idx" ON "tarefas_pendentes"("processado_em", "proxima_tentativa")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tarefas_pendentes_tipo_processado_idx" ON "tarefas_pendentes"("tipo", "processado_em")`);
    console.log('[MIGRATE] indices tarefas_pendentes OK');

    // Coluna transcricao_words (JSONB) — timestamps para karaoke sync
    await prisma.$executeRawUnsafe(`ALTER TABLE "pre_consultas" ADD COLUMN IF NOT EXISTS "transcricao_words" JSONB`);
    console.log('[MIGRATE] coluna pre_consultas.transcricao_words OK');

    // Coluna valor_consulta no medico (pra mostrar impacto em R$ no dashboard)
    await prisma.$executeRawUnsafe(`ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "valor_consulta" DOUBLE PRECISION`);
    console.log('[MIGRATE] coluna medicos.valor_consulta OK');

    // ETAPA 6 (FASE 3) — Status honesto por peca da pre-consulta
    // Tudo nullable, aditivo. Zero risco de data loss.
    await prisma.$executeRawUnsafe(`ALTER TABLE "pre_consultas" ADD COLUMN IF NOT EXISTS "nivel_briefing" INTEGER`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "pre_consultas" ADD COLUMN IF NOT EXISTS "status_resumo_ia" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "pre_consultas" ADD COLUMN IF NOT EXISTS "status_audio_resumo" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "pre_consultas" ADD COLUMN IF NOT EXISTS "status_transcricao" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "pre_consultas" ADD COLUMN IF NOT EXISTS "status_foto" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "pre_consultas" ADD COLUMN IF NOT EXISTS "status_audio" TEXT`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pre_consultas_medico_nivel_idx" ON "pre_consultas"("medico_id", "nivel_briefing")`);
    console.log('[MIGRATE] colunas de status do briefing OK');

    // ETAPA 7 (FASE 7) — Audit trail de acesso ao briefing (LGPD/CFM 5 anos).
    // Cria tabela separada pra nao poluir pre_consultas. Nao guarda dado clinico — so metadata.
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "auditoria_briefing" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "pre_consulta_id" TEXT NOT NULL,
        "medico_id" TEXT NOT NULL,
        "acao" TEXT NOT NULL,
        "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "ip_hash" TEXT,
        "user_agent_hash" TEXT
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "auditoria_briefing_pc_idx" ON "auditoria_briefing"("pre_consulta_id", "criado_em")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "auditoria_briefing_medico_idx" ON "auditoria_briefing"("medico_id", "criado_em")`);
    console.log('[MIGRATE] tabela auditoria_briefing OK');

    // ETAPA 7 — JWT revocation list (jti blacklist) — LGPD: revogar consentimento = revogar token imediato
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "jwt_revogados" (
        "jti" TEXT NOT NULL PRIMARY KEY,
        "usuario_id" TEXT,
        "motivo" TEXT,
        "revogado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expira_em" TIMESTAMP(3) NOT NULL
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "jwt_revogados_expira_idx" ON "jwt_revogados"("expira_em")`);
    console.log('[MIGRATE] tabela jwt_revogados OK');

    // ============================================
    // ETAPA 8 — Modulo Agenda Medica v1 (sessao 26-abr-2026)
    // Idempotente, aditivo, zero risco. Tabelas e colunas so sao criadas
    // se nao existirem. Feature flag AGENDA_V1_ENABLED controla se a feature aparece.
    // ============================================

    // 8.1 — config_agenda (1 por medico)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "config_agenda" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "medico_id" TEXT NOT NULL UNIQUE,
        "duracao_padrao_min" INTEGER NOT NULL DEFAULT 30,
        "visao_padrao" TEXT NOT NULL DEFAULT 'semana',
        "dias_atendimento" TEXT NOT NULL DEFAULT '1,2,3,4,5',
        "horario_inicio" TEXT NOT NULL DEFAULT '08:00',
        "horario_fim" TEXT NOT NULL DEFAULT '18:00',
        "almoco_inicio" TEXT DEFAULT '12:00',
        "almoco_fim" TEXT DEFAULT '13:30',
        "buffer_min" INTEGER NOT NULL DEFAULT 0,
        "lembrete_24h" BOOLEAN NOT NULL DEFAULT true,
        "lembrete_2h" BOOLEAN NOT NULL DEFAULT true,
        "enviar_sms" BOOLEAN NOT NULL DEFAULT false,
        "videochamada_tipo" TEXT NOT NULL DEFAULT 'jitsi',
        "no_show_auto" INTEGER NOT NULL DEFAULT 2,
        "feriados_auto" BOOLEAN NOT NULL DEFAULT true,
        "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
        "primeira_config_em" TIMESTAMP(3),
        "tour_completo" BOOLEAN NOT NULL DEFAULT false,
        "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 8.2 — locais_atendimento
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "locais_atendimento" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "medico_id" TEXT NOT NULL,
        "nome" TEXT NOT NULL,
        "endereco" TEXT,
        "cep" TEXT,
        "cor" TEXT NOT NULL DEFAULT '#00E5A0',
        "ativo" BOOLEAN NOT NULL DEFAULT true,
        "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "locais_atendimento_medico_ativo_idx" ON "locais_atendimento"("medico_id", "ativo")`);

    // 8.3 — agenda_slots (consultas + bloqueios)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "agenda_slots" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "medico_id" TEXT NOT NULL,
        "paciente_id" TEXT,
        "paciente_nome_livre" TEXT,
        "paciente_tel_livre" TEXT,
        "local_id" TEXT,
        "inicio" TIMESTAMP(3) NOT NULL,
        "fim" TIMESTAMP(3) NOT NULL,
        "duracao_min" INTEGER NOT NULL,
        "tipo" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'AGUARDANDO_CONFIRMACAO',
        "motivo" TEXT,
        "observacoes" TEXT,
        "video_url" TEXT,
        "origem" TEXT NOT NULL DEFAULT 'MANUAL',
        "pre_consulta_id" TEXT,
        "google_event_id" TEXT UNIQUE,
        "google_synced_at" TIMESTAMP(3),
        "attempt_id" TEXT UNIQUE,
        "lembrete_24_sent" BOOLEAN NOT NULL DEFAULT false,
        "lembrete_24_sent_at" TIMESTAMP(3),
        "lembrete_2_sent" BOOLEAN NOT NULL DEFAULT false,
        "lembrete_2_sent_at" TIMESTAMP(3),
        "paciente_confirmou" BOOLEAN NOT NULL DEFAULT false,
        "paciente_confirmado_em" TIMESTAMP(3),
        "paciente_recusou" BOOLEAN NOT NULL DEFAULT false,
        "cancelamento_motivo" TEXT,
        "cancelamento_por" TEXT,
        "cancelamento_em" TIMESTAMP(3),
        "desfeito_ate" TIMESTAMP(3),
        "estado_anterior" JSONB,
        "no_show_confirmar_48h" BOOLEAN NOT NULL DEFAULT false,
        "criado_por" TEXT NOT NULL,
        "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "agenda_slots_medico_inicio_idx" ON "agenda_slots"("medico_id", "inicio")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "agenda_slots_medico_status_idx" ON "agenda_slots"("medico_id", "status")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "agenda_slots_paciente_inicio_idx" ON "agenda_slots"("paciente_id", "inicio")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "agenda_slots_inicio_lembrete24_idx" ON "agenda_slots"("inicio", "lembrete_24_sent")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "agenda_slots_inicio_lembrete2_idx" ON "agenda_slots"("inicio", "lembrete_2_sent")`);

    // 8.4 — lista_espera
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "lista_espera" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "medico_id" TEXT NOT NULL,
        "paciente_id" TEXT,
        "paciente_nome" TEXT,
        "paciente_tel" TEXT,
        "paciente_email" TEXT,
        "motivo" TEXT,
        "preferencia" TEXT,
        "prioridade" TEXT NOT NULL DEFAULT 'NORMAL',
        "status" TEXT NOT NULL DEFAULT 'AGUARDANDO',
        "oferta_slot_id" TEXT,
        "oferta_enviada_em" TIMESTAMP(3),
        "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "resolvido_em" TIMESTAMP(3),
        "criado_por" TEXT NOT NULL
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "lista_espera_medico_status_prio_idx" ON "lista_espera"("medico_id", "status", "prioridade")`);

    // 8.5 — secretaria_vinculos (multi-user)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "secretaria_vinculos" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "medico_id" TEXT NOT NULL,
        "usuario_id" TEXT NOT NULL,
        "permissoes" TEXT NOT NULL DEFAULT 'AGENDA_LER,AGENDA_ESCREVER,LISTA_ESPERA',
        "ativo" BOOLEAN NOT NULL DEFAULT true,
        "convite_token" TEXT UNIQUE,
        "convite_expira" TIMESTAMP(3),
        "convite_email" TEXT,
        "aceito_em" TIMESTAMP(3),
        "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "revogado_em" TIMESTAMP(3)
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "secretaria_vinculos_medico_usuario_unq" ON "secretaria_vinculos"("medico_id", "usuario_id")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "secretaria_vinculos_usuario_ativo_idx" ON "secretaria_vinculos"("usuario_id", "ativo")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "secretaria_vinculos_token_idx" ON "secretaria_vinculos"("convite_token")`);

    // 8.6 — push_subscriptions (web push pra lembretes)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "push_subscriptions" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "usuario_id" TEXT NOT NULL,
        "endpoint" TEXT NOT NULL UNIQUE,
        "p256dh" TEXT NOT NULL,
        "auth" TEXT NOT NULL,
        "user_agent" TEXT,
        "ativo" BOOLEAN NOT NULL DEFAULT true,
        "ultimo_uso_em" TIMESTAMP(3),
        "falhou_em" TIMESTAMP(3),
        "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "push_subscriptions_usuario_ativo_idx" ON "push_subscriptions"("usuario_id", "ativo")`);

    // 8.7 — Colunas novas em pre_consultas (finalizacao + retorno)
    await prisma.$executeRawUnsafe(`ALTER TABLE "pre_consultas" ADD COLUMN IF NOT EXISTS "finalizada_em" TIMESTAMP(3)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "pre_consultas" ADD COLUMN IF NOT EXISTS "finalizada_por" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "pre_consultas" ADD COLUMN IF NOT EXISTS "retorno_slot_id" TEXT`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pre_consultas_finalizada_em_idx" ON "pre_consultas"("finalizada_em")`);

    // 8.8 — Colunas novas em medicos (Google Calendar OAuth)
    await prisma.$executeRawUnsafe(`ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "google_token_enc" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "google_token_iv" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "google_token_tag" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "google_email" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "google_scope" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "google_conectado_em" TIMESTAMP(3)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "google_sync_erro_em" TIMESTAMP(3)`);

    console.log('[MIGRATE] ETAPA 8 (Agenda v1) — 6 tabelas + colunas em pre_consultas/medicos OK');
  } catch (e) {
    console.error('[MIGRATE] Erro ao aplicar migracao manual:', e.message);
  }

  // ETAPA 5 — Inicia o worker de processamento assincrono
  try {
    const { iniciarWorker } = require('./workers/processador');
    iniciarWorker();
    console.log('[WORKER] Processador de fila iniciado');
  } catch (e) {
    console.error('[WORKER] Falha ao iniciar processador:', e.message);
  }

  // Limpa exames travados em PROCESSANDO/ENVIADO de deploys anteriores
  try {
    const prisma = require('./utils/prisma');
    const corte = new Date(Date.now() - 10 * 60 * 1000); // 10 minutos atrás
    const result = await prisma.exame.updateMany({
      where: {
        status: { in: ['PROCESSANDO', 'ENVIADO'] },
        criadoEm: { lt: corte },
      },
      data: {
        status: 'ERRO',
        erroProcessamento: 'Processamento interrompido por reinicialização do servidor. Envie o exame novamente.',
      },
    });
    if (result.count > 0) {
      console.log(`[VITAE] ${result.count} exame(s) travado(s) marcado(s) como ERRO.`);
    }
  } catch (e) {
    console.error('[VITAE] Erro ao limpar exames travados:', e.message);
  }
});

module.exports = app;
// force deploy 1774121197
