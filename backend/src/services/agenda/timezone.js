// Util de timezone pro modulo Agenda.
// Regra de ouro: BANCO sempre UTC. DISPLAY sempre Config.timezone (default America/Sao_Paulo).
// Inputs do frontend chegam como ISO 8601 (UTC). Saida: format pra exibir no fuso do consultorio.

const { fromZonedTime, toZonedTime, format } = require('date-fns-tz');

const DEFAULT_TZ = 'America/Sao_Paulo';

// Frontend manda string "2026-05-08T14:00:00" (sem TZ) interpretada como horario do consultorio.
// Convertemos pra UTC pra salvar no banco.
function localToUtc(localIso, timezone = DEFAULT_TZ) {
  if (!localIso) return null;
  return fromZonedTime(localIso, timezone);
}

// Banco devolve UTC. Convertemos pra horario do consultorio pra exibir.
function utcToZoned(utcDate, timezone = DEFAULT_TZ) {
  if (!utcDate) return null;
  return toZonedTime(utcDate, timezone);
}

// Formata UTC pra string legivel no fuso do consultorio.
// Ex: "8 de maio, 14:00" — usado em emails de lembrete.
function formatHumano(utcDate, timezone = DEFAULT_TZ, pattern = "d 'de' MMMM, HH:mm") {
  if (!utcDate) return '';
  return format(utcToZoned(utcDate, timezone), pattern, { timeZone: timezone, locale: undefined });
}

// Formato curto: "08/05 14:00"
function formatCurto(utcDate, timezone = DEFAULT_TZ) {
  if (!utcDate) return '';
  return format(utcToZoned(utcDate, timezone), 'dd/MM HH:mm', { timeZone: timezone });
}

// Verifica se duas datas overlap (intervalos [a1,a2) e [b1,b2)).
// Util pro detector de conflito.
function overlap(a1, a2, b1, b2) {
  const A1 = new Date(a1).getTime();
  const A2 = new Date(a2).getTime();
  const B1 = new Date(b1).getTime();
  const B2 = new Date(b2).getTime();
  return A1 < B2 && A2 > B1;
}

// Calcula data de lembrete (X horas antes do inicio).
function lembreteAt(utcInicio, horasAntes) {
  if (!utcInicio) return null;
  return new Date(new Date(utcInicio).getTime() - horasAntes * 60 * 60 * 1000);
}

// Adiciona N dias a uma data UTC, mantendo a hora local no fuso do consultorio.
// Util pra "+15 dias" ao marcar retorno (preserva mesma hora).
function addDays(utcDate, days, timezone = DEFAULT_TZ) {
  if (!utcDate) return null;
  const zoned = utcToZoned(utcDate, timezone);
  zoned.setDate(zoned.getDate() + days);
  return fromZonedTime(zoned, timezone);
}

// Verifica se data eh feriado nacional brasileiro (usa lib date-holidays).
// Cache simples por ano.
const _holidayCache = new Map();
function ehFeriadoBR(utcDate) {
  if (!utcDate) return null;
  try {
    const Holidays = require('date-holidays');
    const ano = new Date(utcDate).getUTCFullYear();
    let lista = _holidayCache.get(ano);
    if (!lista) {
      const hd = new Holidays('BR');
      lista = hd.getHolidays(ano).filter(h => h.type === 'public');
      _holidayCache.set(ano, lista);
    }
    const ymd = format(utcDate, 'yyyy-MM-dd', { timeZone: DEFAULT_TZ });
    const found = lista.find(h => h.date.startsWith(ymd));
    return found ? { nome: found.name, data: ymd } : null;
  } catch (_e) {
    return null; // lib nao instalada ou erro: nao bloqueia
  }
}

module.exports = {
  DEFAULT_TZ,
  localToUtc,
  utcToZoned,
  formatHumano,
  formatCurto,
  overlap,
  lembreteAt,
  addDays,
  ehFeriadoBR,
};
