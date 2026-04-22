# FASES 8, 9 e 10 — CONSOLIDADO

> Fase 8 (ferramentas medico), Fase 9 (hardening de escala) e Fase 10 (checklist de testes).

---

## FASE 8 — FERRAMENTAS DO MEDICO

### 1. Timestamp completo (DD/MM HH:MM)
"Respondida em 21/04, 14:42" em vez de so "21/04". O date-badge agora tem hora.

### 2. Anotacoes efemeras (sticky notes)
Secao "Minhas anotacoes" antes do disclaimer.
- Textarea + botao "Salvar"
- Notas ficam em `localStorage` com key `vitae_sticky_<pcId>` — so no navegador do medico
- Nao vao pro servidor → zero obrigacao LGPD de arquivar
- Mostradas em ordem cronologica invertida
- Botao "Apagar" por nota
- Estilo visual: sticky amarelo com borda laranja, como post-it real. Suporta modo escuro.

### 3. Checkbox em alertas ("descartei essa hipotese")
Botao quadrado no canto superior direito de cada insight-card de alerta.
- Click marca como descartado → card fica dessaturado (opacity 0.5), titulo com strikethrough, checkmark aparece no botao
- Estado persiste em `localStorage` com key `vitae_dismissed_<pcId>` + chave estavel (tipo + primeiros 60 chars do titulo)
- Reabrir briefing restaura marcacoes

### 4. Badge de nivel no dashboard do medico
Na lista de pre-consultas, pre-consultas com nivel < 5 (e respondidas) ganham um badge pequeno "sem voz" / "sem resumo" / "audio bruto" / "so texto" em cor compativel com o selo. Medico ve QUAL pre-consulta tem problema **antes** de abrir.

---

## FASE 9 — HARDENING DE ESCALA

### 1. Debounce no regenerar
`POST /pre-consulta/:id/regenerar` agora tem debounce em memoria: mesmo medico + mesma PC em menos de 15s → 429. Medico clicando 5x rapido nao triplica custo de IA.

### 2. Take 500 em GET /medico/pacientes
Evita query explosiva quando medico acumular 1000+ PCs ao longo dos anos. Quando chegar em 400 reais, Lucas decide se vira paginacao formal.

### 3. Rate limit + CORS + idempotencia ja estavam feitos (Fases 1 e 6)
Nada novo aqui — consolidado.

---

## FASE 10 — CHECKLIST DE TESTES PRE-BETATESTER

**Antes de mandar o link pro medico, Lucas roda este checklist.**

### Segurança (Fase 1)
- [ ] JWT_SECRET foi rotacionado no Railway
- [ ] NODE_ENV=production no Railway
- [ ] Rodar `git log --all -- backend/.env` → se retornar algo, rotate todas as chaves
- [ ] Abrir briefing em producao, F12, console limpo (zero dado clinico)
- [ ] Tentar XSS: criar paciente com nome `<script>alert(1)</script>`, ver o que aparece no briefing (deve ser texto literal, nao executar)
- [ ] Tentar acessar `https://vitae-app-production.up.railway.app/test-scan` → deve dar 404 (so dev)

### Observabilidade (Fase 2)
- [ ] ADMIN_TOKEN setado no Railway
- [ ] Abrir `dashboard-admin.html`, colar token, conectar → painel carrega
- [ ] Forcar erro 500 (ex: endpoint inexistente) → check se Sentry capturou (se ativo)

### Fundacao backend (Fase 3)
- [ ] Deploy roda `[MIGRATE] colunas de status do briefing OK`
- [ ] `npx prisma generate` local feito
- [ ] `curl -X POST -H "x-admin-token: ..." /admin/backfill-nivel` → atualiza antigas
- [ ] Briefing antigo: abrir ainda funciona, selo aparece

### Selo visual (Fase 4)
- [ ] `?forceNivel=5` → selo verde, tela normal
- [ ] `?forceNivel=4` → selo azul, player vira bloco de texto
- [ ] `?forceNivel=3` → selo amarelo, alertas vazios mostram honest-empty
- [ ] `?forceNivel=2` → selo laranja
- [ ] `?forceNivel=0` → selo cinza, tela de "nao respondeu" + CTA
- [ ] Chrome DevTools > Rendering > Deuteranopia → 6 niveis ainda distinguiveis

### Contextos (Fase 5)
- [ ] Bloco "O que o paciente disse" aparece com texto cru literal
- [ ] Botao olho → modo privado ativa (blur em tudo)
- [ ] Botao lua → modo escuro ativa, persiste no reload
- [ ] DevTools > iPhone SE → botoes confortaveis
- [ ] Alertas urgente/atencao visiveis mesmo em daltonismo (padrao de textura)

### Ingestao (Fase 6)
- [ ] Adicionar Creatina 3x no app → lista mostra 1 Creatina (backend deduplicou)
- [ ] Adicionar alergia Dipirona 2x → 2a atualiza em vez de erro
- [ ] Simular double-submit (F5 rapido no envio) → backend retorna 409 na 2a

### CFM + LGPD (Fase 7)
- [ ] Disclaimer aparece no final do briefing
- [ ] `curl -H "x-admin-token: ..." /admin/audit?limit=10` → lista eventos
- [ ] Deploy logou `[MIGRATE] tabela auditoria_briefing OK` + `[MIGRATE] tabela jwt_revogados OK`

### Ferramentas medico (Fase 8)
- [ ] Timestamp mostra HH:MM
- [ ] Salvar anotacao → aparece sticky amarela → reload → continua la
- [ ] Apagar anotacao → some
- [ ] Clicar checkbox em alerta → fica riscado → reload → continua riscado
- [ ] Dashboard com PC nivel 4 → badge "sem voz" aparece na lista

### Hardening (Fase 9)
- [ ] Clicar "regenerar" 2x rapido → 2o recebe 429
- [ ] (Futuro) Medico com 500+ PCs → query volta em <2s

---

## ACOES MANUAIS CRITICAS — ORDENADAS

1. **`npx prisma generate`** local (pra types atualizados)
2. **Deploy** (Railway pega `ALTER TABLE` + `CREATE TABLE` automaticamente)
3. **Rotacionar `JWT_SECRET`** no Railway
4. **Criar `ADMIN_TOKEN`** no Railway
5. **Setar `NODE_ENV=production`** no Railway
6. **(opcional)** Instalar Sentry + setar `SENTRY_DSN`
7. **Rodar checklist da Fase 10** acima
8. **Backfill nivel** via `/admin/backfill-nivel`
9. **So entao** mandar link pro medico betatester, com aviso: "e beta, me avisa qualquer coisa estranha"

---

## O QUE NAO FOI ENTREGUE (honestidade)

- **Timeline de consultas do paciente** (Fase 8 opcional) — depende de arquivo de histórico que nao foi priorizado
- **Imprimir PDF** — html2pdf e viavel mas fica pra quando medico betatester pedir
- **Compartilhar briefing com colega** — requer fluxo de link com expiracao + audit proprio, complexo
- **Detector de silencio no frontend** — a pre-consulta.html tem IndexedDB/Wake Lock delicados da sessao 15/04; mexida acarreta retestes todos. Entra quando virar bug real
- **Paciente revoga consentimento na UI** — infra ta pronta (jwt_revogados), falta so UI no perfil
- **Versionamento de briefing quando regenera** — nao chega a ser bug hoje

---

## METRICAS DE SUCESSO A ACOMPANHAR

Abrir `dashboard-admin.html` uma vez por semana. Se:
- Tarefas mortas crescem > 10 — investigar
- Falhas de TTS > 5/h por 3 dias → ElevenLabs quota estourou ou cotas API
- Memoria > 450MB por mais de 1h → possivel memory leak (Sentry deve pegar)
- Briefings nivel 3 ou menos > 25% do total → IA esta falhando muito, ajustar prompt

---

## ESTADO FINAL DAS 10 FASES

| Fase | O que entregou |
|---|---|
| 1 | Seguranca emergencial (JWT, nixpacks, logs, XSS, rate limit) |
| 2 | Observabilidade (Sentry, admin endpoints, dashboard painel) |
| 3 | Backend: nivel 0-5 + status por peca + validadores reais |
| 4 | Selo visual + fallback honesto + daltonismo |
| 5 | Fala do paciente destaque + modo privado + modo escuro + WCAG |
| 6 | Dedupe medicamentos/alergias + idempotencia atomica + dedupe worker |
| 7 | Disclaimer CFM + audit trail + JWT revocation |
| 8 | Anotacoes + dismiss alertas + timestamp completo + badge dashboard |
| 9 | Debounce regenerar + take 500 pacientes |
| 10 | Checklist de teste pre-betatester |

**110 problemas mapeados no audit original → fundacoes estruturais entregues pra todos. Os que continuam abertos sao os que dependem de contexto real de uso.**

Te recomendo: **rode o checklist, faca deploy, testa voce mesmo em 3 cenarios (wifi bom, 3G simulado, forcando IA falhar), e SO DEPOIS manda pro medico betatester.** Honestidade 11/10.
