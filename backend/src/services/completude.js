// ============================================
// COMPLETUDE DA PRÉ-CONSULTA
// ============================================
// Calcula % (0-100) de completude da anamnese estruturada (Sessão 13).
// Usado pelas métricas honestas do dashboard médico (Sessão 22).
//
// Os 11 campos da anamnese estruturada:
//   1. queixaPrincipal
//   2. tempoEvolucao
//   3. intensidade
//   4. fatoresAgravantes
//   5. fatoresAtenuantes
//   6. sintomasAssociados
//   7. tratamentoPrevio
//   8. antecedentesPessoais
//   9. antecedentesFamiliares
//  10. habitos
//  11. sono
//
// Um campo conta como "preenchido" se tem valor textual significativo:
//   - String com > 3 caracteres alfanuméricos
//   - Não é placeholder ("—", "-", "")
//   - Não é "não sei" / "n/a" / "nao informado" / "pulado"
// ============================================

const CAMPOS_ANAMNESE_11 = [
  'queixaPrincipal',
  'tempoEvolucao',
  'intensidade',
  'fatoresAgravantes',
  'fatoresAtenuantes',
  'sintomasAssociados',
  'tratamentoPrevio',
  'antecedentesPessoais',
  'antecedentesFamiliares',
  'habitos',
  'sono',
];

const VALORES_VAZIOS = new Set([
  '', '—', '-', '–', 'n/a', 'na', 'nao sei', 'não sei',
  'nao informado', 'não informado', 'pulado', 'desconhecer',
  'desconheço', 'sem informacao', 'sem informação',
]);

/**
 * Verifica se um valor textual conta como "preenchido"
 */
function ehPreenchido(valor) {
  if (valor == null) return false;
  const texto = String(valor).trim().toLowerCase();
  if (texto.length < 3) return false;
  if (VALORES_VAZIOS.has(texto)) return false;
  // Pelo menos 3 caracteres alfanuméricos (filtra "...", "???", etc)
  const alfa = texto.replace(/[^a-z0-9áéíóúâêôãõç]/gi, '');
  return alfa.length >= 3;
}

/**
 * Extrai valor de um campo da anamnese, lidando com 3 estruturas possíveis:
 *   1. Estrutura nova (Sessão 13): { valor: "...", fonte: "audio" }
 *   2. Estrutura compacta: { v: "...", fonte: "..." }
 *   3. Texto direto: "..."
 */
function extrairValor(campo) {
  if (campo == null) return null;
  if (typeof campo === 'string') return campo;
  if (typeof campo === 'object') {
    if ('valor' in campo) return campo.valor;
    if ('v' in campo) return campo.v;
  }
  return null;
}

/**
 * Calcula % de completude (0-100) de uma pré-consulta.
 *
 * Tenta 3 fontes de dados em ordem de prioridade:
 *   1. summaryJson.anamneseEstruturada (estrutura nova, Sessão 13)
 *   2. respostas com chaves nomeadas (queixaPrincipal, etc — fallback)
 *   3. respostas como array de respostas livres (legado — conta como 0)
 *
 * @param {object} preConsulta - registro da tabela pre_consultas
 * @returns {number} 0-100 (inteiro)
 */
function calcularCompletude(preConsulta) {
  if (!preConsulta) return 0;

  // Status PENDENTE/ABERTA = 0% (paciente nem respondeu)
  if (preConsulta.status === 'PENDENTE' || preConsulta.status === 'ABERTO' ||
      preConsulta.status === 'EXPIRADA') {
    return 0;
  }

  // 1. Tenta summaryJson.anamneseEstruturada
  const sj = preConsulta.summaryJson || {};
  const anam = sj.anamneseEstruturada || sj.anamnese_estruturada;

  if (anam && typeof anam === 'object') {
    let preenchidos = 0;
    for (const campo of CAMPOS_ANAMNESE_11) {
      const valor = extrairValor(anam[campo]);
      if (ehPreenchido(valor)) preenchidos++;
    }
    return Math.round((preenchidos / 11) * 100);
  }

  // 2. Fallback: respostas com chaves nomeadas
  const respostas = preConsulta.respostas || {};
  if (respostas && typeof respostas === 'object' && !Array.isArray(respostas)) {
    let preenchidos = 0;
    for (const campo of CAMPOS_ANAMNESE_11) {
      const valor = extrairValor(respostas[campo]);
      if (ehPreenchido(valor)) preenchidos++;
    }
    if (preenchidos > 0) {
      return Math.round((preenchidos / 11) * 100);
    }
  }

  // 3. Legado: array de respostas livres ou estrutura desconhecida
  // Aproximação: se tem respostas E status RESPONDIDA, conta como 50%
  // (sinaliza que paciente respondeu mas não temos como medir granularmente)
  if (preConsulta.status === 'RESPONDIDA' && respostas) {
    const tamanho = Array.isArray(respostas)
      ? respostas.length
      : Object.keys(respostas).length;
    if (tamanho >= 5) return 50;
    if (tamanho >= 1) return 25;
  }

  return 0;
}

module.exports = {
  calcularCompletude,
  CAMPOS_ANAMNESE_11,
};
