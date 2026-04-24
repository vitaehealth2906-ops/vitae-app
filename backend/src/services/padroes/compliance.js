// ═══════════════════════════════════════════════════════════════════
// AGENTE COMPLIANCE
// Ultima linha de defesa. Valida cada card gerado:
//   - Fonte presente?
//   - Disclaimer presente?
//   - Linguagem nao-diagnostica?
//   - Score minimo?
//   - Sinais bateram minimos?
// Rejeita cards que falham. Gera trilha de auditoria imutavel.
// ═══════════════════════════════════════════════════════════════════

const SCORE_MINIMO = 60;
const SINAIS_MIN = 3;

// Regex que detecta linguagem diagnostica proibida
const LINGUAGEM_PROIBIDA = [
  /\bpaciente tem\b/i,
  /\bdiagn[oó]stico de\b/i,
  /\b[ée] uma? \w+\b(?!.*considerar)/i,
  /\bsofre de\b/i,
  /\bconfirm[ao] (?:o )?(?:diagn[oó]stico|doen[çc]a)\b/i,
];

function gerarAuditId(prefix) {
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AUD-${ts}-${prefix}${rand}`;
}

function textoContemLinguagemDiagnostica(texto) {
  if (!texto) return false;
  return LINGUAGEM_PROIBIDA.some(rx => rx.test(texto));
}

function validarCard(card) {
  const problemas = [];

  // 1. Fonte obrigatoria
  if (!card.fonte || !card.fonte.titulo) {
    problemas.push('fonte_ausente');
  }

  // 2. Score minimo (apenas para diferenciais normais — red flags sao isentos)
  if (card.tipo !== 'red_flag_consolidado' && card.tipo !== 'alergia_medicamento' && card.tipo !== 'auto_medicacao') {
    if (typeof card.score === 'number' && card.score < SCORE_MINIMO) {
      problemas.push(`score_abaixo_minimo:${card.score}`);
    }
    // 3. Sinais minimos
    if (Array.isArray(card.sinais_bateram) && card.sinais_bateram.length < SINAIS_MIN) {
      problemas.push(`sinais_insuficientes:${card.sinais_bateram.length}`);
    }
  }

  // 4. Versao base
  if (!card.base_version) {
    problemas.push('base_version_ausente');
  }

  // 5. Linguagem diagnostica em textos livres
  const textosAVerificar = [card.proximo_passo, card.mensagem, card.acao_sugerida];
  for (const t of textosAVerificar) {
    if (textoContemLinguagemDiagnostica(t)) {
      problemas.push('linguagem_diagnostica_detectada');
      break;
    }
  }

  return { aprovado: problemas.length === 0, problemas };
}

function aplicarDisclaimer(card) {
  const disclaimerPadrao = 'Sugestao de apoio a decisao baseada em literatura clinica. Nao constitui diagnostico. Ato medico privativo (CFM Resolucao 2.299/2021).';
  if (!card.disclaimer) card.disclaimer = disclaimerPadrao;
  return card;
}

function processar(cards) {
  const aprovados = [];
  const rejeitados = [];

  for (const card of cards) {
    // Sempre adiciona id de auditoria se ausente
    if (!card.id) card.id = gerarAuditId('C');

    const { aprovado, problemas } = validarCard(card);
    if (aprovado) {
      aprovados.push(aplicarDisclaimer(card));
    } else {
      rejeitados.push({ id: card.id, problemas, card_preview: { nome: card.nome || card.tipo, score: card.score } });
    }
  }

  return { aprovados, rejeitados };
}

module.exports = { processar, validarCard, gerarAuditId };
