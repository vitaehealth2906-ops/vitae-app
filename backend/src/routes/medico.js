const express = require('express');
const { z } = require('zod');
const prisma = require('../utils/prisma');
const { verificarAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const storage = require('../services/storage');

const router = express.Router();

router.use(verificarAuth);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const cadastroMedicoSchema = z.object({
  crm: z.string().min(4, 'CRM invalido').max(20),
  ufCrm: z.string().length(2, 'UF deve ter 2 caracteres'),
  especialidade: z.string().min(2, 'Especialidade obrigatoria'),
  clinica: z.string().optional(),
  enderecoClinica: z.string().optional(),
  telefoneClinica: z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST / — Cadastrar perfil medico
// ---------------------------------------------------------------------------

router.post('/', validate(cadastroMedicoSchema), async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id;
    const { crm, ufCrm, especialidade, clinica, enderecoClinica, telefoneClinica } = req.body;

    // Verificar se ja tem perfil medico
    const existente = await prisma.medico.findUnique({ where: { usuarioId } });
    if (existente) {
      return res.status(409).json({ erro: 'Perfil medico ja existe' });
    }

    // Atualizar tipo do usuario
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { tipo: 'MEDICO' },
    });

    const medico = await prisma.medico.create({
      data: {
        usuarioId,
        crm,
        ufCrm: ufCrm.toUpperCase(),
        especialidade,
        clinica,
        enderecoClinica,
        telefoneClinica,
      },
    });

    return res.status(201).json({ medico });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET / — Obter perfil medico
// ---------------------------------------------------------------------------

router.get('/', async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({
      where: { usuarioId: req.usuario.id },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true, celular: true, fotoUrl: true },
        },
      },
    });

    if (!medico) {
      return res.status(404).json({ erro: 'Perfil medico nao encontrado' });
    }

    return res.status(200).json({ medico });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT / — Atualizar perfil medico
// ---------------------------------------------------------------------------

router.put('/', async (req, res, next) => {
  try {
    const { especialidade, clinica, enderecoClinica, telefoneClinica } = req.body;

    const medico = await prisma.medico.update({
      where: { usuarioId: req.usuario.id },
      data: {
        ...(especialidade && { especialidade }),
        ...(clinica !== undefined && { clinica }),
        ...(enderecoClinica !== undefined && { enderecoClinica }),
        ...(telefoneClinica !== undefined && { telefoneClinica }),
      },
    });

    return res.status(200).json({ medico });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /pacientes — Listar pacientes que autorizaram acesso
// ---------------------------------------------------------------------------

router.get('/pacientes', async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) {
      return res.status(403).json({ erro: 'Perfil medico nao encontrado' });
    }

    const autorizacoes = await prisma.autorizacaoAcesso.findMany({
      where: { medicoId: medico.id, ativo: true },
      include: {
        paciente: {
          select: {
            id: true,
            nome: true,
            email: true,
            celular: true,
            fotoUrl: true,
            perfilSaude: true,
          },
        },
      },
    });

    const pacientes = autorizacoes.map((a) => ({
      autorizacaoId: a.id,
      tipoAcesso: a.tipoAcesso,
      categorias: a.categorias,
      expiraEm: a.expiraEm,
      ...a.paciente,
    }));

    return res.status(200).json({ pacientes });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /dashboard — Stats do medico
// ---------------------------------------------------------------------------

router.get('/dashboard', async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) {
      return res.status(403).json({ erro: 'Perfil medico nao encontrado' });
    }

    const [totalPacientes, preConsultasPendentes, preConsultasRespondidas] = await Promise.all([
      prisma.autorizacaoAcesso.count({ where: { medicoId: medico.id, ativo: true } }),
      prisma.preConsulta.count({ where: { medicoId: medico.id, status: 'PENDENTE' } }),
      prisma.preConsulta.count({ where: { medicoId: medico.id, status: 'RESPONDIDA' } }),
    ]);

    return res.status(200).json({
      totalPacientes,
      preConsultasPendentes,
      preConsultasRespondidas,
      totalPreConsultas: preConsultasPendentes + preConsultasRespondidas,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /pacientes/:pacienteId — Perfil completo do paciente (medico)
// Busca Usuario + PerfilSaude + Exames + Alergias + Medicamentos
// Só retorna se houve pelo menos 1 pré-consulta entre esse paciente e o médico
// ---------------------------------------------------------------------------

router.get('/pacientes/:pacienteId', async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) {
      return res.status(403).json({ erro: 'Perfil medico nao encontrado' });
    }

    const { pacienteId } = req.params;

    // Verifica vinculo: o paciente respondeu pelo menos 1 pre-consulta desse medico
    const vinculo = await prisma.preConsulta.findFirst({
      where: { medicoId: medico.id, pacienteId },
      select: { id: true },
    });

    if (!vinculo) {
      return res.status(403).json({ erro: 'Voce nao tem acesso a esse paciente' });
    }

    const paciente = await prisma.usuario.findUnique({
      where: { id: pacienteId },
      select: {
        id: true,
        nome: true,
        email: true,
        celular: true,
        fotoUrl: true,
        perfilSaude: true,
        medicamentos: {
          orderBy: { criadoEm: 'desc' },
        },
        alergias: { orderBy: { criadoEm: 'desc' } },
        exames: {
          orderBy: { dataExame: 'desc' },
          take: 20,
          select: {
            id: true,
            tipoExame: true,
            laboratorio: true,
            dataExame: true,
            status: true,
            statusGeral: true,
            resumoIA: true,
            arquivoUrl: true,
            nomeArquivo: true,
            tipoArquivo: true,
            criadoEm: true,
            parametros: {
              select: {
                nome: true,
                valor: true,
                unidade: true,
                valorReferencia: true,
                status: true,
                classificacao: true,
              },
            },
          },
        },
      },
    });

    if (!paciente) {
      return res.status(404).json({ erro: 'Paciente nao encontrado' });
    }

    const preConsultas = await prisma.preConsulta.findMany({
      where: { medicoId: medico.id, pacienteId },
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        status: true,
        respondidaEm: true,
        criadoEm: true,
        summaryIA: true,
        audioUrl: true,
        audioSummaryUrl: true,
      },
    });

    return res.status(200).json({ paciente, preConsultas });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /limpeza-antigas — Remove pre-consultas antigas sem vinculo (medico logado)
// Apaga registros PreConsulta do MEDICO atual onde pacienteId IS NULL
// e criadoEm < data de corte. Limpa arquivos do storage tambem.
// Idempotente — pode ser chamado quantas vezes quiser.
// ---------------------------------------------------------------------------

router.post('/limpeza-antigas', async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) {
      return res.status(403).json({ erro: 'Apenas medicos podem executar limpeza' });
    }

    // Data de corte: inicio do fluxo novo (14/04/2026 00:00 UTC)
    const dataCorte = new Date('2026-04-14T00:00:00.000Z');

    // Busca pre-consultas do medico sem pacienteId (sem vinculo real)
    const candidatas = await prisma.preConsulta.findMany({
      where: {
        medicoId: medico.id,
        pacienteId: null,
        criadoEm: { lt: dataCorte },
      },
      select: {
        id: true,
        pacienteNome: true,
        audioUrl: true,
        pacienteFotoUrl: true,
        audioSummaryUrl: true,
      },
    });

    if (candidatas.length === 0) {
      return res.status(200).json({ ok: true, apagadas: 0, mensagem: 'Nada a limpar.' });
    }

    // Apaga arquivos do storage (fire-and-forget, nao bloqueia)
    const promessasStorage = candidatas.flatMap((pc) => {
      const lista = [];
      if (pc.audioUrl) lista.push(storage.deletar(pc.audioUrl).catch(() => {}));
      if (pc.pacienteFotoUrl) lista.push(storage.deletar(pc.pacienteFotoUrl).catch(() => {}));
      if (pc.audioSummaryUrl) lista.push(storage.deletar(pc.audioSummaryUrl).catch(() => {}));
      return lista;
    });
    await Promise.allSettled(promessasStorage);

    // Apaga os registros do banco
    const resultado = await prisma.preConsulta.deleteMany({
      where: {
        id: { in: candidatas.map((c) => c.id) },
      },
    });

    return res.status(200).json({
      ok: true,
      apagadas: resultado.count,
      nomes: candidatas.map((c) => c.pacienteNome),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /diagnostico-pre-consulta — Lista as ultimas pre-consultas do medico
// com info detalhada (audioUrl, fotoUrl, transcricao, tamanho do summary,
// respostas) para diagnosticar problemas de entrega.
// Temporario — remover quando tudo estiver estavel.
// ---------------------------------------------------------------------------

router.get('/diagnostico-pre-consulta', async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) return res.status(403).json({ erro: 'Apenas medicos' });

    const preConsultas = await prisma.preConsulta.findMany({
      where: { medicoId: medico.id },
      orderBy: { criadoEm: 'desc' },
      take: 10,
      select: {
        id: true,
        pacienteNome: true,
        pacienteId: true,
        status: true,
        respondidaEm: true,
        criadoEm: true,
        audioUrl: true,
        pacienteFotoUrl: true,
        audioSummaryUrl: true,
        transcricao: true,
        summaryIA: true,
        respostas: true,
      },
    });

    const diagnostico = preConsultas.map((pc) => {
      const respostasKeys = pc.respostas && typeof pc.respostas === 'object' ? Object.keys(pc.respostas) : [];
      return {
        id: pc.id,
        paciente: pc.pacienteNome,
        temVinculo: !!pc.pacienteId,
        status: pc.status,
        respondidaEm: pc.respondidaEm,
        criadoEm: pc.criadoEm,
        audioChegou: !!pc.audioUrl,
        audioUrl: pc.audioUrl,
        fotoChegou: !!pc.pacienteFotoUrl,
        fotoUrl: pc.pacienteFotoUrl,
        ttsGerado: !!pc.audioSummaryUrl,
        transcricaoChegou: !!(pc.transcricao && pc.transcricao.length > 5 && pc.transcricao !== '(áudio sem transcrição)'),
        transcricaoTamanho: pc.transcricao ? pc.transcricao.length : 0,
        transcricaoPreview: pc.transcricao ? String(pc.transcricao).substring(0, 100) : null,
        summaryGerado: !!(pc.summaryIA && pc.summaryIA.length > 20),
        summaryTamanho: pc.summaryIA ? pc.summaryIA.length : 0,
        respostasCampos: respostasKeys,
        metodoResposta: pc.respostas && pc.respostas.metodo,
      };
    });

    return res.status(200).json({ total: diagnostico.length, preConsultas: diagnostico });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
