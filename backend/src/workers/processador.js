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
const { transcreverAudio } = require('../services/transcription');
const { enviarEmailPreConsultaRespondida } = require('../services/email');
const { enviarSMSConfirmacaoPreConsulta } = require('../services/sms');

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

async function processarGerarSummaryETts(tarefa) {
  const preConsulta = await prisma.preConsulta.findUnique({
    where: { id: tarefa.preConsultaId },
    include: { medico: { include: { usuario: { select: { nome: true, email: true } } } } },
  });
  if (!preConsulta) throw new Error('Pre-consulta nao encontrada: ' + tarefa.preConsultaId);

  // [1] Transcricao via Whisper se vazia mas temos audio
  let transcricao = preConsulta.transcricao;
  const transcricaoInvalida = !transcricao || transcricao.trim().length <= 5 || transcricao === '(áudio sem transcrição)';
  if (transcricaoInvalida && preConsulta.audioUrl) {
    try {
      const whisperText = await transcreverAudio(preConsulta.audioUrl);
      if (whisperText && whisperText.length > 2) {
        transcricao = whisperText;
        await prisma.preConsulta.update({
          where: { id: preConsulta.id },
          data: { transcricao: whisperText },
        });
        console.log('[WORKER] Whisper transcrito:', preConsulta.id, '-', whisperText.substring(0, 80));
      }
    } catch (e) {
      console.error('[WORKER] Whisper falhou:', e.message);
      // Nao falha a tarefa inteira — summary pode ser gerado com o que tem
    }
  }

  // [2] Enriquecer respostas com perfil do paciente logado
  const respostasEnriquecidas = await enriquecerRespostas(preConsulta);

  // [3] Gerar summary com IA
  let summaryIA = null;
  let summaryJson = null;
  try {
    const resultado = await gerarSummaryPreConsulta(
      preConsulta.pacienteNome,
      respostasEnriquecidas,
      transcricao,
      preConsulta.templatePerguntas
    );
    summaryIA = resultado.summaryTexto;
    summaryJson = resultado;
  } catch (e) {
    // Se summary falhou, relanca pra tarefa ser retentada
    throw new Error('gerarSummary falhou: ' + e.message);
  }

  // [4] Salvar summary no banco
  await prisma.preConsulta.update({
    where: { id: preConsulta.id },
    data: { summaryIA, summaryJson },
  });

  // [5] TTS — separado em try pra nao falhar tarefa se so TTS falhar
  if (summaryJson && (summaryJson.textoVoz || summaryIA)) {
    const textoVoz = summaryJson.textoVoz || summaryIA;
    try {
      const audioBuffer = await gerarAudioElevenLabs(textoVoz, preConsulta.pacienteNome);
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
      console.log('[WORKER] TTS gerado:', preConsulta.id);
    } catch (ttsErr) {
      console.error('[WORKER] TTS falhou (nao bloqueia tarefa):', ttsErr.message);
      // TTS falhar nao faz a tarefa ser retentada — medico ainda tem o summary
    }
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
