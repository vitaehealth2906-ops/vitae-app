// ============================================
// Sessão 22 (2026-05-09) — Aplicar migration metricas honestas
// ============================================
// Adiciona coluna `metricas_config JSONB` na tabela `medicos`.
// Risco BAIXO: ADD COLUMN nullable, não toca em dados existentes.
//
// Faz backup da tabela `medicos` em JSON antes (pg_dump indisponível local).
// ============================================

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL não setada. Rode via: railway run -- node scripts/aplicar-migration-22.js');
    process.exit(1);
  }

  // Supabase requer SSL com rejectUnauthorized=false (cert da raiz não está na CA padrão)
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('========================================');
    console.log('VITAE — Migration metricas_honestas v1');
    console.log('========================================\n');

    await client.connect();
    console.log('Conectado ao banco.\n');

    // 1) Snapshot da tabela medicos ANTES
    console.log('[1/4] Backup da tabela medicos...');
    const antes = await client.query('SELECT * FROM medicos');
    console.log(`     ${antes.rows.length} médicos encontrados.`);

    const dataDir = path.resolve(__dirname, '..', 'backups');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFile = path.join(dataDir, `medicos-pre-metricas-honestas-${stamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(antes.rows, null, 2));
    console.log(`     Backup salvo em ${backupFile}\n`);

    // 2) Verifica se a coluna já existe (idempotência)
    console.log('[2/4] Verificando estado atual...');
    const colCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'medicos' AND column_name = 'metricas_config'
    `);
    if (colCheck.rows.length > 0) {
      console.log('     Coluna metricas_config JÁ EXISTE — migration skippada.');
      console.log('     Detalhes:', JSON.stringify(colCheck.rows[0]), '\n');
    } else {
      console.log('     Coluna não existe — aplicando ALTER TABLE...\n');

      // 3) Aplica ALTER TABLE
      console.log('[3/4] Aplicando ALTER TABLE...');
      await client.query(`
        ALTER TABLE "medicos"
          ADD COLUMN IF NOT EXISTS "metricas_config" JSONB DEFAULT NULL
      `);
      console.log('     ALTER TABLE OK.\n');
    }

    // 4) Validação
    console.log('[4/4] Validação pós-migration...');
    const depois = await client.query('SELECT id FROM medicos');
    if (depois.rows.length !== antes.rows.length) {
      throw new Error(
        `INTEGRIDADE QUEBRADA: ${antes.rows.length} médicos antes, ` +
        `${depois.rows.length} depois. Restaurar do backup ${backupFile}.`
      );
    }
    console.log(`     ${depois.rows.length} médicos depois — IDÊNTICO. ZERO PERDA.`);

    const colFinal = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'medicos' AND column_name = 'metricas_config'
    `);
    console.log('     Coluna final:', JSON.stringify(colFinal.rows[0] || null));

    console.log('\n✓ Migration aplicada com sucesso.\n');
  } catch (e) {
    console.error('\n✗ ERRO:', e.message);
    console.error(e.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
