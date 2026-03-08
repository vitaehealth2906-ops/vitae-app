const express = require('express');
const prisma = require('../utils/prisma');
const { verificarAuth } = require('../middleware/auth');
const scoreEngine = require('../services/score-engine');
const ai = require('../services/ai');

const router = express.Router();

router.use(verificarAuth);

function calcularIdadeCronologica(dataNascimento) {
  if (!dataNascimento) return null;
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mesDiff = hoje.getMonth() - nascimento.getMonth();
  if (mesDiff < 0 || (mesDiff === 0 && hoje.getDate() < nascimento.getDate())) idade--;
  return idade;
}

// GET /atual
router.get('/atual', async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id;

    const [scoreAtual, perfil] = await Promise.all([
      prisma.healthScore.findFirst({ where: { usuarioId }, orderBy: { criadoEm: 'desc' } }),
      prisma.perfilSaude.findUnique({ where: { usuarioId } }),
    ]);

    if (!scoreAtual) {
      return res.status(200).json({
        score: null,
        mensagem: 'Nenhum score calculado ainda. Envie exames ou faca um check-in.',
      });
    }

    return res.status(200).json({
      score: {
        scoreGeral: scoreAtual.scoreGeral,
        scoreSono: scoreAtual.scoreSono,
        scoreAtividade: scoreAtual.scoreAtividade,
        scoreProdutividade: scoreAtual.scoreProdutividade,
        scoreExame: scoreAtual.scoreExame,
        idadeBiologica: scoreAtual.idadeBiologica,
        idadeCronologica: perfil ? calcularIdadeCronologica(perfil.dataNascimento) : null,
        confianca: scoreAtual.confianca,
        criadoEm: scoreAtual.criadoEm,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /historico
router.get('/historico', async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id;
    const historico = await prisma.healthScore.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: 'asc' },
      select: {
        id: true, scoreGeral: true, scoreSono: true, scoreAtividade: true,
        scoreProdutividade: true, scoreExame: true, idadeBiologica: true,
        confianca: true, criadoEm: true,
      },
    });
    return res.status(200).json({ historico });
  } catch (err) {
    next(err);
  }
});

// GET /melhorias
router.get('/melhorias', async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id;

    const [perfil, exames, medicamentos, alergias, checkins, scoreAtual] = await Promise.all([
      prisma.perfilSaude.findUnique({ where: { usuarioId } }),
      prisma.exame.findMany({
        where: { usuarioId, status: 'CONCLUIDO' },
        include: { parametros: true },
        orderBy: { criadoEm: 'desc' },
        take: 10,
      }),
      prisma.medicamento.findMany({ where: { usuarioId, ativo: true } }),
      prisma.alergia.findMany({ where: { usuarioId } }),
      prisma.checkinSemanal.findMany({ where: { usuarioId }, orderBy: { criadoEm: 'desc' }, take: 4 }),
      prisma.healthScore.findFirst({ where: { usuarioId }, orderBy: { criadoEm: 'desc' } }),
    ]);

    // Se nao tem dados suficientes, retorna melhorias genericas
    if (!scoreAtual && exames.length === 0 && checkins.length === 0) {
      return res.status(200).json({
        melhorias: [
          { categoria: 'checkup', icone: '🔬', titulo: 'Faca seus exames', texto: 'Envie seus exames de sangue para receber recomendacoes personalizadas.', anosGanhos: 0 },
          { categoria: 'exercicio', icone: '🏃', titulo: 'Pratique atividade fisica', texto: '150 minutos de exercicio moderado por semana podem adicionar anos a sua vida.', anosGanhos: 3.5 },
          { categoria: 'sono', icone: '😴', titulo: 'Durma 7-8 horas', texto: 'Manter uma rotina de sono regular e essencial para a saude.', anosGanhos: 2.0 },
        ],
      });
    }

    const melhorias = await ai.gerarMelhorias(perfil, exames, medicamentos, alergias.map(a => a.nome), checkins, scoreAtual);
    return res.status(200).json({ melhorias });
  } catch (err) {
    next(err);
  }
});

// POST /recalcular
router.post('/recalcular', async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id;
    const scores = await scoreEngine.calcularScores(usuarioId);

    const novoScore = await prisma.healthScore.create({
      data: {
        usuarioId,
        scoreGeral: scores.scoreGeral || 0,
        scoreSono: scores.scoreSono,
        scoreAtividade: scores.scoreAtividade,
        scoreProdutividade: scores.scoreProdutividade,
        scoreExame: scores.scoreExame,
        confianca: scores.confianca,
        fontesDados: scores.fontesDados,
      },
    });

    return res.status(200).json({
      score: {
        scoreGeral: novoScore.scoreGeral,
        scoreSono: novoScore.scoreSono,
        scoreAtividade: novoScore.scoreAtividade,
        scoreProdutividade: novoScore.scoreProdutividade,
        scoreExame: novoScore.scoreExame,
        confianca: novoScore.confianca,
        criadoEm: novoScore.criadoEm,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
