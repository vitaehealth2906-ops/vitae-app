# PLANEJAMENTO DEFINITIVO — Sistema de Scan de Medicamentos
# Cobrindo todos os 1.041 itens mapeados

Data: 09/04/2026
Modo: HM-init — planejamento total antes de implementar

---

## VISAO GERAL

O sistema de scan do vita id tem 2 MODOS dentro da mesma tela:

**MODO 1 — SCAN DE BARCODE (padrao)**
Camera ao vivo. Deteccao automatica. Sem botao de captura. Borda verde quando detecta.

**MODO 2 — FOTO DA EMBALAGEM**
Camera ao vivo. Botao de captura visivel. Paciente enquadra e toca.

O paciente alterna entre os 2 modos com um **toggle** na parte inferior da tela.

---

## DECISOES TOMADAS (110 sub-categorias resolvidas)

### CAMERA (Categoria A — 140 itens)

**A1 — Hardware da camera**
- Decisao: usar SEMPRE `facingMode: "environment"` (camera traseira)
- Se paciente abrir frontal por engano: detectar e avisar "Vire o celular"
- Se celular nao tem camera traseira: usar frontal com aviso
- Se camera tem macro: nao forcar (deixar autofoco decidir)
- Se lente esta suja: detectar imagem borrada e avisar "Limpe a lente da camera"

**A2 — Iluminacao**
- Detectar pouca luz via media de brilho do frame
- Se escuro: mostrar botao de lanterna + mensagem "Ative a lanterna"
- Se sol direto (overexposure): avisar "Evite luz direta sobre a caixa"
- Fluorescente (flickering): ignorar (nao afeta barcode)

**A3 — Angulo e distancia**
- Distancia ideal pro barcode: 15-25cm
- Se muito perto (imagem borrada): "Afaste um pouco"
- Se muito longe (barcode pequeno): "Aproxime da caixa"
- Angulo ideal: perpendicular (reto). Tolerancia ate 30 graus

**A4 — Posicao do celular**
- Barcode e horizontal: tela funciona em qualquer orientacao
- Se celular em modo paisagem: moldura se adapta
- Se tela travada em retrato: funciona normal (barcode horizontal cabe na moldura)

**A5 — Permissao da camera**
- Primeira vez: iOS e Android mostram popup nativo (nao controlamos)
- Se NEGOU: tela mostra "Para escanear, precisamos da camera" + botao "Abrir configuracoes" + botao "Enviar foto da galeria" + link "Digitar o nome"
- Se negou e voltou: verificar permissao a cada abertura da tela
- NUNCA ficar numa tela vazia sem explicacao

**A6 — Navegadores**
- Safari iOS: getUserMedia funciona com playsinline+autoplay+muted
- Chrome Android: funciona normalmente
- Firefox: funciona mas menos testado — fallback pra foto
- In-app browsers (WhatsApp, Instagram): getUserMedia geralmente NAO funciona — detectar e mostrar "Abra no Safari/Chrome"
- Samsung Internet: funciona similar ao Chrome

**A7/A8 — Versoes iOS/Android**
- iOS 14.3+ necessario (getUserMedia em WKWebView)
- iOS abaixo de 14.3: fallback pra foto da galeria + aviso "Atualize seu iPhone"
- Android 5+: funciona
- Android abaixo de 5: fallback pra galeria

**A9 — Tablets**
- iPad: funciona igual iPhone
- Tablets Android: funciona igual Android
- Tela maior: moldura de scan maior (responsiva)

---

### BARCODE (Categoria B — 80 itens)

**B1 — Tipos**
- EAN-13: PRINCIPAL (99% dos medicamentos brasileiros)
- EAN-8: raro mas suportar
- QR Code: receitas digitais — suportar
- Code-128: interno de farmacia — suportar como bonus
- DataMatrix: raro em BR — ignorar V1

**B2 — Localizacao**
- Caixa: geralmente verso ou lateral inferior
- Frasco: rotulo lateral
- Tubo: rotulo ou caixa externa
- Blister solto: NAO TEM barcode — fallback pra foto
- Onboarding ensina: "O codigo fica no verso ou na lateral da caixa"

**B3 — O que torna ilegivel**
- Adesivo de preco colado em cima: dica apos 5s "Se tiver adesivo de preco sobre o codigo, tente remover"
- Impresao falha: fallback pra foto
- Reflexo (plastico brilhante): dica "Mude o angulo pra evitar reflexo"
- Superficie curva (frasco): dica "Gire o frasco devagar"
- Danificado: fallback pra foto

**B4 — Adesivo de preco da farmacia**
- Adesivo tem barcode PROPRIO (do PDV da farmacia, nao do medicamento)
- Se barcode lido mas NAO esta no banco CMED: pode ser adesivo de preco
- Resposta: "Codigo nao reconhecido — pode ser da farmacia, nao do medicamento. Tente encontrar o codigo original da caixa"

**B5 — Multiplos barcodes**
- Caixa pode ter: EAN do medicamento + barcode do lote + QR de rastreabilidade
- Prioridade: EAN-13 primeiro (buscar no CMED). Se nao encontrar, tentar os outros
- Se 2 EAN-13 detectados: mostrar os 2 resultados pro paciente escolher

**B6 — Orientacao**
- Barcode pode estar horizontal ou vertical na caixa
- O scanner deve ler em qualquer orientacao
- A moldura guia e horizontal (formato mais comum) mas o decoder aceita qualquer angulo

**B7 — Distancia e tamanho**
- Barcode minimo: 2cm de largura (maioria dos medicamentos BR tem 3-5cm)
- Distancia minima: ~10cm (foco da camera)
- Distancia maxima: ~40cm (resolucao do barcode no frame)
- Dica se nao detecta: "Aproxime a camera do codigo de barras"

---

### EMBALAGEM (Categoria C — 90 itens)

**C1 — Tipos de embalagem e como tratar cada um**

| Tipo | Tem barcode? | Estrategia |
|------|-------------|------------|
| Caixa cartonada | SIM | Barcode (padrao) |
| Blister solto (sem caixa) | NAO | Foto → OCR nome no blister |
| Frasco (gotas, xarope) | SIM (rotulo) | Barcode (girar devagar) |
| Ampola | NAO | Foto → OCR ou manual |
| Sache | As vezes | Barcode ou foto |
| Tubo (pomada) | SIM (caixa) | Barcode da caixa |
| Bisnaga | As vezes | Barcode ou foto |
| Aerosol | SIM | Barcode no frasco |
| Caneta injetora (insulina) | SIM | Barcode na caixa |
| Colirio | SIM (caixa) | Barcode da caixa ou foto |
| Spray nasal | SIM | Barcode na caixa |

**C3 — Sem caixa original**
- Blister solto: modo foto → OCR no texto do blister
- Frasco sem rotulo: manual entry
- Mensagem: "Sem a embalagem? Digite o nome do medicamento"

**C4 — Embalagem danificada**
- Barcode rasgado: fallback pra foto
- Nome parcialmente visivel: OCR + busca fuzzy

**C5 — Porta-comprimidos**
- NAO tem barcode, NAO tem nome visivel
- Fallback direto pra manual
- Mensagem: "Medicamento sem embalagem? Digite o nome"

---

### PACIENTE (Categoria D — 120 itens)

**D1 — Faixa etaria**
- Adolescente (13-17): entende rapido, impaciente
- Adulto (18-60): variavel
- Idoso (60+): maior publico de medicamentos, menor familiaridade com scan
- Design: fontes grandes (min 14px), botoes grandes (min 48px), contraste alto

**D2 — Alfabetizacao tecnologica**
- "Nunca escaneou nada": onboarding OBRIGATORIO com animacao
- "Ja usou scan antes": pula onboarding (localStorage)
- Regra: SEMPRE ter caminho manual visivel (1 toque)

**D3 — Limitacoes fisicas**
- Tremor: dica "Apoie a caixa em uma mesa e posicione o celular acima"
- Baixa visao: textos grandes, alto contraste, feedback sonoro
- Cadeira de rodas: uma mao ocupada — botoes alcancaveis com polegar
- Deitado na cama: angulo diferente — scanner aceita qualquer angulo

**D4 — Cognitivas**
- Confusao: instrucoes simples, 1 passo por vez
- Dificuldade de leitura: icones > texto
- Esquecimento: app lembra o estado (se sair e voltar, retoma)

**D5 — Estado emocional**
- Ansioso: interface calma, sem alarme, sem vermelho excessivo
- Com dor: fluxo rapido, minimo de toques
- Frustrado (scan nao funciona): SEMPRE oferecer caminho alternativo em <3 segundos

**D6 — Idioma**
- Portugues BR em todo lugar
- Sem termos medicos (posologia → "quantas vezes por dia")
- Sem termos tecnicos (OCR, barcode → "codigo de barras")

**D7 — Cultural**
- Desconfianca de tecnologia: disclaimer "Este app nao substitui seu medico"
- Privacidade: explicar que foto e descartada
- Medicamento controlado: NUNCA destacar ou categorizar diferente

**D8 — Ambiente**
- Casa (mais comum): condicoes variaveis
- Farmacia: boa luz, pode pedir ajuda ao farmaceutico
- Hospital: pode estar deitado, com acesso, com dor
- Carro: instavel, sem apoio — nao ideal, mas acontece
- Transporte publico: chacoalhando — scanner precisa tolerar movimento

---

### TOGGLE/MODOS (Categoria E — 50 itens)

**E1/E2 — Quantos modos e quais**
- MODO 1: SCAN DE BARCODE (padrao)
- MODO 2: FOTO DA EMBALAGEM
- NAO ter modo 3 ou 4. Simplicidade.
- "Digitar nome" e um LINK discreto, nao um modo

**E3 — Formato do toggle**
- Toggle pill (estilo iOS switch) com 2 lados
- Lado esquerdo: icone de barcode (linhas verticais)
- Lado direito: icone de camera/caixa (retangulo com camera)
- Toggle desliza suavemente entre os 2

**E4 — Icones**
- Barcode: icone de codigo de barras (linhas verticais de espessura variada)
- Foto: icone de camera com retangulo
- Ambos reconheciveis SEM texto (acessibilidade universal)

**E5 — Explicar pro paciente**
- Onboarding: "Use o scan para ler o codigo de barras. Se nao encontrar, toque no icone de camera para tirar uma foto da caixa"
- Tooltip na primeira vez que troca de modo: "Modo foto — tire uma foto da frente da caixa"

**E6 — Camera ao trocar modo**
- Camera NAO para. Continua ao vivo.
- Muda: a moldura (de horizontal/barcode pra retangulo/caixa)
- Muda: o decoder (de barcode pra nenhum — foto e manual)
- Muda: botao de captura aparece (modo foto) ou some (modo barcode)

**E7 — Animacao**
- Toggle desliza com animacao suave (200ms)
- Moldura transiciona de formato (250ms)
- Botao de captura aparece com fade (200ms)

**E8 — Modo padrao**
- BARCODE sempre abre primeiro (maior taxa de sucesso)
- Se paciente trocou pra foto na ultima vez: NAO lembrar (barcode e melhor)

**E9 — Lembrar ultimo modo**
- NAO. Sempre abrir em barcode. E o modo mais rapido e preciso.

---

### FEEDBACK (Categoria F — 60 itens)

**F1 — Visual durante scan**
- Moldura com animacao sutil (linha que percorre de cima pra baixo)
- Texto: "Procurando codigo de barras..."
- Bolinha pulsando no status pill

**F2 — Visual no sucesso**
- Moldura fica VERDE instantaneamente
- Overlay verde sutil sobre a tela (flash verde)
- Texto muda: "Codigo encontrado!"
- Nome do medicamento aparece grande no centro
- Navega apos 1.5 segundo

**F3 — Som**
- NAO reproduzir som. Pode assustar paciente em ambiente silencioso (hospital, noite).
- Exceção: se paciente ativar nas configuracoes (futuro)

**F4 — Haptico (vibracao)**
- Android: `navigator.vibrate(100)` — funciona
- iPhone Safari: `navigator.vibrate()` NAO funciona
- Alternativa pro iPhone: nenhuma via web. Aceitar que nao vibra.
- NAO e critico — feedback visual e suficiente

**F5 — O que aparece logo apos detectar**
- Overlay com:
  - Icone de check verde
  - Nome do medicamento (grande)
  - Substancia + forma (pequeno)
  - "Buscando informacoes..."
- Overlay some e navega pra confirmacao apos 1.5s

**F6 — Timing**
- Deteccao → overlay: instantaneo
- Overlay visivel: 1.5 segundo
- Navegacao: suave (fade out)
- Total do paciente sentir: ~2 segundos (detectou → proxima tela)

**F7 — Barcode errado (adesivo de preco)**
- Barcode lido mas nao esta no CMED
- Resposta: "Codigo nao reconhecido. Pode ser o codigo da farmacia. Tente encontrar o codigo original do medicamento"
- Botao: "Tentar de novo"
- Scanner volta a funcionar (nao trava)

**F8 — Barcode nao esta no banco**
- EAN-13 valido mas medicamento nao cadastrado na CMED
- Resposta: "Medicamento nao encontrado em nosso banco. Voce pode tirar uma foto da caixa ou digitar o nome"
- Muda automaticamente pro modo foto

---

### FALLBACKS (Categoria G — 40 itens)

**Cascata de fallback — NUNCA ficar sem saida**

```
BARCODE falha (nao detecta em 10s)
  → Dicas aparecem (5s, 10s)
  → Apos 10s: sugerir modo foto
  
FOTO falha (OCR nao identifica)
  → Mostrar: "Nao conseguimos identificar. Tente com melhor iluminacao"
  → Botao: "Tentar de novo" + "Digitar o nome"
  
OCR falha (nome nao esta no CMED)
  → Campo de busca com autocomplete
  → Busca fuzzy no banco local
  
MANUAL falha (nao encontra no autocomplete)
  → Adicao livre: paciente digita qualquer nome
  → Marcar como "nao verificado"
  
TUDO falha (internet fora + camera nao funciona)
  → Adicao livre offline
  → Sincroniza quando internet voltar
```

**Salvar progresso parcial:**
- Se paciente sai no meio: salvar em sessionStorage
- Se volta: perguntar "Voce estava adicionando um medicamento. Continuar?"

---

### MODO FOTO (Categoria H — 70 itens)

**H1 — O que fotografar**
- Frente da caixa (nome grande visivel)
- OU qualquer lado com texto legivel
- Guia: moldura retangular grande mostrando "Posicione a caixa aqui"

**H2 — Overlay de guia**
- Retangulo com cantos arredondados (formato caixa)
- Semi-transparente
- Texto: "Enquadre a caixa dentro da area"

**H3 — Auto-captura vs toque**
- NO modo foto: NAO auto-capturar. Paciente toca o botao.
- Motivo: paciente precisa de tempo pra enquadrar
- Botao grande e claro no centro inferior

**H4 — Resolucao**
- Capturar em 1280x720 (bom pro OCR, nao muito pesado)
- Comprimir JPEG qualidade 80% antes de enviar
- Tamanho final: ~200-400KB

**H5 — Preview antes de enviar**
- Mostrar a foto por 1 segundo com botoes:
  - "Enviar" (grande, verde)
  - "Tirar outra" (pequeno, cinza)
- Se borrada: detectar e avisar "Foto parece borrada. Tirar outra?"

**H6 — Receita medica**
- Reconhecer automaticamente que e papel (nao caixa)
- OCR extrai TODOS os medicamentos de uma vez
- Fluxo diferente: lista de medicamentos em vez de 1 so

**H7 — Foto de tela (WhatsApp)**
- Padrao moire (listras) atrapalha OCR
- Se detectar: avisar "Fotos de tela podem nao funcionar bem. Tente com o documento original"

---

### POS-SCAN (Categoria I — 80 itens)

**I1 — Card de confirmacao**
- Se barcode (99% certeza): card com tudo preenchido, so confirmar
- Se OCR (90% certeza): card com "Esse e o medicamento?" + opcoes alternativas
- Se manual: card vazio pra preencher

**I2 — Medicamento errado identificado**
- Botao "Nao e esse" → mostra alternativas da busca
- Se nenhuma alternativa serve → campo de busca manual

**I3 — Multiplos matches**
- Mostrar top 3 resultados como cards
- Paciente toca no correto
- Se nenhum: "Nenhum desses — digitar o nome"

**I4 — Dosagem diferente**
- Barcode identificou "Rivotril 2mg" mas paciente toma 0.5mg
- Botao "Dosagem diferente" → mostra todas as opcoes do CMED

**I5 — Pre-preenchimento**
- Frequencia: buscar na bula (posologia comum)
- Horario: sugerir baseado na frequencia
- Tipo de uso: inferir da classe terapeutica (antibiotico = temporario)
- TUDO editavel. TUDO com opcao "Nao sei"

**I6 — Adicionar e proximo**
- Apos confirmar: "Medicamento adicionado. Adicionar outro?"
- Se sim: volta pra camera (sem onboarding, sem bottom sheet)
- Se nao: volta pra lista de medicamentos

---

### CASOS EXTREMOS (Categoria J — 90 itens)

| Caso | Tratamento |
|------|-----------|
| Medicamento veterinario | Barcode nao esta no CMED → "Nao encontrado" → manual |
| Cosmetico | Barcode nao esta no CMED → "Nao encontrado" → manual |
| Suplemento | Alguns no CMED, maioria nao → manual com aviso "Suplementos podem nao estar no nosso banco" |
| Homeopatico | Raramente no CMED → manual |
| Herbal (fitoterapico) | Alguns no CMED → buscar, fallback manual |
| Expirado | Se identificar data: avisar "Este medicamento pode estar vencido (validade: XX/XX). Consulte seu farmaceutico" |
| Recalled | V2 futura — nao implementar agora |
| Daltonismo | Nao usar so COR como indicador. Adicionar icones (check verde + icone de check) |
| Modo escuro | Camera UI funciona em qualquer modo (fundo ja e escuro) |
| Screenshot do resultado | Resultado legivel como imagem (nomes grandes, contraste alto) |
| Compartilhar com medico | V2 futura — botao "Enviar pro medico" |
| Multiplos pacientes | V2 futura — perfis multiplos |
| Medicamento infantil | Igual adulto (concentracao diferente, CMED tem ambos) |
| Insulina/injecoes | Dosagem em "unidades" nao "mg". Card de confirmacao adapta |
| Manipulado | Detectar apos 10s sem resultado → "Medicamento manipulado? Digite o nome" |

---

### PRIVACIDADE (Categoria K — 50 itens)

- Foto NUNCA armazenada no servidor. Processar e descartar.
- Se usar Google Cloud Vision: informar no consentimento
- Consentimento LGPD: dentro do onboarding da camera (ja implementado)
- Historico de scans: salvar so o RESULTADO (nome, data, confianca), NAO a foto
- Escanear medicamento de outra pessoa (cuidador): permitir. Nao pedir CPF do medicamento.
- Exportacao de dados: botao "Exportar meus medicamentos" em PDF
- Exclusao: botao "Apagar todos os dados" nas configuracoes

---

### PERFORMANCE (Categoria L — 60 itens)

- Barcode scan: maximo 3 segundos pra primeira deteccao
- OCR: maximo 10 segundos (total: upload + processamento + resposta)
- Abertura da camera: maximo 2 segundos
- Memoria: manter abaixo de 100MB (video + decoder)
- Bateria: parar camera quando sai da tela. Parar decoder quando nao precisa.
- Rede: comprimir foto antes de enviar (~300KB). Timeout de 10s.
- Crash recovery: se app fecha, sessionStorage mantem estado

---

### ACESSIBILIDADE (Categoria M — 50 itens)

- VoiceOver/TalkBack: todos os botoes com aria-label
- Feedback auditivo quando barcode detecta: "Medicamento encontrado: Rivotril 2mg" (via speech synthesis)
- Texto grande: UI responsiva, minimo 14px
- Contraste: WCAG AA (4.5:1 pra texto)
- Uma mao: todos os botoes na metade inferior da tela
- Modo reduzido de animacoes: respeitar prefers-reduced-motion

---

### INFRAESTRUTURA (Categoria N — 60 itens)

- Banco CMED: atualizar mensalmente via script
- Banco CMED offline: salvar em cache do navegador (Service Worker futuro)
- Erro tracking: logar erros de scan pra melhorar (sem dados pessoais)
- Analytics: quantos scans por dia, taxa de sucesso, tempo medio
- Feature flag: poder desligar OCR se cota do Google acabar

---

### LEGAL (Categoria O — 40 itens)

- App NAO e dispositivo medico (ferramenta de organizacao)
- Disclaimer em todo lugar relevante
- LGPD: consentimento explicito, dados minimos, direito de exclusao
- NUNCA sugerir dosagem. NUNCA diagnosticar. NUNCA prescrever.

---

## ORDEM DE IMPLEMENTACAO (31 tarefas)

### SPRINT 1 — Camera que funciona no iPhone (tarefas 1-5)
1. Criar camera com getUserMedia direto (sem html5-qrcode)
2. Video com autoplay+playsinline+muted (funciona no iPhone)
3. Integrar decoder de barcode WebAssembly
4. Testar no iPhone Safari real
5. Testar no Android Chrome real

### SPRINT 2 — Toggle e modos (tarefas 6-10)
6. Criar componente toggle (barcode ↔ foto)
7. Modo barcode: moldura horizontal, scan automatico, sem botao captura
8. Modo foto: moldura retangular, botao captura, preview
9. Transicao suave entre modos (camera nao para)
10. Dicas progressivas (5s, 10s, 15s)

### SPRINT 3 — Deteccao e feedback (tarefas 11-15)
11. Barcode detectado → borda verde + nome do med
12. Busca no banco CMED local
13. Se nao encontrou → mensagem + sugerir modo foto
14. Lanterna (toggle)
15. Onboarding primeira vez + botao "?"

### SPRINT 4 — Processamento e confirmacao (tarefas 16-20)
16. Pipeline: barcode → CMED → confirmacao
17. Pipeline: foto → OCR → CMED → confirmacao
18. Card de confirmacao com dados CMED
19. Campos editaveis (frequencia, horario, tipo uso)
20. Alerta de alergia + duplicado

### SPRINT 5 — Fallbacks e edge cases (tarefas 21-25)
21. Permissao negada → galeria + manual
22. Navegador in-app → "Abra no Safari"
23. Manipulado/suplemento → entrada livre
24. Foto borrada → "Tente de novo"
25. Receita com multiplos meds

### SPRINT 6 — Privacidade e acessibilidade (tarefas 26-28)
26. Consentimento LGPD no onboarding
27. Foto descartada apos processar
28. VoiceOver labels + feedback auditivo

### SPRINT 7 — Testes reais (tarefas 29-31)
29. 10 caixas reais no iPhone
30. 10 caixas reais no Android
31. Cenarios de erro (escuro, borrado, sem internet, duplicado, alergia)

---

## PREVISAO DE BUGS E FRUSTRACOES

| # | Bug/Frustacao previsivel | Como prevenir |
|---|-------------------------|---------------|
| 1 | Camera abre nativa em vez de inline | Usar getUserMedia direto (nao html5-qrcode) |
| 2 | Barcode detecta mas e adesivo de preco | Verificar no CMED. Se nao encontrar, avisar |
| 3 | Paciente nao sabe onde e o barcode | Onboarding com animacao mostrando |
| 4 | Toggle confuso pra idoso | Icones claros + tooltip na primeira troca |
| 5 | Foto borrada nao e detectada | Analisar sharpness antes de enviar |
| 6 | OCR demora 15+ segundos | Timeout 10s + botao "Continuar" + "Digitar" |
| 7 | Barcode curvo (frasco) nao le | Dica: "Gire o frasco devagar" |
| 8 | Camera nao foca (celular velho) | Dica: "Afaste um pouco da caixa" |
| 9 | Reflexo no plastico brilhante | Dica: "Mude o angulo da caixa" |
| 10 | Paciente em local escuro | Auto-detectar e sugerir lanterna |
| 11 | iPhone nao vibra | Aceitar (feedback visual suficiente) |
| 12 | In-app browser (WhatsApp) | Detectar e avisar "Abra no Safari" |
| 13 | Multiplos barcodes | Priorizar EAN-13, mostrar opcoes se ambiguo |
| 14 | Medicamento nao no banco | Fallback manual + marcar "nao verificado" |
| 15 | Paciente desiste no meio | Salvar progresso parcial |
| 16 | Camera trava apos trocar modo | Nao reiniciar stream, so mudar overlay |
| 17 | Bateria acabando | Parar camera quando sai da tela |
| 18 | Celular superaquece | Processar a 10fps (nao 30fps) |
| 19 | Duplo-scan (detecta 2x o mesmo) | Flag `barcodeFound` previne |
| 20 | Voltar do quiz pra camera | Camera reinicia limpa |
