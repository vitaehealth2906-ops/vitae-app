const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const TEXTO_MINIMO_PDF = 100;

/**
 * Extrai texto embutido de um buffer PDF usando busca por streams de texto.
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
    return textoFinal.length >= TEXTO_MINIMO_PDF ? textoFinal : null;
  } catch {
    return null;
  }
}

/**
 * Usa Claude Vision para extrair texto de uma imagem de exame.
 */
async function ocrComClaude(imagemBuffer, mimeType) {
  const base64 = imagemBuffer.toString('base64');
  const mediaType = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: 'text',
            text: 'Extraia TODO o texto visivel nesta imagem de exame laboratorial. Mantenha a formatacao original o maximo possivel, incluindo nomes de parametros, valores, unidades e faixas de referencia. Retorne apenas o texto extraido, sem comentarios.',
          },
        ],
      },
    ],
  });

  const texto = response.content[0].text.trim();
  if (!texto || texto.length < 20) {
    throw new Error('Nenhum texto foi detectado na imagem. Verifique se a imagem do exame esta nitida e legivel.');
  }
  return texto;
}

/**
 * Extrai texto de um arquivo de exame (PDF ou imagem).
 * Para PDFs, tenta extracao direta primeiro. Se falhar, usa Claude Vision.
 * Para imagens, usa Claude Vision diretamente.
 */
async function extrairTexto(arquivoBuffer, tipoArquivo) {
  if (!arquivoBuffer || arquivoBuffer.length === 0) {
    throw new Error('O arquivo enviado esta vazio.');
  }

  if (!tipoArquivo) {
    throw new Error('O tipo do arquivo nao foi informado.');
  }

  const tipo = tipoArquivo.toLowerCase();

  try {
    if (tipo === 'application/pdf' || tipo === 'pdf') {
      // Tenta extracao direta primeiro (mais rapida e sem custo de API)
      const textoDireto = extrairTextoDiretoPdf(arquivoBuffer);
      if (textoDireto) {
        return textoDireto;
      }
      // Fallback: Claude Vision nao suporta PDF diretamente
      // Retorna erro pedindo que envie como imagem
      throw new Error('Este PDF nao contem texto selecionavel. Por favor, tire uma foto do exame e envie como imagem (JPG ou PNG).');
    }

    if (['image/jpeg', 'image/jpg', 'image/png', 'jpeg', 'jpg', 'png'].includes(tipo)) {
      return await ocrComClaude(arquivoBuffer, tipo.startsWith('image/') ? tipo : `image/${tipo}`);
    }

    throw new Error(`Tipo de arquivo nao suportado: ${tipoArquivo}. Envie um PDF, JPG ou PNG.`);
  } catch (err) {
    if (err.message && /[àáâãéêíóôõúç]/i.test(err.message)) {
      throw err;
    }
    if (err.message && (err.message.includes('nao') || err.message.includes('Este PDF'))) {
      throw err;
    }
    throw new Error(`Erro ao processar o arquivo: ${err.message || 'falha desconhecida'}. Tente novamente.`);
  }
}

module.exports = {
  extrairTexto,
};
