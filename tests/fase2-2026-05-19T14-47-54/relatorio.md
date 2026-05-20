# Relatório E2E FASE 2 — 19/mai/2026

**Início:** 2026-05-19T14:47:55.219Z
**Fim:** 2026-05-19T14:50:13.024Z

## Resumo

| Métrica | Valor |
|---|---|
| Total cenários | 81 |
| ✅ Passou | 79 (98%) |
| ❌ Falhou | 2 |
| Recursos criados | 10 PCs · 10 agendamentos · 4 docs |
| Cleanup | 12 apagados / 12 preservados (proteção CFM/LGPD) |

## ❌ Falhas (2)

### [G1.6] Paciente tenta criar PC (rota só medico) → 403
- **Erro:** `esperado 403, recebeu 400`
- **Tempo:** 216ms

### [?] ?
- **Erro:** `c.fn is not a function`
- **Tempo:** 1ms

## ✅ Passou por grupo

### G1 · Quiz vita id validações — 9 cenários
- [G1.1] Criar PC sem dataConsulta retorna 400 (896ms)
- [G1.2] Criar PC com pacienteEmail inválido retorna 400 (275ms)
- [G1.3] Criar PC com pacienteNome muito curto retorna 400 (280ms)
- [G1.4] Criar PC com templateId inexistente — backend tolera ou rejeita (405ms)
- [G1.5] Criar PC sem auth retorna 401 (205ms)
- [G1.7] Responder pergunta com modo inválido → 400 (739ms)
- [G1.8] Responder pergunta sem perguntaId → 400 (662ms)
- [G1.9] Responder texto vazio → 400 (970ms)
- [G1.10] Modo "pulado" salva sem valor — funciona (892ms)

### G2 · UI médico profundo — 12 cenários
- [G2.1] UI: Sidebar do médico mostra 5 abas (Hoje, Pré-Consultas, Pacientes, Templates, Perfil) (3147ms)
- [G2.2] UI: Aba Pré-Consultas carrega tabela (4510ms)
- [G2.3] UI: Aba Templates carrega grid (4949ms)
- [G2.4] UI: Aba Perfil carrega 5 sub-abas (4612ms)
- [G2.5] UI: Stat cards aparecem na aba Hoje (4019ms)
- [G2.6] Backend: GET /medico/dashboard retorna stats (584ms)
- [G2.7] Backend: GET /medico/metricas retorna 5 inputs do médico (676ms)
- [G2.8] Backend: GET /medico/me/exportar-iclinic retorna CSV (299ms)
- [G2.9] Backend: GET /medico/me/exportar-dados-lgpd JSON (1143ms)
- [G2.10] Backend: GET /templates lista templates do médico (260ms)
- [G2.11] Backend: GET /pre-consulta?status=PENDENTE filtra corretamente (374ms)
- [G2.12] Backend: GET /pre-consulta sem filtro retorna lista (285ms)

### G3 · UI paciente profundo — 10 cenários
- [G3.1] UI Paciente: navega pra aba Saúde (3778ms)
- [G3.2] UI Paciente: navega pra aba Exames (4183ms)
- [G3.3] UI Paciente: navega pra aba QR Code (4964ms)
- [G3.4] UI Paciente: navega pra aba Consultas (3617ms)
- [G3.5] UI Paciente: navega pra aba Perfil (3968ms)
- [G3.6] Backend: GET /perfil do paciente retorna dados (605ms)
- [G3.7] Backend: GET /exames do paciente retorna lista (621ms)
- [G3.8] Backend: GET /medicamentos do paciente retorna lista (753ms)
- [G3.9] Backend: GET /alergias do paciente retorna lista (561ms)
- [G3.10] Backend: GET /scores retorna score atual (193ms)

### G4 · Tela detalhe consulta — 8 cenários
- [G4.1] UI: 16-consulta-detalhe.html carrega standalone (3208ms)
- [G4.2] UI: 15-consultas.html carrega standalone (3850ms)
- [G4.3] Backend: GET /documentos/consulta/:agId existe (643ms)
- [G4.4] Backend: GET /agendamento/:id retorna agendamento (972ms)
- [G4.5] Backend: GET /documentos/:id retorna detalhes do doc (1096ms)
- [G4.6] Backend: paciente NÃO consegue listar documentos de outro paciente (249ms)
- [G4.7] Backend: GET /agendamento sem auth → 401 (211ms)
- [G4.8] Backend: GET /documentos/meus sem auth → 401 (205ms)

### G5 · Estados de erro UI — 8 cenários
- [G5.1] UI Paciente: pre-consulta.html?token=INEXISTENTE mostra tela amigável (4536ms)
- [G5.2] UI Paciente: pre-consulta.html sem token mostra tela amigável (3478ms)
- [G5.3] UI Médico: app-v2.html sem auth redireciona pra 01-login (3798ms)
- [G5.4] Backend: token PC expirada retorna 410 (668ms)
- [G5.5] Backend: finalizar PC com token inválido → 404 (651ms)
- [G5.6] Backend: confirmar retorno sem auth → 401 (215ms)
- [G5.7] Backend: propor retorno sem dataHora → 400 (228ms)
- [G5.8] Backend: propor retorno sem pacienteId → 400 (246ms)

### G6 · Anamnese + IA Collab — 6 cenários
- [G6.1] PC respondida cria entry no histórico do paciente (8811ms)
- [G6.2] Médico vê paciente na lista após 1 PC respondida (1303ms)
- [G6.3] Detalhe paciente inclui >=1 pré-consulta (1053ms)
- [G6.4] Backend: POST /pre-consulta/:id/ia-collab existe (1334ms)
- [G6.5] Anamnese de PC respondida inclui summaryJson (10100ms)
- [G6.6] PC tem transcricao não-vazia após responder (1248ms)

### G7 · Notificações cruzadas — 6 cenários
- [G7.1] Backend: GET /notificacoes do paciente retorna lista (291ms)
- [G7.2] Médico anexa documento → paciente vê em /documentos/meus (1294ms)
- [G7.3] Médico propõe retorno → paciente vê em /retornos-pendentes (796ms)
- [G7.4] Paciente confirma retorno → médico vê em /pacientes/:id agendamento (884ms)
- [G7.5] Paciente recusa retorno → estado muda no banco (625ms)
- [G7.6] Paciente remarca → médico vê data nova (623ms)

### G8 · Validações backend — 8 cenários
- [G8.1] Backend: data de retorno no passado → 400 (273ms)
- [G8.2] Backend: data de retorno em string inválida → 400 (280ms)
- [G8.3] Backend: upload sem arquivo → 400 (336ms)
- [G8.4] Backend: confirmar agendamento inexistente → 404 (242ms)
- [G8.5] Backend: outro paciente NÃO pode confirmar retorno alheio (586ms)
- [G8.6] Backend: criar template sem nome → 400 (240ms)
- [G8.7] Backend: GET /pre-consulta com filtro PENDENTE (403ms)
- [G8.8] Backend: refresh token funciona (377ms)

### G9 · Stress & idempotência — 6 cenários
- [G9.1] Confirmar retorno 2x — segunda chamada não duplica (1179ms)
- [G9.2] Upload do mesmo documento 2x cria 2 entries (não dedup automático) (1592ms)
- [G9.3] Criar 3 PCs em sequência rápida — todas com tokens únicos (782ms)
- [G9.4] Finalizar PC com cobertura 0/11 → 400 (585ms)
- [G9.5] Responder MESMA pergunta 2x — última vence (idempotência por attemptId) (1426ms)
- [G9.6] Propor 2 retornos pro mesmo paciente — backend aceita ambos (623ms)

### G10 · Cleanup & auditoria — 6 cenários
- [G10.1] Lista de PCs do médico após bateria inclui >=5 entries criadas (2747ms)
- [G10.2] Lista de documentos do paciente inclui >=2 entries criadas (279ms)
- [G10.3] Médico DELETE PC criada nesta fase (312ms)
- [G10.4] Médico DELETE documento criado nesta fase (410ms)
- [G10.5] Backend: retornos confirmados/recusados NÃO aceitam DELETE (823ms)
- [G10.6] Refresh tokens armazenados conferem (smoke security) (1ms)

