// CAMADA Z3 — Monta o documento estruturado (Seçoes A-G) que vira input pra IA
// Recebe paciente cru + cadastro filtrado + cluster + modo + perguntas/respostas + transcricao
// Devolve string formatada pronta pra ir no user prompt

function fmtMed(m) {
  const partes = [m.nome];
  if (m.dosagem) partes.push(m.dosagem);
  if (m.frequencia) partes.push(m.frequencia);
  if (m.dataInicio) partes.push(`desde ${new Date(m.dataInicio).toLocaleDateString('pt-BR')}`);
  return partes.join(' · ');
}

function fmtMedDescontinuado(m) {
  return `${m.nome}${m.dosagem ? ' ' + m.dosagem : ''} (descontinuado em ${new Date(m.dataFim).toLocaleDateString('pt-BR')})`;
}

function fmtExame(e) {
  const data = e.data ? new Date(e.data).toLocaleDateString('pt-BR') : '(sem data)';
  return `${e.nome || 'Exame'} — ${data}`;
}

function fmtData(d) {
  if (!d) return '?';
  return new Date(d).toLocaleDateString('pt-BR');
}

function detectarModoResposta(r) {
  if (!r || typeof r !== 'object') return 'texto';
  if (r.modo) return r.modo;
  if (r.audioChunkUrl) return 'audio';
  return 'texto';
}

function valorDaResposta(r) {
  if (!r) return null;
  if (typeof r === 'string') return r;
  if (typeof r === 'object') {
    if ('valor' in r) return r.valor;
    if ('texto' in r) return r.texto;
  }
  return null;
}

function transcricaoBruta(r) {
  if (!r || typeof r !== 'object') return null;
  return r.transcricaoBruta || null;
}

/**
 * Monta SECAO B (respostas) com formato pergunta-por-pergunta.
 */
function montarSecaoB(perguntas, respostasMap) {
  if (!Array.isArray(perguntas) || perguntas.length === 0) {
    return '(sem perguntas no template)';
  }
  const linhas = [];
  for (let i = 0; i < perguntas.length; i++) {
    const p = perguntas[i];
    const r = respostasMap[p.id];
    const modo = detectarModoResposta(r);
    const valor = valorDaResposta(r);
    const original = transcricaoBruta(r);

    const enunciado = (p.texto || p.text || p.id || '').replace(/\n/g, ' ');
    let linha = `P${i + 1} [${modo}] "${enunciado}":\n  ${valor != null ? JSON.stringify(valor) : '(sem resposta)'}`;
    if (original && valor && original !== valor) {
      linha += `\n  (transcricao original: ${JSON.stringify(original)})`;
    }
    linhas.push(linha);
  }
  return linhas.join('\n');
}

/**
 * Monta SECAO C — cadastro filtrado em texto.
 */
function montarSecaoC(cad) {
  const linhas = [];
  linhas.push('Medicamentos ATIVOS hoje (apos filtro de validade):');
  if (cad.medsAtivos && cad.medsAtivos.length > 0) {
    cad.medsAtivos.forEach(m => linhas.push(`  - ${fmtMed(m)}`));
  } else {
    linhas.push('  (nenhum)');
  }

  if (cad.medsDescontinuadosRecentes && cad.medsDescontinuadosRecentes.length > 0) {
    linhas.push('Medicamentos DESCONTINUADOS nos ultimos 90 dias:');
    cad.medsDescontinuadosRecentes.forEach(m => linhas.push(`  - ${fmtMedDescontinuado(m)}`));
  }

  if (cad.alergias && cad.alergias.length > 0) {
    linhas.push(`Alergias registradas: ${cad.alergias.map(a => a.nome || a).join(', ')}`);
  } else {
    linhas.push(`Alergias registradas: ${cad.alergiasMarcador || 'NENHUMA REGISTRADA'}`);
  }

  if (cad.cirurgias && cad.cirurgias.length > 0) {
    linhas.push(`Cirurgias: ${cad.cirurgias.join(', ')}`);
  }
  if (cad.historicoFamiliar && cad.historicoFamiliar.length > 0) {
    linhas.push(`Historico familiar autorrelatado: ${cad.historicoFamiliar.join(', ')}`);
  }

  const ex = cad.examesConcluidos || {};
  linhas.push('Exames CONCLUIDOS:');
  if (ex.ultimos90d && ex.ultimos90d.length > 0) {
    linhas.push(`  Ultimos 90 dias (${ex.ultimos90d.length}): ${ex.ultimos90d.map(fmtExame).join('; ')}`);
  }
  if (ex.entre91e365d && ex.entre91e365d.length > 0) {
    linhas.push(`  91-365 dias (${ex.entre91e365d.length}): ${ex.entre91e365d.map(fmtExame).join('; ')}`);
  }
  if (ex.acima365d && ex.acima365d.length > 0) {
    linhas.push(`  Acima de 365 dias (${ex.acima365d.length}): ${ex.acima365d.map(fmtExame).join('; ')}`);
  }
  if (ex.ignoradosPorErro > 0) {
    linhas.push(`  (${ex.ignoradosPorErro} registros de exame com status=ERRO foram IGNORADOS)`);
  }

  const h = cad.habitos || {};
  const habitosPresentes = [];
  if (h.fuma != null) habitosPresentes.push(`fuma=${h.fuma}`);
  if (h.alcool != null) habitosPresentes.push(`alcool=${h.alcool}`);
  if (h.sono != null) habitosPresentes.push(`sono=${h.sono}`);
  if (h.atividade != null) habitosPresentes.push(`atividade=${h.atividade}`);
  if (habitosPresentes.length > 0) {
    linhas.push(`Habitos: ${habitosPresentes.join(' · ')}`);
  } else {
    linhas.push('Habitos: NENHUM REGISTRADO NO CADASTRO');
  }

  return linhas.join('\n');
}

/**
 * Monta SECAO F — catalogo do cluster (red flags, gaps, vocab).
 */
function montarSecaoF(cluster) {
  const linhas = [];
  linhas.push('Red flags obrigatorios (cite os PRESENTES nas respostas, omita os ausentes):');
  (cluster.redFlags || []).forEach((rf, i) => linhas.push(`  ${i + 1}. ${rf}`));
  linhas.push('Gaps prioritarios (escolha ate 3 dos AUSENTES nas respostas pro "Nao foi colhido"):');
  (cluster.gapsPrioritarios || []).forEach((g, i) => linhas.push(`  ${i + 1}. ${g}`));
  if (cluster.vocabulario && cluster.vocabulario.length > 0) {
    linhas.push(`Vocabulario da especialidade (NAO traduzir/corrigir): ${cluster.vocabulario.join(', ')}`);
  }
  return linhas.join('\n');
}

/**
 * Monta o user prompt completo (string longa).
 */
function montarUserPrompt(ctx) {
  const { paciente, cadastroFiltrado, cluster, modo, modoRazao, clusterRazao,
          perguntas, respostasMap, transcricaoCombinada, contradicoes,
          templateNome, medicoNome, hoje, limitePalavrasNum } = ctx;

  const idade = (cadastroFiltrado.identificacao && cadastroFiltrado.identificacao.idadeAnos) != null
    ? `${cadastroFiltrado.identificacao.idadeAnos} anos` : 'idade nao calculada';

  const partes = [];

  partes.push('[SECAO A — IDENTIFICACAO]');
  partes.push(`Nome: ${cadastroFiltrado.identificacao.nome || paciente && paciente.nome || '(sem nome)'}`);
  partes.push(`Idade: ${idade}`);
  partes.push(`Sexo: ${cadastroFiltrado.identificacao.sexo || 'nao informado'}`);
  partes.push(`Hoje: ${fmtData(hoje)}`);
  partes.push('');

  partes.push('[SECAO B — RESPOSTAS DO PACIENTE]');
  partes.push(montarSecaoB(perguntas, respostasMap));
  if (transcricaoCombinada) {
    partes.push('');
    partes.push('Transcricao combinada dos audios:');
    partes.push(`  "${transcricaoCombinada}"`);
  }
  partes.push('');

  partes.push('[SECAO C — CADASTRO PREVIO (filtrado)]');
  partes.push(montarSecaoC(cadastroFiltrado));
  partes.push('');

  partes.push('[SECAO D — CONTRADICOES E DIVERGENCIAS DETECTADAS PELO SISTEMA]');
  if (contradicoes && contradicoes.length > 0) {
    contradicoes.forEach((c, i) => partes.push(`  D${i + 1}. ${c}`));
  } else {
    partes.push('  (nenhuma)');
  }
  partes.push('');

  partes.push('[SECAO E — CONTEXTO]');
  partes.push(`Template: ${templateNome || '(sem nome)'}`);
  partes.push(`Medico solicitante: ${medicoNome || 'nao identificado'}`);
  partes.push(`Cluster detectado: ${cluster.id} — ${cluster.nome}`);
  partes.push(`Razao da deteccao do cluster: ${clusterRazao}`);
  partes.push(`Modo detectado: ${modo} (${modoRazao})`);
  partes.push(`Hard limit textoVoz: ${limitePalavrasNum} palavras`);
  partes.push('');

  partes.push('[SECAO F — CATALOGO DO CLUSTER]');
  partes.push(montarSecaoF(cluster));
  partes.push('');

  partes.push('[SECAO G — PROIBIDO]');
  partes.push('Nao estao disponiveis nesta pre-consulta: sinais vitais aferidos (PA, FC, FR, SatO2, T), exame fisico, exames laboratoriais em tempo real, sintomas neurovegetativos nao perguntados.');
  partes.push('NUNCA inferir nenhum desses como presente ou ausente.');
  partes.push('');

  partes.push('INSTRUCOES DE PROCESSAMENTO:');
  partes.push(`A. Aplique as 20 regras duras do system prompt.`);
  partes.push(`B. Conte palavras do textoVoz. HARD LIMIT: ${limitePalavrasNum} palavras.`);
  partes.push(`C. Retorne JSON valido conforme schema do system.`);
  partes.push('Apenas JSON. Sem markdown.');

  return partes.join('\n');
}

/**
 * Helper — monta respostasMap a partir das respostas brutas do banco.
 */
function montarRespostasMap(respostas) {
  if (!respostas) return {};
  const map = {};
  if (respostas._v4 && typeof respostas._v4 === 'object') {
    for (const k of Object.keys(respostas._v4)) {
      const id = k.replace(/^pergunta_/, '');
      map[id] = respostas._v4[k];
    }
  } else {
    for (const k of Object.keys(respostas)) {
      if (k.startsWith('_')) continue;
      map[k] = respostas[k];
    }
  }
  return map;
}

module.exports = {
  montarUserPrompt,
  montarRespostasMap,
  montarSecaoB,
  montarSecaoC,
  montarSecaoF
};
