const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Gera um codigo numerico aleatorio de 6 digitos.
 */
function gerarCodigo() {
  const numero = crypto.randomInt(0, 1000000);
  return numero.toString().padStart(6, '0');
}

/**
 * Em modo desenvolvimento (sem Twilio), apenas loga o codigo no console.
 * Em producao com Twilio configurado, enviaria SMS de verdade.
 */
async function enviarCodigoVerificacao(celular, codigo) {
  if (!celular) {
    throw new Error('Numero de celular e obrigatorio.');
  }

  // Se Twilio estiver configurado, envia SMS de verdade
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    const twilio = require('twilio');
    const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await twilioClient.messages.create({
      body: `VITAE: Seu codigo de verificacao e ${codigo}. Valido por 10 minutos.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: celular,
    });
    console.log(`[SMS] Codigo enviado via Twilio para ${celular}`);
  } else {
    // Modo desenvolvimento: loga no console
    console.log('');
    console.log('  ==========================================');
    console.log(`  [SMS BYPASS] Codigo para ${celular}: ${codigo}`);
    console.log('  ==========================================');
    console.log('');
  }
}

/**
 * Verifica se o codigo digitado confere com o hash.
 */
async function verificarCodigo(codigoDigitado, codigoHash) {
  if (!codigoDigitado || !codigoHash) return false;
  const codigoLimpo = String(codigoDigitado).trim();
  if (codigoLimpo.length !== 6 || !/^\d{6}$/.test(codigoLimpo)) return false;
  return bcrypt.compare(codigoLimpo, codigoHash);
}

module.exports = {
  enviarCodigoVerificacao,
  verificarCodigo,
  gerarCodigo,
};
