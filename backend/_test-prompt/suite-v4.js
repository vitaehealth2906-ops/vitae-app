// Suite V4 — 15 casos sinteticos cobrindo clusters + modos diferentes
// T01-T10: testes deterministicos (Z0-Z3, sem chamar IA — rapidos)
// T11-T15: testes com IA real (Z4-Z5, custam ~5 chamadas API)
// Roda com: node _test-prompt/suite-v4.js
// Ambiente: ANTHROPIC_API_KEY no env

const path = require('path');
const fs = require('fs');
const { higienizar } = require(path.join('..', 'src', 'services', 'v4', 'higienizacao'));
const { detectarCluster, obterCluster } = require(path.join('..', 'src', 'services', 'v4', 'detectorCluster'));
const { detectarModo, limitePalavras } = require(path.join('..', 'src', 'services', 'v4', 'detectorModo'));
const { detectarContradicoes } = require(path.join('..', 'src', 'services', 'v4', 'detectorContradicoes'));
const { montarUserPrompt, montarRespostasMap } = require(path.join('..', 'src', 'services', 'v4', 'montagemContexto'));
const { gerarTextoVoz, contarPalavras } = require(path.join('..', 'src', 'services', 'v4', 'promptV4'));
const { validar } = require(path.join('..', 'src', 'services', 'v4', 'validador'));

const HOJE = new Date('2026-05-24T12:00:00Z');

function pacienteAdulto(idade = 30) {
  return {
    usuario: { nome: 'Paciente Teste', email: 'teste@vitae.test' },
    perfilSaude: {
      dataNascimento: new Date(HOJE.getFullYear() - idade, 0, 1),
      genero: 'MASCULINO', alturaCm: 175, pesoKg: 75
    },
    medicamentos: [], alergias: [], exames: []
  };
}

const CASOS = [
  // T01 — Cardio cluster + modo padrao
  { id: 'T01', desc: 'CARDIO padrao', tipo: 'det', input: {
      nomeTemplate: 'CARDIOLOGIA', perguntas: [
        { id: 'q_queixa', texto: 'Qual a queixa?', tipo: 'text' },
        { id: 'q_dor', texto: 'Tem dor no peito?', tipo: 'yesno' }
      ], paciente: pacienteAdulto(45)
    }, esperado: { cluster: 'C01', modo: 'padrao', limite: 180 }
  },
  // T02 — Dermato cluster
  { id: 'T02', desc: 'DERMATO padrao', tipo: 'det', input: {
      nomeTemplate: 'DERMATOLOGIA', perguntas: [
        { id: 'q1', texto: 'Onde aparecem as lesoes?' }
      ], paciente: pacienteAdulto(30)
    }, esperado: { cluster: 'C05', modo: 'padrao', limite: 180 }
  },
  // T03 — Pediatria com cuidador automatico
  { id: 'T03', desc: 'PEDIATRIA cuidador (filho 4a)', tipo: 'det', input: {
      nomeTemplate: 'PEDIATRIA', perguntas: [
        { id: 'q1', texto: 'Tem febre?' }
      ], paciente: pacienteAdulto(4)
    }, esperado: { cluster: 'C11', modo: 'cuidador', limite: 180 }
  },
  // T04 — Check-up (rastreio)
  { id: 'T04', desc: 'IMAGEM diagnostico (rastreio)', tipo: 'det', input: {
      nomeTemplate: 'Tomografia abdominal', perguntas: [
        { id: 'q1', texto: 'Tem alergia a contraste?' }
      ], paciente: pacienteAdulto(50)
    }, esperado: { cluster: 'C25', modo: 'rastreio', limite: 180 }
  },
  // T05 — Psiquiatria (sensivel)
  { id: 'T05', desc: 'PSIQUIATRIA sensivel', tipo: 'det', input: {
      nomeTemplate: 'PSIQUIATRIA', perguntas: [
        { id: 'q1', texto: 'Como esta o sono?' }
      ], paciente: pacienteAdulto(35)
    }, esperado: { cluster: 'C10', modo: 'sensivel', limite: 140 }
  },
  // T06 — UPA (urgencia)
  { id: 'T06', desc: 'EMERGENCIA urgencia', tipo: 'det', input: {
      nomeTemplate: 'Pronto Socorro', perguntas: [
        { id: 'q1', texto: 'Onde dói?' }
      ], paciente: pacienteAdulto(40)
    }, esperado: { cluster: 'C22', modo: 'urgencia', limite: 90 }
  },
  // T07 — Acupuntura (alternativa)
  { id: 'T07', desc: 'ACUPUNTURA alternativa', tipo: 'det', input: {
      nomeTemplate: 'Acupuntura', perguntas: [
        { id: 'q1', texto: 'Como esta a energia?' }
      ], paciente: pacienteAdulto(45)
    }, esperado: { cluster: 'C26', modo: 'alternativa', limite: 180 }
  },
  // T08 — Geriatria com idoso 82a (cuidador_parcial -> cuidador)
  { id: 'T08', desc: 'GERIATRIA cuidador_parcial->cuidador (82a)', tipo: 'det', input: {
      nomeTemplate: 'GERIATRIA', perguntas: [
        { id: 'q1', texto: 'Caiu recentemente?' }
      ], paciente: pacienteAdulto(82)
    }, esperado: { cluster: 'C13', modo: 'cuidador', limite: 180 }
  },
  // T09 — Ginecologia (sensivel_parcial)
  { id: 'T09', desc: 'GINECO sensivel_parcial', tipo: 'det', input: {
      nomeTemplate: 'GINECOLOGIA E OBSTETRICIA', perguntas: [
        { id: 'q1', texto: 'Quando foi a ultima menstruacao?' }
      ], paciente: pacienteAdulto(28)
    }, esperado: { cluster: 'C09', modo: 'sensivel_parcial', limite: 160 }
  },
  // T10 — Template sem nome de especialidade (fallback C23)
  { id: 'T10', desc: 'Avaliacao Geral (fallback)', tipo: 'det', input: {
      nomeTemplate: 'Avaliacao Geral', perguntas: [
        { id: 'q1', texto: 'O que voce sente?' }
      ], paciente: pacienteAdulto(30)
    }, esperado: { cluster: 'C23', modo: 'padrao', limite: 180 }
  },

  // ===== TESTES COM IA REAL =====
  // T11 — Cardio com red flags (esperado: textoVoz cita 8/10, 20-30min, esforco/repouso)
  { id: 'T11', desc: 'CARDIO red flags + contradicao (IA real)', tipo: 'ia', input: {
      nomeTemplate: 'CARDIOLOGIA',
      perguntas: [
        { id: 'q_queixa', texto: 'Qual a queixa?' },
        { id: 'q_dor', texto: 'Tem dor toracica?' },
        { id: 'q_intens', texto: 'Intensidade 0-10?' },
        { id: 'q_dur', texto: 'Duracao por episodio?' },
        { id: 'q_esforco', texto: 'Esforco ou repouso?' }
      ],
      respostas: {
        q_queixa: { valor: 'dor no peito', modo: 'texto' },
        q_dor: { valor: 'Nenhuma', modo: 'texto' },
        q_intens: { valor: '8', modo: 'texto' },
        q_dur: { valor: '20-30 min', modo: 'texto' },
        q_esforco: { valor: 'nas duas', modo: 'texto' }
      },
      transcricao: 'tenho dor no peito ha umas semanas',
      paciente: pacienteAdulto(45)
    },
    checagens: [
      out => /8 de 10|8\/10|intensidade 8/i.test(out.textoVoz) || 'red flag intensidade 8/10 ausente',
      out => /20.*30|vinte.*trinta/i.test(out.textoVoz) || 'red flag duracao 20-30 min ausente',
      out => /esforco.*repouso|repouso.*esforco|nas duas/i.test(out.textoVoz) || 'red flag esforco/repouso ausente',
      out => /vitae briefing/i.test(out.textoVoz) || 'abertura institucional ausente',
      out => !/depressao|ansiedade|estresse/i.test(out.textoVoz) || 'mencionou termo psiquiatrico sem fala literal'
    ]
  },
  // T12 — Pediatria modo cuidador (responsavel refere)
  { id: 'T12', desc: 'PEDIATRIA modo cuidador (IA real)', tipo: 'ia', input: {
      nomeTemplate: 'PEDIATRIA', perguntas: [
        { id: 'q_queixa', texto: 'O que esta acontecendo?' },
        { id: 'q_febre', texto: 'Tem febre?' }
      ],
      respostas: {
        q_queixa: { valor: 'meu filho esta com tosse', modo: 'texto' },
        q_febre: { valor: '38.5C ha 2 dias', modo: 'texto' }
      },
      transcricao: 'meu filho esta tossindo muito',
      paciente: pacienteAdulto(4)
    },
    checagens: [
      out => /respons(a|á)vel/i.test(out.textoVoz) || 'modo cuidador nao mencionou responsavel',
      out => !/paciente (refere|relata|cita|informa)/i.test(out.textoVoz) || 'usou "paciente refere" em modo cuidador'
    ]
  },
  // T13 — Cardio com hist familiar depressao (NAO inferir psiquiatrico)
  { id: 'T13', desc: 'CARDIO sem hipotese psiquiatrica (IA real)', tipo: 'ia', input: {
      nomeTemplate: 'CARDIOLOGIA', perguntas: [
        { id: 'q_queixa', texto: 'Queixa?' },
        { id: 'q_dor', texto: 'Dor no peito?' }
      ],
      respostas: {
        q_queixa: { valor: 'palpitacoes', modo: 'texto' },
        q_dor: { valor: 'as vezes', modo: 'texto' }
      },
      transcricao: 'tenho palpitacoes',
      paciente: { ...pacienteAdulto(30),
        perfilSaude: { dataNascimento: new Date(1996, 0, 1), genero: 'MASCULINO',
                       historicoFamiliar: ['Depressao', 'Diabetes'] }
      }
    },
    checagens: [
      out => !/componente.*ansiedade|componente.*estresse|paciente com ansiedade|quadro de ansiedade/i.test(out.textoVoz) || 'inferiu hipotese psiquiatrica'
    ]
  },
  // T14 — Termos errados na transcricao (urticaria, dipirona)
  { id: 'T14', desc: 'Termos transcritos errado corrigidos silentes (IA real)', tipo: 'ia', input: {
      nomeTemplate: 'ALERGIA E IMUNOLOGIA', perguntas: [
        { id: 'q_alergia', texto: 'Tem alergia?' }
      ],
      respostas: {
        q_alergia: { valor: 'tenho elticaria forte, alergia a poeira', modo: 'audio',
                     transcricaoBruta: 'tenho elticaria forte, alergia a poeira' }
      },
      transcricao: 'tenho elticaria forte, alergia a poeira',
      paciente: pacienteAdulto(30)
    },
    checagens: [
      out => /urtic(a|á)ria/i.test(out.textoVoz) || 'nao corrigiu elticaria pra urticaria',
      out => !/elticaria/i.test(out.textoVoz) || 'manteve transcricao errada no audio'
    ]
  },
  // T15 — Med descontinuado deve aparecer SOMENTE como descontinuado
  { id: 'T15', desc: 'Med vencido nao aparece como ativo (IA real)', tipo: 'ia', input: {
      nomeTemplate: 'CARDIOLOGIA', perguntas: [
        { id: 'q_queixa', texto: 'Queixa?' }
      ],
      respostas: {
        q_queixa: { valor: 'dor no peito', modo: 'texto' }
      },
      transcricao: 'dor no peito',
      paciente: { usuario: { nome: 'Paciente' },
        perfilSaude: { dataNascimento: new Date(1995, 0, 1), genero: 'MASCULINO' },
        medicamentos: [
          { nome: 'Loratadina', dosagem: '10mg', frequencia: '1x/dia', dataInicio: new Date('2026-04-01'), ativo: true },
          { nome: 'Prednisolona', dosagem: '20mg', frequencia: '1x/dia', dataInicio: new Date('2026-04-01'), dataFim: new Date('2026-04-14'), ativo: true }
        ],
        alergias: [], exames: []
      }
    },
    checagens: [
      out => /loratadina/i.test(out.textoVoz) || 'Loratadina nao apareceu',
      out => /descontinuad/i.test(out.textoVoz) || 'Prednisolona nao foi marcada como descontinuada'
    ]
  }
];

async function rodarCasoDeterministico(c) {
  const { input, esperado } = c;
  const cad = higienizar(input.paciente, HOJE);
  const cd = await detectarCluster({ nomeTemplate: input.nomeTemplate, perguntas: input.perguntas });
  const cluster = obterCluster(cd.clusterId);
  const md = detectarModo({ cluster, idadeAnos: cad.identificacao.idadeAnos, respostas: input.respostas });
  const lim = limitePalavras(md.modo);

  const obtidos = { cluster: cd.clusterId, modo: md.modo, limite: lim };
  const falhas = [];
  for (const k of Object.keys(esperado)) {
    if (obtidos[k] !== esperado[k]) falhas.push(`${k} esperado=${esperado[k]} obtido=${obtidos[k]}`);
  }
  return { ok: falhas.length === 0, falhas, obtidos };
}

async function rodarCasoIA(c) {
  const { input } = c;
  const cad = higienizar(input.paciente, HOJE);
  const cd = await detectarCluster({ nomeTemplate: input.nomeTemplate, perguntas: input.perguntas });
  const cluster = obterCluster(cd.clusterId);
  const md = detectarModo({ cluster, idadeAnos: cad.identificacao.idadeAnos, respostas: input.respostas });
  const lim = limitePalavras(md.modo);

  const respostasMap = {};
  for (const k of Object.keys(input.respostas || {})) respostasMap[k] = input.respostas[k];

  const contradicoes = detectarContradicoes({
    perguntas: input.perguntas, respostas: input.respostas,
    transcricaoAudio: input.transcricao, cadastroFiltrado: cad
  });

  const userPrompt = montarUserPrompt({
    paciente: input.paciente.usuario, cadastroFiltrado: cad, cluster,
    modo: md.modo, modoRazao: md.razao, clusterRazao: cd.razao,
    perguntas: input.perguntas, respostasMap, transcricaoCombinada: input.transcricao,
    contradicoes, templateNome: input.nomeTemplate, medicoNome: 'Dr Teste',
    hoje: HOJE, limitePalavrasNum: lim
  });

  const ctx = { modo: md.modo, limitePalavrasNum: lim, contradicoes, cadastroFiltrado: cad, transcricaoCombinada: input.transcricao };
  let r;
  try {
    r = await gerarTextoVoz({ userPrompt });
  } catch (e) {
    return { ok: false, falhas: ['IA call falhou: ' + e.message] };
  }
  if (!r.parsed) return { ok: false, falhas: ['IA nao devolveu JSON valido'] };

  const v = validar(r.parsed, ctx);
  const falhas = v.ok ? [] : v.falhas.map(f => 'validador: ' + f.motivo);

  // Checagens especificas do caso
  for (const checFn of (c.checagens || [])) {
    const res = checFn(r.parsed);
    if (res !== true) falhas.push(res);
  }
  return { ok: falhas.length === 0, falhas, output: r.parsed };
}

async function main() {
  const resultados = [];
  for (const c of CASOS) {
    process.stdout.write(`${c.id} ${c.desc} ... `);
    let r;
    if (c.tipo === 'det') r = await rodarCasoDeterministico(c);
    else r = await rodarCasoIA(c);
    resultados.push({ id: c.id, desc: c.desc, ...r });
    console.log(r.ok ? 'OK' : 'FAIL');
    if (!r.ok) r.falhas.forEach(f => console.log('   - ' + f));
  }
  const ok = resultados.filter(r => r.ok).length;
  console.log(`\nTotal: ${ok}/${resultados.length}`);
  const rel = path.join(__dirname, `relatorio-suite-v4-${Date.now()}.json`);
  fs.writeFileSync(rel, JSON.stringify(resultados, null, 2));
  console.log(`Relatorio: ${rel}`);
  if (ok < resultados.length) process.exit(1);
}

main().catch(e => { console.error('ERR:', e.message, e.stack); process.exit(1); });
