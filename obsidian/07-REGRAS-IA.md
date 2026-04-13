# Regras pra Qualquer IA — vita id

> Voltar pra [[00-CENTRAL]] | Identidade visual em [[01-IDENTIDADE]]

---

## Contexto

Este documento serve pra colar no inicio de qualquer conversa com IA (Claude, ChatGPT, Cursor, etc.) quando for trabalhar no vita id. Seguindo estas regras, a IA vai produzir resultado consistente com o que ja existe.

---

## Obrigatorio — Sempre Fazer

### Antes de criar qualquer tela nova
1. Ler o arquivo `vitae-core.css` — e a fonte unica de verdade do design
2. Olhar pelo menos 2 telas existentes como referencia
3. Usar a mesma estrutura: `<div class="phone"><div class="notch"></div><div class="content">...</div><div class="tab-bar">...</div></div>`
4. Importar os 3 CSS na ordem: vitae-core.css → vitae-glass.css → vitae-light.css
5. Importar a fonte Plus Jakarta Sans do Google Fonts

### Antes de falar com o backend
1. Usar `api.js` — NUNCA fazer fetch direto
2. Verificar quais funcoes ja existem em `vitaeAPI.*`
3. Testar com o backend rodando local na porta 3002

### Design obrigatorio
- Cores: seguir os tokens `--v-green`, `--v-cyan`, `--v-ink`, etc
- Fonte: Plus Jakarta Sans, pesos 400-900
- Icones: SVG stroke (nunca fill, nunca emoji, nunca biblioteca)
- Border-radius padrao: 14px pra cards/botoes, 12px pra badges
- Titulos: palavra-chave em **italico verde**
- Tab bar: 5 itens fixos (Meu RG, Score, Exames, QR Code, Editar)
- Frame: 393x852px com border-radius 52px

### Comunicacao
- Tom institucional serio — como hospital de referencia
- Foco no beneficio pro usuario, nunca no processo tecnico
- Verbos de acao: "Escanear receita", "Adicionar medicamento"

---

## Proibido — Nunca Fazer

| Regra | Por que |
|-------|---------|
| Nunca usar emoji | O app inteiro usa SVG stroke. Emoji quebra a identidade |
| Nunca mencionar "IA" ou "AI" | O usuario nao deve saber que tem IA por tras |
| Nunca usar bibliotecas de icones | Nada de FontAwesome, Material Icons, Heroicons — tudo SVG inline |
| Nunca criar tela fora do padrao | Seguir exatamente o design system existente |
| Nunca mexer na pasta frontend/ | O Next.js esta incompleto e NAO e o frontend ativo |
| Nunca adicionar dependencia nova sem perguntar | Cada dependencia e um risco |
| Nunca usar tom casual/startup | Nada de "que massa!", "show!", "bora!" |
| Nunca inventar funcionalidade | So fazer o que foi pedido |
| Nunca usar fill nos SVGs | Sempre stroke, stroke-width 2, linecap round |

---

## Checklist pra Nova Tela

Antes de considerar uma tela pronta, verificar:

- [ ] Importa vitae-core.css, vitae-glass.css, vitae-light.css (nessa ordem)
- [ ] Importa Plus Jakarta Sans do Google Fonts
- [ ] Usa estrutura .phone > .notch + .content + .tab-bar
- [ ] Tab bar com 5 itens corretos
- [ ] Titulos usam peso 900, 26px, -0.8px letter-spacing
- [ ] Palavra-chave do titulo em italico verde
- [ ] Todos os icones sao SVG stroke (nenhum emoji, nenhuma biblioteca)
- [ ] Usa api.js pra falar com backend
- [ ] Cores seguem os tokens CSS
- [ ] Funciona no frame 393x852 E em tela cheia mobile
- [ ] Tom de voz institucional, sem mencionar IA
- [ ] Tem botao voltar ou navegacao clara
- [ ] Animacoes usam fadeUp com delays escalonados

---

## Template de Prompt pra IA

Copie e cole isso no inicio de qualquer conversa:

```
Estou trabalhando no vita id, um app de saude (RG Digital de Saude).
O projeto usa HTML puro + CSS + api.js (sem framework).

REGRAS OBRIGATORIAS:
- Design system: vitae-core.css (ler antes de criar qualquer coisa)
- Fonte: Plus Jakarta Sans (Google Fonts)
- Cores: #00E5A0 (green), #00B4D8 (cyan), #0D0F14 (texto), #F4F6FA (fundo)
- Gradiente marca: linear-gradient(120deg, #00E5A0, #00B4D8)
- Icones: SOMENTE SVG stroke (nunca emoji, nunca biblioteca)
- Tom: institucional serio, nunca mencionar IA pro usuario
- Titulos: palavra-chave em italico verde
- Frame celular: 393x852px, border-radius 52px
- Tab bar: 5 itens (Meu RG, Score, Exames, QR Code, Editar)
- Backend: api.js (porta 3002 local, Railway em producao)

NUNCA: usar emoji, mencionar IA/AI, usar FontAwesome/Material Icons,
criar tela fora do padrao, usar tom de startup casual.
```

---

## Exemplos de Certo vs Errado

### Texto pro usuario
- CERTO: "Seus medicamentos sao adicionados em segundos"
- ERRADO: "Nossa IA identifica seus medicamentos automaticamente"

### Titulo de pagina
- CERTO: `Seus <em>medicamentos</em>` (em verde com italico)
- ERRADO: `Medicamentos` (sem destaque)

### Icone
- CERTO: `<svg stroke="#00E5A0" fill="none" stroke-width="2">...</svg>`
- ERRADO: `<i class="fa fa-pill"></i>` ou `💊`

### Botao
- CERTO: `<button class="btn-primary">Escanear receita</button>`
- ERRADO: `<button style="background:blue">Scan com IA</button>`
