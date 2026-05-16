# 🏠 HANDOFF PARA O PC DE CASA — 15/MAI/2026 (NOITE)

> Você está chegando do notebook da faculdade. Trabalhamos hoje à noite no PLANEJAMENTO E PREVIEW VISUAL das 3 features novas do app médico desktop. **Nada foi implementado em produção** — só plano + preview HTML pra você aprovar.

---

## 📋 PROMPT DE ENTRADA (cola isso no Claude do PC casa)

```
Oi Claude. Estou retomando o vita id no PC de casa, continuando do notebook da faculdade da noite de 15/mai.

ANTES DE QUALQUER COISA, leia NESSA ORDEM:

1. d:\vitae-app-novo\HANDOFF-PC-CASA-15-MAI-NOITE.md  (ESTE arquivo — contém tudo da sessão de hoje noite)
2. d:\vitae-app-novo\docs\PLANO-MESTRE-3-FEATURES-MEDICO.md  (plano completo de 27 partes — bíblia da feature)
3. d:\vitae-app-novo\CLAUDE.md  (regras absolutas do projeto)
4. C:\Users\valve\.claude\projects\d--\memory\MEMORY.md  (memória global — se existir no PC casa)

DEPOIS DE LER:
- Abra http://localhost:3000/desktop/preview-real-acordeon.html (precisa rodar `node serve.js` na pasta vitae-app-novo)
- Navegue: aba Pacientes → clique em Maria Silva → veja o accordion "Consulta & Retorno"
- Troque entre versões A/B/C usando a barra preta no topo
- Me diga qual versão segue (A, B, C, ou misturar elementos)

DEPOIS DA SUA DECISÃO:
- Implementaremos o accordion DE VERDADE no desktop/app-v2.html, seguindo a versão escolhida
- Backend: 2 tabelas novas + 2 campos em Medico + 5 rotas + bucket Supabase
- Frontend paciente v3: preencher 3 blocos vazios na tela detalhe consulta

REGRAS ABSOLUTAS (do CLAUDE.md, releia se esquecer):
- NUNCA git push sem minha autorização explícita
- NUNCA db push ou --accept-data-loss (incidente 17/04 destruiu dados)
- NUNCA múltiplas sessões Claude no mesmo projeto
- NUNCA mencionar "IA"/"inteligência artificial" em copy
- Antes de qualquer mudança no schema do banco, pedir confirmação
```

---

## 🎯 O QUE FOI FEITO ESTA NOITE (15/MAI 16h-23h, notebook faculdade)

### Etapa 1 — Plano massivo profissional
Você pediu pra eu **estudar profundamente** antes de implementar. Lancei 3 agentes Explore em paralelo + 1 Plan agent sintetizador:
- **Agente A** — mapeou anatomia completa do app médico desktop (`desktop/app-v2.html`, 6446 linhas)
- **Agente B** — vasculhou Obsidian Vault sobre as 7 personas médicas, frustrações, objeções, princípios UX
- **Agente C** — mapeou contrato técnico do app paciente v3 (que dado os 3 blocos vazios esperam)
- **Plan agent** — consolidou tudo num plano de 27 partes

Resultado: **`docs/PLANO-MESTRE-3-FEATURES-MEDICO.md`** — 27 partes, ~88 KB, em PT-BR humano sem código.

### Etapa 2 — Decisões confirmadas com você
Via AskUserQuestion (3 perguntas):
1. ✅ Áudio M4A → MP3 **converter no backend** (FFmpeg server-side)
2. ✅ Tamanho máximo: **10 MB** por arquivo
3. ✅ Notificação ao paciente: **apenas in-app + email no futuro** — SEM SMS, SEM WhatsApp pra notificar anexo (WhatsApp continua exclusivo da Feature 3 com janela controlada)

### Etapa 3 — Preview visual aprovado
Lucas pediu ver as 3 versões **dentro do app real**, não em documento separado.

Construído: **`desktop/preview-real-acordeon.html`** — cópia do `app-v2.html` (6888 linhas) com:
- Bypass de auth (popula token+usuário fake no localStorage)
- Mock de paciente Maria Silva no topo da lista
- Mock de timeline com 3 anamneses (fev/abr/hoje) + IA Collab comparativo
- Barra preta fixa no topo com 3 botões: **A · Linear+Notion | B · Stripe+Apple | C · vita id atual**
- Accordion "Consulta & Retorno" injetado no perfil do paciente via hook em `renderPacienteDetailInline`
- Troca de versão sem reload (toggle de classe `.acc-vA/.acc-vB/.acc-vC` no body)

### Etapa 4 — Preview comparativo em documento (backup)
Também construído: **`preview-accordion-medico.html`** — versão standalone que mostra as 3 versões lado a lado em colunas + galeria de 17 estados (vazio/ativo/erro/modais/sheets). Útil pra comparação direta, mas o **principal é o preview-real-acordeon.html** porque vive dentro do contexto do app médico de verdade.

### Etapa 5 — Pesquisa de referências de design
Instalada coleção de DESIGN.md (68 design systems prontos):
- Repositório clonado em: `C:\Users\valve\.claude\projects\d--\design-refs\awesome-design-md\`
- Lidos: Linear, Notion, Stripe, Apple (suficiente pra construir as 3 versões)
- Não precisei ler Vercel/Figma — já tinha contexto suficiente

---

## 📁 ARQUIVOS QUE VOCÊ PRECISA ABRIR (NA ORDEM)

### 1️⃣ Este handoff (você está lendo)
[d:\vitae-app-novo\HANDOFF-PC-CASA-15-MAI-NOITE.md](HANDOFF-PC-CASA-15-MAI-NOITE.md)

### 2️⃣ Plano mestre completo (a bíblia das 3 features)
[d:\vitae-app-novo\docs\PLANO-MESTRE-3-FEATURES-MEDICO.md](docs/PLANO-MESTRE-3-FEATURES-MEDICO.md)
> 27 partes, ~88 KB. Lê inteiro se tiver paciência (~30 min). Mínimo: leia o Índice + Parte 0 (Contexto) + Parte 1 (Tese) + Parte 27 (Decisões confirmadas).

### 3️⃣ Preview real do app médico com toggle A/B/C
**Como rodar:**
```bash
cd d:/vitae-app-novo
node serve.js
# Se "EADDRINUSE: address already in use" significa que já tá rodando
```
**Como abrir:** http://localhost:3000/desktop/preview-real-acordeon.html

**Como usar:**
- Espera o app carregar (login bypassed automático)
- Clica em **Pacientes** no menu esquerdo
- Clica em **Maria Silva** (no topo da lista)
- Painel direito mostra accordion "Consulta & Retorno" já aberto
- Barra preta no topo: clica nos botões A/B/C pra trocar estilo na hora
- Botão "Voltar ao app real" volta pro app-v2.html original

### 4️⃣ Preview comparativo standalone (backup)
[d:\vitae-app-novo\preview-accordion-medico.html](preview-accordion-medico.html)
**Como abrir:** clica duas vezes no arquivo OU http://localhost:3000/preview-accordion-medico.html
> Mostra as 3 versões lado a lado + galeria com 17 estados (vazio/ativo/erro/modais/sheets). Útil pra comparar detalhes finos.

### 5️⃣ Regras absolutas do projeto
[d:\vitae-app-novo\CLAUDE.md](CLAUDE.md)
> Lê especialmente: seção 3 (REGRAS ABSOLUTAS — banco, design, tom de voz), seção 9 (DIÁRIO DE SESSÕES — leia sessões 19-23 pra contexto do app paciente v3).

---

## 🎯 PRÓXIMO PASSO CONCRETO (DEPOIS QUE VOCÊ DECIDIR A/B/C)

1. **Você abre o preview** e decide qual versão visualmente: **A · Linear+Notion**, **B · Stripe+Apple**, **C · vita id atual** ou "**misturar elementos**" (ex: estrutura da C com tipografia da A).

2. **Diz pro Claude do PC casa:** "Decidi versão X. Implementa de verdade no app-v2.html."

3. **Claude implementa em sequência:**
   - **Fase 1 — Anexar mídias** (~7 dias úteis):
     - Backend: tabela `documentos_consulta` + bucket Supabase + 4 rotas + service de storage
     - Frontend médico: accordion "Consulta & Retorno" no perfil + sub-bloco Documentos com dropzone + modal "Que tipo é?"
     - Frontend paciente v3: bloco "Documentos da médica" preenchido no `16-consulta-detalhe.html` + chip no card da aba Consultas
   - **Fase 2 — Propor retorno** (~11 dias, depende da Fase 1 estar 7 dias em produção): tabela `retornos_agendados` + 3 rotas + sub-bloco Retorno (5 estados) + integração Google Calendar
   - **Fase 3 — Liberar WhatsApp** (~8 dias, depende da Fase 2 estar 14 dias em produção): campos `whatsapp_*` em Medico + tabela `auditoria_whatsapp_clique` + 1 rota + sub-bloco WhatsApp (6 estados) + disclaimer CFM

4. **Antes de cada fase:** pg_dump do banco + tag git pre-feature + autorização explícita sua.

---

## 🧠 CONTEXTO DENSO — O QUE PRECISAMOS RESOLVER

### Problema central
App paciente v3 está 95% pronto, mas tem **3 blocos visuais vazios** na tela detalhe de consulta (`app-v3/16-consulta-detalhe.html`) porque o médico não tem onde criar esses dados:

| Bloco vazio no paciente | Pergunta que o app não responde |
|---|---|
| **Documentos da médica** | "Onde está meu laudo / atestado / receita?" |
| **Retorno proposto** | "Quando minha médica quer me ver de novo?" |
| **Conversar pelo WhatsApp** | "Posso falar com ela fora da consulta?" |

### Solução decidida
Um único **accordion novo "Consulta & Retorno"** no perfil do paciente do app médico, com 4 sub-blocos:
1. Próxima pré-consulta (já existe parcialmente, só consolida)
2. Retorno agendado (NOVO)
3. Documentos anexados (NOVO)
4. Contato WhatsApp (NOVO)

### Onde mora exatamente
**Aba Pacientes → clica no nome → painel direito → último accordion**

Reaproveitamento: 70% dos componentes visuais e técnicos já existem no app (dropzone, modal, sheet, datepicker, badge, animação).

### O que muda no backend
- 2 tabelas novas: `documentos_consulta`, `retornos_agendados`
- 1 tabela auditoria: `auditoria_whatsapp_clique` (retenção 5 anos CFM 2.314/2022)
- 2 campos novos em Medico: `whatsapp_telefone`, `whatsapp_autorizado` (JSON array)
- 5 rotas novas (1 upload, 2 retornos, 1 whatsapp-config, 1 GET estendido)
- 1 bucket Supabase Storage: `documentos-consulta` (privado, URL assinada 7d)
- Zero schema destrutivo (só ADD, nunca DROP/RENAME)

### O que muda no app paciente v3
- 3 blocos vazios preenchidos em `16-consulta-detalhe.html`
- Chips de status nos cards da aba Consultas (`15-consultas.html`)
- Player inline para áudios
- Estados vazios pensados com copy acolhedor

### O que NÃO entra nesta entrega
- SMS (Twilio fora do escopo agora)
- Email (você decide provedor depois — última coisa)
- WhatsApp pra notificar anexo (WhatsApp é exclusivo da Feature 3 com janela)
- Telemedicina, prescrição eletrônica, modo cuidador, premium

---

## 🚦 ESTADO DO PROJETO HOJE

| Camada | Status |
|---|---|
| Backend Railway | Pronto e estável. **Não mexer** sem autorização. |
| App médico desktop (`desktop/app-v2.html`) | Pronto, 6446 linhas. **Não mexido nesta sessão.** |
| App paciente v3 (`app-v3/`) | 95% pronto, em produção em https://vitae-app.vercel.app/app-v3/app.html. 3 blocos vazios na consulta-detalhe. |
| Plano das 3 features novas | ✅ Aprovado em 15/mai (você). Arquivo: `docs/PLANO-MESTRE-3-FEATURES-MEDICO.md` |
| Preview visual 3 versões | ✅ Pronto. Aguardando você decidir A/B/C. |
| Implementação real | ⏸️ Bloqueada até você decidir A/B/C. |

---

## 📐 RESUMO DAS 3 VERSÕES VISUAIS DO ACCORDION

### Versão A · Linear + Notion
- **Tom:** Precisão (Linear: hairline borders, tipografia ajustada) + calor (Notion: cards papel, paleta suave)
- **Cor primária:** Lavender `#5e6ad2` (Linear)
- **Fonte:** Inter weight 500-600 com letter-spacing negativo
- **Cards:** border-radius 8px, hairline 1px `#ede9e4`
- **Vibe:** "limpo, moderno, software de craft" (Linear vibe)
- **Pra quem:** dev/tech-savvy. Helena (premium) pode achar "frio demais"
- **Custo de implementação:** alto (mais retrabalho de CSS — não bate com tokens atuais do app)

### Versão B · Stripe + Apple
- **Tom:** Premium (Stripe: weight 300 elegante, gradients atmosféricos) + serenidade (Apple: white space generoso, action blue)
- **Cor primária:** Indigo `#533afd` (Stripe) com toques de Action Blue `#0066cc` (Apple)
- **Fonte:** Inter weight 300 com negative letter-spacing forte
- **Cards:** border-radius 12-14px, gradients sutis no topo
- **Vibe:** "premium financeiro, museu Apple" (sério, ostentação contida)
- **Pra quem:** Beatriz (especialista premium), Helena. Pode soar "startup chique demais" no contexto médico.
- **Custo de implementação:** alto-médio

### Versão C · vita id atual estendido (RECOMENDADO)
- **Tom:** Exatamente os tokens do app médico em produção. Zero estranheza, zero retrabalho.
- **Cor primária:** Gradient verde→ciano `#00E5A0 → #00B4D8` (vita id)
- **Fonte:** Plus Jakarta Sans (já no app)
- **Cards:** border-radius 14px, border 1px `var(--border)`, padrão de `insight-card` com border-left colorida
- **Vibe:** "continuidade visual do que você já usa todo dia"
- **Pra quem:** todas as 7 personas. Médico que já usa o app não vai sentir nada de estranho.
- **Custo de implementação:** baixo (reutiliza tudo)

**Minha recomendação técnica:** **Versão C**. Mas você é o CEO e sente o que combina com a marca vita id melhor que eu.

---

## 🛠️ COMANDOS ÚTEIS

```bash
# Rodar servidor local (preview + app real)
cd d:/vitae-app-novo
node serve.js

# Abrir preview real
start http://localhost:3000/desktop/preview-real-acordeon.html

# Abrir app real (sem mock, requer login)
start http://localhost:3000/desktop/01-login.html

# Ver status git
git status

# Ver últimos commits
git log --oneline -10

# Sincronizar com GitHub (se outro PC subiu coisa nova)
git pull origin main
```

---

## 🗂️ DESIGN REFERENCES (PASTAS LOCAIS)

Coleção de DESIGN.md baixada:
```
C:\Users\valve\.claude\projects\d--\design-refs\awesome-design-md\design-md\
├── linear.app/DESIGN.md       ← Linear (DARK, precision)
├── notion/DESIGN.md           ← Notion (light, warm)
├── stripe/DESIGN.md           ← Stripe (premium, weight 300)
├── apple/DESIGN.md            ← Apple (action blue, white space)
├── vercel/DESIGN.md           ← (lido, não usado nessa rodada)
├── figma/DESIGN.md            ← (lido, não usado nessa rodada)
└── ... 62 outros brands       ← (Cursor, Supabase, Intercom, Airbnb, Spotify...)
```

Esse repositório existe **só no .claude/projects/d--/design-refs/** — não foi commitado no repo do vita id (refs externas).

Repos clonados:
- [VoltAgent/awesome-claude-design](https://github.com/VoltAgent/awesome-claude-design)
- [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)

---

## 🔍 PERGUNTAS QUE VOCÊ PODE ME FAZER NO PC CASA

- **"O accordion da versão C tá ok visualmente, vamos implementar"** → Eu começo Fase 1 (anexar mídias)
- **"Mistura: estrutura C com cor da B"** → Eu ajusto e te mostro de novo
- **"Tem alguma versão D que misture o melhor de tudo?"** → Posso construir
- **"Não decidi ainda, quero ver as 3 mais um tempo"** → Sem pressa, deixa o preview rodando
- **"Pula o accordion e vai direto pro backend"** → Posso, mas você não vai aprovar UX antes do código existir (risco alto)

---

## ✅ CHECKLIST PRA VOCÊ NO PC CASA

- [ ] Sincronizar repo: `git pull origin main` em `d:\vitae-app-novo\`
- [ ] Ler este arquivo (você está lendo agora)
- [ ] Abrir o plano mestre: `docs/PLANO-MESTRE-3-FEATURES-MEDICO.md`
- [ ] Rodar `node serve.js`
- [ ] Abrir http://localhost:3000/desktop/preview-real-acordeon.html
- [ ] Ir em Pacientes → Maria Silva → ver accordion
- [ ] Clicar nos botões A/B/C no topo, comparar
- [ ] Abrir preview comparativo standalone: http://localhost:3000/preview-accordion-medico.html (3 colunas + 17 estados)
- [ ] **Decidir: A, B, C, ou misturar**
- [ ] Avisar pro Claude do PC casa qual escolheu
- [ ] Implementar de verdade (Fase 1 — Anexar mídias primeiro)

---

## 🧭 ROADMAP DEPOIS DA SUA DECISÃO

```
Semana 1 (após decidir)  → Fase 1: Anexar mídias (~7 dias úteis)
                          ├─ Backend (2d): tabela + bucket + rotas + service storage
                          ├─ Frontend médico (3d): accordion + sub-bloco docs
                          ├─ Frontend paciente v3 (1d): bloco "Documentos da médica"
                          └─ Testes E2E (1d): Playwright + bate-bate manual
                          
Semana 2-3               → Fase 2: Propor retorno (~11 dias úteis)
                          ├─ Pré-req: Fase 1 em produção há 7+ dias
                          ├─ Backend (3d): tabela + rotas + cron + Google Calendar
                          ├─ Frontend médico (4d): sheet + 5 estados
                          ├─ Frontend paciente v3 (2d): bloco retorno + chip
                          └─ Testes E2E (2d)
                          
Semana 4-5               → Fase 3: Liberar WhatsApp (~8 dias úteis)
                          ├─ Pré-req: Fase 2 em produção há 14+ dias
                          ├─ Backend (2d): campos + tabela auditoria + rota
                          ├─ Frontend médico (3d): sheet + 6 estados + disclaimer CFM
                          ├─ Frontend paciente v3 (1d): bloco "Falar com sua médica"
                          └─ Testes E2E (2d)
                          
Total estimado: ~26 dias úteis (~30-35 dias considerando ajustes e betatest)
```

---

## 💾 ARQUIVOS NOVOS COMMITADOS NESTA SESSÃO

1. `HANDOFF-PC-CASA-15-MAI-NOITE.md` (este arquivo)
2. `docs/PLANO-MESTRE-3-FEATURES-MEDICO.md` (plano de 27 partes, ~88KB)
3. `preview-accordion-medico.html` (preview standalone, 3 colunas + galeria de 17 estados, 1447 linhas)
4. `desktop/preview-real-acordeon.html` (preview dentro do app real com toggle A/B/C, 6888 linhas — cópia do app-v2.html com injeções)

Nenhum arquivo de PRODUÇÃO foi modificado nesta sessão. Tudo é preview/planejamento.

---

## 🚨 LEMBRETES IMPORTANTES

1. **NÃO mexa em `desktop/app-v2.html`** sem antes você decidir A/B/C
2. **NÃO faça migration no banco** sem pg_dump + tag git + sua autorização explícita
3. **NÃO abra duas sessões Claude no mesmo projeto** (incidente 17/04 destruiu dados)
4. **NÃO commita** sem antes você ler o que vai subir
5. **Use o Claude do PC casa SOZINHO** durante essa fase (não me deixa rodando no notebook ao mesmo tempo)

---

*Bom trabalho. Te vejo do outro lado da escolha A/B/C/misturar.* 🌱
