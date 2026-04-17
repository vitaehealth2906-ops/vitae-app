// ============================================================
// MIGRACAO RETROATIVA: criar AutorizacaoAcesso pra todos os pacientes
// que ja responderam pre-consulta logados antes do auto-link estar ativo
//
// Idempotente — pode rodar quantas vezes quiser, nao duplica.
// ============================================================
//
// Uso (local):
//   cd backend && node src/scripts/migrar-autorizacoes.js
//
// Uso (Railway prod):
//   railway run node src/scripts/migrar-autorizacoes.js
//
// Tambem exposto via endpoint POST /medico/migrar-autorizacoes
// (autenticado — qualquer medico pode rodar — afeta apenas seus dados? NAO,
// roda global. Por isso o endpoint exige token de admin via env.)

const prisma = require('../utils/prisma');

async function migrarAutorizacoes(opts = {}) {
  const log = (...args) => opts.silent ? null : console.log('[MIGRACAO]', ...args);
  let criadas = 0;
  let ignoradas = 0;
  let erros = 0;

  log('Buscando todas as PreConsultas com pacienteId...');
  const pcs = await prisma.preConsulta.findMany({
    where: { pacienteId: { not: null } },
    select: { id: true, medicoId: true, pacienteId: true, criadoEm: true },
    orderBy: { criadoEm: 'asc' },
  });
  log(`Encontradas ${pcs.length} PCs vinculadas.`);

  // Agrupa por (medicoId, pacienteId) — evita criar duplicata
  const pares = new Map();
  for (const pc of pcs) {
    const k = `${pc.medicoId}|${pc.pacienteId}`;
    if (!pares.has(k)) pares.set(k, { medicoId: pc.medicoId, pacienteId: pc.pacienteId, primeira: pc.criadoEm });
  }
  log(`${pares.size} pares unicos (medico, paciente) detectados.`);

  for (const par of pares.values()) {
    try {
      // upsert via unique [pacienteId, medicoId] — nao duplica
      const expiraEm = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
      const result = await prisma.autorizacaoAcesso.upsert({
        where: { pacienteId_medicoId: { pacienteId: par.pacienteId, medicoId: par.medicoId } },
        update: {}, // ja existe — nao mexe
        create: {
          pacienteId: par.pacienteId,
          medicoId: par.medicoId,
          tipoAcesso: 'LEITURA',
          categorias: ['exames', 'perfil', 'pre-consultas'],
          ativo: true,
          expiraEm,
          criadoEm: par.primeira, // mantem data historica
        },
      });
      // Detecta se foi criado novo ou ja existia (Prisma upsert nao retorna isso direto)
      // Workaround: verificar se criadoEm bate com par.primeira
      if (Math.abs(new Date(result.criadoEm).getTime() - new Date(par.primeira).getTime()) < 5000) {
        criadas++;
      } else {
        ignoradas++;
      }
    } catch (err) {
      erros++;
      log('ERRO em par:', par, err.message);
    }
  }

  log(`Concluido: ${criadas} criadas, ${ignoradas} ja existiam, ${erros} erros.`);
  return { criadas, ignoradas, erros, totalPares: pares.size, totalPcs: pcs.length };
}

module.exports = { migrarAutorizacoes };

// CLI mode
if (require.main === module) {
  migrarAutorizacoes()
    .then((res) => {
      console.log('Resultado:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Falha:', err);
      process.exit(1);
    });
}
