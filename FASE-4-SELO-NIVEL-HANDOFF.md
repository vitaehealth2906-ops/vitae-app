# FASE 4 — SELO DE NIVEL + FALLBACK HONESTO — HANDOFF

> A tela do medico nunca mais mente sobre a qualidade do briefing.

---

## 1. O QUE FOI FEITO

### Selo de nivel no canto superior direito do briefing

Primeira coisa que o medico ve depois do botao voltar. **Cor + icone + padrao visual — os 3 redundantes** pra garantir que medico daltonico distingue sem depender de cor.

| Nivel | Nome | Cor | Padrao do marcador | Quando aparece |
|---|---|---|---|---|
| 5 | Briefing completo | Verde | Circulo solido | Tudo gerado OK |
| 4 | Sem voz | Azul | Circulo tracejado | TTS falhou — texto substitui player |
| 3 | Sem resumo | Amarelo | Listras diagonais | IA falhou — mostra transcricao crua |
| 2 | Audio bruto | Laranja | Grade cruzada | Transcricao falhou — so audio original |
| 1 | So texto | Laranja | Grade pontilhada | Paciente escreveu, nao gravou |
| 0 | Nao respondeu | Cinza | Circulo pontilhado vazio | Link nao foi respondido |

O selo tem `title` com explicacao completa ao passar o mouse/apertar longo.

### Player de audio com fallback honesto

Antes: se TTS falhava, player aparecia vazio, medico clicava play e nada acontecia.

Agora:
- **Se nivel = 4 ou TTS falhou/suspeito** → substitui o player por um **bloco destacado** com titulo "Leia o resumo abaixo" e o texto completo do resumo dentro. Aviso claro: "A voz do briefing nao pode ser gerada. O resumo em texto esta disponivel."
- **Se TTS ainda esta processando** → bloco azul "Audio em processamento — aguarde alguns minutos e atualize".

### Cards de Pontos de Atencao com fallback honesto

Antes: se a IA nao gerava alertas, a secao simplesmente sumia. Medico nao sabia se era porque tudo estava OK ou porque a IA falhou.

Agora:
- Se **nivel entre 1 e 3 e sem alertas** → mostra bloco honest-empty:
  - `statusResumoIa = 'falhou'`: "O resumo automatico nao foi gerado. Consulte a transcricao ou as respostas do paciente abaixo."
  - Outros casos: "Nenhum cruzamento critico detectado. Avalie o contexto clinico."
- Se nivel 5 e sem alertas, a secao segue oculta (comportamento atual — nivel 5 significa IA rodou e escolheu nao gerar alertas).

### Nivel 0 — paciente nao respondeu

Tela simplifica completamente. Mostra: header + foto + nome + bloco grande "Paciente ainda nao respondeu. Reenvie pelo WhatsApp ou entre em contato." Nao carrega player, transcricao, cards. Vai direto pro fim.

### Limpeza LGPD (B05 do audit)

Removido o `console.log` em `init()` que expunha:
- Tamanho do summary text
- audioUrl
- Flag de textoVoz / summaryTexto / summaryIA
- Numero de palavras da transcricao

Isso era visivel em F12 → crime LGPD direto. Agora nao registra.

### Fallback pra briefings antigos

Briefings antigos (pre-Fase 3) nao tem campo `nivelBriefing` no banco. O frontend **deriva** o nivel na hora baseado em: tem audio? tem transcricao? tem summary? tem TTS? Roda o mesmo algoritmo da Fase 3 no cliente como redundancia.

**Consequencia:** mesmo sem rodar o `/admin/backfill-nivel` da Fase 3, briefings antigos ja ganham o selo correto ao abrir. O backfill so economiza o calculo (e prepara pra queries por nivel no dashboard do medico, Fase 8).

---

## 2. TESTAR OS 6 NIVEIS SEM CRIAR BRIEFING FAKE

Adicionei query string `?forceNivel=N` (0 a 5) pra voce poder ver cada um visualmente:

- `25-summary.html?id=XXX&forceNivel=5` — verde, completo
- `25-summary.html?id=XXX&forceNivel=4` — azul, sem voz (player vira texto)
- `25-summary.html?id=XXX&forceNivel=3` — amarelo, sem resumo
- `25-summary.html?id=XXX&forceNivel=2` — laranja, audio bruto
- `25-summary.html?id=XXX&forceNivel=1` — laranja, so texto
- `25-summary.html?id=XXX&forceNivel=0` — cinza, nao respondeu (tela simplificada)

Valida com qualquer briefing ja existente. O forceNivel so muda o **visual** do selo e fallbacks — nao altera banco de dados.

---

## 3. TESTE DE DALTONISMO (auto-check)

**Antes de mandar pro medico real, rodar 1x:**

1. Abrir `25-summary.html?id=XXX&forceNivel=5` em Chrome
2. F12 > Console > More tools > Rendering
3. Em "Emulate vision deficiencies" selecionar "Deuteranopia" (verde-vermelho)
4. Repetir pros 6 niveis
5. Confirmar que **cada selo e distinguivel** mesmo sem a cor — pelo marcador e pelo texto.

Se algum ficar ambiguo, me fala — ajusto o padrao.

---

## 4. O QUE MEDICO PERCEBE DIFERENTE AGORA

**Abrindo briefing nivel 5:** nada mudou visualmente alem do selo verde no canto. Experiencia igual.

**Abrindo briefing nivel 4:** selo azul "Sem voz". Onde antes tinha player vazio + transcricao quebrada, agora tem **bloco destacado com titulo "Leia o resumo abaixo"** e o texto inteiro. Transparencia total.

**Abrindo briefing nivel 3:** selo amarelo "Sem resumo". Onde antes a secao de alertas sumia, agora tem **honest-empty** explicando que o resumo automatico nao foi gerado.

**Abrindo briefing nivel 0:** selo cinza "Nao respondeu". Tela mostra so foto + nome + CTA pra reenviar. Nao tenta carregar nada que nao existe.

---

## 5. O QUE NAO FOI FEITO NESTA FASE

- **Badge de nivel na lista do dashboard do medico** (Fase 8). Por enquanto o medico so ve o nivel ao abrir o briefing.
- **Modo escuro / noturno.** Planejado pra Fase 5.
- **Responsividade pra celular com uma mao.** Planejado pra Fase 5.
- **Anotacoes efemeras / checkbox em alertas / timeline de consultas do paciente.** Fase 8.

---

## 6. ACOES MANUAIS DO LUCAS

### ACAO 1 — Validar visualmente com ?forceNivel

Abrir um briefing ja respondido e testar `?forceNivel=0` ate `5`. Confirmar que cada tela parece honesta e coerente.

### ACAO 2 — Teste de daltonismo (Chrome DevTools)

Seguir o passo-a-passo da secao 3 acima. Se achar que algum selo fica ambiguo, me fala.

### ACAO 3 — Deploy

Commitar e subir. Nao ha migracao de banco nesta fase — mudancas sao so frontend. Deploy e imediato.

---

## 7. PROXIMO PASSO

Depois de validar, me manda **"bora f5"** que eu inicio a Fase 5 (Queixa fiel expandida + Contextos do medico — celular, plantao, teleconsulta, modo privado, modo escuro).
