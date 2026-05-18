const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const MEDICO_ID = 'f49c67cb-dfb6-4517-8311-0c09b466c6e9';

  // Simula o que o endpoint GET /medico/metricas faz
  try {
    const medico = await prisma.medico.findUnique({
      where: { id: MEDICO_ID },
      select: {
        id: true,
        metricasConfig: true,
        tempoMedioConsulta: true,
        tempoAnamneseAtual: true,
        valorConsulta: true,
      },
    });
    console.log('Medico encontrado:');
    console.log('  metricasConfig:', JSON.stringify(medico.metricasConfig, null, 2));
    console.log('  tempoMedioConsulta:', medico.tempoMedioConsulta);
    console.log('  tempoAnamneseAtual:', medico.tempoAnamneseAtual);
    console.log('  valorConsulta:', medico.valorConsulta);

    // Simula GET /perfil
    const usuario = await prisma.usuario.findFirst({
      where: { medico: { id: MEDICO_ID } },
      include: { medico: true, perfilSaude: true },
    });
    console.log('\nUsuario do medico:');
    console.log('  id:', usuario.id);
    console.log('  nome:', usuario.nome);
    console.log('  tipo:', usuario.tipo);
    console.log('  email:', usuario.email);

    // Tenta o calcularMetricas service
    try {
      const calcularMetricas = require('../src/services/calcularMetricas');
      const pcs = await prisma.preConsulta.findMany({
        where: { medicoId: MEDICO_ID, deletadoEm: null, status: 'RESPONDIDA' },
      });
      console.log('\nPCs respondidas:', pcs.length);
      const resultado = calcularMetricas(medico, pcs, '30dias');
      console.log('\nResultado calcularMetricas:', JSON.stringify(resultado, null, 2));
    } catch (e) {
      console.log('\nERRO em calcularMetricas:', e.message);
      console.log(e.stack);
    }
  } catch (e) {
    console.log('ERRO:', e.message);
    console.log(e.stack);
  }
  await prisma.$disconnect();
})();
