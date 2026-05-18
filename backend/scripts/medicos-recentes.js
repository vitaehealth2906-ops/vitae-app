const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const medicos = await prisma.medico.findMany({
    orderBy: { criadoEm: 'desc' },
    take: 5,
    select: { id: true, crm: true, criadoEm: true, metricasConfig: true, usuario: { select: { nome: true, email: true } } },
  });
  console.log('5 medicos mais recentes:\n');
  medicos.forEach((m) => {
    const cfg = m.metricasConfig;
    const setupOk = cfg && cfg.setupConcluido === true ? 'SIM' : 'NAO';
    console.log(`${m.criadoEm.toISOString().slice(0,19)} | ${m.usuario.nome.padEnd(25)} | ${m.usuario.email.padEnd(40)} | CRM ${m.crm} | setupOk=${setupOk}`);
    if (cfg) console.log(`  metricasConfig: ${JSON.stringify(cfg)}`);
  });
  await prisma.$disconnect();
})();
