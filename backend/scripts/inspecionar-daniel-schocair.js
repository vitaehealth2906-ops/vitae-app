// LEITURA APENAS. Pega todos os detalhes do paciente Daniel Garrote Schocair
// pra confirmar se é o "amigo tester" que perdeu medicamentos.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const u = await prisma.usuario.findFirst({
    where: { email: 'schocair@gmail.com' },
    include: {
      perfilSaude: true,
      medicamentos: { orderBy: { criadoEm: 'asc' } },
      alergias: { orderBy: { criadoEm: 'asc' } },
      exames: { orderBy: { criadoEm: 'asc' }, select: { id: true, status: true, criadoEm: true, tipoExame: true } },
      consentimentos: { orderBy: { criadoEm: 'asc' }, select: { tipo: true, aceito: true, criadoEm: true } },
    },
  });

  if (!u) { console.log('Paciente nao encontrado.'); return; }

  const fmtBR = (d) => new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  console.log('================ DANIEL GARROTE SCHOCAIR ================\n');
  console.log(`ID:       ${u.id}`);
  console.log(`Nome:     ${u.nome}`);
  console.log(`Email:    ${u.email}`);
  console.log(`Celular:  ${u.celular}`);
  console.log(`Status:   ${u.status}`);
  console.log(`Criado:   ${fmtBR(u.criadoEm)}`);
  console.log(`Atualiz:  ${fmtBR(u.atualizadoEm)}\n`);

  console.log('--- PerfilSaude ---');
  if (u.perfilSaude) {
    console.log(`Criado em perfil: ${fmtBR(u.perfilSaude.atualizadoEm || u.criadoEm)}`);
    console.log(`Altura:   ${u.perfilSaude.alturaCm}cm`);
    console.log(`Peso:     ${u.perfilSaude.pesoKg}kg`);
    console.log(`Nasc:     ${u.perfilSaude.dataNascimento}`);
    console.log(`Sangue:   ${u.perfilSaude.tipoSanguineo || '?'}`);
  } else {
    console.log('SEM PERFIL');
  }

  console.log(`\n--- Alergias (${u.alergias.length}) ---`);
  u.alergias.forEach(a => {
    console.log(`  - ${a.nome} | gravidade=${a.gravidade || '?'} | criada=${fmtBR(a.criadoEm)} | fonte=${a.fonte || '?'}`);
  });

  console.log(`\n--- Medicamentos (${u.medicamentos.length}) ---`);
  if (u.medicamentos.length === 0) {
    console.log('  ZERO medicamentos no banco.');
  } else {
    u.medicamentos.forEach(m => {
      console.log(`  - ${m.nome} | ativo=${m.ativo} | criado=${fmtBR(m.criadoEm)} | fonte=${m.fonte || '?'}`);
    });
  }

  console.log(`\n--- Consentimentos (${u.consentimentos.length}) ---`);
  u.consentimentos.forEach(c => {
    console.log(`  - ${c.tipo} | aceito=${c.aceito} | em=${fmtBR(c.criadoEm)}`);
  });

  console.log(`\n--- Exames (${u.exames.length}) ---`);
  u.exames.forEach(e => {
    console.log(`  - ${e.tipoExame || '?'} | status=${e.status} | em=${fmtBR(e.criadoEm)}`);
  });

  // Calcular gap entre cadastro do usuario e primeira alergia/med
  console.log('\n=== ANALISE TEMPORAL ===');
  console.log(`Cadastro:           ${fmtBR(u.criadoEm)}`);
  if (u.alergias[0]) {
    const gap = (new Date(u.alergias[0].criadoEm) - new Date(u.criadoEm)) / 1000;
    console.log(`Primeira alergia:   ${fmtBR(u.alergias[0].criadoEm)} (+${gap.toFixed(1)}s)`);
  }
  if (u.medicamentos[0]) {
    const gap = (new Date(u.medicamentos[0].criadoEm) - new Date(u.criadoEm)) / 1000;
    console.log(`Primeiro med:       ${fmtBR(u.medicamentos[0].criadoEm)} (+${gap.toFixed(1)}s)`);
  }
  if (u.consentimentos[0]) {
    const gap = (new Date(u.consentimentos[0].criadoEm) - new Date(u.criadoEm)) / 1000;
    console.log(`Primeiro consent:   ${fmtBR(u.consentimentos[0].criadoEm)} (+${gap.toFixed(1)}s)`);
  }
})().catch(e => { console.error(e); }).finally(() => prisma.$disconnect());
