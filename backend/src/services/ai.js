const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Gemini (Google AI) — usado pra scan de medicamentos (gratis)
const geminiApiKey = process.env.GEMINI_API_KEY;
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

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
 * Monta o prompt de estruturação do exame (usado tanto pela versão texto quanto pela versão arquivo).
 */
function montarPromptEstruturacao(contextoPerfil) {
  return `Analise este exame laboratorial e retorne EXCLUSIVAMENTE um JSON válido (sem markdown, sem blocos de código) com a seguinte estrutura:${contextoPerfil}

{
  "tipo_exame": "string (ex: 'hemograma', 'bioquimica', 'hormonal', 'urina')",
  "nome_exame": "string (nome completo do exame)",
  "nome_amigavel": "string (nome do exame em linguagem leiga, ex: 'Exame de Sangue Completo', 'Painel do Coração', 'Painel Completo de Saúde')",
  "data_exame": "string (data no formato YYYY-MM-DD, ou null se não encontrada)",
  "laboratorio": "string (nome do laboratório, ou null se não encontrado)",
  "medico_solicitante": "string (nome do médico solicitante ou realizador do exame, como aparece no documento, ou null se não encontrado)",
  "paciente_nome": "string (nome do paciente como aparece no exame, ou null se não encontrado)",
  "status_geral": "string ('NORMAL', 'ATENCAO' ou 'CRITICO')",
  "parametros": [
    {
      "nome": "string",
      "valor": "number ou string",
      "unidade": "string",
      "referencia_min": "number ou null",
      "referencia_max": "number ou null",
      "referencia_texto": "string (faixa como aparece no exame)",
      "classificacao": "string ('NORMAL', 'ATENCAO' ou 'CRITICO')",
      "explicacao_simples": "string (1-2 frases explicando o que este marcador significa para a saúde do paciente, em linguagem que qualquer pessoa entende, sem jargão médico)",
      "impacto_pessoal": "string (como este resultado específico afeta o dia a dia desta pessoa — seja concreto: energia, sono, humor, etc. Só preencha se não for NORMAL)",
      "dicas": ["string (dica prática e acionável para melhorar este marcador — só para valores ATENCAO ou CRITICO, máximo 2 dicas)"]
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
}

function parsearRespostaIA(conteudo) {
  try {
    return JSON.parse(conteudo);
  } catch {
    const jsonMatch = conteudo.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1].trim());
    throw new Error('Falha ao interpretar a resposta da IA. Resposta não é um JSON válido.');
  }
}

/**
 * Analisa um arquivo de exame diretamente — lê e estrutura em UMA ÚNICA chamada à API.
 * Mais rápido que a abordagem OCR + estruturar separadamente.
 *
 * @param {Buffer} arquivoBuffer - Buffer do arquivo (PDF ou imagem).
 * @param {string} mimeType - Tipo MIME do arquivo.
 * @param {object} perfilUsuario - Perfil do usuário.
 * @returns {object} Dados estruturados do exame.
 */
async function estruturarExameDeArquivo(arquivoBuffer, mimeType, perfilUsuario) {
  const base64 = arquivoBuffer.toString('base64');
  const tipo = (mimeType || '').toLowerCase();
  const contextoPerfil = montarContextoPerfil(perfilUsuario);

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
    system: SYSTEM_PROMPT_ESTRUTURAR,
    messages: [{
      role: 'user',
      content: [contentItem, { type: 'text', text: montarPromptEstruturacao(contextoPerfil) }],
    }],
  });

  return parsearRespostaIA(response.content[0].text.trim());
}

/**
 * Envia o texto extraído de um exame laboratorial para o Claude e retorna
 * os dados estruturados em JSON.
 * (Mantido para compatibilidade — prefira estruturarExameDeArquivo quando possível)
 */
async function estruturarExame(textoExtraido, perfilUsuario) {
  if (!textoExtraido || textoExtraido.trim().length === 0) {
    throw new Error('Texto do exame está vazio. Não foi possível processar.');
  }

  const contextoPerfil = montarContextoPerfil(perfilUsuario);
  const userPrompt = `Texto do exame:\n---\n${textoExtraido}\n---\n\n${montarPromptEstruturacao(contextoPerfil)}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT_ESTRUTURAR,
    messages: [{ role: 'user', content: userPrompt }],
  });

  return parsearRespostaIA(response.content[0].text.trim());
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

/**
 * Gera o One Minute Summary da pre-consulta usando IA.
 *
 * @param {string} pacienteNome - Nome do paciente.
 * @param {object} respostas - Respostas do formulario de pre-consulta.
 * @param {string} transcricao - Transcricao do audio (se houver).
 * @returns {object} { summaryTexto, blocos, alertas }
 */
async function gerarSummaryPreConsulta(pacienteNome, respostas, transcricao, templatePerguntas) {
  // Monta contexto estruturado com os novos campos do formulario de 11 secoes
  const r = respostas || {};

  // If template questions exist, build context from template Q&A pairs
  let templateContext = '';
  if (templatePerguntas && Array.isArray(templatePerguntas)) {
    const pairs = templatePerguntas.map(q => {
      const answer = r[q.id];
      if (!answer && answer !== 0 && answer !== false) return null;
      return `${q.texto}: ${answer}`;
    }).filter(Boolean);
    if (pairs.length > 0) {
      templateContext = `\nRespostas do formulário personalizado:\n${pairs.join('\n')}\n`;
    }
  }

  const secoes = [];

  if (r.queixaPrincipal) secoes.push(`QUEIXA PRINCIPAL: ${r.queixaPrincipal}`);
  if (r.duracaoSintomas) secoes.push(`Duração dos sintomas: ${r.duracaoSintomas}`);
  if (r.sintomas) secoes.push(`Sintomas adicionais: ${r.sintomas}`);

  if (r.medicamentosEmUso) secoes.push(`MEDICAMENTOS EM USO: ${r.medicamentosEmUso}`);
  if (r.alergias) secoes.push(`ALERGIAS: ${r.alergias}`);
  if (r.reacoesAdversas) secoes.push(`Reações adversas: ${r.reacoesAdversas}`);

  if (r.doencasAtuais) secoes.push(`DOENÇAS/CONDIÇÕES ATUAIS: ${r.doencasAtuais}`);
  if (r.hospitalizacoes) secoes.push(`Hospitalizações: ${r.hospitalizacoes}`);

  if (r.cirurgias) secoes.push(`CIRURGIAS ANTERIORES: ${r.cirurgias}`);
  if (r.procedimentosCosmeticos) secoes.push(`Procedimentos cosméticos: ${r.procedimentosCosmeticos}`);

  if (r.historicoFamiliar) secoes.push(`HISTÓRICO FAMILIAR: ${r.historicoFamiliar}`);

  // Hábitos
  const habitos = [];
  if (r.tabagismo && r.tabagismo !== 'nao') habitos.push(`tabagismo: ${r.tabagismo}`);
  if (r.alcool && r.alcool !== 'nao') habitos.push(`álcool: ${r.alcool}`);
  if (r.exercicio && r.exercicio !== 'nao') habitos.push(`exercício: ${r.exercicio}`);
  if (r.cafe) habitos.push(`café: ${r.cafe} xíc/dia`);
  if (r.horasSono) habitos.push(`sono: ${r.horasSono}h/noite`);
  if (r.mudancasRecentes) habitos.push(`mudanças recentes: ${r.mudancasRecentes}`);
  if (habitos.length > 0) secoes.push(`HÁBITOS: ${habitos.join('; ')}`);

  if (r.examesRecentes) secoes.push(`EXAMES RECENTES: ${r.examesRecentes}`);

  // Acessibilidade
  if (r.acessibilidade) {
    const accLabels = { cadeirante:'cadeirante', deficienciaVisual:'def. visual', deficienciaAuditiva:'def. auditiva', deficienciaCognitiva:'def. cognitiva', autismo:'autismo', limitacaoPosCircurgia:'limitação pós-cirurgia' };
    const accAtivas = Object.entries(r.acessibilidade).filter(([,v]) => v).map(([k]) => accLabels[k] || k);
    if (accAtivas.length > 0) secoes.push(`ACESSIBILIDADE: ${accAtivas.join(', ')}`);
    if (r.acessibilidade.descricao) secoes.push(`Obs. acessibilidade: ${r.acessibilidade.descricao}`);
  }

  if (r.observacoes) secoes.push(`OBSERVAÇÕES: ${r.observacoes}`);

  const dadosPaciente = secoes.join('\n');

  // Dados de identificacao do paciente
  const identificacao = [];
  if (r.apelido) identificacao.push(`Apelido: ${r.apelido}`);
  if (r.dataNascimento) {
    const idade = Math.floor((Date.now() - new Date(r.dataNascimento)) / (365.25 * 24 * 60 * 60 * 1000));
    identificacao.push(`Idade: ${idade} anos`);
  }
  if (r.sexo) identificacao.push(`Sexo: ${r.sexo}`);
  if (r.estadoCivil) identificacao.push(`Estado civil: ${r.estadoCivil}`);

  const userPrompt = `Voce recebeu dados de pre-consulta do paciente ${pacienteNome}. Interprete clinicamente — conecte pontos que o medico levaria minutos lendo um prontuario para perceber.

${identificacao.length > 0 ? `Identificacao: ${identificacao.join(' | ')}` : ''}

Dados clinicos:
${dadosPaciente}
${templateContext}
${transcricao ? `Transcricao do paciente:\n"${transcricao}"` : ''}

ANALISE MENTAL OBRIGATORIA (nao inclua no output):
1. Cruzar medicamentos × alergias documentadas — USE APENAS NOMES EXATOS que o paciente forneceu. Se um medicamento usa nome comercial (ex: Novalgina) e a alergia usa principio ativo (ex: Dipirona), NAO cruze — melhor deixar pro medico verificar. Alertar errado destroi confianca mais que nao alertar.
2. Cruzar sintomas × medicamentos em uso (ex: prurido + medicamento recente = possivel reacao?)
3. Cruzar historico de doencas × queixa atual (ex: diabetes + lesoes cutaneas = avaliar controle glicemico)
4. Identificar padroes temporais (ex: sintomas ha X dias + evento recente = possivel correlacao)
5. Cruzar habitos × queixa (ex: tabagismo + tosse, alcool + dor abdominal, sono ruim + fadiga)
6. Cruzar historico familiar × queixa (ex: historico familiar de cancer + nodulo)

Retorne EXCLUSIVAMENTE um JSON valido:
{
  "descricaoBreve": "1-2 frases SIMPLES, linguagem leiga",
  "summaryTexto": "3-5 frases clinicas INTERPRETATIVAS que CONECTAM dados entre si",
  "textoVoz": "BRIEFING MEDICO de 150-180 palavras (~1 minuto de narracao)",
  "blocos": [{ "titulo": "string", "conteudo": "string", "prioridade": "alta|media|baixa" }],
  "alertas": [{ "tipo": "URGENTE|ATENCAO|INFO", "titulo": "string", "mensagem": "string" }]
}

═══ REGRAS DO textoVoz (MAIS IMPORTANTE — vira audio de 1 minuto) ═══

ESTRUTURA OBRIGATORIA (4 blocos, nesta ordem):
1. ABERTURA (~15 palavras): Contextualize de forma natural, variando o formato. Ex: "Doutor, antes de entrar — proximo paciente: Joao, 52 anos." ou "Antes de entrar, Doutora: Joao, 52 anos, veio por..." VARIE — nao repita frase identica toda vez.
2. IDENTIFICACAO + QUEIXA (~45 palavras): Quem e, o que sente, ha quanto tempo. Usar "relata", "refere", "informa". NUNCA "tem", "possui", "sofre de".
3. INTERPRETACAO (MAXIMO 80 palavras): Cruzamentos e correlacoes entre dados. Este e o bloco mais valioso. Usar "chama atencao", "destaca-se", "merece avaliacao", "vale considerar". NUNCA "recomendo", "sugiro prescrever". Se nao ha cruzamento real, este bloco pode ter apenas 1-2 frases ou ser omitido — melhor briefing curto e preciso que longo e inventado.
4. SEGURANCA + FECHAMENTO (~30 palavras): Alergias documentadas + conflitos. Depois: uma frase objetiva com o ponto principal de atencao. Ex: "Sugiro atencao no controle glicemico." Pode encerrar sem pleonasmos tipo "Boa consulta" — melhor fechar com a observacao clinica.

LIMITE TOTAL: 150-180 palavras. Com dados escassos, pode ter 100-130 palavras — e preferivel que encher com generalidades.

LINGUAGEM SEGURA (obrigatorio):
- USAR: "relata", "refere", "informa", "ha registro de", "chama atencao", "destaca-se", "merece avaliacao", "vale considerar a relacao entre"
- PROIBIDO: "tem", "possui", "sofre de" (parece diagnostico)
- PROIBIDO: "recomendo", "sugiro prescrever", "considere receitar" (parece prescricao)
- PROIBIDO: "O paciente respondeu que", "No formulario consta", "De acordo com as respostas" (leitura de formulario)
- PROIBIDO: "inteligencia artificial", "algoritmo", "sistema identificou" (mencao a IA)
- PROIBIDO: "possivel", "provavel", "suspeita de" para condicoes NAO mencionadas pelo paciente

ANTI-ALUCINACAO (critico — erro aqui destroi confianca):
- Use EXCLUSIVAMENTE dados presentes nas respostas do paciente
- Se um campo esta vazio, NAO mencione. NUNCA diga "nao informou" ou "sem registro de"
- NAO invente dosagem, frequencia ou qualquer detalhe ausente nos dados
- Se nao ha cruzamento real entre dados, NAO force. Melhor briefing curto e preciso que longo e inventado
- NUNCA atribua sintomas, condicoes ou habitos que o paciente nao relatou
- Se o dado existe mas e vago (ex: paciente escreveu "tomo um remedinho pra pressao" sem nome), cite-o EXATAMENTE como o paciente descreveu — NUNCA complete com nome, dosagem, ou classe farmacologica que o paciente nao mencionou
- NUNCA use "possivel", "provavel", "suspeita de" em qualquer contexto clinico — use "ha registro de", "relata", "refere" mesmo para condicoes mencionadas pelo paciente

═══ REGRAS DOS OUTROS CAMPOS ═══

descricaoBreve:
- Linguagem SIMPLES, leiga, como explicaria para o proprio paciente
- Foco no motivo da consulta e sintoma principal
- Ex: "Paciente de 19 anos com coceira generalizada pelo corpo ha 7 dias"

summaryTexto:
- CLINICO e INTERPRETATIVO — conecte dados, nao os liste
- Use linguagem tecnica
- 3-5 frases que mostram correlacoes entre os dados

blocos (3-6):
- Servem como FICHA DE REFERENCIA durante a consulta — podem ser factuais
- Titulos possiveis: "Queixa Principal", "Medicamentos em Uso", "Alergias e Reacoes", "Historico Relevante", "Habitos de Vida", "Historico Familiar", "Acessibilidade"
- conteudo: resumo objetivo do bloco
- So inclua blocos para dados que EXISTEM — nao crie bloco vazio

alertas:
- URGENTE: SOMENTE para conflito medicamento × alergia documentada (risco real de seguranca)
- ATENCAO: correlacao clinica real entre dados que o paciente forneceu
- INFO: contexto factual util (ex: "Paciente cadeirante")
- Cada alerta tem "titulo" (acao curta: "Evitar Dipirona") + "mensagem" (explicacao em 1-2 frases)
- NAO gere alertas genericos como "Acompanhar evolucao" ou "Manter monitoramento"
- Se nao ha cruzamento real, NAO gere alertas — e melhor zero alertas que um alerta falso`;

  const systemPrompt = 'Voce e um interpretador clinico da plataforma VITAE, construido para adiantar contexto para medicos antes da consulta. ' +
    'Seu papel e INTERPRETAR — nunca reorganizar, nunca diagnosticar, nunca prescrever. ' +
    'Voce pensa como medico experiente: cruza medicamentos com alergias, sintomas com historico, habitos com queixa, padroes temporais, historico familiar. ' +
    'Identifica correlacoes que o medico levaria minutos para perceber sozinho lendo um prontuario. ' +
    '\n\nREGRAS ABSOLUTAS DE SEGURANCA JURIDICA E CLINICA:\n' +
    '1. PROIBIDO diagnosticar: nunca "o paciente tem X", "isso indica Y", "suspeita de Z" para condicoes nao relatadas.\n' +
    '2. PROIBIDO prescrever: nunca "recomendo", "sugiro prescrever", "considere receitar", "deve tomar".\n' +
    '3. PROIBIDO ler formulario: nunca "o paciente respondeu que", "no formulario consta", "de acordo com as respostas".\n' +
    '4. PROIBIDO mencionar IA: nunca "inteligencia artificial", "algoritmo", "o sistema identificou".\n' +
    '5. PROIBIDO inventar dados: use EXCLUSIVAMENTE o que o paciente relatou. Se um campo esta vazio, nao mencione — nunca diga "nao informou".\n' +
    '6. USE linguagem interpretativa segura: "relata", "refere", "informa", "ha registro de", "chama atencao", "destaca-se", "merece avaliacao", "vale considerar".\n' +
    '7. LGPD: nao exponha dados pessoais alem do estritamente necessario clinicamente.\n' +
    '\nO textoVoz vira audio de 1 minuto narrado por voz masculina profissional. Deve soar como colega medico adiantando o caso antes da consulta — natural, fluido, objetivo. Nunca robotico, nunca burocratico, nunca amador. ' +
    'Melhor um briefing curto e preciso do que longo e inventado. Confianca do medico e tudo — um erro destroi a relacao.';

  // TRY GEMINI FIRST (free), fallback to Claude
  if (genAI) {
    try {
      console.log('[SUMMARY-AI] Tentando Gemini 2.5 Flash (gratuito)...');
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemPrompt,
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 1500 },
      });

      const result = await model.generateContent(userPrompt);
      const text = result.response.text();
      const parsed = JSON.parse(text);

      // Log if textoVoz is missing (degraded fallback alert)
      if (!parsed.textoVoz) {
        console.warn('[SUMMARY-AI] textoVoz ausente no output Gemini — TTS usara summaryTexto');
      }

      console.log('[SUMMARY-AI] Gemini sucesso! Blocos:', (parsed.blocos || []).length);
      return parsed;
    } catch (geminiErr) {
      console.error('[SUMMARY-AI] Gemini falhou:', geminiErr.message, '— tentando Claude...');
    }
  }

  // FALLBACK: Claude (Anthropic) — requer creditos
  try {
    console.log('[SUMMARY-AI] Tentando Claude Sonnet...');
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
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
      throw new Error('Falha ao parsear resposta do Claude');
    }
  } catch (claudeErr) {
    console.error('[SUMMARY-AI] Claude tambem falhou:', claudeErr.message);
    throw new Error('Nenhuma IA disponivel para gerar resumo: ' + claudeErr.message);
  }
}

/**
 * Gera audio via ElevenLabs a partir do textoVoz do summary.
 * Requer ELEVENLABS_API_KEY na env.
 *
 * @param {string} textoVoz - Texto natural para narração.
 * @returns {Buffer} Buffer do audio MP3.
 */
async function gerarAudioElevenLabs(textoVoz, pacienteNome) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY nao configurada');

  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'onwK4e9ZLuTAKqWW03F9'; // Daniel fallback — trocar por voz PT-BR quando testar

  console.log('[TTS] Gerando audio — voiceId:', voiceId, '| texto length:', textoVoz.length);

  // LGPD: anonimizar nome do paciente antes de enviar pro ElevenLabs
  let textoAnonimizado = textoVoz;
  if (pacienteNome) {
    const nomes = pacienteNome.split(' ').filter(n => n.length > 2);
    nomes.forEach(nome => {
      textoAnonimizado = textoAnonimizado.replace(new RegExp(nome, 'gi'), 'o paciente');
    });
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: textoAnonimizado,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('[TTS] ElevenLabs FALHOU:', response.status, '| voiceId:', voiceId, '| erro:', err);
    throw new Error(`ElevenLabs error: ${response.status} — ${err}`);
  }

  console.log('[TTS] Audio gerado com sucesso — size:', response.headers.get('content-length'));

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Verifica se a transcricao do audio cobre todos os topicos obrigatorios.
 *
 * @param {string} transcricao - Texto transcrito do audio do paciente.
 * @returns {object} { completo, topicosEncontrados, topicosAusentes, mensagem }
 */
async function verificarCompletudeTopicos(transcricao) {
  if (!transcricao || transcricao.trim().length < 10) {
    return {
      completo: false,
      topicosEncontrados: [],
      topicosAusentes: ['Motivo da consulta', 'Medicamentos', 'Alergias', 'Doenças', 'Cirurgias', 'Histórico familiar', 'Hábitos', 'Exames recentes'],
      mensagem: 'A gravação está muito curta. Por favor, fale mais sobre seus sintomas e histórico.',
      qualidadeAudio: 'ruim',
    };
  }

  const userPrompt = `Analise esta transcrição de um paciente respondendo uma pré-consulta médica por áudio.

Transcrição:
"${transcricao}"

Verifique se o paciente mencionou os seguintes tópicos obrigatórios:
1. Motivo da consulta / queixa principal (o que está sentindo, por que veio)
2. Há quanto tempo tem os sintomas
3. Medicamentos, suplementos ou vitaminas em uso
4. Alergias conhecidas
5. Doenças atuais ou internações anteriores
6. Cirurgias ou procedimentos realizados
7. Histórico familiar (doenças na família)
8. Hábitos (fumo, álcool, exercício, sono)
9. Exames recentes

IMPORTANTE: Seja razoável. Se o paciente disse "não tomo nenhum medicamento", isso CONTA como ter mencionado medicamentos. Se disse "não tenho alergia", conta como ter coberto alergias. O que importa é que o paciente ABORDOU o tópico, mesmo que a resposta seja negativa.

Retorne EXCLUSIVAMENTE um JSON válido:
{
  "completo": boolean,
  "topicosEncontrados": ["string (nome do tópico coberto)"],
  "topicosAusentes": ["string (nome do tópico não mencionado)"],
  "mensagem": "string (mensagem amigável para o paciente: se completo, parabenize e diga que pode enviar. Se incompleto, liste o que falta de forma gentil e peça para gravar novamente incluindo esses tópicos.)",
  "qualidadeAudio": "string ('boa' se a transcrição faz sentido clínico, 'razoavel' se falta clareza, 'ruim' se muito curto ou incoerente)"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: 'Voce e um assistente de triagem da plataforma VITAE. Analisa transcricoes de audio de pacientes para verificar se cobriram todos os topicos necessarios para uma pre-consulta medica. Seja gentil e encorajador.',
    messages: [{ role: 'user', content: userPrompt }],
  });

  const conteudo = response.content[0].text.trim();

  try {
    return JSON.parse(conteudo);
  } catch {
    const jsonMatch = conteudo.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1].trim());
    return {
      completo: true,
      topicosEncontrados: [],
      topicosAusentes: [],
      mensagem: 'Não foi possível verificar os tópicos. Você pode enviar mesmo assim.',
      qualidadeAudio: 'razoavel',
    };
  }
}

/**
 * Gera perguntas para um template de pré-consulta com base em uma instrução do médico.
 *
 * @param {string} instrucao - Instrução do médico (ex: "anamnese para cardiologia com 10 perguntas").
 * @returns {string} Texto com as perguntas, uma por linha.
 */
async function gerarPerguntasTemplate(instrucao) {
  if (!instrucao || instrucao.trim().length < 5) {
    throw new Error('Instrução muito curta. Descreva o tipo de formulário que deseja.');
  }

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Você é um assistente médico especializado em criar formulários de pré-consulta para médicos brasileiros. Com base na instrução abaixo, gere perguntas para um formulário de pré-consulta que o paciente responderá antes da consulta.

Retorne APENAS as perguntas, uma por linha, sem numeração, sem explicação, sem títulos.

Instrução: "${instrucao.trim()}"

Regras:
- Gere entre 5 e 20 perguntas conforme pedido (se não especificado, gere 8)
- Perguntas específicas para a especialidade/contexto mencionado
- Linguagem simples e clara para o paciente entender
- NÃO inclua: "Qual o motivo da consulta?", "Toma medicamentos?", "Tem alergia?" — essas são adicionadas automaticamente
- Perguntas práticas e objetivas, relevantes clinicamente
- Apenas as perguntas, nada mais`,
      },
    ],
  });

  const conteudo = response.content[0]?.text || '';
  if (!conteudo.trim()) {
    throw new Error('A IA não conseguiu gerar perguntas. Tente reformular a instrução.');
  }
  return conteudo.trim();
}

// ---------------------------------------------------------------------------
// Scan de receita medica — extrai medicamentos de foto/PDF
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT_SCAN_RECEITA = `Voce e um assistente da plataforma vita id especializado em leitura de receitas medicas brasileiras.

MISSAO: Analisar a imagem/PDF de uma receita medica e extrair TODOS os medicamentos prescritos com seus detalhes.

REGRAS:
- Extraia nome do medicamento, dosagem, frequencia (posologia) e via de administracao
- Se nao conseguir ler um campo com certeza, marque como "uncertain": true
- Se o documento nao for uma receita medica, retorne "tipo": "nao_receita"
- NAO invente medicamentos que nao estao no documento
- Trate abreviacoes medicas comuns (comp = comprimido, cp = comprimido, gt = gotas, mg = miligramas)
- Linguagem simples e acessivel`;

async function scanReceita(arquivoBuffer, mimeType) {
  const base64 = arquivoBuffer.toString('base64');
  const tipo = (mimeType || '').toLowerCase();
  const mediaType = tipo === 'image/jpg' ? 'image/jpeg' : (tipo || 'image/jpeg');

  // USE GEMINI (free) as primary, Claude as fallback
  console.log('[SCAN-AI] genAI disponivel:', !!genAI, '| GEMINI_API_KEY:', !!process.env.GEMINI_API_KEY);
  console.log('[SCAN-AI] base64 size:', base64.length, '| mediaType:', mediaType);

  if (genAI) {
    try {
      console.log('[SCAN-AI] Tentando Gemini 2.5 Flash...');
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json' },
      });

      const prompt = `Voce e um assistente da plataforma vita id. Analise esta foto de medicamento ou receita medica brasileira.

Primeiro identifique o tipo de imagem: caixa de remedio, frasco, receita medica, bula, ou outro.

Retorne um JSON com esta estrutura:
{
  "tipo": "medicamento" ou "receita" ou "nao_receita",
  "mensagem": "string (se nao for medicamento, explique)",
  "medico": "string ou null",
  "medicamentos": [
    {
      "nome": "string (nome comercial do medicamento)",
      "principio_ativo": "string ou null",
      "dosagem": "string ou null (ex: 500mg, 10ml)",
      "forma": "string ou null (comprimido, capsula, gotas, solucao)",
      "frequencia": "string ou null (ex: 1x ao dia, 8/8h)",
      "duracao": "string ou null (ex: 7 dias, uso continuo)",
      "laboratorio": "string ou null",
      "quantidade": "string ou null (ex: 20 comprimidos)",
      "uncertain": false,
      "confianca": "alta" ou "media" ou "baixa"
    }
  ]
}

REGRAS:
- Se nao conseguir ler um campo, coloque null (NUNCA invente)
- Se a foto nao for de medicamento, retorne tipo "nao_receita"
- Trate abreviacoes: comp=comprimido, cp=comprimido, gt=gotas, mg=miligramas
- Se for receita, extraia TODOS os medicamentos listados
- Se for caixa/frasco, extraia o nome e dosagem visiveis`;

      const result = await model.generateContent([
        { inlineData: { mimeType: mediaType, data: base64 } },
        prompt,
      ]);

      const text = result.response.text().trim();
      console.log('[SCAN-AI] Gemini respondeu:', text.substring(0, 300));

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[1].trim());
        else throw new Error('JSON invalido do Gemini: ' + text.substring(0, 100));
      }

      console.log('[SCAN-AI] Gemini identificou:', parsed.tipo, parsed.medicamentos?.length || 0, 'meds');
      return parsed;
    } catch (geminiErr) {
      console.error('[SCAN] Gemini falhou, tentando Claude:', geminiErr.message);
      // Fall through to Claude
    }
  }

  // FALLBACK: Claude (se Gemini falhar ou nao estiver configurado)
  let contentItem;
  if (tipo === 'application/pdf') {
    contentItem = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
  } else {
    contentItem = { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: SYSTEM_PROMPT_SCAN_RECEITA,
    messages: [{
      role: 'user',
      content: [
        contentItem,
        { type: 'text', text: `Analise esta foto de medicamento ou receita medica. Retorne JSON com: tipo, medicamentos [{nome, dosagem, frequencia, horario, duracao, via, observacao, uncertain}]. Se nao for medicamento: {"tipo":"nao_receita","mensagem":"..."}` }
      ],
    }],
  });

  const conteudo = response.content[0].text.trim();
  try {
    return JSON.parse(conteudo);
  } catch {
    const jsonMatch = conteudo.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1].trim());
    throw new Error('Nao foi possivel interpretar. Tente com uma foto mais nitida.');
  }
}

// ---------------------------------------------------------------------------
// Scan de resultado de alergia — extrai alergias de foto/PDF
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT_SCAN_ALERGIA = `Voce e um assistente da plataforma vita id especializado em leitura de resultados de exames alergicos brasileiros.

MISSAO: Analisar a imagem/PDF de um resultado de teste alergico e extrair TODAS as alergias identificadas.

REGRAS:
- Identifique cada substancia/alergeno encontrado
- Classifique por categoria: MEDICAMENTO, ALIMENTO, AMBIENTAL, CONTATO
- Indique a gravidade quando possivel: LEVE, MODERADA, GRAVE
- Se nao tiver certeza sobre a classificacao, marque como "uncertain": true
- NAO invente alergias que nao estao no documento`;

async function scanAlergia(arquivoBuffer, mimeType) {
  const base64 = arquivoBuffer.toString('base64');
  const tipo = (mimeType || '').toLowerCase();
  const mediaType = tipo === 'image/jpg' ? 'image/jpeg' : (tipo || 'image/jpeg');

  // USE GEMINI (free) as primary
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json' },
      });

      const prompt = `Voce e um assistente da plataforma vita id. Analise esta foto de resultado de exame alergico ou medicamento que pode causar alergia.

Retorne um JSON:
{
  "tipo": "exame_alergico" ou "nao_exame",
  "mensagem": "string (se nao for exame/medicamento)",
  "alergias": [
    {
      "nome": "string (nome da substancia/alergeno)",
      "categoria": "MEDICAMENTO" ou "ALIMENTO" ou "AMBIENTAL" ou "CONTATO" ou "OUTRO",
      "gravidade": "LEVE" ou "MODERADA" ou "GRAVE" ou null,
      "detalhe": "string ou null",
      "uncertain": false
    }
  ]
}

REGRAS:
- Se nao conseguir ler, coloque null (NUNCA invente)
- Se nao for exame/medicamento: tipo "nao_exame"`;

      const result = await model.generateContent([
        { inlineData: { mimeType: mediaType, data: base64 } },
        prompt,
      ]);

      const text = result.response.text().trim();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[1].trim());
        else throw new Error('JSON invalido do Gemini');
      }
      return parsed;
    } catch (geminiErr) {
      console.error('[SCAN-ALERGIA] Gemini falhou, tentando Claude:', geminiErr.message);
    }
  }

  // FALLBACK: Claude
  let contentItem;
  if (tipo === 'application/pdf') {
    contentItem = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
  } else {
    contentItem = { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: SYSTEM_PROMPT_SCAN_ALERGIA,
    messages: [{
      role: 'user',
      content: [
        contentItem,
        { type: 'text', text: `Analise este resultado de exame alergico e extraia todas as alergias identificadas.

Retorne EXCLUSIVAMENTE um JSON valido:
{
  "tipo": "exame_alergico",
  "alergias": [
    {
      "nome": "string (nome da substancia/alergeno)",
      "categoria": "MEDICAMENTO | ALIMENTO | AMBIENTAL | CONTATO | OUTRO",
      "gravidade": "LEVE | MODERADA | GRAVE | null",
      "detalhe": "string ou null (ex: IgE elevado, reacao moderada)",
      "uncertain": false
    }
  ]
}

Se algum item nao for claro, marque "uncertain": true.
Se o documento nao for um resultado de exame alergico, retorne: { "tipo": "nao_exame", "mensagem": "Documento nao parece ser um resultado de exame alergico" }` }
      ],
    }],
  });

  const conteudo = response.content[0].text.trim();
  try {
    return JSON.parse(conteudo);
  } catch {
    const jsonMatch = conteudo.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1].trim());
    throw new Error('Nao foi possivel interpretar o resultado. Tente com uma foto mais nitida.');
  }
}

module.exports = {
  estruturarExame,
  estruturarExameDeArquivo,
  gerarAnaliseExame,
  calcularIdadeBiologica,
  gerarMelhorias,
  gerarInfoSubstancia,
  gerarSummaryPreConsulta,
  gerarAudioElevenLabs,
  verificarCompletudeTopicos,
  gerarPerguntasTemplate,
  scanReceita,
  scanAlergia,
};
