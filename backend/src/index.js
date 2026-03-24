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

// ── Health check ───────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Version check endpoint
app.get('/version', (_req, res) => res.json({ version: '3.0-templates', timestamp: '2026-03-22T22:00:00Z' }));

// ── Montagem das rotas ─────────────────────────────────
app.use('/auth', authRoutes);
app.use('/perfil', perfilRoutes);
app.use('/exames', examesRoutes);
app.use('/medicamentos', medicamentosRoutes);
app.use('/alergias', alergiasRoutes);
app.use('/scores', scoresRoutes);
app.use('/checkin', checkinRoutes);
app.use('/notificacoes', notificacoesRoutes);
app.use('/pdf', pdfRoutes);
app.use('/medico', medicoRoutes);
app.use('/pre-consulta', preConsultaRoutes);
app.use('/agendamento', agendamentoRoutes);
app.use('/autorizacao', autorizacaoRoutes);
app.use('/consentimento', consentimentoRoutes);
app.use('/templates', templatesRoutes);
app.use('/timeline', timelineRoutes);

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
