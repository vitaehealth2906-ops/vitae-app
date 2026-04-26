// Entry point do modulo Agenda Medica v1.
// Padrao copiado de services/padroes/index.js (sessao 12 dark launch).
//
// Feature flags:
//   AGENDA_V1_ENABLED  -> liga/desliga TODO o modulo (rotas, frontend reflete via /agenda/config 503)
//   AGENDA_GCAL_ENABLED -> sub-flag pra integracao Google Calendar (read-only)
//   AGENDA_DARK_USERS  -> CSV de usuarioIds habilitados quando flag mestra ON mas em estagio dark
//
// Rollback de 60s: alterar env var no Railway -> redeploy automatico.

function enabled() {
  return process.env.AGENDA_V1_ENABLED === 'true';
}

function gcalEnabled() {
  return enabled() && process.env.AGENDA_GCAL_ENABLED === 'true' && !!process.env.GCAL_CLIENT_ID;
}

function isDarkUser(usuarioId) {
  if (!usuarioId) return false;
  const lista = (process.env.AGENDA_DARK_USERS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return lista.includes(usuarioId);
}

// Em estagio 1 (dark launch): flag ON mas so dark users veem.
// Em estagio 2+ (interna/canario/100%): flag ON e dark list vazia => todos veem.
function isVisibleForUser(usuarioId) {
  if (!enabled()) return false;
  const lista = (process.env.AGENDA_DARK_USERS || '').trim();
  if (!lista) return true; // estagio 2+ ou local dev
  return isDarkUser(usuarioId);
}

module.exports = {
  enabled,
  gcalEnabled,
  isDarkUser,
  isVisibleForUser,
};
