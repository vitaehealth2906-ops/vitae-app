/**
 * Motor de calculo de scores de saude da VITAE.
 * Calcula 4 pilares (0-100): Sono, Atividade, Produtividade e Exames.
 * O Score Geral e a media ponderada dos pilares disponiveis.
 */

const prisma = require('../utils/prisma');

const SEIS_MESES_MS = 6 * 30 * 24 * 60 * 60 * 1000;

function mapear1a5para20a100(valor) {
  if (valor == null || valor < 1 || valor > 5) return null;
  return 20 + (valor - 1) * 20;
}

function media(valores) {
  const validos = valores.filter((v) => v != null);
  if (validos.length === 0) return null;
  return validos.reduce((a, b) => a + b, 0) / validos.length;
}

function clamp(valor) {
  if (valor == null) return null;
  return Math.max(0, Math.min(100, Math.round(valor)));
}

function buscarParametro(parametros, nomesBusca) {
  const nomes = Array.isArray(nomesBusca) ? nomesBusca : [nomesBusca];
  for (const param of parametros) {
    const nomeParam = (param.nome || '').toLowerCase();
    for (const busca of nomes) {
      if (nomeParam.includes(busca.toLowerCase())) return param;
    }
  }
  return null;
}

function parametroNormal(parametros, nomesBusca) {
  const param = buscarParametro(parametros, nomesBusca);
  return param ? (param.classificacao || param.status || '').toUpperCase() === 'NORMAL' : null;
}

function calcularScoreSono(checkinRecente, perfil, parametrosExames) {
  const pontos = [];
  let bonus = 0;

  if (checkinRecente && checkinRecente.sonoQualidade != null) {
    pontos.push(mapear1a5para20a100(checkinRecente.sonoQualidade));
  }

  if (perfil && perfil.horasSono != null) {
    const horas = parseFloat(perfil.horasSono);
    if (horas >= 7 && horas <= 8) bonus = 10;
    else if (horas < 6) bonus = -10;
    else if (horas > 9) bonus = -5;
  }

  if (parametrosExames.length > 0) {
    const cortisol = parametroNormal(parametrosExames, ['cortisol']);
    if (cortisol === true) bonus += 5;
    else if (cortisol === false) bonus -= 5;
  }

  const baseSono = media(pontos);
  if (baseSono == null) return { score: null, fatores: [] };
  return { score: clamp(baseSono + bonus), fatores: [] };
}

function calcularScoreAtividade(checkinRecente, perfil, parametrosExames) {
  const pontos = [];
  let bonus = 0;

  if (checkinRecente && checkinRecente.atividadeFisica) {
    const mapAtividade = { nenhuma: 25, leve: 50, moderada: 75, intensa: 95 };
    const scoreCheckin = mapAtividade[checkinRecente.atividadeFisica.toLowerCase()];
    if (scoreCheckin != null) pontos.push(scoreCheckin);
  }

  if (perfil && perfil.nivelAtividade) {
    const mapNivel = { sedentario: 30, leve: 50, moderado: 70, ativo: 85, muito_ativo: 95 };
    const scorePerfil = mapNivel[perfil.nivelAtividade.toLowerCase()];
    if (scorePerfil != null) pontos.push(scorePerfil);
  }

  if (perfil && perfil.pesoKg && perfil.alturaCm) {
    const alturaM = Number(perfil.alturaCm) / 100;
    const imc = Number(perfil.pesoKg) / (alturaM * alturaM);
    if (imc >= 18.5 && imc <= 24.9) bonus += 5;
    else if (imc >= 25 && imc <= 29.9) bonus -= 3;
    else if (imc > 30) bonus -= 5;
  }

  const baseAtividade = media(pontos);
  if (baseAtividade == null) return { score: null, fatores: [] };
  return { score: clamp(baseAtividade + bonus), fatores: [] };
}

function calcularScoreProdutividade(checkinRecente) {
  let scoreProd = null;
  let scoreHumor = null;

  if (checkinRecente) {
    if (checkinRecente.produtividade != null) scoreProd = mapear1a5para20a100(checkinRecente.produtividade);
    if (checkinRecente.humor != null) scoreHumor = mapear1a5para20a100(checkinRecente.humor);
  }

  if (scoreProd == null && scoreHumor == null) return { score: null, fatores: [] };

  let base;
  if (scoreProd != null && scoreHumor != null) base = scoreProd * 0.6 + scoreHumor * 0.4;
  else base = scoreProd || scoreHumor;

  return { score: clamp(base), fatores: [] };
}

function calcularScoreExame(examesRecentes) {
  if (!examesRecentes || examesRecentes.length === 0) {
    return { score: null, fatores: [] };
  }

  let totalNormal = 0, totalAtencao = 0, totalCritico = 0;

  for (const exame of examesRecentes) {
    const parametros = exame.parametros || [];
    for (const param of parametros) {
      const c = (param.classificacao || param.status || '').toUpperCase();
      if (c === 'NORMAL') totalNormal++;
      else if (c === 'ATENCAO') totalAtencao++;
      else if (c === 'CRITICO') totalCritico++;
    }
  }

  const total = totalNormal + totalAtencao + totalCritico;
  if (total === 0) return { score: null, fatores: [] };

  let score = (totalNormal * 100 + totalAtencao * 50 + totalCritico * 10) / total;

  const agora = Date.now();
  const temRecente = examesRecentes.some((e) => {
    const d = e.dataExame || e.criadoEm;
    return d && (agora - new Date(d).getTime() < SEIS_MESES_MS);
  });
  if (temRecente) score += 5;

  return { score: clamp(score), fatores: [] };
}

async function calcularScores(userId) {
  if (!userId) throw new Error('ID do usuario e obrigatorio.');

  const [perfil, exames, checkins] = await Promise.all([
    prisma.perfilSaude.findUnique({ where: { usuarioId: userId } }),
    prisma.exame.findMany({
      where: { usuarioId: userId, status: 'CONCLUIDO' },
      include: { parametros: true },
      orderBy: { criadoEm: 'desc' },
      take: 10,
    }),
    prisma.checkinSemanal.findMany({
      where: { usuarioId: userId },
      orderBy: { criadoEm: 'desc' },
      take: 30,
    }),
  ]);

  const fontesDados = [];
  if (perfil) fontesDados.push('perfil');
  if (exames.length > 0) fontesDados.push(`${exames.length} exame(s)`);
  if (checkins.length > 0) fontesDados.push(`${checkins.length} check-in(s)`);

  const checkinRecente = checkins.length > 0 ? checkins[0] : null;

  const todosParametros = [];
  for (const exame of exames) {
    if (exame.parametros && Array.isArray(exame.parametros)) {
      todosParametros.push(...exame.parametros);
    }
  }

  const r1 = calcularScoreSono(checkinRecente, perfil, todosParametros);
  const r2 = calcularScoreAtividade(checkinRecente, perfil, todosParametros);
  const r3 = calcularScoreProdutividade(checkinRecente);
  const r4 = calcularScoreExame(exames);

  const pilares = [
    { score: r4.score, pesoBase: 0.40 },
    { score: r1.score, pesoBase: 0.20 },
    { score: r2.score, pesoBase: 0.20 },
    { score: r3.score, pesoBase: 0.20 },
  ];

  const disponiveis = pilares.filter((p) => p.score != null);
  let scoreGeral = null;

  if (disponiveis.length > 0) {
    const pesoTotal = disponiveis.reduce((s, p) => s + p.pesoBase, 0);
    scoreGeral = clamp(disponiveis.reduce((s, p) => s + p.score * (p.pesoBase / pesoTotal), 0));
  }

  const confianca =
    exames.length >= 3 && checkins.length >= 3 ? 'alta' :
    exames.length >= 2 && checkins.length >= 2 ? 'media' : 'baixa';

  return {
    scoreGeral,
    scoreSono: r1.score,
    scoreAtividade: r2.score,
    scoreProdutividade: r3.score,
    scoreExame: r4.score,
    confianca,
    fontesDados,
  };
}

module.exports = { calcularScores };
