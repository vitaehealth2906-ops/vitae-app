# HANDOFF — PC de casa · 27/04/2026 (noite)

> Lucas saiu do notebook indo pro PC de casa. Tudo deployado e commitado no GitHub.
> Esse arquivo e pra Lucas (e pro proximo Claude) saberem exatamente o estado.

---

## ✅ O QUE FOI ENTREGUE NESTA SESSAO

**Feature: Anamnese Estruturada com 11 campos + fonte rastreavel**

Substituiu os antigos componentes "Queixa Principal" + "Pontos de Atencao" por um componente unico mais util pro medico, com 11 campos clinicos e badge de fonte (audio com timestamp ou formulario).

**Backend:**
- `backend/src/services/ai.js` — prompt do Gemini extrai os 11 campos estruturados
- ZERO schema change no banco (campo entra dentro de `summaryJson` existente)

**Frontend (2 telas atualizadas):**
- `25-summary.html` (mobile) — componente novo
- `desktop/app.html` (desktop) — componente novo (fallback mais robusto pra pre-consultas antigas)

**Commits no GitHub (branch `main`):**
- `32be76b` — feat(summary): anamnese estruturada (mobile + backend)
- `6961932` — fix(desktop): aplicar tambem no desktop/app.html

**Deploy:** Vercel + Railway ja propagaram automaticamente apos push.

---

## ⚠️ ATENCAO CRITICA — git local quebrado no notebook

A pasta `d:/vitae-app-github` no NOTEBOOK esta com git CORROMPIDO:
- Refs broken (`origin/main`, `v-pre-agenda-26abr2026`)
- Objeto Git invalido (`7076c709...` — header invalido, inflate error)
- `git log` mostra so 1 commit ("Initial commit")
- `git fetch` falha
- NAO usar essa pasta

**Solucao executada:** clone fresco em `d:/vitae-app-novo` no notebook. Todos os commits desta sessao foram feitos por essa pasta nova. Pasta corrompida foi PRESERVADA (nao deletada) pra forensics.

---

## 🏠 NO PC DE CASA — o que voce precisa fazer

### Cenario A — PC de casa ja tem o repo clonado (d:/vitae-app-github funcionando)

Provavelmente o caso. So precisa puxar as atualizacoes:

```
cd d:/vitae-app-github
git pull origin main
```

Isso traz os 2 commits novos (`32be76b` e `6961932`).

### Cenario B — PC de casa NAO tem o repo

```
git clone https://github.com/vitaehealth2906-ops/vitae-app.git d:/vitae-app-github
```

### Apos o pull/clone

Nada mais precisa ser feito. Deploy ja esta no ar (Railway + Vercel automaticos).

---

## 🧪 COMO TESTAR (no PC de casa OU pelo navegador direto)

1. Abre `https://vitae-app.vercel.app/desktop/app.html`
2. Faz login como medico
3. Vai em "Pre-Consultas"
4. Clica numa pre-consulta antiga ou nova
5. Procura pelo componente **"Anamnese estruturada"** com badge `X/11 campos`
6. Cada campo preenchido tem badge `audio` (verde) ou `formulario` (azul)
7. Campos vazios mostram "Nao relatado" em cinza italico

### Roteiro completo de validacao

**Teste 1 — Pre-consulta antiga (do banco):**
- Deve aparecer componente Anamnese Estruturada
- Pelo menos a Queixa Principal deve estar preenchida (vem de fallback)
- Outros campos podem estar "Nao relatado" se a pre-consulta antiga nao tinha esses dados

**Teste 2 — Pre-consulta NOVA (criar uma agora):**
- Manda link de pre-consulta pra paciente teste responder
- Paciente grava audio mencionando: queixa, tempo, intensidade, fatores, sintomas, tratamento previo, antecedentes
- Apos paciente enviar, abre summary
- TODOS os campos relevantes devem estar preenchidos com badge `audio` (verde)
- Campos do formulario devem ter badge `formulario` (azul)

---

## 🚧 PENDENTE PRA PROXIMA SESSAO

1. **Limpar pasta corrompida no notebook:**
   - Fechar VSCode + serve.js que prendem lock em `d:/vitae-app-github`
   - Renomear `d:/vitae-app-github` → `d:/vitae-app-github-OLD-quebrado-27abr2026` (backup forense)
   - Renomear `d:/vitae-app-novo` → `d:/vitae-app-github` (volta ao nome oficial)

2. **Validar Anamnese Estruturada com pre-consulta nova** (item Teste 2 acima)

3. **Se algum campo da anamnese sair errado** (medico betatester apontar):
   - Ajustar prompt em `backend/src/services/ai.js` (regras de cada campo)
   - Re-deploy automatico

4. **Possivel migracao do fallback expandido:**
   - O `desktop/app.html` tem fallback mais robusto que o `25-summary.html` mobile
   - Considerar portar o `pickFirst()` e mapeamento de chaves pro mobile tambem

---

## 📊 DECISAO ESTRATEGICA TOMADA NESTA SESSAO

**VITAE NAO vai virar ambient scribe.** Decisao apos analise profunda do mercado:
- Sofya, Voa (60k medicos), Vocis, Doctorflow, Heidi, Abridge — mercado saturado
- Custo de entrada R$ 800k-2M (ASR streaming + diarizacao + LLM clinico + time)
- Lucas sozinho, 18 anos, sem capital pra essa briga

**Caminho escolhido (Caminho C — Hibrido inteligente):**
- Dobrar no diferencial unico: pre-consulta gravada pelo paciente em casa
- Anamnese estruturada poderosa (entregue nesta sessao)
- Eventualmente: documentos 1-clique + exportar iClinic + retorno (sem competir no DURANTE)
- Posicionar como complementar ao Sofya/Voa, nao competidor

Detalhes completos: ver Sessao 13 no CLAUDE.md.

---

## 🗂️ ARQUIVOS IMPORTANTES MODIFICADOS

| Arquivo | O que mudou |
|---------|-------------|
| `backend/src/services/ai.js` | Prompt do Gemini com 11 campos estruturados + regras anti-alucinacao |
| `25-summary.html` | CSS + JS do componente Anamnese (mobile) |
| `desktop/app.html` | CSS + JS do componente Anamnese (desktop) com fallback robusto |
| `CLAUDE.md` | Sessao 13 documentada + ERRO-003 (git corrompido) |

---

## 🚫 NAO TOCAR (preview descartado)

Foi construido um preview da jornada PRE → DURANTE → POS em `desktop/preview-consulta-jornada.html` durante a sessao, mas DESCARTADO apos decisao Caminho C. Pode servir como referencia visual no futuro mas NAO representa direcao do produto. Nao excluir, mas tambem nao usar.

---

**Pronto. Bom trabalho hoje, Lucas.** Sessao foi longa mas decisao estrategica e implementacao tecnica fecharam bem. Descansa, e amanha (ou hoje a noite) testa a Anamnese Estruturada com pre-consulta real.
