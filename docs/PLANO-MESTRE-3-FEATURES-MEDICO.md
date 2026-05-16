# PLANO MESTRE — 3 features para o app médico vita id

**Anexar mídias · Propor retorno · Liberar WhatsApp por janela**

> Documento massivo de planejamento UX/Produto/Arquitetura. PT-BR humano, sem código. Lucas Borelli (CEO, 18 anos, não-técnico) é o leitor primário. Densidade alta por escolha — Lucas pediu "pensar em literalmente tudo".

---

## ÍNDICE

- [PARTE 0 — CONTEXTO](#parte-0--contexto)
- [PARTE 1 — TESE E PRINCÍPIOS GUIA](#parte-1--tese-e-princípios-guia)
- [PARTE 2 — A ARQUITETURA EMOCIONAL DAS 3 FEATURES](#parte-2--a-arquitetura-emocional-das-3-features)
- [PARTE 3 — ORDEM DE IMPLEMENTAÇÃO](#parte-3--ordem-de-implementação-anexar--retorno--whatsapp)
- [PARTE 4 — LOCALIZAÇÃO GLOBAL E ANATOMIA DO NOVO ACCORDION](#parte-4--localização-global-e-anatomia-do-novo-accordion)
- [PARTE 5 — FEATURE 1: ANEXAR MÍDIAS](#parte-5--feature-1-anexar-mídias-laudo-atestado-receita-exame-áudio)
- [PARTE 6 — FEATURE 2: PROPOR RETORNO](#parte-6--feature-2-propor-data-de-retorno)
- [PARTE 7 — FEATURE 3: LIBERAR WHATSAPP POR JANELA](#parte-7--feature-3-liberar-contato-whatsapp-por-janela)
- [PARTE 8 — FLUXO DE DADOS COMPLETO](#parte-8--fluxo-de-dados-completo)
- [PARTE 9 — BACKEND DETALHADO](#parte-9--backend-detalhado)
- [PARTE 10 — CICLO DE NOTIFICAÇÕES](#parte-10--ciclo-de-notificações)
- [PARTE 11 — APP PACIENTE V3: OS 3 BLOCOS PREENCHIDOS](#parte-11--app-paciente-v3-os-3-blocos-preenchidos)
- [PARTE 12 — APP MÉDICO DESKTOP: MUDANÇAS VISUAIS POR ABA](#parte-12--app-médico-desktop-mudanças-visuais-por-aba)
- [PARTE 13 — O QUE SUMIR, TRANSFERIR OU GANHAR NOVA CAMADA](#parte-13--o-que-sumir-transferir-ou-ganhar-nova-camada)
- [PARTE 14 — ROADMAP COM 3 FASES](#parte-14--roadmap-com-3-fases)
- [PARTE 15 — VALIDAÇÃO CRUZADA COM 7 PERSONAS](#parte-15--validação-cruzada-com-7-personas)
- [PARTE 16 — COPY POR PERSONA E POR FEATURE](#parte-16--copy-por-persona-e-por-feature)
- [PARTE 17 — RISCOS E MITIGAÇÕES (TOP 12)](#parte-17--riscos-e-mitigações-top-12)
- [PARTE 18 — MÉTRICAS DE SUCESSO POR FEATURE](#parte-18--métricas-de-sucesso-por-feature)
- [PARTE 19 — ACESSIBILIDADE](#parte-19--acessibilidade)
- [PARTE 20 — OFFLINE, SYNC E IDEMPOTÊNCIA](#parte-20--offline-sync-e-idempotência)
- [PARTE 21 — TELEMETRIA E A/B TESTING](#parte-21--telemetria-e-ab-testing)
- [PARTE 22 — ROLLBACK STRATEGY](#parte-22--rollback-strategy)
- [PARTE 23 — IMPACTO NAS HIPÓTESES NÃO VALIDADAS](#parte-23--impacto-nas-hipóteses-não-validadas)
- [PARTE 24 — DEPENDÊNCIAS EXTERNAS](#parte-24--dependências-externas-e-gates-humanos)
- [PARTE 25 — CRITICAL FILES](#parte-25--critical-files-arquivos-a-modificar)
- [PARTE 26 — VERIFICATION](#parte-26--verification-como-testar-end-to-end)
- [PARTE 27 — DECISÕES PENDENTES](#parte-27--decisões-pendentes-3-perguntas-finais-ao-lucas)

---

## PARTE 0 — CONTEXTO

### Por que este plano existe

O app paciente v3 da vita id foi deployado em 14-15/mai/2026 em `https://vitae-app.vercel.app/app-v3/app.html` após 10 lotes de implementação (135/135 testes Playwright passando). Está 95% pronto. Tem 32 telas conectadas ao backend real.

Mas dentro do app paciente v3, especificamente na **tela detalhe de consulta** (`16-consulta-detalhe.html`), 3 blocos visuais foram **removidos no Lote 5** porque continham dados falsos (Renata Cardoso, Losartana 50mg, laudo cardiológico inexistente). Esses 3 blocos representam o **cordão umbilical pós-consulta** entre médico e paciente:

| Bloco vazio no paciente | Pergunta que o paciente faz e que o app não responde |
|---|---|
| **Documentos da médica** | "Onde está meu laudo / atestado / receita?" |
| **Retorno proposto** | "Quando minha médica quer me ver de novo?" |
| **Conversar pelo WhatsApp** | "Posso falar com ela fora da consulta?" |

Esses dados não existem em lugar nenhum do sistema **porque o médico nunca teve onde produzi-los**. O app médico desktop (`desktop/app-v2.html`, 6446+ linhas, em produção) hoje gerencia:
- Pré-consulta (gravação de áudio pelo paciente antes da consulta)
- Anamnese estruturada (11 campos)
- IA Collab (comparação entre anamneses)
- Padrões observados (insights clínicos)
- Templates de perguntas
- Métricas honestas (5 inputs do médico)
- Agendamentos via Google Calendar

Mas o médico **não tem como**:
1. Anexar laudo/atestado/receita/exame/áudio para um paciente específico
2. Propor uma data de retorno e receber confirmação/contraproposta
3. Liberar contato WhatsApp em horários específicos

### O problema mais profundo: o pós-consulta é mudo

Hoje, depois de uma consulta:
- O médico **fala** "te vejo em 30 dias" — fica no ar
- O médico **imprime** receita — pode perder, pode rasgar
- O médico **pede** "manda WhatsApp se precisar" — ou paciente vira invasor da vida pessoal, ou nunca contata
- O paciente sai com sumário **na cabeça** — o app vita id dele não tem nada novo

Sem esses 3 canais, o paciente entra no app, vê os blocos vazios, percebe que vita id é "lembrança de consulta passada" — não cordão umbilical contínuo. Risco de abandono pós-primeira-consulta é altíssimo.

### O que este plano resolve

Cria **um único accordion** novo no app médico — **"Consulta & Retorno"** — dentro do perfil do paciente (aba Pacientes), com 4 sub-blocos:
1. Próxima pré-consulta (já existe parcialmente — só consolida)
2. Retorno agendado
3. Documentos anexados
4. Contato WhatsApp

E **5 mudanças cirúrgicas** no app médico:
- Novo stat na aba Hoje ("Retornos confirmados nesta semana")
- Chip "tem anexo" nos cards da aba Pré-Consultas
- Atalho no sumário de 1 minuto ("Anexar laudo")
- Banner matinal "Você tem WhatsApp ativo com X pacientes"
- Card "Retornos pendentes" se transforma de promocional para funcional

E **8 mudanças cirúrgicas** no app paciente v3:
- 3 blocos vazios da tela detalhe preenchidos
- Chips de status nos cards da aba Consultas
- Push notifications novas
- Estados vazios pensados (com copy acolhedor)
- Estado "fora do horário comercial" do WhatsApp

E no **backend**:
- 2 tabelas novas (zero risco de schema destrutivo)
- 2 campos novos no model Medico
- 5 rotas novas
- 1 bucket novo no Supabase Storage

### O que NÃO está neste plano

Coisas explicitamente deixadas para depois (escopo controlado):
- Telemedicina (consulta por vídeo dentro do app)
- Prescrição eletrônica integrada (assinatura digital ICP-Brasil)
- Plano premium / pagamento (já tem estratégia separada em memória)
- Push notifications avançadas (FCM/APNS) — ficamos com SMS + push web
- Sincronização com iClinic (export já existe, integração bidirecional fica pra depois)
- Análise prosódica do áudio do médico (só do paciente já existe)
- Recurso "Cancelar consulta" — bidirecional, fica como hipótese
- Modo cuidador (Sandra opera pela Helena — enterrado por decisão do Lucas)
- Documentos múltiplos por consulta com versionamento (versão 1 = só lista plana)
- Áudios de orientação editáveis (versão 1 = grava, anexa, fim)

---

## PARTE 1 — TESE E PRINCÍPIOS GUIA

### Tese central em uma frase

> **Um único accordion novo, "Consulta & Retorno", dentro do perfil do paciente no app médico, com 4 sub-blocos que alimentam diretamente os 3 espaços vazios do paciente v3 — controlando com precisão o que sai, quando sai, e por quanto tempo fica disponível — para que o médico ganhe poder pós-consulta sem perder fronteira pessoal.**

### 7 princípios guia (em ordem de prioridade)

| # | Princípio | Implicação prática |
|---|---|---|
| 1 | **Médico no controle absoluto** | Nada sai sem ato consciente do médico. Sem automação que entrega coisas "por padrão". Cada feature exige clique deliberado. |
| 2 | **Janela > permanência** | Tudo que o médico libera tem **data de expiração obrigatória**. Não existe "WhatsApp liberado pra sempre". Não existe "documento sempre visível". Tudo expira. |
| 3 | **Reaproveitamento maciço** | 70% dos componentes visuais e técnicos já existem (dropzone, modal, sheet, datepicker, toggle, badge, animação). Zero invenção desnecessária. |
| 4 | **Boundary > convenience** | Médico SEMPRE pode reduzir alcance, NUNCA é forçado a expandir. WhatsApp nunca abre sem opt-in. Retorno nunca é automático. |
| 5 | **Sistema 1 antes do Sistema 2** | Estados visuais (verde/amarelo/vermelho/cinza) em 200ms antes de qualquer texto. Médico reconhece status do paciente em batida de olho. |
| 6 | **Zero linguagem de startup** | Não fala "IA", "automação inteligente", "experiência otimizada". Fala "anexar", "propor retorno", "liberar contato". Verbos médicos diretos. |
| 7 | **LGPD + CFM como espinha dorsal** | Cada feature tem implicação jurídica explicada. Toda autorização tem disclaimer visível. Todo acesso a documento é logado. WhatsApp tem retenção de log 5 anos (CFM 2.314/2022). |

### O que NÃO faremos (anti-padrões explícitos)

- ❌ Não vamos criar uma "Caixa de Entrada" geral do médico (sobrecarga cognitiva)
- ❌ Não vamos automatizar proposta de retorno baseada em condição clínica (overstepping)
- ❌ Não vamos sugerir frases de mensagem por IA (banner "vita id sugere") — só template fixo opcional
- ❌ Não vamos integrar com email (mais um canal = mais um lugar pra falhar)
- ❌ Não vamos permitir paciente iniciar conversa de WhatsApp se médico não liberou (zero "olha quem entrou no consultório")
- ❌ Não vamos cobrar pela feature no MVP (cobrança vem depois, modelo Superhuman R$449/mês já está mapeado em memória)
- ❌ Não vamos enviar lembretes diários ao médico ("você tem X documentos por anexar") — vira ruído
- ❌ Não vamos mostrar log de conversas WhatsApp dentro do vita id (não é nosso papel guardar conversa real — só guardamos metadata)

---

## PARTE 2 — A ARQUITETURA EMOCIONAL DAS 3 FEATURES

Antes de qualquer pixel, qualquer rota, qualquer tabela — entender o que cada feature **gera emocionalmente** no médico e no paciente. Sem isso, design vira chute.

### Mapa emocional — Médico

| Feature | Primeira emoção do médico | Segunda emoção (após 30 segundos) | Emoção do dia seguinte | Emoção do mês seguinte |
|---|---|---|---|---|
| **Anexar mídia** | Alívio ("não preciso correr atrás do paciente") | Curiosidade ("posso anexar áudio?") | Hábito ("já é parte da rotina pós-consulta") | Tranquilidade ("tudo rastreado") |
| **Propor retorno** | Esperança ("paciente vai voltar") | Pressão ("preciso fazer pra todos?") | Validação ("paciente confirmou") | Compromisso ("é meu canal oficial") |
| **Liberar WhatsApp** | Pavor ("vou ser invadido") | Curiosidade controlada ("posso fechar janela?") | Atenção ("paciente clicou 2x") | Senso de controle ("só com pacientes selecionados") |

### Mapa emocional — Paciente

| Feature | Primeira emoção | Segunda emoção | Emoção do dia seguinte |
|---|---|---|---|
| **Receber documento** | Alívio ("não perdi o laudo") | Confiança ("médica organizada") | Segurança ("tenho prova do atestado") |
| **Receber proposta de retorno** | Surpresa positiva ("ela quer me ver") | Reflexão ("essa data dá?") | Compromisso ("marquei agenda") |
| **Ver botão WhatsApp** | Validação ("ela me considera importante") | Cautela ("uso só se precisar") | Reciprocidade ("respeito o horário dela") |

### As 3 frases-âncora (copywriting macro)

Estas 3 frases viram a espinha dorsal do copy em todo o app. Aparecem em onboarding, em help text, em estados vazios:

1. **Anexar mídias** → *"O que você criar pra esse paciente, fica acessível a ele. Sempre auditável, nunca esquecido."*
2. **Propor retorno** → *"Você sugere a data. Ele confirma ou propõe outra. Sem ligação, sem secretária, sem ruído."*
3. **WhatsApp por janela** → *"Você define quando estar disponível. Fora disso, fica em silêncio. Suas regras."*

### O que move cada persona médica a usar cada feature

**Helena (clínica premium, 50a)** → motivada por *controle absoluto*. Vai amar a janela WhatsApp (boundary clara). Vai usar Anexar pra branding (PDF tem logo da clínica).

**Carlos (PS, 38a)** → motivado por *velocidade*. Vai usar Anexar pra atestados (10x/dia). Não vai usar Retorno (PS não tem follow-up).

**Raffaela (pediatra, 42a)** → motivada por *segurança emocional da mãe*. Vai usar todas as 3 com força. Áudio explicativo é killer feature pra ela.

**Lucas Jr (jovem tech, 32a)** → motivado por *eficiência tecnológica*. Early adopter perfeito. Vai testar todas as opções e dar feedback estruturado.

**Rafael (SUS, 45a)** → motivado por *redução de retrabalho*. Vai usar Retorno pra pacientes crônicos. Anexar e WhatsApp não cabem na realidade SUS.

**Beatriz (especialista, 48a)** → motivada por *compliance e prontuário*. Vai usar todas, mas WhatsApp com cuidado (pós-operatório).

**Mariana (telemedicina, 35a)** → motivada por *fechar o ciclo*. WhatsApp é o canal natural dela. Anexar é 100% do trabalho.

---

## PARTE 3 — ORDEM DE IMPLEMENTAÇÃO (Anexar → Retorno → WhatsApp)

### Por que esta ordem específica?

```
FASE 1 — ANEXAR MÍDIAS
       │
       │ (cria padrão técnico: upload + Storage + ponteiro no banco + notificação)
       │
       ▼
FASE 2 — PROPOR RETORNO
       │
       │ (cria padrão de via mão-dupla: médico propõe → paciente responde)
       │ (cria padrão de estado de máquina: PROPOSTO → CONTRAPROPOSTA → CONFIRMADO)
       │
       ▼
FASE 3 — LIBERAR WHATSAPP
       │
       │ (depende de retorno: timer só dispara após confirmação)
       │ (depende de confiança técnica nas 2 anteriores)
       │ (é a mais sensível: UX-criticamente complexa, médico-legalmente delicada)
       ▼
   COMPLETUDE
```

### Justificativa de cada ordem

#### Por que Anexar primeiro?
1. **Curva de adoção mais previsível** — 85% das personas adotam (vs 75% retorno, 50% WhatsApp)
2. **Risco técnico controlado** — reusa `uploadExame` que já está em produção há meses
3. **Valor imediato** — médico ganha "alívio" logo na primeira consulta pós-implementação
4. **Ensina o paciente a abrir o app** — depois de receber laudo, paciente entra na rotina de abrir
5. **Sem dependência médico-legal complexa** — anexar laudo é prática clínica milenar, só digitalizamos
6. **Funciona sem retorno e sem WhatsApp** — feature stand-alone

#### Por que Retorno segundo?
1. **Depende emocionalmente de Anexar** — médico já confia no canal médico→paciente
2. **Cria a primeira via de mão dupla** — antes era só médico anexando; agora paciente responde
3. **Estabelece padrão de estado de máquina** — 5 estados (proposto/contraproposta/confirmado/cancelado/realizado) que serão referência pra outras features no futuro
4. **Integração com Calendar existente** — reaproveita ConfigAgenda do Lucas (sessão 21)
5. **Métrica que prova valor de produto** — "% retornos confirmados em 24h" vira KPI

#### Por que WhatsApp por último?
1. **Maior risco de adoção** — 50% das personas resistem
2. **Maior risco médico-legal** — CFM 2.314/2022 exige documentação de tudo, retenção 5 anos
3. **Depende de retorno** — janela WhatsApp acoplada a "Até o retorno" só faz sentido se retorno existe
4. **Exige confiança acumulada** — médico precisa ter usado Anexar + Retorno antes de aceitar liberar WhatsApp
5. **UX-criticamente complexa** — uma falha aqui (médico recebe mensagem fora do horário) mata adoção pra sempre

### Tempo entre fases (recomendação)

Não emendar fases. **Espaço mínimo entre fases**:
- Fase 1 → Fase 2: **7 dias úteis** após Fase 1 estar em produção e ter sido usada por pelo menos 3 médicos reais
- Fase 2 → Fase 3: **14 dias úteis** após Fase 2 estar em produção e ter pelo menos 5 retornos confirmados

Por quê esperar? Cada fase ensina algo sobre o uso real que reescreve as decisões da fase seguinte. Lucas Jr de feedback "anexar áudio falhou em iPhone" pode mudar a UX da feature 2 antes de implementarmos.

### Quanto custa cada fase (estimativa pré-validação)

| Fase | Backend | Frontend médico | Frontend paciente | Testes | Total estimado |
|---|---|---|---|---|---|
| 1 — Anexar | 2 dias | 3 dias | 1 dia | 1 dia | **7 dias** |
| 2 — Retorno | 3 dias | 4 dias | 2 dias | 2 dias | **11 dias** |
| 3 — WhatsApp | 2 dias | 3 dias | 1 dia | 2 dias | **8 dias** |
| **Total** | 7 dias | 10 dias | 4 dias | 5 dias | **~26 dias úteis** |

Margem de erro: ±30%. Provavelmente fechará em 30-35 dias considerando bugs descobertos em betatest.

---

## PARTE 4 — LOCALIZAÇÃO GLOBAL E ANATOMIA DO NOVO ACCORDION

### O endereço único de tudo

**Aba Pacientes → clica no nome do paciente na lista esquerda → painel direito mostra perfil expandido → último accordion na sequência: "Consulta & Retorno"**

```
┌───────────────── APP MÉDICO DESKTOP ─────────────────┐
│                                                       │
│  [≡] vita id                          (foto do médico)│
│  ─────────────────────────────────────────────────── │
│  📊 Hoje                                              │
│  📋 Pré-Consultas                                     │
│  👥 Pacientes  ← AQUI                                 │
│  📝 Templates                                         │
│  👤 Meu Perfil                                        │
│                                                       │
└───────────────────────────────────────────────────────┘

╔═══════════════════ ABA PACIENTES ════════════════════╗
║                                                       ║
║  ┌── LISTA ESQUERDA ──┐  ┌──── PAINEL DIREITO ────┐ ║
║  │                    │  │                          │ ║
║  │ 🔍 Buscar paciente │  │  ⬛ Maria Silva, 47a    │ ║
║  │                    │  │     Tipo O+ · Plano X   │ ║
║  │ Filtros:           │  │     Telefone: (11) 9... │ ║
║  │ [Todos][Hoje]      │  │                          │ ║
║  │ [Semana][Mês]      │  │  [Enviar pré-consulta]  │ ║
║  │                    │  │                          │ ║
║  │ ◯ Maria Silva   ●  │  │  ┌─────────────────┐    │ ║
║  │ ◯ João Pedro       │  │  │ ▼ DADOS CLÍNICOS│    │ ║
║  │ ◯ Beatriz          │  │  │  Sangue O+      │    │ ║
║  │ ◯ Carlos           │  │  │  Idade 47       │    │ ║
║  │ ◯ Renata           │  │  │  ...            │    │ ║
║  │                    │  │  └─────────────────┘    │ ║
║  │                    │  │  ┌─────────────────┐    │ ║
║  │                    │  │  │ ▶ EXAMES (3)    │    │ ║
║  │                    │  │  └─────────────────┘    │ ║
║  │                    │  │  ┌─────────────────┐    │ ║
║  │                    │  │  │ ▶ ALERGIAS (2)  │    │ ║
║  │                    │  │  └─────────────────┘    │ ║
║  │                    │  │  ┌─────────────────┐    │ ║
║  │                    │  │  │ ▶ MEDICAMENTOS  │    │ ║
║  │                    │  │  └─────────────────┘    │ ║
║  │                    │  │  ┌═════════════════┐    │ ║
║  │                    │  │  ║ ▼ CONSULTA &    ║◄── │ ║ NOVO
║  │                    │  │  ║   RETORNO   ●   ║    │ ║
║  │                    │  │  ║                 ║    │ ║
║  │                    │  │  ║  4 sub-blocos   ║    │ ║
║  │                    │  │  ║  (detalhe ⬇)   ║    │ ║
║  │                    │  │  └═════════════════┘    │ ║
║  │                    │  │                          │ ║
║  └────────────────────┘  └──────────────────────────┘ ║
╚═══════════════════════════════════════════════════════╝
```

### Por que aqui e não em outra aba?

Comparação detalhada dos 6 candidatos avaliados:

| # | Candidato | Score Anexar | Score Retorno | Score WhatsApp | Veredito |
|---|---|---|---|---|---|
| 1 | Sumário de 1 minuto (Pré-Consultas → resumo) | 9/10 | 10/10 | 6/10 | Ótimo pra 2 features, ruim pra WhatsApp |
| 2 | Perfil do Paciente (Pacientes → coluna direita) | 8/10 | 9/10 | 8/10 | Bom geral, acumula complexidade |
| 3 | Modal Nova Pré-Consulta | 2/10 | 3/10 | 6/10 | Fluxo semantico invertido — NÃO |
| 4 | Aba Hoje (nova seção Pós-Consulta) | 9/10 | 10/10 | 9/10 | Forte mas tira foco de impacto financeiro |
| 5 | Menu 3 pontos da lista de Pacientes | 8/10 | 9/10 | 8/10 | Pragmático mas mistura contextos |
| 6 | **Novo accordion no Perfil do Paciente** | **9/10** | **10/10** | **9/10** | **VENCEDOR — semanticamente correto, visualmente limpo, baixo risco** |

### Anatomia do accordion novo

```
┌══════════ ▼ CONSULTA & RETORNO ═══════════┐
│                                            │
│  ┌─ SUB-BLOCO 1 ─ PRÓXIMA PRÉ-CONSULTA ──┐│
│  │                                        ││
│  │  Consulta de hoje (10/05)              ││
│  │  Anamnese pronta · 11/11 campos        ││
│  │  [Ver sumário de 1 minuto]             ││
│  │                                        ││
│  └────────────────────────────────────────┘│
│                                            │
│  ┌─ SUB-BLOCO 2 ─ RETORNO AGENDADO ──────┐│
│  │                                        ││
│  │  Nenhum retorno proposto.              ││
│  │  [+ Propor retorno]                    ││
│  │                                        ││
│  └────────────────────────────────────────┘│
│                                            │
│  ─────── linha divisória ──────            │
│                                            │
│  ┌─ SUB-BLOCO 3 ─ DOCUMENTOS ANEXADOS ──┐│
│  │                                        ││
│  │  📎 Arrastar arquivos aqui ou clicar  ││
│  │     PDF, JPG, PNG, MP3 — até 10MB     ││
│  │                                        ││
│  │  (lista de documentos abaixo)         ││
│  │                                        ││
│  └────────────────────────────────────────┘│
│                                            │
│  ┌─ SUB-BLOCO 4 ─ CONTATO WHATSAPP ─────┐│
│  │                                        ││
│  │  Inativo. [Liberar contato]            ││
│  │  ⓘ Disponível após retorno confirmado.││
│  │                                        ││
│  └────────────────────────────────────────┘│
│                                            │
└════════════════════════════════════════════┘
```

### Regras de visibilidade do accordion

**Aparece quando:**
- Paciente tem pelo menos 1 PreConsulta com status `RESPONDIDA` **OU**
- Paciente tem pelo menos 1 Agendamento com data passada (consulta já aconteceu)

**Não aparece quando:**
- Paciente foi cadastrado mas nunca consultou (zero histórico de atendimento)
- Paciente está em status `EXCLUIDO` (soft-delete)

**Por quê?** Sem consulta passada, não há "pós-consulta" pra gerenciar. Mostrar accordion vazio polui visualmente.

### Estado de abertura (default)

**Default na primeira visita:** todos os 4 sub-blocos colapsados, accordion principal aberto.

**Default em visitas subsequentes:** lembra o último estado de cada sub-bloco via `localStorage.medicoConsultaRetorno_<pacienteId>` (estado por paciente, não global).

**Mobile (até 480px):** accordion principal colapsado por default; expandir um sub-bloco colapsa os outros (acordeon clássico, single-open mode).

**Desktop (acima de 768px):** múltiplos sub-blocos podem ficar abertos simultaneamente (multi-open mode).

### Hierarquia visual (Design System)

```
Verde primário: #00E5A0 (gradiente verde-ciano para CTAs principais)
Azul info: #3B82F6 (badges "Documentos", "Pré-consulta")
Laranja warning: #F59E0B (badge "Retorno proposto aguardando")
Verde sucesso: #00C47A (badge "Retorno confirmado", "Visto pelo paciente")
Vermelho critico: #EF4444 (apenas para alertas — não usar em features novas exceto erro)
Cinza neutro: #9CA3AF (estados inativos)

Borda lateral colorida 3px (insight-card padrão do projeto):
- Verde para confirmado/sucesso
- Azul para informativo
- Amarelo para aguardando
- Cinza para inativo
```

---

## PARTE 5 — FEATURE 1: ANEXAR MÍDIAS (laudo, atestado, receita, exame, áudio)

### 5.1 Estados visuais (todos os 6 estados possíveis)

#### Estado A — Vazio (médico nunca anexou nada pra esse paciente)

```
┌─ SUB-BLOCO: DOCUMENTOS ANEXADOS ──────────────────────────┐
│                                                            │
│         ┌────────────────────────────────────────┐        │
│         │           📎                            │        │
│         │                                         │        │
│         │   Arraste um arquivo aqui              │        │
│         │   ou [Escolher do computador]          │        │
│         │                                         │        │
│         │   PDF, JPG, PNG, MP3, M4A · até 10MB   │        │
│         └────────────────────────────────────────┘        │
│                                                            │
│   ⓘ Tudo que você enviar fica auditável e expira em 90    │
│     dias para download — paciente pode salvar a cópia     │
│     antes disso.                                           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### Estado B — Drag-over (médico arrastando arquivo por cima)

Dropzone fica verde (`#00E5A0` 20% opacity), borda tracejada vira sólida, ícone 📎 pulsa.

#### Estado C — Modal "Que tipo é esse documento?"

Aparece **imediatamente após drop**, antes do upload começar:

```
┌─ MODAL ──────────────────────────────────────────┐
│                                                    │
│  Que tipo de documento é esse?                    │
│  (Arquivo: ECG_paciente_maria_10mai.pdf · 240 KB) │
│                                                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐             │
│  │  📄     │ │  📋     │ │  💊     │             │
│  │ LAUDO   │ │ATESTADO │ │ RECEITA │             │
│  └─────────┘ └─────────┘ └─────────┘             │
│  ┌─────────┐ ┌─────────┐                         │
│  │  🔬     │ │  🎵     │                         │
│  │ EXAME   │ │  ÁUDIO  │                         │
│  └─────────┘ └─────────┘                         │
│                                                    │
│  Nome amigável (opcional):                        │
│  ┌──────────────────────────────────────────┐    │
│  │ Eletrocardiograma de hoje                │    │
│  └──────────────────────────────────────────┘    │
│                                                    │
│  [ Cancelar ]              [ Anexar agora ]      │
└────────────────────────────────────────────────────┘
```

**Lógica de auto-preenchimento do nome amigável:**
- Se nome do arquivo começa com "LAUDO", "ATESTADO", etc → pré-seleciona tipo + remove prefixo do nome
- Se médico anexou mesmo tipo nos últimos 7 dias → sugere nome similar
- Se médico digita em "Nome amigável", validação em tempo real (sem permitir caracteres especiais que quebrem URL)

#### Estado D — Uploading (barra de progresso visível)

```
┌─ CARD EM ANEXO ─────────────────────────────────┐
│  📄 Eletrocardiograma de hoje                    │
│  ━━━━━━━━━━━━━━━━━░░░░░░░ 78% · ~3s            │
│  [ Cancelar ]                                    │
└──────────────────────────────────────────────────┘
```

#### Estado E — Erro de upload

```
┌─ CARD EM ANEXO ─────────────────────────────────┐
│  ⚠ Eletrocardiograma de hoje                     │
│  Upload falhou: arquivo maior que 10 MB          │
│  Quer que a gente comprima? [Comprimir] [Cancelar]│
└──────────────────────────────────────────────────┘
```

Outros erros possíveis:
- "Conexão caiu. Tentaremos novamente automaticamente." (retry automático em 5s, depois 15s, depois 60s)
- "Tipo de arquivo não aceito. Use PDF, JPG, PNG, MP3 ou M4A."
- "Esse arquivo parece corrompido. Tenta abrir no seu computador antes."

#### Estado F — Anexado com sucesso

```
┌─ CARD ─────────────────────────────────────────────────┐
│  📄 [LAUDO] Eletrocardiograma de hoje                   │
│  Anexado 10/05 às 14h22 · 240 KB                       │
│  ✓ Visto pelo paciente 10/05 às 15h04                  │
│  [👁 Visualizar]  [✏ Renomear]  [🗑 Remover]          │
└─────────────────────────────────────────────────────────┘
```

Se ainda não visto:
```
│  ⓘ Aguardando paciente abrir                            │
```

### 5.2 Modal de tipo do documento — Os 5 tipos detalhados

| Tipo | Ícone | Cor da borda lateral | Quando usar | Mime types aceitos |
|---|---|---|---|---|
| **LAUDO** | 📄 | Azul `#3B82F6` | Laudos de exames (ECG, USG, etc), pareceres clínicos | PDF, JPG, PNG |
| **ATESTADO** | 📋 | Roxo `#8B5CF6` | Atestado médico, afastamento, comparecimento | PDF, JPG, PNG |
| **RECEITA** | 💊 | Verde `#10B981` | Prescrição médica, receita controlada (com cuidado extra) | PDF, JPG, PNG |
| **EXAME** | 🔬 | Laranja `#F59E0B` | Resultado de exame laboratorial, imagem de exame | PDF, JPG, PNG |
| **ÁUDIO** | 🎵 | Cinza `#6B7280` | Orientação pós-consulta gravada pelo médico | MP3, M4A, WAV |

**Cuidado especial com RECEITA:**
- Receita controlada (azul/amarela) exige assinatura digital ICP-Brasil → MVP não suporta receita controlada, banner avisa "Para receita controlada, use sistema oficial Memed/iClinic com assinatura digital"
- Receita simples (comum) pode ser anexada como PDF

### 5.3 Fluxo de upload — Passo a passo completo

```
1. Médico abre app paciente Maria → expande Consulta & Retorno
2. Vai na sub-seção Documentos
3. Arrasta arquivo do desktop dele (ou clica "Escolher")
4. Sistema valida tamanho: se > 10 MB, oferece compressão (imagens) ou cancela (PDF/áudio)
5. Sistema valida mime type: se inválido, mostra erro amigável
6. Abre modal "Que tipo é esse documento?"
7. Médico seleciona tipo (5 opções) + ajusta nome amigável se quiser
8. Médico clica "Anexar agora"
9. Modal fecha, card aparece na lista em estado "Uploading"
10. Frontend chama uploadToSupabase() (reuso de pre-consulta.js):
    a. Comprime se imagem (1200px max, JPEG 0.75)
    b. Gera URL assinada do Supabase Storage
    c. Faz PUT com FormData + tracking de progresso
    d. Timeout 25s, retry 1x automático
11. Após upload no Storage, frontend chama POST /documentos-consulta/upload:
    a. Body: { agendamentoId, tipo, nomeAmigavel, url, tamanhoBytes, mimeType }
    b. Backend valida JWT (médico autenticado)
    c. Backend faz HEAD request no Storage pra confirmar arquivo existe
    d. Backend cria registro em documentos_consulta
    e. Backend dispara notificação (SMS + push se aplicável)
    f. Retorna { id, status: 'disponivel' }
12. Frontend atualiza card: vira estado "Anexado, aguardando paciente"
13. Toast com Desfazer (10 segundos)
14. Se médico clica Desfazer: DELETE /documentos-consulta/:id (soft-delete)
15. Quando paciente abre o documento no app dele:
    a. App paciente registra POST /documentos-consulta/:id/marcar-visto
    b. Backend atualiza campo visto_em
    c. Próxima vez que médico abre o paciente, card mostra "Visto pelo paciente em DD/MM HH:mm"
```

### 5.4 Validações (todas)

**Antes do upload:**
- Tamanho ≤ 10 MB (configurável; PDF pode ter exceção pra 15 MB se Lucas autorizar)
- Mime type na whitelist
- Nome amigável: 1-100 caracteres, sem caracteres especiais perigosos (`<>:"/\|?*`)
- Médico tem permissão (JWT válido)
- Paciente existe no banco (pacienteId é válido)
- Agendamento existe e médico é o dono

**Durante o upload:**
- Detecta conexão caída (online/offline event listener)
- Detecta tab fechando (beforeunload) → IndexedDB salva estado parcial
- Detecta arquivo modificado durante upload (raríssimo, mas possível)

**Após upload:**
- HEAD request confirma arquivo no Storage
- Hash MD5 do arquivo bate com o esperado (anti-corrupção)
- Tamanho final bate (sem truncamento)

### 5.5 Renomeação e duplicatas

**Renomear após anexado:**
- Médico clica "✏ Renomear" → input inline aparece com nome atual
- Edita, pressiona Enter ou clica "Salvar"
- PUT /documentos-consulta/:id/renomear com novo nome
- Card atualiza, paciente vê novo nome na próxima vez que abrir

**Detecção de duplicata (mesmo nome):**
```
┌─ MODAL ────────────────────────────────────────┐
│  Você já anexou "Laudo Cardiológico" pra Maria │
│  em 05/05. O que prefere?                       │
│                                                  │
│  ◯ Substituir o anterior                        │
│    (apaga o de 05/05, mantém só este novo)     │
│  ◯ Manter os dois                               │
│    (este vira "Laudo Cardiológico (2)")        │
│  ◯ Cancelar este upload                         │
│                                                  │
│  [ Confirmar ]                                  │
└─────────────────────────────────────────────────┘
```

### 5.6 Apagamento e LGPD

**Apagar documento (médico):**
- Clica 🗑 → confirmação "Apagar [nome do documento]? Paciente perde acesso imediatamente."
- DELETE /documentos-consulta/:id
- Soft-delete: marca apagado_em, mantém arquivo no Storage por 30 dias (recuperável via suporte)
- Após 30 dias, cron job apaga arquivo permanentemente do Storage
- Toast Desfazer 10 segundos

**Direito LGPD do paciente:**
- Paciente pode pedir apagamento permanente (Art. 18 LGPD) → médico recebe notificação → 7 dias pra contestar → após isso, apagamento imediato e definitivo
- Endpoint público pro paciente: POST /documentos-consulta/:id/solicitar-apagamento

### 5.7 Visualização e status visto/não visto

**Como o paciente abre:**
- App paciente chama GET /agendamento/:id → backend retorna lista de documentos com URL assinada (expiração 7 dias)
- Paciente clica card → abre URL em aba nova (navegador renderiza PDF/imagem nativamente)
- Para áudio, player inline no card (não abre aba)

**Quando "visto" é gravado:**
- PDF/imagem: ao abrir URL (paciente faz GET na URL assinada, backend detecta via Supabase webhook → POST /documentos-consulta/:id/marcar-visto)
- Áudio: ao tocar pelo menos 3 segundos no player inline (frontend dispara POST após 3s de play)

**Indicador no card do médico:**
- "Visto pelo paciente em DD/MM HH:mm" (verde)
- "Aguardando paciente abrir" (cinza)
- "Aberto mas não baixado" (laranja — paciente viu inline mas não salvou cópia)

### 5.8 Notificações ao paciente

> Decisão confirmada com Lucas: **apenas in-app + push web** nesta entrega. SMS fora do escopo. Email vem em fase futura.

**Push web (se paciente instalou PWA e deu permissão):**
```
📎 Documento novo
Dra. Maria Silva anexou um Laudo. Toque para ver.
```

**Badge in-app (sempre — aparece quando paciente abre o app):**
- Ícone aba Consultas ganha bolinha vermelha com contador (ex: ①)
- Card da consulta ganha chip pulsante "Documento novo"
- Banner na aba Saúde: "📎 Dra. Maria anexou um Laudo · [Ver]"

**WhatsApp:** NÃO enviar via WhatsApp (exclusivo da Feature 3, sob janela controlada).

**Email:** fora do escopo desta entrega (fase futura — Lucas escolhe provedor depois).

**SMS:** fora do escopo desta entrega.

### 5.9 Edge cases (15 cenários reais documentados)

1. **Paciente sem conta vita id** → Anexar funciona, fica no banco. Banner amarelo no card: "Esse paciente ainda não criou conta. SMS enviado para cadastro." Sistema dispara SMS com link de cadastro do app.

2. **Paciente com conta mas nunca abriu o app v3** → Anexa normal. SMS enviado. Status fica "Aguardando paciente abrir" indefinidamente.

3. **Paciente bloqueou notificações SMS** → Backend tem flag `paciente.smsAutorizado`. Se false, não envia SMS, mas anexa funciona. Card do médico mostra "Paciente não recebe SMS — avise pessoalmente".

4. **Médico anexa por engano em paciente errado** → 10 segundos de Desfazer no toast. Após 10s, médico precisa clicar 🗑 explicitamente. Confirmação dupla.

5. **Médico anexa receita controlada (azul/amarela)** → Modal de aviso: "Receitas controladas exigem assinatura digital. Use Memed ou sistema oficial. Você está anexando essa receita como PDF não-assinado — paciente vai receber, mas farmácia pode recusar." Médico confirma explicitamente.

6. **Médico anexa atestado para mais que 15 dias** → Modal de alerta: "Atestados acima de 15 dias exigem CID e assinatura. Está tudo no documento?"

7. **Upload de 8 MB em conexão lenta** → Barra de progresso visível, tempo estimado, opção Cancelar a qualquer momento.

8. **Tab fechada no meio do upload** → IndexedDB salva estado. Próxima vez que abrir, banner: "Upload de [nome] foi interrompido. Quer retomar?"

9. **Médico desconectado da internet** → Detecção via navigator.onLine. Botão "Anexar" desabilitado com tooltip "Sem conexão. Tente novamente em alguns segundos."

10. **Arquivo corrompido (PDF sem header válido)** → Backend rejeita com mensagem "Esse arquivo parece corrompido. Tente reabrir no seu computador."

11. **Áudio gravado em formato exótico (AAC, OGG)** → Backend converte para MP3 automaticamente (FFmpeg server-side). Médico não percebe.

12. **Médico anexa 50 documentos para o mesmo paciente** → Sub-bloco mostra 3 mais recentes + botão "Ver todos (50)". Performance otimizada com lazy load.

13. **Paciente perde acesso ao app (deletou conta)** → Documentos ficam no banco órfãos. Cron diário detecta e marca como `paciente_deletou_conta = true`. Médico vê: "Esse paciente deletou conta no vita id. Documentos preservados por 90 dias para você baixar cópia."

14. **Médico para de usar vita id (cancela conta)** → Sistema mantém documentos por 90 dias após cancelamento. Paciente continua tendo acesso. Médico recebe email "Você cancelou a conta. Seus documentos com pacientes estão preservados até [data]. Quer exportar tudo?" (LGPD Art. 18).

15. **Falha no Supabase Storage** → Backend retorna 503. Frontend mostra "Temos um problema temporário no nosso cofre. Tentaremos novamente em 30 segundos." Retry automático 3 vezes. Após 3 falhas, alerta Sentry + médico recebe push "Falha no upload — tente em alguns minutos".

### 5.10 Métricas de sucesso da Feature 1

**KPIs primários:**
- **Taxa de adoção de médicos**: % de médicos ativos que anexam pelo menos 1 documento por mês → meta 60% após 30 dias de launch
- **Documentos por consulta**: média de anexos por consulta atendida → meta 1.5 docs/consulta
- **Tempo até primeiro anexo**: minutos entre login pós-consulta e primeiro anexo → meta < 2 min
- **Taxa de visualização**: % de documentos abertos pelo paciente em 24h → meta 70%

**KPIs secundários:**
- Taxa de upload bem-sucedido: 99% (1% pode falhar por motivos externos)
- Tempo médio de upload (3-5 MB): < 8 segundos
- Taxa de Desfazer: < 5% (se > 5%, UX de confirmação tá ruim)
- Distribuição por tipo: laudo 30%, atestado 25%, receita 20%, exame 15%, áudio 10% (estimativa inicial)

**Sinais de alerta:**
- Se taxa de Desfazer > 10%: investigar UX
- Se < 30% dos documentos são vistos em 7 dias: investigar canal de notificação
- Se taxa de erro de upload > 5%: investigar Storage ou conexão

---

## PARTE 6 — FEATURE 2: PROPOR DATA DE RETORNO

### 6.1 Os 5 estados do retorno

#### Estado A — Nenhum retorno (default após consulta)

```
┌─ SUB-BLOCO: RETORNO AGENDADO ─────────────────────────────┐
│                                                            │
│  Nenhum retorno proposto.                                  │
│                                                            │
│  [ + Propor retorno ao paciente ]                          │
│                                                            │
│  ⓘ Útil para acompanhamento de tratamento, ajuste de       │
│    medicação, ou pacientes crônicos.                       │
└────────────────────────────────────────────────────────────┘
```

#### Estado B — Sheet de proposta (médico clicou "Propor")

```
┌─ SHEET (sobe de baixo) ───────────────────────────────────┐
│                                                            │
│  Propor retorno para Maria Silva                          │
│  ─────────────────────────────────                        │
│                                                            │
│  Em quanto tempo você quer revê-la?                       │
│  ┌────────┬────────┬────────┬────────┬───────────────┐   │
│  │ 7 dias │ 15 dias│ 30 dias│ 60 dias│Personalizado  │   │
│  └────────┴────────┴────────┴────────┴───────────────┘   │
│                                                            │
│  📅 Data sugerida: terça, 25/05/2026                       │
│     [editar data]                                          │
│                                                            │
│  Período do dia:                                          │
│  ◯ Manhã (8h-12h)  ● Tarde (13h-18h)  ◯ Noite (19h-21h)  │
│                                                            │
│  Mensagem para o paciente (opcional):                     │
│  ┌──────────────────────────────────────────────────┐    │
│  │ Queria reavaliar a pressão depois de 30 dias com │    │
│  │ o remédio novo. Se a data não funcionar, sugere  │    │
│  │ outra livremente.                                 │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
│  ☐ Adicionar ao meu Google Calendar agora                 │
│                                                            │
│  [ Cancelar ]              [ Enviar proposta ]            │
└────────────────────────────────────────────────────────────┘
```

#### Estado C — Aguardando paciente responder

```
┌─ SUB-BLOCO: RETORNO AGENDADO ─────────────────────────────┐
│                                                            │
│  ⏳ Aguardando resposta de Maria                            │
│                                                            │
│  Proposto: terça, 25/05/2026 — tarde                       │
│  Enviado há 2 horas via SMS                                │
│                                                            │
│  Sua mensagem: "Queria reavaliar a pressão..."             │
│                                                            │
│  [ Cancelar proposta ]    [ Reenviar lembrete ]            │
└────────────────────────────────────────────────────────────┘
```

#### Estado D — Confirmado pelo paciente

```
┌─ SUB-BLOCO: RETORNO AGENDADO ─────────────────────────────┐
│                                                            │
│  ✓ Confirmado por Maria                                    │
│                                                            │
│  📅 Terça, 25/05/2026 — tarde                              │
│  Confirmado em 11/05 às 09h14                              │
│  Adicionado ao seu Google Calendar ✓                       │
│                                                            │
│  [ Ver na agenda ]    [ Cancelar este retorno ]            │
└────────────────────────────────────────────────────────────┘
```

#### Estado E — Contraproposta do paciente

```
┌─ SUB-BLOCO: RETORNO AGENDADO ─────────────────────────────┐
│                                                            │
│  ⚠ Maria sugeriu outra data                                │
│                                                            │
│  Sua proposta:  terça,  25/05 — tarde                      │
│  Contraproposta: sexta, 28/05 — manhã                      │
│                                                            │
│  Motivo da Maria:                                          │
│  "Não consigo na terça à tarde por causa do trabalho.      │
│   Sexta de manhã seria melhor pra mim."                    │
│                                                            │
│  [ Aceitar nova data ]    [ Propor outra ]    [ Cancelar ]│
└────────────────────────────────────────────────────────────┘
```

### 6.2 Lógica de cálculo de data sugerida

**Quando médico clica "30 dias":**
1. Sistema soma 30 dias corridos à data de hoje
2. Se cair em sábado → pula para segunda
3. Se cair em domingo → pula para segunda
4. Se cair em feriado nacional → pula para próximo dia útil
5. Médico pode editar data manualmente (datepicker abre na sugestão)

**Feriados nacionais considerados:**
- Tirados de lista hard-coded no backend (atualizada anualmente)
- Datas fixas: 1/jan, 21/abr, 1/mai, 7/set, 12/out, 2/nov, 15/nov, 25/dez
- Datas móveis: Carnaval (terça), Sexta Santa, Corpus Christi

**Feriados regionais:** NÃO consideramos no MVP. Médico pode editar manualmente se cair em feriado local.

### 6.3 Sincronização com Google Calendar

**Cenário A — Médico tem Calendar conectado e marcou checkbox:**
- Ao receber confirmação do paciente, backend chama Google Calendar API
- Cria evento no calendário primário do médico (ou em calendário específico configurado em Perfil → Integrações)
- Evento inclui:
  - Título: "Retorno: Maria Silva"
  - Data/hora: dataConfirmada
  - Duração: 30 min (default)
  - Descrição: motivo + link para paciente
  - Lembrete: 1 dia antes (notificação) + 1 hora antes (notificação)

**Cenário B — Médico não tem Calendar conectado:**
- Checkbox aparece desabilitado com tooltip "Conecte seu Google Calendar em Perfil → Integrações"
- Retorno confirmado fica só no banco vita id

**Cenário C — Médico tem Calendar mas evento falha ao criar:**
- Toast: "Retorno confirmado, mas não conseguimos adicionar ao seu Calendar. Tente sincronizar manualmente."
- Botão "Adicionar agora" reaparece no card

### 6.4 Notificações (apenas in-app + push web)

> Decisão confirmada: sem SMS nesta entrega. Email em fase futura.

**Quando médico envia proposta — paciente recebe:**

Push web (se PWA instalado e permissão dada):
```
📅 Retorno proposto
Dra. Maria Silva quer te ver em 09/06 (tarde). Confirme ou sugira outra.
```

Badge in-app:
- Aba Consultas ganha bolinha vermelha
- Card da consulta na aba Consultas vira destaque laranja com chip "Retorno proposto"
- Banner na aba Saúde: "📅 Retorno proposto para 09/06 · [Ver e responder]"

**Quando paciente não responde em 3 dias:**
- Push web automático (se aplicável): "Você ainda não respondeu sobre o retorno proposto"
- Banner home reaparece com prioridade
- Médico recebe push: "Maria ainda não respondeu sobre o retorno (3 dias). Quer reenviar lembrete?"

**Quando paciente confirma — médico recebe:**

Push web (navegador do médico, se permissão dada):
```
✓ Retorno confirmado
Maria confirmou retorno para 09/06 (tarde). Adicionado à sua agenda.
```

Badge in-app médico:
- Lista de Pacientes mostra Maria com bolinha verde
- Stat "Retornos confirmados nesta semana" incrementa

**Quando paciente contrapropõe — médico recebe:**

Push web URGENTE:
```
⚠ Maria sugeriu outra data
Ela propôs 12/06 (sexta, manhã). Veja o motivo no app.
```

Badge in-app médico:
- Lista de Pacientes mostra Maria com bolinha laranja urgente
- Stat novo (se aplicável): "Aguardando resposta sua: 1"

### 6.5 Cenários edge

1. **Paciente confirma data que conflita com outro paciente já confirmado** → Sistema avisa médico antes: "Você já tem 3 consultas confirmadas para 28/05 manhã. Aceitar Maria também?"

2. **Paciente contrapropõe data muito longe (mais de 90 dias)** → Sistema avisa paciente: "Tem certeza que quer marcar tão longe? Seu médico recomendou retorno em 30 dias."

3. **Médico cancela proposta antes do paciente responder** → Paciente já pode ter visto via SMS. Confirmação dupla: "Cancelar essa proposta? Maria já recebeu via SMS. Quer enviar um SMS de cancelamento?"

4. **Paciente confirma data que já passou** → Impossível pela UI (datepicker bloqueia datas passadas), mas se acontecer por bug, backend rejeita.

5. **Paciente sem conta vita id recebe proposta** → SMS funciona normal. Link leva pra tela de cadastro do app v3. Após cadastrar, paciente vê a proposta automaticamente.

6. **Médico propõe retorno mas depois apaga o paciente (LGPD)** → Proposta vira órfã. Sistema marca como `cancelado_automatico = true` e notifica paciente "Sua consulta de retorno foi cancelada pelo médico."

7. **Retorno confirmado mas paciente não aparece no dia** → Sistema marca como `realizado = false`. Médico recebe notificação no dia seguinte: "Maria não compareceu no retorno de ontem. Quer remarcar?"

8. **Médico propõe múltiplos retornos sequenciais** → Permitido. Cada um vira card separado no histórico.

9. **Paciente confirma e depois pede pra remarcar** → Botão "Remarcar" no app paciente abre fluxo igual ao "Contraproposta". Médico aceita ou propõe outra.

### 6.6 Métricas de sucesso da Feature 2

**KPIs primários:**
- **Taxa de proposta**: % de consultas que terminam com retorno proposto → meta 40%
- **Taxa de confirmação em 24h**: % de propostas confirmadas em até 24h → meta 60%
- **Taxa de confirmação em 7 dias**: % de propostas confirmadas em até 7 dias → meta 85%
- **Taxa de contraproposta**: % de propostas que viram contraproposta → meta 15-20% (saudável; muito baixo = paciente engole; muito alto = médico não considera disponibilidade)

**KPIs secundários:**
- Tempo médio entre proposta e resposta: < 18 horas
- Taxa de no-show no retorno: < 15% (vs ~25% sem sistema de confirmação)
- Distribuição de prazos: 7d (15%), 15d (25%), 30d (40%), 60d (15%), personalizado (5%)

---

## PARTE 7 — FEATURE 3: LIBERAR CONTATO WHATSAPP POR JANELA

### 7.1 A pergunta-âncora desta feature

> **"Como dar ao médico um canal de comunicação direta com pacientes selecionados, em horários que ele define, sem invadir a vida pessoal dele e cumprindo CFM 2.314/2022?"**

A resposta vita id: **janela com expiração obrigatória + horário definido + log auditável**.

### 7.2 Pré-condições para liberar WhatsApp

**O botão "Liberar contato" só está ativo quando:**
1. Paciente tem conta vita id (`paciente.contaCriada = true`)
2. Paciente respondeu pelo menos 1 pré-consulta (`paciente.preConsultasRespondidas >= 1`)
3. Médico tem retorno proposto OU confirmado com esse paciente (`retornos_agendados.exists`)

**Se alguma condição falha:**
```
┌─ SUB-BLOCO: CONTATO WHATSAPP ────────────────────────────┐
│                                                            │
│  Liberar contato ainda não disponível.                    │
│                                                            │
│  Para liberar, é preciso:                                 │
│  ✗ Paciente ter conta vita id (aguardando cadastro)       │
│  ✓ Paciente ter respondido pré-consulta                   │
│  ✗ Retorno proposto ou confirmado (use sub-bloco acima)   │
│                                                            │
│  [ Por que essas condições? ]                             │
└────────────────────────────────────────────────────────────┘
```

Clicar em "Por que essas condições?" abre modal explicando:
- Conta vita id: pra paciente conseguir abrir botão WhatsApp dentro do app dele
- Pré-consulta: pra confirmar identidade do paciente (não passamos WhatsApp pra desconhecido)
- Retorno: pra dar contexto temporal claro (WhatsApp dura "até o retorno")

### 7.3 Estados visuais (todos)

#### Estado A — Inativo (todas as pré-condições atendidas)

```
┌─ SUB-BLOCO: CONTATO WHATSAPP ────────────────────────────┐
│                                                            │
│  Você está fora do alcance da Maria por aqui.             │
│                                                            │
│  [ Liberar contato por janela ]                           │
│                                                            │
│  Retorno confirmado para 25/05. Liberar contato até       │
│  lá cria uma ponte segura, em horários que você define.   │
└────────────────────────────────────────────────────────────┘
```

#### Estado B — Sheet de liberação

```
┌─ SHEET ───────────────────────────────────────────────────┐
│                                                            │
│  Liberar contato com Maria Silva                          │
│  ─────────────────────────────────                        │
│                                                            │
│  Quando você quer ficar disponível?                       │
│                                                            │
│  ● Horário comercial                                      │
│    Segunda a sexta · 9h às 18h                            │
│                                                            │
│  ◯ Janela personalizada                                   │
│                                                            │
│  Até quando essa autorização vale?                        │
│  ┌───────┬────────┬─────────┬─────────────────────┐      │
│  │ 7 dias│ 14 dias│ 30 dias │ Até o retorno (25/05)│      │
│  └───────┴────────┴─────────┴─────────────────────┘      │
│                                                            │
│  Seu WhatsApp aparecerá pra Maria como:                   │
│  ┌──────────────────────────────────────────────────┐    │
│  │ (11) 99876-5432                                   │    │
│  │ [ Editar telefone ]                               │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
│  ⚠ Lembre: tudo que você responder por WhatsApp deve      │
│    ser registrado no prontuário (CFM 2.314/2022).         │
│                                                            │
│  ☐ Entendi e aceito a responsabilidade                    │
│                                                            │
│  [ Cancelar ]              [ Liberar ]                    │
└────────────────────────────────────────────────────────────┘
```

**Botão "Liberar" só fica ativo após marcar o checkbox de responsabilidade.**

#### Estado C — Janela personalizada (avançado)

Se médico escolhe "Janela personalizada":

```
┌─ SHEET (expansão) ────────────────────────────────────────┐
│                                                            │
│  Dias da semana:                                          │
│  ☑ Seg  ☑ Ter  ☑ Qua  ☑ Qui  ☑ Sex  ☐ Sáb  ☐ Dom         │
│                                                            │
│  Horário:                                                  │
│  De [09:00 ▼]  até [18:00 ▼]                              │
│                                                            │
│  Exceções (datas que você NÃO quer ser contatado):        │
│  [+ Adicionar exceção]                                    │
│  • 24/05 (Sábado) — Já bloqueado                          │
│  • 25/05 (Domingo) — Já bloqueado                         │
│  • 26/05 — [✗]                                            │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### Estado D — Ativo (visão do médico)

```
┌─ SUB-BLOCO: CONTATO WHATSAPP ────────────────────────────┐
│                                                            │
│  ✓ Ativo até 25/05 (14 dias restantes)                    │
│                                                            │
│  Janela: Seg-Sex · 9h às 18h                              │
│  Telefone autorizado: (11) 99876-5432                     │
│                                                            │
│  📊 Maria clicou no botão WhatsApp: 0 vezes               │
│                                                            │
│  [ Encerrar agora ]    [ Editar janela ]                  │
└────────────────────────────────────────────────────────────┘
```

#### Estado E — Janela expirou

```
┌─ SUB-BLOCO: CONTATO WHATSAPP ────────────────────────────┐
│                                                            │
│  Janela expirou em 25/05.                                 │
│                                                            │
│  📊 Maria clicou no botão WhatsApp: 3 vezes durante      │
│     a janela ativa.                                       │
│                                                            │
│  [ Liberar nova janela ]                                  │
└────────────────────────────────────────────────────────────┘
```

#### Estado F — Encerrado manualmente pelo médico

```
┌─ SUB-BLOCO: CONTATO WHATSAPP ────────────────────────────┐
│                                                            │
│  Encerrado em 18/05 (você fechou manualmente).            │
│                                                            │
│  📊 Maria clicou no botão WhatsApp: 1 vez antes do        │
│     encerramento.                                         │
│                                                            │
│  [ Liberar nova janela ]                                  │
└────────────────────────────────────────────────────────────┘
```

### 7.4 Banner matinal na aba Hoje (quando médico tem WhatsApp ativo)

```
┌─ ABA HOJE — TOPO ─────────────────────────────────────────┐
│                                                            │
│  ⓘ Você tem WhatsApp ativo com 3 pacientes hoje           │
│     • Maria Silva — até 25/05                             │
│     • João Pedro — até 27/05                              │
│     • Renata Lima — até 02/06                             │
│                                                            │
│  Horário ativo agora: Seg-Sex 9h-18h                      │
│                                                            │
│  [ Ver todas as janelas ]                                 │
└────────────────────────────────────────────────────────────┘
```

Banner aparece **só na primeira abertura do dia** (lembra estado via localStorage).

### 7.5 Lado paciente — Os 3 estados que o paciente vê

#### Estado A1 — Janela ativa, dentro do horário

```
┌─ BLOCO: FALAR COM SEU MÉDICO ────────────────────────────┐
│                                                            │
│  Dra. Maria Silva está disponível por WhatsApp            │
│                                                            │
│  [ 💬 Abrir WhatsApp ]                                    │
│                                                            │
│  Horário: Seg-Sex · 9h às 18h                             │
│  Disponível até 25/05/2026                                │
│                                                            │
│  ⓘ Use com calma. Sua médica responde quando puder.       │
│     Para emergência, ligue 192.                           │
└────────────────────────────────────────────────────────────┘
```

#### Estado A2 — Janela ativa, fora do horário

```
┌─ BLOCO: FALAR COM SEU MÉDICO ────────────────────────────┐
│                                                            │
│  Dra. Maria Silva atende por WhatsApp em horário comercial│
│                                                            │
│  Agora são 22h45 — volte entre 9h e 18h, segunda a sexta. │
│                                                            │
│  Próxima janela: amanhã (terça) às 9h                     │
│                                                            │
│  Para emergência, ligue 192.                              │
│                                                            │
│  [ 🔔 Avisar quando abrir ] (opcional)                    │
└────────────────────────────────────────────────────────────┘
```

#### Estado A3 — Sem janela ativa

**Bloco simplesmente não aparece.** Paciente nunca vê "sua médica não liberou contato" — isso geraria pressão social negativa.

### 7.6 Mensagem pré-preenchida do WhatsApp

Quando paciente clica "Abrir WhatsApp", abre `wa.me/55<numero>` com texto pronto:

```
Olá Dra. Maria Silva,
sou Maria da Silva, paciente desde 10/05.

Gostaria de falar sobre:
[escreva aqui]

Enviado pelo vita id.
```

**Por quê esse formato?**
- Identifica paciente (médico atende muita gente)
- Marca data da última consulta (contexto)
- Tem campo claro pra paciente escrever
- "Enviado pelo vita id" sinaliza que veio via canal oficial (não WhatsApp aleatório)

### 7.7 Log de cliques (compliance CFM)

**Cada clique é registrado:**
- Timestamp exato
- ID do paciente
- IP de origem (anônimo após 24h)
- User agent (anônimo após 24h)

**Médico vê:** apenas contador agregado ("Maria clicou X vezes").

**Backend guarda:** log completo por **5 anos** (CFM 2.314/2022 — retenção médica padrão).

**Paciente NÃO vê:** o log. Não é nosso papel mostrar pra paciente "você clicou 5 vezes" (constrangedor).

### 7.8 Telefone do médico — Origem e edição

**Fonte primária:** campo `whatsappTelefone` do model Medico (perfil → Integrações).

**Edição:**
- Médico pode editar a qualquer momento (Perfil ou inline no sheet)
- Validação: formato BR (+55XX...), apenas WhatsApp Business preferencialmente (mas aceita pessoal)
- Aviso: "Esse número aparecerá pra todos os pacientes que você liberar contato. Recomendamos WhatsApp Business com horário comercial configurado."

### 7.9 Cenários edge

1. **Médico esquece de fechar janela e dorme** → Janela TEM expiração obrigatória (default 14 dias). Mesmo se médico esquecer, janela morre sozinha.

2. **Paciente clica botão WhatsApp fora do horário** → App paciente NÃO abre WhatsApp. Mostra estado A2 ("fora do horário").

3. **Paciente perde acesso ao app durante janela ativa** → Botão WhatsApp some pra ele (não consegue abrir). Janela continua ativa no lado médico, mas ninguém clica nela.

4. **Médico troca de número** → Banner em todas as janelas ativas: "Você atualizou seu WhatsApp. Quer informar os pacientes ativos?" — opcional.

5. **Paciente bloqueia médico no WhatsApp** → vita id não detecta (não tem API). Médico continua vendo "Maria clicou 3 vezes" mas mensagens dele não chegam. Sem solução técnica — médico precisa perceber sozinho.

6. **Médico recebe WhatsApp fora do horário (paciente abriu na hora certa, mas conversa continuou)** → vita id não controla isso. WhatsApp é fora do nosso sistema. Disclaimer no onboarding explica.

7. **Múltiplos pacientes ativos simultaneamente** → Limite soft de 50 pacientes ativos por médico. Acima disso, banner: "Você tem muitas janelas ativas. Considere encerrar as antigas."

8. **Médico cancela conta vita id** → Todas as janelas ativas são encerradas automaticamente. Pacientes veem estado vazio. SMS opcional pra cada paciente avisando.

### 7.10 Métricas de sucesso da Feature 3

**KPIs primários:**
- **Taxa de liberação**: % de retornos confirmados que viram janela WhatsApp → meta 30%
- **Taxa de clique do paciente**: % de janelas ativas que recebem pelo menos 1 clique → meta 60%
- **Duração média da janela**: dias ativos antes de expirar ou ser fechada → meta 12-16 dias (saudável)
- **Taxa de re-liberação**: % de pacientes que recebem janela 2x ou mais → meta 25%

**KPIs secundários:**
- Cliques médios por janela ativa: 2-3 (saudável; > 8 = paciente abusando ou médico não respondendo)
- % de janelas que expiram sem cliques: < 30% (acima disso = paciente não viu)
- % de fechamentos manuais antes do prazo: < 15% (acima disso = médico arrependeu-se)

**Sinais de alerta:**
- Taxa de liberação > 80%: médico talvez liberando "pra todo mundo" sem critério → educar
- Taxa de re-liberação < 5%: feature não está sendo útil → entender por quê
- Cliques médios > 10: pacientes pedindo demais → introduzir limite ou educação

---

## PARTE 8 — FLUXO DE DADOS COMPLETO

### 8.1 Anexar mídia — passo a passo do dado

```
┌─ MÉDICO ABRE APP ─┐
│ Aba Pacientes      │
│ Clica em Maria     │
│ Expande accordion  │
│ "Consulta &        │
│  Retorno"          │
│ Vai em "Documentos │
│  anexados"         │
└────────┬───────────┘
         │
         ▼
┌─ ARRASTA PDF ──────────────────────┐
│ Arquivo: laudo_ecg.pdf · 240 KB   │
│ Frontend valida tamanho ≤ 10 MB   │
│ Frontend valida mime PDF/JPG/etc  │
└────────┬───────────────────────────┘
         │
         ▼
┌─ MODAL "QUE TIPO?" ────────────────┐
│ Médico escolhe: LAUDO              │
│ Médico ajusta nome:                │
│ "Eletrocardiograma de hoje"        │
│ Médico clica "Anexar agora"        │
└────────┬───────────────────────────┘
         │
         ▼
┌─ FRONTEND COMPRIME (se imagem) ────┐
│ Imagens: 1200px max, JPEG 0.75    │
│ PDFs: passam direto                │
│ Áudios: passam direto              │
└────────┬───────────────────────────┘
         │
         ▼
┌─ UPLOAD PARA SUPABASE STORAGE ─────┐
│ Bucket: documentos-consulta        │
│ Path: medico_<id>/paciente_<id>/   │
│       agendamento_<id>/            │
│       LAUDO_<timestamp>.pdf        │
│ Frontend usa uploadToSupabase()    │
│ (reuso de pre-consulta.js)         │
│ Timeout: 25s · Retry: 1x           │
└────────┬───────────────────────────┘
         │
         ▼
┌─ STORAGE RETORNA URL ──────────────┐
│ URL pública (mas bucket privado)   │
│ Backend gera signed URL com        │
│ expiração 7 dias quando paciente   │
│ for acessar                        │
└────────┬───────────────────────────┘
         │
         ▼
┌─ FRONTEND CHAMA BACKEND ───────────┐
│ POST /documentos-consulta/upload   │
│ Body:                              │
│  - agendamentoId: "ag-123"         │
│  - tipo: "LAUDO"                   │
│  - nome: "Eletrocardiograma..."    │
│  - urlStorage: "..."               │
│  - tamanhoBytes: 245760            │
│  - mimeType: "application/pdf"     │
│ Headers: Authorization: JWT médico │
└────────┬───────────────────────────┘
         │
         ▼
┌─ BACKEND VALIDA ───────────────────┐
│ 1. JWT médico válido?              │
│ 2. Médico é dono do agendamento?   │
│ 3. Paciente do agendamento existe? │
│ 4. HEAD na URL Storage → arquivo   │
│    realmente está lá?              │
│ 5. Tamanho bate?                   │
└────────┬───────────────────────────┘
         │
         ▼
┌─ BACKEND CRIA REGISTRO ────────────┐
│ Tabela: documentos_consulta        │
│ Insert:                            │
│  id, agendamentoId, medicoId,      │
│  pacienteId, tipo, nome, url,      │
│  tamanhoBytes, mimeType,           │
│  criadoEm, vistoEm (null)          │
└────────┬───────────────────────────┘
         │
         ▼
┌─ BACKEND DISPARA NOTIFICAÇÃO ──────┐
│ Service: notificacoes.js           │
│ 1. SMS pra paciente.telefone       │
│    (via Twilio existing)           │
│ 2. Push web (se paciente tem       │
│    tag de FCM registrada)          │
└────────┬───────────────────────────┘
         │
         ▼
┌─ BACKEND RETORNA AO FRONTEND ──────┐
│ HTTP 200                           │
│ Body:                              │
│  { id, status: "disponivel",       │
│    criadoEm }                      │
└────────┬───────────────────────────┘
         │
         ▼
┌─ FRONTEND ATUALIZA UI ─────────────┐
│ Remove card "Uploading"            │
│ Cria card "Anexado · Aguardando    │
│  paciente abrir"                   │
│ Toast com Desfazer (10s)           │
└────────────────────────────────────┘

─── tempo passa ───

┌─ PACIENTE ABRE APP ────────────────┐
│ App v3 chama GET                   │
│ /agendamento/:id                   │
│ Backend retorna agendamento +      │
│ lista de documentos com URLs       │
│ assinadas (expiração 7d)           │
└────────┬───────────────────────────┘
         │
         ▼
┌─ PACIENTE TOCA NO CARD ────────────┐
│ App abre URL em aba nova           │
│ PDF renderiza no navegador         │
│ Após 2 segundos no arquivo,        │
│ app paciente dispara               │
│ POST /documentos-consulta/:id/     │
│   marcar-visto                     │
└────────┬───────────────────────────┘
         │
         ▼
┌─ BACKEND ATUALIZA VISTO ───────────┐
│ UPDATE documentos_consulta         │
│ SET vistoEm = NOW()                │
│ WHERE id = :id                     │
│ AND pacienteId = :paciente         │
└────────┬───────────────────────────┘
         │
         ▼
┌─ MÉDICO RECARREGA OU REVISITA ─────┐
│ GET /agendamento/:id retorna       │
│ documento com vistoEm preenchido   │
│ Card atualiza:                     │
│ "Visto pelo paciente em DD/MM HH:mm│
└────────────────────────────────────┘
```

### 8.2 Propor retorno — passo a passo do dado

```
MÉDICO PROPÕE
   │
   ├─ Clica "Propor retorno"
   ├─ Sheet abre
   ├─ Escolhe prazo "30 dias"
   ├─ Sistema calcula: hoje (10/05) + 30d = 09/06
   ├─ Pula sábado/domingo se cair em fim de semana
   ├─ Médico ajusta período: "Tarde"
   ├─ Médico escreve mensagem (opcional)
   ├─ Médico marca checkbox "Adicionar ao Calendar"
   └─ Clica "Enviar proposta"
       │
       ▼
   POST /retornos-agendados
   Body: {
     agendamentoOrigemId,
     dataProposta: "2026-06-09T14:00:00Z",
     periodo: "TARDE",
     mensagemMedico: "...",
     adicionarCalendar: true
   }
       │
       ▼
   BACKEND
   ├─ Valida JWT
   ├─ Insert retornos_agendados
   │   status: PROPOSTO
   │   criadoEm: NOW()
   ├─ Dispara SMS pro paciente
   │   "Dr. propôs retorno 09/06"
   ├─ Dispara push (se aplicável)
   └─ Retorna { id, status: "PROPOSTO" }
       │
       ▼
   FRONTEND MÉDICO
   ├─ Sheet fecha
   ├─ Sub-bloco mostra estado C
   │   "⏳ Aguardando resposta"
   └─ Toast "Proposta enviada"

─── horas/dias passam ───

PACIENTE RECEBE SMS
   │
   ├─ Abre app pelo link
   ├─ App carrega aba Consultas
   ├─ Vê chip laranja "Retorno proposto"
   ├─ Toca → vai pra detalhe da consulta
   ├─ Vê bloco "Retorno proposto"
   └─ Tem 2 botões:
      ├─ [✓ Confirmar]
      └─ [Sugerir outra data]
       │
       ▼
PACIENTE CONFIRMA
   │
   ├─ Toca "Confirmar"
   ├─ Confirmação dupla
   │   "Confirmar retorno para 09/06 (tarde)?"
   └─ Toca "Sim"
       │
       ▼
   PUT /retornos-agendados/:id/responder
   Body: { acao: "CONFIRMAR" }
       │
       ▼
   BACKEND
   ├─ Valida que paciente é dono
   ├─ Update retornos_agendados
   │   status: CONFIRMADO
   │   confirmadoEm: NOW()
   ├─ Cria novo Agendamento
   │   tipo: RETORNO
   │   dataHora: 09/06 14:00
   │   medico: <medico>
   │   paciente: <paciente>
   ├─ Se médico tem Google Calendar:
   │   GoogleCalendarAPI.events.insert()
   │   Cria evento na agenda dele
   ├─ Dispara push pro médico
   │   "Maria confirmou retorno"
   └─ Retorna 200
       │
       ▼
   FRONTEND PACIENTE
   ├─ Toast "Retorno confirmado"
   ├─ Card vira verde
   └─ Volta pra aba Consultas
       (com card destaque verde)

─── médico vê depois ───

MÉDICO RECEBE PUSH
   │
   └─ "✓ Maria confirmou retorno"
   │
   ▼
ABRE APP
   │
   ├─ Aba Pacientes
   ├─ Lista mostra Maria com badge verde
   ├─ Clica Maria → perfil
   ├─ Sub-bloco "Retorno" mostra
   │   estado D (confirmado)
   └─ Se ativou Calendar:
      Evento aparece no Google
```

### 8.3 Liberar WhatsApp — passo a passo do dado

```
PRÉ-CONDIÇÕES
   ├─ Paciente tem conta vita id ✓
   ├─ Paciente respondeu PC ✓
   └─ Retorno proposto/confirmado ✓
       │
       ▼ (botão "Liberar" ativo)

MÉDICO LIBERA
   │
   ├─ Clica "Liberar contato por janela"
   ├─ Sheet abre
   ├─ Seleciona "Horário comercial"
   ├─ Seleciona duração "Até o retorno"
   │   (sistema calcula: hoje + 30 dias)
   ├─ Confirma telefone (puxa do perfil)
   ├─ Lê disclaimer CFM
   ├─ Marca checkbox "Entendi"
   └─ Clica "Liberar"
       │
       ▼
   PUT /medico/whatsapp-config
   Body: {
     pacienteId: "p-456",
     diasSemana: [1,2,3,4,5],
     horaInicio: "09:00",
     horaFim: "18:00",
     expiraEm: "2026-06-09T18:00:00Z",
     telefoneMedico: "+5511998765432"
   }
       │
       ▼
   BACKEND
   ├─ Valida JWT
   ├─ Valida pré-condições (re-check)
   ├─ Atualiza Medico.whatsappAutorizado
   │   (campo Json — adiciona objeto novo
   │    OU sobrescreve se já existir pra
   │    esse paciente)
   ├─ Cria entry em log de eventos
   │   tipo: "WHATSAPP_LIBERADO"
   ├─ Dispara SMS pro paciente:
   │   "Dra. Silva liberou WhatsApp
   │    seg-sex 9h-18h até 09/06"
   └─ Retorna 200
       │
       ▼
   FRONTEND MÉDICO
   ├─ Sheet fecha
   ├─ Sub-bloco mostra estado D
   │   "✓ Ativo até 09/06"
   └─ Toast "WhatsApp liberado"

─── paciente abre app ───

PACIENTE NA TELA CONSULTA DETALHE
   │
   ├─ App chama GET /agendamento/:id
   ├─ Backend valida horário:
   │   hora atual: 14h22
   │   janela: 9h-18h
   │   dia: terça (seg-sex permitido)
   │   data: 11/05 (ainda válido)
   │   → ATIVA
   └─ Retorna agendamento + {
       whatsappAtivo: true,
       telefoneMedico: "+5511...",
       proximaJanela: null,
       fimJanela: "2026-06-09T18:00:00Z"
     }
       │
       ▼
   APP RENDERIZA ESTADO A1
   ├─ Botão WhatsApp verde visível
   ├─ Texto "disponível até 09/06"
   └─ Aviso "horário comercial"
       │
       ▼
   PACIENTE TOCA BOTÃO
   │
   ├─ App registra POST evento
   │   /documentos-consulta/whatsapp-clique
   │   { pacienteId, medicoId, agendamentoId }
   ├─ Backend incrementa contador
   ├─ Backend salva log permanente
   │   (retenção 5 anos CFM)
   └─ App abre wa.me/55<numero>
      ?text=<mensagem pré-preenchida>
       │
       ▼
   WHATSAPP NATIVO ABRE
   (fora do vita id daqui em diante)
   Conversa rola entre paciente e médico
   normalmente. vita id não captura nada.
```

---

## PARTE 9 — BACKEND DETALHADO

### 9.1 Tabela `documentos_consulta` (NOVA)

```
documentos_consulta
├─ id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
├─ agendamentoId   uuid NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE
├─ medicoId        uuid NOT NULL REFERENCES medicos(usuarioId)
├─ pacienteId      uuid NULL REFERENCES usuarios(id)
│                  (null até paciente criar conta)
├─ tipo            varchar(20) NOT NULL
│                  CHECK (tipo IN ('LAUDO','ATESTADO','RECEITA','EXAME','AUDIO'))
├─ nome            varchar(120) NOT NULL
├─ urlStorage      text NOT NULL
│                  (URL Supabase Storage privado)
├─ tamanhoBytes    int NOT NULL
├─ mimeType        varchar(50) NOT NULL
├─ hashMd5         varchar(32) NULL
│                  (anti-corrupção; opcional MVP)
├─ criadoEm        timestamp NOT NULL DEFAULT NOW()
├─ vistoEm         timestamp NULL
├─ apagadoEm       timestamp NULL
│                  (soft-delete; retenção 30d antes de purge físico)
└─ atualizadoEm    timestamp NOT NULL DEFAULT NOW()

ÍNDICES:
- ix_documentos_paciente_criado (pacienteId, criadoEm DESC)
- ix_documentos_agendamento (agendamentoId)
- ix_documentos_medico (medicoId, criadoEm DESC)
- ix_documentos_apagamento (apagadoEm) WHERE apagadoEm IS NOT NULL
```

**Propósito de cada campo:**
- `pacienteId NULL` permite anexar antes do paciente criar conta (cron job vincula depois quando paciente cadastra com mesmo telefone)
- `hashMd5` anti-corrupção (futuro; MVP pode omitir)
- `apagadoEm` soft-delete preservativo

### 9.2 Tabela `retornos_agendados` (NOVA)

```
retornos_agendados
├─ id                       uuid PRIMARY KEY DEFAULT gen_random_uuid()
├─ agendamentoOrigemId      uuid NOT NULL REFERENCES agendamentos(id)
├─ agendamentoResultanteId  uuid NULL REFERENCES agendamentos(id)
│                           (preenche quando confirma → cria novo agendamento)
├─ medicoId                 uuid NOT NULL REFERENCES medicos(usuarioId)
├─ pacienteId               uuid NULL REFERENCES usuarios(id)
├─ dataProposta             timestamp NOT NULL
├─ periodo                  varchar(10) NOT NULL
│                           CHECK (periodo IN ('MANHA','TARDE','NOITE'))
├─ mensagemMedico           text NULL
├─ status                   varchar(20) NOT NULL DEFAULT 'PROPOSTO'
│                           CHECK (status IN
│                             ('PROPOSTO','CONTRAPROPOSTA','CONFIRMADO',
│                              'CANCELADO','REALIZADO','EXPIRADO'))
├─ dataContraproposta       timestamp NULL
├─ periodoContraproposta    varchar(10) NULL
├─ justificativaPaciente    text NULL
├─ adicionarCalendar        boolean NOT NULL DEFAULT false
├─ calendarEventoId         varchar(100) NULL
│                           (ID do evento criado no Google Calendar)
├─ criadoEm                 timestamp NOT NULL DEFAULT NOW()
├─ confirmadoEm             timestamp NULL
├─ canceladoEm              timestamp NULL
├─ realizadoEm              timestamp NULL
└─ atualizadoEm             timestamp NOT NULL DEFAULT NOW()

ÍNDICES:
- ix_retornos_paciente_status (pacienteId, status, criadoEm DESC)
- ix_retornos_medico_status (medicoId, status, criadoEm DESC)
- ix_retornos_origem (agendamentoOrigemId)
```

**Lógica de transição de estados:**
```
PROPOSTO ──confirmar──→ CONFIRMADO
   │
   ├──contrapropor──→ CONTRAPROPOSTA
   │                      │
   │                      ├──medico aceita──→ CONFIRMADO
   │                      └──medico cancela──→ CANCELADO
   │
   ├──cancelar (medico)──→ CANCELADO
   │
   └──expira (7d sem resposta)──→ EXPIRADO

CONFIRMADO ──data passou──→ REALIZADO
            (ou REALIZADO_NAO_COMPARECEU)
```

### 9.3 Campos novos em `medicos`

```
medicos (model existente — adicionar 2 campos)
├─ whatsappTelefone        varchar(20) NULL
│                          (número padrão do médico, ex: "+5511998765432")
└─ whatsappAutorizado      jsonb NOT NULL DEFAULT '[]'
                           (array de objetos)
```

Estrutura do `whatsappAutorizado` (JSON):

```
[
  {
    "pacienteId": "uuid",
    "telefoneMedico": "+5511998765432",
    "diasSemana": [1, 2, 3, 4, 5],
    "horaInicio": "09:00",
    "horaFim": "18:00",
    "excecoes": ["2026-05-26"],
    "expiraEm": "2026-06-09T18:00:00Z",
    "criadoEm": "2026-05-10T14:22:00Z",
    "encerradoEm": null,
    "cliquesPaciente": 3,
    "ultimoClique": "2026-05-12T10:15:00Z"
  },
  ...
]
```

**Por que JSON e não tabela separada?**
- 70% dos médicos terão < 10 entries (cabe bem em JSON)
- Lookup é sempre por `medicoId` (single document fetch)
- Atomicidade: liberar/encerrar/atualizar é UPDATE de campo único
- Sem necessidade de queries complexas tipo "todos os pacientes com WhatsApp ativo agora"

**Quando virar tabela separada?**
- Se médico passar de 50 entries habitualmente
- Se tivermos queries cross-médico (ex: "quantos médicos têm WhatsApp ativo agora")

### 9.4 Bucket Supabase Storage: `documentos-consulta`

**Configuração:**
- **Privado** (não público nem misto)
- **Estrutura de pastas:**
  ```
  documentos-consulta/
  ├─ medico_<id>/
  │  ├─ paciente_<id>/
  │  │  ├─ agendamento_<id>/
  │  │  │  ├─ LAUDO_<timestamp>.pdf
  │  │  │  ├─ ATESTADO_<timestamp>.pdf
  │  │  │  ├─ RECEITA_<timestamp>.pdf
  │  │  │  ├─ EXAME_<timestamp>.pdf
  │  │  │  └─ AUDIO_<timestamp>.mp3
  ```
- **Tamanho máximo por arquivo:** 10 MB (configurável)
- **URLs assinadas:** expiração 7 dias, renovadas a cada acesso
- **Tipos aceitos:** PDF, JPG, PNG, MP3, M4A, WAV (WAV converter para MP3 server-side)
- **Retenção pós-soft-delete:** 30 dias antes de purge físico

**Política de acesso (RLS Supabase):**
- Médico só lê próprios arquivos (path começa com `medico_<seu_id>/`)
- Paciente lê arquivos cujo agendamento ele participa
- Sistema (service_role) tem acesso total para operações administrativas

### 9.5 5 rotas novas no backend

#### Rota 1: `POST /documentos-consulta/upload` (médico)

**Body (multipart/form-data):**
```
agendamentoId: "ag-123"
tipo: "LAUDO"
nome: "Eletrocardiograma de hoje"
arquivo: <File>
```

**Validações:**
1. JWT médico válido
2. Médico é dono do agendamento
3. Tamanho ≤ 10 MB
4. Mime type na whitelist
5. Nome 1-100 caracteres sem caracteres especiais perigosos

**Resposta sucesso (201):**
```json
{
  "id": "doc-789",
  "agendamentoId": "ag-123",
  "tipo": "LAUDO",
  "nome": "Eletrocardiograma de hoje",
  "url": "https://supabase.../signed-url...",
  "tamanhoBytes": 245760,
  "mimeType": "application/pdf",
  "criadoEm": "2026-05-10T14:22:00Z",
  "vistoEm": null,
  "status": "disponivel"
}
```

**Erros possíveis:**
- 400: Tamanho excedido / Mime inválido / Nome inválido
- 401: JWT inválido
- 403: Médico não é dono do agendamento
- 413: Payload muito grande (filtro Express)
- 500: Falha no Storage

#### Rota 2: `GET /agendamento/:id/detalhe-completo` (paciente OU médico)

Estende rota existente. Retorna agendamento + documentos + retorno + status WhatsApp.

**Resposta:**
```json
{
  "agendamento": {
    "id": "ag-123",
    "tipo": "CONSULTA",
    "medico": {
      "id": "med-456",
      "nome": "Dra. Maria Silva",
      "especialidade": "Cardiologia",
      "fotoUrl": "..."
    },
    "dataHora": "2026-05-10T10:30:00Z",
    "local": "Consultório...",
    "observacoes": "..."
  },
  "documentos": [
    {
      "id": "doc-789",
      "tipo": "LAUDO",
      "nome": "Eletrocardiograma de hoje",
      "url": "https://supabase.../signed-url...",
      "criadoEm": "2026-05-10T14:22:00Z",
      "vistoEm": null,
      "tamanhoBytes": 245760
    }
  ],
  "retorno": {
    "id": "ret-101",
    "dataProposta": "2026-06-09T14:00:00Z",
    "periodo": "TARDE",
    "status": "PROPOSTO",
    "mensagemMedico": "Queria reavaliar...",
    "criadoEm": "2026-05-10T14:30:00Z"
  },
  "whatsapp": {
    "ativo": true,
    "telefoneMedico": "+5511998765432",
    "horaInicio": "09:00",
    "horaFim": "18:00",
    "diasSemana": [1,2,3,4,5],
    "expiraEm": "2026-06-09T18:00:00Z",
    "dentroDoHorario": true,
    "proximaJanela": null
  }
}
```

#### Rota 3: `POST /retornos-agendados` (médico)

**Body:**
```json
{
  "agendamentoOrigemId": "ag-123",
  "dataProposta": "2026-06-09T14:00:00Z",
  "periodo": "TARDE",
  "mensagemMedico": "Queria reavaliar a pressão...",
  "adicionarCalendar": true
}
```

**Resposta sucesso (201):**
```json
{
  "id": "ret-101",
  "status": "PROPOSTO",
  "dataProposta": "2026-06-09T14:00:00Z",
  "criadoEm": "2026-05-10T14:30:00Z"
}
```

#### Rota 4: `PUT /retornos-agendados/:id/responder` (paciente)

**Body (confirmar):**
```json
{ "acao": "CONFIRMAR" }
```

**Body (contraproposta):**
```json
{
  "acao": "CONTRAPROPOR",
  "dataContraproposta": "2026-06-12T09:00:00Z",
  "periodoContraproposta": "MANHA",
  "justificativaPaciente": "Não consigo na terça..."
}
```

**Resposta sucesso:** 200 com objeto retorno atualizado.

#### Rota 5: `PUT /medico/whatsapp-config` (médico)

**Body (liberar/atualizar):**
```json
{
  "pacienteId": "p-456",
  "diasSemana": [1,2,3,4,5],
  "horaInicio": "09:00",
  "horaFim": "18:00",
  "expiraEm": "2026-06-09T18:00:00Z",
  "telefoneMedico": "+5511998765432"
}
```

**Body (encerrar):**
```json
{
  "pacienteId": "p-456",
  "acao": "ENCERRAR"
}
```

**Resposta sucesso:** 200 com objeto whatsappAutorizado atualizado.

### 9.6 Reutilizar `uploadExame` em `pre-consulta.js`

O fluxo de upload de exames de pré-consulta já tem:
- Compressão de imagem (1200px, JPEG 0.75)
- Upload para Supabase Storage com timeout 25s + retry 1x
- Validação HEAD pós-upload
- Tratamento de erros 503

**Refatoração:**
- Extrair função `uploadToSupabaseStorage(file, bucket, path)` em arquivo compartilhado (`backend/src/services/storage.js`)
- `pre-consulta.js` passa a usar essa função
- Nova rota `/documentos-consulta/upload` também usa
- **Zero duplicação de código**

### 9.7 Auditoria CFM (log de cliques WhatsApp)

**Tabela `auditoria_whatsapp_clique` (NOVA, retenção 5 anos):**

```
auditoria_whatsapp_clique
├─ id              uuid PRIMARY KEY
├─ medicoId        uuid NOT NULL
├─ pacienteId      uuid NOT NULL
├─ agendamentoId   uuid NULL
├─ timestamp       timestamp NOT NULL DEFAULT NOW()
├─ ipHash          varchar(64) NULL
│                  (SHA-256 do IP; original purgado após 24h)
├─ userAgentHash   varchar(64) NULL
└─ janelaId        varchar(50) NOT NULL
                   (identificador único da janela ativa no momento)

ÍNDICES:
- ix_auditoria_medico_paciente_timestamp
- ix_auditoria_retencao (timestamp) — para cron de retenção
```

**Política de retenção:**
- 24h após criação: hash IP + user agent (anonimização parcial)
- 5 anos após criação: purge físico (CFM 2.314/2022)

### 9.8 Migrações Prisma (estratégia anti-destrutiva)

**REGRA CRÍTICA (do CLAUDE.md):**
- NUNCA `prisma db push` com `--accept-data-loss`
- NUNCA mexer em schema sem backup pg_dump prévio

**Migração da Feature 1 (Anexar):**
```sql
-- Migration: 20260601_documentos_consulta
CREATE TABLE documentos_consulta (...);
CREATE INDEX ix_documentos_paciente_criado ...;
-- ZERO ALTER em tabelas existentes
```

**Migração da Feature 2 (Retorno):**
```sql
-- Migration: 20260615_retornos_agendados
CREATE TABLE retornos_agendados (...);
CREATE INDEX ...;
-- ZERO ALTER em tabelas existentes
```

**Migração da Feature 3 (WhatsApp):**
```sql
-- Migration: 20260629_whatsapp_medico
ALTER TABLE medicos
  ADD COLUMN whatsapp_telefone varchar(20) NULL,
  ADD COLUMN whatsapp_autorizado jsonb NOT NULL DEFAULT '[]';
CREATE TABLE auditoria_whatsapp_clique (...);
-- ALTER é ADD COLUMN (não destrutivo)
```

**Cada migração:**
1. Backup pg_dump antes
2. Aplicar via `railway run psql $DATABASE_URL -f migration.sql`
3. Validar contagem antes/depois das tabelas existentes
4. Tag git `pre-feature-N-2026-MM-DD`
5. Rollback plan: DROP TABLE / DROP COLUMN se necessário

---

## PARTE 10 — CICLO DE NOTIFICAÇÕES

### 10.0 DECISÃO DO LUCAS (CONFIRMADA)

> **SMS está fora do escopo desta entrega.** Notificação principal: **dentro do app paciente** (badge + banner + push web). **Email** virá numa fase posterior (não agora — Lucas vai escolher provedor depois).

Isso muda a UX em uma direção importante: o paciente **descobre** que recebeu algo quando **abre o app** (não recebe alerta externo). Isso exige UX cuidadosa pra paciente voltar ao app com frequência — principalmente badge no ícone de Consultas e banner persistente na home.

### 10.1 Canais disponíveis (escopo atualizado)

| Canal | Quando usar | Status no MVP |
|---|---|---|
| **Badge in-app** | Indicador visual no ícone da aba Consultas, lista de cards, etc | ✅ ATIVO |
| **Banner in-app** | Card destacado na aba Saúde (home) avisando "Você tem 2 novidades em Consultas" | ✅ ATIVO |
| **Push web (PWA)** | Push do navegador quando paciente tem o app instalado como PWA e deu permissão | ✅ ATIVO (best effort) |
| **Email (Resend ou similar)** | Notificação por email | ⏸️ FASE FUTURA — Lucas escolhe provedor depois |
| **SMS (Twilio)** | SMS curto com link | ❌ FORA DO ESCOPO desta entrega |
| **WhatsApp** | NÃO usar para notificações | ❌ exclusivo da Feature 3 (canal por janela) |

### 10.2 Matriz de notificações (versão MVP)

| Evento | Badge in-app | Banner home | Push web (se disponível) |
|---|---|---|---|
| Médico anexa documento | ✓ aba Consultas + card da consulta | ✓ "1 documento novo" | ✓ se permissão dada |
| Médico propõe retorno | ✓ aba Consultas + card | ✓ "Retorno proposto" | ✓ se permissão dada |
| Médico libera WhatsApp | ✓ card da consulta | ✓ "Sua médica liberou WhatsApp" | ✓ se permissão dada |
| Lembrete retorno 1 dia antes | ✓ aba Consultas | ✓ "Retorno amanhã" | ✓ se permissão dada |
| Paciente confirma retorno (→ médico) | ✓ lista esquerda Pacientes | ✓ "Maria confirmou" | ✓ navegador médico |
| Paciente contrapropõe (→ médico) | ✓ badge laranja urgente | ✓ "Maria sugeriu outra data" | ✓ urgente |
| Janela WhatsApp prestes a expirar | — | ✓ aba Hoje médico | — |

### 10.3 Como o paciente "descobre" sem SMS

Esta é a peça crítica desta decisão: sem SMS, o paciente **precisa abrir o app pra descobrir**. Estratégia em camadas:

**Camada 1 — Push web (PWA):** Quando paciente instala o app v3 como PWA no iPhone/Android (tela inicial), pode dar permissão pra push. Quando médico anexa documento, paciente recebe notificação nativa do sistema operacional. **Funciona muito bem se paciente instalou.**

**Camada 2 — Badge persistente:** Mesmo se push não funciona, no momento em que paciente abre o app, vê:
- Ícone da aba Consultas com bolinha vermelha + contador (ex: ② significa 2 novidades)
- Card da consulta na aba Consultas com chip pulsante
- Banner na aba Saúde (home): "Você tem 2 atualizações em Consultas" (clicável)

**Camada 3 — Atalho do médico:** Médico pode mandar o link da consulta direto pelo WhatsApp pessoal dele ao paciente após consulta presencial: "Acabei de anexar seu laudo. Veja em [link]". Isso é UX do médico — não automatizado pelo sistema. Mas é prática real e funciona.

**Camada 4 — Email (fase futura):** Quando Lucas decidir o provedor de email, entra como notificação universal pra paciente que não tem PWA instalado.

### 10.4 Como o médico "descobre" resposta do paciente

Médico abre app desktop várias vezes ao dia (parte da rotina já mapeada). Estratégia:

**Camada 1 — Push web do navegador:** Se médico permitiu push no navegador (Chrome/Edge), recebe notificação nativa "Maria confirmou retorno".

**Camada 2 — Badge na lista de Pacientes:** Bolinha colorida ao lado do nome do paciente na lista esquerda:
- Verde: paciente confirmou algo recentemente
- Laranja: paciente contrapropôs (precisa atenção)
- Cinza: sem novidades

**Camada 3 — Stat na aba Hoje:** Contador "Retornos confirmados nesta semana: 8" + novo contador "Aguardando resposta sua: 3" (se houver contrapropostas pendentes).

### 10.5 Política de frequência (anti-spam in-app)

- Banner home: máximo 1 por sessão (mostra o mais recente)
- Badge: cumulativo (não tem limite — médico anexa 5 docs, badge mostra ⑤)
- Push web: máximo 5/dia por paciente (cumulativo de todos os eventos)

### 10.6 Migração futura para SMS/Email

Quando Lucas decidir adicionar SMS ou email no futuro:
- Estrutura de notificação já vem preparada como **service abstrato** (`notificacoes.js`)
- Cada evento dispara função `notificar(evento, destinatario, dados)`
- Hoje a função só registra in-app
- Amanhã: mesma função também dispara SMS/email sem mudar nada no resto do código
- **Zero refactor necessário** quando adicionar canais

### 10.7 Templates de mensagem (in-app)

**Banner home quando médico anexa:**
```
📎 Dra. Maria Silva anexou um Laudo
Toque para ver →
```

**Banner home quando retorno proposto:**
```
📅 Retorno proposto para 09/06
Confirme ou sugira outra data →
```

**Banner home quando WhatsApp liberado:**
```
💬 Dra. Maria liberou WhatsApp
Disponível seg-sex 9h-18h →
```

**Card destaque na aba Consultas:**
```
┌─ ⓘ NOVIDADE ────────────────────────┐
│ Dra. Maria adicionou 2 documentos    │
│ e propôs retorno para 09/06.         │
│ [Ver detalhes]                       │
└──────────────────────────────────────┘
```

---

## PARTE 11 — APP PACIENTE V3: OS 3 BLOCOS PREENCHIDOS

### 11.1 Aba Consultas — chips de status

Cada card no histórico ganha chips visuais:

```
┌─ HISTÓRICO CLÍNICO ───────────────────────────────────────┐
│                                                            │
│ ┌─ Dra. Maria Silva · Cardiologia ────────────────────┐  │
│ │ 10/05/2026 às 10h30                                  │  │
│ │ ✓ Realizada  📎 Documentos (2)  📅 Retorno em 09/06 │  │
│ │ 💬 WhatsApp disponível                                │  │
│ └──────────────────────────────────────────────────────┘  │
│                                                            │
│ ┌─ Dr. João Pedro · Clínica Geral ────────────────────┐  │
│ │ 28/04/2026 às 15h00                                  │  │
│ │ ✓ Realizada                                           │  │
│ └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

**Cores dos chips:**
- ✓ Realizada — cinza neutro
- 📎 Documentos (N) — azul informativo
- 📅 Retorno proposto — laranja warning
- 📅 Retorno confirmado em DD/MM — verde sucesso
- 💬 WhatsApp disponível — verde Sistema 1

### 11.2 Tela detalhe — bloco "Documentos da médica"

```
┌─ DOCUMENTOS DA MÉDICA ────────────────────────────────────┐
│                                                            │
│ ┌─ 📄 LAUDO · Eletrocardiograma de hoje ──────────┐     │
│ │ PDF · enviado 10/05 às 14h22 · 240 KB            │     │
│ │ [ Ver documento ]                                 │     │
│ └───────────────────────────────────────────────────┘     │
│                                                            │
│ ┌─ 📋 ATESTADO · 3 dias de afastamento ───────────┐     │
│ │ PDF · enviado 10/05 às 14h25 · 38 KB             │     │
│ │ [ Ver documento ]                                 │     │
│ └───────────────────────────────────────────────────┘     │
│                                                            │
│ ┌─ 🎵 ÁUDIO · Orientação pós-consulta ────────────┐     │
│ │ 1:42 min · enviado 10/05 às 14h26                 │     │
│ │ [ ▶ Ouvir ]                                       │     │
│ └───────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────┘
```

### 11.3 Tela detalhe — bloco "Retorno proposto"

(Já documentado na Parte 6.)

### 11.4 Tela detalhe — bloco "Falar com seu médico"

(Já documentado na Parte 7.)

### 11.5 Componente toast Desfazer (paciente)

Toast aparece quando paciente confirma retorno (5 segundos):
```
✓ Retorno confirmado em 09/06.
[Desfazer]
```

Se clicar Desfazer: PUT /retornos-agendados/:id/responder com `{ acao: "REVERTER" }` → status volta para PROPOSTO.

---

## PARTE 12 — APP MÉDICO DESKTOP: MUDANÇAS VISUAIS POR ABA

### 12.1 Aba HOJE — Novo stat + Banner WhatsApp

**Antes:**
```
[Pacientes: 12] [Pendentes: 3] [Anamnese pronta: 9] [Parcial: 1]
```

**Depois:**
```
[Pacientes: 12] [Pendentes: 3] [Anamnese pronta: 9] [Parcial: 1] [Retornos confirmados: 8]
```

Stat novo "Retornos confirmados" mostra a soma dos retornos confirmados desta semana. Clicável → filtra lista de pacientes com retorno confirmado.

**Banner novo (matinal, primeira abertura do dia):**
```
ⓘ Você tem WhatsApp ativo com 3 pacientes hoje
```

### 12.2 Aba PACIENTES — Novo accordion (PRINCIPAL MUDANÇA)

Já documentado na Parte 4.

### 12.3 Aba PRÉ-CONSULTAS — Chip "tem anexo" + Atalho

**Linha da tabela ganha indicador:**
```
| Maria Silva | 10/05 | Pendente | 📎 2 anexos |
```

**Tela de sumário de 1 minuto ganha botão no rodapé:**
```
[ Anexar laudo pra Maria ] → atalho que abre direto o accordion na sub-seção Documentos
```

### 12.4 Aba TEMPLATES — Sem mudança

### 12.5 Aba MEU PERFIL — Campo telefone WhatsApp

Sub-aba "Integrações" ganha novo bloco:

```
┌─ WHATSAPP DE CONTATO ─────────────────────────────────────┐
│                                                            │
│  Seu telefone WhatsApp que aparecerá para os pacientes    │
│  quando você liberar contato:                              │
│                                                            │
│  ┌──────────────────────────────────────────────┐         │
│  │ (11) 99876-5432                              │         │
│  │ [Editar]                                      │         │
│  └──────────────────────────────────────────────┘         │
│                                                            │
│  ⓘ Recomendamos WhatsApp Business com horário comercial   │
│    configurado.                                            │
└────────────────────────────────────────────────────────────┘
```

---

## PARTE 13 — O QUE SUMIR, TRANSFERIR OU GANHAR NOVA CAMADA

### 13.1 O que SUMIR (nenhum elemento)

**Nada de fato some.** Todas as features atuais permanecem funcionais.

### 13.2 O que TRANSFERIR

| Item atual | Destino novo | Motivo |
|---|---|---|
| "Imprimir laudo" (não existe hoje, expectativa do médico) | Novo accordion → Sub-bloco Documentos | Digitaliza o fluxo |
| WhatsApp pessoal do médico no rodapé do app (não existe hoje) | Sub-bloco Contato WhatsApp por paciente | Granularidade |
| Card "Retorno" promocional na aba Hoje | Vira funcional: contagem real de retornos pendentes | Substituição |

### 13.3 O que GANHAR NOVA CAMADA

| Lugar existente | Camada nova adicionada |
|---|---|
| Sumário de 1 minuto (PRÉ-CONSULTAS → detalhe) | Botão "Anexar laudo" no rodapé |
| Aba Pré-Consultas (tabela) | Ícone 📎 indicando anexos na linha |
| Aba Hoje (stats) | Novo stat "Retornos confirmados" |
| Perfil do médico → Integrações | Bloco WhatsApp de contato |
| Aba Hoje (topo) | Banner matinal "WhatsApp ativo com X" |

### 13.4 O que NÃO mexer (princípio de isolamento)

- Aba Templates: zero mudança
- Modelo Usuario: zero mudança
- Modelo PreConsulta: zero mudança
- Modelo PerfilSaude: zero mudança
- Rotas existentes: zero quebra (só estender GET /agendamento/:id)
- Schema Prisma existente: só ADD (nunca DROP, nunca RENAME)
- Backend services existentes: só importar de novos services

---

## PARTE 14 — ROADMAP COM 3 FASES

### Fase 1 — ANEXAR MÍDIAS (7 dias úteis estimados)

**Pré-requisitos antes de começar:**
- Confirmar resposta das 3 perguntas pendentes (Parte 27)
- Backup pg_dump do banco produção
- Tag git `pre-feature-anexar-2026-MM-DD`
- Sentry configurado pra capturar erros do upload

**Sub-fases:**

**Sub-fase 1.1 — Backend (2 dias):**
- Migração: criar tabela `documentos_consulta`
- Criar bucket Supabase `documentos-consulta` com RLS
- Refatorar `uploadExame` → `storage.js` shared service
- Implementar POST `/documentos-consulta/upload`
- Estender GET `/agendamento/:id` para retornar documentos
- Implementar DELETE `/documentos-consulta/:id` (soft-delete)
- Implementar POST `/documentos-consulta/:id/marcar-visto`
- Implementar PUT `/documentos-consulta/:id/renomear`
- Testes unitários (jest ou similar)

**Sub-fase 1.2 — Frontend médico (3 dias):**
- Criar accordion "Consulta & Retorno" no perfil do paciente
- Sub-bloco "Documentos anexados" com dropzone
- Modal "Que tipo é esse documento?" com 5 opções
- Lista de cards de documentos com estados
- Botões Renomear, Apagar, Visualizar
- Toast Desfazer 10s
- Chip 📎 na aba Pré-Consultas
- Botão "Anexar laudo" no sumário de 1 minuto

**Sub-fase 1.3 — Frontend paciente (1 dia):**
- Bloco "Documentos da médica" na tela detalhe consulta
- Chip "Documentos" no card da aba Consultas
- Player inline para áudios
- Lógica de marcar visto após X segundos
- Estado vazio

**Sub-fase 1.4 — Testes end-to-end (1 dia):**
- Playwright: médico anexa PDF → paciente vê → marca visto
- Playwright: médico anexa áudio → paciente toca → marca visto
- Playwright: médico tenta anexar arquivo 12 MB → vê erro amigável
- Playwright: paciente sem conta → médico anexa → SMS dispara
- Playwright: médico apaga → confirma → desfaz em 10s

**Critério de aceitação UX:**
- Médico anexa 1 PDF em < 30 segundos do clique
- Paciente abre documento em < 1 minuto após notificação
- Status "visto" atualiza em tempo real (refresh ou polling)
- Zero erros silenciosos (todo erro tem toast amigável)

**Validação humana:**
- Lucas testa com 1 paciente real (familiar/amigo)
- 3 médicos betatesters (Helena equivalente, Lucas Jr equivalente, Raffaela equivalente)
- Apresentação para advogado/consultor LGPD do disclaimer e RLS

### Fase 2 — PROPOR RETORNO (11 dias úteis estimados)

**Pré-requisitos:**
- Fase 1 em produção há pelo menos 7 dias
- Pelo menos 3 médicos reais usaram Fase 1
- Feedback coletado sobre Fase 1
- Tag git `pre-feature-retorno-2026-MM-DD`

**Sub-fases:**

**Sub-fase 2.1 — Backend (3 dias):**
- Migração: criar tabela `retornos_agendados`
- Implementar POST `/retornos-agendados`
- Implementar PUT `/retornos-agendados/:id/responder`
- Implementar POST `/retornos-agendados/:id/cancelar`
- Cron job: estado PROPOSTO sem resposta há 7d → EXPIRADO
- Cron job: estado CONFIRMADO com data passada há 1d → REALIZADO
- Integração Google Calendar API (se médico tem Calendar conectado)
- Lógica de pular fim-de-semana e feriados nacionais
- Notificações in-app + push web + lembrete 1d antes (SMS fora do escopo desta entrega)
- Testes unitários

**Sub-fase 2.2 — Frontend médico (4 dias):**
- Sub-bloco "Retorno agendado" no accordion
- Sheet "Propor retorno" com 6 estados (A, B, C, D, E + sheet aberta)
- Pills 7/15/30/60/Personalizado
- Datepicker com pular weekend
- Toggle período Manhã/Tarde/Noite
- Textarea mensagem
- Checkbox "Adicionar ao Calendar"
- Stat novo "Retornos confirmados" na aba Hoje
- Badge laranja na lista esquerda de Pacientes quando há contraproposta

**Sub-fase 2.3 — Frontend paciente (2 dias):**
- Bloco "Retorno proposto" na tela detalhe consulta
- Chip "Retorno proposto/confirmado" na aba Consultas
- Sheet de contraproposta com datepicker + textarea justificativa
- Toast Desfazer 5s após confirmar
- Estados vazios e fallbacks

**Sub-fase 2.4 — Testes end-to-end (2 dias):**
- Playwright: ciclo completo proposta → confirmação → Calendar
- Playwright: ciclo proposta → contraproposta → aceitação
- Playwright: ciclo proposta → expiração após 7d
- Playwright: data sugerida pula sábado/domingo
- Playwright: paciente sem conta vita id

**Critério de aceitação UX:**
- Médico propõe retorno em < 30 segundos (4 cliques)
- Paciente confirma em 1 toque (do SMS)
- Evento Google Calendar criado automaticamente
- 60% das propostas confirmadas em 24h (KPI a medir após launch)

**Validação humana:**
- Lucas testa fluxo completo: propõe, recebe contraproposta, aceita, Calendar
- 5 médicos betatesters
- Paciente real responde de iPhone real
- Validar pular feriado próximo (15/nov, 25/dez, etc)

### Fase 3 — LIBERAR WHATSAPP (8 dias úteis estimados)

**Pré-requisitos:**
- Fase 2 em produção há pelo menos 14 dias
- Pelo menos 5 retornos confirmados realmente acontecendo
- Feedback coletado sobre Fases 1 e 2
- Disclaimer CFM revisado por advogado
- Tag git `pre-feature-whatsapp-2026-MM-DD`

**Sub-fases:**

**Sub-fase 3.1 — Backend (2 dias):**
- Migração: ADD COLUMN whatsapp_telefone + whatsapp_autorizado em medicos
- Migração: criar tabela auditoria_whatsapp_clique
- Implementar PUT `/medico/whatsapp-config`
- Implementar POST `/whatsapp-clique` (audit log)
- Estender GET /agendamento/:id com bloco whatsapp
- Validador de horário/dia/data (server-side)
- Cron job: janelas com expiraEm passado → status ENCERRADO
- Cron job: purge auditoria > 5 anos

**Sub-fase 3.2 — Frontend médico (3 dias):**
- Sub-bloco "Contato WhatsApp" no accordion
- Sheet de liberação com 2 modos (comercial vs personalizado)
- Toggle dias da semana + horário + exceções
- Pills 7/14/30/"Até retorno"
- Disclaimer CFM com checkbox obrigatório
- Estados A/B/C/D/E/F
- Banner matinal na aba Hoje
- Bloco WhatsApp em Perfil → Integrações

**Sub-fase 3.3 — Frontend paciente (1 dia):**
- Bloco "Falar com seu médico" na tela detalhe consulta
- Estados A1 (dentro do horário), A2 (fora), A3 (sem janela)
- Mensagem pré-preenchida no `wa.me/...`
- Tracking de clique (POST /whatsapp-clique)
- Chip "WhatsApp disponível" no card da aba Consultas

**Sub-fase 3.4 — Testes end-to-end (2 dias):**
- Playwright: médico libera → paciente vê → clica → SMS chega
- Playwright: paciente clica fora do horário → vê estado A2
- Playwright: janela expira → bloco some pro paciente
- Playwright: médico edita janela → muda comportamento real-time
- Playwright: paciente sem conta → bloco não aparece
- Playwright: retorno cancelado → janela "Até retorno" também encerra

**Critério de aceitação UX:**
- Médico libera janela em < 1 minuto (3 cliques: liberar → marcar checkbox → confirmar)
- Paciente vê botão SÓ dentro do horário (validação server-side)
- 60% das janelas ativas recebem pelo menos 1 clique (KPI a medir)
- Disclaimer CFM aparece e checkbox é obrigatório

**Validação humana:**
- Lucas testa com 3 médicos: Helena (resiste), Lucas Jr (adora), Beatriz (cautela)
- Advogado revisa disclaimer e log de auditoria
- Médico testa em fim-de-semana (janela inativa)
- Cenário real: paciente clica botão, conversa rola via WhatsApp nativo

---

## PARTE 15 — VALIDAÇÃO CRUZADA COM 7 PERSONAS

### Tabela cruzada — adoção esperada por feature por persona

| Persona | Anexar | Retorno | WhatsApp | Frequência uso/semana | Volume estimado |
|---|---|---|---|---|---|
| **Helena** (clínica premium, 50a) | ⭐⭐⭐ | ⭐⭐⭐ | ⭐ | 5x/semana | 3-5 anexos · 2-3 retornos · 0-1 WhatsApp |
| **Carlos** (PS, 38a) | ⭐⭐⭐ | ✗ | ✗ | 30x/semana | 30 atestados · 0 retornos · 0 WhatsApp |
| **Raffaela** (pediatra, 42a) | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | 10x/semana | 5 anexos · 3 retornos · 2 WhatsApp |
| **Lucas Jr** (jovem tech, 32a) | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 8x/semana | 4 anexos · 4 retornos · 3 WhatsApp |
| **Rafael** (SUS, 45a) | ✗ | ⭐⭐ | ✗ | 2x/semana | 0 anexos · 5 retornos · 0 WhatsApp |
| **Beatriz** (especialista, 48a) | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | 6x/semana | 5 anexos · 4 retornos · 1 WhatsApp |
| **Mariana** (telemedica, 35a) | ✗ | ✗ | ⭐⭐ | 1x/semana | 0 anexos · 0 retornos · 1 WhatsApp |

### Maior objeção por persona

| Persona | Objeção mais forte | Como o design responde |
|---|---|---|
| Helena | "WhatsApp vai invadir vida pessoal" | Janela rigorosa + horário comercial default + opção encerrar |
| Carlos | "Não tenho tempo de mexer em app" | Anexar atestado em 3 cliques + atalho do sumário |
| Raffaela | "Mãe ansiosa vai abusar do canal" | Janela com expiração + horário definido + counter de cliques |
| Lucas Jr | (nenhuma forte) | Foco em features avançadas (janela personalizada) |
| Rafael | "Paciente SUS não tem smartphone" | Banner pacientes sem conta + SMS universal |
| Beatriz | "Cardio precisa compliance ICP-Brasil" | Disclaimer claro: "Para receita controlada use Memed" |
| Mariana | "Plataforma controla minhas tools" | Feature 3 funciona standalone (não exige outras) |

---

## PARTE 16 — COPY POR PERSONA E POR FEATURE

### Copy macro (aparece em onboarding/help)

**Anexar mídias:**
- Tom Helena (premium): "Seu trabalho clínico, organizado. Cada laudo, atestado e receita ficam acessíveis ao paciente — auditáveis sempre."
- Tom Carlos (PS, direto): "Atestado em 3 cliques. Paciente recebe na hora."
- Tom Raffaela (pediatra, acolhedor): "Mande orientação pós-consulta por áudio. A mãe ouve quando precisa."
- Tom Lucas Jr (tech): "Upload direto, status de visualização em tempo real. Auditável e seguro."

**Propor retorno:**
- Tom Helena: "Seu paciente crônico não desaparece mais. Proposta enviada, ele confirma."
- Tom Raffaela: "Próxima vacina, próximo peso — retorno marcado sem ligação."
- Tom Lucas Jr: "% de retornos confirmados no seu dashboard. Métrica de qualidade clínica."

**Liberar WhatsApp:**
- Tom Helena: "Você no controle. Janela com data e horário definidos por você. Fora disso, silêncio."
- Tom Raffaela: "Mãe ansiosa, mas em horário comercial. Você define quando ouvir."
- Tom Lucas Jr: "Canal direto auditável. Compliance CFM 2.314/2022 garantido."

### Copy micro (botões, labels, toasts)

**Botões:**
- "Anexar documento" (ação direta, verbo médico)
- "Propor retorno ao paciente" (não "Marcar retorno" — proposta é colaborativa)
- "Liberar contato por janela" (não "Liberar WhatsApp" — janela é o conceito-chave)

**Labels de estado:**
- "Aguardando paciente abrir" (não "Não visto" — neutro)
- "Visto pelo paciente em DD/MM HH:mm" (factual)
- "Aguardando resposta da paciente" (humano)
- "Confirmado por Maria" (relacional)

**Toasts:**
- "Documento anexado. Paciente será notificado por SMS." (informativo)
- "Proposta enviada. Maria recebeu SMS agora." (factual)
- "Janela liberada até 09/06." (tempo claro)

**Estados vazios:**
- "Nenhum retorno proposto." (não "Você nunca propôs" — sem julgamento)
- "Você está fora do alcance do paciente por aqui." (poético mas claro)

---

## PARTE 17 — RISCOS E MITIGAÇÕES (TOP 12)

### Risco 1 — Médico anexa documento no paciente errado (LGPD)

**Cenário:** Fim do dia, cansado, anexa atestado de Maria no perfil de Joana. Joana usa pra faltar do trabalho. Empresa descobre fraude.

**Severidade:** CRÍTICA (médico responde processo)

**Mitigação:**
- Modal antes de salvar: confirma nome do paciente + tipo + data em destaque grande
- Confirmação explícita exigida (clique deliberado)
- Toast Desfazer 10 segundos (mais longo que padrão)
- Após desfazer, soft-delete por 30 dias antes de purge físico

### Risco 2 — Documento sensível em bucket público (LGPD)

**Cenário:** Laudo de HIV sobe pro Supabase com URL pública. Alguém acessa URL sem login.

**Severidade:** CRÍTICA (LGPD multa pesada)

**Mitigação:**
- Bucket **estritamente privado**
- URLs assinadas com expiração 7 dias
- Endpoint valida JWT + vínculo antes de gerar URL
- Auditoria de cada acesso
- RLS Supabase como segunda camada de defesa

### Risco 3 — Médico esquece WhatsApp ativo e dorme

**Cenário:** Libera WhatsApp pós-cirurgia, esquece de fechar, paciente manda mensagem 23h, médico vê de manhã, paciente espera 8h.

**Severidade:** ALTA (responsabilidade clínica)

**Mitigação:**
- Janela TEM expiração obrigatória (mesmo no default)
- Banner matinal "Você tem WhatsApp ativo com X pacientes"
- Push notification semanal "Revisar suas janelas"
- App paciente mostra horário ativo claramente

### Risco 4 — Upload falha silencioso (repetir bug de 17/04 da pré-consulta)

**Cenário:** Médico anexa 8 MB, conexão fraca, upload trava aos 70%, app mostra "anexado", paciente nunca vê.

**Severidade:** ALTA (médico perde confiança no produto)

**Mitigação:**
- Mesma arquitetura defensiva da pré-consulta (sessão 5 do CLAUDE.md)
- HEAD request pós-upload validando arquivo no bucket
- Backend só retorna 200 quando confirma
- Frontend só limpa estado local com `documentoConfirmado: true`
- IndexedDB salva estado parcial se tab fecha

### Risco 5 — Accordion fica longo, médico não rola

**Cenário:** Paciente com 12 documentos + 2 retornos + 3 janelas WhatsApp passadas. Sub-bloco Documentos ocupa 4 telas.

**Severidade:** MÉDIA (UX degradado)

**Mitigação:**
- Default: 3 itens mais recentes + "Ver tudo"
- Histórico antigo em accordion "Arquivado"
- Mobile: cada sub-bloco vira aba horizontal
- Lazy load: itens antigos só renderizam ao expandir

### Risco 6 — Paciente clica WhatsApp fora do horário e abre mesmo assim

**Cenário:** Validação só no frontend; paciente burla via DevTools.

**Severidade:** MÉDIA (boundary violation)

**Mitigação:**
- Validação **server-side** sempre (frontend é só UX)
- App paciente nunca recebe número do médico se fora do horário
- Backend retorna `dentroDoHorario: false` → frontend esconde botão
- Auditoria continua logando tentativas mesmo se ocorrerem

### Risco 7 — Médico cancela conta com documentos pendentes

**Cenário:** Médico cancela vita id. Pacientes perdem acesso aos documentos.

**Severidade:** ALTA (impacto em pacientes)

**Mitigação:**
- Política LGPD: documentos preservados 90 dias após cancelamento
- Email para médico: "Você cancelou. Documentos preservados até [data]. Exportar tudo?"
- Email para pacientes afetados: "Seu médico cancelou. Você tem 90 dias para baixar cópias."

### Risco 8 — Receita controlada anexada como PDF não-assinado

**Cenário:** Médico anexa receita azul de Ritalina. Paciente leva à farmácia. Farmácia recusa porque falta assinatura ICP-Brasil.

**Severidade:** ALTA (paciente fica sem medicação)

**Mitigação:**
- Modal de aviso ao escolher tipo "RECEITA": "Receitas controladas exigem assinatura digital. Use Memed para essas. Esta receita simples (verde) você pode anexar."
- Não bloqueamos (médico decide), mas avisamos

### Risco 9 — Paciente confirma retorno mas não comparece

**Cenário:** Maria confirma 09/06. No dia 09/06 não aparece. Médico perde 30 min reservados.

**Severidade:** MÉDIA (impacto financeiro/agenda)

**Mitigação:**
- Lembrete automático 1 dia antes via SMS
- No dia, médico marca "Não compareceu" → estado REALIZADO_NAO_COMPARECEU
- Stat "Taxa de no-show" no Perfil → métricas honestas
- Reenvio automático de proposta após no-show (opcional)

### Risco 10 — Múltiplas sessões Claude editando simultaneamente

**Cenário:** Lucas abre Claude no notebook E no PC casa, ambos mexem em desktop/app-v2.html.

**Severidade:** CRÍTICA (perda de código)

**Mitigação:**
- Regra absoluta do CLAUDE.md
- Lock file `.editing.lock` (.claude/) sinalizando sessão ativa
- Antes de Edit, verificar arquivo não foi modificado externamente

### Risco 11 — Schema migration destrutiva (repetir incidente 17/04)

**Cenário:** Algum Claude paralelo aplica migration com `--accept-data-loss`. Dados de produção perdidos.

**Severidade:** CRÍTICA

**Mitigação:**
- Regra absoluta CLAUDE.md
- pg_dump obrigatório antes de cada migration
- Tag git pre-migration
- Aplicação manual via `railway run psql -f migration.sql` (nunca db push --accept-data-loss)
- Validação antes/depois de contagem de registros

### Risco 12 — Calendar Google API down

**Cenário:** Google API instável. Retornos confirmados não geram evento.

**Severidade:** BAIXA (degradação graceful)

**Mitigação:**
- Retry exponencial 3x
- Se falhar, toast "Retorno confirmado, mas Calendar não foi atualizado. Tente sincronizar depois."
- Botão "Adicionar agora" reaparece
- Estado salvo: `calendarPendente = true` para retry posterior

---

## PARTE 18 — MÉTRICAS DE SUCESSO POR FEATURE

### Dashboard de métricas (Perfil → Tempo & receita estende)

**Aba "Impacto das features novas" (após 30 dias de uso):**

```
📎 ANEXAR DOCUMENTOS
─────────────────────
Você anexou: 47 documentos
Visualizados pelo paciente: 38 (81%)
Tipo mais comum: Laudo (40%)
Tempo médio entre consulta e anexo: 1h22

📅 RETORNOS PROPOSTOS
─────────────────────
Você propôs: 23 retornos
Confirmados: 18 (78%)
Contrapropostas: 4 (17%)
Cancelados: 1 (5%)
Taxa de no-show: 6%

💬 WHATSAPP LIBERADO
─────────────────────
Janelas ativas: 8
Cliques de pacientes: 14
Cliques médios por janela: 1.75
% janelas que expiram com 0 cliques: 12%
```

### Health checks automáticos

**Backend job diário:**
- Validar consistência: documentos órfãos (sem paciente nem médico) → alerta
- Validar consistência: retornos confirmados sem agendamento criado → alerta
- Validar consistência: janelas WhatsApp com paciente sem conta → alerta
- Validar storage: documentos no bucket mas não no banco → alerta
- Validar storage: documentos no banco mas não no bucket → alerta

---

## PARTE 19 — ACESSIBILIDADE

### Compliance WCAG 2.1 nivel AA

**Documentos anexados:**
- Cada card de documento tem `aria-label` com tipo + nome + data + status
- Botão "Ver documento" tem `aria-describedby` com mime type + tamanho
- Player de áudio tem controles nativos (não custom)

**Retorno proposto:**
- Estados visuais não dependem só de cor (verde/amarelo/vermelho) — usar ícones também
- Datepicker acessível via teclado (setas, Enter, Esc)
- Sheet tem `role="dialog"` e foco capturado

**WhatsApp:**
- Estados A1/A2/A3 têm texto claro além da cor
- Disclaimer CFM lido por screen reader
- Botão "Abrir WhatsApp" tem label completo

### Suporte a teclado

**App médico:**
- Tab navega entre sub-blocos
- Enter abre sheet/modal
- Esc fecha sheet/modal
- Ctrl+Enter envia formulários

**App paciente:**
- Mesmo padrão, otimizado para mobile (gestos prioritários)

---

## PARTE 20 — OFFLINE, SYNC E IDEMPOTÊNCIA

### Estratégia offline

**App médico desktop:**
- Detecta offline via `navigator.onLine` + ping periódico
- Botões de ação desabilitados com tooltip "Sem conexão"
- IndexedDB local salva drafts (mensagem do retorno, configuração WhatsApp)
- Quando volta online, prompt "Tentar de novo?"

**App paciente:**
- Tela detalhe consulta funciona offline (cache do último GET)
- Documentos não carregam offline (URL assinada exige conexão)
- Push notification chega via SMS se push falhar

### Idempotência

**POST /documentos-consulta/upload:**
- Cliente envia `idempotencyKey` único (UUID gerado client-side)
- Backend rejeita duplicatas (mesma key em 24h → retorna registro existente)

**POST /retornos-agendados:**
- Mesma estratégia — idempotencyKey
- Médico clica "Enviar" 2x rapidamente → só 1 proposta criada

**PUT /retornos-agendados/:id/responder:**
- Não-idempotente por design (CONFIRMAR após CONTRAPROPOR é estado novo)
- Mas validação: se status atual ≠ "esperado", rejeita

---

## PARTE 21 — TELEMETRIA E A/B TESTING

### Eventos a rastrear

**Anexar:**
- `documento.upload.iniciado` (com tipo, tamanho)
- `documento.upload.sucesso`
- `documento.upload.erro` (com motivo)
- `documento.visualizado.medico`
- `documento.visualizado.paciente`
- `documento.apagado`

**Retorno:**
- `retorno.proposta.enviada` (com prazo escolhido)
- `retorno.proposta.confirmada` (com tempo até confirmação)
- `retorno.proposta.contraproposta` (com motivo)
- `retorno.proposta.cancelada` (por quem)
- `retorno.realizado`
- `retorno.no_show`

**WhatsApp:**
- `whatsapp.janela.liberada` (com modo, duração)
- `whatsapp.janela.encerrada` (manualmente ou expirou)
- `whatsapp.clique` (paciente, dentro ou fora do horário)

### A/B testing potencial (pós-MVP)

- Default de prazo do retorno: 30 dias vs 15 dias (qual converte mais?)
- Copy do disclaimer CFM: longo vs curto (qual reduz menos liberação?)
- Estado vazio "Documentos": com ilustração vs só texto (qual gera mais cliques?)

---

## PARTE 22 — ROLLBACK STRATEGY

### Por fase

**Se Fase 1 (Anexar) tem problema crítico:**
1. Feature flag `documentos_consulta_enabled = false` no env
2. Frontend esconde sub-bloco
3. Backend retorna 503 em /documentos-consulta/*
4. Documentos já anexados ficam no banco (não apaga)
5. Tag git rollback → revert para `pre-feature-anexar-2026-MM-DD`
6. Investigar root cause antes de re-ativar

**Se Fase 2 (Retorno) tem problema crítico:**
1. Feature flag `retornos_agendados_enabled = false`
2. Retornos já confirmados viram evento "normal" na agenda
3. Sub-bloco esconde do médico
4. Cron jobs pausados manualmente

**Se Fase 3 (WhatsApp) tem problema crítico:**
1. Feature flag `whatsapp_window_enabled = false`
2. **TODAS as janelas ativas ficam INATIVAS imediatamente**
3. App paciente esconde bloco WhatsApp
4. Disclaimer CFM mantém log de auditoria por 5 anos (não rola back)

### Rollback de schema

**Se ADD COLUMN falhou:**
```sql
ALTER TABLE medicos DROP COLUMN whatsapp_telefone;
ALTER TABLE medicos DROP COLUMN whatsapp_autorizado;
```

**Se CREATE TABLE falhou:**
```sql
DROP TABLE documentos_consulta CASCADE;
DROP TABLE retornos_agendados CASCADE;
DROP TABLE auditoria_whatsapp_clique CASCADE;
```

(Em Plan mode esses comandos não executam — apenas referência.)

---

## PARTE 23 — IMPACTO NAS HIPÓTESES NÃO VALIDADAS

Do Obsidian `HIPOTESES-NAO-VALIDADAS.md`, esta implementação testa diretamente:

| Hipótese | O que esse plano testa | Como medir |
|---|---|---|
| P1 — Paciente valoriza histórico portável | Taxa de visualização de documentos anexados | > 70% em 7 dias |
| M1 — Médico ganha 3-5 min/consulta | Tempo economizado anexar vs imprimir | A/B com grupo controle |
| M2 — Médico paga R$50-100/mês | Adoção das 3 features → upgrade pra premium | Métrica conversão |
| Pr4 — Tom acolhedor > frio | A/B de copy do SMS | CTR comparado |
| M4 — Médico SUS pode usar | Adoção entre médicos SUS | Segmento separado |
| T3 — WhatsApp/Twilio delivery <100ms | Tempo entre POST e SMS chegar | Telemetria |
| N1 — B2C2B funciona | Pacientes que trazem médicos | Tracking referral |

---

## PARTE 24 — DEPENDÊNCIAS EXTERNAS E GATES HUMANOS

### Dependências técnicas externas

| Dependência | Crítica? | Plano B |
|---|---|---|
| Supabase Storage | SIM | Local storage temporário + retry quando volta |
| Google Calendar API | NÃO | Funciona sem; só não cria evento |
| Push web do navegador | NÃO | Funciona sem; cai pra badge in-app |
| Twilio SMS | ❌ FORA DO ESCOPO | Decisão Lucas: sem SMS nesta entrega |
| Email (provedor TBD) | ❌ FASE FUTURA | Lucas escolhe provedor mais tarde |

### Gates humanos antes de cada fase

**Antes da Fase 1:**
- ✅ Confirmar 3 perguntas pendentes (Parte 27)
- ✅ Lucas aprova plano completo
- ✅ Tag git pre-feature-anexar
- ✅ pg_dump do banco produção

**Antes da Fase 2:**
- ✅ Fase 1 em produção há 7d
- ✅ Pelo menos 3 médicos reais usando Fase 1
- ✅ Feedback coletado
- ✅ Tag git pre-feature-retorno

**Antes da Fase 3:**
- ✅ Fase 2 em produção há 14d
- ✅ Pelo menos 5 retornos confirmados
- ✅ Disclaimer CFM revisado por advogado
- ✅ Tag git pre-feature-whatsapp

---

## PARTE 25 — CRITICAL FILES (arquivos a modificar)

### Backend
- `d:/vitae-app-novo/backend/prisma/schema.prisma` — adicionar models documentos_consulta, retornos_agendados, auditoria_whatsapp_clique; estender Medico
- `d:/vitae-app-novo/backend/src/services/storage.js` — NOVO arquivo, refatorar uploadExame
- `d:/vitae-app-novo/backend/src/services/notificacoes.js` — estender com templates novos
- `d:/vitae-app-novo/backend/src/services/calendar.js` — NOVO arquivo, integração Google Calendar
- `d:/vitae-app-novo/backend/src/routes/documentos-consulta.js` — NOVO arquivo, 4 rotas
- `d:/vitae-app-novo/backend/src/routes/retornos-agendados.js` — NOVO arquivo, 3 rotas
- `d:/vitae-app-novo/backend/src/routes/medico.js` — estender com PUT /whatsapp-config
- `d:/vitae-app-novo/backend/src/routes/agendamento.js` — estender GET /:id para incluir documentos+retorno+whatsapp
- `d:/vitae-app-novo/backend/src/workers/cron-retornos.js` — NOVO arquivo, jobs de expiração/realização
- `d:/vitae-app-novo/backend/src/workers/cron-whatsapp.js` — NOVO arquivo, encerrar janelas expiradas
- `d:/vitae-app-novo/backend/src/middleware/audit.js` — NOVO, log de cliques WhatsApp

### Frontend médico
- `d:/vitae-app-novo/desktop/app-v2.html` — adicionar accordion + sub-blocos + sheets + modais + estados

### Frontend paciente
- `d:/vitae-app-novo/app-v3/16-consulta-detalhe.html` — preencher 3 blocos vazios
- `d:/vitae-app-novo/app-v3/15-consultas.html` — adicionar chips de status nos cards
- `d:/vitae-app-novo/app-v3/api-real.js` — adicionar funções de chamadas novas

### Outros
- `d:/vitae-app-novo/CLAUDE.md` — atualizar com decisões da Sessão N
- `d:/vitae-app-novo/.env.example` — adicionar feature flags

---

## PARTE 26 — VERIFICATION (como testar end-to-end)

### Testes manuais por fase

**Fase 1 — Anexar mídias:**
1. Médico (test account) anexa PDF de 1 MB → ver no app paciente em < 2 min
2. Médico tenta anexar arquivo de 15 MB → ver erro amigável + opção comprimir
3. Médico anexa áudio MP3 → paciente toca no player inline → status "visto" atualiza
4. Médico apaga documento → toast Desfazer → undo funciona em < 10s
5. Paciente sem conta recebe SMS → cria conta → vê documento

**Fase 2 — Propor retorno:**
1. Médico propõe 30 dias → paciente recebe SMS → confirma → médico vê confirmação
2. Médico propõe → paciente contrapropõe → médico aceita
3. Cron testar: proposta sem resposta após 7 dias → vira EXPIRADO
4. Calendar conectado: proposta confirmada → evento criado no Google
5. Data sugerida pula sábado/domingo corretamente

**Fase 3 — Liberar WhatsApp:**
1. Médico libera janela "horário comercial 14 dias"
2. Paciente em horário comercial: vê botão → clica → wa.me abre
3. Paciente fora do horário: vê estado A2 amigável
4. Janela expira: bloco some no paciente, estado E no médico
5. Auditoria: clique registrado no log permanente

### Testes automatizados Playwright

Reutilizar padrão de `tests/run.js` da sessão 18:
- `tests/fluxo-anexar-documento.js`
- `tests/fluxo-propor-retorno.js`
- `tests/fluxo-liberar-whatsapp.js`

Cada um cobrindo golden path + 3 edge cases mínimos.

### Validação de qualidade pós-deploy

**Métricas no Sentry:**
- Taxa de erro em /documentos-consulta/upload < 1%
- Taxa de erro em /retornos-agendados < 1%
- Tempo p95 de upload < 8 segundos

**Métricas de produto:**
- Anexar: > 60% adoção em 30 dias
- Retorno: > 40% das consultas têm retorno proposto
- WhatsApp: > 30% dos retornos confirmados viram janela

---

## PARTE 27 — DECISÕES CONFIRMADAS COM O LUCAS

### Decisão 1 — Conversão de áudio M4A → MP3

✅ **CONFIRMADO: Converter no backend.**

Quando médico anexar áudio M4A (iPhone), backend converte automaticamente para MP3 via FFmpeg server-side. Paciente nunca tem problema de player em nenhum navegador. Custo: +1 dia de implementação na Fase 1.

### Decisão 2 — Tamanho máximo de arquivo

✅ **CONFIRMADO: 10 MB por arquivo.**

Cabe atestado/receita (PDF ~1 MB), áudio de 5 min (~5 MB), imagem de exame (~3 MB). Equilibra custo de storage e prática clínica real. Se mais tarde aparecer necessidade pontual de PDF maior, ajustamos.

### Decisão 3 — Canal de notificação ao paciente

✅ **CONFIRMADO: Apenas dentro do app paciente + email no futuro (fora do escopo agora).**

- **AGORA:** notificação fica dentro do próprio app paciente — badge no ícone da aba Consultas, banner na home, push web do navegador (PWA) se paciente deu permissão.
- **DEPOIS (fase futura):** Lucas vai escolher provedor de email e adicionamos email como canal universal.
- **SMS:** fora do escopo desta entrega (Lucas decidiu não usar Twilio agora — custo + complexidade).
- **WhatsApp:** continua exclusivo da Feature 3 (janela controlada).

**Implicação UX importante:** Sem SMS, o paciente "descobre" novidades **quando abre o app**. Isso exige:
1. Badge muito visível na aba Consultas (bolinha vermelha + contador)
2. Banner persistente na home (aba Saúde) com link rápido
3. Push web ativo (se PWA instalado) como notificação proativa
4. Médico pode mandar link manualmente pelo WhatsApp pessoal dele (prática já existente)

**Implicação arquitetural:** Construímos o service de notificação como abstração desde o dia 1 — quando email chegar, é só plugar sem refactor.

Ver detalhes completos em [Parte 10](#parte-10--ciclo-de-notificações).

---

## SÍNTESE EXECUTIVA (resumo em 7 linhas)

1. **3 features novas no app médico** (anexar mídias, propor retorno, liberar WhatsApp) alimentam **3 blocos vazios no app paciente v3** (documentos, retorno, conversar).
2. **Tudo mora em 1 lugar:** novo accordion **"Consulta & Retorno"** no Perfil do Paciente (aba Pacientes → coluna direita).
3. **Ordem fixa de implementação:** Anexar → Retorno → WhatsApp (justificativa: complexidade técnica + emocional crescente).
4. **Backend:** 2 tabelas novas + 1 tabela auditoria + 2 campos em medicos + 5 rotas + 1 bucket Supabase. Zero schema destrutivo.
5. **Reaproveitamento maciço:** 70% dos componentes visuais e técnicos já existem (dropzone, modal, sheet, badge, datepicker, toggles).
6. **Custo estimado:** ~26 dias úteis em 3 fases sequenciais (~30-35 dias considerando ajustes).
7. **Risco controlado:** cada fase tem rollback via feature flag + tag git. Cada feature pode ser desligada em produção em < 5 min.

---

## PRÓXIMO PASSO CONCRETO

Lucas, este plano está pronto pra execução. Antes de eu sair do plan mode, preciso da sua resposta às **3 perguntas da Parte 27**:
1. Converter áudio M4A → MP3 no backend? (recomendo SIM)
2. Tamanho máximo 10 MB? (recomendo SIM)
3. Notificação por SMS + push (sem email/WhatsApp)? (recomendo SIM)

Com essas 3 confirmadas, Fase 1 pode começar em sessão seguinte com o pé direito.

**Lembrete operacional:** este plano NÃO foi implementado. Estamos em Plan Mode — apenas pesquisa profunda e este documento. Nenhuma linha de código foi escrita, nenhum schema foi tocado, nenhum deploy foi feito.

---

*Plano gerado a partir de 3 agentes paralelos (Anatomia app médico, Médico como pessoa, Contrato técnico paciente) + 1 Plan agent sintetizador + leitura crítica do `16-consulta-detalhe.html`. Densidade alta por pedido explícito do Lucas: "pensar em literalmente tudo".*
