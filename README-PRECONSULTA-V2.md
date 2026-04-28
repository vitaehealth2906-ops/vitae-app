# Pré-consulta V2 — Como ativar e testar

> Sistema novo de **pergunta-por-pergunta linear** com formato minimalista aprovado.
> Por padrão DESLIGADO em produção. Você ativa quando quiser testar.

---

## ⚙️ Como ativar

### Opção 1 — Adicionar `?v=2` na URL (mais simples, por sessão)

Abra o link da pré-consulta com `?v=2` no fim:

```
https://vitae-app.vercel.app/pre-consulta.html?token=ABC123&v=2
```

Resultado: redireciona automaticamente pra `pre-consulta-v2.html`. Funciona pro betatester sem precisar de nada extra.

### Opção 2 — Ativar permanente no celular

No console do navegador (F12 → Console):

```js
localStorage.setItem('vitae_fluxo_v2', 'true');
```

Depois disso, qualquer link de pré-consulta nesse celular cai no V2.

Pra desativar:
```js
localStorage.removeItem('vitae_fluxo_v2');
```

### Opção 3 — Ativar global pra todos (futuro)

Quando quiser que TODOS os pacientes caiam no V2 sem precisar de `?v=2`, edite o `pre-consulta.html`:

Procure o bloco `<!-- ═══ FEATURE FLAG V2 ═══` e adicione `|| true` na condição:

```js
if (queryV2 || storageV2 || globalV2 || true) {  // ← adiciona || true
```

Faz commit, push, e pronto — todo paciente novo cai no V2.

---

## 🚨 Como fazer rollback rápido (se algo desabar)

**Sem deploy:**
- Removendo `?v=2` do link enviado, paciente cai automaticamente no V1.
- Se ativou via localStorage: limpa `localStorage.removeItem('vitae_fluxo_v2')`.

**Com deploy (rollback total):**
- Edita `pre-consulta.html` removendo o bloco `<script>` de feature flag.
- Push. Pronto — todos voltam ao V1.

---

## 🧪 Roteiro de teste antes do médico

### Teste 1 — Fluxo completo no seu celular
1. Abra `https://vitae-app.vercel.app/pre-consulta.html?token=SEU_TOKEN&v=2`
2. Veja as 3 telas de onboarding (Por quê / Como / Controle)
3. Toque "Começar gravando"
4. Veja a primeira pergunta gigante: *"O que está te incomodando hoje?"*
5. Toque no microfone, fale resposta, aguarde 5s de silêncio
6. Sistema deve mostrar "Anotando..." → "Anotei: [valor]"
7. Próxima pergunta deve aparecer automaticamente
8. Repita pra todas as 11 perguntas
9. Tela final de revisão: vê todas as respostas com badges
10. Aperta "Enviar pro médico"

### Teste 2 — Pular pergunta
1. Numa pergunta, toque "Pular" (rodapé)
2. Deve avançar imediatamente, marcando como pulada
3. Na revisão final, badge AMARELO "pulado"

### Teste 3 — "Não sei"
1. Numa pergunta, toque "Não sei" (rodapé)
2. Deve avançar, marcando como desconhecer
3. Na revisão final, badge CINZA "não soube"

### Teste 4 — Modo formulário
1. Na tela de áudio, toque "Preencher formulário"
2. Cards expansíveis aparecem
3. Digite respostas e clique "Salvar resposta" em cada uma
4. Mínimo de 7 respostas pra liberar envio

### Teste 5 — Bloqueio de envio
1. Pule 5+ perguntas
2. Vá pra revisão
3. Tela mostra "Ainda não dá pra enviar — você respondeu só 3 de 11"
4. Botão único "Voltar e completar 3 perguntas"
5. Não tem opção de "enviar mesmo assim"

### Teste 6 — Médico recebe (CRÍTICO)
1. Após enviar, abra como médico no desktop:
   `https://vitae-app.vercel.app/desktop/app.html#pre-consultas/[ID-DA-PC]`
2. Veja a anamnese estruturada com badges:
   - Verde "áudio" pras respostas faladas
   - Amarelo "pulado" pras puladas
   - Cinza "não soube" pras "não sei"
3. Mesmo no mobile (`25-summary.html`)

### Teste 7 — Retomada
1. No meio do fluxo (pergunta 5), feche a aba
2. Abra o mesmo link de novo
3. Banner: "Voltamos de onde você parou — pergunta 5"
4. Continua de onde parou

---

## 📊 O que o V2 muda em relação ao V1 (atual)

| Aspecto | V1 (atual) | V2 (novo) |
|---|---|---|
| Captura | Áudio único de 45-90s sobre tudo | 11 áudios curtos, um por pergunta |
| Cobertura média | 30-50% (5/11) | 80-100% (9-11/11) |
| Detecção fim | Botão manual | 5 segundos de silêncio (Lucas confirmou) |
| Confiança IA | Sem threshold | ≥85% autônomo, 60-84% pede confirmação |
| Mínimo envio | Sem mínimo | 7 de 11 obrigatórias |
| Toggle áudio↔form | Some quando grava (BUG) | Sempre visível |
| Onboarding | 3 slides genéricos | 2 boas-vindas + 3 pré-gravação |
| Fontes no summary | 2 (audio/formulario) | 4 (audio/formulario/pulado/desconhecer) |

---

## 🔧 Estrutura técnica

**Arquivos novos:**
- `pre-consulta-v2.html` — UI completa V2
- `README-PRECONSULTA-V2.md` — esse arquivo

**Arquivos modificados:**
- `pre-consulta.html` — adicionado redirect pra V2 via flag
- `pre-consulta-slides.html` — REESCRITO com 2 telas boas-vindas
- `25-summary.html` — suporte 4 fontes (mobile médico)
- `desktop/app.html` — suporte 4 fontes (desktop médico)
- `backend/src/services/ai.js` — função `classificarRespostaIndividual` + `enriquecerFontesAnamneseV2`
- `backend/src/routes/pre-consulta.js` — endpoint novo `POST /t/:token/classificar-resposta` + `enriquecerRespostasV2` (dual-write)

**Banco de dados:** ZERO mudanças. Tudo entra em `respostas._v2` (Json livre).

---

## ⚠️ Limitações conhecidas (corrigir se aparecer em uso real)

1. Detector de silêncio em 5s pode parecer demorado — se médico reclamar, ajustar pra 2-3s no `CFG.silencioMs` do `pre-consulta-v2.html`.
2. Whisper transcrição de nomes médicos brasileiros (Dipirona, Losartana, etc) pode errar — sem dicionário CMED ainda. Se acontecer muito, adicionar.
3. Modo formulário não tem auto-save por digitação — só ao clicar "Salvar resposta". Pode ser melhorado.
4. WhatsApp in-app browser ainda não tem detecção/aviso no V2 — se paciente abrir pelo WhatsApp, mic não funciona. Adicionar igual V1.
5. Sem teste em 5 pessoas leigas antes do médico (Lucas decidiu pular esse passo).
