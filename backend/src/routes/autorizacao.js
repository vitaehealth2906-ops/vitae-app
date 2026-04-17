const express = require('express');
const { z } = require('zod');
const prisma = require('../utils/prisma');
const { verificarAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { auditar } = require('../utils/auditoria');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /rg-publico/:userId — Dados publicos do RG (sem auth — leitura publica)
// ---------------------------------------------------------------------------

router.get('/rg-publico/:userId', async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.params.userId },
      select: { id: true, nome: true, email: true, celular: true },
    });

    if (!usuario) {
      return res.status(404).json({ erro: 'Usuario nao encontrado' });
    }

    const perfil = await prisma.perfilSaude.findUnique({
      where: { usuarioId: usuario.id },
    });

    const [medicamentos, alergias, examesRecentes] = await Promise.all([
      prisma.medicamento.findMany({
        where: { usuarioId: usuario.id, ativo: true },
        select: { nome: true, dosagem: true, frequencia: true },
      }),
      prisma.alergia.findMany({
        where: { usuarioId: usuario.id },
        select: { nome: true, tipo: true, gravidade: true },
      }),
      prisma.exame.findMany({
        where: { usuarioId: usuario.id },
        orderBy: { dataExame: 'desc' },
        take: 50,
        select: {
          id: true,
          tipoExame: true,
          nomeArquivo: true,
          dataExame: true,
          statusGeral: true,
          status: true,
          laboratorio: true,
          medicoSolicitante: true,
          arquivoUrl: true,
        },
      }),
    ]);

    // Retornar todos os dados relevantes para o RG publico
    const perfilPublico = perfil ? {
      genero: perfil.genero,
      dataNascimento: perfil.dataNascimento,
      tipoSanguineo: perfil.tipoSanguineo,
      pesoKg: perfil.pesoKg,
      alturaCm: perfil.alturaCm,
      cpf: perfil.cpf ? perfil.cpf.slice(0,3) + '.***.***-' + perfil.cpf.slice(-2) : null,
      apelido: perfil.apelido,
      nomeSocial: perfil.nomeSocial,
      condicoes: perfil.condicoes,
      cirurgias: perfil.cirurgias || [],
      planoSaude: perfil.planoSaude,
      carteirinhaPlano: perfil.carteirinhaPlano,
      historicoFamiliar: perfil.historicoFamiliar || [],
      limitacoesAcessibilidade: perfil.limitacoesAcessibilidade,
      contatoEmergenciaNome: perfil.contatoEmergenciaNome,
      contatoEmergenciaTel: perfil.contatoEmergenciaTel,
      nomeMae: perfil.nomeMae,
      telMae: perfil.telMae,
      nomePai: perfil.nomePai,
      telPai: perfil.telPai,
    } : {};

    // Auditoria — registra acesso publico ao RG (sem auth)
    auditar(req, {
      acao: 'VIEW_RG_PUBLICO',
      atorTipo: 'PUBLICO',
      recursoTipo: 'RG_PUBLICO',
      recursoId: usuario.id,
      alvoId: usuario.id,
    });

    return res.status(200).json({
      usuario,
      perfil: perfilPublico,
      alergias,
      medicamentos,
      examesRecentes,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /exame-publico/:userId/:examId — Exame completo publico (sem auth)
// Valida que o exame pertence ao userId antes de expor os dados
// ---------------------------------------------------------------------------

router.get('/exame-publico/:userId/:examId', async (req, res, next) => {
  try {
    const exame = await prisma.exame.findUnique({
      where: { id: req.params.examId },
      include: { parametros: { orderBy: { nome: 'asc' } } },
    });

    if (!exame || exame.usuarioId !== req.params.userId) {
      return res.status(404).json({ erro: 'Exame nao encontrado' });
    }

    return res.status(200).json({ exame });
  } catch (err) {
    next(err);
  }
});

// Todas as rotas abaixo requerem autenticacao
router.use(verificarAuth);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const autorizarSchema = z.object({
  medicoCrm: z.string().min(4, 'CRM do medico obrigatorio'),
  tipoAcesso: z.enum(['LEITURA', 'COMPLETO']).optional(),
  categorias: z.array(z.string()).optional(),
  duracaoDias: z.number().int().min(1).max(365).optional(),
});

// ---------------------------------------------------------------------------
// POST / — Paciente autoriza acesso a um medico
// ---------------------------------------------------------------------------

router.post('/', validate(autorizarSchema), async (req, res, next) => {
  try {
    const pacienteId = req.usuario.id;
    const { medicoCrm, tipoAcesso, categorias, duracaoDias } = req.body;

    // Buscar medico pelo CRM
    const medico = await prisma.medico.findUnique({ where: { crm: medicoCrm } });
    if (!medico) {
      return res.status(404).json({ erro: 'Medico nao encontrado com este CRM' });
    }

    // Verificar se ja existe autorizacao ativa
    const existente = await prisma.autorizacaoAcesso.findFirst({
      where: { pacienteId, medicoId: medico.id, ativo: true },
    });

    if (existente) {
      return res.status(409).json({ erro: 'Ja existe autorizacao ativa para este medico' });
    }

    const autorizacao = await prisma.autorizacaoAcesso.create({
      data: {
        pacienteId,
        medicoId: medico.id,
        tipoAcesso: tipoAcesso || 'LEITURA',
        categorias: categorias || ['exames', 'perfil'],
        expiraEm: duracaoDias
          ? new Date(Date.now() + duracaoDias * 24 * 60 * 60 * 1000)
          : null,
      },
    });

    return res.status(201).json({ autorizacao });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET / — Listar autorizacoes do paciente
// ---------------------------------------------------------------------------

router.get('/', async (req, res, next) => {
  try {
    const autorizacoes = await prisma.autorizacaoAcesso.findMany({
      where: { pacienteId: req.usuario.id },
      include: {
        medico: {
          include: {
            usuario: { select: { nome: true } },
          },
        },
      },
      orderBy: { criadoEm: 'desc' },
    });

    return res.status(200).json({ autorizacoes });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id — Revogar autorizacao
// ---------------------------------------------------------------------------

router.delete('/:id', async (req, res, next) => {
  try {
    const autorizacao = await prisma.autorizacaoAcesso.findFirst({
      where: { id: req.params.id, pacienteId: req.usuario.id },
    });

    if (!autorizacao) {
      return res.status(404).json({ erro: 'Autorizacao nao encontrada' });
    }

    await prisma.autorizacaoAcesso.update({
      where: { id: autorizacao.id },
      data: { ativo: false, revogadoEm: new Date() },
    });

    return res.status(200).json({ mensagem: 'Autorizacao revogada' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /qr-data — Dados para gerar QR code do paciente
// ---------------------------------------------------------------------------

router.get('/qr-data', async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      select: { id: true, nome: true, email: true, celular: true },
    });

    const perfil = await prisma.perfilSaude.findUnique({
      where: { usuarioId: req.usuario.id },
    });

    const [medicamentos, alergias, ultimoExame] = await Promise.all([
      prisma.medicamento.findMany({
        where: { usuarioId: req.usuario.id, ativo: true },
        select: { nome: true, dosagem: true },
      }),
      prisma.alergia.findMany({
        where: { usuarioId: req.usuario.id },
        select: { nome: true, gravidade: true },
      }),
      prisma.exame.findFirst({
        where: { usuarioId: req.usuario.id, status: 'PROCESSADO' },
        orderBy: { dataExame: 'desc' },
        select: { tipoExame: true, dataExame: true, statusGeral: true },
      }),
    ]);

    return res.status(200).json({
      usuario,
      perfil: perfil || {},
      medicamentos,
      alergias,
      ultimoExame,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
