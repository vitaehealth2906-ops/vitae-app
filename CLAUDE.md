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
