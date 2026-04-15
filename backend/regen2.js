const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.zkpilzhyrhsptoujhflz:vitai123.12@aws-0-us-west-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await client.connect();
  const preId = 'a2d69bc8-43bd-4b5c-81e1-6b30773c4dea';

  // Limpa transcricao_words e summary pra forcar reprocessar tudo com codigo novo
  await client.query(`
    UPDATE pre_consultas
    SET transcricao_words = NULL, summary_ia = NULL, summary_json = NULL, audio_summary_url = NULL
    WHERE id = $1
  `, [preId]);
  console.log('Campos limpos para reprocessar');

  // Reseta a tarefa
  const upd = await client.query(`
    UPDATE tarefas_pendentes
    SET processado_em = NULL, dead = false, tentativas = 0,
        proxima_tentativa = NOW(), erro = NULL
    WHERE pre_consulta_id = $1 AND tipo = 'GERAR_SUMMARY_E_TTS'
    RETURNING id
  `, [preId]);
  console.log('Tarefa resetada:', upd.rows);

  await client.end();
  console.log('OK. Worker pega em ate 30s.');
})();
