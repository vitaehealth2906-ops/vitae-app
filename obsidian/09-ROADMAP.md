# Roadmap — vita id

> Voltar pra [[00-CENTRAL]] | Problemas em [[06-PROBLEMAS]]

---

## Status Atual (09/04/2026)

MVP funcional com:
- 31 telas prontas (de 35 planejadas)
- Backend rodando no Railway
- 17 tabelas no banco de dados
- IA lendo exames e extraindo dados
- Scan de receita funcionando (backend pronto, telas faltando)

---

## Prioridade 1 — Fechar o MVP (telas faltando)

| Tarefa | Dificuldade | Dependencia |
|--------|------------|-------------|
| Criar 26-scan-receita.html | Media | Nenhuma (backend ja pronto) |
| Criar 27-processando.html | Facil | Nenhuma |
| Corrigir logout do medico (aponta pra 01-login que nao existe) | Facil | Decidir: redirecionar pra 03-cadastro ou criar 01-login |
| Criar quiz-preconsulta.html | Media | Definir quais perguntas |

---

## Prioridade 2 — Organizar o Projeto

| Tarefa | Dificuldade |
|--------|------------|
| Mover arquivos de dev pra pasta /dev ou /docs | Facil |
| Mover .md de planejamento pra pasta /docs | Facil |
| Resolver numeracao duplicada (15, 20) | Media (muitas referencias) |
| Decidir futuro do frontend/ Next.js | Decisao |
| Decidir futuro da pasta vitae-app-git/ | Decisao |
| Deletar pasta server/ (wearable) se nao for usar agora | Facil |

---

## Prioridade 3 — Funcionalidades Novas

| Feature | O que faz | Complexidade |
|---------|-----------|-------------|
| Push notifications | Lembrete de medicamento no celular | Alta (precisa Firebase/OneSignal) |
| Controle de estoque | Avisar quando remedio vai acabar | Media (backend: endpoint de calculo) |
| Agenda inteligente | Sugerir proximos exames baseado no historico | Media |
| Compartilhamento entre medicos | Medico A encaminha pro Medico B com historico | Media |
| Historico de score | Grafico mostrando evolucao do score ao longo do tempo | Facil (dados ja existem) |
| Idade biologica com dados | Tela 15-bioage com dados reais (hoje so tem "sem dados") | Media |
| Check-in semanal | Paciente responde como esta (sono, atividade, humor) | Media (tela + backend) |

---

## Futuro (pos-validacao)

| Visao | Quando |
|-------|--------|
| Converter pra app nativo (PWA ou React Native) | Quando tiver usuarios reais testando |
| Integrar wearables (WHOOP, Oura, Apple Watch) | Quando app nativo existir |
| Plano pago pra medicos (assinatura) | Quando tiver base de medicos usando |
| Parcerias com laboratorios (envio direto de resultados) | Quando tiver escala |
| Certificacao ANVISA / selo de seguranca | Quando for virar produto comercial |

---

## Como atualizar

Toda vez que completar uma tarefa, risque aqui e mova pra [[10-SESSOES]] com a data.
Toda vez que surgir uma ideia nova, adicione na prioridade correta.
