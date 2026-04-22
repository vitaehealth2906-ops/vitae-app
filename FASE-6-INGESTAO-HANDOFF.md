# FASE 6 — INGESTAO POR PECAS + DEDUPE + IDEMPOTENCIA — HANDOFF

> Fechei a porta das duplicatas na raiz. Frontend + backend + worker.

---

## 1. O QUE FOI FEITO

### 1.1 Dedupe de MEDICAMENTOS no POST /medicamentos

**Resolve o bug original do Lucas (5 Creatinas).**

- Normaliza nome + dosagem (tira acento, minusculo, colapsa espacos).
- Se ja existe medicamento ATIVO do mesmo paciente com mesmo nome+dosagem → **atualiza** em vez de criar outro.
- Frontend pode repetir submit sem se preocupar — backend trata sozinho.
- Retorna `{ medicamento, duplicadoAtualizado: true }` pro frontend saber.

### 1.2 Dedupe de ALERGIAS no POST /alergias

Antes: rejeitava com 409 se nome ja existia. Frustrava paciente que queria atualizar gravidade.
Agora: **mescla inteligente** — se existe, atualiza tipo/gravidade com os novos valores. Promocao leve→grave funciona.

### 1.3 Idempotencia atomica na pre-consulta

Substitui `update` por `updateMany` com `WHERE status != 'RESPONDIDA'`. Em Postgres isso e uma **operacao atomica**: dois requests simultaneos nao conseguem passar ambos.

- Se ambos chegam ao mesmo tempo: primeiro vence, segundo retorna 409 `'Pre-consulta ja respondida'`.
- Zero duplicata de TarefaPendente vinda de double-submit.
- Aplicado em `/responder-audio` e `/responder` (texto).

### 1.4 Dedupe de TarefaPendente

Antes de enfileirar, backend checa se ja existe tarefa pendente (processadoEm null, dead false) pra mesma pre-consulta + tipo. Se existe: **nao cria outra** (log "tarefa ja existe"). Se nao existe: cria.

Protege contra:
- Double-submit (apesar do 409 do updateMany)
- Medico clicando "regenerar summary" 3x seguidas
- Worker crash no meio e retry do cliente

### 1.5 JSON.parse defensivo

`respostas` vinha direto via `JSON.parse` sem try-catch. Payload malformado = 500 feio. Agora: catch → 400 amigavel.

---

## 2. O QUE NAO FOI FEITO

**Detector de silencio no frontend** foi despriorizado — muita mexida em `pre-consulta.html` que Lucas ja tem handoff anterior delicado (IndexedDB, Wake Lock, 5min). Os ganhos da Fase 6 ja resolvem o bug visivel do Lucas (Creatinas). Detector de silencio entra se virar problema real com medico betatester.

---

## 3. ACOES MANUAIS

1. Deploy (sem migration).
2. Testar manual:
   - Adicionar creatina 2 vezes no app → deve ter so 1 pill.
   - Adicionar alergia "Dipirona" duas vezes → 2a request atualiza em vez de erro.
3. Ver logs no Railway em seguida ao deploy — se alguem envia duplo, aparece `[FILA] tarefa ja existe pra PC ... — nao duplicou`.

Sigo direto pra Fase 7 sem parar.
