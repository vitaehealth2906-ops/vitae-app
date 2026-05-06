const express = require('express');
const prisma = require('../utils/prisma');
const { verificarAuth } = require('../middleware/auth');

const router = express.Router();

// Todas as rotas requerem autenticacao
router.use(verificarAuth);

// ---------------------------------------------------------------------------
// GET /
// ---------------------------------------------------------------------------

router.get('/', async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id;

    const { pagina = 1, limite = 20, apenasNaoLidas } = req.query;
    const skip = (parseInt(pagina, 10) - 1) * parseInt(limite, 10);
    const take = parseInt(limite, 10);

    const where = { usuarioId };
    if (apenasNaoLidas === 'true') {
      where.lida = false;
    }

    const [notificacoes, total] = await Promise.all([
      prisma.notificacao.findMany({
        where,
        orderBy: { enviadaEm: 'desc' },
        skip,
        take,
      }),
      prisma.notificacao.count({ where }),
    ]);

    const naoLidas = await prisma.notificacao.count({
      where: { usuarioId, lida: false },
    });

    return res.status(200).json({
      notificacoes,
      total,
      naoLidas,
      pagina: parseInt(pagina, 10),
      totalPaginas: Math.ceil(total / take),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /:id/ler
// ---------------------------------------------------------------------------

router.put('/:id/ler', async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario.id;

    const notificacao = await prisma.notificacao.findUnique({ where: { id } });

    if (!notificacao) {
      return res.status(404).json({ erro: 'Notificacao nao encontrada' });
    }

    if (notificacao.usuarioId !== usuarioId) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const atualizada = await prisma.notificacao.update({
      where: { id },
      data: {
        lida: true,
        lidaEm: new Date(),
      },
    });

    return res.status(200).json({ notificacao: atualizada });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /config
// ---------------------------------------------------------------------------

router.put('/config', async (req, res, next) => {
  try {
    // TODO: Implementar preferencias de notificacao
    // Campos previstos: pushHabilitado, emailHabilitado, smsHabilitado,
    //                   horarioSilencioInicio, horarioSilencioFim,
    //                   tiposHabilitados (array de tipos de notificacao)

    return res.status(200).json({ mensagem: 'Preferencias atualizadas' });
  } catch (err) {
    next(err);
  }
});

// =====================================================================
// FASE 10b — WhatsApp em massa
// =====================================================================
const { dispararEmMassa, MODO: WPP_MODO } = require('../services/whatsapp');

/**
 * POST /notificacoes/lembrete-massa
 * Body: { destinatarios: [{ telefone, nome, data, link, pacienteId, templateSid }],
 *         mensagem: 'template com {{placeholders}}',
 *         agendadoPara?: ISO date }
 */
router.post('/lembrete-massa', async (req, res, next) => {
  try {
    const { destinatarios, mensagem, agendadoPara } = req.body || {};
    if (!Array.isArray(destinatarios) || !destinatarios.length) {
      return res.status(400).json({ erro: 'Lista de destinatários vazia.' });
    }
    if (destinatarios.length > 200) {
      return res.status(400).json({ erro: 'Máximo 200 destinatários por disparo.' });
    }
    if (agendadoPara && new Date(agendadoPara) < new Date(Date.now() - 60*1000)) {
      return res.status(400).json({ erro: 'Data de envio agendada está no passado.' });
    }
    const medico = await prisma.medico.findUnique({
      where: { usuarioId: req.usuario.id },
      include: { usuario: { select: { nome: true } } },
    });
    if (!medico) return res.status(404).json({ erro: 'Perfil médico não encontrado' });

    const msgTemplate = mensagem || medico.mensagemLembretePadrao;

    const resultado = await dispararEmMassa({
      medicoId: medico.id,
      destinatarios,
      mensagemTemplate: msgTemplate,
      agendadoPara,
      medico: { nome: medico.usuario?.nome },
    });

    return res.status(resultado.ok ? 200 : 429).json(resultado);
  } catch (err) { next(err); }
});

/**
 * GET /notificacoes/historico?periodo=7
 */
router.get('/historico', async (req, res, next) => {
  try {
    const dias = Math.min(Math.max(parseInt(req.query.periodo, 10) || 30, 1), 365);
    const desde = new Date(Date.now() - dias * 86400000);
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) return res.status(404).json({ erro: 'Perfil médico não encontrado' });

    const disparos = await prisma.notificacaoDisparo.findMany({
      where: { medicoId: medico.id, criadoEm: { gte: desde } },
      orderBy: { criadoEm: 'desc' },
      take: 500,
    });
    return res.status(200).json({
      modo: WPP_MODO,
      total: disparos.length,
      disparos,
    });
  } catch (err) { next(err); }
});

module.exports = router;
