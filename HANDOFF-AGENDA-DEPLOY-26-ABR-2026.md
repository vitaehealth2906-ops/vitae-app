# Handoff Agenda v1 — Deploy 26-Abr-2026

> **Status:** Código 100% implementado, testado local, commitado (`be78f2d`) e pushado pra `main`. Railway redeployou automaticamente. Schema (ETAPA 8) é aplicado via boot idempotente — não precisa rodar `prisma db push` separado.
>
> **Modo atual:** **DARK** (`AGENDA_V1_ENABLED=false`). Zero efeito visível em produção. Tudo pronto pra ativar quando quiser.

---

## ✅ O que JÁ está pronto e em produção (modo dark)

- 6 tabelas novas no banco (`config_agenda`, `locais_atendimento`, `agenda_slots`, `lista_espera`, `secretaria_vinculos`, `push_subscriptions`)
- Colunas novas em `pre_consultas` (finalização + retorno) e `medicos` (Google OAuth encriptado)
- Status `FINALIZADA` no enum de PreConsulta
- 38 endpoints REST em `/agenda/*` (gated por feature flag → 503 se off)
- Worker em background: lembretes a cada 2min, no-show a cada 1h, Google sync a cada 30min (todos só rodam se flag ON)
- Frontend desktop: sidebar "Agenda" + "Stats", view-agenda completa estilo Google Calendar, 2 botões no briefing (Finalizar atendimento / Finalizar e marcar retorno), modo retorno em tela nova, aba Stats com hero R$ + 3 cards
- Frontend mobile paciente: card "Próxima consulta" no `08-perfil.html`, lista real em `23-agendamentos.html`, push subscription automático
- Service Worker raiz `sw.js` com push notifications
- Multi-user secretária com convite por email (7 dias, single-use)
- Google Calendar OAuth read-only (AES-256-GCM no token)
- 6 templates de email institucionais (consulta marcada / lembrete 24h / lembrete 2h / convite secretária / oferta lista espera / Google desconectado)
- Audit trail (12 ações) e LGPD (pseudonimização, opt-out, retenção 20 anos)
- Docs compliance: `docs/compliance/agenda-risk-analysis.md`, `docs/compliance/agenda-data-flow.md`, `docs/faq-agenda.md`

---

## 🚨 O QUE VOCÊ PRECISA FAZER (passo-a-passo)

### 1. Backup de segurança (5 min) — **OBRIGATÓRIO**

Antes de qualquer ativação:
```bash
cd d:/vitae-app-github
railway run pg_dump $DATABASE_URL > backup-pre-agenda-26abr2026.sql
git tag v-pre-agenda-26abr2026
git push origin v-pre-agenda-26abr2026
```
Salva o `backup-pre-agenda-26abr2026.sql` num local seguro fora do repo (Drive, USB).

### 2. Gerar chaves de encriptação (3 min)

#### 2.1 Chave AES pra token Google
No terminal local:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
Copia a string (44 caracteres terminada em `=`).

#### 2.2 Chaves VAPID pra push web
No terminal local (já tenho web-push instalado):
```bash
cd d:/vitae-app-github/backend
npx web-push generate-vapid-keys
```
Copia `Public Key:` e `Private Key:` (são 2 strings).

### 3. Configurar Railway (10 min) — variáveis de ambiente

No Dashboard Railway → projeto vita id → Environment → adicionar:

```
AGENDA_V1_ENABLED=false                  # ← deixa false! Você ativa depois.
AGENDA_GCAL_ENABLED=false                # ← idem.
AGENDA_DARK_USERS=                       # ← vazio por enquanto. Estágio 1 você coloca seu user-id.
AGENDA_TOKEN_KEY=<a chave de 2.1>
VAPID_PUBLIC_KEY=<public key de 2.2>
VAPID_PRIVATE_KEY=<private key de 2.2>
VAPID_SUBJECT=mailto:vitae.health2906@gmail.com
```

Salva. Railway redeploya sozinho em ~30s.

### 4. Setup Google Cloud Console (30 min) — só se quiser GCal na v1

Se você quer Google Calendar funcionando no estágio 2 em diante:

#### 4.1 Criar projeto
- Acessa `console.cloud.google.com`
- Topo: dropdown de projeto → "Novo projeto"
- Nome: **vita-id-agenda**
- Cria

#### 4.2 Habilitar API
- Menu (☰) → "APIs e serviços" → "Biblioteca"
- Procura "Google Calendar API" → clica → **HABILITAR**

#### 4.3 Configurar tela de consentimento
- Menu → "APIs e serviços" → "Tela de permissão OAuth"
- Tipo: **Externo** (médicos vão usar contas Google pessoais) → Criar
- Nome do app: `vita id`
- Email de suporte: `vitae.health2906@gmail.com`
- Logo: pode pular
- Domínios autorizados: `vitae-app-production.up.railway.app`
- Email do desenvolvedor: idem
- Salvar e continuar
- **Escopos:** clica "Adicionar escopos" → marca `https://www.googleapis.com/auth/calendar.readonly` → salvar
- **Usuários teste:** adiciona seu email + email do médico betatester
- Salvar tudo

#### 4.4 Criar credenciais OAuth
- Menu → "APIs e serviços" → "Credenciais"
- "Criar credenciais" → "ID do cliente OAuth"
- Tipo de aplicativo: **Aplicativo da Web**
- Nome: `vita id - Web`
- **URIs de redirecionamento autorizadas** (adiciona AS DUAS):
  - `https://vitae-app-production.up.railway.app/agenda/google/callback`
  - `http://localhost:3001/agenda/google/callback` (pra testes locais)
- Criar
- Aparece um modal com **Client ID** e **Client Secret** — copia AS DUAS strings

#### 4.5 Adicionar no Railway
```
GCAL_CLIENT_ID=<o client id que voce copiou>
GCAL_CLIENT_SECRET=<o client secret>
GCAL_REDIRECT_URI=https://vitae-app-production.up.railway.app/agenda/google/callback
```
Salvar. Railway redeploya.

### 5. Estágio 1 — Dark Launch (24h, só você vê)

Quando chaves todas configuradas:

a) Pega seu `userId` (do banco, da tua conta médica). Pode pegar via console F12:
```js
fetch('/perfil/me', { headers: { Authorization: 'Bearer ' + localStorage.getItem('vitae_token') }}).then(r=>r.json()).then(console.log)
```
Copia o `id`.

b) Railway → variáveis:
```
AGENDA_V1_ENABLED=true
AGENDA_DARK_USERS=<seu-userId-aqui>
```

c) Aguarda redeploy (~30s).

d) Abre `https://vitae-app-production.up.railway.app/desktop/app.html`. Sidebar deve mostrar "Agenda" e "Stats". Outros médicos não veem.

e) Testa fluxo:
- Clica Agenda → tela de config inicial → preenche → tour 3 slides
- Clica + e marca um slot teste pra você mesmo (paciente livre por nome) amanhã 14h
- Clica no slot → cancela → toast desfazer 10s
- Espera 11s → confirma cancelado
- Cria de novo
- Volta no Dashboard → entra numa pre-consulta RESPONDIDA → vê 2 botões novos
- Clica "Finalizar atendimento" → toast → vai pra Pre-Consultas
- Outra PC → "Finalizar e marcar retorno" → agenda abre em modo retorno → clica num slot livre → confirma → toast → volta dashboard
- Clica Stats → vê hero R$ (provavelmente R$0 no início)
- Se ativou GCal: Configurações → Conectar Google → autoriza → eventos pessoais aparecem como bloqueios cinza
- Convida secretária pra email teste → recebe email → loga conta dela → vê agenda só

f) Se 24h sem erros (Sentry zero, health verde), avança pra estágio 2.

### 6. Estágio 2 — Interna (48h)

Convida 1-2 médicos betatester. Manda link do app + senha + breve guia (FAQ está em `docs/faq-agenda.md`).

Adiciona o userId deles em `AGENDA_DARK_USERS`:
```
AGENDA_DARK_USERS=<seu-id>,<medico1-id>,<medico2-id>
```

48h. Eles testam livremente. Se zero P0 abertos, avança.

### 7. Estágio 3 — Canário 5% (7 dias)

Limpa `AGENDA_DARK_USERS`:
```
AGENDA_DARK_USERS=
```

Edita `backend/src/services/agenda/index.js` função `isVisibleForUser` pra fazer canário (hoje retorna true se vazio = todos veem):

```js
function isVisibleForUser(usuarioId) {
  if (!enabled()) return false;
  const lista = (process.env.AGENDA_DARK_USERS || '').trim();
  if (lista) return isDarkUser(usuarioId);
  // Canário 5%: hash do userId
  const pct = parseInt(process.env.AGENDA_CANARY_PCT || '0');
  if (pct > 0 && pct < 100) {
    const h = require('crypto').createHash('md5').update(usuarioId).digest('hex');
    const n = parseInt(h.slice(0, 8), 16) % 100;
    return n < pct;
  }
  return true;
}
```

Adiciona `AGENDA_CANARY_PCT=5` no Railway. Commit + push.

### 8. Estágio 4 — 100% (permanente)

Após 7 dias estável, remove `AGENDA_CANARY_PCT` (ou põe 100). 100% dos médicos veem.

Mantém monitoramento 30 dias. Depois pode tirar a flag do código se quiser (ou deixa como kill-switch).

---

## 📊 Como monitorar

- **Health:** `GET /health` → deve retornar `{status:'ok'}`
- **Railway logs:** acompanhe `[MIGRATE] ETAPA 8`, `[WORKER]`, erros
- **Sentry:** se tiver `SENTRY_DSN` setado, agrupado por `feature=agenda`
- **Métricas-chave**:
  - Marcação ≤1.5s p95 (Sentry transaction)
  - Erro 5xx em `/agenda/*` ≤0.5%
  - Lembretes delivery rate ≥85% (worker log)

---

## 🚨 Rollback rápido (≤60s)

Se algo der errado em produção:

**Railway → variáveis → `AGENDA_V1_ENABLED=false` → Save.**

Em ~30-60s tudo some. Rota retorna 503. Frontend mostra "Em manutenção". Dados ficam intactos (nunca apaga slot).

---

## 🐛 Troubleshooting comum

**"Agenda em manutenção"** → flag `AGENDA_V1_ENABLED=false`. Coloca true.

**"Modulo Agenda em rollout gradual"** → flag ON mas seu userId não está em `AGENDA_DARK_USERS`. Adiciona.

**"GCAL_DESATIVADO"** → `AGENDA_GCAL_ENABLED=false` ou `GCAL_CLIENT_ID` vazio. Setup do Google Cloud (passo 4).

**Lembretes não chegam** → checa Resend dashboard (cota 3000/mês grátis). Logs Railway buscam `[EMAIL BYPASS]` (sem RESEND_API_KEY) ou erros do worker.

**Push não chega** → confira `VAPID_PUBLIC_KEY` setada. Paciente precisa ter clicado em "permitir notificações" no navegador. iOS Safari só suporta push em PWA instalada.

**"AGENDA_TOKEN_KEY ausente"** → rode passo 2.1 e adiciona em Railway.

**Erro Prisma "table does not exist"** → ETAPA 8 não rodou no boot. Ver logs Railway no startup. Se persistir, rode manual:
```bash
railway run npx prisma db push   # SEM --accept-data-loss; revisa diff
```

---

## 📁 Arquivos criados nesta entrega (resumo)

**Backend** (10 arquivos novos + 4 modificados):
- `backend/src/routes/agenda.js` (38 endpoints)
- `backend/src/services/agenda/{crypto,timezone,slots,finalizar,lembretes,push,espera,google-sync,email-templates,index}.js`
- `backend/src/middleware/permission.js` (Marco 1)
- `backend/prisma/schema.prisma` (6 tabelas + colunas)
- `backend/src/index.js` (ETAPA 8 SQL idempotente + monta /agenda)
- `backend/src/workers/processador.js` (3 ticks novos)
- `backend/.env.example` (10 envs novas)

**Frontend** (5 arquivos modificados):
- `desktop/app.html` (sidebar + view-agenda + view-stats + 2 botões briefing + agendaInit/statsInit)
- `08-perfil.html` (card próxima consulta v2 + push subscription)
- `23-agendamentos.html` (lista real)
- `api.js` (30+ métodos novos)
- `sw.js` (service worker raiz)

**Docs** (3 novos):
- `docs/compliance/agenda-risk-analysis.md` (ISO 14971)
- `docs/compliance/agenda-data-flow.md` (LGPD)
- `docs/faq-agenda.md`

---

## 📈 Métricas pós-deploy não-negociáveis

| Métrica | Meta | Onde medir |
|---|---|---|
| Marcação slot | ≤1.5s p95 | Sentry / logs |
| Sync GCal | ≤30s | worker log |
| Erro /agenda/* | ≤0.5% | rate limit |
| Uptime | ≥99.5% | Railway |
| Pre-consultas finalizadas em 30d | ≥80% | `/agenda/stats` |
| Retornos marcados (vs sem) | ≥40% | idem |
| No-show -20% vs baseline | ≥20% | comparativo |
| Lembrete delivery | ≥85% | worker log |

---

## ⏭️ Próximos passos sugeridos (quando você quiser)

1. **Crie 1 médico betatester** que confia em você e topa testar 1 semana
2. **Faça os 5 passos acima** — backup, chaves, Railway envs, Google Cloud, dark launch
3. **Em 24h sem bugs:** vai pra estágio 2 com o betatester
4. **Em 48h:** estágio 3 canário 5%
5. **Em 7 dias estável:** estágio 4 100%

Total: ~10 dias da hoje pra produção 100%.

Qualquer coisa que travar, me chama. Aqui no projeto pode investigar logs, debugar, ajustar — sem precisar reescrever nada.

---

Fim do handoff. **Commit `be78f2d` é o ponto de retorno seguro.**
