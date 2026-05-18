const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const m = await prisma.medico.findFirst({
    where: { crm: '1257890' },
    include: { usuario: { include: { perfilSaude: true } } },
  });
  console.log('Medico Dr Gilberto Andrade (completo):\n');
  console.log(JSON.stringify(m, null, 2));
})().catch(e => { console.error(e); }).finally(() => prisma.$disconnect());
