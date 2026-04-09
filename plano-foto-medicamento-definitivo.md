# PLANO DEFINITIVO — Identificacao de Medicamentos por Foto
# vita id — Caminho B (sem scanner de barcode)

Data: 09/04/2026
Modo: HM-init 1000% — nenhum detalhe esquecido

---

## PRINCIPIO FUNDAMENTAL

O paciente tira UMA FOTO. O servidor identifica TUDO. O paciente confirma.
Sem scanner de barcode. Sem toggle. Sem moldura. Sem WASM. Sem CDN externo.
Funciona em QUALQUER celular, QUALQUER navegador, QUALQUER condicao.

---

## PARTE 1 — OS 2 CAMINHOS DE ENTRADA

### Caminho 1: Tirar foto na hora
O paciente tem o medicamento na mao (caixinha, frasco, cartela, receita).
Ele tira foto usando a camera nativa do celular.
A foto volta pro app.

### Caminho 2: Enviar arquivo/foto existente
O paciente ja tem a foto salva (tirou antes, recebeu por WhatsApp, tem PDF do laudo).
Ele seleciona da galeria ou dos arquivos.
O arquivo vai pro app.

**Em AMBOS os casos:** A foto/arquivo vai pro mesmo lugar — processamento pelo Claude Vision.

---

## PARTE 2 — O FLUXO COMPLETO (TELA POR TELA)

### TELA 1: Lista de Medicamentos (16-medicamentos.html)

O que o paciente ve:
- Seus medicamentos atuais
- Botao "Adicionar medicamentos"

O que acontece ao tocar "Adicionar":
- Bottom sheet aparece com 2 opcoes:
  - "Tirar foto" → abre camera nativa do celular
  - "Escolher arquivo" → abre galeria/arquivos do celular
- Link discreto embaixo: "Ou digite manualmente"

O que MUDOU:
- Nao vai mais pra tela 26 (scan)
- Abre direto a camera nativa ou galeria
- A foto/arquivo volta pro app e vai direto pra tela de preview

### TELA 2: Preview da Foto (NOVA — 26-preview-foto.html)

Essa tela SUBSTITUI a tela 26 (scan). E simples:

O que o paciente ve:
- A foto que acabou de tirar/selecionar, grande, ocupando a tela
- 2 botoes embaixo:
  - "Enviar" (verde, grande)
  - "Tirar outra" (cinza, menor)
- Texto discreto: "Certifique-se de que o nome do medicamento esta visivel"

O que acontece:
- "Enviar" → armazena a foto e navega pra tela de processamento
- "Tirar outra" → abre camera/galeria de novo

Por que essa tela PRECISA existir:
- O paciente ve a foto ANTES de enviar
- Se saiu borrada, escura, cortada → tira outra
- Evita enviar fotos ruins pro servidor (economia de tempo e custo de API)

Verificacoes automaticas nessa tela:
- Se a foto e muito escura: aviso "Foto parece escura. Deseja tirar outra?"
- Se a foto e muito pequena (resolucao baixa): aviso "Foto com baixa qualidade"
- Se nao e imagem (ex: PDF): mostra icone de documento em vez de preview

### TELA 3: Processamento (27-processando.html — ATUALIZADA)

O que o paciente ve:
- Miniatura da foto no topo
- Titulo: "Identificando seus medicamentos..."
- 4 etapas com animacao:
  1. "Analisando sua foto..." (1s)
  2. "Procurando em nosso sistema..." (1.5s)
  3. "Verificando seguranca..." (1s)
  4. "Organizando tudo para [Nome]" (0.5s)
- Barra de progresso

O que acontece por tras:
1. Foto redimensionada pra max 1568px no lado maior (otimizacao)
2. Comprimida pra JPEG qualidade 82% (balanço qualidade/tamanho)
3. Enviada pro servidor como FormData
4. Servidor manda pro Claude Vision com prompt otimizado
5. Claude identifica: tipo de imagem, nome, dosagem, forma, laboratorio, confianca
6. Servidor cruza nome com banco CMED (15.000+ meds) pra confirmar
7. Servidor cruza com alergias do paciente
8. Retorna resultado estruturado

Timing:
- Animacao: 4 segundos
- API: 2-6 segundos (Claude Vision)
- Se API termina antes da animacao: resultado espera
- Se API demora mais: mostrar "Finalizando..." + botao escape apos 8s
- Timeout maximo: 15 segundos → mostra erro + opcoes

O que NAO acontece mais:
- Nao tenta ler barcode localmente
- Nao depende de nenhum CDN externo
- Nao falha silenciosamente

### TELA 4: Resultado / Confirmacao (28-revisao-receita.html — REESCRITA)

Aqui e onde a magica acontece. O que o paciente ve depende do que o Claude encontrou:

**CENARIO A — Identificou 1 medicamento com confianca ALTA:**

```
┌─────────────────────────────────────┐
│  [miniatura da foto]                 │
│                                       │
│  Encontramos seu medicamento          │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │  Rivotril 2mg                    │ │
│  │  Clonazepam · Comprimido · Roche │ │
│  │                                   │ │
│  │  Quantas vezes por dia?  [1x ▼]  │ │
│  │  Em que horario?       [22:00 ▼] │ │
│  │  Tipo de uso?    [Continuo ▼]    │ │
│  │  Nao sei algum campo? [Pular]    │ │
│  │                                   │ │
│  │  [ Confirmar e adicionar ]        │ │
│  │  [ Nao e esse medicamento ]       │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**CENARIO B — Identificou com confianca MEDIA:**

```
┌─────────────────────────────────────┐
│  Esse e o seu medicamento?            │
│                                       │
│  [ ] Rivotril 2mg (Clonazepam)       │ ← mais provavel
│  [ ] Rivotril 0.5mg (Clonazepam)     │
│  [ ] Clonazepam 2mg (Generico EMS)   │
│  [ ] Nenhum desses                    │
│                                       │
│  (paciente toca no correto)           │
│  → abre card de confirmacao           │
└─────────────────────────────────────┘
```

**CENARIO C — Identificou com confianca BAIXA:**

```
┌─────────────────────────────────────┐
│  Nao tivemos certeza                  │
│                                       │
│  Conseguimos ler: "Rivot..." da foto  │
│                                       │
│  [ Buscar medicamento ]               │
│  (campo com autocomplete CMED)        │
│                                       │
│  [ Tirar outra foto ]                 │
└─────────────────────────────────────┘
```

**CENARIO D — Nao identificou (foto ruim, nao e medicamento):**

```
┌─────────────────────────────────────┐
│  Nao conseguimos identificar          │
│                                       │
│  [icone de atencao]                   │
│                                       │
│  Possivel causa:                      │
│  "A foto esta escura/borrada" OU      │
│  "Nao identificamos um medicamento"   │
│                                       │
│  [ Tirar outra foto ]                 │
│  [ Buscar pelo nome ]                 │
│  [ Digitar manualmente ]              │
└─────────────────────────────────────┘
```

**CENARIO E — Receita com multiplos medicamentos:**

```
┌─────────────────────────────────────┐
│  Encontramos 4 medicamentos           │
│  na sua receita                       │
│                                       │
│  ✓ Amoxicilina 500mg                 │
│    1 capsula de 8/8h por 7 dias      │
│    [Editar]                           │
│                                       │
│  ✓ Ibuprofeno 600mg                  │
│    1 comp de 12/12h por 5 dias       │
│    [Editar]                           │
│                                       │
│  ⚠ Prednisolona 20mg                 │
│    Frequencia nao identificada        │
│    [Completar]                        │
│                                       │
│  🔴 Dipirona 500mg                   │
│    ALERGIA REGISTRADA                 │
│    [Nao adicionar]                    │
│                                       │
│  [ Confirmar 3 medicamentos ]         │
└─────────────────────────────────────┘
```

**Em TODOS os cenarios:**
- Miniatura da foto visivel (paciente sabe de onde veio)
- Botao "Nao e esse" ou "Buscar pelo nome" SEMPRE disponivel
- Campo de busca com autocomplete CMED como fallback
- "Nao sei" como opcao em campos de frequencia/horario
- Alerta de alergia ANTES do botao confirmar

### TELA 5: Sucesso (29-confirmacao.html — LIMPA)

O que o paciente ve:
- Check verde: "Pronto. [N] medicamento(s) adicionado(s)"
- Lista dos medicamentos que foram adicionados
- Lembretes criados (se informou horario)
- Botao: "Adicionar outro" (abre camera/galeria direto)
- Botao: "Voltar ao Meu RG"

O que NAO mostra:
- ZERO dados falsos/demo
- Se nenhum medicamento foi adicionado: nao mostra essa tela (volta pra lista)

---

## PARTE 3 — O QUE O SERVIDOR FAZ COM A FOTO

### Etapa 3.1 — Receber a foto
- Rota: POST /medicamentos/scan
- Recebe: FormData com campo 'arquivo' (imagem ou PDF)
- Validacao: tamanho max 10MB, formatos aceitos (JPEG, PNG, PDF, WebP)
- Se invalido: retorna erro claro

### Etapa 3.2 — Preparar a foto
- Redimensionar pra max 1568px no lado maior
- Comprimir JPEG qualidade 82%
- Se PDF: converter primeira pagina pra imagem

### Etapa 3.3 — Enviar pro Claude Vision
- Modelo: claude-sonnet-4
- Prompt otimizado (ver abaixo)
- Timeout: 30 segundos
- Se falhar: tentar 1 vez mais
- Se falhar de novo: retornar erro

### Etapa 3.4 — Prompt pro Claude

O prompt pede:
1. Classificar o tipo de imagem (caixa, frasco, receita, bula, nao-medicamento, foto ruim)
2. Avaliar qualidade da foto (boa, aceitavel, ruim)
3. Pra cada medicamento visivel:
   - Nome comercial (ou null se nao visivel)
   - Principio ativo (ou null)
   - Dosagem (ou null)
   - Forma farmaceutica
   - Quantidade
   - Laboratorio
   - Numeros do codigo de barras (se visiveis)
   - Numero de registro ANVISA (se visivel)
   - Confianca: ALTA / MEDIA / BAIXA
   - Motivo da confianca
4. Se e receita: extrair todos os medicamentos com frequencia e duracao
5. Texto bruto que conseguiu ler (fallback)
6. Avisos (foto escura, borrada, parcial)

Regras do prompt:
- Se nao consegue ler um campo: retornar null (NUNCA inventar)
- Se nao e medicamento: retornar tipo "NAO_MEDICAMENTO"
- Se foto ruim: retornar tipo "FOTO_RUIM" com motivo
- SEMPRE incluir o texto bruto que leu (pra busca fuzzy no CMED)

### Etapa 3.5 — Validar resultado com banco CMED

Depois que o Claude retorna, o servidor:

1. Pega o nome do medicamento
2. Busca no banco CMED (15.000+ meds brasileiros)
3. Se encontrar match exato: confianca sobe pra ALTA
4. Se encontrar match parcial: mostra opcoes pro paciente
5. Se nao encontrar: mantém o que o Claude disse + flag "nao verificado"

Se o Claude leu numeros do barcode:
1. Busca EAN no CMED
2. Se encontrar: confianca MAXIMA (barcode = identidade unica)
3. Se nao encontrar: ignora o barcode (pode ter lido errado)

### Etapa 3.6 — Cruzar com alergias

1. Busca alergias do paciente no banco
2. Compara nome do medicamento + principio ativo com cada alergia
3. Se conflito: marca `alertaAlergia: true` no resultado
4. Retorna quantos conflitos encontrou

### Etapa 3.7 — Retornar pro app

Formato do retorno:
```
{
  tipo_imagem: "CAIXA" | "FRASCO" | "RECEITA" | ...,
  qualidade: "BOA" | "ACEITAVEL" | "RUIM",
  medicamentos: [{
    nome: "Rivotril",
    principio_ativo: "Clonazepam",
    dosagem: "2mg",
    forma: "Comprimido",
    laboratorio: "Roche",
    frequencia: null (caixa) ou "8/8h" (receita),
    duracao: null (caixa) ou "7 dias" (receita),
    confianca: "ALTA" | "MEDIA" | "BAIXA",
    motivo_confianca: "Nome claramente visivel",
    ean: "7896004711669" ou null,
    alertaAlergia: false,
    verificado_cmed: true | false
  }],
  texto_bruto: "RIVOTRIL clonazepam 2mg...",
  avisos: ["Foto com boa iluminacao"]
}
```

---

## PARTE 4 — CADA TIPO DE FOTO E COMO TRATAR

### 4.1 — Caixa de remedio (frente)
- O que o Claude le: nome grande, dosagem, forma
- O que NAO le: frequencia, horario (nao esta na caixa)
- App pergunta: frequencia, horario, tipo de uso
- Confianca esperada: ALTA

### 4.2 — Caixa de remedio (verso/lateral)
- O que le: principio ativo, laboratorio, ANVISA, barcode (numeros)
- Pode confirmar com CMED via barcode
- Confianca esperada: ALTA

### 4.3 — Frasco (gotas, xarope, colirio)
- O que le: nome no rotulo, dosagem
- Desafio: superficie curva, reflexo
- Dica pro paciente: "Fotografe o rotulo de frente"
- Confianca esperada: MEDIA a ALTA

### 4.4 — Cartela/blister (sem caixa)
- O que le: nome impresso no aluminio (se tiver)
- Desafio: texto pequeno, embossado, sem contraste
- Confianca esperada: BAIXA a MEDIA
- Fallback provavel: busca manual

### 4.5 — Receita impressa/digital
- O que le: TODOS os medicamentos, dosagens, frequencias, duracoes
- Melhor cenario: 1 foto = 3-5 medicamentos adicionados
- Confianca esperada: ALTA (impressa) a MEDIA (digital com logo/marca d'agua)

### 4.6 — Receita manuscrita
- O que le: PARCIAL — depende da letra do medico
- Confianca esperada: BAIXA
- App mostra: "Receitas manuscritas sao dificeis de ler. Confira cada medicamento"
- Cada campo que nao leu: mostra pra paciente completar

### 4.7 — Bula
- Claude identifica como bula
- App avisa: "Isso parece ser uma bula. Fotografe a caixa ou embalagem do medicamento"
- NAO tenta extrair medicamento da bula (tem centenas de nomes dentro)

### 4.8 — Cupom fiscal de farmacia
- Claude identifica como cupom
- App avisa: "Isso parece ser um cupom da farmacia. Fotografe o medicamento"

### 4.9 — Foto de algo que nao e medicamento
- Claude identifica como NAO_MEDICAMENTO
- App avisa: "Nao identificamos um medicamento nesta foto"
- Oferece: tirar outra, buscar por nome, digitar

### 4.10 — Foto borrada/escura
- Claude identifica como FOTO_RUIM + motivo
- App avisa: "A foto esta [escura/borrada]. Tente com melhor [iluminacao/foco]"
- Oferece: tirar outra

### 4.11 — Foto de varios medicamentos juntos
- Claude identifica cada um separadamente
- App mostra lista: "Encontramos 3 medicamentos"
- Paciente confirma cada um

### 4.12 — Foto do celular (screenshot do WhatsApp)
- Claude consegue ler (e texto digital)
- Mas padrao moire pode atrapalhar
- Se qualidade OK: funciona normal

### 4.13 — Medicamento manipulado (farmacia de manipulacao)
- Rotulo diferente (nao padrao)
- Claude le o que conseguir do rotulo
- Provavelmente nao esta no CMED
- App trata como "nao verificado" e permite adicao livre

### 4.14 — Suplemento/vitamina
- Alguns estao no CMED, maioria nao
- Claude identifica normalmente
- Se nao esta no CMED: adicao livre como "nao verificado"

---

## PARTE 5 — OS 13 PROBLEMAS CORRIGIDOS

| # | Problema | Como resolver |
|---|---------|--------------|
| 1 | Scanner barcode nao funciona no iPhone | DELETADO. Nao existe mais scanner. So foto |
| 2 | API falha sem mostrar erro | Mostrar erro claro: "Nao conseguimos processar. Tente novamente" + botoes |
| 3 | Nao logado = paginas vazias | Verificar login. Se nao logado: "Faca login para adicionar medicamentos" |
| 4 | Dados falsos na tela de sucesso | ZERO dados demo. Se sessionStorage vazio: volta pra lista |
| 5 | Frequencia/horario preenchidos sem perguntar | "Nao sei" como opcao. Salva sem frequencia se paciente pular |
| 6 | Botao "Remover" alergia nao funciona | Botao realmente remove o medicamento da lista de adicao |
| 7 | API timeout sem opcao | Apos 8s: botoes "Continuar" e "Digitar" aparecem. Apos 15s: navega automatico |
| 8 | Severidade alergia sempre MODERADA | Perguntar pro paciente: "Qual a gravidade?" (Leve/Moderada/Grave) |
| 9 | Banco CMED com so 52 remedios | Expandir pra tabela completa (15.000+) — script de importacao |
| 10 | cmed-sample.json caminho relativo | Usar caminho absoluto /cmed-sample.json |
| 11 | Lembretes so no localStorage | Salvar no servidor + cache local (futuro) |
| 12 | Nome do paciente nao aparece se nao logado | Verificar login. Se logado: buscar nome. Se nao: "voce" |
| 13 | Scanner falha silenciosamente | DELETADO. Nao existe mais scanner |

---

## PARTE 6 — O QUE DELETAR

| Arquivo/Funcionalidade | Por que deletar |
|----------------------|----------------|
| 26-scan-receita.html (atual) | Substituir por 26-preview-foto.html (simples) |
| Scanner de barcode (html5-qrcode, barcode-detector, ZXing) | Nao funciona no iPhone |
| Toggle barcode/foto | Desnecessario sem scanner |
| Moldura de scan | Desnecessaria sem scanner |
| Dicas progressivas (5s, 10s, 15s) | Desnecessarias sem scanner |
| Onboarding "Aponte pro barcode" | Substituir por dica simples na preview |
| diagnostico-scan.html | Serviu seu proposito, pode remover |
| dashboard-agentes.html | Substituir por dashboard-scan.html |
| Referencia a CDNs externos (jsdelivr, unpkg) | Zero dependencias externas |

---

## PARTE 7 — O QUE CRIAR

| Arquivo | O que faz |
|---------|-----------|
| 26-preview-foto.html (novo) | Preview da foto + botoes Enviar/Tirar outra + verificacao de qualidade |
| 27-processando.html (atualizar) | Animacao + chamada API real + tratamento de erro |
| 28-revisao-receita.html (reescrever) | 5 cenarios (alta/media/baixa/erro/receita) + card editavel + alergia |
| 29-confirmacao.html (limpar) | Zero dados demo. Mostra so dados reais |
| Backend: prompt otimizado pro Claude | Classificacao + extracao + confianca + texto bruto |
| Backend: validacao CMED pos-Claude | Cruzar nome do Claude com banco CMED |

---

## PARTE 8 — PREPARACAO DA FOTO ANTES DE ENVIAR

### 8.1 — Redimensionar
- Lado maior: max 1568px (limite interno do Claude — maior que isso e desperdicado)
- Manter proporcao original
- Fazer no frontend antes de enviar (economiza upload)

### 8.2 — Comprimir
- Formato: JPEG
- Qualidade: 82%
- Tamanho alvo: 200-500KB
- Se PDF: converter pra imagem primeiro

### 8.3 — Corrigir orientacao
- Ler EXIF da foto (camera pode salvar rotacionada)
- Corrigir pra vertical antes de enviar
- Claude le melhor texto na orientacao correta

### 8.4 — Verificacao de qualidade no frontend
Antes de enviar, analisar a foto:
- Brilho medio < 30: "Foto muito escura"
- Brilho medio > 240: "Foto muito clara (reflexo)"
- Resolucao < 400px: "Foto com baixa resolucao"
- Arquivo > 10MB: "Arquivo muito grande"

---

## PARTE 9 — CUSTO E PERFORMANCE

### Custo por scan
- Claude Vision (Sonnet): ~$0.003-0.01 por foto
- 100 scans/dia: ~$0.50-1.00/dia
- 3.000 scans/mes: ~$15-30/mes

### Performance
- Upload da foto (300KB em 4G): ~1 segundo
- Claude Vision processar: 2-6 segundos
- Busca CMED + alergias: <0.5 segundo
- Total: 3-8 segundos

### Otimizacoes
- Cache: se mesmo EAN ja foi escaneado antes, usar resultado anterior
- Compressao: foto menor = upload mais rapido
- Retry: se primeira tentativa falha, tentar de novo automaticamente

---

## PARTE 10 — O QUE O PACIENTE SENTE

### Fluxo feliz (90% dos casos)
1. Toca "Adicionar" (1s)
2. Tira foto do remedio (3s)
3. Ve preview, toca "Enviar" (1s)
4. Espera processamento (4s — ve animacao com seu nome)
5. Ve o medicamento identificado com tudo preenchido (1s pra ler)
6. Toca "Confirmar" (1s)
7. "Pronto. Medicamento adicionado"

**Total: ~11 segundos do inicio ao fim**

### Fluxo com problema (10% dos casos)
1. Tira foto → envia
2. Claude nao identifica com certeza
3. Ve "Esse e o seu medicamento?" com 3 opcoes
4. Toca no correto → confirma

**Total: ~15 segundos**

### Pior caso (foto muito ruim)
1. Tira foto → envia
2. "Nao conseguimos identificar. Tente com melhor iluminacao"
3. Tira outra foto → envia
4. Identifica → confirma

**Total: ~25 segundos**

### Caso extremo (nada funciona)
1. Foto falha 2x
2. "Buscar pelo nome" → digita "Rivotril" → autocomplete mostra
3. Seleciona → confirma

**Total: ~30 segundos (mas NUNCA fica sem saida)**

---

## PARTE 11 — CHECKLIST DE TUDO QUE PRECISA SER FEITO

### Fase A — Limpar (deletar o que nao funciona)
- [ ] Deletar 26-scan-receita.html (frankenstein atual)
- [ ] Deletar diagnostico-scan.html
- [ ] Remover referencias a html5-qrcode, barcode-detector, ZXing
- [ ] Remover CDN externo do jsdelivr/unpkg

### Fase B — Criar (telas novas limpas)
- [ ] Criar 26-preview-foto.html (preview + botoes + verificacao qualidade)
- [ ] Atualizar 16-medicamentos.html (camera nativa + galeria direto)
- [ ] Atualizar 17-alergias.html (mesma logica)

### Fase C — Processamento (servidor)
- [ ] Atualizar prompt do Claude Vision (classificacao + extracao + confianca)
- [ ] Adicionar redimensionamento da foto no servidor
- [ ] Adicionar validacao CMED pos-Claude
- [ ] Adicionar tratamento de erro claro
- [ ] Testar com 10 fotos reais de medicamentos

### Fase D — Revisao (frontend)
- [ ] Reescrever 28-revisao-receita.html (5 cenarios)
- [ ] Card editavel com todos os campos
- [ ] "Nao sei" como opcao em cada campo
- [ ] Alerta de alergia funcional (remove de verdade)
- [ ] Busca CMED como fallback

### Fase E — Sucesso e lembretes
- [ ] Limpar 29-confirmacao.html (zero dados demo)
- [ ] Atualizar 30-lembretes.html (zero dados demo)
- [ ] Atualizar 31-revisao-alergias.html (mesma logica)

### Fase F — Testes
- [ ] 10 fotos de caixas de remedio reais
- [ ] 5 fotos de frascos (gotas, xarope)
- [ ] 3 fotos de receitas impressas
- [ ] 3 fotos ruins de proposito (borrada, escura, cortada)
- [ ] 1 foto de algo que nao e medicamento
- [ ] Testar no iPhone Safari
- [ ] Testar no Android Chrome
- [ ] Testar sem internet
- [ ] Testar sem login

---

## RESUMO EXECUTIVO

**O que era:** Um sistema complicado com scanner de barcode que nao funciona no iPhone, 5 tentativas de CDN que falham, toggle confuso, e 13 bugs.

**O que vai ser:** Tirar foto → servidor identifica com Claude Vision → paciente confirma. 3 passos. Funciona em qualquer celular. Zero dependencia externa.

**O que muda pra melhor:**
- Funciona no iPhone (camera nativa SEMPRE funciona)
- Funciona no Android
- Funciona em celulares velhos
- Funciona offline (ate a parte da foto — envio precisa de internet)
- Le TUDO da foto (nome, dosagem, laboratorio, barcode, receita inteira)
- Nao depende de nenhum CDN, WASM, ou pacote externo
- 5 cenarios de resultado (alta/media/baixa/erro/receita)
- NUNCA mostra dados falsos
- SEMPRE tem caminho alternativo (foto, busca, manual)

**Tempo estimado de implementacao:** Todas as 6 fases (A-F) podem ser feitas em sequencia autonoma.
