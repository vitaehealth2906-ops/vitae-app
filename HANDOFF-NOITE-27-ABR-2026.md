# HANDOFF — 27/04/2026 noite (PC casa → Notebook faculdade)

> Lucas voltou pro PC de casa às ~21h, validou 2 coisas, identificou o que falta.
> Agora tá voltando pro notebook da faculdade. Esse arquivo é o que ele/Claude precisa saber.

---

## ✅ O QUE FOI VALIDADO HOJE À NOITE

### 1. Anamnese Estruturada — FUNCIONANDO (precisa só de teste com áudio NOVO)

Lucas abriu uma pré-consulta antiga e viu **1/11 campos** com badge `formulário`. Achou que era bug. Não é.

**Diagnóstico:** Pré-consultas antigas (respondidas ANTES do deploy de hoje, commit `32be76b`) têm o áudio processado pelo prompt antigo, que não estruturava os 11 campos. O fallback do desktop só consegue extrair do formulário. Funcionando como projetado.

**Pra validar de verdade:** criar pré-consulta NOVA, gravar áudio com sintomas, e confirmar que aparece **9-11/11 campos** com badge `áudio` (verde). Ou usar a opção de reprocessamento (`vitaeAPI.regenerarSummaryPreConsulta('id')` no F12) numa pré-consulta antiga.

**Status:** OK — só falta o teste real.

---

### 2. Bug Google Sign-In paciente Alvaro — DIAGNOSTICADO, FALTA CONFIG

Paciente Alvaro tentou criar conta Google na pré-consulta, deu **`Erro 400: redirect_uri_mismatch`**. É o mesmo bug do incidente ao vivo de mais cedo.

**Confirmado:** É a hipótese A do handoff anterior — config faltando no Google Cloud Console.

**Lucas verificou no Google Cloud Console:**
- Origens JavaScript autorizadas: só `https://vitae-app.vercel.app`
- URIs de redirecionamento autorizados: só `https://vitae-app.vercel.app/03-cadastro.html`

**Estranheza técnica:** o código usa `initTokenClient` (popup, sem redirect) — não deveria precisar de redirect_uri. Mesmo assim o Google deu erro. Hipótese: a pré-consulta abre numa URL preview do Vercel diferente da produção, ou o WhatsApp in-app browser tem comportamento estranho.

**Pendente Lucas mandar (CRÍTICO pra fechar o bug):**
1. **Link exato** da pré-consulta que veio no WhatsApp (qual URL?)
2. **Print da barra do navegador** ANTES de clicar Google (pra ver se é preview Vercel ou produção)

**Solução provisória recomendada (Lucas pode aplicar antes de mandar prints):**

No Google Cloud Console, adicionar nas DUAS listas (origens + redirecionamento):
```
https://vitae-app.vercel.app/03-cadastro.html
https://vitae-app.vercel.app/pre-consulta.html
http://localhost:3000
```

Salvar, esperar 5 min, testar.

---

## 🗂️ ESTADO DAS PASTAS NO PC DE CASA

```
d:\vitae-app-github-OLD          ← pasta velha quebrada (git corrompido) — preservada como backup
d:\vitae-app-novo                ← pasta NOVA, sincronizada com GitHub — É essa que Claude usou hoje
```

**Tentativa de renomear `vitae-app-novo` → `vitae-app-github` falhou** com `Device or resource busy` (lock de VSCode/serve.js). Lucas precisa fechar VSCode/serve.js no PC de casa antes de renomear. Isso NÃO afeta o trabalho — o nome da pasta não muda nada no código.

---

## 📦 NO NOTEBOOK DA FACULDADE — O QUE FAZER QUANDO CHEGAR

### Cenário 1 — Notebook tem `d:/vitae-app-novo` (criado hoje cedo)
```
cd d:/vitae-app-novo
git pull origin main
```
Traz esse handoff + Sessão 14 no CLAUDE.md.

### Cenário 2 — Notebook tem `d:/vitae-app-github` funcionando
```
cd d:/vitae-app-github
git pull origin main
```

### Cenário 3 — Nada funciona
```
git clone https://github.com/vitaehealth2906-ops/vitae-app.git d:/vitae-app-fresh
```

---

## 🎯 PRIORIDADES NA PRÓXIMA SESSÃO (notebook faculdade)

**Tier 1 (urgente — bloqueia validação com médico betatester):**
1. Resolver Google Sign-In — Lucas mandar os 2 prints + adicionar URLs extras no Console
2. Implementar verificação real do ID token com `google-auth-library` (lib já instalada, nunca usada) — Tier 2 do handoff anterior

**Tier 2 (validação):**
3. Criar pré-consulta de teste com áudio real e validar 9-11/11 campos preenchidos
4. Se algum campo sair errado, ajustar prompt em `backend/src/services/ai.js`

**Tier 3 (limpeza):**
5. Renomear pastas no PC de casa quando voltar (fechar VSCode antes)
6. Investigar causa raiz do git corrompido em `vitae-app-github-OLD`

---

## 📍 CONTEXTO IMPORTANTE QUE NÃO PODE PERDER

- Decisão estratégica de hoje cedo: VITAE NÃO vira ambient scribe. Foca em pré-consulta. Documentado na Sessão 13 do CLAUDE.md.
- Anamnese estruturada com 11 campos foi a entrega de hoje (commits `32be76b` + `6961932`).
- Não fizeram alterações de código nessa sessão da noite — só investigação + diagnóstico + esse handoff.

---

**Bom trabalho, Lucas. Descansa um pouco se conseguir. Amanhã (ou na faculdade já) fechamos o Google bug e validamos a Anamnese com áudio real.**
