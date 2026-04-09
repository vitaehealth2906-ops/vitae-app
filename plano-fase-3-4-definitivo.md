# PLANO DEFINITIVO — Fases 3 e 4
# Implementacao completa do scan de medicamentos vita id

Data: 09/04/2026
Modo: Execucao autonoma (apos aprovacao deste documento)

---

## O QUE ESTE DOCUMENTO COBRE

Tudo que falta pra transformar o vita id num produto real:
- Como identificar medicamentos por foto (3 camadas)
- Como educar o paciente a usar a camera
- Como confirmar com o paciente (quiz/confirmacao)
- Como lidar com TODOS os tipos de medicamento (caixa, receita, gotas, manipulado, suplemento, importado)
- Como lidar com TODOS os cenarios de erro
- Como testar tudo
- O que nao pode ser esquecido (60+ cenarios mapeados)

---

## PARTE 1 — O BANCO DE MEDICAMENTOS

### O que e a tabela CMED
A ANVISA publica todo mes um arquivo Excel com todos os medicamentos vendidos no Brasil. Tem ~15.000 produtos com: nome, principio ativo, dosagem, laboratorio, codigo de barras, tipo (generico/referencia/similar), classe terapeutica, preco.

### O problema do arquivo grande
Se transformarmos esse Excel num arquivo JSON de 3-4MB e o app carregar ele toda vez, celulares mais simples (Moto G4, Samsung J2 — muito comuns no Brasil) vao travar por 2-8 segundos. O paciente vai achar que o app bugou.

### A solucao
Em vez de um arquivo JSON grande, vamos usar um banco de dados local leve (SQLite) que pesa ~1.5MB comprimido e faz buscas instantaneas. O paciente nao percebe nenhum carregamento.

### O que guardar no banco local
| Campo | Exemplo | Pra que serve |
|-------|---------|---------------|
| codigo_barras (EAN) | 7891234567890 | Identificacao por scan (99% certeza) |
| registro_anvisa | 1.2345.6789.001-2 | Identificacao alternativa |
| nome_produto | Rivotril | Nome que aparece pro paciente |
| principio_ativo | Clonazepam | Busca generica |
| apresentacao | 2mg Comprimido | Dosagem + forma |
| laboratorio | Roche | Identificacao extra |
| tipo | Referencia/Generico/Similar | Info pro paciente |
| classe_terapeutica | Ansiolítico | Categoria |
| tarja | Preta/Vermelha/Sem | Se precisa receita |
| preco_medio | 25.50 | Info opcional |

### Limpeza dos dados
A tabela CMED tem erros conhecidos:
- Codigos de barras com digitos faltando (devem ter 13, alguns tem 12)
- Codigos de barras duplicados (2 produtos diferentes com o mesmo codigo)
- Caracteres estranhos nos precos

Antes de usar, o sistema limpa: completa zeros, remove duplicatas, padroniza texto.

### Atualizacao
Todo mes, baixar a nova tabela e atualizar o banco local. Pode ser automatico (background) ou manual (botao "atualizar banco de medicamentos" nas configuracoes).

---

## PARTE 2 — IDENTIFICACAO POR FOTO (3 CAMADAS)

### CAMADA 1 — Codigo de barras (99% certeza)
- **Ferramenta:** html5-qrcode (60KB, funciona no navegador, iPhone e Android)
- **Como:** Camera le o codigo de barras EAN-13 em tempo real
- **Onde busca:** Banco local (CMED) — busca instantanea, funciona offline
- **Se encontrar:** Identificacao imediata, vai pro quiz de confirmacao
- **Se NAO encontrar (barcode lido mas nao esta no banco):** Mensagem: "Codigo encontrado mas nao reconhecido. Vamos tentar de outra forma" → vai pra Camada 2

### CAMADA 2 — Leitura do texto (90-95% certeza)
- **Ferramenta:** Google Cloud Vision (gratis ate 1.000/mes)
- **Alternativa:** Claude Vision (ja temos)
- **Como:** Foto enviada → texto extraido → busca por nome no banco local usando Fuse.js (busca inteligente com tolerancia a erros)
- **Se encontrar:** Mostra pro paciente confirmar (pode ter mais de 1 resultado)
- **Se NAO encontrar:** Vai pra Camada 3

### CAMADA 3 — Busca manual (100% com paciente)
- **Como:** Campo de busca com autocomplete (Fuse.js, 5KB)
- **Busca em:** Nome do produto + principio ativo + apresentacao
- **Funciona offline:** Sim (banco local)
- **Tolera erros:** Sim ("rivotri" encontra "Rivotril")

### CAMADA ESPECIAL — Medicamento nao encontrado em nenhum lugar
Se depois de barcode + OCR + busca manual o medicamento nao esta no banco:
- Permitir adicao LIVRE: paciente digita nome, dosagem, frequencia
- Marcar como "nao verificado" no perfil
- Motivos: manipulado, importado, suplemento, medicamento muito novo

---

## PARTE 3 — TIPOS DE MEDICAMENTO (cada um tratado diferente)

### Tipo 1: Caixa de remedio (mais comum)
- **Tem barcode:** Sim → Camada 1
- **Tem nome visivel:** Sim → Camada 2 se barcode falhar
- **O que o app sabe:** Nome, dosagem, forma, laboratorio
- **O que NAO sabe:** Frequencia, horario, duracao
- **Quiz pergunta:** Frequencia + horario + tipo de uso

### Tipo 2: Receita medica impressa
- **Tem barcode:** Nao
- **Tem nomes visiveis:** Sim (texto impresso)
- **O que o app sabe:** Todos os medicamentos + dosagem + frequencia + duracao
- **Quiz:** So confirma (2 perguntas)
- **Diferencial:** 1 foto = multiplos medicamentos

### Tipo 3: Receita medica manuscrita
- **Precisao do OCR:** Muito baixa (40-60%)
- **Tratamento:** NAO tentar ler automaticamente
- **Mensagem:** "Receitas manuscritas sao dificeis de ler. Tente escanear a caixa do medicamento ou digite o nome"

### Tipo 4: Frasco de gotas / colírio
- **Tem barcode:** As vezes (rotulo pequeno)
- **Desafio:** Texto muito pequeno, superficie curva
- **Tratamento:** Tentar barcode → OCR → manual
- **Dica na camera:** "Para frascos pequenos, coloque em uma superficie plana"

### Tipo 5: Pomada / creme / gel
- **Tem barcode:** Sim (na caixa externa)
- **Desafio:** Se o paciente so tem o tubo (sem caixa), barcode pode nao existir
- **Tratamento:** Tentar barcode → OCR no tubo → manual

### Tipo 6: Medicamento manipulado (farmacia de manipulacao)
- **Tem barcode:** NAO
- **Esta no banco CMED:** NAO
- **E muito comum no Brasil:** SIM (10-15% dos pacientes usam)
- **Tratamento especial:**
  - Detectar cedo: "Este e um medicamento manipulado?"
  - Se sim: pular scan, ir direto pra entrada manual
  - Campos: nome da formula, dosagem, frequencia, farmacia
  - NAO buscar no banco (nao vai encontrar)

### Tipo 7: Suplemento / vitamina
- **Esta no banco CMED:** Alguns sim, maioria nao
- **Paciente quer adicionar:** SIM (faz parte da rotina)
- **Tratamento:** Tentar barcode → se nao encontrar, permitir adicao livre
- **Copy:** Usar "medicamento ou suplemento" em vez de so "medicamento"

### Tipo 8: Medicamento importado
- **Barcode:** Pode ser formato diferente (nao EAN-13)
- **Esta no banco CMED:** NAO
- **Tratamento:** Detectar barcode nao-brasileiro → "Medicamento importado. Adicione manualmente"

---

## PARTE 4 — EDUCACAO DO USUARIO (CAMERA)

### Primeira vez: tela de orientacao
- Animacao simples: mao segurando celular sobre caixa de remedio
- Barcode da caixa brilhando pra mostrar onde e
- Texto: "Aponte para o codigo de barras"
- Subtexto: "Ele fica no verso ou na lateral da caixa"
- Botao: "Entendi"
- So aparece na primeira vez. Nas proximas, direto pra camera.
- Botao "?" no canto pra rever a orientacao.

### Camera com moldura inteligente
- Moldura horizontal (formato barcode) no centro
- Area fora levemente escurecida (foca o olho no centro)
- Fantasma sutil de barcode dentro da moldura
- Status em tempo real:
  - Procurando: bolinha pulsando + "Procurando codigo de barras..."
  - Detectou: moldura VERDE + "Codigo encontrado!" + vibracao
  - Foto ruim: "Aproxime mais" ou "Melhore a iluminacao"
- Auto-captura apos 1.5 segundo com barcode estavel
- Botao de lanterna (pra ambientes escuros)
- Auto-deteccao de pouca luz: "Parece escuro. Ligar lanterna?"
- Botao de galeria (pra quem ja tem a foto)

### Dicas progressivas (se nao acha o barcode)
| Tempo | O que aparece |
|-------|---------------|
| 0-5s | Moldura + "Procurando codigo de barras..." |
| 5s | Dica: "Vire a caixa — o codigo fica no verso ou na lateral" |
| 10s | Botao: "Nao encontra? Tire uma foto da frente da caixa" |
| 15s | Botao: "Ou digite o nome do medicamento" |

### Cenarios especiais
- **Maos tremendo (idoso, Parkinson):** Dica: "Coloque a caixa em uma mesa e aponte de cima"
- **Etiqueta de preco cobrindo barcode:** Dica: "Se tiver adesivo de preco sobre o codigo, tente remover"
- **Tela preta na camera:** Detectar e mostrar: "Camera com problema. Feche e abra novamente, ou escolha uma foto da galeria"
- **Foto de foto (paciente fotografa a tela do computador):** OCR vai ter qualidade ruim → fallback pra manual

---

## PARTE 5 — CONFIRMACAO COM O PACIENTE

### O formato: confirmacao rapida, nao quiz longo

Mudanca importante baseada na analise: em vez de 6 perguntas de quiz, o formato ideal e um **card de resumo com botoes de edicao**. Mais rapido, menos cansativo.

### Como funciona

**Se barcode identificou com 99% certeza:**

O paciente ve UM card:

```
┌──────────────────────────────────┐
│  Rivotril 2mg                     │
│  Clonazepam · Comprimido          │
│  Laboratorio Roche                │
│                                    │
│  Quantas vezes por dia? [1x ▼]   │
│  Em que horario?       [08:00 ▼]  │
│  Tipo de uso?   [Uso continuo ▼]  │
│                                    │
│  [ Confirmar e adicionar ]         │
│  [ Nao e esse medicamento ]        │
└──────────────────────────────────┘
```

Os campos de frequencia, horario e tipo ja vem com sugestoes inteligentes (baseadas na bula do medicamento). O paciente so ajusta o que for diferente. 1 tela, 1 toque no botao.

**Se OCR identificou com 90% certeza:**

O paciente ve o mesmo card MAS com uma pergunta extra no topo:

```
"Esse e o seu medicamento?"
[ Sim ] [ Nao — mostrar opcoes ]
```

Se tocar "Nao", aparece lista com alternativas da busca.

**Se nao identificou:**

Campo de busca com autocomplete. Paciente digita, seleciona, e ve o card de confirmacao.

### Sugestoes inteligentes (pre-preenchimento)

Baseado no que o banco CMED e a bula dizem:
| Campo | Sugestao |
|-------|----------|
| Frequencia | Se a posologia comum e 8/8h → sugerir "3x ao dia" |
| Horario | Baseado na frequencia: 1x = 08:00, 2x = 08:00/20:00, 3x = 08:00/14:00/22:00 |
| Tipo de uso | Se e antibiotico → "Tratamento temporario". Se e anti-hipertensivo → "Uso continuo" |

O paciente sempre pode mudar. Nunca forcar uma sugestao.

### Campos obrigatorios vs opcionais

| Campo | Obrigatorio? | Por que |
|-------|-------------|---------|
| Nome do medicamento | Sim | Sem nome nao da pra salvar |
| Frequencia | Nao | Paciente pode nao saber agora. Salvar sem e adicionar depois |
| Horario | Nao | Se nao informar, nao cria lembrete (mas salva o medicamento) |
| Tipo de uso | Nao | Informacao complementar |
| Duracao | Nao | So relevante pra tratamentos temporarios |

**Regra fundamental:** NUNCA bloquear o paciente de adicionar um medicamento porque falta uma informacao opcional. Salvar o que tem, pedir o resto depois.

### "Nao sei" como resposta valida

Pra cada campo, o paciente pode responder "Nao sei" ou "Preencher depois". O medicamento e salvo com uma marcacao de "informacao pendente". Mais tarde, o app pode lembrar: "Voce ainda nao informou o horario do Rivotril. Deseja completar agora?"

### Se a foto e de uma RECEITA (multiplos medicamentos)

1. O app extrai todos os medicamentos de uma vez
2. Mostra uma lista: "Encontramos 4 medicamentos na sua receita"
3. Pra cada um, mostra o card de confirmacao
4. O paciente confirma um por um (mas de forma rapida — ja vem preenchido)
5. No final: "Lucas, 4 medicamentos adicionados. Seus lembretes ja estao prontos"

### Alerta de alergia

Se o medicamento identificado conflita com uma alergia registrada, o alerta aparece ANTES da confirmacao:

```
┌─ ALERTA ─────────────────────────┐
│  Alergia identificada             │
│                                    │
│  Voce tem alergia a Dipirona.     │
│  Este medicamento contem Dipirona. │
│                                    │
│  [ Nao adicionar ]                 │
│  [ Adicionar mesmo assim ]         │
└──────────────────────────────────┘
```

Tom calmo, sem panico, sem exclamacao.

### Medicamento duplicado

Se ja esta no perfil:

```
"Rivotril 2mg ja esta na sua lista.
Deseja atualizar as informacoes?"
[ Atualizar ] [ Cancelar ]
```

---

## PARTE 6 — DEPOIS DA CONFIRMACAO

### O que acontece imediatamente
1. Medicamento salvo no servidor
2. Lembrete criado (se informou horario)
3. Tela de sucesso: "Pronto. Rivotril 2mg adicionado"
4. Opcoes: "Adicionar outro" (camera ja pronta) / "Ver meus medicamentos"

### "Adicionar outro" (modo batch)
Pra pacientes com multiplos medicamentos:
- Apos confirmar 1, o app pergunta: "Adicionar outro medicamento?"
- Se sim: camera abre direto (sem bottom sheet, sem orientacao — ja sabe como usar)
- Fluxo rapido: scan → card de confirmacao → scan → card → ate o paciente dizer "pronto"

### Lembretes
- Se informou horario: lembrete criado automaticamente
- Se informou frequencia mas nao horario: sugerir horarios padrao
- Se nao informou nada: sem lembrete, mas medicamento salvo na lista
- Lembretes agrupados por horario: "08:00 — Tomar: Metformina, Rivotril, Losartana" (1 notificacao, nao 3)

### Notificacao no celular
- Titulo: "Hora do Rivotril 2mg"
- Subtitulo: "1 comprimido · via oral"
- Acao: tocar pra marcar como tomado
- Som: som de notificacao padrao (nao alarme, exceto se o paciente configurar)

---

## PARTE 7 — CENARIOS ESPECIAIS

### 7.1 — O cuidador
Uma filha gerenciando medicamentos da mae idosa. Precisa adicionar 8 medicamentos em uma sessao. O modo batch (Parte 6) resolve isso. Futuro: suporte a multiplos perfis (mae, pai, avo).

### 7.2 — O paciente cronico
Toma 6+ medicamentos diarios. Lembretes agrupados por horario sao essenciais. O hub de lembretes mostra o dia inteiro de uma vez.

### 7.3 — O pos-cirurgico
5 medicamentos novos, todos temporarios, cada um com duracao diferente. O card de confirmacao pergunta "por quantos dias" pra cada um. O app avisa quando cada tratamento termina.

### 7.4 — Insulina e injecoes
Nao e comprimido. A forma e "injecao". A dosagem e em "unidades" (nao mg). A frequencia pode ser "antes de cada refeicao". O card de confirmacao precisa suportar essas opcoes.

### 7.5 — Medicamento controlado (tarja preta)
O paciente pode ter receio de registrar. O app NUNCA destaca, categoriza ou trata diferente medicamentos controlados. Todos sao iguais visualmente.

### 7.6 — Horario de madrugada (4h da manha)
Se o paciente precisa tomar algo as 4h, o lembrete precisa ser forte o suficiente pra acordar. Opcao nas configuracoes: "Alarme forte para lembretes noturnos".

### 7.7 — Pausar medicamento
O medico manda parar. O paciente precisa de: "Pausar" (mantem no historico, para lembretes) vs "Remover" (deleta). Medicamentos pausados ficam numa secao separada.

### 7.8 — Esquemas complexos
"2 comprimidos de manha, 1 a noite" ou "tomar dia sim, dia nao". V1: suportar esquemas simples (N vezes por dia). Esquemas complexos: campo de observacao livre ("tomar 2 de manha e 1 a noite").

---

## PARTE 8 — PRIVACIDADE E LEGALIDADE

### LGPD (obrigatorio)
- Consentimento EXPLICITO antes do primeiro scan: "Vamos analisar a foto do seu medicamento para identifica-lo. A foto e processada e descartada imediatamente. Seus dados de saude sao protegidos."
- Fotos: processar e deletar. NUNCA armazenar no servidor.
- Se usar Google Cloud Vision: informar que a foto e processada por terceiro.
- Exportacao de dados: o paciente pode baixar seus medicamentos em PDF.
- Exclusao: o paciente pode deletar tudo (conta + dados).

### Aviso medico (obrigatorio)
- Na primeira vez: "Este app ajuda voce a lembrar de tomar seus medicamentos. Ele NAO substitui orientacao medica."
- Em cada medicamento adicionado: "Confirme a dosagem e frequencia com seu medico ou farmaceutico."
- NUNCA sugerir dosagem. NUNCA falar em interacoes. NUNCA usar a palavra "prescrever".

### ANVISA
- O app e uma ferramenta de organizacao, NAO um dispositivo medico.
- Nao precisa de registro na ANVISA (por enquanto).
- Se no futuro adicionar alertas de interacao → precisa de consultoria juridica.

---

## PARTE 9 — TESTES (FASE 4)

### Teste 1 — Barcode com 10 caixas reais
Pegar 10 caixas de remedio de casa. Escanear cada uma. Verificar: identificou corretamente?
Meta: 9/10 acertos.

### Teste 2 — Barcode falha (tampando o codigo)
Tampar o barcode. Tirar foto da frente da caixa. Verificar: OCR leu o nome? Busca encontrou?
Meta: 8/10 acertos.

### Teste 3 — Foto ruim
Foto borrada, escura, cortada de proposito. Verificar: app mostra erro claro? Oferece tentar de novo e digitar?
Meta: 100% — nunca mostrar dados falsos.

### Teste 4 — Receita impressa
Fotografar receita impressa. Verificar: extraiu todos os medicamentos? Dosagem? Frequencia?
Meta: 80%+ correto.

### Teste 5 — Alergia detectada
Adicionar Dipirona nas alergias. Escanear caixa de Dipirona. Verificar: alerta apareceu?
Meta: 100%.

### Teste 6 — Duplicado
Escanear medicamento que ja esta no perfil. Verificar: avisou "ja esta na lista"?
Meta: 100%.

### Teste 7 — Offline
Desligar internet. Buscar medicamento por nome. Verificar: autocomplete funciona?
Meta: 100%.

### Teste 8 — Celulares
Testar em iPhone Safari e Android Chrome.
Meta: funcionar nos dois.

### Teste 9 — Fluxo completo
Login → Medicamentos → Adicionar → Foto → Processamento → Confirmacao → Lembrete.
Meta: zero erro no caminho.

### Teste 10 — Duplo-clique
Tocar "Confirmar" 5 vezes rapido. Verificar: adicionou so 1 vez?
Meta: 100%.

### Teste 11 — Manipulado
Tentar escanear medicamento manipulado. Verificar: app oferece entrada manual?
Meta: 100%.

### Teste 12 — Suplemento
Escanear vitamina D. Se nao estiver no banco: permite adicao livre?
Meta: 100%.

### Teste 13 — Modo batch
Adicionar 3 medicamentos seguidos. Verificar: fluxo rapido sem repetir orientacao?
Meta: funcionar sem cansaco.

### Teste 14 — "Nao sei"
Nao informar frequencia nem horario. Verificar: medicamento salva mesmo assim? Sem lembrete?
Meta: 100%.

### Teste 15 — Permissao negada
Negar permissao da camera. Verificar: mostra explicacao e oferece manual?
Meta: 100%.

---

## PARTE 10 — ORDEM DE EXECUCAO

### Etapa A — Banco de medicamentos
1. Baixar tabela CMED da ANVISA
2. Limpar dados (EAN, duplicatas, caracteres)
3. Transformar em banco local leve
4. Integrar busca inteligente (Fuse.js)
5. Testar: buscar "rivotri" encontra "Rivotril"?

### Etapa B — Leitura de barcode
6. Integrar html5-qrcode na camera
7. Conectar com banco CMED (barcode → medicamento)
8. Testar: 10 caixas reais
9. Tratar: barcode lido mas nao encontrado no banco

### Etapa C — Leitura de texto (OCR)
10. Integrar Google Cloud Vision (ou melhorar uso do Claude Vision)
11. Conectar OCR → busca inteligente no banco CMED
12. Tratar: OCR parcial (nome incompleto)
13. Testar: fotos sem barcode visivel

### Etapa D — Camera nova com educacao
14. Refazer tela 26-scan-receita.html:
    - Orientacao na primeira vez (animacao)
    - Moldura horizontal pra barcode
    - Status em tempo real
    - Auto-captura
    - Dicas progressivas (5s, 10s, 15s)
    - Lanterna
    - Fallback pra foto normal e manual
15. Testar: paciente que nunca usou consegue usar?

### Etapa E — Tela de processamento
16. Atualizar 27-processando.html:
    - Miniatura da foto
    - Pipeline real (barcode → OCR → banco)
    - Frases com nome do paciente
    - Esperar API terminar
17. Tratar: timeout, erro, foto ruim

### Etapa F — Confirmacao
18. Refazer 28-revisao-receita.html como card de confirmacao:
    - Card unico com campos pre-preenchidos
    - Sugestoes inteligentes
    - "Nao sei" como opcao
    - Alerta de alergia
    - Deteccao de duplicado
19. Criar fluxo pra receita (multiplos meds)
20. Criar fluxo pra manipulado (entrada livre)
21. Criar modo batch (adicionar outro)

### Etapa G — Pos-confirmacao
22. Atualizar 29-confirmacao.html:
    - Sucesso sem dados demo
    - "Adicionar outro" com camera pronta
    - Lembretes reais baseados no que informou
23. Atualizar 30-lembretes.html:
    - Lembretes agrupados por horario
    - Salvar no servidor (nao so localStorage)
    - Funcionar offline com cache

### Etapa H — Seguranca e privacidade
24. Tela de consentimento LGPD antes do primeiro scan
25. Aviso medico na primeira vez
26. Deletar fotos apos processamento (nunca armazenar)
27. Permitir exportar e deletar dados

### Etapa I — Testes
28. Rodar os 15 testes listados na Parte 9
29. Testar em celular simples (Moto G) com 3G
30. Corrigir bugs encontrados
31. Retestar

---

## PARTE 11 — RESUMO EM TOPICOS SIMPLES

O que vai ser feito, etapa por etapa:

**Etapa A — Montar o banco de remedios**
Baixar a lista oficial da ANVISA com 15.000 remedios brasileiros. Limpar os erros. Colocar num formato rapido pro app usar. Resultado: o app sabe o nome de TODOS os remedios vendidos no Brasil.

**Etapa B — Ler codigo de barras**
Fazer a camera do celular ler o codigo de barras da caixa. Quando le, busca no banco e identifica o remedio na hora. Resultado: paciente aponta a camera, em 2 segundos o remedio aparece.

**Etapa C — Ler o texto da caixa**
Quando o codigo de barras nao funciona, o app le o nome escrito na caixa. Busca no banco pelo nome. Resultado: mesmo sem barcode, o app identifica.

**Etapa D — Ensinar o paciente a usar**
Na primeira vez, mostra uma animacao ensinando onde e o codigo de barras. A camera tem uma moldura que guia o paciente. Dicas aparecem se esta demorando. Resultado: ate quem nunca usou scan consegue usar.

**Etapa E — Tela de processamento**
Enquanto o app trabalha, o paciente ve sua foto e frases como "Procurando em nosso sistema..." e "Organizando tudo para Lucas". Resultado: o paciente sabe que algo esta acontecendo e se sente cuidado.

**Etapa F — Confirmar com o paciente**
O app mostra um card com o remedio identificado e campos ja preenchidos (frequencia, horario). O paciente so ajusta o que for diferente e confirma. Se nao sabe algo, pode pular. Se tem alergia, o app avisa. Resultado: 1 tela, 1 toque, remedio salvo.

**Etapa G — Depois de confirmar**
O remedio aparece na lista. Lembrete e criado. O app pergunta "quer adicionar outro?". Se sim, camera abre direto. Resultado: adicionar 5 remedios em 3 minutos.

**Etapa H — Proteger os dados**
Antes do primeiro scan, pedir permissao pro paciente. Aviso de que nao substitui medico. Fotos apagadas depois de processar. Paciente pode exportar ou deletar tudo. Resultado: app seguro e de acordo com a lei.

**Etapa I — Testar tudo**
15 testes com situacoes reais: barcode, foto ruim, alergia, offline, celulares diferentes, duplo-clique. Corrigir o que falhar. Resultado: app pronto pra pacientes reais.

---

## COMO A EXECUCAO AUTONOMA VAI FUNCIONAR

Quando Lucas aprovar este documento:

1. Eu comeco pela Etapa A e vou ate a I sem parar
2. A cada etapa concluida, eu mesmo testo e verifico
3. Se algo falhar no teste, eu corrijo antes de passar pra proxima
4. Nao vou pedir aprovacao entre etapas — so no final
5. Cada etapa gera um commit no GitHub com descricao do que mudou
6. No final, apresento um relatorio completo do que foi feito

Tempo estimado: trabalho continuo ate completar tudo.

---

## TABELA DE NOTAS ESPERADAS APOS TUDO FEITO

| Area | Hoje | Depois |
|------|------|--------|
| Design Visual | 8 | 10 |
| Design System | 8 | 10 |
| Seguranca | 9 | 10 |
| Tratamento de Erros | 7 | 10 |
| Integridade de Dados | 8 | 10 |
| Prontidao Lancamento | 6 | 10 |
| **MEDIA** | **7.7** | **10** |
