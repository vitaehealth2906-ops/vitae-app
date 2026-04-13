# Identidade Visual — vita id

> Voltar pra [[00-CENTRAL]]

---

## Logo

- **vita** sempre em minuscula, peso 800
- **id** dentro de caixa com gradiente verde→ciano
- Fonte: Plus Jakarta Sans, peso 800, letter-spacing: -0.8px
- Nunca separar "vita" de "id" — sempre juntos
- Em fundo escuro: "vita" branco + "id" caixa gradiente
- Em fundo claro: "vita" preto + "id" caixa gradiente
- Arquivo: `vitaid-logo.svg`

---

## Cores da Marca

### Principais
| Nome | Hex | Uso |
|------|-----|-----|
| Green (principal) | #00E5A0 | Botoes, destaques, icones ativos, gradiente |
| Green escuro | #00C47A | Textos de sucesso |
| Cyan (secundaria) | #00B4D8 | Gradiente junto com green |

### Gradientes
| Nome | Valor | Uso |
|------|-------|-----|
| Marca | linear-gradient(120deg, #00E5A0, #00B4D8) | Botoes primarios, logo, FAB |
| Perigo | linear-gradient(120deg, #EF4444, #F87171) | Botao de excluir |

### Texto (5 niveis de cinza)
| Nome | Hex | Uso |
|------|-----|-----|
| Ink 1 | #0D0F14 | Titulos |
| Ink 2 | #4B5563 | Corpo de texto |
| Ink 3 | #6B7280 | Texto secundario |
| Ink 4 | #9CA3AF | Labels, subtitulos |
| Ink 5 | #C4C9D4 | Placeholders, desabilitado |

### Fundos
| Nome | Hex | Uso |
|------|-----|-----|
| Background | #F4F6FA | Fundo geral do app |
| Surface | #FFFFFF | Fundo de cards |
| Dark | #0D0F14 | Fundos escuros (splash, toast) |

### Semanticas (status)
| Nome | Hex | Uso |
|------|-----|-----|
| Sucesso | #00C47A | Exame normal, confirmacao |
| Atencao | #F59E0B | Exame merece atencao |
| Critico | #EF4444 | Exame critico, erros, alergias |
| Info | #3B82F6 | Informacao neutra |

---

## Tipografia

**Fonte unica:** Plus Jakarta Sans (Google Fonts)

| Peso | Uso |
|------|-----|
| 400 | Corpo de texto, descricoes |
| 500 | Inputs, campos |
| 600 | Labels, subtitulos |
| 700 | Nomes, botao secundario |
| 800 | Logo, titulos de card |
| 900 | Titulos de pagina |

### Estilos de Titulo
- **Titulo de pagina:** 26px, peso 900, letter-spacing -0.8px
- **Palavra-chave em italico verde:** "Seus *medicamentos*" — a palavra principal fica em italico cor #00E5A0
- **Label de secao:** 11px, peso 700, uppercase, letter-spacing 1.5px, cor #9CA3AF
- **Subtitulo:** 13px, peso 400, cor #9CA3AF

---

## Icones

- SVG stroke (NUNCA fill, NUNCA emoji, NUNCA FontAwesome/Material Icons)
- stroke-width: 2
- stroke-linecap: round
- stroke-linejoin: round
- Tamanhos: 22x22 (tab bar), 18x18 (badges), 16x16 (fields), 12x12 (pills)

---

## Componentes Visuais

### Botao Primario
- Background: gradiente da marca
- Cor do texto: branco
- Border-radius: 14px
- Sombra: 0 4px 20px rgba(0,229,160,0.18)
- Hover: sobe 1px
- Active: escala 0.97

### Botao Secundario
- Background: branco
- Borda: 1px solid rgba(0,0,0,0.07)
- Border-radius: 14px
- Cor do texto: #0D0F14

### Botao Perigo
- Background: gradiente vermelho
- Cor do texto: branco
- Border-radius: 14px

### Input
- Background: branco
- Borda: 1.5px solid rgba(0,0,0,0.07)
- Border-radius: 14px
- Focus: borda verde, fundo verde 4%, sombra verde 8%

### Card
- Background: #FFFFFF
- Borda: 1px solid rgba(0,0,0,0.07)
- Border-radius: 14px
- Sombra: 0 1px 12px rgba(0,0,0,0.07)
- Padding: 16px
- Margem lateral: 20px

### Badge
- Border-radius: 100px (pill)
- Padding: 3px 10px
- Font-size: 10px, peso 700
- Variantes: green, red, warn, blue (cor de fundo 6-8% opacity)

### Allergy Pill
- Border-radius: 100px
- Background: rgba(217,68,82,0.06)
- Borda: 1px solid rgba(217,68,82,0.12)
- Cor: rgba(217,68,82,0.8)
- Icone SVG 12x12 + nome

### Tab Bar
- 5 itens fixos: Meu RG, Score, Exames, QR Code, Editar
- Altura: 86px
- Background: rgba(255,255,255,0.95) com blur(30px)
- Ativo: icone e label ficam #00E5A0
- Inativo: #9CA3AF

### Toast
- Background: #0D0F14
- Cor: branco
- Border-radius: 14px
- Posicao: fixo, bottom 100px, centralizado

### Glass Effect
- backdrop-filter: blur(20px) saturate(120%)
- Background: rgba(255,255,255,0.85)
- Usado em: cards, botoes, tab bar

---

## Frame de Celular

- Largura: 393px
- Altura: 852px
- Border-radius: 52px
- Dynamic Island (notch): 126x34px, centralizado no topo
- Em mobile real (<480px): frame desaparece, tela fica full-screen
- Background externo: #1a1a2e (escuro atras do frame)

---

## Animacoes

- fadeUp: sobe 20px com fade (0.4s)
- Delays escalonados: 0.05s entre cada elemento (ate 8 niveis)
- Transicao padrao: cubic-bezier(0.4, 0, 0.2, 1), 0.25s
- Saida de pagina: overlay branco com fade 0.5s

---

## Arquivos CSS

| Arquivo | O que faz | Ordem de carregamento |
|---------|-----------|----------------------|
| vitae-core.css | Tokens, reset, frame, TODOS os componentes | 1o |
| vitae-glass.css | Efeito glass (blur, transparencia) | 2o |
| vitae-light.css | Overrides de tema claro | 3o (depois do glass) |

---

## Tom de Voz

Ver [[07-REGRAS-IA]] para as regras completas de comunicacao.

Resumo:
- Institucional serio (hospital de referencia)
- Foco no beneficio, nunca no "como"
- NUNCA mencionar IA/AI pro usuario
- ZERO emojis
- Verbos de acao: "Escanear receita", "Adicionar medicamento"
