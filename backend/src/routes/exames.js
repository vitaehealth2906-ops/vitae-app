const express = require('express');
const multer = require('multer');
const prisma = require('../utils/prisma');
const { verificarAuth } = require('../middleware/auth');
const storage = require('../services/storage');
const ocr = require('../services/ocr');
const ai = require('../services/ai');
const scoreEngine = require('../services/score-engine');

const router = express.Router();

router.use(verificarAuth);

const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const MAX_TAMANHO = 20 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TAMANHO },
  fileFilter: (_req, file, cb) => {
    if (TIPOS_PERMITIDOS.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de arquivo nao permitido. Envie PDF, JPG ou PNG.'));
  },
});

async function processarExame(exameId, usuarioId) {
  try {
    await prisma.exame.update({ where: { id: exameId }, data: { status: 'PROCESSANDO' } });

    const exame = await prisma.exame.findUnique({ where: { id: exameId } });

    let textoExtraido;
    if (exame.arquivoUrl) {
      if (exame.arquivoUrl.startsWith('/uploads/')) {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(__dirname, '../..', exame.arquivoUrl);
        const buffer = fs.readFileSync(filePath);
        textoExtraido = await ocr.extrairTexto(buffer, exame.tipoArquivo);
      } else {
        const response = await fetch(exame.arquivoUrl);
        const buffer = Buffer.from(await response.arrayBuffer());
        textoExtraido = await ocr.extrairTexto(buffer, exame.tipoArquivo);
      }
    }

    const [perfil, medicamentos, alergias] = await Promise.all([
      prisma.perfilSaude.findUnique({ where: { usuarioId } }),
      prisma.medicamento.findMany({ where: { usuarioId, ativo: true } }),
      prisma.alergia.findMany({ where: { usuarioId } }),
    ]);

    const contexto = {
      perfil,
      medicamentos: medicamentos.map((m) => m.nome),
      alergias: alergias.map((a) => a.nome),
      historicoFamiliar: perfil?.historicoFamiliar || [],
    };

    const dadosEstruturados = await ai.estruturarExame(textoExtraido, contexto);
    const analise = await ai.gerarAnaliseExame(dadosEstruturados, contexto);

    await prisma.$transaction(async (tx) => {
      if (dadosEstruturados.parametros && dadosEstruturados.parametros.length > 0) {
        await tx.parametroExame.createMany({
          data: dadosEstruturados.parametros.map((p) => ({
            exameId,
            nome: p.nome || '',
            valor: String(p.valor || ''),
            unidade: p.unidade || null,
            valorReferencia: p.referencia_texto || null,
            referenciaTexto: p.referencia_texto || null,
            classificacao: p.classificacao || 'NORMAL',
            status: p.classificacao || 'NORMAL',
          })),
        });
      }

      await tx.exame.update({
        where: { id: exameId },
        data: {
          status: 'CONCLUIDO',
          textoExtraido,
          tipoExame: dadosEstruturados.tipo_exame || dadosEstruturados.nome_exame || null,
          laboratorio: dadosEstruturados.laboratorio || null,
          dadosEstruturados: dadosEstruturados,
          resumoIA: analise.resumo || dadosEstruturados.resumo || null,
          impactosIA: analise.impactos || dadosEstruturados.impactos || null,
          melhoriasIA: analise.melhorias || dadosEstruturados.melhorias || null,
          statusGeral: dadosEstruturados.status_geral || 'NORMAL',
          processadoEm: new Date(),
          dataExame: dadosEstruturados.data_exame ? new Date(dadosEstruturados.data_exame) : null,
        },
      });
    });

    try {
      const scores = await scoreEngine.calcularScores(usuarioId);
      await prisma.healthScore.create({
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
    } catch (scoreErr) {
      console.error(`[EXAME] Erro ao calcular scores: ${scoreErr.message}`);
    }

    console.log(`[EXAME] Exame ${exameId} processado com sucesso!`);
  } catch (err) {
    console.error(`[EXAME] Erro ao processar exame ${exameId}:`, err);
    await prisma.exame.update({
      where: { id: exameId },
      data: { status: 'ERRO', erroProcessamento: err.message },
    }).catch(() => {});
  }
}

router.post('/upload', upload.single('arquivo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ erro: 'Arquivo e obrigatorio' });

    const usuarioId = req.usuario.id;
    const { originalname, mimetype, buffer, size } = req.file;

    const arquivoUrl = await storage.upload({ buffer, nomeOriginal: originalname, mimetype, pasta: `exames/${usuarioId}` });

    const exame = await prisma.exame.create({
      data: {
        usuarioId,
        nomeArquivo: originalname,
        tipoArquivo: mimetype,
        tamanhoBytes: size,
        arquivoUrl,
        status: 'ENVIADO',
        dataExame: req.body.dataExame ? new Date(req.body.dataExame) : new Date(),
      },
    });

    processarExame(exame.id, usuarioId);

    return res.status(201).json({ mensagem: 'Exame enviado! Processando...', exameId: exame.id });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id;
    const exames = await prisma.exame.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true, nomeArquivo: true, tipoExame: true, laboratorio: true,
        dataExame: true, status: true, statusGeral: true, criadoEm: true,
        _count: { select: { parametros: true } },
      },
    });

    return res.status(200).json({
      exames: exames.map((e) => ({
        id: e.id, nomeArquivo: e.nomeArquivo, tipoExame: e.tipoExame,
        laboratorio: e.laboratorio, dataExame: e.dataExame, status: e.status,
        statusGeral: e.statusGeral, totalParametros: e._count.parametros, criadoEm: e.criadoEm,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario.id;
    const exame = await prisma.exame.findUnique({
      where: { id },
      include: { parametros: { orderBy: { nome: 'asc' } } },
    });
    if (!exame) return res.status(404).json({ erro: 'Exame nao encontrado' });
    if (exame.usuarioId !== usuarioId) return res.status(403).json({ erro: 'Acesso negado' });
    return res.status(200).json({ exame });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario.id;
    const exame = await prisma.exame.findUnique({ where: { id } });
    if (!exame) return res.status(404).json({ erro: 'Exame nao encontrado' });
    if (exame.usuarioId !== usuarioId) return res.status(403).json({ erro: 'Acesso negado' });
    try { await storage.deletar(exame.arquivoUrl); } catch {}
    await prisma.exame.delete({ where: { id } });
    return res.status(200).json({ mensagem: 'Exame removido' });
  } catch (err) {
    next(err);
  }
});

router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ erro: 'Arquivo muito grande. Maximo: 20MB' });
    return res.status(400).json({ erro: `Erro no upload: ${err.message}` });
  }
  if (err.message && err.message.includes('Tipo de arquivo')) return res.status(400).json({ erro: err.message });
  next(err);
});

module.exports = router;
