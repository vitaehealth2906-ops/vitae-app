# Objetivo de Implementacao — Fluxo de Medicamentos vita id

## Visao Geral

O paciente tira foto de um medicamento (caixa, gotas, receita) e o app identifica, confirma com o paciente atraves de um quiz conversacional, e adiciona ao perfil com lembretes.

---

## Pipeline de 6 Etapas + Quiz

### ETAPA 1 — A foto e boa o suficiente?
Antes de qualquer coisa: a foto esta nitida? Tem luz suficiente? Da pra ver o que tem nela?
Se a foto esta borrada, escura, ou cortada → pede pro paciente tirar de novo.

### ETAPA 2 — O que tem nessa foto?
Identificar SE e um medicamento e de que TIPO:
- Caixa de remedio → segue pro passo 3
- Frasco de gotas → segue pro passo 3
- Receita medica (papel do medico) → segue pro passo 3
- Receita digital (PDF com QR) → segue pro passo 3
- Bula → informa: "Isso parece ser uma bula. Fotografe a caixa ou a receita"
- Nao e medicamento → informa: "Nao identificamos um medicamento nesta foto"

### ETAPA 3 — Ler tudo que esta escrito
Duas leituras paralelas:
- **Leitura 1 — Inteligencia (Claude Vision):** Olha pra foto e entende o contexto
- **Leitura 2 — OCR tecnico (Google Cloud Vision):** Le todas as letras e numeros + codigo de barras

As duas leituras se validam mutuamente. Se concordam = confianca alta. Se discordam = pede confirmacao.

### ETAPA 4 — Confirmar com certeza absoluta
Cascata de confirmacao:

| Metodo | Confianca |
|--------|-----------|
| Codigo de barras (EAN) | 99%+ |
| Numero de registro ANVISA | 99%+ |
| Nome comercial + dosagem + laboratorio | 90-95% |
| So o nome comercial | 70-85% |
| So o principio ativo | 40-60% — pergunta pro paciente |

Busca na **Tabela CMED** (15.000+ medicamentos brasileiros, gratuita, da ANVISA).

### ETAPA 5 — Pesquisar informacoes completas
So depois de ter certeza, buscar:
- Indicacao (pra que serve)
- Posologia padrao
- Efeitos colaterais
- Contraindicacoes
- Interacoes medicamentosas
- Tarja (se precisa de receita)

Fontes: Bulario ANVISA, RxNorm API (gratuita), OpenFDA API (gratuita), Claude.

### ETAPA 6 — Verificar seguranca
Cruzar com:
- Alergias do paciente
- Outros medicamentos que ja toma
- Contraindicacoes

---

## Quiz de Confirmacao (Adaptativo)

Formato identico ao quiz de onboarding (05-quiz.html). Cards de selecao, uma pergunta por vez, barra de progresso.

### Pergunta 1 — Confirmacao do medicamento
Se certeza alta: "Esse e o medicamento correto?" [Sim / Nao]
Se certeza media: "Qual destes e o seu?" [3 opcoes]
Se sem certeza: "Qual o nome do medicamento?" [autocomplete da CMED]

### Pergunta 2 — Tipo de uso (so se foto de caixa)
"Como voce usa?" [Uso continuo / Tratamento temporario / Conforme necessario]

### Pergunta 3 — Frequencia (so se nao veio da receita)
"Quantas vezes por dia?" [1x / 2x / 3x / Outro]

### Pergunta 4 — Horario (so se nao veio da receita)
"Em que horario?" [Manha / Tarde / Noite / Antes de dormir / Personalizar]

### Pergunta 5 — Duracao (so se temporario e nao sabe)
"Por quantos dias?" [3 / 5 / 7 / 10 / 14 / 30 / Outro]

### Pergunta 6 — Observacao (opcional)
"Instrucao especial?" [Em jejum / Com alimento / Antes de dormir / Nenhuma]

### Resumo
"Lucas, tudo certo?" [card com resumo completo] [Confirmar / Voltar e corrigir]

---

## Regras do Quiz

1. Nunca mais que 6 perguntas
2. Se o app ja sabe a resposta, pula a pergunta
3. Cards de selecao, nao formularios
4. Nome do paciente aparece na ultima etapa
5. Barra de progresso no topo
6. Botao Voltar em cada pergunta
7. Se confianca 95%+, quiz e so 2 perguntas

---

## Frases da Tela de Processamento

| Etapa | Frase |
|-------|-------|
| 1 | "Analisando sua foto..." |
| 2 | "Procurando em nosso sistema..." |
| 3 | "Medicamento detectado" |
| 4 | "Verificando seguranca..." |
| 5 | "Organizando tudo para [nome do paciente]" |

---

## Diferenca: Foto de Caixa vs Receita

### Foto de CAIXA/EMBALAGEM
O app sabe: nome, dosagem, forma, laboratorio
O app NAO sabe: frequencia, horario, duracao
→ Quiz pergunta frequencia, horario, duracao

### Foto de RECEITA MEDICA
O app sabe: nome, dosagem, frequencia, duracao
→ Quiz so confirma e mostra resumo (2 perguntas)

---

## Banco de Dados Necessario

| Recurso | O que e | Custo |
|---------|---------|-------|
| Tabela CMED | 15.000+ medicamentos brasileiros | Gratis (ANVISA) |
| RxNorm API | Busca por nome + interacoes | Gratis (NIH) |
| OpenFDA API | Bulas e efeitos colaterais | Gratis (FDA) |
| Claude Vision | Interpretacao da foto | Ja temos |
| Google Cloud Vision | OCR + barcode | Gratis ate 1000/mes |

---

## Campos Novos no Banco

- tipo_uso: continuo / temporario / conforme_necessidade
- confianca_identificacao: alta / media / baixa
- fonte_identificacao: foto_caixa / foto_receita / manual / barcode
- ean_barcode: codigo de barras lido (se disponivel)
- anvisa_registro: numero de registro ANVISA (se disponivel)

---

## 3 Camadas de Identificacao (com provas)

### CAMADA 1 — Codigo de barras (99% de certeza)
Todo medicamento no Brasil tem um codigo de barras EAN-13 na caixa. Se o app le esse codigo, busca na tabela CMED e identifica com 99%+ de certeza.
- **Prova:** Mesmo metodo usado por farmacias e supermercados ha decadas
- **Ferramenta:** html5-qrcode (gratuita, funciona no navegador, iPhone e Android)
- **Quando falha:** Barcode nao visivel, cortado, ou borrado → vai pra Camada 2

### CAMADA 2 — Leitura do texto da embalagem (90-95% de certeza)
O app manda a foto pro Google Cloud Vision, que le todas as letras da embalagem. Pega o nome e busca na tabela CMED.
- **Prova:** Google Cloud Vision tem 95-99% de acerto em texto impresso. Em teste, acertou 100% onde outra ferramenta acertou 24%
- **Custo:** Gratis ate 1.000 fotos/mes. Depois R$8 a cada 1.000 fotos
- **Quando falha:** Nome parcialmente visivel, reflexo, foto escura → vai pra Camada 3

### CAMADA 3 — Busca manual com autocomplete (100% com participacao do paciente)
O paciente digita o nome. Autocomplete busca na tabela CMED (15.000+ medicamentos).
- **Prova:** Metodo mais antigo e confiavel. Funciona offline (tabela salva no app)
- **Quando usar:** Apos 2 tentativas de foto sem sucesso, ou quando o paciente prefere

### Por que a IA NAO e o metodo principal
- Estudo da Nature: GPT-4 Vision acerta 85% em embalagens → 1 erro a cada 7
- Estudo JAMA: IA erra 47% nas interacoes medicamentosas
- IA inventa informacoes (alucinacao) 18% das vezes
- **Conclusao:** IA so e usada pra LER texto. Dados vem de fontes oficiais (CMED/ANVISA)

---

## Educacao do Usuario (Camera Onboarding)

### Dados que comprovam a necessidade
- Sem orientacao: 40-60% dos usuarios erram na primeira tentativa
- Com orientacao animada + moldura: erro cai pra 5-8%
- Usuarios idosos/nao-tecnicos sem orientacao: 70% de falha
- Cada tentativa que falha, 15-20% dos usuarios desistem
- Animacao de posicionamento melhora acerto em 25-40% vs so texto

### Primeira vez: tela de orientacao (antes da camera)
- Animacao simples: mao segurando celular sobre caixa de remedio, barcode brilhando
- Texto grande: "Aponte para o codigo de barras"
- Texto menor: "Ele fica no verso ou na lateral da caixa"
- Botao: "Entendi"
- NAO aparece nas proximas vezes (so na primeira)
- Botao "?" no canto da camera pra rever

### Camera com moldura inteligente
1. **Moldura horizontal** no centro (formato barcode). Area fora escurecida
2. **Fantasma sutil** de barcode dentro da moldura (paciente entende "encaixar aqui")
3. **Texto acima:** "Posicione o codigo de barras aqui"
4. **Status em tempo real:**
   - Procurando: bolinha pulsando + "Procurando codigo de barras..."
   - Detectou: moldura fica VERDE + "Codigo detectado!" + vibracao sutil
   - Foto ruim: "Aproxime mais" ou "Melhore a iluminacao"
5. **Abaixo:** "Nao encontra o codigo? Tire uma foto da frente da caixa"
6. **Botao de galeria** no canto

### Comportamento automatico da camera

| Situacao | O que acontece |
|----------|---------------|
| Barcode detectado | Moldura verde. Auto-captura em 1s. Flash sutil |
| 5s sem barcode | Dica: "Vire a caixa para o lado do codigo de barras" |
| 10s sem barcode | Botao: "Tire uma foto da caixa" (modo foto normal) |
| Foto manual tirada | Vai pra Camada 2 (OCR no texto) |
| Paciente escolheu galeria | Aceita qualquer foto, processa normalmente |

---

## Detalhes que Quase Esqueci

### 1. Permissao da camera
Se o paciente negou permissao antes: "Precisamos da camera para identificar seu medicamento. Ative nas configuracoes." + botao que abre configuracoes do celular.

### 2. Lanterna/flash
Botao de lanterna na camera. Caixas de remedio ficam em locais escuros (gaveta, armario).

### 3. Zoom
Se barcode e pequeno (gotas, pomada), gesto de pinca ou botao de zoom.

### 4. Orientacao do celular
Barcode e horizontal. Se paciente virar celular na vertical, dica: "Mantenha o celular na horizontal".

### 5. Medicamentos sem barcode
Blisters soltos, manipulados, importados. App detecta (10s sem barcode) → oferece foto normal → OCR → ou digitar.

### 6. Multiplos medicamentos na receita
Quiz passa por cada um separadamente: "Proximo: Ibuprofeno 600mg. Confirma?" → "Quantas vezes por dia?" → proximo.

### 7. Medicamento ja cadastrado
Se ja esta no perfil: "Rivotril 2mg ja esta na sua lista. Quer atualizar as informacoes?" Nao adiciona duplicado.

### 8. Alerta de alergia DURANTE o quiz
Se conflita com alergia, alerta aparece DENTRO do quiz:
"Atencao: voce tem alergia registrada a Dipirona. Este medicamento contem Dipirona."
[ Nao adicionar ] [ Adicionar mesmo assim ]

### 9. Dados offline
Tabela CMED salva no app. Busca por nome funciona sem internet. Upload de foto precisa de internet.

### 10. Historico de scans
Cada scan salvo com: foto original, resultado, confianca, o que paciente confirmou/corrigiu. Serve pra melhorar o sistema e auditoria.

---

## Mapa Visual Completo

```
BOTTOM SHEET
  "Tirar foto" / "Galeria" / "Digitar"
        |
        v
EDUCACAO (so 1a vez)
  Animacao: mao + celular + barcode brilhando
  "Aponte para o codigo de barras"
  [ Entendi ]
        |
        v
CAMERA COM MOLDURA
  Moldura horizontal (formato barcode)
  Area ao redor escurecida
  Fantasma sutil de barcode dentro da moldura
  Status em tempo real (procurando → detectado → verde)
        |
   ┌────┴────┐
   |         |
BARCODE    SEM BARCODE (5s)
DETECTADO  → "Vire a caixa" (dica)
   |         |
   |    SEM BARCODE (10s)
   |    → "Tire uma foto da caixa" (botao)
   |         |
   v         v
CAMADA 1   CAMADA 2
(barcode    (OCR texto
 → CMED)    → CMED)
 99%        90-95%
   |         |
   |    FALHOU?
   |    → CAMADA 3 (digitar nome + autocomplete CMED)
   |         |
   └────┬────┘
        |
        v
PROCESSAMENTO
  Miniatura da foto
  5 etapas com nome do paciente
  Espera API terminar
        |
        v
QUIZ ADAPTATIVO
  2-6 perguntas (depende do que ja sabe)
  Cards de selecao (estilo onboarding)
  Barra de progresso
  Alerta de alergia se houver
  Nome do paciente no resumo
        |
        v
SUCESSO + LEMBRETES
```

---

## Garantias de Seguranca

| Cenario | O que acontece | Garantia |
|---------|---------------|----------|
| Barcode legivel | 99% certeza via CMED | Padrao mundial de farmacias |
| Barcode ilegivel, texto visivel | 95% certeza via OCR + CMED | Google Cloud Vision comprovado |
| Nem barcode nem texto | Paciente digita, autocomplete CMED | 100% com participacao humana |
| Internet fora | Busca offline na CMED local | Funciona sem conexao |
| IA inventa informacao | Nao usamos IA pra decidir, so pra ler | Dados de fontes oficiais |
| Medicamento nao esta na tabela | "Digite o nome completo" + adiciona manual | Paciente tem controle |
| Alergia ao medicamento | Alerta dentro do quiz antes de confirmar | Cruzamento automatico |
| Foto ruim | Feedback em tempo real + 3 tentativas + fallback manual | Nunca fica preso |
| Medicamento duplicado | Avisa e oferece atualizar | Nao adiciona duplicado |

**Nao existe cenario onde o paciente fica sem saida.**
**Nao existe cenario onde o app inventa informacao.**
**Nao existe cenario onde um erro passa silenciosamente.**
