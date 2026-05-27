// LEITURA APENAS. Mede o tamanho do estrago: quantos pacientes ja podem ter sido afetados
// pelo bug fire-and-forget de medicamentos/alergias no quiz.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  // Considera APENAS pacientes "reais" (sem email @vitae-teste.local, sem nome "Maria Teste Robo" etc)
  const todos = await prisma.usuario.findMany({
    where: { tipo: 'PACIENTE' },
    select: {
      id: true, nome: true, email: true, criadoEm: true,
      perfilSaude: { select: { id: true, alturaCm: true, pesoKg: true } },
      _count: { select: { medicamentos: true, alergias: true } },
    },
    orderBy: { criadoEm: 'desc' },
  });

  // Filtra fora pacientes-robo de teste automatizado
  const reais = todos.filter(u =>
    u.email &&
    !u.email.includes('@vitae-teste.local') &&
    !u.email.includes('robo-') &&
    !(u.nome || '').toLowerCase().includes('teste robo') &&
    !(u.nome || '').toLowerCase().includes('teste prod')
  );

  console.log(`\n=== BLAST RADIUS - PACIENTES REAIS ===`);
  console.log(`Total pacientes (sem robos): ${reais.length}`);

  // Padrao SUSPEITO de bug: perfil completo (terminou o quiz) MAS:
  //   tem alergias > 0 OU meds > 0 (preencheu algo no quiz)
  //   E pelo menos um dos dois e zero (perdeu o outro)
  // Casos especialmente fortes: alergias > 0 + meds = 0 (mesma assinatura do Daniel)
  const completos = reais.filter(u => u.perfilSaude && (u.perfilSaude.alturaCm || u.perfilSaude.pesoKg));

  const padraoDaniel = completos.filter(u =>
    u._count.alergias > 0 && u._count.medicamentos === 0
  );
  const padraoInverso = completos.filter(u =>
    u._count.medicamentos > 0 && u._count.alergias === 0
  );
  const ambosZero = completos.filter(u =>
    u._count.medicamentos === 0 && u._count.alergias === 0
  );
  const ambosOk = completos.filter(u =>
    u._count.medicamentos > 0 && u._count.alergias > 0
  );

  console.log(`Pacientes que completaram o quiz: ${completos.length}`);
  console.log(`  ALARMANTES: alergia>0 + meds=0 (assinatura Daniel): ${padraoDaniel.length}`);
  console.log(`  Inverso: meds>0 + alergia=0: ${padraoInverso.length}`);
  console.log(`  Ambos zero (nao preencheu ou perdeu ambos): ${ambosZero.length}`);
  console.log(`  Ambos OK (caso de sucesso): ${ambosOk.length}\n`);

  console.log(`--- ALARMANTES (perderam meds, alergia chegou) ---`);
  padraoDaniel.slice(0, 15).forEach(u => {
    const horaBR = new Date(u.criadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    console.log(`  - ${u.nome} (${u.email}) | criado ${horaBR} | aler=${u._count.alergias} med=${u._count.medicamentos}`);
  });
  if (padraoDaniel.length > 15) console.log(`  ... +${padraoDaniel.length - 15} mais`);

  console.log(`\n--- INVERSO (perderam alergia, meds chegou) ---`);
  padraoInverso.slice(0, 10).forEach(u => {
    const horaBR = new Date(u.criadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    console.log(`  - ${u.nome} (${u.email}) | criado ${horaBR} | aler=${u._count.alergias} med=${u._count.medicamentos}`);
  });

  // Estatistica
  console.log(`\n=== TAXA DE PERDA ESTIMADA ===`);
  const expostos = completos.length;
  const perdaParcial = padraoDaniel.length + padraoInverso.length;
  const taxaParcial = expostos > 0 ? ((perdaParcial / expostos) * 100).toFixed(1) : 0;
  console.log(`De ${expostos} pacientes que terminaram o quiz, ${perdaParcial} mostram padrao de perda parcial (${taxaParcial}%)`);
  console.log(`Importante: ambosZero (${ambosZero.length}) pode ser "nao preencheu" OU "perdeu ambos" - ambiguo.\n`);
})().catch(e => { console.error(e); }).finally(() => prisma.$disconnect());
