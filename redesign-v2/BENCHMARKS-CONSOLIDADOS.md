# BENCHMARKS CONSOLIDADOS — vita id redesign v2

## Apps estudados (4 agentes em paralelo)

### 1. Apple Saúde + One Medical
- Apple: 3 abas (Summary/Sharing/Browse), SF Pro, paleta categórica colorida, low-shadow, dark mode nativo
- One Medical: 4-5 abas, GT Super serif + GT America sans, cream background #F7F4EE, deep green #0A4F4A, no dark mode

### 2. Whoop + Oura
- Whoop: dark-first, preto puro, 3 cores semânticas (verde/amarelo/vermelho), DIN Pro nos números, tom científico/atlético
- Oura: dark azulado #0E0E10, paleta biológica calma (azul-noite + dourado), letter-spacing aumentado, tom contemplativo "your patterns"

### 3. Headspace + Calm + Strava
- Headspace: laranja #F47D31, Aperçu custom, sombras coloridas, ilustrações lúdicas, tom "abraço quente"
- Calm: gradientes azul→roxo, midnight blue, imagens fullscreen, copy poético
- Strava: laranja #FC4C02, Boathouse + Inter, tabular-nums em métricas, tom coach inclusivo

### 4. Linear + Notion + Stripe
- Linear: #08090A bg dark, #5E6AD2 brand purple, Inter 13px, denso, Command+K, property rows
- Notion: #F7F6F3 cream, texto #37352F (warm), bottom sheets, sem sombras
- Stripe: #0A2540 navy, Sohne (Inter fallback), tabular-nums obrigatório, skeleton screens, timeline vertical

## DESIGN TOKENS FINAIS — vita id

**Posicionamento:** "Stripe Dashboard com calor Notion + 30% Whoop pra clareza semântica"

### Cores (light mode primário, dark opcional)

```css
/* Backgrounds */
--bg: #F7F6F3;           /* off-white quente (Notion cream) */
--surface: #FFFFFF;       /* cards */
--surface-2: #FAF9F7;     /* surface secundária */

/* Texto */
--text: #1A1F1E;          /* não-preto puro (humanizador) */
--text-2: #6B7280;        /* secundário */
--text-3: #9CA3AF;        /* labels */

/* Brand */
--primary: #0A4F4A;       /* jade institucional (One Medical-style) */
--primary-soft: #E8F0EE;  /* fundo de pills primárias */

/* Semânticas (Whoop-clarity) */
--ok: #16A34A;            /* verde sóbrio (Stripe-tone) */
--ok-soft: #D7F7C2;
--warn: #D97706;          /* amber */
--warn-soft: #FFE3B3;
--danger: #DC2626;        /* vermelho clínico */
--danger-soft: #FFD7D0;
--info: #2563EB;
--info-soft: #DBEAFE;

/* Acento premium (selo) */
--gold: #D4A574;          /* One Medical amber */
```

### Tipografia

```css
--font-display: 'Fraunces', Georgia, serif;  /* títulos editoriais */
--font-ui: 'Inter', -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', monospace;    /* tabular-nums em números clínicos */

/* Escala */
--text-xs: 11px;
--text-sm: 13px;
--text-base: 15px;
--text-lg: 17px;
--text-xl: 20px;
--text-2xl: 24px;
--text-3xl: 32px;
--text-4xl: 40px;

/* Pesos */
--weight-regular: 400;
--weight-medium: 500;
--weight-semibold: 600;
--weight-bold: 700;
```

### Espaçamento (base 4px)
```css
--s-1: 4px;
--s-2: 8px;
--s-3: 12px;
--s-4: 16px;
--s-5: 20px;
--s-6: 24px;
--s-7: 32px;
--s-8: 48px;
```

### Border-radius
```css
--r-sm: 6px;     /* badges, pills */
--r-md: 10px;    /* botões */
--r-lg: 14px;    /* cards (vitae-core padrão) */
--r-xl: 20px;    /* sheets, modais */
--r-pill: 999px;
```

### Sombras
```css
--shadow-sm: 0 1px 2px rgba(10, 79, 74, 0.04);
--shadow-md: 0 2px 8px rgba(10, 79, 74, 0.06);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.08);
```

### Padrões obrigatórios

1. **Tabular-nums em TODO valor numérico** (Stripe)
2. **Texto primário nunca preto puro** (Notion - reduz fadiga)
3. **Status como pill pastel + texto da mesma família** (Stripe)
4. **Property rows em telas de detalhe** (Linear)
5. **Bottom sheets em mobile** (Notion)
6. **Skeleton em vez de spinner** (Stripe)
7. **Hierarquia: número gigante + label pequeno** (Strava)
8. **Copy: nunca julga, sempre convida** (Headspace + Oura)
9. **Zero emoji em UI** (regra Lucas)
10. **Nunca mencionar "IA"** (regra Lucas)

### Frame iPhone
- 393x852px (vitae-core padrão)
- border-radius 52px
- Dynamic Island 126x34
- Tab bar 86px altura
- Status bar com "9:41" e ícones

## TELAS A CONSTRUIR (24 telas, sem onboarding/cadastro/quiz)

### Bloco A — Hoje + Saúde (8 telas)
1. **01-home.html** — Hoje (4 cards principais)
2. **02-saude.html** — Índice de Saúde
3. **03-exames-lista.html** — Lista de exames com filtros
4. **04-exame-detalhe.html** — Exame com parâmetros e gráfico histórico
5. **05-adicionar-exame.html** — Câmera ou PDF
6. **06-processando.html** — Loading com etapas
7. **07-meds-lista.html** — Medicamentos ativos + histórico
8. **08-med-detalhe.html** — Medicamento individual

### Bloco B — Consultas + Cuidado (8 telas)
9. **09-meds-adicionar.html** — Adicionar med (scan ou manual)
10. **10-alergias-condicoes.html** — Alergias + condições unificadas
11. **11-alergia-adicionar.html** — Adicionar alergia
12. **12-consultas-lista.html** — Consultas próximas + histórico
13. **13-consulta-detalhe.html** — Detalhe + ações
14. **14-pre-consulta-responder.html** — Quiz de 4 perguntas
15. **15-briefing-medico.html** — Resumo 1-min (o que médico vê)
16. **16-historico-consulta.html** — Resumo pós-consulta

### Bloco C — Compartilhar + Eu (8 telas)
17. **17-compartilhar.html** — QR + link + opções
18. **18-qr-fullscreen.html** — QR em tela cheia
19. **19-autorizacao.html** — Médicos autorizados (LGPD)
20. **20-rg-publico.html** — Tela que médico vê ao escanear
21. **21-eu.html** — Perfil + ajustes
22. **22-cartao-rg.html** — Cartão 3D flip
23. **23-premium.html** — Paywall
24. **24-ajustes.html** — Configurações
