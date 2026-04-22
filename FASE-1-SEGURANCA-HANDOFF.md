# FASE 1 — LIMPEZA DE SEGURANCA EMERGENCIAL — HANDOFF

> O que fiz automaticamente + o que Lucas precisa fazer manualmente.

---

## 1. O QUE FOI FEITO NO CODIGO (commits pendentes)

### `backend/nixpacks.toml`
- **Removido `prisma db push --accept-data-loss` do start command.** Esse comando rodava a cada deploy — e foi exatamente o vetor do incidente 17/04.
- Agora o start so chama `node src/index.js`. Mudancas de schema precisam ser aplicadas manualmente via `railway run npx prisma db push` (sem a flag).

### `backend/src/middleware/errorHandler.js`
- **Debug info (`debug_code`, `debug_meta`, `debug_message`) agora so aparece em dev.** Em producao, cliente recebe so mensagem amigavel.
- **Meta do Prisma removido dos logs em producao** (podia conter valores do usuario = dados clinicos).
- Logs nunca expoem `req.body` ou `req.query`.

### `backend/src/index.js`
- **CORS mais estrito:** requests sem `origin` (file://, curl) so sao aceitos em dev. Em producao, rejeita. Fecha ataque de HTML local com credenciais.
- **Endpoint `/test-scan` agora so existe em dev.** Era publico e sem auth — vetor de DoS e gasto de cota IA. Em producao nao esta montado.

### `25-summary.html`
- **Sanitizacao XSS em todos os campos renderizados via innerHTML:**
  - Nome do paciente, idade, data, descricao breve
  - Titulo e mensagem dos alertas da IA
  - Conteudo dos cards de Queixa e Historico
  - Itens da lista de referencia
  - Fallback raw "Respostas do paciente"
- **Validacao de `tipo` dos alertas:** so aceita `urgente|atencao|info` (evita injecao de classe CSS via IA).
- **Validacao de `tipo` dos cards de referencia:** so valores conhecidos.
- **Bug B20 corrigido:** `a.mensagem.substring()` nao quebra mais se `mensagem` for undefined.

---

## 2. O QUE LUCAS PRECISA FAZER MANUALMENTE (NAO POSSO FAZER POR VOCE)

### ACAO URGENTE 1 — Rotacionar JWT_SECRET em producao

O audit detectou que o JWT_SECRET atual pode ter vazado (.env pode ter sido commitado no passado, mesmo que hoje esteja no gitignore). **Se alguem tiver copia antiga do repo, pode forjar token e logar como qualquer medico/paciente.**

Passo a passo:

1. Gera uma nova secret segura de 64 caracteres:
   ```
   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
   ```
2. No painel Railway:
   - Abrir o projeto vita id
   - Variables > encontrar `JWT_SECRET`
   - Colar o novo valor
   - Salvar (Railway faz redeploy automatico)
3. Avisar que **todos os usuarios (medicos e pacientes) vao precisar fazer login novamente** — os tokens antigos ficaram invalidos. Isso eh o comportamento esperado e desejado.

**Impacto:** 2-3 minutos de downtime no redeploy. Todos precisam relogar. Risco zerado.

### ACAO URGENTE 2 — Confirmar NODE_ENV=production no Railway

Muita protecao nova depende de `NODE_ENV !== 'production'` pra ligar modo dev. Se isso nao estiver setado corretamente em producao, o CORS aberto e o /test-scan voltam ativos.

Passo:

1. Railway > Variables
2. Confirmar `NODE_ENV` = `production`
3. Se nao estiver, adicionar.

### ACAO URGENTE 3 — Verificar git history do .env

Mesmo que hoje esteja no gitignore, pode ter sido commitado em algum momento. Rodar:

```
git log --all --full-history -- backend/.env
git log --all --full-history -- .env
```

Se retornar qualquer commit, o arquivo foi commitado historicamente. Nesse caso:

- As credenciais comprometidas sao: JWT_SECRET (ja sera rotacionado na Acao 1), ANTHROPIC_API_KEY, GEMINI_API_KEY, SUPABASE_SERVICE_KEY, ELEVENLABS_API_KEY, TWILIO, RESEND.
- **Rotacionar TODAS no respectivo painel** (Anthropic console, Google AI Studio, Supabase > API, ElevenLabs dashboard, Twilio dashboard, Resend dashboard).

Se o `git log` nao retornar nada, sem acao adicional.

### ACAO 4 — Alertas de quota (recomendado)

Antes de abrir pra mais medicos:

1. **Supabase:** painel > Storage > ver quota atual. Se proximo de 800MB, upgrade pro plano Pro ($10/mes) ou ativar rotina de limpeza de audios antigos.
2. **ElevenLabs:** dashboard > Usage. Plano free (10k chars) serve pra testes. Se virar beta com 5+ medicos, Starter ($5/mes) ou desabilitar TTS por enquanto.
3. **Anthropic (Claude):** dashboard > Usage. Configurar alerta de uso em $10/mes pra segurar surpresa.

---

## 3. O QUE NAO FOI ATACADO NESTA FASE (ficam pra fases seguintes)

| Item | Fase que resolve |
|---|---|
| Observabilidade (Sentry, alertas) | Fase 2 |
| Nivel de briefing + IA em pecas + validacao real | Fase 3 |
| Selo visual + fallback honesto | Fase 4 |
| Queixa fiel + contextos do medico | Fase 5 |
| Ingestao por pecas + retomada | Fase 6 |
| WCAG + disclaimer CFM + audit trail | Fase 7 |
| Anotacoes, timeline, print, compartilhar | Fase 8 |
| Hardening de escala + dedupe no worker | Fase 9 |
| Teste ponta a ponta 50 cenarios | Fase 10 |

---

## 4. VERIFICACAO ANTES DE COMMITAR

Antes de subir pro GitHub, voce pode validar:

1. **Testar localmente:** `npm start` no backend. Acessar `http://localhost:3002/health`. Deve responder ok.
2. **CORS:** abrir 25-summary.html via `file://` no navegador. Deve falhar CORS ao chamar API (em producao) — isso e o comportamento correto.
3. **errorHandler:** forcar um erro 500 (ex: DB offline). Resposta nao deve ter `debug_message`.
4. **XSS:** abrir um briefing cujo paciente tenha nome `<script>alert('x')</script>`. Nao deve executar — deve renderizar o texto literal.

---

## 5. PROXIMO PASSO

Apos validar a Fase 1 e fazer as **3 acoes manuais urgentes**, me fala **"bora f2"** que eu comeco a Fase 2 (Observabilidade — Sentry + alertas + dashboard de fila).
