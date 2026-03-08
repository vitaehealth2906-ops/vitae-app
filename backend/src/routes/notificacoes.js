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

module.exports = router;
