-- ============================================
-- VITAE — Criar todas as tabelas
-- Cole este SQL no SQL Editor do Supabase
-- ============================================

-- Extensao UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  celular TEXT UNIQUE,
  senha_hash TEXT NOT NULL,
  provider TEXT,
  provider_id TEXT,
  foto_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  criado_em TIMESTAMP(3) NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT now(),
  ultimo_login TIMESTAMP(3)
);

-- 2. PERFIL DE SAUDE
CREATE TABLE IF NOT EXISTS perfil_saude (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  usuario_id TEXT UNIQUE NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  genero TEXT,
  data_nascimento DATE,
  altura_cm INTEGER,
  peso_kg DECIMAL(5,2),
  tipo_sanguineo TEXT,
  historico_familiar TEXT[] DEFAULT '{}',
  nivel_atividade TEXT,
  horas_sono DECIMAL(3,1),
  fuma BOOLEAN,
  alcool TEXT,
  contato_emergencia_nome TEXT,
  contato_emergencia_tel TEXT,
  nome_mae TEXT,
  tel_mae TEXT,
  nome_pai TEXT,
  tel_pai TEXT,
  condicoes TEXT,
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- 3. EXAMES
CREATE TABLE IF NOT EXISTS exames (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome_arquivo TEXT,
  tipo_arquivo TEXT,
  tamanho_bytes INTEGER,
  arquivo_url TEXT,
  tipo_exame TEXT,
  laboratorio TEXT,
  medico_solicitante TEXT,
  data_exame DATE,
  status TEXT NOT NULL DEFAULT 'ENVIADO',
  status_geral TEXT,
  texto_extraido TEXT,
  dados_estruturados JSONB,
  resumo_ia TEXT,
  impactos_ia JSONB,
  melhorias_ia JSONB,
  score_contribuicao DECIMAL(5,2),
  erro_processamento TEXT,
  processado_em TIMESTAMP(3),
  criado_em TIMESTAMP(3) NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- 4. PARAMETROS DO EXAME
CREATE TABLE IF NOT EXISTS exame_parametros (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  exame_id TEXT NOT NULL REFERENCES exames(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  valor TEXT NOT NULL,
  unidade TEXT,
  valor_referencia TEXT,
  valor_numerico DECIMAL(10,4),
  referencia_min DECIMAL(10,4),
  referencia_max DECIMAL(10,4),
  referencia_texto TEXT,
  status TEXT NOT NULL DEFAULT 'NORMAL',
  classificacao TEXT NOT NULL DEFAULT 'NORMAL',
  percentual_faixa DECIMAL(5,2)
);

-- 5. MEDICAMENTOS
CREATE TABLE IF NOT EXISTS medicamentos (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  dosagem TEXT,
  frequencia TEXT,
  horario TEXT,
  motivo TEXT,
  data_inicio DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  fonte TEXT NOT NULL DEFAULT 'manual',
  criado_em TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- 6. ALERGIAS
CREATE TABLE IF NOT EXISTS alergias (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT,
  gravidade TEXT,
  fonte TEXT NOT NULL DEFAULT 'manual',
  criado_em TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- 7. HEALTH SCORES
CREATE TABLE IF NOT EXISTS health_scores (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  score_geral DECIMAL(5,2) NOT NULL,
  score_sono DECIMAL(5,2),
  score_atividade DECIMAL(5,2),
  score_produtividade DECIMAL(5,2),
  score_exame DECIMAL(5,2),
  idade_biologica DECIMAL(4,1),
  idade_cronologica DECIMAL(4,1),
  fontes_dados TEXT[] DEFAULT '{}',
  confianca TEXT NOT NULL DEFAULT 'baixa',
  detalhes TEXT,
  fatores JSONB,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- 8. CHECK-INS SEMANAIS
CREATE TABLE IF NOT EXISTS checkins_semanais (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  sono_qualidade INTEGER,
  atividade_fisica TEXT,
  humor INTEGER,
  dor TEXT,
  produtividade INTEGER,
  notas TEXT,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- 9. NOTIFICACOES
CREATE TABLE IF NOT EXISTS notificacoes (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  dados TEXT,
  lida BOOLEAN NOT NULL DEFAULT false,
  lida_em TIMESTAMP(3),
  enviada_em TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- 10. CODIGOS DE VERIFICACAO (SMS)
CREATE TABLE IF NOT EXISTS codigos_verificacao (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  celular TEXT NOT NULL,
  codigo_hash TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'VERIFICACAO_SMS',
  tentativas INTEGER NOT NULL DEFAULT 0,
  expira_em TIMESTAMP(3) NOT NULL,
  usado BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- 11. REFRESH TOKENS
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expira_em TIMESTAMP(3) NOT NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_exames_usuario ON exames(usuario_id);
CREATE INDEX IF NOT EXISTS idx_parametros_exame ON exame_parametros(exame_id);
CREATE INDEX IF NOT EXISTS idx_medicamentos_usuario ON medicamentos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_alergias_usuario ON alergias(usuario_id);
CREATE INDEX IF NOT EXISTS idx_scores_usuario ON health_scores(usuario_id);
CREATE INDEX IF NOT EXISTS idx_checkins_usuario ON checkins_semanais(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON notificacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_codigos_celular ON codigos_verificacao(celular);
CREATE INDEX IF NOT EXISTS idx_refresh_usuario ON refresh_tokens(usuario_id);
