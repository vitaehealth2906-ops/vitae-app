const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const { z } = require('zod');
const prisma = require('../utils/prisma');
const { verificarAuth, authOpcional } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { gerarSummaryPreConsulta, gerarAudioElevenLabs, verificarCompletudeTopicos } = require('../services/ai');
const { enviarEmailPreConsultaRespondida } = require('../services/email');
const { enviarSMSConfirmacaoPreConsulta } = require('../services/sms');
const storage = require('../services/storage');
const { transcreverAudio } = require('../services/transcription');

const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const router = express.Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const criarPreConsultaSchema = z.object({
  pacienteNome: z.string().min(2, 'Nome do paciente obrigatorio'),
  pacienteTel: z.string().optional(),
  pacienteEmail: z.string().email().optional(),
  templateId: z.string().uuid().optional(),
});

const responderPreConsultaSchema = z.object({
  respostas: z.record(z.any()), // aceita qualquer estrutura — todos os campos do formulario
  transcricao: z.string().optional(),
  audioBase64: z.string().optional(),
  fotoBase64: z.string().optional(),
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

    const { pacienteNome, pacienteTel, pacienteEmail, templateId } = req.body;
    const linkToken = crypto.randomBytes(24).toString('hex');

    // If template specified, copy its questions into the pre-consulta
    let templatePerguntas = null;
    let permitirAudio = true;
    if (templateId) {
      const template = await prisma.formTemplate.findUnique({ where: { id: templateId } });
      if (template && template.medicoId === medico.id) {
        templatePerguntas = template.perguntas;
        permitirAudio = template.permitirAudio;
        // Increment usage counter
        await prisma.formTemplate.update({ where: { id: templateId }, data: { vezesUsado: { increment: 1 } } });
      }
    }

    const preConsulta = await prisma.preConsulta.create({
      data: {
        medicoId: medico.id,
        pacienteNome,
        pacienteTel,
        pacienteEmail,
        linkToken,
        templateId: templateId || null,
        templatePerguntas,
        expiraEm: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
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
        template: { select: { permitirAudio: true } },
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
          dataNascimento: ps.dataNascimento,
          cpf: ps.cpf,
          genero: ps.genero,
          celular: usuarioVitae.celular,
          email: usuarioVitae.email,
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
      templatePerguntas: preConsulta.templatePerguntas || null,
      permitirAudio: preConsulta.templatePerguntas ? (preConsulta.template?.permitirAudio ?? true) : true,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /t/:token/responder — Paciente responde pre-consulta (publico)
// ---------------------------------------------------------------------------

// POST /t/:token/responder-audio — Paciente responde com audio (publico)
router.post('/t/:token/responder-audio', authOpcional, audioUpload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'foto', maxCount: 1 },
]), async (req, res, next) => {
  try {
    const preConsulta = await prisma.preConsulta.findUnique({
      where: { linkToken: req.params.token },
      include: { medico: { include: { usuario: { select: { nome: true, email: true } } } } },
    });
    if (!preConsulta) return res.status(404).json({ erro: 'Pre-consulta nao encontrada' });
    if (preConsulta.expiraEm < new Date()) return res.status(410).json({ erro: 'Link expirado' });
    if (preConsulta.status === 'RESPONDIDA') return res.status(409).json({ erro: 'Pre-consulta ja respondida' });

    const respostas = req.body.respostas ? JSON.parse(req.body.respostas) : { metodo: 'audio' };
    const transcricao = req.body.transcricao || '';

    // Save audio to storage
    let audioUrl = null;
    const audioFile = req.files && req.files.audio && req.files.audio[0];
    if (audioFile) {
      audioUrl = await storage.upload({
        buffer: audioFile.buffer,
        nomeOriginal: `preconsulta-${preConsulta.id}.webm`,
        mimetype: audioFile.mimetype || 'audio/webm',
        pasta: 'audios',
      });
    }

    // Save photo to storage
    let pacienteFotoUrl = null;
    const fotoFile = req.files && req.files.foto && req.files.foto[0];
    if (fotoFile) {
      pacienteFotoUrl = await storage.upload({
        buffer: fotoFile.buffer,
        nomeOriginal: `foto-${preConsulta.id}.jpg`,
        mimetype: fotoFile.mimetype || 'image/jpeg',
        pasta: 'fotos',
      });
    }

    // Generate AI summary
    let summaryIA = null;
    let summaryJson = null;
    try {
      const resultado = await gerarSummaryPreConsulta(preConsulta.pacienteNome, respostas, transcricao, preConsulta.templatePerguntas);
      summaryIA = resultado.summaryTexto;
      summaryJson = resultado;
    } catch (aiErr) {
      console.error('[PRE-CONSULTA] Erro ao gerar summary IA:', aiErr.message);
    }

    // Capturar pacienteId se o usuario estiver logado (auth opcional)
    const pacienteIdLogado = req.usuario && req.usuario.id ? req.usuario.id : null;

    const atualizada = await prisma.preConsulta.update({
      where: { id: preConsulta.id },
      data: {
        respostas,
        transcricao,
        audioUrl,
        pacienteFotoUrl,
        summaryIA,
        summaryJson,
        status: 'RESPONDIDA',
        respondidaEm: new Date(),
        ...(pacienteIdLogado && { pacienteId: pacienteIdLogado }),
      },
    });

    // Registrar consentimento LGPD (compartilhamento com medico)
    if (pacienteIdLogado) {
      try {
        await prisma.consentimento.create({
          data: {
            usuarioId: pacienteIdLogado,
            tipo: 'COMPARTILHAMENTO_MEDICO',
            versao: '1.0',
            aceito: true,
            ipAddress: (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim(),
            userAgent: req.headers['user-agent'] || null,
          },
        });
      } catch (e) {
        console.error('[CONSENT] Erro ao registrar:', e.message);
      }
    }

    // TTS: Generate ElevenLabs audio in background (fire-and-forget)
    if (summaryJson && (summaryJson.textoVoz || summaryIA)) {
      const textoVoz = summaryJson.textoVoz || summaryIA;
      gerarAudioElevenLabs(textoVoz, preConsulta.pacienteNome)
        .then(async (audioBuffer) => {
          const ttsUrl = await storage.upload({
            buffer: audioBuffer,
            nomeOriginal: `tts-summary-${preConsulta.id}.mp3`,
            mimetype: 'audio/mpeg',
            pasta: 'tts',
          });
          await prisma.preConsulta.update({
            where: { id: preConsulta.id },
            data: { audioSummaryUrl: ttsUrl },
          });
          console.log('[TTS] Audio gerado e salvo:', preConsulta.id);
        })
        .catch(e => console.error('[TTS] Erro (nao bloqueante):', e.message));
    }

    // Notifications
    const nomeMedico = preConsulta.medico.usuario.nome;
    const emailMedico = preConsulta.medico.usuario.email;
    const nomePaciente = preConsulta.pacienteNome;
    const baseUrl = process.env.FRONTEND_URL || 'https://vitaehealth2906-ops.github.io/vitae-app';
    if (emailMedico) {
      enviarEmailPreConsultaRespondida(emailMedico, nomeMedico, nomePaciente, summaryIA, `${baseUrl}/20-medico-dashboard.html`)
        .catch(e => console.error('[EMAIL] Erro:', e.message));
    }
    const celularPaciente = respostas?.celular || preConsulta.pacienteTel;
    if (celularPaciente) {
      enviarSMSConfirmacaoPreConsulta(celularPaciente, nomePaciente, nomeMedico)
        .catch(e => console.error('[SMS] Erro:', e.message));
    }

    return res.status(200).json({ preConsulta: atualizada });
  } catch (err) {
    next(err);
  }
});

router.post('/t/:token/responder', authOpcional, validate(responderPreConsultaSchema), async (req, res, next) => {
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

    const { respostas, transcricao, audioBase64, fotoBase64 } = req.body;

    // Save audio from base64 if provided
    let audioUrl = null;
    if (audioBase64) {
      try {
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        audioUrl = await storage.upload({
          buffer: audioBuffer,
          nomeOriginal: `preconsulta-${preConsulta.id}.webm`,
          mimetype: 'audio/webm',
          pasta: 'audios',
        });
      } catch (e) {
        console.error('[PRE-CONSULTA] Erro ao salvar audio:', e.message);
      }
    }

    // Save photo from base64 if provided
    let pacienteFotoUrl = null;
    if (fotoBase64) {
      try {
        const fotoBuffer = Buffer.from(fotoBase64, 'base64');
        pacienteFotoUrl = await storage.upload({
          buffer: fotoBuffer,
          nomeOriginal: `foto-${preConsulta.id}.jpg`,
          mimetype: 'image/jpeg',
          pasta: 'fotos',
        });
      } catch (e) {
        console.error('[PRE-CONSULTA] Erro ao salvar foto:', e.message);
      }
    }

    // If browser transcription is empty but we have audio, use Whisper
    let finalTranscricao = transcricao;
    const finalAudioUrlForWhisper = audioUrl || (respostas && respostas.audioUrl) || null;
    if ((!finalTranscricao || finalTranscricao === '(áudio sem transcrição)') && finalAudioUrlForWhisper) {
      console.log('[PRE-CONSULTA] Browser transcription empty, trying Whisper...');
      try {
        const whisperText = await transcreverAudio(finalAudioUrlForWhisper);
        if (whisperText) {
          finalTranscricao = whisperText;
          console.log('[PRE-CONSULTA] Whisper transcription success:', whisperText.substring(0, 100));
        }
      } catch (whisperErr) {
        console.error('[PRE-CONSULTA] Whisper failed:', whisperErr.message);
      }
    }

    // Gerar summary com IA
    let summaryIA = null;
    let summaryJson = null;
    try {
      const resultado = await gerarSummaryPreConsulta(
        preConsulta.pacienteNome,
        respostas,
        finalTranscricao,
        preConsulta.templatePerguntas
      );
      summaryIA = resultado.summaryTexto;
      summaryJson = resultado;
    } catch (aiErr) {
      console.error('[PRE-CONSULTA] Erro ao gerar summary IA:', aiErr.message);
    }

    // Capturar pacienteId se o usuario estiver logado (auth opcional)
    const pacienteIdLogado = req.usuario && req.usuario.id ? req.usuario.id : null;

    const updateData = {
      respostas,
      transcricao: finalTranscricao || transcricao,
      summaryIA,
      summaryJson,
      status: 'RESPONDIDA',
      respondidaEm: new Date(),
      ...(pacienteIdLogado && { pacienteId: pacienteIdLogado }),
    };
    // Check audioUrl from base64 upload OR from respostas (Supabase direct upload)
    const finalAudioUrl = audioUrl || (respostas && respostas.audioUrl) || null;
    const finalFotoUrl = pacienteFotoUrl || (respostas && respostas.fotoUrl) || null;
    if (finalAudioUrl) updateData.audioUrl = finalAudioUrl;
    if (finalFotoUrl) updateData.pacienteFotoUrl = finalFotoUrl;

    const atualizada = await prisma.preConsulta.update({
      where: { id: preConsulta.id },
      data: updateData,
    });

    // Registrar consentimento LGPD (compartilhamento com medico)
    if (pacienteIdLogado) {
      try {
        await prisma.consentimento.create({
          data: {
            usuarioId: pacienteIdLogado,
            tipo: 'COMPARTILHAMENTO_MEDICO',
            versao: '1.0',
            aceito: true,
            ipAddress: (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim(),
            userAgent: req.headers['user-agent'] || null,
          },
        });
      } catch (e) {
        console.error('[CONSENT] Erro ao registrar:', e.message);
      }
    }

    // TTS: Generate ElevenLabs audio in background (fire-and-forget)
    if (summaryJson && (summaryJson.textoVoz || summaryIA)) {
      const textoVoz = summaryJson.textoVoz || summaryIA;
      gerarAudioElevenLabs(textoVoz, preConsulta.pacienteNome)
        .then(async (audioBuffer) => {
          const ttsUrl = await storage.upload({
            buffer: audioBuffer,
            nomeOriginal: `tts-summary-${preConsulta.id}.mp3`,
            mimetype: 'audio/mpeg',
            pasta: 'tts',
          });
          await prisma.preConsulta.update({
            where: { id: preConsulta.id },
            data: { audioSummaryUrl: ttsUrl },
          });
          console.log('[TTS] Audio gerado e salvo:', preConsulta.id);
        })
        .catch(e => console.error('[TTS] Erro (nao bloqueante):', e.message));
    }

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

    // Check cache first (unless ?force=true)
    if (preConsulta.audioSummaryUrl && req.query.force !== 'true') {
      return res.redirect(preConsulta.audioSummaryUrl);
    }

    const textoVoz = preConsulta.summaryJson?.textoVoz || preConsulta.summaryIA;
    if (!textoVoz) {
      return res.status(422).json({ erro: 'Nao ha summary disponivel para gerar audio' });
    }

    try {
      const audioBuffer = await gerarAudioElevenLabs(textoVoz, preConsulta.pacienteNome);

      // Cache: upload to Supabase and save URL
      storage.upload({
        buffer: audioBuffer,
        nomeOriginal: `tts-summary-${preConsulta.id}.mp3`,
        mimetype: 'audio/mpeg',
        pasta: 'tts',
      }).then(async (ttsUrl) => {
        await prisma.preConsulta.update({
          where: { id: preConsulta.id },
          data: { audioSummaryUrl: ttsUrl },
        });
      }).catch(e => console.error('[TTS] Erro ao cachear:', e.message));

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

// ---------------------------------------------------------------------------
// POST /t/:token/verificar — Verificar completude dos tópicos (público)
// ---------------------------------------------------------------------------

router.post('/t/:token/verificar', async (req, res, next) => {
  try {
    const preConsulta = await prisma.preConsulta.findUnique({
      where: { linkToken: req.params.token },
    });

    if (!preConsulta) {
      return res.status(404).json({ erro: 'Pre-consulta nao encontrada' });
    }

    const { transcricao } = req.body;
    if (!transcricao || transcricao.trim().length === 0) {
      return res.status(400).json({ erro: 'Transcricao vazia' });
    }

    const resultado = await verificarCompletudeTopicos(transcricao);
    return res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /by-patient — Apagar TODAS pre-consultas de um paciente (autenticado)
// ---------------------------------------------------------------------------

router.delete('/by-patient', verificarAuth, async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) {
      return res.status(403).json({ erro: 'Apenas medicos podem apagar pre-consultas' });
    }

    const { pacienteNome, pacienteTel } = req.body || {};
    if (!pacienteNome) {
      return res.status(400).json({ erro: 'pacienteNome e obrigatorio' });
    }

    const where = { medicoId: medico.id, pacienteNome };
    if (pacienteTel) where.pacienteTel = pacienteTel;

    const preConsultas = await prisma.preConsulta.findMany({ where });

    if (preConsultas.length === 0) {
      return res.status(404).json({ erro: 'Nenhuma pre-consulta encontrada para este paciente' });
    }

    // Clean up all storage files
    const deletePromises = preConsultas.flatMap((pc) => {
      const promises = [];
      if (pc.audioUrl) promises.push(storage.deletar(pc.audioUrl).catch(() => {}));
      if (pc.pacienteFotoUrl) promises.push(storage.deletar(pc.pacienteFotoUrl).catch(() => {}));
      if (pc.audioSummaryUrl) promises.push(storage.deletar(pc.audioSummaryUrl).catch(() => {}));
      return promises;
    });
    await Promise.allSettled(deletePromises);

    await prisma.preConsulta.deleteMany({ where });

    return res.status(200).json({ ok: true, deletedCount: preConsultas.length });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id — Apagar pre-consulta (autenticado — medico)
// ---------------------------------------------------------------------------

router.delete('/:id', verificarAuth, async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) {
      return res.status(403).json({ erro: 'Apenas medicos podem apagar pre-consultas' });
    }

    const preConsulta = await prisma.preConsulta.findFirst({
      where: { id: req.params.id, medicoId: medico.id },
    });

    if (!preConsulta) {
      return res.status(404).json({ erro: 'Pre-consulta nao encontrada' });
    }

    // Delete audio, photo and TTS from storage if they exist
    if (preConsulta.audioUrl) {
      storage.deletar(preConsulta.audioUrl).catch(() => {});
    }
    if (preConsulta.pacienteFotoUrl) {
      storage.deletar(preConsulta.pacienteFotoUrl).catch(() => {});
    }
    if (preConsulta.audioSummaryUrl) {
      storage.deletar(preConsulta.audioSummaryUrl).catch(() => {});
    }

    await prisma.preConsulta.delete({ where: { id: req.params.id } });

    return res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
