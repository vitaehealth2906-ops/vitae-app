// Templates de email do modulo Agenda (institucionais, sem emoji, PT-BR).
// Usa pattern do email.js existente: layout dark com gradiente verde-ciano.
//
// Cada funcao recebe Resend ja inicializado e dados, e dispara envio.
// Bypass mode: se sem RESEND_API_KEY, loga no console (igual padrao da casa).

const { Resend } = require('resend');
const { formatHumano } = require('./timezone');
const { hmacToken } = require('./crypto');

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = 'vita id <onboarding@resend.dev>';
const FOOTER_LGPD = `
  <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:24px 0;">
  <p style="color:rgba(255,255,255,0.3);font-size:11px;line-height:1.5;text-align:center;margin:0;">
    vita id e ferramenta de organizacao da agenda medica. Decisoes clinicas sao responsabilidade do medico.<br>
    LGPD: seus dados estao protegidos. <a href="{LINK_OPT_OUT}" style="color:rgba(0,229,160,0.8);">Nao quero receber lembretes</a>
  </p>
`;

function brand() {
  return `
    <div style="text-align:center;margin-bottom:28px;">
      <h1 style="color:#00E5A0;font-size:26px;margin:0;font-family:Georgia,serif;">vita id</h1>
      <p style="color:rgba(255,255,255,0.35);font-size:11px;margin:4px 0 0;letter-spacing:0.1em;text-transform:uppercase;">Sua saude em um so lugar</p>
    </div>
  `;
}

function botao(texto, url, primario = true) {
  const bg = primario
    ? 'background:linear-gradient(135deg,#00E5A0,#00B4D8);color:#0D0F14;'
    : 'background:transparent;border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.85);';
  return `<a href="${url}" style="display:inline-block;${bg}text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;font-size:14px;letter-spacing:0.3px;margin:6px;">${texto}</a>`;
}

function token(slotId, pacienteId) {
  return hmacToken(`${slotId}:${pacienteId}`);
}

function frontendUrl() {
  return process.env.FRONTEND_URL || 'https://vitae-app.vercel.app';
}

function backendUrl() {
  return process.env.BACKEND_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'https://vitae-app-production.up.railway.app'
      : 'http://localhost:3001');
}

// ---- 1. Consulta marcada ----
async function enviarConsultaMarcada({ slot, paciente, medicoNome, localNome, timezone }) {
  const email = paciente?.email || slot.pacienteTelLivre || null;
  if (!email || !email.includes('@')) return { sent: false, reason: 'sem_email' };
  if (!resend) {
    console.log(`[EMAIL BYPASS] Consulta marcada: ${email} → ${formatHumano(slot.inicio, timezone)}`);
    return { sent: false, reason: 'bypass' };
  }

  const tk = token(slot.id, paciente?.id || 'free');
  const linkConfirma = `${backendUrl()}/agenda/slots/${slot.id}/confirmar-presenca?token=${tk}`;
  const linkRecusa = `${backendUrl()}/agenda/slots/${slot.id}/recusar?token=${tk}`;
  const linkOptOut = `${frontendUrl()}/agenda/preferencias?token=${tk}`;
  const tipo = slot.tipo === 'ONLINE' ? 'online' : 'presencial';

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `vita id — Sua consulta foi marcada (${formatHumano(slot.inicio, timezone, "d 'de' MMMM")})`,
    html: `
      <div style="background:#0A0A0A;padding:40px;font-family:'Plus Jakarta Sans',sans-serif;max-width:520px;margin:0 auto;border-radius:16px;">
        ${brand()}
        <h2 style="color:#fff;font-size:20px;margin:0 0 12px;">Sua consulta foi marcada</h2>
        <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.6;margin:0 0 20px;">
          <strong style="color:#fff;">${formatHumano(slot.inicio, timezone)}</strong> com Dr(a). ${medicoNome}.<br>
          ${tipo === 'online' ? 'Consulta online' : `Local: ${localNome || 'A definir'}`}.
        </p>
        ${slot.motivo ? `<p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0 0 20px;">Motivo: ${slot.motivo}</p>` : ''}
        <div style="text-align:center;margin:24px 0;">
          ${botao('Confirmar presenca', linkConfirma, true)}
          ${botao('Pedir remarcar', linkRecusa, false)}
        </div>
        ${FOOTER_LGPD.replace('{LINK_OPT_OUT}', linkOptOut)}
      </div>
    `,
  });
  return { sent: true };
}

// ---- 2. Lembrete 24h ----
async function enviarLembrete24h({ slot, paciente, medicoNome, localNome, timezone }) {
  const email = paciente?.email;
  if (!email) return { sent: false, reason: 'sem_email' };
  if (!resend) {
    console.log(`[EMAIL BYPASS] Lembrete 24h: ${email}`);
    return { sent: false, reason: 'bypass' };
  }

  const tk = token(slot.id, paciente?.id || 'free');
  const linkConfirma = `${backendUrl()}/agenda/slots/${slot.id}/confirmar-presenca?token=${tk}`;
  const linkRecusa = `${backendUrl()}/agenda/slots/${slot.id}/recusar?token=${tk}`;
  const linkOptOut = `${frontendUrl()}/agenda/preferencias?token=${tk}`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `vita id — Sua consulta e amanha`,
    html: `
      <div style="background:#0A0A0A;padding:40px;font-family:'Plus Jakarta Sans',sans-serif;max-width:520px;margin:0 auto;border-radius:16px;">
        ${brand()}
        <h2 style="color:#fff;font-size:22px;margin:0 0 8px;">Amanha, ${formatHumano(slot.inicio, timezone, 'HH:mm')}</h2>
        <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.6;margin:0 0 18px;">
          Dr(a). <strong>${medicoNome}</strong> — ${slot.tipo === 'ONLINE' ? 'consulta online' : (localNome || 'consultorio')}.
        </p>
        <div style="background:rgba(0,229,160,0.06);border:1px solid rgba(0,229,160,0.2);border-radius:12px;padding:14px;margin:18px 0;">
          <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:0;">
            ${formatHumano(slot.inicio, timezone, "EEEE, d 'de' MMMM 'às' HH:mm")}
          </p>
        </div>
        <div style="text-align:center;margin:24px 0;">
          ${botao('Confirmar presenca', linkConfirma, true)}
          ${botao('Pedir remarcar', linkRecusa, false)}
        </div>
        ${FOOTER_LGPD.replace('{LINK_OPT_OUT}', linkOptOut)}
      </div>
    `,
  });
  return { sent: true };
}

// ---- 3. Lembrete 2h ----
async function enviarLembrete2h({ slot, paciente, medicoNome, localNome, timezone }) {
  const email = paciente?.email;
  if (!email) return { sent: false, reason: 'sem_email' };
  if (!resend) {
    console.log(`[EMAIL BYPASS] Lembrete 2h: ${email}`);
    return { sent: false, reason: 'bypass' };
  }

  const tk = token(slot.id, paciente?.id || 'free');
  const linkOptOut = `${frontendUrl()}/agenda/preferencias?token=${tk}`;
  const linkVideo = slot.tipo === 'ONLINE' && slot.videoUrl ? slot.videoUrl : null;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `vita id — Em 2 horas: ${formatHumano(slot.inicio, timezone, 'HH:mm')}`,
    html: `
      <div style="background:#0A0A0A;padding:40px;font-family:'Plus Jakarta Sans',sans-serif;max-width:520px;margin:0 auto;border-radius:16px;">
        ${brand()}
        <h2 style="color:#fff;font-size:22px;margin:0 0 8px;">Em 2 horas: ${formatHumano(slot.inicio, timezone, 'HH:mm')}</h2>
        <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;margin:0 0 16px;">
          Dr(a). ${medicoNome}<br>
          ${linkVideo ? '' : (localNome || 'Consultorio')}
        </p>
        ${linkVideo ? `<div style="text-align:center;margin:20px 0;">${botao('Entrar na videochamada', linkVideo, true)}</div>` : ''}
        ${FOOTER_LGPD.replace('{LINK_OPT_OUT}', linkOptOut)}
      </div>
    `,
  });
  return { sent: true };
}

// ---- 4. Convite secretaria ----
async function enviarConviteSecretaria({ emailDestino, medicoNome, conviteToken, expiraEm }) {
  if (!resend) {
    console.log(`[EMAIL BYPASS] Convite secretaria: ${emailDestino}`);
    return { sent: false, reason: 'bypass' };
  }

  const link = `${frontendUrl()}/03-cadastro.html?invite=${conviteToken}`;

  await resend.emails.send({
    from: FROM,
    to: emailDestino,
    subject: `vita id — Dr(a). ${medicoNome} convidou voce a ajudar na agenda`,
    html: `
      <div style="background:#0A0A0A;padding:40px;font-family:'Plus Jakarta Sans',sans-serif;max-width:520px;margin:0 auto;border-radius:16px;">
        ${brand()}
        <h2 style="color:#fff;font-size:20px;margin:0 0 12px;">Voce foi convidado(a)</h2>
        <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.6;margin:0 0 20px;">
          Dr(a). <strong>${medicoNome}</strong> convidou voce a ajudar na agenda do consultorio.
          Voce vai poder marcar, remarcar e cancelar consultas, alem de gerenciar a lista de espera.
        </p>
        <p style="color:rgba(255,255,255,0.5);font-size:13px;line-height:1.6;margin:0 0 20px;">
          Voce <strong style="color:rgba(255,255,255,0.85);">nao tera acesso</strong> a dados clinicos dos pacientes (briefings, exames, alergias, medicamentos).
        </p>
        <div style="text-align:center;margin:24px 0;">
          ${botao('Aceitar convite', link, true)}
        </div>
        <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:0;text-align:center;">
          Este convite expira em ${expiraEm ? formatHumano(expiraEm) : '7 dias'}.
        </p>
      </div>
    `,
  });
  return { sent: true };
}

// ---- 5. Oferta de vaga (lista de espera) ----
async function enviarOfertaVaga({ emailDestino, slot, medicoNome, localNome, timezone, listaEsperaToken }) {
  if (!resend) {
    console.log(`[EMAIL BYPASS] Oferta vaga: ${emailDestino}`);
    return { sent: false, reason: 'bypass' };
  }

  const linkAceitar = `${backendUrl()}/agenda/lista-espera/aceitar?token=${listaEsperaToken}`;

  await resend.emails.send({
    from: FROM,
    to: emailDestino,
    subject: `vita id — Abriu vaga em ${formatHumano(slot.inicio, timezone, "d 'de' MMMM")}`,
    html: `
      <div style="background:#0A0A0A;padding:40px;font-family:'Plus Jakarta Sans',sans-serif;max-width:520px;margin:0 auto;border-radius:16px;">
        ${brand()}
        <h2 style="color:#fff;font-size:20px;margin:0 0 12px;">Abriu uma vaga</h2>
        <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.6;margin:0 0 16px;">
          Voce esta na lista de espera de Dr(a). <strong>${medicoNome}</strong>.
          Acabou de abrir um horario que combina com sua preferencia:
        </p>
        <div style="background:rgba(0,229,160,0.06);border:1px solid rgba(0,229,160,0.2);border-radius:12px;padding:14px;margin:18px 0;">
          <p style="color:#fff;font-size:18px;margin:0 0 6px;font-weight:700;">${formatHumano(slot.inicio, timezone)}</p>
          <p style="color:rgba(255,255,255,0.55);font-size:13px;margin:0;">${localNome || 'Consultorio'}</p>
        </div>
        <div style="text-align:center;margin:24px 0;">
          ${botao('Aceitar este horario', linkAceitar, true)}
        </div>
        <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:0;text-align:center;">
          Se nao aceitar em 1 hora, ofereceremos o horario pro proximo da fila.
        </p>
      </div>
    `,
  });
  return { sent: true };
}

// ---- 6. Google Calendar desconectado ----
async function enviarGoogleDesconectado({ emailDestino, nomeMedico }) {
  if (!resend) {
    console.log(`[EMAIL BYPASS] Google desconectado: ${emailDestino}`);
    return { sent: false, reason: 'bypass' };
  }

  const link = `${frontendUrl()}/desktop/app.html#agenda`;

  await resend.emails.send({
    from: FROM,
    to: emailDestino,
    subject: `vita id — Conexao com Google Calendar caiu`,
    html: `
      <div style="background:#0A0A0A;padding:40px;font-family:'Plus Jakarta Sans',sans-serif;max-width:520px;margin:0 auto;border-radius:16px;">
        ${brand()}
        <h2 style="color:#fff;font-size:20px;margin:0 0 12px;">Reconectar Google Calendar?</h2>
        <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.6;margin:0 0 20px;">
          Olá Dr(a). ${nomeMedico}, sua conexao com Google Calendar caiu — provavelmente o acesso foi revogado.
          Sua agenda vita id continua funcionando normalmente. Eventos pessoais do Google deixaram de aparecer como bloqueios.
        </p>
        <div style="text-align:center;margin:24px 0;">
          ${botao('Reconectar Google', link, true)}
        </div>
        <p style="color:rgba(255,255,255,0.4);font-size:12px;line-height:1.6;margin:0;">
          vita id continua nao escrevendo nada no seu Google. Apenas leitura.
        </p>
      </div>
    `,
  });
  return { sent: true };
}

module.exports = {
  enviarConsultaMarcada,
  enviarLembrete24h,
  enviarLembrete2h,
  enviarConviteSecretaria,
  enviarOfertaVaga,
  enviarGoogleDesconectado,
};
