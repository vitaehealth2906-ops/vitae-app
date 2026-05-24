// CAMADA Z0 — Higienizacao do cadastro do paciente antes de virar input pra IA
// Aplica os filtros M1-M6 do plano: meds vencidos, exames ERRO, lixo, idade, alergias vazias, habitos null

const LIXO_NOMES_EXATOS = [
  'soro fisiologico', 'soro fisiológico', 'soro fisiologico 0.9', 'soro fisiologico 0,9',
  'agua', 'água', 'agua destilada',
];

const SUPLEMENTOS_SEM_DOSE_OK = [
  'creatina', 'creatina monohidratada', 'whey', 'whey protein', 'whey isolado',
  'multivitaminico', 'omega 3', 'omega-3'
];

function calcularIdade(dataNascimento, hoje = new Date()) {
  if (!dataNascimento) return null;
  const nasc = new Date(dataNascimento);
  if (isNaN(nasc.getTime())) return null;
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

function diffDias(a, b) {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function nomeNormalizado(s) {
  return (s || '').toString().toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function isMedLixo(nome, dosagem) {
  const n = nomeNormalizado(nome);
  if (!n || n.length < 3) return true;
  // String aleatoria tipo "ASDFGHJK" (so maiuscula sem dose)
  if (/^[A-Z]+$/.test((nome || '').toString()) && (nome || '').toString().length > 8) return true;
  // Soro fisiologico sem dose especifica de prescricao
  for (const lixo of LIXO_NOMES_EXATOS) {
    if (n.includes(lixo)) return true;
  }
  return false;
}

function isMedSemDoseAceitavel(nome) {
  const n = nomeNormalizado(nome);
  return SUPLEMENTOS_SEM_DOSE_OK.some(s => n.includes(s));
}

function filtrarMedsAtivos(meds, hoje) {
  return meds
    .filter(m => m.ativo === true)
    .filter(m => !m.dataFim || new Date(m.dataFim) >= hoje)
    .filter(m => !isMedLixo(m.nome, m.dosagem))
    .filter(m => m.dosagem || isMedSemDoseAceitavel(m.nome));
}

function filtrarMedsDescontinuadosRecentes(meds, hoje) {
  return meds
    .filter(m => m.dataFim && new Date(m.dataFim) < hoje)
    .filter(m => diffDias(hoje, new Date(m.dataFim)) <= 90)
    .filter(m => !isMedLixo(m.nome, m.dosagem));
}

function categorizarExames(exames, hoje) {
  const concluidos = exames.filter(e => e.status === 'CONCLUIDO');
  const erros = exames.filter(e => e.status !== 'CONCLUIDO').length;
  const grupo = (min, max) => concluidos.filter(e => {
    if (!e.data) return false;
    const d = diffDias(hoje, new Date(e.data));
    if (max == null) return d >= min;
    return d >= min && d <= max;
  });
  return {
    ultimos90d: grupo(0, 90),
    entre91e365d: grupo(91, 365),
    acima365d: grupo(366, null),
    ignoradosPorErro: erros
  };
}

/**
 * Recebe { usuario, perfilSaude, medicamentos, alergias, exames } direto do Prisma.
 * Devolve estrutura limpa pronta pra IA receber.
 */
function higienizar({ usuario, perfilSaude, medicamentos, alergias, exames }, hoje = new Date()) {
  const meds = Array.isArray(medicamentos) ? medicamentos : [];
  const alg = Array.isArray(alergias) ? alergias : [];
  const exs = Array.isArray(exames) ? exames : [];

  const idade = calcularIdade(perfilSaude && perfilSaude.dataNascimento, hoje);

  return {
    identificacao: {
      nome: usuario && usuario.nome,
      sexo: perfilSaude && perfilSaude.genero,
      idadeAnos: idade,
      altura: perfilSaude && perfilSaude.alturaCm,
      peso: perfilSaude && perfilSaude.pesoKg,
      tipoSanguineo: perfilSaude && perfilSaude.tipoSanguineo
    },
    medsAtivos: filtrarMedsAtivos(meds, hoje),
    medsDescontinuadosRecentes: filtrarMedsDescontinuadosRecentes(meds, hoje),
    alergias: alg.length > 0 ? alg : null,
    alergiasMarcador: alg.length === 0
      ? 'NENHUMA REGISTRADA NO CADASTRO (paciente pode ter alergias nao informadas no cadastro)'
      : null,
    cirurgias: (perfilSaude && perfilSaude.cirurgias) || [],
    historicoFamiliar: (perfilSaude && perfilSaude.historicoFamiliar) || [],
    examesConcluidos: categorizarExames(exs, hoje),
    habitos: {
      fuma: perfilSaude && perfilSaude.fuma,
      alcool: perfilSaude && perfilSaude.alcool,
      sono: perfilSaude && perfilSaude.horasSono,
      atividade: perfilSaude && perfilSaude.nivelAtividade
    }
  };
}

module.exports = {
  higienizar,
  calcularIdade,
  isMedLixo,
  filtrarMedsAtivos,
  filtrarMedsDescontinuadosRecentes,
  categorizarExames
};
