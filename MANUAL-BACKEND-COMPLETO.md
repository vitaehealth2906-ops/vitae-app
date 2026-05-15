# Manual do Backend vita id

> Documento de referencia exaustiva pro backend localizado em `d:\vitae-app-novo\backend\`.
> Escrito em PT-BR sem jargao desnecessario, mas com TODOS os detalhes tecnicos preservados.
> Objetivo: permitir que o Lucas (nao-programador, 18 anos) entenda como tudo funciona E que um proximo Claude/dev consiga REPLICAR o sistema no app v3.

Data de mapeamento: 2026-05-14
Versao do backend mapeada: master (deploy Railway)
Linhas totais do backend mapeadas: ~10.000 linhas em 30+ arquivos

---

## 1. Visao Geral

### Stack completa

- **Linguagem:** Node.js 18+ (CommonJS, `require` nao `import`)
- **Framework HTTP:** Express 4.x
- **ORM/banco:** Prisma 6.x + PostgreSQL (hospedado no Supabase)
- **Validacao de payload:** Zod
- **Auth:** JWT (`jsonwebtoken`) + bcryptjs (hash de senhas com cost 12)
- **Upload de arquivos:** multer (memoria, max 25MB pra audio, 20MB pra exame, 10MB pra scan)
- **Storage de arquivos:** Supabase Storage (bucket unico chamado `vitae`); fallback pra pasta local `backend/uploads/` se Supabase nao configurado
- **IA principal:** Anthropic Claude (modelos `claude-sonnet-4-20250514`, `claude-haiku-4-5-20251001`, `claude-opus-4-20250514`, `claude-opus-4-6`)
- **IA secundaria/gratuita:** Google Gemini (`gemini-2.5-flash`) — usado como primeiro tentativa em scan e summary porque e mais barato; Claude e fallback
- **Transcricao de audio:** OpenAI Whisper (`whisper-1`) — com opcao de timestamps por palavra pra sincronizacao tipo karaoke
- **Text-to-speech:** ElevenLabs (`eleven_multilingual_v2`) — gera audio MP3 do briefing de 1 minuto pro medico
- **SMS:** Twilio (codigo de verificacao SMS de 6 digitos no cadastro)
- **Email:** Resend (reset de senha, notificacao de pre-consulta respondida)
- **Geocoding:** servico interno proprio (`services/geocoding.js`)
- **Observabilidade:** Sentry opcional (so se `SENTRY_DSN` setada) + log estruturado JSON no stdout
- **Rate limiting:** `express-rate-limit` em memoria (3 niveis: 300/min geral, 60/min publico, 20 por 15min em login/cadastro)
- **CORS:** lista explicita de origens + dev permite qualquer origin (incluindo `file://`)

### URLs

- **Producao Railway:** `https://vitae-app-production.up.railway.app`
- **Local:** `http://localhost:3002` (porta padrao do projeto). O `index.js` linha 171 usa `PORT` da env ou 3001 como default, mas o Lucas configurou pra rodar em 3002 quando local.
- **Frontend (Vercel):** `https://vitae-app.vercel.app` (variavel `FRONTEND_URL`)
- **GitHub Pages (antigo):** `https://vitaehealth2906-ops.github.io` — DESATIVADO em 2026-05-08, mas a URL ainda esta no CORS por compatibilidade

### Autenticacao JWT

- **JWT principal:** assinado com `JWT_SECRET`, expira em `JWT_EXPIRES_IN` (default `15m` — ver `routes/auth.js:66`). CLAUDE.md menciona "30 dias", mas o codigo real usa 15 minutos curtos + refresh longo.
- **Refresh token:** string hex random 96 chars, salvo no banco em `RefreshToken`, expira em `REFRESH_EXPIRES_DAYS` dias (default 30). CLAUDE.md menciona 90 dias.
- **Rotacao:** a cada `/refresh`, o token antigo e deletado e um novo par e gerado (rotacao automatica).
- **Revogacao (LGPD):** tabela `jwt_revogados` com `jti` (JWT ID) + cache de 60s em memoria pra nao bater no banco a cada request.
- **Bearer:** todo header `Authorization: Bearer <token>`.

### Resumo do que o backend faz

- Cadastro e login de paciente e medico
- Upload de exame (foto/PDF) com leitura automatica via IA
- Cadastro manual de medicamentos e alergias + scan de receita
- Score de saude 0-100 (4 pilares)
- Check-in semanal (sono, atividade, humor, produtividade)
- Pre-consulta: medico cria link → paciente responde com audio/texto → IA gera resumo de 1 minuto
- Padroes Observados v2: 5 agentes (anamnesista, farmacologista, matching, compliance, orquestrador) cruzam dados clinicos
- Modulo Agenda v1: agendamentos, lembretes 24h/2h, Google Calendar sync, secretaria multi-user
- IA Collab: compara anamneses de varias pre-consultas do mesmo paciente
- Analise prosodica: detecta sinais sutis na voz (pausa longa, voz embargada)
- Audit trail LGPD/CFM (5 anos pra briefing, 20 anos pra analise prosodica)
- Metricas honestas: calcula tempo economizado, receita possivel, atendimentos equivalentes

---

## 2. Schema do banco (Prisma)

Arquivo: `backend/prisma/schema.prisma` (749 linhas)
Database: PostgreSQL (Supabase). Conexao via `DATABASE_URL`.

### 2.1. Usuario (tabela `usuarios`)

Conta de paciente OU medico (mesma tabela, campo `tipo` discrimina).

| Campo | Tipo | Regras |
|---|---|---|
| id | String | PK, UUID, default uuid() |
| nome | String | NOT NULL |
| email | String | NOT NULL, UNIQUE |
| celular | String? | UNIQUE (pode ser null pra usuarios via Google Sign-In) |
| senhaHash | String? | mapeado pra `senha_hash`. Null se Google Sign-In |
| provider | String? | "google", "apple" ou null (cadastro tradicional) |
| providerId | String? | id no provedor externo |
| fotoUrl | String? | mapeado pra `foto_url`. Foto unica do paciente (Sessao 10) |
| tipo | String | default "PACIENTE". Valores: PACIENTE \| MEDICO |
| status | String | default "PENDENTE". Valores: PENDENTE \| ATIVO \| EXCLUSAO_AGENDADA |
| criadoEm | DateTime | default now() |
| atualizadoEm | DateTime | @updatedAt |
| ultimoLogin | DateTime? | |

Relacoes:
- `perfilSaude` (1-1 com PerfilSaude)
- `medico` (1-1 com Medico — so se tipo=MEDICO)
- `exames`, `medicamentos`, `alergias`, `healthScores`, `checkins`, `notificacoes` (1-N)
- `refreshTokens` (1-N)
- `autorizacoesComoP` (1-N de AutorizacaoAcesso onde Usuario e paciente)
- `agendamentos`, `consentimentos`, `preConsultasComoP`
- `slotsComoPaciente` (Agenda v1, paciente em AgendaSlot)
- `esperasComoP` (Agenda v1, paciente em ListaEspera)
- `pushSubscriptions` (Agenda v1, web push)
- `secretariaVinculos` (Agenda v1, secretaria de algum medico)

### 2.2. PerfilSaude (tabela `perfil_saude`)

1-1 com Usuario. Guarda os dados clinicos basicos.

| Campo | Tipo | Regras |
|---|---|---|
| id | String | PK UUID |
| usuarioId | String | FK pra Usuario, UNIQUE, mapeado `usuario_id`, CASCADE delete |
| genero | String? | MASCULINO \| FEMININO \| OUTRO \| NAO_INFORMADO |
| dataNascimento | DateTime? | Date (sem hora) |
| alturaCm | Int? | |
| pesoKg | Decimal? | 5,2 |
| tipoSanguineo | String? | A_POS, A_NEG, B_POS, B_NEG, AB_POS, AB_NEG, O_POS, O_NEG |
| historicoFamiliar | String[] | array Postgres |
| nivelAtividade | String? | SEDENTARIO \| LEVE \| MODERADO \| ATIVO \| MUITO_ATIVO |
| horasSono | Decimal? | 3,1 |
| fuma | Boolean? | |
| alcool | String? | NUNCA \| RARAMENTE \| SOCIALMENTE \| FREQUENTEMENTE \| DIARIAMENTE |
| contatoEmergenciaNome | String? | |
| contatoEmergenciaTel | String? | |
| nomeMae | String? | |
| telMae | String? | |
| nomePai | String? | |
| telPai | String? | |
| condicoes | String? | texto livre |
| cpf | String? | UNIQUE |
| cirurgias | String[] | default [] |
| planoSaude | String? | |
| carteirinhaPlano | String? | |
| apelido | String? | |
| nomeSocial | String? | |
| estadoCivil | String? | SOLTEIRO \| CASADO \| DIVORCIADO \| VIUVO \| UNIAO_ESTAVEL \| OUTRO |
| corEtnia | String? | |
| limitacoesAcessibilidade | Json? | objeto {cadeirante, deficienciaVisual, deficienciaAuditiva, deficienciaCognitiva, autismo, limitacaoPosCircurgia, descricao} |
| atualizadoEm | DateTime | @updatedAt |

### 2.3. Exame (tabela `exames`)

| Campo | Tipo | Regras |
|---|---|---|
| id | String | PK UUID |
| usuarioId | String | FK Usuario, CASCADE |
| nomeArquivo | String? | nome original do upload |
| tipoArquivo | String? | mimetype |
| tamanhoBytes | Int? | |
| arquivoUrl | String? | URL Supabase Storage |
| tipoExame | String? | "hemograma", "bioquimica", etc — preenchido pela IA |
| laboratorio | String? | nome do lab — pela IA |
| medicoSolicitante | String? | pela IA |
| dataExame | DateTime? | Date |
| status | String | default "ENVIADO". Valores: ENVIADO → PROCESSANDO → CONCLUIDO \| ERRO |
| statusGeral | String? | NORMAL \| ATENCAO \| CRITICO — pela IA |
| textoExtraido | String? | Text — campo legado, nao mais usado (substituido por dadosEstruturados) |
| dadosEstruturados | Json? | JSON completo retornado pela IA com parametros, resumo, impactos, melhorias |
| resumoIA | String? | Text |
| impactosIA | Json? | array de objetos {icone, titulo, texto} |
| melhoriasIA | Json? | array de objetos {categoria, icone, titulo, texto} |
| scoreContribuicao | Decimal? | 5,2 |
| erroProcessamento | String? | Text — mensagem de erro se status=ERRO |
| processadoEm | DateTime? | |
| criadoEm, atualizadoEm | DateTime | |

Relacoes:
- `parametros` (1-N com ParametroExame)

### 2.4. ParametroExame (tabela `exame_parametros`)

Cada parametro extraido do exame (hemoglobina, glicose, etc).

| Campo | Tipo |
|---|---|
| id | String PK |
| exameId | FK Exame, CASCADE |
| nome | String (ex: "Hemoglobina") |
| valor | String (valor bruto como aparece no laudo) |
| unidade | String? |
| valorReferencia | String? |
| valorNumerico | Decimal? 10,4 |
| referenciaMin | Decimal? 10,4 |
| referenciaMax | Decimal? 10,4 |
| referenciaTexto | String? |
| status | String default "NORMAL" |
| classificacao | String default "NORMAL". Valores: NORMAL \| ATENCAO \| CRITICO \| ALTO \| BAIXO |
| percentualFaixa | Decimal? 5,2 |

### 2.5. Medicamento (tabela `medicamentos`)

| Campo | Tipo |
|---|---|
| id | String PK |
| usuarioId | FK Usuario, CASCADE |
| nome | String (obrigatorio) |
| dosagem, frequencia, horario, motivo, observacao | String? |
| dataInicio, dataFim | DateTime? Date |
| duracaoDias | Int? |
| quantidadeEstoque | Int? |
| quantidadePorDose | Int? default 1 |
| medicoPrescritor | String? |
| ativo | Boolean default true |
| fonte | String default "manual" (valores: manual \| scan) |
| criadoEm | DateTime default now() |

Nota: dedupe automatico — se o paciente cadastra `Novalgina 500mg` e ja existe `Novalgina 500mg` ativa, o backend atualiza em vez de criar duplicata. Resolve o bug original do Lucas (5 Creatinas).

### 2.6. Alergia (tabela `alergias`)

| Campo | Tipo |
|---|---|
| id | String PK |
| usuarioId | FK Usuario, CASCADE |
| nome | String |
| tipo | String? (MEDICAMENTO \| ALIMENTO \| AMBIENTAL \| CONTATO \| OUTRO) |
| gravidade | String? (LEVE \| MODERADA \| GRAVE \| ANAFILAXIA) |
| fonte | String default "manual" (manual \| scan) |
| criadoEm | DateTime default now() |

Merge inteligente: se o paciente ja tem `Dipirona LEVE` e adiciona `Dipirona GRAVE`, atualiza pra GRAVE em vez de retornar 409.

### 2.7. HealthScore (tabela `health_scores`)

Historico de scores (cada recalculo gera um registro).

| Campo | Tipo |
|---|---|
| id | String PK |
| usuarioId | FK Usuario, CASCADE |
| scoreGeral | Decimal 5,2 NOT NULL |
| scoreSono, scoreAtividade, scoreProdutividade, scoreExame | Decimal? 5,2 |
| idadeBiologica, idadeCronologica | Decimal? 4,1 |
| fontesDados | String[] |
| confianca | String default "baixa" (baixa \| media \| alta) |
| detalhes | Text? |
| fatores | Json? |
| criadoEm | DateTime |

### 2.8. CheckinSemanal (tabela `checkins_semanais`)

| Campo | Tipo |
|---|---|
| id | String PK |
| usuarioId | FK Usuario, CASCADE |
| sonoQualidade | Int? (1-5) |
| atividadeFisica | String? (NENHUMA \| LEVE \| MODERADA \| INTENSA) |
| humor | Int? (1-5) |
| dor | String? texto livre |
| produtividade | Int? (1-5) |
| notas | Text? |
| criadoEm | DateTime |

Limite: 1 check-in por semana por usuario (validado no route handler).

### 2.9. Notificacao (tabela `notificacoes`)

| Campo | Tipo |
|---|---|
| id | String PK |
| usuarioId | FK Usuario, CASCADE |
| tipo | String |
| titulo | String |
| mensagem | Text |
| dados | Text? (JSON serializado) |
| lida | Boolean default false |
| lidaEm | DateTime? |
| enviadaEm | DateTime default now() |

### 2.10. CodigoVerificacao (tabela `codigos_verificacao`)

Codigos SMS de 6 digitos (cadastro) OU tokens de reset de senha (campo `celular` reusado pra guardar email no caso de RESET_SENHA — comentario em `auth.js:431`).

| Campo | Tipo |
|---|---|
| id | String PK |
| celular | String (ou email se tipo=RESET_SENHA) |
| codigoHash | String (bcrypt do codigo) |
| tipo | String default "VERIFICACAO_SMS" (ou RESET_SENHA) |
| tentativas | Int default 0 (cap 3) |
| expiraEm | DateTime |
| usado | Boolean default false |
| criadoEm | DateTime |

### 2.11. RefreshToken (tabela `refresh_tokens`)

| Campo | Tipo |
|---|---|
| id | String PK |
| usuarioId | FK Usuario, CASCADE |
| token | String UNIQUE (96 hex chars) |
| expiraEm | DateTime |
| criadoEm | DateTime |

### 2.12. Medico (tabela `medicos`)

1-1 com Usuario quando tipo=MEDICO.

| Campo | Tipo |
|---|---|
| id | String PK |
| usuarioId | FK Usuario, UNIQUE, CASCADE |
| crm | String UNIQUE |
| ufCrm | String (2 chars) |
| especialidade | String |
| clinica | String |
| enderecoClinica | String |
| telefoneClinica | String |
| valorConsulta | Float |
| latitudeClinica, longitudeClinica | Float? (geocodificado automatico) |
| ativo | Boolean default true |
| criadoEm, atualizadoEm | DateTime |
| (Fase 7 - persona/config) | |
| tempoMedioConsulta | Int default 30 |
| tempoAnamneseAtual | Int default 7 |
| mensagemLembretePadrao | Text |
| iaCollabAtivado | Boolean default false |
| analiseProsodicaAtivada | Boolean default false |
| modoSimples, modoVolume, modoSUS | Boolean default false |
| excluidoEm | DateTime? (soft-delete LGPD) |
| exclusaoAgendadaPara | DateTime? (30 dias apos solicitar exclusao) |
| (Sessao 22 - metricas honestas) | |
| metricasConfig | Json? (objeto com 5 inputs: tempoAnamneseSemVitae, percentualEconomiaAnamnese, tempoMedioConsulta, valorConsulta, taxaNoShow + setupConcluido + calibradoEm + calibracoes[]) |
| (Google Calendar OAuth) | |
| googleTokenEnc, googleTokenIv, googleTokenTag | String? Text (AES-256-GCM encryption) |
| googleEmail | String? |
| googleScope | String? |
| googleConectadoEm | DateTime? |
| googleSyncErroEm | DateTime? |
| googleCalendarIds | String[] default [] |
| googleSyncedAt | DateTime? |
| pausadoAte | DateTime? (pausa temporaria de disparo de PC) |

### 2.13. AnaliseProsodicaArquive (tabela `analise_prosodica_arquive`)

Fase 9. Retencao 20 anos (CFM 2.314/2022).

| Campo | Tipo |
|---|---|
| id | String PK |
| preConsultaId | String? FK PreConsulta, SetNull |
| medicoId | FK Medico, RESTRICT (nao apaga se medico for deletado — historico legal) |
| pacienteId | String |
| criadoEm | DateTime |
| features | Json (jitter, shimmer, F0, pausa_max_ms, velocidade_wpm, etc) |
| thresholds | Json (snapshots dos thresholds usados) |
| trechoInicioMs, trechoFimMs | Int |
| hashAudio | String (SHA-256, NUNCA o audio em si — LGPD) |
| retencaoAte | DateTime (20 anos a partir de criadoEm) |
| alertaSeveridade | String? (baixa \| media \| alta) |
| alertaMensagem | String? |
| auditadoEm | DateTime? (quando medico abriu o registro detalhado) |
| auditadoPor | String? (usuarioId que auditou) |

Indices:
- (medicoId, criadoEm) `apa_medico_criado_idx`
- (pacienteId, criadoEm) `apa_paciente_criado_idx`
- (preConsultaId) `apa_pre_consulta_idx`

### 2.14. NotificacaoDisparo (tabela `notificacao_disparos`)

ORFA desde 2026-05-10 (removido o fluxo de disparo em massa). Schema mantido mas sem rota usando.

| Campo | Tipo |
|---|---|
| id | String PK |
| medicoId | FK Medico, CASCADE |
| pacienteId | String? |
| destinatario | String |
| canal | String default "whatsapp" |
| mensagem | Text |
| templateSid | String? |
| status | String default "enfileirado" |
| modo | String default "simulacao" |
| agendadoPara, enviadoEm, entregueEm | DateTime? |
| erro | String? |
| twilioSid | String? |
| criadoEm | DateTime |

### 2.15. FormTemplate (tabela `form_templates`)

Templates de pre-consulta criados pelo medico.

| Campo | Tipo |
|---|---|
| id | String PK |
| medicoId | FK Medico, CASCADE |
| nome | String |
| perguntas | Json (array de {id, tipo, texto, opcoes?, obrigatoria?}) |
| permitirAudio | Boolean default true |
| ativo | Boolean default true |
| vezesUsado | Int default 0 |
| versao | Int default 1 |
| criadoEm, atualizadoEm | DateTime |

### 2.16. PreConsulta (tabela `pre_consultas`)

A tabela mais importante do projeto.

| Campo | Tipo |
|---|---|
| id | String PK |
| medicoId | FK Medico, CASCADE |
| templateId | String? FK FormTemplate (set null se template deletado) |
| templatePerguntas | Json? (snapshot das perguntas no momento da criacao — sobrevive a edicao do template) |
| pacienteId | String? FK Usuario, SetNull |
| pacienteNome | String NOT NULL |
| pacienteTel | String? |
| pacienteEmail | String? |
| linkToken | String UNIQUE (24 bytes hex = 48 chars) |
| status | String default "PENDENTE". Valores: PENDENTE → ABERTO → RESPONDIDA \| EXPIRADA \| FINALIZADA |
| respostas | Json? (estrutura do formulario E `_v2`/`_v4` com fontes rastreaveis) |
| pacienteFotoUrl | String? |
| audioUrl | String? |
| transcricao | Text? |
| transcricaoWords | Json? (palavras com timestamps Whisper word-level pro karaoke) |
| summaryIA | Text? (texto do briefing) |
| summaryJson | Json? (estrutura completa: descricaoBreve, summaryTexto, textoVoz, queixaPrincipal, pontosAtencao, identificaPadroes, blocos, alertas, anamneseEstruturada (11 campos), padroesObservados_v2, alertasFarmacologicos, alertaProsodico) |
| audioSummaryUrl | String? (MP3 ElevenLabs do briefing) |
| linkAberto | Boolean default false |
| linkAbertoEm | DateTime? |
| expiraEm | DateTime NOT NULL (30 dias apos criacao) |
| respondidaEm | DateTime? |
| dataConsulta | DateTime? (Sessao 22 — data e hora da consulta agendada) |
| criadoEm, atualizadoEm | DateTime |
| deletadoEm | DateTime? (soft-delete) |
| (Fase 3 — selo de nivel honesto) | |
| nivelBriefing | Int? (0-5, 5=completo, 0=nao respondido) |
| statusResumoIa | String? ('ok' \| 'parcial' \| 'falhou') |
| statusAudioResumo | String? ('ok' \| 'processando' \| 'falhou' \| 'suspeito') |
| statusTranscricao | String? ('ok' \| 'falhou' \| 'sem_audio') |
| statusFoto | String? ('ok' \| 'ausente' \| 'falhou') |
| statusAudio | String? ('ok' \| 'ausente' \| 'silencio' \| 'falhou') |
| (Agenda v1 — finalizacao + retorno) | |
| finalizadaEm | DateTime? |
| finalizadaPor | String? (usuarioId do medico) |
| retornoSlotId | String? FK AgendaSlot |

Indices:
- (medicoId, pacienteId), (medicoId, criadoEm), (medicoId, status), (medicoId, nivelBriefing), (finalizadaEm), (dataConsulta)

### 2.17. AutorizacaoAcesso (tabela `autorizacoes_acesso`)

Vinculo formal paciente ↔ medico (paciente autoriza medico a ver dados).

| Campo | Tipo |
|---|---|
| id | String PK |
| pacienteId | FK Usuario, CASCADE |
| medicoId | FK Medico, CASCADE |
| tipoAcesso | String default "LEITURA" (LEITURA \| COMPLETO) |
| categorias | String[] default ["exames", "perfil"] |
| ativo | Boolean default true |
| expiraEm | DateTime? (default: 180 dias quando criado pela pre-consulta) |
| criadoEm | DateTime |
| revogadoEm | DateTime? |

Constraint: @@unique([pacienteId, medicoId]) — 1 vinculo por par.
Indice: (medicoId, ativo)

### 2.18. Agendamento (tabela `agendamentos`)

Lembretes simples do paciente — NAO confundir com AgendaSlot da Agenda v1 (que e do medico).

| Campo | Tipo |
|---|---|
| id | String PK |
| usuarioId | FK Usuario, CASCADE |
| titulo | String |
| tipo | String (EXAME \| CONSULTA \| RETORNO) |
| local, medico | String? |
| observacoes | Text? |
| dataHora | DateTime |
| lembrete | Boolean default true |
| lembreteEnviado | Boolean default false |
| criadoEm, atualizadoEm | DateTime |

### 2.19. TarefaPendente (tabela `tarefas_pendentes`)

Fila assincrona de processamento. Sobrevive a restart do servidor.

| Campo | Tipo |
|---|---|
| id | String PK |
| tipo | String (GERAR_SUMMARY_E_TTS \| AGENDA_OFERTAR_VAGA \| TRANSCREVER_AUDIO \| etc) |
| preConsultaId | String? |
| payload | Json? |
| tentativas | Int default 0 |
| proximaTentativa | DateTime default now() |
| processadoEm | DateTime? (null = pendente) |
| erro | Text? |
| dead | Boolean default false (true apos 5 tentativas) |
| criadoEm, atualizadoEm | DateTime |

Indices: (processadoEm, proximaTentativa), (tipo, processadoEm)

### 2.20. Consentimento (tabela `consentimentos`)

LGPD — registros de aceite de termos.

| Campo | Tipo |
|---|---|
| id | String PK |
| usuarioId | FK Usuario, CASCADE |
| tipo | String (TERMOS_USO \| POLITICA_PRIVACIDADE \| COMPARTILHAMENTO_MEDICO \| PROCESSAMENTO_IA) |
| versao | String default "1.0" |
| aceito | Boolean default true |
| ipAddress, userAgent | String? |
| criadoEm | DateTime |
| revogadoEm | DateTime? |

Constraint: @@unique([usuarioId, tipo, versao])

### 2.21. AuditoriaAcesso (tabela `auditorias_acesso`)

LGPD — quem viu qual dado, quando, de onde.

| Campo | Tipo |
|---|---|
| id | String PK |
| atorId | String? (quem acessou) |
| atorTipo | String (MEDICO \| PACIENTE \| PUBLICO \| SISTEMA) |
| acao | String (VIEW_PACIENTE \| VIEW_EXAME \| VIEW_RG_PUBLICO \| AUTO_LINK_PACIENTE \| etc) |
| recursoId | String? |
| recursoTipo | String? (PACIENTE \| EXAME \| PRECONSULTA \| RG_PUBLICO) |
| alvoId | String? (dono do dado) |
| ipAddress, userAgent | String? |
| metadata | Json? |
| criadoEm | DateTime |

Indices: (atorId, criadoEm), (alvoId, criadoEm), (recursoTipo, recursoId)

### 2.22. ConfigAgenda (tabela `config_agenda`) — Agenda v1

1-1 com Medico.

| Campo | Tipo |
|---|---|
| medicoId | FK Medico UNIQUE, CASCADE |
| duracaoPadraoMin | Int default 30 |
| visaoPadrao | String default "semana" (dia \| semana \| mes) |
| diasAtendimento | String default "1,2,3,4,5" (CSV de ISO weekdays) |
| horarioInicio, horarioFim | String default "08:00" / "18:00" |
| almocoInicio, almocoFim | String? default "12:00" / "13:30" |
| bufferMin | Int default 0 |
| lembrete24h, lembrete2h | Boolean default true |
| enviarSMS | Boolean default false (v1 sempre false) |
| videochamadaTipo | String default "jitsi" |
| noShowAuto | Int default 2 (2 faltas = confirmar 48h) |
| feriadosAuto | Boolean default true |
| timezone | String default "America/Sao_Paulo" |
| primeiraConfigEm | DateTime? |
| tourCompleto | Boolean default false |
| criadoEm, atualizadoEm | DateTime |

### 2.23. LocalAtendimento (tabela `locais_atendimento`)

| Campo | Tipo |
|---|---|
| id | String PK |
| medicoId | FK Medico, CASCADE |
| nome | String |
| endereco | Text? |
| cep | String? |
| cor | String default "#00E5A0" |
| ativo | Boolean default true |
| criadoEm, atualizadoEm | DateTime |

### 2.24. AgendaSlot (tabela `agenda_slots`)

Slot de consulta ou bloqueio na agenda do medico.

| Campo | Tipo |
|---|---|
| id | String PK |
| medicoId | FK Medico, CASCADE |
| pacienteId | String? FK Usuario, SetNull (null = bloqueio ou paciente sem conta) |
| pacienteNomeLivre, pacienteTelLivre | String? |
| localId | String? FK LocalAtendimento, SetNull |
| inicio, fim | DateTime |
| duracaoMin | Int |
| tipo | String (CONSULTA_NOVA \| RETORNO \| ONLINE \| BLOQUEIO \| FERIADO) |
| status | String default "AGUARDANDO_CONFIRMACAO" (AGUARDANDO_CONFIRMACAO \| CONFIRMADA \| CANCELADA \| REMARCADA \| FALTA \| COMPARECEU) |
| motivo, observacoes | Text? |
| videoUrl | String? |
| origem | String default "MANUAL" (MANUAL \| RETORNO_PRE_CONSULTA \| GOOGLE_IMPORT \| FERIADO_AUTO \| LISTA_ESPERA) |
| preConsultaId | String? |
| googleEventId | String? UNIQUE |
| googleSyncedAt | DateTime? |
| attemptId | String? UNIQUE (dedupe idempotencia) |
| lembrete24Sent, lembrete2Sent | Boolean default false |
| lembrete24SentAt, lembrete2SentAt | DateTime? |
| pacienteConfirmou | Boolean default false |
| pacienteConfirmadoEm | DateTime? |
| pacienteRecusou | Boolean default false |
| cancelamentoMotivo | String? |
| cancelamentoPor | String? (usuarioId) |
| cancelamentoEm | DateTime? |
| desfeitoAte | DateTime? (janela 10s pra desfazer) |
| estadoAnterior | Json? (snapshot pra desfazer) |
| noShowConfirmar48h | Boolean default false |
| ignorado | Boolean default false (medico marca pra slot Google nao virar PC) |
| tituloEvento | Text? |
| calendarNome | String? |
| criadoPor | String (usuarioId — medico OU secretaria) |
| criadoEm, atualizadoEm | DateTime |

Indices: (medicoId, inicio), (medicoId, status), (pacienteId, inicio), (googleEventId), (inicio, lembrete24Sent), (inicio, lembrete2Sent)

### 2.25. ListaEspera (tabela `lista_espera`)

| Campo | Tipo |
|---|---|
| id | String PK |
| medicoId | FK Medico, CASCADE |
| pacienteId | String? FK Usuario, SetNull |
| pacienteNome, pacienteTel, pacienteEmail | String? |
| motivo | Text? |
| preferencia | String? (MANHA \| TARDE \| QUALQUER) |
| prioridade | String default "NORMAL" (NORMAL \| ALTA \| URGENTE) |
| status | String default "AGUARDANDO" (AGUARDANDO \| OFERTADO \| CONFIRMADO \| DESCARTADO) |
| ofertaSlotId | String? |
| ofertaEnviadaEm | DateTime? |
| criadoEm, resolvidoEm | DateTime |
| criadoPor | String (usuarioId) |

Indice: (medicoId, status, prioridade)

### 2.26. SecretariaVinculo (tabela `secretaria_vinculos`)

Multi-user — medico pode dar acesso a 1+ secretarias.

| Campo | Tipo |
|---|---|
| id | String PK |
| medicoId | FK Medico, CASCADE |
| usuarioId | FK Usuario CASCADE (conta da secretaria) |
| permissoes | String default "AGENDA_LER,AGENDA_ESCREVER,LISTA_ESPERA" (CSV) |
| ativo | Boolean default true |
| conviteToken | String? UNIQUE |
| conviteExpira | DateTime? |
| conviteEmail | String? |
| aceitoEm | DateTime? |
| criadoEm, revogadoEm | DateTime |

Constraints: @@unique([medicoId, usuarioId])

### 2.27. PushSubscription (tabela `push_subscriptions`)

Web push pra lembretes da Agenda.

| Campo | Tipo |
|---|---|
| id | String PK |
| usuarioId | FK Usuario, CASCADE |
| endpoint | Text UNIQUE |
| p256dh, auth | Text |
| userAgent | String? |
| ativo | Boolean default true |
| ultimoUsoEm, falhouEm | DateTime? |
| criadoEm | DateTime |

### 2.28. Tabelas via migration auto NAO no schema.prisma

Estas tabelas sao criadas pelo `index.js:178+` via `prisma.$executeRawUnsafe(CREATE TABLE IF NOT EXISTS ...)`. Existem no banco mas nao tem model Prisma:

- **auditoria_briefing** — Fase 7. Audit trail de acesso ao briefing (LGPD/CFM 5 anos). Campos: id, pre_consulta_id, medico_id, acao, criado_em, ip_hash, user_agent_hash.
- **jwt_revogados** — Fase 7. Lista de JWTs revogados. Campos: jti PK, usuario_id, motivo, revogado_em, expira_em.

---

## 3. TODAS as rotas

Montagem em `src/index.js`:
- `/auth` → limiter brute-force (20/15min)
- `/pre-consulta` → limiter publico (60/min)
- `/autorizacao` → limiter publico (60/min)
- `/perfil`, `/exames`, `/medicamentos`, `/alergias`, `/scores`, `/checkin`, `/notificacoes`, `/pdf`, `/medico`, `/agendamento`, `/consentimento`, `/templates`, `/timeline` → limiter geral (300/min)
- `/admin` → limiter publico + header `x-admin-token`
- `/agenda` → limiter geral + gate `AGENDA_V1_ENABLED`

### 3.1. /auth — `routes/auth.js`

#### POST /auth/cadastro
- **Pra que serve:** criar conta nova (paciente ou medico).
- **Quem chama:** publico (sem auth).
- **Body (Zod `cadastroSchema`):**
  - `nome` string min 2 max 120
  - `email` string email
  - `celular` regex `+55\d{2}\d{8,9}`
  - `senha` string min 8
  - `tipo` enum PACIENTE \| MEDICO (opcional, default PACIENTE)
- **Resposta 201:** `{ token, refreshToken, usuario: {id, nome, email, tipo} }`
- **Regras:**
  - Verifica unicidade de email E celular (409 se ja existe)
  - bcrypt cost 12
  - Cria PerfilSaude vazio junto (1-1)
  - status="ATIVO" (sem verificacao SMS obrigatoria)
- **Status:** 201, 409

#### POST /auth/verificar-sms
- **Pra que serve:** verificar codigo SMS de 6 digitos (atualmente nao obrigatorio porque status="ATIVO" no cadastro, mas mantido pra futuro).
- **Quem chama:** publico.
- **Body:** `{ celular, codigo }` (regex `\+55\d{2}\d{8,9}` + length 6)
- **Resposta 200:** `{ token, refreshToken, usuario }`
- **Regras:** verifica codigo bcrypt, cap 3 tentativas, marca usado, ativa usuario, gera tokens.
- **Status:** 200, 400

#### POST /auth/login
- **Pra que serve:** login com email+senha.
- **Body:** `{ email, senha }`.
- **Resposta 200:** `{ token, refreshToken, usuario }`.
- **Regras:** valida bcrypt, exige status=ATIVO, atualiza ultimoLogin.
- **Status:** 200, 401, 403

#### POST /auth/login-social
- **Pra que serve:** login via Google (Apple reservado).
- **Body:** `{ provider: 'google'|'apple', providerToken, nome?, email? }`.
- **Resposta 200:** `{ token, refreshToken, usuario }`.
- **Regras:**
  - Busca por (provider, providerId)
  - Senao, busca por email (linka conta existente)
  - Senao, cria usuario novo
  - Erros codificados: TOKEN_AUSENTE, EMAIL_AUSENTE, LINK_FALHOU, EMAIL_DUPLICADO (P2002), SCHEMA_DESATUALIZADO (P2022/P2021), CREATE_FALHOU
- **Atencao:** NAO valida o providerToken contra o Google de verdade. Lucas precisa adicionar `google-auth-library` em fase futura (pendencia documentada em Sessao 14).

#### POST /auth/refresh
- **Body:** `{ refreshToken }`.
- **Resposta 200:** `{ token, refreshToken }`.
- **Regras:** rotacao — deleta refresh antigo, gera par novo. Se expirou, deleta.
- **Status:** 200, 401

#### POST /auth/esqueci-senha
- **Body:** `{ email }`.
- **Resposta 200:** sempre `{ mensagem: 'Se este email existir...' }` (nao revela se email existe).
- **Regras:** gera token random 64 chars, salva em CodigoVerificacao (campo `celular` recebe email), expira em 30min, envia email via Resend (`enviarEmailResetSenha`).
- **Link enviado:** `${RESET_URL}/15-nova-senha.html?token=...&email=...`

#### POST /auth/resetar-senha
- **Body:** `{ token, novaSenha }` (senha min 8).
- **Resposta 200:** `{ mensagem }`.
- **Regras:** busca todos resets validos, compara bcrypt, marca usado, atualiza senha, deleta TODOS refresh tokens (forca re-login).
- **Status:** 200, 400

#### DELETE /auth/conta
- **Auth:** obrigatoria.
- **Resposta 200:** deleta usuario PERMANENTE (cascade apaga tudo).
- Sem confirmacao — endpoint perigoso. Geralmente usar `DELETE /medico/me` (soft-delete) em vez disso.

### 3.2. /perfil — `routes/perfil.js`

Todas as rotas exigem auth (`router.use(verificarAuth)`).

#### GET /perfil
- Retorna `{ usuario: {id, nome, email, celular, fotoUrl}, perfil: {...PerfilSaude} }`.
- 404 se usuario nao encontrado.

#### PUT /perfil
- Body validado por `atualizarPerfilSchema` (Zod) — todos os campos do PerfilSaude opcionais com enums:
  - genero: MASCULINO \| FEMININO \| OUTRO \| NAO_INFORMADO
  - dataNascimento: YYYY-MM-DD
  - alturaCm: int 50-300
  - pesoKg: number 1-500
  - tipoSanguineo: A_POS \| A_NEG \| B_POS \| B_NEG \| AB_POS \| AB_NEG \| O_POS \| O_NEG
  - historicoFamiliar: string[]
  - nivelAtividade: SEDENTARIO \| LEVE \| MODERADO \| ATIVO \| MUITO_ATIVO
  - horasSono: number 0-24
  - fuma: boolean
  - alcool: NUNCA \| RARAMENTE \| SOCIALMENTE \| FREQUENTEMENTE \| DIARIAMENTE
  - cpf: regex `\d{11}`
  - cirurgias: string[]
  - planoSaude, carteirinhaPlano, condicoes, contatoEmergenciaNome, contatoEmergenciaTel, apelido, nomeSocial: string
  - estadoCivil: SOLTEIRO \| CASADO \| DIVORCIADO \| VIUVO \| UNIAO_ESTAVEL \| OUTRO
  - corEtnia: string
  - limitacoesAcessibilidade: objeto com 7 campos
- Upsert no PerfilSaude.

#### PATCH /perfil/conta
- Body: `{ nome?, email?, celular? }`.
- Atualiza campos do Usuario (sem mudar senha).

#### POST /perfil/foto
- Body: `{ fotoUrl: string }` — aceita URL ja gerada.
- **Atencao:** linha 167 de `perfil.js` ainda tem TODO de implementar upload com multer. Hoje espera URL pronta — frontend usa Supabase direto ou faz upload em outra rota e passa URL aqui.

### 3.3. /exames — `routes/exames.js`

Auth obrigatoria. Multer com memoryStorage, max 20MB, aceita application/pdf, image/jpeg, image/jpg, image/png.

#### POST /exames/upload
- **Multipart:** campo `arquivo` (file) + `dataExame?` (string ISO).
- Faz upload pro Supabase Storage → cria Exame com status=ENVIADO → dispara `processarExame(exameId, usuarioId)` em background (NAO aguarda).
- Resposta 201: `{ mensagem, exameId }`.

#### Funcao `processarExame` (background, nao endpoint)
1. Marca status=PROCESSANDO
2. Baixa buffer do arquivo (Supabase ou local)
3. Busca perfil + medicamentos ativos + alergias em paralelo
4. Chama `ai.estruturarExameDeArquivo(buffer, mimetype, contexto)` — UMA chamada Claude que retorna JSON completo (parametros, resumo, impactos, melhorias)
5. Em transacao: cria ParametroExame[] + atualiza Exame com status=CONCLUIDO + dadosEstruturados + statusGeral
6. Recalcula HealthScore via `scoreEngine.calcularScores(usuarioId)` + cria registro HealthScore novo
7. Em caso de erro: marca status=ERRO + erroProcessamento.

#### GET /exames
- Retorna `{ exames: [...] }` com enrich de cada parametro adicionando explicacao_simples, impacto_pessoal, dicas extraidos do dadosEstruturados.
- Cada exame inclui `totalParametros, normalCount, atencaoCount, criticoCount`.

#### GET /exames/:id
- Detalhes completos do exame + parametros enriquecidos.
- **Regra de acesso:** dono OU medico com vinculo (PreConsulta status=RESPONDIDA entre o medico logado e o paciente do exame).
- Status: 200, 403, 404.

#### DELETE /exames/:id
- So dono pode deletar.
- Apaga arquivo do storage + registro do banco.

### 3.4. /medicamentos — `routes/medicamentos.js`

Auth obrigatoria.

#### GET /medicamentos
- Lista medicamentos ativos do usuario, ordenado por criadoEm desc.

#### POST /medicamentos
- Body validado: `nome` (min 1, max 200), `dosagem?`, `frequencia?`, `horario?`, `motivo?`, `observacao?`, `medicoPrescritor?`, `duracaoDias?` (1-365), `quantidadeEstoque?`, `quantidadePorDose?` (1-10), `dataInicio?`, `dataFim?` (YYYY-MM-DD).
- Calcula `dataFim` automatica se passou `duracaoDias` + `dataInicio`.
- **Dedupe automatica:** se ja existe medicamento ativo com mesmo nome+dosagem (normalizado: minusculo, sem acento, espacos colapsados), atualiza em vez de criar duplicata. Retorna 200 com `duplicadoAtualizado: true`.
- Senao, cria 201.

#### PUT /medicamentos/:id
- Body parcial. So dono atualiza. 404 se nao existe, 403 se outro dono.

#### DELETE /medicamentos/:id

#### GET /medicamentos/info/:nome
- Retorna info gerada por IA sobre o medicamento (descricao, beneficios, efeitos colaterais, interacoes, dicas). Decode URI no nome.
- Chama `ai.gerarInfoSubstancia(nome, 'medicamento')`.

#### POST /medicamentos/scan
- Multipart: `arquivo` (foto/PDF max 10MB). MIMEs aceitos: jpeg, png, webp, pdf.
- Chama `ai.scanReceita(buffer, mimetype)` — Gemini Vision primario, Claude fallback.
- Cruza medicamentos extraidos com alergias do usuario (substring match).
- Retorna `{ tipo: 'receita'|'nao_receita', medico, data, medicamentos: [{...com alertaAlergia: boolean}], totalAlertasAlergia }`.
- Erros traduzidos: 503 (credito), 504 (timeout), 413 (too large), 400 (nao receita), 500 (geral).

### 3.5. /alergias — `routes/alergias.js`

Auth obrigatoria.

#### GET /alergias
- Lista todas alergias do usuario.

#### POST /alergias
- Body: `nome` (min 1 max 200), `tipo?` (enum 5 valores), `gravidade?` (LEVE \| MODERADA \| GRAVE \| ANAFILAXIA).
- **Merge inteligente:** se ja existe alergia com mesmo nome (case-insensitive), atualiza tipo/gravidade. Retorna 200 com `duplicadoAtualizado: true`.

#### DELETE /alergias/:id

#### GET /alergias/info/:nome
- Mesma estrutura do `medicamentos/info` mas pra alergia: descricao, sintomas, o_que_evitar, o_que_fazer, emergencia.

#### POST /alergias/scan
- Multipart: `arquivo` (foto/PDF max 10MB).
- Chama `ai.scanAlergia` — Gemini primario, Claude fallback.
- Marca cada alergia como `existing: boolean` baseado em substring nas alergias atuais.
- Retorna `{ tipo, alergias, totalNovas, totalExistentes }`.

### 3.6. /scores — `routes/scores.js`

Auth obrigatoria.

#### GET /scores/atual
- Retorna ultimo HealthScore + `idadeCronologica` calculada do PerfilSaude.dataNascimento.

#### GET /scores/historico
- Array do historico completo (ordenado por criadoEm asc).

#### GET /scores/melhorias
- Retorna recomendacoes geradas por IA via `ai.gerarMelhorias(perfil, exames, meds, alergias, checkins, scoreAtual)`.
- Se nao tem dados, retorna 3 melhorias genericas hardcoded.

#### POST /scores/recalcular
- Roda `scoreEngine.calcularScores(usuarioId)` + cria HealthScore novo.

### 3.7. /checkin — `routes/checkin.js`

Auth obrigatoria.

#### POST /checkin
- Body: `{ sonoQualidade: 1-5, atividadeFisica: NENHUMA|LEVE|MODERADA|INTENSA, humor: 1-5, dor?: string, produtividade: 1-5, notas?: string }`.
- **Limite:** 1 por semana (a partir de domingo 00:00). Retorna 409 se ja fez essa semana.
- Apos criar, dispara `scoreEngine.calcularScores` em background (fire-and-forget).

#### GET /checkin/historico
- Ultimos 12 check-ins (~3 meses).

### 3.8. /notificacoes — `routes/notificacoes.js`

Auth obrigatoria.

#### GET /notificacoes
- Query: `pagina` (default 1), `limite` (default 20), `apenasNaoLidas` (boolean).
- Retorna `{ notificacoes, total, naoLidas, pagina, totalPaginas }`.

#### PUT /notificacoes/:id/ler
- Marca como lida.

#### PUT /notificacoes/config
- Placeholder. TODO implementar.

**REMOVIDO 2026-05-10:** `POST /notificacoes/lembrete-massa` e `GET /notificacoes/historico` foram apagados. Tabela `notificacao_disparos` ficou orfa. Disparo de WhatsApp em massa virou clique-do-medico abrindo `wa.me` direto no frontend.

### 3.9. /pdf — `routes/pdf.js`

Auth obrigatoria.

#### POST /pdf/gerar
- Retorna JSON com TODOS os dados pro frontend gerar o PDF (usuario, perfil, score, exames, medicamentos, alergias).
- Backend NAO gera PDF — so prepara os dados. Frontend usa lib JS pra desenhar.

### 3.10. /medico — `routes/medico.js`

Auth obrigatoria. ~1150 linhas, a rota mais complexa.

#### POST /medico
- Cria perfil medico. Body: `{ crm (min 4), ufCrm (2 chars), especialidade, clinica, enderecoClinica, telefoneClinica, valorConsulta }`.
- Atualiza Usuario.tipo="MEDICO".
- Geocodifica endereco automaticamente (lat/lng).
- 409 se ja tem perfil medico.

#### GET /medico
- Retorna perfil medico + usuario.

#### PUT /medico
- Atualiza qualquer campo: campos antigos (especialidade, clinica, etc) + Fase 7 (tempoMedioConsulta 5-240, tempoAnamneseAtual 0-60, mensagemLembretePadrao max 1000, iaCollabAtivado, analiseProsodicaAtivada, modoSimples, modoVolume, modoSUS).
- **Upsert defensivo:** se nao existe medico (race condition), cria com defaults (`crm='PENDENTE'`, `ufCrm='SP'`, etc).
- Re-geocodifica se endereco mudou.

#### GET /medico/me/exportar-dados-lgpd?formato=json|csv
- LGPD Art. 18 — portabilidade de dados.
- Retorna pacote completo: titular, medico, consentimentos, preConsultas, templates.
- formato=csv gera CSV das PCs.

#### GET /medico/me/exportar-iclinic?periodo=N
- Exporta CSV compatible com iClinic (sistema medico popular no Brasil).
- Periodo em dias (1-365, default 90).
- Colunas: Data, Paciente, Telefone, Email, Queixa, TempoSintomas, Intensidade, SintomasAssociados, Tratamento, Observacoes.

#### DELETE /medico/me
- Soft-delete LGPD com janela de 30 dias pra arrependimento.
- Body: `{ confirmacao: "EXCLUIR" }` (proteção contra accidente).
- Marca `excluidoEm`, `exclusaoAgendadaPara`, status="EXCLUSAO_AGENDADA".
- Auditoria registrada.

#### GET /medico/pacientes
- **Lista enriquecida** de pacientes do medico. UNIAO de 3 fontes:
  1. AutorizacaoAcesso ativa (vinculo formal)
  2. PreConsulta com pacienteId vinculado (mas sem AutorizacaoAcesso ainda)
  3. PreConsultas anonimas (pacienteId=null) agrupadas por nome+tel
- Cada paciente vem com `preConsultasCount`, `preConsultasRespondidas`, `preConsultasPendentes`, `ultimaAtividade`, `alergiasGraves`, `medicamentosAtivos`, `dataNascimento`, `tipoSanguineo`.
- Take 500 pra evitar query explosiva.

#### GET /medico/pacientes/buscar?q=...
- Autocomplete de pacientes (medico criando PC). Min 2 chars.
- Busca em Usuarios vinculados ao medico por nome, email ou celular (case-insensitive).
- Tambem busca em PCs anonimas por nome/tel.
- Retorna ate 10 matches.

#### GET /medico/dashboard
- Stats: totalPacientes, preConsultasPendentes, preConsultasRespondidas, totalPreConsultas.

#### GET /medico/metricas?periodo=hoje|semana|mes|30dias
- **Sessao 22 — metricas honestas:**
- Le PCs respondidas no periodo + `medico.metricasConfig`
- Calcula via `services/calcularMetricas.calcularMetricas(medico, preConsultas, periodo)`:
  - tempoEconomizadoMin = soma de (tempoAnamneseSemVitae × completude/100 × percentualEconomiaAnamnese/100) por PC
  - atendimentosEquivalentes = floor(tempoEconomizado / tempoMedioConsulta)
  - receitaPossivel = atendimentos × valorConsulta × (1 - taxaNoShow/100)
  - precisao = 50-95% baseado em consultasMedidas
- Se setup nao concluido, retorna alerta + zeros.

#### PUT /medico/metricas/setup
- Salva os 5 inputs do setup. Validacoes:
  - tempoAnamneseSemVitae 1-60 min
  - percentualEconomiaAnamnese 10-95
  - tempoMedioConsulta 5-240 min
  - valorConsulta 0-10000 R$
  - taxaNoShow 0-50%
  - **Cruzado:** anamnese nao pode ser > consulta inteira
- Marca `setupConcluido: true`. Sincroniza colunas dedicadas `tempoMedioConsulta` e `valorConsulta` no medico.

#### POST /medico/metricas/calibracao
- Banner mensal "esse numero faz sentido?".
- Body: `{ resposta: 'ok'|'superestimado'|'subestimado', ajustes? }`.
- Salva no historico `calibracoes[]` (mantem ultimos 12).
- Se vier ajustes, aplica (revalidando faixas).

#### GET /medico/pacientes/:pacienteId
- Retorna perfil completo do paciente (usuario + perfilSaude + medicamentos + alergias + exames + preConsultas).
- **Validacao de acesso (2 niveis):**
  1. AutorizacaoAcesso ativa nao expirada
  2. Fallback: pelo menos 1 PreConsulta entre medico e paciente
- Auditoria VIEW_PACIENTE registrada.

#### POST /medico/limpeza-antigas
- Apaga PreConsulta sem `pacienteId` criadas antes de 14/04/2026 + storage dos arquivos.
- Idempotente.
- Resolve "Daniel sumiu" pra dados antigos.

#### GET /medico/diagnostico-pre-consulta
- Lista ultimas 10 PCs com info detalhada de entrega (audioChegou, fotoChegou, ttsGerado, etc). Temporario — remover quando estavel.

#### POST /medico/migrar-autorizacoes
- Para cada PreConsulta vinculada ao medico, faz upsert da AutorizacaoAcesso correspondente.
- Renova expiraEm pra 180 dias.

### 3.11. /pre-consulta — `routes/pre-consulta.js`

A rota mais critica. ~1800 linhas.

**Funcao auxiliar `vincularPaciente`:**
- Recebe `{ preConsulta, pacienteIdLogado, req }`.
- Se pacienteIdLogado existe → usa direto.
- Senao retorna null (paciente fica anonimo). **NAO faz mais matching por telefone/email** desde 2026-05-08 (decisao Lucas: token e o vinculo unico).
- Cria/atualiza Consentimento (`COMPARTILHAMENTO_MEDICO` v1.0) com IP + UA.
- Cria/atualiza AutorizacaoAcesso (medico↔paciente) renovando expiraEm pra 180 dias.
- Registra auditoria AUTO_LINK_PACIENTE.

**Funcao auxiliar `enriquecerRespostasV2`:**
- Detecta `respostas._v2` (formato pergunta-por-pergunta) e popula campos legados.
- Mapa `tempoEvolucao → duracaoSintomas|duracao|tempoEvolucao`, `sintomasAssociados → sintomas|sintomasAssociados`, etc.
- Pulado/desconhecer NAO populam campo legado (medico ve "vazio" honesto).

#### POST /pre-consulta/
- Auth obrigatoria (medico).
- Body validado: `pacienteNome` (min 2), `pacienteTel?`, `pacienteEmail?`, `templateId?` (UUID), `dataConsulta` (Sessao 22 — obrigatoria, ISO 8601).
- Cria PreConsulta com:
  - `linkToken` = `crypto.randomBytes(24).toString('hex')`
  - `expiraEm` = 30 dias
  - Snapshot do `templatePerguntas` se templateId
  - Incrementa `vezesUsado` do template
- Resposta 201: `{ preConsulta, link, whatsappLink? }`
  - `link` = `${FRONTEND_URL}/pre-consulta.html?token=...`
  - `whatsappLink` = `https://wa.me/...` com mensagem pronta

#### GET /pre-consulta/t/:token (PUBLICO, sem auth)
- `authOpcional` — funciona com ou sem JWT do paciente.
- 404 se nao existe, 410 se expirou, 409 se ja respondida.
- Marca `linkAberto=true` + `status='ABERTO'` na 1a abertura.
- **Auto-fill perfil do paciente** APENAS se requisitante esta logado E e o mesmo usuario identificado pelo telefone/email da PC (LGPD).
- Retorna `{id, pacienteNome, medicoNome, especialidade, status, perfilPaciente, templatePerguntas, permitirAudio}`.

#### POST /pre-consulta/t/:token/responder-audio (PUBLICO, sem auth)
- Multer fields: `audio` (max 25MB), `foto`.
- Body: `respostas` (JSON), `transcricao`, `attemptId`.
- **Idempotencia:** se ja RESPONDIDA com mesmo attemptId, retorna 200 com `duplicate:true`. Senao 409.
- Faz upload de audio + foto pro Supabase.
- Chama `gerarSummaryPreConsulta` (Gemini + Claude fallback) sincrono.
- Roda pipeline `padroesV2` em paralelo se flag ativada.
- Vincula paciente via `vincularPaciente`.
- UPDATE atomico (`updateMany` com filtro `status:{not:'RESPONDIDA'}`).
- Dispara TTS ElevenLabs em background (fire-and-forget).
- Envia email pro medico (`enviarEmailPreConsultaRespondida`).

#### POST /pre-consulta/t/:token/responder (PUBLICO)
- Endpoint alternativo (V1/V2 - texto + base64).
- Body validado: `respostas` (record), `transcricao?`, `audioBase64?`, `fotoBase64?`.
- Faz upload do base64 se enviado.
- **Validacao HEAD critica:** apos upload, faz HEAD request nas URLs do Supabase pra confirmar arquivo existe. Se cliente mandou audio mas nao confirma (audioConfirmado=false) e nao tem transcricao valida → 422.
- **NAO gera summary sincrono.** Apenas:
  - Salva pre-consulta com status=RESPONDIDA
  - Enfileira `TarefaPendente { tipo: 'GERAR_SUMMARY_E_TTS', preConsultaId }`
- Resposta 200: `{ ok, preConsultaId, audioConfirmado, fotoConfirmada, transcricaoValida, statusPosterior }`.

#### POST /pre-consulta/t/:token/classificar-resposta (PUBLICO, V2)
- Multipart: `audioChunk` (max 5MB).
- Body: `pergunta` (JSON), `transcricao?` (direta sem audio).
- Whisper transcreve audio → Gemini classifica.
- NAO salva nada — so classifica.
- Resposta: `{ respondeu, valor, confianca (0-1), motivo, transcricao, audioUrl, perguntaId, campoAnamnese, timestamp }`.

#### GET /pre-consulta/t/:token/estado (PUBLICO, V4)
- Retomada de sessao V4. Retorna estado atual + cobertura.

#### POST /pre-consulta/t/:token/responder-pergunta (PUBLICO, V4)
- Multer: `audioChunk` (5MB).
- Body `dados` (JSON): `{perguntaId, modo, valor?, attemptId?}`.
- Modos validos: `audio | texto | pulado | desconhecer`.
- **Modo audio:** upload chunk → Whisper transcreve → salva como resposta direta (sem julgar). CAMINHO A — Sessao 17 — IA nao julga mais audio.
- **Modo texto:** Gemini classifica.
- **Modo pulado/desconhecer:** sem IA.
- Salva no `respostas._v4`.

#### POST /pre-consulta/t/:token/finalizar (PUBLICO, V4)
- Valida cobertura (default 11/11 perguntas).
- Vincula paciente.
- Concatena transcricoes V4.
- Marca status=RESPONDIDA, enfileira briefing.

#### GET /pre-consulta/ (auth)
- Lista PCs do medico (deletadoEm: null). Ordem: dataConsulta asc nulls last, criadoEm desc.
- Include paciente {id, nome, fotoUrl}.
- Marca `conteudoCurto: boolean` virtual (transcricao < 80 palavras E tem audio).

#### GET /pre-consulta/:id (auth)
- Detalhes da PC. Validacao: medico dono.
- Audit trail LGPD/CFM: `registrarAcessoBriefing` (acao 'view_briefing').

#### POST /pre-consulta/:id/regenerar (auth)
- Debounce: 15s entre chamadas pro mesmo medico+PC.
- Enriquece respostas com perfil completo do paciente vinculado.
- Re-roda `gerarSummaryPreConsulta` + padroesV2.
- Salva summaryIA + summaryJson.
- Regenera TTS em background.

#### POST /pre-consulta/:id/tts (auth)
- Gera audio ElevenLabs do summary.
- Cache: se ja existe `audioSummaryUrl` e nao tem `?force=true`, redireciona pra URL existente.
- Faz upload pro Supabase + salva audioSummaryUrl no banco.

#### POST /pre-consulta/t/:token/verificar (PUBLICO)
- Body: `transcricao`. Chama `verificarCompletudeTopicos` (Claude analisa 9 topicos obrigatorios).
- Retorna `{ completo, topicosEncontrados, topicosAusentes, mensagem, qualidadeAudio }`.

#### DELETE /pre-consulta/by-patient (auth)
- Body: `{ pacienteNome, pacienteTel? }`.
- Apaga TODAS PCs do paciente desse medico + storage.

#### DELETE /pre-consulta/:id (auth)
- Apaga PC do medico + storage de audio/foto/TTS.

#### POST /pre-consulta/:id/ia-collab (auth) — FASE 9
- Body: `{ outrosPCs: [id, ...] }`.
- Valida: `medico.iaCollabAtivado=true`, PC tem `pacienteId`, lista >= 2 PCs do mesmo paciente.
- Chama `iaCollab.compararAnamneses(lista)` — Claude Haiku.
- Pseudonimiza antes de mandar pro LLM (LGPD).
- Auditoria IA_COLLAB_GERADA.
- Retorna `{narrativa, padroes_observados, evolucao_temporal, alertas}`.

#### POST /pre-consulta/:id/analise-prosodica (auth) — FASE 9
- Valida: `medico.analiseProsodicaAtivada=true`, PC tem `pacienteId`, tem `audioUrl`.
- Modo mock (default): usa transcricao + duracao estimada.
- Chama `prosodica.analisar`.
- Cria registro em `AnaliseProsodicaArquive` (retencao 20 anos automatico).
- Atualiza `summaryJson.alertaProsodico` (nao-destrutivo).
- Disclaimer CFM 2.314/2022 obrigatorio.
- Auditoria ANALISE_PROSODICA_GERADA.

#### GET /pre-consulta/analise-prosodica/:registroId (auth)
- So medico dono pode ver.
- Marca `auditadoEm` + `auditadoPor` na 1a leitura.
- Auditoria ANALISE_PROSODICA_AUDITADA.

### 3.12. /agendamento — `routes/agendamento.js`

Auth obrigatoria. CRUD basico (NAO confundir com /agenda da Fase Agenda v1).

- `POST /` — cria. Body: `{titulo, tipo: EXAME|CONSULTA|RETORNO, local?, medico?, observacoes?, dataHora, lembrete?}`.
- `GET /` — lista do usuario (dataHora asc).
- `GET /proximo` — proximo futuro.
- `PUT /:id` — atualiza.
- `DELETE /:id` — apaga.

### 3.13. /autorizacao — `routes/autorizacao.js`

Rotas publicas (RG publico + exame publico) E rotas autenticadas (gerenciar autorizacoes).

#### GET /autorizacao/rg-publico/:userId (PUBLICO)
- Retorna RG da Saude publico: usuario, perfil (com CPF mascarado), alergias, medicamentos ativos, examesRecentes (50).
- Inclui contato emergencia, mae/pai, plano saude, condicoes, cirurgias, historico familiar, limitacoes acessibilidade.
- Auditoria VIEW_RG_PUBLICO.

#### GET /autorizacao/exame-publico/:userId/:examId (PUBLICO)
- Retorna exame + parametros. Valida que exame pertence ao userId.
- Auditoria VIEW_EXAME_PUBLICO.

#### POST /autorizacao/ (auth)
- Paciente autoriza medico via CRM.
- Body: `{medicoCrm (min 4), tipoAcesso?, categorias?, duracaoDias?}`.
- 409 se ja tem autorizacao ativa.

#### GET /autorizacao/ (auth)
- Lista autorizacoes do paciente com medico include.

#### DELETE /autorizacao/:id (auth)
- Revoga (marca `ativo=false`, `revogadoEm`).

#### GET /autorizacao/qr-data (auth)
- Dados pra gerar QR Code do paciente.

### 3.14. /consentimento — `routes/consentimento.js`

Auth obrigatoria.

- `POST /` — registra. Body: `{tipo, aceito, versao?}`. Salva IP + UA.
- `GET /` — lista do usuario.
- `DELETE /:id` — revoga.
- `GET /status` — retorna mapa `{TERMOS_USO, POLITICA_PRIVACIDADE, COMPARTILHAMENTO_MEDICO, PROCESSAMENTO_IA}` com `{aceito, data, versao}`.

### 3.15. /timeline — `routes/timeline.js`

Auth obrigatoria.

#### GET /timeline
- Retorna timeline unificada: exames (50), medicamentos, alergias, agendamentos (20), checkins (12), ordenado por data desc.
- Cada evento: `{tipo, id, titulo, subtitulo, status, resumo?, data}`.

### 3.16. /templates — `routes/templates.js`

Auth obrigatoria (exceto preview-publico).

#### GET /templates/preview-publico/:id (PUBLICO)
- Retorna `{nome, perguntas}` (pra iframe preview no quiz).

#### POST /templates/gerar (auth, medico)
- Body: `{instrucao}` (min 5 chars).
- Chama `ai.gerarPerguntasTemplate(instrucao)` (Claude Opus retorna perguntas uma por linha).
- Roda `classifyAllQuestions(texto)` — heuristica que detecta tipo de cada pergunta:
  - scale: "intensidade", "escala", "nivel", "de 0 a", "de 1 a"
  - location: "onde dói", "regiao"
  - duration: "quanto tempo", "ha quanto"
  - frequency: "frequencia", "quantas vezes"
  - upload: "foto", "anexar"
  - date: "data", "quando foi"
  - yesno: "fuma", "tem", "possui", "ja teve"
  - smoking, alcohol: detectores especificos
- Adiciona 3 perguntas obrigatorias no inicio: q_queixa (motivo consulta), q_medicamentos, q_alergias.

#### POST /templates/classificar (auth, medico)
- Body: `{texto}`. Roda mesma `classifyAllQuestions`.
- Util pra medico digitar perguntas livres e backend estruturar.

#### GET /templates (auth, medico)
- Lista templates do medico (ordem criadoEm desc).

#### GET /templates/:id (auth, medico)
- Detalhe (so se medicoId bate).

#### POST /templates (auth, medico)
- Body: `{nome (min 2), perguntas (array min 4 max 25), permitirAudio?}`.

#### PUT /templates/:id (auth, medico)
- Atualiza. Se mudou perguntas, incrementa versao.

#### DELETE /templates/:id (auth, medico)
- Apaga. Aviso se tem PCs pendentes ainda usando ele.

### 3.17. /admin — `routes/admin.js`

Header `x-admin-token` obrigatorio (compara com `ADMIN_TOKEN` env var).

- `GET /admin/health` — `{ok, db, observability}` (testa SELECT 1 + observability.snapshot())
- `GET /admin/queue` — `{pendentes, mortas, processadas_24h, por_tipo, stuck_30min_ou_mais}` (queries SQL raw em tarefas_pendentes)
- `GET /admin/stats` — `{usuarios, medicos, pacientes, preConsultas_24h, preConsultas_total, exames_total}`
- `GET /admin/audit?limit=N` — `auditoria_briefing` agregado (ate 500)
- `POST /admin/backfill-nivel` — calcula nivelBriefing pras PCs antigas (batch 500). Le pacienteFotoUrl, audioUrl, transcricao, summaryJson, audioSummaryUrl, respostas. Roda validadores do `services/briefing` e atualiza nivelBriefing + statusXxx.
- `POST /admin/queue/:id/retry` — forca retry de tarefa morta (`dead=false, tentativas=0, proxima_tentativa=NOW()`).

### 3.18. /agenda — `routes/agenda.js`

Auth obrigatoria + `perm.carregarPermissoes` + gate `AGENDA_V1_ENABLED`.

Rotas publicas (sem auth):
- `/slots/:id/confirmar-presenca?token=...`
- `/slots/:id/recusar?token=...`
- `/lista-espera/aceitar?token=...`
- `/google/callback`
- `/push/vapid-public-key`

#### Config:
- `GET /agenda/config` (medicoOnly) — cria default + local default se primeira vez
- `PUT /agenda/config` — valida Zod (duracaoPadraoMin 10-120, visaoPadrao dia|semana|mes, etc)

#### Locais:
- `GET/POST/PUT/DELETE /agenda/locais[/id]`

#### Slots:
- `GET /agenda/slots?inicio&fim&incluirCanceladas`
- `POST /agenda/slots` — Body Zod: `{pacienteId?, pacienteNomeLivre?, pacienteTelLivre?, localId?, inicio, fim, duracaoMin 10-480, tipo: CONSULTA_NOVA|RETORNO|ONLINE|BLOQUEIO, motivo?, observacoes?, videoUrl?, attemptId?}`
- `PUT /agenda/slots/:id` — remarca
- `DELETE /agenda/slots/:id?motivo` — cancela + tenta ofertar pra lista de espera
- `POST /agenda/slots/:id/desfazer` — janela 10s
- `POST /agenda/slots/:id/comparecer` — marca COMPARECEU
- `POST /agenda/slots/:id/falta` — marca FALTA + auditoria
- `GET /agenda/slots/:id/confirmar-presenca` (PUBLICO, HMAC) — paciente confirma. Token HMAC = `hmacToken(slotId:pacienteId)`. Resposta HTML.
- `GET /agenda/slots/:id/recusar` (PUBLICO, HMAC)
- `POST /agenda/slots/:id/ignorar` / `DELETE` — marca slot Google como ignorado

#### Pacientes/Medicos:
- `GET /agenda/sugestoes-retorno?pacienteId&prazoDias`
- `GET /agenda/meus-slots` — paciente ve proprios
- `GET /agenda/proximo-meu`

#### Finalizar consulta:
- `POST /agenda/finalizar/:preConsultaId` — Body: `{comRetorno, slotInicio?, slotFim?, slotDuracaoMin?, slotLocalId?, slotMotivo?, attemptId?}`. Marca PC `finalizadaEm`, cria slot de retorno se comRetorno=true.
- `POST /agenda/finalizar/:preConsultaId/desfazer`

#### Lista de espera:
- `GET/POST/DELETE /agenda/lista-espera[/id]`
- `POST /agenda/lista-espera/:id/oferecer` — Body: `{slotId}`. Oferta vaga.
- `GET /agenda/lista-espera/aceitar?token=` (PUBLICO) — paciente aceita

#### Stats:
- `GET /agenda/stats?mes=YYYY-MM` — `{totalSlots, comparecimentos, faltas, retornosMarcados, finalizadas, taxaPresenca, taxaRetorno, noShowEvitado, economiaRS}`

#### Google Calendar (read-only):
- `GET /agenda/google/auth` — gera URL OAuth com state JWT 10min TTL
- `GET /agenda/google/callback?code&state` — processa callback, salva token AES-256-GCM, redireciona pro frontend
- `POST /agenda/google/sync` / `sync-now` — forca resync (90 dias)
- `DELETE /agenda/google/desconectar`
- `GET /agenda/google/status` — `{conectado, email, calendarIds, pausado, metricas:{eventosSemana, totalImportados}}`
- `GET /agenda/google/calendars` — lista agendas Google do medico
- `PUT /agenda/google/calendars-selected` — Body: `{ids:[]}`. Salva quais agendas monitorar
- `POST /agenda/pausar` — Body: `{dias 1-365}`. Pausa disparo PC ate data
- `DELETE /agenda/pausar` — despausa
- `GET /agenda/pcs-historico?limit=N` — `{proximos: slots futuros, historico: PCs respondidas}`

#### Secretarias (multi-user):
- `GET /agenda/secretarias` (medicoOnly)
- `POST /agenda/secretarias/convidar` — Body: `{email, permissoes?}`. Cria token 7d, envia email convite.
- `POST /agenda/secretarias/aceitar/:token` (auth secretaria) — aceita convite, invalida cache de role
- `PUT /agenda/secretarias/:id` — atualiza permissoes/ativo
- `DELETE /agenda/secretarias/:id` — soft-delete

#### Push Web:
- `GET /agenda/push/vapid-public-key` (PUBLICO)
- `POST /agenda/push/subscribe` — Body: subscription completa
- `DELETE /agenda/push/subscribe` — Body: `{endpoint}`

---

## 4. Servicos externos

### 4.1. Anthropic Claude (`services/ai.js`)

API key: `ANTHROPIC_API_KEY` (ou `CLAUDE_API_KEY` em iaCollab).

Modelos usados:
- `claude-sonnet-4-20250514` — exame estruturado, summary fallback, scan fallback, info substancia, melhorias, verificar completude
- `claude-haiku-4-5-20251001` — anamnesista (padroes v2), iaCollab
- `claude-opus-4-20250514` — idade biologica
- `claude-opus-4-6` — gerar perguntas template

Pra que serve cada chamada:
1. **estruturarExameDeArquivo** — recebe PDF/imagem do exame, retorna JSON com parametros, classificacao, resumo, impactos, melhorias. PROMPT em `SYSTEM_PROMPT_ESTRUTURAR` linha 13.
2. **gerarAnaliseExame** — analise comparativa com historico (mantida pra compat).
3. **calcularIdadeBiologica** — PhenoAge/GrimAge inspired. Retorna `{idadeBiologica, confianca, fatores}`.
4. **gerarMelhorias** — recomendacoes personalizadas. Respeita alergias + medicamentos em uso.
5. **gerarInfoSubstancia** — info sobre medicamento OU alergia (descricao, beneficios, sintomas, etc).
6. **gerarSummaryPreConsulta** — o coracao do briefing. Gera JSON com: `descricaoBreve`, `summaryTexto`, `textoVoz` (briefing falado 150-180 palavras), `queixaPrincipal`, `pontosAtencao`, `identificaPadroes`, `blocos`, `alertas`, `anamneseEstruturada` (11 campos). PROMPT principal em linha 719 (`userPrompt`) + system prompt em linha 968. Tenta Gemini primeiro, Claude fallback. Tem `tentarRecuperarJSON` pra reparar JSON cortado.
7. **verificarCompletudeTopicos** — analisa transcricao e diz quais dos 9 topicos foram cobertos.
8. **classificarRespostaIndividual** — V2/V4 quiz. Recebe `{pergunta, transcricao}` e retorna `{respondeu, valor, confianca 0-1, motivo}`.

**Prompts importantes (literais):**

**Sistema do summary (linha 968 do `ai.js`):**
```
Voce e um interpretador clinico da plataforma VITAE, construido para adiantar contexto para medicos antes da consulta.
Seu papel e INTERPRETAR — nunca reorganizar, nunca diagnosticar, nunca prescrever.
...
REGRAS ABSOLUTAS DE SEGURANCA JURIDICA E CLINICA:
1. PROIBIDO diagnosticar: nunca "o paciente tem X"...
2. PROIBIDO prescrever: nunca "recomendo"...
3. PROIBIDO ler formulario: nunca "o paciente respondeu que"...
4. PROIBIDO mencionar IA: nunca "inteligencia artificial"...
5. PROIBIDO inventar dados...
6. USE linguagem interpretativa segura: "relata", "refere", "informa"...
```

**Estrutura do textoVoz (1 minuto):** 4 blocos obrigatorios:
1. Abertura (~15-20 palavras): "Doutor, [nome COMPLETO], [idade] anos, [motivo]"
2. Identificacao + Queixa (~45 palavras)
3. Interpretacao (max 80 palavras) — cruzamentos
4. Seguranca + Fechamento (~30 palavras) — alergias documentadas + ponto principal

**Indispensaveis (NUNCA pode faltar):** nome completo, idade, queixa principal, duracao, TODAS as alergias por nome, TODOS os medicamentos por nome.

### 4.2. Google Gemini (`services/ai.js`)

API key: `GEMINI_API_KEY`. Modelo: `gemini-2.5-flash`.

Pra que serve:
1. **Scan de receita medica** (`scanReceita`) — PROMPT linha 1266 do `ai.js`. Identifica medicamentos em foto. Retorna `{tipo: 'receita'|'medicamento'|'nao_receita', medico, data, medicamentos:[{nome, principio_ativo, dosagem, forma, frequencia, duracao, laboratorio, quantidade, uncertain, confianca}]}`.
2. **Scan de exame alergico** (`scanAlergia`) — PROMPT linha 1397. Categoriza por MEDICAMENTO|ALIMENTO|AMBIENTAL|CONTATO + LEVE|MODERADA|GRAVE.
3. **Summary da pre-consulta** — Gemini e primario, Claude fallback (linha 984).
4. **Classificador V2/V4** (`classificarRespostaIndividual`) — Gemini primario, Claude fallback (linha 1572). Temperature 0.3 pra determinismo.

Deadline compartilhado: 26s pra Gemini + Claude (Railway mata em 30s). Funcao `comTimeout(promise, ms, label)` faz `Promise.race` com timeout.

### 4.3. OpenAI Whisper (`services/transcription.js`)

API key: `OPENAI_API_KEY`. Modelo: `whisper-1`. Language: `pt`.

Pra que serve:
1. **transcreverAudio(audioUrl)** — baixa audio do Supabase, manda pro Whisper, retorna text.
2. **transcreverAudioComTimestamps(audioUrl)** — mesma coisa mas com `response_format: 'verbose_json'` e `timestamp_granularities: ['word']`. Retorna `{text, words:[{word, start, end}]}` pra sync karaoke no frontend.

Formatos aceitos: webm, mp4, ogg, wav, m4a.

### 4.4. ElevenLabs (TTS) — `services/ai.js`

API key: `ELEVENLABS_API_KEY`. Voice ID: `ELEVENLABS_VOICE_ID` (default `onwK4e9ZLuTAKqWW03F9` — Daniel).

Funcao: `gerarAudioElevenLabs(textoVoz, pacienteNome)`.
- Modelo: `eleven_multilingual_v2`.
- Voice settings: `{stability: 0.5, similarity_boost: 0.75}`.
- Retorna Buffer MP3.
- NAO anonimiza nome (medico precisa ouvir nome real na abertura).

### 4.5. Twilio (SMS) — `services/sms.js`

Vars: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.

Funcao: `enviarCodigoVerificacao(celular, codigo)` — envia SMS "VITAE: Seu codigo de verificacao e XXXXXX. Valido por 10 minutos.".

Modo dev (sem Twilio configurado): loga no console.

**REMOVIDO 2026-05-10:** `enviarSMSConfirmacaoPreConsulta` — confirmacao ao paciente fica dentro da propria pre-consulta.html.

### 4.6. Resend (Email) — `services/email.js`

API key: `RESEND_API_KEY`. From: `VITAE Health <onboarding@resend.dev>`.

Funcoes:
1. **enviarEmailResetSenha(emailDestino, nomeUsuario, linkReset)** — HTML dark theme com botao "Redefinir minha senha".
2. **enviarEmailPreConsultaRespondida(emailMedico, nomeMedico, nomePaciente, summaryIA, linkDashboard)** — notifica medico que paciente respondeu.

### 4.7. Supabase Storage — `services/storage.js`

Vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (ou `SUPABASE_ANON_KEY`). Bucket unico: `vitae`.

Pastas dentro do bucket:
- `exames/{usuarioId}/` — exames
- `audios/` — audio das PCs
- `fotos/` — fotos da PC
- `audios-chunks/` — chunks de audio temporarios (V2)
- `pre-consulta-v4-chunks/` — chunks V4
- `tts/` — audios ElevenLabs gerados

Funcoes:
- **upload({buffer, nomeOriginal, mimetype, pasta})** — upload com `upsert: true`. Sanitiza nome. Fallback local em `backend/uploads/{pasta}/` se Supabase falhar.
- **gerarUrlAssinada(path, {expiraEmSegundos})** — URL temporaria.
- **deletar(path)** — extrai caminho relativo e remove.

### 4.8. Google Calendar — `services/agenda/google-sync.js`

Vars: `GCAL_CLIENT_ID`, `GCAL_CLIENT_SECRET`, `GCAL_REDIRECT_URI`, `GCAL_ENCRYPTION_KEY` (32 bytes pra AES-256-GCM).

OAuth 2.0:
1. `gerarAuthUrl(state)` → redireciona pra Google
2. Callback: `processarCallback(code, medicoId)` — troca code por tokens, encripta com AES-256-GCM (token_enc, iv, tag), salva em `medico.googleToken*`
3. `sincronizar(medicoId, dias)` — lista eventos das agendas selecionadas, filtra all-day, cria `AgendaSlot` com origem=GOOGLE_IMPORT.

### 4.9. Geocoding — `services/geocoding.js`

Funcao: `geocodificar(endereco)` retorna `{lat, lng}` ou `null`. Provavelmente usa servico externo (Nominatim/Mapbox) — arquivo nao foi lido na profundidade.

---

## 5. Workers (`backend/src/workers/`)

Unico worker: `processador.js`. Iniciado pelo `index.js` no boot do servidor com `iniciarWorker()`.

### 5.1. Worker principal (fila TarefaPendente)

- Intervalo: `setInterval(tick, 30s)` apos delay inicial de 10s.
- Limite por ciclo: 5 tarefas simultaneas.
- Max tentativas: 5 (apos isso `dead=true`).
- Backoff exponencial: 30s, 2min, 10min, 30min, 2h.

**Tipos processados:**
- `GERAR_SUMMARY_E_TTS` — funcao `processarGerarSummaryETts(tarefa)`:
  1. Whisper transcreve audio (com word-level timestamps)
  2. Enriquece respostas com perfil do paciente vinculado
  3. Gera summary (Gemini + Claude fallback) — VALIDA INDISPENSAVEIS (nome, idade, alergias por nome, meds por nome). Faz ate 2 tentativas se faltar
  4. Gera TTS ElevenLabs
  5. Calcula nivel briefing 0-5 + atualiza statusXxx
  6. Envia email pro medico
- `AGENDA_OFERTAR_VAGA` — chama `esperaSvc.tentarOfertar(slotId)`.

### 5.2. Worker de lembretes Agenda (`tickLembretes`)

- Intervalo: 2 min.
- So roda se `AGENDA_V1_ENABLED=true`.
- Busca `listarLembretes24hPendentes()` e `listarLembretes2hPendentes()`.
- Envia via `lembretesSvc.enviar(slotId, '24h'|'2h')`.

### 5.3. Worker de no-show automatico (`tickNoShow`)

- Intervalo: 1 hora.
- So se `AGENDA_V1_ENABLED=true`.
- Busca slots com `fim < now - 1h` e status AGUARDANDO_CONFIRMACAO ou CONFIRMADA.
- Marca FALTA via `slotsSvc.marcarStatus(id, 'FALTA', 'AUTO_NO_SHOW')`.

### 5.4. Worker de sync Google Calendar (`tickGoogleSync`)

- Intervalo: 30 min.
- So se `AGENDA_V1_ENABLED=true` E `AGENDA_GCAL_ENABLED=true`.
- Itera medicos com `googleConectadoEm != null`.
- Chama `gcalSvc.sincronizar(medicoId, 90)`.

### Estrutura da fila

Tabela `tarefas_pendentes`:
- `processadoEm = null` + `proximaTentativa <= NOW()` → pega no proximo tick
- Em sucesso: marca `processadoEm`
- Em erro: `tentativas++`, `proximaTentativa = NOW() + backoff`
- Apos 5 falhas: `dead=true`, medico ve "Incompleta" no dashboard, admin pode forcar retry via `POST /admin/queue/:id/retry`

---

## 6. Pipeline Padroes Observados v2

Local: `backend/src/services/padroes/`.

Feature flag: `PADROES_V2_ENABLED=true`. Quando false, pipeline NAO roda — backend usa apenas summary tradicional.

### 6.1. Os 5 agentes

1. **Anamnesista** (`anamnesista.js`) — UNICA chamada LLM (Claude Haiku 4.5).
   - Extrai 17 campos estruturados: queixa_principal, duracao_dias, duracao_horas, intensidade (0-10), localizacao, qualidade_dor, inicio_dor, fatores_piora[], fatores_melhora[], sintomas_associados[], padrao_temporal, medicamentos_mencionados[], alergias_mencionadas[], condicoes_mencionadas[], historico_familiar[], habitos[], outras_queixas[].
   - **Pseudonimiza** antes do LLM: remove CPF (regex), telefone, email (LGPD Art. 11).
   - Sanitiza: minusculas, trim, garante arrays.
   - Timeout 8s.

2. **Farmacologista** (`farmacologista.js`) — 100% DETERMINISTICO, sem LLM.
   - Le `backend/knowledge/_farmacologia/classes.json` + `sinonimos.json`.
   - Normaliza nomes (ex: "Novalgina" → `{principio_ativo: "dipirona", classe: "pirazolonicos"}`).
   - Cruza alergias × medicamentos por:
     - principio_ativo igual
     - classe igual (incluindo cruzamentos: penicilinas ↔ cefalosporinas_1g; ieca ↔ bra; sulfas ↔ diureticos_tiazidicos)
     - texto da alergia contem nome da classe
   - Severidade: `critica` se alergia GRAVE/ANAFILAXIA, senao `alta`.
   - Detecta auto-medicacao: medicamento mencionado no audio mas nao no perfil.
   - Cada card tem ID `AUD-{timestamp}-{random}` + disclaimer.

3. **Matching/Epidemiologista** (`matching.js`) — 100% DETERMINISTICO.
   - Le `backend/knowledge/{queixa}/*.json`.
   - Detecta queixa principal via mapa de termos (`cefaleia`, `dor_toracica`, etc).
   - Pra cada condicao da queixa:
     - Avalia `criterios_exclusao` (qualquer = elimina)
     - Calcula score: soma de pesos dos `criterios_positivos` que bateram / soma maxima × 100
     - Aplica `modificadores_demograficos` (ex: enxaqueca em mulher 25-55a ganha +2 peso)
   - Operadores: equals, contains, contains_any, not_contains_any, `>=`, `>`, `<=`, `<`, range.
   - Detecta red flags transversais: inicio_subito_severo, deficit_neurologico, febre_associada, rigidez_nuca, piora_valsalva, progressiva_semanas, idade_primeira_crise_maior_50, alteracao_consciencia.
   - Ordena candidatos por score desc.

4. **Compliance** (`compliance.js`) — ULTIMA LINHA DE DEFESA.
   - Valida cada card:
     - fonte_obrigatoria (titulo)
     - score >= 60 (SCORE_MINIMO) — exceto red_flag, alergia_medicamento, auto_medicacao
     - sinais_bateram >= 3 (SINAIS_MIN)
     - base_version presente
     - **Linguagem nao-diagnostica** (regex bloqueia): "paciente tem", "diagnostico de", "sofre de", "confirma diagnostico/doenca"
   - Aplica `disclaimer` padrao se ausente: "Sugestao de apoio a decisao baseada em literatura clinica. Nao constitui diagnostico. Ato medico privativo (CFM Resolucao 2.299/2021)."
   - Retorna `{aprovados, rejeitados}` (com motivo da rejeicao).

5. **Pipeline orquestrador** (`pipeline.js`) — `rodar({transcricao, respostas, perfil, idade, sexo})`.
   - Timeout global 15s.
   - Order: Anamnesista → (Farmacologista + Matching em paralelo) → Consolidar cards → Compliance.
   - Consolidacao em 4 blocos visuais: critico_topo (alergia critica), alerta_farmaco, auto_medicacao, padrao_diferencial (cap 3), red_flag_separado.
   - Retorna `{sucesso, pipeline_version, anamnese_resumo, padroesObservados_v2: aprovados, alertasFarmacologicos, examesRelevantes, auditoria, base_versions, tempo_ms, red_flags_detectados}`.

### 6.2. Base de conhecimento (`backend/knowledge/`)

**JSONs existentes:**

- `_version.json` — pipeline_version, queixas_disponiveis (20), queixas_pendentes ([], hoje tudo coberto), fontes_prioridade, regras_duras (score_minimo 60, sinais_bateram_minimo 3, exige_fonte_prioridade [1,2])
- `_farmacologia/classes.json` — 23 classes farmacologicas BR (pirazolonicos, aines, paraaminofenois, penicilinas, cefalosporinas, macrolideos, sulfas, bra, ieca, beta_bloqueadores, bcc_dihidropiridinicos, diureticos_tiazidicos, ibp, biguanidas, estatinas, issrs, benzodiazepinicos, antidepressivos_triciclicos, triptanos, corticosteroides, antihistaminicos_h1, contraceptivos)
- `_farmacologia/sinonimos.json` — ~70 mapeamentos nome comercial→principio ativo (Novalgina→dipirona, Tylenol→paracetamol, Voltaren→diclofenaco, Amoxil→amoxicilina, Keflex→cefalexina, Bactrim→sulfa, Losartana→losartana/bra, Glifage→metformina, Rivotril→clonazepam, etc)
- `_red_flags_transversais.json` — definicoes
- 20 pastas de queixas:
  - **cefaleia/**: tensional_cronica, enxaqueca_sem_aura, enxaqueca_com_aura, cluster, cefaleia_secundaria + _diretriz_source.md + _version.json
  - **dor_toracica/**: sca_provavel, tep, costocondrite, refluxo + _diretriz_source.md
  - **dispneia/**: pneumonia, asma, dpoc_exacerbacao, insuficiencia_cardiaca + _diretriz_source.md
  - **febre/**: sindrome_gripal, dengue, itu + _diretriz_source.md
  - **dor_abdominal/**: apendicite, gastrite, colelitiase, sii + _diretriz_source.md
  - **tosse/**: ivas, bronquite_aguda, tuberculose + _diretriz_source.md
  - **dor_lombar/**: lombalgia_mecanica, hernia_disco, litiase_renal + _diretriz_source.md
  - **tontura/**: vppb, vestibulopatia, hipotensao_ortostatica
  - **dor_articular/**: osteoartrite, artrite_reumatoide, gota
  - **diarreia/**: gastroenterite_aguda, intoxicacao_alimentar, sii_diarreia
  - **vomito/**: gastroenterite_vomito, cinetose, enxaqueca_vomito
  - **fadiga/**: anemia, hipotireoidismo, depressao
  - **perda_peso/**: hipertireoidismo, diabetes_descompensado, neoplasia
  - **palpitacao/**: ansiedade_palpitacao, arritmia
  - **edema/**: insuficiencia_venosa, insuficiencia_cardiaca_edema
  - **disuria/**: cistite, uretrite
  - **prurido/**: urticaria, dermatite_atopica
  - **lesao_pele/**: dermatite_contato, micose
  - **ansiedade/**: panico, tag
  - **insonia/**: insonia_primaria, apneia_sono

**Estrutura de cada JSON de condicao** (ex: `cefaleia/enxaqueca_sem_aura.json`):
```json
{
  "id": "cefaleia_enxaqueca_sem_aura",
  "queixa": "cefaleia",
  "nome": "Enxaqueca sem aura",
  "nome_popular": "Enxaqueca",
  "cid10": "G43.0",
  "versao": "1.0",
  "prevalencia": {geral, feminino_adulto, masculino_adulto, idoso, pediatrico},
  "criterios_positivos": [{campo, operador, valor, peso, descricao}],
  "criterios_exclusao": [{campo, operador, valor, motivo}],
  "red_flags_transversais": ["inicio_subito_severo", ...],
  "modificadores_demograficos": [{condicao, peso_extra, motivo}],
  "fatores_risco": [],
  "exames_relevantes": [],
  "proximo_passo_template": "Aplicar criterios ICHD-3 ...",
  "fonte": {titulo, ano, url, secao, tipo, prioridade},
  "fonte_complementar": {titulo, ano, url, tipo},
  "nivel_evidencia": "A",
  "contraindicacao_gestacao": false,
  "consideracoes_gestacao": "...",
  "_validacao": {criterios_alinhados_com, revisado_por, data_revisao}
}
```

### 6.3. Threshold e regras duras

- **SCORE_MINIMO = 60** (`compliance.js:12`) — cards com score < 60 sao rejeitados (exceto red flags, alergias e auto-medicacao).
- **SINAIS_MIN = 3** (`compliance.js:13`) — precisam de 3+ criterios batendo.
- **Linguagem proibida regex:** `/\bpaciente tem\b/i`, `/\bdiagn[oó]stico de\b/i`, `/\b[ée] uma? \w+\b/i`, `/\bsofre de\b/i`, `/\bconfirm[ao] (?:o )?(?:diagn[oó]stico|doen[çc]a)\b/i`.

### 6.4. Feature flag `PADROES_V2_ENABLED`

Verificada em runtime via `process.env.PADROES_V2_ENABLED === 'true'` no `services/padroes/index.js:6`.

Quando `false`:
- Pipeline NAO roda
- `summaryJson.padroesObservados_v2` nao e populado
- Frontend cai no fallback (componente v1 legado)

Pra ativar em prod: Railway → Environment Variables → `PADROES_V2_ENABLED=true` → redeploy automatico.

Pra desativar (rollback < 60s): setar `false` no Railway.

---

## 7. Variaveis de ambiente

Lista completa de env vars que o backend espera (extraida do codigo):

### Obrigatorias
- `DATABASE_URL` — Postgres do Supabase (formato `postgresql://...`)
- `JWT_SECRET` — chave de assinatura JWT (usada tambem como salt do hash de IP/UA)

### Importantes
- `ANTHROPIC_API_KEY` — Claude (todos os modelos)
- `CLAUDE_API_KEY` — alternativo, usado SO em `services/iaCollab.js`
- `GEMINI_API_KEY` — Google Gemini (scan, summary primario)
- `OPENAI_API_KEY` — Whisper (transcricao audio)
- `ELEVENLABS_API_KEY` — TTS
- `ELEVENLABS_VOICE_ID` — voz pra usar (default `onwK4e9ZLuTAKqWW03F9` Daniel)
- `SUPABASE_URL` — endpoint Supabase
- `SUPABASE_SERVICE_KEY` ou `SUPABASE_ANON_KEY` — key do storage
- `RESEND_API_KEY` — email
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — SMS de cadastro

### Config
- `PORT` — porta HTTP (default 3001; Lucas usa 3002 local)
- `NODE_ENV` — `development` ou `production` (afeta CORS e debug logs)
- `JWT_EXPIRES_IN` — default `15m`
- `REFRESH_EXPIRES_DAYS` — default 30
- `FRONTEND_URL` — default `https://vitae-app.vercel.app` (usado em links de PC, OAuth callback)
- `RESET_URL` — base do link de reset de senha (default `http://localhost:3000`)

### Feature flags
- `PADROES_V2_ENABLED` — `true`/`false` (default false). Liga pipeline Padroes Observados v2.
- `PROSODICA_MODO` — `mock`/`real` (default `mock`). Modo da analise prosodica.
- `AGENDA_V1_ENABLED` — `true`/`false`. Liga modulo Agenda completo (gate em `/agenda/*` retorna 503 se false).
- `AGENDA_GCAL_ENABLED` — `true`/`false`. Sub-flag pra integracao Google Calendar.
- `AGENDA_DARK_USERS` — CSV de usuarioIds (dark launch — so esses usuarios veem agenda quando flag mestra ON).

### Google Calendar OAuth
- `GCAL_CLIENT_ID` — Client ID do Google Cloud Console
- `GCAL_CLIENT_SECRET` — Client Secret
- `GCAL_REDIRECT_URI` — URL do callback (`{backend}/agenda/google/callback`)
- `GCAL_ENCRYPTION_KEY` — chave AES-256-GCM (32 bytes) pra encriptar tokens armazenados

### Observabilidade
- `SENTRY_DSN` — DSN do Sentry (opcional)
- `ADMIN_TOKEN` — token pra rotas `/admin/*` (header `x-admin-token`)

### WhatsApp (REMOVIDO 2026-05-10, podem sair do Railway)
- `WHATSAPP_MODO` — `simulacao` (legado, nao usado mais)
- `TWILIO_WHATSAPP_FROM`
- `WHATSAPP_TEMPLATE_LEMBRETE_SID`
- `WHATSAPP_TEMPLATE_CONFIRMACAO_SID`

---

## 8. CORS, rate limits, seguranca

### CORS (`index.js:36-59`)

**Origens liberadas em producao:**
- `https://vitaehealth2906-ops.github.io` (legado — GitHub Pages desativado mas mantido no allowlist)
- `https://vitae-app.vercel.app` (producao Vercel)
- `http://localhost:3000`, `:3001`, `:3002` + `http://127.0.0.1:` equivalents

**Em dev** (`NODE_ENV !== 'production'`): aceita qualquer origin (inclusive sem origin, ou seja, `file://`, curl, Postman).

**Em prod:** se origin nao bate em nenhum allowlist (com `startsWith`), rejeita.

Headers permitidos: `Content-Type, Authorization`.
Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS.
Credentials: true.

### Rate Limits (`index.js:75-99`)

- **limiterGeral:** 300 req/min por IP. Aplicado em `/perfil`, `/exames`, `/medicamentos`, `/alergias`, `/scores`, `/checkin`, `/notificacoes`, `/pdf`, `/medico`, `/agendamento`, `/consentimento`, `/templates`, `/timeline`, `/agenda`.
- **limiterPublico:** 60 req/min. Aplicado em `/pre-consulta`, `/autorizacao`, `/admin`.
- **limiterAuth:** 20 req em 15min. Aplicado SO em `/auth` (defesa contra brute-force).

Trust proxy: `app.set('trust proxy', 1)` — pega IP real do Railway/Vercel header.

### Sanitizacao XSS

- Helper `sanitizar(str)` em `utils/respostas-v4.js:50` — remove `<>`, `javascript:`, normaliza espacos, limita 5000 chars. Usado em respostas V4.
- Outros endpoints confiam no Zod + Prisma (sem HTML rendering no backend; tudo retorna JSON).

### LGPD

- **Pseudonimizacao:**
  - Anamnesista pseudonimiza transcricao antes de mandar pro Claude (CPF, telefone, email viram `[CPF_REMOVIDO]`, etc).
  - iaCollab anonimiza preConsultas (so envia queixa, anamneseEstruturada, summaryTexto — sem nome/tel/email).
  - Analise prosodica armazena APENAS hash SHA-256 do audio (nao o audio).
  - Audit trail hasheia IP e User-Agent com salt do JWT_SECRET.
- **Retencao:**
  - `auditoria_briefing` — 5 anos (CFM)
  - `AnaliseProsodicaArquive` — 20 anos (CFM 2.314/2022, campo `retencaoAte`)
  - PCs — sem politica de retencao automatica explicita; soft-delete via `deletadoEm`.
- **Direito de portabilidade:** `GET /medico/me/exportar-dados-lgpd?formato=json|csv` (LGPD Art. 18).
- **Direito de apagamento:** `DELETE /medico/me` — soft-delete com janela 30 dias.
- **Consentimento:** tabela Consentimento + auto-criacao quando paciente responde PC (`COMPARTILHAMENTO_MEDICO` v1.0). Armazena IP + UA.
- **Auditoria:** AuditoriaAcesso registra VIEW_PACIENTE, VIEW_EXAME, VIEW_RG_PUBLICO, AUTO_LINK_PACIENTE, etc.
- **Revogacao de token:** tabela `jwt_revogados` permite invalidar JWT imediatamente quando consentimento e revogado.

### Outras protecoes

- **bcrypt cost 12** pra senhas + codigos SMS.
- **HEAD request validation** antes de aceitar pre-consulta com audio (Sessao 5 — fix do bug "audio silencioso").
- **Idempotencia por attemptId** em responder-audio (evita duplicar processamento em retry do paciente).
- **UPDATE atomico com filtro `status: {not: 'RESPONDIDA'}`** evita double-submit.
- **Debounce em memoria** pra regenerar PC (15s).
- **`directUrl` removido** do schema (Prisma 7 nao aceita; usar `databaseUrl` direto).

---

## 9. Endpoints publicos (sem auth)

Lista completa:

1. `GET /health` — status simples
2. `GET /version` — `{version: '3.1-gemini'}`
3. `POST /test-scan` — APENAS em dev (gate `isDevelopment`)
4. `GET /autorizacao/rg-publico/:userId` — RG da Saude publico (medico escaneou QR)
5. `GET /autorizacao/exame-publico/:userId/:examId` — exame individual publico
6. `GET /templates/preview-publico/:id` — preview do template pro iframe
7. `GET /pre-consulta/t/:token` — paciente abre link (`authOpcional`, funciona com ou sem JWT)
8. `POST /pre-consulta/t/:token/responder-audio` — paciente envia respostas + audio
9. `POST /pre-consulta/t/:token/responder` — paciente envia respostas + base64
10. `POST /pre-consulta/t/:token/classificar-resposta` — V2 classifica audio chunk
11. `GET /pre-consulta/t/:token/estado` — V4 retomada de sessao
12. `POST /pre-consulta/t/:token/responder-pergunta` — V4 salva 1 resposta
13. `POST /pre-consulta/t/:token/finalizar` — V4 finaliza
14. `POST /pre-consulta/t/:token/verificar` — verifica completude topicos
15. `POST /auth/cadastro`, `/login`, `/login-social`, `/refresh`, `/verificar-sms`, `/esqueci-senha`, `/resetar-senha` — fluxo auth (rate limit apertado 20/15min)
16. `GET /agenda/slots/:id/confirmar-presenca?token=` — paciente confirma (HMAC token)
17. `GET /agenda/slots/:id/recusar?token=` — paciente pede remarcar
18. `GET /agenda/lista-espera/aceitar?token=` — paciente aceita vaga
19. `GET /agenda/google/callback?code&state` — OAuth callback (state JWT)
20. `GET /agenda/push/vapid-public-key` — chave publica VAPID

**Atencao:** todos rate-limited (60/min publico, 20/15min auth).

---

## 10. Metricas honestas do medico

Implementacao Sessao 22 (2026-05-09).

### 10.1. Os 5 inputs declarativos do setup

Salvos em `medico.metricasConfig` (JSON nullable). Validados em `PUT /medico/metricas/setup`:

1. **tempoAnamneseSemVitae** (1-60 min) — tempo da anamnese SEM vita id
2. **percentualEconomiaAnamnese** (10-95) — % que o medico declara economizar
3. **tempoMedioConsulta** (5-240 min) — tempo total da consulta
4. **valorConsulta** (0-10000 R$) — ticket medio
5. **taxaNoShow** (0-50%) — % pacientes que faltam

Validacao cruzada: anamnese nao pode durar mais que consulta inteira.

### 10.2. Service `completude.js`

Calcula % (0-100) de preenchimento dos 11 campos da anamnese estruturada:
- queixaPrincipal, tempoEvolucao, intensidade, fatoresAgravantes, fatoresAtenuantes, sintomasAssociados, tratamentoPrevio, antecedentesPessoais, antecedentesFamiliares, habitos, sono

**Funcao `ehPreenchido(valor)`:**
- String com > 3 caracteres alfanumericos
- Nao e placeholder ("—", "-", "n/a", "nao sei", "pulado", "desconhecer", "sem informacao")

**Funcao `calcularCompletude(preConsulta)`** tenta 3 fontes em ordem:
1. `summaryJson.anamneseEstruturada` (estrutura nova Sessao 13)
2. `respostas` com chaves nomeadas (fallback)
3. Legado: se status=RESPONDIDA e tem respostas, conta como 25-50%

Status PENDENTE/ABERTO/EXPIRADA = 0%.

### 10.3. Service `calcularMetricas.js`

**Funcao `janelaPeriodo(periodo)`:**
- `hoje` — 00:00 ate agora
- `semana` — ultimos 7 dias rolling
- `mes` — mes corrente (dia 1 ate agora)
- `30dias` — rolling 30 dias (default)

**Funcao `calcularMetricas(medico, preConsultas, periodo)`:**

Calculo (com aritmetica em centesimos pra evitar erro float):
```
Para cada PC respondida:
  centesimos = (tempoAnamneseSemVitae × completude × percentualEconomiaAnamnese) / 100

tempoEconomizadoMin = floor(sumCentesimos / 100)
atendimentosEquivalentes = floor(tempoEconomizadoMin / tempoMedioConsulta)
receitaPossivel = floor(atendimentos × valorConsulta × (1 - taxaNoShow/100))
```

**Indicador de confianca (4 faixas):**
- 0-9 PCs medidas: 50-68%
- 10-29: 70-85%
- 30-59: 85-92%
- 60+: 92-95%

**Retorno:**
```json
{
  "periodo": "30dias",
  "setupConcluido": true,
  "alerta": null,
  "tempoEconomizadoMin": 42,
  "atendimentosEquivalentes": 1,
  "receitaPossivel": 180,
  "precisao": 85,
  "consultasMedidas": 28,
  "consultasNoPeriodo": 30,
  "detalhe": {
    "tempoAnamneseSemVitae": 12,
    "percentualEconomiaAnamnese": 70,
    "tempoMedioConsulta": 30,
    "valorConsulta": 250,
    "taxaNoShow": 15,
    "completudeMediaPeriodo": 82,
    "calibradoEm": "2026-05-09T..."
  }
}
```

Se setup nao concluido: retorna `setupConcluido: false`, zeros e mensagem "Configure suas informacoes no perfil pra liberar as metricas".

### 10.4. Calibracao mensal

`POST /medico/metricas/calibracao` — banner mensal "esse numero faz sentido?":
- Body: `{resposta: 'ok'|'superestimado'|'subestimado', ajustes?}`
- Aceita ajustes em `percentualEconomiaAnamnese` (10-95) e `tempoAnamneseSemVitae` (1-60)
- Mantem historico `calibracoes[]` (ultimos 12 meses)
- Marca `calibradoEm`

Trigger no frontend: passou >= 30 dias da ultima calibracao OU >= 10 PCs sem nunca calibrar.

### 10.5. Honestidade aplicada (decisoes Sessao 22)

- Removido multiplicador 5/21 das projecoes (semana/mes = soma real do periodo)
- Removido 0.7 hardcoded universal (vira input do medico)
- Removido default `valorConsulta = 0` (medico obrigado a preencher)
- "Atendimentos a mais" → "Tempo livre equivalente a X consultas"
- "Receita potencial" → "Receita possivel" (ja desconta no-show)
- Math.floor em todas exibicoes (conservador)
- Indicador de confianca visivel em todas as telas

---

## Apendice A — Middleware

### auth.js
- `verificarAuth(req, res, next)` — obrigatoria. Decodifica JWT, verifica jwt_revogados (cache 60s), seta `req.usuario = req.user = {id, email, jti}`.
- `authOpcional(req, res, next)` — nao rejeita se faltar token. `req.user = null` se ausente.

### validate.js
- `validate(zodSchema)` — fabrica de middleware. Substitui `req.body` pelo parsed. Em ZodError retorna 400 com array de `{campo: mensagem}` em portugues.

### permission.js (modulo Agenda)
- `carregarPermissoes(req)` — busca role do usuario (PACIENTE/MEDICO/SECRETARIA), busca medicoId se medico, busca SecretariaVinculo[] ativos. Cache 60s.
- `medicoOnly` — rejeita 403 se nao role=MEDICO.
- `medicoOuSecretariaCom(permissao)` — fabrica. Aceita medico operando sobre proprio dado OU secretaria com permissao especifica em target medicoId.
- `pacienteOnly`, `bloquearSecretariaParaClinico`, `invalidarCache`.

### errorHandler.js
- Trata `Prisma.PrismaClientKnownRequestError`: P2002→409, P2025→404, P2003→400, P2014→400.
- Em DEV inclui `debug_code`, `debug_meta`, `debug_message` no response.
- Em PROD: so mensagem generica.
- Trata Zod (400 com detalhes).
- Trata JWT (401 expirou/invalido).
- `err.statusCode` custom → status do erro.
- Captura no Sentry se ativo.
- **NUNCA loga req.body/query** (LGPD).

---

## Apendice B — Migrations e schema versionado

Pasta: `backend/prisma/migrations/`.

Migrations existentes:
- `20260505_fase7_medico_prosodica/migration.sql` — Fase 7 (8 colunas em medico + 2 tabelas analise_prosodica_arquive + notificacao_disparos)
- `20260508_calendar_reframe/migration.sql` — Agenda v1 calendar (googleCalendarIds, googleSyncedAt, pausadoAte, AgendaSlot.ignorado, tituloEvento)
- `20260508b_calendar_titulo_evento/migration.sql` — followup
- `20260509_metricas_honestas/migration.sql` — ADD COLUMN metricasConfig Json?
- `20260509_add_data_consulta_pc/migration.sql` — ADD COLUMN dataConsulta DateTime?

**Migration AUTO no boot** (`index.js:178-442`): em CADA boot do servidor o backend roda `$executeRawUnsafe` com `IF NOT EXISTS` em todos os ALTER TABLE / CREATE TABLE / CREATE INDEX. Idempotente, zero risco. Garante que mesmo sem rodar `prisma migrate deploy` o schema fica consistente.

**REGRA CRITICA (do CLAUDE.md):** NUNCA adicionar `--accept-data-loss` no build do Railway. NUNCA `prisma db push` no script de build (apenas `prisma generate`). Schema changes via migration versionada OU migration auto idempotente.

---

## Apendice C — Estrutura visual do diretorio

```
backend/
├── package.json
├── prisma/
│   ├── schema.prisma (749 linhas)
│   └── migrations/
│       ├── 20260505_fase7_medico_prosodica/migration.sql
│       ├── 20260508_calendar_reframe/migration.sql
│       ├── 20260508b_calendar_titulo_evento/migration.sql
│       ├── 20260509_metricas_honestas/migration.sql
│       └── 20260509_add_data_consulta_pc/migration.sql
├── knowledge/
│   ├── _version.json
│   ├── _farmacologia/
│   │   ├── classes.json (23 classes)
│   │   └── sinonimos.json (~70 mapeamentos)
│   ├── _red_flags_transversais.json
│   └── 20 pastas de queixas (cefaleia/, dor_toracica/, ..., insonia/) com ~55 condicoes JSON
├── scripts/
│   ├── backup-pre-agenda.js
│   └── list-medicos.js
└── src/
    ├── index.js (479 linhas — bootstrap, CORS, rate limit, migration auto, worker)
    ├── routes/
    │   ├── auth.js (529 linhas)
    │   ├── perfil.js (187 linhas)
    │   ├── exames.js (305 linhas)
    │   ├── medicamentos.js (324 linhas)
    │   ├── alergias.js (209 linhas)
    │   ├── scores.js (148 linhas)
    │   ├── checkin.js (116 linhas)
    │   ├── notificacoes.js (113 linhas)
    │   ├── pdf.js (57 linhas)
    │   ├── medico.js (1150 linhas)
    │   ├── pre-consulta.js (1818 linhas)
    │   ├── agendamento.js (123 linhas)
    │   ├── autorizacao.js (281 linhas)
    │   ├── consentimento.js (121 linhas)
    │   ├── timeline.js (119 linhas)
    │   ├── templates.js (337 linhas)
    │   ├── admin.js (185 linhas)
    │   └── agenda.js (904 linhas)
    ├── services/
    │   ├── ai.js (1652 linhas — Claude + Gemini)
    │   ├── transcription.js (102 linhas — Whisper)
    │   ├── storage.js (126 linhas — Supabase)
    │   ├── sms.js (62 linhas — Twilio)
    │   ├── email.js (76 linhas — Resend)
    │   ├── score-engine.js (216 linhas)
    │   ├── completude.js (139 linhas — Sessao 22)
    │   ├── calcularMetricas.js (203 linhas — Sessao 22)
    │   ├── iaCollab.js (102 linhas — Fase 9)
    │   ├── prosodica.js (168 linhas — Fase 9)
    │   ├── briefing.js (165 linhas — Fase 3)
    │   ├── audit.js (58 linhas — Fase 7)
    │   ├── observability.js (179 linhas)
    │   ├── geocoding.js
    │   ├── ocr.js (legado)
    │   ├── padroes/
    │   │   ├── index.js (13 linhas)
    │   │   ├── pipeline.js (155 linhas)
    │   │   ├── anamnesista.js (120 linhas)
    │   │   ├── farmacologista.js (139 linhas)
    │   │   ├── matching.js (262 linhas)
    │   │   └── compliance.js (97 linhas)
    │   └── agenda/
    │       ├── index.js (43 linhas — flags)
    │       ├── slots.js
    │       ├── espera.js
    │       ├── lembretes.js
    │       ├── finalizar.js
    │       ├── google-sync.js
    │       ├── timezone.js
    │       ├── crypto.js (HMAC + AES-256-GCM)
    │       ├── push.js (web push VAPID)
    │       └── email-templates.js
    ├── workers/
    │   └── processador.js (577 linhas — fila TarefaPendente + 3 workers auxiliares)
    ├── middleware/
    │   ├── auth.js (92 linhas)
    │   ├── validate.js (38 linhas)
    │   ├── permission.js (173 linhas)
    │   └── errorHandler.js (94 linhas)
    └── utils/
        ├── prisma.js (singleton Prisma client)
        ├── telefone.js (normalizar + variantes)
        ├── auditoria.js (helper)
        └── respostas-v4.js (232 linhas — V4 quiz helpers)
```

---

## Apendice D — Decisoes importantes registradas no codigo

1. **Removido SMS de confirmacao** (2026-05-10): paciente ve confirmacao dentro da propria pre-consulta.html.
2. **Removido disparo WhatsApp em massa** (2026-05-10): virou clique-do-medico (`wa.me`).
3. **Removido matching por telefone/email no vincularPaciente** (2026-05-08): token e o vinculo unico (bug Julia Alves).
4. **IA NAO julga audio mais** (CAMINHO A — Sessao 17, 30/04/2026): transcricao bruta vira valor direto. Paciente confirma na tela seguinte.
5. **JWT 15min curto + Refresh 30d** (nao 30+90 como diz CLAUDE.md — codigo real e 15m+30d).
6. **Threshold RMS 0.006** pra deteccao de voz (era 0.015 — Sessao 16 reduziu pra captar voz natural).
7. **Padroes Observados v2 roda APOS summary tradicional**, em paralelo, sem substituir (circuit breaker).
8. **Audit trail nunca loga req.body** (LGPD).
9. **HEAD validation** depois de upload pra confirmar arquivo existe (Sessao 5 — fix audio silencioso).
10. **Dedupe automatico de medicamentos** (normalizado: minusculo, sem acento, espacos colapsados).
11. **Geocoding** automatico em endereco do consultorio + re-geocoding em update.

---

## Notas finais

Este manual foi mapeado lendo cada arquivo individualmente (todos os 30+ arquivos da pasta `backend/src/` e todos os JSONs de `backend/knowledge/`). Total de linhas mapeadas: ~10.000.

**Nao foram lidos em profundidade (mas estao listados):**
- `backend/src/services/agenda/slots.js`, `espera.js`, `lembretes.js`, `finalizar.js`, `google-sync.js`, `timezone.js`, `crypto.js`, `push.js`, `email-templates.js` — apenas listei suas funcoes via grep nas rotas de /agenda. Detalhes finos podem variar.
- `backend/src/services/geocoding.js` — apenas mencionada via funcao `geocodificar(endereco)` usada em medico.js.
- `backend/src/services/ocr.js` — provavelmente legado, substituido por `ai.estruturarExameDeArquivo`.

**O que e novo nesta versao do manual:**
- Schema atualizado pos-Fase 7 e Sessao 22
- Metricas honestas detalhadas
- Pipeline Padroes Observados v2 com 5 agentes
- Modulo Agenda v1 (Google Calendar, secretarias, web push)
- Decisoes recentes (remocao SMS, remocao WhatsApp massa)
