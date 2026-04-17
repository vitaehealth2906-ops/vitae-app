// ============================================================
// Normalizacao universal de telefone — UMA fonte de verdade
// Usado em todos os pontos do backend que comparam telefones
// ============================================================
//
// Padrao adotado: E.164 brasileiro = "+55" + DDD (2 digitos) + numero (8 ou 9 digitos)
// Exemplos validos:
//   "+5511999999999" (celular SP)
//   "+551133334444"  (fixo SP)
//
// Aceita entradas tipo:
//   "11999999999"
//   "(11) 99999-9999"
//   "11 9 9999-9999"
//   "+55 11 9 9999 9999"
//   "5511999999999"
// E retorna sempre o formato canonico "+5511999999999"
//
// Se a entrada nao for um telefone BR valido, retorna null.

function normalizarTelefone(input) {
  if (!input || typeof input !== 'string') return null;

  // Tira tudo que nao for digito
  let digitos = input.replace(/\D/g, '');
  if (!digitos) return null;

  // Se ja vem com 55 no inicio e tem comprimento valido (12-13), assume +55
  if (digitos.length === 13 && digitos.startsWith('55')) {
    return '+' + digitos;
  }
  if (digitos.length === 12 && digitos.startsWith('55')) {
    return '+' + digitos;
  }

  // Numero BR sem prefixo 55:
  //   - 11 digitos = celular (DDD + 9 + 8 digitos)
  //   - 10 digitos = fixo (DDD + 8 digitos)
  if (digitos.length === 11 || digitos.length === 10) {
    return '+55' + digitos;
  }

  // Nao reconhece — retorna null em vez de gerar lixo
  return null;
}

// Gera variantes possiveis pra busca em banco (porque banco pode ter formato antigo)
// Util pra migrar dados ou comparar com Usuario.celular que pode ter sido salvo
// em formato diferente antes da padronizacao.
function variantesTelefone(input) {
  const canonico = normalizarTelefone(input);
  if (!canonico) return [];

  // Remove o +55 pra gerar a versao "11999999999"
  const semPais = canonico.startsWith('+55') ? canonico.slice(3) : canonico.replace(/^\+/, '');

  // Variantes mais comuns no banco:
  return Array.from(new Set([
    canonico,           // "+5511999999999"
    canonico.replace(/^\+/, ''), // "5511999999999"
    semPais,            // "11999999999"
    `+${canonico.slice(1).replace(/^55/, '55 ')}`, // tolerancia
  ].filter(Boolean)));
}

module.exports = { normalizarTelefone, variantesTelefone };
