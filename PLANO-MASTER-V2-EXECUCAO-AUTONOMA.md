# PLANO MASTER V2 — Execução Autônoma do App Paciente

> **Para:** Lucas Borelli, fundador
> **Data:** 2026-05-14
> **Modo:** Execução autônoma total · sem pedir permissão · sem perguntas
> **Princípio:** "JÁ APROVEI O FLUXO, FRONTEND. AGORA PRECISO FAZER FUNCIONAR."
> **Compromisso:** Lucas vai sair, voltar, e tudo estará feito e validado.

---

## SUMÁRIO PRO LUCAS (em PT-BR claro, sem código)

Você aprovou o frontend (32 telas), aprovou o fluxo, aprovou o backend (que já existe). Agora o trabalho é:

1. **Consolidar** as 32 telas num único arquivo de verdade (igual o app do médico que já funciona em produção)
2. **Plugar no servidor real** (não mais mock que mente sobre dados)
3. **Cada botão, cada ação, cada redirect** funciona de verdade
4. **Validar tudo** com testes automatizados (robô abrindo o app e clicando)
5. **Agente revisor por trás** confere se respeita princípios + arquitetura + design system

**Eu executo sozinho.** Você vai sair. Quando voltar, ou está tudo pronto, ou tenho um relatório honesto do que faltou (com motivo).

**Não te pergunto nada.** Decido sozinho dentro dos princípios do plano. Se descobrir bug crítico que pode quebrar dados reais, paro e te conto.

---

# PARTE 1 — Princípios inegociáveis (idênticos ao V1)

São 8 leis tiradas do Vault Obsidian:

1. **Nunca mencionar "IA"** na copy do paciente (Maria tem medo de tecnologia)
2. **Tom institucional sério** (hospital de referência, nunca startup casual)
3. **Alergia é protagonista vermelho** em toda tela relevante (Lucas-Dipirona)
4. **Banco de dados é sagrado** (incidente 17/04 não pode se repetir)
5. **Zero dark patterns** (teste Cialdini: "ficaria grato ou enganado?")
6. **Design system fechado** (verde #00E5A0, ciano #00B4D8, Plus Jakarta Sans, gradient 120°)
7. **QR Code é cinto de segurança** (sem login, salva vida em emergência)
8. **Dados fragmentados são inimigo #1** (62% dos brasileiros não acessam saúde)

**E mais 4 princípios de execução** (novos pro V2):

9. **Não refazer nada que já existe** (bird-in-hand: backend, design system, 32 telas, app médico)
10. **Não tocar no app médico** (intocável)
11. **Não tocar no schema do banco** (preserva dados)
12. **Não inventar feature nova** (escopo fechado nas 32 telas aprovadas)

---

# PARTE 2 — Estado atual

## O que JÁ FUNCIONA (não vou refazer)

- **Servidor central** (Railway) com 60 serviços prontos
- **17 gavetas do banco** organizadas (Usuario, PerfilSaude, Medicamento, Alergia, Exame, etc)
- **8 ajudantes externos** (Claude, Gemini, Whisper, Twilio, Resend, Supabase, etc)
- **App do médico** (`desktop/app-v2.html`, 6446 linhas, em produção)
- **`api.js` real** (tradutor entre app e servidor — já testado e funcionando)
- **32 telas do paciente** desenhadas e prontas visualmente
- **Design system** consolidado

## O que ESTÁ ERRADO HOJE

- `app.html` atual é **fachada** (32 iframes, não 1 arquivo de verdade)
- Mock `api.js` **mente** (devolve "Lucas Borelli fictício")
- Cada tela carrega tudo **do zero** (32 vezes fonts, CSS, tradutor)
- Estado **isolado por iframe** (telas não compartilham dados em memória)
- Bugs sutis de sincronia entre arquivos

## O que VAI MUDAR

- 1 arquivo único (`app.html` novo, ~12-15 mil linhas)
- Conteúdo das 32 telas embutido (não mais iframe)
- Mock substituído pelo `api.js` real (servidor real)
- Estado global em memória (1 lugar, todas as telas leem)
- Navegação instantânea (mostrar/esconder, sem recarregar)

---

# PARTE 3 — Estrutura do arquivo final

Espelha a arquitetura do `desktop/app-v2.html` adaptada pro paciente:

```
app.html (~12-15 mil linhas estimadas)
│
├── HEAD
│   ├── Fontes (Plus Jakarta Sans)
│   ├── Tokens visuais (cores, espaçamentos, raios, sombras)
│   ├── CSS de componentes core (botão, card, input, modal, toast, badge, pill)
│   ├── CSS específico por tela (prefixado com t-NOME- pra não brigar)
│   └── api.js real importado (tradutor backend)
│
├── BODY
│   ├── div#v-container — palco central onde tela ativa aparece
│   ├── nav#tabbar — tab bar fixa embaixo (Saúde · Exames · QR · Consultas)
│   ├── div#modals-host — onde modais sobem
│   ├── div#sheets-host — onde sheets bottom sobem
│   ├── div#toasts-host — onde notificações curtas aparecem
│   └── div#offline-banner — barra "sem internet" persistente
│
└── SCRIPT
    ├── ESTADO GLOBAL (USER, STATE, MEDS, ALERGIAS, EXAMES, etc)
    ├── NAVEGAÇÃO (goto, voltar, hashRouter, tabBar)
    ├── BACKEND (window.BACKEND.api — vem do api.js real)
    ├── RENDERERS (1 função por tela: renderSplash, renderSaude, etc)
    ├── AÇÕES (salvarMedicamento, deletarAlergia, etc)
    ├── HELPERS (toast, openModal, validar, formatar, comprimir)
    ├── EVENT LISTENERS (online/offline, visibility, popstate)
    └── INIT (auth gate, carregar dados, mostrar tela inicial)
```

---

# PARTE 4 — Sistema de execução autônoma (NOVO)

## Como cada fase executa

Cada fase é uma rodada de 4 etapas:

### Etapa A — Construir
Eu escrevo/modifico arquivos. Uso agentes paralelos quando precisa ler muita coisa (ex: 32 telas pra extrair conteúdo).

### Etapa B — Testar
Quando aplicável, uso **Playwright** (skill de teste) que abre o app num navegador automatizado, clica em botões, preenche forms, tira prints. Se algo trava, log captura o erro.

### Etapa C — Revisar
Lanço um **agente revisor** (subagent `feature-dev:code-reviewer` ou `claude` revisor) que:
- Confere se o que foi feito bate com o **mapa de implementação**
- Confere os **12 princípios** (sem "IA" na copy, design tokens corretos, alergia vermelha, etc)
- Aponta o que está fora do padrão
- Devolve relatório

### Etapa D — Corrigir e continuar
Se revisor apontou erro:
- **Erro pequeno** (typo, classe errada): corrijo na hora, sigo
- **Erro médio** (validação faltando, casos extremos): corrijo, valido de novo
- **Erro crítico** (perda de dado, segurança): paro, escrevo em RELATÓRIO-PROBLEMAS.md, sigo o que dá

**Nunca te pergunto.** Decido com base nos princípios do plano.

## Quando paro e te chamo

Apenas 3 situações:
1. **Bug que pode destruir dados reais** (memória do incidente 17/04)
2. **Servidor real fora do ar** (Railway down, não dá pra plugar) — uso mock temporariamente, anoto
3. **Limite de contexto da sessão chegou** — paro, salvo progresso, escrevo relatório de onde ficou

Em todos os outros casos: **decido e sigo.**

---

# PARTE 5 — As 8 fases (com plano detalhado de execução autônoma)

## FASE 1 — Esqueleto base + design system inline

### Objetivo
Criar `app.html` novo com:
- Phone frame + notch + status bar (1 vez só, não 32)
- Tab bar de 4 abas funcional
- Sistema de navegação (`goto`, `voltar`, hash routing)
- CSS de componentes core (botão, card, input, modal, toast)
- Estado global vazio
- 32 sections placeholder (vão receber conteúdo nas próximas fases)
- Painel DEV pra pular pra qualquer tela

### Execução
- Etapa A: Escrevo `app.html` v2 completo (placeholders nas sections)
- Etapa B: Validar via Bash que tem ~600 linhas e não dá erro de sintaxe
- Etapa C: Agente revisor confere se segue padrão do `desktop/app-v2.html`
- Etapa D: Ajusto se necessário

### Critério objetivo de pronto
- Arquivo abre sem erro
- Trocar de tela funciona (mostrar/esconder)
- Tab bar acende a aba correta
- Hash routing sincroniza com URL
- Painel DEV lista 32 telas

### Backup
- `app.html` atual vira `app-v3-iframes-backup.html` (preservado)

---

## FASE 2 — Plugar api.js real

### Objetivo
Substituir o mock pelo `api.js` real (que já existe e já funciona — usado pelo médico).

### Execução
- Etapa A:
  1. **Localizar** `api.js` real (pode estar em `vitae-app-github-OLD/api.js` ou no raiz do `vitae-app-novo/`)
  2. **Copiar** pro `app-v3/api-real.js`
  3. **Atualizar** o app.html pra importar `api-real.js` em vez do mock
  4. **Deletar** o mock (`api.js` atual do app-v3) ou renomear pra `api-mock.js` como backup
- Etapa B: Validar com curl que servidor Railway responde
- Etapa C: Agente revisor confere se URL detecta corretamente local vs produção
- Etapa D: Ajusto config se preciso

### Critério objetivo de pronto
- App abre e console mostra requisições reais ao Railway
- Cadastro de teste via curl funciona
- Refresh token automático funciona quando JWT expira
- Dados fictícios ("Lucas Borelli") desapareceram

### Riscos
- CORS pode bloquear localhost — se acontecer, adiciono origem no backend OU faço fallback temporário com mock
- Railway pode estar offline — uso mock, anoto, sigo

---

## FASE 3 — Onboarding + Auth funcionais

### Objetivo
Mover conteúdo real de 10 telas pro app.html:
- Splash (20), Boas-vindas (21), Login (23 — vira modo do 26), Esqueci senha (24), Nova senha (25), Cadastro (26), SMS (27 — fluxo passa direto), Onboarding (28), Quiz (30), Pronto (31)

### Execução
- Etapa A: Lanço **4 agentes paralelos** pra extrair conteúdo das 10 telas
  - Agente 1: 20, 21, 23 (extrai HTML+CSS+JS, prefixa com `t-splash-`, `t-boas-`, etc)
  - Agente 2: 24, 25, 26 (mesma coisa)
  - Agente 3: 27, 28 (mesma coisa)
  - Agente 4: 30, 31 (mesma coisa — o quiz é a tela maior com 1343 linhas)
- Etapa A.2: Consolido cada conteúdo dentro da section correspondente no `app.html`
- Etapa A.3: Adapto `window.location.href` pra `goto('nome-tela')`
- Etapa A.4: Adapto chamadas API: do mock vão pro BACKEND real
- Etapa B: Playwright simula:
  - Cadastro completo (nome + email + senha)
  - Avança pelos 3 slides de onboarding
  - Faz quiz inteiro (7 passos)
  - Chega na tela "Pronto"
  - Auto-redireciona pra home
- Etapa C: Agente revisor confere:
  - Copy não menciona "IA"
  - Validações inline funcionam
  - Foto sobe pro Supabase real (não fica em base64 local)
  - Senha tem medidor de força + 4 regras
  - Quiz salva parcial no localStorage (recuperação)
- Etapa D: Corrijo o que aparecer

### Critério objetivo de pronto
- Cadastro de paciente com email **real** funciona end-to-end
- Dados aparecem no banco (validável via curl GET /perfil/me com token)
- Quiz salva 7 campos corretamente
- Sem dados fictícios

---

## FASE 4 — 4 abas principais

### Objetivo
Mover conteúdo de 4 telas (01-saude, 09-exames, 12-qr, 15-consultas) pro app.html.

### Execução
- Etapa A: 4 agentes paralelos extraem cada aba (uma é grande — `09-exames-lista` tem 2146 linhas)
- Etapa A.2: Consolido cada uma dentro do app.html
- Etapa A.3: Cada aba carrega dados do servidor REAL ao ativar:
  - Saúde: GET /perfil/me + /medicamentos + /alergias + /scores/atual + /exames?limit=3 (paralelo)
  - Exames: GET /exames com filtros
  - QR: POST /autorizacao/criar pra gerar token
  - Consultas: GET /agendamento
- Etapa B: Playwright valida:
  - Cada aba abre sem erro
  - Lista dados reais (após cadastro feito na Fase 3)
  - Skeleton aparece durante loading
  - Estados vazios aparecem quando lista vazia
- Etapa C: Agente revisor confere:
  - Alergia em vermelho na tela Saúde
  - Score visual correto
  - QR Code gera e leva pro rg-publico
  - Filtros funcionam
- Etapa D: Corrijo

### Critério objetivo de pronto
- Você logado vê seus dados reais nas 4 abas
- Refresh da página não perde estado

---

## FASE 5 — Telas filhas + Cruzamentos

### Objetivo
Mover 10 telas filhas (perfil, privacidade, meds, det-med, add-med, alergias, det-alergia, add-alergia, det-exame, det-consulta) e implementar cruzamento alergia-medicamento.

### Execução
- Etapa A: 4 agentes paralelos extraem 10 telas
- Etapa A.2: Consolido
- Etapa A.3: Implemento ações reais:
  - Adicionar medicamento → POST /medicamentos
  - Editar medicamento → PUT /medicamentos/:id
  - Deletar → DELETE
  - Mesma coisa pra alergia
  - Upload exame → POST /exames com FormData
- Etapa A.4: Cruzamento crítico — quando adiciona med ou alergia, verifico se há conflito:
  - Tem mapa CMED de classes farmacológicas (Penicilina, AINE, Dipirona, etc)
  - Se med adicionado pertence à mesma classe de alergia ativa → badge vermelho destacado
- Etapa B: Playwright simula cenário Lucas-Dipirona:
  - Cadastra "Dipirona" como medicamento ativo
  - Cadastra "Dipirona" como alergia
  - Vê alerta vermelho aparecer
- Etapa C: Agente revisor confere:
  - Todos os botões salvam de verdade
  - Confirmação destrutiva (excluir) tem 2 cliques
  - Toast aparece após cada ação
  - Validações inline funcionam
- Etapa D: Corrijo

### Critério objetivo de pronto
- CRUD completo pra meds, alergias, exames
- Cruzamento alergia-med funciona
- Cenário Lucas-Dipirona dispara alerta correto

---

## FASE 6 — Estados (vazios, loading, erro) + RG público

### Objetivo
Mover conteúdo de 8 telas:
- 5 estados vazios (40-44)
- 1 loading-home (52)
- 1 erro-offline (60)
- 1 RG público (14)

### Execução
- Etapa A: 2 agentes paralelos extraem conteúdo
- Etapa A.2: Consolido como sections separadas
- Etapa A.3: Implementar disparo automático:
  - Lista vazia? → mostra estado vazio em vez de lista
  - Loading? → mostra skeleton
  - `window.addEventListener('offline')` → mostra banner offline
  - Banner some quando volta online
- Etapa A.4: RG público continua arquivo separado (`14-rg-publico.html`) pra médico escanear externamente
- Etapa B: Playwright valida:
  - Conta nova vê estados vazios
  - Desligar wi-fi simulado mostra banner
  - Religar some o banner
- Etapa C: Agente revisor confere copy dos estados vazios + ilustrações
- Etapa D: Corrijo

### Critério objetivo de pronto
- 5 estados vazios bonitos
- Skeleton durante loadings
- Banner offline aparece/some automático
- RG público continua acessível externamente

---

## FASE 7 — 30 casos extremos tratados

### Objetivo
Cobrir os 30 cenários mapeados na Parte VIII do Plano V1.

### Execução
- Etapa A: Pra cada cenário, adiciono tratamento no app.html:
  - Email duplicado → toast amigável + botão "entrar"
  - Senha errada → mensagem genérica (segurança)
  - Token expirado → refresh automático (já vem do api.js real)
  - Sem internet → banner persistente
  - Servidor 5xx → toast vermelho + sugestão de retry
  - Foto >10MB → comprime automaticamente
  - Alergia vs med conflita → badge vermelho (já feito na Fase 5)
  - Quiz abandonado → salva parcial, oferece "continuar"
  - Médico revogou acesso → backend filtra (já tem)
  - CPF inválido → validação inline
  - ... mais 20 cenários
- Etapa B: Playwright simula 5-10 cenários críticos
- Etapa C: Agente revisor confere se cada mensagem é amigável e em PT-BR
- Etapa D: Corrijo

### Critério objetivo de pronto
- 30 cenários tratados
- Mensagens em PT-BR
- Auto-recovery onde possível
- Sem mensagem técnica feia exposta ao usuário

---

## FASE 8 — Validação end-to-end + agente revisor auditando

### Objetivo
Garantir que sistema inteiro funciona junto:
- Paciente cadastra de verdade
- Adiciona dados
- Cria autorização pra médico
- Médico (em outra aba) vê
- Paciente revoga
- Médico para de ver

### Execução
- Etapa A: Playwright executa cenário completo:
  1. Abre app.html
  2. Cadastra paciente novo com email único
  3. Faz quiz 7 passos
  4. Chega na home
  5. Adiciona 1 medicamento
  6. Adiciona 1 alergia conflitante → verifica alerta vermelho
  7. Faz upload de exame de teste
  8. Cria autorização pra médico
  9. Abre app médico em outra aba (com credenciais médico de teste)
  10. Médico vê o paciente
  11. Volta no app paciente, revoga autorização
  12. Médico para de ver
- Etapa B: Agente revisor faz auditoria final completa:
  - Confere 12 princípios cumpridos
  - Confere mapa de implementação seguido
  - Confere design system aplicado
  - Lista o que ficou perfeito
  - Lista o que falta (se algo)
- Etapa C: Escrevo `RELATORIO-EXECUCAO-FINAL.md` com tudo
- Etapa D: Se algo crítico falhou, tento corrigir. Se não conseguir, anoto honestamente.

### Critério objetivo de pronto
- 12 passos do Playwright passam
- Auditoria do revisor passa
- Relatório final escrito

---

# PARTE 6 — Validação cruzada de princípios

## Checagens automáticas executadas pelo agente revisor

Após cada fase, o agente revisor faz essas perguntas e responde objetivamente:

| # | Pergunta | Como verifica |
|---|----------|---------------|
| 1 | Tem "IA", "AI", "algoritmo" na copy? | Grep no app.html por essas palavras |
| 2 | Cores não-tokenizadas estão sendo usadas? | Grep por hex codes fora da paleta |
| 3 | Fonte não-Plus-Jakarta está sendo usada? | Procura por `font-family:` que não seja Plus Jakarta |
| 4 | Alergia tem destaque vermelho na tela Saúde? | Inspeciona section data-screen="saude" |
| 5 | Tab bar tem 4 abas (não 5, não 3)? | Conta `<button class="tab">` |
| 6 | Auth gate redireciona se não logado? | Lê função goto() pra ver if(isLoggedIn) |
| 7 | Schema do banco foi modificado? | Compara backend/prisma/schema.prisma com versão anterior |
| 8 | App médico foi modificado? | Compara desktop/app-v2.html |
| 9 | Mock api.js ainda está sendo importado? | Grep por "api.js" sem "api-real" |
| 10 | Botões críticos chamam BACKEND real? | Verifica que onclick chama função que usa window.BACKEND |
| 11 | Sem dark pattern (urgência fake, badge vazio)? | Grep por "só hoje", "última chance", etc |
| 12 | Validação inline em todos os forms? | Verifica oninput/onblur em cada `<input>` |

Se alguma checagem falha → agente revisor APONTA, eu CORRIJO antes de avançar.

---

# PARTE 7 — Casos extremos completos (30 cenários)

Mesmo do Plano V1, mas reforçados:

| # | Cenário | Tratamento |
|---|---------|-----------|
| 1 | Email já cadastrado | Toast "esse email já existe · entrar?" + botão toggle |
| 2 | Senha errada | "email ou senha incorretos" (genérico) |
| 3 | JWT expira no meio do uso | Refresh automático invisível |
| 4 | Refresh também falhou | Logout + redireciona mantendo estado |
| 5 | Sem internet | Banner persistente · dados não se perdem |
| 6 | Servidor caiu (5xx) | Toast vermelho · sugere retry |
| 7 | Foto >10MB | Comprime antes (1200px, JPEG 0.75) |
| 8 | Alergia conflita com med ativo | Alerta vermelho destacado · não bloqueia |
| 9 | Quiz abandonado | localStorage salva · oferece "continuar" |
| 10 | Médico revogou acesso | App não mostra (backend filtra) |
| 11 | CPF inválido | Validação inline com dígitos errados |
| 12 | Celular fora do formato | Máscara automática |
| 13 | Senha fraca | Medidor visual + 4 regras |
| 14 | Upload tipo errado | Aceita só JPG/PNG/PDF/HEIC |
| 15 | Exame processando >5min | Status "demorando · regenerar?" |
| 16 | Exame deu erro de IA | ERRO + botão "tentar de novo" |
| 17 | Two-tabs concurrent edit | Última gravação vence + warning |
| 18 | Conexão lenta | Skeleton + timeout 30s + retry exponencial |
| 19 | Logout em outra aba | Detecta storage removido + redireciona |
| 20 | localStorage corrompido | Valida ao carregar · limpa se corrupto |
| 21 | Backend retorna formato diferente | Schema validation + fallback |
| 22 | Push negada | Não insiste · banner explicativo opcional |
| 23 | Câmera negada | Fallback galeria + tutorial |
| 24 | Áudio corrompido | Detecta + pede regravar |
| 25 | Web Share API indisponível | Fallback copy link |
| 26 | Modo anônimo | localStorage limitado · funciona mas avisa |
| 27 | Browser muito antigo | Detecta + "atualize navegador" |
| 28 | LGPD apagar conta | DELETE + janela 30 dias + email confirmação |
| 29 | LGPD exportar dados | GET ZIP em JSON/CSV |
| 30 | Idade <13 | Bloqueia · "precisa ter 13+ anos" |

---

# PARTE 8 — Definição de pronto (checklist objetivo)

Sistema considerado pronto quando TODOS os critérios passam:

## Funcionalidade
- [ ] Cadastro real funciona (dados → banco)
- [ ] Login real funciona (banco → app)
- [ ] Quiz salva 7 campos no banco
- [ ] Foto sobe pro Supabase
- [ ] Medicamentos: criar, editar, deletar via API real
- [ ] Alergias: mesmo
- [ ] Exames: upload + análise IA + visualização
- [ ] Score carrega
- [ ] QR Code gera e abre rg-publico correto
- [ ] Autorização cria e revoga
- [ ] Logout limpa tudo
- [ ] Esqueci senha funciona end-to-end

## Qualidade (12 princípios)
- [ ] Zero "IA" na copy
- [ ] Tom institucional consistente
- [ ] Design tokens aplicados
- [ ] Alergia vermelha em toda tela relevante
- [ ] Mobile responsivo (<480px sem phone frame)
- [ ] Loading skeleton em toda operação async
- [ ] Toast feedback em toda ação
- [ ] Sem dark pattern
- [ ] Sem urgência fabricada
- [ ] Sem mensagem técnica feia exposta
- [ ] Schema banco intacto
- [ ] App médico intacto

## Casos extremos
- [ ] 30 cenários todos tratados

## Integração
- [ ] Médico desktop vê paciente recém-cadastrado
- [ ] Paciente revoga, médico perde acesso
- [ ] Pré-consulta (link externo) funciona

## Performance
- [ ] App abre <2s
- [ ] Trocar abas <100ms
- [ ] Fetch home <1s

## Validação
- [ ] Playwright passa em fluxos críticos
- [ ] Agente revisor aprovou cada fase
- [ ] Testado em Chrome + Edge
- [ ] Relatório final escrito

---

# PARTE 9 — Cronograma de execução autônoma

Estimativa realista de uma sessão única:

| Fase | Tempo estimado | Skill/Agente |
|------|----------------|--------------|
| Fase 1 (esqueleto) | 30 min | Write direto |
| Fase 2 (api real) | 20 min | Bash + Read + Edit |
| Fase 3 (onboarding) | 90 min | 4 agentes Explore paralelos + Write |
| Fase 4 (abas) | 90 min | 4 agentes Explore paralelos + Write |
| Fase 5 (filhas) | 90 min | 4 agentes Explore paralelos + Write |
| Fase 6 (estados) | 45 min | 2 agentes Explore paralelos + Write |
| Fase 7 (extremos) | 60 min | Edits incrementais + revisor |
| Fase 8 (validação) | 60 min | Playwright + agente revisor + relatório |

**Total estimado:** ~8h de trabalho contínuo.

**Realidade:** numa única resposta minha, posso executar **Fases 1-4 ou 1-5** dentro do limite. Fases 6-8 ficam pra continuação ou eu reporto onde ficou.

---

# COMPROMISSO

Eu, Claude, ao final desta sessão, deixo:

1. **`app.html` novo** — SPA real, conteúdo das 32 telas embutido, conectado ao backend real
2. **`api-real.js`** — tradutor de verdade plugado
3. **`api-mock.js`** — mock antigo preservado (caso precise voltar)
4. **`app-v3-iframes-backup.html`** — versão anterior preservada
5. **`RELATORIO-EXECUCAO-FINAL.md`** — relatório honesto do que foi feito, validado e o que falta
6. **`PLANO-MASTER-V2-EXECUCAO-AUTONOMA.md`** — este arquivo, como referência

Se algo não der pra terminar nesta sessão, o relatório final dirá:
- O que foi entregue
- O que está validado
- O que falta
- Próximos passos exatos pra retomar

**Sem perguntas. Sem permissões. Sem pausas.**

Hora de execução.
