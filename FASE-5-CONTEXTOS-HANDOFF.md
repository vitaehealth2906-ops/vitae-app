# FASE 5 — QUEIXA FIEL + CONTEXTOS DO MEDICO — HANDOFF

> A tela do briefing agora serve medico de verdade, nao so o cenario ideal.

---

## 1. O QUE FOI FEITO

Seis entregas, todas em `25-summary.html`:

### 1.1 Bloco "O que o paciente disse" em destaque

Antes do player, antes dos alertas, logo depois do stale warning. E **o ancoramento visual da tela** — a SEGUNDA coisa que o medico ve depois do selo de nivel.

- Fundo azul claro gradiente, borda lateral ciano (cor da marca)
- Aspas tipograficas "..." ao redor do texto, grandes e cianas
- Label uppercase "O QUE O PACIENTE DISSE"
- Meta abaixo: fonte (respondido por escrito / transcricao do audio) + duracao dos sintomas se informou
- Texto LITERAL do paciente — sem parafrase, sem resumo da IA
- Fonte: `r.queixaPrincipal` > `r.queixa` > transcricao do audio (se ≥15 chars)

**Principio 1 do redesign (DESING.md): fidelidade acima de resumo.** Palavras exatas do paciente tem prioridade visual sobre qualquer parafrase da IA. O card "Queixa principal" da Referencia continua existindo mas agora e secundario ao bloco destacado.

### 1.2 Modo privado (botao olho no header)

Clica no icone de olho ao lado do selo de nivel. Toggle on:
- Faixa preta no topo: "MODO PRIVADO ATIVO — dados sensiveis ocultos"
- Foto do paciente: borrada
- Nome, descricao, texto da fala do paciente, transcricao, mensagens dos alertas, itens de referencia: todos borrados (blur)
- Nao ha `user-select` (nao da pra copiar)
- Toggle off: tudo volta. Estado nao persiste entre reloads (intencional — medico ativa sob demanda)

**Quando usa:** consulta com acompanhante nao autorizado, telemedicina com tela compartilhada, paciente curioso olhando.

### 1.3 Modo escuro (botao lua no header)

Clica no icone de lua. Toggle on:
- Fundo #0D0F14, cards #1A1E26
- Texto em tons de cinza claro confortavel
- Estado **persiste em localStorage** (`vitae_theme`): proximo load ja vem escuro
- Sistema auto-ativa dark se `prefers-color-scheme: dark` do SO estiver ligado e o usuario nunca trocou manualmente

**Quando usa:** plantao noturno, luz ambiente baixa.

### 1.4 Responsivo celular (hit targets 48px+)

- Viewport < 480px: botoes voltar e header-icon viram 44px (iOS/Android guideline = 44px min)
- Botao play do audio vira 64px (era 56)
- Skip buttons: 44px
- Chip de velocidade: 44px min-height
- Palavras da transcricao clicavel: padding aumentado + min-height 32px (menos frustracao de toque)
- Card da fala e honest-empty com fontes maiores (16px em vez de 15)

### 1.5 Desktop grande (≥1200px)

- Patient name 26px (era 22)
- Texto da fala e mensagens com +1-2px
- Mantido proporcional — nao fica desproporcional em 1920+

### 1.6 Daltonismo nos alertas (alem do selo)

Borda lateral dos insight-cards nao depende mais so de cor:
- **Urgente**: listras vermelhas diagonais (em vez de barra solida vermelha)
- **Atencao**: listras amarelas em diagonal inversa
- **Info**: barra solida azul
- **Queixa**: barra solida ciano
- **Historico**: listras roxas horizontais

Deuteranopio agora diferencia urgente/atencao/info sem depender de cor — o **padrao** da borda ja basta.

### 1.7 Contraste WCAG AA em textos secundarios

- `--v-ink3` (#6B7280, 4.5:1 limite) → forcado pra #4B5563 (7.2:1) em `.patient-age`, `.insight-msg`, `.fala-paciente-meta`.
- Margem confortavel de leitura em luz ambiente de consultorio.

---

## 2. TESTAR

### Teste 1 — Bloco "O que o paciente disse"
Abrir briefing respondido. Logo abaixo do patient-hero e stale warning (se tiver), deve aparecer bloco azul claro com o texto literal do paciente entre aspas.

### Teste 2 — Modo privado
Clicar no icone de olho. Deve aparecer faixa preta no topo + foto/nome/textos borrados. Clicar de novo volta.

### Teste 3 — Modo escuro
Clicar no icone de lua. Tela fica preta. Fecha a aba, abre de novo — continua escura (persistencia).
Clicar de novo volta pro claro. Idem persiste.

### Teste 4 — Auto-dark
Trocar SO pra modo escuro (Windows: Configuracoes > Personalizacao > Modo). Abrir briefing numa aba nova que NUNCA teve toggle manual: deve abrir escura automaticamente.

### Teste 5 — Daltonismo
Chrome DevTools > Rendering > Emulate vision deficiencies > Deuteranopia. Abrir briefing com alertas urgente E atencao. Confirmar que a BORDA LATERAL diferencia os dois (listra vermelha grossa vs listra amarela suave).

### Teste 6 — Celular
Chrome DevTools > Toggle device toolbar > iPhone SE (375px). Abrir briefing. Confirmar que botoes do player sao mais redondos, mais faceis de tocar com polegar.

---

## 3. O QUE NAO FOI FEITO NESTA FASE

- **Modo apresentacao fullscreen** (teleconsulta). Complexo, valor marginal — se o medico quiser, ja consegue com F11 do browser.
- **Prefetch do proximo paciente** (plantao). Depende de arquitetura do dashboard — fica pra Fase 8.
- **Botao "Proximo paciente" FAB** no briefing. Idem.
- **Breadcrumb dinamico por origem** (from=emergencia&filtro=criticos). Sem urgencia agora.
- **Anotacoes, checkbox em alertas, timeline de consultas.** Fase 8.

---

## 4. ACOES DO LUCAS

1. Deploy (so frontend — sem migracao).
2. Rodar os 6 testes acima.
3. **Mostrar pra 2-3 pessoas diferentes:** 1 com celular, 1 em desktop, 1 com daltonismo se possivel (pai, avo, amigo). Perguntar: "voce entende o que e cada selo? voce consegue usar no celular? o modo privado faz sentido?"

Se algum feedback for "confuso" ou "feio", me fala — ajusto.

---

## 5. PROXIMO PASSO

Depois de validar, manda **"bora f6"** — inicio Fase 6 (Ingestao por pecas + retomada + dedupe no backend). Essa e a grande reforma da pre-consulta do paciente (celular, 3G, salvamento local).
