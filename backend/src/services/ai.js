const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT_ESTRUTURAR = `Você é um assistente médico da plataforma VITAE especializado em interpretação de exames laboratoriais brasileiros.

MISSÃO: Analisar o texto extraído de um exame laboratorial e estruturar TODOS os dados com precisão.

PADRÕES DE REFERÊNCIA:
- Use SEMPRE os valores de referência impressos no próprio laudo como fonte primária.
- Quando o laudo NÃO especificar referências, use os padrões brasileiros da SBPC/ML (Sociedade Brasileira de Patologia Clínica/Medicina Laboratorial).
- Ajuste as referências considerando sexo, idade e condições específicas do paciente quando disponíveis no perfil.
- Exemplos de padrões SBPC/ML: Hemoglobina homem 13,5-17,5 g/dL, mulher 12-16 g/dL; Glicose em jejum 70-99 mg/dL; TSH 0,4-4,0 mUI/L; Vitamina D 30-100 ng/mL.

CLASSIFICAÇÕES:
- NORMAL: dentro da faixa de referência
- ATENCAO: até 20% acima ou abaixo da referência, ou limítrofe
- CRITICO: mais de 20% fora da referência, ou considerado clinicamente significativo

IMPORTANTE: Você NÃO é médico. Sempre sugira consultar um profissional de saúde. Linguagem simples e acolhedora.`;


/**
 * Monta o contexto do perfil do usuário para inclusão nos prompts.
 */
function montarContextoPerfil(perfilUsuario) {
  if (!perfilUsuario) return '';

  const campos = [];

  if (perfilUsuario.dataNascimento) {
    const idade = Math.floor(
      (Date.now() - new Date(perfilUsuario.dataNascimento).getTime()) /
        (365.25 * 24 * 60 * 60 * 1000)
    );
    campos.push(`Idade: ${idade} anos`);
  }

  if (perfilUsuario.sexo) campos.push(`Sexo: ${perfilUsuario.sexo}`);
  if (perfilUsuario.peso) campos.push(`Peso: ${perfilUsuario.peso} kg`);
  if (perfilUsuario.altura) campos.push(`Altura: ${perfilUsuario.altura} cm`);

  if (perfilUsuario.medicamentos && perfilUsuario.medicamentos.length > 0) {
    campos.push(`Medicamentos em uso: ${perfilUsuario.medicamentos.join(', ')}`);
  }

  if (perfilUsuario.alergias && perfilUsuario.alergias.length > 0) {
    campos.push(`Alergias: ${perfilUsuario.alergias.join(', ')}`);
  }

  if (perfilUsuario.historicoFamiliar && perfilUsuario.historicoFamiliar.length > 0) {
    campos.push(`Histórico familiar: ${perfilUsuario.historicoFamiliar.join(', ')}`);
  }

  return campos.length > 0
    ? `\n\nPerfil do paciente:\n${campos.join('\n')}`
    : '';
}

/**
 * Envia o texto extraído de um exame laboratorial para o Claude e retorna
 * os dados estruturados em JSON.
 *
 * @param {string} textoExtraido - Texto bruto extraído do exame (via OCR ou PDF).
 * @param {object} perfilUsuario - Perfil do usuário (idade, sexo, peso, etc.).
 * @returns {object} Dados estruturados do exame.
 */
async function estruturarExame(textoExtraido, perfilUsuario) {
  if (!textoExtraido || textoExtraido.trim().length === 0) {
    throw new Error('Texto do exame está vazio. Não foi possível processar.');
  }

  const contextoPerfil = montarContextoPerfil(perfilUsuario);

  const userPrompt = `Analise o seguinte texto extraído de um exame laboratorial e retorne um JSON estruturado.${contextoPerfil}

Texto do exame:
---
${textoExtraido}
---

Retorne EXCLUSIVAMENTE um JSON válido (sem markdown, sem blocos de código) com a seguinte estrutura:
{
  "tipo_exame": "string (ex: 'hemograma', 'bioquimica', 'hormonal', 'urina')",
  "nome_exame": "string (nome completo do exame)",
  "data_exame": "string (data no formato YYYY-MM-DD, ou null se não encontrada)",
  "laboratorio": "string (nome do laboratório, ou null se não encontrado)",
  "status_geral": "string ('NORMAL', 'ATENCAO' ou 'CRITICO')",
  "parametros": [
    {
      "nome": "string",
      "valor": "number ou string",
      "unidade": "string",
      "referencia_min": "number ou null",
      "referencia_max": "number ou null",
      "referencia_texto": "string (faixa como aparece no exame)",
      "classificacao": "string ('NORMAL', 'ATENCAO' ou 'CRITICO')"
    }
  ],
  "resumo": "string (resumo em linguagem simples para o paciente, 2-4 frases)",
  "impactos": [
    {
      "icone": "string (emoji relevante)",
      "titulo": "string",
      "texto": "string (como este resultado afeta o dia a dia)"
    }
  ],
  "melhorias": [
    {
      "categoria": "string (ex: 'alimentacao', 'exercicio', 'sono', 'suplementacao')",
      "icone": "string (emoji relevante)",
      "titulo": "string",
      "texto": "string (sugestão prática e acionável)"
    }
  ]
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT_ESTRUTURAR,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const conteudo = response.content[0].text.trim();

  try {
    return JSON.parse(conteudo);
  } catch (parseError) {
    // Tenta extrair JSON de possíveis blocos de código markdown
    const jsonMatch = conteudo.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    throw new Error(
      `Falha ao interpretar a resposta da IA. Resposta recebida não é um JSON válido.`
    );
  }
}

/**
 * Gera uma análise personalizada dos dados estruturados do exame, comparando
 * com o histórico quando disponível.
 *
 * @param {object} dadosEstruturados - Dados do exame já estruturados.
 * @param {object} perfilUsuario - Perfil do usuário.
 * @param {object[]} historicoExames - Array de exames anteriores estruturados.
 * @returns {object} Análise personalizada com resumo, impactos e melhorias.
 */
async function gerarAnaliseExame(dadosEstruturados, perfilUsuario, historicoExames) {
  if (!dadosEstruturados || !dadosEstruturados.parametros) {
    throw new Error('Dados estruturados do exame são obrigatórios para gerar a análise.');
  }

  const contextoPerfil = montarContextoPerfil(perfilUsuario);

  let contextoHistorico = '';
  if (historicoExames && historicoExames.length > 0) {
    const examesAnteriores = historicoExames
      .slice(0, 5) // Limita aos 5 mais recentes para não exceder o contexto
      .map((exame, i) => {
        const params = (exame.parametros || [])
          .map((p) => `  - ${p.nome}: ${p.valor} ${p.unidade} (${p.classificacao})`)
          .join('\n');
        return `Exame ${i + 1} (${exame.data_exame || 'data desconhecida'} - ${exame.nome_exame || exame.tipo_exame}):\n${params}`;
      })
      .join('\n\n');

    contextoHistorico = `\n\nHistórico de exames anteriores (do mais recente ao mais antigo):\n${examesAnteriores}`;
  }

  const parametrosAtuais = dadosEstruturados.parametros
    .map((p) => `- ${p.nome}: ${p.valor} ${p.unidade} [${p.classificacao}] (ref: ${p.referencia_texto || 'N/A'})`)
    .join('\n');

  const userPrompt = `Com base nos dados do exame abaixo, gere uma análise personalizada para o paciente.${contextoPerfil}${contextoHistorico}

Exame atual (${dadosEstruturados.nome_exame || dadosEstruturados.tipo_exame}, ${dadosEstruturados.data_exame || 'data não informada'}):
${parametrosAtuais}

Retorne EXCLUSIVAMENTE um JSON válido com a seguinte estrutura:
{
  "resumo": "string (2-3 frases em linguagem simples e acolhedora. Se houver histórico, compare: 'Sua hemoglobina melhorou de X para Y'. Sempre termine sugerindo consultar um profissional.)",
  "impactos": [
    {
      "icone": "string (emoji)",
      "titulo": "string (máx 40 caracteres)",
      "texto": "string (como isso afeta o dia a dia do paciente, 1-2 frases)"
    }
  ],
  "melhorias": [
    {
      "categoria": "string",
      "icone": "string (emoji)",
      "titulo": "string (máx 40 caracteres)",
      "texto": "string (sugestão prática, específica e acionável, 1-2 frases)",
      "prioridade": "string ('alta', 'media', 'baixa')"
    }
  ]
}

Regras:
- Gere exatamente 3 impactos (cards sobre como o resultado impacta o dia a dia).
- Gere de 3 a 5 melhorias (sugestões acionáveis e práticas).
- Se houver histórico, COMPARE os valores e mencione evolução.
- Linguagem simples, acolhedora e sem termos técnicos complexos.
- NUNCA faça diagnósticos. Sempre sugira consultar um profissional de saúde.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT_ESTRUTURAR,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const conteudo = response.content[0].text.trim();

  try {
    return JSON.parse(conteudo);
  } catch (parseError) {
    const jsonMatch = conteudo.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    throw new Error('Falha ao interpretar a análise gerada pela IA.');
  }
}

/**
 * Calcula a idade biológica estimada do usuário usando o modelo mais capaz,
 * baseado na metodologia PhenoAge/GrimAge.
 *
 * @param {object} perfilUsuario - Perfil completo do usuário.
 * @param {object[]} exames - Exames recentes estruturados.
 * @param {object[]} checkins - Check-ins diários recentes.
 * @param {object[]} medicamentos - Medicamentos em uso.
 * @returns {object} { idadeBiologica, confianca, fatores }
 */
async function calcularIdadeBiologica(perfilUsuario, exames, checkins, medicamentos) {
  if (!perfilUsuario || !perfilUsuario.dataNascimento) {
    throw new Error('Perfil do usuário com data de nascimento é obrigatório.');
  }

  const idadeCronologica = Math.floor(
    (Date.now() - new Date(perfilUsuario.dataNascimento).getTime()) /
      (365.25 * 24 * 60 * 60 * 1000)
  );

  const dadosExames = (exames || []).map((exame) => ({
    tipo: exame.tipo_exame || exame.nome_exame,
    data: exame.data_exame,
    parametros: (exame.parametros || []).map((p) => ({
      nome: p.nome,
      valor: p.valor,
      unidade: p.unidade,
      classificacao: p.classificacao,
    })),
  }));

  const dadosCheckins = (checkins || []).slice(0, 30).map((c) => ({
    data: c.data || c.createdAt,
    sonoQualidade: c.sonoQualidade,
    horasSono: c.horasSono,
    humor: c.humor,
    energia: c.energia,
    estresse: c.estresse,
    atividadeFisica: c.atividadeFisica,
    produtividade: c.produtividade,
  }));

  const userPrompt = `Estime a idade biológica deste paciente usando princípios das metodologias PhenoAge e GrimAge.

Dados do paciente:
- Idade cronológica: ${idadeCronologica} anos
- Sexo: ${perfilUsuario.sexo || 'não informado'}
- Peso: ${perfilUsuario.peso || 'não informado'} kg
- Altura: ${perfilUsuario.altura || 'não informado'} cm
- IMC: ${perfilUsuario.peso && perfilUsuario.altura ? (perfilUsuario.peso / ((perfilUsuario.altura / 100) ** 2)).toFixed(1) : 'não calculado'}
- Nível de atividade: ${perfilUsuario.nivelAtividade || 'não informado'}
- Horas de sono: ${perfilUsuario.horasSono || 'não informado'}
- Fumante: ${perfilUsuario.fumante ? 'Sim' : 'Não'}
- Consumo de álcool: ${perfilUsuario.consumoAlcool || 'não informado'}
- Histórico familiar: ${(perfilUsuario.historicoFamiliar || []).join(', ') || 'não informado'}

Medicamentos em uso: ${(medicamentos || []).map((m) => m.nome || m).join(', ') || 'nenhum informado'}

Exames laboratoriais recentes:
${JSON.stringify(dadosExames, null, 2)}

Check-ins diários recentes (últimos 30 dias):
${JSON.stringify(dadosCheckins, null, 2)}

Retorne EXCLUSIVAMENTE um JSON válido:
{
  "idadeBiologica": number (idade estimada em anos, com 1 casa decimal),
  "confianca": "string ('baixa', 'media' ou 'alta' - baseado na quantidade e qualidade dos dados disponíveis)",
  "fatores": [
    {
      "nome": "string (nome do fator analisado)",
      "impacto": "string ('positivo', 'neutro' ou 'negativo')",
      "contribuicao": "string (em anos: ex: '+2.1 anos', '-1.5 anos', '0 anos')",
      "explicacao": "string (explicação simples de por que este fator impacta a idade biológica)"
    }
  ]
}

Regras:
- A idade biológica deve ser realista (normalmente entre -10 e +10 anos da cronológica).
- Se poucos dados estiverem disponíveis, use confianca='baixa' e seja conservador.
- Liste de 5 a 10 fatores principais.
- Linguagem simples e acessível.
- NÃO faça diagnósticos. Isso é uma estimativa educacional.`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-20250514',
    max_tokens: 4096,
    system:
      'Você é um especialista em longevidade e envelhecimento biológico da plataforma VITAE. ' +
      'Sua função é estimar a idade biológica com base em dados laboratoriais, hábitos e biomarcadores. ' +
      'Use princípios das metodologias PhenoAge e GrimAge. Seja conservador nas estimativas. ' +
      'IMPORTANTE: Isso é uma estimativa educacional, não um diagnóstico médico.',
    messages: [{ role: 'user', content: userPrompt }],
  });

  const conteudo = response.content[0].text.trim();

  try {
    return JSON.parse(conteudo);
  } catch (parseError) {
    const jsonMatch = conteudo.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    throw new Error('Falha ao calcular a idade biológica. Tente novamente.');
  }
}

/**
 * Gera recomendações personalizadas de melhoria considerando todo o contexto
 * do usuário (alergias, medicamentos em uso, etc.).
 *
 * @param {object} perfilUsuario - Perfil do usuário.
 * @param {object[]} exames - Exames recentes.
 * @param {object[]} medicamentos - Medicamentos em uso.
 * @param {string[]} alergias - Lista de alergias.
 * @param {object[]} checkins - Check-ins recentes.
 * @param {object} scores - Scores de saúde calculados.
 * @returns {object[]} Array de recomendações.
 */
async function gerarMelhorias(perfilUsuario, exames, medicamentos, alergias, checkins, scores) {
  const contextoPerfil = montarContextoPerfil(perfilUsuario);

  const listaAlergias = (alergias || perfilUsuario?.alergias || []).join(', ');
  const listaMedicamentos = (medicamentos || [])
    .map((m) => (typeof m === 'string' ? m : m.nome || m.medicamento))
    .join(', ');

  const dadosExames = (exames || []).slice(0, 5).map((exame) => ({
    tipo: exame.tipo_exame || exame.nome_exame,
    data: exame.data_exame,
    status: exame.status_geral,
    parametrosAlterados: (exame.parametros || [])
      .filter((p) => p.classificacao !== 'NORMAL')
      .map((p) => `${p.nome}: ${p.valor} ${p.unidade} (${p.classificacao})`),
  }));

  const dadosCheckins = (checkins || []).slice(0, 14).map((c) => ({
    data: c.data || c.createdAt,
    sonoQualidade: c.sonoQualidade,
    humor: c.humor,
    energia: c.energia,
    estresse: c.estresse,
    atividadeFisica: c.atividadeFisica,
  }));

  const userPrompt = `Gere recomendações personalizadas de melhoria de saúde para este paciente.${contextoPerfil}

RESTRIÇÕES IMPORTANTES:
- Alergias do paciente (NÃO sugira nada que contenha ou possa causar reação): ${listaAlergias || 'nenhuma informada'}
- Medicamentos já em uso (NÃO sugira o que já está tomando): ${listaMedicamentos || 'nenhum informado'}

Scores de saúde atuais:
${JSON.stringify(scores || {}, null, 2)}

Exames recentes (foco nos alterados):
${JSON.stringify(dadosExames, null, 2)}

Check-ins recentes:
${JSON.stringify(dadosCheckins, null, 2)}

Retorne EXCLUSIVAMENTE um JSON válido - um array de objetos:
[
  {
    "categoria": "string (ex: 'alimentacao', 'exercicio', 'sono', 'suplementacao', 'saude_mental', 'hidratacao', 'checkup')",
    "icone": "string (emoji relevante)",
    "titulo": "string (máx 50 caracteres, direto e motivacional)",
    "texto": "string (recomendação prática e específica, 2-3 frases. Personalize com base nos dados do paciente.)",
    "anosGanhos": "number (estimativa conservadora de anos de vida saudável que essa melhoria pode agregar, ex: 0.5, 1.2, 2.0)"
  }
]

Regras:
- Gere de 5 a 8 recomendações, ordenadas por impacto (anosGanhos).
- NUNCA sugira alimentos/substâncias que o paciente tem alergia.
- NUNCA sugira medicamentos ou suplementos que o paciente já usa.
- Foque nas áreas com pior score ou parâmetros alterados.
- Seja específico (não diga "coma melhor", diga "inclua 2 porções de vegetais verde-escuros por dia").
- anosGanhos deve ser conservador e baseado em evidências gerais.
- NUNCA faça diagnósticos. Sempre reforce a importância de consultar um profissional.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system:
      'Você é um especialista em saúde preventiva e longevidade da plataforma VITAE. ' +
      'Gere recomendações personalizadas, práticas e baseadas em evidências. ' +
      'Respeite TODAS as restrições alimentares e medicamentosas do paciente. ' +
      'IMPORTANTE: Você NÃO é médico. Sempre sugira consultar um profissional de saúde.',
    messages: [{ role: 'user', content: userPrompt }],
  });

  const conteudo = response.content[0].text.trim();

  try {
    return JSON.parse(conteudo);
  } catch (parseError) {
    const jsonMatch = conteudo.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    throw new Error('Falha ao gerar recomendações de melhoria. Tente novamente.');
  }
}

/**
 * Gera informacoes detalhadas sobre um medicamento ou alergia usando IA.
 *
 * @param {string} nome - Nome do medicamento ou alergia.
 * @param {string} tipo - 'medicamento' ou 'alergia'.
 * @returns {object} Informacoes estruturadas.
 */
async function gerarInfoSubstancia(nome, tipo) {
  if (!nome || nome.trim().length === 0) {
    throw new Error('Nome e obrigatorio.');
  }

  const isMed = tipo === 'medicamento';

  const userPrompt = isMed
    ? `Gere informacoes detalhadas sobre o medicamento/suplemento "${nome}" para um aplicativo de saude.

Retorne EXCLUSIVAMENTE um JSON valido:
{
  "nome": "string (nome correto do medicamento/suplemento)",
  "categoria": "string (ex: 'Suplemento', 'Anti-inflamatorio', 'Analgesico', 'Vitamina', 'Hormonio')",
  "descricao": "string (2-3 frases simples sobre o que e e para que serve)",
  "beneficios": [
    { "icone": "emoji", "titulo": "string (max 30 chars)", "texto": "string (1-2 frases)" }
  ],
  "como_funciona": "string (2-3 frases simples explicando o mecanismo de acao)",
  "efeitos_colaterais": [
    { "nome": "string", "gravidade": "leve|moderado|grave", "frequencia": "comum|incomum|raro" }
  ],
  "interacoes": ["string (medicamentos/substancias que podem interagir)"],
  "dicas": [
    { "icone": "emoji", "titulo": "string", "texto": "string (dica pratica de uso)" }
  ],
  "curiosidade": "string (1 fato interessante sobre o medicamento/suplemento)"
}

Regras:
- Gere 3-4 beneficios, 3-5 efeitos colaterais, 2-4 interacoes, 2-3 dicas.
- Linguagem simples e acessivel.
- NAO faca diagnosticos. Sempre reforce a importancia de consultar um profissional.`
    : `Gere informacoes detalhadas sobre a alergia a "${nome}" para um aplicativo de saude.

Retorne EXCLUSIVAMENTE um JSON valido:
{
  "nome": "string (nome correto da alergia/alergeno)",
  "categoria": "string (ex: 'Medicamento', 'Alimento', 'Ambiental', 'Contato')",
  "descricao": "string (2-3 frases simples sobre o que e essa alergia)",
  "sintomas": [
    { "icone": "emoji", "nome": "string", "gravidade": "leve|moderado|grave" }
  ],
  "o_que_evitar": [
    { "icone": "emoji", "item": "string", "motivo": "string (1 frase)" }
  ],
  "o_que_fazer": [
    { "icone": "emoji", "titulo": "string", "texto": "string (1-2 frases de orientacao)" }
  ],
  "emergencia": {
    "sinais": ["string (sinais de reacao grave/anafilaxia)"],
    "acoes": ["string (o que fazer em caso de emergencia)"]
  },
  "alternativas": ["string (alternativas seguras quando aplicavel)"],
  "curiosidade": "string (1 fato interessante sobre essa alergia)"
}

Regras:
- Gere 4-6 sintomas, 3-5 itens para evitar, 3-4 orientacoes.
- Linguagem simples e acessivel.
- NAO faca diagnosticos. Sempre reforce a importancia de consultar um profissional.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: 'Voce e um assistente de saude da plataforma VITAE. Forneca informacoes educacionais precisas sobre medicamentos e alergias. IMPORTANTE: Voce NAO e medico. Sempre sugira consultar um profissional de saude.',
    messages: [{ role: 'user', content: userPrompt }],
  });

  const conteudo = response.content[0].text.trim();

  try {
    return JSON.parse(conteudo);
  } catch {
    const jsonMatch = conteudo.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    throw new Error('Falha ao gerar informacoes. Tente novamente.');
  }
}

module.exports = {
  estruturarExame,
  gerarAnaliseExame,
  calcularIdadeBiologica,
  gerarMelhorias,
  gerarInfoSubstancia,
};
