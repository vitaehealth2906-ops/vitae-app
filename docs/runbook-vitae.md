# Runbook VITAE — Operações de Produção

**Última atualização:** 2026-05-05
**Mantenedor:** Lucas Borelli + Claude Code
**Pra quem:** quem precisa fazer rollback, restaurar dados, debugar incidente em produção

---

## 🚨 EMERGÊNCIAS — Procedimentos rápidos

### 1. Erro crítico em produção — Rollback do app-v2 → legacy

**Quando usar:** error rate > 0.5%, NPS médico < 7, queixa crítica do betatester, ou métrica anômala (PCs/dia caindo, latência subindo).

**Tempo:** < 5 minutos.

**Passos:**
1. Editar `vercel.json` no GitHub (ou localmente):
   - Mudar `"source": "/desktop"` rewrite pra apontar pra `app-legacy-2026-05-05.html`
2. Fazer commit + push pra `main`:
   ```
   git commit -am "rollback: voltar desktop pra legacy" && git push
   ```
3. Vercel faz redeploy automático em ~60-90s
4. Confirmar acessando `vitae-app.vercel.app/desktop/`
5. Médicos que tinham toggle "voltar pro antigo" no localStorage continuam vendo legacy
6. Se quiser forçar TODOS a voltarem: limpar cache no Vercel + adicionar header `Cache-Control: no-cache`

**Sinal de sucesso:** o `app-legacy` carrega normalmente, sem erro 404 ou 500.

---

### 2. Banco de dados corrompido / migration deu errado

**Tempo:** 15-30 min com backup local. 1-2h sem backup.

**Backup mais recente:** `d:/vitae-app-novo/backups/vitae-pre-fase7-2026-05-05.dump` (MD5 53697cb7)

**Restauração:**
```bash
"C:/Program Files/PostgreSQL/18/bin/pg_restore.exe" \
  --dbname="postgresql://postgres.zkpilzhyrhsptoujhflz:SENHA@aws-0-us-west-2.pooler.supabase.com:5432/postgres" \
  --clean --if-exists --no-owner --no-acl \
  d:/vitae-app-novo/backups/vitae-pre-fase7-2026-05-05.dump
```

⚠️ `--clean` apaga objetos antes de recriar. Tem confirmação interna do `pg_restore`.

**Verificação pós-restauração:**
```sql
SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY n_live_tup DESC;
-- Deve bater com baseline em vitae-pre-fase7-2026-05-05.baseline.txt
```

---

### 3. Token JWT vazado / acesso indevido

1. Mudar `JWT_SECRET` no Railway (Settings → Variables) — invalida TODOS os tokens
2. Mudar `REFRESH_SECRET` também
3. Trigger redeploy
4. Avisa usuários: precisarão logar de novo

---

### 4. Senha do banco vazou

1. Supabase → Settings → Database → **Reset database password**
2. Copiar a nova senha
3. Railway → Variables → atualizar `DATABASE_URL` com a nova senha
4. Railway → Deployments → Redeploy
5. Esperar 1-2 min até o backend voltar
6. Verificar `/health` retornando 200

---

## 📊 Monitoramento diário

### Métricas a acompanhar (D+0 a D+30 pós-cutover)

| Métrica | Onde ver | Alerta se |
|---|---|---|
| Error rate (5xx) | Sentry → Issues | > 0.5% por 1h |
| Latência média | Railway → Metrics | > 800ms p95 |
| PCs respondidas/dia | `SELECT COUNT(*) FROM pre_consultas WHERE respondida_em::date = CURRENT_DATE` | Cai > 30% vs média 7d |
| Logins/dia | `SELECT COUNT(*) FROM refresh_tokens WHERE criado_em::date = CURRENT_DATE` | Cai > 30% |
| Storage | Supabase → Storage → buckets | > 80% do limite |

### Comandos úteis

```sql
-- PCs do dia
SELECT COUNT(*) FROM pre_consultas WHERE respondida_em::date = CURRENT_DATE;

-- Médicos ativos (login últimos 7 dias)
SELECT COUNT(DISTINCT u.id) FROM usuarios u
JOIN refresh_tokens rt ON rt.usuario_id = u.id
WHERE u.tipo = 'MEDICO' AND rt.criado_em > NOW() - INTERVAL '7 days';

-- Análises prosódicas geradas (Fase 9)
SELECT COUNT(*), DATE_TRUNC('day', criado_em) FROM analise_prosodica_arquive
GROUP BY 2 ORDER BY 2 DESC LIMIT 14;

-- Disparos WhatsApp por status
SELECT status, modo, COUNT(*) FROM notificacao_disparos
WHERE criado_em > NOW() - INTERVAL '7 days'
GROUP BY 1, 2;

-- Médicos com exclusão agendada (Fase 11)
SELECT id, usuario_id, excluido_em, exclusao_agendada_para FROM medicos
WHERE excluido_em IS NOT NULL ORDER BY exclusao_agendada_para;
```

---

## 🔄 Operações periódicas

### Hard-delete de contas após 30 dias (Fase 11)

Worker que precisa rodar 1x/dia (cron):

```sql
-- Identificar contas pra hard-delete
SELECT id, exclusao_agendada_para FROM medicos
WHERE exclusao_agendada_para < NOW();
```

Se houver: deletar via API ou SQL com cuidado. Manter PCs do paciente (anonimizando referências ao médico).

### Rotação de chaves (a cada 90 dias)

- `JWT_SECRET` — rotacionar invalida tokens (downtime ~30s)
- `REFRESH_SECRET` — idem
- `ADMIN_TOKEN` — só usado em rotas /admin/*

### Snapshot manual semanal (até upgradar Supabase Pro)

```bash
"C:/Program Files/PostgreSQL/18/bin/pg_dump.exe" \
  "postgresql://postgres.zkpilzhyrhsptoujhflz:SENHA@aws-0-us-west-2.pooler.supabase.com:5432/postgres" \
  -F c \
  -f "d:/vitae-app-novo/backups/vitae-semanal-$(date +%Y-%m-%d).dump"
```

Reter os últimos 4 backups (1 mês de cobertura).

---

## 🧪 Smoke test pós-deploy

Cada deploy do Railway/Vercel deve ser seguido por:

1. `curl https://vitae-app-production.up.railway.app/health` → 200
2. Login com conta médica de teste
3. Abrir aba **Hoje** — deve ver agenda
4. Abrir aba **Pré-Consultas** — deve listar
5. Clicar em 1 PC respondida — deve mostrar summary
6. Abrir aba **Pacientes** — lista
7. Abrir aba **Templates** — lista
8. Logout

**Bateria automática:** `node tests/run.js` (ver `tests/`)

---

## 🐛 Problemas comuns + soluções

### "Sessão expirou" infinito após login
- Verificar JWT_SECRET no Railway está setado
- Verificar refresh token foi salvo (cookies OU localStorage)
- Limpar localStorage e tentar de novo

### Pré-consulta com summaryJson vazio
- Verificar `tarefas_pendentes` table — pode estar travada
- Forçar regenerar via UI ou via console: `vitaeAPI.regenerarSummaryPreConsulta(id)`

### Foto do paciente não aparece
- Verificar URL é pública no Supabase Storage
- Bucket `fotos-perfil` precisa estar com policy `public read`

### "Não foi possível salvar" no Perfil
- Verificar Zod validation no backend — campo fora do range?
- Console F12 mostra detalhes via `vitaeAuthError`

### Análise prosódica ativada mas alerta nunca aparece
- Threshold conservador por design
- Modo `mock` precisa de transcrição com >30s de áudio
- Modo `real` ainda não implementado

---

## 📞 Contatos de emergência

- **Lucas Borelli** (founder): WhatsApp pessoal
- **Supabase** support: support@supabase.io (apenas plano Pro)
- **Railway** support: help@railway.app
- **Vercel** support: dashboard → Help

---

## 📚 Referências

- Plano mestre: `C:/Users/valve/.claude/plans/voce-naoe-sta-entnendedo-synthetic-bee.md`
- Bitácora execução: `docs/migracao/EXECUCAO-AUTONOMA.md`
- Contrato API: `docs/migracao/01-contrato-api.md`
- Escopo congelado: `docs/migracao/00-escopo-congelado.md`
- Compliance: `docs/compliance/`
- CLAUDE.md: `d:/vitae-app-novo/CLAUDE.md` (regras do projeto)
