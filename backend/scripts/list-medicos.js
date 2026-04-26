// Lista medicos cadastrados pra dark launch.
const prisma = require('../src/utils/prisma');

async function main() {
  const u = await prisma.usuario.findMany({
    where: { tipo: 'MEDICO' },
    include: { medico: { select: { id: true, crm: true, especialidade: true, ativo: true } } },
    orderBy: { criadoEm: 'asc' },
  });
  console.log(JSON.stringify(u.map(x => ({
    usuarioId: x.id, email: x.email, nome: x.nome, status: x.status,
    medicoId: x.medico?.id, crm: x.medico?.crm, esp: x.medico?.especialidade, ativo: x.medico?.ativo,
  })), null, 2));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
