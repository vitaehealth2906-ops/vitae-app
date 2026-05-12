# vita id — Design Strategy v4
## Síntese de pesquisa profunda (12 agentes, 11 mai 2026)

> Documento pra Lucas validar ANTES de construir. Cada decisão tem origem em pesquisa real (Einstein, Sírio, gov.br, Apple Health, Whoop/Oura, Stripe/Linear, Notion). URLs no doc original de cada agente.

---

## 1. POSICIONAMENTO VISUAL (a tese)

> **"vita id parece que o Governo Federal de 2030 contratou a Stripe pra redesenhar a CNH Digital — autoridade brasileira + execução premium internacional."**

Não é healthtech jovem (Nubank/Hims).
Não é fintech vibrante (Memed/Revolut).
Não é gov.br lento (ConecteSUS).
Não é hospital empresarial sóbrio puro (Einstein/Sírio).

É a **interseção dos quatro**: a alma de documento oficial brasileiro + a execução visual da Apple Wallet + a densidade clínica do MyChart + o silêncio premium do One Medical.

---

## 2. AS 7 FEATURES HERO (que Lucas confirmou)

Ordem de protagonismo:

1. **RG da Saúde (cartão)** — artefato central, ID do produto
2. **QR Code para médico/socorrista** — momento de máximo valor (emergência)
3. **Exames** — organização + entendimento em PT-BR simples
4. **Alergias** — destaque vermelho no RG público, life-saving
5. **Medicamentos** — lista de uso contínuo + cruzamento com alergias
6. **Pré-consulta** — paciente chega pronto, médico recebe briefing
7. **Linha do tempo** — histórico médico cronológico (consultas + exames + diagnósticos + vacinas)

Outras features (premium, ajustes, dados pessoais, etc.) ficam **secundárias e escondidas**.

---

## 3. MODELO DE NAVEGAÇÃO (decisão crítica)

### Escolhido: **HUB + SHEET VERTICAL** (combo Apple Wallet + Carteira Trabalho Digital)

**Por quê:** brasileiro lê cartão digital como "documento oficial". Tab bar transformaria o RG num app de delivery. O cartão é o produto, não o menu.

### Estrutura única — não há "5 telas paralelas"

```
┌──────────────────────────────────────┐
│  HEADER FINO (56px)                  │
│  Avatar pequeno + saudação           │
│  Ícone QR (emergência sempre vis.)   │
├──────────────────────────────────────┤
│                                      │
│  CARTÃO HERO — RG DA SAÚDE           │
│  (320-360px altura, aspect 1.585:1)  │
│  Foto + Nome + Sangue GIGANTE        │
│  Alergias críticas em vermelho       │
│  QR de validação no canto            │
│  Tap → flip 3D pro verso             │
│                                      │
├──────────────────────────────────────┤
│  CTA PRÉ-CONSULTA (condicional)      │
│  Só aparece se consulta em 48h       │
├──────────────────────────────────────┤
│  3 CHIPS HORIZONTAIS                 │
│  Alergias 3 · Meds 5 · Condições 2   │
├──────────────────────────────────────┤
│  EXAMES RECENTES (2-3 cards)         │
├──────────────────────────────────────┤
│  LINHA DO TEMPO (preview 2-3 itens)  │
├──────────────────────────────────────┤
│  Editar perfil · Compartilhar        │
└──────────────────────────────────────┘
   (sem tab bar)
```

**Navegação secundária:** tudo abre como **bottom sheet** vindo de baixo (Notion-style). Volta exatamente onde o usuário parou na home. Sem perder contexto.

**Atalhos cross-feature:** ícone QR no header está SEMPRE acessível, em qualquer tela. É o equivalente do "shake to send" da Apple — a função vital nunca está enterrada.

---

## 4. DESIGN TOKENS DEFINITIVOS

### Tipografia
- **UI/Body:** IBM Plex Sans (variable, free, OFL)
- **Display/Headers grandes:** Newsreader (serif editorial, free, OFL)
- **Dados clínicos numéricos:** IBM Plex Mono (CPF, IDs, valores tabulares)

Justificativa: IBM Plex carrega "DNA institucional crítico" (saúde, banco, gov). Newsreader injeta autoridade editorial Einstein/Sírio sem cair em serif-clínica-velha. Plex Mono parea perfeito (mesma família).

### Cores — evolução vita id

| Token | Antes | Depois | Por quê |
|---|---|---|---|
| Verde primário | `#00E5A0` | `#00B377` | Sai de neon-AI pra jade-clínico |
| Verde escuro | — | `#006B4A` | Hover/texto sobre verde-soft |
| Verde soft | — | `#D6F1E5` | BG sucesso |
| Teal acento | `#00B4D8` | `#1A8FA8` | Sai de fintech-vibrante pra teal-hospitalar |
| Dark warm | `#0D0F14` | `#0A1F1C` | Sai de preto-terminal pra dark verde-petróleo |
| Background | `#FFFFFF` | `#FAFAF7` | Off-white quente, não Google Doc puro |
| Texto primário | `#0D0F14` | `#0F1A1A` | Mesmo percepção, sem viés cyan frio |
| Borda | `#E5E5E5` | `#E5E3DC` | Quente combina com bg quente |
| Warning | (amarelo Post-it) | `#C77A1F` | Âmbar terracotta dessaturado |
| Danger | (vermelho neon) | `#B83A3A` | Vermelho-tijolo institucional |
| Gold premium | — | `#A88A3D` | Selo verificação (não amarelo carnaval) |

### Regras de cor (60-30-10)
- **60% off-white/cream/branco** (a marca é o silêncio visual)
- **30% neutros escuros e cinzas** (texto, ícones, bordas)
- **10% cor da marca + semânticas** (acentos, CTAs, status)

### Gradient: PROIBIDO em UI
Único uso permitido: gradient sutilíssimo `verde→teal` em hero de landing marketing, 15% opacidade. Dentro do app: **zero**.

### Iconografia
- **Base:** Phosphor Icons (Regular weight, 1.5px stroke, 9k+ ícones, MIT)
- **Médicos específicos:** Healthicons.org (gota com tipo sanguíneo, vacinas, OMS-grade)
- **5 ícones autorais custom:** logo vita id, selo verificado, cartão RG, selo nível 0-5, ícone família

**Regra:** stroke fixo 1.5px, single color (currentColor), nunca duotone, ativo de navegação vira `fill` (mesma família, peso diferente).

### Sombras (estratificadas, tinted)
```css
--shadow-rest:
  0 1px 2px rgba(15, 26, 26, 0.04),
  0 1px 3px rgba(15, 26, 26, 0.06);
--shadow-hover:
  0 2px 4px rgba(15, 26, 26, 0.05),
  0 8px 16px rgba(15, 26, 26, 0.08);
--shadow-pressed:
  0 1px 1px rgba(15, 26, 26, 0.06);
--shadow-modal:
  0 4px 8px rgba(15, 26, 26, 0.06),
  0 24px 48px rgba(15, 26, 26, 0.12);
```

Tinted com viés verde-petróleo da marca. **Sombras pretas puras = cara de IA.**

### Border-radius (VARIA, não uniforme)
- Cards: 14px
- Botões: 10px
- Inputs: 10px
- Modal/sheet topo: 24px
- Avatar: 50% (full circle)
- Pills/badges: 999px
- Chip pequeno: 6px

A variação é o que cria hierarquia — não 12px em tudo.

---

## 5. O CARTÃO RG DA SAÚDE — anatomia

Esse é **o produto**. Premium hospitalar + documento oficial brasileiro.

```
┌────────────────────────────────────────┐
│ vita id            🛡 Verificado  ◆◆◆ │ ← Logo + selo + marca d'água
│                                        │
│  ╭───╮  LUCAS BORELLI                  │ ← Foto + nome 24px peso 700
│  │ L │  18 anos · Masc                 │
│  ╰───╯  VI-2026-A7F3-B2K9              │ ← ID único monoespaçado
│                                        │
│           ┌───────┐                    │
│           │  A+   │ ← Tipo sanguíneo   │
│           └───────┘    56-72px peso 800│
│                                        │
│  ⚠ ALERGIA: Penicilina, Dipirona       │ ← Faixa vermelha (#B83A3A)
│                                        │
│  Hipertensão · Em tratamento           │ ← Condição (texto neutro)
│                                        │
│  Emitido em 11 mai 2026 ▣ QR          │ ← Validade + QR 110×110
│  Válido até 11 nov 2026                │
└────────────────────────────────────────┘
```

### Acabamento (anti-flat)
- **Gradient base:** jade-petróleo escuro `#0A1F1C → #134039 → #0F2A28` na diagonal
- **Textura:** noise/grain 2% opacity (evita flat AI-look)
- **Sombra dupla:** próxima `0 1px 3px` + distante `0 20px 60px` tinted verde-petróleo
- **Marca d'água:** monograma "VI" repetido diagonal 30°, 4% opacity
- **Holograma sutil:** gradient cônico iridescente nas bordas (verde/teal) que reflete no toque
- **Aspect ratio:** 1.585:1 (ISO/IEC 7810 ID-1 — padrão internacional de cartão)

### Animação
1. **Mount inicial:** scale 0.85→1.0 + translateY 20px→0, 500ms spring
2. **Parallax no scroll:** desloca 0.5x do scroll geral (mais lento que conteúdo)
3. **Brilho ao tocar:** gradient branco translúcido varre da esquerda → direita, 800ms
4. **Flip 3D (toque duplo):** rotateY 180deg, 600ms cubic-bezier, mostra verso (histórico + emergência)
5. **Tilt giroscópio (long press):** acompanha inclinação ±15°, holograma se move
6. **Long-press:** expande pra tela cheia (modo "mostrar pro médico"), QR fica gigante

---

## 6. AS 7 TELAS PRINCIPAIS (sem cadastro/onboarding)

Telas que importam, fora do login/quiz:

### 1. HOME (a estrela)
Cartão hero + 4 seções verticais como descrito acima.

### 2. CARTÃO RG FULLSCREEN (toque longo)
Cartão ocupa 90% da tela. QR em destaque. Brilho 100% forçado.

### 3. EXAMES (lista + detalhe)
- Lista cronológica reversa, agrupada por mês
- Cada exame: nome + data + lab + status badge (Normal/Atenção/Crítico)
- Detalhe: valor GIGANTE (48-56px) + range bar horizontal + gráfico histórico minimalista + interpretação leiga
- Cor warning âmbar `#C77A1F` (não laranja iOS), nunca vermelho fora de alergia/emergência

### 4. ALERGIAS & CONDIÇÕES
- Card de aviso topo com border-left bad
- Severidade tripla: Leve (amarelo) / Moderada (âmbar) / Grave (vermelho-tijolo)
- Cada alergia: substância + reação + última vez + fonte

### 5. MEDICAMENTOS
- Calendário horizontal 7 dias (hoje destacado)
- Lista "EM USO" + lista "HISTÓRICO"
- Por med: dose + frequência + prescritor + estoque + cruzamento com alergias
- Adesão mensal sutil no rodapé

### 6. LINHA DO TEMPO MÉDICA (a nova feature crítica)
- Timeline vertical Stripe-style
- Dots coloridos por categoria (consulta=verde-sálvia, exame=azul-petróleo, receita=âmbar, alergia=vermelho-terracota, vacina=verde-musgo, cirurgia=bordô)
- Linha conectora 2px cinza-200
- Cards com ícone + data + título + resumo + CTA "Ver"
- Sticky headers por mês (ou ano se 3+ anos)
- Chips de filtro: Tudo · Consultas · Exames · Receitas · Vacinas · Alergias
- Eventos críticos pinados no topo numa seção "Importantes"
- Scrubber lateral pra navegação rápida em históricos longos

### 7. QR FULLSCREEN (modo emergência)
- Fundo branco puro (#FFFFFF — overrides bg cream)
- Header jade vita id
- Foto + nome + tipo sanguíneo + alergia crítica
- QR 280×280
- Timer "Expira em XX:XX" — regenera token a cada 60s
- Detecção de screenshot bloqueia
- Push notification pro paciente quando alguém escaneia

---

## 7. RG PÚBLICO (a tela que o médico vê após escanear)

Aberto como **web** (não app), em `vita.id/v/[token]`. Médico não precisa instalar nada.

**Hierarquia clínica brutal:**
1. Header jade vita id + selo "✓ Identificação verificada"
2. **Foto + Nome 32px + Idade + O+ + "Doador: Sim"**
3. **CARD VERMELHO DE ALERTA** (se houver alergia grave) — border-left 4px, texto vermelho, "⚠ ATENÇÃO MÉDICA CRÍTICA"
4. **Confirmação profissional (modal)** — médico digita CRM antes de ver histórico completo (LGPD)
5. Condições crônicas + CID-10
6. Meds em uso contínuo
7. Cirurgias recentes (últimos 12 meses)
8. **Contato emergência com botão "Ligar" verde** (tap-to-call)
9. Médico responsável (se cadastrado)

**Audit trail invisível:** IP, geo (cidade), timestamp, CRM digitado. Tudo logado em banco WORM (write-once-read-many). Paciente recebe push: "Seu vita id foi acessado por Dr. X (CRM Y) às HH:MM em [cidade]."

---

## 8. MICROINTERAÇÕES (anti-cara-de-IA)

### As 12 regras absolutas

1. **Sombras 2-camadas tinted** (verde-petróleo, nunca preto puro)
2. **Easings cubic-bezier custom** (nunca `ease`/`ease-in-out` padrão):
   - `--ease-standard: cubic-bezier(0.25, 0.46, 0.45, 0.94)`
   - `--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)` — botões, toggles
   - `--ease-apple: cubic-bezier(0.32, 0.72, 0, 1)` — modais
3. **5 estados em todo componente** (rest, hover, focus, pressed, disabled)
4. **Focus ring 2-4px** com cor primary + offset branco (acessibilidade)
5. **Pressed: scale 0.97 + sombra reduzida** em 80-120ms
6. **Stagger animation** em listas (30-50ms entre itens)
7. **Skeleton que espelha conteúdo** (não spinner genérico)
8. **Toasts de baixo no mobile**, spring entrada
9. **Haptic seletivo** (success/error/medium/light)
10. **Numbers count-up** em métricas grandes (dashboard, score)
11. **Empty states com copy custom + CTA** (nunca "ainda não há dados")
12. **Border-radius VARIA por componente** (14/10/24/999 não tudo 12px)

### Stack técnico
- **CSS puro + Web Animations API** (não Framer Motion — desnecessário pra PWA)
- Lottie só pra empty states ilustrados, máximo 1-2 telas
- Tokens em CSS variables (`--ease-*`, `--shadow-*`)

---

## 9. COPY (tom de voz)

### Princípios
- **Formal-acolhedor** (Einstein/Sírio): "Seu exame está pronto" (não "Foi liberado pelo sistema")
- **Sem "IA" jamais** (regra Lucas + CFM 2.454/2026 compliance)
- **Sem jargão médico** sem explicar
- **Frases curtas, presente afirmativo**
- **"Você" sempre** (não "o senhor/a senhora")
- **Nunca julga, sempre convida**

### Exemplos
| Pior | Melhor |
|---|---|
| "Você esqueceu sua medicação" | "O remédio das 14h ainda está esperando" |
| "Erro ao salvar" | "Não conseguimos salvar — tenta de novo?" |
| "Selecione a opção desejada" | "O que você quer fazer agora?" |
| "Documento liberado pelo sistema" | "Seu exame chegou" |
| "Out of range" | "Levemente acima do esperado" |
| "Vacina aplicada com sucesso" | "Vacina registrada · próxima em out/2026" |
| "Nenhum dado encontrado" | "Sua linha do tempo começa hoje" |

### Microcopy em momentos críticos
- **Resultado alterado:** "Vale conversar com seu médico — não é urgente."
- **Alergia detectada via scan:** "Encontrei isso na sua receita. Confirma?"
- **Pré-consulta enviada:** "Pronto. Dra. Helena vai chegar te conhecendo."
- **QR escaneado:** "Dr. João Silva (CRM 12345) está vendo seu RG agora. Foi você quem mostrou?"

---

## 10. CHECKLIST DE APROVAÇÃO (antes de cada tela)

20 itens. Se 5+ falham, refazer.

1. ☐ Tipografia tem 3+ tamanhos com contraste real (não 14/15/16)
2. ☐ Hover state visível (não só cursor pointer)
3. ☐ Focus ring 2-4px com cor primary
4. ☐ Pressed state (scale 0.97 + sombra reduzida)
5. ☐ Disabled state (opacity 40% + cursor not-allowed)
6. ☐ Sombras 2-camadas tinted (não preto puro)
7. ☐ Border-radius VARIA entre componentes
8. ☐ Padding segue escala 4/8/12/16/24/32
9. ☐ Empty state tem copy custom + CTA
10. ☐ Loading é skeleton com forma do conteúdo
11. ☐ Nenhum gradiente verde→cyan ou roxo (cara de IA)
12. ☐ Nenhum emoji como ícone de navegação (SVG only)
13. ☐ Modal abre com spring + backdrop blur
14. ☐ Listas têm stagger animation
15. ☐ Números grandes animam count-up
16. ☐ Easing cubic-bezier custom (não `ease` padrão)
17. ☐ Texto de erro específico ("E-mail já cadastrado")
18. ☐ Nenhuma menção a "IA" / "inteligência artificial"
19. ☐ tabular-nums em TODO valor numérico clínico
20. ☐ Toast vem de baixo no mobile com spring

---

## 11. BLUE OCEAN: 3 DIFERENCIAIS QUE NINGUÉM TEM NO BRASIL

1. **Selo de emergência via QR escaneável sem app** — Apple Medical ID + RoadID levados pro Brasil. Conecte SUS NÃO faz isso. Memed NÃO faz isso. Hospital app NÃO faz isso.

2. **Linha do tempo médica unificada** — Apple Health tem por categoria, MyChart fragmenta. NINGUÉM no BR consolida consultas + exames + receitas + vacinas + alergias + cirurgias num feed cronológico filtrável.

3. **Portabilidade absoluta entre planos/hospitais** — brasileiro troca plano a cada 3-4 anos. Vita id é o ÚNICO que segue com ele. Posicionamento: "Seu prontuário, não da sua operadora."

---

## 12. EXECUÇÃO — PRÓXIMOS PASSOS (PRA LUCAS APROVAR)

### Fase A — Aprovação estratégica (HOJE)
Lucas valida:
- [ ] Posicionamento "gov.br 2030 redesenhado pela Stripe" — OK?
- [ ] Tipografia IBM Plex Sans + Newsreader — OK?
- [ ] Paleta dessaturada (verde #00B377 + teal #1A8FA8 + dark warm #0A1F1C + cream #FAFAF7) — OK?
- [ ] Modelo hub+sheet (sem tab bar) — OK?
- [ ] 7 features hero — OK?
- [ ] Cartão RG como artefato central — OK?

### Fase B — Construção (após aprovação)
1. Criar `_core.css` v4 com todos os tokens consolidados (1h)
2. Construir CARTÃO RG perfeito (template ouro) — 3-4 iterações até 10/10 (~3h)
3. Construir HOME completa com hub+sheet (~2h)
4. Construir 6 telas principais restantes em paralelo (~4h)
5. Sistema de navegação entre telas com hrefs reais
6. Servir em localhost direto na home

**Total: ~10h de trabalho focado, sem 50 agentes — qualidade > quantidade**

### Fase C — Polish (após Lucas testar)
- Iteração baseada em feedback real do Lucas
- Animações detalhadas (microinterações premium)
- Testes em mobile real (iPhone)
- Anti-cara-de-IA checklist passada em CADA tela

---

## 13. O QUE NÃO FAZER (anti-padrões evitados)

1. ❌ Tab bar embaixo (Lucas vetou + gov.br não usa em carteiras digitais)
2. ❌ Gradient verde→cyan vibrante (cara de AI startup 2024)
3. ❌ Plus Jakarta Sans (ok, mas saturada em healthtech genérico)
4. ❌ Border-radius 12px universal (cara de IA)
5. ❌ Sombras pretas puras (cara de IA)
6. ❌ Spinner genérico de loading (usar skeletons)
7. ❌ Empty state "Nenhum dado encontrado" (usar copy humana)
8. ❌ Ícones Material/FontAwesome (Phosphor + Healthicons)
9. ❌ Emoji em UI (SVG only)
10. ❌ Mencionar "IA" em qualquer copy
11. ❌ Score 0-100 inventado (você já cortou)
12. ❌ Idade biológica fake (você já cortou)
13. ❌ Confete/celebração lúdica (Einstein/Sírio = sobriedade)
14. ❌ Grid 2x2 ou 3x3 de "atalhos" na home (cara de plano de saúde popular)
15. ❌ Verde Unimed `#00995D` (lê instantaneamente como Unimed)
16. ❌ Azul Einstein `#0033A0` puro (lê como Einstein-clone)

---

## 14. FONTES DE PESQUISA (12 docs)

Esta estratégia veio de 12 pesquisas profundas com fontes reais (não opinião):

1. **Apps Einstein Conecta + Sírio-Libanês** (App Store, Play Store, Brandfetch, OZ Design case)
2. **Apps Rede D'Or + Hapvida + Unimed** (apps reais BR, padrões consolidados)
3. **CNH Digital + ConecteSUS + Carteira Trabalho** (gov.br design system)
4. **Apple Health Records + Mayo + MyChart** (Apple Developer, Mayo brand, Epic docs)
5. **Padrões navegação sem tab bar** (NN/g, Material Design, Apple HIG)
6. **Cartão identidade digital como artefato** (Apple Wallet, Google Wallet, Curve, Revolut)
7. **Linha do tempo médica** (Stripe Timeline, Linear, GitHub, MyChart)
8. **QR Code emergência médica** (Apple Medical ID, NHS COVID Pass, RoadID)
9. **Tipografia premium hospitalar** (IBM Plex, Newsreader — decisão final)
10. **Paleta consolidada vita id** (10 healthtechs analisadas, anti-cara-de-IA)
11. **Microinterações premium** (Apple HIG, Stripe motion, anti-AI patterns)
12. **Iconografia médica profissional** (Phosphor, Healthicons.org, Tabler)

---

## DECISÃO LUCAS

**Aprova essa direção pra eu construir?**

Se sim, próximo passo: construo o CARTÃO RG perfeito primeiro (3-4 iterações), você aprova, e só depois sigo pras outras telas.

Se algo tá errado, me fala AGORA antes de eu codar uma única linha. Esse doc é o blueprint — se a fundação estiver torta, tudo cai.
