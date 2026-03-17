const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const prisma = require('../utils/prisma');
const { verificarAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const sms = require('../services/sms');
const { enviarEmailResetSenha } = require('../services/email');

const router = express.Router();

// ---------------------------------------------------------------------------
// Schemas de validacao (Zod)
// ---------------------------------------------------------------------------

const cadastroSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no minimo 2 caracteres').max(120),
  email: z.string().email('Email invalido'),
  celular: z.string().regex(
    /^\+55\d{2}\d{8,9}$/,
    'Celular deve estar no formato +55DDXXXXXXXXX',
  ),
  senha: z.string().min(8, 'Senha deve ter no minimo 8 caracteres'),
  tipo: z.enum(['PACIENTE', 'MEDICO']).optional(),
});

const verificarSmsSchema = z.object({
  celular: z.string().regex(/^\+55\d{2}\d{8,9}$/, 'Celular invalido'),
  codigo: z.string().length(6, 'Codigo deve ter 6 digitos'),
});

const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  senha: z.string().min(1, 'Senha e obrigatoria'),
});

const loginSocialSchema = z.object({
  provider: z.enum(['google', 'apple'], {
    errorMap: () => ({ message: 'Provider deve ser google ou apple' }),
  }),
  providerToken: z.string().min(1, 'Token do provider e obrigatorio'),
  nome: z.string().optional(),
  email: z.string().email().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token e obrigatorio'),
});

const esqueciSenhaSchema = z.object({
  email: z.string().email('Email invalido'),
});

const resetarSenhaSchema = z.object({
  token: z.string().min(1, 'Token e obrigatorio'),
  novaSenha: z.string().min(8, 'Senha deve ter no minimo 8 caracteres'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_DAYS = parseInt(process.env.REFRESH_EXPIRES_DAYS, 10) || 30;

/**
 * Gera um par JWT + refresh token e persiste o refresh no banco.
 */
async function gerarTokens(user) {
  const token = jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );

  const refreshToken = crypto.randomBytes(48).toString('hex');
  const expiraEm = new Date();
  expiraEm.setDate(expiraEm.getDate() + REFRESH_EXPIRES_DAYS);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      usuarioId: user.id,
      expiraEm,
    },
  });

  return { token, refreshToken };
}

/**
 * Gera codigo numerico de 6 digitos.
 */
function gerarCodigo6Digitos() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ---------------------------------------------------------------------------
// POST /cadastro
// ---------------------------------------------------------------------------

router.post('/cadastro', validate(cadastroSchema), async (req, res, next) => {
  try {
    const { nome, email, celular, senha, tipo } = req.body;

    // Verificar unicidade de email e celular
    const existente = await prisma.usuario.findFirst({
      where: {
        OR: [{ email }, { celular }],
      },
    });

    if (existente) {
      const campo = existente.email === email ? 'email' : 'celular';
      return res.status(409).json({ erro: `Ja existe uma conta com este ${campo}` });
    }

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 12);

    // Criar usuario ja ativo (sem verificacao SMS)
    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        celular,
        senhaHash,
        tipo: tipo || 'PACIENTE',
        status: 'ATIVO',
        perfilSaude: {
          create: {},
        },
      },
    });

    // Gerar tokens para login automatico
    const { token, refreshToken } = await gerarTokens(usuario);

    return res.status(201).json({
      token,
      refreshToken,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo || 'PACIENTE',
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /verificar-sms
// ---------------------------------------------------------------------------

router.post('/verificar-sms', validate(verificarSmsSchema), async (req, res, next) => {
  try {
    const { celular, codigo } = req.body;

    // Buscar codigo mais recente valido
    const registro = await prisma.codigoVerificacao.findFirst({
      where: {
        celular,
        tipo: 'VERIFICACAO_SMS',
        usado: false,
        expiraEm: { gt: new Date() },
        tentativas: { lt: 3 },
      },
      orderBy: { criadoEm: 'desc' },
    });

    if (!registro) {
      return res.status(400).json({ erro: 'Codigo expirado ou invalido. Solicite um novo.' });
    }

    // Verificar codigo
    const codigoValido = await bcrypt.compare(codigo, registro.codigoHash);

    if (!codigoValido) {
      await prisma.codigoVerificacao.update({
        where: { id: registro.id },
        data: { tentativas: { increment: 1 } },
      });
      return res.status(400).json({ erro: 'Codigo incorreto' });
    }

    // Marcar como usado
    await prisma.codigoVerificacao.update({
      where: { id: registro.id },
      data: { usado: true },
    });

    // Ativar usuario
    const usuario = await prisma.usuario.update({
      where: { celular },
      data: { status: 'ATIVO' },
    });

    // Gerar tokens
    const { token, refreshToken } = await gerarTokens(usuario);

    return res.status(200).json({
      token,
      refreshToken,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo || 'PACIENTE',
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------------

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, senha } = req.body;

    const usuario = await prisma.usuario.findUnique({ where: { email } });

    if (!usuario) {
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);

    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    if (usuario.status !== 'ATIVO') {
      return res.status(403).json({ erro: 'Conta nao esta ativa. Verifique seu celular.' });
    }

    // Atualizar ultimo login
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLogin: new Date() },
    });

    const { token, refreshToken } = await gerarTokens(usuario);

    return res.status(200).json({
      token,
      refreshToken,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo || 'PACIENTE',
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /login-social
// ---------------------------------------------------------------------------

router.post('/login-social', validate(loginSocialSchema), async (req, res, next) => {
  try {
    const { provider, providerToken, nome, email } = req.body;

    // TODO: Implementar verificacao real do token OAuth com o provider
    // Por enquanto, apenas valida que o token existe
    if (!providerToken) {
      return res.status(400).json({ erro: 'Token do provider e obrigatorio' });
    }

    // Usar o token como providerId temporario (em producao, decodificar o token)
    const providerId = providerToken;

    // Buscar usuario existente pelo provider
    let usuario = await prisma.usuario.findFirst({
      where: {
        provider,
        providerId,
      },
    });

    if (!usuario) {
      // Criar novo usuario via login social
      usuario = await prisma.usuario.create({
        data: {
          nome: nome || `Usuario ${provider}`,
          email: email || `${providerId}@${provider}.placeholder`,
          provider,
          providerId,
          status: 'ATIVO',
          perfilSaude: {
            create: {},
          },
        },
      });
    }

    const { token, refreshToken } = await gerarTokens(usuario);

    return res.status(200).json({
      token,
      refreshToken,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo || 'PACIENTE',
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /refresh
// ---------------------------------------------------------------------------

router.post('/refresh', validate(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    const registro = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { usuario: true },
    });

    if (!registro) {
      return res.status(401).json({ erro: 'Refresh token invalido' });
    }

    if (registro.expiraEm < new Date()) {
      await prisma.refreshToken.delete({ where: { id: registro.id } });
      return res.status(401).json({ erro: 'Refresh token expirado' });
    }

    // Deletar token antigo (rotacao)
    await prisma.refreshToken.delete({ where: { id: registro.id } });

    // Gerar novo par de tokens
    const tokens = await gerarTokens(registro.usuario);

    return res.status(200).json({
      token: tokens.token,
      refreshToken: tokens.refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /esqueci-senha
// ---------------------------------------------------------------------------

router.post('/esqueci-senha', validate(esqueciSenhaSchema), async (req, res, next) => {
  try {
    const { email } = req.body;

    const usuario = await prisma.usuario.findUnique({ where: { email } });

    // Sempre retornar sucesso para nao revelar se o email existe
    if (!usuario) {
      return res.status(200).json({ mensagem: 'Se este email existir, voce receberá um link em breve.' });
    }

    // Gerar token unico de reset
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);

    // Salvar no banco reutilizando a tabela de codigos (campo celular recebe o email aqui)
    await prisma.codigoVerificacao.create({
      data: {
        celular: email, // reutilizando o campo para armazenar o email
        codigoHash: tokenHash,
        tipo: 'RESET_SENHA',
        expiraEm: new Date(Date.now() + 30 * 60 * 1000), // 30 minutos
      },
    });

    // Montar link de reset (o frontend abre essa URL)
    const baseUrl = process.env.RESET_URL || 'http://localhost:3000';
    const linkReset = `${baseUrl}/15-nova-senha.html?token=${token}&email=${encodeURIComponent(email)}`;

    await enviarEmailResetSenha(email, usuario.nome, linkReset);

    console.log(`[RESET] Link para ${email}: ${linkReset}`);

    return res.status(200).json({ mensagem: 'Se este email existir, voce receberá um link em breve.' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /resetar-senha
// ---------------------------------------------------------------------------

router.post('/resetar-senha', validate(resetarSenhaSchema), async (req, res, next) => {
  try {
    const { token, novaSenha } = req.body;

    // Buscar todos os registros de reset nao usados e nao expirados
    const registros = await prisma.codigoVerificacao.findMany({
      where: {
        tipo: 'RESET_SENHA',
        usado: false,
        expiraEm: { gt: new Date() },
      },
      orderBy: { criadoEm: 'desc' },
    });

    // Verificar token contra cada registro
    let registroValido = null;
    for (const r of registros) {
      const valido = await bcrypt.compare(token, r.codigoHash);
      if (valido) { registroValido = r; break; }
    }

    if (!registroValido) {
      return res.status(400).json({ erro: 'Link expirado ou invalido. Solicite um novo.' });
    }

    // Marcar como usado
    await prisma.codigoVerificacao.update({
      where: { id: registroValido.id },
      data: { usado: true },
    });

    // O campo "celular" guarda o email neste fluxo
    const email = registroValido.celular;
    const usuario = await prisma.usuario.findUnique({ where: { email } });

    if (!usuario) {
      return res.status(400).json({ erro: 'Usuario nao encontrado.' });
    }

    // Atualizar senha
    const senhaHash = await bcrypt.hash(novaSenha, 12);
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { senhaHash },
    });

    // Invalidar todos os refresh tokens (forcar re-login)
    await prisma.refreshToken.deleteMany({ where: { usuarioId: usuario.id } });

    return res.status(200).json({ mensagem: 'Senha atualizada com sucesso.' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /conta
// ---------------------------------------------------------------------------

router.delete('/conta', verificarAuth, async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id;

    // Deletar usuario — cascade no Prisma cuida das relacoes
    await prisma.usuario.delete({ where: { id: usuarioId } });

    return res.status(200).json({ mensagem: 'Conta deletada permanentemente' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
