const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const prisma = require('../utils/prisma');
const { verificarAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { gerarSummaryPreConsulta, gerarAudioElevenLabs } = require('../services/ai');
const { enviarEmailPreConsultaRespondida } = require('../services/email');
const { enviarSMSConfirmacaoPreConsulta } = require('../services/sms');

const router = express.Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const criarPreConsultaSchema = z.object({
  pacienteNome: z.string().min(2, 'Nome do paciente obrigatorio'),
  pacienteTel: z.string().optional(),
  pacienteEmail: z.string().email().optional(),
});

const responderPreConsultaSchema = z.object({
  respostas: z.record(z.any()), // aceita qualquer estrutura — todos os campos do formulario
  transcricao: z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST / — Medico cria link de pre-consulta (autenticado)
// ---------------------------------------------------------------------------

router.post('/', verificarAuth, validate(criarPreConsultaSchema), async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) {
      return res.status(403).json({ erro: 'Apenas medicos podem criar pre-consultas' });
    }

    const { pacienteNome, pacienteTel, pacienteEmail } = req.body;
    const linkToken = crypto.randomBytes(24).toString('hex');

    const preConsulta = await prisma.preConsulta.create({
      data: {
        medicoId: medico.id,
        pacienteNome,
        pacienteTel,
        pacienteEmail,
        linkToken,
        expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
      },
    });

    const baseUrl = process.env.FRONTEND_URL || 'https://vitaehealth2906-ops.github.io/vitae-app';
    const link = `${baseUrl}/pre-consulta.html?token=${linkToken}`;

    return res.status(201).json({
      preConsulta,
      link,
      whatsappLink: pacienteTel
        ? `https://wa.me/${pacienteTel.replace(/\D/g, '')}?text=${encodeURIComponent(
            `Olá ${pacienteNome}! Antes da sua consulta, preencha este formulário: ${link}`
          )}`
        : null,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /t/:token — Buscar pre-consulta por token (publico)
// Marca link como aberto + tenta auto-fill pelo telefone/email do paciente
// ---------------------------------------------------------------------------

router.get('/t/:token', async (req, res, next) => {
  try {
    const preConsulta = await prisma.preConsulta.findUnique({
      where: { linkToken: req.params.token },
      include: {
        medico: {
          include: {
            usuario: { select: { nome: true } },
          },
        },
      },
    });

    if (!preConsulta) {
      return res.status(404).json({ erro: 'Pre-consulta nao encontrada' });
    }

    if (preConsulta.expiraEm < new Date()) {
      return res.status(410).json({ erro: 'Link expirado' });
    }

    if (preConsulta.status === 'RESPONDIDA') {
      return res.status(409).json({ erro: 'Pre-consulta ja respondida' });
    }

    // Marcar link como aberto (apenas na primeira vez)
    if (!preConsulta.linkAberto) {
      await prisma.preConsulta.update({
        where: { id: preConsulta.id },
        data: {
          linkAberto: true,
          linkAbertoEm: new Date(),
          status: 'ABERTO',
        },
      });
    }

    // Tentar encontrar paciente no Vitae pelo telefone ou email
    let perfilPaciente = null;
    try {
      const usuarioVitae = preConsulta.pacienteTel || preConsulta.pacienteEmail
        ? await prisma.usuario.findFirst({
            where: {
              OR: [
                preConsulta.pacienteTel ? { celular: preConsulta.pacienteTel.replace(/\D/g, '').replace(/^(\d{2})(\d+)$/, '+55$1$2') } : undefined,
                preConsulta.pacienteEmail ? { email: preConsulta.pacienteEmail } : undefined,
              ].filter(Boolean),
            },
            include: {
              perfilSaude: true,
              medicamentos: { where: { ativo: true }, select: { nome: true, dosagem: true } },
              alergias: { select: { nome: true, gravidade: true } },
              exames: { orderBy: { dataExame: 'desc' }, take: 5, select: { tipoExame: true, dataExame: true } },
            },
          })
        : null;

      if (usuarioVitae && usuarioVitae.perfilSaude) {
        const ps = usuarioVitae.perfilSaude;
        perfilPaciente = {
          nome: ps.nomeSocial || usuarioVitae.nome,
          apelido: ps.apelido,
          nomeSocial: ps.nomeSocial,
          dataNascimento: ps.dataNascimento,
          cpf: ps.cpf,
          genero: ps.genero,
          estadoCivil: ps.estadoCivil,
          corEtnia: ps.corEtnia,
          planoSaude: ps.planoSaude,
          carteirinhaPlano: ps.carteirinhaPlano,
          condicoes: ps.condicoes,
          cirurgias: ps.cirurgias || [],
          historicoFamiliar: ps.historicoFamiliar || [],
          fuma: ps.fuma,
          alcool: ps.alcool,
          horasSono: ps.horasSono,
          nivelAtividade: ps.nivelAtividade,
          limitacoesAcessibilidade: ps.limitacoesAcessibilidade,
          medicamentos: usuarioVitae.medicamentos.map(m => `${m.nome}${m.dosagem ? ` ${m.dosagem}` : ''}`),
          alergias: usuarioVitae.alergias.map(a => a.nome),
          examesRecentes: usuarioVitae.exames.map(e => e.tipoExame || 'Exame').join(', '),
        };
      }
    } catch (lookupErr) {
      console.error('[PRE-CONSULTA] Erro ao buscar perfil do paciente:', lookupErr.message);
    }

    return res.status(200).json({
      id: preConsulta.id,
      pacienteNome: preConsulta.pacienteNome,
      medicoNome: preConsulta.medico.usuario.nome,
      especialidade: preConsulta.medico.especialidade,
      status: preConsulta.status,
      perfilPaciente, // null se nao tiver conta Vitae
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /t/:token/responder — Paciente responde pre-consulta (publico)
// ---------------------------------------------------------------------------

router.post('/t/:token/responder', validate(responderPreConsultaSchema), async (req, res, next) => {
  try {
    const preConsulta = await prisma.preConsulta.findUnique({
      where: { linkToken: req.params.token },
      include: {
        medico: {
          include: {
            usuario: { select: { nome: true, email: true } },
          },
        },
      },
    });

    if (!preConsulta) {
      return res.status(404).json({ erro: 'Pre-consulta nao encontrada' });
    }

    if (preConsulta.expiraEm < new Date()) {
      return res.status(410).json({ erro: 'Link expirado' });
    }

    if (preConsulta.status === 'RESPONDIDA') {
      return res.status(409).json({ erro: 'Pre-consulta ja respondida' });
    }

    const { respostas, transcricao } = req.body;

    // Gerar summary com IA
    let summaryIA = null;
    let summaryJson = null;
    try {
      const resultado = await gerarSummaryPreConsulta(
        preConsulta.pacienteNome,
        respostas,
        transcricao
      );
      summaryIA = resultado.summaryTexto;
      summaryJson = resultado;
    } catch (aiErr) {
      console.error('[PRE-CONSULTA] Erro ao gerar summary IA:', aiErr.message);
    }

    const atualizada = await prisma.preConsulta.update({
      where: { id: preConsulta.id },
      data: {
        respostas,
        transcricao,
        summaryIA,
        summaryJson,
        status: 'RESPONDIDA',
        respondidaEm: new Date(),
      },
    });

    // Notificacoes (fire-and-forget — nao bloqueia a resposta)
    const nomeMedico = preConsulta.medico.usuario.nome;
    const emailMedico = preConsulta.medico.usuario.email;
    const nomePaciente = preConsulta.pacienteNome;
    const baseUrl = process.env.FRONTEND_URL || 'https://vitaehealth2906-ops.github.io/vitae-app';
    const linkDashboard = `${baseUrl}/20-medico-dashboard.html`;

    // Email para o medico
    if (emailMedico) {
      enviarEmailPreConsultaRespondida(emailMedico, nomeMedico, nomePaciente, summaryIA, linkDashboard)
        .catch(e => console.error('[EMAIL] Erro ao notificar medico:', e.message));
    }

    // SMS para o paciente (usa o telefone do formulario ou o telefone cadastrado)
    const celularPaciente = respostas?.celular || preConsulta.pacienteTel;
    if (celularPaciente) {
      enviarSMSConfirmacaoPreConsulta(celularPaciente, nomePaciente, nomeMedico)
        .catch(e => console.error('[SMS] Erro ao confirmar para paciente:', e.message));
    }

    return res.status(200).json({ preConsulta: atualizada });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET / — Listar pre-consultas do medico (autenticado)
// ---------------------------------------------------------------------------

router.get('/', verificarAuth, async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) {
      return res.status(403).json({ erro: 'Apenas medicos podem listar pre-consultas' });
    }

    const preConsultas = await prisma.preConsulta.findMany({
      where: { medicoId: medico.id },
      orderBy: { criadoEm: 'desc' },
    });

    return res.status(200).json({ preConsultas });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /:id — Detalhe de uma pre-consulta (autenticado — medico)
// ---------------------------------------------------------------------------

router.get('/:id', verificarAuth, async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) {
      return res.status(403).json({ erro: 'Apenas medicos podem ver detalhes' });
    }

    const preConsulta = await prisma.preConsulta.findFirst({
      where: { id: req.params.id, medicoId: medico.id },
    });

    if (!preConsulta) {
      return res.status(404).json({ erro: 'Pre-consulta nao encontrada' });
    }

    return res.status(200).json({ preConsulta });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:id/tts — Gerar audio ElevenLabs do summary (autenticado — medico)
// ---------------------------------------------------------------------------

router.post('/:id/tts', verificarAuth, async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) {
      return res.status(403).json({ erro: 'Apenas medicos podem gerar audio' });
    }

    const preConsulta = await prisma.preConsulta.findFirst({
      where: { id: req.params.id, medicoId: medico.id },
    });

    if (!preConsulta) {
      return res.status(404).json({ erro: 'Pre-consulta nao encontrada' });
    }

    const textoVoz = preConsulta.summaryJson?.textoVoz || preConsulta.summaryIA;
    if (!textoVoz) {
      return res.status(422).json({ erro: 'Nao ha summary disponivel para gerar audio' });
    }

    try {
      const audioBuffer = await gerarAudioElevenLabs(textoVoz);
      res.set('Content-Type', 'audio/mpeg');
      res.set('Content-Length', audioBuffer.length);
      return res.send(audioBuffer);
    } catch (ttsErr) {
      return res.status(503).json({ erro: ttsErr.message });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
