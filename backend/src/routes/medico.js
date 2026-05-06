const express = require('express');
const { z } = require('zod');
const prisma = require('../utils/prisma');
const { verificarAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const storage = require('../services/storage');
const { geocodificar } = require('../services/geocoding');
const { auditar } = require('../utils/auditoria');

const router = express.Router();

router.use(verificarAuth);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const cadastroMedicoSchema = z.object({
  crm: z.string().min(4, 'CRM invalido').max(20),
  ufCrm: z.string().length(2, 'UF deve ter 2 caracteres'),
  especialidade: z.string().min(2, 'Especialidade obrigatoria'),
  clinica: z.string().min(2, 'Nome da clinica obrigatorio'),
  enderecoClinica: z.string().min(5, 'Endereco da clinica obrigatorio'),
  telefoneClinica: z.string().min(10, 'Telefone da clinica obrigatorio'),
  valorConsulta: z.number().positive('Valor da consulta obrigatorio'),
});

// ---------------------------------------------------------------------------
// POST / — Cadastrar perfil medico
// ---------------------------------------------------------------------------

router.post('/', validate(cadastroMedicoSchema), async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id;
    const { crm, ufCrm, especialidade, clinica, enderecoClinica, telefoneClinica, valorConsulta } = req.body;

    // Verificar se ja tem perfil medico
    const existente = await prisma.medico.findUnique({ where: { usuarioId } });
    if (existente) {
      return res.status(409).json({ erro: 'Perfil medico ja existe' });
    }

    // Atualizar tipo do usuario
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { tipo: 'MEDICO' },
    });

    // Geocodifica endereco em background (tolerante a falha)
    const coord = await geocodificar(enderecoClinica);

    const medico = await prisma.medico.create({
      data: {
        usuarioId,
        crm,
        ufCrm: ufCrm.toUpperCase(),
        especialidade,
        clinica,
        enderecoClinica,
        telefoneClinica,
        valorConsulta,
        latitudeClinica: coord?.lat ?? null,
        longitudeClinica: coord?.lng ?? null,
      },
    });

    return res.status(201).json({ medico });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET / — Obter perfil medico
// ---------------------------------------------------------------------------

router.get('/', async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({
      where: { usuarioId: req.usuario.id },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true, celular: true, fotoUrl: true },
        },
      },
    });

    if (!medico) {
      return res.status(404).json({ erro: 'Perfil medico nao encontrado' });
    }

    return res.status(200).json({ medico });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT / — Atualizar perfil medico
// ---------------------------------------------------------------------------

router.put('/', async (req, res, next) => {
  try {
    const {
      // Campos antigos
      especialidade, clinica, enderecoClinica, telefoneClinica, valorConsulta,
      // Fase 7 — campos novos
      tempoMedioConsulta, tempoAnamneseAtual, mensagemLembretePadrao,
      iaCollabAtivado, analiseProsodicaAtivada,
      modoSimples, modoVolume, modoSUS,
    } = req.body;

    // Validações leves (defesa em profundidade)
    if (tempoMedioConsulta != null && (tempoMedioConsulta < 5 || tempoMedioConsulta > 240)) {
      return res.status(400).json({ erro: 'tempoMedioConsulta deve estar entre 5 e 240 minutos' });
    }
    if (tempoAnamneseAtual != null && (tempoAnamneseAtual < 0 || tempoAnamneseAtual > 60)) {
      return res.status(400).json({ erro: 'tempoAnamneseAtual deve estar entre 0 e 60 minutos' });
    }
    if (mensagemLembretePadrao != null && String(mensagemLembretePadrao).length > 1000) {
      return res.status(400).json({ erro: 'mensagemLembretePadrao acima de 1000 caracteres' });
    }

    // Se o endereco mudou, re-geocodifica pra atualizar lat/lng do mapa
    let geoPatch = {};
    if (enderecoClinica !== undefined) {
      const coord = await geocodificar(enderecoClinica);
      geoPatch = {
        latitudeClinica: coord?.lat ?? null,
        longitudeClinica: coord?.lng ?? null,
      };
    }

    const medico = await prisma.medico.update({
      where: { usuarioId: req.usuario.id },
      data: {
        ...(especialidade && { especialidade }),
        ...(clinica !== undefined && { clinica }),
        ...(enderecoClinica !== undefined && { enderecoClinica, ...geoPatch }),
        ...(telefoneClinica !== undefined && { telefoneClinica }),
        ...(valorConsulta !== undefined && { valorConsulta: valorConsulta === null ? null : Number(valorConsulta) }),
        // Fase 7 — campos novos
        ...(tempoMedioConsulta !== undefined && { tempoMedioConsulta: Number(tempoMedioConsulta) }),
        ...(tempoAnamneseAtual !== undefined && { tempoAnamneseAtual: Number(tempoAnamneseAtual) }),
        ...(mensagemLembretePadrao !== undefined && { mensagemLembretePadrao: String(mensagemLembretePadrao) }),
        ...(iaCollabAtivado !== undefined && { iaCollabAtivado: !!iaCollabAtivado }),
        ...(analiseProsodicaAtivada !== undefined && { analiseProsodicaAtivada: !!analiseProsodicaAtivada }),
        ...(modoSimples !== undefined && { modoSimples: !!modoSimples }),
        ...(modoVolume !== undefined && { modoVolume: !!modoVolume }),
        ...(modoSUS !== undefined && { modoSUS: !!modoSUS }),
      },
    });

    return res.status(200).json({ medico });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /medico/me — Soft-delete com janela de 30 dias (LGPD)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// FASE 11 — Exportar dados LGPD
// ---------------------------------------------------------------------------

router.get('/me/exportar-dados-lgpd', async (req, res, next) => {
  try {
    const formato = (req.query.formato || 'json').toLowerCase();
    const usuarioId = req.usuario.id;

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: {
        medico: true,
        consentimentos: true,
      },
    });
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });

    const preConsultas = await prisma.preConsulta.findMany({
      where: { medicoId: usuario.medico?.id },
      orderBy: { criadoEm: 'desc' },
    });

    const templates = await prisma.formTemplate.findMany({
      where: { medicoId: usuario.medico?.id },
    });

    const disparos = await prisma.notificacaoDisparo.findMany({
      where: { medicoId: usuario.medico?.id },
      orderBy: { criadoEm: 'desc' },
      take: 1000,
    });

    const pacote = {
      exportadoEm: new Date().toISOString(),
      lei: 'LGPD - Art. 18 - Direito de portabilidade',
      titular: {
        id: usuario.id, nome: usuario.nome, email: usuario.email, celular: usuario.celular,
        criadoEm: usuario.criadoEm, ultimoLogin: usuario.ultimoLogin,
      },
      medico: usuario.medico,
      consentimentos: usuario.consentimentos,
      preConsultas: preConsultas,
      templates: templates,
      historicoDisparos: disparos,
    };

    if (formato === 'csv') {
      // Gera CSV simplificado das pré-consultas
      const linhas = ['id,paciente,status,criadoEm,respondidaEm,queixa'];
      preConsultas.forEach(pc => {
        const queixa = (pc.summaryJson?.queixaPrincipal || '').replace(/"/g, '""');
        linhas.push(`${pc.id},"${(pc.pacienteNome||'').replace(/"/g,'""')}",${pc.status},${pc.criadoEm?.toISOString()||''},${pc.respondidaEm?.toISOString()||''},"${queixa}"`);
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="vitae-dados-lgpd-${Date.now()}.csv"`);
      return res.status(200).send(linhas.join('\n'));
    }

    // PDF — formato JSON simplificado por enquanto, frontend monta o PDF
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="vitae-dados-lgpd-${Date.now()}.json"`);
    return res.status(200).json(pacote);
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// FASE 11 — Exportar para iClinic (CSV clínico)
// ---------------------------------------------------------------------------

router.get('/me/exportar-iclinic', async (req, res, next) => {
  try {
    const dias = Math.min(Math.max(parseInt(req.query.periodo, 10) || 90, 1), 365);
    const desde = new Date(Date.now() - dias * 86400000);
    const usuarioId = req.usuario.id;
    const medico = await prisma.medico.findUnique({ where: { usuarioId } });
    if (!medico) return res.status(404).json({ erro: 'Perfil médico não encontrado' });

    const pcs = await prisma.preConsulta.findMany({
      where: { medicoId: medico.id, criadoEm: { gte: desde }, status: 'RESPONDIDA' },
      orderBy: { criadoEm: 'desc' },
      take: 5000,
    });

    // Formato iClinic compatível (cabeçalho clínico simplificado)
    const linhas = ['Data,Paciente,Telefone,Email,Queixa,TempoSintomas,Intensidade,SintomasAssociados,Tratamento,Observacoes'];
    pcs.forEach(pc => {
      const sj = pc.summaryJson || {};
      const a = sj.anamneseEstruturada || {};
      const get = (k) => (a[k]?.valor ? String(a[k].valor).replace(/"/g, '""').replace(/[\r\n]/g, ' ') : '');
      const dataBR = pc.respondidaEm ? new Date(pc.respondidaEm).toLocaleDateString('pt-BR') : '';
      linhas.push([
        dataBR,
        `"${(pc.pacienteNome||'').replace(/"/g,'""')}"`,
        pc.pacienteTel || '',
        pc.pacienteEmail || '',
        `"${get('queixaPrincipal')}"`,
        `"${get('tempoEvolucao')}"`,
        `"${get('intensidade')}"`,
        `"${get('sintomasAssociados')}"`,
        `"${get('tratamentoPrevio')}"`,
        `"${(sj.summaryTexto||'').replace(/"/g,'""').replace(/[\r\n]/g,' ')}"`,
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="vitae-iclinic-${Date.now()}.csv"`);
    return res.status(200).send(linhas.join('\n'));
  } catch (err) { next(err); }
});

router.delete('/me', async (req, res, next) => {
  try {
    const { confirmacao } = req.body || {};
    if (confirmacao !== 'EXCLUIR') {
      return res.status(400).json({ erro: 'Para confirmar a exclusão, envie {"confirmacao":"EXCLUIR"}' });
    }
    const agora = new Date();
    const em30dias = new Date(agora);
    em30dias.setDate(em30dias.getDate() + 30);

    const medico = await prisma.medico.update({
      where: { usuarioId: req.usuario.id },
      data: {
        excluidoEm: agora,
        exclusaoAgendadaPara: em30dias,
        ativo: false,
      },
    });

    await prisma.usuario.update({
      where: { id: req.usuario.id },
      data: { status: 'EXCLUSAO_AGENDADA' },
    });

    try { await auditar({ usuarioId: req.usuario.id, acao: 'EXCLUSAO_CONTA_SOLICITADA', meta: { exclusaoAgendadaPara: em30dias } }); } catch(e){}

    return res.status(200).json({
      ok: true,
      mensagem: 'Sua conta entrou em janela de 30 dias para arrependimento. Para reativar, basta fazer login dentro deste período.',
      exclusaoAgendadaPara: em30dias,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /pacientes — Listar pacientes do medico
//
// Retorna UNIAO de:
//   1. Pacientes com AutorizacaoAcesso ativa (vinculo formal)
//   2. Pacientes com PreConsulta respondida com pacienteId vinculado
//   3. Pacientes "anonimos" (PreConsulta com pacienteId NULL) — agrupados por
//      pacienteNome+pacienteTel pra nao perder info, mas marcados como sem-vinculo
// Tudo deduplicado e enriquecido com contadores e ultima atividade.
// ---------------------------------------------------------------------------

router.get('/pacientes', async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) {
      return res.status(403).json({ erro: 'Perfil medico nao encontrado' });
    }

    // 1) Autorizacoes ativas — fonte primaria de "vinculo formal"
    const autorizacoes = await prisma.autorizacaoAcesso.findMany({
      where: { medicoId: medico.id, ativo: true },
      include: {
        paciente: {
          select: {
            id: true, nome: true, email: true, celular: true, fotoUrl: true,
            perfilSaude: { select: { dataNascimento: true, tipoSanguineo: true } },
            alergias: { select: { gravidade: true } },
            medicamentos: { where: { ativo: true }, select: { id: true } },
          },
        },
      },
    });

    // 2) Todas as pre-consultas do medico (vivas) — pra contar por paciente e detectar anonimos
    // FASE 9 — take 500 evita query explosiva quando medico acumula muitas PCs.
    // Se precisar mais, paginacao real entra quando >400 em uso.
    const pcs = await prisma.preConsulta.findMany({
      where: { medicoId: medico.id, deletadoEm: null },
      orderBy: { criadoEm: 'desc' },
      take: 500,
      select: {
        id: true, pacienteId: true, pacienteNome: true, pacienteTel: true,
        pacienteFotoUrl: true, status: true, criadoEm: true, respondidaEm: true,
      },
    });

    // Agrupa pre-consultas por pacienteId (vinculados) e por nome+tel (anonimos)
    const porPacienteId = new Map();
    const porChaveAnonima = new Map();
    for (const pc of pcs) {
      if (pc.pacienteId) {
        if (!porPacienteId.has(pc.pacienteId)) porPacienteId.set(pc.pacienteId, []);
        porPacienteId.get(pc.pacienteId).push(pc);
      } else {
        const chave = `${(pc.pacienteNome || '').trim().toLowerCase()}|${(pc.pacienteTel || '').replace(/\D/g, '')}`;
        if (!porChaveAnonima.has(chave)) porChaveAnonima.set(chave, []);
        porChaveAnonima.get(chave).push(pc);
      }
    }

    // Monta lista final de pacientes vinculados (autorizacoes + pre-consultas com pacienteId)
    const pacientesVinculadosMap = new Map(); // pacienteId → registro

    // Adiciona quem tem AutorizacaoAcesso
    for (const a of autorizacoes) {
      const p = a.paciente;
      const pcsDaqui = porPacienteId.get(p.id) || [];
      const ultimaAtividade = pcsDaqui[0]?.respondidaEm || pcsDaqui[0]?.criadoEm || a.criadoEm || null;
      const pcRespondidas = pcsDaqui.filter(x => x.status === 'RESPONDIDA').length;
      const pcPendentes = pcsDaqui.filter(x => x.status === 'PENDENTE' || x.status === 'ABERTO').length;
      const alergiasGraves = (p.alergias || []).filter(x => x.gravidade === 'GRAVE').length;
      // Nome que o medico digitou na PC mais recente (memoria muscular do medico);
      // se nao houver PC, usa o nome oficial do cadastro como fallback
      const nomeDigitado = pcsDaqui[0]?.pacienteNome || p.nome;

      pacientesVinculadosMap.set(p.id, {
        pacienteId: p.id,
        pacienteNome: nomeDigitado,
        nomeVitaId: p.nome,
        pacienteTel: p.celular,
        pacienteEmail: p.email,
        pacienteFotoUrl: p.fotoUrl,
        temVinculo: true,
        autorizacaoId: a.id,
        tipoAcesso: a.tipoAcesso,
        expiraEm: a.expiraEm,
        dataNascimento: p.perfilSaude?.dataNascimento || null,
        tipoSanguineo: p.perfilSaude?.tipoSanguineo || null,
        alergiasGraves,
        medicamentosAtivos: (p.medicamentos || []).length,
        preConsultasCount: pcsDaqui.length,
        preConsultasRespondidas: pcRespondidas,
        preConsultasPendentes: pcPendentes,
        ultimaAtividade,
      });
    }

    // Adiciona pacientes que tem PreConsulta com pacienteId mas SEM AutorizacaoAcesso
    // (cenario antigo — antes do auto-link estar ativo)
    for (const [pacienteId, pcsDaqui] of porPacienteId.entries()) {
      if (pacientesVinculadosMap.has(pacienteId)) continue;
      const usuario = await prisma.usuario.findUnique({
        where: { id: pacienteId },
        select: {
          id: true, nome: true, email: true, celular: true, fotoUrl: true,
          perfilSaude: { select: { dataNascimento: true, tipoSanguineo: true } },
          alergias: { select: { gravidade: true } },
          medicamentos: { where: { ativo: true }, select: { id: true } },
        },
      });
      if (!usuario) continue;
      const ultimaAtividade = pcsDaqui[0]?.respondidaEm || pcsDaqui[0]?.criadoEm || null;
      const nomeDigitado = pcsDaqui[0]?.pacienteNome || usuario.nome;
      pacientesVinculadosMap.set(pacienteId, {
        pacienteId,
        pacienteNome: nomeDigitado,
        nomeVitaId: usuario.nome,
        pacienteTel: usuario.celular,
        pacienteEmail: usuario.email,
        pacienteFotoUrl: usuario.fotoUrl,
        temVinculo: true,
        autorizacaoId: null, // sem autorizacao formal ainda
        dataNascimento: usuario.perfilSaude?.dataNascimento || null,
        tipoSanguineo: usuario.perfilSaude?.tipoSanguineo || null,
        alergiasGraves: (usuario.alergias || []).filter(x => x.gravidade === 'GRAVE').length,
        medicamentosAtivos: (usuario.medicamentos || []).length,
        preConsultasCount: pcsDaqui.length,
        preConsultasRespondidas: pcsDaqui.filter(x => x.status === 'RESPONDIDA').length,
        preConsultasPendentes: pcsDaqui.filter(x => x.status === 'PENDENTE' || x.status === 'ABERTO').length,
        ultimaAtividade,
      });
    }

    // Adiciona pacientes ANONIMOS (sem conta) — agrupados por nome+tel
    const anonimos = [];
    for (const [chave, pcsDaqui] of porChaveAnonima.entries()) {
      const primeiroPc = pcsDaqui[0];
      if (!primeiroPc.pacienteNome) continue; // ignora completamente sem nome
      anonimos.push({
        pacienteId: null,
        chaveAnonima: chave,
        pacienteNome: primeiroPc.pacienteNome,
        nomeVitaId: null,
        pacienteTel: primeiroPc.pacienteTel,
        pacienteEmail: null,
        pacienteFotoUrl: primeiroPc.pacienteFotoUrl,
        temVinculo: false,
        preConsultasCount: pcsDaqui.length,
        preConsultasRespondidas: pcsDaqui.filter(x => x.status === 'RESPONDIDA').length,
        preConsultasPendentes: pcsDaqui.filter(x => x.status === 'PENDENTE' || x.status === 'ABERTO').length,
        ultimaAtividade: pcsDaqui[0]?.respondidaEm || pcsDaqui[0]?.criadoEm || null,
      });
    }

    const pacientes = [
      ...Array.from(pacientesVinculadosMap.values()),
      ...anonimos,
    ].sort((a, b) => {
      const da = a.ultimaAtividade ? new Date(a.ultimaAtividade).getTime() : 0;
      const db = b.ultimaAtividade ? new Date(b.ultimaAtividade).getTime() : 0;
      return db - da;
    });

    return res.status(200).json({ pacientes });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /pacientes/buscar?q=daniel — Autocomplete de pacientes (medico criando PC)
//
// Busca em pacientes vinculados ao medico (vinculo via AutorizacaoAcesso ou
// PreConsulta com pacienteId). Retorna ate 10 matches por nome/email/tel.
// Usado pelo modal "Nova Pre-Consulta" pra reaproveitar dados em vez de redigitar.
// ---------------------------------------------------------------------------

router.get('/pacientes/buscar', async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) {
      return res.status(403).json({ erro: 'Perfil medico nao encontrado' });
    }
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.status(200).json({ pacientes: [] });

    // IDs de pacientes ja vinculados a esse medico (via autorizacao OU pre-consulta)
    const [autorizacoes, preConsultas] = await Promise.all([
      prisma.autorizacaoAcesso.findMany({
        where: { medicoId: medico.id, ativo: true },
        select: { pacienteId: true },
      }),
      prisma.preConsulta.findMany({
        where: { medicoId: medico.id, pacienteId: { not: null }, deletadoEm: null },
        select: { pacienteId: true, pacienteNome: true, pacienteTel: true, pacienteEmail: true },
      }),
    ]);
    const pacienteIds = Array.from(new Set([
      ...autorizacoes.map(a => a.pacienteId),
      ...preConsultas.map(pc => pc.pacienteId).filter(Boolean),
    ]));

    if (pacienteIds.length === 0) {
      // Tambem busca em PCs anonimas (nome/tel)
      const orFilters = [
        { pacienteNome: { contains: q, mode: 'insensitive' } },
      ];
      if (/\d/.test(q)) orFilters.push({ pacienteTel: { contains: q.replace(/\D/g, '') } });
      const pcsAnonimas = await prisma.preConsulta.findMany({
        where: { medicoId: medico.id, pacienteId: null, deletadoEm: null, OR: orFilters },
        orderBy: { criadoEm: 'desc' },
        take: 10,
        select: { pacienteNome: true, pacienteTel: true, pacienteEmail: true, pacienteFotoUrl: true, criadoEm: true },
      });
      const dedup = new Map();
      pcsAnonimas.forEach(p => {
        const k = `${p.pacienteNome}|${p.pacienteTel || ''}`;
        if (!dedup.has(k)) dedup.set(k, { ...p, pacienteId: null, temVinculo: false });
      });
      return res.status(200).json({ pacientes: Array.from(dedup.values()) });
    }

    // Busca em Usuario por nome/email/celular (case-insensitive)
    const orFilters = [
      { nome: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
    if (/\d/.test(q)) orFilters.push({ celular: { contains: q.replace(/\D/g, '') } });

    const usuarios = await prisma.usuario.findMany({
      where: { id: { in: pacienteIds }, OR: orFilters },
      take: 10,
      select: {
        id: true, nome: true, email: true, celular: true, fotoUrl: true,
        perfilSaude: { select: { dataNascimento: true } },
      },
    });

    const pacientes = usuarios.map(u => ({
      pacienteId: u.id,
      pacienteNome: u.nome,
      pacienteEmail: u.email,
      pacienteTel: u.celular,
      pacienteFotoUrl: u.fotoUrl,
      dataNascimento: u.perfilSaude?.dataNascimento || null,
      temVinculo: true,
    }));

    return res.status(200).json({ pacientes });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /dashboard — Stats do medico
// ---------------------------------------------------------------------------

router.get('/dashboard', async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) {
      return res.status(403).json({ erro: 'Perfil medico nao encontrado' });
    }

    const [totalPacientes, preConsultasPendentes, preConsultasRespondidas] = await Promise.all([
      prisma.autorizacaoAcesso.count({ where: { medicoId: medico.id, ativo: true } }),
      prisma.preConsulta.count({ where: { medicoId: medico.id, status: 'PENDENTE' } }),
      prisma.preConsulta.count({ where: { medicoId: medico.id, status: 'RESPONDIDA' } }),
    ]);

    return res.status(200).json({
      totalPacientes,
      preConsultasPendentes,
      preConsultasRespondidas,
      totalPreConsultas: preConsultasPendentes + preConsultasRespondidas,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /pacientes/:pacienteId — Perfil completo do paciente (medico)
// Busca Usuario + PerfilSaude + Exames + Alergias + Medicamentos
// Só retorna se houve pelo menos 1 pré-consulta entre esse paciente e o médico
// ---------------------------------------------------------------------------

router.get('/pacientes/:pacienteId', async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) {
      return res.status(403).json({ erro: 'Perfil medico nao encontrado' });
    }

    const { pacienteId } = req.params;

    // Validacao em 2 niveis:
    //   1. AutorizacaoAcesso ativa (paciente nao revogou) — fonte primaria
    //   2. Fallback: pelo menos 1 PreConsulta entre medico e paciente (legado)
    const autorizacao = await prisma.autorizacaoAcesso.findFirst({
      where: {
        medicoId: medico.id,
        pacienteId,
        ativo: true,
        OR: [
          { expiraEm: null },
          { expiraEm: { gt: new Date() } },
        ],
      },
      select: { id: true },
    });

    if (!autorizacao) {
      const vinculo = await prisma.preConsulta.findFirst({
        where: { medicoId: medico.id, pacienteId, deletadoEm: null },
        select: { id: true },
      });
      if (!vinculo) {
        return res.status(403).json({ erro: 'Voce nao tem acesso a esse paciente' });
      }
    }

    // Auditoria — registra acesso a dados clinicos
    auditar(req, {
      acao: 'VIEW_PACIENTE',
      atorTipo: 'MEDICO',
      recursoTipo: 'PACIENTE',
      recursoId: pacienteId,
      alvoId: pacienteId,
      metadata: { medicoId: medico.id },
    });

    const paciente = await prisma.usuario.findUnique({
      where: { id: pacienteId },
      select: {
        id: true,
        nome: true,
        email: true,
        celular: true,
        fotoUrl: true,
        perfilSaude: true,
        medicamentos: {
          orderBy: { criadoEm: 'desc' },
        },
        alergias: { orderBy: { criadoEm: 'desc' } },
        exames: {
          orderBy: { dataExame: 'desc' },
          take: 20,
          select: {
            id: true,
            tipoExame: true,
            laboratorio: true,
            dataExame: true,
            status: true,
            statusGeral: true,
            resumoIA: true,
            arquivoUrl: true,
            nomeArquivo: true,
            tipoArquivo: true,
            criadoEm: true,
            parametros: {
              select: {
                nome: true,
                valor: true,
                unidade: true,
                valorReferencia: true,
                status: true,
                classificacao: true,
              },
            },
          },
        },
      },
    });

    if (!paciente) {
      return res.status(404).json({ erro: 'Paciente nao encontrado' });
    }

    const preConsultas = await prisma.preConsulta.findMany({
      where: { medicoId: medico.id, pacienteId },
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        status: true,
        respondidaEm: true,
        criadoEm: true,
        summaryIA: true,
        audioUrl: true,
        audioSummaryUrl: true,
      },
    });

    return res.status(200).json({ paciente, preConsultas });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /limpeza-antigas — Remove pre-consultas antigas sem vinculo (medico logado)
// Apaga registros PreConsulta do MEDICO atual onde pacienteId IS NULL
// e criadoEm < data de corte. Limpa arquivos do storage tambem.
// Idempotente — pode ser chamado quantas vezes quiser.
// ---------------------------------------------------------------------------

router.post('/limpeza-antigas', async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) {
      return res.status(403).json({ erro: 'Apenas medicos podem executar limpeza' });
    }

    // Data de corte: inicio do fluxo novo (14/04/2026 00:00 UTC)
    const dataCorte = new Date('2026-04-14T00:00:00.000Z');

    // Busca pre-consultas do medico sem pacienteId (sem vinculo real)
    const candidatas = await prisma.preConsulta.findMany({
      where: {
        medicoId: medico.id,
        pacienteId: null,
        criadoEm: { lt: dataCorte },
      },
      select: {
        id: true,
        pacienteNome: true,
        audioUrl: true,
        pacienteFotoUrl: true,
        audioSummaryUrl: true,
      },
    });

    if (candidatas.length === 0) {
      return res.status(200).json({ ok: true, apagadas: 0, mensagem: 'Nada a limpar.' });
    }

    // Apaga arquivos do storage (fire-and-forget, nao bloqueia)
    const promessasStorage = candidatas.flatMap((pc) => {
      const lista = [];
      if (pc.audioUrl) lista.push(storage.deletar(pc.audioUrl).catch(() => {}));
      if (pc.pacienteFotoUrl) lista.push(storage.deletar(pc.pacienteFotoUrl).catch(() => {}));
      if (pc.audioSummaryUrl) lista.push(storage.deletar(pc.audioSummaryUrl).catch(() => {}));
      return lista;
    });
    await Promise.allSettled(promessasStorage);

    // Apaga os registros do banco
    const resultado = await prisma.preConsulta.deleteMany({
      where: {
        id: { in: candidatas.map((c) => c.id) },
      },
    });

    return res.status(200).json({
      ok: true,
      apagadas: resultado.count,
      nomes: candidatas.map((c) => c.pacienteNome),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /diagnostico-pre-consulta — Lista as ultimas pre-consultas do medico
// com info detalhada (audioUrl, fotoUrl, transcricao, tamanho do summary,
// respostas) para diagnosticar problemas de entrega.
// Temporario — remover quando tudo estiver estavel.
// ---------------------------------------------------------------------------

router.get('/diagnostico-pre-consulta', async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) return res.status(403).json({ erro: 'Apenas medicos' });

    const preConsultas = await prisma.preConsulta.findMany({
      where: { medicoId: medico.id },
      orderBy: { criadoEm: 'desc' },
      take: 10,
      select: {
        id: true,
        pacienteNome: true,
        pacienteId: true,
        status: true,
        respondidaEm: true,
        criadoEm: true,
        audioUrl: true,
        pacienteFotoUrl: true,
        audioSummaryUrl: true,
        transcricao: true,
        summaryIA: true,
        respostas: true,
      },
    });

    const diagnostico = preConsultas.map((pc) => {
      const respostasKeys = pc.respostas && typeof pc.respostas === 'object' ? Object.keys(pc.respostas) : [];
      return {
        id: pc.id,
        paciente: pc.pacienteNome,
        temVinculo: !!pc.pacienteId,
        status: pc.status,
        respondidaEm: pc.respondidaEm,
        criadoEm: pc.criadoEm,
        audioChegou: !!pc.audioUrl,
        audioUrl: pc.audioUrl,
        fotoChegou: !!pc.pacienteFotoUrl,
        fotoUrl: pc.pacienteFotoUrl,
        ttsGerado: !!pc.audioSummaryUrl,
        transcricaoChegou: !!(pc.transcricao && pc.transcricao.length > 5 && pc.transcricao !== '(áudio sem transcrição)'),
        transcricaoTamanho: pc.transcricao ? pc.transcricao.length : 0,
        transcricaoPreview: pc.transcricao ? String(pc.transcricao).substring(0, 100) : null,
        summaryGerado: !!(pc.summaryIA && pc.summaryIA.length > 20),
        summaryTamanho: pc.summaryIA ? pc.summaryIA.length : 0,
        respostasCampos: respostasKeys,
        metodoResposta: pc.respostas && pc.respostas.metodo,
      };
    });

    return res.status(200).json({ total: diagnostico.length, preConsultas: diagnostico });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /migrar-autorizacoes — Popula AutorizacaoAcesso retroativamente
//
// Para cada PreConsulta DESSE medico que ja tem pacienteId vinculado, cria
// (upsert idempotente) a AutorizacaoAcesso correspondente. Resolve o problema
// do "Daniel nao aparece em Pacientes" pra dados antigos, antes do auto-link
// estar ativo no responder.
// ---------------------------------------------------------------------------

router.post('/migrar-autorizacoes', async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!medico) return res.status(403).json({ erro: 'Perfil medico nao encontrado' });

    const pcs = await prisma.preConsulta.findMany({
      where: { medicoId: medico.id, pacienteId: { not: null }, deletadoEm: null },
      select: { id: true, pacienteId: true, criadoEm: true },
      orderBy: { criadoEm: 'asc' },
    });

    const pacienteIds = Array.from(new Set(pcs.map(pc => pc.pacienteId)));
    let criadas = 0;
    let atualizadas = 0;

    for (const pacienteId of pacienteIds) {
      const primeirapc = pcs.find(p => p.pacienteId === pacienteId);
      const expiraEm = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
      const existente = await prisma.autorizacaoAcesso.findUnique({
        where: { pacienteId_medicoId: { pacienteId, medicoId: medico.id } },
      });
      if (existente) {
        await prisma.autorizacaoAcesso.update({
          where: { pacienteId_medicoId: { pacienteId, medicoId: medico.id } },
          data: { ativo: true, expiraEm, revogadoEm: null },
        });
        atualizadas++;
      } else {
        await prisma.autorizacaoAcesso.create({
          data: {
            pacienteId,
            medicoId: medico.id,
            tipoAcesso: 'LEITURA',
            categorias: ['exames', 'perfil', 'pre-consultas'],
            ativo: true,
            expiraEm,
            criadoEm: primeirapc.criadoEm,
          },
        });
        criadas++;
      }
    }

    auditar(req, {
      acao: 'MIGRAR_AUTORIZACOES',
      atorTipo: 'MEDICO',
      metadata: { medicoId: medico.id, criadas, atualizadas, totalPacientes: pacienteIds.length },
    });

    return res.status(200).json({ ok: true, criadas, atualizadas, totalPacientes: pacienteIds.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
