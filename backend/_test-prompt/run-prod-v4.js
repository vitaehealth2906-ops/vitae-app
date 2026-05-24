// Roda pipeline V4 contra PC real em prod (usa env vars do Railway via `railway run`)
// CUIDADO: ATUALIZA dados no banco prod (mas preserva summaryIA original em campo paralelo)
// Uso: railway run -- node _test-prompt/run-prod-v4.js

const path = require('path');
const { executarPipelineV4 } = require(path.join('..', 'src', 'services', 'v4', 'pipeline'));

const PC_ID = process.argv[2] || '34671191-2157-46b9-9a76-9f8a0cc9f286'; // default: PC Lucas

(async () => {
  console.log(`[PROD-V4] rodando pipeline V4 contra pc=${PC_ID}`);
  console.log(`[PROD-V4] PROMPT_V4_ENABLED=${process.env.PROMPT_V4_ENABLED}`);
  console.log(`[PROD-V4] DATABASE_URL prefixo=${(process.env.DATABASE_URL || '').slice(0, 30)}...`);
  console.log(`[PROD-V4] SUPABASE_URL=${process.env.SUPABASE_URL}`);
  const t0 = Date.now();
  try {
    const r = await executarPipelineV4(PC_ID);
    console.log(`\n[PROD-V4] OK em ${Date.now() - t0}ms`);
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.error(`[PROD-V4] FALHOU em ${Date.now() - t0}ms: ${e.message}`);
    console.error(e.stack);
    process.exit(1);
  }
})();
