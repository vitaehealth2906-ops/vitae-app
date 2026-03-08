const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;

function getSupabase() {
  if (!supabase) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.warn('[STORAGE] Supabase nao configurado. Upload de arquivos desabilitado.');
      return null;
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabase;
}

const BUCKET_EXAMES = 'exames';

/**
 * Faz upload de um arquivo para o Supabase Storage.
 */
async function upload({ buffer, nomeOriginal, mimetype, pasta }) {
  const client = getSupabase();

  // Se Supabase nao estiver configurado, salva localmente como fallback
  if (!client) {
    const fs = require('fs');
    const path = require('path');
    const uploadDir = path.join(__dirname, '../../uploads', pasta || '');
    fs.mkdirSync(uploadDir, { recursive: true });
    const fileName = `${Date.now()}-${nomeOriginal.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${pasta ? pasta + '/' : ''}${fileName}`;
  }

  const nomeSeguro = nomeOriginal
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');

  const caminho = pasta ? `${pasta}/${Date.now()}-${nomeSeguro}` : `${Date.now()}-${nomeSeguro}`;

  const { data, error } = await client.storage
    .from(BUCKET_EXAMES)
    .upload(caminho, buffer, {
      contentType: mimetype || 'application/octet-stream',
      upsert: true,
    });

  if (error) {
    throw new Error(`Falha ao fazer upload: ${error.message}`);
  }

  const { data: urlData } = client.storage
    .from(BUCKET_EXAMES)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Gera uma URL assinada temporaria.
 */
async function gerarUrlAssinada(path, { expiraEmSegundos = 3600 } = {}) {
  const client = getSupabase();
  if (!client) return path;

  const { data, error } = await client.storage
    .from(BUCKET_EXAMES)
    .createSignedUrl(path, expiraEmSegundos);

  if (error) {
    throw new Error(`Falha ao gerar URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Deleta um arquivo do storage.
 */
async function deletar(path) {
  const client = getSupabase();
  if (!client || !path) return;

  // Extrai o caminho relativo da URL publica
  const relativePath = path.includes('/storage/v1/object/public/')
    ? path.split('/storage/v1/object/public/' + BUCKET_EXAMES + '/')[1]
    : path;

  if (!relativePath) return;

  const { error } = await client.storage
    .from(BUCKET_EXAMES)
    .remove([relativePath]);

  if (error) {
    console.error(`[STORAGE] Erro ao deletar: ${error.message}`);
  }
}

module.exports = {
  upload,
  gerarUrlAssinada,
  deletar,
  // Aliases para compatibilidade
  uploadArquivo: upload,
  getArquivoUrl: gerarUrlAssinada,
  deletarArquivo: deletar,
};
