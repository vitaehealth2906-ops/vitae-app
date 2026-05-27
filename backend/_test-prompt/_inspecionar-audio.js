const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const pc = await p.preConsulta.findUnique({
    where: { id: '34671191-2157-46b9-9a76-9f8a0cc9f286' },
    select: { audioSummaryUrl: true, summaryIA: true }
  });
  console.log('AUDIO URL:', pc.audioSummaryUrl);
  console.log('\nTEXTO COMPLETO:\n');
  console.log(pc.summaryIA);
  await p.$disconnect();
})();
