# Handoff Agenda v1 — Deploy 26-Abr-2026 (ATUALIZADO)

> **Status:** Código deployado em produção. Schema aplicado. Envs configuradas.
> **Modo atual:** **DARK** (flag `AGENDA_V1_ENABLED=false`). Zero efeito visível.
> **Pra você ver Agenda na sua conta:** falta apenas 1 clique no Railway (passo 1 abaixo).

---

## ✅ O QUE EU JÁ FIZ POR VOCÊ (não precisa mexer)

| O que | Status | Detalhe |
|---|---|---|
| Backup lógico do banco prod | ✅ feito | `backup-pre-agenda-26abr2026.json` (44 usuários, 4 médicos, 17 pre-consultas, 42 exames preservados) |
| Tag git de retorno seguro | ✅ feito | `v-pre-agenda-26abr2026` |
| Schema 6 tabelas + colunas em prod | ✅ aplicado | Via boot idempotente (ETAPA 8). Logs Railway confirmam: `[MIGRATE] ETAPA 8 (Agenda v1) OK` |
| Chave AES-256 (AGENDA_TOKEN_KEY) | ✅ gerada + setada no Railway | 32 bytes base64 |
| Chaves VAPID (push web) | ✅ geradas + setadas no Railway | Public + Private + Subject |
| Flag `AGENDA_V1_ENABLED` | ✅ setada | `false` (modo dark) |
| Flag `AGENDA_GCAL_ENABLED` | ✅ setada | `false` (até você fazer setup Google) |
| Sua user ID em `AGENDA_DARK_USERS` | ✅ pré-configurada | `2ca33817-16e4-47d8-9ce8-b41102cdb4dc` (Lucas Borelli) |
| Health prod | ✅ green | `https://vitae-app-production.up.railway.app/health` retorna `ok` |
| `/agenda/config` | ✅ retorna 503 | Esperado em modo dark — protege do mundo |
| Frontend desktop deployado | ✅ no GitHub Pages | sidebar tem Agenda+Stats, botões prontos no briefing |

**Commit final:** `cb682d2` na main. Railway redeployou automaticamente.

---

## 🚦 PRA ATIVAR PRA VOCÊ (estágio 1 dark launch — só 1 clique)

### Opção A — via Railway Dashboard (mais visual)

1. Abre `railway.app/project/daring-nurturing` (você já está logado)
2. Clica no service `vitae-app`
3. Aba **Variables**
4. Procura `AGENDA_V1_ENABLED` → muda de `false` pra `true` → Save
5. Espera ~30-60s (Railway redeploya)
6. Abre `https://vitaehealth2906-ops.github.io/vitae-app/desktop/app.html` (logado como você)
7. Sidebar agora mostra **Agenda** e **Stats**

### Opção B — via terminal (mais rápido)

```bash
cd d:/vitae-app-github
railway variables --set "AGENDA_V1_ENABLED=true"
```

(Não precisa `--skip-deploys` — você QUER que redeploye pra refletir.)

---

## 🧪 Roteiro de teste rápido (15 min)

Depois de ativar:

1. **Sidebar Agenda → 1ª vez carregando**: deve aparecer tela de config inicial → preenche → salva
2. **Tour 3 slides** aparece automaticamente → fecha
3. **Marca um slot teste**: clica `+ Marcar consulta` → digita "Maria Teste" → confirma. Aparece no calendário hoje 9h
4. **Cancela**: clica no slot → cancelar → toast com "Desfazer" 10s
5. **Desfaz**: clica Desfazer → slot reaparece
6. **Cancela de novo**: aguarda 11s → confirma cancelado
7. **Briefing → Finalizar atendimento**: Dashboard → Pre-Consultas → entra numa RESPONDIDA → vê 2 botões novos no topo
8. **Finalizar atendimento (cinza)**: clica → toast → vai pra Pre-Consultas, status FINALIZADA
9. **Outra PC → Finalizar e marcar retorno (verde)**: clica → agenda abre em modo retorno (banner verde no topo) → clica num slot livre +15d → confirma → toast → volta dashboard
10. **Stats**: sidebar → Stats → vê hero R$ no-show evitado (provavelmente R$0 no início — normal)
11. **Mobile paciente**: abre `08-perfil.html` no celular → aparece card "Próxima consulta" se você for paciente de algum médico

Se tudo isso passar: **dark launch validado**. Pode adicionar betatesters em `AGENDA_DARK_USERS` (CSV de userIds, separados por vírgula).

---

## 🌐 OPCIONAL: Setup Google Calendar (estágio 2+ se quiser)

Se você quer que eventos pessoais do Google apareçam como bloqueios cinza na agenda. **Não é obrigatório pra v1 funcionar.**

### Passo único: criar OAuth Client no Google Cloud

1. Abre `console.cloud.google.com`
2. Topo: dropdown projeto → **Novo projeto** → nome `vita-id-agenda` → criar
3. Menu (☰) → **APIs e serviços** → **Biblioteca** → procura "Google Calendar API" → **HABILITAR**
4. Menu → **APIs e serviços** → **Tela de permissão OAuth**:
   - Tipo: **Externo**
   - Nome: `vita id`
   - Email suporte: `vitae.health2906@gmail.com`
   - Domínios autorizados: `vitae-app-production.up.railway.app`
   - Email desenvolvedor: idem
   - **Escopos**: adicionar `https://www.googleapis.com/auth/calendar.readonly`
   - **Usuários teste**: adicionar seu email
   - Salvar
5. Menu → **APIs e serviços** → **Credenciais** → **Criar credenciais** → **ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**
   - Nome: `vita id - Web`
   - URIs redirecionamento autorizadas (cola AS DUAS):
     - `https://vitae-app-production.up.railway.app/agenda/google/callback`
     - `http://localhost:3001/agenda/google/callback`
   - Criar → copia **Client ID** e **Client Secret**

6. Setar no Railway via terminal:
```bash
cd d:/vitae-app-github
railway variables --set "GCAL_CLIENT_ID=<o-client-id>" --set "GCAL_CLIENT_SECRET=<o-secret>" --set "GCAL_REDIRECT_URI=https://vitae-app-production.up.railway.app/agenda/google/callback" --set "AGENDA_GCAL_ENABLED=true"
```

7. Aguarda redeploy. Volta na Agenda → Configurações → "Conectar Google" → autoriza → eventos pessoais aparecem como bloqueios cinza listrado.

---

## 🚨 Rollback rápido se algo der errado

Em qualquer momento, ≤60s:

```bash
railway variables --set "AGENDA_V1_ENABLED=false"
```

Pronto. Tudo some. Dados intactos (nunca apaga slot — só status=CANCELADA).

---

## 📊 Como monitorar

```bash
# Logs ao vivo
railway logs --tail

# Health
curl https://vitae-app-production.up.railway.app/health

# Tentar /agenda (deve dar 503 se flag off, ou 200/401 se on)
curl https://vitae-app-production.up.railway.app/agenda/config
```

Sentry (se DSN setada) agrupa erros com tag `feature=agenda`.

---

## 🎯 Plano de rollout sugerido

| Estágio | Quando | O que muda |
|---|---|---|
| **1. Dark launch** | Você ativar (passo acima) | Só você vê. Testa tudo 24-48h. |
| **2. Interna** | Após 1-2 dias OK | Adiciona 1-2 médicos betatester em `AGENDA_DARK_USERS` (CSV) |
| **3. Canário 5%** | Após 1 semana sem P0 | Limpa `AGENDA_DARK_USERS=` e deixa flag global ON. (Ou pede pra eu implementar canário hash baseado em userId — em 30 min) |
| **4. 100%** | Após 7 dias canário OK | Já está liberado pra todos com flag ON e dark vazio |

---

## 📁 Arquivos neste deploy

- **52 arquivos** tocados (18 modificações + 34 criações)
- **3.595 linhas** de código novo
- **Todos os commits**: `7410c1d` (Marco 1) + `be78f2d` (Marco 2-7) + `cb682d2` (handoff)
- **Tag retorno**: `v-pre-agenda-26abr2026`
- **Backup lógico**: `backup-pre-agenda-26abr2026.json` (na raiz do repo, **não commitado** — guarda local)

---

## 🔐 Variáveis Railway atualmente configuradas (verificadas)

```
✅ AGENDA_V1_ENABLED         = false
✅ AGENDA_GCAL_ENABLED       = false
✅ AGENDA_DARK_USERS         = 2ca33817-16e4-47d8-9ce8-b41102cdb4dc
✅ AGENDA_TOKEN_KEY          = (32 bytes AES configurada)
✅ VAPID_PUBLIC_KEY          = (configurada)
✅ VAPID_PRIVATE_KEY         = (configurada)
✅ VAPID_SUBJECT             = mailto:vitae.health2906@gmail.com

⏳ GCAL_CLIENT_ID            = (vazio — só se quiser Google Calendar)
⏳ GCAL_CLIENT_SECRET        = (vazio — idem)
⏳ GCAL_REDIRECT_URI         = (vazio — idem)
```

---

## ✅ Checklist final pra ativar

- [ ] (opcional) Salvar `backup-pre-agenda-26abr2026.json` num local seguro fora do repo
- [ ] Setar `AGENDA_V1_ENABLED=true` no Railway (via Dashboard ou CLI)
- [ ] Aguardar redeploy ~30s
- [ ] Abrir o app desktop → ver "Agenda" e "Stats" na sidebar
- [ ] Rodar roteiro de teste de 15 min
- [ ] Se tudo OK por 24h → adicionar betatester
- [ ] (opcional) Setup Google Cloud quando quiser

---

**Pra qualquer coisa que travar, me chama.** Logs do Railway, banco prod, código — tudo aqui acessível.
