/**
 * VITAE — WhatsApp Business (Fase 10b)
 *
 * MODO 'simulacao' (default): registra cada envio em notificacao_disparos sem chamar Twilio.
 *                              UI flui normalmente, médico vê histórico, mas mensagem NÃO sai.
 * MODO 'real': chama Twilio Business API com template aprovado pela Meta.
 *
 * Pra ativar modo real, setar WHATSAPP_MODO=real + variáveis Twilio no Railway:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
 *   WHATSAPP_TEMPLATE_LEMBRETE_SID, WHATSAPP_TEMPLATE_CONFIRMACAO_SID
 *
 * Rate limit: 10 mensagens/min por médico (server-side)
 */
const prisma = require('../utils/prisma');

const MODO = process.env.WHATSAPP_MODO || 'simulacao';

// Cliente Twilio só carregado se modo real
let twilio = null;
if (MODO === 'real' && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (e) {
    console.warn('[whatsapp] Twilio SDK não instalado, voltando pra modo simulação');
  }
}

const TIMEZONE = 'America/Sao_Paulo';

function fmtDataBR(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function fmtHoraBR(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}

/**
 * Substitui placeholders {{nome}}, {{medico}}, {{data}}, {{hora}}, {{link}} numa mensagem.
 */
function aplicarPlaceholders(template, vars) {
  if (!template) return '';
  return String(template).replace(/\{\{(\w+)\}\}/g, (_m, k) => (vars[k] != null ? String(vars[k]) : ''));
}

/**
 * Normaliza número de celular pro formato E.164 BR (+55DDXXXXXXXXX).
 */
function normalizarTelefone(tel) {
  if (!tel) return null;
  const limpo = String(tel).replace(/\D/g, '');
  if (limpo.length === 11) return '+55' + limpo;
  if (limpo.length === 13 && limpo.startsWith('55')) return '+' + limpo;
  if (limpo.length === 10) return '+55' + limpo; // sem 9 inicial
  return null;
}

/**
 * Envia 1 mensagem (ou simula). SEMPRE registra em notificacao_disparos.
 */
async function enviarUma({ medicoId, pacienteId, destinatario, mensagem, templateSid, agendadoPara }) {
  const numeroE164 = normalizarTelefone(destinatario);
  if (!numeroE164) {
    return prisma.notificacaoDisparo.create({
      data: {
        medicoId,
        pacienteId: pacienteId || null,
        destinatario: String(destinatario || ''),
        canal: 'whatsapp',
        mensagem,
        templateSid: templateSid || null,
        modo: MODO,
        status: 'falhou',
        erro: 'Número de telefone inválido (não é BR ou formato incorreto)',
      },
    });
  }

  // Cria registro com status enfileirado
  const disparo = await prisma.notificacaoDisparo.create({
    data: {
      medicoId,
      pacienteId: pacienteId || null,
      destinatario: numeroE164,
      canal: 'whatsapp',
      mensagem,
      templateSid: templateSid || null,
      modo: MODO,
      status: agendadoPara ? 'agendado' : 'enfileirado',
      agendadoPara: agendadoPara || null,
    },
  });

  // Se agendado pro futuro, sai daqui (worker processa depois)
  if (agendadoPara && new Date(agendadoPara) > new Date()) {
    return disparo;
  }

  // Modo simulação: marca como entregue após delay simulado
  if (MODO === 'simulacao' || !twilio) {
    setTimeout(async () => {
      try {
        await prisma.notificacaoDisparo.update({
          where: { id: disparo.id },
          data: { status: 'entregue', enviadoEm: new Date(), entregueEm: new Date(), modo: 'simulacao' },
        });
      } catch (e) {}
    }, 800);
    return { ...disparo, status: 'entregue', modo: 'simulacao' };
  }

  // Modo real: chama Twilio
  try {
    const resp = await twilio.messages.create({
      from: 'whatsapp:' + (process.env.TWILIO_WHATSAPP_FROM || ''),
      to: 'whatsapp:' + numeroE164,
      contentSid: templateSid || undefined,
      body: templateSid ? undefined : mensagem,
    });
    await prisma.notificacaoDisparo.update({
      where: { id: disparo.id },
      data: { status: 'enviado', enviadoEm: new Date(), twilioSid: resp.sid },
    });
    return { ...disparo, twilioSid: resp.sid, status: 'enviado' };
  } catch (err) {
    await prisma.notificacaoDisparo.update({
      where: { id: disparo.id },
      data: { status: 'falhou', erro: String(err?.message || err).slice(0, 500) },
    });
    return { ...disparo, status: 'falhou', erro: err.message };
  }
}

/**
 * Disparo em massa. Aplica rate limit por médico.
 */
async function dispararEmMassa({ medicoId, destinatarios, mensagemTemplate, agendadoPara, paciente, medico }) {
  // Rate limit: contar disparos do médico nos últimos 60s
  const limiteMin = 10;
  const desde = new Date(Date.now() - 60 * 1000);
  const recentes = await prisma.notificacaoDisparo.count({
    where: { medicoId, criadoEm: { gte: desde } },
  });
  if (recentes >= limiteMin) {
    return {
      ok: false,
      erro: `Rate limit: máximo ${limiteMin} disparos por minuto. Aguarde alguns segundos.`,
      enviados: 0,
    };
  }

  const resultados = [];
  for (const dest of (destinatarios || [])) {
    const vars = {
      nome: dest.nome || (paciente?.nome) || 'paciente',
      medico: medico?.nome || 'seu médico',
      data: fmtDataBR(dest.data),
      hora: fmtHoraBR(dest.data || dest.hora),
      link: dest.link || '',
    };
    const msg = aplicarPlaceholders(mensagemTemplate, vars);
    const r = await enviarUma({
      medicoId,
      pacienteId: dest.pacienteId || null,
      destinatario: dest.telefone,
      mensagem: msg,
      templateSid: dest.templateSid || null,
      agendadoPara: agendadoPara ? new Date(agendadoPara) : null,
    });
    resultados.push(r);
  }

  return {
    ok: true,
    enviados: resultados.filter(r => r.status === 'enviado' || r.status === 'entregue' || r.status === 'agendado').length,
    falharam: resultados.filter(r => r.status === 'falhou').length,
    modo: MODO,
    disparos: resultados,
  };
}

module.exports = {
  enviarUma,
  dispararEmMassa,
  aplicarPlaceholders,
  normalizarTelefone,
  MODO,
};
