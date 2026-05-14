# PLANO MASTER — App Paciente vita id

> **Para:** Lucas Borelli, fundador
> **Data:** 2026-05-14
> **Status:** Plano de implementação completo até produto final funcionando
> **Princípio central:** "JÁ APROVEI O FLUXO, FRONTEND, AGORA PRECISO FAZER FUNCIONAR"
> **Origem:** 4 estudos profundos paralelos (Vault Obsidian · App médico desktop · Backend + banco · 32 telas atuais)

---

## SUMÁRIO EXECUTIVO (leia primeiro)

### O que vamos construir
Um único arquivo HTML (`app.html`) que **substitui** os 32 arquivos atuais espalhados + iframes, espelhando a arquitetura do `desktop/app-v2.html` do médico (que já roda em produção há semanas). Cada uma das 32 telas vira uma `<section>` interna. Estado global em memória. Comunicação com o backend que **já existe e já funciona**. Quando você cadastrar uma conta, vai pro banco de verdade. O médico vê. Você revoga. Médico para de ver.

### Por que assim
- O `desktop/app-v2.html` já provou que dá pra fazer 6446 linhas num arquivo funcionar bem em produção
- O backend já existe (18 grupos de rotas, 17 tabelas, 8 integrações)
- O frontend das 32 telas já existe (todas prontas visualmente)
- O `api.js` real já existe e já funciona (médico usa hoje)
- Restam **2 coisas**: (1) unificar visualmente igual o médico desktop; (2) plugar no backend real em vez do mock

### Tempo realista
- **Fase 1-3 (base + estado + backend):** 1 sessão longa
- **Fase 4-6 (mover conteúdo das 32 telas):** 2-3 sessões longas
- **Fase 7-8 (validação + edge cases):** 1 sessão longa
- **Total estimado:** 4-5 sessões longas

### O que NÃO vamos fazer
- Refazer fluxo (você aprovou)
- Refazer telas (você aprovou)
- Inventar feature nova
- Tocar no app médico
- Tocar no schema do banco
- Polir UI antes de funcionar (princípio "já aprovei o frontend")

---

# PARTE I — Os princípios que governam tudo

## 1. Os 8 princípios absolutos do produto

Cada um tem fonte no vault. Não negociáveis.

| # | Princípio | Por quê |
|---|-----------|---------|
| 1 | **Nunca mencionar "IA", "AI", "algoritmo"** | Paciente tem medo de tecnologia. IA roda invisível. Copy diz "organizado automaticamente". (REGRAS-IA.md) |
| 2 | **Tom institucional — como hospital de referência** | Saúde é série. Zero emoji, zero "que massa". Bernard Arnault/LVMH, não startup casual. (DESING.md, MENTALIDADE-CEO.md) |
| 3 | **Alergia é PROTAGONISTA, nunca detalhe** | Vermelho em TODA tela relevante. Nascido da crise do Lucas (Dipirona+Penicilina). (Historia de Origem.md) |
| 4 | **Banco de dados é sagrado — LGPD inegociável** | Paciente é dono dos dados. Botão de deletar conta + exportar dados precisam funcionar. (Sessão 19 backend tem rotas prontas) |
| 5 | **Zero dark patterns, zero dopamina vazia** | Sem streak punitivo, sem badge sem significado, sem urgência fabricada. Teste: "Se usuário soubesse o que faço, ficaria grato ou enganado?" (PERSUASAO-ETICA.md) |
| 6 | **Design system é lei** | Verde #00E5A0, ciano #00B4D8, Plus Jakarta Sans. Gradiente 120deg green→cyan = assinatura. (DESING.md) |
| 7 | **QR Code é o cinto de segurança em emergência** | Funciona SEM login. Médico escaneia, vê em 1 segundo: sangue + alergias + meds ativos. (Historia de Origem.md) |
| 8 | **Dados fragmentados são o inimigo #1** | 62% dos brasileiros não conseguem acesso à saúde. 20,8% das internações são evitáveis só por falta de contexto. (Jornada do Paciente AS-IS.md) |

## 2. Filosofia "Higher Mind" (HM) do Lucas

> "Cada entrega é 11/10 ou não sai. Se está 3/10, para e refaz." — MENTALIDADE-CEO.md

**1/10 vs 11/10 do Lucas:**

| 1/10 (aceita mediocridade) | 11/10 (First Principles) |
|---|---|
| "App de saúde precisa de X" sem questionar | "Por que MESMO assim?" (Musk) |
| Botão bugado fica pra depois | Bug óbvio = stop everything |
| Copy "show, gostei" | Tom institucional sempre |
| Design pastel genérico | Design que sussurra autoridade |

Exemplos concretos do que é 11/10 no projeto:
- ✅ QR Code: simples, sem login, salva vida — 11/10
- ✅ Tom institucional: cria confiança (ocitocina, neurociência) — 11/10
- ❌ Logout do médico apontando pra tela inexistente — 1/10 (não pode sair assim)

## 3. Sistema dos 3 Modos (Framework de decisão)

Vem de FRAMEWORK-DECISAO.md. **Cada decisão que tomamos ativa 1 dos 3 modos:**

### MODO CONSTRUTOR — "Estou criando algo novo"
Ativa quando: nova feature, nova tela, novo fluxo.

Checklist:
- [ ] Defini o problema: "[USUÁRIO] precisa de [X] porque [Y]"
- [ ] O que já tenho pra começar (bird-in-hand)?
- [ ] Gerei 3+ alternativas antes de escolher
- [ ] Protótipo de baixo custo possível?
- [ ] Como vou medir sucesso?

Regra: **velocidade > perfeição na descoberta**.

### MODO PROTETOR — "Estou decidindo algo arriscado"
Ativa quando: gastar dinheiro, mudar tecnologia, publicar, remover feature.

Checklist:
- [ ] Porta única ou duas mãos? (reversível?)
- [ ] 3 formas de dar errado (inversão)
- [ ] Perda máxima se falhar (affordable loss)
- [ ] Consequências 2º e 3º nível
- [ ] Aos 80 anos, me arrependo? (regret minimization)
- [ ] **VEREDITO: GO / NO-GO / PRECISA MAIS INFO**

Regra: **reversível decide rápido. Irreversível para e analisa.**

### MODO MENTALISTA — "Estou pensando no usuário/copy/UX"
Ativa quando: copy, UX, fluxo, onboarding.

Checklist:
- [ ] Sistema 1 (rápido/emocional) ou 2 (lento/analítico)?
- [ ] Que SENSAÇÃO física essa tela gera?
- [ ] Max 4 itens de info principal (limite cognitivo)
- [ ] Cialdini ético: facilitação ou manipulação?
- [ ] Dark pattern test: "Usuário ficaria grato ou enganado?"

Regra: **se ficaria enganado, NUNCA faz.**

## 4. Persona Maria (a única que importa)

Você confirmou: foco em Maria. Sandra/Pivot familiar enterrados.

**Quem ela é:**
- 45-60 anos, urbana brasileira
- Smartphone que usa no dia a dia
- Tem ou plano de saúde ou SUS
- Provavelmente já tem 1+ doença crônica (diabetes, hipertensão)
- Alergia real que motiva o app (cenário Lucas-Dipirona)

**A dor real:**
- 62% dos brasileiros não procuram atendimento quando precisam — Maria está nesse grupo
- Maria perdeu exames (gaveta, email, portal lab com senha esquecida)
- Maria refez exames (25-40% dos exames brasileiros são repetições por falta de acesso)
- Maria não segue prescrição (<40% dos hipertensos seguem corretamente)
- Maria se automedica (86-90% dos brasileiros)

**O que ela ESPERA do app:**
- Valor IMEDIATO no primeiro uso ("Seu RG da Saúde pronto!")
- Simplicidade extrema (<5 min pro primeiro RG)
- Progresso visível (score que muda, dados que aparecem)
- Controle ("isto é MEU, eu autorizo quem vê")
- Emergência resolvida (QR funciona em 1 segundo)

**O que faz Maria ABANDONAR o app:**
- Onboarding longo demais
- Pede muito dado antes de entregar valor
- Notificações spam
- Design que parece startup casual
- Senha forte com recuperação difícil
- Botão bugado, link quebrado

**Cenários reais (5):**

| # | Quando | O que ela faz | O app responde |
|---|--------|---------------|----------------|
| 1 | Segunda 8h | Abre app, vê score subiu 5 pontos | Sensação "estou melhorando", volta amanhã |
| 2 | Antes de consultar | Tira foto da prescrição antiga | App identifica meds, alerta conflito com alergia |
| 3 | Filha pede pra ver exame | Mostra QR Code | Filha escaneia, vê tudo organizado |
| 4 | **Desmaia na rua (crítico)** | Atendente escaneia QR no celular dela | Em 2s: sangue O+, alérgica Dipirona+Penicilina, toma Losartana → médico não prescreve errado |
| 5 | Médico mandou link de pré-consulta | Responde por áudio em casa | Médico chega na consulta sabendo tudo |

**Frase típica dela:**
> "Aí a gente chega no pronto-socorro e ninguém sabe que a gente é alérgico. Fica uma coisa que você fica com medo, sabe?"

## 5. Linhas vermelhas (NUNCA fazer)

Diretamente do Lucas, do CLAUDE.md, do vault, de incidentes documentados:

1. **NUNCA** mencionar IA/AI/algoritmo na copy do paciente
2. **NUNCA** usar `--accept-data-loss` em migrations (incidente 17/04 destruiu dados reais)
3. **NUNCA** mexer no schema do banco sem alinhamento
4. **NUNCA** abrir 2+ sessões Claude paralelas no mesmo projeto (causa conflito)
5. **NUNCA** tocar no app médico desktop sem autorização explícita
6. **NUNCA** copiar concorrente sem entender POR QUE funciona pra ele
7. **NUNCA** adicionar feature sem saber qual problema resolve
8. **NUNCA** decidir por empolgação (espera 24h em decisões de porta única)
9. **NUNCA** fabricar urgência ("só hoje!", "últimas vagas!") em app de saúde
10. **NUNCA** publicar pro mundo sem teste com 5+ pessoas reais

## 6. Sempre fazer

1. **SEMPRE** testar com pessoa real antes de declarar pronto
2. **SEMPRE** documentar decisão + motivo (CLAUDE.md, vault)
3. **SEMPRE** começar pelo que TEM (bird-in-hand) não pelo que falta
4. **SEMPRE** inverter ("o que faria isso falhar?")
5. **SEMPRE** separar valor claro (testado) de valor percebido (achismo)
6. **SEMPRE** respeitar o usuário (teste Cialdini ético)
7. **SEMPRE** voltar pra empatia (Maria precisa, não "feature X")
8. **SEMPRE** validar fluxo end-to-end (cadastra de verdade, médico vê, revoga, médico para de ver)

---

# PARTE II — Inventário completo do que existe

## 7. Backend (já existe e funciona em produção)

### Stack
- Express.js + Prisma ORM + PostgreSQL Supabase
- Railway hospeda (`https://vitae-app-production.up.railway.app`)
- Local: porta 3002
- Auth: JWT 30 min + Refresh Token 90 dias (rotativo)
- Storage: Supabase Storage (buckets `exames`, `fotos`, `audios` public-read)
- CORS já libera: Vercel produção, GitHub Pages, localhost:3000/3001/3002

### As 18 famílias de rotas (60+ endpoints, todos prontos)

| Grupo | Endpoints principais | Pra quê |
|-------|---------------------|---------|
| **Auth** | cadastro · login · login-social · refresh · esqueci-senha · resetar-senha · deletar-conta | Conta + recuperação |
| **Perfil** | GET/PUT /perfil/me · POST /perfil/foto · POST /perfil/cpf-check | Dados pessoais + foto |
| **Exames** | GET/POST /exames · GET /exames/:id · POST regenerar · DELETE | Upload + análise IA |
| **Medicamentos** | GET/POST · PUT · DELETE · info/:nome | CRUD + info farmacológica |
| **Alergias** | GET/POST · PUT · DELETE | CRUD |
| **Scores** | GET /scores/atual · histórico · POST recalcular | Saúde 0-100 |
| **Check-in** | GET/POST /checkin | Auto-relatório semanal |
| **Notificações** | GET · POST marcar-lida | Lembretes + updates |
| **Autorizações** | POST criar · GET listar · POST revogar · GET dados/:token | Paciente controla acesso |
| **Agendamentos** | CRUD | Consultas marcadas |
| **Consentimentos** | POST upsert · GET status | LGPD aceites rastreáveis |
| **Pré-consulta** | (FORA do app único — fluxo externo) | Coração da integração paciente-médico |
| **Templates** | (FORA — só médico usa) | Perguntas pré-consulta |
| **Médico** | (FORA — só médico usa) | Dashboard impacto |
| **Health** | GET /health | Status servidor |

### Banco — 17 tabelas, todas em produção

**Pra o paciente, 9 tabelas críticas:**

| Tabela | O que guarda |
|--------|--------------|
| `usuarios` | Conta (email, celular, senha hash, tipo PACIENTE/MEDICO) |
| `perfil_saude` | Tipo sanguíneo, altura, peso, gênero, histórico familiar, contato emergência |
| `exames` | Arquivo + status processamento + texto extraído + resumoIA |
| `exame_parametros` | Cada parâmetro do exame (hemoglobina, glicose, etc) classificado NORMAL/ATENÇÃO/CRÍTICO |
| `medicamentos` | Nome, dosagem, frequência, horário, ativo, fonte (manual/scan) |
| `alergias` | Nome, tipo, gravidade LEVE/MODERADA/GRAVE, fonte |
| `health_scores` | Histórico do score 0-100 (4 pilares: sono, atividade, produtividade, exames) |
| `checkins_semanais` | Sono qualidade, atividade física, humor, dor |
| `notificacoes` | Lembretes (90 dias retenção) |

**Tabelas de integração paciente↔médico:**
- `pre_consultas` (link token único, status, respostas, audioUrl, summaryIA)
- `autorizacoes_acesso` (paciente↔médico, categorias, ativo, expiraEm)
- `consentimentos` (LGPD, auditoria de aceites)

### As 8 integrações externas

| Serviço | Pra quê |
|---------|---------|
| **Claude Anthropic** | Lê exames completos, gera summary 1 min de pré-consulta, estrutura anamnese 11 campos |
| **Gemini 2.5 Flash** | Scan visual de receita (excluído do app paciente — mas backend tem) |
| **Whisper OpenAI** | Transcreve áudio da pré-consulta |
| **Twilio** | SMS verificação |
| **Resend** | Email reset senha |
| **Supabase Storage** | Arquivos exames + fotos + áudios |
| **Google Cloud Vision** | OCR de PDFs como fallback |
| **ElevenLabs** | TTS pra summary em áudio (futuro) |

### O `api.js` real (que vamos usar — não o mock)

Localização real: `d:/vitae-app-novo/api.js` (ou disponível em `vitae-app-github-OLD/api.js`).

O que ele faz:
- Auto-detecta local vs produção (URL muda automaticamente)
- Envia JWT em toda requisição autenticada (`Authorization: Bearer <token>`)
- Refresh automático em 401 (transparente pro app)
- Logout final se refresh também falhar
- Sanitização XSS antes de exibir
- Tratamento padrão de erros (400, 401, 403, 404, 409, 413, 422, 500+)
- Retry com backoff exponencial em timeouts

## 8. App médico desktop (modelo de arquitetura)

`desktop/app-v2.html` — 6446 linhas, em produção, validado em cutover (Sessão 18-19).

### Estrutura geral
- **HEAD (1-440):** auth gate + fonts + CSS import + 420 linhas de override
- **BODY (441-700):** estrutura responsiva + 5 placeholders pra abas
- **SCRIPT (701-6443):** estado global + navegação + 20+ renderizadores + integração backend

### Padrões de código (que vamos copiar)

**Navegação central:**
```
goto('hoje')
  ↓ valida view existe
  ↓ STATE.view = 'hoje'
  ↓ chama renderHoje() (renderiza HTML novo)
  ↓ injeta em $('v-container').innerHTML
```

**Estado global em memória:**
- `DR = { /* dados do médico */ }` (no paciente vira `USER = { /* dados do paciente */ }`)
- `STATE = { view, search, filters, ... }`
- `PCS`, `PACIENTES`, `TEMPLATES` (no paciente vira `MEDS`, `ALERGIAS`, `EXAMES`, `CONSULTAS`)

**Comunicação com backend:**
```
var resultado = await window.BACKEND.api('/endpoint', { method: 'POST', body: ... })
```

`window.BACKEND` é exposto pelo `api.js`. Tudo passa por ele.

**Renderizador padrão:**
```
function renderXxx() {
  var html = '<div>...</div>'
  // monta HTML com dados de STATE
  $('v-container').innerHTML = html
}
```

**Fluxo de salvar formulário:**
1. Inputs preenchem `STATE._criarXxx` enquanto digita
2. Clica "Salvar" → valida local (`trim`, `length`, formato)
3. Monta payload JSON
4. POST via `BACKEND.api()`
5. Backend retorna 200 + dados
6. Atualiza estado local
7. Re-renderiza
8. `toast('Salvo')`

### Componentes visuais reutilizáveis (vamos copiar)

| Componente | Onde está | Uso no paciente |
|------------|-----------|-----------------|
| `.btn.btn-p` (primário gradient) | ~300 | Botões CTA |
| `.btn.btn-ghost` (secundário) | ~310 | Ações secundárias |
| `.modal-bg` + `.modal-h` + `.modal-body` + `.modal-foot` | ~1741 | Modais (excluir, confirmar) |
| `.ins-card` (insight com borda lateral) | ~251 | Alertas (alergia + med conflito) |
| `.pct-pill` (filtro chip) | ~203 | Filtros de lista |
| `toast(msg)` (função global) | (em desktop-core.css) | Feedback de ação |
| `.pat-skel` (skeleton shimmer) | ~1844 | Loading states |
| `.player` (player áudio dark) | ~227 | Não usa no paciente (médico ouve) |

### Convenções de naming (vamos manter)

- `render{NOME}()` — renderiza view inteira
- `open{NOME}()` — abre modal
- `salvar/atualizar/deletar{NOME}()` — CRUD
- `goto(view)` — navega
- Variáveis: MAIÚSCULAS pra dados globais, camelCase pra funções, prefixos curtos pra classes (`pcn-`, `pat-`)

## 9. Frontend paciente atual (32 telas — todas existem)

Inventário completo:

| Grupo | Telas | Linhas total |
|-------|-------|--------------|
| Onboarding + Auth (10) | 20-splash, 21-boas, 23-login, 24/25-senha, 26-cadastro, 27-sms, 28-onboarding, 30-quiz, 31-pronto | ~4400 |
| Abas principais (4) | 01-saude, 09-exames, 12-qr, 15-consultas | ~3160 |
| Filhas (10) | 18-perfil, 71-privacidade, 03-meds, 04-det-med, 05-add-med, 06-alergias, 07-det-alergia, 08-add-alergia, 10-det-exame, 16-det-consulta | ~3550 |
| RG público (1) | 14-rg-publico | 505 |
| Estados vazios (5) | 40-44 vazios | ~847 |
| Loading + Erro (2) | 52-loading, 60-offline | 285 |

**Total: 32 telas, ~12750 linhas spread em 32 arquivos.**

### O `app.html` atual (estado real)
- **368 linhas** de wrapper SPA
- **32 sections** com iframes que apontam pros 32 arquivos
- **NÃO é arquivo único de verdade** — é uma fachada
- Lazy loading + hash routing + dev panel funcionam
- Mas cada iframe carrega arquivos independentes → ineficiente, isolado, frágil

### O mock api.js (o que vai sair)
- Finge tudo OK
- Devolve dados fictícios ("Lucas Borelli 12/03/2008")
- Auto-marca quiz como completo em rotas internas
- NÃO conversa com backend real
- **Quando trocarmos pelo api.js real, dados fakes somem**

### Bugs visíveis catalogados
- ✅ Resolvidos nesta sessão: 26-cadastro corrompido (código backend no HTML), pre-consulta antiga, scan receita órfão
- ⚠️ Pendentes:
  - Cada arquivo recarrega fontes/CSS/api.js do zero (ineficiente)
  - localStorage compartilhado mas estado isolado por iframe (bugs sutis de sincronia)
  - Cada tela tem seu próprio phone frame (vai dar conflito ao consolidar)
  - 23-login é só redirect (pode virar lógica do 26-cadastro)
  - 27-sms tela existe mas backend não pede SMS (cadastro já passa direto)

## 10. Design System (tokens fechados)

```
--green:       #00E5A0
--cyan:        #00B4D8
--green-deep:  #00C47A
--ink-1:       #0D0F14 (texto principal)
--ink-2:       #4B5563 (texto corpo)
--ink-3:       #6B7280 (texto secundário)
--ink-4:       #9CA3AF (placeholder)
--bg:          #F4F6FA (fundo)
--surface:     #FFFFFF (cards)
--gradient:    linear-gradient(120deg, #00E5A0 0%, #00B4D8 100%)
--shadow-card: 0 1px 2px rgba(13,15,20,0.04), 0 4px 16px rgba(13,15,20,0.04)
--font:        'Plus Jakarta Sans', system-ui, sans-serif
--radius-sm:   12px
--radius-md:   14px
--radius-lg:   20px
--phone:       393x852px (Dynamic Island 126x34, radius 52)
```

Pesos de fonte: 400 / 500 / 600 / 700 / 800 / 900
Título de página: 26px, peso 900, letter-spacing -0.5px, palavra-chave em itálico verde

---

# PARTE III — Diagnóstico do estado atual (verdade nua)

## 11. O que funciona
- ✅ Os 32 arquivos HTML individuais — todas as telas existem e renderizam
- ✅ Design system consistente em quase todas (Plus Jakarta Sans, cores certas)
- ✅ Mock api.js permite navegar e simular fluxos
- ✅ Mapa de telas (`mapa-v3.html`) com previews
- ✅ Sistema de hash routing no `app.html` (você pode pular pra qualquer tela via `#nome`)
- ✅ Backup do estado atual preservado em `app-galeria.html` e `app-esqueleto.html`
- ✅ Versão produção das telas críticas (cadastro, pre-consulta) está limpa

## 12. O que é fachada (precisa virar real)
- ❌ `app.html` atual = wrapper de iframes, NÃO arquivo único de verdade
- ❌ Mock api.js mente sobre dados (Lucas Borelli fake)
- ❌ Cada iframe tem seu próprio phone frame (duplicação visual)
- ❌ Cada arquivo carrega o api.js do zero (32 instâncias)
- ❌ Estado não é compartilhado entre telas (cada uma vive isolada)

## 13. Gaps reais (o que falta pra ser app de produção)

| Gap | Impacto | Esforço |
|-----|---------|---------|
| Consolidar 32 telas em 1 arquivo de verdade (igual médico) | Crítico — é o pedido principal | Alto (~3 sessões) |
| Trocar mock pelo api.js real | Crítico — sem isso é só protótipo | Médio (1 sessão) |
| Cada botão de fato chamar a rota certa do backend | Crítico — o "fazer funcionar" | Alto (distribuído) |
| Tratamento de erros amigáveis | Alto — UX em falha define produto | Médio |
| Auto-recovery de offline | Médio — Maria pode ficar sem net | Baixo (já tem código no pre-consulta) |
| Validação de formulários em tempo real | Médio — evita frustração | Baixo |
| Compressão de fotos antes de enviar | Médio — backend rejeita >10MB | Baixo (algoritmo existe no quiz) |

## 14. O bug específico que você reportou ("Lucas Borelli fictício")

Causa: o mock `api.js` no app-v3 tem essa linha:

> `setSession({ id: 'mock', nome: 'Lucas Borelli', email: 'lucas@email.com', tipo: 'PACIENTE' })`

Quando paciente cadastra "Maria Silva", o mock IGNORA o que ela digitou e usa "Lucas Borelli" fake. Quando o app pede o nome do paciente (header, perfil, etc), ele lê do localStorage onde o mock gravou fake.

**Solução:** trocar o mock pelo `api.js` real, que vai mandar os dados de verdade pro backend e devolver o que foi gravado. Maria Silva cadastra → backend grava → app lê "Maria Silva". O dado fictício some pra sempre.

---

# PARTE IV — Arquitetura alvo (o destino claro)

## 15. Estrutura do `app.html` final

Vamos copiar a arquitetura do `desktop/app-v2.html` adaptando pro paciente.

```
app.html (~10-12 mil linhas estimadas)
│
├── <head>
│   ├── auth gate (valida JWT + tipo PACIENTE)
│   ├── fontes (Plus Jakarta Sans)
│   ├── CSS tokens (design system completo)
│   ├── CSS componentes (botões, cards, modais, listas, inputs, etc)
│   └── CSS views específicas (cada tela tem seu bloco com prefixo)
│
├── <body>
│   ├── div#v-container (palco central onde renderiza tela ativa)
│   ├── tab bar fixa embaixo (4 abas)
│   ├── div#modals-host (overlay container)
│   └── div#toasts-host (notificações)
│
└── <script>
    ├── ESTADO GLOBAL
    │   ├── USER = { /* dados do paciente logado */ }
    │   ├── STATE = { view, search, filters, foto, audio, etc }
    │   ├── MEDS = [ /* lista de medicamentos */ ]
    │   ├── ALERGIAS = [ /* lista */ ]
    │   ├── EXAMES = [ /* lista */ ]
    │   ├── CONSULTAS = [ /* lista */ ]
    │   ├── SCORE = { atual, historico, idadeBiologica }
    │   ├── NOTIFICACOES = [ ]
    │   └── AUTORIZACOES = [ ]
    │
    ├── NAVEGAÇÃO
    │   ├── goto(view, opts) — função central
    │   ├── voltar() — histórico
    │   ├── bindHash() — URL sync
    │   └── ABA_DA_TELA = { saude: 'saude', meds: 'saude', ... }
    │
    ├── BACKEND (importado do api.js real)
    │   ├── window.BACKEND.api(rota, opts)
    │   ├── auto JWT
    │   ├── auto refresh
    │   └── error handling padrão
    │
    ├── RENDERERS (1 por view)
    │   ├── renderSplash()
    │   ├── renderBoasVindas()
    │   ├── renderLogin() (= cadastro modo login)
    │   ├── renderCadastro()
    │   ├── renderEsqueciSenha()
    │   ├── renderNovaSenha()
    │   ├── renderOnboardingQuiz() (3 slides)
    │   ├── renderQuiz() (7 passos)
    │   ├── renderPronto()
    │   ├── renderSaude() (home)
    │   ├── renderExames() (lista)
    │   ├── renderExameDetalhe()
    │   ├── renderQR()
    │   ├── renderConsultas()
    │   ├── renderConsultaDetalhe()
    │   ├── renderPerfil()
    │   ├── renderPrivacidade()
    │   ├── renderMedicamentos()
    │   ├── renderMedDetalhe()
    │   ├── renderAddMedicamento()
    │   ├── renderAlergias()
    │   ├── renderAlergiaDetalhe()
    │   ├── renderAddAlergia()
    │   ├── renderRGPublico() (visão do médico)
    │   ├── render*Vazia() (5)
    │   ├── renderLoadingHome()
    │   └── renderErroOffline()
    │
    ├── AÇÕES (verbo + objeto)
    │   ├── salvarMedicamento(dados)
    │   ├── deletarMedicamento(id)
    │   ├── salvarAlergia(dados)
    │   ├── uploadExame(arquivo)
    │   ├── compartilharQR()
    │   ├── autorizarMedico(email, categorias)
    │   ├── revogarAutorizacao(id)
    │   ├── fazerLogin(email, senha)
    │   ├── fazerCadastro(dados)
    │   ├── completarQuiz(respostas)
    │   ├── fazerLogout()
    │   ├── recuperarSenha(email)
    │   └── etc
    │
    ├── HELPERS
    │   ├── toast(msg, tipo)
    │   ├── openModal(html, opts)
    │   ├── closeModal()
    │   ├── confirmar(pergunta, callback)
    │   ├── comprimirImagem(file)
    │   ├── validarCPF, validarEmail, validarCelular
    │   ├── formatarData, formatarTelefone
    │   ├── debounce(fn, ms)
    │   └── etc
    │
    └── INIT
        ├── window.addEventListener('hashchange', ...)
        ├── document.addEventListener('DOMContentLoaded', ...)
        ├── carregarDadosIniciais()
        └── irPara(telaInicial)
```

## 16. Estado global centralizado

```
USER:
  id, nome, email, celular, fotoUrl, tipo,
  perfilSaude: {
    dataNascimento, tipoSanguineo, alturaCm, pesoKg, genero, cpf,
    contatoEmergenciaTel, contatoEmergenciaNome,
    historicoFamiliar, condicoesCronicas
  }

STATE:
  view: 'saude',           // tela ativa
  viewAnterior: 'splash',   // pra voltar
  search: { meds:'', alergias:'', exames:'' },
  filters: { exames:'all', consultas:'proximas' },
  quiz: { passo:1, respostas:{} },  // estado parcial do quiz
  upload: { file:null, progresso:0 },
  online: true,
  loading: false,
  modalAberto: null

MEDS:
  [ { id, nome, dosagem, frequencia, horario, motivo, ativo, fonte, dataInicio, dataFim }, ... ]

ALERGIAS:
  [ { id, nome, tipo, gravidade, fonte, observacoes }, ... ]

EXAMES:
  [ { id, tipoExame, dataExame, laboratorio, status, resumoIA, parametros:[], scoreContribuicao }, ... ]

CONSULTAS:
  [ { id, titulo, tipo, local, medico, dataHora, lembrete }, ... ]

SCORE:
  { atual:72, sono:80, atividade:60, produtividade:75, exames:65,
    idadeBiologica:32.5, idadeCronologica:25, confianca:'alta',
    historico:[{score:65,data:'2026-04-01'},...] }

AUTORIZACOES:
  [ { id, medicoNome, medicoEmail, categorias:[], ativo, expiraEm, criadoEm }, ... ]

NOTIFICACOES:
  [ { id, tipo, titulo, mensagem, lida, enviadaEm }, ... ]
```

## 17. Sistema de navegação

| Tipo | Como |
|------|------|
| Entre views | `goto('nome-view')` |
| Voltar | `voltar()` (pop histórico) |
| URL direta | `#nome-view` (hash routing) |
| Tab bar | Botão de cada aba chama `goto(...)` |
| Modal | `openModal({ titulo, body, acoes })` |
| Sheet bottom | `openSheet({ ... })` |

`goto()` faz:
1. Valida que view existe
2. Push em STATE.viewAnterior
3. STATE.view = nova
4. Chama renderer correspondente
5. Atualiza tab bar (aba acesa)
6. Atualiza hash da URL
7. Scroll top

## 18. Camada de backend (api.js real)

Substitui completamente o mock. Funcionalidades:

- Auto-detect URL (localhost:3002 dev, Railway produção)
- `BACKEND.api(rota, opts)` — fetch genérico autenticado
- Refresh automático em 401
- Logout final se refresh falha
- Sanitização XSS
- Tratamento padrão por status code
- Timeout com retry exponencial (1s, 2s, 4s)

Cada renderer chama `BACKEND.algumaAcao()` que retorna dados → atualiza estado → re-renderiza.

## 19. Sistema de erros, loading, vazio

Padrões consistentes:

**Loading:**
- Skeleton shimmer enquanto fetch roda
- `STATE.loading = true` → renderer mostra skeleton
- Quando dados chegam: `STATE.loading = false` + re-render

**Vazio:**
- Cada lista (meds, alergias, exames) tem estado vazio
- Vazio = empty state com ilustração + CTA "Adicionar primeiro"

**Erro:**
- Toast vermelho com mensagem amigável
- Banner persistente se erro crítico (offline, servidor)
- Mensagens traduzidas pra PT-BR (do dicionário do `auth-errors.js`)

## 20. Sistema de validação

**Tempo real (inputs):**
- Email: regex + visual (verde se válido, cinza se vazio, vermelho se inválido)
- Celular: máscara (XX) XXXXX-XXXX + validação 11 dígitos
- CPF: máscara XXX.XXX.XXX-XX + validador de dígitos
- Senha: medidor de força (4 barras), 4 regras visuais

**Submit:**
- Antes de chamar backend, valida tudo
- Se falha: foca no primeiro campo errado + toast
- Se OK: chama backend
- Backend pode rejeitar (409 email duplicado, 422 fora de regra) → toast traduzido

---

# PARTE V — Mapa tela por tela (32 telas)

Pra cada tela, o que precisa funcionar de verdade quando consolidarmos.

## Grupo A — Onboarding + Autenticação (10 telas)

### 20 — Splash
- **Função:** Decidir pra onde mandar baseado em estado
- **Lógica:** Se logado + tem RG → home. Se logado + sem RG → quiz. Não logado → cadastro.
- **Backend:** GET `/perfil/me` pra checar se tem RG
- **Estados:** Animação 8s + curtain de saída
- **Erro tratamento:** Se backend offline, ainda assim ir pra cadastro (não trava)

### 21 — Boas-vindas (3 slides)
- **Função:** Introduzir vita id com 3 slides (problema → solução → benefícios)
- **Backend:** Nenhum
- **Ações:** "Próximo" entre slides, "Pular" pra cadastro
- **Estados:** Swipe, dots, animação entre slides

### 23 — Login
- **Função:** Hoje só redireciona. Vai virar entrada do modo login do cadastro.
- **Backend:** Nenhum direto (cadastro faz)

### 24 — Esqueci senha
- **Função:** Email → backend manda link
- **Backend:** POST `/auth/esqueci-senha` com `{email}`
- **Estados:** Vazio → enviando → enviado (tela de sucesso)
- **Erro:** 404 (email não existe) → mensagem "Se o email existir, link foi enviado" (não revela)

### 25 — Nova senha
- **Função:** Receber token do email + criar nova senha
- **Backend:** POST `/auth/resetar-senha` com `{token, novaSenha}`
- **Validação:** Medidor de força + 4 regras (8 chars, maiúscula+minúscula, número, símbolo)
- **Erro:** 400 token inválido → "Link expirado, peça outro"

### 26 — Cadastro / Login (unificado)
- **Função:** Toggle entre criar conta e entrar
- **Backend cadastro:** POST `/auth/cadastro` com `{nome, email, celular, senha}` → retorna `{token, refreshToken, usuario}`
- **Backend login:** POST `/auth/login` com `{email, senha}` → mesmo retorno
- **Backend Google:** POST `/auth/login-social` com `{provider, providerToken, nome, email}`
- **Erro:** 409 email duplicado → "Já existe conta · entrar?" (com botão pra toggle)
- **Validação:** email regex, celular 11 dígitos, senha mínima 8 chars, termos aceitos
- **Após sucesso:** salva token, vai pra 28-onboarding (se cadastro) ou 01-saude (se login)

### 27 — SMS
- **Função:** Verificar SMS de 6 dígitos (LEGADO — cadastro não pede mais)
- **Decisão:** Manter por enquanto, fluxo passa direto (próximo botão sem digitar)
- **Backend:** Nenhum no fluxo atual

### 28 — Onboarding pós-cadastro
- **Função:** 3 slides explicando o quiz que vem a seguir
- **Backend:** Nenhum
- **Ações:** Swipe + "Criar meu RG da Saúde →"
- **Após:** Vai pra 30-quiz

### 30 — Quiz vita id (7 passos)
- **Função:** Coletar dados do RG da Saúde
- **Passos:** Saúde geral · Contato emergência · Alergias · Medicamentos · Exames · Foto · Conclusão
- **Backend:** PUT `/perfil/me` com dados consolidados + POST `/perfil/foto` (foto)
- **Salvar parcial:** localStorage a cada passo (não perde se fechar)
- **Validação:** Cada passo tem validação própria
- **Após:** Marca `vitae_quiz_completo='1'` → vai pra 31-pronto

### 31 — Pronto!
- **Função:** Celebração visual + redirect automático
- **Backend:** Nenhum (só lê estado)
- **Animação:** Check com confetti, glow pulsante
- **Após 5s:** vai pra 01-saude

## Grupo B — Abas principais (4 telas)

### 01 — Saúde (HOME)
- **Função:** Hub central. Mostra RG + cartões de meds/alergias/exames/score
- **Backend (paralelo):**
  - GET `/perfil/me` (dados RG)
  - GET `/medicamentos?ativo=true` (lista meds ativos)
  - GET `/alergias` (lista alergias)
  - GET `/scores/atual` (score)
  - GET `/exames?limit=3` (3 últimos exames)
- **Carrega via:** Promise.all (paralelo)
- **Estados:** Loading skeleton → dados ou vazio
- **Componentes:** Cartão RG hero, lista compacta de meds, alergias em pills, score visual, atalhos
- **Ações:** Click em cada cartão → navega pra tela detalhada

### 09 — Exames (lista)
- **Função:** Histórico de exames + upload
- **Backend:** GET `/exames` → lista filtrável
- **Filtros:** Todos / Alterados / Normais / Em leitura
- **Ações:** Click no exame → 10-exame-detalhe. Botão "+" → upload
- **Upload:** Câmera/galeria/PDF → comprime → POST `/exames`
- **Estados:** Lista + skeleton + vazio (43-exames-vazia)

### 12 — QR Code
- **Função:** Gerar QR Code do RG digital
- **Backend:** POST `/autorizacao/criar` com `{categorias:['perfil','alergias','medicamentos']}` → retorna token
- **Componente:** QR Code SVG gerado com lib do navegador
- **Ações:** "Compartilhar" → Web Share API ou copia link. "Ver o que médico vê" → 14-rg-publico
- **Estados:** Loading → QR pronto

### 15 — Consultas
- **Função:** Próximas consultas + histórico
- **Backend:** GET `/agendamento`
- **Filtros:** Próximas / Histórico
- **Estados:** Lista + vazio (44-consultas-vazia)

## Grupo C — Telas filhas (10 telas)

### 18 — Meu Perfil
- **Função:** Dados pessoais + foto + dados saúde + ações
- **Backend:** GET `/perfil/me` (load) · PUT `/perfil/me` (editar)
- **Foto:** POST `/perfil/foto` com FormData
- **Validações:** Mesmas do cadastro
- **Ações:** Editar campo → modal inline ou tela cheia → salvar
- **Logout:** `fazerLogout()` → limpa token → splash
- **Apagar conta:** DELETE `/auth/deletar-conta` → janela 30 dias

### 71 — Privacidade
- **Função:** Gerenciar autorizações de médicos
- **Backend:** GET `/autorizacao/listar` · POST `/autorizacao/criar` · POST `/autorizacao/:id/revogar`
- **Componentes:** Lista de médicos autorizados + categorias + data + botão revogar

### 03 — Medicamentos (lista)
- **Função:** Meds ativos e descontinuados
- **Backend:** GET `/medicamentos`
- **Filtros:** Ativos / Descontinuados
- **Ações:** Click → 04-detalhe. "+" → 05-add
- **Cruzamento:** Cada med checa se conflita com alergia → badge vermelho

### 04 — Detalhe do medicamento
- **Função:** Nome, dosagem, horário, motivo, prescritor, datas
- **Backend:** Não chama (já tem em STATE.MEDS)
- **Ações:** "Editar" → 05-add (modo edit). "Excluir" → confirma → DELETE

### 05 — Add/editar medicamento
- **Função:** Formulário manual
- **Backend:** POST `/medicamentos` (novo) · PUT `/medicamentos/:id` (editar)
- **Validações:** Nome obrigatório, frequência válida
- **Sucesso:** Toast + back pra lista

### 06 — Alergias (lista)
- **Função:** Lista por gravidade
- **Backend:** GET `/alergias`
- **Visual:** Pills com cor por gravidade (vermelho/laranja/amarelo)
- **Ações:** Click → 07-detalhe. "+" → 08-add

### 07 — Detalhe da alergia
- **Função:** Reação, gravidade, observações
- **Backend:** Não chama (já em STATE.ALERGIAS)
- **Cruzamento:** Lista medicamentos ativos da mesma classe (alerta)

### 08 — Add/editar alergia
- **Função:** Formulário
- **Backend:** POST `/alergias` · PUT `/alergias/:id`
- **Validações:** Nome único (não duplica), gravidade selecionada

### 10 — Detalhe do exame
- **Função:** Parâmetros + análise IA
- **Backend:** GET `/exames/:id` (carrega completo com parametros)
- **Componentes:** Hero, action items (NORMAL/ATENÇÃO/CRÍTICO), timeline, parametros
- **Ações:** "Regenerar análise" → POST `/exames/:id/regenerar`. "Excluir" → DELETE.

### 16 — Detalhe da consulta
- **Função:** Médico, data, queixa, receita, retorno
- **Backend:** Já em STATE.CONSULTAS

## Grupo D — Estados (8 telas)

### 14 — RG público
- **Função:** Visão do médico ao escanear QR
- **Backend:** GET `/autorizacao/dados/:token` (público, sem auth)
- **Visual:** Sangue gigante, alergias vermelho no topo, meds ativos, exames recentes

### 40-44 — Estados vazios
- **Função:** Quando lista está vazia, mostra ilustração + CTA
- **Backend:** Nenhum
- **Disparo:** Renderer detecta `lista.length === 0` → mostra estado vazio em vez de lista

### 52 — Loading home
- **Função:** Skeleton enquanto carrega dados iniciais
- **Disparo:** STATE.loading = true (durante Promise.all do home)

### 60 — Erro offline
- **Função:** Banner persistente quando `!navigator.onLine`
- **Detecção:** `window.addEventListener('online'/'offline')`
- **Ações:** Botão "Tentar de novo" → re-tenta última operação

---

# PARTE VI — 10 fluxos end-to-end

## Fluxo 1: Paciente novo
splash → boas-vindas → cadastro → onboarding-quiz → quiz (7 passos) → pronto → home

## Fluxo 2: Login retorno
splash → home (direto, se token válido)

## Fluxo 3: Esqueci senha
cadastro → esqueci → email → link → nova-senha → cadastro (modo login)

## Fluxo 4: Adicionar medicamento
home → tab Saúde → seção meds → "+" → 05-add → salva → volta lista

## Fluxo 5: Adicionar alergia
home → tab Saúde → seção alergias → "+" → 08-add → salva → cruzamento auto com meds

## Fluxo 6: Enviar exame
home → tab Exames → "+" → câmera/galeria → comprime → upload → status PROCESSANDO → polling → CONCLUIDO

## Fluxo 7: Compartilhar QR
home → tab QR → gera token → Web Share API ou copy

## Fluxo 8: Autorizar médico
home → header → privacidade → "+" autorização → email do médico → categorias → salva → médico ganha acesso

## Fluxo 9: Revogar acesso
privacidade → médico na lista → "Revogar" → confirma → médico perde acesso instantâneo

## Fluxo 10: Receber link pré-consulta (EXTERNO)
WhatsApp do médico → clique no link → `pre-consulta.html` (FORA do app único) → cadastro/login se preciso → quiz se primeira vez → onboarding-pc → grava áudio → envia → médico vê

---

# PARTE VII — Regras de design visual (resumo)

## Componentes core

| Componente | Specs |
|------------|-------|
| Botão primário | gradient 120deg, peso 700, padding 16x14, radius 14, shadow green-glow |
| Botão secundário | fundo branco, borda 1px rgba(0,0,0,0.08), radius 14 |
| Botão ghost | transparente, borda dashed |
| Card | fundo branco, radius 14-16, shadow leve, padding 18-22 |
| Input | padding 14x16, borda 1.5px rgba(0,0,0,0.07), radius 12-14, focus green+glow |
| Pill | radius 100px, padding 4x10, peso 700 |
| Toast | fundo #0D0F14, texto branco, radius 14, bottom 100px, fade-in 0.2s |
| Modal | overlay backdrop-filter blur(20px), tinta escura rgba(13,15,20,0.45) |
| Phone frame | 393x852, radius 52, Dynamic Island 126x34 black, sombra dupla |

## Estados interativos

- **Hover** (desktop): transform translateY(-1px) + shadow elevation
- **Active**: scale(0.98)
- **Focus**: borda verde + glow rgba(0,229,160,0.10)
- **Disabled**: opacity 0.4, cursor not-allowed

## Animações

- **Transição entre telas**: fadeUp 0.4s ease
- **Loading skeleton**: shimmer 1.4s infinite
- **Modal aparecer**: fadeM 0.2s
- **Botão tap**: 0.15s
- **Toast**: 3s + fade

---

# PARTE VIII — Casos extremos (30 cenários mapeados)

| # | Cenário | Tratamento |
|---|---------|-----------|
| 1 | Email já cadastrado | Toast "esse email já existe · entrar?" + botão pra toggle |
| 2 | Senha errada | "email ou senha incorretos" (genérico, sem dar dica) |
| 3 | Token JWT expira no meio do uso | Refresh automático invisível |
| 4 | Refresh token também expirou | Logout + redirect pra cadastro mantendo estado |
| 5 | Sem internet | Banner "sem internet" + dados não se perdem |
| 6 | Servidor caiu (5xx) | Toast vermelho "tente em alguns segundos" |
| 7 | Foto >10MB | Comprime antes (1200px, JPEG 0.75) · se mesmo assim rejeitar, pede outra |
| 8 | Alergia conflita com med ativo | Alerta vermelho destacado · não bloqueia |
| 9 | Quiz abandonado no meio | localStorage salva · reabre "continuar de onde parou" |
| 10 | Médico revogou acesso depois | App não mostra (filtro backend) |
| 11 | CPF inválido | Validação inline mostrando dígitos errados |
| 12 | Celular fora do formato | Máscara automática + validação |
| 13 | Senha fraca | Medidor visual + 4 regras checklist |
| 14 | Upload de arquivo não suportado | Aceita só JPG/PNG/PDF/HEIC |
| 15 | Exame processando >5min | Status "Demorando mais que o normal · tente regenerar" |
| 16 | Exame deu erro de IA | Status ERRO + botão "Tentar de novo" |
| 17 | Two-tabs concurrent edit | Conflict resolution: última gravação vence (warning sutil) |
| 18 | Conexão lenta | Skeleton + timeout 30s + retry exponencial |
| 19 | Logout em outra aba | App detecta token removido e redireciona |
| 20 | Dados corrompidos no localStorage | Validação ao carregar · se corrupto, limpa e reinicia |
| 21 | Backend retorna formato diferente do esperado | Schema validation + fallback gracioso |
| 22 | Push notification negada | Não insiste · banner com explicação opcional |
| 23 | Câmera negada (foto perfil) | Fallback pra galeria + tutorial pra liberar |
| 24 | Arquivo de áudio corrompido (pre-consulta) | Detecta + pede pra gravar de novo |
| 25 | Web Share API não disponível | Fallback pra copy link |
| 26 | Modo navegação anônima/incognito | localStorage limitado · funciona mas avisa |
| 27 | Browser muito antigo (sem ES6) | Detecta + mostra "atualize o navegador" |
| 28 | LGPD: paciente pede pra apagar conta | DELETE + janela 30 dias + email confirmação |
| 29 | LGPD: paciente pede exportar dados | GET ZIP em formato JSON/CSV |
| 30 | Idade do paciente <13 (menor) | Bloqueia · "precisa ter 13+ anos" |

---

# PARTE IX — Plano de implementação (8 fases)

## Fase 1 — Esqueleto base + design system inline (sessão 1, ~3-4h)

**Objetivo:** `app.html` virou um arquivo único com phone frame, tab bar, painel dev, sistema de navegação. Sem conteúdo das 32 telas ainda — só placeholder.

**Saídas:**
- HEAD completo com fontes, design tokens, CSS de componentes core (botão, card, input, modal, toast)
- BODY com `#v-container` + tab bar + modal host + toast host
- SCRIPT com `STATE`, `goto()`, `voltar()`, `toast()`, `openModal()`, hash routing
- Validar: hash funciona, tab bar troca, modal abre/fecha, toast aparece

**Critério de pronto:** Você abre `app.html`, ele renderiza phone frame em fundo escuro. Clica nas tabs, troca de placeholder. Tecla `D` mostra DEV panel.

## Fase 2 — Backend real plugado (sessão 1, ~1-2h)

**Objetivo:** O mock api.js sai. O api.js real entra. Conexão com Railway válida.

**Saídas:**
- `api.js` real embutido ou linkado no head
- Auto-detect URL funciona
- JWT lido do localStorage, enviado em toda req
- Refresh automático testado
- `BACKEND.api()` exposto globalmente
- Tradução de erros em PT-BR (do `auth-errors.js`)

**Critério de pronto:** Console do navegador mostra requisições reais pro Railway. Login com email existente funciona (você cadastra direto via cURL primeiro pra testar).

## Fase 3 — Onboarding + Auth funcional (sessão 2, ~3-4h)

**Objetivo:** O fluxo completo de cadastro/login funciona de verdade. Dados vão pro banco. Quiz salva.

**Saídas:**
- `renderSplash()`, `renderBoasVindas()`, `renderCadastro()`, `renderEsqueciSenha()`, `renderNovaSenha()`
- `renderOnboardingQuiz()`, `renderQuiz()` (7 passos), `renderPronto()`
- Salvar parcial do quiz em localStorage
- Foto sobe pro Supabase via `/perfil/foto`
- Após quiz, paciente tem RG real

**Critério de pronto:** Você cadastra uma conta com seu email real, faz o quiz inteiro, e os dados aparecem no banco (Railway logs ou Supabase Dashboard).

## Fase 4 — 4 abas principais (sessão 2-3, ~3-4h)

**Objetivo:** Saúde, Exames, QR, Consultas funcionando com dados reais.

**Saídas:**
- `renderSaude()` — carrega 5 endpoints em paralelo, monta hub
- `renderExames()` — lista + upload + filtros
- `renderQR()` — gera token + QR Code visual
- `renderConsultas()` — lista + filtros

**Critério de pronto:** Você faz login no app, vê seus dados reais nas 4 abas.

## Fase 5 — Filhas + Cruzamentos (sessão 3, ~3-4h)

**Objetivo:** Detalhes + Adicionar + Editar + Cruzamentos paciente-med-alergia.

**Saídas:**
- 10 renderers de telas filhas
- Cruzamento automático: med adicionada vs alergia → badge vermelho
- Validações tempo real
- Toast de sucesso/erro

**Critério de pronto:** Você adiciona "Dipirona" como medicamento E "Dipirona" como alergia → app mostra alerta vermelho.

## Fase 6 — Estados (vazios, loading, erro) + RG público (sessão 3-4, ~2-3h)

**Objetivo:** Cada estado raro funciona bonito.

**Saídas:**
- 5 telas vazias renderizadas quando lista vazia
- Skeleton durante todos os loadings
- Banner offline persistente
- 14-rg-publico funciona com token público (sem auth)

**Critério de pronto:** Você cria conta nova, vê estados vazios corretamente. Desliga wi-fi, vê banner. Liga e o banner some automático.

## Fase 7 — Casos extremos (sessão 4, ~2-3h)

**Objetivo:** Os 30 cenários da Parte VIII todos cobertos.

**Saídas:**
- Cada cenário tem código de tratamento
- Mensagens de erro amigáveis traduzidas
- Auto-recovery onde possível
- Fallbacks pra features não suportadas

**Critério de pronto:** Você tenta cadastrar com email já existente → mensagem amigável. Tenta uploar PDF de 50MB → comprime ou rejeita educadamente.

## Fase 8 — Validação end-to-end (sessão 4-5, ~2-3h)

**Objetivo:** Tudo funciona junto. Médico vê paciente. Paciente revoga. Médico para de ver.

**Saídas:**
- Você cadastra conta real
- Adiciona 1 med, 1 alergia, 1 exame
- Cria autorização pra médico (que é você logado no desktop em outra aba)
- Médico vê tudo
- Paciente revoga
- Médico para de ver

**Critério de pronto:** Cenário ponta-a-ponta funciona. Pronto pra betatester.

---

# PARTE X — Validação com skills de teste

Quando chegar nas Fases 4-8, vou usar Playwright pra validar fluxos críticos:

| Fluxo | Como testar |
|-------|-------------|
| Cadastro → quiz → home | Playwright preenche form, clica "criar conta", percorre quiz, espera home aparecer |
| Adicionar medicamento | Playwright entra em meds, abre "+", preenche, salva, verifica que apareceu na lista |
| Cruzamento alergia-med | Adiciona Dipirona como med E alergia → checa que alerta vermelho aparece |
| Upload exame | Anexa arquivo de teste, espera status mudar de PROCESSANDO pra CONCLUIDO |
| Compartilhar QR | Gera QR, abre rg-publico em outra aba/iframe, verifica dados aparecerem |
| Revogar acesso | Cria autorização, revoga, verifica que segundo cliente perdeu acesso |

Vou também tirar **prints** comparando:
- App paciente novo vs app antigo (lado a lado)
- Cada tela em mobile vs desktop
- Estados vazios vs com dados
- Modais e toasts em ação

---

# PARTE XI — Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| CORS bloqueando localhost do app | Alta | Alto | Validar URLs antes de começar. Adicionar se preciso. |
| Refresh token logic do api.js real não funcionar bem | Média | Alto | Testar refresh isolado antes de plugar tudo |
| Cada tela usa estilos conflitantes (mesmas classes) | Alta | Médio | Prefixar TUDO com `t-NOME-` ao mover. Trabalho mecânico mas necessário. |
| Backend Railway tiver downtime | Baixa | Alto | Plano B: continuar com mock até voltar, sem perder progresso |
| Arquivo final muito grande (>15k linhas) | Baixa | Médio | Comentários separadores ASCII + índice no topo |
| Você mudar de ideia no meio | Média | Médio | Cada fase é independente. Para no fim de uma fase, retoma na seguinte. |
| Algum endpoint do backend retornar formato diferente do esperado | Média | Alto | Schema validation + log + fallback gracioso |
| Mock tinha lógica que não existe no real | Alta | Médio | Mapear caso a caso quando aparecer. Não tratar como bug, é diferença. |

---

# PARTE XII — Definição de pronto (checklist final)

App paciente está pronto quando TODOS esses critérios passam:

### Funcionalidade
- [ ] Cadastro real funciona (dados vão pro banco)
- [ ] Login real funciona (dados vêm do banco)
- [ ] Quiz salva no banco e marca RG completo
- [ ] Foto sobe pro Supabase
- [ ] Medicamentos: CRUD completo via API real
- [ ] Alergias: CRUD completo via API real
- [ ] Exames: upload + análise IA + visualização
- [ ] Score atual carrega e mostra
- [ ] QR Code gera e leva pra rg-publico
- [ ] Autorização cria e revoga
- [ ] Logout limpa tudo
- [ ] Esqueci senha funciona ponta-a-ponta

### Qualidade
- [ ] Zero menção a "IA" na copy
- [ ] Tom institucional consistente
- [ ] Design system aplicado
- [ ] Alergia em vermelho em toda tela relevante
- [ ] Mobile responsivo (sem phone frame em <480px)
- [ ] Loading skeleton em toda operação async
- [ ] Toast de feedback em toda ação

### Casos extremos
- [ ] 30 cenários da Parte VIII todos tratados
- [ ] Offline detectado e tratado
- [ ] Token expirado refresh automático
- [ ] Erros traduzidos em PT-BR

### Integração
- [ ] Médico no desktop vê paciente recém-cadastrado
- [ ] Paciente revoga, médico perde acesso
- [ ] Pré-consulta link funciona (fluxo externo separado)
- [ ] LGPD: apagar conta + exportar dados visíveis

### Performance
- [ ] App carrega <2s
- [ ] Trocar entre abas <100ms
- [ ] Fetch de home <1s

### Validação
- [ ] Playwright passa em fluxos críticos
- [ ] Prints visuais comparativos OK
- [ ] Testado manualmente em 2+ navegadores (Chrome, Edge)
- [ ] Testado em mobile real (iPhone Safari, Android Chrome)

---

# Próximo passo concreto

Quando você aprovar este plano:

1. Eu começo pela **Fase 1** (esqueleto base) — ~3h
2. Reporto pra você abrir e testar
3. Sigo pra **Fase 2** (backend real) — ~1-2h
4. Reporto pra você abrir e cadastrar uma conta real
5. Continuo até a Fase 8 sem te interromper

**Em cada fase concluída:** te aviso "pode testar X" → você abre, testa, aponta o que ver torto → corrijo antes de avançar.

**Não vou pedir permissão pra cada subfase.** Você autorizou execução autônoma.

**Vou parar e te perguntar SE:** descobrir algo no backend que muda escopo, descobrir bug crítico que precisa decisão sua, ou se ficar travado tecnicamente.

---

# Apêndice — Origens das informações

| Fonte | O que veio dela |
|-------|-----------------|
| Vault Obsidian (`C:\Users\win11\OneDrive\Documentos\Obsidian Vault\`) | Princípios, persona Maria, filosofia HM, 3 modos de decisão, erros documentados, regras de copy, roadmap |
| `desktop/app-v2.html` (6446 linhas) | Modelo de arquitetura SPA — vamos copiar essa estrutura |
| Backend (`d:\vitae-app-novo\backend\`) | 18 grupos de rotas, schema do banco, services, integrações |
| `api.js` real | Cliente de produção que vamos usar (substitui o mock) |
| 32 arquivos HTML do paciente | Conteúdo visual de cada tela (vai pra dentro do app.html) |
| CLAUDE.md | Documento vivo com histórico de 23 sessões |
| Memória persistente em `C:\Users\win11\.claude\projects\d--\memory\` | Decisões, contexto, padrões |

---

**Status:** Plano completo. Aguardando seu OK pra começar Fase 1.
