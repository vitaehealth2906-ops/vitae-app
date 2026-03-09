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

// ── App ────────────────────────────────────────────────
const app = express();

// ── CORS ───────────────────────────────────────────────
// Em dev, aceita qualquer origin (file://, localhost, etc.)
// Em producao, restringir para o dominio real
app.use(
  cors({
    origin: true,
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

// ── 404 para rotas nao encontradas ────────────────────
app.use((_req, res) => {
  res.status(404).json({ erro: 'Rota nao encontrada.' });
});

// ── Error handler global (deve ser o ultimo) ──────────
app.use(errorHandler);

// ── Inicializacao do servidor ─────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 3001;

app.listen(PORT, () => {
  console.log(`[VITAE] Servidor rodando na porta ${PORT}`);
  console.log(`[VITAE] Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
