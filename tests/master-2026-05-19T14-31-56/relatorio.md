# Relatório E2E vita id — 19/mai/2026

**Início:** 2026-05-19T14:31:57.105Z
**Fim:** 2026-05-19T14:32:52.799Z

## Resumo

| Métrica | Valor |
|---|---|
| Total de cenários | 32 |
| ✅ Passou | 24 (75%) |
| ⚠️ Parcial | 0 |
| ❌ Falhou | 8 |
| Recursos criados | 5 PCs · 3 agendamentos · 2 docs |
| Cleanup | 7 apagados / 3 falhas |

## ❌ Falhas (8)

### [A.6] Responder PC com 11 textos completos → cobertura 11/11
- **Erro:** `template não tem 11 perguntas: 0`
- **Tempo:** 494ms

### [A.7] Responder com modo "desconhecer" em todas → cobertura 11/11 + finalizar 200
- **Erro:** `finalizar status 400`
- **Tempo:** 774ms

### [A.8] Texto curto "Bebo" salva sem julgar IA (regressão Sessão 26)
- **Erro:** `finalizar status 400 (BUG sessão 26 regressão!): {"erro":"Cobertura insuficiente","detalhe":"Faltam 11 perguntas com algum status","respondidas":0,"t`
- **Tempo:** 746ms

### [A.9] Token já respondida retorna duplicate true
- **Erro:** `esperado duplicate:true, recebeu {"status":400,"body":{"erro":"Cobertura insuficiente","detalhe":"Faltam 11 perguntas com algum status","respondidas":0,"total":11}}`
- **Tempo:** 253ms

### [A.10] Cobertura insuficiente bloqueia (PC com 5/11 respostas)
- **Erro:** `Cannot read properties of undefined (reading 'id')`
- **Tempo:** 492ms

### [D.4] Médico propõe retorno 2 — paciente REMARCA com nova data
- **Erro:** `remarcar status 400: {"erro":"Dados invalidos. Verifique os campos e tente novamente.","detalhes":["novaDataHora: Required"]}`
- **Tempo:** 488ms

### [D.7] Médico anexa ATESTADO (PDF)
- **Erro:** `upload doc: 400 {"erro":"tipo invalido. Valores aceitos: RECEITA, LAUDO, ENCAMINHAMENTO, EXAME_PEDIDO, OUTRO"}`
- **Tempo:** 360ms

### [D.9] Médico anexa EXAME (JPG)
- **Erro:** `upload doc: 400 {"erro":"tipo invalido. Valores aceitos: RECEITA, LAUDO, ENCAMINHAMENTO, EXAME_PEDIDO, OUTRO"}`
- **Tempo:** 533ms

## ✅ Passou (24)

- [A.1] Médico logado via API retorna usuario.tipo MEDICO (0ms)
- [A.2] Paciente logado via API retorna usuario.tipo PACIENTE (1ms)
- [A.3] Criar PC via API gera linkToken válido (290ms)
- [A.4] GET /estado retorna PC criada (335ms)
- [A.5] Token inválido retorna 404 (220ms)
- [B.1] GET /medico/pacientes retorna lista com paciente recém-respondido (1313ms)
- [B.2] GET /medico/pacientes/:id retorna detalhe completo (1047ms)
- [B.3] PC respondidas têm summary (após delay 5s) (8333ms)
- [B.4] Lista de pacientes filtrável por nome (busca PREFIX) (9046ms)
- [C.1] GET /agendamento (paciente) retorna lista (pode ser vazia) (567ms)
- [C.2] GET /agendamento/retornos-pendentes retorna lista (305ms)
- [C.3] GET /documentos/meus retorna lista (pode ser vazia) (281ms)
- [D.1] Médico propõe retorno em 30 dias (351ms)
- [D.2] Paciente vê retorno em /retornos-pendentes (213ms)
- [D.3] Paciente CONFIRMA retorno → status muda (297ms)
- [D.5] Médico propõe retorno 3 — paciente RECUSA (571ms)
- [D.6] Médico anexa LAUDO (PDF) pra paciente (1209ms)
- [D.8] Médico anexa RECEITA (PDF) (565ms)
- [D.10] Paciente vê documentos anexados em /documentos/meus (273ms)
- [D.11] Paciente baixa documento (URL assinada) (273ms)
- [A.11] UI: Médico abre app-v2 e chega na Aba Hoje (com auth bypass via localStorage) (3121ms)
- [A.12] UI: Médico navega pra aba Pacientes (4980ms)
- [A.13] UI: Paciente abre app-v3 e chega na Saúde (5301ms)
- [A.14] UI: Paciente navega pra aba Consultas (4189ms)

---
Gerado por master-e2e-2026-05-19.js
