// LEITURA APENAS. Lista pacientes criados nas ultimas 12h e quantos meds/alergias cada um tem.
// Objetivo: provar que o tester de ~17h tem perfil mas zero meds/alergias no banco.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const agora = new Date();
  const desde = new Date(agora.getTime() - 12 * 60 * 60 * 1000); // 12h atras

  const pacientes = await prisma.usuario.findMany({
    where: {
      tipo: 'PACIENTE',
      criadoEm: { gte: desde },
    },
    select: {
      id: true,
      nome: true,
      email: true,
      celular: true,
      status: true,
      criadoEm: true,
      perfilSaude: { select: { id: true, alturaCm: true, pesoKg: true, dataNascimento: true } },
      _count: { select: { medicamentos: true, alergias: true } },
    },
    orderBy: { criadoEm: 'desc' },
  });

  console.log(`\n=== Pacientes criados nas ultimas 12h (desde ${desde.toISOString()}) ===\n`);
  console.log(`Total encontrados: ${pacientes.length}\n`);

  for (const p of pacientes) {
    // contagem detalhada de meds (ativos vs total) — pra detectar se algum foi salvo com ativo=false
    const medsAtivos = await prisma.medicamento.count({ where: { usuarioId: p.id, ativo: true } });
    const medsTotal  = await prisma.medicamento.count({ where: { usuarioId: p.id } });

    const horaBR = new Date(p.criadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    console.log('-----------------------------------------------------------');
    console.log(`Nome:      ${p.nome || '(sem nome)'}`);
    console.log(`Email:     ${p.email || '(sem email)'}`);
    console.log(`Celular:   ${p.celular || '(sem celular)'}`);
    console.log(`Status:    ${p.status}`);
    console.log(`Criado:    ${horaBR}`);
    console.log(`Perfil:    ${p.perfilSaude ? `OK (nasc=${p.perfilSaude.dataNascimento || '?'}, altura=${p.perfilSaude.alturaCm || '?'}cm, peso=${p.perfilSaude.pesoKg || '?'}kg)` : 'NAO TEM'}`);
    console.log(`Meds:      total=${medsTotal} | ativos=${medsAtivos}`);
    console.log(`Alergias:  ${p._count.alergias}`);
  }

  console.log('\n=== Suspeitos do bug (perfil OK + zero meds + zero alergias) ===\n');
  const suspeitos = [];
  for (const p of pacientes) {
    if (p.perfilSaude && p._count.medicamentos === 0 && p._count.alergias === 0) {
      suspeitos.push(p);
    }
  }
  if (suspeitos.length === 0) {
    console.log('Nenhum.');
  } else {
    suspeitos.forEach(s => {
      const horaBR = new Date(s.criadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      console.log(`- ${s.nome} (${s.email}) criado ${horaBR}`);
    });
  }
})().catch(e => { console.error(e); }).finally(() => prisma.$disconnect());
