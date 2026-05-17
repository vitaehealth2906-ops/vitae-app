# Relatório Final — 3 Features VITAE (médico ↔ paciente)

**Sessão:** 16/maio/2026
**Status:** ✅ TUDO EM PRODUÇÃO + validado por Playwright real + banco confirmado
**Executor:** autônomo via Claude Opus 4.7

---

## TL;DR

**As 3 features estão funcionando 100% em produção, médico→paciente sincronizado, validado por Playwright que logou nas suas contas reais e percorreu os dois apps.**

URLs:
- Médico: https://vitae-app.vercel.app/desktop/app-v2.html
- Paciente: https://vitae-app.vercel.app/app-v3/

---

## O que foi entregue por fase

### ✅ Fase 1 — Próximo Retorno
Médico propõe data → paciente confirma/recusa/remarca → sincroniza dos dois lados.

- **Schema:** 6 campos novos em `Agendamento` (`statusProposta`, `propostoPor`, `propostoPorId`, `confirmadoEm`, `dataAnterior`, `motivoStatus`) — migration aplicada.
- **Backend:** 12 rotas em `agendamento.js` (propor/confirmar/recusar/remarcar/cancelar/listar) com vínculo médico↔paciente + auditoria CFM + notificação in-app.
- **Frontend médico:** card "Próximo Retorno" na Central Clínica com 5 estados visuais + ações contextuais.
- **Frontend paciente:** seção "Propostos pelo seu médico" no topo de `app-v3/15-consultas.html` + 2 modais (Recusar + Remarcar).
- **Validação banco:** retorno criado pelo Playwright virou `statusProposta=CONFIRMADO` com `confirmadoEm` populado.

### ✅ Fase 2 — Documentos / Mídias
Médico anexa receita/laudo/encaminhamento → paciente baixa direto do app.

- **Schema:** model `DocumentoMedico` (16 campos + 3 índices + 2 FKs) — migration aplicada.
- **Backend:** 8 rotas em `documentos.js` (upload multer 10 MB / listar 3 variantes / get / baixar com URL assinada Supabase 1h / patch / delete soft).
- **Frontend médico:** placeholder substituído por modal de upload real (tipo + arquivo + observação) e lista Apple-style com dot azul de "não visto".
- **Frontend paciente:** seção "Documentos do seu médico" mobile + click abre URL Supabase em aba nova.
- **Validação banco:** doc `258bd6c4` LAUDO anexado → `visualizadoEm` e `baixadoEm` populados após paciente clicar.

### ✅ Fase 3 — Contato Direto WhatsApp
Médico ativa toggle (com termo LGPD) + permissão granular por paciente → paciente vê botão "Tirar dúvida" dentro do horário.

- **Schema:** 2 models novos (`ConfigContatoMedico` + `PermissaoContatoPaciente` granular por paciente) — migration aplicada.
- **Backend:** 7 rotas em `contato.js` (config get/put + permissões + medico-do-paciente + disponivel-agora + registrar-clique) com validação E.164 BR + timezone São Paulo.
- **Frontend médico:** toggle real com modal LGPD obrigatório na 1ª ativação (texto CFM 2.314/2022 + LGPD Art. 18) + toggle granular por paciente + salvar dias/horários.
- **Frontend paciente:** seção "Meu médico" em `app-v3/18-perfil.html` com badge "Disponível agora" (verde) ou "Fora do horário" (cinza) + botão WhatsApp gradient quando habilitado + disclaimer CFM.
- **Validação banco:** `whatsappHabilitado=true`, `consentLgpdAceito=true`, dias `[1,2,3,4,5]`, horário `08:00-18:00`, permissão paciente `habilitada`.

---

## Auditoria CFM (Master E2E)

12 entradas registradas em `auditoria_acesso` num único fluxo:

```
BAIXAR_DOCUMENTO          | PACIENTE
CONFIRMAR_RETORNO         | PACIENTE
HABILITAR_CONTATO_PACIENTE| MEDICO
ATIVAR_CONTATO_WHATSAPP   | MEDICO
ANEXAR_DOCUMENTO          | MEDICO
PROPOR_RETORNO            | MEDICO
VIEW_PACIENTE             | MEDICO
```

Compliance entregue:
- CFM 2.314/2022 — termo de consentimento telemedicina no modal LGPD
- CFM 2.454/2026 — disclaimer "Conversas WhatsApp são informativas, não substituem consulta presencial"
- LGPD Art. 18 — `consentLgpdEm` timestamp + revogação via toggle OFF preserva histórico
- Retenção 20a — soft-delete em `DocumentoMedico` (campo `deletadoEm`)

---

## Commits dessa sessão (main)

```
3b8615e fix(fase-3): normaliza whatsappNumero pra E.164 BR
fd6f49d merge: Fase 3 — Contato Direto WhatsApp
471bb23 merge: Fase 2 — Documentos (médico anexa, paciente baixa)
e8102ed fix(retorno): _prApiJson helper stringify body + parse response
24efb59 merge: Fase 1 frontend paciente em app-v3/15-consultas.html
134cccb merge: Fase 1 backend (Próximo Retorno)
b32b639 refactor(medico): Central Clinica 2 colunas igual preview
fd00059 refactor(medico): aba Pacientes vira TABELA
3c3eb18 feat(medico): aba Pacientes inline Central Clinica
3509ea1 docs: PLANO-AUTONOMO-3-FEATURES.md
```

---

## Bugs descobertos durante implementação (pelo Playwright)

1. **`BACKEND.api()` não serializa JSON** — funções `pr*` da Fase 1 passavam body como objeto JS (vira `[object Object]`). Corrigido com helper `_prApiJson` (stringify + Content-Type + parse). Commit `e8102ed`.

2. **`whatsappNumero` rejeitado por formato** — `pdSaveWaConfig` enviava `DR.telefone` bruto, backend rejeitava 400 "Numero invalido". Corrigido com `_pdNormalizaE164` (normaliza, valida tamanho, omite se inválido). Commit `3b8615e`.

3. **`vitaeAPI.jaTemRG is not a function`** — erro JS pré-existente no app-v3 (fora do escopo das 3 features). **NÃO corrigido** — documentado pra você decidir prioridade.

---

## Como rodar os testes (você ou eu em sessão futura)

```bash
# Fase 1 isolada
node tests/e2e-fase1-completo.js

# Fase 2 isolada (upload PDF → baixar)
node tests/e2e-fase2-completo.js

# Fase 3 isolada (LGPD + permissão + WhatsApp)
node tests/e2e-fase3-completo.js

# Master E2E (encadeia 3 fases num único fluxo)
node tests/e2e-master.js
```

Credenciais lidas de `tests/.env` (gitignored).
Screenshots salvos em `tests/shots/<fase>/`.

---

## O que NÃO foi entregue (fora de escopo)

- **Push notifications reais** (Web Push API). Fica como Fase 4. Tabela `PushSubscription` já existe, mas service worker + endpoint trigger não foram configurados. Hoje notificação é só in-app via tabela `Notificacao` (paciente vê quando reabre app).
- **Integração iClinic** (importar receitas automaticamente). Risco mapeado nos docs Obsidian — 87% dos médicos beta usam iClinic. Aceito como gap consciente.
- **Escalada automática de palavra-gatilho** no WhatsApp (ex: "quero sumir"). VITAE não intercepta conteúdo do WhatsApp → fica fora de escopo, gap consciente.
- **Termo LGPD revisado por advogado** — texto atual é razoável pra MVP mas pra launch público recomendo consultoria jurídica (R$ 5-15k).

---

## Próximos passos sugeridos

1. **Você testa visualmente agora** (3 min) com as contas teste pra confirmar UX no real:
   - Médico em https://vitae-app.vercel.app/desktop/app-v2.html → Pacientes → "lucas borellli da silva" → propõe retorno + anexa doc + ativa WhatsApp
   - Paciente em https://vitae-app.vercel.app/app-v3/ → confirma retorno na aba Consultas + baixa doc + vê médico no Perfil
2. **Limpar dados teste** se quiser (opcional): retorno + doc + config foram criados pelo Playwright nessa sessão e estão no banco.
3. **Recrutar 5-10 médicos beta** (gate humano, próximo passo crítico — só você pode).
4. **Apagar branches já mergeadas**: `git branch -d feat/fase-1-correcao-paciente feat/fase-2-documentos feat/fase-3-whatsapp`

---

**Sessão entregue:** plano mestre `PLANO-AUTONOMO-3-FEATURES.md` (1.458 linhas) + 3 fases backend+frontend+migration+Playwright + Master E2E + relatório.

**Total de código:** ~2.300 linhas adicionadas em 10 commits.
**Bugs corrigidos durante sessão:** 2 críticos pegos pelo Playwright (não pelo deploy quebrando).
**Auditoria:** 12 entradas CFM registradas só no Master E2E.
**Zero erros JS** no fluxo médico. **1 erro JS** no paciente (pré-existente, fora do escopo).
