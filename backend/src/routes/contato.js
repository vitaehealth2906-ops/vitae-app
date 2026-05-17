const express = require('express');
const { z } = require('zod');
const prisma = require('../utils/prisma');
const { verificarAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { auditar } = require('../utils/auditoria');

const router = express.Router();
router.use(verificarAuth);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const E164_BR_REGEX = /^\+55[1-9]\d{8,10}$/;
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const configSchema = z.object({
  whatsappHabilitado: z.boolean(),
  whatsappNumero: z.string().regex(E164_BR_REGEX, 'Numero invalido. Use formato +5511999999999').optional().nullable(),
  diasDisponiveis: z.array(z.number().int().min(0).max(6)).min(1, 'Selecione pelo menos 1 dia').optional(),
  horaInicio: z.string().regex(HORA_REGEX, 'Hora invalida (use HH:mm)').optional(),
  horaFim: z.string().regex(HORA_REGEX, 'Hora invalida (use HH:mm)').optional(),
  mensagemPreFormatada: z.string().max(500).optional().nullable(),
  consentLgpdAceito: z.boolean().optional(),
});

const permissaoSchema = z.object({
  habilitado: z.boolean(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function validarVinculoMedicoPaciente(medicoId, pacienteId) {
  const autorizacao = await prisma.autorizacaoAcesso.findFirst({
    where: { medicoId, pacienteId, ativo: true, OR: [{ expiraEm: null }, { expiraEm: { gt: new Date() } }] },
    select: { id: true },
  });
  if (autorizacao) return true;
  const vinculo = await prisma.preConsulta.findFirst({
    where: { medicoId, pacienteId, deletadoEm: null },
    select: { id: true },
  });
  return !!vinculo;
}

function disponivelAgora(config, agora) {
  if (!config || !config.whatsappHabilitado) return false;
  const now = agora || new Date();
  // Timezone BR: usa hora local do server (Railway BR-friendly) ou converte explicitamente.
  // Simplificacao: usa hora local Sao Paulo via toLocaleString.
  const brTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dia = brTime.getDay(); // 0=dom, 6=sab
  const minutos = brTime.getHours() * 60 + brTime.getMinutes();
  const [hI, mI] = (config.horaInicio || '08:00').split(':').map(Number);
  const [hF, mF] = (config.horaFim || '18:00').split(':').map(Number);
  const inicioMin = hI * 60 + mI;
  const fimMin = hF * 60 + mF;
  if (!Array.isArray(config.diasDisponiveis) || !config.diasDisponiveis.includes(dia)) return false;
  return minutos >= inicioMin && minutos < fimMin;
}

function rotularDias(dias) {
  if (!Array.isArray(dias) || !dias.length) return 'nenhum dia';
  const labels = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  const sorted = [...dias].sort();
  // Se for seg-sex consecutivo, abrevia
  if (JSON.stringify(sorted) === JSON.stringify([1, 2, 3, 4, 5])) return 'seg-sex';
  if (JSON.stringify(sorted) === JSON.stringify([0, 1, 2, 3, 4, 5, 6])) return 'todos os dias';
  return sorted.map(d => labels[d]).join(', ');
}

// ---------------------------------------------------------------------------
// GET /config — Medico ve config propria (cria com defaults se nao existir)
// ---------------------------------------------------------------------------

router.get('/config', async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) return res.status(403).json({ erro: 'Perfil medico nao encontrado' });

    let config = await prisma.configContatoMedico.findUnique({ where: { medicoId: medico.id } });
    if (!config) {
      config = await prisma.configContatoMedico.create({
        data: { medicoId: medico.id, diasDisponiveis: [1, 2, 3, 4, 5] },
      });
    }
    return res.status(200).json({ config });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /config — Atualiza config. Primeira ativacao exige consent LGPD.
// ---------------------------------------------------------------------------

router.put('/config', validate(configSchema), async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) return res.status(403).json({ erro: 'Perfil medico nao encontrado' });

    let config = await prisma.configContatoMedico.findUnique({ where: { medicoId: medico.id } });

    const ativandoPrimeiraVez = req.body.whatsappHabilitado && (!config || !config.consentLgpdAceito);
    if (ativandoPrimeiraVez && !req.body.consentLgpdAceito) {
      return res.status(400).json({ erro: 'Consent LGPD obrigatorio na primeira ativacao do contato direto.' });
    }

    // Valida horaFim > horaInicio
    if (req.body.horaInicio && req.body.horaFim) {
      const [hI, mI] = req.body.horaInicio.split(':').map(Number);
      const [hF, mF] = req.body.horaFim.split(':').map(Number);
      if (hF * 60 + mF <= hI * 60 + mI) {
        return res.status(400).json({ erro: 'Hora fim precisa ser depois da hora inicio.' });
      }
    }

    const data = {
      whatsappHabilitado: req.body.whatsappHabilitado,
      ...(req.body.whatsappNumero !== undefined ? { whatsappNumero: req.body.whatsappNumero } : {}),
      ...(req.body.diasDisponiveis !== undefined ? { diasDisponiveis: req.body.diasDisponiveis } : {}),
      ...(req.body.horaInicio !== undefined ? { horaInicio: req.body.horaInicio } : {}),
      ...(req.body.horaFim !== undefined ? { horaFim: req.body.horaFim } : {}),
      ...(req.body.mensagemPreFormatada !== undefined ? { mensagemPreFormatada: req.body.mensagemPreFormatada } : {}),
    };
    if (ativandoPrimeiraVez) {
      data.consentLgpdAceito = true;
      data.consentLgpdEm = new Date();
    }

    if (config) {
      config = await prisma.configContatoMedico.update({ where: { medicoId: medico.id }, data });
    } else {
      config = await prisma.configContatoMedico.create({ data: { medicoId: medico.id, ...data } });
    }

    auditar(req, {
      acao: req.body.whatsappHabilitado ? 'ATIVAR_CONTATO_WHATSAPP' : 'DESATIVAR_CONTATO_WHATSAPP',
      atorTipo: 'MEDICO',
      recursoTipo: 'CONFIG_CONTATO_MEDICO',
      recursoId: config.id,
    });

    return res.status(200).json({ config });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /permissoes — Medico lista pacientes vinculados + status permissao
// ---------------------------------------------------------------------------

router.get('/permissoes', async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) return res.status(403).json({ erro: 'Perfil medico nao encontrado' });

    const permissoes = await prisma.permissaoContatoPaciente.findMany({
      where: { medicoId: medico.id },
      include: { paciente: { select: { id: true, nome: true, email: true, celular: true } } },
      orderBy: { atualizadoEm: 'desc' },
    });

    return res.status(200).json({ permissoes });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /permissoes/:pacienteId — Medico habilita/desabilita contato pra paciente
// ---------------------------------------------------------------------------

router.put('/permissoes/:pacienteId', validate(permissaoSchema), async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) return res.status(403).json({ erro: 'Perfil medico nao encontrado' });

    const { pacienteId } = req.params;
    const vinculoOk = await validarVinculoMedicoPaciente(medico.id, pacienteId);
    if (!vinculoOk) return res.status(403).json({ erro: 'Voce nao tem acesso a esse paciente' });

    const existente = await prisma.permissaoContatoPaciente.findUnique({
      where: { medicoId_pacienteId: { medicoId: medico.id, pacienteId } },
    });

    let perm;
    const habilitado = req.body.habilitado;
    if (existente) {
      perm = await prisma.permissaoContatoPaciente.update({
        where: { id: existente.id },
        data: {
          habilitado,
          habilitadoEm: habilitado ? new Date() : existente.habilitadoEm,
          revogadoEm: !habilitado ? new Date() : null,
        },
      });
    } else {
      perm = await prisma.permissaoContatoPaciente.create({
        data: {
          medicoId: medico.id,
          pacienteId,
          habilitado,
          habilitadoEm: habilitado ? new Date() : null,
        },
      });
    }

    // Notifica paciente quando habilita pela primeira vez
    if (habilitado && !existente?.habilitadoEm) {
      const nomeMedico = await prisma.usuario.findUnique({ where: { id: req.usuario.id }, select: { nome: true } });
      await prisma.notificacao.create({
        data: {
          usuarioId: pacienteId,
          tipo: 'CONTATO',
          titulo: 'Contato direto habilitado',
          mensagem: `${nomeMedico?.nome || 'Seu medico'} habilitou contato via WhatsApp dentro dos horarios disponiveis.`,
        },
      }).catch(() => {});
    }

    auditar(req, {
      acao: habilitado ? 'HABILITAR_CONTATO_PACIENTE' : 'REVOGAR_CONTATO_PACIENTE',
      atorTipo: 'MEDICO',
      recursoTipo: 'PERMISSAO_CONTATO_PACIENTE',
      recursoId: perm.id,
      alvoId: pacienteId,
    });

    return res.status(200).json({ permissao: perm });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /medico-do-paciente — Paciente lista medicos com contato habilitado
// ---------------------------------------------------------------------------

router.get('/medico-do-paciente', async (req, res, next) => {
  try {
    const perms = await prisma.permissaoContatoPaciente.findMany({
      where: { pacienteId: req.usuario.id, habilitado: true },
      include: {
        medico: {
          include: {
            usuario: { select: { id: true, nome: true } },
            configContato: true,
          },
        },
      },
    });

    const agora = new Date();
    const medicos = perms
      .filter(p => p.medico && p.medico.configContato && p.medico.configContato.whatsappHabilitado)
      .map(p => {
        const cfg = p.medico.configContato;
        return {
          medicoId: p.medico.id,
          nome: p.medico.usuario?.nome || 'Seu medico',
          especialidade: p.medico.especialidade,
          numero: cfg.whatsappNumero,
          diasDisponiveis: cfg.diasDisponiveis,
          horaInicio: cfg.horaInicio,
          horaFim: cfg.horaFim,
          mensagemPreFormatada: cfg.mensagemPreFormatada || `Olá, Dr(a). ${p.medico.usuario?.nome || ''}.`,
          disponivelAgora: disponivelAgora(cfg, agora),
          janelaResumo: rotularDias(cfg.diasDisponiveis) + ' ' + cfg.horaInicio + '-' + cfg.horaFim,
        };
      });

    return res.status(200).json({ medicos });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /disponivel-agora/:medicoId — Paciente checa disponibilidade
// ---------------------------------------------------------------------------

router.get('/disponivel-agora/:medicoId', async (req, res, next) => {
  try {
    const { medicoId } = req.params;
    const perm = await prisma.permissaoContatoPaciente.findFirst({
      where: { medicoId, pacienteId: req.usuario.id, habilitado: true },
    });
    if (!perm) return res.status(200).json({ disponivel: false, motivo: 'Sem permissao' });

    const cfg = await prisma.configContatoMedico.findUnique({ where: { medicoId } });
    if (!cfg || !cfg.whatsappHabilitado) return res.status(200).json({ disponivel: false, motivo: 'Contato desativado' });

    const disp = disponivelAgora(cfg, new Date());
    return res.status(200).json({
      disponivel: disp,
      diasDisponiveis: cfg.diasDisponiveis,
      horaInicio: cfg.horaInicio,
      horaFim: cfg.horaFim,
      janelaResumo: rotularDias(cfg.diasDisponiveis) + ' ' + cfg.horaInicio + '-' + cfg.horaFim,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /registrar-clique — Paciente clicou no botao WhatsApp (auditoria + metrica)
// ---------------------------------------------------------------------------

router.post('/registrar-clique', async (req, res, next) => {
  try {
    const { medicoId } = req.body || {};
    if (!medicoId) return res.status(400).json({ erro: 'medicoId obrigatorio' });

    const perm = await prisma.permissaoContatoPaciente.findFirst({
      where: { medicoId, pacienteId: req.usuario.id, habilitado: true },
    });
    if (!perm) return res.status(403).json({ erro: 'Sem permissao de contato com esse medico' });

    auditar(req, {
      acao: 'CLIQUE_WHATSAPP',
      atorTipo: 'PACIENTE',
      recursoTipo: 'PERMISSAO_CONTATO_PACIENTE',
      recursoId: perm.id,
      alvoId: medicoId,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
