# HANDOFF — Módulo Agenda + Finalização + Retorno + Google Calendar

**Data:** 2026-04-24
**Sessão anterior:** desktop principal (dia 23-abr noite)
**Próxima sessão:** notebook faculdade (24-abr)
**Status:** preview aprovado (pendente) · plano 10/10 definido · implementação NÃO iniciada

---

## 1. O QUE FOI DECIDIDO (consolidado)

Implementar módulo completo de **Agenda do médico + Finalização de atendimento + Retorno automático + Integração Google Calendar** como **uma única entrega** (sem faseamento).

Lucas autorizou **execução autônoma total** — começa no "manda" e só para quando fizer deploy final com 0 erros em 7 dias. Sem pedir autorização fase-a-fase.

## 2. ESTADO ATUAL DO REPO

### Branch: `main`
### Último commit: `cd7e12d` (preview-agenda-completa.html refeito com layout real)

### Commits relevantes da sessão 23-24:
- `37d8d9e` — Padrões observados infra + cefaleia v1.0 + docs compliance
- `6cfa86b` — Base 20 queixas (55 condições clínicas)
- `091c30b` — Pipeline v2 roda no /regenerar
- `867724e` — Remove badge "Audio bruto"
- `993fc39` — Preview agenda v1 (descartado)
- `cd7e12d` — Preview agenda v2 **fiel ao sistema** (ativo)

### Arquivos do preview aprovado:
- [desktop/preview-agenda-completa.html](desktop/preview-agenda-completa.html) — 18 telas navegáveis
- Deploy: https://vitae-app.vercel.app/desktop/preview-agenda-completa.html

### Feature flag pendente no Railway:
- `PADROES_V2_ENABLED` (ainda **true** do último deploy) — sessão anterior

## 3. AS 18 TELAS APROVADAS (resumo visual)

1. **Config inicial da agenda** (tela inteira dentro do .content, NÃO popup)
2-4. **Tour de 4 popups** (usando estilo `.tpl-onb-*` com animação popIn)
5. **Briefing + Botão Finalizar atendimento** (sticky no rodapé)
6. **Modal "Finalizar este atendimento?"** (popIn)
7. **Modal "Quando voltar?"** (opções 7/15/30/outra + motivo)
8. **Agenda visão semana** (5 tipos de cartões coloridos)
9. **Detalhe da consulta selecionada** (split painel lateral)
10. **Agenda centrada na data de retorno** (+15 dias com sugestão)
11. **Modal marcar consulta nova**
12. **Alerta de conflito** (com 3 alternativas)
13. **Toast com desfazer** (10s)
14. **Lista de espera** (tab nova)
15. **Aba "Finalizadas"** (separada de Respondidas)
16. **Stats mensais** (ROI R$ 2.400 de no-show evitado)
17. **Paciente mobile — próxima consulta** no topo
18. **Lembrete push** + e-mail backup

## 4. PLANO 10/10 — RESUMO (documento completo no chat, 22 seções)

### As 10 mentalidades usadas
1. **Construtor** — motor de relacionamento contínuo
2. **Protetor** — inversão, 40 jeitos de dar errado mapeados
3. **Mentalista** — humano real (Sistema 1 em 2s, marcadores somáticos, autonomia)
4. **Antropólogo** — Brasil (cultura do atraso, informalidade, classes sociais, regional)
5. **Financeiro** — ROI (R$ 200-500 por no-show evitado)
6. **Ético** — não discriminar, respeitar vontade do paciente, limite de lembretes
7. **Advogado** — CFM 2.299/2021, Lei 13.787 (prontuário 20 anos), LGPD Art.11
8. **Estrategista** — diferencial vita id é ciclo completo, concorrentes têm pedaços
9. **Engenheiro de resiliência** — Railway cai, Google cai, deploy controlado, cache local 2 semanas
10. **Pesquisador de comportamento** — 35% no-show sem lembrete, 8% com lembrete

### 40 riscos mapeados em 5 famílias
- **A — Perdas financeiras pro médico** (10): slot vazio, dupla marcação, no-show, remarcação em cadeia, feriado municipal, lembrete falhou, Google desynced, fuso errado, retorno duplicado, sistema cai
- **B — Perdas emocionais pro médico** (8): sentir-se substituído, burnout, autonomia perdida, desconfiança pós-erro, sobrecarga cognitiva, frustração integração, vergonha com paciente, fadiga de cliques
- **C — Perdas emocionais pro paciente** (8): lembrete madrugada, lembrete errado, não entende, idoso perdido, exposição de dados, ansiedade de confirmação, traumas reativados, abandono silencioso
- **D — Perdas de reputação vita id** (8): viral redes, processo, reportagem, CFM, LGPD ANPD, churn, copia, ação coletiva
- **E — Perdas técnicas invisíveis** (6): vazamento Google, token hackeado, banco corrompido, memory leak, dependência Google API, race condition pico

### 10 personas de médico servidas
1. Médico ocupadíssimo · 2. Tele-consulta · 3. Com secretária · 4. Usuário Google Calendar · 5. Nunca usou agenda digital · 6. SUS multi-unidades · 7. Pediatra 15min · 8. Psiquiatra 50min · 9. Emergência escala · 10. Em viagem com fuso

### 20 pontos esquecidos no plano anterior (todos incluídos)
Config inicial obrigatória · Onboarding confirmação do paciente · Tutorial na 1ª marcação · Secretária multi-usuário · Importar agenda · Onboarding conta automática · Lista de espera · Recorrentes · Busca horário livre · Exportar .ics · Imprimir · Por paciente · Anotações privadas · Relatório mensal · Aniversário · Próxima consulta mobile · Paciente remarcar no app · Histórico · Feedback pós-consulta · Avaliação médico

### Decisões já tomadas (Lucas não decide nada)
- Visão padrão: semana · Duração: 30min · Horário: seg-sex 8h-18h
- Lembretes: 24h + 2h, push + e-mail · WhatsApp NÃO v1.0 · SMS NÃO v1.0
- Integração: Google Calendar primeiro · Outlook/Apple futuro
- Videochamada: Jitsi (grátis) · Fuso: UTC banco, conversão exibição
- Rollout: 4 estágios (dark → interna → canário 5% → 100%)
- Cancelamento paciente: até 4h antes · No-show tracking: 2 faltas = confirma 48h
- Desfazer: 10s · Cache offline: 2 semanas · Feriados: IBGE automático

### 3 perguntas pendentes pro Lucas (não respondidas ainda)
1. **Custo SMS/WhatsApp:** zero extra (só push+email) ou autoriza ~R$ 50-200/mês?
2. **Videochamada:** Jitsi (grátis, recomendado) / Google Meet / link manual Zoom?
3. **Conta Google Cloud:** criar agora com passo-a-passo ou Google Calendar fica pra fase 2?

## 5. ARQUITETURA TÉCNICA (sem código)

### Schema do banco (PRECISA SCHEMA CHANGE — aditivo, não destrutivo)
- Tabela nova `AgendaSlot` (id, medicoId, pacienteId, dataHora, duracao, tipo, status, motivo, linkOnline, criadoEm, localId, googleEventId, attemptId)
- Tabela nova `ListaEspera` (id, medicoId, pacienteId, criterio, prioridade, criadoEm)
- Tabela nova `LocalAtendimento` (id, medicoId, nome, endereco)
- Tabela nova `ConfigAgenda` (medicoId, duracaoPadrao, horarioInicio, horarioFim, diasAtivos[], almocoInicio, almocoFim, estado, googleTokenHash)
- Campo novo em `PreConsulta`: `status` ganha valor `FINALIZADA`, campos `finalizadaEm`, `retornoAgendaSlotId`
- **Aplicação via `railway run npx prisma db push` SEM `--accept-data-loss`** (regra CLAUDE.md)

### Backend novos serviços
- `backend/src/routes/agenda.js` — CRUD agenda, busca horários livres
- `backend/src/routes/espera.js` — lista de espera
- `backend/src/services/gcal.js` — OAuth + sincronização bidirecional
- `backend/src/services/lembretes.js` — scheduler + disparo push/email
- `backend/src/services/feriados.js` — IBGE automático
- Cron job novo: dispara lembretes 24h e 2h antes

### Frontend desktop
- Nova aba Agenda no sidebar (`nl` com ícone calendário)
- Nova view `#view-agenda` no `desktop/app.html` (igual outras views)
- Nova view `#view-agenda-onboarding` (config inicial, 1ª vez)
- Tour popups usando `.tpl-onb-*` existente
- Modal finalizar + modal retorno reutilizam `.tpl-onb-*`
- Nova aba "Finalizadas" no `#view-pc` (tabs existentes + 1)
- Botão Finalizar no final do `#view-resumo` (sticky footer)

### Frontend mobile paciente
- Card próxima consulta no topo de `08-perfil.html`
- Lembrete push via FCM (Firebase Cloud Messaging — gratuito)

## 6. ROLLOUT EM 4 ESTÁGIOS (autônomo)

1. **Dark launch** (flag `AGENDA_V1_ENABLED=false`) — 24h código em prod sem aparecer
2. **Interna** (flag true pra contas de teste) — 48h Lucas + QA testam
3. **Canário 5%** — 7 dias com monitoramento (rollback auto se falhar)
4. **100%** — 30 dias monitoramento contínuo

## 7. MÉTRICAS NÃO-NEGOCIÁVEIS (pós-deploy)
- Marcação ≤ 1.5s · Sincronização Google ≤ 30s · Erro ≤ 0.5% · Uptime ≥ 99.5%
- % pre-consultas finalizadas em 30 dias ≥ 80%
- % retornos marcados ≥ 40% · % retornos aconteceram ≥ 75%
- Redução no-show ≥ 20%

Qualquer métrica vermelha 24h = revisão/rollback auto.

## 8. PROTEÇÕES LEGAIS EMBUTIDAS (LGPD + CFM + Lei 13.787)
- Consentimento granular paciente pra notificações
- Token Google criptografado
- Agenda = parte do prontuário, retenção 20 anos
- Direito ao esquecimento: apaga pessoais, anonimiza histórico
- Exportação .ics disponível (LGPD portabilidade)
- Termo de uso: lembretes auxiliares, não substituem contato direto
- Disclaimer em cada lembrete: "Em emergência, 192"

---

## 9. MEGA-PROMPT PRO NOTEBOOK (copiar e colar)

```
Oi Claude. Sou Lucas, founder do vita id. Estou continuando no notebook
depois de trabalhar no desktop principal.

Quero que você leia, nesta ordem exata, pra ter contexto completo:
1. d:\vitae-app-github\CLAUDE.md (inteiro — é minha bíblia)
2. d:\vitae-app-github\HANDOFF-AGENDA-24-ABR-2026.md (este arquivo — estado
   atual da coisa que estou construindo)
3. d:\vitae-app-github\desktop\preview-agenda-completa.html (o preview
   visual das 18 telas que aprovei)
4. C:\Users\win11\.claude\projects\d--\memory\MEMORY.md (memória do Claude)

Regras absolutas pra esta sessão:
- Eu não programo. Explique TUDO em português simples, sem código.
- Tom institucional, nunca menciono IA pro usuário.
- Zero emoji em telas do produto.
- NUNCA prisma db push no build, NUNCA --accept-data-loss.
- Qualquer schema change: me avise antes de aplicar, eu rodo manual.
- Uso mentalidade CEO 11/10 de 3 modos (Construtor/Protetor/Mentalista).
- Pensamento profundo antes de implementar (leia a parte do plano 10/10).

O que você vai encontrar no handoff:
- Plano 10/10 já definido (10 mentalidades, 40 riscos, 10 personas, 20
  esquecidos cobertos)
- 18 telas do preview aprovadas visualmente por mim
- Decisões já tomadas (visão semana, 30min, push+email, Jitsi, etc)
- 3 perguntas pendentes no final (custo SMS/WA, videochamada, Google)

Meu pedido específico agora:
Quando eu disser "manda", você começa a implementação autônoma COMPLETA
do módulo Agenda + Finalização + Retorno + Google Calendar, seguindo
exatamente o plano 10/10. Só para quando fizer o deploy final com
métricas verdes em 7 dias consecutivos.

Durante a execução:
- Commit por commit (atômicos, reversíveis)
- Push para main (Railway + Vercel deployam automático)
- Só me pergunta se cair nas 4 portas invioláveis (schema change que
  não eliminei ainda, regressão em feature não relacionada, 3 falhas
  seguidas em teste crítico, descoberta que invalida premissa)
- Tudo mais você decide sozinho usando o plano

Antes do "manda", responde as 3 perguntas pendentes do plano em
linguagem simples pra eu escolher (sem jargão técnico).

Pronto pra começar?
```

---

## 10. CHECKLIST PRÉ-IMPLEMENTAÇÃO

- [x] Plano 10/10 definido
- [x] Preview 18 telas aprovado visualmente
- [x] Documentado em HANDOFF (este arquivo)
- [x] Commit + push pra GitHub
- [ ] Lucas responder 3 perguntas finais pro notebook começar
- [ ] Schema change aplicado manual (Lucas roda `railway run npx prisma db push`)
- [ ] Fase 1 (backend agenda) iniciada
- [ ] Fases 2-11 autônomas até deploy

## 11. CONTATOS E LINKS

- **Repo GitHub:** https://github.com/vitaehealth2906-ops/vitae-app
- **Produção Railway:** https://vitae-app-production.up.railway.app
- **Vercel:** https://vitae-app.vercel.app
- **Desktop médico:** https://vitae-app.vercel.app/desktop
- **Preview agenda:** https://vitae-app.vercel.app/desktop/preview-agenda-completa.html
- **Obsidian Vault:** C:\Users\win11\OneDrive\Documentos\Obsidian Vault\
- **Memória Claude:** C:\Users\win11\.claude\projects\d--\memory\

---

## 12. RESUMO EXECUTIVO DE 30 SEGUNDOS

**O que:** Módulo Agenda completo pro médico, com finalização de atendimento que leva a retorno marcado automaticamente. Fecha o ciclo que hoje morre depois do médico ver o briefing.

**Por que:** Transforma vita id de "app de pre-consulta" em "plataforma de relacionamento contínuo" — diferencial competitivo defensável, base pra monetização recorrente, histórico longitudinal (o ativo real da empresa).

**Custo:** 6-8 semanas autônomas de execução.

**Risco:** mapeado em 40 pontos com contra-medidas embutidas em código (não em processo).

**Próximo passo:** Lucas responde 3 perguntas finais do plano no notebook. Notebook executa autônomo até deploy.

---

## 13. INSTRUÇÃO FINAL PRO NOTEBOOK

Se Lucas colar o mega-prompt (seção 9) na próxima sessão no notebook:
1. Ler os 4 arquivos em ordem
2. Entender que plano e preview já estão aprovados
3. Responder as 3 perguntas pendentes em linguagem simples
4. Ao "manda" do Lucas, iniciar Fase 1 autônoma (backend agenda)
5. Seguir o plano 10/10 até deploy em 4 estágios
6. Atualizar este arquivo e CLAUDE.md ao final da sessão com progresso

**Boa sorte, Claude do notebook. Continua o trabalho bom. Lucas confia.**
