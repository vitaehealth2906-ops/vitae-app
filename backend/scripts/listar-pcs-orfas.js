const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const orfas = await prisma.preConsulta.findMany({
    where: { pacienteId: null, deletadoEm: null },
    select: {
      id: true,
      pacienteNome: true,
      pacienteTel: true,
      pacienteEmail: true,
      status: true,
      respondidaEm: true,
      criadoEm: true,
    },
    orderBy: { criadoEm: 'desc' },
  });

  console.log(`\nTotal de PCs orfas (pacienteId=null, nao deletadas): ${orfas.length}\n`);
  console.log('='.repeat(120));

  orfas.forEach((pc, i) => {
    const respondida = pc.respondidaEm ? pc.respondidaEm.toISOString().slice(0, 10) : '-';
    const criada = pc.criadoEm.toISOString().slice(0, 10);
    console.log(
      `${(i + 1).toString().padStart(2)}. ${pc.id.slice(0, 8)}... | ${(pc.pacienteNome || '(sem nome)').padEnd(30)} | ${(pc.pacienteTel || '-').padEnd(18)} | status=${pc.status.padEnd(12)} | respondida=${respondida} | criada=${criada}`
    );
  });

  console.log('='.repeat(120));

  const porStatus = orfas.reduce((acc, pc) => {
    acc[pc.status] = (acc[pc.status] || 0) + 1;
    return acc;
  }, {});
  console.log('\nBreakdown por status:');
  Object.entries(porStatus).forEach(([s, c]) => console.log(`  ${s}: ${c}`));

  await prisma.$disconnect();
})().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
