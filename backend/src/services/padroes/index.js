// Entry point publico do pipeline Padroes Observados v2
const pipeline = require('./pipeline');

// Feature flag: verifica env var em runtime
function enabled() {
  return process.env.PADROES_V2_ENABLED === 'true';
}

module.exports = {
  rodar: pipeline.rodar,
  enabled,
};
