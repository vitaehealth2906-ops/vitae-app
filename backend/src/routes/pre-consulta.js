const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const { z } = require('zod');
const prisma = require('../utils/prisma');
const { verificarAuth, authOpcional } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { gerarSummaryPreConsulta, gerarAudioElevenLabs, verificarCompletudeTopicos, classificarRespostaIndividual } = require('../services/ai');
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
const v4ChunkUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// V4 helpers
const v4 = require('../utils/respostas-v4');

const router = express.Router();

// ----------------------------------------------------------------------------
// V2 RETROCOMPATIBILIDADE — Dual-write
// Se respostas vem no formato V2 (com _v2 ou _versaoFluxo), extrai os valores
// pros campos legados que telas antigas e o summary atual esperam.
// Mapeamento campo da anamnese → campo legado:
//   queixaPrincipal → queixaPrincipal
//   tempoEvolucao → duracaoSintomas
//   intensidade → intensidade (campo novo, mas IA aceita)
//   fatoresAgravantes → fatoresAgravantes
//   fatoresAtenuantes → fatoresAtenuantes
//   sintomasAssociados → sintomas
//   tratamentoPrevio → tratamentoPrevio
//   antecedentesPessoais → doencasAtuais
//   antecedentesFamiliares → historicoFamiliar
//   habitos → (composto: tabagismo + alcool + exercicio em string unica)
//   sono → horasSono / qualidadeSono
// Telas legadas leem direto. _v2 fica preservado pra IA/UI nova.
// ----------------------------------------------------------------------------
function enriquecerRespostasV2(respostas) {
  if (!respostas || typeof respostas !== 'object') return respostas;
  const v2 = respostas._v2;
  if (!v2 || typeof v2 !== 'object') return respostas;

  const out = { ...respostas };
  const mapaCampoLegado = {
    queixaPrincipal:        ['queixaPrincipal'],
    tempoEvolucao:          ['duracaoSintomas', 'duracao', 'tempoEvolucao'],
    intensidade:            ['intensidade'],
    fatoresAgravantes:      ['fatoresAgravantes'],
    fatoresAtenuantes:      ['fatoresAtenuantes'],
    sintomasAssociados:     ['sintomas', 'sintomasAssociados'],
    tratamentoPrevio:       ['tratamentoPrevio'],
    antecedentesPessoais:   ['doencasAtuais', 'condicoes', 'antecedentesPessoais'],
    antecedentesFamiliares: ['historicoFamiliar', 'antecedentesFamiliares'],
    habitos:                ['habitos'],
    sono:                   ['sono', 'horasSono'],
  };

  Object.values(v2).forEach(r => {
    if (!r || typeof r !== 'object') return;
    const campo = r.campoAnamnese;
    const valor = r.valor;
    if (!campo) return;

    // Pulado / desconhecer NAO populam o campo legado
    // (medico precisa ver "vazio" se foi pulado, nao texto fake)
    if (r.fonte === 'pulado' || r.fonte === 'desconhecer') return;
    if (!valor) return;

    const destinos = mapaCampoLegado[campo] || [campo];
    destinos.forEach(d => {
      if (!out[d]) out[d] = valor; // nao sobrescreve se ja existe
    });
  });

  // Preserva metadata
  out._v2 = v2;
  out._versaoFluxo = respostas._versaoFluxo || 'v2-pergunta-por-pergunta';

  return out;
}

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

    // FASE 6 — JSON.parse defensivo (evita 500 se corrompido)
    let respostas;
    try {
      respostas = req.body.respostas ? JSON.parse(req.body.respostas) : { metodo: 'audio' };
    } catch (e) {
      return res.status(400).json({ erro: 'Formato de respostas invalido. Tente enviar novamente.' });
    }
    const transcricao = req.body.transcricao || '';

    // FASE E (audio-45s) — idempotencia por attemptId
    // Se ja RESPONDIDA e o attemptId bate com o anterior, retorna 200 duplicate
    // (cliente perdeu resposta, retentou — backend confirma que ja foi processado)
    const novoAttemptId = (respostas && respostas.attemptId) || req.body.attemptId || null;
    if (preConsulta.status === 'RESPONDIDA') {
      const respostasAnteriores = preConsulta.respostas || {};
      const attemptIdAnterior = respostasAnteriores && respostasAnteriores.attemptId;
      if (novoAttemptId && attemptIdAnterior && novoAttemptId === attemptIdAnterior) {
        return res.status(200).json({
          sucesso: true,
          duplicate: true,
          preConsultaId: preConsulta.id,
          audioConfirmado: !!preConsulta.audioUrl,
        });
      }
      return res.status(409).json({ erro: 'Pre-consulta ja respondida' });
    }

    // Save audio to storage
    // FASE E — inclui attemptId no filename pra evitar sobrescrita em race de retry
    let audioUrl = null;
    const audioFile = req.files && req.files.audio && req.files.audio[0];
    if (audioFile) {
      const attSuffix = novoAttemptId ? `-${String(novoAttemptId).replace(/[^a-zA-Z0-9]/g,'').slice(0,8)}` : '';
      audioUrl = await storage.upload({
        buffer: audioFile.buffer,
        nomeOriginal: `preconsulta-${preConsulta.id}${attSuffix}.webm`,
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

    // ═══════════════════════════════════════════════════════════
    // PADROES OBSERVADOS v2 — pipeline multi-agente (flag-gated)
    // Roda em paralelo sem atrapalhar o summary antigo.
    // Se falhar ou flag off, summary antigo continua funcionando 100%.
    // ═══════════════════════════════════════════════════════════
    try {
      const padroesV2 = require('../services/padroes');
      if (padroesV2.enabled()) {
        // Busca perfil clinico minimo pro pipeline
        let perfilClinico = {};
        try {
          if (pacienteIdLogado || preConsulta.pacienteId) {
            const pid = pacienteIdLogado || preConsulta.pacienteId;
            const perfilDb = await prisma.perfilSaude.findUnique({ where: { usuarioId: pid } });
            const alergias = await prisma.alergia.findMany({ where: { usuarioId: pid } });
            const meds = await prisma.medicamento.findMany({ where: { usuarioId: pid, ativo: true } });
            perfilClinico = {
              alergias: alergias.map(a => ({ nome: a.nome, gravidade: a.gravidade })),
              medicamentos: meds.map(m => ({ nome: m.nome, dosagem: m.dosagem })),
              condicoes: perfilDb?.condicoes ? (Array.isArray(perfilDb.condicoes) ? perfilDb.condicoes : []) : [],
              gestante: perfilDb?.gestante || false,
            };
          }
        } catch (perfilErr) {
          console.warn('[PADROES_V2] nao foi possivel carregar perfil clinico:', perfilErr.message);
        }

        const idade = preConsulta.pacienteDataNascimento
          ? Math.floor((Date.now() - new Date(preConsulta.pacienteDataNascimento).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : null;

        const resultadoV2 = await padroesV2.rodar({
          transcricao,
          respostas,
          perfil: perfilClinico,
          idade,
          sexo: preConsulta.pacienteGenero ? String(preConsulta.pacienteGenero).toLowerCase() : null,
        });

        if (resultadoV2.sucesso) {
          // Enxerta no summaryJson sem substituir nada existente
          summaryJson = summaryJson || {};
          summaryJson.padroesObservados_v2 = resultadoV2.padroesObservados_v2;
          summaryJson.alertasFarmacologicos = resultadoV2.alertasFarmacologicos;
          summaryJson.pipeline_version = resultadoV2.pipeline_version;
          summaryJson.base_versions = resultadoV2.base_versions;
          summaryJson.auditoria_padroes_v2 = resultadoV2.auditoria;
          console.log('[PADROES_V2] pipeline ok — cards:', resultadoV2.padroesObservados_v2.length, 'tempo:', resultadoV2.tempo_ms + 'ms');
        } else {
          console.warn('[PADROES_V2] pipeline retornou sem sucesso:', resultadoV2.motivo, resultadoV2.erro);
          // Nao falha o request — so loga
          summaryJson = summaryJson || {};
          summaryJson.padroesObservados_v2_falhou = { motivo: resultadoV2.motivo, erro: resultadoV2.erro };
        }
      }
    } catch (v2Err) {
      // Circuit breaker: erro no v2 nao derruba o fluxo antigo
      console.error('[PADROES_V2] circuit breaker acionado:', v2Err.message);
    }

    // Capturar pacienteId logado E tentar auto-link se nao tem (cria AutorizacaoAcesso + Consentimento)
    const pacienteIdLogado = req.usuario && req.usuario.id ? req.usuario.id : null;
    const pacienteIdFinal = await vincularPaciente({ preConsulta, pacienteIdLogado, req });

    // FASE E — garante que attemptId fica persistido no JSON respostas pra dedupe futuro
    if (novoAttemptId && respostas && !respostas.attemptId) {
      respostas.attemptId = novoAttemptId;
    }

    // FASE 6 — UPDATE atomico: so atualiza se status ainda NAO for RESPONDIDA.
    // Protege contra 2 requests simultaneos (double-submit do paciente).
    const updatedCount = await prisma.preConsulta.updateMany({
      where: { id: preConsulta.id, status: { not: 'RESPONDIDA' } },
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
    if (updatedCount.count === 0) {
      // Outro request ja respondeu enquanto processavamos — comportamento idempotente
      return res.status(409).json({ erro: 'Pre-consulta ja respondida', detalhe: 'Outro envio foi processado em paralelo.' });
    }
    const atualizada = await prisma.preConsulta.findUnique({ where: { id: preConsulta.id } });

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

    // REGRA: se o cliente mandou audio (fluxo audio), exige confirmacao — protecao do bug "audio silencioso" da Sessao 5.
    // Se nao mandou audio (fluxo formulario), aceita desde que tenha respostas preenchidas.
    const clienteTentouAudio = !!(audioBase64 || (respostas && respostas.audioUrl));
    const temRespostas = respostas && Object.keys(respostas).length >= 2;

    if (clienteTentouAudio && !audioConfirmado && !transcricaoValida) {
      return res.status(422).json({
        erro: 'Audio nao chegou',
        detalhe: 'A gravacao de audio nao foi confirmada no servidor. Tente enviar novamente.',
        audioConfirmado: false,
        fotoConfirmada: fotoConfirmada,
        transcricaoValida: false,
      });
    }
    if (!clienteTentouAudio && !temRespostas) {
      return res.status(400).json({
        erro: 'Envio vazio',
        detalhe: 'Grave um audio ou preencha o formulario antes de enviar.',
      });
    }

    // === ETAPA 4 — Capturar pacienteId logado E tentar auto-link via tel/email ===
    // vincularPaciente cria AutorizacaoAcesso + Consentimento automaticamente.
    // Resolve o bug do "Daniel sumiu da aba Pacientes".
    const pacienteIdLogado = req.usuario && req.usuario.id ? req.usuario.id : null;
    const pacienteIdFinal = await vincularPaciente({ preConsulta, pacienteIdLogado, req });

    // === FASE 3 V2 — Dual-write retrocompat ===
    // Se chegou no formato V2 (com _v2 ou _versaoFluxo === 'v2-pergunta-por-pergunta'),
    // extrai os valores e popula campos antigos pra retrocompatibilidade total.
    // Resultado: telas antigas (25-summary, desktop/app) leem campo legado;
    // telas/IA novas leem _v2 com fonte rastreavel.
    const respostasEnriquecidas = enriquecerRespostasV2(respostas);

    // Concatena transcricoes individuais V2 numa unica transcricao final pro Whisper/Gemini summary
    let transcricaoFinal = transcricao || null;
    if (respostas && respostas._v2 && typeof respostas._v2 === 'object') {
      const transcsV2 = Object.values(respostas._v2)
        .filter(r => r && r.transcricaoBruta)
        .map(r => r.transcricaoBruta)
        .join(' ');
      if (transcsV2 && transcsV2.length > 0) transcricaoFinal = transcsV2;
    }

    // === ETAPA 4 — Salvar pre-consulta imediatamente (SEM gerar summary sincrono) ===
    // Summary/Whisper/TTS saem do caminho critico e viram tarefas pendentes (Etapa 5)
    const updateData = {
      respostas: respostasEnriquecidas,
      transcricao: transcricaoFinal,
      status: 'RESPONDIDA',
      respondidaEm: new Date(),
      ...(pacienteIdFinal && { pacienteId: pacienteIdFinal }),
    };
    if (finalAudioUrl && audioConfirmado) updateData.audioUrl = finalAudioUrl;
    if (finalFotoUrl && fotoConfirmada) updateData.pacienteFotoUrl = finalFotoUrl;

    // FASE 6 — UPDATE atomico: so atualiza se status ainda NAO for RESPONDIDA.
    const updatedCount = await prisma.preConsulta.updateMany({
      where: { id: preConsulta.id, status: { not: 'RESPONDIDA' } },
      data: updateData,
    });
    if (updatedCount.count === 0) {
      return res.status(409).json({ erro: 'Pre-consulta ja respondida', detalhe: 'Outro envio foi processado em paralelo.' });
    }
    const atualizada = await prisma.preConsulta.findUnique({ where: { id: preConsulta.id } });

    // === ETAPA 5 — Enfileirar processamento assincrono (fora do caminho critico) ===
    // FASE 6 — Dedupe: so enfileira se nao existir tarefa pendente do mesmo tipo pra essa PC.
    try {
      const existente = await prisma.tarefaPendente.findFirst({
        where: {
          tipo: 'GERAR_SUMMARY_E_TTS',
          preConsultaId: preConsulta.id,
          processadoEm: null,
          dead: false,
        },
      });
      if (!existente) {
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
      } else {
        console.log('[FILA] tarefa ja existe pra PC', preConsulta.id, '— nao duplicou');
      }
    } catch (queueErr) {
      console.error('[FILA] Erro ao enfileirar summary:', queueErr.message);
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
// POST /t/:token/classificar-resposta — V2 (publico, sem auth)
// Pre-consulta V2 (pergunta-por-pergunta linear).
// Recebe UMA pergunta + audio chunk OU transcricao direta.
// Retorna se respondeu, valor estruturado, confianca (0-1).
// NAO salva nada permanente — so classifica. Frontend salva no IDB local
// e o salvamento final continua via POST /responder.
// ---------------------------------------------------------------------------

const audioChunkUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/t/:token/classificar-resposta', audioChunkUpload.single('audioChunk'), async (req, res, next) => {
  try {
    const preConsulta = await prisma.preConsulta.findUnique({
      where: { linkToken: req.params.token },
    });
    if (!preConsulta) return res.status(404).json({ erro: 'Pre-consulta nao encontrada' });
    if (preConsulta.expiraEm < new Date()) return res.status(410).json({ erro: 'Link expirado' });
    if (preConsulta.status === 'RESPONDIDA') return res.status(409).json({ erro: 'Pre-consulta ja respondida' });

    // Parse do payload
    let pergunta, transcricaoDireta;
    try {
      pergunta = req.body.pergunta ? JSON.parse(req.body.pergunta) : null;
      transcricaoDireta = req.body.transcricao || null;
    } catch (e) {
      return res.status(400).json({ erro: 'Formato invalido', detalhe: 'Campo pergunta deve ser JSON valido.' });
    }

    if (!pergunta || !pergunta.texto) {
      return res.status(400).json({ erro: 'Pergunta obrigatoria', detalhe: 'Envie a pergunta sendo classificada.' });
    }

    // Caminho 1: cliente enviou transcricao direta (sem audio)
    let transcricao = (transcricaoDireta || '').trim();

    // Caminho 2: cliente enviou audio chunk — backend transcreve via Whisper
    let audioUrl = null;
    if (req.file && req.file.buffer) {
      try {
        // Upload temporario pra storage (necessario pro Whisper baixar)
        audioUrl = await storage.upload({
          buffer: req.file.buffer,
          nomeOriginal: `chunk-${preConsulta.id}-${Date.now()}.webm`,
          mimetype: req.file.mimetype || 'audio/webm',
          pasta: 'audios-chunks',
        });
        // Whisper transcreve
        const t = await transcreverAudio(audioUrl);
        if (t) transcricao = t.trim();
      } catch (audioErr) {
        console.error('[CLASSIFICAR] Erro ao transcrever audio chunk:', audioErr.message);
        return res.status(200).json({
          respondeu: false,
          valor: null,
          confianca: 0,
          motivo: 'transcricao_falhou',
          transcricao: '',
          audioUrl,
          erro: 'Nao consegui transcrever — tente falar de novo',
        });
      }
    }

    if (!transcricao || transcricao.length < 2) {
      return res.status(200).json({
        respondeu: false,
        valor: null,
        confianca: 0,
        motivo: 'transcricao_vazia',
        transcricao: '',
        audioUrl,
      });
    }

    // Chama classificador (Gemini → Claude fallback)
    const resultado = await classificarRespostaIndividual(pergunta, transcricao);

    // Anexa transcricao bruta e audioUrl pro frontend salvar no estado
    return res.status(200).json({
      ...resultado,
      transcricao,
      audioUrl,
      perguntaId: pergunta.id || null,
      campoAnamnese: pergunta.campo || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[CLASSIFICAR] Erro:', err.message);
    next(err);
  }
});

// ============================================================================
// V4 ENDPOINTS — Quiz híbrido (texto OU áudio por pergunta)
// ============================================================================

// ---------------------------------------------------------------------------
// GET /t/:token/estado — Retomada de sessão V4 (público)
// Retorna estado atual: respostas, perguntaAtual, modo, cobertura
// ---------------------------------------------------------------------------
router.get('/t/:token/estado', async (req, res, next) => {
  try {
    const preConsulta = await prisma.preConsulta.findUnique({
      where: { linkToken: req.params.token },
      include: {
        medico: { include: { usuario: { select: { nome: true } } } },
      },
    });
    if (!preConsulta) return res.status(404).json({ erro: 'Pré-consulta não encontrada' });
    if (preConsulta.expiraEm < new Date()) return res.status(410).json({ erro: 'Link expirado' });
    if (preConsulta.status === 'RESPONDIDA') return res.status(409).json({ erro: 'Pré-consulta já respondida' });

    const totalPerguntas = Array.isArray(preConsulta.templatePerguntas)
      ? preConsulta.templatePerguntas.length
      : 11;

    const resumo = v4.resumirParaCliente(preConsulta.respostas, totalPerguntas);

    return res.status(200).json({
      preConsultaId: preConsulta.id,
      pacienteNome: preConsulta.pacienteNome,
      medicoNome: preConsulta.medico.usuario.nome,
      especialidade: preConsulta.medico.especialidade,
      status: preConsulta.status,
      templatePerguntas: preConsulta.templatePerguntas,
      totalPerguntas,
      ...resumo,
    });
  } catch (err) {
    console.error('[V4 ESTADO] Erro:', err.message);
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /t/:token/responder-pergunta — Salva UMA resposta V4 (público)
// Modos: 'audio' (multipart audioChunk + JSON) | 'texto' | 'pulado' | 'desconhecer'
// Retorna interpretação Gemini + valor extraído + confiança
// ---------------------------------------------------------------------------
router.post('/t/:token/responder-pergunta', v4ChunkUpload.single('audioChunk'), async (req, res, next) => {
  try {
    const preConsulta = await prisma.preConsulta.findUnique({
      where: { linkToken: req.params.token },
    });
    if (!preConsulta) return res.status(404).json({ erro: 'Pré-consulta não encontrada' });
    if (preConsulta.expiraEm < new Date()) return res.status(410).json({ erro: 'Link expirado' });
    if (preConsulta.status === 'RESPONDIDA') return res.status(409).json({ erro: 'Já respondida' });

    // Parse do payload
    let dados;
    try {
      dados = req.body.dados ? JSON.parse(req.body.dados) : req.body;
    } catch (e) {
      return res.status(400).json({ erro: 'Formato inválido', detalhe: 'dados deve ser JSON válido' });
    }

    const { perguntaId, modo, valor: valorTexto, attemptId } = dados;

    if (!perguntaId) return res.status(400).json({ erro: 'perguntaId obrigatório' });
    if (!v4.MODOS_VALIDOS.includes(modo)) {
      return res.status(400).json({ erro: 'Modo inválido', detalhe: 'use audio | texto | pulado | desconhecer' });
    }

    // Busca campo da anamnese pela pergunta no template
    const tpl = Array.isArray(preConsulta.templatePerguntas) ? preConsulta.templatePerguntas : [];
    const perguntaTemplate = tpl.find(p => p.id === perguntaId) || { texto: '', campo: null };
    const campoAnamnese = perguntaTemplate.campo || perguntaTemplate.campoAnamnese || null;

    let resultadoClassificador = null;
    let audioUrl = null;
    let transcricao = null;

    // ────────────────────────────────────────────────────────────────
    // MODO ÁUDIO — upload chunk → Whisper → Gemini
    // ────────────────────────────────────────────────────────────────
    if (modo === 'audio') {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ erro: 'audioChunk obrigatório no modo áudio' });
      }
      try {
        audioUrl = await storage.upload({
          buffer: req.file.buffer,
          nomeOriginal: `v4-${preConsulta.id}-${perguntaId}-${Date.now()}.webm`,
          mimetype: req.file.mimetype || 'audio/webm',
          pasta: 'pre-consulta-v4-chunks',
        });
        transcricao = await transcreverAudio(audioUrl);
      } catch (audioErr) {
        console.error('[V4 RESPONDER] Erro áudio:', audioErr.message);
        return res.status(200).json({
          modo: 'audio',
          respondeu: false,
          valor: null,
          confianca: 0,
          motivo: 'transcricao_falhou',
          erro: 'Não consegui transcrever o áudio — tenta de novo',
        });
      }

      if (!transcricao || transcricao.trim().length < 2) {
        return res.status(200).json({
          modo: 'audio',
          respondeu: false,
          valor: null,
          confianca: 0,
          motivo: 'transcricao_vazia',
          transcricao: '',
          audioUrl,
          erro: 'Não captei o que você disse',
        });
      }

      // CAMINHO A (Sessao 17, 30/04/2026): IA NAO julga mais respostas de audio.
      // Transcreveu? Salva como resposta direta. Paciente confirma na tela seguinte.
      // Decisao do Lucas apos bug recorrente do classificador rejeitar respostas validas
      // ("muito forte" sem numero, "faz uns dias" vago) com mensagem enganosa de "audio falhou".
      // Trade-off aceito: medico recebe transcricao bruta em vez de valor estruturado.
      resultadoClassificador = {
        respondeu: true,
        valor: transcricao.trim().slice(0, 500),
        confianca: 1,
        motivo: 'audio_direto',
      };
    }

    // ────────────────────────────────────────────────────────────────
    // MODO TEXTO — só Gemini, pula Whisper
    // ────────────────────────────────────────────────────────────────
    else if (modo === 'texto') {
      const txtSanitizado = v4.sanitizar(valorTexto);
      if (!txtSanitizado || txtSanitizado.length < 1) {
        return res.status(400).json({ erro: 'Texto vazio' });
      }
      transcricao = txtSanitizado;
      resultadoClassificador = await classificarRespostaIndividual(perguntaTemplate, txtSanitizado);
    }

    // ────────────────────────────────────────────────────────────────
    // MODO PULADO / DESCONHECER — sem IA
    // ────────────────────────────────────────────────────────────────
    else {
      resultadoClassificador = {
        respondeu: modo === 'desconhecer',
        valor: modo === 'desconhecer' ? 'Paciente declarou desconhecer' : null,
        confianca: 1,
        motivo: modo,
      };
    }

    // ────────────────────────────────────────────────────────────────
    // FIX: Se classificador disse que NAO respondeu em modo audio/texto,
    // NAO tenta salvar — retorna 200 com motivo pro frontend mostrar
    // "Nao captei sua fala" e paciente tentar de novo. Sem isso, o codigo
    // tentava salvar com valor=null e validarRespostaV4 rejeitava com 400,
    // que o frontend antigo traduzia errado como "internet falhou".
    // ────────────────────────────────────────────────────────────────
    if ((modo === 'audio' || modo === 'texto') && !resultadoClassificador.respondeu) {
      return res.status(200).json({
        modo,
        respondeu: false,
        valor: null,
        confianca: resultadoClassificador.confianca || 0,
        motivo: resultadoClassificador.motivo || (modo === 'audio' ? 'transcricao_falhou' : 'sem_resposta'),
        transcricao,
        audioUrl,
        perguntaId,
      });
    }

    // Fallback: se classificador retornou respondeu=true mas valor=null em modo audio,
    // usa transcricao bruta como valor (pelo menos tem ALGUMA coisa salva).
    const valorFinal = resultadoClassificador.valor
      || (modo === 'audio' && transcricao ? transcricao.slice(0, 200) : null)
      || (modo === 'texto' ? transcricao : null);

    // ────────────────────────────────────────────────────────────────
    // SALVAR no banco
    // ────────────────────────────────────────────────────────────────
    const novaResposta = v4.criarResposta({
      valor: valorFinal,
      modo,
      confianca: resultadoClassificador.confianca,
      transcricaoBruta: transcricao,
      audioChunkUrl: audioUrl,
      campoAnamnese,
    });

    const validacao = v4.validarRespostaV4(novaResposta);
    if (!validacao.ok) {
      console.error('[V4 RESPONDER] Validação falhou:', validacao.erro, 'novaResposta:', JSON.stringify(novaResposta));
      // Em vez de 400 (que viraria erro pro paciente), retorna 200 com motivo
      // pro frontend mostrar "Nao captei sua fala" e paciente refazer.
      return res.status(200).json({
        modo,
        respondeu: false,
        valor: null,
        confianca: 0,
        motivo: 'transcricao_falhou',
        transcricao,
        audioUrl,
        perguntaId,
        debugErro: validacao.erro,
      });
    }

    const respostasAtualizadas = v4.salvarRespostaNoEstado(
      preConsulta.respostas || {},
      perguntaId,
      novaResposta
    );

    // Marca attemptId pra dedupe futuro
    if (attemptId) respostasAtualizadas._attemptId = attemptId;

    // Atomic update — só atualiza se ainda não está RESPONDIDA
    const atualizadas = await prisma.preConsulta.updateMany({
      where: { id: preConsulta.id, status: { not: 'RESPONDIDA' } },
      data: {
        respostas: respostasAtualizadas,
        status: 'ABERTO', // garante transição
      },
    });
    if (atualizadas.count === 0) {
      return res.status(409).json({ erro: 'Pré-consulta já finalizada' });
    }

    // ────────────────────────────────────────────────────────────────
    // RETORNO
    // ────────────────────────────────────────────────────────────────
    return res.status(200).json({
      modo,
      respondeu: resultadoClassificador.respondeu,
      valor: resultadoClassificador.valor,
      confianca: resultadoClassificador.confianca,
      motivo: resultadoClassificador.motivo,
      transcricao,
      audioUrl,
      perguntaId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[V4 RESPONDER] Erro:', err.message);
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /t/:token/finalizar — Finaliza pré-consulta V4 (público)
// Valida cobertura 11/11 → marca RESPONDIDA → enfileira briefing
// ---------------------------------------------------------------------------
router.post('/t/:token/finalizar', authOpcional, async (req, res, next) => {
  try {
    const preConsulta = await prisma.preConsulta.findUnique({
      where: { linkToken: req.params.token },
      include: { medico: { include: { usuario: { select: { nome: true, email: true } } } } },
    });
    if (!preConsulta) return res.status(404).json({ erro: 'Pré-consulta não encontrada' });
    if (preConsulta.expiraEm < new Date()) return res.status(410).json({ erro: 'Link expirado' });
    if (preConsulta.status === 'RESPONDIDA') {
      return res.status(200).json({ ok: true, duplicate: true, preConsultaId: preConsulta.id });
    }

    const totalPerguntas = Array.isArray(preConsulta.templatePerguntas)
      ? preConsulta.templatePerguntas.length
      : 11;

    const cobertura = v4.calcularCobertura(preConsulta.respostas, totalPerguntas);

    if (!cobertura.completa) {
      return res.status(400).json({
        erro: 'Cobertura insuficiente',
        detalhe: `Faltam ${cobertura.faltam} perguntas com algum status`,
        respondidas: cobertura.respondidas,
        total: totalPerguntas,
      });
    }

    // Vincula paciente (auto-link tel/email) — mesma lógica do endpoint legado
    const pacienteIdLogado = req.usuario && req.usuario.id ? req.usuario.id : null;
    const pacienteIdFinal = await vincularPaciente({ preConsulta, pacienteIdLogado, req });

    // Concatena transcrições V4 numa transcrição final pro Whisper/Gemini summary
    const transcricoesV4 = preConsulta.respostas && preConsulta.respostas._v4
      ? Object.values(preConsulta.respostas._v4)
          .filter(r => r && r.transcricaoBruta)
          .map(r => r.transcricaoBruta)
          .join(' \n')
      : '';

    // Enriquece campos legados final (garantia)
    const respostasFinais = v4.enriquecerCamposLegados(preConsulta.respostas);

    const updateData = {
      respostas: respostasFinais,
      transcricao: transcricoesV4 || preConsulta.transcricao || null,
      status: 'RESPONDIDA',
      respondidaEm: new Date(),
      ...(pacienteIdFinal && { pacienteId: pacienteIdFinal }),
    };

    const updatedCount = await prisma.preConsulta.updateMany({
      where: { id: preConsulta.id, status: { not: 'RESPONDIDA' } },
      data: updateData,
    });
    if (updatedCount.count === 0) {
      return res.status(409).json({ erro: 'Pré-consulta já respondida (concorrência)' });
    }

    // Enfileira briefing (mesmo worker do legado processa)
    try {
      const existente = await prisma.tarefaPendente.findFirst({
        where: { tipo: 'GERAR_SUMMARY_E_TTS', preConsultaId: preConsulta.id, processadoEm: null, dead: false },
      });
      if (!existente) {
        await prisma.tarefaPendente.create({
          data: {
            tipo: 'GERAR_SUMMARY_E_TTS',
            preConsultaId: preConsulta.id,
            payload: { temAudio: true, transcricaoInicial: transcricoesV4, versao: 'v4' },
            tentativas: 0,
          },
        });
      }
    } catch (queueErr) {
      console.error('[V4 FINALIZAR] Erro ao enfileirar:', queueErr.message);
      // Não bloqueia — pré-consulta já está RESPONDIDA, briefing pode ser regenerado
    }

    return res.status(200).json({
      ok: true,
      preConsultaId: preConsulta.id,
      cobertura,
      statusBriefing: 'enfileirado',
    });
  } catch (err) {
    console.error('[V4 FINALIZAR] Erro:', err.message);
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET / — Listar pre-consultas do medico (autenticado)
// ---------------------------------------------------------------------------

// FASE E (audio-45s) — calcula conteudoCurto virtualmente a partir da transcricao.
// Threshold: <80 palavras uteis (zero schema change).
const CONTEUDO_CURTO_WORD_THRESHOLD = 80;
function marcarConteudoCurto(pc) {
  if (!pc) return pc;
  // Sinal "conteudo curto" so faz sentido pra pre-consulta com AUDIO
  // Sem audioUrl => resposta via formulario escrito => nao aplica
  if (!pc.audioUrl) { pc.conteudoCurto = false; return pc; }
  const t = (pc.transcricao || '').trim();
  if (!t) { pc.conteudoCurto = false; return pc; }
  const palavras = t.split(/\s+/).filter(Boolean);
  pc.conteudoCurto = palavras.length < CONTEUDO_CURTO_WORD_THRESHOLD;
  pc.palavrasTranscricao = palavras.length;
  return pc;
}

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

    // FASE E — marca virtualmente conteudoCurto
    preConsultas.forEach(marcarConteudoCurto);

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

    // FASE 7 — Audit trail LGPD/CFM: registra abertura do briefing pelo medico
    try {
      const { registrarAcessoBriefing } = require('../services/audit');
      registrarAcessoBriefing({
        preConsultaId: preConsulta.id,
        medicoId: medico.id,
        acao: 'view_briefing',
        req,
      });
    } catch (_e) { /* auditoria nao pode quebrar response */ }

    // FASE E (audio-45s) — marca virtualmente conteudoCurto
    marcarConteudoCurto(preConsulta);

    return res.status(200).json({ preConsulta });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:id/regenerar — Regenerar resumo IA de uma pre-consulta (autenticado)
// ---------------------------------------------------------------------------

// FASE 9 — debounce em memoria: regenerar/PC nao pode ser disparado > 1x em 15s
const _regenDebounce = new Map();
setInterval(function() {
  const agora = Date.now();
  for (const [k, v] of _regenDebounce.entries()) if (agora - v > 30000) _regenDebounce.delete(k);
}, 60000).unref();

router.post('/:id/regenerar', verificarAuth, async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) return res.status(403).json({ erro: 'Apenas medicos' });

    // FASE 9 — debounce: evita custo duplicado se medico clica 3x rapido
    const debounceKey = medico.id + '|' + req.params.id;
    const ultimo = _regenDebounce.get(debounceKey);
    if (ultimo && Date.now() - ultimo < 15000) {
      return res.status(429).json({ erro: 'Aguarde 15 segundos antes de regenerar novamente.' });
    }
    _regenDebounce.set(debounceKey, Date.now());

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

    // PADROES V2 tambem roda na regeneracao (flag-gated)
    let summaryJsonFinal = resultado;
    try {
      const padroesV2 = require('../services/padroes');
      if (padroesV2.enabled()) {
        let perfilClinico = {};
        try {
          if (pc.pacienteId) {
            const perfilDb = await prisma.perfilSaude.findUnique({ where: { usuarioId: pc.pacienteId } });
            const alergias = await prisma.alergia.findMany({ where: { usuarioId: pc.pacienteId } });
            const meds = await prisma.medicamento.findMany({ where: { usuarioId: pc.pacienteId, ativo: true } });
            perfilClinico = {
              alergias: alergias.map(a => ({ nome: a.nome, gravidade: a.gravidade })),
              medicamentos: meds.map(m => ({ nome: m.nome, dosagem: m.dosagem })),
              condicoes: perfilDb?.condicoes ? (Array.isArray(perfilDb.condicoes) ? perfilDb.condicoes : []) : [],
              gestante: perfilDb?.gestante || false,
            };
          }
        } catch (pErr) { console.warn('[REGEN-V2] perfil falhou:', pErr.message); }

        const idade = pc.pacienteDataNascimento
          ? Math.floor((Date.now() - new Date(pc.pacienteDataNascimento).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : null;

        const resultadoV2 = await padroesV2.rodar({
          transcricao: pc.transcricao || '',
          respostas: respostasEnriq,
          perfil: perfilClinico,
          idade,
          sexo: pc.pacienteGenero ? String(pc.pacienteGenero).toLowerCase() : null,
        });

        if (resultadoV2.sucesso) {
          summaryJsonFinal = {
            ...resultado,
            padroesObservados_v2: resultadoV2.padroesObservados_v2,
            alertasFarmacologicos: resultadoV2.alertasFarmacologicos,
            pipeline_version: resultadoV2.pipeline_version,
            base_versions: resultadoV2.base_versions,
            auditoria_padroes_v2: resultadoV2.auditoria,
          };
          console.log('[REGEN-V2] ok, cards:', resultadoV2.padroesObservados_v2.length, 'tempo:', resultadoV2.tempo_ms + 'ms');
        } else {
          console.warn('[REGEN-V2] falhou:', resultadoV2.motivo, resultadoV2.erro);
        }
      }
    } catch (v2Err) {
      console.error('[REGEN-V2] circuit breaker:', v2Err.message);
    }

    await prisma.preConsulta.update({
      where: { id: pc.id },
      data: { summaryIA: resultado.summaryTexto, summaryJson: summaryJsonFinal },
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
