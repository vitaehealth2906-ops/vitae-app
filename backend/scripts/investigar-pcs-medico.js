const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const MEDICO_ID = 'f49c67cb-dfb6-4517-8311-0c09b466c6e9';
  console.log(`Medico Lucas Borelli (CRM 09876543-SP) | medicoId=${MEDICO_ID}\n`);

  const pcs = await prisma.preConsulta.findMany({
    where: { medicoId: MEDICO_ID, deletadoEm: null },
    select: {
      id: true,
      pacienteId: true,
      pacienteNome: true,
      pacienteTel: true,
      pacienteEmail: true,
      status: true,
      respondidaEm: true,
      criadoEm: true,
      paciente: { select: { id: true, nome: true, email: true, status: true, perfilSaude: { select: { id: true } } } },
    },
    orderBy: { criadoEm: 'desc' },
  });

  console.log(`Total PCs do medico (nao deletadas): ${pcs.length}\n`);
  console.log('='.repeat(140));
  pcs.forEach((pc, i) => {
    const respondida = pc.respondidaEm ? pc.respondidaEm.toISOString().slice(0, 10) : '-';
    const criada = pc.criadoEm.toISOString().slice(0, 10);
    const pid = pc.pacienteId ? pc.pacienteId.slice(0, 8) + '...' : 'NULL    ';
    const userExiste = pc.paciente ? 'sim' : 'NAO';
    const userNome = pc.paciente?.nome || '-';
    const userDeletado = pc.paciente?.status === 'ATIVO' ? 'ativo' : (pc.paciente?.status || '-');
    const temPerfil = pc.paciente?.perfilSaude ? 'sim' : 'NAO';
    console.log(
      `${(i + 1).toString().padStart(2)}. PC nome=${(pc.pacienteNome || '?').padEnd(22)} | st=${pc.status.padEnd(11)} | resp=${respondida} | pacId=${pid} | UserExiste=${userExiste} | UserNome=${userNome.padEnd(22)} | ${userDeletado.padEnd(8)} | Perfil=${temPerfil}`
    );
  });
  console.log('='.repeat(140));

  // Verifica AutorizacaoAcesso
  const autorizacoes = await prisma.autorizacaoAcesso.findMany({
    where: { medicoId: MEDICO_ID },
    select: { pacienteId: true, ativo: true, expiraEm: true, paciente: { select: { nome: true } } },
  });
  console.log(`\nAutorizacoes de acesso (${autorizacoes.length}):`);
  autorizacoes.forEach((a) => {
    const ativo = a.ativo ? 'ATIVO' : 'inativo';
    const exp = a.expiraEm ? a.expiraEm.toISOString().slice(0, 10) : 'sem-exp';
    console.log(`  ${a.paciente?.nome || '?'} | ${ativo} | expira ${exp}`);
  });

  await prisma.$disconnect();
})().catch((e) => {
  console.error('ERRO:', e.message);
  console.error(e.stack);
  process.exit(1);
});
