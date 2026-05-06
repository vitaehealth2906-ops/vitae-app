# Escopo Congelado — Migração Desktop Médico VITAE

**Data:** 2026-05-05
**Versão:** 1.0
**Autorizado por:** Lucas Borelli (founder)
**Executor:** Claude (Plan + Code agents)
**Tag git baseline:** `vitae-legacy-baseline-2026-05-05`

---

## O que ENTRA na migração

### Frontend
- Arquivo único `desktop/app.html` (substituirá o atual)
- Tela `desktop/01-login.html` (criar)
- Backup `desktop/app-legacy-2026-05-05.html` servido em paralelo 90 dias

### 5 abas principais
1. **Hoje** — cockpit com agenda, alertas prosódicos, painel Tempo&Receita, automações
2. **Pré-Consultas** — lista, filtros, busca, summary de 1min com anamnese 11 campos + Padrões Observados v2 + Possíveis Urgências Detectadas
3. **Pacientes** — lista, detalhe com 7 abas internas, IA Collab opt-in
4. **Templates** — CRUD com Phone Preview real do paciente, perguntas por especialidade, popup actions-overlay
5. **Meu Perfil** — 5 sub-abas (Dados, Tempo&Receita, Integrações, Voz, Conta) + modos persona (simples/volume/SUS)

### Modais (33 nominalmente — lista no plano mestre)
### Animações IA (8 — lista no plano mestre)
### Estados globais (banners, toasts, undo, atalhos teclado, spotlight tour, confete)

### Backend novo (14 rotas)
- Listadas no plano mestre, fases 8-11

### Schema (12 colunas em Medico + 1 tabela nova AnaliseProsodicaArquive)
- Fase 7

### Validação
- Bateria Playwright por fase
- Lighthouse audit
- 1 médico betatester, 5 dias úteis, NPS ≥ 8

### Cutover
- A/B Vercel: 10% → 50% → 100%
- Toggle "voltar pro antigo" no Perfil
- 90 dias legacy preservado

---

## O que NÃO ENTRA (descopo)

- Refatorar `pre-consulta.html` (paciente) — fora deste ciclo, mantém como está
- Tela mobile do médico (`20-medico-dashboard.html`) — fora, prioridade desktop
- Telas legadas: CRM & Retornos, Agenda, Notificar Atrasados, Métricas — escondidas do menu, código preservado em legacy
- Integrações futuras: iClinic API real, Conexa, Memed — placeholders apenas
- Recurso de telemedicina (vídeo chamada) — fora
- Plano pago + monetização — placeholder de banner apenas
- Pacientes em massa: importar CSV de pacientes — fora
- Dashboard administrativo VITAE (interno) — fora

---

## Premissas (não-negociáveis)

1. Zero perda de dados em produção (regra de ouro do CLAUDE.md)
2. App-legacy permanece 90 dias após cutover
3. Bateria Playwright 100% verde em cada fase pra fechar fase
4. Lucas aprova marcos críticos por mensagem datada
5. CFM 2.314/2022 + LGPD + ISO 14971 cumpridos
6. Tom institucional, zero emoji, zero "cara de IA" pro paciente

---

## Stakeholders e canal de aprovação

| Decisão | Quem aprova | Canal |
|---|---|---|
| Encerramento de cada fase | Lucas | Mensagem datada no chat Claude |
| Schema migration (Fase 7) | Lucas | Presencial + janela combinada |
| Texto de copy | Lucas | Revisão antes de mergear |
| Cutover A/B (Fase 13) | Lucas | NPS validado + métricas estáveis |
| Aposentadoria legacy (Fase 14) | Lucas | Após 90 dias estáveis |
| Decisões técnicas internas | Claude executa autonomamente, reporta no fechamento | — |

---

## Inventário Vercel + Railway (env vars críticas)

### Vercel (frontend)
- Domínio: vitae-app.vercel.app
- Rewrite atual: `/` → `01-splash.html`

### Railway (backend)
- Endpoint: vitae-app-production.up.railway.app
- Env vars críticas (já existentes — referência, não revelar valores):
  - DATABASE_URL (PostgreSQL Supabase)
  - JWT_SECRET, REFRESH_SECRET
  - CLAUDE_API_KEY (Anthropic)
  - GEMINI_API_KEY (Google)
  - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY
  - RESEND_API_KEY
  - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
  - ADMIN_TOKEN
  - PADROES_V2_ENABLED (atualmente false em prod — ativar em fase 9)

### Env vars NOVAS a adicionar (Fase 9-10)
- GOOGLE_OAUTH_CLIENT_ID
- GOOGLE_OAUTH_CLIENT_SECRET
- GOOGLE_OAUTH_REDIRECT_URI
- WHATSAPP_BUSINESS_API_TOKEN (Twilio Business ou Z-API)
- WHATSAPP_TEMPLATE_SID (template pré-aprovado pela Meta)

---

## Snapshot Supabase (GATE HUMANO antes da Fase 7)

Antes da Fase 7 (schema migration), Lucas deve:
1. Acessar Supabase dashboard
2. Database → Backups → Create manual backup
3. Rotular: `pre-vitae-reform-fase7-{data}`
4. Reter por 365 dias
5. Confirmar contagem de registros das 17 tabelas (anotar em log)

---

## Status atual (final Fase 1)

- [x] Backup `app-legacy-2026-05-05.html` criado
- [x] Tag git `vitae-legacy-baseline-2026-05-05` aplicada localmente
- [x] Pasta `docs/migracao/` criada
- [x] Documento de escopo congelado (este arquivo)
- [ ] Push da tag pro remote (Lucas executa: `git push --tags`)
- [ ] Snapshot Supabase rotulado (Lucas executa antes da Fase 7)
- [ ] Lucas assina escopo por mensagem datada

---

## Plano de execução remanescente

Próximas 13 fases conforme `voce-naoe-sta-entnendedo-synthetic-bee.md`. Bateria Playwright por fase obrigatória. Gates humanos: Fase 7 (schema), Fase 10 (OAuth/Twilio), Fase 13 (cutover).
