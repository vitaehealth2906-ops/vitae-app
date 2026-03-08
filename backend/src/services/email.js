const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function enviarEmailResetSenha(emailDestino, nomeUsuario, linkReset) {
  await transporter.sendMail({
    from: `"VITAE Health" <${process.env.GMAIL_USER}>`,
    to: emailDestino,
    subject: 'Redefinir sua senha — VITAE',
    html: `
      <div style="background:#0A0A0A;padding:40px;font-family:Inter,sans-serif;max-width:480px;margin:0 auto;border-radius:16px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#C5A55A;font-size:28px;margin:0;">VITAE</h1>
          <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:4px 0 0;">Sua saúde em um só lugar</p>
        </div>
        <h2 style="color:#fff;font-size:20px;margin:0 0 12px;">Olá, ${nomeUsuario} 👋</h2>
        <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;margin:0 0 28px;">
          Recebemos uma solicitação para redefinir a senha da sua conta VITAE. Clique no botão abaixo para criar uma nova senha.
        </p>
        <div style="text-align:center;margin-bottom:28px;">
          <a href="${linkReset}" style="display:inline-block;background:linear-gradient(135deg,#C5A55A,#D4B96A);color:#0A0A0A;text-decoration:none;padding:16px 40px;border-radius:12px;font-weight:700;font-size:15px;letter-spacing:0.5px;">
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

module.exports = { enviarEmailResetSenha };
