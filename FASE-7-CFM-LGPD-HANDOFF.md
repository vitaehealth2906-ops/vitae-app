# FASE 7 — CFM + LGPD + AUDIT TRAIL — HANDOFF

> Compliance legal. Disclaimer, audit, JWT revogavel.

## O QUE FOI FEITO

### 1. Disclaimer CFM permanente no 25-summary.html
Bloco no final: "Suporte a decisao clinica. Nao substitui a avaliacao medica. Diagnostico e conduta sao responsabilidade exclusiva do medico. Acesso auditado conforme LGPD e CFM." Cumpre exigencia do Codigo de Etica Medica (briefing IA nao vira prontuario).

### 2. Audit trail de acesso ao briefing
Nova tabela `auditoria_briefing` (id, pre_consulta_id, medico_id, acao, criado_em, ip_hash, user_agent_hash).
- IP e user-agent sao **hashados com salt do JWT_SECRET** — LGPD pseudonimizacao (pode reidentificar se necessario com controle, mas nao vaza em dump).
- Registrado automaticamente toda vez que medico abre `GET /pre-consulta/:id`.
- Endpoint admin: `GET /admin/audit?limit=100` lista ultimos eventos pro Lucas.

### 3. JWT revocation list
Nova tabela `jwt_revogados` (jti, usuario_id, motivo, revogado_em, expira_em).
- Middleware `verificarAuth` agora verifica se jti do token esta na blacklist.
- Cache de 1 min em memoria pra nao atingir DB a cada request.
- Se tabela nao existir ainda, fallback silencioso (nao quebra requests).
- Quando paciente revogar consentimento LGPD no futuro, basta inserir jti dele aqui → sessao invalida imediatamente.

### 4. Service audit.js
Modulo central. `registrarAcessoBriefing` e `registrarRevogacao`. Hash consistente de IP/UA, zero dado clinico.

### 5. Schema aditivo
2 tabelas novas, ambas via `CREATE TABLE IF NOT EXISTS` no startup. Zero risco de data loss.

## TESTAR

1. Deploy. Ver log `[MIGRATE] tabela auditoria_briefing OK` + `[MIGRATE] tabela jwt_revogados OK`.
2. Abrir briefing como medico. Olhar `GET /admin/audit` (via curl com token admin) — deve aparecer 1 evento.
3. Disclaimer: abrir briefing, rolar ate o fim — deve ter o bloco azul claro com texto CFM.

## O QUE NAO FOI FEITO

- **Paciente revogar consentimento** pelo app → gerar automatico entrada na `jwt_revogados`. Infra ta pronta, falta UI no perfil do paciente. Fica pra sessao futura (demanda especifica do paciente).
- **Versionamento de briefing** (se IA regenera). Planejado mas com baixo ganho imediato — os casos existem sao raros.

Seguindo pra Fase 8.
