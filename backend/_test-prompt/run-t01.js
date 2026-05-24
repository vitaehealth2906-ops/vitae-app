// Teste integrado T01 — caso Lucas Borelli real
// Usa Z0+Z1+Z2+Z3+Z4+Z5 mas sem TTS (so o briefing texto)

require('dotenv').config(); // se .env existir, carrega; se nao, OK
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { higienizar } = require(path.join('..', 'src', 'services', 'v4', 'higienizacao'));
const { detectarCluster, obterCluster } = require(path.join('..', 'src', 'services', 'v4', 'detectorCluster'));
const { detectarModo, limitePalavras } = require(path.join('..', 'src', 'services', 'v4', 'detectorModo'));
const { detectarContradicoes } = require(path.join('..', 'src', 'services', 'v4', 'detectorContradicoes'));
const { montarUserPrompt, montarRespostasMap } = require(path.join('..', 'src', 'services', 'v4', 'montagemContexto'));
const { gerarTextoVoz, contarPalavras } = require(path.join('..', 'src', 'services', 'v4', 'promptV4'));
const { validar, formatarCorrecao } = require(path.join('..', 'src', 'services', 'v4', 'validador'));

const PC_ID = '34671191-2157-46b9-9a76-9f8a0cc9f286';

async function main() {
  if (process.env.DATABASE_URL == null && !process.argv.includes('--db')) {
    // fallback: setar DATABASE_URL via arg
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL ausente — seta no env antes de rodar');
  }
  const prisma = new PrismaClient();

  console.log('[T01] Puxando PC do banco...');
  const pc = await prisma.preConsulta.findUnique({ where: { id: PC_ID } });
  if (!pc) throw new Error('PC nao encontrada');
  const paciente = pc.pacienteId ? await prisma.usuario.findUnique({ where: { id: pc.pacienteId } }) : null;
  const perfilSaude = pc.pacienteId ? await prisma.perfilSaude.findUnique({ where: { usuarioId: pc.pacienteId } }) : null;
  const medicamentos = pc.pacienteId ? await prisma.medicamento.findMany({ where: { usuarioId: pc.pacienteId } }) : [];
  const alergias = pc.pacienteId ? await prisma.alergia.findMany({ where: { usuarioId: pc.pacienteId } }) : [];
  const exames = pc.pacienteId ? await prisma.exame.findMany({ where: { usuarioId: pc.pacienteId } }) : [];
  const template = pc.templateId ? await prisma.formTemplate.findUnique({ where: { id: pc.templateId } }) : null;
  const medico = pc.medicoId ? await prisma.medico.findUnique({ where: { id: pc.medicoId }, include: { usuario: { select: { nome: true } } } }) : null;

  await prisma.$disconnect();

  const hoje = new Date('2026-05-24T12:00:00Z');

  // Z0
  const cadastroFiltrado = higienizar({ usuario: paciente, perfilSaude, medicamentos, alergias, exames }, hoje);
  console.log('[Z0] meds ativos:', cadastroFiltrado.medsAtivos.length, '| descontinuados:', cadastroFiltrado.medsDescontinuadosRecentes.length, '| alergias:', cadastroFiltrado.alergias ? cadastroFiltrado.alergias.length : 0);
  console.log('[Z0] exames CONCLUIDO ult 90d:', cadastroFiltrado.examesConcluidos.ultimos90d.length, '| 91-365d:', cadastroFiltrado.examesConcluidos.entre91e365d.length, '| >365d:', cadastroFiltrado.examesConcluidos.acima365d.length, '| ERRO ignorados:', cadastroFiltrado.examesConcluidos.ignoradosPorErro);

  // Z1
  const perguntas = (template && template.perguntas) || pc.templatePerguntas || [];
  const cd = await detectarCluster({ nomeTemplate: template && template.nome, perguntas });
  console.log(`[Z1] cluster: ${cd.clusterId} (${cd.razao}, etapa ${cd.etapa})`);
  const cluster = obterCluster(cd.clusterId);

  // Z2
  const md = detectarModo({ cluster, idadeAnos: cadastroFiltrado.identificacao.idadeAnos, respostas: pc.respostas });
  console.log(`[Z2] modo: ${md.modo} (${md.razao})`);
  const limitePalavrasNum = limitePalavras(md.modo);
  console.log(`[Z2] limite palavras: ${limitePalavrasNum}`);

  // Z3 — contradicoes
  const respostasMap = montarRespostasMap(pc.respostas);
  const contradicoes = detectarContradicoes({
    perguntas,
    respostas: pc.respostas,
    transcricaoAudio: pc.transcricao,
    cadastroFiltrado
  });
  console.log(`[Z3] contradicoes detectadas: ${contradicoes.length}`);
  contradicoes.forEach((c, i) => console.log(`     ${i + 1}. ${c.slice(0, 120)}`));

  // Z3 — montar user prompt
  const userPrompt = montarUserPrompt({
    paciente,
    cadastroFiltrado,
    cluster,
    modo: md.modo,
    modoRazao: md.razao,
    clusterRazao: cd.razao,
    perguntas,
    respostasMap,
    transcricaoCombinada: pc.transcricao,
    contradicoes,
    templateNome: template && template.nome,
    medicoNome: medico && medico.usuario && medico.usuario.nome,
    hoje,
    limitePalavrasNum
  });

  console.log('\n[Z3] user prompt tamanho:', userPrompt.length, 'chars');
  // Salva pra inspecao
  require('fs').writeFileSync(path.join(__dirname, 't01-user-prompt.txt'), userPrompt);

  // Z4 — gerar
  console.log('\n[Z4] chamando Claude...');
  let tentativa = 1;
  let instrucaoCorrecao = null;
  let resultado = null;
  let validacao = null;
  const ctx = {
    modo: md.modo,
    limitePalavrasNum,
    contradicoes,
    cadastroFiltrado,
    transcricaoCombinada: pc.transcricao
  };

  while (tentativa <= 3) {
    const t0 = Date.now();
    resultado = await gerarTextoVoz({ userPrompt, instrucaoCorrecao });
    console.log(`[Z4] tentativa ${tentativa}: ${Date.now() - t0}ms · tokens in=${resultado.usage.input_tokens} out=${resultado.usage.output_tokens}`);
    if (!resultado.parsed) {
      console.log('[Z4] JSON nao parseado, raw:', resultado.raw.slice(0, 300));
      instrucaoCorrecao = 'Resposta anterior nao foi JSON valido. Retorne APENAS JSON sem markdown.';
      tentativa++;
      continue;
    }
    validacao = validar(resultado.parsed, ctx);
    if (validacao.ok) break;
    console.log(`[Z5] tentativa ${tentativa} REPROVADA. Falhas:`);
    validacao.falhas.forEach(f => console.log(`     - ${f.motivo}`));
    instrucaoCorrecao = formatarCorrecao(validacao.falhas);
    tentativa++;
  }

  if (!validacao || !validacao.ok) {
    console.log('\n[T01] FALHA: validacao nao passou em 3 tentativas. Output marcado pra revisao manual.');
  } else {
    console.log('\n[T01] OK validacao passou.');
  }

  if (resultado && resultado.parsed) {
    console.log('\n╔══════ textoVoz ══════╗');
    console.log(resultado.parsed.textoVoz);
    console.log(`(${contarPalavras(resultado.parsed.textoVoz)} palavras — limite ${limitePalavrasNum})`);
    console.log('\n╔══════ pontos_consolidados ══════╗');
    console.log(JSON.stringify(resultado.parsed.pontos_consolidados, null, 2));
    console.log('\n╔══════ exclusoes_aplicadas ══════╗');
    console.log(JSON.stringify(resultado.parsed.exclusoes_aplicadas, null, 2));
    console.log('\n╔══════ red_flags_capturados ══════╗');
    console.log(JSON.stringify(resultado.parsed.red_flags_capturados, null, 2));
    console.log('\n╔══════ nao_capturado ══════╗');
    console.log(JSON.stringify(resultado.parsed.nao_capturado, null, 2));
    require('fs').writeFileSync(path.join(__dirname, 't01-resultado.json'), JSON.stringify(resultado.parsed, null, 2));
  }
}

main().catch(e => { console.error('ERR:', e.message, e.stack); process.exit(1); });
