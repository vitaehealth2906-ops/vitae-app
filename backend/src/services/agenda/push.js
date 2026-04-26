// Servico de push web (VAPID) para enviar lembretes ao navegador/celular do paciente.
// Subscribe acontece no frontend via Service Worker (public/sw.js).
// Aqui so disparamos pra subscriptions ativas.

const prisma = require('../../utils/prisma');

let webpush = null;
let configurado = false;

function init() {
  if (configurado) return webpush;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return null; // sem push, no-op
  }
  try {
    webpush = require('web-push');
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:suporte@vitaehealth.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    configurado = true;
    return webpush;
  } catch (e) {
    console.warn('[push] Erro ao inicializar web-push:', e.message);
    return null;
  }
}

// Envia push pra todas as subscriptions ativas de um usuario.
// payload: { titulo, body, slotId? }
async function enviarPara(usuarioId, payload) {
  const wp = init();
  if (!wp) return { sent: 0, reason: 'VAPID_NAO_CONFIGURADO' };

  const subs = await prisma.pushSubscription.findMany({
    where: { usuarioId, ativo: true },
  });
  if (subs.length === 0) return { sent: 0, reason: 'SEM_SUBSCRIPTION' };

  let sent = 0;
  let falhou = 0;
  for (const s of subs) {
    try {
      await wp.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({
          title: payload.titulo || 'vita id',
          body: payload.body || '',
          icon: '/vitaid-logo.svg',
          badge: '/vitaid-logo.svg',
          data: { slotId: payload.slotId || null, url: payload.url || '/08-perfil.html' },
        })
      );
      await prisma.pushSubscription.update({
        where: { id: s.id },
        data: { ultimoUsoEm: new Date() },
      });
      sent++;
    } catch (e) {
      falhou++;
      // Status 410 (Gone) ou 404 = subscription expirada — desativa
      const status = e.statusCode || e.status;
      if (status === 410 || status === 404) {
        await prisma.pushSubscription.update({
          where: { id: s.id },
          data: { ativo: false, falhouEm: new Date() },
        });
      }
    }
  }
  return { sent, falhou };
}

// Salva nova subscription (frontend chama POST /push/subscribe)
async function inscrever(usuarioId, sub, userAgent) {
  if (!sub || !sub.endpoint || !sub.keys) {
    throw new Error('Subscription invalida.');
  }
  const existing = await prisma.pushSubscription.findUnique({
    where: { endpoint: sub.endpoint },
  });
  if (existing) {
    return prisma.pushSubscription.update({
      where: { endpoint: sub.endpoint },
      data: { usuarioId, ativo: true, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
    });
  }
  return prisma.pushSubscription.create({
    data: {
      usuarioId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: userAgent || null,
    },
  });
}

async function desinscrever(usuarioId, endpoint) {
  return prisma.pushSubscription.updateMany({
    where: { usuarioId, endpoint },
    data: { ativo: false },
  });
}

function publicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

module.exports = { enviarPara, inscrever, desinscrever, publicKey, init };
