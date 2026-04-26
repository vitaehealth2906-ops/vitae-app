// Backup logico pre-Agenda v1 (sessao 26-abr-2026).
// Exporta JSON das tabelas criticas pra ter ponto de retorno se algo der errado.
// Schema do modulo Agenda apenas ADICIONA — zero risco de data loss em rollback.
// Mesmo assim, registramos o estado pre-deploy.
//
// Uso: railway run node backend/scripts/backup-pre-agenda.js > backup.json

const prisma = require('../src/utils/prisma');

async function main() {
  const out = {
    timestamp: new Date().toISOString(),
    versao: 'pre-agenda-v1-26abr2026',
    contagem: {},
    amostras: {},
  };

  // Counts (mais rapido — pra ter tamanho do banco no momento)
  out.contagem.usuarios = await prisma.usuario.count();
  out.contagem.medicos = await prisma.medico.count();
  out.contagem.preConsultas = await prisma.preConsulta.count();
  out.contagem.exames = await prisma.exame.count();
  out.contagem.medicamentos = await prisma.medicamento.count();
  out.contagem.alergias = await prisma.alergia.count();
  out.contagem.agendamentos = await prisma.agendamento.count();
  out.contagem.autorizacoes = await prisma.autorizacaoAcesso.count();
  out.contagem.healthScores = await prisma.healthScore.count();

  // Amostras: 5 mais recentes de cada (pra spot-check em rollback)
  out.amostras.usuarios = await prisma.usuario.findMany({
    orderBy: { criadoEm: 'desc' }, take: 5,
    select: { id: true, email: true, tipo: true, status: true, criadoEm: true },
  });
  out.amostras.medicos = await prisma.medico.findMany({
    orderBy: { criadoEm: 'desc' }, take: 5,
    select: { id: true, crm: true, ufCrm: true, especialidade: true, ativo: true },
  });
  out.amostras.preConsultas = await prisma.preConsulta.findMany({
    orderBy: { criadoEm: 'desc' }, take: 5,
    select: { id: true, status: true, pacienteNome: true, criadoEm: true, respondidaEm: true },
  });

  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Erro backup:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
