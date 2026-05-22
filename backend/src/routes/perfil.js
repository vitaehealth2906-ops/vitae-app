const express = require('express');
const { z } = require('zod');
const prisma = require('../utils/prisma');
const { verificarAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { enfileirarRegeneracaoAsync } = require('../utils/invalidacao');

const router = express.Router();

// Todas as rotas requerem autenticacao
router.use(verificarAuth);

// ---------------------------------------------------------------------------
// Schemas de validacao
// ---------------------------------------------------------------------------

const atualizarPerfilSchema = z.object({
  genero: z.enum(['MASCULINO', 'FEMININO', 'OUTRO', 'NAO_INFORMADO']).optional(),
  dataNascimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .transform((val) => new Date(val))
    .optional(),
  alturaCm: z
    .number()
    .int()
    .min(50, 'Altura minima: 50cm')
    .max(300, 'Altura maxima: 300cm')
    .optional(),
  pesoKg: z
    .number()
    .min(1, 'Peso minimo: 1kg')
    .max(500, 'Peso maximo: 500kg')
    .optional(),
  tipoSanguineo: z
    .enum(['A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG'])
    .optional(),
  historicoFamiliar: z.array(z.string()).optional(),
  nivelAtividade: z
    .enum(['SEDENTARIO', 'LEVE', 'MODERADO', 'ATIVO', 'MUITO_ATIVO'])
    .optional(),
  horasSono: z
    .number()
    .min(0, 'Horas de sono minimo: 0')
    .max(24, 'Horas de sono maximo: 24')
    .optional(),
  fuma: z.boolean().optional(),
  alcool: z.enum(['NUNCA', 'RARAMENTE', 'SOCIALMENTE', 'FREQUENTEMENTE', 'DIARIAMENTE']).optional(),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 digitos').optional(),
  cirurgias: z.array(z.string()).optional(),
  planoSaude: z.string().optional(),
  carteirinhaPlano: z.string().optional(),
  condicoes: z.string().optional(),
  contatoEmergenciaNome: z.string().optional(),
  contatoEmergenciaTel: z.string().optional(),
  apelido: z.string().optional(),
  nomeSocial: z.string().optional(),
  estadoCivil: z.enum(['SOLTEIRO', 'CASADO', 'DIVORCIADO', 'VIUVO', 'UNIAO_ESTAVEL', 'OUTRO']).optional(),
  corEtnia: z.string().optional(),
  limitacoesAcessibilidade: z.object({
    cadeirante: z.boolean().optional(),
    deficienciaVisual: z.boolean().optional(),
    deficienciaAuditiva: z.boolean().optional(),
    deficienciaCognitiva: z.boolean().optional(),
    autismo: z.boolean().optional(),
    limitacaoPosCircurgia: z.boolean().optional(),
    descricao: z.string().optional(),
  }).optional(),
});

const atualizarContaSchema = z.object({
  nome: z.string().min(2).max(120).optional(),
  email: z.string().email('Email invalido').optional(),
  celular: z.string().optional(),
});

// ---------------------------------------------------------------------------
// GET /
// ---------------------------------------------------------------------------

router.get('/', async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      select: {
        id: true,
        nome: true,
        email: true,
        celular: true,
        fotoUrl: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({ erro: 'Usuario nao encontrado' });
    }

    // Defensivo: se flagsApp ainda não foi migrado, findUnique sem select quebra.
    // Tenta com flagsApp; se P2022, refaz sem.
    let perfil = null;
    try {
      perfil = await prisma.perfilSaude.findUnique({
        where: { usuarioId: req.usuario.id },
      });
    } catch (e) {
      if (e && e.code === 'P2022') {
        console.warn('[perfil GET] coluna pendente — refazendo query sem flagsApp');
        perfil = await prisma.perfilSaude.findUnique({
          where: { usuarioId: req.usuario.id },
          select: {
            id: true, usuarioId: true, genero: true, dataNascimento: true,
            alturaCm: true, pesoKg: true, tipoSanguineo: true,
            historicoFamiliar: true, nivelAtividade: true, horasSono: true,
            fuma: true, alcool: true, contatoEmergenciaNome: true,
            contatoEmergenciaTel: true, nomeMae: true, telMae: true,
            nomePai: true, telPai: true, condicoes: true, cpf: true,
            cirurgias: true, planoSaude: true, carteirinhaPlano: true,
            apelido: true, nomeSocial: true, estadoCivil: true, corEtnia: true,
            limitacoesAcessibilidade: true, atualizadoEm: true,
          },
        });
      } else {
        throw e;
      }
    }

    return res.status(200).json({
      usuario,
      perfil: perfil || {},
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /
// ---------------------------------------------------------------------------

router.put('/', validate(atualizarPerfilSchema), async (req, res, next) => {
  try {
    const dados = req.body;
    const usuarioId = req.usuario.id;

    const perfil = await prisma.perfilSaude.upsert({
      where: { usuarioId },
      update: {
        ...dados,
        atualizadoEm: new Date(),
      },
      create: {
        usuarioId,
        ...dados,
      },
    });

    // Fase 5 perf — invalida summary se mudaram dados clínicos relevantes
    const clinicoMudou = !!(dados.condicoes !== undefined || dados.cirurgias !== undefined || dados.historicoFamiliar !== undefined || dados.gestante !== undefined);
    if (clinicoMudou) {
      enfileirarRegeneracaoAsync(usuarioId, 'perfil', { op: 'update', campos: Object.keys(dados) });
    }

    return res.status(200).json({ perfil });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /conta — atualiza dados da conta (usuario: nome, email, celular)
// ---------------------------------------------------------------------------

router.patch('/conta', validate(atualizarContaSchema), async (req, res, next) => {
  try {
    const { nome, email, celular } = req.body;
    const updateData = {};
    if (nome !== undefined) updateData.nome = nome;
    if (email !== undefined) updateData.email = email;
    if (celular !== undefined) updateData.celular = celular;

    const usuario = await prisma.usuario.update({
      where: { id: req.usuario.id },
      data: updateData,
      select: { id: true, nome: true, email: true, celular: true },
    });

    return res.status(200).json({ usuario });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /foto
// ---------------------------------------------------------------------------

router.post('/foto', async (req, res, next) => {
  try {
    // TODO: Implementar upload com multer + servico de storage (S3/GCS)
    // Por enquanto, placeholder que aceita URL direta
    const { fotoUrl } = req.body;

    if (!fotoUrl) {
      return res.status(400).json({ erro: 'URL da foto e obrigatoria' });
    }

    await prisma.usuario.update({
      where: { id: req.usuario.id },
      data: { fotoUrl },
    });

    return res.status(200).json({ fotoUrl });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /flags-app — flags do app (onboarding visto, exames já avisados)
// Defensivo: se coluna flags_app não existe (migração não aplicada), retorna {}.
// ---------------------------------------------------------------------------

router.get('/flags-app', async (req, res, next) => {
  try {
    const perfil = await prisma.perfilSaude.findUnique({
      where: { usuarioId: req.usuario.id },
      select: { flagsApp: true },
    });
    return res.status(200).json({ flagsApp: (perfil && perfil.flagsApp) || {} });
  } catch (err) {
    // P2022 (coluna não existe) ou P2021 (tabela não existe) — tolera, retorna vazio
    if (err && (err.code === 'P2022' || err.code === 'P2021')) {
      console.warn('[perfil/flags-app] coluna flags_app ausente — rodar migration 20260522_flags_app_onboarding');
      return res.status(200).json({ flagsApp: {} });
    }
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /flags-app — merge incremental nas flags (não substitui o objeto inteiro)
// Body aceito: { onboardingExamesVisto?: ISOString, onboardingConsultasVisto?: ISOString, ... }
// ---------------------------------------------------------------------------

const flagsAppSchema = z.object({
  onboardingExamesVisto: z.string().optional(),
  onboardingConsultasVisto: z.string().optional(),
  onboardingQrCodeVisto: z.string().optional(),
  onboardingSaudeVisto: z.string().optional(),
  examesAvisadosIds: z.array(z.string()).max(500).optional(),
  examesVistosIds: z.array(z.string()).max(500).optional(),
}).passthrough(); // permite chaves futuras sem quebrar

router.post('/flags-app', validate(flagsAppSchema), async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id;
    const novosCampos = req.body || {};

    // Merge: lê flags atuais, sobrescreve só as chaves enviadas
    let flagsAtuais = {};
    try {
      const atual = await prisma.perfilSaude.findUnique({
        where: { usuarioId },
        select: { flagsApp: true },
      });
      flagsAtuais = (atual && atual.flagsApp) || {};
    } catch (e) {
      if (e && (e.code === 'P2022' || e.code === 'P2021')) {
        // Coluna não existe — não persiste, mas devolve 200 pra não travar UX
        console.warn('[perfil/flags-app POST] coluna flags_app ausente — flag enviada perdida ate migration rodar');
        return res.status(200).json({ flagsApp: novosCampos, persistido: false });
      }
      throw e;
    }

    const flagsMerged = { ...flagsAtuais, ...novosCampos };

    try {
      await prisma.perfilSaude.upsert({
        where: { usuarioId },
        update: { flagsApp: flagsMerged, atualizadoEm: new Date() },
        create: { usuarioId, flagsApp: flagsMerged },
      });
    } catch (e) {
      if (e && (e.code === 'P2022' || e.code === 'P2021')) {
        console.warn('[perfil/flags-app POST upsert] coluna ausente — retornando 200 sem persistir');
        return res.status(200).json({ flagsApp: novosCampos, persistido: false });
      }
      throw e;
    }

    return res.status(200).json({ flagsApp: flagsMerged, persistido: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
