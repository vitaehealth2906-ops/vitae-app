// Testes unitarios das camadas Z0-Z2 (sem chamar IA externa por padrao)
// Roda com: node _test-prompt/unit-deteccao.js

const path = require('path');
const { higienizar, calcularIdade, isMedLixo } = require(path.join('..', 'src', 'services', 'v4', 'higienizacao'));
const { matchPorNomeTemplate, matchPorPerguntas } = require(path.join('..', 'src', 'services', 'v4', 'detectorCluster'));
const { detectarModo, limitePalavras } = require(path.join('..', 'src', 'services', 'v4', 'detectorModo'));
const { detectarContradicoes, medsCitadosNoAudio } = require(path.join('..', 'src', 'services', 'v4', 'detectorContradicoes'));

const casos = [
  // matchPorNomeTemplate — esperado: cluster correto
  { tipo: 'nome', nome: 'CARDIOLOGIA', esperado: 'C01' },
  { tipo: 'nome', nome: 'Dermatologia Geral', esperado: 'C05' },
  { tipo: 'nome', nome: 'Pediatria de rotina', esperado: 'C11' },
  { tipo: 'nome', nome: 'Geriatria - avaliacao', esperado: 'C13' },
  { tipo: 'nome', nome: 'PSIQUIATRIA', esperado: 'C10' },
  { tipo: 'nome', nome: 'Acupuntura clinica', esperado: 'C26' },
  { tipo: 'nome', nome: 'PRONTO SOCORRO - triagem', esperado: 'C22' },
  { tipo: 'nome', nome: 'OBSTETRICIA', esperado: 'C09' },
  { tipo: 'nome', nome: 'Avaliacao Geral', esperado: 'C23' },  // fallback
  // matchPorPerguntas — heuristica
  { tipo: 'perguntas', perguntas: [
    { texto: 'Voce sente dor no peito?' },
    { texto: 'A dor irradia para o braco?' },
    { texto: 'Tem palpitacao?' }
  ], esperado: 'C01' },
  { tipo: 'perguntas', perguntas: [
    { texto: 'Onde fica a lesao na pele?' },
    { texto: 'Ha quanto tempo apareceu a mancha?' },
    { texto: 'Esta com prurido (coca)?' }
  ], esperado: 'C05' },
  // Filtros higienizacao
  { tipo: 'lixo', nome: 'Soro Fisiologico', esperado: true },
  { tipo: 'lixo', nome: 'Loratadina 10mg', esperado: false },
  { tipo: 'lixo', nome: 'XX', esperado: true },
  // Idade
  { tipo: 'idade', nasc: '2007-03-15', hoje: '2026-05-24', esperado: 19 },
  // Modo
  { tipo: 'modo', cluster: { modoEspecial: 'cuidador' }, idade: 4, esperado: 'cuidador' },
  { tipo: 'modo', cluster: { modoEspecial: 'sensivel' }, idade: 30, esperado: 'sensivel' },
  { tipo: 'modo', cluster: { modoEspecial: null }, idade: 30, respostas: { p1: { valor: 'esta com dor muito forte agora mesmo, urgente' } }, esperado: 'urgencia' },
  // Limite palavras
  { tipo: 'limite', modo: 'urgencia', esperado: 90 },
  { tipo: 'limite', modo: 'sensivel', esperado: 140 },
  { tipo: 'limite', modo: 'padrao', esperado: 180 },
  // Meds no audio
  { tipo: 'meds_audio', texto: 'tomo cetirizina e loratadina toda manha', esperado: ['cetirizina', 'loratadina'] }
];

function rodar() {
  let passou = 0, falhou = 0;
  const falhas = [];
  for (const c of casos) {
    let resultado, ok = false;
    try {
      if (c.tipo === 'nome') {
        const r = matchPorNomeTemplate(c.nome);
        resultado = r ? r.clusterId : 'C23';
        ok = resultado === c.esperado;
      } else if (c.tipo === 'perguntas') {
        const r = matchPorPerguntas(c.perguntas);
        resultado = r ? r.clusterId : 'C23';
        ok = resultado === c.esperado;
      } else if (c.tipo === 'lixo') {
        resultado = isMedLixo(c.nome, null);
        ok = resultado === c.esperado;
      } else if (c.tipo === 'idade') {
        resultado = calcularIdade(c.nasc, new Date(c.hoje));
        ok = resultado === c.esperado;
      } else if (c.tipo === 'modo') {
        const r = detectarModo({ cluster: c.cluster, idadeAnos: c.idade, respostas: c.respostas });
        resultado = r.modo;
        ok = resultado === c.esperado;
      } else if (c.tipo === 'limite') {
        resultado = limitePalavras(c.modo);
        ok = resultado === c.esperado;
      } else if (c.tipo === 'meds_audio') {
        resultado = medsCitadosNoAudio(c.texto);
        ok = JSON.stringify(resultado.sort()) === JSON.stringify(c.esperado.sort());
      }
    } catch (e) {
      resultado = 'EXCECAO: ' + e.message;
      ok = false;
    }
    if (ok) { passou++; console.log(`OK  [${c.tipo}] ${c.nome || c.modo || c.esperado} -> ${JSON.stringify(resultado)}`); }
    else { falhou++; falhas.push({ caso: c, resultado }); console.log(`FAIL [${c.tipo}] esperado=${c.esperado} obtido=${JSON.stringify(resultado)}`); }
  }
  console.log(`\nTotal: ${passou}/${passou + falhou} OK`);
  if (falhou > 0) {
    console.log('\nFALHAS:');
    for (const f of falhas) console.log(JSON.stringify(f, null, 2));
    process.exit(1);
  }
}

rodar();
