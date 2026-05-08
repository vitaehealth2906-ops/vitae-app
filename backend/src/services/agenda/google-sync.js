// Integracao Google Calendar (READ-ONLY).
// Le eventos pessoais do medico e cria AgendaSlot com origem=GOOGLE_IMPORT, tipo=BLOQUEIO.
// NUNCA escreve no Google. Sempre confirma scope = calendar.readonly.
//
// Setup pelo Lucas:
//   1. console.cloud.google.com -> projeto "vita-id-agenda"
//   2. Habilita Google Calendar API
//   3. OAuth 2.0 Client ID, tipo Web, redirect: ${BACKEND_URL}/agenda/google/callback
//   4. Env Railway: GCAL_CLIENT_ID, GCAL_CLIENT_SECRET, GCAL_REDIRECT_URI

const prisma = require('../../utils/prisma');
const cryptoSvc = require('./crypto');

let google = null;
function getGoogle() {
  if (google) return google;
  try {
    google = require('googleapis').google;
    return google;
  } catch (_e) {
    return null;
  }
}

const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

function clientFor() {
  const g = getGoogle();
  if (!g) throw new Error('googleapis nao instalado');
  if (!process.env.GCAL_CLIENT_ID || !process.env.GCAL_CLIENT_SECRET) {
    throw new Error('GCAL_CLIENT_ID/CLIENT_SECRET ausentes');
  }
  return new g.auth.OAuth2(
    process.env.GCAL_CLIENT_ID,
    process.env.GCAL_CLIENT_SECRET,
    process.env.GCAL_REDIRECT_URI || 'http://localhost:3001/agenda/google/callback',
  );
}

// Gera URL pra iniciar OAuth (com state CSRF)
function gerarAuthUrl(state) {
  const oauth2 = clientFor();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // forca refresh_token mesmo se ja autorizou antes
    scope: [SCOPE, 'email'],
    state,
  });
}

// Troca code por tokens, salva encriptado.
async function processarCallback(code, medicoId) {
  const oauth2 = clientFor();
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    return { ok: false, code: 'SEM_REFRESH_TOKEN', message: 'Google nao retornou refresh token. Revogue acesso e tente de novo.' };
  }

  // Pegar email do usuario Google
  oauth2.setCredentials(tokens);
  let googleEmail = null;
  try {
    const g = getGoogle();
    const oauth2api = g.oauth2({ version: 'v2', auth: oauth2 });
    const userinfo = await oauth2api.userinfo.get();
    googleEmail = userinfo.data?.email || null;
  } catch (_e) { /* nao critico */ }

  const enc = cryptoSvc.encrypt(tokens.refresh_token);

  await prisma.medico.update({
    where: { id: medicoId },
    data: {
      googleTokenEnc: enc.enc,
      googleTokenIv: enc.iv,
      googleTokenTag: enc.tag,
      googleEmail,
      googleScope: SCOPE,
      googleConectadoEm: new Date(),
      googleSyncErroEm: null,
    },
  });

  return { ok: true, data: { email: googleEmail } };
}

// Helper: monta cliente Google autenticado pro medico.
async function clientAutenticado(medicoId) {
  const medico = await prisma.medico.findUnique({
    where: { id: medicoId },
    select: {
      googleTokenEnc: true,
      googleTokenIv: true,
      googleTokenTag: true,
      googleCalendarIds: true,
    },
  });
  if (!medico?.googleTokenEnc) {
    return { ok: false, code: 'NAO_CONECTADO' };
  }
  let refreshToken;
  try {
    refreshToken = cryptoSvc.decrypt({
      enc: medico.googleTokenEnc,
      iv: medico.googleTokenIv,
      tag: medico.googleTokenTag,
    });
  } catch (_e) {
    return { ok: false, code: 'TOKEN_CORROMPIDO', message: 'Reconecte Google.' };
  }
  const oauth2 = clientFor();
  oauth2.setCredentials({ refresh_token: refreshToken });
  return { ok: true, oauth2, calendarIds: medico.googleCalendarIds || [] };
}

// Lista todas as agendas (calendars) que o medico tem acesso na conta Google.
// Inclui cor, nome, contagem de eventos. Ordenado: principal -> proprias -> compartilhadas -> Google (aniv/feriados).
async function listarCalendars(medicoId) {
  const auth = await clientAutenticado(medicoId);
  if (!auth.ok) return auth;
  const g = getGoogle();
  try {
    const cal = g.calendar({ version: 'v3', auth: auth.oauth2 });
    const res = await cal.calendarList.list({ minAccessRole: 'reader', maxResults: 100 });
    const items = res.data.items || [];
    // Classifica cada agenda pra UI mostrar com defaults inteligentes.
    const agora = new Date();
    const fim = new Date(agora.getTime() + 90 * 24 * 60 * 60 * 1000);
    const lista = await Promise.all(items.map(async (item) => {
      // Categorizacao — normaliza pra remover acentos (Aniversários -> aniversarios)
      let categoria = 'outras';
      let recomendado = false;
      const summaryNorm = (item.summary || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const isGoogleAuto = /aniversari|birthday|feriado|holiday|tarefa|task|reminder|lembrete/i.test(summaryNorm)
        || item.id === 'addressbook#contacts@group.v.calendar.google.com'
        || /^(en\.brazilian|pt\.brazilian|en\.usa|pt\.|tasks)/i.test(item.id || '');
      if (item.primary) {
        categoria = 'principal';
        recomendado = true;
      } else if (isGoogleAuto) {
        categoria = 'google_automatica';
        recomendado = false;
      } else if (item.accessRole === 'owner') {
        categoria = 'criada_por_voce';
        recomendado = true;
      } else if (item.accessRole === 'reader' || item.accessRole === 'freeBusyReader') {
        categoria = 'compartilhada';
        recomendado = true;
      }
      // Conta eventos proximos 90d (limitado)
      let eventCount = 0;
      try {
        const evRes = await cal.events.list({
          calendarId: item.id,
          timeMin: agora.toISOString(),
          timeMax: fim.toISOString(),
          singleEvents: true,
          maxResults: 50,
        });
        eventCount = (evRes.data.items || []).length;
      } catch (_e) { /* ignora se a agenda especifica falhar */ }
      return {
        id: item.id,
        summary: item.summary,
        backgroundColor: item.backgroundColor || '#4285F4',
        foregroundColor: item.foregroundColor || '#FFFFFF',
        primary: !!item.primary,
        accessRole: item.accessRole,
        categoria,
        recomendado,
        eventCount,
      };
    }));
    // Ordena: principal -> propria -> compartilhada -> google_automatica -> outras
    const ordem = { principal: 0, criada_por_voce: 1, compartilhada: 2, outras: 3, google_automatica: 4 };
    lista.sort((a, b) => (ordem[a.categoria] || 5) - (ordem[b.categoria] || 5));
    return { ok: true, data: lista };
  } catch (e) {
    if (e.code === 401 || /invalid_grant/.test(e.message || '')) {
      await prisma.medico.update({
        where: { id: medicoId },
        data: { googleSyncErroEm: new Date() },
      });
      return { ok: false, code: 'TOKEN_REVOGADO', message: 'Google revogou acesso. Reconecte.' };
    }
    return { ok: false, code: 'GOOGLE_API_ERRO', message: e.message };
  }
}

// Faz sync dos eventos dos proximos N dias.
// Le agendas selecionadas em googleCalendarIds. Se vazio, usa 'primary' como fallback.
async function sincronizar(medicoId, diasFuturo = 90) {
  const auth = await clientAutenticado(medicoId);
  if (!auth.ok) return auth;
  const g = getGoogle();
  const calendarIds = (auth.calendarIds && auth.calendarIds.length > 0) ? auth.calendarIds : ['primary'];

  let eventos = [];
  try {
    const cal = g.calendar({ version: 'v3', auth: auth.oauth2 });
    const agora = new Date();
    const fim = new Date(agora.getTime() + diasFuturo * 24 * 60 * 60 * 1000);
    // Busca em PARALELO de cada agenda selecionada (com nome da agenda)
    const resultadosPorAgenda = await Promise.all(calendarIds.map(async (calId) => {
      try {
        // Pega metadata da agenda (nome) — 1 chamada leve
        let calNome = calId;
        try {
          const metaRes = await cal.calendars.get({ calendarId: calId });
          calNome = metaRes.data?.summary || calId;
        } catch (_e) { /* fallback ao id */ }
        const res = await cal.events.list({
          calendarId: calId,
          timeMin: agora.toISOString(),
          timeMax: fim.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 250,
        });
        return (res.data.items || []).map(ev => ({ ...ev, _calendarId: calId, _calNome: calNome }));
      } catch (e) {
        // Se uma agenda especifica falhar (ex: removida pelo medico), continua com as outras
        if (e.code === 401 || /invalid_grant/.test(e.message || '')) throw e;
        return [];
      }
    }));
    eventos = resultadosPorAgenda.flat();
  } catch (e) {
    if (e.code === 401 || /invalid_grant/.test(e.message || '')) {
      await prisma.medico.update({
        where: { id: medicoId },
        data: {
          googleTokenEnc: null,
          googleTokenIv: null,
          googleTokenTag: null,
          googleSyncErroEm: new Date(),
        },
      });
      return { ok: false, code: 'TOKEN_REVOGADO', message: 'Google revogou acesso. Reconecte.' };
    }
    throw e;
  }

  // Busca slots Google ja importados
  const existentes = await prisma.agendaSlot.findMany({
    where: { medicoId, origem: 'GOOGLE_IMPORT' },
    select: { id: true, googleEventId: true },
  });
  const mapaExistentes = new Map(existentes.map(s => [s.googleEventId, s.id]));

  let inseridos = 0, atualizados = 0, removidos = 0;
  const idsRecebidos = new Set();

  for (const ev of eventos) {
    if (!ev.id || !ev.start || !ev.end) continue;
    const inicio = ev.start.dateTime || ev.start.date;
    const fim = ev.end.dateTime || ev.end.date;
    if (!inicio || !fim) continue;

    idsRecebidos.add(ev.id);
    const inicioDate = new Date(inicio);
    const fimDate = new Date(fim);
    const duracaoMin = Math.round((fimDate - inicioDate) / 60000);

    // Titulo do evento (resumo) — usado pra medico identificar consulta na lista
    const titulo = ev.summary || null;
    const calNome = ev._calNome || null;

    if (mapaExistentes.has(ev.id)) {
      // Atualiza
      await prisma.agendaSlot.update({
        where: { googleEventId: ev.id },
        data: {
          inicio: inicioDate,
          fim: fimDate,
          duracaoMin,
          tituloEvento: titulo,
          calendarNome: calNome,
          googleSyncedAt: new Date(),
        },
      });
      atualizados++;
    } else {
      // Cria novo bloqueio
      try {
        await prisma.agendaSlot.create({
          data: {
            medicoId,
            inicio: inicioDate,
            fim: fimDate,
            duracaoMin,
            tipo: 'BLOQUEIO',
            status: 'CONFIRMADA',
            origem: 'GOOGLE_IMPORT',
            googleEventId: ev.id,
            googleSyncedAt: new Date(),
            tituloEvento: titulo,
            calendarNome: calNome,
            criadoPor: 'GOOGLE_SYNC',
          },
        });
        inseridos++;
      } catch (_e) {
        // Conflito de unique google_event_id (race) — ignora
      }
    }
  }

  // Remove os que sumiram do Google
  for (const [evId, slotId] of mapaExistentes.entries()) {
    if (!idsRecebidos.has(evId)) {
      await prisma.agendaSlot.delete({ where: { id: slotId } });
      removidos++;
    }
  }

  // Marca timestamp real de sincronizacao
  await prisma.medico.update({
    where: { id: medicoId },
    data: { googleSyncedAt: new Date(), googleSyncErroEm: null },
  });

  return { ok: true, data: { inseridos, atualizados, removidos, total: eventos.length } };
}

async function desconectar(medicoId) {
  await prisma.$transaction([
    prisma.agendaSlot.deleteMany({ where: { medicoId, origem: 'GOOGLE_IMPORT' } }),
    prisma.medico.update({
      where: { id: medicoId },
      data: {
        googleTokenEnc: null,
        googleTokenIv: null,
        googleTokenTag: null,
        googleEmail: null,
        googleScope: null,
        googleConectadoEm: null,
      },
    }),
  ]);
  return { ok: true };
}

module.exports = { gerarAuthUrl, processarCallback, sincronizar, desconectar, listarCalendars, SCOPE };
