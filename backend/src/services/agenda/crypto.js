// AES-256-GCM pra encriptar refresh_token do Google Calendar.
// Chave em env AGENDA_TOKEN_KEY (32 bytes em base64).
// IV unico (12 bytes) por registro, salvo junto.
// Tag de autenticacao impede tampering.
//
// Sem chave: lanca erro claro pra evitar persistir token em texto plano.

const crypto = require('crypto');

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const KEY_LEN = 32;

function getKey() {
  const k = process.env.AGENDA_TOKEN_KEY;
  if (!k) {
    throw new Error('[agenda/crypto] AGENDA_TOKEN_KEY ausente. Gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
  }
  const buf = Buffer.from(k, 'base64');
  if (buf.length !== KEY_LEN) {
    throw new Error('[agenda/crypto] AGENDA_TOKEN_KEY deve ter exatamente 32 bytes (44 chars base64).');
  }
  return buf;
}

function encrypt(plaintext) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('[agenda/crypto] encrypt: plaintext invalido');
  }
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    enc: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

function decrypt({ enc, iv, tag }) {
  if (!enc || !iv || !tag) {
    throw new Error('[agenda/crypto] decrypt: campos enc/iv/tag obrigatorios');
  }
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALG, key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(enc, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

// Helper: HMAC pra tokens de confirmacao por email (sem login)
function hmacToken(payload) {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url').slice(0, 24);
}

function verifyHmac(payload, token) {
  return hmacToken(payload) === token;
}

module.exports = { encrypt, decrypt, hmacToken, verifyHmac };
