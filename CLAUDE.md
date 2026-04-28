# vita id — Documento Vivo do Projeto

> INSTRUCAO CRITICA PARA O CLAUDE: No final de TODA sessao de trabalho, ANTES de encerrar,
> voce DEVE atualizar este arquivo com tudo que aconteceu. Adicione nas secoes corretas:
> erros encontrados, tentativas de correcao, o que funcionou, o que nao funcionou,
> decisoes tomadas, e atualize o status geral. NUNCA encerre uma sessao sem atualizar este arquivo.
> Depois de atualizar, avise o Lucas: "CLAUDE.md atualizado — pode transferir pro Obsidian."

---

# PARTE A — CONTEXTO PERMANENTE

---

## 1. O QUE E O PROJETO

vita id e um **RG Digital de Saude** para brasileiros. Dois produtos no mesmo app que se conectam — dois publicos diferentes que compartilham os mesmos processos medicos:

### vita id — RG da Saude (para o paciente)
Coletamos dados do paciente: exames, medicamentos, alergias, dados de saude em geral. Com isso conseguimos propor acoes para eles serem identificados de maneira rapida e facil em hospitais e clinicas.

O paciente pode:
- Guardar todos os exames num lugar so (envia foto/PDF, o sistema le e organiza)
- Listar medicamentos (digita ou escaneia a receita)
- Registrar alergias (importante pra emergencia)
- Ver um score de saude de 0 a 100
- Compartilhar tudo com qualquer medico via QR Code em 1 segundo
- Receber lembretes de medicamento

### vitae — Plataforma Medica (para o medico)
O medico consegue mandar uma pre-consulta para o paciente. O paciente pega seu vita id (se nao tiver, cria um) e responde em forma de audio. Chega tudo mastigado pro medico: audio de 1 minuto falando sobre o que esta rolando com o paciente, insights medicos, etc.

O medico pode:
- Criar templates de perguntas pra pre-consulta
- Gerar link e enviar pro paciente via WhatsApp
- Receber resumo de 1 minuto do paciente (gerado automaticamente)
- Ver historico de exames, medicamentos e alergias do paciente
- Gerenciar varios pacientes num dashboard

### Origem
Lucas Borelli (fundador, 18 anos, Americana-SP) foi internado por crise alergica (Dipirona + Penicilina). Nenhum sistema avisou o medico. O vita id nasceu pra resolver isso — historico de saude sempre acessivel, em qualquer emergencia.

---

## 2. SOBRE O LUCAS (fundador)

- 18 anos, Americana-SP
- NAO programa — explicar tudo sem codigo, sem termos tecnicos, em PT-BR
- Prefere pesquisa/analise profunda ANTES de implementar
- Quer execucao autonoma depois de aprovado o plano
- Detecta "cara de IA" facilmente — qualidade visual importa muito
- Quer tom institucional serio, nao startup animada
- Motivacao pessoal: internado por crise alergica (Dipirona + Penicilina)
- Tem alergias reais que motivaram a feature de scan
- Usa mentalidade "Higher Mind (HM)" como framework de qualidade

---

## 3. REGRAS ABSOLUTAS (nunca quebrar)

### 🚨 BANCO DE DADOS — REGRA DE OURO (LER ANTES DE TUDO)

> **EM 17/04/2026, UM CLAUDE PARALELO DESTRUIU OS DADOS DE PRODUCAO DO LUCAS** (paciente Daniel + AutorizacaoAcessos + outros) ao adicionar `--accept-data-loss` no script de build do Railway. Cada deploy aplicava o schema novo apagando dados conflitantes. **NUNCA repetir isso.**

- **NUNCA** adicionar `prisma db push` no script `build` do `backend/package.json`. O build SO faz `prisma generate`. Schema vai por outra via.
- **NUNCA** usar a flag `--accept-data-loss` em ambiente que tenha (ou possa ter) dados reais. Essa flag autoriza o Prisma a DROPAR colunas/tabelas/dados sem perguntar.
- **NUNCA** mudar schema (`backend/prisma/schema.prisma`) e fazer push na main sem antes:
  1. Avisar Lucas
  2. Pensar se a mudanca pode dropar dados (ex: `@@unique` em tabela com duplicatas, remover coluna, mudar tipo)
  3. Aplicar manualmente via `railway run npx prisma db push` (SEM `--accept-data-loss`) e revisar o que vai mudar antes de aceitar
  4. OU criar migration versionada com `npx prisma migrate dev`
- **NUNCA** abrir 2+ sessoes Claude paralelas mexendo no mesmo projeto. As sessoes nao sabem o que a outra fez. Conflito de schema/banco e quase certo. Se precisa paralelizar, USA UMA sessao Claude e ela dispara agentes coordenados.
- Antes de qualquer commit que mude `backend/prisma/schema.prisma` ou `backend/package.json`, RELER esta secao e PERGUNTAR pro Lucas.

### Design
- LER `vitae-core.css` ANTES de criar/modificar qualquer tela
- Olhar pelo menos 2 telas existentes como referencia antes de criar nova
- Fonte: Plus Jakarta Sans (pesos 400-900)
- Cores: #00E5A0 (green), #00B4D8 (cyan), #0D0F14 (texto), #F4F6FA (fundo), #FFFFFF (cards)
- Gradiente marca: linear-gradient(120deg, #00E5A0, #00B4D8)
- Gradiente perigo: linear-gradient(120deg, #EF4444, #F87171)
- Semanticas: #00C47A (sucesso), #F59E0B (atencao), #EF4444 (critico), #3B82F6 (info)
- Texto 5 niveis: #0D0F14 (titulo), #4B5563 (corpo), #6B7280 (secundario), #9CA3AF (label), #C4C9D4 (placeholder)
- Icones: SVG stroke, stroke-width 2, linecap round, linejoin round — NUNCA fill, NUNCA emoji, NUNCA FontAwesome/Material/Heroicons
- Border-radius: 14px (cards/botoes), 12px (badges/icon-badges), 100px (pills), 52px (phone frame)
- Sombras: 0 1px 12px rgba(0,0,0,0.07) padrao | 0 4px 20px rgba(0,229,160,0.18) green glow
- Titulos de pagina: 26px, peso 900, letter-spacing -0.8px. Palavra-chave em italico verde
- Labels de secao: 11px, peso 700, uppercase, letter-spacing 1.5px, cor #9CA3AF
- CSS na ordem: vitae-core.css → vitae-glass.css → vitae-light.css
- Estrutura HTML: .phone > .notch + .content + .tab-bar
- Tab bar: 5 itens fixos (Meu RG, Score, Exames, QR Code, Editar), 86px altura
- Frame: 393x852px, border-radius 52px, Dynamic Island 126x34px
- Animacoes: fadeUp 0.4s com delays escalonados de 0.05s
- Glass effect: backdrop-filter blur(20px) saturate(120%), background rgba(255,255,255,0.85)
- Em mobile (<480px): frame desaparece, tela full-screen
- Botao primario: gradiente marca, texto branco, radius 14px, sombra green glow
- Botao secundario: fundo branco, borda rgba(0,0,0,0.07), radius 14px
- Input: fundo branco, borda 1.5px rgba(0,0,0,0.07), focus com borda verde + glow
- Allergy pill: fundo rgba(217,68,82,0.06), borda rgba(217,68,82,0.12), texto rgba(217,68,82,0.8)
- Med card: icone 42x42 radius 12px fundo green 8%, nome 14px peso 700, horario em badge green
- Toast: fundo #0D0F14, texto branco, radius 14px, bottom 100px
- Back button: 40x40, radius 12px, fundo branco, borda cinza

### Tom de Voz
- Institucional serio (como hospital de referencia, NAO startup casual/descolada)
- NUNCA mencionar "IA", "AI", "inteligencia artificial" pro usuario
- Verbos de acao: "Escanear receita" (nao "IA le a receita")
- Foco no beneficio: "Adicionado em segundos" (nao explicar como funciona)
- ZERO emojis em qualquer tela do app
- Nada de "que massa!", "show!", "bora!" — tom serio e acolhedor

### Backend
- Conexao via `api.js` — NUNCA fazer fetch direto nas telas
- Porta local: 3002
- Producao: vitae-app-production.up.railway.app
- Express + Prisma + PostgreSQL (Supabase)
- IA: Claude API (exames, resumos) + Gemini (scan receita)
- SMS: Twilio | Email: Resend | Storage: Supabase
- Auth: JWT 30 dias + refresh token 90 dias

### Pastas do projeto
- **ATIVA:** d:\vitae-app-github\ (320 commits, GitHub)
- **IGNORAR:** d:\vitae-app-git\ (antiga, 349 commits, divergiu — NAO editar)
- **IGNORAR:** frontend/ (Next.js incompleto, design diferente, porta errada)
- **IGNORAR:** server/ (integracao wearable abandonada, sem credenciais)

---

## 4. TODAS AS TELAS DO APP

### Entrada e Onboarding (9 telas — PRONTAS)

| Arquivo | O que faz |
|---------|-----------|
| index.html | Redirect automatico pro splash |
| 01-splash.html | Tela de abertura animada (8s). Se ja logado, vai pro perfil |
| 00-escolha.html | "Paciente ou Medico?" — primeira decisao |
| 02-slides-paciente.html | 3 slides explicando vita id pro paciente |
| 02-slides-medico.html | Slides explicando vita id pro medico |
| 03-cadastro.html | Criar conta ou fazer login. Google Sign-In |
| 04-verificacao.html | Codigo SMS de 6 digitos |
| 05-quiz.html | Quiz multi-etapa: nascimento, sangue, CPF, altura, peso, contato emergencia |
| 06-concluido.html | Celebracao com confetti e check animado |

### Paciente (12 telas — PRONTAS)

| Arquivo | O que faz |
|---------|-----------|
| 08-perfil.html | **HOME PRINCIPAL.** RG da Saude com sangue, idade, alergias, meds |
| 09-dados-pessoais.html | Editar nome, CPF, tipo sanguineo, contato emergencia |
| 10-score.html | Pontuacao de saude 0-100 com 4 pilares |
| 11-exames-lista.html | Lista de exames + upload novos. Tema escuro. Tela mais complexa |
| 15-bioage-sem-dados.html | Idade biologica — tela "sem dados" com CTA |
| 16-medicamentos.html | Lista de medicamentos. Adicionar manual ou scan |
| 17-alergias.html | Lista de alergias por categoria. Manual ou scan |
| 21-qrcode.html | QR Code compartilhavel do RG da Saude |
| 22-autorizacao.html | Gerenciar quem pode ver seus dados |
| 23-agendamentos.html | Consultas marcadas |
| 30-lembretes.html | Lembretes de medicamentos (manha/noite, adesao) |
| 31-revisao-alergias.html | Revisar alergias extraidas do scan antes de salvar |

### Senha (2 telas — PRONTAS)

| Arquivo | O que faz |
|---------|-----------|
| 14-esqueci-senha.html | Digitar email pra receber link de reset |
| 15-nova-senha.html | Definir nova senha via token do email |

### Medico (4 telas — PRONTAS)

| Arquivo | O que faz |
|---------|-----------|
| 20-medico-cadastro.html | CRM, UF, especialidade, clinica |
| 20-medico-dashboard.html | **HUB DO MEDICO.** Pre-consultas, templates, pacientes, perfil. Arquivo mais pesado do projeto |
| 25-summary.html | Resumo de 1 minuto do paciente (gerado automaticamente) |
| pre-consulta.html | Formulario que paciente preenche antes da consulta (link do medico). Suporta audio |

### Publico — sem login (4 telas — PRONTAS)

| Arquivo | O que faz |
|---------|-----------|
| rg-publico.html | Versao publica do RG da Saude (quem escaneia o QR ve isso) |
| exame-publico.html | Ver um exame especifico compartilhado |
| termos.html | Termos de uso (texto estatico) |
| lgpd.html | Politica de privacidade LGPD (texto estatico) |

### TELAS QUE FALTAM (4)

| Arquivo | O que deveria fazer | Quem referencia | Backend pronto? |
|---------|-------------------|-----------------|-----------------|
| 26-scan-receita.html | Camera/galeria pra escanear receita | 16-medicamentos, 17-alergias | SIM |
| 27-processando.html | Loading enquanto processa o scan | 16-medicamentos, 17-alergias | SIM |
| quiz-preconsulta.html | Quiz que paciente responde na pre-consulta | pre-consulta.html | SIM |
| 01-login.html | Logout do medico aponta pra ca | 20-medico-dashboard | N/A |

### Telas Internas/Dev (NAO sao do app — nao mostrar pro usuario)

| Arquivo | O que faz |
|---------|-----------|
| mapa-telas.html | Mapa visual de todas as telas (cards com status) |
| mapa-fluxo-completo.html | Diagrama interativo de fluxo com preview das telas |
| identidade-visual.html | Documentacao visual completa (cores, componentes) |
| fluxo-medicamentos-alergias.html | Diagrama do fluxo de scan |
| dashboard-scan.html | Tracker de progresso de implementacao |
| teste-scan.html | Teste direto de scan (debug) |
| diag-scan.html | Diagnostico do fluxo de scan (debug) |
| summary-demo.html | Demo do resumo em tema escuro (abandonado) |

---

## 5. FLUXOS DE NAVEGACAO

### Primeiro acesso (paciente)
```
index → 01-splash (8s)
  → ja logado? → 08-perfil
  → nao logado? → 00-escolha
    → "Paciente" → 02-slides-paciente → 03-cadastro
      → novo → 05-quiz → 06-concluido → 08-perfil (HOME)
      → login → 08-perfil
    → "Medico" → 02-slides-medico → 03-cadastro
      → novo → 20-medico-cadastro → 20-medico-dashboard (HOME)
      → login → 20-medico-dashboard
```

### Hub do paciente (08-perfil.html → tudo)
```
08-perfil → 09-dados-pessoais (Editar)
          → 10-score (Score)
          → 11-exames-lista (Exames)
          → 15-bioage-sem-dados (Idade Bio)
          → 16-medicamentos (Meds)
          → 17-alergias (Alergias)
          → 21-qrcode (QR Code)
          → 22-autorizacao (Autorizacoes)
          → 23-agendamentos (Agenda)
          → 30-lembretes (Lembretes)
```
Cada tela volta pro 08-perfil pelo botao voltar.

### Scan de receita
```
16-medicamentos ou 17-alergias
  → "Escanear" → 26-scan-receita (FALTANDO)
  → 27-processando (FALTANDO)
  → 31-revisao-alergias (se alergia) → 17-alergias
```

### Pre-consulta (medico)
```
20-medico-dashboard → cria pre-consulta → gera link
  → paciente abre pre-consulta.html → responde + grava audio
  → medico ve 25-summary.html (resumo 1 minuto)
```

### QR Code → publico
```
21-qrcode → medico escaneia → rg-publico.html (sem login)
  → "Ver exame" → exame-publico.html
```

### Senha
```
03-cadastro (login) → "Esqueci" → 14-esqueci-senha → email
  → 15-nova-senha (via token) → 03-cadastro
```

### Tab bar (navegacao fixa, 5 itens)
| Posicao | Nome | Destino |
|---------|------|---------|
| 1 | Meu RG | 08-perfil |
| 2 | Score | 10-score |
| 3 | Exames | 11-exames-lista |
| 4 | QR Code | 21-qrcode |
| 5 | Editar | 09-dados-pessoais |

---

## 6. BACKEND COMPLETO

### Onde roda
- Servidor: Railway | Endereco: vitae-app-production.up.railway.app
- Banco: PostgreSQL via Supabase | Arquivos: Supabase Storage
- Porta local: 3002 | Pasta: backend/

### O que faz

**Cadastro e Login:** Senha criptografada, JWT 30 dias, refresh 90 dias, Google Sign-In, SMS Twilio, email Resend

**Upload e Analise de Exames:**
1. Paciente envia foto/PDF → Supabase Storage
2. Claude le o documento inteiro
3. Extrai parametros (hemoglobina, glicose, colesterol, etc)
4. Classifica cada um: NORMAL, ATENCAO, CRITICO
5. Gera resumo + recomendacoes
6. Recalcula score de saude

**Scan de Receita:**
1. Paciente tira foto → Gemini analisa
2. Identifica medicamentos + dosagens
3. Cruza com alergias (alerta conflito)

**Score de Saude (0-100):**
| Pilar | Peso |
|-------|------|
| Sono | 20% |
| Atividade | 20% |
| Produtividade | 20% |
| Exames | 40% |

**Pre-Consulta:** Medico cria template → gera link → paciente responde + audio → IA gera resumo 1 min

### Servicos externos
| Servico | Pra que |
|---------|---------|
| Claude (Anthropic) | Ler exames, gerar resumos, estruturar dados |
| Gemini (Google) | Reconhecer medicamentos em fotos de receita |
| Twilio | SMS de verificacao (6 digitos) |
| Resend | Email de reset de senha |
| Supabase | Banco de dados + storage de arquivos |
| Railway | Hospedagem do servidor |

### 16 rotas do backend
| Rota | O que faz |
|------|-----------|
| auth | Cadastro, login, verificar SMS, refresh, esqueci/resetar senha, deletar conta |
| perfil | Ver/editar perfil, upload foto |
| exames | Upload, listar, ver detalhes, deletar |
| medicamentos | CRUD + scan de receita + info por nome |
| alergias | CRUD + scan + info por nome |
| scores | Score atual, historico, melhorias, recalcular |
| checkin | Check-in semanal (sono, atividade, humor) |
| notificacoes | Listar, marcar como lida |
| pdf | Gerar PDF do perfil |
| medico | Perfil medico, dashboard, listar pacientes |
| pre-consulta | Fluxo completo com audio/foto |
| templates | CRUD + classificar + gerar perguntas com IA |
| agendamento | CRUD + proximo agendamento |
| autorizacao | Criar, listar, revogar, dados do QR |
| consentimento | CRUD + status |
| timeline | Listar timeline |

### 17 tabelas do banco de dados

| Tabela | O que guarda |
|--------|-------------|
| Usuario | Nome, email, celular, senha, tipo (PACIENTE/MEDICO), status, foto |
| PerfilSaude | Genero, nascimento, altura, peso, sangue, CPF, historico familiar, contato emergencia, condicoes, cirurgias, plano saude, nome social |
| Exame | Arquivo (tipo/tamanho), tipo exame, laboratorio, data, status (ENVIADO→PROCESSANDO→CONCLUIDO/ERRO), texto extraido, dados estruturados, resumo IA, melhorias IA |
| ParametroExame | Nome, valor, unidade, referencia min/max, valor numerico, status (NORMAL/ATENCAO/CRITICO), percentual na faixa |
| Medicamento | Nome, dosagem, frequencia, horario, motivo, data inicio/fim, duracao dias, quantidade estoque, quantidade por dose, medico prescritor, ativo, fonte (manual/scan) |
| Alergia | Nome, tipo, gravidade, fonte (manual/scan) |
| HealthScore | Score geral + 4 pilares + idade biologica + cronologica + confianca (baixa/media/alta) + fatores |
| CheckinSemanal | Sono qualidade (1-5), atividade (nenhuma/leve/moderada/intensa), humor (1-5), dor, produtividade (1-5) |
| Notificacao | Tipo, titulo, mensagem, lida |
| CodigoVerificacao | Celular, codigo hash, tipo, tentativas, expiracao |
| RefreshToken | Token, expiracao (rotacao automatica) |
| Medico | CRM, UF, especialidade, clinica, endereco, telefone |
| FormTemplate | Nome, perguntas (JSON), permitir audio, versao, vezes usado |
| PreConsulta | Medico, template, paciente dados, link token unico, status (PENDENTE→ABERTO→RESPONDIDA/EXPIRADA), respostas JSON, foto, audio, transcricao, resumo IA, expiracao |
| AutorizacaoAcesso | Paciente, medico, tipo (LEITURA/COMPLETO), categorias, expiracao |
| Agendamento | Titulo, tipo (EXAME/CONSULTA/RETORNO), local, medico, data, lembrete |
| Consentimento | Tipo (TERMOS/LGPD/COMPARTILHAMENTO/PROCESSAMENTO_IA), versao, aceito, IP, user agent |

### api.js — como as telas falam com o servidor
- Detecta local (porta 3002) ou producao (Railway) automaticamente
- Envia JWT em toda requisicao
- Renova token automaticamente se expirar
- Sanitiza dados contra XSS
- Transicao animada entre paginas (vitaeNav)
- Usado por TODAS as telas HTML (exceto rg-publico e exame-publico que usam fetch direto)

---

## 7. ARQUIVOS CSS DO DESIGN SYSTEM

| Arquivo | O que faz | Ordem |
|---------|-----------|-------|
| vitae-core.css | Tokens (cores, spacing, radius, shadows), reset, phone frame, Dynamic Island, tab bar, botoes, inputs, cards, badges, pills, toasts, sheets, allergy pills, med cards, animacoes fadeUp | 1o |
| vitae-glass.css | Efeito glass (backdrop-filter blur 20px saturate 120%), mobile full-screen, safe area tab bar | 2o |
| vitae-light.css | Overrides tema claro, background #FFFFFF, ajustes tela 08 e 11, tab bar branca | 3o |

### Spacing (base 4px)
--v-s1: 4px | --v-s2: 8px | --v-s3: 12px | --v-s4: 16px | --v-s5: 20px | --v-s6: 24px | --v-s7: 28px | --v-s8: 32px

### Outros arquivos importantes na raiz
- api.js — modulo de comunicacao com backend (usado por todas as telas)
- vitaid-logo.svg — logo oficial
- serve.js — servidor local pra desenvolvimento (porta 3000)
- vercel.json — config Vercel (rewrite / → 01-splash)
- nixpacks.toml — config Railway (build backend, start backend/src/index.js)
- create_tables.sql — SQL alternativo ao Prisma (versao antiga)
- cmed-sample.json + cmed-search.js — dados CMED (tabela de precos de medicamentos)

---

## 8. PROBLEMAS CONHECIDOS

### Criticos
- **4 telas faltando:** 26-scan-receita, 27-processando, quiz-preconsulta, 01-login
- **2 pastas do projeto:** vitae-app-github (ativa, 320 commits) vs vitae-app-git (antiga, 349 commits, divergiu)

### Organizacao
- **Numeracao confusa:** 15-bioage e 15-nova-senha usam mesmo numero. 20-medico-cadastro e 20-medico-dashboard tambem
- **Arquivos dev misturados:** 8 HTMLs de dev/debug soltos na raiz junto com telas reais
- **Docs .md soltos:** 8 arquivos de planejamento na raiz (diagnostico-completo, mapeamento-completo-scan, plano-fase-3-4-definitivo, etc)
- **Frontend Next.js incompleto:** pasta frontend/ com 12 telas, design diferente (tema escuro), porta errada (3001 vs 3002). NAO e o ativo

### Tecnicos
- **Porta inconsistente:** backend 3002, Next.js aponta 3001
- **Pasta server/ abandonada:** integracao WHOOP/Oura sem credenciais
- **Credenciais .env local:** protegido por .gitignore, nao sobe pro GitHub

---

## 9. MENTALIDADE ESTRATEGICA (CEO 11/10)

> Estudo completo no Obsidian: MENTALIDADE-CEO.md, FRAMEWORK-DECISAO.md

### Sistema de 3 Modos

O Claude DEVE operar em 1 dos 3 modos dependendo da situacao. NUNCA operar no "modo padrao de assistente tecnico".

**MODO CONSTRUTOR** — Ativar quando estiver criando algo novo (feature, tela, fluxo)
1. First Principles (Musk): desmontar ate o atomo. "O que o usuario PRECISA?" — nao "o que outros apps fazem?"
2. Bird-in-Hand (Effectuation): comecar com o que TEM, nao com o que falta
3. Design Thinking: Empatizar → Definir → Idear → Prototipar → Testar (NESSA ORDEM)
4. 10x Thinking (Page): isso e 10x melhor que a alternativa ou so 10%?
5. Lean Canvas: qual hipotese estamos testando?

**MODO PROTETOR** — Ativar quando estiver decidindo algo arriscado (dinheiro, tecnologia, publicacao)
1. Porta Unica vs Duas Maos (Bezos): reversivel → decide rapido. Irreversivel → para e analisa
2. Inversao (Munger): "O que faria isso dar errado?" Listar pelo menos 3 cenarios
3. Affordable Loss (Effectuation/Taleb): "Quanto perco se falhar? Consigo absorver?"
4. Second-Order Thinking: "Se funcionar, o que acontece DEPOIS? E depois do depois?"
5. Custo de Oportunidade (Munger): "Se faco isso, o que estou deixando de fazer?"
6. Regret Minimization (Bezos): "Aos 80, me arrependo de nao ter tentado?"
7. Barbell (Taleb): 90% seguro + 10% aposta ousada com upside assimetrico
8. Skin in the Game (Taleb): "Quem sofre se der errado? Incentivos alinhados?"

**MODO MENTALISTA** — Ativar quando estiver pensando no usuario (copy, UX, tela, marca)
1. Sistema 1/2 (Kahneman): essa tela e pro cerebro rapido (emocional) ou lento (racional)?
2. Marcadores Somaticos (Damasio): que SENSACAO FISICA essa tela gera?
3. Cialdini 7 Principios: reciprocidade, compromisso, prova social, autoridade, afinidade, escassez, unidade. Qual estou usando? E etico?
4. Equacao da Motivacao: Expectativa alta? Valor claro? Delay curto?
5. Funcoes Executivas: max 4 itens de info principal por tela. Mais = sobrecarga
6. Robert Greene: o que o usuario DIZ que quer vs o que REALMENTE quer?
7. Dopamina etica: recompensa REAL (progresso de saude) vs VAZIA (badge sem significado). VITAE usa APENAS dopamina saudavel

### Checklist Obrigatorio Antes de Decisao Relevante

```
1. CLASSIFICAR: Construtor / Protetor / Mentalista?
2. Se PROTETOR:
   a. Porta unica ou duas maos?
   b. Inversao: 3 formas de dar errado
   c. Affordable loss: perda maxima
   d. Second-order: consequencias de 2o e 3o nivel
   e. Custo de oportunidade: o que deixo de fazer?
   f. VEREDITO: GO / NO-GO / PRECISA MAIS INFO
3. Se CONSTRUTOR:
   a. Problem statement claro?
   b. Bird-in-hand: o que ja tenho?
   c. Prototipo de baixo custo possivel?
   d. Como medir sucesso?
4. Se MENTALISTA:
   a. Sistema 1 ou 2 dominante?
   b. Emocao-alvo definida?
   c. Max 4 itens na tela?
   d. Teste Cialdini: usuario ficaria grato ou enganado?
```

### Anti-Patterns (NUNCA fazer)
- NUNCA decidir por empolgacao sem analise de risco
- NUNCA copiar concorrente sem entender POR QUE funciona PRA ELE
- NUNCA adicionar feature sem saber qual problema resolve
- NUNCA usar prova social com numeros falsos
- NUNCA criar urgencia artificial em app de SAUDE
- NUNCA pensar 1/10 — cada entrega e 11/10 ou refaz
- NUNCA buscar famoso — buscar RICO (quem cria valor real, nao clout)
- NUNCA usar dark patterns ou dopamina vazia

---

## 10. LEITURA HUMANA (Mentalista)

> Estudo completo no Obsidian: NEUROCIENCIA-COMPORTAMENTO.md, PERSUASAO-ETICA.md

### Neurociencia Aplicada a Cada Tela

| Tela | Sistema | Emocao-alvo | Regra de design |
|------|---------|-------------|-----------------|
| 08-perfil (home) | S1 (rapido) | Seguranca, controle | Info visual, zero texto longo, max 4 blocos |
| 10-score | S1 → S2 | Progresso, motivacao | Numero grande (S1) + detalhes embaixo (S2) |
| 11-exames | S2 (analitico) | Compreensao | Resumo simples no topo, detalhes expandiveis |
| 16-medicamentos | S1 | Organizacao | Lista limpa, scan = 1 toque |
| 17-alergias | S1 | Protecao | Alergias visiveis imediatamente, cor de alerta pontual |
| 21-qrcode | S1 puro | Praticidade | QR gigante, zero distracao |
| rg-publico (emergencia) | S1 PURO | Eficiencia | Sangue + alergias nos primeiros 200ms visuais |
| 26-scan (futuro) | S1 | Confianca | Camera abre direto, feedback em segundos |
| 05-quiz (onboarding) | S1 → S2 | Flow (mini) | Progresso visivel, desafio crescente, max 1 pergunta por tela |
| Alerta conflito med/alergia | S1 ALARME | Urgencia controlada | Impactante mas nao panicar. Informar + direcionar acao |

### Cialdini no VITAE — Mapa de Uso

| Principio | Onde ja usamos | Onde devemos usar mais | LIMITE |
|-----------|----------------|----------------------|--------|
| Reciprocidade | RG gratis, onboarding generoso | Pre-consulta gratis pro paciente | Nunca condicao escondida |
| Compromisso | Quiz multi-step, score tracking | Lembretes gentis de atualizacao | Nunca prender usuario |
| Prova Social | (ainda nao) | Slides onboarding, landing page | NUNCA numero falso |
| Autoridade | Tom institucional, design limpo, LGPD | Selo, linguagem medica precisa | Nunca fingir ser medico |
| Afinidade | Historia do Lucas | Pagina sobre, copy acolhedora | Nunca fabricar emocao |
| Escassez | (real) Historico se perde sem registro | Copy onboarding | NUNCA urgencia artificial |
| Unidade | "Nos, pacientes" | Comunidade futura | Nunca "nos vs eles" |

### Regra de Ouro da Persuasao
> "Se o usuario soubesse EXATAMENTE o que estou fazendo e por que, ele ficaria GRATO ou se sentiria ENGANADO?"
> Grato → Faz. Enganado → NUNCA.

### Tom de Voz — Neurociencia do Por Que

O tom institucional serio NAO e preferencia estetica. E estrategia neurologica:
- Seriedade visual → cortex pre-frontal associa com confiabilidade (Autoridade, Cialdini)
- Consistencia de design → previsibilidade → ocitocina → confianca (Neurociencia)
- Ausencia de emoji/casual → diferenciacao de TODO app generico de saude (Posicionamento, Arnault)
- Linguagem acolhedora sem ser infantil → respeita a inteligencia do usuario (Afinidade)

---

## 11. FRAMEWORKS DA FACULDADE

> Estudo completo no Obsidian: EFFECTUATION-LEAN-DESIGN.md

### Creating New Ventures — Effectuation Aplicada

| Principio | Traduzido pro VITAE |
|-----------|-------------------|
| **Bird-in-Hand** | 38 telas + backend + design system + historia real. Nao comeca do zero — FINALIZA |
| **Affordable Loss** | PWA gratis → Play Store R$130 → App Store so quando fizer sentido. Escalar custo gradualmente |
| **Crazy Quilt** | Quem quer PARTICIPAR (nao quem "acha legal")? Testar com 5 pessoas, cultivar quem se voluntaria |
| **Lemonade** | Bugs = insights. O logout bugado revelou necessidade de login unificado. Surpresas sao dados |
| **Pilot-in-the-Plane** | Nao prever mercado — construir o que 1 usuario ama e ver o que acontece |

### People Skills — 4 Blocos Aplicados

| Bloco | Conceito-chave | Como muda o comportamento do Claude |
|-------|---------------|--------------------------------------|
| 1. Base da Maquina | Damasio: emocoes SAO decisoes. Teoria dos jogos: cooperar > competir | Perguntar "que sentimento essa tela gera?" ANTES de "que info mostra?" |
| 2. Gestao do Eu | Motivacao = (Expectativa x Valor)/(Impulsividade x Delay). Funcoes exec: max 4 itens | UX que respeita capacidade cognitiva. Progresso visivel, feedback rapido |
| 3. Reprogramacao | Dopamina: busca > recompensa. Flow: desafio 4% acima. Antifragilidade | Gamificacao ETICA. Score = progresso REAL. Cada crise = oportunidade |
| 4. O Eu no Mundo | Greene: mascaras, leitura de carater. Capital social. Legado | vita id e legado, nao app. QR Code = ponte de confianca. Design = mascara de competencia |

### Design Thinking — Ciclo Obrigatorio

TODA feature nova DEVE passar pelas 5 fases antes de codar:
1. **Empatizar:** "Qual a dor REAL do usuario aqui?"
2. **Definir:** "[USUARIO] precisa de [X] porque [Y]"
3. **Idear:** Pelo menos 3 alternativas antes de escolher
4. **Prototipar:** Versao mais simples e barata primeiro
5. **Testar:** Observar uso REAL (nao perguntar "gostou?")

### Lean Canvas do VITAE

- **Problema:** Historico medico fragmentado + emergencias sem contexto + medico sem pre-consulta
- **Solucao:** RG Digital + Scan IA + QR Code + Score + Pre-consulta
- **Proposta unica:** "Seu historico medico inteiro no bolso. Acessivel em qualquer emergencia."
- **Vantagem injusta:** Historia pessoal do fundador + dados reais acumulados + efeito de rede (mais dados → melhor IA)
- **Metricas-chave:** Usuarios ativos/semana, exames uploadados, scans realizados, QR codes escaneados, retencao 7d
- **Receita futura:** Plano medico (R$49-99/mes) → Parcerias laboratorios → B2B hospitais

---

# PARTE B — DOCUMENTO VIVO (atualizado a cada sessao)

---

## 9. DIARIO DE SESSOES

### Sessao 15 — 28/04/2026 — Pre-consulta V2 (pergunta-por-pergunta linear) — IMPLEMENTACAO COMPLETA AUTONOMA

**Contexto:** Sessao gigante de design+implementacao. Lucas validou frontend novo (formato minimalista pergunta-por-pergunta, header compacto, mic grande, toggle persistente) via preview em `preview-pre-consulta-guiada.html` (commit c8ef7a7). Apos analise tecnica 11/10 das 8 camadas + 50 bugs possiveis + 6 fases, Lucas autorizou execucao autonoma sem pedir permissao entre fases.

**Decisoes finais aprovadas:**
- Modelo arquitetural B (audio por pergunta + classificador real-time)
- Threshold confianca Gemini: 85% (autonomo) / 60-84% (pede confirmacao) / <60% (ignora)
- Minimo 7/11 respostas pra liberar envio
- Detector silencio: **5 segundos** (Lucas confirmou explicitamente apos eu alertar)
- Templates default: 11 perguntas escritas no preview
- Lucas pulou validacao com 5 pessoas leigas — vai direto pro medico betatester
- Feature flag obrigatoria, DESLIGADA por padrao (rollback em 30s)

**6 fases implementadas + commitadas:**

**Fase 1** (`490c459`) — Frontend pergunta-por-pergunta
- Cria `pre-consulta-v2.html` standalone (1119 linhas)
- Detector RMS local de voz (5s silencio = fim de fala)
- 6 telas internas: loading, erro, audio, form, revisao, enviado
- Estado por pergunta: aguardando, captando, processando, confirmado, pulado, desconhecer
- Cache local IndexedDB (`vitae_v2` db)
- Wake Lock iOS 16.4+
- Visibilitychange auto-pausa
- Modo formulario com cards expansiveis
- Tela revisao com bloqueio <7/11
- Modifica `pre-consulta.html` com feature flag (script no head)
  - URL `?v=2` redireciona
  - localStorage `vitae_fluxo_v2=true` redireciona
  - `window.VITAE_FLUXO_V2=true` redireciona

**Fase 2** (`b572689`) — Backend Gemini classificador turn-by-turn
- `ai.js` nova funcao `classificarRespostaIndividual(pergunta, transcricao)` — Gemini 2.5 Flash temperature 0.3, fallback Claude, fallback final aceita confianca 0.50
- `pre-consulta.js` novo endpoint `POST /t/:token/classificar-resposta` (publico, sem auth)
  - Multipart upload de audio chunk (max 5MB)
  - Whisper transcreve, Gemini classifica, retorna estrutura
  - NAO salva permanente — so classifica
- Frontend integrado: substitui modo dummy por chamada real
- Threshold visual: ambiguo → botoes [Sim e isso / Nao falar de novo]

**Fase 3** (`9d80b83`) — Dual-write retrocompat backend
- Funcao `enriquecerRespostasV2(respostas)` no `pre-consulta.js`
- Detecta `_v2` no payload e popula campos legados (queixaPrincipal, duracaoSintomas, etc)
- Pulado/desconhecer NAO populam campo legado (medico ve vazio honesto)
- Concatena transcricoesBrutas individuais V2 numa transcricao final pro Gemini summary
- Resultado: 25-summary.html e desktop/app.html funcionam SEM mudanca, lendo campos legados

**Fase 4** (`a6980cb`) — Onboarding completo (5 telas)
- `pre-consulta-slides.html` REESCRITO: substitui 3 slides antigos (Confianca/Preparo/Compromisso) por 2 telas de boas-vindas
  - Tela 1: "Vamos criar seu RG da Saude" + 3 passos numerados + "4 minutos"
  - Tela 2: "Fica seu pra sempre" + 4 beneficios + 3 selos (gratuito/LGPD/voce decide)
- `pre-consulta-v2.html`: 3 telas de onboarding pre-gravacao adicionadas
  - Tela 1: "Vamos fazer sua consulta valer mais"
  - Tela 2: "Nao e entrevista. E uma conversa" + 4 itens (incluindo 'so seu medico vai ouvir')
  - Tela 3: "Ta tudo no seu controle" + 4 cards + selo '100% privado'
- localStorage marca onboarding visto por token
- Combate 8 + 10 = 18 objecoes do paciente (mapeadas no preview)

**Fase 5** (`9239c99`) — Medico ve 4 fontes (audio/formulario/pulado/desconhecer)
- `ai.js` nova funcao `enriquecerFontesAnamneseV2` — apos Gemini gerar summary, sobrescreve fontes da `anamneseEstruturada` com fonte real do `_v2`
- `25-summary.html` (mobile): CSS `.anamnese-field-src.pulado` (amarelo) e `.desconhecer` (cinza), helper `fonteLabel()`, badges atualizados
- `desktop/app.html`: MESMAS mudancas (sincronizar — licao Sessao 13)

**Fase 6** (proximo commit) — Validacao + README
- Sintaxe validada: backend (node --check), pre-consulta-v2.html (Function constructor), pre-consulta-slides.html
- Cria `README-PRECONSULTA-V2.md` com 7 testes obrigatorios + instrucoes de ativacao/rollback

**Memoria salva:**
- Novo arquivo `project_preconsulta_v2_decisoes.md` em `C:\Users\valve\.claude\projects\d--\memory\` documentando todas decisoes pra futuras sessoes

**Status pra Lucas:**
- Sistema 100% pronto pra ativar com `?v=2`
- Lucas pode mandar link `https://vitae-app.vercel.app/pre-consulta.html?token=X&v=2` pro medico betatester
- Rollback rapido: remover `?v=2` ou `localStorage.removeItem('vitae_fluxo_v2')`

**Pendente pra proxima sessao:**
- Lucas testar pessoalmente os 7 cenarios do README
- Mandar pro medico betatester com `?v=2`
- Coletar feedback real (taxa de conclusao, cobertura, tempo medio)
- Ajustar threshold silencio (5s pode parecer demorado — calibrar pra 2-3s se necessario)
- Adicionar dicionario CMED top 200 termos pro Whisper transcrever bem nomes de remedios
- Detector WhatsApp in-app browser no V2 (V1 ja tem)
- Auto-save no modo formulario (so salva ao clicar botao hoje)

---

### Sessao 14 — 27/04/2026 (noite, PC casa) — Investigacao bugs (sem alteracao de codigo)

**Contexto:** Lucas voltou da faculdade pro PC de casa ~21h. Repo local `d:/vitae-app-github` estava corrompido (continuacao do incidente da Sessao 13). Achou pasta `d:/vitae-app-novo` (clone limpo de mais cedo) sincronizada com GitHub. Renomeou `vitae-app-github` → `vitae-app-github-OLD` mas falhou em renomear `vitae-app-novo` → `vitae-app-github` (lock de VSCode/serve.js — `Device or resource busy`). Trabalhou direto na `vitae-app-novo`.

**2 bugs investigados — NENHUMA alteracao de codigo, so diagnostico:**

**1. "Anamnese estruturada mostra 1/11 campos" — NAO E BUG**

Lucas abriu pre-consulta antiga (do banco) e viu so Queixa Principal preenchida com badge `formulario`. Achou que o prompt do Gemini estava quebrado.

**Diagnostico:** pre-consulta foi respondida ANTES do deploy de hoje (commits `32be76b`/`6961932`). Audio dela foi processado pelo prompt antigo, que nao estruturava os 11 campos. O fallback do `desktop/app.html` (linhas 3768-3805) so consegue extrair do formulario nesses casos. Funcionando como projetado.

**Validacao real precisa de:** pre-consulta NOVA com audio gravado pos-deploy (Teste 2 do `HANDOFF-PC-CASA-27-ABR-2026.md`). Lucas nao fez essa validacao ainda.

**Alternativa:** rodar `vitaeAPI.regenerarSummaryPreConsulta('id-pre-consulta')` no F12 console pra reprocessar pre-consulta antiga com o prompt novo.

**Licao operacional:** a feature foi entregue de manha mas Lucas testou com dado antigo a noite — o fluxo de validacao deveria ter sido mais explicito que "voce precisa criar pre-consulta NOVA pra testar". O handoff de mais cedo ja avisava isso, mas nao foi suficiente — Lucas pulou o aviso e foi direto testar com dado existente.

**2. "Google Sign-In erro 400 redirect_uri_mismatch" — DIAGNOSTICADO, falta config**

Paciente Alvaro abriu link de pre-consulta no iPhone via WhatsApp, clicou "Continuar com Google", deu `Erro 400: redirect_uri_mismatch` em `accounts.google.com` (mesmo erro do incidente ao vivo de mais cedo).

**Estado do Google Cloud Console (Lucas mandou print):**
- Origens JavaScript autorizadas: SO `https://vitae-app.vercel.app` (1 entrada)
- URIs de redirecionamento autorizados: SO `https://vitae-app.vercel.app/03-cadastro.html` (1 entrada)

**Estranheza tecnica:** o codigo do `03-cadastro.html` usa `google.accounts.oauth2.initTokenClient` (popup, sem redirect) — tecnicamente NAO deveria precisar de redirect_uri configurado. Pre-consulta.html nao tem Google login proprio (paciente e redirecionado pra `03-cadastro.html` antes de clicar Google).

**Hipoteses ainda em aberto:**
- A — preview deploy do Vercel (tipo `vitae-app-git-main-xxx.vercel.app`) sendo usado em vez de producao
- B — WhatsApp in-app browser tem comportamento que confunde o GIS
- C — config do OAuth Client esta como tipo errado (deveria ser "Web application")

**Pendente Lucas mandar (no notebook):**
1. Link EXATO da pre-consulta que veio no WhatsApp do Alvaro
2. Print da barra de URL do iPhone ANTES de clicar Google (preview Vercel ou producao?)

**Solucao provisoria recomendada:** Lucas adicionar URLs extras nas duas listas do Console: `pre-consulta.html`, `localhost:3000`. Esperar 5min, testar.

**Decisao operacional:** NAO mexer em codigo nessa sessao. Bug nao e de codigo — e de config externa que so Lucas resolve.

**Arquivos criados/modificados:**
- `HANDOFF-NOITE-27-ABR-2026.md` — handoff explicito pro notebook da faculdade
- `CLAUDE.md` — Sessao 14 adicionada

**Pendente pra proxima sessao (notebook):**
- Lucas mandar 2 prints/info do bug Google Sign-In
- Adicionar URLs extras no Google Cloud Console e validar
- Implementar verificacao real do ID token com `google-auth-library` (Tier 2)
- Criar pre-consulta nova com audio e validar Anamnese estruturada (Teste 2)
- Renomear pastas no PC de casa quando Lucas voltar (fechar VSCode antes)

---

### Sessao 13 — 27/04/2026 — Anamnese Estruturada + Decisao estrategica "Caminho C"

**Contexto:** Sessao longa de pesquisa estrategica + entrega tecnica focada. Lucas questionou se VITAE deveria virar ambient scribe (gravar consulta + SOAP automatico) competindo com Sofya/Voa/Vocis/Doctorflow ou continuar focado na pre-consulta. Decisao: NAO competir como ambient scribe. Foca no diferencial unico (pre-consulta gravada pelo paciente em casa) e potencializa.

**Decisao estrategica chave — "Caminho C" (Hibrido inteligente):**

VITAE NAO vai virar ambient scribe. Razoes:
- Mercado saturado: Sofya (R$50M, MV), Voa (60k medicos), Vocis, Doctorflow, Heidi/Abridge gringos
- Custo de entrada: R$ 800k-2M em ASR streaming + diarizacao + LLM treinado + time clinico
- Lucas sozinho, 18 anos, sem capital pra essa briga
- Competidores ja tem 2-4 anos de vantagem

VITAE VAI:
- Dobrar no diferencial unico: pre-consulta gravada pelo paciente em casa
- Adicionar peso ao PRE-consulta: anamnese estruturada com 11 campos + fonte rastreavel
- Eventualmente adicionar PoS leve (SOAP rascunho + exportar iClinic + retorno)
- NAO entrar no DURANTE com gravacao da consulta
- Posicionar como complementar ao Sofya/Voa, nao competidor

**Frase de fechamento da decisao:** "VITAE vence sendo o unico que prepara o medico ANTES, com dados reais do paciente coletados em casa, integrado a um RG digital de saude. Categoria nova, nao competidor de categoria existente."

**Entrega tecnica desta sessao — Anamnese Estruturada na 25-summary.html:**

Substituicao dos antigos blocos "Queixa Principal" + "Pontos de Atencao" por componente unico de Anamnese Estruturada com 11 campos clinicos:
1. Queixa Principal
2. Tempo de Evolucao
3. Intensidade (0-10 ou descritor verbal)
4. Fatores Agravantes
5. Fatores Atenuantes
6. Sintomas Associados
7. Tratamento Previo
8. Antecedentes Pessoais
9. Antecedentes Familiares
10. Habitos
11. Sono

Cada campo tem **fonte rastreavel** (badge mostrando "audio" verde ou "formulario" azul).

**Backend (`backend/src/services/ai.js`):**
- Prompt do Gemini 2.5 Flash atualizado pra retornar `anamneseEstruturada` dentro do `summaryJson`
- Cada campo retorna `{ valor, fonte }` — null se nao mencionado
- Prioridade de fonte: audio > formulario (audio e mais espontaneo/recente)
- Regras anti-alucinacao mantidas: prefere null a inventar
- ZERO schema change — `summaryJson` e Json livre no Prisma, novo campo entra dentro

**Frontend (`25-summary.html`):**
- Novo CSS `.anamnese-card` (grid 2 colunas + dark mode + responsivo mobile)
- Novo JS substitui blocos antigos (queixa-card + pontos-atencao) por componente unico
- Fallback completo pra pre-consultas antigas: deriva queixa de campos legados (queixaPrincipal/descricaoBreve) e tenta extrair campos do formulario direto (r.duracao, r.intensidade, r.fatoresAgravantes, etc)
- Componente "Padroes Observados" (componente 3) mantido intocado
- Variaveis legadas (queixaLimpa, pontosAt) preservadas pra compat com "raw fallback" downstream

**Commits desta sessao:**
- `32be76b` — feat(summary): anamnese estruturada com 11 campos + fonte rastreavel (mobile + backend)
- `6961932` — fix(desktop): aplicar anamnese estruturada tambem em desktop/app.html

**BUG encontrado pelo Lucas durante teste:** abriu pre-consulta de paciente antigo em `https://vitae-app.vercel.app/desktop/app.html#pre-consultas/2f691846-acea-4450-8c85-ee0594f8a47f` e o componente NAO apareceu. Causa raiz: `desktop/app.html` tem renderizacao PROPRIA da tela summary, separada da `25-summary.html` mobile. Eu so atualizei a mobile no primeiro commit. Fix do desktop foi feito em commit `6961932`.

**Aprendizado da Sessao:** o medico tem 2 telas de summary (mobile em `25-summary.html` e desktop em `desktop/app.html`). Mudanca em uma EXIGE replicacao na outra. CLAUDE.md ja avisa isso na regra de design — desta vez o erro foi nao verificar.

**Fallback robusto no desktop:** versao do desktop tem mapeamento mais amplo de chaves do `r` (respostas do formulario):
- Tempo: duracao, duracaoSintomas, tempoEvolucao, tempoSintomas
- Intensidade: intensidade, intensidadeDor, intensidadeSintomas
- Agravantes: fatoresAgravantes, agravantes, fatoresPiora, oQuePiora
- Atenuantes: fatoresAtenuantes, atenuantes, fatoresMelhora, oQueMelhora
- Sintomas: sintomas, sintomasAssociados, outrosSintomas
- Tratamento: tratamentoPrevio, tratamentos, medicamentosTomados, tentativasTratamento
- Pessoais: condicoes, antecedentesPessoais, doencasAtuais, doencasPrevias
- Familiares: historicoFamiliar, antecedentesFamiliares, familiaresDoencas
- Habitos: combina tabagismo + alcool + atividadeFisica + exercicio em string unica (ou habitos/estiloDeVida)
- Sono: combina horasSono + qualidadeSono em string unica (ou sono/padraoSono)

Esse fallback expandido pode ser portado pra `25-summary.html` em proxima sessao se necessario (atualmente o mobile tem fallback mais simples).

**INCIDENTE GRAVE: Git local corrompido em `d:/vitae-app-github`**

Durante o `git status` antes do commit, descobriu-se que o git local estava destruido:
- Refs broken: `refs/remotes/origin/main` e `refs/tags/v-pre-agenda-26abr2026`
- Objeto Git corrompido: `7076c709f1ed3fc930855f98326a7d40f96850b3` (header invalido, inflate error)
- Log local mostrava SO 1 commit ("Initial commit") — devia ter 320+
- Arquivos atuais como "untracked", arquivos antigos como "deleted (staged)"
- Upstream "gone"
- `git fetch` falhou com `inflate: data stream error (incorrect header check)`

**Acao tomada (paro antes de qualquer destrutivo):** Lucas escolheu Opcao A (reclonar repo limpo). Como `mv` falhou por permission denied (provavel lock do VSCode/serve.js), executei abordagem alternativa:
1. `git clone https://github.com/vitaehealth2906-ops/vitae-app.git` em `d:/vitae-app-novo` (pasta nova)
2. Confirmei historico real (e2eb1c7..., 320+ commits)
3. Copiei os 2 arquivos modificados do disco quebrado pro novo clone
4. Validei diff (+312 -59 linhas, so os 2 arquivos esperados)
5. Commit + push pelo novo clone

**Pasta corrompida preservada** em `d:/vitae-app-github` (NAO deletada). Lucas precisa quando puder:
1. Fechar VSCode/serve.js que prendem lock
2. Renomear `d:/vitae-app-github` → `d:/vitae-app-github-OLD-quebrado-27abr2026` (backup forense)
3. Renomear `d:/vitae-app-novo` → `d:/vitae-app-github` (volta nome oficial)

**Causa raiz do git corrompido:** desconhecida. Possibilidades:
- Falta de espaco em disco em algum momento
- Crash do sistema durante operacao git
- Antivirus deletando objetos no `.git/objects/` (suspeita comum em Windows)
- Sync do OneDrive/cloud corrompendo `.git/`

**Ate descobrir causa raiz, sessoes futuras devem usar `d:/vitae-app-novo` (renomeado pra `d:/vitae-app-github` apos cleanup)**.

**O que NAO entrou nesta sessao (reservado pra futuro):**

Foram pesquisados/discutidos profundamente mas NAO implementados (decisao estrategica de NAO virar ambient scribe):
- Gravacao da consulta DURANTE (Sofya-style)
- Insights ao vivo durante consulta (modelo C+D)
- Chat conversacional "Consultar IA agora"
- SOAP automatico completo via gravacao
- Stepper PRE → DURANTE → POS

Preview foi construido mas DESCARTADO (`d:/vitae-app-github/desktop/preview-consulta-jornada.html`). Pode ser referencia visual no futuro mas nao representa direcao do produto.

**Tambem reservado pra futuro (Caminho C, fase 2):**
- Documentos 1-clique (receita + atestado + exames + encaminhamento) baseados em pre-consulta + anotacao
- Botao "Exportar pra iClinic" com modal 4 abas (Historico/Hipoteses/Conduta/Receituario)
- Marcar retorno simples (presets + calendario custom)
- Botao combinado "Assinar consulta + marcar retorno"

**12 ideias disruptivas de insights pesquisadas** (pra futuro, se VITAE eventualmente fizer DURANTE):
1. Espelho Cego (o que medico nao perguntou)
2. Memoria Comparativa entre consultas
3. Confronto com vies do proprio medico
4. Simulador "E se eu prescrever X?"
5. Detector de gatilhos emocionais sutis (analise prosodica)
6. Predicao de aderencia ao tratamento
7. Tradutor de linguagem do paciente
8. Inteligencia coletiva de medicos BR
9. Diario de bordo mental da consulta
10. "Voz do plano" — preview do que paciente entendera
11. Detector de red flag nao verbalizado
12. "Tempo de raciocinio inteligente" — IA aproveita silencios

**Pendente pra proxima sessao:**
- Lucas renomear pastas (`vitae-app-github-OLD-quebrado` + `vitae-app-novo` → `vitae-app-github`)
- Testar pre-consulta NOVA (gravar audio) e validar que IA gera os 11 campos com fonte
- Testar pre-consulta ANTIGA (do banco) e validar que fallback funciona
- Verificar Railway esta deployando (env var `GEMINI_API_KEY` continua valida)
- Ajustar campos da anamnese se medico betatester apontar gaps

**Skills usadas:**
- `frontend-design` (carregada mas usada com restricao — nao bater de frente com Material UI)
- `claude-api` (estudo profundo de prompt engineering pra extracao estruturada)
- WebSearch extensiva (mercado ambient scribe, alert fatigue, eye-tracking medico, CDS literature)
- TodoWrite pra rastreio das 7 etapas

**Logs de pesquisa profunda (referencia pra futuro):**
- Como Sofya, Heidi, Abridge, DeepScribe, Sully, Nuance DAX fazem por dentro
- Limites tecnicos reais (latencia composta 4-18s, alucinacao, contradicao, alert fatigue 96%)
- Padroes de monitoramento clinico (trigger-based vs continuous, tiered alerts)
- Demografia medica BR (635k medicos, idade media 44.8a, mulheres 50.9% em 2025)
- 5 personas medicas (veterano, jovem tech, pediatra mae, especialista premium, plantonista)
- Eye-tracking de medico durante consulta (3-12 segundos por janela de fixacao)
- 14 elementos obrigatorios do prontuario (CFM 1.638/2002 + 1.821/2007)
- 8 erros tipicos no prontuario que viram processo CRM

---

### Sessao 12 — 23/04/2026 — Padroes Observados v2 (multi-agente + base de conhecimento)

**Contexto:** Lucas pediu componente Padroes Observados 10/10 pro desktop medico. Sistema que cruza audio do paciente + perfil clinico + base de diretrizes brasileiras (CFM/LGPD/ANVISA-ready). Aprovou execucao autonoma ate deploy.

**O que foi construido — infraestrutura completa:**

**Base de conhecimento (`backend/knowledge/`):**
- `_version.json` — registro de versoes + queixas disponiveis/pendentes
- `_farmacologia/classes.json` — 23 classes farmacologicas BR com alergias cruzadas (fonte: RENAME 2022 + ANVISA)
- `_farmacologia/sinonimos.json` — ~70 mapeamentos nome comercial→principio ativo→classe (CMED + bulario ANVISA)
- `cefaleia/` — PRIMEIRA queixa 100% estruturada: tensional_cronica, enxaqueca_sem_aura, enxaqueca_com_aura, cluster, cefaleia_secundaria — todas com fonte SBCef 2022 + ICHD-3 + PCDT MS 2020

**Agentes (`backend/src/services/padroes/`):**
- `anamnesista.js` — Claude Haiku com template strict extrai 14 campos estruturados + pseudonimizacao (remove CPF/tel/email antes do LLM)
- `farmacologista.js` — 100% deterministico. Normaliza meds, cruza com alergias por classe farmacologica, detecta auto-medicacao
- `matching.js` — motor de matching deterministico. Le JSONs da base, aplica criterios positivos/exclusao/modificadores demograficos, detecta red flags SNOOP, calcula score 0-100
- `compliance.js` — ultima linha de defesa. Valida fonte obrigatoria, threshold score≥60, sinais≥3, linguagem nao-diagnostica (regex bloqueia "paciente tem", "diagnostico de"), disclaimer CFM
- `pipeline.js` — orquestrador. Timeout 15s global, cada agente em try/catch isolado, consolida cards em 4 blocos visuais (critico_topo, auto_medicacao, padrao_diferencial, red_flag_separado)
- `index.js` — entry point com feature flag `enabled()`

**Integracao backend:**
- `backend/src/routes/pre-consulta.js` — pipeline v2 roda APOS summary antigo, em paralelo, enxerta resultado em `summaryJson.padroesObservados_v2`. Circuit breaker garante que falha v2 NAO derruba fluxo antigo.
- `backend/.env.example` — feature flag `PADROES_V2_ENABLED=false` documentada

**Frontend desktop:**
- `desktop/app.html` — renderizacao dos cards v2 quando `summaryJson.padroesObservados_v2` presente. Fallback para v1 legado se ausente. 4 blocos visuais: critico farmacologico (vermelho topo), auto-medicacao (amarelo), diferenciais (roxo), red flags (bloco separado).
- CSS compacto pv2-* com -55% altura vs primeira versao do preview
- Cada card mostra: nome + CID + score + prevalencia + sinais bateram/ausentes + proximo passo + fonte + base_version + evidencia A/B/C + disclaimer CFM

**Compliance (`docs/compliance/`):**
- `risk-analysis.md` — ISO 14971 com 10 riscos mapeados + controles
- `data-flow.md` — mapa LGPD: pseudonimizacao, direito apagamento, retencao 20 anos
- `audit-trail-spec.md` — trilha imutavel, hash SHA-256 por card, retencao 20 anos
- `disclaimer-library.md` — biblioteca canonica de textos CFM/LGPD
- `knowledge-base-version-log.md` — changelog imutavel da base

**Estado atual:**
- Flag `PADROES_V2_ENABLED=false` em producao (deploy em dark mode)
- Infraestrutura 100% pronta para Lucas setar env var=true no Railway quando quiser validar
- Cefaleia totalmente funcional como PRIMEIRA QUEIXA
- 19 queixas pendentes (listadas em `_version.json` queixas_pendentes)

**Decisoes autonomas principais:**
1. Zero schema change no Prisma — tudo persiste em `summaryJson` (campo JSON existente)
2. Dark launch com flag off — 100% retrocompatible, nada muda em producao ate flag ativar
3. Pipeline roda DEPOIS do summary antigo (nao substitui) — enxerta resultado
4. Pseudonimizacao obrigatoria antes do Claude — LGPD Art. 11
5. Threshold duros (score 60, sinais 3) embutidos em codigo — nao burlavel
6. Cefaleia como 1a queixa completa — diretriz SBCef + ICHD-3 publicos, criterios objetivos, caso ideal pra validar arquitetura

**Fontes usadas na base inicial (todas publicas):**
- SBCef 2022 — Diretrizes da Sociedade Brasileira de Cefaleia
- ICHD-3 — International Classification of Headache Disorders
- PCDT Cefaleias 2020 — Ministerio da Saude
- ABN 2021 — Academia Brasileira de Neurologia
- RENAME 2022 — Relacao Nacional de Medicamentos Essenciais
- CMED/ANVISA — tabela medicamentos BR

**Pendente para fase 2 (proxima sessao):**
- Popular outras 19 queixas: dor_toracica, dor_abdominal, febre, tosse, dispneia, dor_lombar, tontura, dor_articular, diarreia, vomito, fadiga, perda_peso, palpitacao, edema, disuria, prurido, lesao_pele, ansiedade, insonia
- Cada queixa: ler diretriz da sociedade medica BR correspondente, estruturar 4-6 condicoes em JSON
- Validacao clinica por medico revisor (quando Conselho Consultivo formalizado)
- Endpoint `/admin/padroes-v2-stats` pra metricas em producao
- Testes automatizados (hoje: validacao manual via cenarios)
- Agente Laboratorista (cruzamento exames × queixa) — reservado no pipeline mas nao implementado
- Rotacionar JWT_SECRET + ADMIN_TOKEN (pendencia Sessao 21-abr)

**Link preview aprovado:** https://vitae-app.vercel.app/desktop/preview-padroes-observados.html

**Como ativar em producao:**
1. Railway → Environment Variables → `PADROES_V2_ENABLED=true`
2. Railway redeploya automatico
3. Proxima pre-consulta respondida ja roda pipeline v2
4. Medico abre → ve cards novos

**Como desativar em emergencia (rollback em 60s):**
1. Railway → `PADROES_V2_ENABLED=false`
2. Pipeline para imediatamente, sistema volta ao legado

### Sessao 11 — 23/04/2026 — Audio de 45s minimo (execucao autonoma)

**Contexto:** Lucas reportou frustracao dos medicos com audios de 15s. Pediu feature completa pra garantir minimo de 45 segundos sem criar fricao nova pro paciente. Apos 3 iteracoes de plano (1/10 → 10/10), Lucas aprovou execucao autonoma: "comece e so termine quando fizer deploy de tudo, sem me pedir autorizacao de fase em fase".

**7 fases executadas em sequencia, 7 commits atomicos:**

- **A** `c915bb8` — pre-consulta-slides.html: 3 slides (Confianca, Preparo, Compromisso) com swipe/dots/botao voltar/pular. Redireciona pra pre-consulta.html?skipSlides=1. Lealdade visual 100% ao 02-slides-paciente.html.
- **B** `e2c195e` — pre-consulta.html estados do botao: 5 estados conforme tempo (Pausar <45s, Finalizar >=45s, Continuar em pausa, etc). Barra de progresso ate 45s+ideal 90s. Pause/resume nativos com compensacao de tempo. Cap 3 pausas. attemptId UUID. Hints por faixa.
- **C** `e0f4fda` — fluxos de erro: 410/409/404 no load, detector in-app browser (WhatsApp/IG/FB), sheet permissao mic (1a vez vs 2a+), handler mediaRecorder.onerror (bluetooth/ligacao).
- **D** `8b22579` — sheet <45s em retomada, validacao silencio via RMS sampling (threshold 0.015), overlay "Nao captamos sua voz", visibilitychange auto-pausa.
- **E** `693ffec` — backend attemptId dedupe (200 duplicate:true em retry) + badge "conteudo curto" no dashboard medico (transcricao <80 palavras). **ZERO schema change** — attemptId persiste em respostas JSON, conteudoCurto calculado virtualmente no GET.
- **F** `82b0832` — integracao slides: maybeRedirectToSlides no load checa localStorage + IDB raw. Primeira visita => slides. Segunda/retomada => pula. modo=form => formulario ativo.
- **G** `14b2ad5` — 10 bugs criticos encontrados por 3 code-reviewers em paralelo e corrigidos:
  - CRIT: visibilitychange e onerror NAO queimam cap de pauseCount (pausa auto != pausa manual)
  - CRIT: updateButtonState chamado em toda tick (evita estado preso se timer skipa 45s)
  - CRIT: redirectTo com lock no slides (double-tap nao duplica navegacao)
  - CRIT: TOKEN vazio redireciona pro splash (nao grava localStorage orfao)
  - HIGH: restartRecording race — _thisRecorder local ignora onstop de instancia antiga
  - HIGH: validacao silencio trata _rmsCount=0 como silencio (Safari throttle)
  - HIGH: audio filename inclui attemptId slice (evita sobrescrita em retry)
  - HIGH: badge conteudoCurto guarda audioUrl (formulario escrito nao recebe badge)
  - HIGH: onerror usa pauseRecording(true) pra garantir timeout 90s
  - MED: attemptId persistido em respostas antes do updateMany

**Decisoes autonomas chaves:**
- Eliminei dependencia de schema change: conteudoCurto virtual via transcricao.split.
- Threshold silencio 0.015 conservador (voz baixa passa, bolso/mudo rejeita).
- Cap pausas manual = 3; auto-pausas nao contam.
- Slides so na 1a visita (flag localStorage por token + IDB raw check).
- Todos os commits pushaveis independentemente — rollback granular.

**Arquivos modificados:**
- Novo: `pre-consulta-slides.html`, `pre-consulta-backup-pre45s.html` (snapshot), `preview-audio-45s.html`
- Modificado: `pre-consulta.html`, `backend/src/routes/pre-consulta.js`, `20-medico-dashboard.html`

**NAO mexido (por pedido explicito do Lucas):**
- Qualquer tela do desktop medico (exceto badge novo no dashboard mobile)
- Schema do banco (Prisma)
- Fluxo de login/quiz/cadastro
- Scan de receita

**Skills usadas:** 3 agentes code-reviewer em paralelo na Fase G. TodoWrite pra tracking.

**Como testar no celular real (obrigatorio antes de divulgar pro medico):**
1. Abre link de pre-consulta novo no iPhone — deve ver os 3 slides primeiro
2. Grava 30s, clica Pausar, espera — timer para
3. Continua — timer segue de 30s
4. Chega aos 45s — botao vira "Finalizar gravacao" verde
5. Finaliza em 01:00 — chega review normal, envia, medico recebe
6. Gravar de novo com celular no bolso (silencio) — aos 45s+clique Finalizar tela "Nao captamos sua voz"
7. Recomecar 3x seguidas — a partir da 2a, link "Prefere responder por texto?" aparece
8. Abrir link no WhatsApp in-app browser — tela "Abra no seu navegador"
9. Dashboard medico — pre-consulta com pouca fala deve ter badge amarelo "conteudo curto"

**Pendente pra proxima sessao:**
- Validar no iPhone real com teste dos 9 cenarios acima
- Testar dedupe enviando 2x via F12 Network (should return duplicate:true no 2o)
- Eventualmente calibrar threshold silencio 0.015 com gravacoes reais
- Se Sentry reportar erro novo pos-deploy: investigar + revert

---

### Sessao 10 — 17/04/2026 (tarde) — Unificar foto do paciente

**Contexto:** Lucas notou que fotos do paciente vinham de DIFERENTES campos em DIFERENTES telas. Pediu mapeamento exaustivo. Agente Explore achou 2 campos no banco + 5 logicas diferentes de render em 14 telas. Conflito real: paciente fazia upload no perfil mas medico via icone vazio na lista (porque puxava PreConsulta.pacienteFotoUrl que podia estar vazio).

**Decisao:** foto tirada no quiz vira fonte unica. Salva em Usuario.fotoUrl. Todo lugar puxa dela. PreConsulta.pacienteFotoUrl mantida como historico forense, mas nunca usada pra display.

**O que foi feito:**

1. **Tela de foto obrigatoria no 05-quiz.html (onboarding):**
   - Novo step 3 no final (de 3 steps pra 4 — conserta o bug cosmetico "de 4")
   - UI: circulo 180px com dashed border, botoes Tirar Foto / Galeria, preview com fade-in
   - Compressao via canvas (1200px, JPEG 0.8)
   - Upload via vitaeAPI.uploadFoto() → POST /perfil/foto → salva Usuario.fotoUrl
   - btn-next disabled ate foto ser adicionada

2. **Mesma tela no quiz-preconsulta.html:**
   - Novo step 6 no final (de 6 pra 7)
   - Mesmo componente visual, mesmo fluxo
   - Conclude roda antes atualizarPerfil → depois uploadFoto

3. **Backend: endpoint retorna paciente.fotoUrl:**
   - `GET /pre-consulta/` (listar) e `GET /pre-consulta/:id` (detalhe)
   - Agora inclui `paciente: { id, nome, fotoUrl }` via Prisma include

4. **20-medico-dashboard.html unificado (3 pontos internos):**
   - Mini-lista PC: prioridade `pc.paciente.fotoUrl` > `pc.pacienteFotoUrl`
   - Grouped patient (perfil sheet + RG card): mesma prioridade
   - Greeting do medico: ja usava `Usuario.fotoUrl`, sem mudanca

5. **25-summary.html:** foto prioriza `pc.paciente.fotoUrl` em vez de `r.fotoUrl` (campo fantasma que nao existia)

6. **Desktop (3 arquivos) pickFoto simplificada:**
   - De 7 buscas pra 4 ordem: fotoUrl direto, paciente.fotoUrl, usuario.fotoUrl, pacienteFotoUrl (fallback)

**Arquivos modificados:**
- `05-quiz.html` (CSS foto + step3 + JS handler + conclude upload)
- `quiz-preconsulta.html` (CSS foto + step6 + JS handler + conclude upload)
- `backend/src/routes/pre-consulta.js` (2 endpoints com include paciente)
- `20-medico-dashboard.html` (3 pontos de prioridade invertidos)
- `25-summary.html` (linha 828 — prioridade correta)
- `desktop/dashboard.html` (pickFoto simplificada)
- `desktop/pre-consultas.html` (pickFoto simplificada)
- `desktop/pacientes.html` (pickFoto simplificada)

**Skills usadas:**
- Agent Explore exaustivo pra mapear os 2 campos + 14 telas + 5 logicas
- TodoWrite pra tracking de 8 tarefas

**Decisoes tomadas:**
- Foto obrigatoria no quiz (Lucas foi enfatico — CEO decide)
- No final dos 2 quizzes (depois de contato emergencia / exames)
- Manter PreConsulta.pacienteFotoUrl como historico forense
- Nao adicionar foto em telas que hoje nao mostram (21-qrcode, rg-publico, etc) — escopo fechado

**Pendente pra proxima sessao:**
- Testar quiz no celular real (camera funciona via capture="user"?)
- Confirmar que bucket Supabase aceita base64 via POST /perfil/foto (ou se precisa ajustar)
- Validar visualmente: medico ve mesma foto que paciente ve no perfil
- Considerar limpeza futura: remover campos `fotoBlob` do pre-consulta.html (agora foto ja esta no perfil antes da PC)
- Considerar adicionar foto nas 5 telas que hoje nao mostram (Lucas disse "so unificar no que ja existe" — fica pra depois)

---

### Sessao 9 — 17/04/2026 (PC de casa) — 4 ajustes no desktop medico

**Contexto:** Lucas abriu desktop e pontou 4 problemas visuais de uma vez. Pediu pesquisa profunda antes de implementar (plan mode com 3 Explore agents em paralelo). Plano aprovado com 3 decisoes tomadas via AskUserQuestion. Depois: "tudo" (executou as 4).

**Os 4 ajustes:**

1. **Mini-lista Dashboard limpa** (`desktop/dashboard.html`):
   - Removido: badge texto "Respondida/Pendente/Aberto/Expirada" + botao copiar-link
   - Adicionado: borda lateral esquerda 3px colorida por status (verde=respondida, amarela=pendente, azul=aberto, vermelha=expirada) — mesmo padrao dos insight cards da sessao 15/04
   - Mantido: avatar + nome + data + lixeira
   - Tooltip `title` com o status pra acessibilidade (daltonicos)

2. **Clique em exame abre arquivo direto** (`desktop/pre-consultas.html` linha 663):
   - Antes: `window.open('../11-exames-lista.html?pacienteId=X&openExamId=Y')` — abria tela mobile inteira
   - Agora: `window.open(e.arquivoUrl, '_blank', 'noopener')` — abre PDF/imagem direto
   - Se exame sem arquivoUrl, card fica sem cursor pointer

3. **Aba "Nova Pre-Consulta" unificada**:
   - Removida aba da sidebar em 7 arquivos: dashboard, pre-consultas, pre-consulta, pacientes, crm, templates, perfil
   - Removido botao topbar verde "+ Nova Pre-Consulta" de dashboard, pacientes, pre-consultas
   - Adicionado botao `.btn-p` no header da pagina Pre-Consultas (lado direito do titulo, `.ph` ja tem `justify-content:space-between`)
   - Modal inline do dashboard ficou orfao no codigo (funcoes openModal/gerarPreConsulta/etc ainda existem mas nunca sao chamadas — deixadas caso reative)

4. **Fotos dos pacientes nos avatares** (3 telas):
   - Funcao util `pickFoto(obj)` — procura em `fotoUrl`, `foto`, `pacienteFotoUrl`, `usuario.fotoUrl`, `paciente.fotoUrl`
   - Funcao `renderAvatar(obj, ini, size)` — se tem foto retorna `<div><img>`, senao fallback iniciais
   - `onerror` no `<img>` volta pra iniciais se URL quebrada (nunca aparece quadrado quebrado)
   - Aplicado em: dashboard `renderPC`, pre-consultas `renderList`, pacientes `renderPatients`

**Arquivos modificados:**
- `desktop/dashboard.html` (CSS + renderPC + renderAvatar + removida aba/botao)
- `desktop/pre-consultas.html` (sidebar + topbar + header com botao + exame direto + renderAvatarInline)
- `desktop/pacientes.html` (sidebar + topbar + renderAvatar + tabela usa ele)
- `desktop/pre-consulta.html` (sidebar)
- `desktop/crm.html` (sidebar)
- `desktop/templates.html` (sidebar)
- `desktop/perfil.html` (sidebar)

**Commits:** ainda nao feito (Lucas pediu pra pausar e validar visualmente antes)

**Skills usadas:**
- Plan mode com 3 Explore agents em paralelo (mapear UI desktop, ler Obsidian vault, investigar bugs avatares/exames)
- AskUserQuestion pra 3 decisoes (prioridade da foto, como abrir exame, status como borda colorida)
- Plano salvo em `C:\Users\win11\.claude\plans\nao-quero-que-impleemnte-steady-bear.md`

**Decisoes confirmadas:**
- Foto: prioridade `fotoUrl` do perfil → `pacienteFotoUrl` da pre-consulta → iniciais
- Exame: abrir PDF/imagem direto (Caminho A). Tela desktop dedicada fica pra proxima fase se Lucas sentir falta
- Status: remover texto, manter cor na borda lateral esquerda (padrao insight cards 15/04)

**Pendente pra proxima sessao:**
- Lucas testar visualmente as 4 mudancas
- Validar que bucket Supabase tem URL publica (se foto nao carregar, ajustar permissao)
- Testar exame abre de verdade em aba nova (depende de e.arquivoUrl ser URL direta do Storage)
- Commit + push apos validacao
- Limpeza futura: remover codigo orfao do modal inline do dashboard (openModal, gerarPreConsulta, etc) se confirmado que nao vai reativar
- Considerar aplicar mesma limpeza na pagina Pre-Consultas (tirar badge + botao copiar) se Lucas quiser consistencia com Dashboard

---

### Sessao 8 — 16/04/2026 (notebook, handoff pro PC de casa)
**O que foi feito:**
10 commits em 3 frentes: dashboard pills + 2 mockups visuais + redesign completo da aba Templates.

**Frente A — Dashboard pills + stats funcionais (2 commits):**
- Pills aumentados (padding 6/14 → 8/16, font 12 → 13, radius 20 → 22)
- Scrollbar 4px visivel embaixo dos pills (com hover)
- 3 pills novas estaticas no HTML: Pacientes, Pendentes, Respondidas (antes apareciam so apos clicar)
- Stat "Pacientes" filtra so quem tem `pacienteId` (conta VitaID real)
- Bug critico corrigido: stat "Respondidas" caia no branch do "Todos" e nao filtrava nada
- Commits: `d6ea2b1`, `30f5798`

**Frente B — Mockup perfil do paciente (1 commit, AGUARDA DECISAO):**
- Diagnostico: componente de colunas (Exames/Condicoes/Alergias/Meds) achatado, sem hierarquia clinica, "Condicoes" sem cedilha
- Mockup standalone com 2 direcoes lado a lado:
  - Direcao A — Cockpit Clinico: alergia em destaque vermelho no topo, bento 2x1 meds+condicoes
  - Direcao B — Bento Compacto: grid 2x2 colorido por categoria
- URL: https://vitae-app.vercel.app/mockup-perfil-paciente.html
- **PENDENTE:** Lucas escolher A ou B pra implementar
- Commit: `6a0130e`

**Frente C — Aba Templates redesign completo (8 commits, PLAN MODE ATIVADO):**

*Plano formal escrito (3 agentes Explore em paralelo):*
- Code Mapper: mapeou linha-por-linha o estado atual
- Documentation Agent: leu CLAUDE.md + 19 arquivos do Obsidian
- UX Research Agent: pesquisou Driver.js, Shepherd.js, Coach Marks, Stripe/Linear/Notion

*Conflito etico detectado e resolvido:*
Lucas pediu onboarding forcado TODA visita. Pesquisa nos seus proprios docs (PERSUASAO-ETICA.md, MENTALIDADE-CEO.md, NEUROCIENCIA-COMPORTAMENTO.md) revelou: forcar tutorial repetido = anti-padrao #1. Pesquisa externa (200+ flows) confirmou. Solucao aprovada: tutorial completo so PRIMEIRA VEZ + botao "Como funciona?" pra reabrir sob demanda + glow sutil no FAB quando zero templates.

*4 mudancas implementadas:*
1. Titulo: font-weight 700 → 900, angulo 120° → 90°, size 26 → 28px (gradient agora visivel)
2. Pills: mesmas dimensoes da aba pre-consulta + scrollbar visivel
3. 4 filtros novos (zero schema change): Curtos (perg < 5), Longos (≥ 10), Nao usados (vezesUsado=0), Com audio (permitirAudio=true)
4. Onboarding etico: trigger movido pra `showView('templates')`, overlay agora modal centralizado com fosco glass, 4 slides (3 conceituais + 1 spotlight final)

*Bugs e fixes na propria sessao:*
- Background overlay 78% branco escondia tudo → trocado pra rgba(13,15,20, 0.22) tinta escura sutil padrao Apple/Stripe sheet
- Clique no + durante spotlight nao fechava popup → safety net no `tplGoCreate()` que SEMPRE limpa overlay
- Bottom sheet (3 pontinhos do template): Lucas pediu remover "Duplicar" e "Cancelar", adicionar X de fechar

**Commits desta frente:**
- `a95ac82` — mockup templates (4 frames)
- `4d8f9db` — redesign completo
- `4f72e92` — fix fundo onboarding
- `f0b68a3` — 2 fixes onboarding (fundo + spotlight click)
- `033d353` — safety net tplGoCreate
- `c137002` — remove Duplicar + adiciona X
- `cf3c8e5` — remove Cancelar

**Pendente pra proxima sessao:**
- Lucas validar visualmente as mudancas (hard refresh + apagar localStorage `vitae_tpl_onboarding_visto`)
- Lucas escolher Direcao A ou B do mockup do perfil do paciente
- Mandar fluxo completo pro medico betatester (alerta CTO ainda valido)

**Decisoes documentadas:**
- Onboarding etico vence onboarding forcado (basea-se nos proprios docs do Lucas)
- Filtros sem mudanca de schema preferidos (Favoritos/Categoria sao fase 2)
- Spotlight via FAB z-index alto + glow CSS (mais simples que CSS mask "buraco")
- Background overlay tinta escura (nao clara) — padrao Apple/Stripe

**Skills usadas:**
- Plan mode com 3 Explore agents em paralelo
- Plano salvo em `C:\Users\valve\.claude\plans\temporal-gathering-toucan.md`

---

### Sessao 7 — 15-16/04/2026 (PC de casa, handoff pro notebook)
**O que foi feito:**
Duas grandes frentes: redesign S1/S2 da tela 25-summary (que o medico ve apos pre-consulta) + 3 melhorias UX no dashboard do medico.

**Frente A — 25-summary.html (tela do briefing do paciente):**

1. **Player minimalista (Apple Podcasts style):**
   - Removido "Ouvir briefing / ~1 minuto" do lado dos botoes
   - 3 botoes centralizados: skip -5s, play grande (56px), skip +5s
   - Timer split: atual esquerda, duracao direita, abaixo da barra de progresso
   - 3 chips de velocidade consolidados em 1 botao unico que cicla 1x → 1.5x → 2x → 1x

2. **Transcricao simetrica 220px:**
   - Altura igual ao player
   - Fades gradiente topo/base (sinaliza "ha mais texto")
   - Scrollbar 2px verde
   - Pulso verde ao clicar numa palavra antes do seek
   - Palavra atual trava na 3a linha (terco superior)
   - Scroll manual pausa auto-follow por 4 segundos (sem chip "Voltar ao audio" — Lucas rejeitou)

3. **Referencia (iteracao de 4 versoes ate chegar):**
   - V1: accordion "Dados do paciente" com linhas separadas por border-bottom (feia, parecia Word)
   - V2: mini-cards off-white com barra lateral muted 3px em 3 camadas + "Contexto adicional" colapsavel (Lucas rejeitou: "apagada")
   - V3: mesmo componente .insight-card dos Pontos de atencao, com variantes de cor fortes (alergia vermelha, med verde, queixa azul, historico roxo, familiar/exames cinza)
   - **V4 (FINAL): mostra APENAS Queixa principal (azul) + Historico relevante (roxo).** Alergias/meds/familiar/exames removidos — ja existem nas telas dedicadas do medico (medico-alergias/meds/condicoes/exames)

4. **Principio S1/S2 documentado** em `C:\Users\win11\OneDrive\Documentos\Obsidian Vault\DESING\DESING.md` como regua permanente de hierarquia visual. S1 = reconhecimento rapido (chip paciente, player, alertas); S2 = consulta analitica (transcricao, referencia) com saturacao recuada.

**Frente B — 20-medico-dashboard.html (3 melhorias):**

1. **FAB "+" esconde no perfil do paciente:**
   - `showPatientProfile()` → `document.getElementById('dashFab').style.display = 'none'`
   - `backToPacList()` → reverte pra `''`

2. **Stats clicaveis viram tags de filtro:**
   - Clicar "Pendentes" (9) cria uma pill verde "Pendentes" na faixa de filtros embaixo (junto com Todos/Hoje/Semana/Mes) e filtra a lista mostrando so pacientes com pelo menos 1 pre-consulta status PENDENTE/ABERTO
   - Clicar "Pacientes" ou "Respondidas" seleciona a pill "Todos" (mostra todos)
   - Stats em si NAO ficam destacadas visualmente — sao apenas numeros clicaveis que ativam o filtro embaixo
   - Funcao nova: `filterByStatus(tipo)` em `20-medico-dashboard.html` apos `filterPacTime()`
   - Variaveis de estado: `_currentStatusFilter`, `_currentPeriodFilter`
   - `renderPacientesList()` ajustada pra compor os 2 filtros (status × periodo)

3. **Botao X nos popups:**
   - Modal de criar pre-consulta: X no canto superior direito, chama `closeModal()`
   - Apos gerar link, botao "Gerar link" vira "Fechar" (alem do X ja existir)
   - `closeModal()` reseta botao pra "Gerar link" + reata `criarPreConsulta` como onclick

**Commits relevantes (nessa ordem):**
- `2c973e9` — 25-summary redesign S1/S2 (3 frentes)
- `bb01948` — remove chip "Voltar ao audio"
- `a5e553f` — referencia usa mesmo insight-card dos pontos de atencao
- `832e409` — remove alergias/meds/familiar/exames da referencia
- `edf2e60` — dashboard 3 melhorias UX
- `f4f23a0` — stats clicam pra selecionar tag pill embaixo
- `8fe4950` — corrige mapeamento stats → filtros (Pacientes/Respondidas = Todos, Pendentes = pill propria)

**Bugs que Lucas apontou e foram corrigidos na sessao:**
- Cards "apagados" na referencia → trocados por insight-cards coloridos
- Cards duplicados de alergias/meds/familiar/exames (ja existem em telas dedicadas) → removidos
- Chip "Voltar ao audio" dentro da transcricao → removido (Lucas nao quis)
- Stats ficando verde quando clicadas → trocado por criar pill de filtro embaixo
- Pacientes e Respondidas deviam mostrar tudo (nao so quem tem anamnese respondida) → corrigido

**Pendente pra proxima sessao:**
- Testar no celular real (iPhone Safari) com cache limpo
- **Mandar fluxo completo pro medico betatester** (ver alerta CTO abaixo)
- Validar no celular: cards de Referencia ficaram visualmente iguais aos Pontos de atencao
- Validar stats-filter no celular (tap em "Pendentes" cria pill embaixo)
- Validar X do popup em mobile (facil de acertar com dedo)

**Alerta CTO pro Lucas (IMPORTANTE):**
Depois dessa sessao, **parar de polir telas** e mandar o fluxo completo pro medico betatester. Cada rodada de polimento sem validacao de uso real eh escultura em marmore no deserto. A critica do medico pode invalidar 2-3 decisoes tomadas ontem — e tudo bem, isso eh o processo.

**Handoff completo em Obsidian:** Recomendado criar `TRANSICAO-FACULDADE-15-ABR-2026-TARDE/` com este resumo + proximos passos.

---

### Sessao 1 — 09/04/2026
**O que foi feito:**
- Mapeamento completo de todas as 38 telas (leitura de todos os HTMLs)
- Descoberta dos 4 arquivos faltando (26, 27, quiz-preconsulta, 01-login)
- Criacao do mapa de fluxo visual interativo (mapa-fluxo-completo.html) — 2 versoes (v1 desorganizada, v2 com fileiras + preview)
- Criacao da tela de identidade visual (identidade-visual.html) — cores, fontes, componentes reais, mockups
- Analise completa do projeto (backend 16 rotas, 17 tabelas, servicos, CSS, api.js)
- Descoberta de que vitae-app-git e vitae-app-github NAO sao duplicatas (divergiram)
- Montagem do vault Obsidian com 9 notas direto em C:\Users\win11\OneDrive\Documentos\Obsidian Vault\
- Criacao deste CLAUDE.md como documento vivo

**Skills usadas:**
- Nenhuma skill formal (/gsd, /commit, etc). Trabalho manual de exploracao + criacao.

**Decisoes tomadas:**
- CLAUDE.md sera o documento vivo (Claude le automaticamente)
- Obsidian e pra Lucas consultar (Claude NAO le automaticamente)
- vitae-app-github e a pasta ativa (ignorar vitae-app-git)
- No final de toda sessao, atualizar este CLAUDE.md

**O que ficou pendente:**
- Criar as 4 telas faltando (26-scan-receita, 27-processando, quiz-preconsulta, 01-login)
- Organizar arquivos de dev em pasta separada (/dev ou /tools)
- Mover .md de planejamento pra /docs
- Decidir futuro do frontend/ Next.js (manter ou deletar)
- Decidir futuro da pasta vitae-app-git/ (arquivar ou deletar)

### Sessao 6 — 15/04/2026 (tarde) — 7 fases completas
**O que foi feito:** 7 fases independentes resolvendo os 8 problemas que Lucas listou. Cada fase passou por validacao de 10 agentes antes do deploy. ~20 bugs criticos foram pegos pelos agentes.

**Problemas resolvidos:**
1. Aba Score removida do paciente (tab bar 5→4 abas) — FASE 1
2. Botao voltar pre-consulta volta pro perfil do paciente especifico — FASE 1
3. Prompt IA do One Minute Summary reescrito com regras anti-falha + anti-alucinacao + linguagem segura — FASE 2
4. Gemini agora usa systemInstruction separado (antes concatenava e perdia autoridade das regras) — FASE 2
5. Tela de Exames do medico: 11-exames-lista.html aceita `?pacienteId=XXX` e entra em modo medico (reuso total) — FASE 3
6. Backend GET /exames/:id libera acesso pra medicos com vinculo — FASE 3
7. Alergias/Condicoes/Medicamentos agora sao accordions inline no perfil do paciente (nao abre tela separada) — FASE 4
8. Tabela MED_EQUIV com 20+ pares brand↔generico BR — resolve Novalgina=Dipirona (caso original do Lucas!) — FASE 4
9. 4 telas antigas apagadas (medico-exames/alergias/meds/condicoes = 1752 linhas removidas) — FASE 5
10. Scan no PC: compressao de imagem (1600px/JPEG 0.75) + timeout 30s + mensagens amigaveis — FASE 6
11. Novo Template: 4 telas (onboarding + form + preview + confirm) — FASE 7

**Arquivos modificados:**
- 08-perfil, 09-dados-pessoais, 11-exames-lista, 15-bioage-sem-dados, 16-medicamentos, 17-alergias, 21-qrcode, 25-summary, 30-lembretes, 31-revisao-alergias
- 20-medico-dashboard.html (maior mudanca — accordions + 4 telas template)
- 27-processando.html (compressao)
- backend/src/services/ai.js (prompt + timeout)
- backend/src/routes/exames.js (acesso medico)

**Arquivos criados:**
- preview-novo-template.html (dev only, preview visual das 4 telas)

**Arquivos deletados:**
- medico-exames.html, medico-alergias.html, medico-medicamentos.html, medico-condicoes.html

**Metodologia:** planejar → Lucas aprovar → implementar → 10 agentes validam → corrigir criticos → commit → push → proxima fase.

**Commits:** 12 commits (183e40d, 240bd83, 93c9147, b7fbe5d, 574a37e, b02c76d, ccd5660, 3ff8df0, 23ef8af, 4829625, e0ab1f1, d25f404)

**Pendente pra proxima sessao:**
- Testar tudo no celular real
- Regenerar summary das pre-consultas existentes com novo prompt
- Configurar voz ElevenLabs PT-BR definitiva no Railway
- Linguagem "voce/seu/sua" nas telas de detalhe de exame (modo medico)
- Bug Novalgina=Dipirona NO SCAN de receita (dashboard ja cruza, scan ainda nao)

**Detalhes completos:** SESSAO-15-ABR-2026-tarde.md no Obsidian

---

### Sessao 5 — 15/04/2026 (noite)
**O que foi feito:**
Infraestrutura real de entrega garantida de audio na pre-consulta. Motivacao: paciente gravou, viu "Enviado", mas audio nao chegou ao medico betatester. Investigacao profunda (2 agentes paralelos) revelou que o sistema falhava silenciosamente em 30-40% dos envios com audio > 3min.

**Etapas executadas:**
1. **IndexedDB local (vitaStorage)** — audio e foto ficam salvos no navegador antes, durante e depois do envio. Paciente pode fechar app e retomar depois sem perder nada.
2. **Chunked recording** — MediaRecorder.start(1000): chunks a cada 1s vao pra IDB em tempo real. Bitrate 64kbps reduz 5min de audio de 4.8MB pra 2.4MB.
3. **Wake Lock** (iOS 16.4+) durante gravacao e envio — impede auto-lock do celular.
4. **Deteccao iOS + banner de aviso** — "mantenha a tela acesa durante gravacao e envio".
5. **Limite de 5 minutos** com alerta visual (timer fica amarelo aos 4min, vermelho aos 4:30, auto-stop aos 5:00).
6. **Upload com timeout explicito 25s + 1 retry automatico** — em vez de fetch sem timeout que morria silencioso.
7. **Fluxo de envio com confirmacao real** — backend faz HEAD request na URL do Supabase pra validar que arquivo existe ANTES de responder 200. Se nao existir, retorna 422. Cliente so limpa IDB quando backend confirma explicitamente `audioConfirmado: true`.
8. **Fila de processamento assincrono** — summary/Whisper/TTS saem do caminho critico. Nova tabela `TarefaPendente` + worker que roda a cada 30s com backoff exponencial (30s, 2min, 10min, 30min, 2h). Apos 5 tentativas marca como DEAD. Elimina risco de 504 Gateway Timeout do Railway (30s).
9. **Retomada automatica** — se paciente fecha o app no meio do envio, ao reabrir pre-consulta.html com o mesmo token, o sistema detecta dados pendentes na IDB e oferece banner "Sua gravacao anterior foi recuperada".
10. **Badge "Incompleta" no dashboard do medico** — pre-consultas com status RESPONDIDA sem audio OU sem summary (apos 3 min de graca) mostram badge laranja + botao "pedir reenvio" que abre WhatsApp com mensagem pronta.

**Caminho critico do /responder:**
- Antes: 28-53s (frequente 504 no Railway)
- Depois: 2-5s (retorno rapido, summary gerado em background)

**Commits:**
- `fb7e954` — persistencia local + Wake Lock + limite 5min
- `ab4bab6` — fila assincrona + validacao HEAD + confirmacao real
- (proximo) — retomada automatica + badge dashboard + docs

**Decisoes confirmadas com Lucas (AskUserQuestion):**
- Confirmacao pro paciente: so tela de sucesso (sem SMS/email)
- Aviso de pre-consulta incompleta pro medico: card + botao manual (sem SMS auto)
- Audio precisa funcionar ate 5 minutos de duracao

**Como regenerar uma pre-consulta que veio pobre:**
No dashboard do medico, F12 console: `vitaeAPI.regenerarSummaryPreConsulta('ID_DA_PRE_CONSULTA')`

**Licoes aprendidas:**
1. Investigacao profunda ANTES de propor solucao — 2 agentes paralelos em ~2 min revelaram 10 pontos de falha silenciosa
2. "Tenta de novo" sem numeros = mal plano. Numeros reais (tamanhos, timeouts, backoff) = arquitetura
3. iOS Safari tem armadilhas (ITP 7d, sem Background Sync, tela bloqueia mata gravacao) que FORCA design defensivo: assume que algo vai dar errado
4. Validacao explicita > confianca implicita. HEAD request antes de 200 resolve o bug.

**O que ficou pendente:**
- Remover debug_code/debug_meta/debug_message do errorHandler
- Escolher voz ElevenLabs definitiva (3 MP3s na raiz: daniel, eric, george)
- Testar no celular real com audio de 5min (cenarios: WiFi, 3G, bloquear tela, fechar app)

---

### Sessao 4 — 14/04/2026 (noite)
**O que foi feito:**
- Redesign completo das 4 telas dedicadas do medico (Exames, Condicoes, Alergias, Medicamentos)
  - Patient subheader unificado (avatar + nome + idade/sangue + count)
  - Tab strip interno: navegacao entre as 4 sem voltar ao dashboard
  - Insight cards com borda lateral colorida 4px (padrao 25-summary): vermelha (grave/critico), amarela (atencao/moderado), verde (normal/leve/ativo), azul (informativo/passado)
  - Empty states acolhedores com hint contextual
  - Skeleton de loading com shimmer (sem texto "Carregando...")
  - Identity-missing fallback: se pacienteId vazio, mostra tela bonita "Paciente sem vinculo" em vez de "Erro: ID nao fornecido"
- **medico-condicoes.html:** icones contextuais por categoria (cardio/diabetes/respiratorio/mental/digestivo/tireoide), chip "Em tratamento" via cross-link com motivo dos medicamentos ativos
- **medico-alergias.html:** painel "Antes de prescrever, revise" no topo com pills decrescentes por gravidade, botao "Copiar lista", cross-match com medicamentos ativos por nome (badge "Presente em [Med]")
- **medico-medicamentos.html:** secao "Em uso agora" com horarios em chips, motivo, prescritor, tempo de uso calculado, alerta "Acaba em X dias" se estoque baixo, secao "Descontinuados" opacificada, cross-match com alergias
- **medico-exames.html:** secao "Pontos de atencao" no topo (criticos/atencao primeiro), filtros (Todos/Alterados/Normais/Em leitura), linha do tempo agrupada por ano com timeline-card, parametros alterados como chips com setas (↑/↓), resumo clinico (sem mencionar IA)

- **Bug "ID nao fornecido" — RESOLVIDO em 3 camadas:**
  1. Backend: novo endpoint POST /medico/limpeza-antigas — apaga PreConsulta sem pacienteId criadas antes de 14/04/2026 (com limpeza de storage)
  2. Dashboard: helper buildClinicalLink() — quando paciente sem vinculo, abre sheet bottom-up explicativo em vez de navegar pra tela quebrada. Cards desabilitados visualmente (opacity 0.5) + chip "Sem vinculo"
  3. 4 telas: cada uma renderiza identity-missing fallback se pacienteId ausente (defesa em profundidade)

- **Backend ajustes em medico.js GET /pacientes/:id:**
  - Removido filtro "where ativo:true" em medicamentos (agora retorna todos pra mostrar descontinuados)
  - Exames agora retornam parametros[], status, nomeArquivo, tipoArquivo (precisos pra mostrar chips alterados na tela)

- **api.js:** nova funcao limpezaPreConsultasAntigas()

**Skills usadas:**
- /ultraplan (plan mode com Explore + Plan agents) pra projetar antes de implementar
- AskUserQuestion pra clarificar 4 decisoes-chave com Lucas

**Decisoes tomadas:**
- Cruzamentos basicos por nome exato (sem mapa de familias farmacologicas nessa rodada)
- Apagar pre-consultas antigas sem vinculo do banco (irreversivel — Lucas autorizou)
- Dupla protecao contra "ID nao fornecido" (dashboard + 4 telas)
- Chip "Sem vinculo" em vez de esconder o paciente — medico precisa ver que ele existe mas falta cadastro

**Arquivos modificados:**
- backend/src/routes/medico.js (endpoint limpeza + select expandido pra exames/medicamentos)
- 20-medico-dashboard.html (CSS sheet, helper buildClinicalLink, banner "Sem vinculo", funcoes de identity-sheet e limpeza)
- medico-condicoes.html (rewrite completo)
- medico-alergias.html (rewrite completo)
- medico-medicamentos.html (rewrite completo)
- medico-exames.html (rewrite completo)
- api.js (limpezaPreConsultasAntigas)

**Como rodar a limpeza (uso unico):**
1. Abrir 20-medico-dashboard.html logado como medico
2. F12 (console)
3. Digitar: `rodarLimpezaAntigas()`
4. Confirmar — apaga todas PreConsulta sem pacienteId criadas antes de 14/04/2026

**O que ficou pendente:**
- Limpar campos debug do errorHandler.js (debug_code, debug_meta, debug_message expostos no response — uso temporario)
- Testar fluxo completo no celular real
- Decidir voz ElevenLabs definitiva (3 MP3s de teste na raiz: daniel/eric/george)
- Regenerar summary das pre-consultas existentes (prompt antigo) usando diag-pipeline.html

---

### Sessao 2 — 10/04/2026
**O que foi feito:**
- Analise profunda do fluxo de medicamentos (cada botao, cada link, cada funcao)
- Mapeamento de 26 itens faltando no scan (6 areas: telas, IA, dados, UX, seguranca, custos)
- Descoberta CRITICA: sistema nao detecta Novalgina=Dipirona (risco de vida)
- Descoberta: Gemini e Claude retornam campos diferentes (schema mismatch)
- Descoberta: tabela CMED (52 remedios) existe mas ninguem usa
- Descoberta: gravidade de alergia sempre salva como "MODERADA" ignorando IA
- Descoberta: medicamentos nunca marcam fonte "scan"
- Descoberta: sem deteccao de duplicata pra medicamentos
- 4 especialistas trabalharam em paralelo (camera, processamento, revisao, backend)
- Plano completo de 8 fases criado em PLANO-SCAN-COMPLETO.md
- Pesquisa sobre HM Skills (Rodrigo Lopes) — GitHub: rodrigohighermind/highermind-code-skills

**Skills usadas:**
- Nenhuma skill formal. 4 agentes especializados (code-architect) rodaram em paralelo.

**Decisoes tomadas:**
- Backend primeiro → Telas depois → Polimento por ultimo (ordem de execucao)
- Deteccao de alergias precisa de 3 camadas (CMED + familias + texto)
- Mapa de familias de medicamentos (penicilinas, AINEs, dipirona) sera hardcoded
- Tela de revisao de medicamentos (28) e tela nova (nao reusar a de alergias)
- Foto sera comprimida no celular antes de enviar (1200px max, qualidade 0.7)
- Limite de 15 scans por dia por usuario

**O que ficou pendente:**
- EXECUTAR o plano de 8 fases (nada foi implementado ainda, so planejado)
- Instalar HM Skills no Claude Code (decidir se vale)
- Criar as 4 telas faltando + 3 arquivos novos de backend
- Todas as correcoes de backend (normalizacao, conflito, duplicata, fonte)

---

## 10. LOG DE ERROS

> Registro de todo erro que apareceu, o que causou, o que tentamos, se resolveu.
> Formato:

```
### ERRO-001: [Nome curto]
- **Data:** DD/MM/AAAA
- **Onde:** [arquivo ou tela]
- **O que aconteceu:** [descricao simples]
- **Causa:** [por que aconteceu]
- **Tentativa 1:** [o que tentamos] → [funcionou/nao]
- **Tentativa 2:** [o que tentamos] → [funcionou/nao]
- **Status:** RESOLVIDO / PENDENTE / CONTORNADO
- **Licao:** [o que aprendemos]
```

### ERRO-001: "Erro: ID nao fornecido" nas 4 telas dedicadas do medico
- **Data:** 14/04/2026
- **Onde:** medico-alergias.html, medico-medicamentos.html, medico-condicoes.html, medico-exames.html
- **O que aconteceu:** Ao clicar nos cards Exames/Alergias/Meds/Condicoes no dashboard do medico, algumas vezes mostrava "Erro: ID nao fornecido" em vez dos dados.
- **Causa:** Pre-consultas antigas (testes "ppppp" e similares) ficaram no banco SEM pacienteId vinculado a um Usuario. O dashboard montava as URLs com `pacienteId=` vazio, e as 4 telas rejeitavam.
- **Tentativa 1:** Identificar pre-consultas antigas → SUCESSO (criadas antes de 14/04/2026 quando o fluxo novo de quiz obrigatorio entrou)
- **Fix em 3 camadas:**
  1. Backend POST /medico/limpeza-antigas — apaga PreConsulta sem pacienteId pre-fluxo-novo
  2. Dashboard helper buildClinicalLink() — abre sheet "Paciente sem vinculo" se vazio, em vez de navegar
  3. As 4 telas com identity-missing fallback (defesa em profundidade)
- **Status:** RESOLVIDO
- **Licao:** Quando uma feature exige pre-condicao (ex: paciente ter conta), o frontend NUNCA pode confiar que essa pre-condicao foi cumprida. Sempre validar e ter fallback bonito (NUNCA "Erro: ID nao fornecido" — sempre tela explicativa).

### ERRO-002: Audio de pre-consulta nao chegava silenciosamente
- **Data:** 15/04/2026
- **Onde:** pre-consulta.html (frontend) + pre-consulta.js (backend)
- **O que aconteceu:** Paciente gravou audio no iPhone, fez login, viu "Enviado com sucesso". Foto chegou no medico, audio NAO chegou. Medico betatester avisou.
- **Causa raiz (tripla):**
  1. `uploadToSupabase()` falhava silencioso (retornava null sem jogar excecao)
  2. `enviarAudio()` considerava sucesso mesmo com audioUrl=null
  3. Backend aceitava pre-consulta sem audio e retornava 200 feliz
  - Provaveis motivos especificos: CORS nao configurado no bucket Supabase, iOS suspendeu fetch ao bloquear tela, ou timeout por falta de AbortController
- **Investigacao:** 2 agentes paralelos (Explore + pesquisa iOS Safari) revelaram 10 pontos de falha silenciosa, taxa estimada de falha 30-40% com audio > 3min
- **Fix em 10 camadas** (documentado na Sessao 5 acima). Principais: IndexedDB local, chunks a 1s, Wake Lock, HEAD validation no backend, fila assincrona com backoff, retomada automatica, badge "Incompleta" no dashboard
- **Status:** RESOLVIDO
- **Licao:** No iOS Safari, upload silencioso e a regra, nao excecao. Forca design defensivo: cada peca precisa confirmar entrega explicitamente (HEAD), backend precisa retornar status detalhado (audioConfirmado, fotoConfirmada), cliente nao pode limpar estado local sem confirmacao. Numeros reais em cima de arquitetura: bitrate 64kbps, timeout 25s, backoff 30s/2min/10min/30min/2h.

### ERRO-003: Git local em `d:/vitae-app-github` corrompido (objetos invalidos)
- **Data:** 27/04/2026
- **Onde:** repositorio git local na pasta `d:/vitae-app-github` (todo o `.git/`)
- **O que aconteceu:** durante `git status` antes de commit de feature nova (anamnese estruturada), descoberto que historico local sumiu. `git log` mostrava SO 1 commit ("Initial commit"). `origin/main` ref broken. Tag `v-pre-agenda-26abr2026` broken. Objeto `7076c709f1ed3fc930855f98326a7d40f96850b3` com header invalido.
- **Causa raiz:** desconhecida. Hipoteses: antivirus Windows deletando objetos do `.git/objects/`, sync OneDrive corrompendo, falta de espaco em disco em algum momento, ou crash do sistema durante operacao git.
- **Tentativa 1:** `git fetch origin` → falhou com `inflate: data stream error (incorrect header check)` → JOGOU pro fallback
- **Tentativa 2:** `mv d:/vitae-app-github → vitae-app-github-quebrado` → falhou com `Permission denied` (lock de processo, provavel VSCode ou serve.js)
- **Solucao executada:** `git clone` em pasta nova `d:/vitae-app-novo`, copiou os 2 arquivos modificados (ai.js + 25-summary.html) do disco quebrado, commit + push do clone novo. Pasta corrompida preservada (NAO deletada).
- **Status:** CONTORNADO (deploy fez normal). Pasta corrompida ainda existe em `d:/vitae-app-github` aguardando Lucas fechar locks pra renomear.
- **Licao:** Quando git local quebra, NUNCA tentar `git reset --hard`, `git fsck --fix`, ou outros comandos destrutivos sem aprovacao. Clone fresco em pasta nova e sempre o caminho mais seguro. Preservar pasta corrompida pra forensics. Evitar ter pasta de projeto dentro de OneDrive/iCloud (sync corrompe `.git/`). Considerar excluir `.git/` da varredura do antivirus em maquinas Windows.

(nenhum outro erro registrado ainda — cresce conforme trabalhamos)

---

## 11. LOG DE TENTATIVAS

> Coisas que tentamos, deram certo ou nao, e por que.

### TENT-001: Mapa de fluxo com caixas simples
- **Data:** 09/04/2026
- **Objetivo:** Visualizar todas as telas e conexoes
- **Abordagem:** HTML com nodes posicionados e linhas SVG retas
- **Resultado:** PARCIAL
- **Detalhes:** Funcionou mas ficou desorganizado — posicoes aleatorias, linhas cruzando
- **Licao:** Precisa de fileiras organizadas por etapa do fluxo

### TENT-002: Mapa de fluxo com fileiras + preview de telas
- **Data:** 09/04/2026
- **Objetivo:** Refazer o mapa organizado
- **Abordagem:** Fileiras horizontais por etapa, iframes mostrando cada HTML real, linhas ortogonais
- **Resultado:** SUCESSO
- **Detalhes:** Mapa ficou limpo, organizado. Preview real de cada tela. Duplo clique abre modal grande. Busca, zoom, minimap.
- **Licao:** Preview real > caixas com texto. Sempre organizar em fileiras.

### TENT-003: Vault Obsidian com 10 notas na pasta do projeto
- **Data:** 09/04/2026
- **Objetivo:** Criar documentacao pro Obsidian
- **Abordagem:** Primeiro criou em d:\vitae-app-github\obsidian\, depois descobriu vault real e escreveu direto la
- **Resultado:** SUCESSO
- **Detalhes:** 9 notas criadas direto em C:\Users\win11\OneDrive\Documentos\Obsidian Vault\
- **Licao:** Descobrir o caminho real do vault ANTES de criar arquivos

### TENT-004: Analise do fluxo de scan com agente unico
- **Data:** 10/04/2026
- **Objetivo:** Entender como o scan de medicamentos funciona de ponta a ponta
- **Abordagem:** Agente explorador lendo cada arquivo do fluxo
- **Resultado:** SUCESSO
- **Detalhes:** Mapeou 26 itens faltando em 6 areas. Descobriu bugs criticos (Novalgina/Dipirona, schema mismatch)
- **Licao:** Analise profunda antes de implementar revela problemas que ninguem sabia que existiam

### TENT-005: 4 arquitetos em paralelo pra planejar scan completo
- **Data:** 10/04/2026
- **Objetivo:** Planejar as 3 telas + melhorias de backend simultaneamente
- **Abordagem:** 4 agentes code-architect rodando ao mesmo tempo, cada um lendo o projeto inteiro
- **Resultado:** SUCESSO
- **Detalhes:** Cada agente entregou blueprint completo (~250 linhas cada). Consolidados no PLANO-SCAN-COMPLETO.md
- **Licao:** Agentes paralelos multiplicam a capacidade. Cada um leu os mesmos arquivos mas com foco diferente

---

## 12. SKILLS USADAS

> Registro de cada skill (/comando) usada, como, e resultado.

```
### SKILL: /nome-da-skill
- **Data:** DD/MM/AAAA
- **Pra que:** [objetivo]
- **Como:** [o que digitou]
- **Resultado:** BOM / RUIM / MEDIO
- **Nota:** [observacao]
```

(nenhuma skill usada ainda — sera preenchido conforme usar /gsd, /commit, /review, /simplify, etc)

**Skills disponiveis que podem ser uteis pro vita id:**
- /commit — criar commits organizados
- /simplify — revisar codigo e simplificar
- /gsd:new-milestone — definir proxima grande entrega
- /gsd:plan-phase — planejar uma fase com passos detalhados
- /gsd:execute-phase — executar o plano
- /gsd:autonomous — executar tudo sozinho fase por fase
- /gsd:debug — modo detetive pra achar bugs
- /gsd:fast — tarefa simples rapida sem burocracia
- /frontend-design — criar interfaces com design de qualidade

---

## 13. PADROES DESCOBERTOS (repetir)

- **Preview real > descricao:** Quando mostrar telas, usar iframe com preview real em vez de caixas com texto
- **Fileiras organizadas:** Diagramas sempre em fileiras horizontais por etapa
- **Pesquisa antes de fazer:** Lucas quer entender o territorio completo antes de mexer
- **Explicar sem codigo:** Sempre traduzir tudo pra linguagem simples em PT-BR
- **Verificar se existe:** Antes de referenciar arquivo, confirmar que ele realmente existe
- **Backend primeiro, telas depois:** Corrigir o cerebro antes de construir a interface
- **Agentes paralelos pra planejamento:** Lancar 4 arquitetos ao mesmo tempo pra planejar partes independentes
- **Mapeamento exaustivo antes de planejar:** Identificar TUDO que falta antes de planejar qualquer solucao
- **3 camadas de protecao:** Pra deteccao critica (alergias), nunca depender de um metodo so
- **Plano em fases independentes:** Cada fase pode ser executada separadamente sem quebrar as outras
- **2 telas de referencia:** Antes de criar tela nova, ler pelo menos 2 existentes pra copiar o padrao
- **Escrever direto no destino:** Descobrir caminho real antes de criar arquivo (ex: vault do Obsidian)

---

## 14. ANTI-PADROES (nunca repetir)

- **Nodes em posicoes aleatorias:** Mapa de fluxo com caixas soltas fica ilegivel — usar fileiras
- **Criar sem ler vitae-core.css:** Tela nova sem ler o design system = fora do padrao garantido
- **Assumir que arquivo existe:** 4 telas sao referenciadas mas nao existem — sempre verificar
- **Criar em pasta errada:** Primeiro confirmar caminho certo (ex: vault Obsidian)
- **Explicar com jargao tecnico:** Lucas nao programa — traduzir tudo
- **Fetch direto nas telas:** Sempre usar api.js, nunca fetch direto (exceto rg-publico e exame-publico)

---

## 15. ROADMAP

### Prioridade 1 — Fechar MVP
- [ ] Criar 26-scan-receita.html (camera/galeria)
- [ ] Criar 27-processando.html (loading do scan)
- [ ] Corrigir logout do medico (aponta pra 01-login que nao existe)
- [ ] Criar quiz-preconsulta.html

### Prioridade 2 — Organizar projeto
- [ ] Mover arquivos dev pra pasta /dev ou /tools (mapa-telas, dashboard-scan, teste-scan, diag-scan, summary-demo, fluxo-medicamentos-alergias)
- [ ] Mover .md de planejamento pra /docs (diagnostico-completo, mapeamento-completo-scan, plano-fase-3-4-definitivo, etc)
- [ ] Resolver numeracao duplicada (15: bioage vs nova-senha | 20: medico-cadastro vs medico-dashboard)
- [ ] Decidir: manter ou deletar pasta frontend/ (Next.js)
- [ ] Decidir: manter ou deletar pasta vitae-app-git/
- [ ] Decidir: manter ou deletar pasta server/ (wearable)

### Prioridade 3 — Features novas
- [ ] Push notifications (lembretes de medicamento no celular)
- [ ] Controle de estoque (avisar quando remedio vai acabar)
- [ ] Historico de score (grafico de evolucao ao longo do tempo)
- [ ] Idade biologica com dados reais (15-bioage funcionando)
- [ ] Check-in semanal (tela pro paciente responder sono, humor, atividade)
- [ ] Compartilhamento entre medicos (encaminhar paciente)

### Futuro (pos-validacao)
- [ ] Converter pra app nativo (PWA ou React Native)
- [ ] Integrar wearables (WHOOP, Oura, Apple Watch)
- [ ] Plano pago pra medicos (assinatura)
- [ ] Parcerias com laboratorios (envio direto de resultados)

---

## 16. DECISOES TOMADAS

| Data | Decisao | Por que |
|------|---------|---------|
| Inicio | HTML puro como frontend | Velocidade, simplicidade, Lucas nao programa |
| Inicio | Supabase (banco + storage) | Tudo junto, gratuito pra comecar |
| Inicio | Claude API pra exames | Melhor compreensao de docs medicos BR |
| Inicio | Railway pra servidor | Deploy simples via git push |
| Inicio | JWT 30 dias + refresh 90 dias | Usuario nao precisa logar toda hora |
| Inicio | Tom institucional | Saude e serio, confianca e fundamental |
| Inicio | Zero emojis | SVG e mais profissional e controlavel |
| Inicio | Nunca falar de IA | Usuario tem medo de "IA diagnosticando" |
| Inicio | Tema claro (#F4F6FA) | Mais legivel pra info medica |
| Inicio | Plus Jakarta Sans | Moderna sem ser casual |
| Inicio | Gradiente 120deg green→cyan | Diferencia da concorrencia (azul medico) |
| Inicio | Titulo italico verde | Assinatura visual unica |
| Inicio | Frame 393x852 | Simula iPhone 14/15 (mais comum no BR) |
| Recente | Gemini pra scan de receita | Melhor reconhecimento visual que Claude |
| Recente | Claude Vision pra OCR | Uma dependencia a menos (nao usa Google Cloud Vision) |
| 09/04/2026 | vitae-app-github como pasta ativa | Mais atualizada, sincronizada com GitHub |
| 09/04/2026 | Ignorar frontend/ Next.js | Incompleto (12 telas), design diferente, porta errada |
| 09/04/2026 | Ignorar server/ wearable | Sem credenciais, sem conexao com backend |
| 09/04/2026 | CLAUDE.md como documento vivo | Unico arquivo que o Claude le automaticamente |
| 09/04/2026 | Obsidian pra Lucas consultar | Organizar pensamentos, acompanhar evolucao |
| 09/04/2026 | Atualizar CLAUDE.md toda sessao | Nunca perder contexto entre conversas |

---

## 17. TRANSFERIR PRO OBSIDIAN

> No final de cada sessao, o Claude atualiza este arquivo.
> Lucas pode copiar as secoes atualizadas pro Obsidian:

| Secao deste arquivo | Nota no Obsidian |
|--------------------|-----------------|
| 4. Status Atual | O QUE E VITAE E VITA ID |
| 9. Diario de Sessoes | SESSOES |
| 10. Log de Erros | PROBLEMAS |
| 11. Log de Tentativas | SESSOES |
| 12. Skills Usadas | SESSOES |
| 13. Padroes | DECISOES |
| 14. Anti-padroes | DECISOES |
| 15. Roadmap | ROADMAP |
| 16. Decisoes | DECISOES |

---

## 18. LOCALIZACAO DE TUDO

| O que | Onde |
|-------|------|
| Projeto ativo | d:\vitae-app-github\ |
| Este CLAUDE.md | d:\vitae-app-github\CLAUDE.md |
| Vault Obsidian | C:\Users\win11\OneDrive\Documentos\Obsidian Vault\ |
| Memoria do Claude | C:\Users\win11\.claude\projects\d--\memory\ |
| Backend local | localhost:3002 |
| Backend producao | vitae-app-production.up.railway.app |
| GitHub | vitaehealth2906-ops/vitae-app |
| Design system | vitae-core.css + vitae-glass.css + vitae-light.css |
| API frontend | api.js |
| Mapa de fluxo | mapa-fluxo-completo.html (abrir no navegador) |
| Identidade visual | identidade-visual.html (abrir no navegador) |
| Logo | vitaid-logo.svg |
| Schema banco | backend/prisma/schema.prisma |
| Credenciais | backend/.env (local, NAO sobe pro GitHub) |
