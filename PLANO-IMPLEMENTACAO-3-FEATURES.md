# Plano de Implementação — 3 Features Médico ↔ Paciente

> Documento mestre pra aprovação do Lucas antes da implementação autônoma das 3 features novas (Próximo Retorno, Contato Direto WhatsApp, Documentos/Mídias).
>
> Baseado em 3 estudos paralelos: validação do storyboard vs app real do paciente, mapeamento do backend/sincronização entre apps, e estudo comportamental das personas médicas e pacientes via Obsidian.

---

## 1. Resumo Executivo

### O que já temos (frontend médico aprovado)
A tela Central Clínica do paciente no app médico está **aprovada** em `preview-central-clinica.html` — visual idêntico ao app real, sem login. Layout 3 colunas com timeline, IA Collab, retorno, WhatsApp, configurações, documentos e dados do paciente.

### O que falta (frontend paciente + backend)
O app v3 do paciente tem o **CSS pronto** pros 3 blocos novos (retorno, WhatsApp, documentos) em `16-consulta-detalhe.html`, mas **nenhum desses blocos renderiza dados ainda**. O backend não tem nenhuma das 3 tabelas/rotas necessárias.

### Tamanho do trabalho
- **Banco de dados:** 3 mudanças no schema (1 alteração + 2 tabelas novas)
- **Backend:** ~7 rotas novas
- **App médico:** plug do preview já aprovado nas rotas reais
- **App paciente:** ~600 linhas de JavaScript + ajustes no HTML
- **Estimativa total:** 7-9 dias de trabalho autônomo (3 fases independentes)

---

## 2. Estado Atual — O que existe vs o que falta

### Próximo Retorno

**Existe no banco hoje:**
A tabela `Agendamento` já tem campos `tipo` (com valor "RETORNO" permitido), `dataHora`, paciente, médico e local.

**Falta no banco:**
- Campo de **status da proposta** (proposto, confirmado, vencido, cancelado)
- Campo **quem propôs** (médico ou paciente — sabe quem iniciou)
- Campo **quem confirmou** (paciente sim ou não)

**Existe no app paciente:**
O arquivo `16-consulta-detalhe.html` tem a classe CSS `.retorno-card` pronta. Mas o HTML não renderiza esse card em lugar nenhum — está só esperando ser usado.

**Falta no app paciente:**
- O JavaScript que pega o agendamento atual e renderiza o card no estado certo (sem retorno, aguardando, confirmado, etc.)
- Botões de "Confirmar" e "Sugerir outra data" que funcionem de verdade
- Tela de seleção de nova data quando paciente sugere

### Contato Direto WhatsApp

**Existe no banco hoje:**
A tabela `Medico` tem `telefoneClinica` (fixo da clínica), mas isso é diferente. Não tem o telefone pessoal/profissional pra contato direto.

**Falta no banco:**
- Campo **whatsappHabilitado** (médico ativa ou não)
- Campo **whatsappTelefone** (número pra abrir wa.me)
- Campo **whatsappJanela** (dias da semana + horário de atendimento)
- Campo **whatsappPausadoAte** (pra "estou de férias até X")

**Existe no app paciente:**
A classe CSS `.talk-card` e `.btn-wa` estão prontas em `16-consulta-detalhe.html`. Sem dados pra alimentar.

**Falta no app paciente:**
- JavaScript que verifica se o médico habilitou
- Lógica de hora atual vs janela de atendimento (mostra verde dentro do horário, cinza fora)
- Texto contextual ("Disponível terça às 17h")
- Click que abre wa.me real do médico

### Documentos / Mídias

**Existe no banco hoje:**
**Nada.** Não há tabela de documentos do médico pra paciente. A tabela `Exame` é só pra upload do paciente. A `PreConsulta.audioUrl` é só pra áudio do paciente.

**Falta no banco:**
- Tabela **DocumentoMedico** completa: id, médico, paciente, consulta vinculada (opcional), tipo (laudo/receita/atestado), arquivo (URL Supabase Storage), nome, tamanho, timestamps de envio e visualização, soft-delete

**Existe no app paciente:**
A classe CSS `.doc` está pronta com layout pra lista de documentos.

**Falta no app paciente:**
- Lista de documentos da consulta atual
- Badge "Novo" pra não-visto
- Click pra abrir/baixar
- Marca como visualizado quando paciente abre

---

## 3. As 3 Features em Detalhe

### Feature 1 — Próximo Retorno

**O que o médico faz:**
No card "Próximo Retorno" da Central Clínica, clica em "Marcar retorno", escolhe data e hora, opcionalmente adiciona motivo. Sistema cria proposta com status "aguardando". Médico vê badge âmbar "Aguardando confirmação do paciente".

**O que o paciente vê:**
Recebe push (e fallback por email/SMS se push falhar) com "Sua médica propôs um retorno". Ao abrir o app, na aba Consultas → detalhe da consulta, aparece um card com a data grande, status âmbar "Confirme sua presença", botão verde "Confirmar" e botão cinza "Sugerir outra data".

**Estados possíveis:**
1. **Sem retorno** — médico vê CTA "Marcar retorno", paciente vê empty state contextual
2. **Proposto pelo médico** — badge âmbar nos dois apps, paciente tem botões de ação
3. **Contraproposta do paciente** — médico vê data original riscada vs nova proposta, com botões "Aceitar nova", "Manter original", "Cancelar"
4. **Confirmado** — badge verde, médico vê "confirmado em 15/mai · 09:32", paciente vê "Confirmado · Dra. Helena"
5. **Vencido** — badge vermelho 24h depois da data, médico tem "Remarcar" + "Registrar realizado", paciente vê "Você perdeu sua consulta"
6. **Cancelado** — qualquer lado cancela, o outro recebe notificação

**Frustração resolvida (médico):**
> "Marquei retorno verbalmente, paciente nunca voltou. Não sei se ele esqueceu ou desistiu. Perco continuidade clínica e tempo."

**Frustração resolvida (paciente):**
> "Saí da consulta achando que era 'em 30 dias', mas não anotei nada. Esqueci."

**Objeção principal do médico:**
> "Já uso Google Agenda da minha secretária — vai duplicar?"

**Resposta:** Não duplica. É confirmação, não agendamento operacional. Médico pode integrar via Google Calendar API depois (já existem campos `googleEmail` no schema).

**Objeção principal do paciente (Maria 45-55a, Sistema 1 cognitivo):**
> "Recebi notificação mas não sei o que clicar."

**Resposta UX:** Data gigante, 1 botão verde óbvio, confirmar em menos de 3 segundos. Se ignorar, retry automático em 24h e 7 dias antes da data.

**Riscos UX a evitar:**
- Data em texto relativo ("próxima semana") — sempre absoluto ("15 de junho")
- Estado intermediário sem feedback ("salvando...") por mais de 1.5 segundos
- Botão pequeno abaixo do fold (corte da tela)
- Sem confirmação visual ao clicar — pulse + toast verde imediato

---

### Feature 2 — Contato Direto WhatsApp

**O que o médico faz:**
Toggle "Permitir contato por WhatsApp" no card Contato Direto. Quando habilita, preenche o número, marca os dias da semana (Dom/Seg/Ter/Qua/Qui/Sex/Sáb) e define horário "Das 08:00 às 19:00". Salva. Pode pausar temporariamente (ex: férias até 22/mai).

**O que o paciente vê:**
Na aba Consultas → detalhe → se o médico habilitou, aparece um card "Contato Direto" com:
- **Dentro do horário:** botão verde "Falar com Dra. Helena" → abre wa.me/numero
- **Fora do horário:** botão cinza desabilitado + texto "Disponível segunda-feira às 17h"
- **Pausado:** "Dra. Helena indisponível, retorna em 22/mai"

**Estados possíveis:**
1. **Desabilitado** — paciente não vê nada
2. **Configurando** — médico digitou parcial, ainda não salvou; paciente não vê
3. **Dentro do horário** — botão verde, click abre WhatsApp
4. **Fora do horário** — botão cinza com próximo horário disponível
5. **Pausado** — indisponível com data de retorno

**Frustração resolvida (médico Carlos, consultório solo):**
> "Pacientes me mandam WhatsApp no celular pessoal. Misturado com mensagens da família. Sem auditoria."

**Resposta:** Número fica registrado, paciente vê janela de horário claramente, link wa.me oficial.

**Objeção principal do médico (Helena Volume):**
> "Vou virar plantonista 24h? Não consigo responder 200 pacientes."

**Resposta:** Janela rigorosa de horário visível pro paciente + opção de pausar quando quiser. Aviso "Para emergências, ligue 192" obrigatório no card do paciente.

**Objeção do médico Beatriz (especialista premium):**
> "Risco legal — se paciente mandar mensagem e eu não vir, é responsabilidade minha?"

**Resposta:** Sistema mostra ao paciente "Respostas em até 24h úteis" — define expectativa clara. Não cria obrigação legal de resposta imediata.

**Risco UX (paciente):**
- Sem aviso de horário → paciente manda 23h e espera resposta imediata, frustra os dois.
- Resposta:Texto **sempre visível** no card: "Disponível seg-sex 17h-19h · Respostas em até 24h"

**Por que essa feature funciona melhor para o Carlos:**
Ele já usa WhatsApp como hábito. O vita id remove o atrito (não precisa dar número pessoal) e adiciona auditoria.

---

### Feature 3 — Documentos / Mídias

**O que o médico faz:**
Na seção "Documentos" da Central Clínica, clica "+ Anexar". Seleciona PDF, JPG ou PNG (máx 10 MB). Define tipo: Laudo / Receita / Atestado / Encaminhamento / Outro. Sistema sobe pro Supabase Storage, cria registro no banco, envia notificação ao paciente.

**O que o paciente vê:**
Na aba Consultas → detalhe → seção Documentos. Cada documento aparece como linha com:
- Ícone do tipo (PDF/IMG) colorido
- Nome do arquivo
- Data de envio
- Médico que enviou
- Badge "Novo" se ainda não foi aberto
- Click abre/baixa o arquivo

Quando paciente abre, sistema marca como visualizado e médico vê timestamp "Visto em 16/mai · 10:32".

**Estados possíveis:**
1. **Sem documentos** — empty state contextual, paciente vê "Sua médica ainda não enviou nenhum documento"
2. **Upload em andamento** — médico vê barra de progresso, paciente não vê nada ainda
3. **Enviado, não visto** — paciente vê badge "Novo" amarelo, médico vê indicador "não visualizado"
4. **Visualizado** — badge some, médico vê timestamp
5. **Upload falhou** — médico vê erro com botão "Tentar novamente", paciente não vê
6. **Excluído pelo médico** — soft-delete, paciente recebe push "Dra. Helena removeu um documento"
7. **Paciente sem app** — link com token único enviado por SMS/email pra acesso direto

**Ranking de importância dos tipos (do paciente):**
1. **Laudo de exame** — paciente quer ver resultados (glicose, hemoglobina)
2. **Receita** — precisa guardar pra farmácia
3. **Atestado** — leva pro trabalho/INSS
4. **Relatório de consulta** — referência futura

**Frustração resolvida (médico):**
> "Tirava foto do laudo no celular pessoal e mandava por WhatsApp pessoal. Qualidade ruim, sem rastreamento, paciente perdia."

**Frustração resolvida (paciente):**
> "Recebi foto do laudo, salvei na galeria, perdi. Hoje preciso pra ir no farmacêutico e não acho."

**Objeção do médico Beatriz:**
> "E se paciente abrir e não entender o resultado?"

**Resposta:** Possibilidade futura — área de comentário do médico abaixo do documento. Não MVP.

**Objeção do paciente:**
> "Vão vazar meu laudo?"

**Resposta UX:** Documento fica dentro do app vita id, com URL assinada de 7 dias do Supabase. Não é link público.

**Risco UX:**
- PDF grande (3MB+) trava ao abrir — implementar preview de primeira página antes do download completo
- Laudo em imagem sem possibilidade de buscar texto — preferir PDF sempre, com warning se subir imagem
- Sem notificação ao paciente — push obrigatório com som "Você recebeu um documento da Dra. Helena"

---

## 4. Banco de Dados — Mudanças Exatas

### Alteração 1: Tabela Agendamento (já existe)
Adicionar:
- `statusProposta` (texto, valores: PROPOSTO, CONFIRMADO, RECUSADO, CONTRAPROPOSTA, CANCELADO, VENCIDO, REALIZADO)
- `propostoPor` (id do usuário que iniciou — médico ou paciente)
- `confirmadoEm` (timestamp de quando o outro lado aceitou)
- `dataAnterior` (se houve contraproposta, guarda a data original)

### Tabela Nova 1: ConfigContatoMedico
Pra Contato Direto:
- `medicoId` (link com Medico)
- `habilitado` (boolean)
- `telefone` (texto, formato +5511987654321)
- `dias` (lista de inteiros 0-6, onde 0=domingo)
- `horaInicio` e `horaFim` (texto formato "08:00")
- `pausadoAte` (data, opcional)
- `criadoEm`, `atualizadoEm`

### Tabela Nova 2: DocumentoMedico
Pra Documentos:
- `medicoId`, `pacienteId` (sempre obrigatórios)
- `consultaId` (opcional — pode anexar documento "solto" sem vincular consulta específica)
- `tipo` (LAUDO, RECEITA, ATESTADO, ENCAMINHAMENTO, OUTRO)
- `nome` (nome do arquivo original)
- `arquivoUrl` (URL Supabase Storage)
- `tamanhoBytes`, `mimeType`
- `descricao` (opcional, comentário do médico)
- `visualizadoEm` (timestamp quando paciente abriu)
- `excluidoEm` (soft-delete)
- `criadoEm`

### Permissões — usar AutorizacaoAcesso que já existe
A tabela `AutorizacaoAcesso` já existe e tem campo `categorias` (lista de textos). Adicionar 3 valores possíveis: `retorno`, `documentos`, `contato`. Médico só vê/cria essas coisas se paciente autorizou aquela categoria.

---

## 5. Rotas Backend — O que criar

### Próximo Retorno
- `POST /agendamento/proposta` — médico propõe data
- `PUT /agendamento/:id/confirmar` — paciente confirma
- `PUT /agendamento/:id/contraproposta` — paciente sugere outra data
- `PUT /agendamento/:id/cancelar` — qualquer lado cancela
- `GET /agendamento/pendentes` — paciente vê todas propostas dele

### Contato Direto
- `GET /medico/contato-config` — médico lê config atual
- `PUT /medico/contato-config` — médico salva config
- `GET /paciente/contato-medico/:medicoId` — paciente vê config do médico (se autorizado)

### Documentos
- `POST /documentos` — médico faz upload (multipart, sobe pro Supabase)
- `GET /documentos/paciente/:pacienteId` — médico lista
- `GET /documentos/meus` — paciente lista os dele
- `PUT /documentos/:id/visualizado` — paciente marca como visto (auto-chamado ao abrir)
- `DELETE /documentos/:id` — médico soft-delete

### Notificações
Já existe sistema de push (Web Push API). Estender pra:
- Push quando médico propõe retorno
- Push quando paciente confirma/recusa
- Push quando documento novo é anexado
- Email fallback se push falhar 2x

### Job de vencimento
Cron diário (00:00) que muda status de agendamentos para VENCIDO se passou 24h da `dataHora` sem confirmação ou comparecimento.

---

## 6. Frontend Médico — O que falta

A tela `preview-central-clinica.html` está **aprovada visualmente**. Precisa virar `desktop/app-v2.html` real:

1. Substituir dados mock (3 pacientes hardcoded) por chamadas reais à API
2. Toggle WhatsApp passa a salvar via `PUT /medico/contato-config`
3. Click "Marcar retorno" abre modal de data → `POST /agendamento/proposta`
4. Click "+ Anexar" abre dropzone → `POST /documentos`
5. Click "Confirmar/Reagendar/Cancelar" no card de retorno → rotas correspondentes
6. Estados em tempo real: WebSocket ou polling a cada 30s pra atualizar status do paciente

---

## 7. Frontend Paciente — O que adicionar

Em `app-v3/16-consulta-detalhe.html`, adicionar 3 blocos novos que vão usar o CSS já pronto:

### Bloco Próximo Retorno
- Função `renderRetorno()` que chama `GET /agendamento/pendentes` e renderiza o card no estado correto
- Botões "Confirmar" e "Sugerir" que chamam as rotas
- Datepicker simples pra contraproposta

### Bloco Contato Direto
- Função `renderContato()` que chama `GET /paciente/contato-medico/:id` e decide:
  - Se desabilitado: não renderiza
  - Se dentro do horário: botão verde com `wa.me`
  - Se fora: botão cinza com texto contextual
  - Se pausado: mensagem de retorno
- Cálculo de janela usa hora local do paciente

### Bloco Documentos
- Função `renderDocumentos()` que chama `GET /documentos/meus?consultaId=X`
- Lista com ícones por tipo
- Badge "Novo" se `visualizadoEm` é nulo
- Click abre arquivo + chama `PUT /documentos/:id/visualizado` em background

### Notificações
- Service Worker pra receber push
- Badge na aba Consultas mostra quantos documentos/retornos não vistos
- Pull-to-refresh atualiza tudo

---

## 8. Fluxos de Sincronização — Passo a passo

### Fluxo Retorno (Happy path)
1. Médico abre Central Clínica do paciente Álvaro
2. Clica "Marcar retorno" → modal → 15/jul 14h → Salvar
3. Backend: cria Agendamento com status PROPOSTO, salva, dispara push pro paciente
4. Paciente recebe push "Sua médica propôs um retorno em 15/jul" → toca → abre app → Consultas → vê card âmbar
5. Clica "Confirmar" → backend muda status pra CONFIRMADO → push pro médico
6. Médico vê badge verde "Confirmado" na próxima abertura da Central Clínica

### Fluxo Documento
1. Médico clica "+ Anexar" → seleciona PDF do laudo do hemograma → sistema sobe pro Supabase
2. Backend salva DocumentoMedico, gera URL assinada de 7 dias, dispara push
3. Paciente vê notificação "Dra. Helena enviou um documento" → abre app → Consultas → card vermelho "1 novo"
4. Toca no documento → abre em viewer → backend marca `visualizadoEm`
5. Médico, ao abrir Central Clínica de novo, vê "Visto em 16/mai · 10:32"

### Fluxo WhatsApp (configuração inicial)
1. Médico abre Central Clínica de qualquer paciente → toggle Contato Direto OFF → clica → vira ON
2. Preenche número, dias e horário → "Salvar"
3. Backend salva ConfigContatoMedico
4. Daquele momento em diante, qualquer paciente que abrir uma consulta com esse médico vê o card de contato (se a categoria estiver autorizada)

---

## 9. Notificações — Como o paciente sabe que algo novo aconteceu

### Hierarquia de notificação
1. **Push web (preferencial)** — instantâneo, funciona com app fechado, dispensa servidor SMS pago
2. **Email fallback** — se push falhar 2x consecutivas
3. **Badge no app** — toda vez que paciente abre, mostra quantos itens não vistos na aba Consultas
4. **SMS** — só pra paciente sem app instalado (fluxo separado, fora desta fase)

### O que dispara push
- Retorno proposto pelo médico
- Retorno confirmado pelo paciente (notifica médico)
- Documento anexado pelo médico
- 24h antes da data do retorno confirmado (lembrete)

### O que NÃO dispara push
- Médico habilita WhatsApp (paciente vê quando abrir o app, sem urgência)
- Documento excluído (toast no app, sem push)

---

## 10. Plano de Implementação em 3 Fases

### Fase 1 — Próximo Retorno (3-4 dias)
**Por que primeiro?** Tabela Agendamento já existe, é só estender. Resolve maior frustração diária do médico. Validação rápida do conceito médico↔paciente.

**Entregas:**
- 4 campos novos em Agendamento
- 5 rotas backend
- Plug no app médico (modal + ações no card)
- Implementação no app paciente (card no detalhe da consulta)
- Push notifications
- Job de vencimento

**Como testar:** Médico propõe → paciente recebe push → confirma → médico vê. Cenário com contraproposta. Cenário vencido (forçar data passada).

### Fase 2 — Documentos (3-4 dias)
**Por que segundo?** Mais complexo (Supabase Storage, soft-delete), mas valor enorme. Já há infra de upload pra reusar (telas de exame).

**Entregas:**
- Tabela DocumentoMedico
- Bucket Supabase configurado pra documentos médicos (URLs assinadas 7 dias)
- 5 rotas backend
- Dropzone no app médico
- Lista no app paciente com badge "Novo"
- Marca como visualizado automático
- Push notifications

**Como testar:** Upload PDF/JPG → paciente recebe push → abre → médico vê visualizado. Upload falhou → retry. Exclusão → soft-delete preserva auditoria.

### Fase 3 — Contato Direto WhatsApp (2 dias)
**Por que terceiro?** Mais simples tecnicamente (sem upload, sem propostas), mas requer cuidado UX (janela de horário, comportamento "fora do horário"). Aproveita aprendizado das fases anteriores.

**Entregas:**
- Tabela ConfigContatoMedico
- 3 rotas backend
- Form de configuração no app médico (já está no preview)
- Card no app paciente com lógica de horário em tempo real
- Aviso de janela visível

**Como testar:** Médico habilita → paciente vê botão. Mudar relógio do sistema pra simular fora do horário. Pausar e voltar a habilitar.

---

## 11. Testes — Auto-validação contínua com Playwright

### Princípio
Eu mesmo navego e simulo o uso real **antes de você testar**. Você só vê uma fase como "pronta" depois que a bateria Playwright passou 100% no meu lado. Zero "tenta aí, talvez funcione". Só te chamo quando o bot médico + bot paciente fizeram o fluxo inteiro sem erro.

### Pipeline por sub-fase (executado autonomamente)
```
[implemento código] 
   ↓
[node --check sintaxe backend + Function constructor sintaxe frontend]
   ↓
[deploy local: serve.js na 3000 + backend Railway prod]
   ↓
[Playwright headed em Edge: bot médico abre desktop, faz ação]
   ↓
[Playwright headed: bot paciente abre mobile (viewport 393x852, iPhone Safari user-agent)]
   ↓
[asserts: payload backend correto, banco persistiu, frontend renderizou, push disparou]
   ↓
[capturas em tests/shots/<fase>/<passo>.png pra log forense]
   ↓
[bug? → corrijo → repete] | [tudo verde? → commit + push + próxima sub-fase]
```

### Baterias Playwright que vou criar (1 por feature)

**tests/e2e-retorno.js** — Cobre Próximo Retorno end-to-end:
- Médico abre Central Clínica do paciente
- Clica "+ Marcar retorno", escolhe data 15/jul, salva
- Backend retorna 200, banco tem `statusProposta='AGUARDANDO'`
- Bot paciente abre app, navega pra Consultas, vê card "15 jul · Aguardando confirmação"
- Bot paciente clica "Confirmar"
- Backend persiste `statusProposta='CONFIRMADO'` + `confirmadoEm` timestamp
- Bot médico recarrega → card vira verde "Confirmado pelo paciente"
- Edge cases: paciente recusa, paciente remarca, médico cancela, push notification dispara

**tests/e2e-documentos.js** — Cobre Documentos:
- Médico anexa PDF 124 KB (simula upload via fixtures/receita-mock.pdf)
- Backend cria registro DocumentoMedico + URL assinada Supabase
- Bot paciente abre app, vê dot azul no perfil indicando doc novo
- Clica, abre PDF em aba nova (assert window.open chamado com URL Supabase)
- Backend marca `visualizadoEm` no banco
- Bot médico recarrega → status vira "Visto"
- Edge cases: upload > 10 MB rejeitado com erro amigável, doc deletado some pro paciente, paciente sem permissão vê 403

**tests/e2e-whatsapp.js** — Cobre Contato Direto:
- Médico abre Configurações de Contato, ativa toggle
- Define dias seg-sex + horário 8h-19h, salva
- Backend persiste ConfigContatoMedico
- Bot paciente abre perfil do médico no app, vê botão WhatsApp visível (dentro do horário) ou cinza fora
- Click WhatsApp → window.open com wa.me/55XXXXXXXX + mensagem padrão
- Edge cases: médico fora do horário (botão cinza + texto "Disponível seg-sex 8h-19h"), médico desligou toggle (botão some)

**tests/e2e-master.js** — Smoke completo encadeado:
- Médico cria pré-consulta → paciente responde → médico abre Central → marca retorno + anexa doc + ativa WhatsApp → paciente recebe 3 notificações → confirma retorno + baixa doc + manda WhatsApp → médico vê tudo sincronizado em < 30s

### Critério de "fase pronta"
Uma fase só é considerada pronta quando:
- ✓ Bateria Playwright da fase passou 100% (zero retry, zero falha intermitente)
- ✓ Bateria master continua passando (não quebrei nada anterior)
- ✓ Sintaxe limpa: `node --check` em todos os .js modificados, sem warnings
- ✓ Logs do Playwright salvos em `tests/shots/<fase>/` pra auditoria
- ✓ Commit feito com mensagem clara descrevendo a fase
- ✓ Deploy automático Vercel + Railway concluído (espero 60s + ping endpoint pra confirmar)
- ✓ Smoke test em prod: 1 chamada real pra cada endpoint novo, valida 200

Só depois disso eu marco a fase como ✓ no HANDOFF.md e parto pra próxima.

### Loop de correção de bug encontrado em produção (caso ache)
Se durante o Playwright eu descobrir um bug em código JÁ existente (fora do escopo das 3 features):
1. Documento em `BUGS-DESCOBERTOS-DURANTE-IMPL.md` com reprodução + causa
2. **NÃO corrijo silenciosamente** — listo no HANDOFF pra você decidir prioridade
3. Continuo a fase original sem desviar (princípio "não inventar trabalho")

---

## 12. Riscos e Mitigações

### Risco 1 — Paciente deslogado não recebe notificação
**Probabilidade:** alta (Maria 45-55a esquece senha)
**Mitigação:** Email fallback obrigatório. Quando paciente fizer login depois, mostra todos os itens não vistos com badge.

### Risco 2 — Job de vencimento falha silenciosamente
**Probabilidade:** média
**Mitigação:** Logs com alerta se job não rodou em 25h. Endpoint manual de re-trigger pra reprocessamento.

### Risco 3 — Médico Beatriz desconfia da rastreabilidade
**Probabilidade:** alta (persona conservadora)
**Mitigação:** Tela de auditoria mostra exatamente quem viu, quando, IP da visualização. Conformidade CFM 2.314/2022 documentada.

### Risco 4 — Paciente envia WhatsApp 23h achando que vai ser respondido
**Probabilidade:** muito alta
**Mitigação:** Texto **sempre visível** "Respostas em até 24h úteis". Não basta esconder o botão fora do horário — precisa educar sobre expectativa de resposta.

### Risco 5 — Documento grande (10 MB+) trava o app
**Probabilidade:** média
**Mitigação:** Limite hardcoded 10 MB no backend. Frontend mostra erro educativo antes do upload se passar do limite. PDFs grandes — implementar viewer com paginação no futuro.

### Risco 6 — Conflito entre Agendamento "manual" do médico e Próximo Retorno
**Probabilidade:** baixa
**Mitigação:** Mostrar TODOS os agendamentos do paciente na aba Consultas, com filtro por tipo. Status "manual" vs "proposto" claros.

---

## 13. Decisões finais já tomadas (defaults razoáveis)

As 5 perguntas que estavam abertas foram fechadas com defaults conservadores. Tudo abaixo é decisão final — você só precisa dizer "vai" pra eu começar.

### Decisão 1 — Ordem das fases: **Retorno → Documentos → WhatsApp**
**Por quê:** Retorno tem menor risco técnico (Agendamento já existe, só adicionar 4 campos). Documentos tem maior risco (upload + Storage + URLs assinadas). WhatsApp é o mais simples mas menos crítico. Construir confiança da fácil pra arriscada.

### Decisão 2 — Schema do banco: **OK, com pg_dump obrigatório antes de cada migration**
**Regras absolutas (do CLAUDE.md, sessão 17/04 incidente):**
- Backup `pg_dump $DATABASE_URL > backups/pre-fase-N-AAMMDD.dump` antes de qualquer alteração
- NUNCA `--accept-data-loss`
- NUNCA `prisma db push` no script `build`
- Migrations versionadas via `npx prisma migrate dev --create-only` + aplicação manual via `railway run psql -f migration.sql`
- Cada migration é ADD COLUMN nullable ou CREATE TABLE — zero risco de drop

### Decisão 3 — Implementação autônoma: **SIM, sem pausar entre fases**
**Por quê:** Você pediu explicitamente "só termina quando fizer deploy de tudo". Pipeline Playwright garante que cada fase passou no meu lado antes de partir pra próxima. Se o Playwright achar bug, eu corrijo e re-rodo até passar — só te chamo quando tudo verde.

**Exceção:** se o Playwright revelar que uma decisão arquitetural precisa virar (ex: schema novo causa conflito imprevisto), eu paro, documento em ALERTA-PAUSA.md e te chamo. Caso raro.

### Decisão 4 — Push notifications: **SIM, desde Fase 1**
**Por quê:** Infraestrutura `PushSubscription` já existe no banco. Não é custo extra de implementação. Sem push, a feature de Retorno fica meio capenga (paciente só vê quando reabrir o app, que pode ser dias depois).
**Fallback:** se push falhar, banner in-app com badge + email opcional. Não bloqueia o fluxo.

### Decisão 5 — Persona priorizada: **Helena Volume**
**Por quê:** Mais sensível a fricção (50+ pacientes/dia). Se a UX funcionar pra Helena, funciona pros outros 6. Otimizações específicas: 1-clique pra ações comuns (marcar retorno padrão "30 dias úteis"), bulk actions futuras (Fase 2+), zero modais bloqueantes.

---

## 14. Gate de início

**Você só precisa responder "vai" (ou "aprovado", "ok", "começa").** Isso dispara:

1. Backup pg_dump do banco prod → `backups/pre-fase-1-AAMMDD.dump`
2. Branch `feat/proximo-retorno` criado a partir de main
3. Migration Prisma + aplicação via psql direto
4. 5 rotas backend novas + testes node --check
5. Frontend médico: plug do modal "Marcar retorno" + ações do card em `desktop/app-v2.html`
6. Frontend paciente: `renderRetorno()` em `16-consulta-detalhe.html`
7. Push notification service worker + endpoint trigger
8. Bateria Playwright `tests/e2e-retorno.js` rodada até 100% verde
9. Commit + push + deploy Vercel/Railway
10. Smoke test em prod
11. Marco Fase 1 ✓ no HANDOFF e parto pra Fase 2

**Te chamo apenas em 3 cenários:**
- ✓ Fase inteira passou Playwright → "Fase 1 verde, vou pra Fase 2" (informativo, não bloqueante)
- ⚠ Bug arquitetural exige sua decisão → pauso e abro ALERTA-PAUSA.md
- ✓ Deploy final das 3 fases concluído → "Tudo pronto pra você testar"

---

**Documento gerado por:** consolidação de 3 estudos paralelos (storyboard validation + backend mapping + behavioral study via Obsidian) + pipeline de auto-validação Playwright.
**Próximo passo:** sua palavra "vai" inicia execução autônoma da Fase 1.
