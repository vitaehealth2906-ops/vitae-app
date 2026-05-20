# Relatório E2E vita id — 19/mai/2026

**Início:** 2026-05-19T14:34:54.621Z
**Fim:** 2026-05-19T14:35:58.566Z

## Resumo

| Métrica | Valor |
|---|---|
| Total de cenários | 33 |
| ✅ Passou | 33 (100%) |
| ⚠️ Parcial | 0 |
| ❌ Falhou | 0 |
| Recursos criados | 5 PCs · 3 agendamentos · 5 docs |
| Cleanup | 6 apagados / 7 falhas |

## ✅ Passou (33)

- [A.1] Médico logado via API retorna usuario.tipo MEDICO (0ms)
- [A.2] Paciente logado via API retorna usuario.tipo PACIENTE (0ms)
- [A.3] Criar PC via API gera linkToken válido (753ms)
- [A.4] GET /estado retorna PC criada (283ms)
- [A.5] Token inválido retorna 404 (244ms)
- [A.6] Responder PC com 11 textos completos → cobertura 11/11 (6240ms)
- [A.7] Responder com modo "desconhecer" em todas → cobertura 11/11 + finalizar 200 (5864ms)
- [A.8] Texto curto "Bebo" salva sem julgar IA (regressão Sessão 26) (5985ms)
- [A.9] Token já respondida retorna duplicate true (270ms)
- [A.10] Cobertura insuficiente bloqueia (PC com 5/11 respostas) (2700ms)
- [B.1] GET /medico/pacientes retorna lista com paciente recém-respondido (1395ms)
- [B.2] GET /medico/pacientes/:id retorna detalhe completo (861ms)
- [B.3] PC respondidas têm summary (após delay 5s) (6291ms)
- [B.4] Lista de pacientes filtrável por nome (busca PREFIX) (1512ms)
- [C.1] GET /agendamento (paciente) retorna lista (pode ser vazia) (238ms)
- [C.2] GET /agendamento/retornos-pendentes retorna lista (229ms)
- [C.3] GET /documentos/meus retorna lista (pode ser vazia) (277ms)
- [D.1] Médico propõe retorno em 30 dias (346ms)
- [D.2] Paciente vê retorno em /retornos-pendentes (218ms)
- [D.3] Paciente CONFIRMA retorno → status muda (301ms)
- [D.4] Médico propõe retorno 2 — paciente REMARCA com nova data (586ms)
- [D.5] Médico propõe retorno 3 — paciente RECUSA (585ms)
- [D.6] Médico anexa LAUDO (PDF) pra paciente (812ms)
- [D.7] Médico anexa ENCAMINHAMENTO (PDF) (574ms)
- [D.8] Médico anexa RECEITA (PDF) (611ms)
- [D.9] Médico anexa EXAME_PEDIDO (JPG) (849ms)
- [D.9b] Médico anexa OUTRO (PDF) (465ms)
- [D.10] Paciente vê documentos anexados em /documentos/meus (259ms)
- [D.11] Paciente baixa documento (URL assinada) (429ms)
- [A.11] UI: Médico abre app-v2 e chega na Aba Hoje (com auth bypass via localStorage) (2893ms)
- [A.12] UI: Médico navega pra aba Pacientes (4845ms)
- [A.13] UI: Paciente abre app-v3 e chega na Saúde (4270ms)
- [A.14] UI: Paciente navega pra aba Consultas (3809ms)

---
Gerado por master-e2e-2026-05-19.js
