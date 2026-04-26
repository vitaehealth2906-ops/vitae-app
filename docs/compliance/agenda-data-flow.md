# Mapa de Fluxo de Dados — Módulo Agenda

**Norma:** LGPD (Lei 13.709/2018) + CFM Res. 2.299/2021
**Versão:** 1.0
**Data:** 2026-04-26

---

## 1. Categorias de dados tratados

### 1.1 Dados pessoais comuns
- Nome, telefone, email do paciente
- Nome, email do médico
- Nome, email da secretária

### 1.2 Dados pessoais sensíveis (LGPD Art. 11)
- Motivo da consulta (texto livre, opcional)
- Observações clínicas (texto livre, opcional)
- Histórico de comparecimento/falta
- Tipo de consulta (presencial/online/retorno)

### 1.3 Metadados
- Data e hora de criação/edição/cancelamento
- IP e User-Agent (hashados em logs)
- Token Google encriptado (AES-256-GCM)

---

## 2. Fluxos de dados

### 2.1 Marcação de consulta

```
[Médico ou Secretária] → POST /agenda/slots
                         ↓
                    Validação Zod
                         ↓
                    Lock advisor + transação
                         ↓
                    INSERT AgendaSlot (Postgres Supabase)
                         ↓
                    INSERT TarefaPendente × 2 (lembrete-24h, lembrete-2h)
                         ↓
                    Audit (AuditoriaAcesso) — 20 anos retenção
                         ↓
                    Worker assíncrono envia email/push (Resend / VAPID)
```

**Dados enviados ao paciente:** nome do médico, data/hora, local, motivo (se preenchido), link videochamada (se online).
**Dados que NUNCA saem do banco:** observações clínicas, audit trail, IP de quem criou.

### 2.2 Sincronização Google Calendar (read-only)

```
[Médico] → GET /agenda/google/auth (CSRF state)
            ↓
       Google OAuth consent (scope: calendar.readonly)
            ↓
       GET /agenda/google/callback?code=X&state=Y
            ↓
       Validação state → troca code por refresh_token
            ↓
       Encripta refresh_token com AES-256-GCM (chave AGENDA_TOKEN_KEY)
            ↓
       Salva em Medico.googleTokenEnc + IV + Tag
            ↓
       Worker periódico (30min): fetch eventos próximos 90 dias
            ↓
       Cria/atualiza AgendaSlot com origem=GOOGLE_IMPORT, tipo=BLOQUEIO
       (sem título, label "Ocupado · Google" no display — LGPD)
```

**O que vita id NÃO faz:**
- Não chama `events.insert` (sem escrita)
- Não chama `events.delete` no Google
- Não armazena título/descrição/local de eventos pessoais (apenas horário)
- Não compartilha esses dados com pacientes ou secretárias

### 2.3 Lembrete ao paciente

```
Worker pega TarefaPendente LEMBRETE_24H ou LEMBRETE_2H
   ↓
Verifica slot.status NÃO está em (CANCELADA, REMARCADA)
   ↓
Verifica slot.desfeitoAte < now() (passou janela de desfazer)
   ↓
Verifica !slot.lembrete*Sent (idempotência)
   ↓
Tenta canal 1: email Resend → template lembrete-{tipo}.html
   - Render com nome paciente, data/hora, local, link confirmar/recusar
   - Token HMAC pra confirmação sem login
   ↓
Tenta canal 2: push web (se PushSubscription ativa)
   ↓
Se falha em ambos: registra contador agenda_lembrete_falhou; backoff worker
   Após 5 tentativas: dead=true; médico vê badge "lembrete não enviado"
```

### 2.4 Acesso por secretária (multi-user)

```
Secretária faz login → JWT com role=SECRETARIA
   ↓
GET /agenda/slots?medicoId=X
   ↓
Middleware permission.js verifica SecretariaVinculo ativo
   ↓
Se OK: retorna slots SEM campos clínicos sensíveis
   - Inclui: paciente.nome, paciente.telefone, slot.inicio/fim, slot.tipo, slot.local
   - Exclui: motivo (se marcado clínico-sensível), observações
   ↓
Tentativa de acessar /pre-consulta/:id ou /exames → 403
```

---

## 3. Direitos do titular (LGPD Art. 18)

| Direito | Como exercer | Implementação |
|---|---|---|
| Acesso aos dados | `GET /auth/exportar-dados` | JSON completo: perfil + slots + audit visível |
| Correção | Editar via app ou suporte | Endpoint `/perfil` + audit |
| Exclusão | `DELETE /auth/conta` | Anonimiza paciente em slots (`pacienteId=null`, `pacienteNomeLivre='Paciente excluído'`); preserva histórico clínico do médico (LGPD Art. 7º §2 — finalidade legítima saúde) |
| Portabilidade | `GET /agenda/stats/export-csv` | CSV com todos os slots do paciente |
| Revogação consentimento lembretes | Link opt-out no rodapé de cada email | Marca `Config.lembreteOptOut[pacienteId]=true` |
| Informação | FAQ + Política de Privacidade | `docs/faq-agenda.md` + `lgpd.html` |

---

## 4. Bases legais (LGPD Art. 7 e 11)

| Tratamento | Base legal |
|---|---|
| Marcação de consulta + dados de contato | Execução de contrato (Art. 7º V) |
| Lembretes automáticos | Legítimo interesse (Art. 7º IX) — opt-out disponível |
| Compartilhamento entre médico e secretária | Consentimento expresso do médico ao convidar; secretária assina termo de confidencialidade |
| Histórico de comparecimento (FALTA/COMPARECEU) | Tutela da saúde (Art. 11º II f) |
| Auditoria de acessos | Cumprimento de obrigação legal (Art. 7º II) — CFM/CRM |
| Sincronização com Google Calendar pessoal | Consentimento explícito do médico (toggle separado) |

---

## 5. Retenção e eliminação

| Dado | Período | Justificativa |
|---|---|---|
| AgendaSlot histórico | 20 anos | CFM Res. 1638/2002 (prontuário) |
| Audit trail | 20 anos | LGPD + CFM |
| TarefaPendente processada | 90 dias | Operacional |
| PushSubscription inativa | 30 dias após `falhouEm` | Higiene do banco |
| Token Google encriptado | até desconexão | Operacional |
| Logs Sentry | 90 dias | Política Sentry padrão |
| Backup pg_dump | 30 dias rotativo | DR |

---

## 6. Compartilhamento com terceiros

| Terceiro | Dados compartilhados | Finalidade | Salvaguarda |
|---|---|---|---|
| **Resend** (email) | Nome, email do paciente, conteúdo lembrete | Entrega de email | DPA assinado; Brasil-EU adequação (UE) |
| **VAPID Push** (web push) | Endpoint do navegador (UUID) | Entrega de push | Sem PII no payload |
| **Google Calendar** (leitura) | Token OAuth (scope readonly) | Importar bloqueios | Consentimento explícito; encriptado |
| **Jitsi Meet** (videocall) | Slot ID gerado randomicamente | Sala única por consulta | Sala efêmera; sem cadastro; sem persistência |
| **Supabase** (DB + storage) | Todos os dados | Hospedagem | DPA assinado; servidor SP-Brasil; SSL obrigatório |
| **Railway** (host backend) | Logs operacionais (sem PII após scrub) | Hospedagem | DPA padrão |
| **Sentry** (errors, opcional) | Stack traces sem PII | Debug | Scrub LGPD ativo (Art. 11) |

---

## 7. Encarregado de Dados (DPO)

Lucas Borelli (founder) atua como DPO até estruturação de equipe. Contato: [email a definir].

---

## 8. Avaliação de Impacto (DPIA simplificado)

**Necessidade:** confirmada — fluxo de agendamento médico requer dados de contato + horário.
**Proporcionalidade:** dados mínimos coletados; observações clínicas opcionais.
**Riscos:** mapeados em `agenda-risk-analysis.md`.
**Salvaguardas:** encryption, RBAC, audit, opt-out, scrub em logs, dark launch + canário com rollback ≤60s.

---

## 9. Notificação de incidente

Em caso de violação:
1. Detectar via Sentry/observabilidade.
2. Conter: flag OFF em ≤60s.
3. Avaliar escopo (quantos titulares afetados, dados expostos).
4. Notificar ANPD em ≤72h se risco relevante (LGPD Art. 48).
5. Notificar titulares afetados.
6. Post-mortem em `docs/post-mortems/`.
