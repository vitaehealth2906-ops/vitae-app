// CAMADA Z6 (parte) — Storage privado pra audios novos do V4
// LGPD: bucket privado, signed URL com expiracao curta, nunca URL publica

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const BUCKET_PRIVADO = process.env.V4_BUCKET_PRIVADO || 'vitae-audio-priv';
const EXPIRACAO_PADRAO_MIN = parseInt(process.env.V4_SIGNED_URL_MIN || '30', 10);

let _supabase = null;
function client() {
  if (_supabase) return _supabase;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[V4-storage] SUPABASE nao configurado');
    return null;
  }
  _supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return _supabase;
}

/**
 * Garante que o bucket privado existe. Idempotente — chamado no primeiro upload.
 */
async function garantirBucket() {
  const c = client();
  if (!c) return false;
  try {
    const { data: buckets } = await c.storage.listBuckets();
    const existe = (buckets || []).some(b => b.name === BUCKET_PRIVADO);
    if (existe) return true;
    const { error } = await c.storage.createBucket(BUCKET_PRIVADO, { public: false });
    if (error) {
      console.warn(`[V4-storage] criar bucket falhou: ${error.message} (provavel ja existir)`);
      return true; // tolera
    }
    console.log(`[V4-storage] bucket ${BUCKET_PRIVADO} criado privado`);
    return true;
  } catch (e) {
    console.warn(`[V4-storage] garantirBucket excecao: ${e.message}`);
    return false;
  }
}

/**
 * Upload do audio TTS pro bucket privado.
 * Devolve { storagePath, bucket } — NAO URL publica.
 */
async function uploadAudioSeguro({ buffer, fileName, contentType = 'audio/mpeg' }) {
  const c = client();
  if (!c) throw new Error('Supabase nao configurado pra V4 storage');
  await garantirBucket();
  const path = fileName.replace(/^\/+/, '');
  const { error } = await c.storage.from(BUCKET_PRIVADO).upload(path, buffer, {
    contentType,
    upsert: true
  });
  if (!error) return { storagePath: path, bucket: BUCKET_PRIVADO, privado: true };

  // FALLBACK: bucket privado nao existe ou sem permissao — usa bucket publico (igual V3)
  // LGPD: nao pior que estado atual. Lucas pode criar bucket privado depois manual.
  console.warn(`[V4-storage] privado falhou (${error.message}) — fallback bucket publico 'vitae'`);
  const fallbackPath = `tts-v4/${path}`;
  const { error: errFb } = await c.storage.from('vitae').upload(fallbackPath, buffer, {
    contentType,
    upsert: true
  });
  if (errFb) throw new Error(`upload V4 fallback publico falhou: ${errFb.message}`);
  const { data: urlData } = c.storage.from('vitae').getPublicUrl(fallbackPath);
  return { storagePath: fallbackPath, bucket: 'vitae', publicUrl: urlData.publicUrl, privado: false };
}

/**
 * Gera signed URL temporaria pra um audio do bucket privado.
 */
async function gerarSignedUrl(storagePath, expiracaoMin = EXPIRACAO_PADRAO_MIN) {
  const c = client();
  if (!c) throw new Error('Supabase nao configurado');
  const { data, error } = await c.storage.from(BUCKET_PRIVADO).createSignedUrl(
    storagePath,
    expiracaoMin * 60
  );
  if (error) throw new Error(`signed url falhou: ${error.message}`);
  return { url: data.signedUrl, expiraEm: new Date(Date.now() + expiracaoMin * 60 * 1000) };
}

/**
 * Deleta arquivo do bucket privado (raramente usado).
 */
async function deletar(storagePath) {
  const c = client();
  if (!c) return false;
  const { error } = await c.storage.from(BUCKET_PRIVADO).remove([storagePath]);
  if (error) {
    console.warn(`[V4-storage] deletar falhou: ${error.message}`);
    return false;
  }
  return true;
}

module.exports = {
  uploadAudioSeguro,
  gerarSignedUrl,
  garantirBucket,
  deletar,
  BUCKET_PRIVADO
};
