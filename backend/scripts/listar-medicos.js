const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const medicos = await prisma.medico.findMany({
    select: {
      id: true,
      crm: true,
      ufCrm: true,
      usuarioId: true,
      _count: { select: { preConsultas: true } },
    },
  });

  console.log(`\nTotal de medicos: ${medicos.length}\n`);
  for (const m of medicos) {
    const u = await prisma.usuario.findUnique({ where: { id: m.usuarioId }, select: { nome: true, email: true, status: true } });
    console.log(
      `medicoId=${m.id} | CRM ${m.crm}-${m.ufCrm} | usuario=${u?.nome || '?'} | email=${u?.email || '?'} | status=${u?.status || '?'} | PCs=${m._count.preConsultas}`
    );
  }

  await prisma.$disconnect();
})().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
