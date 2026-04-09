# MAPA DE IMPLEMENTACAO COMPLETO — vita id
# De nota 3 pra nota 10 em TUDO

Data: 09/04/2026
Filosofia: HM-init — planejar tudo antes de tocar em qualquer coisa
Modo: Execucao autonoma

---

## DOCUMENTO 1 — OBJETIVO DO PRODUTO

### O que o vita id faz
App de saude brasileiro. O paciente tem um "RG de Saude" digital com seus medicamentos, alergias, exames e score de saude. Pode compartilhar com medicos via QR Code.

### O diferencial
Nenhum app no Brasil permite escanear uma receita medica ou caixa de remedio e adicionar automaticamente ao perfil. O vita id faz isso.

### Fluxo principal do paciente
1. Tira foto de receita ou caixa de remedio
2. App identifica com 3 camadas (barcode 99% → OCR 95% → manual 100%)
3. Quiz conversacional confirma e completa informacoes
4. Medicamento adicionado ao perfil com lembretes
5. Cruzamento automatico com alergias

---

## DOCUMENTO 2 — PIPELINE DE IDENTIFICACAO

### 3 Camadas de seguranca

**CAMADA 1 — Codigo de barras (99% certeza)**
- Ferramenta: html5-qrcode (gratuita, funciona no navegador)
- Banco: Tabela CMED da ANVISA (15.000+ medicamentos brasileiros com EAN)
- Se barcode detectado → busca na CMED → identifica com 99% certeza

**CAMADA 2 — Leitura do texto (90-95% certeza)**
- Ferramenta: Google Cloud Vision (gratis ate 1.000/mes) + Claude Vision
- Duas leituras paralelas que se validam
- Se nome encontrado → busca na CMED → confirma

**CAMADA 3 — Busca manual (100% com paciente)**
- Autocomplete buscando na CMED offline
- Sempre disponivel como fallback

### Cascata de confianca
| Metodo | Confianca |
|--------|-----------|
| Codigo de barras EAN | 99%+ |
| Registro ANVISA | 99%+ |
| Nome + dosagem + laboratorio | 90-95% |
| So nome comercial | 70-85% |
| So principio ativo | 40-60% — pergunta |

### Fontes de dados (todas gratuitas)
| Recurso | O que e | Custo |
|---------|---------|-------|
| Tabela CMED | 15.000+ medicamentos BR | Gratis (ANVISA) |
| RxNorm API | Interacoes medicamentosas | Gratis (NIH) |
| OpenFDA API | Bulas e efeitos | Gratis (FDA) |
| Claude Vision | Interpretacao da foto | Ja temos |
| Google Cloud Vision | OCR + barcode | Gratis ate 1000/mes |

---

## DOCUMENTO 3 — EDUCACAO DO USUARIO (CAMERA)

### Primeira vez: tela de orientacao
- Animacao: mao segurando celular sobre caixa, barcode brilhando
- Texto: "Aponte para o codigo de barras"
- Subtexto: "Ele fica no verso ou na lateral da caixa"
- Botao: "Entendi"
- NAO aparece nas proximas vezes

### Camera com moldura inteligente
- Moldura horizontal (formato barcode) no centro
- Area fora escurecida
- Fantasma sutil de barcode dentro da moldura
- Status em tempo real: procurando → detectado → verde
- Auto-captura apos 1.5s estavel
- Dica apos 5s sem barcode: "Vire a caixa"
- Botao apos 10s: "Tire uma foto da caixa" (modo foto normal)
- Botao de lanterna, zoom, galeria

---

## DOCUMENTO 4 — QUIZ ADAPTATIVO

### Formato
Identico ao quiz de onboarding (05-quiz.html). Cards de selecao, uma pergunta por vez, barra de progresso.

### Perguntas (adaptativas — so pergunta o que nao sabe)

**P1 — Confirmacao do medicamento**
- Certeza alta (barcode): "Esse e o medicamento?" [Sim/Nao]
- Certeza media (OCR): "Qual destes?" [3 opcoes]
- Sem certeza: "Qual o nome?" [autocomplete CMED]

**P2 — Tipo de uso** (so se foto de caixa)
"Como voce usa?" [Continuo / Temporario / Quando precisa]

**P3 — Frequencia** (so se nao veio da receita)
"Quantas vezes por dia?" [1x / 2x / 3x / Outro]

**P4 — Horario** (so se nao veio da receita)
"Em que horario?" [Manha / Noite / Personalizar]

**P5 — Duracao** (so se temporario e nao sabe)
"Por quantos dias?" [5 / 7 / 10 / 30 / Outro]

**P6 — Observacao** (opcional)
"Instrucao especial?" [Em jejum / Com alimento / Nenhuma]

**Resumo:** "Lucas, tudo certo?" [Confirmar / Corrigir]

### Regras
1. Nunca mais que 6 perguntas
2. Pula o que ja sabe
3. Cards de selecao, nao formularios
4. Nome do paciente no resumo
5. Barra de progresso
6. Se confianca 95%+, quiz e so 2 perguntas

---

## DOCUMENTO 5 — FRASES DE PROCESSAMENTO

| Etapa | Frase |
|-------|-------|
| 1 | "Analisando sua foto..." |
| 2 | "Procurando em nosso sistema..." |
| 3 | "Medicamento detectado" |
| 4 | "Verificando seguranca..." |
| 5 | "Organizando tudo para [nome do paciente]" |

---

## DOCUMENTO 6 — COPY (TOM DE VOZ)

### Regras
- NUNCA mencionar: IA, inteligencia artificial, algoritmo, machine learning, OCR, scan
- Tom institucional (hospital moderno, nao startup)
- Sem exclamacoes desnecessarias
- Calmo ate nos alertas
- Nome da marca: "vita id" (minusculo)
- Verbos focados no usuario: "Adicionar medicamentos" nao "Escanear receita por IA"

### Exemplos
| Errado | Certo |
|--------|-------|
| "IA le a receita" | "Seus medicamentos sao adicionados em segundos" |
| "Alerta de Alergia!" | "Alergia identificada" |
| "4 medicamentos adicionados!" | "Pronto. 4 medicamentos adicionados" |
| "Lembretes criados automaticamente" | "Seus lembretes ja estao prontos" |
| "Nao consegui ler" | "Frequencia nao identificada — toque para completar" |

---

## DOCUMENTO 7 — AUDITORIA DE PROBLEMAS ATUAIS

### Seguranca (6 vulnerabilidades XSS)
1. 25-summary.html: foto do paciente
2. 08-perfil.html: foto do usuario
3. 08-perfil.html: condicoes de saude nas tags
4. 20-medico-dashboard.html: busca de pacientes
5. pre-consulta.html: resposta da IA
6. 20-medico-dashboard.html: opcoes de edicao

### Dados falsos (dados demo no app real)
1. 28-revisao-receita.html: array fixo de 4 medicamentos
2. 31-revisao-alergias.html: array fixo de 4 alergias
3. 30-lembretes.html: schedule fixo de 5 lembretes
4. 29-confirmacao.html: lembretes fixos

### Telas sem tratamento de erro (19 telas)
03-cadastro, 04-verificacao, 05-quiz, 08-perfil, 09-dados-pessoais, 10-score, 11-exames-lista, 14-esqueci-senha, 15-nova-senha, 16-medicamentos, 17-alergias, 20-medico-cadastro, 22-autorizacao, 23-agendamentos, 26-scan-receita, 27-processando, 28-revisao-receita, 30-lembretes, 31-revisao-alergias

### CSS: vitae-core.css nao importado por nenhuma tela
- 43 ocorrencias de #00E5A0 espalhadas
- 6 implementacoes diferentes de tab bar
- 24 valores diferentes de border-radius
- vitae-glass.css e vitae-light.css criando conflito

### Link quebrado
- pre-consulta.html: referencia "esqueci-senha.html" que nao existe (correto: 14-esqueci-senha.html)

### Navegacao inconsistente
- 08-perfil usa navigateTo()
- 28-revisao usa nav()
- 30-lembretes usa nav()
- Funcoes diferentes com comportamento diferente

### Lembretes nao persistem
- localStorage pra dados medicos (some se limpar cache)
- Sem sincronizacao com servidor
- Sem historico de adesao

---

## DOCUMENTO 8 — DESIGN SYSTEM COMPLETO

### Cores
- Primaria: #00E5A0
- Secundaria: #00B4D8
- Gradiente: linear-gradient(120deg, #00E5A0, #00B4D8)
- Gradiente vermelho: linear-gradient(120deg, #EF4444, #F87171)
- Fundo: #F4F6FA
- Card: #FFFFFF
- Texto primario: #0D0F14
- Texto secundario: #9CA3AF
- Texto terciario: #6B7280
- Perigo: #EF4444
- Alerta: #F59E0B
- Sucesso: #00C47A
- Info: #3B82F6

### Tipografia
- Fonte: Plus Jakarta Sans (500, 600, 700, 800)
- Titulo de pagina: 26px, weight 700
- Titulo de secao: 18px, weight 800
- Corpo: 14px, weight 500
- Label: 11px, weight 700, uppercase, letter-spacing 0.12em
- Badge: 10px, weight 700

### Espacamento (escala de 4px)
4, 8, 12, 16, 20, 24, 28, 32

### Arredondamento (4 niveis)
- Pequeno: 8px (badges, botoes pequenos)
- Medio: 14px (cards, inputs, botoes)
- Grande: 20px (modais, bottom sheets)
- Redondo: 50% (avatares, indicadores)

### Sombras (3 niveis)
- Sutil: 0 1px 12px rgba(0,0,0,0.07) — cards normais
- Media: 0 4px 24px rgba(0,0,0,0.10) — cards em destaque
- Forte: 0 12px 40px rgba(0,0,0,0.12) — flutuantes

### Tab bar
- Altura: 80px
- Fundo: rgba(255,255,255,0.95) com blur(20px)
- Borda top: 1px solid rgba(0,0,0,0.07)
- 5 itens: Meu RG, Score, Exames, QR Code, Editar
- Ativo: cor verde + ponto indicador
- Icones: SVG 22x22, stroke-width 2

### Titulos
- Palavra-chave em italico verde: "Seus *medicamentos*"
- Logo: "vita" escuro + "id" em caixa com gradiente

---

## DOCUMENTO 9 — PLANO DE EXECUCAO

### FASE 0 — Fundacao (Design System vira lei)

**0.1** Atualizar vitae-core.css com TODOS os componentes listados no Doc 8
**0.2** Migrar cada uma das 38 telas pra importar vitae-core.css
**0.3** Remover CSS inline duplicado de cada tela (manter so o especifico)
**0.4** Padronizar tab bar: 1 HTML + 1 funcao nav() em todas
**0.5** Eliminar vitae-glass.css e vitae-light.css (absorver no core)
**0.6** Verificar: todas as telas identicas visualmente apos migracao

### FASE 1 — Seguranca

**1.1** Criar funcao sanitize() no api.js
**1.2** Aplicar sanitize() nos 6 pontos de XSS identificados
**1.3** Validar tipo e tamanho de dados do servidor
**1.4** Desabilitar botoes durante envio (prevenir duplo-clique)
**1.5** Corrigir link quebrado em pre-consulta.html

### FASE 2 — Integridade de Dados

**2.1** Remover TODOS os dados demo (4 arquivos)
**2.2** Se scan falha: mostrar erro claro + opcoes (nao dados falsos)
**2.3** Adicionar loading state em todos os botoes de acao (19 telas)
**2.4** Adicionar tratamento de erro em todas as chamadas de API (19 telas)
**2.5** Validar sessionStorage entre telas do fluxo de scan
**2.6** Limpar dados temporarios apos fluxo completar

### FASE 3 — Funcionalidade Nova

**3.1** Importar tabela CMED pro banco (15.000+ medicamentos)
**3.2** Implementar leitura de barcode com html5-qrcode
**3.3** Implementar pipeline 3 camadas (barcode → OCR → manual)
**3.4** Implementar quiz adaptativo (formato onboarding)
**3.5** Implementar educacao do usuario na camera (onboarding de scan)
**3.6** Implementar frases de processamento com nome do paciente
**3.7** Criar rota POST /medicamentos/dose-tomada no backend
**3.8** Criar rota GET /medicamentos/doses-hoje no backend
**3.9** Migrar lembretes de localStorage pra servidor + cache local

### FASE 4 — Qualidade (HM-QA)

**4.1** Testar scan com 10 fotos reais de medicamentos BR
**4.2** Testar scan com 5 fotos ruins
**4.3** Testar fluxo completo: login → scan → quiz → confirmar → lembrete
**4.4** Testar alerta de alergia com conflito real
**4.5** Testar offline (busca CMED sem internet)
**4.6** Testar duplo-clique em todos os botoes
**4.7** Testar em iPhone Safari e Android Chrome
**4.8** Corrigir bugs encontrados

---

## DOCUMENTO 10 — TABELA DE NOTAS ESPERADAS

| Area | Hoje | Fase 0 | Fase 1 | Fase 2 | Fase 3 | Fase 4 |
|------|------|--------|--------|--------|--------|--------|
| Design Visual | 7 | 10 | 10 | 10 | 10 | 10 |
| Design System | 3 | 10 | 10 | 10 | 10 | 10 |
| Seguranca | 4 | 4 | 10 | 10 | 10 | 10 |
| Tratamento Erros | 2 | 2 | 2 | 10 | 10 | 10 |
| Integridade Dados | 3 | 3 | 3 | 10 | 10 | 10 |
| Prontidao Lancamento | 3 | 3 | 4 | 6 | 9 | 10 |
| **MEDIA** | **3.7** | **5.3** | **6.5** | **9.3** | **9.8** | **10** |

---

## DOCUMENTO 11 — DETALHES QUE NAO PODEM SER ESQUECIDOS

1. Permissao da camera: tratar caso de negado
2. Lanterna na camera pra ambientes escuros
3. Zoom pra barcodes pequenos (gotas, pomada)
4. Medicamentos sem barcode (blisters soltos, manipulados)
5. Multiplos medicamentos na mesma receita (quiz passa por cada um)
6. Medicamento ja cadastrado: avisa em vez de duplicar
7. Alerta de alergia DENTRO do quiz (nao tela separada)
8. CMED offline (busca funciona sem internet)
9. Historico de scans salvo (foto + resultado + confirmacao)
10. Orientacao do celular (horizontal pra barcode)
11. Receita digital com QR Code (extrair dados estruturados)
12. Diferenca caixa vs receita (caixa nao tem horario, receita tem)
13. Nunca inventar horario ou dosagem
14. Nome do paciente nas frases de processamento
15. Primeira vez: educacao. Proximas: direto pra camera

---

## GARANTIAS DE SEGURANCA

| Cenario | O que acontece |
|---------|---------------|
| Barcode legivel | 99% certeza (padrao de farmacias) |
| Barcode ilegivel, texto visivel | 95% certeza (Google Cloud Vision) |
| Nada legivel | Paciente digita (autocomplete CMED) |
| Internet fora | Busca offline na CMED local |
| IA inventa info | IA so le texto; dados de fontes oficiais |
| Medicamento nao na tabela | "Digite o nome" + adiciona manual |
| Alergia ao medicamento | Alerta dentro do quiz |
| Foto ruim | Feedback tempo real + fallback manual |
| Duplicado | Avisa e oferece atualizar |
| Servidor fora | Erro claro + opcao manual |
| Duplo-clique | Botao desabilitado apos primeiro toque |
| XSS/ataque | Dados sanitizados antes de exibir |

**Nao existe cenario sem saida. Nao existe dado falso. Nao existe erro silencioso.**
