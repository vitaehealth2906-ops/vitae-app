# 🏠 HANDOFF PARA O PC DE CASA — 18/MAI/2026 (NOITE, 22h)

> Você estava no notebook da faculdade testando pré-consulta no iPhone, descobriu bug crítico, e quer continuar do PC casa. **Tudo já está no GitHub.** Quando chegar lá, é só dar `git pull` e seguir o checklist abaixo.

---

## 🚨 ANTES DE QUALQUER COISA — FECHAR SESSÃO CLAUDE DO PC CASA

Detectei que **havia sessão Claude rodando no PC casa em paralelo** com esta no notebook. Os commits `dfd9b56` e `071e3c0` (19:52-19:53) foram feitos pela outra sessão enquanto eu trabalhava aqui. Por sorte os fixes coincidiram, mas isso **viola regra absoluta do CLAUDE.md** (NUNCA 2+ sessões paralelas no mesmo projeto).

**Quando chegar no PC casa:**
1. Antes de abrir Claude lá, mata qualquer sessão Claude/terminal que estiver aberta
2. Espera o terminal limpar
3. Aí sim, abre nova sessão fresca

---

## 📋 PROMPT PRA COLAR NO CLAUDE DO PC CASA

```
Oi Claude. Acabei de chegar do notebook da faculdade. Cheguei em casa
~22h de 18/05/2026.

ANTES DE QUALQUER COISA, leia NESSA ORDEM:

1. d:\vitae-app-novo\HANDOFF-PC-CASA-18-MAI-NOITE.md
   (ESTE arquivo — resumo das 4 sessões de hoje noite)

2. d:\vitae-app-novo\HANDOFF-FACULDADE-18-MAI-2026\* (no Obsidian Vault)
   (handoff anterior, da manhã — Sprint 1/2/3)

3. d:\vitae-app-novo\CLAUDE.md
   (regras absolutas + sessão 25 + 26)

DEPOIS DE LER, me confirma o que entendeu e perguntem por onde
continuar (testar bug fix, Sprint 1, validar M2).

REGRAS ABSOLUTAS:
- NUNCA git push sem autorização explícita
- NUNCA db push ou --accept-data-loss
- NUNCA múltiplas sessões Claude paralelas
- NUNCA mencionar "IA" em copy
- Antes de schema change, pedir confirmação
```

---

## 🎯 O QUE FOI FEITO NESTA SESSÃO (18/MAI, 19h-22h, notebook faculdade)

### Bloco 1 — API Key Anthropic (resolvido por você)
- Mapeei todos os usos da API Anthropic no backend (15 chamadas em 4 arquivos)
- Calculei estrutura de custo por feature (R$ 0,05 - 3,00 por chamada)
- Você disse "ja resolvei" — você revogou a antiga e plugou a nova no Railway

### Bloco 2 — Fix logout do app médico desktop
**Commit:** `89d2dcf`
**Arquivo:** `desktop/app-v2.html` linha 5245
**Bug:** Modal "Sair da conta?" só fazia toast falso "Você saiu da conta" — não saía de verdade
**Fix:** Botão "Sair" agora chama `doLogout()` que apaga token + redireciona pra `01-login.html`

### Bloco 3 — Fix "Criar template" → tela em vez de popup
**Commit:** `89d2dcf` (mesmo do logout — agrupados)
**Arquivo:** `desktop/app-v2.html` linhas 3128 e 3140
**Bug:** Botão "+ Criar template" abria popup antigo (`modalCriarTemplate`) em vez da tela cheia com 3 passos + phone preview
**Fix:** `onclick="modalCriarTemplate()"` → `onclick="abrirCriarTemplate()"` (2 ocorrências)
**Pendência:** Código órfão (~30 linhas em 5106-5132) das funções antigas — limpeza adiada

### Bloco 4 — Bug crítico do envio da pré-consulta (resolvido por sessão paralela do PC casa!)
**Commits feitos por outra sessão Claude:**
- `dfd9b56` (19:52) — fix backend texto direto (mesmo fix que eu estava fazendo aqui)
- `071e3c0` (19:53) — banner de erro visível + bateria 17 cenários

**Bug que você viu no iPhone:**
- Você gravou 10 respostas em áudio + 1 em texto ("Bebo" pra pergunta de hábitos)
- Clicou "Enviar pro médico"
- Botão virou "Tentar enviar de novo" e ficou em loop
- Banner de erro nem aparecia visível (estava no topo da tela, você scrollado embaixo)

**Causa raiz:**
- Backend usava Gemini pra classificar texto digitado
- "Bebo" pra pergunta "fuma, bebe, faz exercício?" foi classificado como `respondeu=false`
- Backend retornava 200 mas NÃO salvava no banco
- Frontend avançava sem saber que não salvou
- No fim, banco tinha 10/11 respostas → endpoint `/finalizar` rejeitava com 400 "Cobertura insuficiente"

**Fix aplicado:**
- Modo texto agora aplica CAMINHO A (Sessão 17): paciente digitou → salva direto sem IA julgar
- Espelha exatamente o que modo áudio já fazia
- Bonus: banner de erro agora aparece DENTRO da barra sticky do botão (não some scrollado)
- Bonus 2: bateria de 17 cenários de teste autônomos pra validar

---

## ✅ STATUS ATUAL DO PROJETO

| Camada | Status |
|---|---|
| **Backend Railway** | ✅ Vivo (testei `/health` e `/version` agora) |
| **Frontend Vercel** | ✅ Vivo, deploy auto via push |
| **Fix logout (desktop)** | ✅ Em produção (commit 89d2dcf) |
| **Fix criar template (desktop)** | ✅ Em produção (commit 89d2dcf) |
| **Fix bug texto pré-consulta** | ✅ Em produção (commit dfd9b56) |
| **Banner erro visível + testes** | ✅ Em produção (commit 071e3c0) |
| **API Anthropic key** | ✅ Você confirmou que resolveu |
| **Tudo sincronizado no main** | ✅ Local = origin/main |

---

## ⚠️ PENDÊNCIAS QUE EU NÃO RESOLVI HOJE

### A pré-consulta SUA que travou no iPhone
- Você gravou 10 respostas + 1 escrita "Bebo"
- A #10 nunca foi salva no banco
- **Status:** continua travada com 10/11 cobertura
- **Opções:**
  - **Opção A** — Abre o link da pré-consulta de novo no iPhone. Clica em **Editar** na pergunta 10. Responde de novo (texto ou áudio). Como o fix já tá em produção, vai salvar. Depois clica Enviar.
  - **Opção B** — Você me dá o token da PC (URL `?token=...`) e eu faço patch direto no banco pela API admin pra completar a #10 com "Bebo".

### Modificações antigas não commitadas
No `git status` antes desta sessão, vi vários arquivos modificados/deletados de outras sessões:
- `00-escolha.html` (deletado)
- `01-splash.html` (modificado)
- `02-slides-medico.html` (deletado)
- `03-cadastro.html` (modificado)
- `08-perfil.html` (modificado)
- `10-score.html` (modificado)
- `api.js` (modificado)
- `package-lock.json`, `package.json` (modificado)
- `tests/debug-quiz-passo5.js` (modificado)
- `PLANO-EXECUCAO-LOTES-AUTONOMO.md` (untracked)
- `tests/shots-paciente/` (untracked)
- `tests/videos-paciente/` (untracked)
- `docs/migracao/IMPLEMENTACAO-DATA-CONSULTA-2026-05-09.md` (untracked)

**Não commitei nada disso** porque não sei se é intencional ou drift. Quando chegar no PC casa, dá uma olhada — se for trabalho antigo seu pra commitar, decide o que mantém.

### Plano das 3 features médicas (Anexar/Retorno/WhatsApp)
- Bíblia: `docs/PLANO-MESTRE-3-FEATURES-MEDICO.md` (88 KB, 27 partes)
- Preview real: `desktop/preview-real-acordeon.html` (com toggle A/B/C)
- **Você ainda não decidiu qual versão visual segue:** A (Linear+Notion), B (Stripe+Apple), C (vita id atual)
- Quando decidir, implementação real começa (Fase 1: Anexar mídias, ~7 dias)

### Code morto pra limpar (não urgente)
- `modalCriarTemplate`, `modalEditarTemplate`, `renderModalTemplate` em `desktop/app-v2.html:5106-5132` (~30 linhas órfãs)
- Pode deletar quando fizer próxima faxina

---

## 📁 ARQUIVOS QUE EXISTEM HOJE (referência)

```
d:\vitae-app-novo\
├── HANDOFF-PC-CASA-15-MAI-NOITE.md  ← handoff da sessão 15/mai
├── HANDOFF-PC-CASA-18-MAI-NOITE.md  ← ESTE arquivo
├── CLAUDE.md                         ← regras + diário (sessão 26 ainda não atualizada)
├── desktop/
│   ├── app-v2.html                   ← app médico, 6446 linhas
│   ├── preview-real-acordeon.html    ← preview accordion A/B/C
│   └── app-v2-backup-2026-05-04.html ← backup antigo
├── app-v3/
│   ├── pre-consulta.html             ← onde o bug texto foi corrigido
│   ├── 15-consultas.html             ← aba consultas paciente (3 chips status)
│   ├── 16-consulta-detalhe.html      ← 3 blocos vazios aguardando features
│   └── ...
├── backend/
│   └── src/routes/pre-consulta.js    ← onde aplicamos o CAMINHO A no texto
├── docs/
│   ├── PLANO-MESTRE-3-FEATURES-MEDICO.md  ← bíblia das 3 features
│   └── ...
└── tests/
    └── shots-paciente/   ← prints dos testes (sessão paralela do PC casa criou)
    └── videos-paciente/  ← vídeos dos testes (idem)
```

---

## 🧪 COMO TESTAR OS FIXES EM PRODUÇÃO

### Teste 1 — Logout (app médico)
1. Vai em `https://vitae-app.vercel.app/desktop/app-v2.html`
2. Loga
3. Clica no avatar/nome na sidebar (canto inferior esquerdo)
4. Modal "Sair da conta?" → clica **Sair**
5. ✅ Deve cair em `01-login.html`

### Teste 2 — Criar template (app médico)
1. Mesmo app médico, aba **Templates**
2. Clica **"+ Criar template"** no canto direito
3. ✅ Deve abrir TELA CHEIA com 3 passos + phone preview à direita (não popup pequeno)

### Teste 3 — Pré-consulta com resposta em texto
1. Pede pro seu sócio (ou você mesmo do iPhone) mandar uma pré-consulta nova
2. Responde 10 em áudio + 1 em texto curto (ex: pergunta de hábitos)
3. Clica "Enviar pro médico"
4. ✅ Deve ir pra "Pronto, seu briefing chegou"
5. ✅ Banner de erro só aparece se realmente der erro (e visível dentro da barra sticky agora)

### Teste 4 — Resolver SUA pré-consulta travada
- Opção A — Abre link, edita #10, responde de novo
- Opção B — Me passa o token que eu faço o patch

---

## 🛠️ COMANDOS ÚTEIS NO PC CASA

```bash
# Sincronizar repo (essencial primeiro passo)
cd d:\vitae-app-novo
git pull origin main

# Ver últimos commits pra confirmar
git log --oneline -10
# Deve mostrar 071e3c0, dfd9b56, 89d2dcf nos primeiros

# Status (deve estar limpo)
git status

# Rodar servidor local (se quiser testar preview do accordion)
node serve.js
# Abre http://localhost:3000/desktop/preview-real-acordeon.html
```

---

## 🚦 PRÓXIMO PASSO QUANDO CHEGAR NO PC CASA

Decisão prioritária: **A pré-consulta sua continua travada com 10/11**. Quer:

1. Reabrir o link no iPhone e editar #10? (1 minuto)
2. Me passar o token e eu faço patch via API? (você só me dá a string `?token=...` da URL)
3. Deixar essa PC quebrada e fazer outra do zero pra testar?

Decide isso primeiro. Depois:

4. Decidir versão visual do accordion (A/B/C/misturar) — bloqueando implementação das 3 features médicas
5. Sprint 1 do handoff anterior (HANDOFF-FACULDADE-18-MAI-2026 no Obsidian Vault)

---

## 💾 COMMITS DE HOJE (cronológico)

```
071e3c0  Mon 18 19:53  feat(pre-consulta): erro visivel + 17 testes [sessao paralela PC casa]
dfd9b56  Mon 18 19:52  fix(pre-consulta): texto direto sem IA [sessao paralela PC casa]
89d2dcf  Mon 18 19:32  fix(desktop): logout real + criar template tela [esta sessao]
8821228  Sun 17       docs: Sessao 25 + handoff faculdade [sessao anterior]
```

---

## ✅ CHECKLIST QUANDO CHEGAR NO PC CASA

- [ ] Fechar Claude Code antigo (terminal/janela) ANTES de abrir novo
- [ ] `cd d:\vitae-app-novo && git pull origin main`
- [ ] Confirmar `git log --oneline -5` mostra `071e3c0` no topo
- [ ] Abrir Claude Code novo
- [ ] Colar o prompt no topo deste arquivo
- [ ] Ler este handoff inteiro
- [ ] Decidir o que fazer com SUA pré-consulta travada
- [ ] Confirmar fixes funcionam em produção (Testes 1-3 acima)
- [ ] Decidir versão visual do accordion A/B/C
- [ ] Atacar Sprint 1 do plano das 3 features médicas

---

*Tudo já no ar. Backend Railway respondendo. Frontend Vercel ok. Boa noite.* 🌙
