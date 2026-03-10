const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Envia o arquivo diretamente para o Claude ler — PDFs (incluindo escaneados)
 * e imagens. O Claude lê tudo visualmente, igual ao claude.com.
 */
async function lerArquivoComClaude(arquivoBuffer, mimeType) {
  const base64 = arquivoBuffer.toString('base64');
  const tipo = (mimeType || '').toLowerCase();

  let contentItem;

  if (tipo === 'application/pdf') {
    contentItem = {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    };
  } else {
    const mediaType = tipo === 'image/jpg' ? 'image/jpeg' : tipo;
    contentItem = {
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64 },
    };
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          contentItem,
          {
            type: 'text',
            text: 'Extraia TODO o texto visível neste documento de exame laboratorial. Mantenha a formatação original, incluindo nomes de parâmetros, valores, unidades e faixas de referência. Retorne apenas o texto extraído, sem comentários.',
          },
        ],
      },
    ],
  });

  const texto = response.content[0].text.trim();

  if (!texto || texto.length < 20) {
    throw new Error('O arquivo não contém texto legível. Verifique se é um resultado de laboratório válido.');
  }

  return texto;
}

/**
 * Extrai texto de um arquivo de exame.
 * Usa Claude Vision/Document para QUALQUER tipo de arquivo — mesmo PDFs escaneados.
 */
async function extrairTexto(arquivoBuffer, tipoArquivo) {
  if (!arquivoBuffer || arquivoBuffer.length === 0) {
    throw new Error('O arquivo enviado está vazio.');
  }

  const tipo = (tipoArquivo || '').toLowerCase();

  if (tipo === 'application/pdf' || tipo === 'pdf') {
    return await lerArquivoComClaude(arquivoBuffer, 'application/pdf');
  }

  if (['image/jpeg', 'image/jpg', 'image/png', 'jpeg', 'jpg', 'png'].includes(tipo)) {
    const mime = tipo.startsWith('image/') ? tipo : `image/${tipo}`;
    return await lerArquivoComClaude(arquivoBuffer, mime);
  }

  throw new Error(`Tipo de arquivo não suportado: ${tipoArquivo}. Envie PDF, JPG ou PNG.`);
}

module.exports = { extrairTexto };
