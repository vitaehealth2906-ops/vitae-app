/* Aplica migration 20260521_recado_paciente_e_contador_trocas
   Verifica estado antes/depois pra garantir que rodou.
   Uso: DATABASE_URL=... node scripts/apply-migration-21mai.js
*/
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB = process.env.DATABASE_URL;
if (!DB) { console.error('DATABASE_URL nao definida'); process.exit(1); }

const SQL_FILE = path.join(__dirname, '..', 'prisma', 'migrations', '20260521_recado_paciente_e_contador_trocas', 'migration.sql');

(async () => {
  const client = new Client({ connectionString: DB });
  await client.connect();
  console.log('Conectado.');

  // ESTADO ANTES
  console.log('\n=== ESTADO ANTES ===');
  const antes = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_name IN ('agendamentos','agenda_slots')
      AND column_name IN ('recado_paciente','contador_trocas','propostas_atuais')
    ORDER BY table_name, column_name;
  `);
  console.log(`Colunas novas ja existentes: ${antes.rows.length}`);
  antes.rows.forEach(r => console.log(`  ${r.table_name}.${r.column_name}`));

  // APLICA
  console.log('\n=== APLICANDO MIGRATION ===');
  const sql = fs.readFileSync(SQL_FILE, 'utf-8');
  // Remove comentarios SQL pra log limpo
  const sqlExec = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  await client.query(sqlExec);
  console.log('SQL executado.');

  // ESTADO DEPOIS
  console.log('\n=== ESTADO DEPOIS ===');
  const depois = await client.query(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name IN ('agendamentos','agenda_slots')
      AND column_name IN ('recado_paciente','contador_trocas','propostas_atuais')
    ORDER BY table_name, column_name;
  `);
  console.log(`Total de colunas novas presentes: ${depois.rows.length}/4`);
  depois.rows.forEach(r => console.log(`  ${r.table_name}.${r.column_name} (${r.data_type}, nullable=${r.is_nullable}, default=${r.column_default || 'nenhum'})`));

  // VERIFICACAO
  const expected = [
    { table_name: 'agenda_slots', column_name: 'recado_paciente' },
    { table_name: 'agendamentos', column_name: 'contador_trocas' },
    { table_name: 'agendamentos', column_name: 'propostas_atuais' },
    { table_name: 'agendamentos', column_name: 'recado_paciente' },
  ];
  const got = depois.rows.map(r => `${r.table_name}.${r.column_name}`).sort();
  const expectedKeys = expected.map(e => `${e.table_name}.${e.column_name}`).sort();
  const ok = JSON.stringify(got) === JSON.stringify(expectedKeys);

  console.log('\n=== RESULTADO ===');
  if (ok) console.log('✅ MIGRATION APLICADA COM SUCESSO');
  else {
    console.log('❌ MIGRATION INCOMPLETA');
    console.log('Esperado:', expectedKeys);
    console.log('Encontrado:', got);
    process.exitCode = 1;
  }

  // Contagem de registros pra confirmar que dados antigos ficaram intactos
  const ag = await client.query('SELECT COUNT(*) FROM agendamentos');
  const sl = await client.query('SELECT COUNT(*) FROM agenda_slots');
  console.log(`\nDados intactos: agendamentos=${ag.rows[0].count}, agenda_slots=${sl.rows[0].count}`);

  await client.end();
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
