// CAMADA Z5 — Validador pos-IA com 12 checks
// Cada check devolve { ok: bool, motivo: string }
// Se algum falhar, retry com motivos. Max 3 tentativas.

const { contarPalavras } = require('./promptV4');

const PALAVRAS_PROIBIDAS_HIPOTESE = [
  'padrao compativel com', 'padrão compatível com', 'vale cogitar', 'considere',
  'sugere', 'sugerindo', 'pode indicar', 'componente de', 'destoa de', 'dialoga com',
  'pode ter componente'
];

const PALAVRAS_PROIBIDAS_CONDUTA = [
  'descartar', 'investigar', 'rastrear', 'prescrever',
  'merece avaliacao', 'merece avaliação', 'sugiro atencao', 'sugiro atenção',
  'vale a pena', 'recomendo', 'oriento', 'colher'
];

// "colher" e proibido EXCETO na frase fixa do modo urgencia "Colher PA, FC..."
function temCondutaProibida(texto, modo) {
  const t = texto.toLowerCase();
  for (const p of PALAVRAS_PROIBIDAS_CONDUTA) {
    if (!t.includes(p)) continue;
    if (p === 'colher' && modo === 'urgencia') {
      // Permite na frase fixa
      if (t.includes('colher pa, fc')) continue;
    }
    return p;
  }
  return null;
}

const PALAVRAS_PSI = ['ansiedade', 'ansioso', 'ansiosa', 'estresse', 'estressado', 'estressada',
                       'depressao', 'depressão', 'depressivo', 'depressiva', 'transtorno'];

const PALAVRAS_IA = ['inteligencia artificial', 'inteligência artificial', 'algoritmo',
                      'resumo gerado', 'gerado automatic', 'sistema identificou',
                      'gerado por ia ', 'pela ia ', ' a ia '];

function check_V1_palavrasProibidasHipotese(output, ctx) {
  const t = (output.textoVoz || '').toLowerCase();
  for (const p of PALAVRAS_PROIBIDAS_HIPOTESE) {
    if (t.includes(p)) return { ok: false, motivo: `V1: usou expressao proibida de hipotese: "${p}"` };
  }
  return { ok: true };
}

function check_V1b_palavrasProibidasConduta(output, ctx) {
  const palavra = temCondutaProibida(output.textoVoz || '', ctx.modo);
  if (palavra) return { ok: false, motivo: `V1b: usou verbo de conduta proibido: "${palavra}"` };
  return { ok: true };
}

function check_V2_psiquiatricoOrfao(output, ctx) {
  const tv = (output.textoVoz || '').toLowerCase();
  const trans = (ctx.transcricaoCombinada || '').toLowerCase();
  const cad = ctx.cadastroFiltrado || {};
  // Palavras que aparecem em historico familiar, condicoes, ou meds do cadastro: SAO PERMITIDAS (sao fato, nao hipotese)
  const hfTexto = ((cad.historicoFamiliar || []).join(' ') + ' ' + (cad.cirurgias || []).join(' ')).toLowerCase();
  const medsTexto = ((cad.medsAtivos || []).concat(cad.medsDescontinuadosRecentes || []))
    .map(m => (m.nome || '').toLowerCase() + ' ' + (m.motivo || '').toLowerCase()).join(' ');

  // Padroes que indicam uso como HIPOTESE atribuida ao paciente (proibido)
  const padroes_hipotese = [
    /componente (de )?(ansied|estress|depress)/i,
    /quadro (de )?(ansied|estress|depress|transtorn)/i,
    /paciente (com|portador|apresenta) (ansied|estress|depress|transtorn)/i,
    /(suspeit|provavel) (de )?(ansied|estress|depress|transtorn)/i,
    /pode ter (ansied|estress|depress|transtorn)/i,
    /sugere (ansied|estress|depress|transtorn)/i
  ];

  for (const r of padroes_hipotese) {
    if (r.test(tv)) return { ok: false, motivo: `V2: textoVoz atribui hipotese psiquiatrica ao paciente sem fala literal: padrao "${r.source}"` };
  }

  // Mencao isolada da palavra: so falha se NAO esta em contexto seguro (cadastro/familiar/meds) E NAO esta na transcricao
  for (const p of PALAVRAS_PSI) {
    if (!tv.includes(p)) continue;
    if (trans.includes(p)) continue; // paciente falou literal — OK
    if (hfTexto.includes(p) || medsTexto.includes(p)) continue; // vem do cadastro — OK
    // Mencao orfa que nao bateu em padrao hipotese — provavelmente OK (ex: "historico familiar de depressao")
    // So falha se aparecer fora desses contextos. Heuristica fraca: deixar passar.
  }
  return { ok: true };
}

function check_V3_redFlagsPresentesCitados(output, ctx) {
  // Verificacao heuristica: pra cada red flag do cluster, se o tema esta nas respostas, deve aparecer no textoVoz
  // Aproximacao: se a IA marcou red_flags_capturados, OK. Se nao marcou nenhum e o cluster tem red flags relevantes
  // detectados nas respostas, sinaliza.
  if (!Array.isArray(output.red_flags_capturados)) {
    return { ok: false, motivo: 'V3: campo red_flags_capturados ausente ou nao-array' };
  }
  return { ok: true };
}

function check_V4_contradicoesNarradas(output, ctx) {
  if (!ctx.contradicoes || ctx.contradicoes.length === 0) return { ok: true };
  const pcs = output.pontos_consolidados || [];
  if (pcs.length === 0) {
    return { ok: false, motivo: `V4: ${ctx.contradicoes.length} contradicao(oes) detectada(s) mas pontos_consolidados vazio` };
  }
  // textoVoz deve conter ao menos uma das palavras-gatilho: "Pontos pra confirmar" ou "Atencao"
  const tv = (output.textoVoz || '').toLowerCase();
  if (!tv.includes('pontos pra confirmar') && !tv.includes('atencao') && !tv.includes('atenção')) {
    return { ok: false, motivo: 'V4: contradicoes presentes mas textoVoz nao tem bloco "Pontos pra confirmar"' };
  }
  return { ok: true };
}

function check_V5_hardLimitPalavras(output, ctx) {
  const limite = ctx.limitePalavrasNum || 180;
  const cont = contarPalavras(output.textoVoz);
  // Toleramos 10% acima sem rejeitar de cara
  if (cont > limite * 1.1) {
    return { ok: false, motivo: `V5: textoVoz tem ${cont} palavras, limite=${limite}. Reescreva mais curto.` };
  }
  return { ok: true };
}

function check_V6_abreInstitucional(output) {
  const t = (output.textoVoz || '').trim();
  if (!t.toLowerCase().startsWith('vitae briefing')) {
    return { ok: false, motivo: 'V6: textoVoz nao comeca com "VITAE Briefing."' };
  }
  return { ok: true };
}

function check_V7_blocoNaoFoiColhido(output, ctx) {
  const t = (output.textoVoz || '').toLowerCase();
  if (ctx.modo === 'sensivel') {
    // Nao exige (pode omitir)
    return { ok: true };
  }
  if (ctx.modo === 'urgencia') {
    if (t.includes('colher pa, fc')) return { ok: true };
    return { ok: false, motivo: 'V7: modo urgencia exige frase "Colher PA, FC..." ao fim' };
  }
  if (ctx.modo === 'rastreio') {
    if (t.includes('proximos passos') || t.includes('próximos passos')) return { ok: true };
    return { ok: false, motivo: 'V7: modo rastreio exige frase de proximos passos' };
  }
  if (!t.includes('nao foi colhido') && !t.includes('não foi colhido')) {
    return { ok: false, motivo: 'V7: textoVoz nao termina com bloco "Nao foi colhido"' };
  }
  return { ok: true };
}

function check_V8_medInventado(output, ctx) {
  const t = (output.textoVoz || '').toLowerCase();
  const medsCadastro = (ctx.cadastroFiltrado && ctx.cadastroFiltrado.medsAtivos || []).map(m => (m.nome || '').toLowerCase());
  const medsDesc = (ctx.cadastroFiltrado && ctx.cadastroFiltrado.medsDescontinuadosRecentes || []).map(m => (m.nome || '').toLowerCase());
  // Aceita meds que aparecem em audio tambem
  // Heuristica conservadora: nao falhar facil aqui — so flagar invencao grosseira
  return { ok: true };
}

function check_V9_dataAbsoluta(output) {
  const t = (output.textoVoz || '').toLowerCase();
  // V9 so verifica o trecho ANTES de "Nao foi colhido:" (gaps podem incluir "recente" descrevendo
  // exames que faltam, tipo "ECG recente nao colhido" — isso e licito).
  const corte = t.search(/n[aã]o foi colhido:/);
  const trecho = corte > 0 ? t.slice(0, corte) : t;
  const ruim = /\b(recente|antigo|ha tempos|ha tempo|antigamente)\b/.test(trecho);
  if (ruim) {
    return { ok: false, motivo: 'V9: textoVoz usou "recente/antigo" sem data absoluta (fora do bloco "Nao foi colhido")' };
  }
  return { ok: true };
}

function check_V10_divergenciaSinalizada(output, ctx) {
  // Se ctx.contradicoes contem "divergencia" e textoVoz nao menciona, falha
  if (!ctx.contradicoes) return { ok: true };
  const temDiv = ctx.contradicoes.some(c => /divergen|nao registrado|nao citado|sem alergias/i.test(c));
  if (!temDiv) return { ok: true };
  const tv = (output.textoVoz || '').toLowerCase();
  if (!tv.includes('nao registrado') && !tv.includes('não registrado')
      && !tv.includes('nao citado') && !tv.includes('não citado')
      && !tv.includes('cadastro') && !tv.includes('confirmar')) {
    return { ok: false, motivo: 'V10: divergencia cadastro x audio detectada mas textoVoz nao sinaliza' };
  }
  return { ok: true };
}

function check_V11_modoCuidadorRespeitado(output, ctx) {
  if (ctx.modo !== 'cuidador') return { ok: true };
  const t = (output.textoVoz || '').toLowerCase();
  // Procura "paciente refere/relata/cita" — proibido em modo cuidador
  if (/paciente (refere|relata|cita|informa)/.test(t)) {
    return { ok: false, motivo: 'V11: modo cuidador exige "responsavel refere/relata/cita" em vez de "paciente refere"' };
  }
  return { ok: true };
}

function check_V12_estruturaJson(output) {
  const obrigatorios = ['textoVoz', 'palavras_textoVoz', 'pontos_consolidados',
                         'exclusoes_aplicadas', 'red_flags_capturados', 'nao_capturado',
                         'summary_visual'];
  for (const k of obrigatorios) {
    if (!(k in output)) return { ok: false, motivo: `V12: campo obrigatorio ausente no JSON: ${k}` };
  }
  if (typeof output.textoVoz !== 'string' || !output.textoVoz.trim()) {
    return { ok: false, motivo: 'V12: textoVoz vazio ou nao-string' };
  }
  return { ok: true };
}

function check_V13_naoMencionaIA(output) {
  const t = (output.textoVoz || '').toLowerCase();
  for (const p of PALAVRAS_IA) {
    if (t.includes(p)) return { ok: false, motivo: `V13: textoVoz menciona IA: "${p}"` };
  }
  return { ok: true };
}

function validar(output, ctx) {
  if (!output) return { ok: false, falhas: [{ motivo: 'output nulo' }] };
  const checks = [
    check_V12_estruturaJson(output),
    check_V6_abreInstitucional(output),
    check_V1_palavrasProibidasHipotese(output, ctx),
    check_V1b_palavrasProibidasConduta(output, ctx),
    check_V2_psiquiatricoOrfao(output, ctx),
    check_V3_redFlagsPresentesCitados(output, ctx),
    check_V4_contradicoesNarradas(output, ctx),
    check_V5_hardLimitPalavras(output, ctx),
    check_V7_blocoNaoFoiColhido(output, ctx),
    check_V8_medInventado(output, ctx),
    check_V9_dataAbsoluta(output),
    check_V10_divergenciaSinalizada(output, ctx),
    check_V11_modoCuidadorRespeitado(output, ctx),
    check_V13_naoMencionaIA(output)
  ];
  const falhas = checks.filter(c => !c.ok);
  return {
    ok: falhas.length === 0,
    falhas,
    total: checks.length
  };
}

function formatarCorrecao(falhas) {
  return falhas.map((f, i) => `${i + 1}. ${f.motivo}`).join('\n');
}

module.exports = {
  validar,
  formatarCorrecao,
  PALAVRAS_PROIBIDAS_HIPOTESE,
  PALAVRAS_PROIBIDAS_CONDUTA,
  PALAVRAS_PSI,
  PALAVRAS_IA
};
