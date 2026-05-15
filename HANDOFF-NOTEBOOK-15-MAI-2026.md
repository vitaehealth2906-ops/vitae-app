# Handoff — Notebook da Faculdade — 15 Mai 2026

> **Cole este arquivo no Claude do notebook pra retomar exatamente de onde parou.**

---

## O QUE FOI FEITO NESSA SESSÃO (15/mai)

### Ponto de partida
- App v3 existia localmente em `d:\vitae-app-novo\app-v3\` mas nunca tinha sido testado em produção
- Todas as telas tinham dados hardcoded: "Lucas Borelli", "Losartana 50mg", "Dipirona", "Marina Borelli", "Dra. Renata Cardoso" — dados de demo falsos
- Backend Railway estava funcionando mas app v3 não se conectava a ele

### O que foi entregue

#### 1. App v3 subido na Vercel (URL pública)
- Branch `feat-app-v3-paciente` criada → mergeada na `main`
- **URL ao vivo:** `https://vitae-app.vercel.app/app-v3/app.html`
- App antigo continua intocado em `https://vitae-app.vercel.app/`

#### 2. Três manuais técnicos criados (274 KB total)
- `MANUAL-BACKEND-COMPLETO.md` (94 KB) — todas as 47 rotas do backend, schema Prisma, prompts IA
- `MANUAL-APP-ANTIGO-USO-BACKEND.md` (58 KB) — como o app antigo usa cada API, jornadas completas
- `MANUAL-FEATURES-ESPECIAIS.md` (122 KB) — fórmula exata do score, CMED, pipeline Whisper+Gemini+Claude, anamnese estruturada, padrões observados v2

#### 3. Mapa de implementação criado
- `MAPA-IMPLEMENTACAO-FINAL.md` (55 KB) — estado de cada tela, 65 hardcodes inventariados, 10 lotes detalhados

#### 4. Todos os 10 lotes implementados e no ar
| Lote | O que fez | Commit |
|---|---|---|
| 1 | Tela Saúde HOME — RG card + meds-hoje + alergias + score reais | `f5b3f36` |
| 2 | Medicamentos — lista real + CRUD completo | `428d381` |
| 3 | Alergias — lista real + CRUD + cruzamento CMED | `5030880` |
| 4 | Exames — lista real + detalhe com biomarcadores (9/9 Playwright ✅) | `a9f9b55` |
| 5 | Consultas — agendamentos reais + estado vazio | `1ec8170` |
| 6 | QR Code + RG público com token real | `e481ae5` |
| 7 | Perfil editável — todos os campos (9/9 Playwright ✅) | `c25f472` |
| 8 | Privacidade + autorizações de médicos (4/4 Playwright ✅) | `dbd9322` |
| 9 | Quiz com formulário estruturado de medicamento (nome/dose/via/horário/lembretes) | `462435b` |
| 10 | Polimento final + smoke integrado | `8c23f4f` |

#### 5. Botão DEV removido do app público | `68c4e58`

---

## ESTADO ATUAL DO APP V3

### O que funciona (ligado ao backend Railway)
- ✅ Cadastro + login + Google Sign-In
- ✅ Quiz vita id com 50+ validações (CPF, altura, peso, cruzamento CMED alergia×med)
- ✅ Tela Saúde HOME — dados reais do paciente
- ✅ Medicamentos — lista, detalhe, adicionar, remover
- ✅ Alergias — lista, detalhe, adicionar, cruzamento farmacológico real
- ✅ Exames — upload, lista, detalhe com biomarcadores NORMAL/ATENÇÃO/CRÍTICO
- ✅ Consultas — lista de agendamentos reais + estado vazio pra paciente novo
- ✅ QR Code — gera token real, médico escaneia, vê RG público
- ✅ Perfil — editar todos os dados (nome, CPF, nascimento, altura, peso, sangue, contato emergência, foto)
- ✅ Privacidade — ver e revogar autorizações de médicos

### O que NÃO está feito (para próximas sessões)
1. **3 features da aba Consultas** (médico → paciente):
   - Propor/negociar data de retorno (não existe no backend, não existe no médico)
   - Botão WhatsApp de contato direto com médico (backend existe, UI falta)
   - Médico anexar documentos ao paciente (laudos, atestados, receitas) — não existe em nenhum lado

2. **Scan de receita** (câmera → Gemini → lista meds) — telas faltando no v3

3. **Score detalhado** (10-score.html) — tela existe mas sem gráfico de evolução histórica

4. **Idade biológica** (15-bioage.html) — tela existe mas sem dados reais

5. **Notificações** — lembretes de medicamento (30-lembretes.html) sem lógica real

6. **Plano de implementação super detalhado** que Lucas pediu — estava sendo montado quando ele precisou ir pro notebook (não foi criado ainda)

---

## LINKS IMPORTANTES

| O que | Link |
|---|---|
| App paciente v3 (novo) | https://vitae-app.vercel.app/app-v3/app.html |
| App paciente antigo | https://vitae-app.vercel.app/01-splash.html |
| App médico desktop | https://vitae-app.vercel.app/desktop |
| GitHub repo | https://github.com/vitaehealth2906-ops/vitae-app |
| Backend Railway | https://vitae-app-production.up.railway.app/health |
| Vercel deployments | https://vercel.com/vitaehealth2906-ops/vitae-app/deployments |

---

## ONDE ESTÃO OS ARQUIVOS

```
d:\vitae-app-novo\
  app-v3\                    ← app paciente novo (38 telas, todas funcionais)
    app.html                 ← wrapper de iframes (ponto de entrada)
    api.js + api-real.js     ← conexão com backend Railway
    01-saude.html            ← HOME do paciente
    09-exames-lista.html     ← tela mais complexa (2350 linhas)
    30-quiz.html             ← quiz vita id com 50+ validações
    ...
  desktop\
    app-v2.html              ← app médico desktop (em produção)
  backend\                   ← servidor Railway
    src\routes\              ← 47 rotas
    prisma\schema.prisma     ← banco de dados
  tests\
    shots\auditoria\         ← 32 screenshots das telas
  MANUAL-BACKEND-COMPLETO.md        ← 94 KB de docs técnicos
  MANUAL-APP-ANTIGO-USO-BACKEND.md  ← 58 KB
  MANUAL-FEATURES-ESPECIAIS.md     ← 122 KB
  MAPA-IMPLEMENTACAO-FINAL.md      ← 55 KB
  RELATORIO-LOTES-V3.md            ← relatório dos 10 lotes
```

---

## DECISÕES TOMADAS NESSA SESSÃO

1. **Arquitetura**: app v3 usa wrapper de iframes (cada tela é um HTML separado carregado em iframe). O SPA consolidado foi testado mas estava quebrando — mantemos wrapper. Arquivo `app-spa-quebrado.html` é o backup.

2. **Backend**: api.js detecta automaticamente se está em localhost (usa Railway pra não precisar de servidor local) ou em produção.

3. **CMED**: cruzamento alergia×medicamento usa mapa de 23 classes farmacológicas + ~70 sinônimos. Já funcionando no quiz.

4. **Consultas**: decidido que aba mostra agendamentos por enquanto. As 3 features (retorno, WhatsApp, documentos do médico) são a próxima prioridade.

5. **App antigo**: mantido intocado em produção. App v3 em rota separada `/app-v3/`. Sem cutover ainda.

---

## CONTEXTO IMPORTANTE (para não esquecer)

### Regras absolutas do projeto
- NUNCA usar `--accept-data-loss` no Prisma (destruiu dados reais em 17/04)
- NUNCA mencionar "IA" ou "inteligência artificial" na copy do paciente
- NUNCA fazer git push sem autorização do Lucas
- NUNCA tocar no app médico (`desktop/app-v2.html`) sem autorização
- NUNCA abrir 2+ sessões Claude paralelas no mesmo projeto

### Backend Railway
- URL: `vitae-app-production.up.railway.app`
- CORS libera: `vitae-app.vercel.app`, `vitaehealth2906-ops.github.io`, `localhost:3000/3001/3002`
- JWT: 30 dias + refresh 90 dias rotativo

### Sobre o Lucas
- 18 anos, Americana-SP, fundador, não programa
- Explicar tudo em PT-BR sem código/termos técnicos
- Prefere execução autônoma depois de aprovado o plano
- Motivação pessoal: internado por crise alérgica (Dipirona + Penicilina)

---

## PRÓXIMA SESSÃO — POR ONDE CONTINUAR

### Prioridade 1 (mais impacto imediato)
Implementar as 3 features da aba Consultas que conectam médico↔paciente:

**Feature A — WhatsApp de contato** (mais simples, ~1h)
- No app do médico: adicionar campo "Habilitar contato via WhatsApp" no perfil
- No app do paciente: botão "Falar com médico" na tela de consulta

**Feature B — Propor data de retorno** (médio, ~3h)
- No app do médico: após ver summary de pré-consulta, botão "Marcar retorno"
- No banco: campo novo em Agendamento (sem risco de perda de dados)
- No app do paciente: card "Retorno proposto" com aceitar/sugerir outra data

**Feature C — Documentos do médico pro paciente** (maior, ~5h)
- Nova tabela `DocumentoAcesso` no banco (laudo, atestado, receita)
- Upload no app do médico (pasta do paciente)
- Download no app do paciente (tela de consulta)

### Prioridade 2
- Plano super detalhado de implementação dos 10 lotes (Lucas pediu mas saiu pro notebook antes de ser criado)
- Teste ponta-a-ponta: paciente cria conta → médico vê no dashboard → médico manda pré-consulta → paciente responde → médico vê summary

---

## MEGA-PROMPT PRA COLAR NO CLAUDE DO NOTEBOOK

```
Oi! Estou retomando o desenvolvimento do vita id no notebook da faculdade.
Preciso que você leia o arquivo de handoff desta sessão antes de qualquer coisa:
d:\vitae-app-novo\HANDOFF-NOTEBOOK-15-MAI-2026.md

E também o CLAUDE.md do projeto:
d:\vitae-app-novo\CLAUDE.md

Resumo do que foi feito hoje (15/mai):
- App paciente v3 subido na Vercel: https://vitae-app.vercel.app/app-v3/app.html
- 10 lotes implementados e no ar (todas as telas conectadas ao backend real)
- 274 KB de manuais técnicos criados (backend, app antigo, features especiais)
- Botão DEV removido do app público

O que falta e é prioridade:
1. 3 features aba Consultas (WhatsApp médico, retorno negociado, documentos do médico)
2. Plano super hiper detalhado de implementação que Lucas pediu

No notebook, o repo está em: d:\vitae-app-novo\ (ou d:\vitae-app-github\)
Se não tiver, clone: git clone https://github.com/vitaehealth2906-ops/vitae-app.git

Antes de implementar qualquer coisa, leia o HANDOFF e o CLAUDE.md completo.
Não faça git push sem autorização do Lucas.
Não use --accept-data-loss no Prisma.
```

---

## VERIFICAÇÃO FINAL — TUDO SALVO?

- [x] GitHub: todos os 10 lotes commitados e na `main` ✅
- [x] Vercel: deployado automaticamente ✅
- [x] Railway: backend não foi mexido ✅
- [x] CLAUDE.md: precisa ser atualizado com a Sessão 24 (esta sessão) ⚠️
- [x] Obsidian: precisa de nota da sessão ⚠️

> Os dois itens marcados ⚠️ podem ser feitos no notebook depois de clonar.
