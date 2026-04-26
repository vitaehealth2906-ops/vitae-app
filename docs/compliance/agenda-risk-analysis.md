# Análise de Risco — Módulo Agenda Médica

**Norma de referência:** ISO 14971 — Medical devices — Application of risk management to medical devices
**Versão:** 1.0
**Data:** 2026-04-26
**Classificação estimada ANVISA:** SaMD Classe I (apoio operacional ao consultório, risco baixo)

---

## 1. Descrição do componente

Sistema de agenda médica integrado ao vita id, permitindo:
- Marcação, cancelamento e remarcação de consultas
- Sincronização (somente leitura) com Google Calendar pessoal do médico
- Lembretes automáticos para o paciente (24h e 2h antes) por email e push web
- Finalização de atendimento com retorno opcional
- Lista de espera com matching automático
- Multi-usuário (médico + secretária com permissões limitadas)

**Finalidade:** organizar fluxo de atendimentos e reduzir no-show. **Não substitui prontuário nem registro clínico oficial.**

---

## 2. Mapa de riscos (12 itens críticos)

| ID | Risco | Severidade | Probabilidade | Mitigação implementada |
|----|-------|------------|----------------|------------------------|
| AG01 | Marcação dupla simultânea (médico e secretária) | Alta | Média | `pg_advisory_xact_lock(hashtext(medicoId))` em transação; `attemptId` UUID dedupe idempotente; segundo POST retorna `duplicate:true` |
| AG02 | Lembrete não chega ao paciente | Média | Média | 2 canais (email Resend + push web); fila com retry 5x backoff 30s→2h; dead-letter visível ao médico (`badge "lembrete não enviado"`); auto-marcação `lembrete*Sent` impede reenvio |
| AG03 | Paciente recebe lembrete de consulta cancelada | Alta | Baixa | Worker rechecha `slot.status` antes de enviar; cancelamento marca `TarefaPendente.dead=true`; janela de desfazer 10s suspende envio |
| AG04 | Médico cancela slot por engano | Média | Média | Snapshot `estadoAnterior` em coluna; toast persistente 10s com botão Desfazer; após janela, fluxo normal de re-marcação |
| AG05 | Conflito de timezone (médico em viagem ou DST) | Alta | Baixa | Banco em UTC; display em `Config.timezone` (default America/Sao_Paulo); banner aviso quando browser detecta TZ diferente; `services/agenda/timezone.js` cobre 25 casos teste |
| AG06 | Token Google vaza | Crítica | Baixa | AES-256-GCM com IV único (12 bytes) por registro; `AGENDA_TOKEN_KEY` 32 bytes em env Railway; nunca logado nem no Sentry |
| AG07 | vita id escreve no Google Calendar pessoal do médico | Alta | Baixa | Scope OAuth restrito a `calendar.readonly`; nunca chama `events.insert`; teste de integração mocka API e verifica zero chamadas de escrita |
| AG08 | Secretária acessa briefing clínico | Crítica | Baixa | Middleware `permission.js`: rotas `/pre-consulta/:id/respostas`, `/exames`, `/medicamentos`, `/alergias` rejeitam role SECRETARIA com 403; teste RBAC matriz 24 cenários |
| AG09 | Convite de secretária reutilizado por terceiros | Alta | Baixa | Token criptograficamente aleatório 32 bytes; expira em 7 dias; single-use (campo `aceitoEm` desativa); HTTPS obrigatório |
| AG10 | No-show falso positivo (médico esqueceu de marcar comparecimento) | Baixa | Alta | Auto-marcação `MARCAR_NO_SHOW` roda às 23h e cobra status; UI permite reverter status até 7 dias; histórico em audit |
| AG11 | Paciente sem canal digital (idoso) não recebe lembrete | Média | Média | Sistema NÃO bloqueia marcação; badge "lembrar manualmente" pra secretária; fluxo de Joana ligar permanece |
| AG12 | Sistema cai em produção e médico fica sem agenda na frente do paciente | Crítica | Baixa | Cache offline IndexedDB 14 dias; Service Worker estratégia stale-while-revalidate; banner "modo leitura" quando sem internet; flag `AGENDA_V1_ENABLED` permite rollback em ≤60s |

---

## 3. Controles de mitigação (técnicos e administrativos)

### 3.1 Controles técnicos

- **Lock advisor PostgreSQL** em todas as criações/edições de slot.
- **Idempotência via `attemptId` UUID** em todas operações destrutivas/criativas.
- **Janela de desfazer 10s** com snapshot `estadoAnterior` em JSON.
- **Worker dead-letter** após 5 tentativas, marcado `dead=true`.
- **Rate limiting** em rotas críticas (`/agenda/google/auth`: 1/min; `/agenda/secretarias/convidar`: 5/dia).
- **Encriptação AES-256-GCM** para refresh token Google.
- **Audit trail imutável** em `AuditoriaAcesso` para 12 ações da agenda.
- **Pseudonimização em logs** Sentry (scrub `pacienteNome`, `motivo`, `observacoes`).
- **Health check estendido** monitora DB, worker, Resend, GCal sync.

### 3.2 Controles administrativos

- **Backup obrigatório** antes de schema change (`pg_dump` + tag git).
- **Rollout em 4 estágios** (dark launch → interna → 5% canário → 100%) com gatilhos de rollback explícitos.
- **Feature flag `AGENDA_V1_ENABLED`** desliga toda a feature em ≤60s sem redeploy.
- **Documentação obrigatória** de FAQ e tutorial antes do go-live.
- **Médico betatester** valida 25 cenários E2E manuais antes do estágio 3.

---

## 4. Disclaimer CFM (rodapé da agenda)

> "vita id é ferramenta de organização da agenda médica. Decisões clínicas, indicação de retorno, conduta diagnóstica e terapêutica são responsabilidade exclusiva do médico (CFM Resolução 2.299/2021)."

---

## 5. Métricas pós-deploy (não-negociáveis)

| Métrica | Meta | Onde medir |
|---|---|---|
| Tempo marcar slot | ≤1.5s p95 | Sentry transaction `agenda.slots.create` |
| Sync GCal end-to-end | ≤30s | worker log `agenda_gcal_sync_*` |
| Erro 5xx em `/agenda/*` | ≤0.5% | rate limit + Sentry |
| Uptime API | ≥99.5% | Railway health |
| % Pre-consultas finalizadas em 30d | ≥80% | `/admin/agenda-stats` |
| % Retornos marcados (vs sem retorno) | ≥40% | idem |
| Redução de no-show | ≥20% (vs baseline pré-agenda) | comparativo contadores `FALTA` |
| Lembrete delivery rate | ≥85% | worker log `agenda_lembrete_*` |

---

## 6. Trilha de auditoria (12 ações registradas)

`CRIAR_AGENDAMENTO`, `CANCELAR_AGENDAMENTO`, `REMARCAR_AGENDAMENTO`, `FINALIZAR_ATENDIMENTO`, `FINALIZAR_DESFAZER`, `CONECTAR_GOOGLE`, `DESCONECTAR_GOOGLE`, `CONVIDAR_SECRETARIA`, `ACEITAR_CONVITE`, `REVOGAR_SECRETARIA`, `MARCAR_FALTA`, `EXPORTAR_DADOS`.

Cada entrada: `atorId`, `acao`, `recursoId`, `alvoId`, `ipAddress` (hash), `userAgent` (hash), `metadata` (JSON), `criadoEm`. Retenção 20 anos (CFM Res. 1638/2002).

---

## 7. Plano de rollback

- **Imediato (≤60s):** flag `AGENDA_V1_ENABLED=false` em Railway → redeploy automático.
- **Médio (≤30min):** restore `pg_dump` se schema corrompido; tag git `v-pre-agenda` checkout.
- **Comunicação:** mensagem ao médico betatester; status page atualizada; post-mortem documentado em `docs/post-mortems/`.
