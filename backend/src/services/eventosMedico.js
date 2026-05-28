/**
 * eventosMedico.js — telemetria comportamental do beta
 *
 * Registra acoes do medico em eventos_medico (tabela criada 2026-05-28).
 * Fire-and-forget: NUNCA quebra o fluxo da request.
 * Pseudonimiza IP (hash SHA-256 + salt JWT_SECRET).
 * Cache em memoria de tipo do usuario (10min TTL) pra evitar query a cada request.
 */

const crypto = require('crypto');
const prisma = require('../utils/prisma');

const TIPO_CACHE = new Map(); // userId -> { tipo, expira }
const TIPO_CACHE_TTL_MS = 10 * 60 * 1000;

function hashIp(ip) {
  if (!ip) return null;
  const salt = (process.env.JWT_SECRET || 'vitae').slice(0, 16);
  return crypto.createHash('sha256').update(salt + String(ip)).digest('hex').substring(0, 16);
}

function curtarUserAgent(ua) {
  if (!ua) return null;
  // Detecta plataforma e navegador em formato curto
  let plataforma = 'desconhecido';
  if (/iPhone|iPad/i.test(ua)) plataforma = 'iOS';
  else if (/Android/i.test(ua)) plataforma = 'Android';
  else if (/Mac OS X/i.test(ua)) plataforma = 'macOS';
  else if (/Windows/i.test(ua)) plataforma = 'Windows';
  else if (/Linux/i.test(ua)) plataforma = 'Linux';

  let navegador = 'desconhecido';
  if (/Edg\//i.test(ua)) navegador = 'Edge';
  else if (/Chrome\//i.test(ua)) navegador = 'Chrome';
  else if (/Safari\//i.test(ua)) navegador = 'Safari';
  else if (/Firefox\//i.test(ua)) navegador = 'Firefox';

  return `${plataforma} / ${navegador}`;
}

async function ehMedico(userId) {
  if (!userId) return false;
  const cached = TIPO_CACHE.get(userId);
  if (cached && cached.expira > Date.now()) return cached.tipo === 'MEDICO';
  try {
    const u = await prisma.usuario.findUnique({ where: { id: userId }, select: { tipo: true } });
    const tipo = u?.tipo || null;
    TIPO_CACHE.set(userId, { tipo, expira: Date.now() + TIPO_CACHE_TTL_MS });
    if (TIPO_CACHE.size > 2000) TIPO_CACHE.clear();
    return tipo === 'MEDICO';
  } catch (_e) {
    return false;
  }
}

/**
 * Registra um evento de medico no banco. Fire-and-forget.
 * @param {Object} ev
 * @param {string} ev.medicoId      id do Usuario (tipo=MEDICO)
 * @param {string} ev.tipo          LOGIN, LOGOUT, HEARTBEAT, NAVEGACAO, CRIAR_TEMPLATE, etc
 * @param {string} [ev.recursoTipo] PRECONSULTA, TEMPLATE, PACIENTE, etc
 * @param {string} [ev.recursoId]
 * @param {string} [ev.rota]        ex: "GET /medico/pacientes/:id"
 * @param {string} [ev.metodo]
 * @param {Object} [ev.payload]
 * @param {string} [ev.ipHash]
 * @param {string} [ev.userAgent]
 * @param {number} [ev.duracaoMs]
 * @param {number} [ev.status]      HTTP status
 */
async function registrarEventoMedico(ev) {
  if (!ev || !ev.medicoId || !ev.tipo) return;
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO eventos_medico
       (id, medico_id, tipo, recurso_tipo, recurso_id, rota, metodo, payload, ip_hash, user_agent, duracao_ms, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12)`,
      crypto.randomUUID(),
      ev.medicoId,
      ev.tipo,
      ev.recursoTipo || null,
      ev.recursoId || null,
      ev.rota || null,
      ev.metodo || null,
      ev.payload ? JSON.stringify(ev.payload) : null,
      ev.ipHash || null,
      ev.userAgent || null,
      ev.duracaoMs ?? null,
      ev.status ?? null
    );
  } catch (e) {
    // Tabela pode nao existir ainda (migration nao rodou) — nao quebra fluxo
    if (!e.message?.includes('eventos_medico')) {
      console.warn('[EVENTOS-MEDICO] falha:', e.message);
    }
  }
}

/**
 * Infere o tipo do evento a partir do metodo + URL.
 * Retorna { tipo, recursoTipo, recursoId } ou null se nao mapeavel.
 */
function inferirTipoEvento(metodo, url, params) {
  const m = String(metodo || '').toUpperCase();
  const u = String(url || '').toLowerCase();

  // Auth
  if (u.includes('/auth/login')) return { tipo: 'LOGIN' };
  if (u.includes('/auth/logout')) return { tipo: 'LOGOUT' };
  if (u.includes('/auth/refresh')) return { tipo: 'REFRESH_TOKEN' };

  // Heartbeat
  if (u.includes('/eventos/ping')) return { tipo: 'HEARTBEAT' };

  // Templates
  if (u.includes('/templates') || u.includes('/form-templates')) {
    if (m === 'POST') return { tipo: 'CRIAR_TEMPLATE', recursoTipo: 'TEMPLATE', recursoId: params?.id };
    if (m === 'PUT' || m === 'PATCH') return { tipo: 'EDITAR_TEMPLATE', recursoTipo: 'TEMPLATE', recursoId: params?.id };
    if (m === 'DELETE') return { tipo: 'DELETAR_TEMPLATE', recursoTipo: 'TEMPLATE', recursoId: params?.id };
    if (m === 'GET' && params?.id) return { tipo: 'VER_TEMPLATE', recursoTipo: 'TEMPLATE', recursoId: params.id };
    if (m === 'GET') return { tipo: 'LISTAR_TEMPLATES' };
  }

  // Pre-consulta
  if (u.includes('/pre-consulta')) {
    if (u.includes('/ia-collab')) return { tipo: 'IA_COLLAB', recursoTipo: 'PRECONSULTA', recursoId: params?.id };
    if (u.includes('/regenerar')) return { tipo: 'REGENERAR_SUMMARY', recursoTipo: 'PRECONSULTA', recursoId: params?.id };
    if (u.includes('/finalizar')) return { tipo: 'FINALIZAR_PRECONSULTA', recursoTipo: 'PRECONSULTA' };
    if (m === 'POST' && !u.includes('/t/')) return { tipo: 'CRIAR_PRECONSULTA', recursoTipo: 'PRECONSULTA' };
    if (m === 'DELETE') return { tipo: 'DELETAR_PRECONSULTA', recursoTipo: 'PRECONSULTA', recursoId: params?.id };
    if (m === 'GET' && params?.id) return { tipo: 'VER_PRECONSULTA', recursoTipo: 'PRECONSULTA', recursoId: params.id };
    if (m === 'GET') return { tipo: 'LISTAR_PRECONSULTAS' };
  }

  // Agendamento / retornos
  if (u.includes('/agendamento')) {
    if (u.includes('/aceitar-proposta')) return { tipo: 'ACEITAR_PROPOSTA_RETORNO', recursoTipo: 'AGENDAMENTO', recursoId: params?.id };
    if (u.includes('/propor-retorno')) return { tipo: 'PROPOR_RETORNO', recursoTipo: 'AGENDAMENTO' };
    if (u.includes('/remarcar')) return { tipo: 'REMARCAR_AGENDAMENTO', recursoTipo: 'AGENDAMENTO', recursoId: params?.id };
    if (u.includes('/confirmar')) return { tipo: 'CONFIRMAR_AGENDAMENTO', recursoTipo: 'AGENDAMENTO', recursoId: params?.id };
    if (m === 'POST') return { tipo: 'CRIAR_AGENDAMENTO', recursoTipo: 'AGENDAMENTO' };
    if (m === 'DELETE') return { tipo: 'DELETAR_AGENDAMENTO', recursoTipo: 'AGENDAMENTO', recursoId: params?.id };
    if (m === 'GET') return { tipo: 'LISTAR_AGENDAMENTOS' };
  }

  // Documentos
  if (u.includes('/documento')) {
    if (m === 'POST') return { tipo: 'ANEXAR_DOCUMENTO', recursoTipo: 'DOCUMENTO' };
    if (m === 'DELETE') return { tipo: 'DELETAR_DOCUMENTO', recursoTipo: 'DOCUMENTO', recursoId: params?.id };
    if (m === 'GET') return { tipo: 'VER_DOCUMENTOS' };
  }

  // Contato WhatsApp
  if (u.includes('/contato')) {
    if (u.includes('/permissao')) return { tipo: 'PERMISSAO_CONTATO_PACIENTE', recursoTipo: 'PACIENTE', recursoId: params?.pacienteId };
    if (u.includes('/config')) return { tipo: 'CONFIGURAR_WHATSAPP' };
  }

  // Pacientes
  if (u.includes('/medico/pacientes')) {
    if (m === 'GET' && params?.id) return { tipo: 'VER_PACIENTE', recursoTipo: 'PACIENTE', recursoId: params.id };
    if (m === 'GET') return { tipo: 'LISTAR_PACIENTES' };
  }

  // Perfil medico
  if (u.includes('/medico/me') || (u.includes('/medico') && !u.includes('/pacientes'))) {
    if (u.includes('exportar-iclinic')) return { tipo: 'EXPORTAR_PRONTUARIO' };
    if (u.includes('exportar-dados-lgpd')) return { tipo: 'EXPORTAR_LGPD' };
    if (u.includes('metricas/setup')) return { tipo: 'CONFIGURAR_METRICAS' };
    if (u.includes('metricas/calibracao')) return { tipo: 'CALIBRAR_METRICAS' };
    if (u.includes('metricas')) return { tipo: 'VER_METRICAS' };
    if (m === 'GET' && u.endsWith('/medico/me')) return { tipo: 'VER_PERFIL' };
    if (m === 'PUT' || m === 'PATCH') return { tipo: 'EDITAR_PERFIL' };
    if (m === 'DELETE') return { tipo: 'DELETAR_CONTA' };
  }

  // Calendar / Google
  if (u.includes('/calendar') || u.includes('/google')) {
    if (u.includes('/oauth')) return { tipo: 'OAUTH_CALENDAR' };
    if (u.includes('/sync')) return { tipo: 'SYNC_CALENDAR' };
    if (u.includes('/desconectar')) return { tipo: 'DESCONECTAR_CALENDAR' };
    return { tipo: 'CALENDAR' };
  }

  // Notificacoes
  if (u.includes('/notificacoes')) {
    if (m === 'GET') return { tipo: 'VER_NOTIFICACOES' };
  }

  // Fallback generico
  return null;
}

module.exports = {
  registrarEventoMedico,
  ehMedico,
  hashIp,
  curtarUserAgent,
  inferirTipoEvento,
};
