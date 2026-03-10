const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const TEXTO_MINIMO = 80;

/**
 * Extrai texto embutido de um buffer PDF usando streams de texto.
 * Retorna null se o texto for insuficiente (PDF escaneado).
 */
function extrairTextoDiretoPdf(pdfBuffer) {
  try {
    const conteudo = pdfBuffer.toString('latin1');
    const blocos = [];

    const regexBT = /BT\s([\s\S]*?)ET/g;
    let matchBT;
    while ((matchBT = regexBT.exec(conteudo)) !== null) {
      const bloco = matchBT[1];

      const regexTj = /\(([^)]*)\)\s*Tj/g;
      let matchTj;
      while ((matchTj = regexTj.exec(bloco)) !== null) {
        const texto = matchTj[1].trim();
        if (texto) blocos.push(texto);
      }

      const regexTJArray = /\[(.*?)\]\s*TJ/g;
      let matchTJArray;
      while ((matchTJArray = regexTJArray.exec(bloco)) !== null) {
        const regexTJItem = /\(([^)]*)\)/g;
        let matchTJItem;
        while ((matchTJItem = regexTJItem.exec(matchTJArray[1])) !== null) {
          const texto = matchTJItem[1].trim();
          if (texto) blocos.push(texto);
        }
      }
    }

    const textoFinal = blocos.join(' ').replace(/\s+/g, ' ').trim();
    return textoFinal.length >= TEXTO_MINIMO ? textoFinal : null;
  } catch {
    return null;
  }
}

/**
 * Envia um arquivo (imagem ou PDF escaneado) para o Claude extrair o texto visualmente.
 * Suporta PDFs nativos e imagens.
 */
async function lerArquivoComClaude(arquivoBuffer, mimeType) {
  const base64 = arquivoBuffer.toString('base64');
  const tipo = (mimeType || '').toLowerCase();

  let contentItem;

  if (tipo === 'application/pdf') {
    // Claude lê o PDF diretamente — incluindo PDFs escaneados (sem texto selecionável)
    contentItem = {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    };
  } else {
    // Imagem: JPEG, PNG etc.
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
            text: 'Extraia TODO o texto visível neste documento de exame laboratorial. Mantenha a formatação original o máximo possível, incluindo nomes de parâmetros, valores, unidades e faixas de referência. Se o documento estiver em formato de tabela, preserve a estrutura. Retorne apenas o texto extraído, sem comentários ou explicações.',
          },
        ],
      },
    ],
  });

  const texto = response.content[0].text.trim();

  if (!texto || texto.length < 20) {
    throw new Error(
      'O arquivo não contém texto legível. Verifique se o arquivo é um resultado de laboratório válido.'
    );
  }

  return texto;
}

/**
 * Extrai texto de um arquivo de exame (PDF ou imagem).
 *
 * Estratégia:
 * - PDF com texto → extração direta (rápido, sem custo de API)
 * - PDF escaneado → Claude lê visualmente o documento
 * - Imagem (JPG/PNG) → Claude Vision
 */
async function extrairTexto(arquivoBuffer, tipoArquivo) {
  if (!arquivoBuffer || arquivoBuffer.length === 0) {
    throw new Error('O arquivo enviado está vazio.');
  }

  if (!tipoArquivo) {
    throw new Error('O tipo do arquivo não foi informado.');
  }

  const tipo = tipoArquivo.toLowerCase();

  if (tipo === 'application/pdf' || tipo === 'pdf') {
    // Tenta extração direta primeiro (mais rápida e sem custo de API)
    const textoDireto = extrairTextoDiretoPdf(arquivoBuffer);
    if (textoDireto) {
      console.log('[OCR] PDF com texto selecionável — extração direta OK');
      return textoDireto;
    }
    // PDF escaneado: Claude lê visualmente
    console.log('[OCR] PDF sem texto selecionável — usando Claude Vision');
    return await lerArquivoComClaude(arquivoBuffer, 'application/pdf');
  }

  if (['image/jpeg', 'image/jpg', 'image/png', 'jpeg', 'jpg', 'png'].includes(tipo)) {
    const mime = tipo.startsWith('image/') ? tipo : `image/${tipo}`;
    return await lerArquivoComClaude(arquivoBuffer, mime);
  }

  throw new Error(`Tipo de arquivo não suportado: ${tipoArquivo}. Envie PDF, JPG ou PNG.`);
}

module.exports = {
  extrairTexto,
};
