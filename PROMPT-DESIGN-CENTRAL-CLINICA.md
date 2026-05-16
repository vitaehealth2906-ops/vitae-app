# PROMPT — REDESIGN DA CENTRAL CLÍNICA DO PACIENTE (vitaid)

> Cole esse prompt inteiro em uma sessão Claude com acesso ao repositório.
> Arquivo base: `d:\vitae-app-novo\desktop\preview-paciente-premium.html`
> Arquivo de saída: `d:\vitae-app-novo\desktop\preview-paciente-v3.html`

---

## CONTEXTO DO PRODUTO

Você está redesenhando a tela **Central Clínica do Paciente** do **vitaid** — plataforma médica desktop usada por médicos brasileiros no consultório.

O médico abre essa tela ao clicar no nome de um paciente na lista da aba Pacientes. Ele está num contexto de alta pressão: 28 consultas por dia, ~15 minutos por paciente, o próximo já está na sala de espera.

O produto precisa transmitir: **confiança clínica, velocidade operacional, inteligência e sofisticação silenciosa.**

---

## O QUE ESSA TELA FAZ (funcional)

A tela tem 6 blocos funcionais:

### 1. Identificação do Paciente
Quem é, dados vitais, alertas clínicos críticos (alergias graves), ações rápidas.
- Médico precisa saber em **< 2 segundos**: nome, idade, sangue, alergias ativas.
- Ações: "Enviar pré-consulta" (primária) + "WhatsApp" (abre wa.me do paciente em nova aba) + menu "..."

### 2. Resumo Clínico (4 indicadores)
Exames recentes / Alergias (com destaque se houver grave) / Medicamentos ativos / Condições crônicas.
- Clicáveis para expandir detalhes inline.

### 3. Documentos
O médico anexa laudos, receitas, atestados, exames para o paciente ver no app dele.
- Ações por documento: visualizar, baixar, excluir (só no hover).
- Botão "Anexar" para adicionar novo.
- Estado vazio com mensagem útil.

### 4. Linha do Tempo de Anamneses
Histórico cronológico de pré-consultas respondidas pelo paciente.
- Cada item: data, título da queixa, resumo em 2 linhas, badges (alertas detectados, exames, farmacológicos).
- Clicável para abrir o resumo de 1 minuto completo.
- Estado vazio: não pode ser "morto". Precisa ter CTA para enviar pré-consulta.

### 5. IA Collab (Insights Clínicos)
Só aparece se o paciente tiver 2+ anamneses. Cruza dados ao longo do tempo.
- Mostra padrões, mudanças relevantes, conflitos farmacológicos, evolução.
- NÃO deve parecer "feature de IA". Deve parecer análise clínica natural.

### 6. Próximo Retorno
O médico propõe uma data de retorno. O paciente confirma ou sugere outra pelo app.
- Estados: sem retorno / retorno proposto aguardando confirmação / retorno confirmado / retorno vencido.
- Ações: Marcar retorno / Reagendar / Cancelar.

---

## O QUE ESTÁ ERRADO ATUALMENTE (problemas explícitos)

Leia o arquivo `preview-paciente-premium.html` como referência do estado atual. Os problemas:

1. **Box enorme para o header** — 80% do espaço está em branco. Nome, foto, 2 botões e muita área vazia.
2. **4 cards gigantes** para 4 números. Cada card tem ~120px de altura pra mostrar "3" e "últimos 3 meses". Absurdo.
3. **Seções sem ritmo visual** — cada bloco parece um projeto separado, sem grid unificado.
4. **Botões gigantes e genéricos** — "Marcar retorno" e "Cancelar proposta" lado a lado, cada um com 50% da largura disponível, sem hierarquia.
5. **Tipografia sem hierarquia** — labels e valores no mesmo peso visual.
6. **Espaçamento aleatório** — não segue grid de 8pt.
7. **Bordas excessivas** — cada seção embrulhada em card com borda, criando "caixas dentro de caixas dentro de caixas".
8. **Estado vazio morto** — "Sem anamneses ainda" com ícone de relógio e nada mais.
9. **IA Collab como botão perdido** — não integrado ao fluxo clínico.
10. **Visual "Lovable/vibe code"** — parece template genérico de dashboard, não produto médico.

---

## DIRETRIZES DE DESIGN (200 REGRAS SINTETIZADAS)

### Lei de Hick — reduza escolhas simultâneas
No header, máximo 2 ações visíveis. Resto em menu "...".
No retorno, máximo 1 ação primária visível + secondary link.

### Lei de Fitts — alvos maiores para ações frequentes
"Enviar pré-consulta" deve ter área de clique generosa. "Excluir" documento deve ser pequeno e aparecer apenas no hover.

### Lei de Proximidade (Gestalt)
Alergias e medicamentos são vizinhos clínicos — agrupar visualmente perto.
Data de retorno e ações de retorno — na mesma linha, sem separação.

### Lei de Miller (7 ± 2)
Nunca mostrar mais de 7 itens na timeline sem paginação.
Badges por anamnese: máximo 3 visíveis, resto em "+N mais".

### Efeito von Restorff — isolamento para destaque
Alergias graves em vermelho são o único elemento vermelho na tela. Nada mais vermelho.
Isso garante que o médico vê o alerta de Dipirona/Penicilina em 200ms.

### Progressive Disclosure
Documentos: mostrar primeiros 3, link "Ver todos (N)" para expandir.
Timeline: mostrar últimas 3 anamneses, "Ver histórico completo" no rodapé.
Insights: mostrar 2-3 bullets principais, "Ver análise completa →" no rodapé.

### Efeito Zeigarnik — mostrar progresso incompleto
Se retorno está "aguardando confirmação" há mais de 48h, exibir badge de urgência sutil.

### Carga Cognitiva Zero no Header
O médico lê o header 28x por dia. Deve ser instantâneo:
- Nome: maior elemento, sem competição
- Metadados: inline, em cinza, separados por "·"
- Alergias críticas: pills vermelhas imediatamente abaixo do nome
- Ações: direita, pequenas, não competem com o conteúdo

### Reconhecimento > Memorização
Labels das seções em uppercase 10px — médico escaneia sem ler.
Ícone + label juntos em cada indicador clínico.
Estados de retorno com cor + texto + ícone (nunca só cor).

### WCAG Acessibilidade
Contraste mínimo 4.5:1 para texto normal.
Áreas de toque mínimo 44x44px para botões.
Todo alerta clínico: cor + ícone + texto (nunca só cor).
Foco visual visível em todos os elementos interativos.

### Grid 8pt obrigatório
Todos os espaçamentos múltiplos de 8: 8, 16, 24, 32, 40, 48.
ZERO padding/margin que não seja múltiplo de 4.

---

## SISTEMA VISUAL (tokens obrigatórios)

```css
/* Backgrounds */
--bg:     #F7F7F6;   /* Notion-like warm off-white */
--surf:   #FFFFFF;
--surf-2: #FAFAF9;   /* hover state */

/* Texto */
--t1: #111118;       /* primário — nomes, valores */
--t2: #52525B;       /* secundário — metadados */
--t3: #A1A1AA;       /* terciário — labels, datas */
--t4: #D4D4D8;       /* quaternário — bordas, divisores */

/* Bordas */
--border:   rgba(0,0,0,.07);
--border-2: rgba(0,0,0,.04);

/* Semânticas — NUNCA usar fora do contexto abaixo */
--red:        #EF4444;   /* APENAS: alergia grave, erro crítico */
--red-bg:     rgba(239,68,68,.07);
--amber:      #D97706;   /* APENAS: atenção, retorno pendente */
--amber-bg:   rgba(217,119,6,.09);
--green:      #00C47A;   /* APENAS: ativo, confirmado, vita id brand */
--green-bg:   rgba(0,196,122,.09);
--cyan:       #00B4D8;   /* APENAS: IA/insights */
--cyan-bg:    rgba(0,180,216,.08);

/* Sidebar */
--side: #0F0F11;

/* Tipografia */
--font: 'Instrument Sans', system-ui, sans-serif;
--mono: 'DM Mono', monospace;

/* Radius */
--r:    8px;
--r-sm: 5px;
--r-xs: 3px;

/* Sombras — usar com extrema parcimônia */
--shadow-sm: 0 1px 3px rgba(0,0,0,.06);
```

### Tipografia (escala obrigatória)

| Uso | Tamanho | Peso | Cor | Família |
|-----|---------|------|-----|---------|
| Nome do paciente | 17px | 700 | --t1 | var(--font) |
| Título de seção (label) | 10.5px | 700 | --t3 | var(--font) uppercase letter-spacing .09em |
| Título de evento (timeline) | 13.5px | 600 | --t1 | var(--font) |
| Texto de resumo | 12.5px | 400 | --t2 | var(--font) line-height 1.55 |
| Metadado inline | 12.5px | 400 | --t3 | var(--font) |
| Valor numérico grande (indicadores) | 18px | 700 | --t1 | var(--mono) |
| Valor numérico pequeno | 13px | 600 | --t1 | var(--mono) |
| Data de retorno | 20px | 700 | --t1 | var(--mono) |
| Label de botão primário | 12.5px | 700 | #0F0F11 | var(--font) |
| Label de botão secundário | 12.5px | 500 | --t2 | var(--font) |
| Metadata de documento | 11px | 400 | --t3 | var(--font) |

---

## ANATOMIA DE CADA COMPONENTE

### COMPONENTE 1: Header do Paciente

**Tamanho alvo:** 68px de altura (não mais que isso)

```
[foto 40px circular] [nome 17px bold] ......................... [btn-primary] [btn-ghost] [btn-icon ...]
                     [metadados inline 12.5px muted]
                     [pill alergia vermelha] [pill condição cinza]
```

**Regras:**
- Foto: 40x40px, border-radius 50%, fundo verde-bg se sem foto (iniciais em verde)
- Metadados: "46 anos · Masculino · Sangue A+" — inline, separado por "·"
- Pills de alergia: vermelhas, pequenas (padding 2px 8px), font 11.5px, border-radius 20px
- Pills de condição: cinzas neutras, mesmo tamanho
- btn-primary: "Enviar pré-consulta" — fundo #00C47A, texto #0F0F11, font 12.5px 700, padding 7px 14px, border-radius 5px
- btn-ghost: "WhatsApp ↗" — borda 1px --border, fundo transparente, padding 7px 12px
- btn-icon: "..." — 32x32px, borda --border, sem fundo

**O que NÃO fazer:**
- NÃO deixar mais de 40% do header em branco
- NÃO usar box/card embrulhando o header inteiro
- NÃO usar sombra no header

---

### COMPONENTE 2: Indicadores Clínicos (row)

**Tamanho alvo:** 52px de altura (UMA linha)

```
[EXAMES · 3 · últimos 3 meses] | [ALERGIAS · 2 · 1 grave] | [MEDICAMENTOS · 4 · em uso] | [CONDIÇÕES · 1 · hipertensão]
```

**Regras:**
- Container: `display:flex`, fundo branco, borda inferior 1px --border
- Cada item: `flex:1`, padding 12px 20px, separados por `::before` 1px vertical
- Label: 10px uppercase 700 --t3 letter-spacing .08em
- Valor: 18px 700 --mono --t1 (alergias: --red se houver grave)
- Sub: 11px --t3 margin-top 2px
- Hover: fundo --surf-2, cursor pointer (para expandir)

**O que NÃO fazer:**
- NÃO usar 4 cards separados com borda e border-radius
- NÃO usar padding interno maior que 16px vertical
- NÃO repetir a borda do card externo dentro de cada item

---

### COMPONENTE 3: Documentos

**Layout:** lista densa, não cards

```
DOCUMENTOS ─────────────────────────────── + Anexar

[PDF] Hemograma completo          128 KB · 29 abr · Fleury    [●verde] [ver][dl][del(hover)]
[IMG] ECG de repouso              2.1 MB · 15 abr · Cardio    [●verde] [ver][dl][del(hover)]
[PDF] Receita — Losartana 50mg    38 KB  · 02 mar · Dra. H.   [●verde] [ver][dl][del(hover)]
```

**Regras:**
- Container: `background:var(--surf)`, `border:1px solid var(--border)`, `border-radius:var(--r)`
- Header: padding 10px 14px, `border-bottom:1px solid var(--border-2)`, flex space-between
- Label "DOCUMENTOS": 10.5px 700 uppercase --t3
- Botão "+ Anexar": link-style (sem caixa), 12px 600 --green
- Cada linha: `display:flex`, `align-items:center`, `gap:10px`, padding 10px 14px, `border-bottom:1px solid var(--border-2)`
- Hover na linha: fundo --surf-2, revelar ações de forma progressiva
- Ícone de tipo: 32x36px retângulo arredondado 4px, fundo colorido por tipo (PDF vermelho, IMG verde, DOC azul), texto 8.5px 700 monospace
- Nome: 13px 500 --t1 `text-overflow:ellipsis`
- Metadata: 10.5px --t3 (tamanho · data · origem)
- Status dot: 6px círculo (verde = visto, âmbar = novo)
- Ações: `opacity:0`, visíveis no `hover` da linha. Ícones 26x26px com borda --border

**Estado vazio:**
```
Nenhum documento anexado.
Adicione laudos, receitas ou exames para o paciente visualizar.
```
- Texto 12.5px --t3, centralizado, com botão "+ Anexar primeiro documento" sutil

---

### COMPONENTE 4: Linha do Tempo

**Layout:** timeline vertical, datas à esquerda (Linear-style)

```
HISTÓRICO CLÍNICO ─────────────────────── Ver tudo →

29   │● Cefaleia recorrente e dor abdominal
ABR  │  Paciente relata dor de cabeça intensa há 3 dias...
     │  [Alerta farmacológico] [3 exames] [Retorno marcado]

15   │○ Controle de hipertensão arterial
ABR  │  Pressão aferida: 148/92 mmHg. Paciente relata...
     │  [PA elevada] [Medicamento ajustado]
```

**Regras:**
- Grid: `display:grid`, `grid-template-columns:56px 1fr`, `gap:16px`
- Coluna data: data (11px 600 --mono --t2) + mês (10px --mono --t3), alinhados à direita
- Linha vertical: `position:absolute`, `left:63px`, 1px --border-2
- Dot: 10px circle, `position:absolute`, `left:59px`. Ativo: borda --green fundo branco. Normal: borda --t4.
- Título: 13.5px 600 --t1, cursor pointer, hover color --green
- Resumo: 12.5px --t2 line-height 1.55, `-webkit-line-clamp:2`
- Badges: 10.5px 500, padding 2px 8px, border-radius 3px. Cores por tipo (green/amber/red/gray).

**Estado vazio — NÃO usar ícone morto:**
```
Sem histórico de pré-consultas ainda.

Quando este paciente responder sua primeira pré-consulta,
a evolução clínica aparece aqui automaticamente.

[→ Enviar pré-consulta agora]
```
- Layout: flex column, padding 24px 0, sem ícone, sem fundo colorido
- Link CTA: 12.5px 600 --green com seta →

---

### COMPONENTE 5: Insights Clínicos (IA Collab)

**Layout:** card sutil, abaixo da timeline. Só aparece com 2+ anamneses.

```
┌─ ANÁLISE CLÍNICA ──────────────────── Gerado automaticamente ─┐
│ · 3 consultas nos últimos 90 dias — frequência acima da média.  │
│ · Padrão de cefaleia recorrente detectado nas últimas 2 anamneses.│
│ · Dipirona prescrita em mar. Alergia registrada — conflito.     │
│                                              Ver análise completa → │
└────────────────────────────────────────────────────────────────┘
```

**Regras:**
- Container: `border:1px solid var(--border)`, `border-radius:var(--r)`, fundo --surf
- Header: padding 11px 16px, flex, `border-bottom:1px solid var(--border-2)`
- Ícone: svg spark/asterisk 14px cor --cyan
- Label "ANÁLISE CLÍNICA": 11px 700 uppercase --t2
- Badge "Gerado automaticamente": 10px, fundo --cyan-bg, cor --cyan, border-radius 10px
- Body: padding 14px 16px, lista de bullets com `·` como marcador
- Cada bullet: 12.5px --t2, line-height 1.55, strong em --t1
- Footer: padding 10px 16px, border-top --border-2, link "Ver análise completa →" 12px 600 --cyan

**O que NÃO fazer:**
- NÃO usar gradient neon
- NÃO usar "✨" ou "🤖" ou qualquer emoji
- NÃO escrever "IA" explicitamente na UI (é "Análise clínica")
- NÃO usar fundo colorido chamativo

---

### COMPONENTE 6: Próximo Retorno

Este é o componente mais importante operacionalmente. O médico precisa bater o olho e agir.

**Layout:** compacto, operacional

**Estado A — Sem retorno:**
```
PRÓXIMO RETORNO ─────────────────────── + Marcar retorno

Nenhum retorno agendado.
```

**Estado B — Aguardando confirmação:**
```
PRÓXIMO RETORNO

15 jul 2026                    ⏳ Aguardando confirmação
                               há 2 horas · via app

[Reagendar]  [Cancelar proposta]
```

**Estado C — Confirmado:**
```
PRÓXIMO RETORNO

15 jul 2026                    ✓ Confirmado pelo paciente
                               Confirmado em 14 mai · 09:32

[Reagendar]
```

**Estado D — Vencido:**
```
PRÓXIMO RETORNO

05 mai 2026                    ⚠ Retorno vencido
                               Proposto há 12 dias

[Remarcar agora]  [Excluir]
```

**Regras de design:**
- Container: `background:var(--surf)`, `border:1px solid var(--border)`, `border-radius:var(--r)`
- Header: padding 10px 14px, border-bottom --border-2, flex space-between
- Data: 20px 700 --mono --t1 (visível imediatamente)
- Status badge: inline-flex, gap 5px, padding 3px 9px, border-radius 20px. Cores semânticas.
- Status "Aguardando": fundo --amber-bg, cor --amber, borda rgba(amber,.2)
- Status "Confirmado": fundo --green-bg, cor --green, borda rgba(green,.25)
- Status "Vencido": fundo --red-bg, cor --red, borda rgba(red,.25)
- Ações: `display:flex`, gap 6px, margin-top 12px
- Botão Confirmar: fundo --t1, cor branco, padding 7px 0, flex 1, border-radius --r-sm, 11.5px 600
- Demais botões: borda --border, fundo transparente, cor --t2, mesmos padding
- "+ Marcar retorno" no estado vazio: link-style, 12px 600 --green no header

**O que NÃO fazer:**
- NÃO usar 2 botões com 50% de largura cada lado a lado sem hierarquia
- NÃO usar data gigante sem contexto de status ao lado
- NÃO usar sombra no card

---

## LAYOUT GERAL DA TELA

```
┌─ SIDEBAR 200px ──────┬─ CONTENT ─────────────────────────────────┐
│ vita id [PRO]         │ TOPBAR: Pacientes › Álvaro Schocair   22:48│
│ ─────────────────     ├─ PATIENT HEADER (68px) ─────────────────  │
│ Hoje                  │ [foto] Álvaro Schocair                     │
│ Pré-Consultas [9]     │        46 anos · Masc · A+  [Enviar][Wapp]│
│ Pacientes [3] ●       │        [Hipertensão] [Alérgico: Dipirona]  │
│ ─────────────────     ├─ METRICS STRIP (52px) ──────────────────  │
│ Templates             │ EXAMES·3·rec | ALERG·2·1grave | MEDS·4 |  │
│ Meu Perfil            ├─ TWO COLUMNS ──────────────────────────── │
│                       │  MAIN (65%)     │  RAIL (35%)             │
│                       │  ─────────────  │  ─────────────────      │
│                       │  HISTÓRICO      │  PRÓXIMO RETORNO        │
│                       │  CLÍNICO        │  ─────────────────      │
│                       │  (timeline)     │  DOCUMENTOS             │
│                       │                 │                         │
│                       │  ANÁLISE        │                         │
│                       │  CLÍNICA        │                         │
│ [Helena Souza CRM]    │  (insights)     │                         │
└──────────────────────┴─────────────────┴─────────────────────────┘
```

**Regras do layout:**
- Sidebar: 200px fixo, fundo #0F0F11, nunca scrollable
- Topbar: 48px, fundo branco, border-bottom --border
- Patient header + metrics strip: fixos no topo do content (sticky)
- Two columns: `display:grid`, `grid-template-columns:1fr 320px`
- MAIN: overflow-y scroll, padding 24px 28px
- RAIL: overflow-y scroll, padding 20px

---

## ESTADO DA LISTA DE PACIENTES (tabela)

Ao entrar na aba Pacientes, aparece uma tabela antes de clicar num paciente:

```
PACIENTES                        [3 pacientes]      [🔍 Buscar...]

─────────────────────────────────────────────────────────────────
PACIENTE          ÚLTIMA CONSULTA    STATUS      RETORNO
─────────────────────────────────────────────────────────────────
[AS] Álvaro Scho  29 abr             ● Ativa     15 jul          Abrir →
[MS] Maria Silva  10 mai             ● Ativa     —               Abrir →
[DF] Daniel Fern  05 mai             ⚠ Alerta    20 mai          Abrir →
─────────────────────────────────────────────────────────────────
```

**Regras:**
- Container: `background:var(--surf)`, `border:1px solid var(--border)`, `border-radius:var(--r)`
- Header row: fundo --bg, height 36px, labels 10.5px 600 uppercase --t3
- Data row: height 52px, hover fundo --surf-2, cursor pointer
- Grid: `grid-template-columns: 2fr 1fr 100px 120px 72px`
- Avatar: 32x32 círculo, fundo --green-bg, iniciais 11px 700 --mono --green
- Nome: 13.5px 600 --t1 + meta 11.5px --t3 embaixo
- Status badges: border-style (borda colorida + fundo suave), não fundo sólido
- "Abrir →": 12px 600 --t3, opacity 0, `display:flex` na row hover

---

## DADOS MOCK (usar esses 3 pacientes)

```js
var PATIENTS = [
  {
    id:'p1', name:'Álvaro Schocair', age:46, sex:'Masculino', blood:'A+',
    lastVisit:'29 abr', status:'active', returnDate:'15 jul 2026', returnStatus:'awaiting', returnSentAt:'há 2 horas',
    tags:[
      {label:'Hipertensão', type:'cond'},
      {label:'Alérgico: Dipirona', type:'alert'},
      {label:'Alérgico: Penicilina', type:'alert'}
    ],
    indicators:{
      exams:{value:3, sub:'últimos 3 meses'},
      allergies:{value:2, sub:'1 grave', critical:true},
      meds:{value:4, sub:'em uso agora'},
      conds:{value:1, sub:'hipertensão'}
    },
    anamneses:[
      {
        day:'29', month:'ABR', active:true,
        title:'Cefaleia recorrente e dor abdominal',
        summary:'Paciente relata dor de cabeça intensa há 3 dias, intensidade 8/10. Associada a náuseas e sensibilidade à luz. Dor abdominal pontual na região epigástrica.',
        badges:[
          {label:'Alerta farmacológico', type:'red'},
          {label:'3 exames solicitados', type:'gray'},
          {label:'Retorno marcado', type:'green'}
        ]
      },
      {
        day:'15', month:'ABR', active:false,
        title:'Controle de hipertensão arterial',
        summary:'Pressão aferida: 148/92 mmHg. Boa adesão à Losartana 50mg. Episódios de tontura matinal. Proposto ajuste de dose.',
        badges:[
          {label:'PA elevada', type:'amber'},
          {label:'Medicamento ajustado', type:'gray'}
        ]
      },
      {
        day:'02', month:'MAR', active:false,
        title:'Consulta de rotina — check-up anual',
        summary:'Paciente sem queixas ativas. Exames de rotina dentro dos parâmetros normais. Recomendada manutenção do tratamento atual.',
        badges:[
          {label:'Sem alertas', type:'green'},
          {label:'Exames OK', type:'gray'}
        ]
      }
    ],
    documents:[
      {name:'Hemograma completo', type:'pdf', size:'128 KB', date:'29 abr', status:'seen', origin:'Lab. Fleury'},
      {name:'ECG de repouso', type:'img', size:'2.1 MB', date:'15 abr', status:'seen', origin:'Cardioclínica SP'},
      {name:'Receita — Losartana 50mg', type:'pdf', size:'38 KB', date:'02 mar', status:'seen', origin:'Dra. Helena Souza'}
    ],
    insights:[
      {text:'<strong>3 consultas</strong> nos últimos 90 dias — frequência acima da média para hipertensos controlados.'},
      {text:'Padrão de <strong>cefaleia recorrente</strong> detectado nas últimas 2 anamneses. Considerar avaliação neurológica.'},
      {text:'Dipirona prescrita em 02/mar. <strong>Alergia registrada</strong> — conflito farmacológico detectado.'}
    ]
  },
  {
    id:'p2', name:'Maria Silva', age:47, sex:'Feminino', blood:'O+',
    lastVisit:'10 mai', status:'active', returnDate:null, returnStatus:null,
    tags:[{label:'Diabetes tipo 2', type:'cond'},{label:'Hipotireoidismo', type:'cond'}],
    indicators:{
      exams:{value:5, sub:'últimos 6 meses'},
      allergies:{value:1, sub:'sem graves', critical:false},
      meds:{value:3, sub:'em uso agora'},
      conds:{value:2, sub:'2 crônicas'}
    },
    anamneses:[
      {
        day:'10', month:'MAI', active:true,
        title:'Controle glicêmico — revisão trimestral',
        summary:'HbA1c: 7.2% — levemente acima da meta. Dificuldade em manter dieta. Proposto ajuste na dose de Metformina e encaminhamento nutricional.',
        badges:[{label:'Glicemia elevada', type:'amber'},{label:'Ajuste medicamentoso', type:'gray'}]
      }
    ],
    documents:[
      {name:'HbA1c — resultado', type:'pdf', size:'89 KB', date:'10 mai', status:'new', origin:'Lab. Sabin'}
    ],
    insights:[
      {text:'HbA1c <strong>7.2%</strong> — acima da meta de 7.0% para diabéticos tipo 2.'},
      {text:'Levotiroxina sem ajuste há <strong>8 meses</strong>. TSH não revisado neste período.'}
    ]
  },
  {
    id:'p3', name:'Daniel Fernandes', age:17, sex:'Masculino', blood:'B+',
    lastVisit:'05 mai', status:'alert', returnDate:'20 mai 2026', returnStatus:'confirmed', returnSentAt:'05 mai',
    tags:[{label:'Asma leve', type:'cond'},{label:'Rinite alérgica', type:'cond'}],
    indicators:{
      exams:{value:1, sub:'último mês'},
      allergies:{value:3, sub:'2 graves', critical:true},
      meds:{value:2, sub:'em uso'},
      conds:{value:2, sub:'respiratórias'}
    },
    anamneses:[
      {
        day:'05', month:'MAI', active:true,
        title:'Crise de broncoespasmo noturna',
        summary:'3 episódios de broncoespasmo na última semana, principalmente após 22h. Acordou 2 vezes com sensação de aperto no peito e chiado.',
        badges:[{label:'Urgência respiratória', type:'red'},{label:'Retorno em 15 dias', type:'amber'}]
      }
    ],
    documents:[],
    insights:[
      {text:'<strong>3 crises noturnas</strong> em 7 dias — padrão compatível com asma não controlada.'},
      {text:'Sem uso de corticoide inalatório nos últimos 30 dias. <strong>Adesão comprometida.</strong>'}
    ]
  }
];
```

---

## INSTRUÇÕES TÉCNICAS

1. **Leia** `d:\vitae-app-novo\desktop\preview-nova-aba-pacientes.html` para pegar o script de bypass de auth (as primeiras 60 linhas).

2. **Crie** `d:\vitae-app-novo\desktop\preview-paciente-v3.html` como arquivo standalone. Não depende de nenhum CSS externo além de Google Fonts.

3. **Fontes:** `Instrument Sans` + `DM Mono` do Google Fonts.

4. **Sem frameworks CSS.** Todo CSS inline no `<style>`.

5. **JavaScript puro.** Sem bibliotecas. Sem imports.

6. **O arquivo deve abrir sem login** (bypass de fetch já está no script de auth do arquivo base).

7. **Estados navegáveis:** Lista → clica paciente → detalhe. Botão "← Voltar" no topbar.

8. **Relógio no topbar** em DM Mono, atualizado a cada segundo.

9. **Não usar `!important`** exceto em casos específicos documentados no CSS.

10. **Todos os SVG icons inline** — sem FontAwesome, sem Material Icons.

---

## CRITÉRIOS DE APROVAÇÃO

A tela estará pronta quando:

- [ ] Header do paciente ≤ 70px de altura com informação densa
- [ ] Indicadores em UMA linha horizontal, não 4 cards
- [ ] Nenhuma seção com mais de 40% de espaço vazio
- [ ] Alergias graves visíveis em vermelho sem precisar procurar
- [ ] Timeline com datas à esquerda, conteúdo à direita
- [ ] Insights sem menção a "IA" — chamado "Análise clínica"
- [ ] Retorno com 3-4 estados visuais distintos e ações hierarquizadas
- [ ] Documentos em lista densa com ações no hover
- [ ] Grid 8pt respeitado em todos os espaçamentos
- [ ] Nenhum elemento decorativo sem função clínica
- [ ] Abre sem login no localhost:3000
- [ ] Todos os 3 pacientes mock navegáveis

---

*Fim do prompt. Qualquer dúvida sobre o produto, leia `d:\vitae-app-novo\CLAUDE.md`.*
