// Rotas REST do modulo Agenda v1.
// Bloqueado por feature flag AGENDA_V1_ENABLED. Quando false, retorna 503.
// Auth obrigatoria + middleware permission carregando role.

const express = require('express');
const { z } = require('zod');
const { verificarAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const perm = require('../middleware/permission');
const prisma = require('../utils/prisma');
const agendaSvc = require('../services/agenda');
const slotsSvc = require('../services/agenda/slots');
const finalizarSvc = require('../services/agenda/finalizar');
const lembretesSvc = require('../services/agenda/lembretes');
const esperaSvc = require('../services/agenda/espera');
const pushSvc = require('../services/agenda/push');
const gcalSvc = require('../services/agenda/google-sync');
const { hmacToken, verifyHmac } = require('../services/agenda/crypto');
const { auditar } = require('../utils/auditoria');
const { v4: uuid } = require('uuid');

const router = express.Router();

// ---- Gate global: feature flag ----
router.use((req, res, next) => {
  if (!agendaSvc.enabled()) {
    return res.status(503).json({
      ok: false,
      code: 'AGENDA_DESATIVADA',
      message: 'Modulo Agenda em manutencao.',
    });
  }
  next();
});

// ---- Auth + perms (exceto rotas publicas com token) ----
const ROTAS_PUBLICAS = [
  /^\/slots\/[^/]+\/confirmar-presenca$/,
  /^\/slots\/[^/]+\/recusar$/,
  /^\/lista-espera\/aceitar$/,
  /^\/google\/callback$/,
  /^\/push\/vapid-public-key$/,
];

router.use((req, res, next) => {
  if (ROTAS_PUBLICAS.some(r => r.test(req.path))) return next();
  return verificarAuth(req, res, next);
});

router.use((req, res, next) => {
  if (ROTAS_PUBLICAS.some(r => r.test(req.path))) return next();
  return perm.carregarPermissoes(req, res, next);
});

// Dark launch: rejeita usuarios fora da whitelist se AGENDA_DARK_USERS setado
router.use((req, res, next) => {
  if (ROTAS_PUBLICAS.some(r => r.test(req.path))) return next();
  if (!req.user) return next();
  if (!agendaSvc.isVisibleForUser(req.user.id)) {
    return res.status(503).json({
      ok: false,
      code: 'AGENDA_INDISPONIVEL_USUARIO',
      message: 'Modulo Agenda em rollout gradual.',
    });
  }
  next();
});

// =========================================================
// CONFIG DA AGENDA
// =========================================================

router.get('/config', perm.medicoOnly, async (req, res, next) => {
  try {
    let config = await prisma.configAgenda.findUnique({
      where: { medicoId: req.user.medicoId },
    });
    if (!config) {
      // Cria config default + 1 local default (primeira vez)
      config = await prisma.configAgenda.create({
        data: { medicoId: req.user.medicoId, primeiraConfigEm: new Date() },
      });
      const ja = await prisma.localAtendimento.count({ where: { medicoId: req.user.medicoId } });
      if (ja === 0) {
        await prisma.localAtendimento.create({
          data: { medicoId: req.user.medicoId, nome: 'Meu consultorio' },
        });
      }
    }
    res.json({ ok: true, data: config });
  } catch (e) { next(e); }
});

const configSchema = z.object({
  duracaoPadraoMin: z.number().min(10).max(120).optional(),
  visaoPadrao: z.enum(['dia', 'semana', 'mes']).optional(),
  diasAtendimento: z.string().optional(),
  horarioInicio: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  horarioFim: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  almocoInicio: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  almocoFim: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  bufferMin: z.number().min(0).max(60).optional(),
  lembrete24h: z.boolean().optional(),
  lembrete2h: z.boolean().optional(),
  videochamadaTipo: z.enum(['jitsi', 'manual']).optional(),
  noShowAuto: z.number().min(1).max(10).optional(),
  feriadosAuto: z.boolean().optional(),
  timezone: z.string().optional(),
  tourCompleto: z.boolean().optional(),
});

router.put('/config', perm.medicoOnly, validate(configSchema), async (req, res, next) => {
  try {
    const config = await prisma.configAgenda.upsert({
      where: { medicoId: req.user.medicoId },
      update: req.body,
      create: { medicoId: req.user.medicoId, ...req.body, primeiraConfigEm: new Date() },
    });
    res.json({ ok: true, data: config });
  } catch (e) { next(e); }
});

// =========================================================
// LOCAIS DE ATENDIMENTO
// =========================================================

router.get('/locais', perm.medicoOuSecretariaCom('AGENDA_LER'), async (req, res, next) => {
  try {
    const medicoId = req.user.medicoId || req.query.medicoId;
    const locais = await prisma.localAtendimento.findMany({
      where: { medicoId, ativo: true },
      orderBy: { criadoEm: 'asc' },
    });
    res.json({ ok: true, data: locais });
  } catch (e) { next(e); }
});

router.post('/locais', perm.medicoOnly, async (req, res, next) => {
  try {
    const local = await prisma.localAtendimento.create({
      data: { medicoId: req.user.medicoId, ...req.body, ativo: true },
    });
    res.json({ ok: true, data: local });
  } catch (e) { next(e); }
});

router.put('/locais/:id', perm.medicoOnly, async (req, res, next) => {
  try {
    const local = await prisma.localAtendimento.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ ok: true, data: local });
  } catch (e) { next(e); }
});

router.delete('/locais/:id', perm.medicoOnly, async (req, res, next) => {
  try {
    await prisma.localAtendimento.update({
      where: { id: req.params.id },
      data: { ativo: false },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// =========================================================
// SLOTS (consultas)
// =========================================================

router.get('/slots', perm.medicoOuSecretariaCom('AGENDA_LER'), async (req, res, next) => {
  try {
    const medicoId = req.user.medicoId || req.query.medicoId;
    const inicio = req.query.inicio || new Date().toISOString();
    const fim = req.query.fim || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const slots = await slotsSvc.listarSlots(medicoId, inicio, fim, {
      incluirCanceladas: req.query.incluirCanceladas === 'true',
    });
    res.json({ ok: true, data: slots });
  } catch (e) { next(e); }
});

const slotCreateSchema = z.object({
  pacienteId: z.string().optional().nullable(),
  pacienteNomeLivre: z.string().optional().nullable(),
  pacienteTelLivre: z.string().optional().nullable(),
  localId: z.string().optional().nullable(),
  inicio: z.string(),
  fim: z.string(),
  duracaoMin: z.number().min(10).max(480),
  tipo: z.enum(['CONSULTA_NOVA', 'RETORNO', 'ONLINE', 'BLOQUEIO']),
  motivo: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  attemptId: z.string().optional(),
});

router.post('/slots', perm.medicoOuSecretariaCom('AGENDA_ESCREVER'), validate(slotCreateSchema), async (req, res, next) => {
  try {
    const medicoId = req.user.medicoId || req.body.medicoId;
    const result = await slotsSvc.criarSlot({
      ...req.body,
      medicoId,
      criadoPor: req.user.id,
      attemptId: req.body.attemptId || uuid(),
    });
    if (!result.ok) return res.status(409).json(result);
    auditar(req, { acao: 'CRIAR_AGENDAMENTO', recursoId: result.data.id, recursoTipo: 'AGENDA_SLOT' });
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (e) { next(e); }
});

router.put('/slots/:id', perm.medicoOuSecretariaCom('AGENDA_ESCREVER'), async (req, res, next) => {
  try {
    const result = await slotsSvc.remarcarSlot(req.params.id, req.body, req.user.id);
    if (!result.ok) return res.status(409).json(result);
    auditar(req, { acao: 'REMARCAR_AGENDAMENTO', recursoId: req.params.id, recursoTipo: 'AGENDA_SLOT' });
    res.json(result);
  } catch (e) { next(e); }
});

router.delete('/slots/:id', perm.medicoOuSecretariaCom('AGENDA_ESCREVER'), async (req, res, next) => {
  try {
    const result = await slotsSvc.cancelarSlot(req.params.id, req.user.id, req.query.motivo);
    if (!result.ok) return res.status(400).json(result);
    auditar(req, { acao: 'CANCELAR_AGENDAMENTO', recursoId: req.params.id, recursoTipo: 'AGENDA_SLOT', metadata: { motivo: req.query.motivo } });

    // Tenta ofertar pra lista de espera (async, nao bloqueia resposta)
    esperaSvc.tentarOfertar(req.params.id).catch(() => {});

    res.json(result);
  } catch (e) { next(e); }
});

router.post('/slots/:id/desfazer', perm.medicoOuSecretariaCom('AGENDA_ESCREVER'), async (req, res, next) => {
  try {
    const result = await slotsSvc.desfazerCancelamento(req.params.id, req.user.id);
    if (!result.ok) return res.status(410).json(result);
    res.json(result);
  } catch (e) { next(e); }
});

router.post('/slots/:id/comparecer', perm.medicoOuSecretariaCom('AGENDA_ESCREVER'), async (req, res, next) => {
  try {
    const result = await slotsSvc.marcarStatus(req.params.id, 'COMPARECEU', req.user.id);
    res.json(result);
  } catch (e) { next(e); }
});

router.post('/slots/:id/falta', perm.medicoOuSecretariaCom('AGENDA_ESCREVER'), async (req, res, next) => {
  try {
    const result = await slotsSvc.marcarStatus(req.params.id, 'FALTA', req.user.id);
    auditar(req, { acao: 'MARCAR_FALTA', recursoId: req.params.id, recursoTipo: 'AGENDA_SLOT' });
    res.json(result);
  } catch (e) { next(e); }
});

// Confirmar presenca (paciente, sem login, com token HMAC)
router.get('/slots/:id/confirmar-presenca', async (req, res, next) => {
  try {
    const slot = await prisma.agendaSlot.findUnique({ where: { id: req.params.id } });
    if (!slot) return res.status(404).send('<h1>Slot nao encontrado</h1>');

    const expected = hmacToken(`${slot.id}:${slot.pacienteId || 'free'}`);
    if (req.query.token !== expected) {
      return res.status(401).send('<h1>Token invalido</h1>');
    }

    await prisma.agendaSlot.update({
      where: { id: slot.id },
      data: { pacienteConfirmou: true, pacienteConfirmadoEm: new Date(), status: 'CONFIRMADA' },
    });

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#0A0A0A;color:#fff;">
      <h1 style="color:#00E5A0;">Presenca confirmada</h1>
      <p>Obrigado. Voce foi marcado(a) como confirmado(a) para a consulta.</p>
      </body></html>
    `);
  } catch (e) { next(e); }
});

// Recusar (paciente pede remarcar)
router.get('/slots/:id/recusar', async (req, res, next) => {
  try {
    const slot = await prisma.agendaSlot.findUnique({ where: { id: req.params.id } });
    if (!slot) return res.status(404).send('<h1>Slot nao encontrado</h1>');
    const expected = hmacToken(`${slot.id}:${slot.pacienteId || 'free'}`);
    if (req.query.token !== expected) return res.status(401).send('<h1>Token invalido</h1>');

    await prisma.agendaSlot.update({
      where: { id: slot.id },
      data: { pacienteRecusou: true },
    });

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#0A0A0A;color:#fff;">
      <h1 style="color:#F59E0B;">Pedido de remarcacao registrado</h1>
      <p>Seu medico foi avisado e entrara em contato pra remarcar.</p>
      </body></html>
    `);
  } catch (e) { next(e); }
});

// Sugerir retorno
router.get('/sugestoes-retorno', perm.medicoOnly, async (req, res, next) => {
  try {
    const pacienteId = req.query.pacienteId || null;
    const prazoDias = parseInt(req.query.prazoDias) || 15;
    const result = await finalizarSvc.sugerirRetorno(req.user.medicoId, pacienteId, prazoDias);
    res.json(result);
  } catch (e) { next(e); }
});

// Slot de paciente: meus proprios slots
router.get('/meus-slots', async (req, res, next) => {
  try {
    if (req.user.role !== 'PACIENTE' && req.user.role !== 'MEDICO') {
      return res.status(403).json({ ok: false, code: 'PROIBIDO' });
    }
    const slots = await prisma.agendaSlot.findMany({
      where: {
        pacienteId: req.user.id,
        status: { notIn: ['CANCELADA', 'REMARCADA'] },
      },
      include: {
        medico: { select: { usuario: { select: { nome: true } }, especialidade: true } },
        local: { select: { nome: true, endereco: true } },
      },
      orderBy: { inicio: 'asc' },
    });
    res.json({ ok: true, data: slots });
  } catch (e) { next(e); }
});

router.get('/proximo-meu', async (req, res, next) => {
  try {
    const slot = await prisma.agendaSlot.findFirst({
      where: {
        pacienteId: req.user.id,
        inicio: { gte: new Date() },
        status: { notIn: ['CANCELADA', 'REMARCADA'] },
      },
      include: {
        medico: { select: { usuario: { select: { nome: true } }, especialidade: true } },
        local: { select: { nome: true, endereco: true } },
      },
      orderBy: { inicio: 'asc' },
    });
    res.json({ ok: true, data: slot });
  } catch (e) { next(e); }
});

// =========================================================
// FINALIZAR ATENDIMENTO
// =========================================================

const finalizarSchema = z.object({
  comRetorno: z.boolean(),
  slotInicio: z.string().optional(),
  slotFim: z.string().optional(),
  slotDuracaoMin: z.number().optional(),
  slotLocalId: z.string().optional().nullable(),
  slotMotivo: z.string().optional().nullable(),
  attemptId: z.string().optional(),
});

router.post('/finalizar/:preConsultaId', perm.medicoOnly, validate(finalizarSchema), async (req, res, next) => {
  try {
    // Valida que pre-consulta pertence a este medico
    const pc = await prisma.preConsulta.findUnique({ where: { id: req.params.preConsultaId } });
    if (!pc || pc.medicoId !== req.user.medicoId) {
      return res.status(404).json({ ok: false, code: 'NOT_FOUND' });
    }

    const result = await finalizarSvc.finalizar(req.params.preConsultaId, req.body, req.user.id);
    if (!result.ok) return res.status(409).json(result);

    auditar(req, {
      acao: 'FINALIZAR_ATENDIMENTO',
      recursoId: req.params.preConsultaId,
      recursoTipo: 'PRE_CONSULTA',
      metadata: { comRetorno: req.body.comRetorno, retornoSlotId: result.data.retornoSlotId },
    });

    res.json(result);
  } catch (e) { next(e); }
});

router.post('/finalizar/:preConsultaId/desfazer', perm.medicoOnly, async (req, res, next) => {
  try {
    const pc = await prisma.preConsulta.findUnique({ where: { id: req.params.preConsultaId } });
    if (!pc || pc.medicoId !== req.user.medicoId) {
      return res.status(404).json({ ok: false, code: 'NOT_FOUND' });
    }
    const result = await finalizarSvc.desfazerFinalizacao(req.params.preConsultaId, req.user.id);
    if (!result.ok) return res.status(410).json(result);
    auditar(req, { acao: 'FINALIZAR_DESFAZER', recursoId: req.params.preConsultaId, recursoTipo: 'PRE_CONSULTA' });
    res.json(result);
  } catch (e) { next(e); }
});

// =========================================================
// LISTA DE ESPERA
// =========================================================

router.get('/lista-espera', perm.medicoOuSecretariaCom('LISTA_ESPERA'), async (req, res, next) => {
  try {
    const medicoId = req.user.medicoId || req.query.medicoId;
    const lista = await esperaSvc.listar(medicoId);
    res.json({ ok: true, data: lista });
  } catch (e) { next(e); }
});

router.post('/lista-espera', perm.medicoOuSecretariaCom('LISTA_ESPERA'), async (req, res, next) => {
  try {
    const medicoId = req.user.medicoId || req.body.medicoId;
    const item = await esperaSvc.adicionar(medicoId, req.body, req.user.id);
    res.json({ ok: true, data: item });
  } catch (e) { next(e); }
});

router.delete('/lista-espera/:id', perm.medicoOuSecretariaCom('LISTA_ESPERA'), async (req, res, next) => {
  try {
    const item = await esperaSvc.remover(req.params.id);
    res.json({ ok: true, data: item });
  } catch (e) { next(e); }
});

router.post('/lista-espera/:id/oferecer', perm.medicoOuSecretariaCom('LISTA_ESPERA'), async (req, res, next) => {
  try {
    if (!req.body.slotId) return res.status(400).json({ ok: false, code: 'SLOT_ID_REQUIRED' });
    const result = await esperaSvc.tentarOfertar(req.body.slotId);
    res.json({ ok: true, data: result });
  } catch (e) { next(e); }
});

router.get('/lista-espera/aceitar', async (req, res, next) => {
  // Token format: "esperaId:hmac"
  try {
    const [esperaId, token] = (req.query.token || '').split(':');
    if (!esperaId || !token) return res.status(400).send('<h1>Link invalido</h1>');
    const result = await esperaSvc.aceitarOferta(esperaId, token, req.query.usuarioId || null);
    if (!result.ok) {
      return res.status(400).send(`<h1>${result.message || 'Oferta indisponivel'}</h1>`);
    }
    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#0A0A0A;color:#fff;">
      <h1 style="color:#00E5A0;">Vaga aceita</h1>
      <p>Sua consulta foi confirmada. Voce vai receber lembretes 24h e 2h antes.</p>
      </body></html>
    `);
  } catch (e) { next(e); }
});

// =========================================================
// STATS MENSAIS
// =========================================================

router.get('/stats', perm.medicoOnly, async (req, res, next) => {
  try {
    const mesParam = req.query.mes || new Date().toISOString().slice(0, 7); // YYYY-MM
    const [ano, mes] = mesParam.split('-').map(Number);
    const inicio = new Date(Date.UTC(ano, mes - 1, 1));
    const fim = new Date(Date.UTC(ano, mes, 1));

    const [totalSlots, comparecimentos, faltas, retornosMarcados, finalizadas, medicoData] = await Promise.all([
      prisma.agendaSlot.count({
        where: { medicoId: req.user.medicoId, inicio: { gte: inicio, lt: fim },
                 status: { notIn: ['CANCELADA', 'REMARCADA', 'BLOQUEIO'] } },
      }),
      prisma.agendaSlot.count({
        where: { medicoId: req.user.medicoId, inicio: { gte: inicio, lt: fim }, status: 'COMPARECEU' },
      }),
      prisma.agendaSlot.count({
        where: { medicoId: req.user.medicoId, inicio: { gte: inicio, lt: fim }, status: 'FALTA' },
      }),
      prisma.agendaSlot.count({
        where: { medicoId: req.user.medicoId, inicio: { gte: inicio, lt: fim }, tipo: 'RETORNO' },
      }),
      prisma.preConsulta.count({
        where: { medicoId: req.user.medicoId, finalizadaEm: { gte: inicio, lt: fim } },
      }),
      prisma.medico.findUnique({ where: { id: req.user.medicoId }, select: { valorConsulta: true } }),
    ]);

    const taxaPresenca = totalSlots > 0 ? Math.round((comparecimentos / totalSlots) * 100) : 0;
    const taxaRetorno = finalizadas > 0 ? Math.round((retornosMarcados / finalizadas) * 100) : 0;

    // Cancelamentos confirmados (slot abriu, alguem da espera ocupou) = no-show evitado
    const noShowEvitado = await prisma.agendaSlot.count({
      where: { medicoId: req.user.medicoId, inicio: { gte: inicio, lt: fim }, origem: 'LISTA_ESPERA' },
    });
    const valorConsulta = Number(medicoData?.valorConsulta || 200);
    const economiaRS = noShowEvitado * valorConsulta;

    res.json({
      ok: true,
      data: {
        mes: mesParam,
        totalSlots,
        comparecimentos,
        faltas,
        retornosMarcados,
        finalizadas,
        taxaPresenca,
        taxaRetorno,
        noShowEvitado,
        economiaRS,
      },
    });
  } catch (e) { next(e); }
});

// =========================================================
// GOOGLE CALENDAR
// =========================================================

router.get('/google/auth', perm.medicoOnly, async (req, res, next) => {
  try {
    if (!agendaSvc.gcalEnabled()) {
      return res.status(503).json({ ok: false, code: 'GCAL_DESATIVADO' });
    }
    const state = require('crypto').randomBytes(16).toString('hex');
    res.cookie('gcal_oauth_state', `${state}:${req.user.medicoId}`, {
      httpOnly: true, secure: true, sameSite: 'lax', maxAge: 10 * 60 * 1000,
    });
    const url = gcalSvc.gerarAuthUrl(state);
    res.json({ ok: true, data: { url } });
  } catch (e) { next(e); }
});

router.get('/google/callback', async (req, res, next) => {
  try {
    const stateCookie = req.cookies?.gcal_oauth_state || '';
    const [stateExpected, medicoId] = stateCookie.split(':');
    if (!stateExpected || !medicoId || stateExpected !== req.query.state) {
      return res.status(401).send('<h1>State CSRF invalido. Tente novamente.</h1>');
    }
    if (!req.query.code) return res.status(400).send('<h1>Code ausente</h1>');

    const result = await gcalSvc.processarCallback(req.query.code, medicoId);
    if (!result.ok) return res.status(400).send(`<h1>${result.message}</h1>`);

    // Inicia sync inicial async (nao bloqueia)
    gcalSvc.sincronizar(medicoId, 90).catch(() => {});

    res.clearCookie('gcal_oauth_state');
    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#0A0A0A;color:#fff;">
      <h1 style="color:#00E5A0;">Google Calendar conectado</h1>
      <p>Conta: ${result.data.email}</p>
      <p>vita id NUNCA escreve no seu Google. Apenas leitura.</p>
      <a href="/desktop/app.html#agenda" style="color:#00B4D8;">Voltar para agenda</a>
      </body></html>
    `);
  } catch (e) { next(e); }
});

router.post('/google/sync', perm.medicoOnly, async (req, res, next) => {
  try {
    const result = await gcalSvc.sincronizar(req.user.medicoId, 90);
    res.json(result);
  } catch (e) { next(e); }
});

router.delete('/google/desconectar', perm.medicoOnly, async (req, res, next) => {
  try {
    await gcalSvc.desconectar(req.user.medicoId);
    auditar(req, { acao: 'DESCONECTAR_GOOGLE' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/google/status', perm.medicoOnly, async (req, res, next) => {
  try {
    const m = await prisma.medico.findUnique({
      where: { id: req.user.medicoId },
      select: { googleEmail: true, googleConectadoEm: true, googleSyncErroEm: true },
    });
    const count = await prisma.agendaSlot.count({
      where: { medicoId: req.user.medicoId, origem: 'GOOGLE_IMPORT' },
    });
    res.json({
      ok: true,
      data: {
        conectado: !!m?.googleConectadoEm,
        email: m?.googleEmail,
        conectadoEm: m?.googleConectadoEm,
        ultimoErro: m?.googleSyncErroEm,
        eventosImportados: count,
      },
    });
  } catch (e) { next(e); }
});

// =========================================================
// SECRETARIA (multi-user)
// =========================================================

router.get('/secretarias', perm.medicoOnly, async (req, res, next) => {
  try {
    const lista = await prisma.secretariaVinculo.findMany({
      where: { medicoId: req.user.medicoId },
      include: { usuario: { select: { id: true, nome: true, email: true, fotoUrl: true } } },
      orderBy: { criadoEm: 'desc' },
    });
    res.json({ ok: true, data: lista });
  } catch (e) { next(e); }
});

router.post('/secretarias/convidar', perm.medicoOnly, async (req, res, next) => {
  try {
    const { email, permissoes } = req.body;
    if (!email) return res.status(400).json({ ok: false, code: 'EMAIL_REQUIRED' });
    const token = require('crypto').randomBytes(24).toString('hex');
    const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Verifica se ja existe vinculo (ativo ou pendente)
    const existing = await prisma.usuario.findUnique({ where: { email } });
    if (existing) {
      const ja = await prisma.secretariaVinculo.findFirst({
        where: { medicoId: req.user.medicoId, usuarioId: existing.id },
      });
      if (ja && ja.ativo && ja.aceitoEm) {
        return res.status(409).json({ ok: false, code: 'JA_VINCULADO' });
      }
    }

    const vinculo = await prisma.secretariaVinculo.create({
      data: {
        medicoId: req.user.medicoId,
        usuarioId: existing?.id || 'PENDING-' + token,
        permissoes: permissoes || 'AGENDA_LER,AGENDA_ESCREVER,LISTA_ESPERA',
        ativo: false,
        conviteToken: token,
        conviteExpira: expira,
        conviteEmail: email,
      },
    });

    const medico = await prisma.medico.findUnique({
      where: { id: req.user.medicoId },
      include: { usuario: { select: { nome: true } } },
    });

    const tpl = require('../services/agenda/email-templates');
    await tpl.enviarConviteSecretaria({
      emailDestino: email,
      medicoNome: medico?.usuario?.nome || 'seu medico',
      conviteToken: token,
      expiraEm: expira,
    }).catch(() => {});

    auditar(req, { acao: 'CONVIDAR_SECRETARIA', metadata: { email, permissoes } });
    res.json({ ok: true, data: vinculo });
  } catch (e) { next(e); }
});

router.post('/secretarias/aceitar/:token', async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ ok: false, code: 'AUTH_REQUIRED', message: 'Faca login antes.' });
    const vinculo = await prisma.secretariaVinculo.findUnique({
      where: { conviteToken: req.params.token },
    });
    if (!vinculo) return res.status(404).json({ ok: false, code: 'CONVITE_INVALIDO' });
    if (vinculo.aceitoEm) return res.status(410).json({ ok: false, code: 'JA_ACEITO' });
    if (vinculo.conviteExpira && vinculo.conviteExpira < new Date()) {
      return res.status(410).json({ ok: false, code: 'EXPIROU' });
    }
    const updated = await prisma.secretariaVinculo.update({
      where: { id: vinculo.id },
      data: {
        usuarioId: req.user.id,
        ativo: true,
        aceitoEm: new Date(),
        conviteToken: null,
      },
    });
    perm.invalidarCache(req.user.id);
    auditar(req, { acao: 'ACEITAR_CONVITE', metadata: { medicoId: vinculo.medicoId } });
    res.json({ ok: true, data: updated });
  } catch (e) { next(e); }
});

router.put('/secretarias/:id', perm.medicoOnly, async (req, res, next) => {
  try {
    const vinculo = await prisma.secretariaVinculo.update({
      where: { id: req.params.id },
      data: { permissoes: req.body.permissoes, ativo: req.body.ativo !== undefined ? req.body.ativo : undefined },
    });
    perm.invalidarCache(vinculo.usuarioId);
    res.json({ ok: true, data: vinculo });
  } catch (e) { next(e); }
});

router.delete('/secretarias/:id', perm.medicoOnly, async (req, res, next) => {
  try {
    const vinculo = await prisma.secretariaVinculo.update({
      where: { id: req.params.id },
      data: { ativo: false, revogadoEm: new Date() },
    });
    perm.invalidarCache(vinculo.usuarioId);
    auditar(req, { acao: 'REVOGAR_SECRETARIA', recursoId: req.params.id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// =========================================================
// PUSH WEB
// =========================================================

router.get('/push/vapid-public-key', (req, res) => {
  res.json({ ok: true, data: { key: pushSvc.publicKey() } });
});

router.post('/push/subscribe', async (req, res, next) => {
  try {
    const sub = await pushSvc.inscrever(req.user.id, req.body, req.headers['user-agent']);
    res.json({ ok: true, data: { id: sub.id } });
  } catch (e) { next(e); }
});

router.delete('/push/subscribe', async (req, res, next) => {
  try {
    await pushSvc.desinscrever(req.user.id, req.body.endpoint);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
