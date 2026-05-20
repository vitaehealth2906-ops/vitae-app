# 🧪 Cenários de Teste E2E — vita id

**Documento mestre · 19/mai/2026 (notebook faculdade)**

> Mapeamento exaustivo de todos os cenários de teste manual pra rodar com login real do médico e paciente. Baseado em pesquisa profunda via 3 agentes Explore + verificação cruzada do backend.

---

## 🎯 OBJETIVO

Testar END-TO-END o fluxo:

1. **Link de pré-consulta** (paciente recebe e responde)
2. **Aba Pacientes do médico** (validação cruzada do briefing recebido)
3. **Aba Consultas do paciente** (validação cruzada do que paciente vê depois)
4. **Features cruzadas** (médico propõe retorno → paciente confirma/contrapropõe; médico anexa documento → paciente vê; médico libera WhatsApp → paciente vê botão)

---

## 📋 RESUMO EXECUTIVO

### O que já está testado (baseline)
- ✅ **10 cenários** rodados via Playwright na noite 18→19/mai (6 texto + 4 áudio)
- ✅ Cenário "Bebo-bug" (10 áudios + 1 texto curto) — **passou após fix da Sessão 26**
- ✅ Backend `/finalizar` com cobertura 11/11

### O que NÃO foi testado ainda (gaps críticos)
- 🔴 **iPhone Safari real** — só rodou em Chrome headless
- 🔴 **Cruzamento médico↔paciente** — médico abrir briefing, ver dados, propor retorno
- 🔴 **Features novas** (retorno + documentos + whatsapp) — backend pronto, frontend parcial
- 🔴 **Personas extremas** (idoso lento, paciente menor, sem mic)
- 🔴 **Casos de erro real** (sem internet, sessão expirada, mic negado)

### Status das 3 features novas (atualizado 19/mai)

| Feature | Backend | Frontend médico | Frontend paciente v3 |
|---|---|---|---|
| **Propor retorno** (médico → paciente) | ✅ rotas implementadas | ⚠️ UI parcial (estados visuais OK, botões podem ser stub) | ✅ aba Consultas tem seção "Retornos Propostos" funcional |
| **Anexar documento** (médico → paciente) | ✅ upload + meus + baixar | ⚠️ UI parcial (dropzone pode não estar pronto) | ⚠️ tab Consultas mostra documentos mas tela detalhe tem bloco vazio |
| **Liberar WhatsApp** (médico configura) | ✅ rota /contato/config | ⚠️ UI toggle existe mas pode não persistir | ❌ tela detalhe paciente bloco "Falar com sua médica" vazio |

> **Pra cada cenário cruzado abaixo, anota: ✅ funcionou / ⚠️ parcial / ❌ não funcionou**

---

## 👤 TIPOS DE PACIENTES (PERSONAS DE TESTE)

| # | Persona | Idade/Perfil | Conta vita id? | Modo preferido | Risco principal |
|---|---|---|---|---|---|
| **P1** | **Beatriz** (link médico, novata) | 45a, executiva | ❌ nunca teve | Texto rápido | Cadastro rápido funciona? |
| **P2** | **Maria** (já tem app loja) | 38a, mulher | ✅ login existente | Áudio + texto | Auto-login pelo token |
| **P3** | **Lucas** (power user) | 28a, fundador | ✅ login + múltiplas anamneses | Áudio principalmente | Retomada estado funciona? |
| **P4** | **Sandra** (cuidadora) | 35a respondendo pela mãe (65a) | ⚠️ celular da mãe | Texto | Confusão "quem é o paciente?" |
| **P5** | **João** (esqueceu senha) | 50a | ✅ mas password perdida | Texto | Reset funciona sem perder pré-consulta? |
| **P6** | **Helena** (abandona meio) | 72a, idosa confusa | ❌ não cria | Áudio | Estado salvo se fechar aba? |
| **P7** | **Idoso lento** | 78a | ❌ ou ✅ | Texto super lento (30s/resposta) | Timeout não mata sessão? |
| **P8** | **Jovem ansioso** | 22a | ✅ | Áudio rápido | Clique múltiplo, idempotência |

---

## 🟢 CAMADA A — Fluxo do link de pré-consulta

### A.1 — Estados do link ao clicar (7 cenários)

| # | Cenário | Setup | Ação | Resultado esperado | Como verificar |
|---|---|---|---|---|---|
| A.1.1 | Token válido, primeira vez | PC criada agora | Paciente novato clica link | Tela login/cadastro → quiz vita id → pré-consulta | Backend log `GET /t/<token>/estado 200` |
| A.1.2 | Token inválido (404) | Token fake na URL | Clica | Tela "Link não encontrado" | Status 404 + tela amigável |
| A.1.3 | Token expirado (>30 dias) | PC criada há 31 dias | Clica | Tela "Link expirado, peça outro" | Status 410 |
| A.1.4 | Token já respondida | PC respondida ontem | Reclica | Tela "Você já respondeu" | Status 200 com `duplicate: true` |
| A.1.5 | Paciente já logado no app | PC nova + Maria já tem conta | Clica | Pula login, vai direto pro quiz | Logs sem chamada de /auth/login |
| A.1.6 | Paciente sem conta | PC nova + Beatriz novata | Clica | Tela login → "Não tenho conta" → cadastro rápido | Cria usuário + vincula auto |
| A.1.7 | Esqueceu senha | João tem conta mas perdeu senha | Clica → "Esqueci" | Email → nova senha → continua PC | Reset não perde estado da PC |

### A.2 — Ambiente técnico (12 cenários)

| # | Dispositivo/conexão | Modo | Esperado | Risco |
|---|---|---|---|---|
| A.2.1 | iPhone Safari, mic OK | Áudio | Wake Lock + chunks salvos | iOS suspende JS |
| A.2.2 | iPhone Safari, mic negado | Texto fallback | Aviso "Ative microfone" | Não trava fluxo |
| A.2.3 | iPhone dentro do WhatsApp | In-app browser | Aviso "Abra no navegador" OU texto puro | Mic bloqueado pelo WhatsApp |
| A.2.4 | Android Chrome, mic OK | Áudio | Igual A.2.1 | Codecs diferentes |
| A.2.5 | Android dentro do WhatsApp | In-app browser | Igual A.2.3 | — |
| A.2.6 | Desktop Chrome | Áudio + texto | Layout responsivo, frame phone OU full | Frame 393px feio no desktop |
| A.2.7 | WiFi rápido (>10Mbps) | Áudio | Chunks <2s por upload | — |
| A.2.8 | 3G lento (~500Kbps) | Áudio | Banner "Tá lento, segura aí" | Timeout não mata upload |
| A.2.9 | Offline durante gravação | Áudio | IndexedDB salva, banner crítico | Não perde resposta gravada |
| A.2.10 | Online → offline → online | Áudio | Retomada via /estado | Pergunta atual preservada |
| A.2.11 | Bluetooth desconectado | Áudio | Mic interno funciona | — |
| A.2.12 | Auto-lock iOS durante gravação | Áudio | Wake Lock mantém tela | Senão perde áudio |

### A.3 — Modo de resposta por pergunta (11 cenários)

| # | Padrão | Resultado esperado | Critério |
|---|---|---|---|
| A.3.1 | 11 áudios | Whisper transcreveu cada uma + finalizar 200 | Cobertura 11/11 |
| A.3.2 | 11 texto | Salvo direto sem julgar IA | Cobertura 11/11 |
| A.3.3 | 11 "Não sei" | Cobertura 11/11 mas qualidade 0 | Backend NÃO bloqueia |
| A.3.4 | 11 pulado | Mesmo que "não sei" — só conta entry | Médico vê "vazio" no briefing |
| A.3.5 | Misto áudio/texto | Cada um salva no modo escolhido | Modos variados no banco |
| A.3.6 | 10 áudio + "Bebo" texto na #10 | **Bug Lucas — JÁ CORRIGIDO Sessão 26** | Cobertura 11/11, "Bebo" salvo |
| A.3.7 | Alguns "Não sei" + outros respondidos | Mistura sem quebrar | — |
| A.3.8 | Áudio → cancelar → refazer | Última gravação salva, anterior descartada | Tentativas: 2 |
| A.3.9 | Texto 1 palavra ("Sim", "Não") em todas | Salvo bruto, médico julga | — |
| A.3.10 | Texto vazio + enviar | Validação "Complete a resposta" OU permite | Decidir UX |
| A.3.11 | Voltar pra editar resposta anterior | P1 atualizada, tentativas++ | — |

### A.4 — Erros e recuperação (10 cenários)

| # | Trigger | Resultado esperado | Onde verificar |
|---|---|---|---|
| A.4.1 | Sem internet no /responder-pergunta | Retry automático + banner crítico | Resposta NÃO salva no banco se falhar |
| A.4.2 | Internet cai/volta no upload | Resume + retry | — |
| A.4.3 | Fecha aba durante gravação | IndexedDB preserva respostas anteriores | Reabre → retoma de P6 |
| A.4.4 | JWT expira no meio | Redirect login + retoma estado | 401 trata bem |
| A.4.5 | iOS auto-lock | Wake Lock segura | Áudio inteiro salvo |
| A.4.6 | Backend 500 em /responder-pergunta | Retry + aviso amigável | Não fica em loop |
| A.4.7 | Backend 504 em /finalizar | Status PENDENTE + retry queue | TarefaPendente criada |
| A.4.8 | Whisper falha (áudio ruim) | "Não captei sua fala — tenta de novo" | Motivo: transcricao_falhou |
| A.4.9 | Anthropic API key expirada | TarefaPendente fica DEAD após 5 tentativas | Pré-consulta vira RESPONDIDA mesmo assim |
| A.4.10 | Supabase Storage offline | Fallback: retenta após X segundos | — |

### A.5 — Casos de borda (10 cenários)

| # | Cenário | Esperado | Risco |
|---|---|---|---|
| A.5.1 | 2 abas simultâneas com mesmo token | Race condition — última ganha | Sincronização? |
| A.5.2 | Fecha + reabre 1 semana depois | Estado preservado (token 30d) | — |
| A.5.3 | Já respondida + clica link de novo | Status 200 duplicate, mostra "já enviou" | — |
| A.5.4 | Link compartilhado com outra pessoa | **Risco LGPD** — bug grave se outra pessoa loga | Validação adicional? |
| A.5.5 | Menor de 13 anos (LGPD) | Quiz bloqueia | Validação no quiz vita id |
| A.5.6 | CPF inválido (12345678901) | Quiz rejeita com algoritmo dígito verificador | — |
| A.5.7 | Idade inválida (negativa, 200 anos) | Quiz limita range | — |
| A.5.8 | Altura/peso absurdos (300cm, -50kg) | Quiz limita ou avisa | — |
| A.5.9 | Cruzamento alergia-medicamento detectado | Aviso no quiz ou no briefing médico | — |
| A.5.10 | Recusa termos LGPD | Bloqueia envio até aceitar | — |

### A.6 — Integração com /finalizar (5 cenários)

| # | Cenário | Esperado |
|---|---|---|
| A.6.1 | Cobertura 11/11 | 200 + status RESPONDIDA + TarefaPendente enfileirada |
| A.6.2 | Cobertura 10/11 | 400 "Cobertura insuficiente" — banner mostra qual falta |
| A.6.3 | Modo desconhecido | 400 "Modo inválido" |
| A.6.4 | Concorrência: PC já RESPONDIDA | 200 com `duplicate: true` (não duplica) |
| A.6.5 | TarefaPendente falha | Status RESPONDIDA mesmo se summary falhar |

**Total Camada A: ~55 cenários (10 já testados, ~45 pra testar manual)**

---

## 🔵 CAMADA B — Aba Pacientes do médico (validação após paciente responder)

### B.1 — Médico vê o paciente novo (5 cenários)

| # | Cenário | Setup | Ação | Esperado | Verificação |
|---|---|---|---|---|---|
| B.1.1 | Beatriz nova → aparece na lista | P1 respondeu PC há 5 min | Médico abre aba Pacientes | Card aparece com nome + foto + última ativ. "Hoje" + contador "1 anamnese" | `GET /medico/pacientes` retorna ela |
| B.1.2 | Maria já existia → atualiza | P2 já tinha 2 PCs, respondeu 3ª | Médico abre Pacientes | Card atualiza "3 anamneses" + última ativ. "Agora" | — |
| B.1.3 | Lucas com 4 PCs históricas | P3 respondeu mais 1 | Abre Pacientes | Card ordena no topo da lista | Ordenação por ultimaAtividade DESC |
| B.1.4 | Sandra (cuidadora) — pelo celular da mãe | P4 respondeu via celular Helena | Médico abre Pacientes | Aparece o paciente (Helena) com dados certos | Vínculo correto: PC pertence à Helena, não Sandra |
| B.1.5 | Paciente sem conta (link só) | P1 respondeu mas não criou conta | Médico abre Pacientes | Aparece com ícone cinza "Sem vínculo" | `temVinculo=false` no retorno |

### B.2 — Painel detalhe do paciente (8 cenários)

| # | Cenário | Esperado |
|---|---|---|
| B.2.1 | Hero do paciente carrega | Avatar + nome + idade + sangue + contador PCs |
| B.2.2 | Accordion "Histórico Clínico" com 1 PC | "Aguardando 2ª anamnese pra comparar" |
| B.2.3 | Accordion com 2+ PCs | Spinner → IA Collab carrega narrativa comparativa |
| B.2.4 | Accordion "Medicamentos em uso" | Lista de meds ativos (com fonte: manual ou scan) |
| B.2.5 | Accordion "Alergias" | Lista com gravidade (GRAVE/MODERADA/LEVE) + ícones |
| B.2.6 | Accordion "Exames" | Lista últimos 20 com status (Normal/Alterado) |
| B.2.7 | Botão "Enviar pré-consulta" no hero | Abre modal de criar nova PC pré-selecionando paciente |
| B.2.8 | Botão "WhatsApp" no hero (se telefone) | Abre wa.me direto |

### B.3 — Tela "Sumário de 1 minuto" (10 cenários)

| # | Cenário | Esperado |
|---|---|---|
| B.3.1 | PC com 11 áudios | Player aparece + transcrição completa |
| B.3.2 | PC só texto | Player não aparece, só transcrição |
| B.3.3 | PC mista | Player + transcrição mostrando origem (áudio/texto) |
| B.3.4 | Anamnese estruturada 11/11 campos | Cada campo preenchido com fonte (áudio/formulário) |
| B.3.5 | Anamnese parcial (alguns vazios) | Campos vazios indicados |
| B.3.6 | Padrões observados | Cards com alertas se houver |
| B.3.7 | "Bebo" salvo em texto | Mostra "Bebo" claro como fonte: formulário |
| B.3.8 | Áudio de 5 min | Player navegável, controles funcionam |
| B.3.9 | TTS resumo IA (1 min áudio) | Toca preview narrativa |
| B.3.10 | Exportar pra iClinic | CSV baixa correto |

### B.4 — Filtros e busca (4 cenários)

| # | Cenário | Esperado |
|---|---|---|
| B.4.1 | Filtro "Recentes 30d" | Esconde PCs antigas |
| B.4.2 | Busca por nome | Case-insensitive (mas pode não normalizar acentos) |
| B.4.3 | Busca por CPF | Match parcial |
| B.4.4 | Busca por telefone | Match parcial |

**Total Camada B: ~27 cenários**

---

## 🟡 CAMADA C — Aba Consultas do paciente (validação após resposta + ações médico)

### C.1 — Estado vazio (3 cenários)

| # | Setup | Ação | Esperado |
|---|---|---|---|
| C.1.1 | Paciente novato, 0 PCs | Abre aba Consultas | Estado vazio com mensagem amigável |
| C.1.2 | Paciente respondeu 1 PC, sem retorno proposto | Abre Consultas | Vê card "Histórico Clínico" com 1 entry |
| C.1.3 | Paciente com PC pendente (médico mandou mas não respondeu) | Abre Consultas | Bloco "Pré-consultas pendentes" — verificar se existe |

### C.2 — Seção "Retornos Propostos" (5 cenários)

> Backend: `GET /agendamento/retornos-pendentes` — implementado ✅

| # | Cenário | Esperado |
|---|---|---|
| C.2.1 | Médico propôs retorno há 1h | Card aparece com avatar + nome + data + dias até | 
| C.2.2 | Paciente clica "Confirmar" | `POST /agendamento/:id/confirmar` → card some + médico recebe notificação |
| C.2.3 | Paciente clica "Recusar" + motivo | `POST /agendamento/:id/recusar` → card some + motivo no banco |
| C.2.4 | Paciente clica "Remarcar" + nova data | `POST /agendamento/:id/remarcar` → card atualiza + médico vê contraproposta |
| C.2.5 | Múltiplos retornos pendentes (raro) | Lista todos |

### C.3 — Seção "Documentos" (4 cenários)

> Backend: `GET /documentos/meus` — implementado ✅

| # | Cenário | Esperado |
|---|---|---|
| C.3.1 | Médico anexou laudo | Card aparece + badge "Novo" se ainda não visualizado |
| C.3.2 | Paciente clica documento | `GET /documentos/:id/baixar` → URL assinada → abre PDF |
| C.3.3 | Documento áudio (.mp3) | Player inline OU download |
| C.3.4 | Vários documentos | Lista ordenada por data DESC |

### C.4 — Seção "Próxima Consulta" (3 cenários)

| # | Cenário | Esperado |
|---|---|---|
| C.4.1 | Sem agendamento | Estado vazio |
| C.4.2 | Agendamento confirmado | Card com data, médico, especialidade, local |
| C.4.3 | Múltiplos agendamentos | Mostra o mais próximo |

### C.5 — Seção "Histórico Clínico" (3 cenários)

| # | Cenário | Esperado |
|---|---|---|
| C.5.1 | 1 consulta passada | 1 card no histórico |
| C.5.2 | 5+ consultas passadas | Lista paginada ou full scroll |
| C.5.3 | Consulta sem detalhe (PC respondida mas sem agendamento real) | Aparece OU é filtrado? |

### C.6 — Tela detalhe da consulta (6 cenários — **3 BLOCOS VAZIOS HOJE**)

> Tela `16-consulta-detalhe.html` — 3 blocos planejados mas vazios

| # | Bloco | Status atual | Esperado quando implementado |
|---|---|---|---|
| C.6.1 | Hero do médico | ✅ Funciona | Nome + especialidade + avatar |
| C.6.2 | Data + Local | ✅ Funciona | Formatado bonito |
| C.6.3 | Observações | ✅ Funciona | Texto livre |
| C.6.4 | **Documentos da médica** | ❌ Vazio | Lista de docs da consulta específica → backend tem `GET /documentos/consulta/:agendamentoId` |
| C.6.5 | **Retorno proposto** | ❌ Vazio | Card com data proposta + botões Confirmar/Recusar/Remarcar |
| C.6.6 | **Falar com a médica (WhatsApp)** | ❌ Vazio | Botão WhatsApp se médica liberou + indicador de horário |

**Total Camada C: ~24 cenários** (alguns esperam vazio porque feature não está completa no frontend)

---

## 🔴 CAMADA D — Cenários cruzados (médico ↔ paciente em tempo real)

### D.1 — Ciclo de retorno completo (5 cenários)

| # | Passo | Quem faz | Onde | Verificação |
|---|---|---|---|---|
| D.1.1 | Médico abre paciente | Médico | Aba Pacientes → clica paciente | Painel direito carrega |
| D.1.2 | Médico propõe retorno em 30d | Médico | Accordion "Próximo Retorno" → "+ Marcar retorno" → preenche data | `POST /agendamento/propor-retorno` 200 |
| D.1.3 | Paciente recebe e vê | Paciente | Abre app → aba Consultas → vê card "Retornos Propostos" | Card visível com data proposta |
| D.1.4a | Paciente confirma | Paciente | Clica "Confirmar" | `POST /agendamento/:id/confirmar` 200 → card some → médico recebe |
| D.1.4b | OU Paciente remarca | Paciente | Clica "Remarcar" → escolhe nova data | `POST /agendamento/:id/remarcar` 200 |
| D.1.5 | Médico vê resultado | Médico | Volta aba Pacientes → painel direito → "Próximo Retorno" | Mostra status atualizado (Confirmado ou Aguardando médico se contraproposta) |

### D.2 — Ciclo de documentos (4 cenários)

| # | Passo | Quem | Esperado |
|---|---|---|---|
| D.2.1 | Médico anexa receita (PDF 1MB) | Médico | Upload OK + documento no banco |
| D.2.2 | Paciente vê na aba Consultas | Paciente | Card "Documentos" → entry novo com badge "Novo" |
| D.2.3 | Paciente baixa | Paciente | URL assinada abre PDF |
| D.2.4 | Médico vê confirmação "visto" | Médico | Card mostra "Visto pelo paciente em HH:mm" |

### D.3 — Ciclo de WhatsApp (3 cenários)

| # | Passo | Quem | Esperado |
|---|---|---|---|
| D.3.1 | Médico liga toggle "Contato Direto" + configura horário | Médico | Persiste no banco (`whatsappHabilitado: true`) |
| D.3.2 | Paciente abre app dentro do horário | Paciente | Vê botão "Falar com sua médica" ativo |
| D.3.3 | Paciente fora do horário | Paciente | Vê "Disponível seg-sex 9h-18h, volte mais tarde" |

### D.4 — Notificações cruzadas (3 cenários)

| # | Evento | Notificação esperada | Canal |
|---|---|---|---|
| D.4.1 | Médico propõe retorno | Paciente recebe push? SMS? Email? | Verificar qual canal está ativo |
| D.4.2 | Paciente confirma retorno | Médico recebe notificação visível na aba Pacientes ou Hoje |
| D.4.3 | Médico anexa documento | Paciente recebe notificação |

**Total Camada D: ~15 cenários cruzados**

---

## 📊 RESUMO TOTAL

| Camada | Cenários | Status atual |
|---|---|---|
| A — Link pré-consulta | ~55 | 10 testados via Playwright, 45 manuais |
| B — Aba Pacientes médico | ~27 | 0 testados |
| C — Aba Consultas paciente | ~24 | 0 testados (3 esperam vazio) |
| D — Cruzados (médico↔paciente) | ~15 | 0 testados |
| **TOTAL** | **~121** | **10 testados / 111 pendentes** |

---

## 🚀 ORDEM RECOMENDADA DE EXECUÇÃO (priorização CEO)

### Sprint 1 — Validação básica (1-2 horas)
**Objetivo:** confirmar que fluxo principal funciona com seus dados reais.

1. **A.1.1** — Token válido, link novo (você como Lucas/P3) → quiz vita id → 11 perguntas → enviar
2. **A.3.5** — Misto áudio/texto (igual seu uso real)
3. **B.1.3** — Você abre Pacientes no médico desktop, vê a si mesmo
4. **B.3.1-B.3.4** — Abre o briefing de 1 minuto, valida anamnese 11/11
5. **C.5.1** — Você abre app paciente → aba Consultas → vê histórico

### Sprint 2 — Features cruzadas (1-2 horas)
**Objetivo:** validar que retorno/documentos/WhatsApp funcionam end-to-end.

6. **D.1** completo — Médico propõe retorno → você confirma → médico vê
7. **D.1.4b** — Remarcar com nova data
8. **D.2** completo — Médico anexa receita → você baixa
9. **D.3** completo — Médico liga WhatsApp → você vê botão

### Sprint 3 — Casos de borda críticos (1 hora)
**Objetivo:** validar que erros se tratam bem.

10. **A.4.1** — Sem internet no meio (desligar WiFi 30s)
11. **A.4.3** — Fechar aba e reabrir
12. **A.5.3** — Já respondida, clica de novo
13. **A.3.6** — Bug Bebo (regressão check)

### Sprint 4 — Personas variadas (2-3 horas)
**Objetivo:** confirmar que todos os perfis funcionam.

14. **A.1.6 + persona P1** (Beatriz nova) — pede pra alguém sem conta vita id testar
15. **A.2.3** — Abre link no WhatsApp in-app (do iPhone)
16. **A.3.3** — 11 "Não sei" → backend bloqueia?
17. **A.5.4** — Compartilhar link e outra pessoa loga (LGPD risk)

### Sprint 5 — Restante (~80 cenários)
Os restantes ficam pra rodar quando houver tempo. Priorize por **frequência** (quantos pacientes vão hit esse caminho) × **gravidade** (o que quebra se falhar).

---

## 🛠️ PRÉ-REQUISITOS PRA RODAR

### Logins necessários
- **Médico de produção** (seu) — pra criar PCs e validar lado médico
- **Paciente de produção** (seu) — pra responder as PCs
- **Paciente extra novato** (Beatriz fictícia) — pra testar A.1.6 sem conta

### URLs
- App médico: https://vitae-app.vercel.app/desktop/app-v2.html
- App paciente: https://vitae-app.vercel.app/app-v3/app.html
- Link de PC: gerado quando médico cria (formato `?token=XYZ`)
- Backend: https://vitae-app-production.up.railway.app

### Ferramentas
- 1 desktop (Chrome ou Edge) — médico
- 1 iPhone — paciente (pra simular casos reais)
- Opcional: 1 Android — paciente (compatibilidade cross-device)

### Estado inicial limpo
- ⚠️ Antes de começar: apagar as **22 PCs lixo (ROBO-*/AUDIO-*)** da bateria automatizada
- Confirmar que sua PC do iPhone com 10/11 (do dia 18) está resolvida (Opção A ou B do handoff)

---

## 📝 TEMPLATE PRA REGISTRAR RESULTADOS

Pra cada cenário testado, copia este bloco e preenche:

```
### Cenário [X.Y.Z]: [nome]
- Data/hora teste:
- Persona usada:
- Dispositivo/browser:
- Passos executados:
  1.
  2.
- Resultado: [✅ passou / ⚠️ parcial / ❌ falhou]
- Print/log (se falhou):
- Observação:
```

Posso transformar isso em planilha CSV se preferir tracking estruturado.

---

## 🎯 PRÓXIMO PASSO

Quando você me passar:
1. **Login médico** (email + senha)
2. **Login paciente** (email + senha)
3. **Sequência inicial** que quer atacar (sugiro **Sprint 1 + Sprint 2**)

Eu disparo automação Playwright onde der + relatório manual onde não der. O resultado de cada cenário vai pra:
- `tests/shots-cenarios-2026-05-19/` (prints por passo)
- `tests/logs/cenarios-2026-05-19.json` (relatório estruturado)
- `tests/RELATORIO-CENARIOS-2026-05-19.md` (resumo legível pra você decidir o que arrumar primeiro)

---

*Documento gerado por 3 agentes Explore paralelos + verificação cruzada do backend. 19/mai/2026.*
