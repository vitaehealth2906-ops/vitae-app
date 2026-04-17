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
const { normalizarTelefone, variantesTelefone } = require('../utils/telefone');
const { auditar } = require('../utils/auditoria');

// ----------------------------------------------------------------------------
// VINCULAR PACIENTE — coracao do fix do "Daniel sumiu"
//
// Recebe a PC + (opcional) pacienteIdLogado.
// Retorna o pacienteId que deve ser gravado na PC e cria automaticamente:
//   - Registro de Consentimento LGPD (upsert, nao duplica)
//   - Registro de AutorizacaoAcesso (medico ↔ paciente, persiste pra sempre)
//
// Logica:
//   1. Se pacienteIdLogado existe → usa direto (caminho mais confiavel)
//   2. Senao, tenta auto-link por telefone normalizado
//   3. Senao, tenta auto-link por email (case-insensitive)
//   4. Se nada funciona → retorna null (paciente fica anonimo, mas pelo menos
//      ja avisamos isso no front)
//
// Idempotente: pode ser chamado multiplas vezes sem duplicar nada.
// ----------------------------------------------------------------------------
async function vincularPaciente({ preConsulta, pacienteIdLogado, req }) {
  let pacienteId = pacienteIdLogado || null;

  // Tentativa de auto-link se nao tem pacienteId ainda
  if (!pacienteId) {
    const telCanonico = normalizarTelefone(preConsulta.pacienteTel);
    const variantes = telCanonico ? variantesTelefone(preConsulta.pacienteTel) : [];

    if (variantes.length > 0 || preConsulta.pacienteEmail) {
      const orFilters = [];
      if (variantes.length > 0) orFilters.push({ celular: { in: variantes } });
      if (preConsulta.pacienteEmail) {
        orFilters.push({ email: { equals: preConsulta.pacienteEmail, mode: 'insensitive' } });
      }
      // findFirst ordenado por criadoEm asc — sempre pega o mais antigo (deterministico)
      const matchUsuario = await prisma.usuario.findFirst({
        where: { OR: orFilters },
        orderBy: { criadoEm: 'asc' },
        select: { id: true },
      });
      if (matchUsuario) pacienteId = matchUsuario.id;
    }
  }

  // Se nao tem paciente vinculado, nao ha o que fazer
  if (!pacienteId) return null;

  // Cria/atualiza Consentimento LGPD (upsert via unique [usuarioId, tipo, versao])
  try {
    const ipAddress = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim() || null;
    const userAgent = req.headers['user-agent'] || null;
    await prisma.consentimento.upsert({
      where: { usuarioId_tipo_versao: { usuarioId: pacienteId, tipo: 'COMPARTILHAMENTO_MEDICO', versao: '1.0' } },
      update: {
        aceito: true,
        ipAddress,
        userAgent,
        revogadoEm: null, // re-ativa caso tenha sido revogado
      },
      create: {
        usuarioId: pacienteId,
        tipo: 'COMPARTILHAMENTO_MEDICO',
        versao: '1.0',
        aceito: true,
        ipAddress,
        userAgent,
      },
    });
  } catch (e) {
    console.error('[CONSENT] erro:', e.message);
  }

  // Cria/atualiza AutorizacaoAcesso (medico ↔ paciente). Esse e o vinculo
  // persistente que faz o paciente aparecer na aba Pacientes do medico.
  // Renova a expiraEm pra 180 dias a cada nova interacao.
  try {
    const expiraEm = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
    await prisma.autorizacaoAcesso.upsert({
      where: { pacienteId_medicoId: { pacienteId, medicoId: preConsulta.medicoId } },
      update: {
        ativo: true,
        expiraEm,
        revogadoEm: null,
      },
      create: {
        pacienteId,
        medicoId: preConsulta.medicoId,
        tipoAcesso: 'LEITURA',
        categorias: ['exames', 'perfil', 'pre-consultas'],
        ativo: true,
        expiraEm,
      },
    });
  } catch (e) {
    console.error('[AUTORIZACAO] erro:', e.message);
  }

  // Auditoria — registra que esse paciente passou a ter vinculo com esse medico
  auditar(req, {
    acao: 'AUTO_LINK_PACIENTE',
    atorTipo: 'SISTEMA',
    recursoTipo: 'PACIENTE',
    recursoId: pacienteId,
    alvoId: pacienteId,
    metadata: {
      medicoId: preConsulta.medicoId,
      preConsultaId: preConsulta.id,
      origem: pacienteIdLogado ? 'login' : 'auto-match',
    },
  });

  return pacienteId;
}

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

router.get('/t/:token', authOpcional, async (req, res, next) => {
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

    // Auto-fill perfil do paciente — APENAS se o requisitante estiver autenticado
    // como o proprio dono dos dados.
    //
    // Regra LGPD: nao podemos retornar dados clinicos (alergias, meds, exames, CPF, etc)
    // pra qualquer pessoa que tenha o linkToken. Antes esse endpoint era publico e
    // expunha tudo. Agora exige que o usuario logado seja o mesmo que esta sendo
    // identificado pelo telefone/email da PC.
    let perfilPaciente = null;
    try {
      const variantesTel = variantesTelefone(preConsulta.pacienteTel);
      if (variantesTel.length > 0 || preConsulta.pacienteEmail) {
        const orFilters = [];
        if (variantesTel.length > 0) orFilters.push({ celular: { in: variantesTel } });
        if (preConsulta.pacienteEmail) {
          orFilters.push({ email: { equals: preConsulta.pacienteEmail, mode: 'insensitive' } });
        }
        const usuarioVitae = await prisma.usuario.findFirst({
          where: { OR: orFilters },
          orderBy: { criadoEm: 'asc' },
          select: { id: true, nome: true, email: true, celular: true },
        });

        // Verifica se o usuario logado E o mesmo que esta sendo identificado
        const requisitanteId = req.usuario && req.usuario.id ? req.usuario.id : null;
        const podeVerDados = usuarioVitae && requisitanteId && usuarioVitae.id === requisitanteId;

        if (podeVerDados) {
          // Carrega dados completos com cuidado (so quando autorizado)
          const dadosClinicos = await prisma.usuario.findUnique({
            where: { id: usuarioVitae.id },
            include: {
              perfilSaude: true,
              medicamentos: { where: { ativo: true }, select: { nome: true, dosagem: true } },
              alergias: { select: { nome: true, gravidade: true } },
              exames: { orderBy: { dataExame: 'desc' }, take: 5, select: { tipoExame: true, dataExame: true } },
            },
          });
          if (dadosClinicos && dadosClinicos.perfilSaude) {
            const ps = dadosClinicos.perfilSaude;
            perfilPaciente = {
              nome: ps.nomeSocial || dadosClinicos.nome,
              dataNascimento: ps.dataNascimento,
              cpf: ps.cpf,
              genero: ps.genero,
              celular: dadosClinicos.celular,
              email: dadosClinicos.email,
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
              medicamentos: dadosClinicos.medicamentos.map(m => `${m.nome}${m.dosagem ? ` ${m.dosagem}` : ''}`),
              alergias: dadosClinicos.alergias.map(a => a.nome),
              examesRecentes: dadosClinicos.exames.map(e => e.tipoExame || 'Exame').join(', '),
            };
          }
        } else if (usuarioVitae) {
          // Avisa o frontend que existe conta mas precisa fazer login pra ver/usar
          perfilPaciente = { existeContaVitae: true, precisaLogin: true };
        }
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

    // Capturar pacienteId logado E tentar auto-link se nao tem (cria AutorizacaoAcesso + Consentimento)
    const pacienteIdLogado = req.usuario && req.usuario.id ? req.usuario.id : null;
    const pacienteIdFinal = await vincularPaciente({ preConsulta, pacienteIdLogado, req });

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
        ...(pacienteIdFinal && { pacienteId: pacienteIdFinal }),
      },
    });

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

// Verifica se URL existe no Supabase storage fazendo HEAD request
// Retorna true se o arquivo existe (200/2xx), false caso contrario
async function urlExiste(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const resp = await fetch(url, { method: 'HEAD' });
    return resp.ok;
  } catch (e) {
    console.warn('[urlExiste] falha HEAD:', url, e.message);
    return false;
  }
}

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

    // === ETAPA 4 — Validacao HEAD das URLs antes de considerar entrega ok ===
    // URL final do audio e foto (upload direto Supabase ou base64 via backend)
    const finalAudioUrl = audioUrl || (respostas && respostas.audioUrl) || null;
    const finalFotoUrl = pacienteFotoUrl || (respostas && respostas.fotoUrl) || null;

    // Faz HEAD request nas URLs — se nao responderem 2xx, arquivo nao existe de verdade
    let audioConfirmado = false;
    let fotoConfirmada = false;
    if (finalAudioUrl) audioConfirmado = await urlExiste(finalAudioUrl);
    if (finalFotoUrl) fotoConfirmada = await urlExiste(finalFotoUrl);

    // Tem transcricao textual como fallback valido (se browser conseguiu gerar)?
    const transcricaoValida = transcricao && transcricao.trim().length > 5 && transcricao !== '(áudio sem transcrição)';

    // REGRA: pelo menos UM entre audio confirmado OU transcricao valida precisa existir
    // Se nao tem nem um nem outro, rejeita com 422 — cliente tem que tentar de novo
    if (!audioConfirmado && !transcricaoValida) {
      return res.status(422).json({
        erro: 'Audio nao chegou',
        detalhe: 'A gravacao de audio nao foi confirmada no servidor. Tente enviar novamente.',
        audioConfirmado: false,
        fotoConfirmada: fotoConfirmada,
        transcricaoValida: false,
      });
    }

    // === ETAPA 4 — Capturar pacienteId logado E tentar auto-link via tel/email ===
    // vincularPaciente cria AutorizacaoAcesso + Consentimento automaticamente.
    // Resolve o bug do "Daniel sumiu da aba Pacientes".
    const pacienteIdLogado = req.usuario && req.usuario.id ? req.usuario.id : null;
    const pacienteIdFinal = await vincularPaciente({ preConsulta, pacienteIdLogado, req });

    // === ETAPA 4 — Salvar pre-consulta imediatamente (SEM gerar summary sincrono) ===
    // Summary/Whisper/TTS saem do caminho critico e viram tarefas pendentes (Etapa 5)
    const updateData = {
      respostas,
      transcricao: transcricao || null,
      status: 'RESPONDIDA',
      respondidaEm: new Date(),
      ...(pacienteIdFinal && { pacienteId: pacienteIdFinal }),
    };
    if (finalAudioUrl && audioConfirmado) updateData.audioUrl = finalAudioUrl;
    if (finalFotoUrl && fotoConfirmada) updateData.pacienteFotoUrl = finalFotoUrl;

    const atualizada = await prisma.preConsulta.update({
      where: { id: preConsulta.id },
      data: updateData,
    });

    // === ETAPA 5 — Enfileirar processamento assincrono (fora do caminho critico) ===
    // Summary, Whisper, TTS vao pra fila. Worker processa em background.
    try {
      // Tarefa de gerar summary (inclui whisper se transcricao vazia, depois TTS)
      await prisma.tarefaPendente.create({
        data: {
          tipo: 'GERAR_SUMMARY_E_TTS',
          preConsultaId: preConsulta.id,
          payload: {
            temAudio: !!(finalAudioUrl && audioConfirmado),
            transcricaoInicial: transcricao || null,
          },
          tentativas: 0,
        },
      });
    } catch (queueErr) {
      console.error('[FILA] Erro ao enfileirar summary:', queueErr.message);
      // Nao falha a resposta — medico vai ver "Incompleta" e pode pedir reenvio
    }

    // === ETAPA 4 — Resposta explicita ao cliente ===
    return res.status(200).json({
      ok: true,
      preConsultaId: atualizada.id,
      audioConfirmado: audioConfirmado,
      fotoConfirmada: fotoConfirmada,
      transcricaoValida: transcricaoValida,
      termosRegistrados: !!pacienteIdLogado,
      statusPosterior: 'O resumo clinico sera gerado em ate 2 minutos. O medico sera notificado.',
    });
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
      include: {
        paciente: {
          select: { id: true, nome: true, fotoUrl: true },
        },
      },
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
      include: {
        paciente: {
          select: { id: true, nome: true, fotoUrl: true },
        },
      },
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
// POST /:id/regenerar — Regenerar resumo IA de uma pre-consulta (autenticado)
// ---------------------------------------------------------------------------

router.post('/:id/regenerar', verificarAuth, async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) return res.status(403).json({ erro: 'Apenas medicos' });

    const pc = await prisma.preConsulta.findFirst({
      where: { id: req.params.id, medicoId: medico.id, status: 'RESPONDIDA' },
    });
    if (!pc) return res.status(404).json({ erro: 'Pre-consulta nao encontrada' });

    // Enriquecer respostas com perfil do paciente (se houver vinculo)
    let respostasEnriq = pc.respostas || {};
    if (pc.pacienteId) {
      try {
        const u = await prisma.usuario.findUnique({
          where: { id: pc.pacienteId },
          include: {
            perfilSaude: true,
            medicamentos: { where: { ativo: true }, select: { nome: true, dosagem: true, frequencia: true, motivo: true } },
            alergias: { select: { nome: true, gravidade: true } },
            exames: { orderBy: { dataExame: 'desc' }, take: 5, select: { tipoExame: true, dataExame: true, statusGeral: true } },
          },
        });
        if (u) {
          const ps = u.perfilSaude || {};
          respostasEnriq = Object.assign({}, pc.respostas || {}, {
            dataNascimento: ps.dataNascimento || (pc.respostas && pc.respostas.dataNascimento),
            sexo: ps.genero || (pc.respostas && pc.respostas.sexo),
            medicamentosEmUso: (pc.respostas && pc.respostas.medicamentosEmUso)
              || (u.medicamentos || []).map(m => `${m.nome}${m.dosagem ? ' ' + m.dosagem : ''}${m.frequencia ? ' (' + m.frequencia + ')' : ''}${m.motivo ? ' - ' + m.motivo : ''}`).join('; '),
            alergias: (pc.respostas && pc.respostas.alergias)
              || (u.alergias || []).map(a => `${a.nome}${a.gravidade ? ' (' + a.gravidade + ')' : ''}`).join('; '),
            doencasAtuais: (pc.respostas && pc.respostas.doencasAtuais) || ps.condicoes,
            cirurgias: (pc.respostas && pc.respostas.cirurgias)
              || (Array.isArray(ps.cirurgias) ? ps.cirurgias.join(', ') : ps.cirurgias),
            historicoFamiliar: (pc.respostas && pc.respostas.historicoFamiliar)
              || (Array.isArray(ps.historicoFamiliar) ? ps.historicoFamiliar.join(', ') : ps.historicoFamiliar),
            examesRecentes: (pc.respostas && pc.respostas.examesRecentes)
              || (u.exames || []).map(e => `${e.tipoExame || 'Exame'}${e.dataExame ? ' em ' + new Date(e.dataExame).toLocaleDateString('pt-BR') : ''}${e.statusGeral ? ' (' + e.statusGeral + ')' : ''}`).join('; '),
          });
        }
      } catch (e) {
        console.error('[REGEN] Erro ao enriquecer:', e.message);
      }
    }

    const resultado = await gerarSummaryPreConsulta(
      pc.pacienteNome, respostasEnriq, pc.transcricao || '', pc.templatePerguntas
    );

    await prisma.preConsulta.update({
      where: { id: pc.id },
      data: { summaryIA: resultado.summaryTexto, summaryJson: resultado },
    });

    // TTS em background
    if (resultado.textoVoz || resultado.summaryTexto) {
      gerarAudioElevenLabs(resultado.textoVoz || resultado.summaryTexto, pc.pacienteNome)
        .then(async (buf) => {
          const url = await storage.upload({ buffer: buf, nomeOriginal: 'tts-' + pc.id + '.mp3', mimetype: 'audio/mpeg', pasta: 'tts' });
          await prisma.preConsulta.update({ where: { id: pc.id }, data: { audioSummaryUrl: url } });
          console.log('[REGEN] TTS salvo:', pc.id);
        })
        .catch(e => console.error('[REGEN] TTS erro:', e.message));
    }

    return res.status(200).json({ ok: true, summary: resultado });
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
