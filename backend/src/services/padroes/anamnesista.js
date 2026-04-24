// ═══════════════════════════════════════════════════════════════════
// AGENTE ANAMNESISTA
// Extrai 14 campos estruturados da transcricao + respostas do paciente.
// Usa Claude com template JSON strict. Valida schema antes de sair.
// ═══════════════════════════════════════════════════════════════════

const Anthropic = require('@anthropic-ai/sdk');

const ANAMNESE_SCHEMA = [
  'queixa_principal',        // string
  'duracao_dias',            // number|null
  'duracao_horas',           // number|null
  'intensidade',             // number 0-10
  'localizacao',             // string|null
  'qualidade_dor',           // string|null  (pulsátil/opressiva/queimação...)
  'inicio_dor',              // string|null  (súbito/gradual)
  'fatores_piora',           // string[]
  'fatores_melhora',         // string[]
  'sintomas_associados',     // string[]
  'padrao_temporal',         // string|null  (diurno/noturno/salvas)
  'medicamentos_mencionados',// string[]
  'alergias_mencionadas',    // string[]
  'condicoes_mencionadas',   // string[]
  'historico_familiar',      // string[]
  'habitos',                 // string[]
  'outras_queixas',          // string[]
];

// Pseudonimiza: remove qualquer marcador identificável
function pseudonimizar(texto) {
  if (!texto) return '';
  // Remove padroes obvios: CPF, telefone, email
  return String(texto)
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF_REMOVIDO]')
    .replace(/\b\d{2}\s?\d{4,5}-?\d{4}\b/g, '[TEL_REMOVIDO]')
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[EMAIL_REMOVIDO]');
}

async function extrair({ transcricao, respostas, idade, sexo }) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const transcricaoClean = pseudonimizar(transcricao || '');
  const respostasStr = respostas ? JSON.stringify(respostas).slice(0, 2000) : '';

  const prompt = [
    'Voce e um assistente de anamnese. Extrai fatos clinicos estruturados do relato do paciente.',
    'NAO interpreta. NAO diagnostica. NAO sugere condicoes. Apenas extrai o que o paciente disse.',
    'Se um campo nao tem informacao, retorna null (ou array vazio).',
    'NUNCA inventa informacao.',
    '',
    'Contexto:',
    `Paciente: ${idade || '?'} anos, ${sexo || '?'}`,
    '',
    'Transcricao do audio do paciente:',
    transcricaoClean,
    '',
    respostasStr ? `Respostas do formulario:\n${respostasStr}\n` : '',
    'Retorne APENAS um JSON valido (sem markdown) com o seguinte schema:',
    JSON.stringify({
      queixa_principal: 'string',
      duracao_dias: 'number|null',
      duracao_horas: 'number|null',
      intensidade: 'number (0-10) ou null',
      localizacao: 'string|null',
      qualidade_dor: 'string|null',
      inicio_dor: 'string|null',
      fatores_piora: '[string]',
      fatores_melhora: '[string]',
      sintomas_associados: '[string]',
      padrao_temporal: 'string|null',
      medicamentos_mencionados: '[string]',
      alergias_mencionadas: '[string]',
      condicoes_mencionadas: '[string]',
      historico_familiar: '[string]',
      habitos: '[string]',
      outras_queixas: '[string]',
    }, null, 2),
  ].join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content?.[0]?.text || '{}';
  // Extrai JSON mesmo se Claude devolver markdown
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Anamnesista: resposta sem JSON');
  }

  let anamnese;
  try {
    anamnese = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error('Anamnesista: JSON invalido');
  }

  // Sanitiza: so mantem campos do schema
  const out = {};
  for (const campo of ANAMNESE_SCHEMA) {
    out[campo] = campo in anamnese ? anamnese[campo] : null;
    if (Array.isArray(out[campo])) {
      out[campo] = out[campo].map(x => String(x).toLowerCase().trim()).filter(Boolean);
    } else if (typeof out[campo] === 'string') {
      out[campo] = out[campo].toLowerCase().trim();
    }
  }

  // Garante arrays
  ['fatores_piora', 'fatores_melhora', 'sintomas_associados', 'medicamentos_mencionados',
   'alergias_mencionadas', 'condicoes_mencionadas', 'historico_familiar', 'habitos', 'outras_queixas']
    .forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });

  return out;
}

module.exports = { extrair, ANAMNESE_SCHEMA };
