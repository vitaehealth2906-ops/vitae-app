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

// Faz sync dos eventos dos proximos N dias.
async function sincronizar(medicoId, diasFuturo = 90) {
  const medico = await prisma.medico.findUnique({
    where: { id: medicoId },
    select: { googleTokenEnc: true, googleTokenIv: true, googleTokenTag: true },
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
  } catch (e) {
    return { ok: false, code: 'TOKEN_CORROMPIDO', message: 'Reconecte Google.' };
  }

  const g = getGoogle();
  const oauth2 = clientFor();
  oauth2.setCredentials({ refresh_token: refreshToken });

  let eventos;
  try {
    const cal = g.calendar({ version: 'v3', auth: oauth2 });
    const agora = new Date();
    const fim = new Date(agora.getTime() + diasFuturo * 24 * 60 * 60 * 1000);
    const res = await cal.events.list({
      calendarId: 'primary',
      timeMin: agora.toISOString(),
      timeMax: fim.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });
    eventos = res.data.items || [];
  } catch (e) {
    if (e.code === 401 || /invalid_grant/.test(e.message || '')) {
      // Token revogado ou expirado
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

    if (mapaExistentes.has(ev.id)) {
      // Atualiza
      await prisma.agendaSlot.update({
        where: { googleEventId: ev.id },
        data: {
          inicio: inicioDate,
          fim: fimDate,
          duracaoMin,
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
            criadoPor: 'GOOGLE_SYNC',
            // motivo/observacoes ficam null pra LGPD
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

module.exports = { gerarAuthUrl, processarCallback, sincronizar, desconectar, SCOPE };
