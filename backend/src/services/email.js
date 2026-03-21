const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function enviarEmailResetSenha(emailDestino, nomeUsuario, linkReset) {
  await resend.emails.send({
    from: 'VITAE Health <onboarding@resend.dev>',
    to: emailDestino,
    subject: 'VITAE — Link para redefinir sua senha',
    html: `
      <div style="background:#0A0A0A;padding:40px;font-family:Inter,sans-serif;max-width:480px;margin:0 auto;border-radius:16px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#00C882;font-size:28px;margin:0;">VITAE</h1>
          <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:4px 0 0;">Sua saúde em um só lugar</p>
        </div>
        <h2 style="color:#fff;font-size:20px;margin:0 0 12px;">Olá, ${nomeUsuario} 👋</h2>
        <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;margin:0 0 28px;">
          Recebemos uma solicitação para redefinir a senha da sua conta VITAE. Clique no botão abaixo para criar uma nova senha.
        </p>
        <div style="text-align:center;margin-bottom:28px;">
          <a href="${linkReset}" style="display:inline-block;background:linear-gradient(135deg,#00C882,#0099C4);color:#0A0A0A;text-decoration:none;padding:16px 40px;border-radius:12px;font-weight:700;font-size:15px;letter-spacing:0.5px;">
            Redefinir minha senha
          </a>
        </div>
        <p style="color:rgba(255,255,255,0.3);font-size:12px;line-height:1.6;margin:0;">
          Este link expira em <strong style="color:rgba(255,255,255,0.5);">30 minutos</strong>. Se você não solicitou a redefinição, ignore este email — sua senha permanece a mesma.
        </p>
        <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:24px 0;">
        <p style="color:rgba(255,255,255,0.2);font-size:11px;text-align:center;margin:0;">VITAE Health · vitae.health2906@gmail.com</p>
      </div>
    `,
  });
}

async function enviarEmailPreConsultaRespondida(emailMedico, nomeMedico, nomePaciente, summaryIA, linkDashboard) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL BYPASS] Pre-consulta respondida: ${nomePaciente} → ${emailMedico}`);
    return;
  }

  const summaryHtml = summaryIA
    ? `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(0,200,130,0.15);border-radius:12px;padding:20px;margin:20px 0;">
        <p style="color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 10px;">Resumo clínico</p>
        <p style="color:rgba(255,255,255,0.75);font-size:14px;line-height:1.7;margin:0;">${summaryIA}</p>
       </div>`
    : '';

  await resend.emails.send({
    from: 'VITAE Health <onboarding@resend.dev>',
    to: emailMedico,
    subject: `VITAE — ${nomePaciente} respondeu a pré-consulta`,
    html: `
      <div style="background:#0A0A0A;padding:40px;font-family:Inter,sans-serif;max-width:520px;margin:0 auto;border-radius:16px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#00C882;font-size:28px;margin:0;font-family:Georgia,serif;">VITAE</h1>
          <p style="color:rgba(255,255,255,0.35);font-size:12px;margin:4px 0 0;letter-spacing:0.1em;text-transform:uppercase;">Sua saúde em um só lugar</p>
        </div>
        <h2 style="color:#fff;font-size:18px;margin:0 0 8px;">Olá, Dr(a). ${nomeMedico}</h2>
        <p style="color:rgba(255,255,255,0.55);font-size:14px;line-height:1.6;margin:0 0 20px;">
          Seu paciente <strong style="color:#fff;">${nomePaciente}</strong> acabou de responder o formulário de pré-consulta.
        </p>
        ${summaryHtml}
        <div style="text-align:center;margin:28px 0;">
          <a href="${linkDashboard}" style="display:inline-block;background:linear-gradient(135deg,#00C882,#0099C4);color:#0A0A0A;text-decoration:none;padding:16px 40px;border-radius:12px;font-weight:700;font-size:14px;letter-spacing:0.5px;">
            Ver pré-consulta completa
          </a>
        </div>
        <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:24px 0;">
        <p style="color:rgba(255,255,255,0.2);font-size:11px;text-align:center;margin:0;">VITAE Health · vitae.health2906@gmail.com</p>
      </div>
    `,
  });
}

module.exports = { enviarEmailResetSenha, enviarEmailPreConsultaRespondida };
