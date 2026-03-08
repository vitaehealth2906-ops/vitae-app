const express = require('express');
const prisma = require('../utils/prisma');
const { verificarAuth } = require('../middleware/auth');

const router = express.Router();

function formatarData(data) {
  if (!data) return '---';
  return new Date(data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// POST /gerar — retorna dados para o frontend gerar o PDF
router.post('/gerar', verificarAuth, async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id;

    const [usuario, perfil, score, exames, medicamentos, alergias] = await Promise.all([
      prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { id: true, nome: true, email: true },
      }),
      prisma.perfilSaude.findUnique({ where: { usuarioId } }),
      prisma.healthScore.findFirst({ where: { usuarioId }, orderBy: { criadoEm: 'desc' } }),
      prisma.exame.findMany({
        where: { usuarioId, status: 'CONCLUIDO' },
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true, nomeArquivo: true, tipoExame: true, dataExame: true,
          statusGeral: true, _count: { select: { parametros: true } },
        },
      }),
      prisma.medicamento.findMany({ where: { usuarioId, ativo: true }, orderBy: { nome: 'asc' } }),
      prisma.alergia.findMany({ where: { usuarioId }, orderBy: { nome: 'asc' } }),
    ]);

    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado' });

    return res.status(200).json({
      usuario,
      perfil: perfil || {},
      score: score || null,
      exames: exames.map(e => ({
        ...e,
        dataExameFormatada: formatarData(e.dataExame),
        totalParametros: e._count.parametros,
      })),
      medicamentos,
      alergias,
      geradoEm: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
