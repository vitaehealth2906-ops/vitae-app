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
app.use(
  cors({
    origin: function(origin, callback) {
      // Permitir requests sem origin (file://, mobile apps, curl)
      if (!origin) return callback(null, true);
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

// ── DIAGNOSTICO: teste do scan sem login ──────────────
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
