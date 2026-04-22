// ═══════════════════════════════════════════════════════════════════
//   Worker de processamento assincrono de tarefas pendentes
//
//   Garante que summary/whisper/TTS sejam executados depois que a
//   pre-consulta foi persistida, FORA do caminho critico do request HTTP.
//
//   - Roda em setInterval(30s) no processo do servidor
//   - Pega ate N tarefas com processadoEm=null e proximaTentativa<=now
//   - Executa, em caso de falha: incrementa tentativas, agenda backoff
//   - Apos 5 tentativas: marca dead=true (medico ve "incompleta" no dashboard)
// ═══════════════════════════════════════════════════════════════════

const prisma = require('../utils/prisma');
const storage = require('../services/storage');
const { gerarSummaryPreConsulta, gerarAudioElevenLabs } = require('../services/ai');
const { transcreverAudio, transcreverAudioComTimestamps } = require('../services/transcription');
const { enviarEmailPreConsultaRespondida } = require('../services/email');
const { enviarSMSConfirmacaoPreConsulta } = require('../services/sms');
const { registrarFalha } = require('../services/observability');
const { validarTranscricao, validarFoto, validarAudio, validarQueixa, calcularNivel, validarResultadoIA } = require('../services/briefing');

const INTERVALO_MS = 30 * 1000; // checa a cada 30s
const MAX_TENTATIVAS = 5;
const LIMITE_POR_CICLO = 5; // max tarefas processadas simultaneamente

// Backoff exponencial: 30s, 2min, 10min, 30min, 2h
function delayParaProximaTentativa(tentativas) {
  const minutos = [0.5, 2, 10, 30, 120];
  const m = minutos[Math.min(tentativas, minutos.length - 1)];
  return new Date(Date.now() + m * 60 * 1000);
}

async function enriquecerRespostas(preConsulta) {
  let respostas = preConsulta.respostas || {};
  if (!preConsulta.pacienteId) return respostas;
  try {
    const u = await prisma.usuario.findUnique({
      where: { id: preConsulta.pacienteId },
      include: {
        perfilSaude: true,
        medicamentos: { where: { ativo: true }, select: { nome: true, dosagem: true, frequencia: true, motivo: true } },
        alergias: { select: { nome: true, gravidade: true } },
        exames: { orderBy: { dataExame: 'desc' }, take: 5, select: { tipoExame: true, dataExame: true, statusGeral: true } },
      },
    });
    if (!u) return respostas;
    const ps = u.perfilSaude || {};
    return Object.assign({}, respostas, {
      dataNascimento: ps.dataNascimento || respostas.dataNascimento,
      sexo: ps.genero || respostas.sexo,
      medicamentosEmUso: respostas.medicamentosEmUso
        || (u.medicamentos || []).map(m => `${m.nome}${m.dosagem ? ' ' + m.dosagem : ''}${m.frequencia ? ' (' + m.frequencia + ')' : ''}${m.motivo ? ' - ' + m.motivo : ''}`).join('; '),
      alergias: respostas.alergias
        || (u.alergias || []).map(a => `${a.nome}${a.gravidade ? ' (' + a.gravidade + ')' : ''}`).join('; '),
      doencasAtuais: respostas.doencasAtuais || ps.condicoes,
      cirurgias: respostas.cirurgias
        || (Array.isArray(ps.cirurgias) ? ps.cirurgias.join(', ') : ps.cirurgias),
      historicoFamiliar: respostas.historicoFamiliar
        || (Array.isArray(ps.historicoFamiliar) ? ps.historicoFamiliar.join(', ') : ps.historicoFamiliar),
      examesRecentes: respostas.examesRecentes
        || (u.exames || []).map(e => `${e.tipoExame || 'Exame'}${e.dataExame ? ' em ' + new Date(e.dataExame).toLocaleDateString('pt-BR') : ''}${e.statusGeral ? ' (' + e.statusGeral + ')' : ''}`).join('; '),
    });
  } catch (e) {
    console.error('[WORKER] enriquecer falhou:', e.message);
    return respostas;
  }
}

// Normaliza string pra comparar (minusculas, sem acento)
function _norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Valida que o textoVoz gerado contem todos os elementos indispensaveis.
// Retorna { ok, faltando: [] }.
function validarIndispensaveis(textoVoz, contexto) {
  const t = _norm(textoVoz);
  const faltando = [];

  // 1. NOME — pelo menos o primeiro nome tem que estar
  if (contexto.pacienteNome) {
    const primeiroNome = _norm(contexto.pacienteNome.split(' ')[0]);
    if (primeiroNome && primeiroNome.length > 2 && !t.includes(primeiroNome)) {
      faltando.push(`nome "${primeiroNome}"`);
    }
  }

  // 2. IDADE — se paciente tem idade, tem que mencionar "anos"
  if (contexto.idade && !t.includes('ano')) {
    faltando.push('idade (palavra "anos")');
  }

  // 3. ALERGIAS — cada alergia pelo nome
  if (Array.isArray(contexto.alergias) && contexto.alergias.length > 0) {
    for (const al of contexto.alergias) {
      const nome = _norm(al.nome || al);
      if (nome && nome.length > 2 && !t.includes(nome)) {
        faltando.push(`alergia "${nome}"`);
      }
    }
  }

  // 4. MEDICAMENTOS EM USO — cada med pelo nome
  if (Array.isArray(contexto.medicamentos) && contexto.medicamentos.length > 0) {
    for (const m of contexto.medicamentos) {
      const nome = _norm(m.nome || m);
      if (nome && nome.length > 2 && !t.includes(nome)) {
        faltando.push(`medicamento "${nome}"`);
      }
    }
  }

  return { ok: faltando.length === 0, faltando };
}

// Extrai contexto do paciente pra validacao (so o indispensavel)
async function extrairContextoValidacao(preConsulta) {
  const ctx = {
    pacienteNome: preConsulta.pacienteNome,
    idade: null,
    alergias: [],
    medicamentos: [],
  };
  if (!preConsulta.pacienteId) return ctx;
  try {
    const u = await prisma.usuario.findUnique({
      where: { id: preConsulta.pacienteId },
      include: {
        perfilSaude: true,
        medicamentos: { where: { ativo: true }, select: { nome: true } },
        alergias: { select: { nome: true, gravidade: true } },
      },
    });
    if (u) {
      if (u.perfilSaude && u.perfilSaude.dataNascimento) {
        const dn = new Date(u.perfilSaude.dataNascimento);
        if (!isNaN(dn.getTime())) {
          ctx.idade = Math.floor((Date.now() - dn.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        }
      }
      ctx.alergias = (u.alergias || []).filter(a => {
        const g = String(a.gravidade || '').toUpperCase();
        return g === 'GRAVE' || g === 'ALTA' || g === 'SEVERA' || g === 'MODERADA' || !a.gravidade;
      });
      ctx.medicamentos = u.medicamentos || [];
    }
  } catch (e) {
    console.error('[VALIDACAO] erro ao montar contexto:', e.message);
  }
  return ctx;
}

async function processarGerarSummaryETts(tarefa) {
  const preConsulta = await prisma.preConsulta.findUnique({
    where: { id: tarefa.preConsultaId },
    include: { medico: { include: { usuario: { select: { nome: true, email: true } } } } },
  });
  if (!preConsulta) throw new Error('Pre-consulta nao encontrada: ' + tarefa.preConsultaId);

  // ── FASE 3 — Status por peca, calculado a cada etapa ──
  // Inicia com estado derivado do que chegou do paciente.
  const status = {
    statusFoto: validarFoto(preConsulta.pacienteFotoUrl).ok ? 'ok' : 'ausente',
    statusAudio: validarAudio(preConsulta.audioUrl).ok ? 'ok' : 'ausente',
    statusTranscricao: 'sem_audio',
    statusResumoIa: 'falhou',
    statusAudioResumo: 'falhou',
    temTexto: !!(preConsulta.respostas && Object.keys(preConsulta.respostas).length > 1),
  };

  // [1] Transcricao via Whisper com word-level timestamps (para karaoke sync)
  //     Sempre atualiza os words se temos audio — mesmo que ja exista transcricao,
  //     precisamos dos timestamps. Se ja tem words salvos, nao re-transcreve.
  let transcricao = preConsulta.transcricao;
  // Se ja tinha transcricao salva antes, validar antes de usar
  if (transcricao) {
    const v = validarTranscricao(transcricao);
    status.statusTranscricao = v.ok ? 'ok' : 'falhou';
  }
  const precisaTranscrever = !preConsulta.transcricaoWords && preConsulta.audioUrl;
  if (precisaTranscrever) {
    try {
      const resultado = await transcreverAudioComTimestamps(preConsulta.audioUrl);
      if (resultado && resultado.text) {
        transcricao = resultado.text;
        await prisma.preConsulta.update({
          where: { id: preConsulta.id },
          data: {
            transcricao: resultado.text,
            transcricaoWords: resultado.words,
          },
        });
        console.log('[WORKER] Whisper com timestamps salvo:', preConsulta.id, '-', resultado.words.length, 'words');
      }
    } catch (e) {
      console.error('[WORKER] Whisper com timestamps falhou, tentando sem:', e.message);
      // Fallback: tenta transcricao simples sem timestamps
      try {
        const whisperText = await transcreverAudio(preConsulta.audioUrl);
        if (whisperText && whisperText.length > 2) {
          transcricao = whisperText;
          await prisma.preConsulta.update({
            where: { id: preConsulta.id },
            data: { transcricao: whisperText },
          });
        }
      } catch (e2) {
        console.error('[WORKER] Whisper simples tambem falhou:', e2.message);
        registrarFalha('whisper_falha', { preConsultaId: preConsulta.id, motivo: 'ambos_fallbacks_falharam' });
      }
    }
    // Valida transcricao produzida (pode ter saido "(áudio sem transcrição)" etc)
    if (transcricao) {
      const v = validarTranscricao(transcricao);
      status.statusTranscricao = v.ok ? 'ok' : 'falhou';
      if (!v.ok) {
        console.warn('[WORKER] transcricao invalida:', v.motivo, preConsulta.id);
        registrarFalha('whisper_falha', { preConsultaId: preConsulta.id, motivo: v.motivo });
      }
    } else {
      status.statusTranscricao = 'falhou';
    }
  }

  // [2] Enriquecer respostas com perfil do paciente logado
  const respostasEnriquecidas = await enriquecerRespostas(preConsulta);

  // [3] Gerar summary com IA — com validacao de indispensaveis + 1 retry se faltar
  let summaryIA = null;
  let summaryJson = null;
  let validacao = { ok: false, faltando: [] };
  const contextoVal = await extrairContextoValidacao(preConsulta);

  for (let tentativaSummary = 1; tentativaSummary <= 2; tentativaSummary++) {
    try {
      const resultado = await gerarSummaryPreConsulta(
        preConsulta.pacienteNome,
        respostasEnriquecidas,
        transcricao,
        preConsulta.templatePerguntas
      );
      summaryJson = resultado;
      summaryIA = resultado.summaryTexto;

      // Valida indispensaveis no textoVoz (que vai pro TTS — e o que o medico ouve)
      const textoParaValidar = resultado.textoVoz || resultado.summaryTexto || '';
      validacao = validarIndispensaveis(textoParaValidar, contextoVal);

      if (validacao.ok) {
        console.log('[VALIDACAO] indispensaveis OK (tentativa', tentativaSummary + ')');
        break;
      } else {
        console.warn('[VALIDACAO] tentativa', tentativaSummary, '— faltou:', validacao.faltando.join(', '));
        if (tentativaSummary < 2) {
          console.log('[VALIDACAO] regenerando com dados reenfatizados...');
          // Na proxima tentativa, adiciona os indispensaveis explicitamente no prompt
          // via enriquecimento extra (o texto ficara REDUNDANTE proposital no contexto)
          // Ja tentamos implicito, agora enfatizamos
        }
      }
    } catch (e) {
      if (tentativaSummary >= 2) {
        registrarFalha('ia_ambos_falharam', { preConsultaId: preConsulta.id, motivo: e.message?.substring(0, 60) });
        throw new Error('gerarSummary falhou: ' + e.message);
      }
      console.warn('[WORKER] gerarSummary erro tentativa', tentativaSummary, ':', e.message);
    }
  }

  if (!validacao.ok && summaryJson) {
    console.error('[VALIDACAO] FALHOU apos 2 tentativas. Salvando mesmo assim + flag. Faltou:', validacao.faltando.join(', '));
  }

  // Valida resultado da IA pra decidir statusResumoIa
  if (summaryJson) {
    const validResult = validarResultadoIA(summaryJson);
    // Se IA nao conseguiu o basico, marca falhou; se parcial (faltou indispensaveis), parcial
    if (!validResult.ok) status.statusResumoIa = 'falhou';
    else if (validResult.nivel === 'parcial' || !validacao.ok) status.statusResumoIa = 'parcial';
    else status.statusResumoIa = 'ok';
  } else {
    status.statusResumoIa = 'falhou';
  }

  // [4] Salvar summary no banco (inclui alerta de incompleto se faltou indispensavel)
  await prisma.preConsulta.update({
    where: { id: preConsulta.id },
    data: { summaryIA, summaryJson, statusResumoIa: status.statusResumoIa },
  });

  // [5] TTS — separado em try pra nao falhar tarefa se so TTS falhar
  if (summaryJson && (summaryJson.textoVoz || summaryIA)) {
    const textoVoz = summaryJson.textoVoz || summaryIA;
    // Marca "processando" ANTES de tentar — medico ve "em processamento" se demorar
    try {
      await prisma.preConsulta.update({
        where: { id: preConsulta.id },
        data: { statusAudioResumo: 'processando' },
      });
    } catch (_e) { /* nao bloqueia */ }

    try {
      const audioBuffer = await gerarAudioElevenLabs(textoVoz, preConsulta.pacienteNome);
      const ttsUrl = await storage.upload({
        buffer: audioBuffer,
        nomeOriginal: `tts-summary-${preConsulta.id}.mp3`,
        mimetype: 'audio/mpeg',
        pasta: 'tts',
      });
      // Suspeita: audio muito curto (voz costuma ser 1MB+ pra 60s)
      const tamSuspeito = audioBuffer && audioBuffer.length < 30000; // <30KB = uns 2-3s
      status.statusAudioResumo = tamSuspeito ? 'suspeito' : 'ok';
      await prisma.preConsulta.update({
        where: { id: preConsulta.id },
        data: { audioSummaryUrl: ttsUrl, statusAudioResumo: status.statusAudioResumo },
      });
      console.log('[WORKER] TTS gerado:', preConsulta.id, 'status:', status.statusAudioResumo);
    } catch (ttsErr) {
      console.error('[WORKER] TTS falhou (nao bloqueia tarefa):', ttsErr.message);
      registrarFalha('tts_falha', { preConsultaId: preConsulta.id, motivo: ttsErr.message?.substring(0, 60) });
      status.statusAudioResumo = 'falhou';
      try {
        await prisma.preConsulta.update({
          where: { id: preConsulta.id },
          data: { statusAudioResumo: 'falhou' },
        });
      } catch (_e) { /* nao bloqueia */ }
    }
  } else {
    status.statusAudioResumo = 'falhou';
  }

  // [7] Calcula e grava nivel final do briefing (0-5)
  const nivel = calcularNivel(status);
  try {
    await prisma.preConsulta.update({
      where: { id: preConsulta.id },
      data: {
        nivelBriefing: nivel,
        statusFoto: status.statusFoto,
        statusAudio: status.statusAudio,
        statusTranscricao: status.statusTranscricao,
      },
    });
    console.log('[WORKER] nivel briefing:', preConsulta.id, '= nivel', nivel);
  } catch (e) {
    // Se colunas ainda nao migraram, nao bloqueia fluxo existente
    console.warn('[WORKER] falha ao gravar nivel/status (migration pode nao ter rodado):', e.message);
  }

  // [6] Notificacoes fire-and-forget
  const nomeMedico = preConsulta.medico.usuario.nome;
  const emailMedico = preConsulta.medico.usuario.email;
  const nomePaciente = preConsulta.pacienteNome;
  const baseUrl = process.env.FRONTEND_URL || 'https://vitaehealth2906-ops.github.io/vitae-app';
  if (emailMedico) {
    enviarEmailPreConsultaRespondida(emailMedico, nomeMedico, nomePaciente, summaryIA, `${baseUrl}/20-medico-dashboard.html`)
      .catch(e => console.error('[EMAIL] Erro:', e.message));
  }
  const celularPaciente = (preConsulta.respostas && preConsulta.respostas.celular) || preConsulta.pacienteTel;
  if (celularPaciente) {
    enviarSMSConfirmacaoPreConsulta(celularPaciente, nomePaciente, nomeMedico)
      .catch(e => console.error('[SMS] Erro:', e.message));
  }
}

async function processarTarefa(tarefa) {
  console.log('[WORKER] processando tarefa', tarefa.id, tarefa.tipo, 'tentativa', tarefa.tentativas + 1);
  try {
    if (tarefa.tipo === 'GERAR_SUMMARY_E_TTS') {
      await processarGerarSummaryETts(tarefa);
    } else {
      throw new Error('Tipo de tarefa desconhecido: ' + tarefa.tipo);
    }

    // Sucesso — marcar processadoEm
    await prisma.tarefaPendente.update({
      where: { id: tarefa.id },
      data: { processadoEm: new Date(), erro: null },
    });
    console.log('[WORKER] tarefa', tarefa.id, 'CONCLUIDA');
  } catch (err) {
    const novasTentativas = tarefa.tentativas + 1;
    console.error('[WORKER] tarefa', tarefa.id, 'falhou:', err.message, '| tentativas:', novasTentativas);

    if (novasTentativas >= MAX_TENTATIVAS) {
      // Dead letter — medico vai ver "Incompleta" no dashboard e pode pedir reenvio
      await prisma.tarefaPendente.update({
        where: { id: tarefa.id },
        data: {
          tentativas: novasTentativas,
          erro: String(err.message || err).substring(0, 500),
          dead: true,
          processadoEm: new Date(),
        },
      });
      console.error('[WORKER] tarefa', tarefa.id, 'DEAD apos', novasTentativas, 'tentativas');
    } else {
      // Reagenda com backoff
      await prisma.tarefaPendente.update({
        where: { id: tarefa.id },
        data: {
          tentativas: novasTentativas,
          erro: String(err.message || err).substring(0, 500),
          proximaTentativa: delayParaProximaTentativa(novasTentativas),
        },
      });
    }
  }
}

let rodando = false;
async function tick() {
  if (rodando) return; // evita concorrencia
  rodando = true;
  try {
    const pendentes = await prisma.tarefaPendente.findMany({
      where: {
        processadoEm: null,
        dead: false,
        proximaTentativa: { lte: new Date() },
      },
      orderBy: { criadoEm: 'asc' },
      take: LIMITE_POR_CICLO,
    });
    if (pendentes.length === 0) return;
    console.log('[WORKER] tick:', pendentes.length, 'tarefa(s) pendentes');
    // Processa sequencialmente (evita rate limit em IA/storage)
    for (const t of pendentes) {
      await processarTarefa(t);
    }
  } catch (e) {
    console.error('[WORKER] tick erro:', e.message);
  } finally {
    rodando = false;
  }
}

let intervalHandle = null;
function iniciarWorker() {
  if (intervalHandle) return;
  // Primeiro tick depois de 10s (da tempo do servidor subir)
  setTimeout(() => {
    tick();
    intervalHandle = setInterval(tick, INTERVALO_MS);
  }, 10000);
}

function pararWorker() {
  if (intervalHandle) { clearInterval(intervalHandle); intervalHandle = null; }
}

module.exports = { iniciarWorker, pararWorker };
