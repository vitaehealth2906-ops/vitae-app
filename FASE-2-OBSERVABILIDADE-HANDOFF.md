# FASE 2 — OBSERVABILIDADE — HANDOFF

> Lucas nao pode estar cego. Agora voce tem visao interna do sistema sem depender de medico reclamar.

---

## 1. O QUE FOI FEITO NO CODIGO

### Novo: `backend/src/services/observability.js`
Modulo central de telemetria. Faz 3 coisas:

- **Carrega Sentry automaticamente** se `SENTRY_DSN` estiver setado e o pacote `@sentry/node` instalado. Se nao estiver, segue sem. Zero impacto se desativado.
- **Contador de falhas em memoria** (resetado a cada hora): quantas vezes Gemini falhou, Claude falhou, TTS falhou, Whisper falhou, upload falhou.
- **Alerta automatico** quando contador bate threshold: log estruturado em JSON + envia pro Sentry. Thresholds hoje: 3 falhas duplas de IA, 5 de TTS, 5 de Whisper, 10 de upload em 1h.
- **Anti-LGPD:** sanitiza o contexto antes de logar — nada de queixa, nome, CPF, respostas.

### Novo: `backend/src/routes/admin.js`
3 endpoints protegidos por header `x-admin-token`:

- `GET /admin/health` — status do banco, uptime, memoria, contadores de falha
- `GET /admin/stats` — contagem de usuarios, medicos, pacientes, pre-consultas (24h + total), exames
- `GET /admin/queue` — estado da fila `tarefas_pendentes`: quantas pendentes, mortas, stuck, agrupadas por tipo
- `POST /admin/queue/:id/retry` — forca retry de tarefa morta

Rate limit: o limitePublico (60 req/min) aplicado.

### Novo: `dashboard-admin.html`
Tela visual privada pra Lucas acessar. Acesso via URL direta. Pede ADMIN_TOKEN na tela. Salva o token no localStorage do navegador pra nao pedir de novo. Auto-refresh a cada 30s.

Mostra: saude do banco, uptime, memoria, Sentry on/off, estatisticas, fila de processamento, contadores de falha com threshold visual, tabela de tarefas travadas com botao retry.

### Alterado: `errorHandler.js`
Agora captura exceptions 500 pro Sentry (se ativo) — via `capturarExcecao`. Wrappado em try pra NUNCA deixar observabilidade quebrar o handler.

### Alterado: `workers/processador.js`
Registra falhas nos pontos criticos:
- Whisper falha nos 2 fallbacks → `registrarFalha('whisper_falha')`
- IA falha nas 2 tentativas → `registrarFalha('ia_ambos_falharam')`
- TTS falha → `registrarFalha('tts_falha')`

---

## 2. ACOES MANUAIS URGENTES

### ACAO 1 — Criar ADMIN_TOKEN no Railway (2 minutos)

Sem isso o painel interno nao funciona.

1. Gera token seguro:
   ```
   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
   ```
2. Railway > Variables > adicionar `ADMIN_TOKEN` com o valor.
3. Salvar. Railway redeploy automatico (~1min).
4. Abrir `https://vitae-app.vercel.app/dashboard-admin.html` (ou onde voce hospeda as HTML).
5. Cola o token, clica Conectar. Deve aparecer o painel.

**Seguranca:** esse token e o equivalente a "senha de admin". Guarda num password manager. Nao compartilha. Se vazar, gera outro.

### ACAO 2 — Instalar Sentry (opcional mas MUITO recomendado — 10 minutos)

Sem Sentry voce tem os contadores em memoria (que zeram ao reiniciar) mas nao captura individual de erros.

1. Conta gratis em https://sentry.io (5k eventos/mes free — mais que suficiente).
2. Criar projeto "vitae-backend" tipo Node.js.
3. Copiar o DSN (formato `https://xxxxx@o123.ingest.sentry.io/456789`).
4. No terminal local, na pasta `backend`:
   ```
   npm install @sentry/node
   git add package.json package-lock.json
   ```
5. No Railway > Variables > adicionar `SENTRY_DSN` = o DSN copiado.
6. Railway redeploy automatico. Dashboard admin mostrara "Sentry: ON".

**O que voce ganha:**
- Captura automatica de TODO erro 500 com stack trace
- Alerta por email se erro novo aparecer
- Historico de 30 dias
- Zero dado clinico (codigo sanitiza antes de enviar)

### ACAO 3 — Testar localmente antes de subir (5 min)

1. `cd backend && npm start`
2. Em outro terminal:
   ```
   curl http://localhost:3002/admin/health
   ```
   Deve retornar 503 "ADMIN_TOKEN nao configurado" — OK.
3. Setar temporariamente: `export ADMIN_TOKEN=teste123` e reiniciar.
4. `curl -H "x-admin-token: teste123" http://localhost:3002/admin/health`
   Deve retornar JSON com saude.
5. Abrir `dashboard-admin.html` no browser → colar `teste123` → conectar → ver painel.

---

## 3. O QUE VOCE PASSA A VER AGORA

**Antes da Fase 2:** sistema quebra, voce so sabe quando medico reclama no WhatsApp 2h depois.

**Depois da Fase 2:**
- Painel visual com tudo em 1 tela
- Alertas automaticos quando IA falha 3× em 1h
- Log estruturado (JSON) no Railway pra cada falha — filtravel, searchavel
- Sentry captura erro com stack trace assim que acontece
- Tarefas travadas +30min aparecem em tabela com botao "retry"
- Fila mostra se ta acumulando (sinal de problema)

---

## 4. LIMITES DO QUE FOI FEITO (honestidade)

- **Contadores em memoria** zeram ao reiniciar servidor (Railway cold start, deploy). Sentry resolve isso em parte.
- **Alertas hoje sao LOG + Sentry.** Nao ha SMS nem email pro Lucas. Se Sentry nao estiver configurado, alerta fica so no log — pode passar despercebido. Proxima melhoria: integrar Resend pra mandar email pro Lucas quando threshold bater. Deixado pra fase seguinte se necessario.
- **Sem monitoramento de quota externa** (Supabase storage, ElevenLabs, Claude). Cada servico tem API de uso diferente — precisa integracao dedicada. Pra vita id hoje (beta), checar manualmente 1× por semana resolve. Proxima melhoria: endpoint `/admin/quotas` que puxa de cada servico.
- **Sem alerta de DB offline.** Se o banco cair, `/admin/health` retorna `db: offline` mas ninguem esta olhando. Sentry pega erro quando app tentar usar. Proxima melhoria: ping periodico.

---

## 5. PROXIMO PASSO

Depois de:
1. Criar `ADMIN_TOKEN` no Railway
2. (Opcional) Instalar Sentry + setar `SENTRY_DSN`
3. Validar que `dashboard-admin.html` abre e mostra dados

Me manda **"bora f3"** que eu inicio a Fase 3 (Fundacao no Backend — nivel de briefing, IA em pecas, validacao real de transcricao/audio).
