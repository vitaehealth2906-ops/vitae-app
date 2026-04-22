# FASE 3 — FUNDACAO NO BACKEND — HANDOFF

> Nivel de briefing 0-5 + validacao real de cada peca + status honesto.
> ZERO mudanca visivel ao usuario — so fundacao. A Fase 4 transforma isso em selo visual.

---

## 1. O QUE FOI FEITO

### Schema aditivo (zero risco de data loss)

**Apenas 6 colunas nullable novas em `pre_consultas`:**

- `nivel_briefing` INT — 0 a 5 (5 = completo, 0 = nao respondeu)
- `status_resumo_ia` TEXT — 'ok' | 'parcial' | 'falhou'
- `status_audio_resumo` TEXT — 'ok' | 'processando' | 'falhou' | 'suspeito'
- `status_transcricao` TEXT — 'ok' | 'falhou' | 'sem_audio'
- `status_foto` TEXT — 'ok' | 'ausente' | 'falhou'
- `status_audio` TEXT — 'ok' | 'ausente' | 'silencio' | 'falhou'

Mais um indice: `(medico_id, nivel_briefing)` pra filtrar briefings por nivel no dashboard do medico (Fase 4).

**Migracao ja esta no `index.js` no mesmo padrao seguro das outras** (`ALTER TABLE IF NOT EXISTS`, idempotente). Roda sozinho no proximo deploy. **Zero dropa de coluna, zero altera tipo, zero `--accept-data-loss`.**

### Novo: `backend/src/services/briefing.js`

Modulo central da Fase 3. Faz 3 coisas:

1. **Validadores honestos de cada peca:**
   - `validarTranscricao` — rejeita "(áudio sem transcrição)", lixo repetitivo (aaaaa), < 15 chars
   - `validarFoto` — rejeita data-url vazia, URL curta demais
   - `validarAudio` — checa URL basica (silencio e detectado indiretamente pela transcricao vazia)
   - `validarQueixa` — rejeita vazia ou < 5 chars

2. **`calcularNivel(status)`** — mapeia o estado das 6 pecas pra nivel 0-5:
   - 5 = audio + transcricao + resumo IA + TTS, todos OK
   - 4 = sem TTS (voz falhou)
   - 3 = transcricao OK mas IA falhou
   - 2 = audio OK mas transcricao falhou
   - 1 = so texto (sem audio)
   - 0 = nao respondeu nada

3. **`gerarResumoComValidacao`** — chama a IA com timeout explicito (45s), depois valida o resultado. `validarResultadoIA` decide se saiu ok, parcial ou falhou baseado em textoVoz, summaryTexto, blocos, alertas.

### Worker atualizado: `processador.js`

Agora em cada etapa ele:
- Valida peca que chegou do paciente → grava `statusFoto`, `statusAudio`
- Depois do Whisper → valida transcricao → grava `statusTranscricao`
- Depois da IA → valida resultado → grava `statusResumoIa`
- Antes do TTS → marca `statusAudioResumo = 'processando'` (medico ve "em processamento" se abrir no meio)
- Depois do TTS → valida tamanho do audio (< 30KB = suspeito, nao exibe como completo) → grava 'ok' | 'suspeito' | 'falhou'
- No fim: **calcula nivel 0-5** e grava tudo de uma vez no banco

**Se a migration de colunas ainda nao rodou**, o update do nivel falha em silencio (log warning) e o fluxo segue — nao quebra o resto.

### Novo: endpoint `POST /admin/backfill-nivel`

Pra pre-consultas antigas (sem `nivel_briefing` setado ainda), calcula retroativo baseado nos dados que ja tem.

- Protegido pelo `ADMIN_TOKEN` (header `x-admin-token`)
- Idempotente: so mexe em quem tem `nivel_briefing = null`
- Batch de 500 por chamada (pode rodar varias vezes se tiver mais que isso)

---

## 2. ACOES MANUAIS DO LUCAS

### ACAO 1 — Rodar `prisma generate` localmente pra atualizar os types (1 min)

```
cd backend
npx prisma generate
```

Isso atualiza os tipos do cliente Prisma pra incluir os novos campos (`nivelBriefing`, `statusResumoIa`, etc).

### ACAO 2 — Deploy na Railway (migracao roda sozinha)

Commitar e fazer push. O servidor, ao subir, roda os `ALTER TABLE ... IF NOT EXISTS` no startup. Logs no Railway devem mostrar:
```
[MIGRATE] colunas de status do briefing OK
```

**Se aparecer `[MIGRATE] Erro ao aplicar migracao manual:`**, verificar — pode ser que o Postgres nao aceitou alguma das queries. Sao todas `IF NOT EXISTS`, entao tentar de novo nao destroi nada.

### ACAO 3 — Backfill das pre-consultas antigas (1 min)

Depois do deploy, abrir terminal:

```
curl -X POST -H "x-admin-token: SEU_TOKEN_AQUI" https://vitae-app-production.up.railway.app/admin/backfill-nivel
```

Resposta:
```
{ "ok": true, "encontradas": 42, "atualizadas": 42 }
```

Se tiver mais de 500 antigas, rodar de novo ate `encontradas` virar 0.

### ACAO 4 — Verificar no dashboard interno

Abrir `dashboard-admin.html`, colar token, conectar. O painel admin ainda nao mostra nivel por pre-consulta (isso e da Fase 4 quando a tela muda), mas as stats gerais continuam funcionando.

---

## 3. O QUE FICA DIFERENTE NO BANCO DE DADOS (exemplo pratico)

**Antes da Fase 3:**
```
PreConsulta {
  id: "abc",
  summaryIA: "...",
  summaryJson: {...},
  audioSummaryUrl: "https://..."
}
```
Medico abre: ve tudo como "completo" mesmo se TTS falhou ou IA gerou lixo.

**Depois da Fase 3:**
```
PreConsulta {
  id: "abc",
  summaryIA: "...",
  summaryJson: {...},
  audioSummaryUrl: "https://...",
  nivelBriefing: 4,              // <- NOVO: 4 significa "sem voz"
  statusResumoIa: "ok",           // <- NOVO
  statusAudioResumo: "falhou",    // <- NOVO: TTS falhou, por isso nivel 4 e nao 5
  statusTranscricao: "ok",        // <- NOVO
  statusFoto: "ok",               // <- NOVO
  statusAudio: "ok"               // <- NOVO
}
```

A Fase 4 vai usar `nivelBriefing` pra mostrar o selo visual. Agora a informacao existe no banco — pronto pra consumir.

---

## 4. O QUE NAO FOI FEITO NESTA FASE

- **IA em 3 chamadas separadas (queixa fiel + alertas + texto voz).** Reconsideracao: o `gerarSummaryPreConsulta` ja existente gera as 3 pecas num JSON unico, e a maior parte do truncamento vem do input gigante, nao da geracao. A Fase 3 adicionou **timeout explicito** e **validacao do resultado** que sao os ganhos reais de confiabilidade. Quebrar em 3 chamadas separadas triplicaria custo de IA e adicionaria latencia. **Decisao: manter como esta ate medidas reais mostrarem que precisa.** Esta e uma decisao reversivel — se em producao vermos truncamento frequente, a Fase 5 pode quebrar.
- **Selo visual na tela do medico.** Fase 4.
- **Modo responsive pra celular/plantao.** Fase 5.

---

## 5. PROXIMO PASSO

Depois de:
1. `npx prisma generate` local
2. Deploy (migration roda auto)
3. Rodar `/admin/backfill-nivel` via curl

Me manda **"bora f4"** que eu comeco a Fase 4 (Selo de nivel visual + fallback honesto no 25-summary.html).
