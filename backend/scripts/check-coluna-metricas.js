const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const cols = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'medicos'
        AND column_name IN ('metricas_config', 'tempo_medio_consulta', 'valor_consulta', 'tempo_anamnese_atual')
      ORDER BY column_name;
    `;
    console.log('Colunas relacionadas a metricas na tabela "medicos":\n');
    if (cols.length === 0) {
      console.log('  NENHUMA encontrada — migration pendente!');
    } else {
      cols.forEach((c) => console.log(`  ${c.column_name.padEnd(28)} | ${c.data_type.padEnd(20)} | nullable=${c.is_nullable}`));
    }

    console.log('\nTesta acesso ao campo metricasConfig via Prisma client:');
    const medico = await prisma.medico.findFirst({ select: { id: true, metricasConfig: true } });
    if (!medico) console.log('  Nenhum medico no banco');
    else console.log(`  medicoId=${medico.id.slice(0,8)}... | metricasConfig=${JSON.stringify(medico.metricasConfig)}`);
  } catch (e) {
    console.log('ERRO ao acessar metricasConfig:', e.message);
  }
  await prisma.$disconnect();
})();
