# vita id — Documento Central

> Atualizado em: 09/04/2026
> Fundador: Lucas Borelli, 18 anos, Americana-SP
> Status: MVP funcional — 31 telas prontas, backend rodando, 4 arquivos faltando

---

## O que e a vita id?

Um **RG Digital de Saude** para brasileiros. O paciente guarda num lugar so: exames, medicamentos, alergias, consultas, score de saude. O medico consegue ver um resumo do paciente em 1 minuto antes da consulta.

**Origem pessoal:** Lucas foi internado por crise alergica (Dipirona + Penicilina). Nenhum sistema avisou o medico. O vita id nasceu pra resolver isso — seu historico de saude sempre acessivel, em qualquer emergencia.

**Proposta de valor:**
- Para o paciente: "Seu historico de saude inteiro no bolso. Compartilhe com qualquer medico em 1 segundo via QR Code."
- Para o medico: "Saiba tudo do seu paciente em 1 minuto antes da consulta. Sem papel, sem esquecimento."

---

## Identidade da Marca

### Nome
- **vita id** (sempre minusculo)
- "vita" em preto/branco + "id" dentro de caixa com gradiente verde-ciano
- Nunca separar "vita" de "id"

### Tom de Voz
- Institucional serio, como um hospital de referencia
- NAO e startup animada/descolada
- Foco no beneficio, nunca no "como" tecnico
- **NUNCA** mencionar "IA", "AI", "inteligencia artificial" pro usuario
- Usar verbos de acao: "Escanear receita" (nao "a IA le sua receita")
- **ZERO emojis** em qualquer lugar do app

### Cores
| Nome | Hex | Uso |
|------|-----|-----|
| Green (principal) | #00E5A0 | Botoes, destaques, icones ativos |
| Green escuro | #00C47A | Textos de sucesso |
| Cyan (secundaria) | #00B4D8 | Gradiente junto com green |
| Ink (texto) | #0D0F14 | Titulos e texto principal |
| Ink 2 | #4B5563 | Corpo de texto |
| Ink 3 | #6B7280 | Texto secundario |
| Ink 4 (label) | #9CA3AF | Labels, subtitulos |
| Ink 5 (placeholder) | #C4C9D4 | Placeholders, desabilitado |
| Background | #F4F6FA | Fundo geral do app |
| Surface | #FFFFFF | Fundo de cards |
| Sucesso | #00C47A | Exame normal |
| Atencao | #F59E0B | Exame atencao |
| Critico | #EF4444 | Exame critico, erros |
| Info | #3B82F6 | Informacoes neutras |

### Gradientes
- **Marca:** 120deg de #00E5A0 para #00B4D8 (usado em botoes, logo, destaques)
- **Perigo:** 120deg de #EF4444 para #F87171 (botao de excluir)

### Tipografia
- **Fonte unica:** Plus Jakarta Sans
- Pesos usados: 400 (corpo), 500 (input), 600 (labels), 700 (subtitulos), 800 (logo), 900 (titulos de pagina)
- Titulos de pagina: 26px, peso 900, letter-spacing -0.8px
- Palavra-chave do titulo em **italico verde**: "Seus *medicamentos*"
- Labels de secao: 11px, peso 700, uppercase, letter-spacing 1.5px

### Icones
- SVG stroke (nunca fill, nunca emoji, nunca biblioteca de icones)
- stroke-width: 2, stroke-linecap: round, stroke-linejoin: round
- Tamanho padrao: 22x22 na tab bar, 18x18 em badges, 16x16 em fields

### Formato de Tela
- Toda tela renderiza dentro de um "frame de celular": 393x852px, border-radius 52px
- Dynamic Island (notch): 126x34px, centralizada no topo
- Tab bar fixa no fundo: 86px de altura, 5 itens
- Em mobile real (<480px): frame desaparece, tela fica full-screen

---

## Estrutura do App — O que cada tela faz

### Fluxo de Entrada (o usuario abre o app)

```
index.html → redireciona automatico
    ↓
01-splash.html — Tela de abertura (8 segundos de animacao)
    ↓ ja logado? → vai pro perfil
    ↓ nao logado? ↓
00-escolha.html — "Voce e Paciente ou Medico?"
    ↓ paciente              ↓ medico
02-slides-paciente     02-slides-medico
    ↓                       ↓
03-cadastro.html — Criar conta ou fazer login
    ↓ novo paciente    ↓ novo medico    ↓ login
05-quiz.html      20-med-cadastro    08-perfil ou 20-med-dash
    ↓
06-concluido.html — Tela de celebracao
    ↓
08-perfil.html — HOME DO PACIENTE
```

### Hub do Paciente (08-perfil.html)

E a tela principal. De la o paciente acessa tudo:

| Destino | O que faz |
|---------|-----------|
| 09-dados-pessoais | Editar nome, CPF, contato de emergencia |
| 10-score | Ver pontuacao de saude (0-100) |
| 11-exames-lista | Ver todos os exames enviados, enviar novos |
| 15-bioage-sem-dados | Idade biologica (ainda sem dados) |
| 16-medicamentos | Listar, adicionar, escanear receita |
| 17-alergias | Listar, adicionar, escanear |
| 21-qrcode | QR Code pra compartilhar RG da Saude |
| 22-autorizacao | Gerenciar quem ve seus dados |
| 23-agendamentos | Consultas marcadas |
| 30-lembretes | Lembretes de medicamentos |

### Fluxo de Scan (medicamentos e alergias)

```
16-medicamentos ou 17-alergias
    ↓ clicou "Escanear"
26-scan-receita (FALTANDO) — camera ou galeria
    ↓
27-processando (FALTANDO) — tela de loading
    ↓
31-revisao-alergias — revisar o que foi encontrado
    ↓ confirmar
volta pra 17-alergias
```

### Hub do Medico (20-medico-dashboard.html)

| Destino | O que faz |
|---------|-----------|
| 25-summary | Ver resumo de 1 minuto do paciente (gerado por IA) |
| pre-consulta | Formulario que o paciente preenche antes da consulta |
| Templates | Criar perguntas personalizadas pra pre-consulta |

### Telas Publicas (sem login)

| Tela | O que faz |
|------|-----------|
| rg-publico | Versao publica do RG da Saude (acessada via QR) |
| exame-publico | Ver um exame especifico compartilhado |
| termos | Termos de uso |
| lgpd | Politica de privacidade (LGPD) |

### Telas de Senha

| Tela | O que faz |
|------|-----------|
| 14-esqueci-senha | Digitar email pra receber link de reset |
| 15-nova-senha | Definir nova senha via link do email |

---

## O que falta (arquivos que nao existem)

| Arquivo | O que deveria fazer | Quem referencia |
|---------|-------------------|-----------------|
| 26-scan-receita.html | Tela de camera/galeria pra escanear receita | 16-medicamentos, 17-alergias |
| 27-processando.html | Tela de loading enquanto processa o scan | 16-medicamentos, 17-alergias |
| quiz-preconsulta.html | Quiz que paciente responde na pre-consulta | pre-consulta.html |
| 01-login.html | Referenciada no logout do medico | 20-medico-dashboard (botao logout) |

---

## Backend — Como funciona (sem termos tecnicos)

### Onde roda
- **Servidor:** Railway (nuvem) — endereco: vitae-app-production.up.railway.app
- **Banco de dados:** Supabase (PostgreSQL) — guarda todos os dados dos usuarios
- **Arquivos (fotos, PDFs):** Supabase Storage

### O que o servidor faz
| Funcionalidade | Como funciona por tras |
|---------------|----------------------|
| Cadastro e login | Senha criptografada, token de acesso (JWT) de 30 dias |
| Upload de exame | Recebe PDF/foto → Claude le o documento → extrai todos os parametros → calcula score |
| Scan de receita | Recebe foto → Gemini (Google) identifica medicamentos → cruza com alergias do paciente |
| Score de saude | 4 pilares: Sono (20%), Atividade (20%), Produtividade (20%), Exames (40%) |
| Pre-consulta | Medico cria link → paciente preenche → IA gera resumo de 1 minuto |
| Verificacao SMS | Twilio envia codigo de 6 digitos |
| Reset de senha | Resend envia email com link |

### Dados guardados (17 tabelas)
| Tabela | O que guarda |
|--------|-------------|
| Usuario | Nome, email, celular, senha, tipo (paciente/medico), foto |
| PerfilSaude | Genero, nascimento, altura, peso, sangue, CPF, contato emergencia, condicoes |
| Exame | Arquivo, tipo, laboratorio, data, texto extraido, dados estruturados, resumo IA |
| ParametroExame | Nome do exame, valor, unidade, referencia, status (normal/atencao/critico) |
| Medicamento | Nome, dosagem, frequencia, horario, medico prescritor, estoque |
| Alergia | Nome, tipo, gravidade, fonte (manual/scan) |
| HealthScore | Score geral + 4 pilares + idade biologica + confianca |
| CheckinSemanal | Qualidade sono, atividade, humor, dor, produtividade |
| Notificacao | Tipo, titulo, mensagem, se ja foi lida |
| CodigoVerificacao | Celular, codigo, tentativas, expiracao |
| RefreshToken | Token de renovacao de acesso |
| Medico | CRM, UF, especialidade, clinica |
| FormTemplate | Perguntas de pre-consulta personalizadas |
| PreConsulta | Link, respostas do paciente, resumo IA, audio |
| AutorizacaoAcesso | Qual paciente autorizou qual medico, por quanto tempo |
| Agendamento | Titulo, tipo (exame/consulta/retorno), local, data |
| Consentimento | Aceite de termos, LGPD, compartilhamento, processamento |

---

## Arquivos do Projeto — Mapa Completo

### Raiz (d:\vitae-app-github\)

**Telas do app (HTML):**
- 31 telas funcionais do app
- 6 telas internas/dev (mapa-telas, mapa-fluxo-completo, identidade-visual, fluxo-medicamentos-alergias, dashboard-scan, teste-scan, diag-scan)

**Design System (CSS):**
- vitae-core.css — fonte unica de verdade visual (tokens, componentes, animacoes)
- vitae-glass.css — efeito glass (blur, transparencia)
- vitae-light.css — overrides de tema claro (carrega depois do glass)

**Conexao com servidor:**
- api.js — modulo compartilhado por TODAS as telas pra falar com o backend

**Logo:**
- vitaid-logo.svg — logo oficial em SVG

### Pasta backend/
- Servidor Express (porta 3002)
- 16 arquivos de rotas (uma pra cada funcionalidade)
- Servicos: IA (Claude), OCR (Claude Vision), SMS (Twilio), Email (Resend), Storage (Supabase)
- Banco de dados: Prisma + PostgreSQL
- Score engine: calcula os 4 pilares de saude

### Pasta frontend/ (INCOMPLETO — nao usar)
- App Next.js com React (apenas 12 telas)
- Design DIFERENTE do HTML (tema escuro vs claro)
- Porta errada (aponta pra 3001, backend roda na 3002)
- **NAO e o frontend ativo** — as telas HTML sao o frontend real

### Pasta server/ (ABANDONADO)
- Tentativa de integracao com WHOOP e Oura Ring
- Sem credenciais configuradas
- Nao conectado com nada

---

## Problemas Conhecidos

### Criticos
1. **4 telas referenciadas que nao existem** — scan-receita, processando, quiz-preconsulta, login antigo
2. **2 pastas do projeto** — vitae-app-github (ativa) e vitae-app-git (antiga, divergiu). Nao sao duplicatas exatas

### Organizacao
3. **Numeracao confusa** — 15-bioage e 15-nova-senha usam o mesmo numero
4. **6 arquivos de dev soltos** na raiz junto com telas reais
5. **Documentos .md de planejamento** misturados com arquivos do app
6. **Frontend Next.js incompleto** na pasta frontend/ — gera confusao sobre qual e o "real"

### Tecnicos
7. **Porta inconsistente** — backend roda na 3002, Next.js aponta pra 3001
8. **Credenciais no .env** — arquivo existe local com chaves reais (protegido pelo .gitignore, nao sobe pro GitHub)

---

## Regras pra Qualquer IA Trabalhando Neste Projeto

### Obrigatorio
1. Ler vitae-core.css antes de criar qualquer tela nova
2. Seguir o design system existente (cores, fontes, componentes)
3. Usar api.js pra qualquer comunicacao com o backend
4. Tom institucional — como hospital, nao startup
5. ZERO emojis — todos os icones sao SVG stroke
6. NUNCA mencionar "IA" ou "AI" em textos que o usuario vai ver
7. Titulos com palavra-chave em italico verde
8. Testar em 393x852 (frame de celular)

### Proibido
1. Criar telas fora do padrao visual existente
2. Usar bibliotecas de icones (Material Icons, FontAwesome, etc)
3. Adicionar dependencias novas sem aprovacao do Lucas
4. Mexer no frontend Next.js (pasta frontend/) — nao e o ativo
5. Inventar funcionalidades que nao foram pedidas
6. Usar tom casual/descolado/startupeiro

---

## Historico de Decisoes

| Data | Decisao | Por que |
|------|---------|---------|
| Inicio | HTML puro em vez de framework | Velocidade de prototipacao, sem complexidade |
| Inicio | Supabase em vez de Firebase | PostgreSQL + Storage + Auth tudo junto |
| Inicio | Claude API pra leitura de exames | Melhor compreensao de documentos medicos |
| Recente | Gemini pra scan de receita | Melhor reconhecimento visual de medicamentos |
| Recente | JWT com refresh tokens | Seguranca sem forcar re-login a cada sessao |
| 09/04/2026 | Mapa de fluxo visual criado | Organizar projeto antes de crescer |
| 09/04/2026 | Identidade visual documentada | Garantir consistencia nas proximas telas |

---

## Estrutura Sugerida pro Obsidian

Se voce quer organizar tudo no Obsidian, crie estas notas separadas e conecte com [[links]]:

```
vitae/
├── 00-CENTRAL.md          ← esta nota (hub principal)
├── 01-IDENTIDADE.md        ← cores, fontes, regras visuais, tom de voz
├── 02-TELAS.md             ← lista de todas as telas e o que cada uma faz
├── 03-FLUXOS.md            ← como o usuario navega entre as telas
├── 04-BACKEND.md           ← o que o servidor faz, quais servicos usa
├── 05-BANCO-DE-DADOS.md    ← as 17 tabelas e o que cada uma guarda
├── 06-PROBLEMAS.md         ← bugs conhecidos, coisas que faltam
├── 07-REGRAS-IA.md         ← regras pra qualquer IA seguir no projeto
├── 08-DECISOES.md          ← historico de por que cada coisa foi feita assim
├── 09-ROADMAP.md           ← o que falta fazer, prioridades, futuro
└── 10-SESSOES.md           ← log de cada sessao de trabalho (o que foi feito)
```

Cada nota linka pras outras. A nota central (00) e o ponto de entrada.

---

## Contatos e Servicos

| Servico | Pra que | Status |
|---------|---------|--------|
| Railway | Hospeda o servidor | Ativo |
| Supabase | Banco de dados + Storage | Ativo |
| Anthropic (Claude) | Leitura de exames + resumos | Ativo |
| Google (Gemini) | Scan de receitas | Ativo |
| Twilio | SMS de verificacao | Ativo |
| Resend | Email de reset de senha | Ativo |
| GitHub | Codigo fonte | Ativo |
| Vercel | Config existe mas nao confirmado se esta ativo | Verificar |
