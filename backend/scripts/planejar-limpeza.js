const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

(async () => {
  const MEDICO_ID = 'f49c67cb-dfb6-4517-8311-0c09b466c6e9';
  const MEDICO_EMAIL = 'valveeumudei1107@gmail.com';

  // Encontrar o Usuario do medico
  const medico = await prisma.medico.findUnique({
    where: { id: MEDICO_ID },
    select: { usuarioId: true },
  });
  const medicoUsuarioId = medico.usuarioId;
  console.log(`Medico Usuario ID (NAO apagar nunca): ${medicoUsuarioId}`);

  // PCs do medico (9)
  const pcsMedico = await prisma.preConsulta.findMany({
    where: { medicoId: MEDICO_ID, deletadoEm: null },
    select: { id: true, pacienteNome: true, pacienteId: true, status: true },
  });

  // PCs orfas (3)
  const pcsOrfas = await prisma.preConsulta.findMany({
    where: { pacienteId: null, deletadoEm: null },
    select: { id: true, pacienteNome: true, status: true },
  });

  // Usuarios paciente unicos das PCs do medico
  const pacienteIds = [...new Set(pcsMedico.map((pc) => pc.pacienteId).filter(Boolean))];
  const pacientes = await prisma.usuario.findMany({
    where: { id: { in: pacienteIds } },
    select: { id: true, nome: true, email: true, status: true, tipo: true },
  });

  console.log('\n=== PLANO DE LIMPEZA ===\n');

  console.log(`PCs do medico Lucas a apagar (soft-delete em PreConsulta.deletadoEm): ${pcsMedico.length}`);
  pcsMedico.forEach((pc) => console.log(`  - ${pc.id.slice(0, 8)} | ${pc.pacienteNome} | ${pc.status}`));

  console.log(`\nPCs orfas a apagar (soft-delete): ${pcsOrfas.length}`);
  pcsOrfas.forEach((pc) => console.log(`  - ${pc.id.slice(0, 8)} | ${pc.pacienteNome} | ${pc.status}`));

  console.log(`\nContas Usuario paciente a marcar como EXCLUIDO (status field): ${pacientes.length}`);
  for (const p of pacientes) {
    const ehMedico = p.id === medicoUsuarioId ? '<<< MEDICO LUCAS — NAO APAGAR' : '';
    console.log(`  - ${p.id.slice(0, 8)} | ${p.nome} | ${p.email} | tipo=${p.tipo} | status=${p.status} ${ehMedico}`);
  }

  // VALIDACAO CRITICA
  const conflito = pacientes.find((p) => p.id === medicoUsuarioId);
  if (conflito) {
    console.log('\n!!! ATENCAO: Uma das PCs aponta pacienteId para o proprio medico Lucas. Esse Usuario sera EXCLUIDO da lista de exclusao automaticamente.');
  }
  if (pacientes.some((p) => p.email === MEDICO_EMAIL)) {
    console.log('!!! ATENCAO: Email do medico Lucas detectado nas contas paciente. Sera filtrado.');
  }

  const pacientesSafe = pacientes.filter((p) => p.id !== medicoUsuarioId && p.email !== MEDICO_EMAIL);
  console.log(`\nContas que serao realmente excluidas (sem o medico): ${pacientesSafe.length}`);
  pacientesSafe.forEach((p) => console.log(`  - ${p.nome} | ${p.email}`));

  // BACKUP em JSON
  const backupsDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFile = path.join(backupsDir, `pre-limpeza-${stamp}.json`);

  // Pegar dados completos pra backup
  const pcsBackup = await prisma.preConsulta.findMany({
    where: {
      OR: [
        { id: { in: [...pcsMedico, ...pcsOrfas].map((pc) => pc.id) } },
      ],
    },
  });
  const pacientesBackup = await prisma.usuario.findMany({
    where: { id: { in: pacientesSafe.map((p) => p.id) } },
    include: { perfilSaude: true },
  });

  fs.writeFileSync(
    backupFile,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        medico: { id: MEDICO_ID, usuarioId: medicoUsuarioId, email: MEDICO_EMAIL },
        preConsultas: pcsBackup,
        usuariosPaciente: pacientesBackup,
      },
      null,
      2
    )
  );

  console.log(`\nBackup salvo em: ${backupFile}`);
  console.log(`Tamanho: ${(fs.statSync(backupFile).size / 1024).toFixed(1)} KB`);

  console.log('\n=== TOTAIS ===');
  console.log(`PCs a soft-delete: ${pcsMedico.length + pcsOrfas.length}`);
  console.log(`Usuarios paciente a marcar como EXCLUIDO: ${pacientesSafe.length}`);
  console.log('\nNADA FOI APAGADO AINDA. Rode executar-limpeza.js para confirmar.');

  await prisma.$disconnect();
})().catch((e) => {
  console.error('ERRO:', e.message);
  console.error(e.stack);
  process.exit(1);
});
