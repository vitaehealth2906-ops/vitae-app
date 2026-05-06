/**
 * VITAE — IA Collab (Fase 9)
 *
 * Cruza anamneses do MESMO PACIENTE entre múltiplas pré-consultas para
 * detectar evolução clínica, mudança de queixa, intensificação de sintomas,
 * vocabulário emocional. Usa Claude Haiku.
 *
 * NUNCA gera diagnóstico — só correlações observacionais que o médico confirma.
 * Disclaimer CFM 2.314/2022 obrigatório no front.
 */
const Anthropic = require('@anthropic-ai/sdk');

const claude = process.env.CLAUDE_API_KEY ? new Anthropic({ apiKey: process.env.CLAUDE_API_KEY }) : null;

const SYSTEM_PROMPT = `Você é um médico clínico experiente analisando a EVOLUÇÃO CLÍNICA de um mesmo paciente entre pré-consultas distintas.

REGRAS:
1. Compare anamneses estruturadas, queixas principais e sintomas associados.
2. Identifique padrões: queixa recorrente, mudança de intensidade, novos sintomas, melhora ou piora reportada.
3. NÃO faça diagnóstico. Use linguagem de observação clínica ("paciente relatou", "intensidade descrita aumentou", "mantém queixa de", "novo sintoma associado").
4. Linguagem PT-BR institucional, frases curtas, máximo 5 parágrafos.
5. Se as anamneses forem muito distintas (queixas sem relação), diga "queixas distintas, sem padrão evolutivo claro".
6. Termine sempre com: "Confirme clinicamente — esta é uma observação correlativa, não diagnóstico."

FORMATO DE SAÍDA (JSON puro, sem markdown):
{
  "narrativa": "texto livre 3-5 parágrafos curtos",
  "padroes_observados": ["padrão 1", "padrão 2", ...],
  "evolucao_temporal": "melhora | piora | estável | sem padrão",
  "alertas": ["alerta 1", ...] (só se houver vermelho clínico — vazio se não)
}`;

/**
 * @param {Array} preConsultas — array de PreConsulta com summaryJson populado, ordenadas mais antiga → mais recente
 * @returns {Promise<{narrativa, padroes_observados, evolucao_temporal, alertas}>}
 */
async function compararAnamneses(preConsultas) {
  if (!claude) {
    return {
      narrativa: 'IA indisponível no momento. Tente novamente em alguns segundos.',
      padroes_observados: [],
      evolucao_temporal: 'sem padrão',
      alertas: [],
    };
  }
  if (!Array.isArray(preConsultas) || preConsultas.length < 2) {
    throw new Error('Mínimo 2 pré-consultas para comparar.');
  }

  // Pseudonimização: remove nome/telefone/email antes de enviar pro LLM
  const anonimas = preConsultas.map((pc, i) => {
    const sj = pc.summaryJson || {};
    return {
      indice: i + 1,
      data: pc.respondidaEm || pc.criadoEm,
      queixaPrincipal: sj.queixaPrincipal || sj.descricaoBreve || '(não informado)',
      anamneseEstruturada: sj.anamneseEstruturada || null,
      summaryTexto: sj.summaryTexto || null,
    };
  });

  const userMsg = `Anamneses do paciente em ordem cronológica (mais antiga → mais recente):\n\n${JSON.stringify(anonimas, null, 2)}\n\nGere a análise comparativa.`;

  try {
    const resp = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMsg }],
    });

    const txt = (resp.content?.[0]?.text || '').trim();
    // Extrai JSON do response (modelo pode envelopar em ```json blocks)
    const match = txt.match(/\{[\s\S]*\}/);
    if (!match) {
      return {
        narrativa: txt.slice(0, 2000),
        padroes_observados: [],
        evolucao_temporal: 'sem padrão',
        alertas: [],
      };
    }
    const parsed = JSON.parse(match[0]);
    return {
      narrativa: parsed.narrativa || '',
      padroes_observados: parsed.padroes_observados || [],
      evolucao_temporal: parsed.evolucao_temporal || 'sem padrão',
      alertas: parsed.alertas || [],
    };
  } catch (err) {
    console.error('[iaCollab] erro:', err.message);
    return {
      narrativa: 'Não foi possível gerar a análise comparativa agora. Tente novamente em alguns segundos.',
      padroes_observados: [],
      evolucao_temporal: 'sem padrão',
      alertas: [],
      erro: err.message,
    };
  }
}

module.exports = { compararAnamneses };
