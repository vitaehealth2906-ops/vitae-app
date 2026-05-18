# Relatório — Bateria de testes pré-consulta (18/mai/2026)

Antes dos 3 médicos testarem amanhã, rodei uma bateria de **17 cenários** simulando
tudo que pode dar errado quando paciente envia a pré-consulta.

**Resultado: 17/17 PASS.**

---

## O que foi corrigido no app

### Erro era invisível pro paciente
**Antes:** quando dava erro no "Enviar pro médico", aparecia um banner LÁ EM CIMA da tela.
O paciente estava scrollado lá embaixo (depois de revisar 11 respostas) e só via o botão
mudar pra "Tentar enviar de novo". Achava que o app travou.

**Agora:** o erro aparece **dentro da barra fixa do botão** (em cima dele), com cor,
título grande, mensagem amigável e botão de ação. A tela rola sozinha pra mostrar.

### 7 tipos de erro com mensagem específica + ação

| Status backend | O que paciente vê agora | Botão de ação |
|----------------|-------------------------|---------------|
| 400 cobertura | "Faltam X respostas" (laranja) — diz quantas faltam | "Ir para o que falta" → volta direto na primeira pergunta vazia |
| 404 link inválido | "Link não encontrado" (vermelho) — "Confere o link no WhatsApp" | — |
| 410 link expirou | "Link expirou" (vermelho) — "Pede um novo pro médico" | — |
| 409 já enviado | "Já foi enviado!" (verde) — "Tudo certo" | "Continuar" → onboarding pós-envio |
| 500 servidor caiu | "Servidor com problema" (vermelho) — "Suas respostas estão salvas, tenta em 1 min" | — |
| 401 sessão expirou | "Sessão expirou" (laranja) — "Recarrega e entra de novo" | "Recarregar página" |
| Network/offline | "Sem conexão" (laranja) — "Verifica WiFi, suas respostas estão salvas" | — |
| Timeout (>30s) | "Servidor lento" (laranja) — "Tenta de novo em alguns segundos" | — |

### Modo debug pra investigar bugs ao vivo amanhã

Se você abrir o link com `?debug=1` no final (ex:
`https://vitae-app.vercel.app/pre-consulta.html?token=ABC&debug=1`), o card de erro mostra
um bloco técnico expandido com: status HTTP, corpo da resposta, tempo de envio, user agent,
estado online/offline.

Paciente tira print → manda pra você → você consegue diagnosticar sem precisar do F12.

Você pode também ativar global no celular sem precisar mexer no link:
F12 do Mac/PC ou abre o link no navegador desktop e digita no console:
`localStorage.setItem('vitae_debug', '1')` → vale pra sempre nesse celular.
Pra desligar: `localStorage.removeItem('vitae_debug')`.

---

## Bateria 1 — Erros de finalização (9/9 PASS)

Cada um simula uma resposta HTTP diferente do backend ao chamar /finalizar.

| # | Cenário | Status esperado | Resultado |
|---|---------|-----------------|-----------|
| 1 | 400 Cobertura insuficiente | titulo "Faltam X respostas" + botão "Ir para o que falta" + laranja | ✅ PASS |
| 2 | 404 Pré-consulta não encontrada | titulo "Link não encontrado" + vermelho | ✅ PASS |
| 3 | 410 Link expirou | titulo "Link expirou" + vermelho | ✅ PASS |
| 4 | 409 Já respondida | titulo "Já foi enviado" + botão "Continuar" + verde | ✅ PASS |
| 5 | 500 Servidor caiu | titulo "Servidor com problema" + vermelho | ✅ PASS |
| 6 | 401 Sessão expirou | titulo "Sessão expirou" + botão "Recarregar" + laranja | ✅ PASS |
| 7 | Network error | titulo "Sem conexão" + laranja | ✅ PASS |
| 8 | Timeout (abort) | titulo "Servidor lento" + laranja | ✅ PASS |
| 9 | 200 Sucesso | nenhum erro inline (transição pro onboarding) | ✅ PASS |

Screenshots: `tests/shots/erro-finalizar-*/` (9 imagens, 1 por cenário).

---

## Bateria 2 — Complicações no fluxo (8/8 PASS)

Simula situações que pacientes reais geram além dos erros normais.

| # | Cenário | Validação | Resultado |
|---|---------|-----------|-----------|
| 1 | Paciente abre no WhatsApp in-app browser | UA WhatsApp → `detectarInAppBrowser()` retorna true | ✅ PASS |
| 2 | Clica "Enviar" 3 vezes rápido (race) | só 1 chamada chega no backend (botão disabled) | ✅ PASS |
| 3 | Pré-consulta já respondida ao carregar | tela de erro com título "já respondeu" | ✅ PASS |
| 4 | Link expirado ao carregar (não no envio) | tela de erro com título "expirou" | ✅ PASS |
| 5 | Token inválido ao carregar | tela de erro com título sobre link inválido | ✅ PASS |
| 6 | Network offline durante envio | erro inline laranja "Sem conexão" aparece | ✅ PASS |
| 7 | Visibility hidden (tela bloqueia) | listener não quebra a página | ✅ PASS |
| 8 | 2 abas simultâneas | aba 1 sucesso + aba 2 vê "Já foi enviado" (409 verde) | ✅ PASS |

Screenshots: `tests/shots/complicacoes-*/` (9 imagens).

---

## Cenários que NÃO dá pra automatizar (precisam de paciente real ou ajuste manual)

| Cenário | Por que não dá | Mitigação |
|---------|----------------|-----------|
| Paciente fala muito baixo | Precisa de áudio real com voz humana | Sessão 16 baixou threshold RMS pra 0.006. Testar manual com pelo menos 1 paciente |
| Whisper transcreve errado | Modelo de IA — varia por pronúncia/sotaque | Paciente sempre confirma antes de enviar (Sessão 17 — Caminho A) |
| Mic bluetooth desconecta | Hardware | Detector já existe no V4 |
| Paciente fala E digita junto | Estado de captura é exclusivo no V4 (audio OU texto) | App não permite — botão de modo bloqueia |
| Cola texto enorme (>10k chars) | Backend pode rejeitar — não validado | Adicionar limite client-side amanhã se aparecer |
| Só emoji na resposta | Whisper não transcreve, Gemini extrai vazio | Cai no caso "respondeu=false → motivo: sem_resposta" |

---

## Como rodar de novo (você ou eu)

```
cd d:/vitae-app-novo
node tests/cenarios-erro-finalizar.js
node tests/cenarios-complicacoes.js
```

Os screenshots ficam em `tests/shots/`. Logs JSON em `tests/logs/`.

---

## Próximo passo recomendado pra amanhã

1. **Você dá `?debug=1` pros 3 médicos no link** — assim se der erro, paciente tira print
   e você diagnostica em 5 segundos em vez de chutar.
2. **Eu monitoro** os erros conforme aparecerem (você me manda screenshots).
3. **Cada erro novo que aparecer vira novo cenário** na bateria automatizada.

---

## Arquivos modificados nesta sessão

- `pre-consulta.html` — banner inline + classificarErroFinalizar + mostrarErroInline + modo debug
- `serve.js` — aceita PORT via env var (pra rodar testes em portas alternativas)
- `tests/cenarios-erro-finalizar.js` (novo) — bateria 9 cenários de erro
- `tests/cenarios-complicacoes.js` (novo) — bateria 8 complicações
- `RELATORIO-BATERIA-PRECONSULTA-18MAI.md` (este arquivo)
