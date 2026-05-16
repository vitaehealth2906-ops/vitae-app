# Plano de Execução Autônoma dos 10 Lotes — App v3 Paciente vita id

> Data: 14/05/2026
> Autor: Claude Opus 4.7 (1M context)
> Aprovador: Lucas Borelli (fundador)
> Status: Aguardando aprovação do Lucas
>
> Este documento é o **plano definitivo** para o Claude executar autonomamente os 10 lotes de implementação do app v3 paciente do vita id. Cada lote será testado com Playwright simulando usuário real. Nada de interromper Lucas no meio. O documento detalha CADA arquivo, CADA linha, CADA endpoint, CADA teste, CADA cenário de erro, CADA passo de deploy, e CADA critério de pronto.
>
> Insumos consolidados:
> - `MANUAL-BACKEND-COMPLETO.md` (94 KB / 2054 linhas) — o que o backend oferece
> - `MANUAL-APP-ANTIGO-USO-BACKEND.md` (58 KB) — padrão de uso
> - `MANUAL-FEATURES-ESPECIAIS.md` (122 KB / 3635 linhas) — fórmulas internas
> - `MAPA-IMPLEMENTACAO-FINAL.md` (55 KB / 986 linhas) — escopo aprovado
> - `app-v3/*.html` — 38 arquivos HTML reais (3 sandbox excluídos)
> - `app-v3/api-real.js` (626 linhas) — todas as funções vitaeAPI
> - `tests/smoke-quiz-50.js` + `tests/auditoria-completa.js` — padrão Playwright
> - `CLAUDE.md` — regras absolutas
>
> ATENÇÃO LUCAS: Leia este plano **inteiro** antes de aprovar. Ele é grande de propósito — o Claude vai usar como bíblia durante 30-40h de execução sozinho. Cada coisa não-documentada vira decisão arbitrária do Claude (que você não vai gostar). Mexa onde quiser: ordem, escopo, critérios. Pode pedir pra remover lotes inteiros. Mas não aprove "no automático" — esse documento é o contrato.

---

# PARTE 0 — Setup, Princípios e Workflow Absoluto

Esta seção é **lida e relida** pelo Claude entre cada lote. É a "constituição" da execução autônoma. Se algo aqui não estiver claro, o Claude PARA e pergunta. Mas o objetivo é deixar tão explícito que nenhuma pergunta seja necessária.

## 0.1 Ambiente de Trabalho

### 0.1.1 Diretório raiz

Todo trabalho acontece em `d:\vitae-app-novo\`. Esta é a pasta ATIVA do projeto (a outra pasta `d:\vitae-app-github\` foi deletada — não existe mais).

Estrutura relevante:

```
d:\vitae-app-novo\
├── app-v3\               <-- pasta principal deste plano (38 telas HTML)
│   ├── api-real.js       <-- biblioteca vitaeAPI (NUNCA editar sem aviso)
│   ├── 01-saude.html
│   ├── 03-medicamentos.html
│   ├── (...todas as 38 telas)
│   └── shots\            <-- screenshots Playwright (gerado em runtime)
├── tests\                <-- pasta dos testes Playwright
│   ├── smoke-quiz-50.js  <-- padrão de teste pra estudar
│   ├── auditoria-completa.js
│   ├── credenciais-lotes.json  <-- CRIAR pra registrar pacientes de teste
│   ├── bugs-encontrados.json   <-- CRIAR pra log de bugs
│   ├── lote-1-saude-home.js    <-- CRIAR no Lote 1
│   ├── lote-2-meds.js          <-- etc
│   └── shots\
│       ├── lote-1\
│       ├── lote-2\
│       └── (...)
├── api.js                <-- versão da raiz (não usar)
├── CLAUDE.md             <-- regras absolutas
├── MANUAL-BACKEND-COMPLETO.md
├── MAPA-IMPLEMENTACAO-FINAL.md
├── package.json          <-- contém scripts npm
├── vercel.json
└── PLANO-EXECUCAO-LOTES-AUTONOMO.md  <-- este arquivo
```

### 0.1.2 Servidor local

Para testar local, rodar antes de tudo:

```powershell
cd d:\vitae-app-novo
python -m http.server 3000
```

Servidor responde em:
- `http://localhost:3000/app-v3/01-saude.html` (telas individuais)
- `http://localhost:3000/app-v3/app.html` (shell SPA — só usar pra testes integrados)

Por padrão, `api-real.js` aponta pra Railway (produção). Pra rodar local com backend local:

```
http://localhost:3000/app-v3/01-saude.html?api=local
```

NÃO USAR backend local nos lotes. Sempre Railway — é o estado de produção.

### 0.1.3 Backend de produção

URL: `https://vitae-app-production.up.railway.app`

Tem auto-deploy a partir do branch `main` do repo backend (separado deste).

NÃO MEXER no backend nesta rodada. Se descobrir bug ou endpoint faltando, **registrar em `tests/bugs-encontrados.json` com flag `backend: true`** e seguir adiante. Pular feature se for impossível sem backend.

### 0.1.4 Deploy Vercel

URL produção do app: `https://vitae-app.vercel.app`
URL v3: `https://vitae-app.vercel.app/app-v3/01-saude.html`
URL alternativa preview: `https://vitae-gr5jltjh5-vitaehealth2906-ops-projects.vercel.app/app-v3/`

Cada `git push origin <branch>` dispara deploy automático em ~90-120 segundos. O branch ativo deste trabalho é `feat-app-v3-paciente`. Se não existir, criar.

Verificação de deploy concluído:

```powershell
# Espera por 120s, depois verifica
Start-Sleep -Seconds 120
$r = Invoke-WebRequest "https://vitae-app.vercel.app/app-v3/01-saude.html" -Method Head
$r.StatusCode  # deve ser 200
$r.Headers["x-vercel-id"]  # mostra id do deploy
```

### 0.1.5 Branch do git

Branch ativo: `feat-app-v3-paciente`

Se não existir:

```powershell
git fetch origin
git checkout -b feat-app-v3-paciente origin/main
git push -u origin feat-app-v3-paciente
```

Se existir mas estiver atrás:

```powershell
git checkout feat-app-v3-paciente
git pull origin feat-app-v3-paciente --rebase
```

**Antes de qualquer trabalho**, rodar:

```powershell
git status
git log --oneline -5
```

Se houver mudanças não commitadas que o Claude não fez, **PARAR e perguntar**. Pode ser do Lucas no celular ou do PC da faculdade.

### 0.1.6 Playwright

Já instalado em `node_modules`. Verificar com:

```powershell
cd d:\vitae-app-novo
node -e "console.log(require('playwright').devices['iPhone 14'])"
```

Se quebrar:

```powershell
npm install playwright --save-dev
npx playwright install msedge
```

**Channel obrigatório**: `msedge` (Microsoft Edge). Não usar Chrome — no Windows, Chrome precisa de permissão administrativa.

**Viewport padrão**: 500x950px (simula iPhone 14 em paisagem do frame do app).

**Headless**: SEMPRE `false` durante desenvolvimento. Permite o Claude ver o browser e capturar evidência visual. Para CI futuro, mudar pra `true`.

## 0.2 Paciente de Teste Padrão

A cada lote, criar **3 contas de teste** com sufixo único:

```javascript
const sufixo = Date.now(); // ex: 1715731234567
const paciente = {
  nome: `Lote${N} Test ${sufixo}`,
  celular: '(11) 9' + String(sufixo).slice(-4) + '-' + String(sufixo).slice(-4).split('').reverse().join(''),
  email: `lote${N}-${sufixo}@vitae-test.com`,
  senha: 'TesteSenha123!'
};
```

As 3 contas representam:

1. **Paciente NOVO sem perfil**: só cadastrou. Não preencheu nada.
2. **Paciente parcial**: completou quiz mas sem meds/alergias.
3. **Paciente cheio**: 3 meds + 3 alergias + 2 exames + 1 agendamento.

Cada conta criada via API direto (não via UI — mais rápido). Sempre via Railway.

### 0.2.1 Salvar credenciais

Após criar, salvar em `tests/credenciais-lotes.json`:

```json
{
  "lote-1": [
    { "nivel": "novo", "email": "lote1-1715731234567@vitae-test.com", "senha": "TesteSenha123!", "userId": "abc123", "criadoEm": "2026-05-14T19:30:00Z" },
    { "nivel": "parcial", "email": "...", "senha": "...", "userId": "..." },
    { "nivel": "cheio", "email": "...", "senha": "...", "userId": "..." }
  ],
  "lote-2": [...],
  "lote-3": [...]
}
```

NÃO REUSAR contas entre lotes. Cada lote usa contas novas pra não poluir state.

### 0.2.2 Limpeza de contas antigas

NÃO fazer cleanup automático. Backend não tem endpoint DELETE /usuario protegido. Contas de teste ficam até o backend rodar GC manual (Lucas faz).

Se acumular muita conta de teste no Railway e degradar perfomance, parar e pedir Lucas pra limpar.

## 0.3 Padrão de Commit Obrigatório

Cada lote vira UM único commit (pode quebrar em 2-3 se tiver muita coisa, mas preferência é 1).

Formato:

```
feat(app-v3): LOTE N — descrição breve até 60 chars

- Bullet 1: o que mudou (verbo no passado: "trocou", "conectou", "removeu")
- Bullet 2: telas afetadas
- Bullet 3: funções vitaeAPI conectadas
- Bullet 4: testes Playwright (X/X cenarios passaram)

Tests: Playwright X/X passed contra http://localhost:3000
Validated: Playwright X/X passed contra https://vitae-app.vercel.app/app-v3 (deploy YYY)
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Exemplo real do Lote 1:

```
feat(app-v3): LOTE 1 — Tela Saúde HOME conectada ao backend

- Trocou nome, RG, dataNasc, tipo sanguíneo, contato emergência hardcoded por chamadas reais
- Conectou cards de medicamentos e alergias com listarMedicamentos e listarAlergias
- Adicionou estado de loading inline (skeleton) e empty state pra paciente sem perfil
- Telas afetadas: 01-saude.html, 40-saude-vazia.html, 52-loading-home.html
- Funções vitaeAPI conectadas: getPerfil, listarAlergias, listarMedicamentos
- Testes: 8 cenários Playwright (paciente novo / paciente cheio / sem rede / 401 / etc)

Tests: Playwright 8/8 passed local
Validated: Playwright 8/8 passed contra vitae-app.vercel.app/app-v3 (deploy v3-2026-05-14-15)
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

NUNCA usar `--no-verify`. NUNCA usar `--amend`. Cada falha gera novo commit (não amend).

## 0.4 Workflow Obrigatório por Lote

Esta é a sequência ESTRITA. Não pular passos. Não inverter ordem.

### Passo 1: Pre-flight
- Ler PARTE 0 deste documento de novo (sim, toda vez)
- Ler PARTE N (o lote atual) inteira
- `git status` — se sujo, perguntar Lucas
- `git pull origin feat-app-v3-paciente --rebase` — sincronizar
- Confirmar `python -m http.server 3000` está rodando (em outro terminal)

### Passo 2: Setup do lote
- Criar branch local de trabalho se necessário (NÃO fazer push ainda)
- Listar todos os arquivos a tocar (do plano)
- Para cada arquivo:
  - `Read` linha por linha do estado atual
  - Anotar linhas hardcoded que sairão (usar `Grep` ou ler trechos)
  - Verificar referências entre arquivos (links, ids)
- Criar os arquivos de teste:
  - `tests/lote-N-<nome>.js` (vazio com cabeçalho boilerplate)

### Passo 3: Implementação
- Editar arquivos um por vez
- Após cada arquivo, abrir manualmente no browser e verificar visualmente (Playwright screenshot)
- Se quebrou layout, reverter o `Edit` e tentar outra abordagem
- NÃO COMMITAR ainda — deixar tudo no working tree

### Passo 4: Testes locais
- Rodar `node tests/lote-N-<nome>.js`
- Se 100% passou, ir pro Passo 5
- Se falhou:
  - Anotar em `tests/bugs-encontrados.json`
  - Investigar causa
  - Corrigir
  - Re-rodar
  - Repetir até 100%

### Passo 5: Commit + push
- `git add` arquivos específicos (NUNCA `git add .`)
- `git commit -m "..."` (formato 0.3)
- `git push origin feat-app-v3-paciente`

### Passo 6: Aguardar deploy
- Capturar timestamp do push
- Esperar 120s
- Verificar deploy:
  ```powershell
  Invoke-WebRequest "https://vitae-app.vercel.app/app-v3/01-saude.html" -Method Head
  ```
- Se erro 500 ou timeout: investigar Vercel logs, mas NÃO REVERTER o commit (o deploy normalmente recupera)

### Passo 7: Validação em produção
- Rodar `node tests/lote-N-<nome>.js --prod`
- Se 100% passou → marcar lote DONE e ir pro próximo
- Se falhou na produção mas passou local: investigar diferença (CORS, env var, dados antigos)
  - Se for diferença de dados (cache), aguardar 5min e re-rodar
  - Se for bug real: revert o commit, fix, novo commit, retest

### Passo 8: Atualizar artefatos
- Updateiar `MAPA-IMPLEMENTACAO-FINAL.md` marcando lote ✅
- Updateiar `CLAUDE.md` adicionando entrada na seção PARTE B (sessões)
- Commit separado: `docs: atualizar status pós-LOTE N`

### Passo 9: Reset
- `git status` limpo
- `tests/bugs-encontrados.json` revisado (bugs do lote resolvidos)
- Memória mental limpa
- Voltar pro Passo 1 com o próximo lote

## 0.5 Regras Absolutas — NUNCA Quebrar

Lista numerada. Cada vez que o Claude estiver prestes a fazer algo, percorrer mentalmente esta lista. Se qualquer ação **viola**, abortar e perguntar Lucas.

1. **NUNCA usar `--accept-data-loss` em Prisma.** Em 17/04/2026 isso destruiu os dados do Lucas. Banheira de sangue.
2. **NUNCA mudar `backend/prisma/schema.prisma`.** Esta rodada é só frontend.
3. **NUNCA adicionar `prisma db push` em `package.json` do backend.**
4. **NUNCA mencionar "IA", "AI", "inteligência artificial" na copy do paciente.** Pode em comentário de código, NUNCA em UI.
5. **NUNCA tocar no app médico** (raiz do projeto, antes do `app-v3/`). Esta rodada é só `app-v3/`.
6. **NUNCA fazer `git push --force`.** Nem em branch de feature. Se precisar reescrever histórico, perguntar Lucas.
7. **NUNCA pular hooks** (`--no-verify`, `--no-gpg-sign`).
8. **NUNCA commitar dados de demo hardcoded.** Cada substituição = remover hardcode pra placeholder com ID renderizado pelo JS.
9. **NUNCA criar mock de dados pra preencher tela "porque ficou bonito".** Vazio é vazio. Mostrar empty state.
10. **NUNCA inventar endpoint.** Se o backend não tem, **pular feature** e logar em bugs.
11. **NUNCA modificar `api-real.js`** sem perguntar Lucas. É biblioteca compartilhada.
12. **NUNCA usar `fetch` direto nas telas.** Sempre `vitaeAPI`. Exceção: `14-rg-publico.html` (sem JWT — fetch direto pro endpoint público).
13. **NUNCA chamar `vitaeAPI.X()` sem try/catch.** Erro de rede sempre acontece. Sempre ter fallback.
14. **NUNCA confiar em dados do backend** sem sanitizar com `sanitize()` antes de renderizar (XSS).
15. **NUNCA renderizar `null`/`undefined`.** Sempre default pra `'—'` ou empty string.
16. **NUNCA usar `innerHTML` com string concatenada de input do usuário.** Usar `sanitize()`.
17. **NUNCA usar emoji em código de UI.** Substituir por SVG.
18. **NUNCA usar `alert()`, `confirm()`, `prompt()`** no app v3. Usar toast/modal custom.
19. **NUNCA fazer `git checkout main`** durante a execução. Trabalhar sempre em `feat-app-v3-paciente`.
20. **NUNCA fazer `npm install` sem perguntar.** Se precisar lib nova, perguntar.
21. **NUNCA criar arquivo `.md` proativamente** (regra do harness). Atualizar existentes só quando o plano manda.
22. **NUNCA logar dados sensíveis** (senha, token, CPF) em console.log ou Sentry.
23. **NUNCA esquecer de `requireAuth()`** em telas autenticadas. Senão paciente sem login quebra app.
24. **NUNCA esquecer skeleton/loading.** Sem ele, paciente vê tela em branco antes de fetch retornar — péssimo.
25. **NUNCA chamar `Promise.all` sem catch.** Se 1 falha, todas falham. Usar `.catch(() => null)` por chamada individual.
26. **NUNCA esquecer cleanup** em `useEffect` mental (event listeners, timers).
27. **NUNCA permitir double-click** em botões de submit. Usar `disableBtn`/`enableBtn`.
28. **NUNCA cachear nada em localStorage sem TTL** (perigo de stale).
29. **NUNCA permitir input com `<` ou `>`** passar sem sanitize (XSS).
30. **NUNCA assumir que `getPerfil()` retorna perfil.** Pode ser `{ usuario, perfil: null }` se paciente novo.

## 0.6 Padrão de Chamada API

Modelo de função `iniciar<Tela>()` que toda tela autenticada deve seguir:

```javascript
async function iniciarTela<X>() {
  // 1. Verifica auth
  if (!vitaeAPI.isLoggedIn()) {
    window.location.href = '23-login.html';
    return;
  }

  // 2. Mostra skeleton (sempre 200ms mínimo pra não piscar)
  const inicioRender = Date.now();
  document.body.classList.add('loading');

  try {
    // 3. Carrega tudo em paralelo (com catch individual)
    const resultados = await Promise.all([
      vitaeAPI.getPerfil().catch(e => ({ erro: e })),
      vitaeAPI.listarAlergias().catch(e => ({ erro: e })),
      vitaeAPI.listarMedicamentos().catch(e => ({ erro: e }))
    ]);

    // 4. Trata cada resultado
    const [perfilRes, alergiasRes, medsRes] = resultados;
    if (perfilRes.erro) {
      mostrarBannerErro(traduzirErro(perfilRes.erro));
      return;
    }

    // 5. Detecta estado vazio
    const perfilCompleto = perfilRes.perfil && perfilRes.perfil.dataNascimento && perfilRes.perfil.tipoSanguineo;
    if (!perfilCompleto) {
      window.location.href = '40-saude-vazia.html';
      return;
    }

    // 6. Render
    renderRGCard(perfilRes);
    renderAlergiasResumo(alergiasRes.alergias || []);
    renderMedsResumo(medsRes.medicamentos || []);

  } catch (e) {
    // 7. Erro fatal
    mostrarBannerErro(traduzirErro(e));
  } finally {
    // 8. Garante que skeleton durou pelo menos 200ms (UX)
    const tempoRender = Date.now() - inicioRender;
    if (tempoRender < 200) await new Promise(r => setTimeout(r, 200 - tempoRender));
    document.body.classList.remove('loading');
  }
}
```

### 0.6.1 Helper `traduzirErro`

Adicionar em `app-v3/api-real.js` (única edição autorizada nesse arquivo, e somente se já não existir):

```javascript
window.traduzirErro = function(e) {
  const msg = (e && e.message) || String(e);
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'Sem conexão. Verifique sua internet e tente novamente.';
  }
  if (msg.includes('Sessao expirada') || msg.includes('401')) {
    return 'Sua sessão expirou. Faça login de novo.';
  }
  if (msg.includes('500') || msg.includes('503')) {
    return 'Servidor com problema temporário. Tente em alguns segundos.';
  }
  if (msg.includes('422') || msg.includes('400')) {
    return msg.replace(/^Erro \d+\n?/, '');
  }
  return msg || 'Algo deu errado. Tente novamente.';
};
```

Já existe `handleResponse` que joga `erro + detalhes`. O `traduzirErro` pega isso e mostra em PT-BR humano.

### 0.6.2 Helper `mostrarBannerErro`

Adicionar em CADA tela autenticada (snippet copy-paste):

```javascript
function mostrarBannerErro(msg) {
  const old = document.getElementById('errorBanner');
  if (old) old.remove();
  const banner = document.createElement('div');
  banner.id = 'errorBanner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#EF4444;color:#fff;padding:14px 20px;text-align:center;font:600 13px/1.4 "Plus Jakarta Sans",sans-serif;z-index:1000;display:flex;align-items:center;justify-content:center;gap:12px;';
  banner.innerHTML = `
    <span>${sanitize(msg)}</span>
    <button onclick="document.getElementById('errorBanner').remove(); location.reload();" style="background:#fff;color:#EF4444;border:none;padding:6px 14px;border-radius:8px;font:700 12px 'Plus Jakarta Sans',sans-serif;cursor:pointer;">Tentar de novo</button>
  `;
  document.body.appendChild(banner);
  // Auto-some em 8s
  setTimeout(() => banner.remove(), 8000);
}
```

### 0.6.3 Helper `mostrarToast`

```javascript
function mostrarToast(msg, tipo = 'sucesso') {
  const t = document.createElement('div');
  const cor = tipo === 'erro' ? '#EF4444' : tipo === 'aviso' ? '#F59E0B' : '#00C47A';
  t.style.cssText = `position:fixed;bottom:100px;left:50%;transform:translateX(-50%) translateY(20px);background:#0D0F14;color:#fff;padding:14px 22px;border-radius:14px;font:600 13px/1.4 "Plus Jakarta Sans",sans-serif;z-index:1001;box-shadow:0 12px 40px rgba(0,0,0,0.2);opacity:0;transition:all 0.3s cubic-bezier(0.4,0,0.2,1);display:flex;align-items:center;gap:10px;`;
  t.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${cor};"></span>${sanitize(msg)}`;
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => t.remove(), 300);
  }, 3500);
}
```

## 0.7 Quando Algo Dá Errado

### 0.7.1 Erro de rede

Sintoma: `Failed to fetch` ou `NetworkError`.
Ação: mostrar banner topo "Sem conexão. Verifique sua internet." + botão "Tentar de novo" que recarrega.
Não tentar retry automático — paciente vai achar que travou.

### 0.7.2 401 sessão expirada

Sintoma: response 401 do backend.
Comportamento atual em `api-real.js`: tenta `refreshTokens()` automático. Se refresh também 401, chama `logout()` que limpa tokens e redireciona pra `23-login.html`.
Ação adicional: nenhuma. Confiar no api-real.js.

### 0.7.3 500/503

Sintoma: `Erro 500` ou `Erro 503` no `e.message`.
Ação: mostrar banner "Servidor com problema temporário. Suas alterações estão salvas." (mesmo que não estejam — não preocupar paciente).
Não tentar retry automático.

### 0.7.4 404 em recurso (ex: GET /medicamentos/999)

Ação: ignorar erro e tratar como dados vazios. Não mostrar erro pro paciente.
Exemplo:

```javascript
const med = await vitaeAPI.getMedicamento(id).catch(() => null);
if (!med) {
  mostrarTela404('Esse medicamento não está mais na sua lista.');
  return;
}
```

### 0.7.5 422 validação (POST falha)

Sintoma: response 422 com array `detalhes`.
Ação: traduzir cada erro de campo via `CAMPOS_AMIGAVEIS` map. Mostrar inline no campo, não em banner.

```javascript
const CAMPOS_AMIGAVEIS = {
  'nome': 'Nome',
  'email': 'E-mail',
  'celular': 'Celular',
  'senha': 'Senha',
  'tipo': 'Tipo',
  'tipoSanguineo': 'Tipo sanguíneo',
  'dataNascimento': 'Data de nascimento',
  'cpf': 'CPF',
  'dose': 'Dose',
  'frequencia': 'Frequência',
  'horario': 'Horário',
  'nomeAlergia': 'Nome da alergia',
  'gravidade': 'Gravidade',
  'tipo': 'Tipo de reação',
  'crm': 'CRM',
  'estado': 'Estado',
  'duracaoDias': 'Duração'
};

function traduzirCampo(campo) {
  return CAMPOS_AMIGAVEIS[campo] || campo;
}
```

### 0.7.6 Backend offline (Railway dormindo ou caiu)

Sintoma: timeout em todos os fetch.
Ação: mostrar tela `60-erro-offline.html` (já existe) com botão retry.

### 0.7.7 Dados corrompidos no backend

Ex: `tipoSanguineo = "X_POS"` quando só existe `A_POS` `B_POS` etc.
Ação: fallback pra `'—'`. Não quebrar a tela. Logar em `bugs-encontrados.json` como `backend: corruption`.

### 0.7.8 Foto upload falhou (Supabase Storage down)

Sintoma: 500 em POST /perfil/foto.
Ação: mostrar toast "Foto não enviada. Tente de novo em alguns segundos."
Não bloquear formulário (paciente pode salvar outros campos).

### 0.7.9 Quota Anthropic estourada (exame upload)

Sintoma: response 429 em POST /exames/upload.
Ação: mostrar toast "Estamos com muitos pedidos agora. Tente em alguns minutos."
Marcar exame como `status: 'PENDENTE'` localmente.

## 0.8 Estrutura de Cada Tela

Toda tela do app v3 segue a mesma estrutura HTML básica:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>vita id — Nome da Tela</title>
  <link rel="stylesheet" href="..."> <!-- vitae-core.css etc -->
  <style>/* estilos da tela */</style>
</head>
<body>
  <div class="phone">
    <div class="notch"></div>
    <div class="status-bar"><span>9:41</span>...</div>

    <div class="header">
      <!-- back btn OU title -->
      <!-- action btns -->
    </div>

    <div class="content">
      <!-- conteúdo principal -->
    </div>

    <div class="tab-bar">
      <!-- 4 tabs -->
    </div>
  </div>

  <script src="api-real.js"></script>
  <script>
    // init code
    window.addEventListener('DOMContentLoaded', iniciar);
  </script>
</body>
</html>
```

**Importante**: `api-real.js` precisa ser carregado em TODA tela que chama `vitaeAPI`. Hoje muitas telas hardcoded não chamam — Claude precisa **adicionar** o `<script src="api-real.js"></script>` em cada tela que vai conectar.

## 0.9 Identificadores Estáveis a Adicionar

Cada elemento que será preenchido dinamicamente precisa de `id`. Padrão de nomenclatura:

| Conteúdo | id |
|---|---|
| Nome do paciente | `nomePaciente` |
| Nome com saudação | `greetingNome` |
| RG number | `rgNumero` |
| Tipo sanguíneo | `tipoSanguineo` |
| Data nascimento formatada | `dataNascimento` |
| Idade calculada | `idadePaciente` |
| Telefone emergência | `telEmergencia` |
| Nome contato emergência | `nomeContatoEmergencia` |
| RG verso alergias | `rgVersoAlergias` |
| RG verso meds | `rgVersoMeds` |
| RG verso emerg contato | `rgVersoEmerg` |
| Container alergias resumo | `alergiasResumo` |
| Lista de alergias home | `alergiasHomeList` |
| Container meds resumo | `medsResumo` |
| Lista de meds home | `medsHomeList` |
| Container alergias página completa | `alergiasContainer` |
| Container meds página completa | `medsContainer` |
| Container exames | `examesContainer` |
| Subtítulo da página | `pageSubtitle` |
| Footer atualização | `atualizadoEm` |
| Toast root | `toastRoot` |
| Skeleton | `skeleton` |
| Empty state | `emptyState` |
| Error banner | `errorBanner` |

Convenção:
- `algumaCoisa` para containers únicos.
- `algumaCoisa-{indice}` ou `algumaCoisa-{id}` para listas dinâmicas.

## 0.10 SVG Inline vs External

Hoje todas as telas têm SVG inline gigantes no HTML. **NÃO mudar.** Mexer só se a tela precisar do SVG dinâmico (ex: ícone de status mudando entre normal/atenção/crítico) — aí extrair pra função JS que retorna string SVG.

Não criar arquivo `.svg` separado nesta rodada — é incompatível com SPA atual.

## 0.11 CSS

Cada tela tem `<style>` inline gigante. Não consolidar agora. Cada Edit deve manter o `<style>` intacto, mexer só no HTML/JS.

Variáveis CSS comuns (já no `:root` de cada tela):

```css
:root {
  --green: #00E5A0;
  --green2: #00B4D8;
  --bad: #EF4444;
  --warn: #F59E0B;
  --ink: #0D0F14;
  --ink2: #4B5563;
  --ink3: #6B7280;
  --ink4: #9CA3AF;
  --bg: #F4F6FA;
  --surface: #FFFFFF;
  --r-md: 14px;
  --r-lg: 16px;
  --s1: 4px;
  --s2: 8px;
  --s3: 12px;
  --s4: 16px;
  --s5: 24px;
  --border: 1px solid rgba(0,0,0,0.07);
}
```

## 0.12 Date Formatting

Sempre PT-BR:

```javascript
function formatarData(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR'); // "12/03/2008"
}

function formatarDataExtensa(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  // "12 de março de 2008"
}

function formatarDataCurta(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  // "12 de mar."
}

function formatarHora(h) {
  if (!h) return '—';
  return h; // backend retorna "08:00" string já
}

function calcularIdade(dataNasc) {
  if (!dataNasc) return null;
  const d = new Date(dataNasc);
  if (isNaN(d.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) idade--;
  return idade;
}
```

## 0.13 Tipo Sanguíneo Formatting

Backend salva como enum: `A_POS, A_NEG, B_POS, B_NEG, AB_POS, AB_NEG, O_POS, O_NEG`.
UI mostra: `A+ A- B+ B- AB+ AB- O+ O-`.

```javascript
function formatarTipoSanguineo(t) {
  const map = {
    'A_POS': 'A+', 'A_NEG': 'A-',
    'B_POS': 'B+', 'B_NEG': 'B-',
    'AB_POS': 'AB+', 'AB_NEG': 'AB-',
    'O_POS': 'O+', 'O_NEG': 'O-'
  };
  return map[t] || '—';
}

function parseTipoSanguineo(s) {
  const map = {
    'A+': 'A_POS', 'A-': 'A_NEG',
    'B+': 'B_POS', 'B-': 'B_NEG',
    'AB+': 'AB_POS', 'AB-': 'AB_NEG',
    'O+': 'O_POS', 'O-': 'O_NEG'
  };
  return map[s] || null;
}
```

## 0.14 Tipo de Reação Formatting

Backend retorna `Alergia.tipo` como `RASH, URTICARIA, ANAFILAXIA, BRONCOSPASMO, OUTRO`. UI mostra:

```javascript
function formatarTipoAlergia(t) {
  const map = {
    'RASH': 'Erupção cutânea',
    'URTICARIA': 'Urticária',
    'ANAFILAXIA': 'Choque anafilático',
    'BRONCOSPASMO': 'Broncoespasmo',
    'EDEMA': 'Edema laríngeo',
    'OUTRO': 'Outro'
  };
  return map[t] || sanitize(t || '—');
}
```

## 0.15 Gravidade Formatting

Backend usa `LEVE, MODERADA, GRAVE`. UI mostra:

```javascript
function formatarGravidade(g) {
  const map = {
    'LEVE': 'Leve',
    'MODERADA': 'Moderada',
    'GRAVE': 'Alta gravidade'
  };
  return map[g] || '—';
}

function classeGravidade(g) {
  if (g === 'GRAVE') return 'critica';
  if (g === 'MODERADA') return 'moderada';
  return 'leve';
}
```

## 0.16 Convenções de Nomenclatura JS

- Funções públicas (chamadas de `onclick`): `iniciar...()`, `abrir...()`, `salvar...()`, `excluir...()`
- Helpers internos: prefixo `_` (ex: `_renderCard`)
- Estado global da tela: `window.STATE = { ... }` (NÃO usar variáveis soltas)
- Constantes: `UPPER_SNAKE`
- DOM refs: `el<Algo>` (ex: `elNome`, `elBtnSubmit`)

## 0.17 Como Lidar com SPA vs Multi-Page

App v3 é multi-page (cada `.html` é separado). NÃO virou SPA. As "tabs" são links normais que recarregam a página.

Implicação: **dados não persistem entre telas via memória**. Sempre re-buscar do backend (ou cachear em localStorage com TTL).

### 0.17.1 Cache localStorage (regras)

Permitido cachear:
- `vitae_usuario` (já feito): nome, email, fotoUrl, tipo.
- `vitae_perfil_cache`: perfil completo, TTL 60s.
- `vitae_alergias_cache`: lista, TTL 30s.
- `vitae_meds_cache`: idem.

NÃO cachear:
- Tokens (já são localStorage permanente, à parte).
- Exames (mudam pouco mas têm imagens — não desperdiçar).
- Agendamentos (mudam o tempo todo).
- Scores (recalcular sempre).

Implementação opcional (Lote 10):

```javascript
function getCacheTTL(chave, fetcher, ttl = 30000) {
  const raw = localStorage.getItem(chave);
  if (raw) {
    try {
      const { ts, dados } = JSON.parse(raw);
      if (Date.now() - ts < ttl) return Promise.resolve(dados);
    } catch (e) { /* corrompido */ }
  }
  return fetcher().then(dados => {
    localStorage.setItem(chave, JSON.stringify({ ts: Date.now(), dados }));
    return dados;
  });
}
```

Não fazer isso até Lote 10 — pode mascarar bugs de fetch nos lotes anteriores.

## 0.18 Verificação Visual Manual via Playwright

Pra cada lote, Claude deve abrir Playwright e bater **screenshots** das telas modificadas. Pasta:

```
tests/shots/lote-{N}/
  ├── 01-paciente-novo.png
  ├── 02-paciente-cheio.png
  ├── 03-sem-rede.png
  └── 04-after-deploy.png
```

Lucas vai ABRIR essas imagens depois pra revisar visualmente. Cada teste Playwright precisa salvar screenshots significativos.

## 0.19 Performance Budget

Cada tela deve carregar em < 2 segundos no 4G simulado. Métricas:

- `getPerfil()`: típico 200-400ms
- `listarMedicamentos()`: 150-300ms
- `listarAlergias()`: 150-300ms
- `listarExames()`: 300-800ms (depende de quantos exames)
- `Promise.all([...])` paralelizado: ~400ms total

Se uma tela passar de 2s no teste Playwright, **logar em bugs** e investigar no Lote 10.

## 0.20 Quando Parar e Perguntar Lucas

Lista exaustiva de situações que requerem intervenção humana:

1. **Schema do banco precisa mudar.** Adicionar campo na tabela Paciente, criar nova tabela, etc.
2. **Endpoint precisa ser criado.** Backend não tem.
3. **Copy de UI precisa ser inventada.** Lucas tem opinião forte sobre tom.
4. **Conflito de design.** Ex: duas telas mostram o mesmo dado de forma diferente.
5. **Decisão de produto.** Ex: "devo mostrar idade biológica na home?".
6. **Erro inexplicável após 3 tentativas.** Salvar logs e perguntar.
7. **Falha de deploy Vercel.** Build quebrou.
8. **Conta de teste impossível de criar.** SMS Twilio fora do ar.
9. **Mudança no `api-real.js`.** Qualquer.
10. **Mudança em arquivo da raiz (não `app-v3/`).**
11. **Necessidade de feature fora do escopo dos 10 lotes.**
12. **Critério de cutover atingido.** Avisar pra Lucas decidir A/B.

**Como perguntar**: salvar em `tests/perguntas-lucas.md` o contexto + opções consideradas + recomendação. Quando Lucas voltar, esse arquivo é a fila.

## 0.21 Logs e Auditoria

Cada lote gera:

```
tests/shots/lote-{N}/
  ├── log.json         <-- {n, ok, det} por cenário Playwright
  ├── timings.json     <-- duração de cada chamada API
  ├── screenshots/
  │   └── *.png
  └── network.har      <-- network log do browser (opcional, pesado)
```

Salvar `log.json` em formato:

```json
[
  { "n": "Cenário 1: paciente novo", "ok": true, "det": "Tempo 1.2s", "ts": "2026-05-14T..." },
  { "n": "Cenário 2: sem rede", "ok": false, "det": "Banner não apareceu", "ts": "..." }
]
```

## 0.22 Snippet de Cabeçalho Playwright

Cada `tests/lote-N-X.js` começa com:

```javascript
// LOTE N — Teste Playwright
// Gera: tests/shots/lote-N/{*.png, log.json, timings.json}
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const isProd = process.argv.includes('--prod');
const APP_BASE = isProd
  ? 'https://vitae-app.vercel.app/app-v3'
  : 'http://localhost:3000/app-v3';
const SHOTS = path.join(__dirname, 'shots', `lote-${LOTE_NUMERO}`);
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const BACKEND = 'https://vitae-app-production.up.railway.app';

const log = [];
const timings = {};
function step(n, ok, det) {
  const entry = { n, ok, det, ts: new Date().toISOString() };
  log.push(entry);
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${n}${det ? ' · ' + det : ''}`);
}

async function criarPaciente(page, nivel) {
  const sufixo = Date.now() + Math.floor(Math.random() * 1000);
  const dados = {
    nome: `Lote${LOTE_NUMERO}-${nivel} ${sufixo}`,
    celular: '+5511' + String(sufixo).slice(-9),
    email: `lote${LOTE_NUMERO}-${nivel}-${sufixo}@vitae-test.com`,
    senha: 'TesteSenha123!'
  };
  const res = await page.evaluate(async (d) => {
    const r = await fetch('https://vitae-app-production.up.railway.app/auth/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...d, tipo: 'PACIENTE' })
    });
    return { status: r.status, body: await r.json() };
  }, dados);

  if (!res.body || !res.body.token) {
    step(`Setup: criar paciente ${nivel}`, false, 'sem token (HTTP ' + res.status + ')');
    return null;
  }

  await page.evaluate((data) => {
    localStorage.setItem('vitae_token', data.token);
    if (data.refreshToken) localStorage.setItem('vitae_refresh_token', data.refreshToken);
    localStorage.setItem('vitae_usuario', JSON.stringify(data.usuario));
  }, res.body);

  return { ...dados, token: res.body.token, usuario: res.body.usuario };
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const ctx = await browser.newContext({ viewport: { width: 500, height: 950 } });
  const page = await ctx.newPage();

  // Logar network failures
  page.on('requestfailed', req => {
    console.log('  [network failed]', req.url(), req.failure().errorText);
  });

  try {
    // === CENÁRIOS DO LOTE ===
    await cenario1(page);
    await cenario2(page);
    // ...

  } catch (e) {
    console.error('[fatal]', e);
    await page.screenshot({ path: path.join(SHOTS, 'erro-fatal.png') });
  } finally {
    fs.writeFileSync(path.join(SHOTS, 'log.json'), JSON.stringify(log, null, 2));
    fs.writeFileSync(path.join(SHOTS, 'timings.json'), JSON.stringify(timings, null, 2));

    const total = log.length;
    const passou = log.filter(l => l.ok).length;
    console.log(`\n[${passou}/${total}] cenários passaram`);

    await browser.close();
    process.exit(passou === total ? 0 : 1);
  }
})();
```

(Onde `LOTE_NUMERO` é literalmente o número, ex: `1`.)

## 0.23 Antes de Começar

Checklist mental:

- [ ] Servidor Python rodando na 3000
- [ ] Playwright instalado (`npx playwright --version` retorna versão)
- [ ] Branch `feat-app-v3-paciente` ativo
- [ ] Working tree limpo (`git status` vazio)
- [ ] Backend Railway respondendo (`curl -I https://vitae-app-production.up.railway.app/health`)
- [ ] `tests/credenciais-lotes.json` existe (vazio se primeira execução)
- [ ] `tests/bugs-encontrados.json` existe (vazio se primeira execução)
- [ ] Memória do plano fresca (releu PARTE 0 nos últimos minutos)

Quando todos OK, ir pra Parte 1 (Lote 1).

---

# PARTE 1 — Lote 1: Tela Saúde HOME

## 1.1 Resumo Executivo

**Objetivo macro**: tornar `01-saude.html` 100% real. Paciente vê SEU nome, SEU sangue, SUAS alergias, SEUS medicamentos. Zero hardcoded.

**Telas afetadas** (3):
- `app-v3/01-saude.html` (HOME principal — atualmente 418 linhas, com 12+ hardcodes)
- `app-v3/40-saude-vazia.html` (empty state — atualmente 156 linhas, com 4+ hardcodes)
- `app-v3/52-loading-home.html` (skeleton — atualmente 161 linhas, sem hardcode mas precisa virar componente embed)

**Funções vitaeAPI usadas**:
- `vitaeAPI.getPerfil()` — retorna `{ usuario, perfil }`
- `vitaeAPI.listarAlergias()` — retorna `{ alergias: [...] }`
- `vitaeAPI.listarMedicamentos()` — retorna `{ medicamentos: [...] }`
- `vitaeAPI.getProximoAgendamento()` (opcional, com `.catch`) — retorna `{ agendamento } | { agendamento: null }`
- `vitaeAPI.getScoreAtual()` (opcional, com `.catch`) — pra um pequeno ring no header se aprovado

**Endpoints backend** (que estes métodos chamam):
- `GET /perfil` → retorna `{ usuario: { id, nome, email, fotoUrl, tipo }, perfil: { dataNascimento, tipoSanguineo, sexoBiologico, peso, altura, cpf, contatoEmergenciaNome, contatoEmergenciaTel, ... } | null }`
- `GET /alergias` → retorna `{ alergias: [{ id, nome, tipo, gravidade, dataDiagnostico, medicoDiagnostico, ... }] }`
- `GET /medicamentos` → retorna `{ medicamentos: [{ id, nome, dosagem, frequencia, horario, motivo, via, dataInicio, dataFim, ativo, ... }] }`
- `GET /agendamento/proximo` → retorna `{ agendamento: { id, data, hora, medicoNome, especialidade, local, ... } | null }`
- `GET /scores/atual` → retorna `{ score: { valor, atualizadoEm, ... }, pilares: { ... } } | 404`

**Tempo estimado**: 3-4h.

**Risco**: médio. Muitos pontos de leitura simultânea + precisa cuidar de paciente novo vs cheio.

**Dependências**: Nenhum lote anterior necessário. Pode ser o primeiro.

## 1.2 Estado Atual Exato

### 1.2.1 Arquivo `01-saude.html` (418 linhas)

Grep dos hardcodes mais críticos:

| Linha | Trecho | O que substituir |
|---|---|---|
| 219 | `<div style="font-size:17px;font-weight:800;color:var(--ink)">Lucas Borelli</div>` | `<div id="greetingNome" ...>...</div>` JS preenche `usuario.nome` |
| 245 | `<div class="rgcard-name">LUCAS BORELLI</div>` | `<div class="rgcard-name" id="rgNome"></div>` |
| 246 | `<div class="rgcard-id">RG da Saúde · #001234567</div>` | `<div class="rgcard-id" id="rgId">RG da Saúde · #<span id="rgNumero"></span></div>` |
| 250 | `<div class="vbig">A+</div>` | `<div class="vbig" id="rgSangue"></div>` |
| 254 | `<div class="vmid">12/03/2008</div>` | `<div class="vmid" id="rgNascimento"></div>` |
| 258 | `<div class="vmid">(11) 98765-4321</div>` | `<div class="vmid" id="rgEmerg"></div>` |
| 275 | `<div class="rgcard-back-content allergy">Dipirona · Penicilina</div>` | `<div ... id="rgVersoAlergias"></div>` |
| 279 | `<div class="rgcard-back-content">Losartana 50mg · Omeprazol 20mg</div>` | `<div ... id="rgVersoMeds"></div>` |
| 283 | `<div class="rgcard-back-content">Marina Borelli (mãe) · (11) 98765-4321</div>` | `<div ... id="rgVersoEmerg"></div>` |
| 287 | `Atualizado em 12/mai` | `Atualizado em <span id="rgAtualizadoEm"></span>` |
| 297 | `<div class="meds-today-title">2 de 3 tomados</div>` | `<div class="meds-today-title" id="medsTituloHoje"></div>` |
| 303-340 | 3 cards `<div class="med-row">...</div>` hardcoded | `<div class="meds-today-list" id="medsHomeList"></div>` (vazio, JS injeta) |
| 347 | `<div class="meds-today-title">2 críticas · 1 leve</div>` | `<div class="meds-today-title" id="alergiasResumo"></div>` |
| 353-381 | 3 cards `<div class="med-row">...</div>` de alergias hardcoded | `<div class="meds-today-list" id="alergiasHomeList"></div>` |

Total: **18 mudanças no HTML** + adicionar `<script src="api-real.js">` + adicionar bloco `<script>` com `iniciarTelaSaude()`.

### 1.2.2 Arquivo `40-saude-vazia.html` (156 linhas)

Grep dos hardcodes:

| Linha | Trecho | O que substituir |
|---|---|---|
| 54 | `<div ...>Lucas Borelli</div>` | id="vazioNome" |
| 79 | `<div class="rgcard-name">LUCAS BORELLI</div>` | id="vazioRGNome" |
| 80 | `<div class="rgcard-id">RG da Saúde · #001234567</div>` | id="vazioRGId" — placeholder "Em criação" se não tem RG |
| 83 | `<div class="vmid">12/03/2008</div>` | id="vazioNasc" |
| 84 | `<div class="vmid">(11) 98765-4321</div>` | id="vazioEmerg" |

Total: **5 mudanças** + script.

### 1.2.3 Arquivo `52-loading-home.html` (161 linhas)

Esta tela hoje é tela separada — usada na transição quiz→home. Não tem hardcode visível mas tem dados visuais que sugerem RG já preenchido. NA PRÁTICA esta tela deveria ser:
- (a) Embed inline dentro de `01-saude.html` (skeleton durante fetch).
- (b) Tela separada só pra primeira carga pós-quiz (com mensagem "Preparando seu RG da Saúde...").

**Decisão**: manter (b) por agora (não quebrar fluxo do quiz), MAS adicionar skeleton inline em `01-saude.html` também. Lote 10 decide se remove a tela separada.

Mudança no `52-loading-home.html`: nenhuma neste lote (deixar como está).

## 1.3 Plano de Mudanças Passo-a-Passo

### Passo 1.3.1: Abrir `01-saude.html` e substituir HTML estático por placeholders

Edit 1: greeting (linha ~218-220):

```diff
-      <div style="flex:1">
-        <div style="font-size:12px;color:var(--ink3);font-weight:500">Olá,</div>
-        <div style="font-size:17px;font-weight:800;color:var(--ink)">Lucas Borelli</div>
-      </div>
+      <div style="flex:1">
+        <div style="font-size:12px;color:var(--ink3);font-weight:500">Olá,</div>
+        <div id="greetingNome" style="font-size:17px;font-weight:800;color:var(--ink)">&nbsp;</div>
+      </div>
```

Edit 2: RG card frente (linhas 244-260):

```diff
-          <div class="rgcard-mid">
-            <div class="rgcard-name">LUCAS BORELLI</div>
-            <div class="rgcard-id">RG da Saúde · #001234567</div>
-            <div class="rgcard-cols">
-              <div class="rgcol">
-                <div class="slbl">TIPO</div>
-                <div class="vbig">A+</div>
-              </div>
-              <div class="rgcol">
-                <div class="slbl">NASCIMENTO</div>
-                <div class="vmid">12/03/2008</div>
-              </div>
-              <div class="rgcol">
-                <div class="slbl">EMERGÊNCIA</div>
-                <div class="vmid">(11) 98765-4321</div>
-              </div>
-            </div>
-          </div>
+          <div class="rgcard-mid">
+            <div class="rgcard-name" id="rgNome">&nbsp;</div>
+            <div class="rgcard-id">RG da Saúde · #<span id="rgNumero">&nbsp;</span></div>
+            <div class="rgcard-cols">
+              <div class="rgcol">
+                <div class="slbl">TIPO</div>
+                <div class="vbig" id="rgSangue">&nbsp;</div>
+              </div>
+              <div class="rgcol">
+                <div class="slbl">NASCIMENTO</div>
+                <div class="vmid" id="rgNascimento">&nbsp;</div>
+              </div>
+              <div class="rgcol">
+                <div class="slbl">EMERGÊNCIA</div>
+                <div class="vmid" id="rgEmerg">&nbsp;</div>
+              </div>
+            </div>
+          </div>
```

Edit 3: RG card verso (linhas 272-289):

```diff
-          <div style="margin-top: -4px;">
-            <div class="rgcard-back-section">
-              <div class="rgcard-back-label">Alergias críticas</div>
-              <div class="rgcard-back-content allergy">Dipirona · Penicilina</div>
-            </div>
-            <div class="rgcard-back-section">
-              <div class="rgcard-back-label">Medicamentos em uso</div>
-              <div class="rgcard-back-content">Losartana 50mg · Omeprazol 20mg</div>
-            </div>
-            <div class="rgcard-back-section">
-              <div class="rgcard-back-label">Contato de emergência</div>
-              <div class="rgcard-back-content">Marina Borelli (mãe) · (11) 98765-4321</div>
-            </div>
-          </div>
-          <div style="font-size:9px;color:rgba(255,255,255,0.42);font-weight:600;letter-spacing:0.05em;text-align:right;">
-            Atualizado em 12/mai
-          </div>
+          <div style="margin-top: -4px;">
+            <div class="rgcard-back-section">
+              <div class="rgcard-back-label">Alergias críticas</div>
+              <div class="rgcard-back-content allergy" id="rgVersoAlergias">&nbsp;</div>
+            </div>
+            <div class="rgcard-back-section">
+              <div class="rgcard-back-label">Medicamentos em uso</div>
+              <div class="rgcard-back-content" id="rgVersoMeds">&nbsp;</div>
+            </div>
+            <div class="rgcard-back-section">
+              <div class="rgcard-back-label">Contato de emergência</div>
+              <div class="rgcard-back-content" id="rgVersoEmerg">&nbsp;</div>
+            </div>
+          </div>
+          <div style="font-size:9px;color:rgba(255,255,255,0.42);font-weight:600;letter-spacing:0.05em;text-align:right;">
+            Atualizado em <span id="rgAtualizadoEm">&nbsp;</span>
+          </div>
```

Edit 4: bloco medicamentos hoje (linhas 293-341):

```diff
-    <!-- MEDICAMENTOS DE HOJE -->
-    <div class="section-label anim anim-d3">Medicamentos de hoje</div>
-    <div class="meds-today anim anim-d3">
-      <div class="meds-today-header">
-        <div class="meds-today-title">2 de 3 tomados</div>
-        <a href="03-medicamentos.html" class="meds-today-link">
-          Ver semana
-          <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
-        </a>
-      </div>
-      <div class="meds-today-list">
-        <div class="med-row">
-          <div class="med-icon">...</div>
-          <div class="med-row-info">
-            <div class="med-row-name">Losartana 50mg</div>
-            <div class="med-row-time">08:00 · oral</div>
-          </div>
-          <button class="med-check taken" ...></button>
-        </div>
-        (... 2 outras cards Omeprazol e Vitamina D ...)
-      </div>
-    </div>
+    <!-- MEDICAMENTOS DE HOJE -->
+    <div class="section-label anim anim-d3">Medicamentos de hoje</div>
+    <div class="meds-today anim anim-d3" id="secMedsHoje">
+      <div class="meds-today-header">
+        <div class="meds-today-title" id="medsTituloHoje">&nbsp;</div>
+        <a href="03-medicamentos.html" class="meds-today-link">
+          Ver semana
+          <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
+        </a>
+      </div>
+      <div class="meds-today-list" id="medsHomeList">
+        <!-- JS injeta -->
+      </div>
+    </div>
```

Edit 5: bloco alergias (linhas 343-382):

```diff
-    <!-- ALERGIAS -->
-    <div class="section-label anim anim-d4">Alergias</div>
-    <div class="meds-today anim anim-d4">
-      <div class="meds-today-header">
-        <div class="meds-today-title">2 críticas · 1 leve</div>
-        <a href="06-alergias.html" class="meds-today-link">
-          Ver todas
-          <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
-        </a>
-      </div>
-      <div class="meds-today-list">
-        <div class="med-row" onclick="window.location='07-alergia-detalhe.html'" style="cursor:pointer">
-          (... 3 cards Dipirona, Penicilina, Camarão ...)
-        </div>
-      </div>
-    </div>
+    <!-- ALERGIAS -->
+    <div class="section-label anim anim-d4">Alergias</div>
+    <div class="meds-today anim anim-d4" id="secAlergias">
+      <div class="meds-today-header">
+        <div class="meds-today-title" id="alergiasResumo">&nbsp;</div>
+        <a href="06-alergias.html" class="meds-today-link">
+          Ver todas
+          <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
+        </a>
+      </div>
+      <div class="meds-today-list" id="alergiasHomeList">
+        <!-- JS injeta -->
+      </div>
+    </div>
```

Edit 6: substituir o `<script>` minúsculo no final por um bloco completo.

Linha ~409:
```diff
-<script>
-  function flipCard(el) {
-    el.classList.toggle('flipped');
-  }
-  function toggleCheck(btn) {
-    btn.classList.toggle('taken');
-  }
-</script>
+<script src="api-real.js"></script>
+<script>
+  // (snippets do passo 1.3.2 a 1.3.7 aqui)
+</script>
```

### Passo 1.3.2: JavaScript completo de `iniciarTelaSaude()`

Conteúdo do `<script>` que vai no final do `01-saude.html`:

```javascript
// ========== HELPERS ==========
function sanitize(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatarTipoSanguineo(t) {
  const map = { 'A_POS': 'A+', 'A_NEG': 'A-', 'B_POS': 'B+', 'B_NEG': 'B-', 'AB_POS': 'AB+', 'AB_NEG': 'AB-', 'O_POS': 'O+', 'O_NEG': 'O-' };
  return map[t] || '—';
}

function formatarData(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

function formatarDataCurta(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function calcularIdade(d) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - date.getFullYear();
  const m = hoje.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < date.getDate())) idade--;
  return idade;
}

function primeiroNome(nome) {
  if (!nome) return '';
  return nome.trim().split(/\s+/)[0];
}

function traduzirErro(e) {
  const msg = (e && e.message) || String(e);
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('TypeError: NetworkError')) {
    return 'Sem conexão. Verifique sua internet.';
  }
  if (msg.includes('Sessao expirada') || msg.includes('401')) {
    return 'Sua sessão expirou. Faça login de novo.';
  }
  if (msg.includes('500') || msg.includes('503')) {
    return 'Servidor com problema temporário. Tente em alguns segundos.';
  }
  return msg || 'Algo deu errado. Tente novamente.';
}

function mostrarBannerErro(msg) {
  const old = document.getElementById('errorBanner');
  if (old) old.remove();
  const banner = document.createElement('div');
  banner.id = 'errorBanner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#EF4444;color:#fff;padding:14px 20px;text-align:center;font:600 13px/1.4 "Plus Jakarta Sans",sans-serif;z-index:1000;display:flex;align-items:center;justify-content:center;gap:12px;';
  banner.innerHTML = `<span>${sanitize(msg)}</span><button onclick="document.getElementById('errorBanner').remove(); location.reload();" style="background:#fff;color:#EF4444;border:none;padding:6px 14px;border-radius:8px;font:700 12px \'Plus Jakarta Sans\',sans-serif;cursor:pointer;">Tentar de novo</button>`;
  document.body.appendChild(banner);
}

function flipCard(el) { el.classList.toggle('flipped'); }

// ========== INIT ==========
async function iniciarTelaSaude() {
  // 1. Auth gate
  if (!vitaeAPI.isLoggedIn()) {
    window.location.href = '23-login.html';
    return;
  }

  // 2. Carrega usuário do localStorage (já tem do login)
  const usuario = vitaeAPI.getUsuario();
  if (!usuario || !usuario.nome) {
    window.location.href = '23-login.html';
    return;
  }

  // 3. Preenche greeting imediatamente (sem esperar fetch)
  const elGreeting = document.getElementById('greetingNome');
  if (elGreeting) elGreeting.textContent = sanitize(primeiroNome(usuario.nome));

  // 4. Mostra skeleton no resto
  document.body.classList.add('loading');
  marcarSkeleton(true);

  // 5. Carrega tudo em paralelo (com catch individual)
  const inicio = Date.now();
  const resultados = await Promise.all([
    vitaeAPI.getPerfil().catch(e => ({ _erro: e })),
    vitaeAPI.listarAlergias().catch(e => ({ _erro: e })),
    vitaeAPI.listarMedicamentos().catch(e => ({ _erro: e })),
    vitaeAPI.getProximoAgendamento().catch(() => null)
  ]);
  const [perfilRes, alergiasRes, medsRes, agendaRes] = resultados;

  // 6. Erro de rede no perfil = fatal
  if (perfilRes._erro) {
    mostrarBannerErro(traduzirErro(perfilRes._erro));
    document.body.classList.remove('loading');
    marcarSkeleton(false);
    return;
  }

  // 7. Detecta paciente novo (sem dataNascimento OU sem tipoSanguineo)
  const perfil = perfilRes.perfil || {};
  const perfilCompleto = !!(perfil.dataNascimento && perfil.tipoSanguineo);

  if (!perfilCompleto) {
    // Redirect pra estado vazio com nome já no querystring (40 lê)
    const qs = `?nome=${encodeURIComponent(usuario.nome)}`;
    window.location.href = '40-saude-vazia.html' + qs;
    return;
  }

  // 8. Render RG card frente
  document.getElementById('rgNome').textContent = sanitize(usuario.nome.toUpperCase());
  document.getElementById('rgNumero').textContent = sanitize(formatarRGNumero(usuario.id));
  document.getElementById('rgSangue').textContent = formatarTipoSanguineo(perfil.tipoSanguineo);
  document.getElementById('rgNascimento').textContent = formatarData(perfil.dataNascimento);
  document.getElementById('rgEmerg').textContent = sanitize(perfil.contatoEmergenciaTel || '—');

  // 9. Render RG card verso
  const alergias = (alergiasRes && alergiasRes.alergias) || [];
  const criticas = alergias.filter(a => a.gravidade === 'GRAVE');
  document.getElementById('rgVersoAlergias').textContent = criticas.length
    ? criticas.map(a => a.nome).join(' · ')
    : 'Nenhuma alergia crítica';

  const meds = (medsRes && medsRes.medicamentos) || [];
  const medsAtivos = meds.filter(m => m.ativo !== false);
  document.getElementById('rgVersoMeds').textContent = medsAtivos.length
    ? medsAtivos.map(m => `${m.nome}${m.dosagem ? ' ' + m.dosagem : ''}`).slice(0, 3).join(' · ') + (medsAtivos.length > 3 ? ' · +' + (medsAtivos.length - 3) : '')
    : 'Nenhum medicamento em uso';

  const emergNome = perfil.contatoEmergenciaNome || '';
  const emergTel = perfil.contatoEmergenciaTel || '';
  const parentesco = perfil.contatoEmergenciaParentesco || '';
  document.getElementById('rgVersoEmerg').textContent =
    (emergNome ? emergNome : '—') +
    (parentesco ? ` (${parentesco})` : '') +
    (emergTel ? ` · ${emergTel}` : '');

  document.getElementById('rgAtualizadoEm').textContent = formatarDataCurta(new Date());

  // 10. Render lista meds de hoje
  renderMedsHoje(medsAtivos);

  // 11. Render lista alergias
  renderAlergiasHome(alergias);

  // 12. Skeleton off (com mínimo 200ms pra não piscar)
  const decorrido = Date.now() - inicio;
  if (decorrido < 200) await new Promise(r => setTimeout(r, 200 - decorrido));
  document.body.classList.remove('loading');
  marcarSkeleton(false);
}

function formatarRGNumero(id) {
  if (!id) return '—';
  // Pega últimos 7 dígitos numéricos do UUID
  const onlyNums = String(id).replace(/[^0-9]/g, '');
  if (onlyNums.length >= 7) return onlyNums.slice(-7);
  return onlyNums.padStart(7, '0');
}

function renderMedsHoje(meds) {
  const titulo = document.getElementById('medsTituloHoje');
  const list = document.getElementById('medsHomeList');

  if (meds.length === 0) {
    titulo.textContent = 'Nenhum medicamento ativo';
    list.innerHTML = `
      <div style="padding:20px;text-align:center;color:var(--ink3);font-size:13px;font-weight:500;">
        Comece adicionando seu primeiro medicamento
        <br>
        <a href="05-add-medicamento.html" style="color:var(--green2);font-weight:700;text-decoration:none;margin-top:8px;display:inline-block;">+ Adicionar agora</a>
      </div>
    `;
    return;
  }

  // Considera ativos com horário hoje
  const hoje = new Date();
  const proximas = meds
    .filter(m => m.ativo !== false)
    .sort((a, b) => (a.horario || '99:99').localeCompare(b.horario || '99:99'))
    .slice(0, 3);

  const tomados = Number(localStorage.getItem(`vitae_tomados_${dataChave(hoje)}`) || 0);
  titulo.textContent = `${tomados} de ${proximas.length} tomados`;

  list.innerHTML = proximas.map(m => `
    <div class="med-row" onclick="window.location='04-med-detalhe.html?id=${encodeURIComponent(m.id)}'">
      <div class="med-icon">
        <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 20.5 3.5 13.5a4.95 4.95 0 0 1 7-7l7 7a4.95 4.95 0 0 1-7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
      </div>
      <div class="med-row-info">
        <div class="med-row-name">${sanitize(m.nome)}${m.dosagem ? ' ' + sanitize(m.dosagem) : ''}</div>
        <div class="med-row-time">${sanitize(m.horario || 'Quando precisar')}${m.via ? ' · ' + sanitize(m.via.toLowerCase()) : ''}</div>
      </div>
      <button class="med-check" onclick="event.stopPropagation(); marcarTomado('${m.id}', this);" aria-label="Marcar como tomado">
        <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
    </div>
  `).join('');
}

function renderAlergiasHome(alergias) {
  const resumo = document.getElementById('alergiasResumo');
  const list = document.getElementById('alergiasHomeList');

  if (alergias.length === 0) {
    resumo.textContent = 'Nenhuma alergia cadastrada';
    list.innerHTML = `
      <div style="padding:20px;text-align:center;color:var(--ink3);font-size:13px;font-weight:500;">
        Cadastre suas alergias pra emergência
        <br>
        <a href="08-add-alergia.html" style="color:var(--green2);font-weight:700;text-decoration:none;margin-top:8px;display:inline-block;">+ Adicionar agora</a>
      </div>
    `;
    return;
  }

  const criticas = alergias.filter(a => a.gravidade === 'GRAVE').length;
  const moderadas = alergias.filter(a => a.gravidade === 'MODERADA').length;
  const leves = alergias.filter(a => a.gravidade === 'LEVE').length;

  const partes = [];
  if (criticas) partes.push(`${criticas} ${criticas === 1 ? 'crítica' : 'críticas'}`);
  if (moderadas) partes.push(`${moderadas} ${moderadas === 1 ? 'moderada' : 'moderadas'}`);
  if (leves) partes.push(`${leves} ${leves === 1 ? 'leve' : 'leves'}`);
  resumo.textContent = partes.join(' · ');

  const ordenadas = [...alergias].sort((a, b) => {
    const ordem = { 'GRAVE': 0, 'MODERADA': 1, 'LEVE': 2 };
    return (ordem[a.gravidade] || 99) - (ordem[b.gravidade] || 99);
  }).slice(0, 3);

  list.innerHTML = ordenadas.map(a => `
    <div class="med-row" onclick="window.location='07-alergia-detalhe.html?id=${encodeURIComponent(a.id)}'" style="cursor:pointer">
      <div class="med-icon ${a.gravidade === 'GRAVE' ? 'bad' : ''}">
        <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <div class="med-row-info">
        <div class="med-row-name">${sanitize(a.nome)}</div>
        <div class="med-row-time">${formatarGravidade(a.gravidade)}${a.tipo ? ' · ' + formatarTipoAlergia(a.tipo).toLowerCase() : ''}</div>
      </div>
    </div>
  `).join('');
}

function formatarGravidade(g) {
  const map = { 'LEVE': 'Leve', 'MODERADA': 'Moderada', 'GRAVE': 'Alta gravidade' };
  return map[g] || '—';
}

function formatarTipoAlergia(t) {
  const map = { 'RASH': 'Erupção cutânea', 'URTICARIA': 'Urticária', 'ANAFILAXIA': 'Choque anafilático', 'BRONCOSPASMO': 'Broncoespasmo', 'EDEMA': 'Edema laríngeo', 'OUTRO': 'Outro' };
  return map[t] || sanitize(t || 'Outro');
}

function dataChave(d) {
  return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}

function marcarTomado(medId, btn) {
  btn.classList.toggle('taken');
  const hoje = new Date();
  const chave = `vitae_tomados_${dataChave(hoje)}`;
  let atual = Number(localStorage.getItem(chave) || 0);
  if (btn.classList.contains('taken')) atual++;
  else atual = Math.max(0, atual - 1);
  localStorage.setItem(chave, String(atual));
  // Atualiza titulo
  const titulo = document.getElementById('medsTituloHoje');
  const total = document.querySelectorAll('#medsHomeList .med-row').length;
  titulo.textContent = `${atual} de ${total} tomados`;
}

function marcarSkeleton(on) {
  const ids = ['rgNome', 'rgNumero', 'rgSangue', 'rgNascimento', 'rgEmerg', 'rgVersoAlergias', 'rgVersoMeds', 'rgVersoEmerg', 'rgAtualizadoEm', 'medsTituloHoje', 'alergiasResumo'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (on) el.classList.add('skeleton-text');
    else el.classList.remove('skeleton-text');
  });
}

// Boot
window.addEventListener('DOMContentLoaded', iniciarTelaSaude);
```

### Passo 1.3.3: Adicionar CSS de skeleton no `<style>` da tela

Inserir antes de `</style>` do `01-saude.html`:

```css
.skeleton-text {
  background: linear-gradient(90deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.09) 50%, rgba(0,0,0,0.05) 100%);
  background-size: 200%;
  animation: skelAnim 1.4s ease-in-out infinite;
  border-radius: 4px;
  color: transparent !important;
  user-select: none;
}
@keyframes skelAnim { 0% { background-position: 200%; } 100% { background-position: -200%; } }
body.loading .anim { animation-play-state: paused; }
```

### Passo 1.3.4: Editar `40-saude-vazia.html`

Adicionar `<script src="api-real.js"></script>` antes de `</body>` + bloco JS:

```javascript
<script>
function sanitize(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function primeiroNome(n) {
  if (!n) return '';
  return n.trim().split(/\s+/)[0];
}

window.addEventListener('DOMContentLoaded', () => {
  // Lê nome do query (vindo do redirect de 01-saude) ou do localStorage
  const params = new URLSearchParams(window.location.search);
  let nome = params.get('nome');
  if (!nome) {
    const u = JSON.parse(localStorage.getItem('vitae_usuario') || 'null');
    nome = u && u.nome || '';
  }

  document.getElementById('vazioNome').textContent = primeiroNome(nome);
  document.getElementById('vazioRGNome').textContent = nome.toUpperCase();
  document.getElementById('vazioRGId').textContent = 'RG da Saúde · em criação';
  document.getElementById('vazioNasc').textContent = '—';
  document.getElementById('vazioEmerg').textContent = '—';
});
</script>
```

Substituir os 5 hardcodes por placeholders com IDs (`vazioNome`, `vazioRGNome`, `vazioRGId`, `vazioNasc`, `vazioEmerg`).

### Passo 1.3.5: Não editar `52-loading-home.html` neste lote

Confirmar que continua acessível como tela separada.

### Passo 1.3.6: Testar manualmente

Abrir `http://localhost:3000/app-v3/01-saude.html` no Edge (com Playwright headless: false).

Esperar ver:
- Sem token: redirect imediato pra `23-login.html`
- Com token de paciente novo: redirect pra `40-saude-vazia.html?nome=...`
- Com token de paciente cheio: tela com dados reais

Se algum hardcode aparece após 2s, **falhou** — voltar pra Passo 1.3.1.

### Passo 1.3.7: Criar `tests/lote-1-saude-home.js`

Ver seção 1.5 abaixo.

## 1.4 Estados a Cobrir

### Estado 1: Paciente sem login

```
sem vitae_token
  → 01-saude.html
  → redirect 23-login.html
```

Validação: `expect(page.url()).toContain('23-login.html')`.

### Estado 2: Token expirado (refresh falha)

```
token expirado + refresh expirado
  → 01-saude.html
  → fetch /perfil 401
  → refreshTokens() falha
  → logout() → redirect 23-login.html
```

Validação: igual ao Estado 1.

### Estado 3: Token expirado mas refresh válido

```
token expirado + refresh válido
  → 01-saude.html
  → fetch /perfil 401
  → refreshTokens() retorna novo token
  → retry → 200 → render normal
```

Validação: tela carrega normal, sem redirect.

### Estado 4: Paciente novo, perfil vazio

```
perfil retorna { usuario: { nome: "Joao Silva", ... }, perfil: null }
  → redirect 40-saude-vazia.html?nome=Joao+Silva
  → 40 mostra "JOAO SILVA" no RG, "RG em criação", nasc "—"
```

Validação: 40-saude-vazia mostra primeiro nome no greeting + nome completo upper no RG.

### Estado 5: Paciente parcial (só nasc, sem sangue)

```
perfil retorna { usuario, perfil: { dataNascimento: "1990-...", tipoSanguineo: null, ... } }
  → considera incompleto → redirect 40
```

Estado 6: Paciente completo, 0 meds, 0 alergias

```
perfil completo + listarMedicamentos retorna { medicamentos: [] } + listarAlergias retorna { alergias: [] }
  → home renderiza RG card preenchido
  → seção meds mostra "Nenhum medicamento ativo" + CTA "+ Adicionar agora"
  → seção alergias mostra "Nenhuma alergia cadastrada" + CTA
```

Validação: `expect(page.locator('text=Nenhum medicamento ativo')).toBeVisible()`.

### Estado 7: Paciente completo, 3 meds, 3 alergias

```
perfil completo + 3 meds (1 ativo + 2 ativos) + 3 alergias (1 grave + 1 mod + 1 leve)
  → home renderiza tudo
  → RG card frente: nome maiúsculo, RG, sangue (ex "O+"), nasc dd/mm/yyyy, emerg formatado
  → RG card verso: alergias críticas separadas por · , meds separados por ·, contato emerg
  → seção meds: "0 de 3 tomados" (localStorage zerado), 3 cards (ordenados por horário)
  → seção alergias: "1 crítica · 1 moderada · 1 leve", 3 cards (ordenados por gravidade)
```

### Estado 8: Sem rede (backend offline)

```
todas chamadas falham com Failed to fetch
  → mostrarBannerErro com "Sem conexão..."
  → botão "Tentar de novo" recarrega
```

Validação: `expect(page.locator('#errorBanner')).toBeVisible()`.

### Estado 9: 500 do backend

```
fetch /perfil retorna 500
  → mostrarBannerErro com "Servidor com problema..."
```

### Estado 10: Foto do usuário

```
usuario.fotoUrl preenchido
  → header avatar mostra a foto (Lote 7 — neste lote: opcional)
```

Decisão: NESTE LOTE não preocupar com foto na home. Lote 7 cuida.

### Estado 11: Próxima consulta presente

```
getProximoAgendamento retorna { agendamento: { data: "2026-05-21T14:30", medicoNome: "Dr. X", ... } }
  → este lote: ignora (não tem UI ainda).
```

Decisão: este lote NÃO mostra próximo agendamento. Lote 5 cuida.

### Estado 12: Flip card

Já funciona (não mexe).

### Estado 13: Skeleton durante fetch

```
fetch demora 1s
  → durante 1s: todos os campos têm classe .skeleton-text (animação pulse)
  → fetch retorna: classe sai, valores aparecem com transição
```

Validação: capture screenshot durante 300ms após `goto` — espera ver skeleton.

### Estado 14: Renderização gradual

Não fazer streaming. Tudo aparece junto após `Promise.all` resolver. Skeleton uniforme.

## 1.5 Playwright Tests pra Este Lote

Arquivo: `tests/lote-1-saude-home.js`.

```javascript
// LOTE 1 — Tela Saúde HOME
// Cenários: 12 cobertos abaixo
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const isProd = process.argv.includes('--prod');
const APP_BASE = isProd
  ? 'https://vitae-app.vercel.app/app-v3'
  : 'http://localhost:3000/app-v3';
const BACKEND = 'https://vitae-app-production.up.railway.app';
const SHOTS = path.join(__dirname, 'shots', 'lote-1');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const log = [];
function step(n, ok, det) {
  log.push({ n, ok, det, ts: new Date().toISOString() });
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${n}${det ? ' · ' + det : ''}`);
}

async function criarPaciente(page, nivel) {
  const sufixo = Date.now() + Math.floor(Math.random() * 1000);
  const dados = {
    nome: `Lote1-${nivel} ${sufixo}`,
    celular: '+5511' + String(sufixo).slice(-9),
    email: `lote1-${nivel}-${sufixo}@vitae-test.com`,
    senha: 'TesteSenha123!'
  };
  const res = await page.evaluate(async ({ d, backend }) => {
    const r = await fetch(`${backend}/auth/cadastro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...d, tipo: 'PACIENTE' })
    });
    return { status: r.status, body: await r.json() };
  }, { d: dados, backend: BACKEND });

  if (!res.body || !res.body.token) {
    step(`Setup criar paciente ${nivel}`, false, 'HTTP ' + res.status);
    return null;
  }
  await page.evaluate((data) => {
    localStorage.setItem('vitae_token', data.token);
    if (data.refreshToken) localStorage.setItem('vitae_refresh_token', data.refreshToken);
    localStorage.setItem('vitae_usuario', JSON.stringify(data.usuario));
  }, res.body);
  return { ...dados, token: res.body.token, usuario: res.body.usuario };
}

async function preencherPerfil(page, token, dados) {
  return page.evaluate(async ({ token, dados, backend }) => {
    const r = await fetch(`${backend}/perfil`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(dados)
    });
    return { status: r.status, body: await r.json() };
  }, { token, dados, backend: BACKEND });
}

async function adicionarMed(page, token, dados) {
  return page.evaluate(async ({ token, dados, backend }) => {
    const r = await fetch(`${backend}/medicamentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(dados)
    });
    return { status: r.status, body: await r.json() };
  }, { token, dados, backend: BACKEND });
}

async function adicionarAlergia(page, token, dados) {
  return page.evaluate(async ({ token, dados, backend }) => {
    const r = await fetch(`${backend}/alergias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(dados)
    });
    return { status: r.status, body: await r.json() };
  }, { token, dados, backend: BACKEND });
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const ctx = await browser.newContext({ viewport: { width: 500, height: 950 } });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('  [console.error]', m.text()); });

  try {

    // ============== CENÁRIO 1: Paciente sem login ==============
    await page.goto(APP_BASE + '/01-saude.html');
    await page.waitForTimeout(2000);
    const url1 = page.url();
    step('1. Sem login redirect login', url1.includes('23-login') || url1.includes('21-boas-vindas') || url1.includes('20-splash'), 'url: ' + url1);
    await page.screenshot({ path: path.join(SHOTS, '01-sem-login.png') });

    // ============== CENÁRIO 2: Paciente NOVO sem perfil ==============
    await page.goto(APP_BASE + '/01-saude.html');
    await page.waitForTimeout(500);
    const novo = await criarPaciente(page, 'novo');
    if (!novo) { step('2. Setup paciente novo', false, 'falhou criar'); return; }

    await page.goto(APP_BASE + '/01-saude.html');
    await page.waitForTimeout(3000);
    const url2 = page.url();
    step('2. Paciente novo redirect 40-vazia', url2.includes('40-saude-vazia'), 'url: ' + url2);
    const nomeVisivel = await page.locator(`text=${novo.nome.split(' ')[0]}`).count();
    step('2.1 Nome real no greeting de 40-vazia', nomeVisivel > 0);
    await page.screenshot({ path: path.join(SHOTS, '02-paciente-novo.png') });

    // ============== CENÁRIO 3: Paciente preenche perfil → home renderiza ==============
    await preencherPerfil(page, novo.token, {
      dataNascimento: '1990-05-15',
      tipoSanguineo: 'O_POS',
      sexoBiologico: 'MASCULINO',
      cpf: '52998224725',
      altura: 175,
      peso: 70,
      contatoEmergenciaNome: 'Maria Test',
      contatoEmergenciaTel: '(11) 91234-5678',
      contatoEmergenciaParentesco: 'mãe'
    });
    await page.goto(APP_BASE + '/01-saude.html');
    await page.waitForTimeout(3000);

    const rgNome = await page.locator('#rgNome').textContent();
    step('3. RG mostra nome real', rgNome && rgNome.includes(novo.nome.split(' ')[0].toUpperCase()), 'rgNome: ' + rgNome);

    const rgSangue = await page.locator('#rgSangue').textContent();
    step('3.1 RG mostra sangue real (O+)', rgSangue === 'O+', 'sangue: ' + rgSangue);

    const rgNasc = await page.locator('#rgNascimento').textContent();
    step('3.2 RG mostra nascimento formatado', rgNasc === '15/05/1990', 'nasc: ' + rgNasc);

    const rgEmerg = await page.locator('#rgEmerg').textContent();
    step('3.3 RG mostra emerg tel real', rgEmerg && rgEmerg.includes('1234'), 'emerg: ' + rgEmerg);

    await page.screenshot({ path: path.join(SHOTS, '03-paciente-perfil.png') });

    // ============== CENÁRIO 4: Empty state de meds e alergias ==============
    const medsEmpty = await page.locator('text=Nenhum medicamento ativo').count();
    step('4. Empty state meds quando 0', medsEmpty > 0);

    const alergiaEmpty = await page.locator('text=Nenhuma alergia cadastrada').count();
    step('4.1 Empty state alergias quando 0', alergiaEmpty > 0);

    // ============== CENÁRIO 5: Adicionar 1 alergia GRAVE → RG verso atualiza ==============
    await adicionarAlergia(page, novo.token, {
      nome: 'Dipirona',
      tipo: 'ANAFILAXIA',
      gravidade: 'GRAVE',
      dataDiagnostico: '2024-03-12'
    });
    await page.goto(APP_BASE + '/01-saude.html');
    await page.waitForTimeout(3000);

    const versoAlergias = await page.locator('#rgVersoAlergias').textContent();
    step('5. RG verso mostra alergia GRAVE adicionada', versoAlergias && versoAlergias.includes('Dipirona'), 'verso: ' + versoAlergias);

    const resumoAlergias = await page.locator('#alergiasResumo').textContent();
    step('5.1 Resumo "1 crítica"', resumoAlergias && resumoAlergias.includes('1 crítica'), 'resumo: ' + resumoAlergias);

    await page.screenshot({ path: path.join(SHOTS, '04-com-alergia.png') });

    // ============== CENÁRIO 6: Adicionar 2 medicamentos → RG verso + lista ==============
    await adicionarMed(page, novo.token, { nome: 'Losartana', dosagem: '50mg', horario: '08:00', frequencia: 'Todo dia', via: 'ORAL', motivo: 'Pressão', dataInicio: '2026-03-01' });
    await adicionarMed(page, novo.token, { nome: 'Omeprazol', dosagem: '20mg', horario: '07:30', frequencia: 'Todo dia', via: 'ORAL', motivo: 'Refluxo', dataInicio: '2026-04-01' });
    await page.goto(APP_BASE + '/01-saude.html');
    await page.waitForTimeout(3000);

    const versoMeds = await page.locator('#rgVersoMeds').textContent();
    step('6. RG verso mostra meds adicionados', versoMeds && versoMeds.includes('Losartana') && versoMeds.includes('Omeprazol'), 'verso: ' + versoMeds);

    const tituloMeds = await page.locator('#medsTituloHoje').textContent();
    step('6.1 Título "0 de 2 tomados"', tituloMeds && tituloMeds.includes('0 de 2'), 'titulo: ' + tituloMeds);

    const cardsMeds = await page.locator('#medsHomeList .med-row').count();
    step('6.2 Lista tem 2 cards', cardsMeds === 2, 'count: ' + cardsMeds);

    await page.screenshot({ path: path.join(SHOTS, '05-com-meds.png') });

    // ============== CENÁRIO 7: Click no card → vai pro detalhe ==============
    const cards = page.locator('#medsHomeList .med-row');
    await cards.first().click();
    await page.waitForTimeout(1500);
    const urlDetalhe = page.url();
    step('7. Click card med → 04-med-detalhe com id', urlDetalhe.includes('04-med-detalhe.html') && urlDetalhe.includes('id='), 'url: ' + urlDetalhe);

    // ============== CENÁRIO 8: Marcar tomado → titulo atualiza ==============
    await page.goto(APP_BASE + '/01-saude.html');
    await page.waitForTimeout(3000);
    const checkBtn = page.locator('#medsHomeList .med-check').first();
    await checkBtn.click();
    await page.waitForTimeout(500);
    const tituloDepois = await page.locator('#medsTituloHoje').textContent();
    step('8. Marcar tomado atualiza contagem', tituloDepois && tituloDepois.includes('1 de 2'), 'titulo: ' + tituloDepois);

    // ============== CENÁRIO 9: Sem rede ==============
    await page.route('**/perfil', route => route.abort());
    await page.route('**/alergias', route => route.abort());
    await page.route('**/medicamentos', route => route.abort());
    await page.goto(APP_BASE + '/01-saude.html');
    await page.waitForTimeout(4000);
    const banner = await page.locator('#errorBanner').count();
    step('9. Sem rede → banner erro aparece', banner > 0);
    await page.screenshot({ path: path.join(SHOTS, '06-sem-rede.png') });
    await page.unroute('**/perfil');
    await page.unroute('**/alergias');
    await page.unroute('**/medicamentos');

    // ============== CENÁRIO 10: Token inválido ==============
    await page.evaluate(() => { localStorage.setItem('vitae_token', 'invalido-fake'); });
    await page.goto(APP_BASE + '/01-saude.html');
    await page.waitForTimeout(4000);
    const urlAposInvalido = page.url();
    step('10. Token inválido → redirect login', urlAposInvalido.includes('23-login') || urlAposInvalido.includes('21-boas-vindas') || urlAposInvalido.includes('03-cadastro'), 'url: ' + urlAposInvalido);

    // ============== CENÁRIO 11: Flip card funciona ==============
    await page.evaluate((data) => {
      localStorage.setItem('vitae_token', data.token);
      localStorage.setItem('vitae_refresh_token', data.refreshToken || '');
      localStorage.setItem('vitae_usuario', JSON.stringify(data.usuario));
    }, { token: novo.token, refreshToken: '', usuario: novo.usuario });

    await page.goto(APP_BASE + '/01-saude.html');
    await page.waitForTimeout(3000);
    const cardFlipBefore = await page.locator('#rgCard').getAttribute('class');
    await page.locator('#rgCard').click();
    await page.waitForTimeout(800);
    const cardFlipAfter = await page.locator('#rgCard').getAttribute('class');
    step('11. Click no RG card → flip funciona', cardFlipAfter && cardFlipAfter.includes('flipped'), 'classes: ' + cardFlipAfter);
    await page.screenshot({ path: path.join(SHOTS, '07-card-flipped.png') });

    // ============== CENÁRIO 12: Nenhum hardcoded restou ==============
    await page.goto(APP_BASE + '/01-saude.html');
    await page.waitForTimeout(3000);
    const html = await page.content();
    const hardcodes = [
      'LUCAS BORELLI',
      '001234567',
      '12/03/2008',
      '(11) 98765-4321',
      'Marina Borelli',
      'Losartana 50mg',
      'Omeprazol 20mg',
      'Vitamina D 2000',
      'Dipirona · Penicilina',
      '2 de 3 tomados',
      '2 críticas · 1 leve'
    ];
    const encontrados = hardcodes.filter(h => html.includes(h));
    step('12. Zero hardcoded restou na home', encontrados.length === 0, 'restou: ' + encontrados.join(', '));

  } catch (e) {
    console.error('[fatal]', e);
    await page.screenshot({ path: path.join(SHOTS, 'erro-fatal.png') });
    step('Fatal error', false, e.message);
  } finally {
    fs.writeFileSync(path.join(SHOTS, 'log.json'), JSON.stringify(log, null, 2));
    const total = log.length;
    const passou = log.filter(l => l.ok).length;
    console.log(`\n[${passou}/${total}] cenários passaram`);
    await browser.close();
    process.exit(passou === total ? 0 : 1);
  }
})();
```

## 1.6 Critério de Pronto

Lote 1 considerado pronto quando TODAS as condições abaixo são true:

- [ ] Grep `Lucas Borelli` em `01-saude.html` retorna 0 linhas (case-sensitive E case-insensitive)
- [ ] Grep `LUCAS BORELLI` retorna 0
- [ ] Grep `001234567` retorna 0
- [ ] Grep `12/03/2008` retorna 0
- [ ] Grep `98765-4321` retorna 0
- [ ] Grep `Marina Borelli` retorna 0
- [ ] Grep `Losartana 50mg` em `01-saude.html` retorna 0
- [ ] Grep `Omeprazol 20mg` em `01-saude.html` retorna 0
- [ ] Grep `Vitamina D 2000UI` em `01-saude.html` retorna 0
- [ ] Grep `2 de 3 tomados` retorna 0
- [ ] Grep `Dipirona · Penicilina` retorna 0
- [ ] Grep `2 críticas · 1 leve` retorna 0
- [ ] Mesmos hardcodes em `40-saude-vazia.html` retornam 0
- [ ] Paciente sem login redireciona pra login
- [ ] Paciente novo (sem perfil) redireciona pra `40-saude-vazia.html` com nome real
- [ ] Paciente cheio vê RG com SEUS dados
- [ ] Empty states "Nenhum medicamento ativo" / "Nenhuma alergia cadastrada" aparecem quando 0
- [ ] Click em card de med leva pro detalhe (Lote 2) com id no querystring
- [ ] Click em card de alergia leva pro detalhe (Lote 3) com id no querystring
- [ ] Marcar tomado atualiza contador local
- [ ] Sem rede → banner vermelho aparece
- [ ] Token inválido → redirect login
- [ ] Flip card funciona normal
- [ ] 12/12 cenários Playwright passam local
- [ ] 12/12 cenários Playwright passam em produção (após deploy)
- [ ] Screenshots em `tests/shots/lote-1/` mostram visualmente OK
- [ ] Lighthouse mobile na home > 80 (não obrigatório, só logar)

## 1.7 Deploy do Lote 1

### 1.7.1 Pre-deploy

```powershell
# Limpa qualquer servidor python rodando
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force

# Verifica branch correta
git status
git branch --show-current  # deve mostrar feat-app-v3-paciente
```

### 1.7.2 Commit

```powershell
git add app-v3/01-saude.html app-v3/40-saude-vazia.html tests/lote-1-saude-home.js tests/credenciais-lotes.json
git status  # confere o que vai commitar
git commit -m @'
feat(app-v3): LOTE 1 — Tela Saúde HOME conectada ao backend

- Trocou nome, RG, dataNasc, tipo sanguíneo, contato emergência hardcoded por chamadas reais
- Conectou cards de medicamentos e alergias com listarMedicamentos e listarAlergias
- Adicionou estado de loading inline (skeleton) e empty state pra paciente sem perfil
- Telas afetadas: 01-saude.html, 40-saude-vazia.html
- Funções vitaeAPI conectadas: getPerfil, listarAlergias, listarMedicamentos
- Testes: 12 cenários Playwright (paciente novo / cheio / sem rede / 401 / flip / etc)

Tests: Playwright 12/12 passed local
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
```

### 1.7.3 Push

```powershell
git push origin feat-app-v3-paciente
```

### 1.7.4 Verificar deploy Vercel

```powershell
Start-Sleep -Seconds 90
$r = Invoke-WebRequest "https://vitae-app.vercel.app/app-v3/01-saude.html" -Method Head
Write-Host "Status: $($r.StatusCode)"
Write-Host "Deploy id: $($r.Headers['x-vercel-id'])"
```

Se status != 200, esperar +30s e retry. Se ainda falhar após 3min, ir ao Vercel dashboard.

### 1.7.5 Validar contra produção

```powershell
node tests/lote-1-saude-home.js --prod
```

Espera 12/12 passar. Se falhar:
- Capturar logs
- Investigar (provavelmente cache do browser ou CDN — esperar 5min)
- Re-rodar
- Se ainda falhar: REVERTER commit, fix, novo commit

### 1.7.6 Commit final do lote

Após validação OK, fazer commit separado com `MAPA-IMPLEMENTACAO-FINAL.md` e `CLAUDE.md` atualizados:

```powershell
git add MAPA-IMPLEMENTACAO-FINAL.md CLAUDE.md
git commit -m @'
docs: marca LOTE 1 como completed

- 01-saude.html, 40-saude-vazia.html: backend conectado, hardcoded zerado
- Playwright 12/12 passed local + prod
- Próximo: LOTE 2 (lista medicamentos)
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
git push origin feat-app-v3-paciente
```

## 1.8 Rollback se Lote 1 Quebrar Produção

### 1.8.1 Opção A: revert (preferida)

```powershell
git revert HEAD --no-edit
git push origin feat-app-v3-paciente
```

Vercel re-deploya versão anterior em ~90s.

### 1.8.2 Opção B: Vercel dashboard

1. Vai pra vercel.com/vitaehealth2906-ops/vitae-app/deployments
2. Acha o deploy anterior (verde)
3. Clica "Promote to Production"
4. Instant rollback (~10s)

### 1.8.3 Validação pós-rollback

```powershell
Invoke-WebRequest "https://vitae-app.vercel.app/app-v3/01-saude.html" | Select-Object -ExpandProperty Content | Select-String 'LUCAS BORELLI'
```

Espera ver "LUCAS BORELLI" (a versão antiga). Significa que rollback funcionou.

### 1.8.4 Pós-rollback

- Marcar lote como FALHADO em `tests/bugs-encontrados.json`
- Investigar causa raiz
- Não tentar Lote 2 até resolver

## 1.9 Bugs Conhecidos a Evitar

### Bug 1: `vitaeAPI.getProximoAgendamento()` retorna 404 pra paciente novo

Comportamento backend: paciente sem agendamentos retorna 404 (não array vazio).
Solução: `.catch(() => null)` na chamada. Já incluído no plano.

### Bug 2: `vitaeAPI.getScoreAtual()` retorna 404 ou 500 pra paciente sem checkin

Idem. Solução: `.catch(() => null)`. NÃO USAR neste lote — sem UI de score.

### Bug 3: `usuario.fotoUrl` pode vir vazio mesmo após upload

Backend salva `fotoUrl` na tabela Usuario. Se quiz pulou foto, `fotoUrl = null`. UI deve mostrar iniciais.
Solução: helper `iniciais(nome)`. NÃO USAR neste lote (header é só ícone genérico).

### Bug 4: Sanitize de strings vazias retorna '' não '—'

Cuidado: sanitize('') = ''. Pra UI mostrar '—' use `sanitize(x) || '—'`.

### Bug 5: tipoSanguineo pode vir como string raw "O+" se vier do quiz antigo

Versões antigas do quiz salvavam "O+" em vez de "O_POS". O `formatarTipoSanguineo` precisa aceitar AMBOS.

Ajuste:
```javascript
function formatarTipoSanguineo(t) {
  const map = { 'A_POS': 'A+', 'A_NEG': 'A-', ... };
  if (map[t]) return map[t];
  if (typeof t === 'string' && /^(A|B|AB|O)[+-]$/.test(t)) return t; // já formatado
  return '—';
}
```

### Bug 6: dataNascimento pode vir como "1990-05-15T00:00:00.000Z" ou "1990-05-15"

Ambos parseiam com `new Date(d)`. Mas se vier `"15/05/1990"` (formato BR), quebra.
Solução: `formatarData` já trata isNaN. Se vier formato errado, retorna '—'.

### Bug 7: Skeleton pisca quando fetch é muito rápido

Ex: backend cached responde em 50ms. Skeleton aparece e some no mesmo frame. Olho percebe "flicker".
Solução: `setTimeout` de mínimo 200ms antes de remover skeleton. Já incluído no plano.

### Bug 8: localStorage pode estar corrompido

Ex: `JSON.parse(localStorage.getItem('vitae_usuario'))` lança erro se string inválida.
Solução: try/catch + fallback null. Adicionar wrapper:

```javascript
function safeGetUsuario() {
  try {
    const raw = localStorage.getItem('vitae_usuario');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
```

### Bug 9: RG number = id UUID truncado pode dar conflito

Dois pacientes podem ter mesmos últimos 7 dígitos numéricos.
Decisão: aceitar (não é número oficial, só visual). Lote 10 reavalia.

### Bug 10: Backend retorna `alergias` ou `[...alergias diretamente]` (inconsistência)

Confirmado pelo manual: backend retorna `{ alergias: [...] }`. Mas há código antigo que assume array direto.
Solução: `const alergias = (alergiasRes && alergiasRes.alergias) || (Array.isArray(alergiasRes) ? alergiasRes : [])`.

### Bug 11: Token de paciente medico criado pelo dashboard pode aparecer aqui

Edge case: alguém faz cadastro como MEDICO e tenta abrir `01-saude.html`. Não deveria ter perfil de paciente.
Solução: verificar `usuario.tipo === 'PACIENTE'`. Se não, redirect pro dashboard médico.

```javascript
if (usuario.tipo === 'MEDICO') {
  window.location.href = '/20-medico-dashboard.html';
  return;
}
```

### Bug 12: Race condition em marcarTomado()

Se paciente clica check rápido, contador desincroniza.
Solução: usar transação localStorage atômica. Não crítico — leve.

### Bug 13: Empty state CTA pode ser redundante

Já tem link "Ver semana" no header. Adicionar CTA "Adicionar agora" no empty pode confundir.
Decisão: testar com Lucas. Se ele acha redundante, remover.

## 1.10 Tempo Estimado Detalhado

| Sub-tarefa | Tempo |
|---|---|
| Ler 01-saude.html inteiro | 10min |
| Ler 40-saude-vazia.html inteiro | 5min |
| Editar 01-saude.html (6 edits HTML + 1 edit script) | 60min |
| Editar 40-saude-vazia.html (5 edits + script) | 25min |
| Testar manualmente local (browser ao vivo) | 20min |
| Escrever tests/lote-1-saude-home.js | 40min |
| Rodar e corrigir bugs Playwright | 60min |
| Commit + push | 5min |
| Esperar deploy + validar prod | 15min |
| Update MAPA + CLAUDE.md | 10min |
| **Total** | **~4h** |

Margem +20% = 4h48min. Se passar de 5h sem completar, **PARAR e perguntar Lucas**.

## 1.11 Checklist Final Lote 1

- [ ] Lido este lote inteiro 2x antes de começar
- [ ] Lido PARTE 0 1x antes de começar
- [ ] 6 edits no `01-saude.html` aplicados
- [ ] Script novo de ~300 linhas adicionado no final
- [ ] 5 edits no `40-saude-vazia.html` aplicados
- [ ] Script novo de ~30 linhas adicionado no final
- [ ] `<script src="api-real.js">` em ambos os arquivos
- [ ] `tests/lote-1-saude-home.js` criado e roda 12/12 local
- [ ] Commit feito com mensagem padrão
- [ ] Push feito
- [ ] Deploy Vercel verificado (status 200)
- [ ] Validação prod 12/12
- [ ] Screenshots capturados em `tests/shots/lote-1/`
- [ ] Bugs novos (se houver) logados em `tests/bugs-encontrados.json`
- [ ] MAPA-IMPLEMENTACAO-FINAL.md atualizado
- [ ] CLAUDE.md atualizado
- [ ] Commit doc + push
- [ ] Voltar pra PARTE 0 e ler de novo
- [ ] Ir pra Lote 2

---

# PARTE 2 — Lote 2: Lista de Medicamentos + CRUD

## 2.1 Resumo Executivo

**Objetivo macro**: tornar a aba Medicamentos do app v3 100% real. Paciente lista, adiciona, edita, remove SEUS medicamentos com persistência no backend e estado vazio acolhedor.

**Telas afetadas** (4):
- `app-v3/03-medicamentos.html` (lista — atualmente 316 linhas, 7+ hardcodes)
- `app-v3/04-med-detalhe.html` (detalhe — atualmente 178 linhas, todo hardcoded)
- `app-v3/05-add-medicamento.html` (form add/edit — atualmente 223 linhas, sem hardcode mas sem submit real)
- `app-v3/41-medicamentos-vazia.html` (empty state — atualmente sem hardcode crítico)

**Funções vitaeAPI usadas**:
- `vitaeAPI.listarMedicamentos()`
- `vitaeAPI.adicionarMedicamento(dados)`
- `vitaeAPI.atualizarMedicamento(id, dados)`
- `vitaeAPI.removerMedicamento(id)`
- `vitaeAPI.infoMedicamento(nome)` (CMED — opcional autocomplete)

**Endpoints backend**:
- `GET /medicamentos` → retorna `{ medicamentos: [{ id, nome, dosagem, frequencia, horario, motivo, via, dataInicio, dataFim, ativo, quantidadeEstoque, medicoPrescritor, ... }] }`
- `POST /medicamentos` → cria, retorna `{ medicamento }` ou 422 validação
- `PUT /medicamentos/:id` → atualiza, retorna `{ medicamento }`
- `DELETE /medicamentos/:id` → 204
- `GET /medicamentos/info/:nome` → retorna `{ nome, principioAtivo, classe, indicacoes, contraindicacoes, ... }` ou 404

**Tempo estimado**: 3-4h.

**Risco**: baixo. CRUD simples + lista. Calendário tem cuidado.

**Dependências**: Lote 1 não obrigatório, mas recomendado pra base de helpers.

## 2.2 Estado Atual Exato

### 2.2.1 Arquivo `03-medicamentos.html` (316 linhas)

Hardcodes:

| Linha | Trecho | O que substituir |
|---|---|---|
| 179 | `87% de adesão esta semana` | `<span id="aderenciaSemana">—</span>` |
| 188-223 | Calendário semana hardcoded dias 12-18 | container `<div id="calendarioSemana">` JS gera |
| 227 | `Hoje, quarta · 14 de maio` | `<div id="diaLabel">Hoje</div>` |
| 230-281 | 3 cards `<div class="med-card-detail">` hardcoded | `<div id="medsListaCompleta">` JS injeta |

Substitutos:
- Calendário: gerar dinâmico Date hoje +/- 3 dias (7 dias semana atual)
- Cards: iterar `listarMedicamentos`, agrupar por horário, render
- Adesão: calcular do localStorage `vitae_tomados_YYYYMMDD` últimos 7 dias

### 2.2.2 Arquivo `04-med-detalhe.html` (178 linhas)

Hardcodes:

| Linha | Trecho | O que substituir |
|---|---|---|
| 6 | `<title>vita id — Losartana</title>` | JS: `document.title = 'vita id - ' + sanitize(med.nome)` |
| 120 | `<h1 class="page-title anim">...Losartana 50mg</h1>` | `<h1 id="medTitulo"></h1>` |
| 153 | Prescritor: `Dra. Renata Cardoso` | `<span id="medPrescritor">—</span>` |
| 165 | Alert farmacológico: `Combinar Losartana com ibuprofeno aumenta...` | `<div id="medAlerta">` JS injeta (do `infoMedicamento` se possível) |

Tudo precisa de:
- ler `?id=X` da query
- chamar `listarMedicamentos` (ou `getMedicamento` se backend tiver)
- filtrar id correto
- render

### 2.2.3 Arquivo `05-add-medicamento.html` (223 linhas)

Sem hardcode crítico. Mas:
- Botão "Salvar" linha 197 hoje só faz `window.location='03-medicamentos.html'`. Precisa chamar `adicionarMedicamento`.
- Sem validação de campos.
- Sem suporte a modo edit (`?id=X`).
- Sem feedback de erro.

### 2.2.4 Arquivo `41-medicamentos-vazia.html`

OK como está. Adicionar `<script>` que redireciona pra 03 se já tem meds (caso paciente entre direto no link).

## 2.3 Plano de Mudanças Passo-a-Passo

### Passo 2.3.1: Editar `03-medicamentos.html` — Substituir HTML estático

Edit A (linha ~179, subtítulo):
```diff
-    <div class="page-subtitle anim anim-d1">87% de adesão esta semana</div>
+    <div class="page-subtitle anim anim-d1"><span id="aderenciaSemana">—</span> de adesão esta semana</div>
```

Edit B (linhas 188-223, calendário): substituir tudo por:
```html
<div class="week-calendar anim anim-d2" id="calendarioSemana">
  <!-- JS gera 7 dias -->
</div>
```

Edit C (linha 227, dia label):
```diff
-    <div class="section-label anim anim-d3" id="day-label">Hoje, quarta · 14 de maio</div>
+    <div class="section-label anim anim-d3" id="diaLabel">Hoje</div>
```

Edit D (linhas 230-281, 3 cards hardcoded): substituir por:
```html
<div id="medsListaCompleta" class="anim anim-d3">
  <!-- JS injeta cards -->
</div>
```

### Passo 2.3.2: JavaScript completo de `03-medicamentos.html`

Adicionar antes de `</body>`:

```html
<script src="api-real.js"></script>
<script>
// ========== HELPERS (copy de 01-saude.html — DRY futuro) ==========
function sanitize(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function traduzirErro(e) {
  const msg = (e && e.message) || String(e);
  if (msg.includes('Failed to fetch')) return 'Sem conexão. Verifique sua internet.';
  if (msg.includes('401')) return 'Sua sessão expirou. Faça login.';
  if (msg.match(/^Erro 5\d\d/)) return 'Servidor com problema temporário.';
  return msg || 'Algo deu errado.';
}
function mostrarBannerErro(msg) {
  const old = document.getElementById('errorBanner');
  if (old) old.remove();
  const b = document.createElement('div');
  b.id = 'errorBanner';
  b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#EF4444;color:#fff;padding:14px 20px;text-align:center;font:600 13px/1.4 "Plus Jakarta Sans",sans-serif;z-index:1000;';
  b.textContent = msg;
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 6000);
}
function dataChave(d) {
  return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}
function nomeMesPt(idx) {
  return ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][idx];
}
function diaSemanaPt(d, longo = false) {
  const dias = longo
    ? ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
    : ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
  return dias[d];
}

// ========== STATE ==========
window.STATE = {
  medicamentos: [],
  diaSelecionado: new Date(),
  hoje: new Date()
};

// ========== INIT ==========
async function iniciarTelaMeds() {
  if (!vitaeAPI.isLoggedIn()) {
    window.location.href = '23-login.html';
    return;
  }

  // Renderiza calendário enquanto fetch acontece (UI snappy)
  renderCalendario();
  renderDiaLabel();

  try {
    const res = await vitaeAPI.listarMedicamentos();
    STATE.medicamentos = (res && res.medicamentos) || [];

    if (STATE.medicamentos.length === 0) {
      window.location.href = '41-medicamentos-vazia.html';
      return;
    }

    renderMedsLista();
    renderAderencia();
  } catch (e) {
    mostrarBannerErro(traduzirErro(e));
  }
}

// ========== RENDER ==========
function renderCalendario() {
  const container = document.getElementById('calendarioSemana');
  if (!container) return;

  const hoje = STATE.hoje;
  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - hoje.getDay() + 1); // segunda

  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    const ehHoje = dataChave(d) === dataChave(hoje);
    const ehFuturo = d > hoje;
    const ehPassado = d < hoje && !ehHoje;

    const tomados = Number(localStorage.getItem(`vitae_tomados_${dataChave(d)}`) || 0);
    let status = '';
    if (ehHoje) status = tomados > 0 ? 'partial' : 'today';
    else if (ehFuturo) status = 'future';
    else if (ehPassado && tomados > 0) status = 'complete';

    html += `
      <div class="day ${ehHoje ? 'today ' : ''}${status}" onclick="selecionarDia(${i})" data-data="${d.toISOString()}">
        <div class="day-letter">${diaSemanaPt(d.getDay())}</div>
        <div class="day-num">${d.getDate()}</div>
        <div class="day-status"></div>
      </div>
    `;
  }
  container.innerHTML = html;
}

function renderDiaLabel() {
  const el = document.getElementById('diaLabel');
  if (!el) return;
  const d = STATE.diaSelecionado;
  const ehHoje = dataChave(d) === dataChave(STATE.hoje);
  if (ehHoje) {
    el.textContent = `Hoje, ${diaSemanaPt(d.getDay(), true)} · ${d.getDate()} de ${nomeMesPt(d.getMonth())}`;
  } else {
    el.textContent = `${diaSemanaPt(d.getDay(), true)} · ${d.getDate()} de ${nomeMesPt(d.getMonth())}`;
  }
}

function selecionarDia(idx) {
  // Não permite click em futuro
  const hoje = STATE.hoje;
  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - hoje.getDay() + 1);
  const novo = new Date(inicio);
  novo.setDate(inicio.getDate() + idx);
  if (novo > hoje) return;

  STATE.diaSelecionado = novo;
  renderCalendario(); // re-render pra atualizar 'selected'
  renderDiaLabel();
  renderMedsLista();
}

function renderMedsLista() {
  const container = document.getElementById('medsListaCompleta');
  if (!container) return;

  const meds = STATE.medicamentos.filter(m => m.ativo !== false);

  if (meds.length === 0) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--ink3);font-size:13px;">Nenhum medicamento ativo</div>`;
    return;
  }

  // Ordena por horário
  const ordenados = [...meds].sort((a, b) => (a.horario || '99:99').localeCompare(b.horario || '99:99'));

  const dia = STATE.diaSelecionado;
  const ehHoje = dataChave(dia) === dataChave(STATE.hoje);
  const chaveDia = `vitae_tomados_lista_${dataChave(dia)}`;
  const tomadosDia = JSON.parse(localStorage.getItem(chaveDia) || '[]');

  container.innerHTML = ordenados.map((m, i) => {
    const tomado = tomadosDia.includes(m.id);
    const horario = m.horario || 'Quando precisar';
    const motivoBadge = m.motivo ? `<span class="badge ${corMotivo(m.motivo)}" style="margin-left:6px"><span class="dot"></span>${sanitize(m.motivo)}</span>` : '';
    const aguardando = !tomado && ehHoje && horario !== 'Quando precisar' && horario > formatarHoraAgora();

    return `
      <div class="med-card-detail ${aguardando ? 'warn' : ''} anim anim-d${Math.min(6, 3 + i)}" onclick="window.location='04-med-detalhe.html?id=${encodeURIComponent(m.id)}'">
        <div class="med-detail-icon">
          <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 20.5 3.5 13.5a4.95 4.95 0 0 1 7-7l7 7a4.95 4.95 0 0 1-7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
        </div>
        <div class="med-detail-info">
          <div class="med-detail-name">${sanitize(m.nome)}${m.dosagem ? ' ' + sanitize(m.dosagem) : ''}</div>
          <div class="med-detail-meta">${sanitize(m.dose || '1 comprimido')} · ${sanitize((m.via || 'oral').toLowerCase())}</div>
          <div class="med-detail-time-row">
            <span>${sanitize(horario)}</span> · <span>${sanitize(m.frequencia || 'Todo dia')}</span>
            ${motivoBadge}
          </div>
        </div>
        <button class="med-detail-check ${tomado ? 'taken' : ''}" onclick="event.stopPropagation(); marcarTomadoLista('${m.id}', this);">
          <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
      </div>
    `;
  }).join('');
}

function corMotivo(motivo) {
  const m = (motivo || '').toLowerCase();
  if (m.includes('pressão') || m.includes('cardio') || m.includes('coração')) return 'green';
  if (m.includes('refluxo') || m.includes('gastr')) return 'blue';
  if (m.includes('dor') || m.includes('alergia')) return 'warn';
  if (m.includes('diabet') || m.includes('insulin')) return 'red';
  return '';
}

function formatarHoraAgora() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function marcarTomadoLista(medId, btn) {
  btn.classList.toggle('taken');
  const chaveDia = `vitae_tomados_lista_${dataChave(STATE.diaSelecionado)}`;
  let lista = JSON.parse(localStorage.getItem(chaveDia) || '[]');
  if (btn.classList.contains('taken')) {
    if (!lista.includes(medId)) lista.push(medId);
  } else {
    lista = lista.filter(x => x !== medId);
  }
  localStorage.setItem(chaveDia, JSON.stringify(lista));
  // Atualiza contador rapido também
  localStorage.setItem(`vitae_tomados_${dataChave(STATE.diaSelecionado)}`, lista.length);
  renderCalendario();
  renderAderencia();
}

function renderAderencia() {
  const el = document.getElementById('aderenciaSemana');
  if (!el) return;

  const hoje = STATE.hoje;
  let tomadosTotal = 0;
  let possiveisTotal = 0;

  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - 6); // últimos 7 dias

  for (let i = 0; i < 7; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    if (d > hoje) continue;
    const chave = `vitae_tomados_lista_${dataChave(d)}`;
    const lista = JSON.parse(localStorage.getItem(chave) || '[]');
    tomadosTotal += lista.length;
    // possíveis: meds ativos x 1 vez por dia (simplificado)
    possiveisTotal += STATE.medicamentos.filter(m => m.ativo !== false).length;
  }

  if (possiveisTotal === 0) {
    el.textContent = 'Sem dados';
    return;
  }
  const pct = Math.round((tomadosTotal / possiveisTotal) * 100);
  el.textContent = pct + '%';
}

window.addEventListener('DOMContentLoaded', iniciarTelaMeds);
</script>
```

### Passo 2.3.3: Editar `04-med-detalhe.html` — Substituir HTML estático

Adicionar IDs estáveis:
- `<title id="pageTitle">vita id</title>` (JS atualiza)
- Hero: `<h1 id="medTitulo">—</h1>`
- Prescritor: `<span id="medPrescritor">—</span>`
- Dose: `<span id="medDose">—</span>`
- Frequencia: `<span id="medFrequencia">—</span>`
- Horario: `<span id="medHorario">—</span>`
- Motivo: `<span id="medMotivo">—</span>`
- Via: `<span id="medVia">—</span>`
- Data inicio: `<span id="medInicio">—</span>`
- Alert farmacologico: `<div id="medAlerta" style="display:none">...</div>`
- Botão editar: `<button id="btnEditar" onclick="abrirEdicao()">`
- Botão deletar: `<button id="btnDeletar" onclick="confirmarDelete()">`

JS:

```html
<script src="api-real.js"></script>
<script>
function sanitize(s) { return s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function formatarData(d) { if (!d) return '—'; const x = new Date(d); return isNaN(x.getTime()) ? '—' : x.toLocaleDateString('pt-BR'); }
function mostrarToast(msg, tipo = 'sucesso') {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#0D0F14;color:#fff;padding:14px 22px;border-radius:14px;font:600 13px/1.4 "Plus Jakarta Sans",sans-serif;z-index:1001;';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

let STATE = { med: null };

async function iniciarTelaDetalhe() {
  if (!vitaeAPI.isLoggedIn()) { window.location.href = '23-login.html'; return; }

  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    document.getElementById('medTitulo').textContent = 'Medicamento não encontrado';
    return;
  }

  try {
    const res = await vitaeAPI.listarMedicamentos();
    const meds = (res && res.medicamentos) || [];
    const med = meds.find(m => m.id === id);
    if (!med) {
      document.getElementById('medTitulo').textContent = 'Esse medicamento não está mais na sua lista';
      return;
    }

    STATE.med = med;
    document.title = 'vita id - ' + sanitize(med.nome);
    document.getElementById('medTitulo').innerHTML = sanitize(med.nome) + (med.dosagem ? ' <em>' + sanitize(med.dosagem) + '</em>' : '');
    document.getElementById('medPrescritor').textContent = sanitize(med.medicoPrescritor || '—');
    document.getElementById('medDose').textContent = sanitize(med.dose || med.dosagem || '—');
    document.getElementById('medFrequencia').textContent = sanitize(med.frequencia || '—');
    document.getElementById('medHorario').textContent = sanitize(med.horario || 'Quando precisar');
    document.getElementById('medMotivo').textContent = sanitize(med.motivo || '—');
    document.getElementById('medVia').textContent = sanitize(med.via || '—');
    document.getElementById('medInicio').textContent = formatarData(med.dataInicio);

    // Calcula meses em uso
    if (med.dataInicio) {
      const meses = Math.max(1, Math.floor((Date.now() - new Date(med.dataInicio)) / (1000 * 60 * 60 * 24 * 30)));
      const elTempo = document.getElementById('medTempoUso');
      if (elTempo) elTempo.textContent = `Em uso há ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
    }

    // Busca info CMED (alerta farmacológico)
    try {
      const info = await vitaeAPI.infoMedicamento(med.nome);
      if (info && info.contraindicacoes) {
        const alerta = document.getElementById('medAlerta');
        alerta.style.display = '';
        alerta.querySelector('.alerta-texto').textContent = sanitize(info.contraindicacoes);
      }
    } catch { /* ok sem alerta */ }

  } catch (e) {
    mostrarToast('Erro ao carregar medicamento', 'erro');
  }
}

function abrirEdicao() {
  if (!STATE.med) return;
  window.location.href = '05-add-medicamento.html?id=' + encodeURIComponent(STATE.med.id);
}

async function confirmarDelete() {
  if (!STATE.med) return;
  // Modal custom em vez de confirm()
  const ok = await modalConfirmar(`Remover ${STATE.med.nome} da sua lista?`, 'Você pode adicionar de novo depois.');
  if (!ok) return;

  try {
    const btn = document.getElementById('btnDeletar');
    btn.disabled = true;
    btn.textContent = 'Removendo...';
    await vitaeAPI.removerMedicamento(STATE.med.id);
    mostrarToast('Medicamento removido', 'sucesso');
    setTimeout(() => window.location.href = '03-medicamentos.html', 800);
  } catch (e) {
    mostrarToast('Não conseguimos remover. Tente de novo.', 'erro');
    document.getElementById('btnDeletar').disabled = false;
    document.getElementById('btnDeletar').textContent = 'Remover';
  }
}

function modalConfirmar(titulo, descricao) {
  return new Promise(resolve => {
    const m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:center;justify-content:center;';
    m.innerHTML = `
      <div style="background:#fff;padding:24px;border-radius:18px;max-width:340px;width:88%;font-family:'Plus Jakarta Sans',sans-serif;">
        <div style="font-size:18px;font-weight:800;color:#0D0F14;margin-bottom:8px;">${sanitize(titulo)}</div>
        <div style="font-size:13px;color:#6B7280;margin-bottom:18px;line-height:1.5;">${sanitize(descricao)}</div>
        <div style="display:flex;gap:10px;">
          <button id="modalCancel" style="flex:1;padding:12px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:12px;font:600 14px 'Plus Jakarta Sans',sans-serif;cursor:pointer;">Cancelar</button>
          <button id="modalOk" style="flex:1;padding:12px;background:#EF4444;color:#fff;border:none;border-radius:12px;font:700 14px 'Plus Jakarta Sans',sans-serif;cursor:pointer;">Remover</button>
        </div>
      </div>
    `;
    document.body.appendChild(m);
    m.querySelector('#modalCancel').onclick = () => { m.remove(); resolve(false); };
    m.querySelector('#modalOk').onclick = () => { m.remove(); resolve(true); };
  });
}

window.addEventListener('DOMContentLoaded', iniciarTelaDetalhe);
</script>
```

### Passo 2.3.4: Editar `05-add-medicamento.html`

Adicionar IDs nos inputs:
- nome: `id="inputNome"`
- dose: `id="inputDose"`
- via: `id="inputVia"`
- horario(s): `<div id="timeChips">` (já tem)
- dataFim: `id="dateEnd"` (já tem)
- continuo: `id="cont"` (já tem)
- alarme toggle: `id="toggleAlarme"`
- avisar acabar toggle: `id="toggleAcabar"`
- botão salvar: `id="btnSalvar"`

Trocar `onclick="window.location='03-medicamentos.html'"` por `onclick="salvarMedicamento()"`.

JS:

```html
<script src="api-real.js"></script>
<script>
function sanitize(s) { return s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function mostrarToast(msg, tipo = 'sucesso') {
  const t = document.createElement('div');
  const bg = tipo === 'erro' ? '#EF4444' : '#0D0F14';
  t.style.cssText = `position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:${bg};color:#fff;padding:14px 22px;border-radius:14px;font:600 13px "Plus Jakarta Sans",sans-serif;z-index:1001;`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

let STATE = { editId: null, horarios: [] };

async function iniciarFormMed() {
  if (!vitaeAPI.isLoggedIn()) { window.location.href = '23-login.html'; return; }

  const id = new URLSearchParams(window.location.search).get('id');
  if (id) {
    STATE.editId = id;
    document.querySelector('.page-title').innerHTML = 'Editar <em>medicamento</em>';
    document.getElementById('btnSalvar').textContent = 'Salvar alterações';

    try {
      const res = await vitaeAPI.listarMedicamentos();
      const med = ((res && res.medicamentos) || []).find(m => m.id === id);
      if (med) {
        document.getElementById('inputNome').value = med.nome + (med.dosagem ? ' ' + med.dosagem : '');
        document.getElementById('inputDose').value = med.dose || '1 comp.';
        document.getElementById('inputVia').value = med.via || 'Oral';
        STATE.horarios = (med.horario || '').split(',').filter(Boolean);
        renderHorarios();
        if (med.dataFim) document.getElementById('dateEnd').value = med.dataFim.split('T')[0];
        if (!med.dataFim) document.getElementById('cont').checked = true;
      }
    } catch (e) {
      mostrarToast('Não conseguimos carregar o medicamento', 'erro');
    }
  }
}

function renderHorarios() {
  const chips = document.getElementById('timeChips');
  chips.querySelectorAll('.time-chip').forEach(c => c.remove());
  const addBtn = chips.querySelector('.time-add');
  STATE.horarios.forEach(h => {
    const chip = document.createElement('span');
    chip.className = 'time-chip';
    chip.innerHTML = `${sanitize(h)} <span class="x" onclick="removerHorario('${h}')">×</span>`;
    chips.insertBefore(chip, addBtn);
  });
}

function removerHorario(h) {
  STATE.horarios = STATE.horarios.filter(x => x !== h);
  renderHorarios();
}

function addTime() {
  const input = document.getElementById('timeInput');
  input.style.display = '';
  input.focus();
  input.click();
  input.onchange = function() {
    if (input.value && !STATE.horarios.includes(input.value)) {
      STATE.horarios.push(input.value);
      STATE.horarios.sort();
      renderHorarios();
      input.value = '';
    }
    input.style.display = 'none';
  };
}

async function salvarMedicamento() {
  const nomeRaw = document.getElementById('inputNome').value.trim();
  if (!nomeRaw) {
    mostrarToast('Coloca o nome do medicamento', 'erro');
    return;
  }

  // Separa nome de dosagem (heurística: última palavra com mg/ml/UI)
  let nome = nomeRaw;
  let dosagem = '';
  const matchDose = nomeRaw.match(/(.+?)\s+(\d+(?:[.,]\d+)?\s*(?:mg|ml|mcg|UI|g|%))$/i);
  if (matchDose) { nome = matchDose[1].trim(); dosagem = matchDose[2].trim(); }

  const dados = {
    nome,
    dosagem: dosagem || null,
    dose: document.getElementById('inputDose').value.trim() || null,
    via: document.getElementById('inputVia').value.trim().toUpperCase() || null,
    horario: STATE.horarios.join(',') || null,
    frequencia: STATE.horarios.length > 1 ? `${STATE.horarios.length}x ao dia` : 'Todo dia',
    dataInicio: new Date().toISOString().split('T')[0],
    dataFim: document.getElementById('cont').checked ? null : document.getElementById('dateEnd').value || null,
    ativo: true
  };

  const btn = document.getElementById('btnSalvar');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    if (STATE.editId) {
      await vitaeAPI.atualizarMedicamento(STATE.editId, dados);
      mostrarToast('Salvo', 'sucesso');
    } else {
      await vitaeAPI.adicionarMedicamento(dados);
      mostrarToast('Medicamento adicionado', 'sucesso');
    }
    setTimeout(() => window.location.href = '03-medicamentos.html', 800);
  } catch (e) {
    const msg = (e && e.message) || 'Erro ao salvar';
    if (msg.includes('422') || msg.includes('400')) mostrarToast('Verifique os campos', 'erro');
    else mostrarToast(msg.replace(/^Erro \d+\n?/, ''), 'erro');
    btn.disabled = false;
    btn.textContent = STATE.editId ? 'Salvar alterações' : 'Salvar medicamento';
  }
}

window.addEventListener('DOMContentLoaded', iniciarFormMed);
</script>
```

### Passo 2.3.5: Editar `41-medicamentos-vazia.html`

Adicionar script simples:

```html
<script src="api-real.js"></script>
<script>
window.addEventListener('DOMContentLoaded', async () => {
  if (!vitaeAPI.isLoggedIn()) { window.location.href = '23-login.html'; return; }
  // Se já tem meds, não mostrar vazia
  try {
    const res = await vitaeAPI.listarMedicamentos();
    if (res && res.medicamentos && res.medicamentos.length > 0) {
      window.location.href = '03-medicamentos.html';
    }
  } catch (e) { /* fica na vazia */ }
});
</script>
```

## 2.4 Estados a Cobrir

### Estado 1: Paciente sem login → redirect

### Estado 2: 0 meds → redirect 41-vazia

### Estado 3: 1+ med → mostra lista, calendário dinâmico

### Estado 4: Click num med → detalhe carrega com dados corretos

### Estado 5: Click "Novo" → form `05-add` abre limpo

### Estado 6: Submit form add → POST → toast → volta lista atualizada

### Estado 7: Submit form edit → PUT → toast → volta detalhe

### Estado 8: Validação: nome vazio → toast erro, não submit

### Estado 9: Validação: data fim no passado → toast erro

### Estado 10: Click "Remover" no detalhe → modal → DELETE → volta lista

### Estado 11: Sem rede → banner erro

### Estado 12: Erro 422 do backend → tradução de campo

### Estado 13: Add horário → chip aparece, sort cronológico

### Estado 14: Remover horário → chip some

### Estado 15: Toggle "Uso contínuo" → dataFim disable

### Estado 16: Calendário click dia passado → muda lista filtrada

### Estado 17: Calendário click dia futuro → não muda

### Estado 18: Marcar tomado → localStorage, calendário atualiza

### Estado 19: 14 dias de uso → aderência % calcula

### Estado 20: Med com horario null → mostra "Quando precisar"

## 2.5 Playwright Tests pra Este Lote

Arquivo: `tests/lote-2-meds.js`. Estrutura igual ao Lote 1.

Cenários (12+):

```javascript
// LOTE 2 — Lista Medicamentos + CRUD
// CENÁRIOS:
// 1. Sem login → redirect
// 2. 0 meds → redirect 41-vazia
// 3. 1 med → aparece na lista
// 4. 3 meds → ordenados por horário
// 5. Click med → 04-med-detalhe carrega
// 6. Add med via form → aparece na lista
// 7. Edit med → mudança persiste
// 8. Delete med → some da lista
// 9. Validação: nome vazio bloqueia submit
// 10. Calendário muda dia → lista filtra
// 11. Marcar tomado → calendário atualiza
// 12. Sem rede → banner erro
// 13. Aderência % calcula (7 dias)
// 14. Modal de confirmar delete
```

Pseudo-código de cada cenário (Playwright real fica como modelo do Lote 1):

```javascript
// Cenário 3: 1 med aparece na lista
const paciente = await criarPaciente(page, 'lote2-1med');
await preencherPerfil(page, paciente.token, { dataNascimento: '1990-05-15', tipoSanguineo: 'O_POS', sexoBiologico: 'MASCULINO' });
await adicionarMed(page, paciente.token, { nome: 'Losartana', dosagem: '50mg', horario: '08:00', frequencia: 'Todo dia', via: 'ORAL', motivo: 'Pressão' });
await page.goto(APP_BASE + '/03-medicamentos.html');
await page.waitForTimeout(2500);
const cards = await page.locator('#medsListaCompleta .med-card-detail').count();
step('3. 1 med aparece na lista', cards === 1);

// Cenário 6: Add med via form
await page.goto(APP_BASE + '/05-add-medicamento.html');
await page.waitForTimeout(1000);
await page.fill('#inputNome', 'Vitamina D 2000UI');
await page.fill('#inputDose', '1 cap.');
await page.click('button.time-add');
await page.fill('#timeInput', '20:00');
await page.dispatchEvent('#timeInput', 'change');
await page.click('#btnSalvar');
await page.waitForTimeout(2500);
const cardsAfter = await page.locator('#medsListaCompleta .med-card-detail').count();
step('6. Add via form aumentou lista', cardsAfter === 2);

// Cenário 8: Delete
const firstCard = page.locator('#medsListaCompleta .med-card-detail').first();
await firstCard.click();
await page.waitForTimeout(2000);
await page.click('#btnDeletar');
await page.waitForTimeout(500);
await page.click('#modalOk');
await page.waitForTimeout(2000);
const cardsAfterDelete = await page.locator('#medsListaCompleta .med-card-detail').count();
step('8. Delete med removeu', cardsAfterDelete === 1);
```

## 2.6 Critério de Pronto

- [ ] Grep `87% de adesão` retorna 0
- [ ] Grep `Losartana 50mg`, `Omeprazol 20mg`, `Vitamina D 2000UI` em `03-medicamentos.html` retorna 0
- [ ] Grep `Dra. Renata Cardoso` em `04-med-detalhe.html` retorna 0
- [ ] Calendário renderiza dinâmico (não "12 de maio" fixo)
- [ ] Paciente novo sem meds vai pra 41-vazia
- [ ] Add via form → POST funciona → lista atualiza
- [ ] Edit via form → PUT funciona
- [ ] Delete via modal → DELETE funciona
- [ ] Click card meds → 04-detalhe carrega dados certos
- [ ] Calendário muda lista por dia
- [ ] Aderência % calcula corretamente
- [ ] Playwright 14/14 local
- [ ] Playwright 14/14 prod

## 2.7 Deploy do Lote 2

Idêntico ao Lote 1. Commit message:

```
feat(app-v3): LOTE 2 — Medicamentos lista, detalhe, CRUD

- Lista (03-medicamentos): calendário dinâmico, cards de listarMedicamentos, aderência %
- Detalhe (04-med-detalhe): id por query, fetch + render, alerta CMED quando disponível
- Form add/edit (05-add-medicamento): submit chama adicionar/atualizar com validação
- Empty (41-medicamentos-vazia): redirect se já tem meds
- Telas afetadas: 03-medicamentos.html, 04-med-detalhe.html, 05-add-medicamento.html, 41-medicamentos-vazia.html
- Funções vitaeAPI: listarMedicamentos, adicionarMedicamento, atualizarMedicamento, removerMedicamento, infoMedicamento
- Testes: 14 cenários Playwright

Tests: Playwright 14/14 passed local
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

## 2.8 Rollback Lote 2

Idêntico ao 1.8. Se quebrar, `git revert HEAD` + push. Vercel volta versão anterior em ~90s.

Atenção: se já tinha rodado Lote 1, NÃO reverter Lote 1 também. O revert é só do HEAD.

## 2.9 Bugs Conhecidos a Evitar

### Bug 1: backend pode rejeitar `horario` se string vazia

Garantir `horario: STATE.horarios.join(',') || null`. Nunca enviar `""`.

### Bug 2: `via` precisa ser uppercase no backend

Schema usa enum `ORAL, SUBLINGUAL, TOPICA, INJETAVEL, INALATORIA`. Frontend faz `.toUpperCase()` antes de enviar.

Mapping:
- "Oral" → `ORAL`
- "Sublingual" → `SUBLINGUAL`
- "Tópico" → `TOPICA`
- "Injetável" → `INJETAVEL`
- "Inalatório" → `INALATORIA`

### Bug 3: `dataInicio` formato

Backend aceita `YYYY-MM-DD` ou ISO. Usar `new Date().toISOString().split('T')[0]`.

### Bug 4: Med com `frequencia` "Quando precisar" tem `horario` null

Tratamento: se `frequencia` contém "quando" ou "necessidade", forçar `horario: null`.

### Bug 5: Calendário inicia errado em domingo

`hoje.getDay() === 0` (domingo) significa segunda da semana foi 6 dias atrás.
Atual: `inicio.setDate(hoje.getDate() - hoje.getDay() + 1)`. Se hoje é domingo (`getDay() === 0`), `+1` vai pra próxima segunda — erro.
Fix: `inicio.setDate(hoje.getDate() - (hoje.getDay() === 0 ? 6 : hoje.getDay() - 1))`.

### Bug 6: localStorage `vitae_tomados_*` acumula sem limite

Após meses, terá centenas de chaves. Limpar tudo > 30 dias na inicialização:

```javascript
function limparTomadosVelhos() {
  const limite = Date.now() - 30 * 86400000;
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('vitae_tomados_')) {
      const dataStr = k.replace('vitae_tomados_lista_', '').replace('vitae_tomados_', '');
      if (dataStr.length === 8) {
        const ano = +dataStr.slice(0, 4);
        const mes = +dataStr.slice(4, 6) - 1;
        const dia = +dataStr.slice(6, 8);
        if (new Date(ano, mes, dia).getTime() < limite) localStorage.removeItem(k);
      }
    }
  });
}
```

Chamar em `iniciarTelaMeds()`.

### Bug 7: Form input `tabindex` ruim em mobile

`<input type="time">` em iOS abre wheel picker — boa UX. Manter.

### Bug 8: Botões da tab bar não sublinham na aba ativa em 03

Confirmar que a aba Meu RG tá ativa (já tá `class="tab active"` no HTML estático). OK.

### Bug 9: `media query` mobile fullscreen quebra calendário

Em mobile <480px o phone frame some. Verificar que `.week-calendar` continua scrollable horizontal.
Já testar com Playwright viewport 375x812 (iPhone 13).

### Bug 10: Confirmação modal não funciona em iOS sem `event.stopPropagation`

iOS Safari às vezes dispara `click` no parent. Adicionar `stopPropagation` em onclick do modal.

## 2.10 Tempo Estimado

| Sub-tarefa | Tempo |
|---|---|
| Ler 03, 04, 05, 41 inteiros | 25min |
| Edit 03-medicamentos.html (4 edits + script ~250 linhas) | 50min |
| Edit 04-med-detalhe.html (10 IDs + script ~120 linhas) | 40min |
| Edit 05-add-medicamento.html (5 IDs + script ~140 linhas) | 40min |
| Edit 41-medicamentos-vazia.html (script ~10 linhas) | 10min |
| Testar manual | 30min |
| Escrever tests/lote-2-meds.js | 60min |
| Rodar tests + corrigir | 60min |
| Commit + push | 5min |
| Deploy + validar prod | 15min |
| Docs update | 10min |
| **Total** | **~5h45min** |

Acima do estimado do mapa (3-4h) — ajuste realista.

## 2.11 Checklist Lote 2

- [ ] Lido lote 2 e PARTE 0 antes de começar
- [ ] 4 edits em `03-medicamentos.html`
- [ ] Script ~250 linhas em `03-medicamentos.html`
- [ ] ~10 IDs em `04-med-detalhe.html`
- [ ] Script ~120 linhas em `04-med-detalhe.html`
- [ ] ~5 IDs em `05-add-medicamento.html`
- [ ] Script ~140 linhas em `05-add-medicamento.html`
- [ ] Script ~10 linhas em `41-medicamentos-vazia.html`
- [ ] `tests/lote-2-meds.js` criado e 14/14 local
- [ ] Commit + push
- [ ] Deploy validado
- [ ] 14/14 prod
- [ ] MAPA + CLAUDE.md updated
- [ ] Bugs novos logados
- [ ] Voltar PARTE 0 → Lote 3

---

# PARTE 3 — Lote 3: Lista de Alergias + CRUD

## 3.1 Resumo Executivo

**Objetivo macro**: tornar a aba Alergias do app v3 100% real. Paciente lista, adiciona, vê detalhe e remove SUAS alergias, com cruzamento farmacológico (CMED).

**Telas afetadas** (4):
- `app-v3/06-alergias.html` (lista — 174 linhas, 8+ hardcodes)
- `app-v3/07-alergia-detalhe.html` (detalhe — 136 linhas, todo hardcoded)
- `app-v3/08-add-alergia.html` (form — 125 linhas, sem hardcode, sem submit real)
- `app-v3/42-alergias-vazia.html` (empty state)

**Funções vitaeAPI usadas**:
- `vitaeAPI.listarAlergias()`
- `vitaeAPI.adicionarAlergia(dados)`
- `vitaeAPI.removerAlergia(id)`
- `vitaeAPI.infoAlergia(nome)` — família farmacológica + sinônimos (CMED)
- `vitaeAPI.listarMedicamentos()` — pra alertar cruzamento

**Endpoints backend**:
- `GET /alergias` → `{ alergias: [{ id, nome, tipo, gravidade, dataDiagnostico, medicoDiagnostico, ... }] }`
- `POST /alergias` → cria
- `DELETE /alergias/:id` → 204
- `GET /alergias/info/:nome` → `{ nome, classe, principioAtivo, sinonimos: [], reacaoCruzada: [], ... }` ou 404

**Tempo estimado**: 2-3h.

**Risco**: baixo. CRUD simples + 1 enriquecimento via CMED.

**Dependências**: Recomendado ter Lote 1 e 2 feitos (helpers reutilizados).

## 3.2 Estado Atual Exato

### 3.2.1 `06-alergias.html` (174 linhas)

| Linha | Trecho | Substituir |
|---|---|---|
| 91 | `3 cadastradas · 2 críticas` | `<span id="alergiasSubtitulo">—</span>` |
| 96-108 | Card Dipirona (critica) hardcoded | container `<div id="criticasContainer">` |
| 110-122 | Card Penicilina (critica) | dentro do mesmo container |
| 127-133 | Card Camarão (leve) | `<div id="levesContainer">` |
| 104-106 | Pills "Novalgina · Magnopyrol · Metamizol" | JS pega de `infoAlergia` |
| 118-120 | Pills "Amoxicilina · Ampicilina · Cefalexina" | idem |

Estrutura nova:

```html
<div class="content">
  <h1 class="page-title anim anim-d1">Minhas <em>alergias</em></h1>
  <div class="page-subtitle anim anim-d1" id="alergiasSubtitulo">—</div>

  <!-- CRÍTICAS -->
  <div class="section-label anim anim-d2" id="lblCriticas" style="color: var(--bad); display:none;">Críticas (anafilaxia possível)</div>
  <div id="criticasContainer"></div>

  <!-- MODERADAS -->
  <div class="section-label anim anim-d3" id="lblModeradas" style="display:none;">Moderadas</div>
  <div id="moderadasContainer"></div>

  <!-- LEVES -->
  <div class="section-label anim anim-d4" id="lblLeves" style="color: var(--ink3); display:none;">Leves</div>
  <div id="levesContainer"></div>

  <!-- INFO LGPD (mantém) -->
  <div class="card tight anim anim-d5">...</div>
</div>
```

### 3.2.2 `07-alergia-detalhe.html` (136 linhas)

Adicionar IDs:
- `<title id="pageTitle">vita id</title>`
- `<h1 class="hero-name" id="alergiaNome">—</h1>`
- `<div class="hero-tipo" id="alergiaTipo">—</div>`
- `<span id="alergiaGravidade"></span>`
- `<div id="alergiaData">—</div>`
- `<div id="alergiaMedico">—</div>`
- `<div id="alergiaLocal">—</div>`
- `<div id="alergiaCruzados" class="pills"></div>` (sinônimos)
- `<div id="alergiaCruzamentoMeds" style="display:none">` (alerta se paciente toma medicamento da mesma classe)
- `<button id="btnDeletar" onclick="confirmarDelete()">`

### 3.2.3 `08-add-alergia.html` (125 linhas)

Adicionar IDs:
- `<input id="inputNome" placeholder="Ex: Dipirona, Camarão...">`
- `<select id="selectGravidade">` ou radio buttons
- `<select id="selectTipo">` (RASH / URTICARIA / ANAFILAXIA / etc)
- `<input id="inputData" type="date">` (opcional)
- `<input id="inputMedico">` (opcional)
- `<button id="btnSalvar" onclick="salvarAlergia()">`

### 3.2.4 `42-alergias-vazia.html`

Script redirect se 1+ alergia.

## 3.3 Plano de Mudanças

### Passo 3.3.1: Edit `06-alergias.html`

```html
<script src="api-real.js"></script>
<script>
// helpers (copy patrão)
function sanitize(s) { ... }
function traduzirErro(e) { ... }
function formatarData(d) { ... }

const FAMILIA_RAPIDA = {
  // mapa offline pra fallback se infoAlergia 404
  'dipirona': ['Novalgina', 'Magnopyrol', 'Metamizol', 'Anador'],
  'penicilina': ['Amoxicilina', 'Ampicilina', 'Benzetacil', 'Cefalexina'],
  'aspirina': ['AAS', 'Aspirinα', 'Ácido acetilsalicílico'],
  'sulfa': ['Sulfametoxazol', 'Bactrim', 'Sulfadiazina'],
  'ibuprofeno': ['Advil', 'Buscopam Composto', 'Alivium'],
  'paracetamol': ['Tylenol', 'Dôrico'],
  'amoxicilina': ['Amoxil', 'Ospamox', 'Amplacilina'],
  'ciprofloxacino': ['Cipro', 'Ciprofloxacina'],
};

async function iniciarTelaAlergias() {
  if (!vitaeAPI.isLoggedIn()) { window.location.href = '23-login.html'; return; }

  try {
    const res = await vitaeAPI.listarAlergias();
    const alergias = (res && res.alergias) || [];

    if (alergias.length === 0) {
      window.location.href = '42-alergias-vazia.html';
      return;
    }

    renderSubtitulo(alergias);
    renderGrupos(alergias);

  } catch (e) {
    mostrarBannerErro(traduzirErro(e));
  }
}

function renderSubtitulo(alergias) {
  const criticas = alergias.filter(a => a.gravidade === 'GRAVE').length;
  const total = alergias.length;
  document.getElementById('alergiasSubtitulo').textContent =
    `${total} cadastrada${total === 1 ? '' : 's'}${criticas ? ` · ${criticas} crítica${criticas === 1 ? '' : 's'}` : ''}`;
}

function renderGrupos(alergias) {
  const grupos = {
    GRAVE: { container: 'criticasContainer', label: 'lblCriticas', list: [] },
    MODERADA: { container: 'moderadasContainer', label: 'lblModeradas', list: [] },
    LEVE: { container: 'levesContainer', label: 'lblLeves', list: [] }
  };

  alergias.forEach(a => {
    const g = grupos[a.gravidade] || grupos.LEVE;
    g.list.push(a);
  });

  Object.entries(grupos).forEach(async ([nivel, info]) => {
    const cont = document.getElementById(info.container);
    const lbl = document.getElementById(info.label);
    if (info.list.length === 0) {
      lbl.style.display = 'none';
      cont.innerHTML = '';
      return;
    }
    lbl.style.display = '';
    cont.innerHTML = info.list.map((a, i) => renderCardSync(a, nivel, i)).join('');

    // Async enrichment (sinônimos) — não bloqueia render
    for (let i = 0; i < info.list.length; i++) {
      const a = info.list[i];
      try {
        const inf = await vitaeAPI.infoAlergia(a.nome);
        if (inf && (inf.sinonimos || inf.reacaoCruzada)) {
          const slot = document.getElementById(`sinonimos-${a.id}`);
          if (slot) {
            const lista = [...(inf.sinonimos || []), ...(inf.reacaoCruzada || [])].slice(0, 4);
            slot.innerHTML = `
              <div class="sev-related-label">${(inf.reacaoCruzada && inf.reacaoCruzada.length) ? 'Evitar também (reação cruzada)' : 'Evitar também'}</div>
              ${lista.map(s => `<span class="sev-mini">${sanitize(s)}</span>`).join('')}
            `;
          }
        }
      } catch {
        // Fallback offline
        const fallback = FAMILIA_RAPIDA[a.nome.toLowerCase()];
        if (fallback) {
          const slot = document.getElementById(`sinonimos-${a.id}`);
          if (slot) slot.innerHTML = `
            <div class="sev-related-label">Evitar também</div>
            ${fallback.map(s => `<span class="sev-mini">${sanitize(s)}</span>`).join('')}
          `;
        }
      }
    }
  });
}

function renderCardSync(a, nivel, idx) {
  const clazz = { GRAVE: 'critica', MODERADA: 'moderada', LEVE: 'leve' }[nivel];
  const badge = { GRAVE: '<span class="badge red"><span class="dot"></span>Alta gravidade</span>',
                  MODERADA: '<span class="badge warn"><span class="dot"></span>Moderada</span>',
                  LEVE: '<span class="badge muted"><span class="dot"></span>Leve</span>' }[nivel];
  const tipoLabel = formatarTipoAlergia(a.tipo);
  const detalhe = [
    tipoLabel,
    a.medicoDiagnostico ? sanitize(a.medicoDiagnostico) : null,
    a.dataDiagnostico ? formatarData(a.dataDiagnostico) : null
  ].filter(Boolean).join(' · ');

  return `
    <div class="severity-card ${clazz} anim anim-d${Math.min(6, 2 + idx)}" onclick="window.location='07-alergia-detalhe.html?id=${encodeURIComponent(a.id)}'">
      <div class="sev-header">
        <div class="sev-name">${sanitize(a.nome)}</div>
        ${badge}
      </div>
      <div class="sev-detail">${detalhe || '—'}</div>
      <div class="sev-related" id="sinonimos-${a.id}">
        <!-- async enrichment -->
      </div>
    </div>
  `;
}

function formatarTipoAlergia(t) {
  const map = { 'RASH': 'Erupção cutânea', 'URTICARIA': 'Urticária', 'ANAFILAXIA': 'Choque anafilático', 'BRONCOSPASMO': 'Broncoespasmo', 'EDEMA': 'Edema laríngeo', 'OUTRO': 'Outro' };
  return map[t] || sanitize(t || 'Outro');
}

window.addEventListener('DOMContentLoaded', iniciarTelaAlergias);
</script>
```

### Passo 3.3.2: Edit `07-alergia-detalhe.html`

```html
<script src="api-real.js"></script>
<script>
let STATE = { alergia: null };

async function iniciarDetalheAlergia() {
  if (!vitaeAPI.isLoggedIn()) { window.location.href = '23-login.html'; return; }

  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    document.getElementById('alergiaNome').textContent = 'Alergia não encontrada';
    return;
  }

  try {
    const res = await vitaeAPI.listarAlergias();
    const alergias = (res && res.alergias) || [];
    const a = alergias.find(x => x.id === id);
    if (!a) {
      document.getElementById('alergiaNome').textContent = 'Essa alergia não está mais na sua lista';
      return;
    }

    STATE.alergia = a;
    document.title = 'vita id - ' + sanitize(a.nome);

    document.getElementById('alergiaNome').textContent = sanitize(a.nome);
    document.getElementById('alergiaTipo').textContent = formatarTipoAlergia(a.tipo);
    document.getElementById('alergiaGravidade').textContent = formatarGravidade(a.gravidade);
    document.getElementById('alergiaData').textContent = formatarData(a.dataDiagnostico);
    document.getElementById('alergiaMedico').textContent = sanitize(a.medicoDiagnostico || '—');
    document.getElementById('alergiaLocal').textContent = sanitize(a.localDiagnostico || '—');

    // Enrichment: sinônimos + cruzamento com meds atuais
    enrichInfo(a);

  } catch (e) {
    mostrarToast('Erro ao carregar alergia', 'erro');
  }
}

async function enrichInfo(a) {
  try {
    const inf = await vitaeAPI.infoAlergia(a.nome);
    const cruzados = [...(inf?.sinonimos || []), ...(inf?.reacaoCruzada || [])];
    if (cruzados.length) {
      document.getElementById('alergiaCruzados').innerHTML = cruzados.map(s => `<span class="pill">${sanitize(s)}</span>`).join('');
    }

    // Verifica se paciente toma algum med dessa classe
    const meds = await vitaeAPI.listarMedicamentos();
    const lista = (meds && meds.medicamentos) || [];
    const cruzadosLower = cruzados.map(c => c.toLowerCase());
    const conflitantes = lista.filter(m => cruzadosLower.some(c => m.nome.toLowerCase().includes(c.toLowerCase())));
    if (conflitantes.length) {
      const box = document.getElementById('alergiaCruzamentoMeds');
      box.style.display = '';
      box.innerHTML = `
        <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:14px;padding:14px 18px;color:#991B1B;">
          <div style="font-weight:800;margin-bottom:6px;font-size:14px;">Atenção: cruzamento ativo</div>
          <div style="font-size:13px;line-height:1.5;">Você toma <strong>${conflitantes.map(m => sanitize(m.nome)).join(', ')}</strong>, que tem relação com esta alergia. Fale com seu médico.</div>
        </div>
      `;
    }
  } catch (e) { /* sem enrichment */ }
}

function formatarGravidade(g) {
  return { 'LEVE': 'Leve', 'MODERADA': 'Moderada', 'GRAVE': 'Alta gravidade' }[g] || '—';
}

async function confirmarDelete() {
  if (!STATE.alergia) return;
  const ok = await modalConfirmar(`Remover ${STATE.alergia.nome}?`, 'Sua segurança em emergência depende dessa info.');
  if (!ok) return;
  try {
    await vitaeAPI.removerAlergia(STATE.alergia.id);
    mostrarToast('Alergia removida', 'sucesso');
    setTimeout(() => window.location.href = '06-alergias.html', 800);
  } catch (e) {
    mostrarToast('Não conseguimos remover. Tente de novo.', 'erro');
  }
}

window.addEventListener('DOMContentLoaded', iniciarDetalheAlergia);
</script>
```

### Passo 3.3.3: Edit `08-add-alergia.html`

```html
<script src="api-real.js"></script>
<script>
let _bloqueado = false;

async function salvarAlergia() {
  if (_bloqueado) return;

  const nome = document.getElementById('inputNome').value.trim();
  if (!nome) {
    mostrarToast('Coloca o nome da alergia', 'erro');
    return;
  }

  const gravidade = document.querySelector('input[name="gravidade"]:checked')?.value || 'MODERADA';
  const tipo = document.getElementById('selectTipo')?.value || 'OUTRO';
  const dataDiag = document.getElementById('inputData')?.value || null;
  const medico = document.getElementById('inputMedico')?.value?.trim() || null;

  const dados = { nome, gravidade, tipo };
  if (dataDiag) dados.dataDiagnostico = dataDiag;
  if (medico) dados.medicoDiagnostico = medico;

  _bloqueado = true;
  const btn = document.getElementById('btnSalvar');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    await vitaeAPI.adicionarAlergia(dados);

    // Cruzamento com meds atuais
    try {
      const inf = await vitaeAPI.infoAlergia(nome);
      const cruzados = [...(inf?.sinonimos || []), ...(inf?.reacaoCruzada || [])];
      if (cruzados.length) {
        const meds = await vitaeAPI.listarMedicamentos();
        const lista = (meds && meds.medicamentos) || [];
        const cruzadosLower = cruzados.map(c => c.toLowerCase());
        const conflitantes = lista.filter(m => cruzadosLower.some(c => m.nome.toLowerCase().includes(c)));
        if (conflitantes.length) {
          // Mostra alerta antes de redirecionar
          await modalAlerta('Atenção: cruzamento ativo', `Você toma ${conflitantes.map(m => m.nome).join(', ')}, que tem relação com ${nome}. Avise seu médico.`);
        }
      }
    } catch { /* ignora */ }

    mostrarToast('Alergia adicionada', 'sucesso');
    setTimeout(() => window.location.href = '06-alergias.html', 1500);
  } catch (e) {
    const msg = (e.message || '').includes('422') ? 'Verifique os campos' : 'Erro ao salvar. Tente de novo.';
    mostrarToast(msg, 'erro');
    _bloqueado = false;
    btn.disabled = false;
    btn.textContent = 'Salvar alergia';
  }
}

function modalAlerta(titulo, descricao) {
  return new Promise(resolve => {
    const m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:center;justify-content:center;';
    m.innerHTML = `<div style="background:#fff;padding:24px;border-radius:18px;max-width:340px;width:88%;font-family:'Plus Jakarta Sans',sans-serif;">
      <div style="font-size:18px;font-weight:800;color:#EF4444;margin-bottom:8px;">${titulo}</div>
      <div style="font-size:13px;color:#6B7280;margin-bottom:18px;line-height:1.5;">${descricao}</div>
      <button id="modalOk" style="width:100%;padding:12px;background:#0D0F14;color:#fff;border:none;border-radius:12px;font:700 14px 'Plus Jakarta Sans',sans-serif;cursor:pointer;">Entendi</button>
    </div>`;
    document.body.appendChild(m);
    m.querySelector('#modalOk').onclick = () => { m.remove(); resolve(); };
  });
}

window.addEventListener('DOMContentLoaded', () => {
  if (!vitaeAPI.isLoggedIn()) { window.location.href = '23-login.html'; return; }
});
</script>
```

### Passo 3.3.4: Edit `42-alergias-vazia.html`

Script redirect se já tem alergias.

## 3.4 Estados a Cobrir

1. Sem login → redirect
2. 0 alergias → redirect 42-vazia
3. 1 GRAVE → aparece em "Críticas"
4. 1 GRAVE + 1 MODERADA + 1 LEVE → 3 grupos
5. Click → detalhe carrega
6. Add via form → POST → cruzamento alertado se houver
7. Add com paciente toma med relacionado → modal alerta
8. Delete via detalhe → modal → DELETE → volta lista
9. Sem rede → banner
10. Sinônimos CMED enrichment (assíncrono, não bloqueia)
11. CMED fora do ar → fallback offline `FAMILIA_RAPIDA`

## 3.5 Playwright Tests

`tests/lote-3-alergias.js`. 12 cenários.

```javascript
// Cenário chave: adicionar Dipirona com paciente tomando Novalgina → alerta
await adicionarMed(page, paciente.token, { nome: 'Novalgina', dosagem: '500mg', frequencia: 'Quando precisar' });
await page.goto(APP_BASE + '/08-add-alergia.html');
await page.fill('#inputNome', 'Dipirona');
await page.check('input[name="gravidade"][value="GRAVE"]');
await page.selectOption('#selectTipo', 'ANAFILAXIA');
await page.click('#btnSalvar');
await page.waitForTimeout(2500);
const alerta = await page.locator('text=cruzamento ativo').count();
step('Cruzamento Dipirona+Novalgina alerta', alerta > 0);
```

## 3.6 Critério de Pronto

- [ ] Grep `Dipirona`, `Penicilina`, `Camarão` em `06-alergias.html` retorna 0
- [ ] Grep `Novalgina · Magnopyrol · Metamizol` retorna 0
- [ ] Grep `Dra. Renata`, `Hospital Albert Einstein` retorna 0
- [ ] Lista renderiza agrupada por gravidade
- [ ] Sinônimos vêm do CMED via async (não bloqueia)
- [ ] Fallback offline funciona quando CMED 404
- [ ] Cruzamento de alergia x med atual mostra alerta
- [ ] Add/delete funcionam
- [ ] 12/12 Playwright local + prod

## 3.7 Deploy

```
feat(app-v3): LOTE 3 — Alergias lista, detalhe, CRUD com cruzamento CMED

- Lista: agrupa por gravidade, sinônimos via infoAlergia async, fallback offline
- Detalhe: id por query, alerta de cruzamento com meds atuais
- Form add: cruzamento detectado dispara modal de alerta antes de salvar
- Telas: 06-alergias.html, 07-alergia-detalhe.html, 08-add-alergia.html, 42-alergias-vazia.html
- Funções vitaeAPI: listarAlergias, adicionarAlergia, removerAlergia, infoAlergia, listarMedicamentos

Tests: Playwright 12/12 passed
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

## 3.8 Rollback

Idêntico aos lotes anteriores. `git revert HEAD`.

## 3.9 Bugs Conhecidos a Evitar

1. **infoAlergia backend pode 404 pra termo genérico** (ex: "Amendoim"). Fallback `FAMILIA_RAPIDA` cobre os mais comuns. Não é completo — ok.
2. **Cruzamento médico**: usa includes() — pode dar falso positivo (ex: "Penicilina" includes em "Amoxicilina" — não tá). Aceitar e melhorar Lote 10.
3. **Modal de alerta pode pular se backend lento**: timeout de 5s nas chamadas de infoAlergia/listarMedicamentos. Se passar, ignora e segue.
4. **Tipo ANAFILAXIA + gravidade LEVE = inconsistente**: deixar paciente cadastrar mesmo assim. Backend não impede. UI não validar — confiar no paciente.
5. **Nome muito longo (>50 chars)**: truncar visualmente com CSS `text-overflow: ellipsis`. NÃO truncar string salva.

## 3.10 Tempo Estimado

| Sub-tarefa | Tempo |
|---|---|
| Leitura | 15min |
| Edit 06-alergias.html | 40min |
| Edit 07-alergia-detalhe.html | 35min |
| Edit 08-add-alergia.html | 35min |
| Edit 42-vazia.html | 10min |
| Test write + run | 75min |
| Deploy + validar | 20min |
| Docs | 10min |
| **Total** | **~4h** |

## 3.11 Checklist Lote 3

- [ ] Reescrever 4 telas
- [ ] 12/12 Playwright local
- [ ] Commit + deploy
- [ ] 12/12 prod
- [ ] MAPA + CLAUDE.md
- [ ] Próximo: Lote 4

---

# PARTE 4 — Lote 4: Lista de Exames + Detalhe com Biomarcadores

## 4.1 Resumo Executivo

**Objetivo macro**: tornar a tela de detalhe de exames (`10-exame-detalhe.html`) 100% real, com biomarcadores (parâmetros) renderizados do backend + classificação NORMAL/ATENÇÃO/CRÍTICO.

**Telas afetadas** (3):
- `app-v3/09-exames-lista.html` (já parcialmente funcional, 1087 linhas — só validar empty state e modo médico)
- `app-v3/10-exame-detalhe.html` (1087 linhas, todo hardcoded)
- `app-v3/43-exames-vazia.html` (empty state)

**Funções vitaeAPI usadas**:
- `vitaeAPI.listarExames()` → `{ exames: [...] }`
- `vitaeAPI.getExame(id)` → exame completo com `parametros[]`, `impactosIA`, `melhoriasIA`
- `vitaeAPI.uploadExame(file, dataExame?)` → upload + Claude OCR + retorna exame com biomarcadores
- `vitaeAPI.deletarExame(id)` → 204
- `vitaeAPI.getPerfilPacienteMedico(pacienteId)` (modo médico)

**Endpoints backend**:
- `GET /exames` → `{ exames: [{ id, tipoExame, dataExame, laboratorio, status, arquivoUrl, resumoIA, statusGeral, ... }] }`
- `GET /exames/:id` → exame + `parametros: [{ nome, valor, unidade, valorReferenciaMin, valorReferenciaMax, status, percentualFaixa, ... }]` + `impactosIA: []` + `melhoriasIA: []`
- `POST /exames/upload` (multipart) → assíncrono, Claude analisa em ~10s
- `DELETE /exames/:id` → 204

**Tempo estimado**: 3-4h.

**Risco**: alto. Biomarcadores têm muita complexidade visual (faixas, cores, scroll).

**Dependências**: nenhum.

## 4.2 Estado Atual

### 4.2.1 `09-exames-lista.html` (1087 linhas)

Já chama `listarExames()`. Funcional. Precisa:
- Validar empty state (`statusGeral.length === 0` → 43-vazia)
- Modo médico (`?pacienteId=X` → `getPerfilPacienteMedico(pacienteId).exames`)
- Click num exame → `10-exame-detalhe.html?id=X`

### 4.2.2 `10-exame-detalhe.html` (1087 linhas)

Hoje hardcoded com biomarcadores demo (Hemoglobina, Glicose etc).

Estrutura a montar:

```
Hero:
  - tipoExame ("Hemograma completo")
  - dataExame (formatado)
  - laboratorio
  - statusGeral (badge colorida)

Resumo IA:
  - texto curto

Biomarcadores (parametros[]):
  - Iterar
  - Para cada: nome, valor + unidade, faixa visual (min ─── max com indicador), status (NORMAL/ALTO/BAIXO/CRITICO), explicação

Impactos:
  - Array {icone, titulo, texto}

Melhorias:
  - Array similar

Ações:
  - Compartilhar (não nesta rodada)
  - Baixar PDF (não nesta rodada)
  - Deletar
```

## 4.3 Plano de Mudanças

### Passo 4.3.1: Edit `09-exames-lista.html` — Validar Estado Vazio

Adicionar no script da página:

```javascript
async function checarEstadoVazio() {
  try {
    const res = await vitaeAPI.listarExames();
    const exames = (res && res.exames) || [];
    if (exames.length === 0) {
      const pacienteIdQS = new URLSearchParams(location.search).get('pacienteId');
      // No modo médico, NÃO redirecionar (médico pode ver "sem exames")
      if (!pacienteIdQS) window.location.href = '43-exames-vazia.html';
    }
  } catch (e) { /* mostra erro normal */ }
}
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(checarEstadoVazio, 500); // espera tela inicial montar
});
```

### Passo 4.3.2: Edit `10-exame-detalhe.html` — Substituir hardcoded por placeholders + JS

Estrutura HTML simplificada (deixar `<style>` como está):

```html
<div class="content" style="background: #0a0d12; min-height: 100vh; color: #fff;">

  <!-- Header com back -->
  <div class="header" style="background: transparent; border: none;">
    <a href="javascript:history.back()" class="header-back" style="background: rgba(255,255,255,0.06);">
      <svg viewBox="0 0 24 24" stroke="#fff" stroke-width="2" fill="none"><polyline points="15 18 9 12 15 6"/></svg>
    </a>
  </div>

  <!-- Hero -->
  <div style="padding: 20px;">
    <div style="font-size: 12px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;" id="exameTipo">—</div>
    <h1 style="font-size: 28px; font-weight: 800; margin: 0 0 8px; color: #fff;" id="exameTitulo">—</h1>
    <div style="display: flex; gap: 10px; font-size: 13px; color: rgba(255,255,255,0.6);">
      <span id="exameData">—</span>
      <span>·</span>
      <span id="exameLab">—</span>
    </div>
    <div style="margin-top: 16px;">
      <span id="exameStatus" style="display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;">—</span>
    </div>
  </div>

  <!-- Resumo IA -->
  <div style="margin: 0 20px 20px; padding: 18px; background: rgba(255,255,255,0.05); border-radius: 16px;">
    <div style="font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 8px;">Resumo</div>
    <div id="exameResumo" style="font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.88);">—</div>
  </div>

  <!-- Biomarcadores -->
  <div style="margin: 0 20px 20px;">
    <div style="font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 14px;">Parâmetros</div>
    <div id="biomarcadoresLista"></div>
  </div>

  <!-- Impactos -->
  <div style="margin: 0 20px 20px;" id="impactosSec" hidden>
    <div style="font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 14px;">O que isso impacta</div>
    <div id="impactosLista"></div>
  </div>

  <!-- Melhorias -->
  <div style="margin: 0 20px 20px;" id="melhoriasSec" hidden>
    <div style="font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 14px;">O que ajuda</div>
    <div id="melhoriasLista"></div>
  </div>

  <!-- Botão deletar -->
  <div style="padding: 30px 20px 80px;">
    <button id="btnDeletar" onclick="confirmarDelete()" style="width: 100%; padding: 14px; background: transparent; color: #EF4444; border: 1px solid rgba(239,68,68,0.3); border-radius: 14px; font: 700 14px 'Plus Jakarta Sans',sans-serif; cursor: pointer;">Remover este exame</button>
  </div>

</div>

<script src="api-real.js"></script>
<script>
let STATE = { exame: null };

async function iniciarDetalheExame() {
  if (!vitaeAPI.isLoggedIn()) { window.location.href = '23-login.html'; return; }

  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    document.getElementById('exameTitulo').textContent = 'Exame não encontrado';
    return;
  }

  try {
    const exame = await vitaeAPI.getExame(id);
    STATE.exame = exame;

    document.title = 'vita id - ' + sanitize(exame.tipoExame || 'Exame');
    document.getElementById('exameTipo').textContent = sanitize((exame.tipoExame || 'exame').toUpperCase());
    document.getElementById('exameTitulo').textContent = formatarTituloExame(exame);
    document.getElementById('exameData').textContent = formatarData(exame.dataExame);
    document.getElementById('exameLab').textContent = sanitize(exame.laboratorio || 'Laboratório não informado');

    renderStatusGeral(exame.statusGeral);
    document.getElementById('exameResumo').textContent = sanitize(exame.resumoIA || 'Resumo sendo gerado...');

    renderBiomarcadores(exame.parametros || []);
    renderImpactos(exame.impactosIA || []);
    renderMelhorias(exame.melhoriasIA || []);

  } catch (e) {
    if (e.message && e.message.includes('404')) {
      document.getElementById('exameTitulo').textContent = 'Este exame não está mais disponível';
    } else {
      document.getElementById('exameTitulo').textContent = 'Erro ao carregar';
    }
  }
}

function formatarTituloExame(e) {
  const n = e.tipoExame || e.nomeArquivo || 'Exame';
  return sanitize(n.replace(/\.(pdf|jpg|jpeg|png|webp)$/i, ''));
}

function renderStatusGeral(status) {
  const el = document.getElementById('exameStatus');
  if (!status) {
    el.textContent = 'Processando';
    el.style.background = 'rgba(245,158,11,0.15)';
    el.style.color = '#F59E0B';
    return;
  }
  const map = {
    'NORMAL': { txt: 'Normal', bg: 'rgba(0,196,122,0.15)', cor: '#00C47A' },
    'ATENCAO': { txt: 'Atenção', bg: 'rgba(245,158,11,0.15)', cor: '#F59E0B' },
    'CRITICO': { txt: 'Crítico', bg: 'rgba(239,68,68,0.15)', cor: '#EF4444' }
  };
  const m = map[status] || { txt: status, bg: 'rgba(255,255,255,0.1)', cor: '#fff' };
  el.textContent = m.txt;
  el.style.background = m.bg;
  el.style.color = m.cor;
}

function renderBiomarcadores(params) {
  const cont = document.getElementById('biomarcadoresLista');
  if (params.length === 0) {
    cont.innerHTML = `<div style="padding: 30px; text-align: center; color: rgba(255,255,255,0.4); font-size: 13px;">Sem parâmetros disponíveis. O exame pode ainda estar sendo processado.</div>`;
    return;
  }

  cont.innerHTML = params.map(p => {
    const status = p.status || 'NORMAL';
    const cor = corStatus(status);
    const min = p.valorReferenciaMin != null ? Number(p.valorReferenciaMin) : null;
    const max = p.valorReferenciaMax != null ? Number(p.valorReferenciaMax) : null;
    const val = Number(p.valor);

    let posicao = 50;
    if (min != null && max != null && !isNaN(val)) {
      if (val <= min) posicao = 5;
      else if (val >= max) posicao = 95;
      else posicao = 5 + ((val - min) / (max - min)) * 90;
    }

    return `
      <div style="background: rgba(255,255,255,0.04); border-radius: 14px; padding: 16px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
          <div style="font-size: 15px; font-weight: 700; color: #fff;">${sanitize(p.nome)}</div>
          <div style="text-align: right;">
            <span style="font-size: 18px; font-weight: 800; color: ${cor};">${sanitize(p.valor)}</span>
            ${p.unidade ? `<span style="font-size: 11px; color: rgba(255,255,255,0.4); margin-left: 3px;">${sanitize(p.unidade)}</span>` : ''}
          </div>
        </div>

        ${min != null && max != null ? `
          <div style="position: relative; height: 22px; margin: 8px 0;">
            <div style="position: absolute; top: 50%; left: 0; right: 0; height: 3px; background: linear-gradient(to right, ${corStatus('CRITICO')} 0%, ${corStatus('NORMAL')} 30%, ${corStatus('NORMAL')} 70%, ${corStatus('CRITICO')} 100%); border-radius: 2px; transform: translateY(-50%); opacity: 0.7;"></div>
            <div style="position: absolute; top: 50%; left: ${posicao}%; transform: translate(-50%, -50%); width: 14px; height: 14px; border-radius: 50%; background: ${cor}; border: 2px solid #0a0d12; box-shadow: 0 0 0 1px ${cor};"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: rgba(255,255,255,0.4);">
            <span>${min}</span>
            <span>${max}</span>
          </div>
        ` : ''}

        <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 8px;">${formatarStatusParametro(status)}</div>
      </div>
    `;
  }).join('');
}

function corStatus(s) {
  return ({ NORMAL: '#00C47A', ALTO: '#F59E0B', BAIXO: '#F59E0B', ATENCAO: '#F59E0B', CRITICO: '#EF4444' })[s] || '#fff';
}

function formatarStatusParametro(s) {
  return ({ NORMAL: 'Dentro da faixa esperada', ALTO: 'Acima da faixa', BAIXO: 'Abaixo da faixa', ATENCAO: 'Requer atenção', CRITICO: 'Valor crítico — fale com seu médico' })[s] || s;
}

function renderImpactos(impactos) {
  if (impactos.length === 0) return;
  document.getElementById('impactosSec').hidden = false;
  document.getElementById('impactosLista').innerHTML = impactos.map(i => `
    <div style="background: rgba(255,255,255,0.04); border-radius: 14px; padding: 14px 16px; margin-bottom: 8px;">
      <div style="font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 4px;">${sanitize(i.titulo)}</div>
      <div style="font-size: 12px; line-height: 1.5; color: rgba(255,255,255,0.6);">${sanitize(i.texto)}</div>
    </div>
  `).join('');
}

function renderMelhorias(melhorias) {
  if (melhorias.length === 0) return;
  document.getElementById('melhoriasSec').hidden = false;
  document.getElementById('melhoriasLista').innerHTML = melhorias.map(m => `
    <div style="background: rgba(0,229,160,0.06); border: 1px solid rgba(0,229,160,0.2); border-radius: 14px; padding: 14px 16px; margin-bottom: 8px;">
      <div style="font-size: 14px; font-weight: 700; color: #00E5A0; margin-bottom: 4px;">${sanitize(m.titulo)}</div>
      <div style="font-size: 12px; line-height: 1.5; color: rgba(255,255,255,0.7);">${sanitize(m.texto)}</div>
    </div>
  `).join('');
}

async function confirmarDelete() {
  if (!STATE.exame) return;
  const ok = await modalConfirmar(`Remover ${STATE.exame.tipoExame || 'este exame'}?`, 'Os dados ficam apagados pra sempre.');
  if (!ok) return;
  try {
    await vitaeAPI.deletarExame(STATE.exame.id);
    mostrarToast('Exame removido', 'sucesso');
    setTimeout(() => window.location.href = '09-exames-lista.html', 800);
  } catch (e) {
    mostrarToast('Não conseguimos remover. Tente de novo.', 'erro');
  }
}

window.addEventListener('DOMContentLoaded', iniciarDetalheExame);
</script>
```

### Passo 4.3.3: Edit `43-exames-vazia.html`

Script redirect se já tem exames.

## 4.4 Estados a Cobrir

1. Sem login → redirect
2. Exame em status PROCESSANDO → mostra "Resumo sendo gerado..." + status amarelo
3. Exame com 5+ parâmetros → todos renderizados com faixa visual
4. Exame com parâmetro CRITICO → cor vermelha + texto "Valor crítico"
5. Exame com parâmetro sem `valorReferenciaMin/Max` → faixa visual some, só valor
6. Impactos + melhorias presentes → seções aparecem
7. Sem impactos → seção some
8. Upload novo exame → after ~10s exame aparece com parâmetros (testar via API direto)
9. Deletar → modal → DELETE → volta lista
10. ID inválido na query → mostra "exame não disponível"
11. Modo médico (`?pacienteId=X`) → carrega exames do paciente (Lote 5 cobre, mas testar)

## 4.5 Playwright Tests

`tests/lote-4-exames.js`. 12 cenários. Upload de exame requer arquivo binário — usar fixture pequeno PDF.

```javascript
// Upload de fixture
const fs = require('fs');
const pdfPath = path.join(__dirname, 'fixtures', 'exame-teste.pdf');
if (!fs.existsSync(pdfPath)) {
  // Não tem fixture, pula upload
  step('Upload requer fixture PDF', false, 'crie tests/fixtures/exame-teste.pdf manualmente');
}
// Ou usar input file:
const fileInput = await page.locator('input[type="file"]').first();
await fileInput.setInputFiles(pdfPath);
await page.waitForTimeout(15000); // espera Claude analisar
```

## 4.6 Critério de Pronto

- [ ] Grep `Hemoglobina` em `10-exame-detalhe.html` retorna 0 (a menos que venha do backend)
- [ ] Detalhe carrega parâmetros reais do exame
- [ ] Faixa visual renderiza com indicador na posição correta
- [ ] Status cores: verde NORMAL, amarelo ATENCAO, vermelho CRITICO
- [ ] Upload novo exame funciona ponta a ponta (paciente upload → ver biomarcadores)
- [ ] Delete funciona
- [ ] Empty state 43-vazia redirect quando 0 exames
- [ ] 12/12 Playwright local + prod

## 4.7 Deploy

```
feat(app-v3): LOTE 4 — Exames detalhe com biomarcadores reais

- Detalhe (10-exame-detalhe): tema escuro, biomarcadores com faixa visual + status colorido
- Lista (09-exames-lista): empty state redirect + modo médico
- Impactos + Melhorias renderizados quando presentes
- Telas: 09-exames-lista.html, 10-exame-detalhe.html, 43-exames-vazia.html
- Funções vitaeAPI: listarExames, getExame, uploadExame, deletarExame, getPerfilPacienteMedico

Tests: Playwright 12/12 passed
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

## 4.8 Rollback

`git revert HEAD`. App antigo (raiz) tem versão dele de exames intocada.

## 4.9 Bugs Conhecidos

1. **Upload demora 10-20s**: paciente vê processando. NÃO bloquear UI. Mostrar "Analisando seu exame..."
2. **`statusGeral` pode ser null se exame falhou**: tratar como "Processando" amarelo.
3. **`parametros` pode ser array vazio mesmo após análise**: mostrar "Sem parâmetros disponíveis"
4. **Faixa visual pode quebrar se min>max** (raro): proteger com check `min < max`.
5. **Valores não-numéricos** (ex: "Negativo"): renderizar sem faixa, só valor.
6. **Anthropic 429**: timeout → mostrar "Estamos com fila — tente em alguns minutos".
7. **Modo médico**: deve mostrar com texto pequeno "Dados de: [Nome paciente]" no topo.
8. **PDF preview**: app já tem `renderPdfThumb()`. Reutilizar.
9. **Exame com mais de 30 parâmetros**: scroll vertical OK. Não paginar.
10. **Tema escuro força em `10`**: cuidado pra não mexer no light de `09`. CSS isolado por `<style scoped>` mental.

## 4.10 Tempo

| Sub | Tempo |
|---|---|
| Leitura 09, 10 (extensos) | 30min |
| Edit 09 (script empty) | 15min |
| Edit 10 (reescrever conteúdo, ~400 linhas) | 90min |
| Edit 43 | 10min |
| Tests | 90min |
| Deploy + validar | 25min |
| **Total** | **~4h 30min** |

## 4.11 Checklist

- [ ] 09, 10, 43 reescritas
- [ ] 12/12 Playwright local + prod
- [ ] Deploy + docs
- [ ] Próximo: Lote 5

---

# PARTE 5 — Lote 5: Aba Consultas

## 5.1 Resumo Executivo

**Objetivo macro**: tornar a tela de Consultas 100% real. Paciente vê pré-consultas pendentes em destaque, próximo agendamento, e histórico clínico. Sem hardcoded.

**Telas afetadas** (3):
- `app-v3/15-consultas.html` (lista — 390 linhas, 10+ hardcodes)
- `app-v3/16-consulta-detalhe.html` (detalhe — 404 linhas, todo hardcoded)
- `app-v3/44-consultas-vazia.html` (empty state)

**Funções vitaeAPI usadas**:
- `vitaeAPI.listarAgendamentos()` → `{ agendamentos: [{ id, data, hora, medicoNome, especialidade, crm, local, status, ... }] }`
- `vitaeAPI.getProximoAgendamento()` → `{ agendamento }` ou null
- `vitaeAPI.listarPreConsultas()` → `{ preConsultas: [{ id, token, medicoNome, status, dataLimite, ... }] }` (paciente vê SUAS pré-consultas)
- `vitaeAPI.atualizarAgendamento(id, dados)` (não nesta rodada — só GET)

**Endpoints backend**:
- `GET /agendamento` → lista
- `GET /agendamento/proximo` → próximo
- `GET /pre-consulta` → lista do paciente logado (pendentes + respondidas)

**Tempo estimado**: 2-3h.

**Risco**: médio. Mistura de agendamentos + pré-consultas no histórico precisa de sort + dedupe.

**Dependências**: Lote 1 (greeting consistente).

## 5.2 Estado Atual

### 5.2.1 `15-consultas.html` (390 linhas)

Hardcodes:

| Linha | Trecho |
|---|---|
| 289 | `Olá, Lucas` |
| 290 | `Suas <em>consultas</em>` (manter, é título) |
| 303 | `Pré-consulta da Dra. Renata Cardoso` |
| 304 | `Responda 4 perguntas antes de quarta-feira. Tempo médio: 3 minutos.` |
| 317 | `<div class="next-avatar">RC</div>` |
| 319 | `Dra. Renata Cardoso` |
| 320 | `Cardiologia · CRM-SP 145.232` |
| 325 | `Quarta, 21 de maio · 14h30` |
| 331 | `Clínica Vitae · Itaim` |
| 333 | `EM 7 DIAS` |
| 343, 352, 361 | 3 cards históricos (RC, BL, MF) |

### 5.2.2 `16-consulta-detalhe.html` (404 linhas)

Todo hardcoded. Estrutura a montar dinâmica:
- Hero: nome médico, especialidade, CRM
- Data + hora + local
- Documentos relacionados (exames, receitas — opcional)
- Resumo (se foi pré-consulta respondida)
- Botão "Ver receita" / "Ver exames"

### 5.2.3 `44-consultas-vazia.html`

OK, deixa como está. Adicionar script.

## 5.3 Plano de Mudanças

### Passo 5.3.1: Edit `15-consultas.html`

Substituir tudo entre `<div class="content">` e `</div>` (fim de content) por placeholders + container. Estrutura:

```html
<div class="content" style="top: 50px; background: #F4F6FA;">
  <div class="ph anim anim-d1">
    <div>
      <div class="ph-greeting" id="greetingConsultas">Olá,</div>
      <div class="ph-title">Suas <em>consultas</em></div>
    </div>
    <button class="ph-action" aria-label="Buscar">
      <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    </button>
  </div>

  <!-- Pré-consulta pendente (insight-card amarelo) -->
  <div id="preConsultaPendente" style="display:none;"></div>

  <!-- Próxima consulta -->
  <div class="section-lbl anim anim-d3" id="lblProxima" style="display:none;">Próxima consulta</div>
  <div id="proximaContainer" style="display:none;"></div>

  <!-- Histórico -->
  <div class="section-lbl anim anim-d4" id="lblHistorico" style="display:none;">Histórico clínico</div>
  <div id="historicoContainer"></div>

  <div style="height: 100px"></div>
</div>
```

JS:

```html
<script src="api-real.js"></script>
<script>
function sanitize(s) { return s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function formatarDataExtensa(d) {
  if (!d) return '—';
  const x = new Date(d);
  if (isNaN(x.getTime())) return '—';
  return x.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}
function formatarHora(h) { return h || '—'; }
function diasAte(d) {
  if (!d) return null;
  const x = new Date(d);
  const hoje = new Date();
  const ms = x - hoje;
  return Math.ceil(ms / 86400000);
}
function iniciais(nome) {
  if (!nome) return '?';
  return nome.split(' ').filter(p => p.length > 2 || p.toUpperCase() !== p).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

async function iniciarConsultas() {
  if (!vitaeAPI.isLoggedIn()) { window.location.href = '23-login.html'; return; }

  const u = vitaeAPI.getUsuario();
  if (u && u.nome) {
    document.getElementById('greetingConsultas').textContent = 'Olá, ' + u.nome.split(' ')[0];
  }

  const [agRes, preRes] = await Promise.all([
    vitaeAPI.listarAgendamentos().catch(() => ({ agendamentos: [] })),
    vitaeAPI.listarPreConsultas().catch(() => ({ preConsultas: [] }))
  ]);

  const agendamentos = (agRes && agRes.agendamentos) || [];
  const preConsultas = (preRes && preRes.preConsultas) || [];

  // Empty state
  if (agendamentos.length === 0 && preConsultas.length === 0) {
    window.location.href = '44-consultas-vazia.html';
    return;
  }

  // Pré-consulta pendente
  const pendentes = preConsultas.filter(p => p.status === 'ABERTO' || p.status === 'PENDENTE' || !p.respondidaEm);
  if (pendentes.length) renderPendente(pendentes[0]);

  // Próximo agendamento
  const futuros = agendamentos.filter(a => new Date(a.data) > new Date());
  if (futuros.length) {
    futuros.sort((a, b) => new Date(a.data) - new Date(b.data));
    renderProxima(futuros[0]);
  }

  // Histórico (passados + pré-consultas respondidas)
  const passados = agendamentos.filter(a => new Date(a.data) <= new Date());
  const preRespondidas = preConsultas.filter(p => p.respondidaEm);
  const historico = [
    ...passados.map(a => ({ tipo: 'agendamento', ...a, ord: new Date(a.data) })),
    ...preRespondidas.map(p => ({ tipo: 'pre-consulta', ...p, ord: new Date(p.respondidaEm) }))
  ].sort((a, b) => b.ord - a.ord);

  renderHistorico(historico);
}

function renderPendente(p) {
  const cont = document.getElementById('preConsultaPendente');
  cont.style.display = '';
  const dataLimite = p.dataLimite ? formatarDataExtensa(p.dataLimite) : 'em breve';
  cont.innerHTML = `
    <div class="insight anim anim-d2" onclick="window.location='pre-consulta.html?token=${encodeURIComponent(p.token)}'">
      <div class="insight-ic">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <div class="insight-body">
        <div class="insight-title">Pré-consulta ${p.medicoNome ? 'da ' + sanitize(p.medicoNome) : 'pendente'}</div>
        <div class="insight-msg">Responda antes de ${dataLimite}. Tempo médio: 3 minutos.</div>
        <div class="insight-action">
          Iniciar agora
          <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </div>
      </div>
    </div>
  `;
}

function renderProxima(a) {
  document.getElementById('lblProxima').style.display = '';
  const cont = document.getElementById('proximaContainer');
  cont.style.display = '';
  const dias = diasAte(a.data);
  const countdown = dias <= 0 ? 'HOJE' : dias === 1 ? 'AMANHÃ' : `EM ${dias} DIAS`;
  cont.innerHTML = `
    <div class="next anim anim-d3" onclick="window.location='16-consulta-detalhe.html?id=${encodeURIComponent(a.id)}&tipo=agendamento'">
      <div class="next-top">
        <div class="next-doctor-row" style="margin-top: 4px;">
          <div class="next-avatar">${iniciais(a.medicoNome)}</div>
          <div class="next-doctor">
            <div class="next-doctor-name">${sanitize(a.medicoNome || 'Médico')}</div>
            <div class="next-doctor-spec">${sanitize(a.especialidade || 'Consulta')}${a.crm ? ' · CRM-' + sanitize(a.estado || 'SP') + ' ' + sanitize(a.crm) : ''}</div>
          </div>
        </div>
        <div class="next-datebadge">
          <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${formatarDataExtensa(a.data)}${a.hora ? ' · ' + sanitize(a.hora) : ''}
        </div>
      </div>
      <div class="next-bot">
        <div class="next-loc">
          <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${sanitize(a.local || 'Local a confirmar')}
        </div>
        <span class="next-cd">${countdown}</span>
      </div>
    </div>
  `;
}

function renderHistorico(items) {
  if (items.length === 0) return;
  document.getElementById('lblHistorico').style.display = '';
  document.getElementById('historicoContainer').innerHTML = items.map((it, i) => {
    const isAg = it.tipo === 'agendamento';
    const nome = isAg ? it.medicoNome : it.medicoNome;
    const meta = isAg ?
      `${sanitize(it.especialidade || 'Consulta')} · ${formatarDataExtensa(it.data)}` :
      `Pré-consulta · ${formatarDataExtensa(it.respondidaEm)}`;
    const url = isAg ?
      `16-consulta-detalhe.html?id=${encodeURIComponent(it.id)}&tipo=agendamento` :
      `16-consulta-detalhe.html?id=${encodeURIComponent(it.id)}&tipo=pre-consulta`;
    return `
      <div class="h-card anim anim-d${Math.min(6, 4 + i)}" onclick="window.location='${url}'">
        <div class="h-av">${iniciais(nome)}</div>
        <div class="h-body">
          <div class="h-name">${sanitize(nome || '—')}</div>
          <div class="h-meta">${meta}</div>
        </div>
        <div class="h-chev"><svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></div>
      </div>
    `;
  }).join('');
}

window.addEventListener('DOMContentLoaded', iniciarConsultas);
</script>
```

### Passo 5.3.2: Edit `16-consulta-detalhe.html`

Receber `?id=X&tipo=agendamento|pre-consulta`.

```html
<script src="api-real.js"></script>
<script>
let STATE = { item: null, tipo: null };

async function iniciarDetalheConsulta() {
  if (!vitaeAPI.isLoggedIn()) { window.location.href = '23-login.html'; return; }

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const tipo = params.get('tipo') || 'agendamento';
  STATE.tipo = tipo;

  if (!id) {
    document.getElementById('detalheTitulo').textContent = 'Consulta não encontrada';
    return;
  }

  try {
    if (tipo === 'agendamento') {
      const res = await vitaeAPI.listarAgendamentos();
      const ag = ((res && res.agendamentos) || []).find(a => a.id === id);
      if (!ag) { mostrarNaoEncontrado(); return; }
      STATE.item = ag;
      renderAgendamento(ag);
    } else {
      const res = await vitaeAPI.listarPreConsultas();
      const pc = ((res && res.preConsultas) || []).find(p => p.id === id);
      if (!pc) { mostrarNaoEncontrado(); return; }
      STATE.item = pc;
      renderPreConsulta(pc);
    }
  } catch (e) {
    document.getElementById('detalheTitulo').textContent = 'Erro ao carregar';
  }
}

function mostrarNaoEncontrado() {
  document.getElementById('detalheTitulo').textContent = 'Consulta não disponível';
}

function renderAgendamento(a) {
  document.getElementById('docNome').textContent = sanitize(a.medicoNome || '—');
  document.getElementById('docEspec').textContent = sanitize(a.especialidade || 'Consulta');
  document.getElementById('detData').textContent = formatarDataExtensa(a.data);
  document.getElementById('detHora').textContent = a.hora || '—';
  document.getElementById('detLocal').textContent = sanitize(a.local || 'Local a confirmar');
  document.getElementById('detEndereco').textContent = sanitize(a.endereco || '');
  // Documentos: por enquanto, mostrar exames do paciente que sejam próximos da data
  carregarDocumentosRelacionados(a.data);
}

async function carregarDocumentosRelacionados(dataConsulta) {
  try {
    const res = await vitaeAPI.listarExames();
    const exames = (res && res.exames) || [];
    const docs = exames.filter(e => {
      const diff = Math.abs(new Date(e.dataExame) - new Date(dataConsulta));
      return diff < 30 * 86400000; // 30 dias
    }).slice(0, 5);

    const cont = document.getElementById('docsContainer');
    if (docs.length === 0) {
      cont.innerHTML = `<div style="padding:14px;color:var(--ink3);font-size:13px;">Nenhum documento relacionado.</div>`;
      return;
    }
    cont.innerHTML = docs.map(d => `
      <div class="doc-row" onclick="window.location='10-exame-detalhe.html?id=${encodeURIComponent(d.id)}'">
        <div class="doc-icon"><svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
        <div>
          <div style="font-weight:700;font-size:14px;">${sanitize(d.tipoExame || 'Exame')}</div>
          <div style="font-size:12px;color:var(--ink3);">${formatarData(d.dataExame)}</div>
        </div>
      </div>
    `).join('');
  } catch (e) { /* ignora */ }
}

function renderPreConsulta(p) {
  document.getElementById('docNome').textContent = sanitize(p.medicoNome || '—');
  document.getElementById('docEspec').textContent = 'Pré-consulta respondida';
  document.getElementById('detData').textContent = formatarDataExtensa(p.respondidaEm);
  if (p.resumoTexto) {
    const r = document.getElementById('resumoContainer');
    r.style.display = '';
    r.innerHTML = `
      <div class="section-lbl">Resumo</div>
      <div style="padding:14px;background:#fff;border-radius:14px;font-size:13px;line-height:1.6;">${sanitize(p.resumoTexto)}</div>
    `;
  }
  if (p.audioUrl) {
    const a = document.getElementById('audioContainer');
    a.style.display = '';
    a.innerHTML = `
      <div class="section-lbl">Áudio</div>
      <audio controls style="width:100%;">
        <source src="${sanitize(p.audioUrl)}" type="audio/webm">
      </audio>
    `;
  }
}

window.addEventListener('DOMContentLoaded', iniciarDetalheConsulta);
</script>
```

E adicionar IDs no HTML estático (`docNome`, `docEspec`, `detData`, `detHora`, `detLocal`, `detEndereco`, `docsContainer`, `resumoContainer`, `audioContainer`).

### Passo 5.3.3: Edit `44-consultas-vazia.html`

Script padrão.

## 5.4 Estados a Cobrir

1. Sem login → redirect
2. 0 agendamentos + 0 pré-consultas → 44-vazia
3. 1 pré-consulta PENDENTE → destaque amarelo no topo
4. 1 agendamento futuro → próxima consulta card
5. 2+ agendamentos passados → histórico desc
6. 2+ pré-consultas respondidas → entram no histórico
7. Mistura: 1 pendente + 1 próximo + 5 passados → render correto
8. Click próxima → 16-consulta-detalhe?tipo=agendamento
9. Click pendente → pre-consulta.html?token=X
10. Click histórico → 16 com tipo certo

## 5.5 Playwright Tests

12 cenários. Setup via API direto (criar agendamentos via backend).

## 5.6 Critério de Pronto

- [ ] Grep `Olá, Lucas`, `Dra. Renata Cardoso`, `CRM-SP 145.232`, `Quarta, 21 de maio` retorna 0
- [ ] Greeting personalizado
- [ ] Pré-consulta pendente destacada
- [ ] Próxima consulta com countdown dinâmico
- [ ] Histórico com agendamentos + pré-consultas
- [ ] Detalhe carrega correto por tipo
- [ ] 12/12 Playwright

## 5.7 Deploy

```
feat(app-v3): LOTE 5 — Consultas com agendamentos + pré-consultas

- 15-consultas: greeting real, pendente, próxima, histórico
- 16-consulta-detalhe: id+tipo por query, documentos relacionados
- 44-vazia: redirect se já tem consultas
- Funções: listarAgendamentos, listarPreConsultas, getProximoAgendamento

Tests: 12/12
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

## 5.8 Rollback

Padrão.

## 5.9 Bugs Conhecidos

1. **Backend pode não ter `listarPreConsultas` exposta pra paciente** (era só pra médico). VERIFICAR. Se não existe, criar endpoint OU listar via outra rota (preconsulta-paciente). Logar bug se confirmado.
2. **Agendamento sem hora** (campo null): mostrar "—".
3. **medicoNome pode ser null em pré-consulta antiga**: fallback "Médico".
4. **Token de pré-consulta pode expirar**: backend retorna 404. Tratar.
5. **CRM + estado**: pode vir como "12345/SP" ou separado. Backend retorna separado.
6. **Especialidade pode ser livre** (string sem categoria): aceitar.
7. **Click pre-consulta.html abre fora do app v3**: confirmar fluxo (mesmo origem). Já é caso testado.
8. **Histórico longo**: limitar primeiros 20. Botão "Ver mais" pra Lote 10.
9. **Agendamento "passado" mas sem hora**: comparar só por data (ignora hora). Aceitar imprecisão.
10. **Pré-consulta com `respondidaEm: null` mas `respostas[]` cheia**: backend bug? Tratar como respondida se respostas.length > 0.

## 5.10 Tempo

| Sub | Tempo |
|---|---|
| Leitura 15, 16 | 20min |
| Edit 15 | 60min |
| Edit 16 | 50min |
| Edit 44 | 10min |
| Tests | 75min |
| Deploy | 15min |
| Docs | 10min |
| **Total** | **~4h** |

## 5.11 Checklist

- [ ] 3 telas reescritas
- [ ] Endpoint `listarPreConsultas` verificado
- [ ] 12/12 Playwright local + prod
- [ ] Deploy + docs
- [ ] Próximo: Lote 6

---

# PARTE 6 — Lote 6: QR + RG Público

## 6.1 Resumo Executivo

**Objetivo**: paciente gera seu QR Code do RG da Saúde. Qualquer pessoa que escaneie vê dados de emergência sem precisar logar.

**Telas** (2):
- `app-v3/12-qr-code.html` (já funcional — apenas validar)
- `app-v3/14-rg-publico.html` (verificar JS — pode estar funcional ou hardcoded)

**Funções vitaeAPI**:
- `vitaeAPI.getQrData()` (autenticado)
- `fetch /autorizacao/rg-publico/:userId` (público, sem JWT)

**Tempo**: 2h. **Risco**: baixo. **Dependências**: Nenhum.

## 6.2 Estado Atual

`12-qr-code.html`: já chama `getQrData()`. Validar:
- WhatsApp share inclui link real `{origin}/app-v3/14-rg-publico.html?id={userId}`
- QR gerado aponta pra essa URL
- Fallback se backend offline

`14-rg-publico.html`: 546 linhas. Pelo grep, é dinâmico (`fetch` direto). Validar:
- Recebe `?id=X` da query
- Fetch `/autorizacao/rg-publico/X` retorna dados
- Renderiza nome, alergias, meds, exames, contato emergência
- Sem dados hardcoded
- Carrega em <3s

## 6.3 Plano de Mudanças

### Passo 6.3.1: Verificar `12-qr-code.html`

```javascript
// Conferir que getQrData() retorna { url, userId, pin }
// E que url é "{origin}/app-v3/14-rg-publico.html?id={userId}"
// Se não, ajustar:
async function gerarQR() {
  const data = await vitaeAPI.getQrData();
  const urlBase = window.location.origin + '/app-v3/14-rg-publico.html?id=' + data.userId;
  // Render QR com urlBase
  // ...
}
```

### Passo 6.3.2: Verificar `14-rg-publico.html`

Ler JS completo e confirmar:
- `const id = new URLSearchParams(location.search).get('id');`
- `fetch(${BACKEND}/autorizacao/rg-publico/${id})` (sem JWT)
- Render do retorno

Adicionar fallbacks:
- Sem `?id` → tela "QR inválido"
- Backend 404 → tela "Esse RG não existe ou foi removido"
- Backend 410 (Gone) → "Esse compartilhamento expirou"
- Backend offline → "Sem conexão"

### Passo 6.3.3: Adicionar banner aviso "Você está vendo o RG de X"

No topo de `14-rg-publico.html`:

```html
<div class="banner-publico" style="background: #00E5A0; color: #0D0F14; padding: 12px 20px; text-align: center; font: 600 12px 'Plus Jakarta Sans',sans-serif;">
  <span id="bannerNome">Carregando...</span>
</div>
```

JS: após fetch, `document.getElementById('bannerNome').textContent = 'Você está vendo o RG da Saúde de ' + sanitize(usuario.nome)`

### Passo 6.3.4: Confirmar app antigo `exame-publico.html` ainda funciona

Click em "Ver exame" no 14-rg-publico aponta pra `exame-publico.html?user=X&exam=Y` (raiz). Validar que essa página ainda responde — NÃO MEXER NELA.

## 6.4 Estados a Cobrir

1. Paciente logado abre 12-qr → QR aparece
2. Outro celular escaneia → 14-rg-publico carrega
3. Sem `?id` → tela erro
4. ID inexistente → erro 404
5. Compartilhamento revogado → 410
6. Dados: nome, alergias críticas, meds, contato emerg
7. Exames recentes com thumbnail
8. Histórico familiar (opcional)
9. GLP-1 alerta (Ozempic/Mounjaro) → warning anestesia
10. Acessibilidade flags

## 6.5 Playwright Tests

`tests/lote-6-qr.js`. 8 cenários.

```javascript
// Cenário chave: paciente cheio gera QR → outro browser context escaneia URL
const paciente = await criarPaciente(page, 'lote6-qr');
await preencherPerfil(...); await adicionarAlergia(...); await adicionarMed(...);

// Pega URL do QR
await page.goto(APP_BASE + '/12-qr-code.html');
await page.waitForTimeout(3000);
const qrUrl = await page.evaluate(() => window.STATE?.qrUrl || document.querySelector('img.qr-img')?.src);
step('QR gerado tem URL', !!qrUrl);

// Abre noutro context sem auth
const ctx2 = await browser.newContext({ viewport: { width: 500, height: 950 } });
const page2 = await ctx2.newPage();
const urlPublica = APP_BASE + '/14-rg-publico.html?id=' + paciente.usuario.id;
await page2.goto(urlPublica);
await page2.waitForTimeout(3000);

const nomeVisivel = await page2.locator(`text=${paciente.nome.split(' ')[0]}`).count();
step('Outro celular vê nome', nomeVisivel > 0);

const alergiaVisivel = await page2.locator('text=Dipirona').count();
step('Alergia visível', alergiaVisivel > 0);
```

## 6.6 Critério de Pronto

- [ ] 12-qr-code gera QR com URL do origin
- [ ] WhatsApp share text inclui nome real
- [ ] 14-rg-publico carrega dados de qualquer paciente via `?id=`
- [ ] Banner topo mostra "Vendo RG de [Nome]"
- [ ] Alergias críticas em destaque vermelho
- [ ] Meds em uso visível
- [ ] Exames recentes com thumbnail
- [ ] 8/8 Playwright

## 6.7 Deploy + 6.8 Rollback

Padrão.

## 6.9 Bugs Conhecidos

1. **CORS no fetch direto pro Railway**: pode bloquear se origin não no whitelist. Backend já permite Vercel; testar local.
2. **PDF thumbnail demora**: Pdf.js lazy. Mostrar placeholder.
3. **userId UUID muito longo na URL**: aceitar.
4. **Banner com cor de fundo verde + texto preto**: contraste OK.
5. **Versão mobile**: nome do paciente quebra linha. CSS `white-space: nowrap` + `overflow: hidden; text-overflow: ellipsis`.

## 6.10 Tempo

| Sub | Tempo |
|---|---|
| Leitura | 25min |
| Verificar 12 + ajustar | 30min |
| Verificar 14 + ajustar + banner | 60min |
| Tests | 45min |
| Deploy + docs | 20min |
| **Total** | **~3h** |

## 6.11 Checklist

- [ ] 12 e 14 validados/ajustados
- [ ] Tests 8/8
- [ ] Deploy + docs
- [ ] Próximo: Lote 7

---

# PARTE 7 — Lote 7: Perfil Editável

## 7.1 Resumo

**Objetivo**: polir `18-perfil.html` que já é parcialmente funcional (chama `buscarPerfil`, `atualizarPerfil`, `atualizarConta`, `uploadFoto`, `logout`). Adicionar:
- Máscaras de input (CPF, telefone, peso, altura)
- Validações cliente (CPF dígitos verificadores, email pattern)
- Upload foto via câmera (`<input capture="user">`)
- Subseção Privacidade com link pra 71
- Botão "Excluir minha conta" (LGPD)
- Toast em vez de alert
- Edge cases (campo vazio → NULL)

**Telas** (1):
- `app-v3/18-perfil.html` (979 linhas — já 80% funcional)

**Tempo**: 3h. **Risco**: baixo.

## 7.2 Estado Atual

Já chama:
- `vitaeAPI.buscarPerfil()` no boot
- `vitaeAPI.atualizarPerfil(dados)` no save
- `vitaeAPI.atualizarConta({nome|email|celular})` em campos da Usuario
- `vitaeAPI.uploadFoto({fotoUrl})` em base64
- `vitaeAPI.logout()` no logout

Falta:
- Máscara CPF: `000.000.000-00`
- Máscara telefone: `(11) 99999-9999`
- Validação CPF
- Camera live (não só file picker)
- Link 71-privacidade
- Botão excluir conta

## 7.3 Plano de Mudanças

### 7.3.1 Helpers de máscara

```javascript
function mascaraCPF(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1-$2');
}

function mascaraTelefone(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false; // 111.111.111-11 etc

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(cpf[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(cpf[10])) return false;

  return true;
}

function validarEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
```

Aplicar nos inputs via `oninput="this.value = mascaraCPF(this.value)"`.

### 7.3.2 Camera upload

```html
<button onclick="abrirCamera()">Tirar foto</button>
<input type="file" id="fotoInput" accept="image/*" capture="user" style="display:none;" onchange="processarFoto(this.files[0])">

<script>
function abrirCamera() {
  document.getElementById('fotoInput').click();
}

async function processarFoto(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      await vitaeAPI.uploadFoto({ fotoUrl: e.target.result });
      mostrarToast('Foto atualizada', 'sucesso');
      document.getElementById('avatarImg').src = e.target.result;
    } catch (err) {
      mostrarToast('Não conseguimos salvar a foto. Tente de novo.', 'erro');
    }
  };
  reader.readAsDataURL(file);
}
</script>
```

### 7.3.3 Link Privacidade

```html
<div class="card" onclick="window.location='71-privacidade.html'">
  <div class="card-icon">...</div>
  <div>Privacidade e Autorizações</div>
  <span class="chevron">›</span>
</div>
```

### 7.3.4 Botão excluir conta

```javascript
async function excluirConta() {
  const ok = await modalConfirmar(
    'Excluir minha conta',
    'Todos os seus dados serão apagados pra sempre. Você não vai conseguir recuperar depois. Tem certeza?'
  );
  if (!ok) return;

  // Modal de dupla confirmação
  const ok2 = await modalDigite(
    'Última confirmação',
    'Digite "EXCLUIR" pra confirmar.',
    'EXCLUIR'
  );
  if (!ok2) return;

  try {
    // Endpoint DELETE /perfil (verificar se existe)
    await apiRequest('/perfil', { method: 'DELETE' });
    vitaeAPI.logout();
  } catch (e) {
    mostrarToast('Erro ao excluir. Entre em contato.', 'erro');
  }
}

function modalDigite(titulo, descricao, esperado) {
  return new Promise(resolve => {
    const m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:center;justify-content:center;';
    m.innerHTML = `<div style="background:#fff;padding:24px;border-radius:18px;max-width:340px;width:88%;">
      <div style="font-size:18px;font-weight:800;color:#EF4444;margin-bottom:8px;">${titulo}</div>
      <div style="font-size:13px;color:#6B7280;margin-bottom:14px;line-height:1.5;">${descricao}</div>
      <input id="modalInput" type="text" placeholder="${esperado}" style="width:100%;padding:12px;border:1px solid rgba(0,0,0,0.1);border-radius:12px;font:600 14px 'Plus Jakarta Sans',sans-serif;margin-bottom:14px;">
      <div style="display:flex;gap:10px;">
        <button id="modalCancel" style="flex:1;padding:12px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:12px;cursor:pointer;font:600 14px 'Plus Jakarta Sans',sans-serif;">Cancelar</button>
        <button id="modalOk" style="flex:1;padding:12px;background:#EF4444;color:#fff;border:none;border-radius:12px;cursor:pointer;font:700 14px 'Plus Jakarta Sans',sans-serif;" disabled>Excluir</button>
      </div>
    </div>`;
    document.body.appendChild(m);
    const input = m.querySelector('#modalInput');
    const ok = m.querySelector('#modalOk');
    input.oninput = () => { ok.disabled = input.value.trim() !== esperado; };
    m.querySelector('#modalCancel').onclick = () => { m.remove(); resolve(false); };
    ok.onclick = () => { m.remove(); resolve(true); };
  });
}
```

VERIFICAR se backend tem `DELETE /perfil` ou rota similar. Se não, **PARAR e perguntar Lucas**.

## 7.4 Estados a Cobrir

1. Edit nome → PATCH /perfil/conta
2. Edit email → PATCH (rejeita se já existe)
3. Edit telefone com máscara
4. Edit CPF inválido → erro inline
5. Edit data nascimento (date picker)
6. Edit sangue (select)
7. Upload foto via camera (mobile)
8. Upload foto via picker (desktop)
9. Logout
10. Excluir conta → 2 modais → DELETE → redirect login

## 7.5 Playwright Tests

10 cenários. `tests/lote-7-perfil.js`.

## 7.6 Critério de Pronto

- [ ] Máscaras funcionam em todos os campos
- [ ] Validações inline
- [ ] Camera upload OK
- [ ] Link Privacidade
- [ ] Excluir conta (se endpoint existir)
- [ ] 10/10 Playwright

## 7.7 Deploy

```
feat(app-v3): LOTE 7 — Perfil com máscaras, validações, camera

- Máscaras: CPF, telefone, peso, altura
- Validações: CPF dígito verificador, email, telefone
- Upload foto: camera live + file picker
- Subseção Privacidade
- Botão Excluir conta (LGPD Art. 18)

Tests: 10/10
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

## 7.8 Rollback + 7.9 Bugs

1. **Camera no iOS**: precisa permissão. Se negada, fallback file picker.
2. **base64 grande**: limit 5MB. Backend pode rejeitar. Resize cliente antes de upload.
3. **`DELETE /perfil` pode não existir**: PARAR e perguntar.
4. **Máscara CPF que paciente "auto-completa"**: cuidado com colagem (cole CPF formatado).
5. **`PATCH /perfil/conta` com mesma senha vazia**: backend bug? Não enviar senha se vazia.

## 7.10 Tempo

3-4h.

## 7.11 Checklist

- [ ] 18-perfil ajustado
- [ ] 10/10 Playwright
- [ ] Endpoint DELETE confirmado ou bug logado
- [ ] Deploy
- [ ] Próximo: Lote 8

---

# PARTE 8 — Lote 8: Privacidade + Autorizações

## 8.1 Resumo

**Objetivo**: enriquecer `71-privacidade.html` (já funcional 80%). Adicionar:
- Subseção Consentimentos LGPD (lista TERMOS_USO, POLITICA_PRIVACIDADE, DADOS_SAUDE com data)
- Link "Ver Termos de Uso" → /termos.html (raiz, já existe)
- Link "Ver Política LGPD" → /lgpd.html
- Botão "Baixar meus dados" (POST /pdf/gerar)
- Trocar emojis 🔐 ⚕️ por SVG (regra CLAUDE.md: zero emoji)

**Telas** (1):
- `app-v3/71-privacidade.html` (184 linhas)

**Tempo**: 1-2h. **Risco**: baixo.

## 8.2 Estado Atual

Chama `listarAutorizacoes`, `autorizarMedico`, `revogarAutorizacao`. Tem dois emojis em CSS background ou inline.

## 8.3 Plano de Mudanças

### 8.3.1 Substituir emojis por SVG

Grep `🔐|⚕️` em 71-privacidade.html → trocar por:

```html
<!-- shield -->
<svg viewBox="0 0 24 24" stroke-width="2" fill="none" stroke="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
<!-- staff -->
<svg viewBox="0 0 24 24" stroke-width="2" fill="none" stroke="currentColor"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
```

### 8.3.2 Adicionar Consentimentos LGPD

```html
<div class="section-label">Consentimentos LGPD</div>
<div id="consentimentosLista"></div>
```

JS:
```javascript
async function carregarConsentimentos() {
  try {
    const res = await vitaeAPI.getStatusConsentimentos();
    const tipos = ['TERMOS_USO', 'POLITICA_PRIVACIDADE', 'DADOS_SAUDE'];
    const lista = document.getElementById('consentimentosLista');
    lista.innerHTML = tipos.map(t => {
      const aceito = res[t] || {};
      const aceitoEm = aceito.aceitoEm ? formatarData(aceito.aceitoEm) : 'Não aceito';
      return `
        <div class="card-row">
          <div>
            <div style="font-weight:700;font-size:14px;">${labelConsentimento(t)}</div>
            <div style="font-size:12px;color:var(--ink3);">${aceitoEm}</div>
          </div>
          ${aceito.aceitoEm ? '<span class="badge green">Ativo</span>' : '<span class="badge red">Pendente</span>'}
        </div>
      `;
    }).join('');
  } catch (e) { /* ignora */ }
}

function labelConsentimento(t) {
  return { TERMOS_USO: 'Termos de Uso', POLITICA_PRIVACIDADE: 'Política de Privacidade', DADOS_SAUDE: 'Compartilhamento de Dados de Saúde' }[t] || t;
}
```

### 8.3.3 Botão Baixar dados (LGPD Art. 18)

```html
<button id="btnBaixarDados" onclick="baixarMeusDados()">Baixar meus dados</button>
```

```javascript
async function baixarMeusDados() {
  const btn = document.getElementById('btnBaixarDados');
  btn.disabled = true;
  btn.textContent = 'Gerando...';
  try {
    const res = await vitaeAPI.getDadosPdf();
    if (res && res.url) {
      window.open(res.url, '_blank');
      mostrarToast('PDF gerado', 'sucesso');
    } else {
      mostrarToast('PDF não disponível', 'erro');
    }
  } catch (e) {
    mostrarToast('Erro ao gerar PDF. Tente de novo.', 'erro');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Baixar meus dados';
  }
}
```

### 8.3.4 Links Termos + LGPD

```html
<a href="/termos.html" target="_blank">Ver Termos de Uso</a>
<a href="/lgpd.html" target="_blank">Ver Política LGPD</a>
```

(Páginas estão na raiz, não em app-v3/.)

## 8.4 Estados

1. Lista autorizações
2. Autoriza médico por CRM → POST → aparece
3. Revoga → DELETE → some
4. Consentimentos LGPD render
5. Click Termos → abre página
6. Click LGPD → abre página
7. Baixar dados → gera PDF
8. Emojis substituídos

## 8.5 Playwright Tests

8 cenários. `tests/lote-8-privacidade.js`.

## 8.6 Critério de Pronto

- [ ] Grep `🔐|⚕️` em 71-privacidade.html retorna 0
- [ ] Consentimentos lista 3 itens com data
- [ ] Botão Baixar PDF funciona
- [ ] Links Termos/LGPD abrem
- [ ] 8/8 Playwright

## 8.7 Deploy

```
feat(app-v3): LOTE 8 — Privacidade com consentimentos LGPD e PDF

- Trocou emojis por SVG (regra CLAUDE.md)
- Consentimentos LGPD: 3 status com data
- Botão Baixar dados (Art. 18)
- Links Termos + Política

Tests: 8/8
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

## 8.8 Rollback + 8.9 Bugs

1. **getStatusConsentimentos pode 404**: handle gracefully.
2. **PDF demora**: backend gera assíncrono. Polling? Não nesta rodada.
3. **CRM autorização**: medico precisa existir. Se não, backend 404.

## 8.10 Tempo

2h.

## 8.11 Checklist

- [ ] Emojis fora
- [ ] Consentimentos
- [ ] PDF
- [ ] Links
- [ ] 8/8 Playwright
- [ ] Deploy
- [ ] Próximo: Lote 9

---

# PARTE 9 — Lote 9: Quiz com Formulário Estruturado de Medicamento

## 9.1 Resumo

**Objetivo**: no quiz `30-quiz.html` (e `quiz-preconsulta.html`), quando paciente digita medicamento, abrir mini-form inline pra estruturar (nome, dose, frequência, horário, motivo, via). Hoje é string solta.

**Telas** (2):
- `app-v3/30-quiz.html`
- `app-v3/quiz-preconsulta.html`

**Funções**: `vitaeAPI.adicionarMedicamento`, `vitaeAPI.infoMedicamento`.

**Tempo**: 2-3h. **Risco**: médio. **Dependências**: Lote 2 (form já existe).

## 9.2 Estado Atual

Quiz hoje: paciente digita "Losartana 50mg, Omeprazol 20mg, Vitamina D" → backend parseia por vírgula → cria 3 meds só com nome. Resultado pobre.

## 9.3 Plano de Mudanças

### 9.3.1 Detectar passo de medicamentos no quiz

Achar o passo em `30-quiz.html` onde pergunta "Que medicamentos você toma?" e o input textarea. Substituir por interface estruturada:

```html
<div class="quiz-step" data-step="medicamentos">
  <h2>Que medicamentos você toma?</h2>
  <div id="medsListaQuiz"></div>
  <button onclick="abrirFormMed()" class="btn-add-med">+ Adicionar medicamento</button>
  <button onclick="prosseguirQuiz()" class="btn-next">Continuar</button>
</div>
```

### 9.3.2 Form modal de medicamento estruturado

```javascript
function abrirFormMed(editIdx) {
  const isEdit = editIdx !== undefined;
  const med = isEdit ? STATE.medsQuiz[editIdx] : {};

  const m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:flex-end;';
  m.innerHTML = `
    <div style="background:#fff;width:100%;max-width:500px;margin:auto;border-radius:24px 24px 0 0;padding:24px;max-height:90vh;overflow-y:auto;">
      <div style="font-size:20px;font-weight:800;margin-bottom:18px;">${isEdit ? 'Editar' : 'Novo'} medicamento</div>

      <label>Nome
        <input id="qmNome" placeholder="Ex: Losartana" value="${sanitize(med.nome || '')}">
      </label>

      <label>Dosagem
        <input id="qmDose" placeholder="50mg" value="${sanitize(med.dosagem || '')}">
      </label>

      <label>Frequência
        <select id="qmFreq">
          <option value="Todo dia" ${med.frequencia === 'Todo dia' ? 'selected' : ''}>Todo dia</option>
          <option value="2x ao dia" ${med.frequencia === '2x ao dia' ? 'selected' : ''}>2x ao dia</option>
          <option value="3x ao dia" ${med.frequencia === '3x ao dia' ? 'selected' : ''}>3x ao dia</option>
          <option value="Quando precisar" ${med.frequencia === 'Quando precisar' ? 'selected' : ''}>Quando precisar</option>
        </select>
      </label>

      <label id="qmHorarioLabel">Horário
        <input id="qmHorario" type="time" value="${sanitize(med.horario || '08:00')}">
      </label>

      <label>Pra que serve
        <input id="qmMotivo" placeholder="Pressão, refluxo, etc" value="${sanitize(med.motivo || '')}">
      </label>

      <label>Como toma
        <select id="qmVia">
          <option value="ORAL">Oral (boca)</option>
          <option value="SUBLINGUAL">Sublingual</option>
          <option value="TOPICA">Tópica (pele)</option>
          <option value="INJETAVEL">Injetável</option>
          <option value="INALATORIA">Inalatória</option>
        </select>
      </label>

      <div style="display:flex;gap:10px;margin-top:18px;">
        <button onclick="this.closest('div[style*=position]').remove()" style="flex:1;padding:14px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:12px;">Cancelar</button>
        <button onclick="salvarMedQuiz(${isEdit ? editIdx : 'null'})" style="flex:1;padding:14px;background:linear-gradient(120deg,#00E5A0,#00B4D8);color:#fff;border:none;border-radius:12px;">Salvar</button>
      </div>
    </div>
  `;
  document.body.appendChild(m);

  document.getElementById('qmFreq').onchange = function() {
    document.getElementById('qmHorarioLabel').style.display = this.value === 'Quando precisar' ? 'none' : '';
  };
}

function salvarMedQuiz(idx) {
  const med = {
    nome: document.getElementById('qmNome').value.trim(),
    dosagem: document.getElementById('qmDose').value.trim() || null,
    frequencia: document.getElementById('qmFreq').value,
    horario: document.getElementById('qmFreq').value === 'Quando precisar' ? null : document.getElementById('qmHorario').value,
    motivo: document.getElementById('qmMotivo').value.trim() || null,
    via: document.getElementById('qmVia').value
  };
  if (!med.nome) return;
  if (idx === null) STATE.medsQuiz.push(med);
  else STATE.medsQuiz[idx] = med;
  document.querySelector('div[style*=position]').remove();
  renderMedsQuiz();
}

function renderMedsQuiz() {
  const cont = document.getElementById('medsListaQuiz');
  if (STATE.medsQuiz.length === 0) {
    cont.innerHTML = '<div style="padding:14px;color:var(--ink3);text-align:center;">Nenhum medicamento ainda</div>';
    return;
  }
  cont.innerHTML = STATE.medsQuiz.map((m, i) => `
    <div class="med-quiz-card" style="display:flex;align-items:center;gap:12px;padding:12px;background:#fff;border-radius:14px;margin-bottom:8px;border:1px solid rgba(0,0,0,0.06);">
      <div style="flex:1;">
        <div style="font-weight:700;">${sanitize(m.nome)}${m.dosagem ? ' ' + sanitize(m.dosagem) : ''}</div>
        <div style="font-size:12px;color:var(--ink3);">${sanitize(m.frequencia)}${m.horario ? ' · ' + sanitize(m.horario) : ''}${m.motivo ? ' · ' + sanitize(m.motivo) : ''}</div>
      </div>
      <button onclick="abrirFormMed(${i})" style="background:none;border:none;color:var(--green2);cursor:pointer;">Editar</button>
      <button onclick="STATE.medsQuiz.splice(${i}, 1); renderMedsQuiz();" style="background:none;border:none;color:var(--bad);cursor:pointer;">×</button>
    </div>
  `).join('');
}
```

### 9.3.3 Submit final do quiz

No fim do quiz (transição pra 31-pronto), enviar cada med via POST:

```javascript
async function finalizarQuiz() {
  // ... outras chamadas (atualizarPerfil, adicionarAlergia, registrarConsentimento) ...

  // Medicamentos estruturados
  for (const med of STATE.medsQuiz) {
    try {
      await vitaeAPI.adicionarMedicamento({ ...med, dataInicio: new Date().toISOString().split('T')[0], ativo: true });
    } catch (e) {
      console.error('Erro ao adicionar med', med.nome, e);
    }
  }

  // Continua pro 31-pronto
}
```

### 9.3.4 Replicar em `quiz-preconsulta.html`

Mesma lógica.

## 9.4 Estados

1. Paciente entra quiz → step meds vazio
2. Clica "+ Adicionar" → modal abre
3. Preenche e salva → card aparece na lista
4. Edita → modal pré-preenche → salva → card atualiza
5. Remove → card some
6. Continua quiz → POST de cada med no finalizar
7. Volta home → vê meds estruturados (não só nome)

## 9.5 Playwright Tests

10 cenários. `tests/lote-9-quiz.js`.

## 9.6 Critério de Pronto

- [ ] Quiz tem mini-form de medicamento
- [ ] Múltiplos meds podem ser adicionados
- [ ] Edit + remove funciona
- [ ] Submit envia POST estruturado pra cada
- [ ] Home depois do quiz mostra meds com dose/horario/motivo
- [ ] Mesma lógica em quiz-preconsulta
- [ ] 10/10 Playwright

## 9.7 Deploy

```
feat(app-v3): LOTE 9 — Quiz com medicamento estruturado

- 30-quiz: substituiu textarea string por mini-form (nome+dose+freq+horario+motivo+via)
- quiz-preconsulta: mesma lógica
- POST adicionarMedicamento pra cada med estruturado no finalizar

Tests: 10/10
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

## 9.8 Rollback + 9.9 Bugs

1. **Quiz tem state parcial em localStorage (`vitae_quiz_parcial_v2`)**: incluir `medsQuiz` no save.
2. **Continuar quiz no meio**: deve restaurar lista de meds.
3. **Validação backend** (POST /medicamentos): se rejeitar 1 med, continuar com os outros.
4. **Quiz time-out (sessão expira no meio)**: refresh automático.
5. **Modal precisa de focus trap** (acessibilidade): deixar pra Lote 10.

## 9.10 Tempo

3h.

## 9.11 Checklist

- [ ] 30-quiz adaptado
- [ ] quiz-preconsulta adaptado
- [ ] 10/10 Playwright
- [ ] Deploy
- [ ] Próximo: Lote 10

---

# PARTE 10 — Lote 10: Polimento + Edge Cases + Bugs Descobertos

## 10.1 Resumo

**Objetivo**: limpar tudo que ficou pra trás. Substituir hardcoded restante. Corrigir edge cases. Implementar features menores: cache localStorage, lazy load exames, validações finais. Auditoria total.

**Telas afetadas**: todas as 13+ telas, especialmente:
- `app-v3/60-erro-offline.html` (4 hardcodes)
- `app-v3/31-pronto.html` (contagem hardcoded "0")
- `app-v3/52-loading-home.html` (decidir se mantém ou remove)
- `app-v3/40-saude-vazia.html` (revalidar)
- Validações faltantes em forms (Lotes anteriores podem ter pulado)
- Acessibilidade: alt, aria-label
- Performance: lazy-load exames
- Sentry: window.onerror handler

**Tempo**: 3-4h. **Risco**: alto (descobre bugs imprevistos).

## 10.2 Estado Atual

Vai depender do que ficou. Após Lotes 1-9, rodar grep total:

```powershell
cd d:\vitae-app-novo\app-v3
Get-ChildItem *.html | Select-String -Pattern 'Lucas Borelli|LUCAS BORELLI|001234567|12/03/2008|98765-4321|Marina Borelli|Losartana 50mg|Omeprazol 20mg|Dipirona|Penicilina|Camarão|Dra. Renata|Bruno Lima|Marina Ferreira'
```

Lista cada match. Tratar cada um.

Excluir sandbox (`app.html`, `app-galeria.html`, etc).

## 10.3 Plano de Mudanças

### 10.3.1 Edit `60-erro-offline.html`

```javascript
window.addEventListener('DOMContentLoaded', () => {
  const u = JSON.parse(localStorage.getItem('vitae_usuario') || 'null');
  if (u) {
    document.getElementById('offlineNome').textContent = u.nome.toUpperCase();
    // Tipo sanguineo + nasc do cache (vitae_perfil_cache se existir)
    const cache = JSON.parse(localStorage.getItem('vitae_perfil_cache') || '{}').dados || {};
    if (cache.perfil) {
      document.getElementById('offlineNasc').textContent = formatarData(cache.perfil.dataNascimento);
      document.getElementById('offlineSangue').textContent = formatarTipoSanguineo(cache.perfil.tipoSanguineo);
    }
  }
  // Mostra última sync
  const lastSync = localStorage.getItem('vitae_last_sync');
  if (lastSync) document.getElementById('offlineUltimaSync').textContent = 'Atualizado ' + formatarDataExtensa(lastSync);
});
```

Substituir hardcodes por IDs (`offlineNome`, `offlineNasc`, `offlineSangue`, `offlineUltimaSync`).

### 10.3.2 Edit `31-pronto.html`

```javascript
async function contarRespostas() {
  // Quantas info paciente preencheu no quiz
  try {
    const res = await vitaeAPI.getPerfil();
    let count = 0;
    const p = res.perfil || {};
    if (p.dataNascimento) count++;
    if (p.tipoSanguineo) count++;
    if (p.cpf) count++;
    if (p.peso) count++;
    if (p.altura) count++;
    if (p.contatoEmergenciaNome) count++;
    // Alergias e meds
    const al = await vitaeAPI.listarAlergias().catch(() => ({ alergias: [] }));
    count += (al.alergias || []).length;
    const md = await vitaeAPI.listarMedicamentos().catch(() => ({ medicamentos: [] }));
    count += (md.medicamentos || []).length;

    document.getElementById('contagemRespostas').textContent = count + ' respostas';
  } catch (e) {
    document.getElementById('contagemRespostas').textContent = 'respostas salvas';
  }
}
window.addEventListener('DOMContentLoaded', contarRespostas);
```

### 10.3.3 Decidir destino de `52-loading-home.html`

Opções:
- (A) Manter como tela separada usada só após quiz (transição 31→01).
- (B) Remover e mover skeleton 100% inline.

Decisão: manter (A). 31-pronto.html já redireciona pra 52, e 52 redireciona pra 01.

Pequeno ajuste em 52: timeout máximo de 3s antes de forçar redirect pra 01 (UX).

```javascript
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => window.location.href = '01-saude.html', 1500);
});
```

### 10.3.4 Sentry config

Em cada tela, adicionar:

```javascript
window.onerror = function(msg, src, line, col, err) {
  console.error('[onerror]', msg, src, line, col, err);
  // Sentry? Lucas decide depois.
  return false; // não suprime erro default
};

window.onunhandledrejection = function(e) {
  console.error('[unhandled promise]', e.reason);
};
```

### 10.3.5 Acessibilidade

Audit:
- Todos os `<img>` têm `alt`
- Todos os `<button>` icone-only têm `aria-label`
- Foco visível em inputs
- Roles em modais (`role="dialog" aria-modal="true"`)

### 10.3.6 Performance

- `09-exames-lista.html`: lazy load thumbnails (já tem)
- `01-saude.html`: caches localStorage 30s
- Minify? Não nesta rodada.

### 10.3.7 Mascaras nas telas que faltaram

CPF em 26-cadastro? Telefone em 26-cadastro? Verificar.

### 10.3.8 Audit final hardcode

```powershell
cd d:\vitae-app-novo\app-v3
Get-ChildItem *.html | Where-Object { $_.Name -notmatch 'app|mapa-v3' } | ForEach-Object {
  $matches = Select-String -Path $_.FullName -Pattern '(Lucas|Losartana 50mg|Dipirona|Renata Cardoso|001234567|98765-4321|Marina Borelli|Albert Einstein|CRM-SP 145|Quarta, 21 de maio|EM 7 DIAS|87% de adesao|2 criticas)'
  if ($matches) {
    Write-Host "==== $($_.Name) ====" -ForegroundColor Yellow
    $matches | Format-Table LineNumber, Line -AutoSize
  }
}
```

Cada match → editar e remover.

## 10.4 Estados a Cobrir

1. App offline → 60-erro-offline com nome cached
2. Quiz concluído → 31-pronto mostra contagem real
3. Quiz → 52-loading-home → 01 (em <2s)
4. Hardcode total ZERADO

## 10.5 Playwright Tests

`tests/lote-10-polimento.js`. 6+ cenários incluindo:
- Grep final em todos arquivos HTML
- Re-roda todos os testes anteriores (smoke)
- Performance budget: 01-saude < 2s

## 10.6 Critério de Pronto

- [ ] Grep total em `app-v3/*.html` (excluindo sandbox) retorna 0 hardcoded
- [ ] 60-erro-offline lê cache
- [ ] 31-pronto conta respostas
- [ ] window.onerror em todas telas autenticadas
- [ ] alt + aria-label faltando preenchidos
- [ ] Lighthouse mobile > 80 em 5 telas principais
- [ ] Bug list `tests/bugs-encontrados.json` está limpa (ou só com bugs assumidos pra phase 2)
- [ ] Sentry/console clean
- [ ] Re-roda Lotes 1-9 e tudo passa

## 10.7 Deploy

```
feat(app-v3): LOTE 10 — Polimento, edge cases e bugs descobertos

- 60-erro-offline lê cache localStorage
- 31-pronto conta respostas reais do paciente
- 52-loading-home auto-redirect em 1.5s
- onerror + unhandledrejection capturados
- Audit final: zero hardcoded em app-v3 (excluindo sandbox)
- Acessibilidade: alt, aria-label, role
- Performance: cache localStorage 30s

Tests: 6/6 polimento + re-runs 1-9 all green
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

## 10.8 Rollback

Padrão.

## 10.9 Bugs Conhecidos

Tudo que ficou em `tests/bugs-encontrados.json`.

## 10.10 Tempo

4h. Pode estender pra 6h se aparecer surpresa.

## 10.11 Checklist

- [ ] Grep total ZERO
- [ ] 60, 31, 52 ajustados
- [ ] Sentry hooks
- [ ] Acessibilidade
- [ ] Re-roda 1-9
- [ ] Deploy
- [ ] PARTE 11 (testes integrados)

---

# PARTE 11 — Testes Integrados Finais

Após Lote 10, antes de cutover (Parte 12), rodar bateria total.

## 11.1 Smoke Test Cross-Lote

`tests/smoke-app-v3-completo.js`:

Simula jornada completa do paciente novo:

1. Acessa app-v3 sem login → splash → boas-vindas → cadastro
2. Cadastra → SMS → onboarding → quiz
3. Quiz preenche: nasc, sangue, CPF, altura, peso, emerg, 2 alergias, 3 meds (estruturado), termos
4. Conclui → 31-pronto → 52-loading → 01-saude
5. Vê home com SEUS dados
6. Click meds → 03 → mostra 3
7. Click 1 med → 04-detalhe → mostra correto
8. Volta → click alergias → 06 → mostra 2
9. Click 1 alergia → 07 → mostra cruzamentos
10. Voltar → QR Code 12 → vê QR
11. Outro celular escaneia → 14-rg-publico → vê alergias críticas + meds
12. Volta app → exames → 09 → vazia → upload → 10 → vê biomarcadores
13. Consultas → 15 → vazia (sem agendamentos)
14. Perfil → 18 → editar nome → salva
15. Privacidade → 71 → autoriza médico CRM teste → vê na lista
16. Logout → volta login

100+ asserts.

## 11.2 Cross-paciente-médico

1. Paciente cadastra e cria dados (alergia + med + exame)
2. Paciente autoriza médico (via CRM)
3. Médico loga no `20-medico-dashboard.html` (raiz, app antigo)
4. Médico vê paciente na lista
5. Médico abre paciente → vê alergias, meds, exames
6. Médico envia pré-consulta → paciente recebe link
7. Paciente clica link → responde pré-consulta → gera resumo
8. Médico vê 25-summary com resumo

## 11.3 Carga

10 pacientes criando simultaneamente. Backend aguenta? Métrica: tempo médio cadastro.

## 11.4 Regressão app antigo

`vitae-app.vercel.app/` (raiz) ainda funciona? Acessa, faz login antigo, vê dados.

`tests/regressao-antigo.js`:
- Cadastra via antigo
- Faz quiz antigo
- Acessa home antiga
- Confirma nada quebrou

## 11.5 Tempo total Parte 11

3-4h.

---

# PARTE 12 — Critério de Cutover (Fase 9)

App v3 substitui o antigo quando TODAS as condições:

## 12.1 Técnicas

- [ ] 10 lotes commited e deployed
- [ ] Bateria Playwright (Lotes 1-10) verde
- [ ] Smoke cross-lote 100%
- [ ] Grep hardcoded em `app-v3/*.html`: 0
- [ ] Sentry 48h sem novo erro
- [ ] Lighthouse mobile > 85 em 5 telas
- [ ] JWT interop antigo ↔ v3

## 12.2 Funcionais

- [ ] Paciente novo: cadastro → SMS → quiz → home com dados → QR funcional
- [ ] Paciente antigo (banco): abre v3 e vê dados sem perder
- [ ] Médico autorizado abre QR → < 3s carrega

## 12.3 UX

- [ ] Lucas + 2 betatesters confirmam "melhor que antigo"
- [ ] Sem feedback "onde clico" (intuitividade)
- [ ] Nada mais lento que antigo

## 12.4 Métricas a Coletar

| Métrica | Alvo | Como medir |
|---|---|---|
| Tempo quiz | < 4min | Sentry/timer |
| % conclui onboarding | > 80% | Backend (count usuarios com perfilCompleto) |
| Tempo carregar home | < 1.5s | Performance API |
| Erros fetch 24h | < 5/paciente | Sentry |
| NPS pós 7 dias | >= 8 | Survey |

## 12.5 Plano A/B

Vercel rewrite condicional em `vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/((?!app-v3).*)",
      "has": [{ "type": "cookie", "key": "vitae_v3", "value": "true" }],
      "destination": "/app-v3/$1"
    },
    {
      "source": "/((?!app-v3).*)",
      "destination": "/$1"
    }
  ]
}
```

Dia 1-3: 10% trafego → cookie `vitae_v3=true`
Dia 4-7: 50% se métricas estáveis
Dia 8+: 100%

## 12.6 Rollback Rápido

Mudar `vercel.json` pra `{ "rewrites": [{ "source": "/((?!app-v3).*)", "destination": "/$1" }] }` e push = 60s.

App v3 fica em `/app-v3/` separado mesmo, mas raiz volta pro antigo.

---

# PARTE 13 — Bugs e Decisões a Levar ao Lucas

Lista de coisas onde o Claude PARA e pergunta. NUNCA decide sozinho.

## 13.1 Mudança de schema do banco

Qualquer alteração em `backend/prisma/schema.prisma`.

## 13.2 Endpoint novo

Backend não tem o que precisa. Ex: `DELETE /perfil` no Lote 7.

## 13.3 Copy nova

Texto inventado pra UI. Lucas tem opinião forte.

## 13.4 Feature nova fora dos 10 lotes

Ex: scan receita real. Não cabe.

## 13.5 Cutover timing

Lucas decide quando lançar A/B.

## 13.6 Schema enum mudança

Ex: adicionar gravidade `CRITICA` se backend só tem `LEVE/MODERADA/GRAVE`.

## 13.7 Foto upload formato

Backend espera base64. Trocar pra multipart? Lucas decide.

## 13.8 Push notifications

Não nesta rodada. Pergunta se entra Lote 10 ou phase 2.

## 13.9 Modo offline (IndexedDB)

Não nesta rodada.

## 13.10 Internacionalização (PT/EN/ES)

Não nesta rodada.

---

# PARTE 14 — Cronograma Real

## 14.1 Tabela de Estimativas

| Lote | Tempo otimista | Tempo realista | Tempo pessimista | Paralelizar? |
|---|---|---|---|---|
| 1 | 3h | 4h | 5h | Não — base dos outros |
| 2 | 3h | 5h | 6h | Não — depende de Lote 1 |
| 3 | 2h | 4h | 5h | Pode com 2 |
| 4 | 3h | 4h30 | 6h | Não — único |
| 5 | 2h | 4h | 5h | Pode com 4 |
| 6 | 2h | 3h | 4h | Pode com 5 |
| 7 | 3h | 4h | 5h | Pode com 6 |
| 8 | 1h30 | 2h | 3h | Pode com 7 |
| 9 | 2h | 3h | 4h | Não — depende de 2 |
| 10 | 3h | 4h30 | 7h | Sempre alto |
| 11 | 3h | 4h | 6h | Não — depende todos |
| 12 | (decisão Lucas) | - | - | - |

**Total realista**: 30-40h.

## 14.2 Sessão única vs sessões múltiplas

Recomendação: **sessões de 4-6h cada**, com checkpoint entre lotes.

Sequência otimizada (não paralelizar — segurança):

- Sessão 1 (6h): Lote 1 + Lote 2
- Sessão 2 (6h): Lote 3 + Lote 4
- Sessão 3 (6h): Lote 5 + Lote 6
- Sessão 4 (6h): Lote 7 + Lote 8
- Sessão 5 (6h): Lote 9 + Lote 10 começo
- Sessão 6 (6h): Lote 10 fim + Parte 11
- Sessão 7: Cutover decisão (Lucas + Claude)

Total: 7 sessões de 6h = 42h. Margem 5%.

---

# PARTE 15 — Checklist Final (Antes de Avisar Lucas)

Antes de relatar "tudo pronto pra cutover":

- [ ] Todos os 10 lotes commitados e em `feat-app-v3-paciente` push'ado
- [ ] Vercel deploy ativo em todas as URLs
- [ ] Playwright completo (todos os lotes) verde local
- [ ] Playwright completo verde prod
- [ ] Cross-lote smoke verde
- [ ] Regressão app antigo verde
- [ ] Grep total hardcoded: 0
- [ ] App antigo ainda intocado (não foi tocado)
- [ ] `MAPA-IMPLEMENTACAO-FINAL.md` marca todos os 10 lotes ✅
- [ ] `CLAUDE.md` PARTE B atualizada com sessões executadas
- [ ] `tests/bugs-encontrados.json` revisado (tudo resolvido ou marked phase-2)
- [ ] `tests/credenciais-lotes.json` revisado (limpa? salva?)
- [ ] Relatório final escrito (NÃO criar .md proativo — só preenche se Lucas pedir)
- [ ] URLs preview + produção testadas em iPhone real (Lucas faz)
- [ ] Tempo total real registrado (vs estimado)
- [ ] Pergunta de cutover preparada pra Lucas

Aviso a enviar:

```
Lucas: 10 lotes deployed e validados. Bateria de testes verde.
URL preview: https://vitae-app.vercel.app/app-v3/01-saude.html
URL produção (rota /app-v3/): https://vitae-app.vercel.app/app-v3/01-saude.html

Próximo passo: cutover A/B. Quando você quiser ativar, eu mudo `vercel.json`.

Bugs em phase-2: [lista de tests/bugs-encontrados.json].

Tempo total: X horas (vs Y estimado).
```

---

# APÊNDICE A — Snippets Reutilizáveis

## A.1 Helpers JS Padrão (copy-paste em cada tela)

```javascript
function sanitize(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function formatarData(d) {
  if (!d) return '—';
  const x = new Date(d);
  return isNaN(x.getTime()) ? '—' : x.toLocaleDateString('pt-BR');
}
function formatarDataExtensa(d) {
  if (!d) return '—';
  const x = new Date(d);
  return isNaN(x.getTime()) ? '—' : x.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function formatarTipoSanguineo(t) {
  const map = { 'A_POS': 'A+', 'A_NEG': 'A-', 'B_POS': 'B+', 'B_NEG': 'B-', 'AB_POS': 'AB+', 'AB_NEG': 'AB-', 'O_POS': 'O+', 'O_NEG': 'O-' };
  if (map[t]) return map[t];
  if (typeof t === 'string' && /^(A|B|AB|O)[+-]$/.test(t)) return t;
  return '—';
}
function calcularIdade(d) {
  if (!d) return null;
  const x = new Date(d);
  if (isNaN(x.getTime())) return null;
  const h = new Date();
  let i = h.getFullYear() - x.getFullYear();
  const m = h.getMonth() - x.getMonth();
  if (m < 0 || (m === 0 && h.getDate() < x.getDate())) i--;
  return i;
}
function primeiroNome(n) { if (!n) return ''; return n.trim().split(/\s+/)[0]; }
function iniciais(n) { if (!n) return '?'; return n.split(' ').filter(p => p.length > 1).slice(0, 2).map(p => p[0]).join('').toUpperCase(); }
function traduzirErro(e) {
  const m = (e && e.message) || String(e);
  if (m.includes('Failed to fetch') || m.includes('NetworkError')) return 'Sem conexão. Verifique sua internet.';
  if (m.includes('Sessao expirada') || m.includes('401')) return 'Sua sessão expirou. Faça login.';
  if (m.includes('500') || m.includes('503')) return 'Servidor com problema temporário.';
  return m.replace(/^Erro \d+\n?/, '') || 'Algo deu errado.';
}
function mostrarToast(msg, tipo = 'sucesso') {
  const t = document.createElement('div');
  const cor = { sucesso: '#00C47A', erro: '#EF4444', aviso: '#F59E0B' }[tipo] || '#0D0F14';
  t.style.cssText = `position:fixed;bottom:100px;left:50%;transform:translateX(-50%) translateY(20px);background:#0D0F14;color:#fff;padding:14px 22px;border-radius:14px;font:600 13px/1.4 "Plus Jakarta Sans",sans-serif;z-index:1001;display:flex;align-items:center;gap:10px;opacity:0;transition:all 0.3s;`;
  t.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${cor};"></span>${sanitize(msg)}`;
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3500);
}
function mostrarBannerErro(msg) {
  const old = document.getElementById('errorBanner');
  if (old) old.remove();
  const b = document.createElement('div');
  b.id = 'errorBanner';
  b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#EF4444;color:#fff;padding:14px 20px;text-align:center;font:600 13px/1.4 "Plus Jakarta Sans",sans-serif;z-index:1000;display:flex;align-items:center;justify-content:center;gap:12px;';
  b.innerHTML = `<span>${sanitize(msg)}</span><button onclick="document.getElementById('errorBanner').remove(); location.reload();" style="background:#fff;color:#EF4444;border:none;padding:6px 14px;border-radius:8px;font:700 12px sans-serif;cursor:pointer;">Tentar de novo</button>`;
  document.body.appendChild(b);
}
function modalConfirmar(titulo, descricao) {
  return new Promise(resolve => {
    const m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:center;justify-content:center;';
    m.innerHTML = `<div style="background:#fff;padding:24px;border-radius:18px;max-width:340px;width:88%;font-family:'Plus Jakarta Sans',sans-serif;">
      <div style="font-size:18px;font-weight:800;color:#0D0F14;margin-bottom:8px;">${sanitize(titulo)}</div>
      <div style="font-size:13px;color:#6B7280;margin-bottom:18px;line-height:1.5;">${sanitize(descricao)}</div>
      <div style="display:flex;gap:10px;">
        <button id="modalCancel" style="flex:1;padding:12px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:12px;cursor:pointer;font:600 14px sans-serif;">Cancelar</button>
        <button id="modalOk" style="flex:1;padding:12px;background:#EF4444;color:#fff;border:none;border-radius:12px;cursor:pointer;font:700 14px sans-serif;">Confirmar</button>
      </div>
    </div>`;
    document.body.appendChild(m);
    m.querySelector('#modalCancel').onclick = () => { m.remove(); resolve(false); };
    m.querySelector('#modalOk').onclick = () => { m.remove(); resolve(true); };
  });
}
```

## A.2 SVG Icons Comuns

```javascript
const ICONS = {
  alergia: `<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
  med: `<path d="M10.5 20.5 3.5 13.5a4.95 4.95 0 0 1 7-7l7 7a4.95 4.95 0 0 1-7 7Z"/><path d="m8.5 8.5 7 7"/>`,
  exame: `<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`,
  qr: `<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3"/>`,
  calendar: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  pin: `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>`,
  arrow: `<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>`,
  check: `<polyline points="20 6 9 17 4 12"/>`,
  shield: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
};
function svgIcon(name, color = 'currentColor', size = 24) {
  const path = ICONS[name];
  if (!path) return '';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}
```

---

# APÊNDICE B — Comandos PowerShell Comuns

## B.1 Verificações pré-vôo

```powershell
# Branch certa
git branch --show-current

# Working tree limpo
git status --short

# Backend respondendo
$r = Invoke-WebRequest "https://vitae-app-production.up.railway.app/health" -Method Get -ErrorAction SilentlyContinue
$r.StatusCode

# Vercel respondendo
$r2 = Invoke-WebRequest "https://vitae-app.vercel.app/app-v3/01-saude.html" -Method Head
$r2.StatusCode

# Playwright
npx playwright --version
```

## B.2 Servidor local

```powershell
# Inicia em background (mantém terminal livre)
$pid = Start-Process python -ArgumentList "-m", "http.server", "3000" -WindowStyle Hidden -PassThru

# Verifica respondendo
Start-Sleep -Seconds 2
Invoke-WebRequest "http://localhost:3000/app-v3/01-saude.html" -Method Head | Select-Object StatusCode

# Mata depois
Stop-Process -Id $pid
```

## B.3 Audit hardcoded

```powershell
cd d:\vitae-app-novo\app-v3
$pattern = 'Lucas Borelli|LUCAS BORELLI|001234567|12/03/2008|98765-4321|Marina Borelli|Losartana 50mg|Omeprazol 20mg|Vitamina D 2000UI|Dipirona · Penicilina|2 críticas · 1 leve|Dra. Renata Cardoso|CRM-SP 145.232|Quarta, 21 de maio|Albert Einstein|87% de adesão'
$arquivos = Get-ChildItem *.html | Where-Object { $_.Name -notmatch '^app(\..+|-.+\.html$)|^mapa-v3\.html$' }
foreach ($f in $arquivos) {
  $hits = Select-String -Path $f.FullName -Pattern $pattern
  if ($hits) {
    Write-Host "==== $($f.Name) ====" -ForegroundColor Red
    $hits | Format-Table LineNumber, Line -AutoSize
  }
}
```

## B.4 Limpar cache Vercel

```powershell
# Se deploy tá stale
Invoke-WebRequest "https://vitae-app.vercel.app/app-v3/01-saude.html?nocache=$(Get-Random)" -Method Head
```

---

# APÊNDICE C — Estrutura de Dados Backend

## C.1 Tabelas relevantes (Prisma — somente leitura)

### Usuario

```typescript
{
  id: string;             // UUID
  nome: string;
  email: string;          // unique
  celular: string;        // unique, formato +5511XXXXXXXXX
  senhaHash: string;
  tipo: 'PACIENTE' | 'MEDICO' | 'SECRETARIA';
  fotoUrl: string | null; // base64 ou URL Supabase
  emailVerificado: boolean;
  celularVerificado: boolean;
  criadoEm: Date;
}
```

### PerfilSaude (1:1 com Usuario do tipo PACIENTE)

```typescript
{
  id: string;
  usuarioId: string;       // FK Usuario
  dataNascimento: Date | null;
  tipoSanguineo: 'A_POS'|'A_NEG'|'B_POS'|'B_NEG'|'AB_POS'|'AB_NEG'|'O_POS'|'O_NEG' | null;
  sexoBiologico: 'MASCULINO' | 'FEMININO' | 'OUTRO' | null;
  cpf: string | null;
  peso: number | null;     // kg
  altura: number | null;   // cm
  contatoEmergenciaNome: string | null;
  contatoEmergenciaTel: string | null;
  contatoEmergenciaParentesco: string | null;
  nomeMae: string | null;
  nomePai: string | null;
  telMae: string | null;
  telPai: string | null;
  condicoes: string | null;     // texto livre vírgula
  cirurgias: string[];
  historicoFamiliar: string[];
  limitacoesAcessibilidade: object | null;
}
```

### Alergia

```typescript
{
  id: string;
  usuarioId: string;
  nome: string;
  tipo: 'RASH' | 'URTICARIA' | 'ANAFILAXIA' | 'BRONCOSPASMO' | 'EDEMA' | 'OUTRO' | null;
  gravidade: 'LEVE' | 'MODERADA' | 'GRAVE';
  dataDiagnostico: Date | null;
  medicoDiagnostico: string | null;
  localDiagnostico: string | null;
  observacoes: string | null;
  criadoEm: Date;
}
```

### Medicamento

```typescript
{
  id: string;
  usuarioId: string;
  nome: string;
  dosagem: string | null;        // "50mg"
  dose: string | null;           // "1 comp."
  frequencia: string | null;     // "Todo dia"
  horario: string | null;        // "08:00" ou "08:00,20:00"
  motivo: string | null;
  via: 'ORAL' | 'SUBLINGUAL' | 'TOPICA' | 'INJETAVEL' | 'INALATORIA' | null;
  dataInicio: Date | null;
  dataFim: Date | null;
  ativo: boolean;
  quantidadeEstoque: number | null;
  medicoPrescritor: string | null;
  criadoEm: Date;
}
```

### Exame

```typescript
{
  id: string;
  usuarioId: string;
  tipoExame: string;             // "Hemograma completo", "Glicemia em jejum"
  dataExame: Date | null;
  laboratorio: string | null;
  arquivoUrl: string;            // Supabase Storage
  status: 'PROCESSANDO' | 'CONCLUIDO' | 'ERRO';
  statusGeral: 'NORMAL' | 'ATENCAO' | 'CRITICO' | null;
  resumoIA: string | null;
  parametros: ExameParametro[];  // relação
  impactosIA: object[] | null;   // [{ icone, titulo, texto }]
  melhoriasIA: object[] | null;
  criadoEm: Date;
}
```

### ExameParametro

```typescript
{
  id: string;
  exameId: string;
  nome: string;                  // "Hemoglobina"
  valor: string;                 // "14.5" (string pra preservar não-numéricos)
  unidade: string | null;        // "g/dL"
  valorReferenciaMin: number | null;
  valorReferenciaMax: number | null;
  status: 'NORMAL' | 'ALTO' | 'BAIXO' | 'CRITICO' | null;
  percentualFaixa: number | null; // 0-100
  observacao: string | null;
}
```

### Agendamento

```typescript
{
  id: string;
  usuarioId: string;     // paciente
  medicoId: string | null;
  medicoNome: string;
  especialidade: string | null;
  crm: string | null;
  estado: string | null;
  data: Date;
  hora: string | null;   // "14:30"
  local: string | null;
  endereco: string | null;
  status: 'AGENDADO' | 'CONCLUIDO' | 'CANCELADO' | 'FALTA' | null;
  observacoes: string | null;
  criadoEm: Date;
}
```

### PreConsulta

```typescript
{
  id: string;
  usuarioId: string;        // paciente
  medicoId: string;
  medicoNome: string;
  token: string;            // pra URL pública
  status: 'ABERTO' | 'RESPONDIDO' | 'EXPIRADO';
  perguntas: object[];      // [{ texto, tipo, opcoes }]
  respostas: object | null; // { idx: resposta }
  resumoTexto: string | null;
  audioUrl: string | null;
  dataLimite: Date | null;
  respondidaEm: Date | null;
  criadoEm: Date;
}
```

### Autorizacao

```typescript
{
  id: string;
  pacienteId: string;
  medicoId: string;
  medicoCrm: string;
  duracaoDias: number;     // 30 default
  ativo: boolean;
  criadoEm: Date;
  expiraEm: Date;
}
```

### Consentimento

```typescript
{
  id: string;
  usuarioId: string;
  tipo: 'TERMOS_USO' | 'POLITICA_PRIVACIDADE' | 'DADOS_SAUDE';
  aceito: boolean;
  aceitoEm: Date;
}
```

## C.2 Formato de Resposta Padrão

### Sucesso 200

```json
{ "exames": [...] }
{ "medicamentos": [...] }
{ "alergias": [...] }
{ "usuario": {...}, "perfil": {...} }
```

### Erro 4xx/5xx

```json
{ "erro": "Mensagem amigável", "detalhes": ["campo X é obrigatório"], "codigo": "ERR_X" }
```

### Auth 200

```json
{
  "token": "eyJ...",
  "refreshToken": "abc...",
  "usuario": { "id", "nome", "email", "tipo", "fotoUrl" }
}
```

---

# APÊNDICE D — Glossário

- **PerfilSaude**: tabela 1:1 com Usuario PACIENTE, dados clínicos.
- **vitaeAPI**: objeto global window.vitaeAPI, definido em api-real.js.
- **JWT**: token 30 dias, salvo em `localStorage.vitae_token`.
- **Refresh token**: 90 dias, em `localStorage.vitae_refresh_token`.
- **CMED**: Câmara de Regulação do Mercado de Medicamentos — base usada em `infoMedicamento`.
- **GLP-1**: classe de medicamentos pra obesidade (Ozempic, Mounjaro). Anestesia precisa jejum estendido.
- **Pré-consulta**: formulário que paciente preenche antes da consulta, envia áudio.
- **Anamnese estruturada**: 11 campos preenchidos durante pré-consulta (lado médico, fora desta rodada).
- **Padrões Observados v2**: análise IA dos dados clínicos (5 agentes) — médico.
- **Análise prosódica**: detecção de sinais sutis na voz — médico.
- **IA Collab**: comparativo entre pré-consultas do mesmo paciente.
- **Selo Nivel 0-5**: sistema de confiabilidade de fontes (raiz, não app v3).
- **CFM 2.314/2022**: resolução sobre telemedicina.
- **CFM 2.454/2026**: resolução sobre IA médica (atual — esperando publicação).
- **LGPD Art. 18**: direito do titular acessar e deletar dados.

---

# APÊNDICE E — Resposta a Perguntas Comuns

## E.1 "E se o Vercel deploy falhar?"

Olhar logs em vercel.com/vitaehealth2906-ops/vitae-app/deployments. Se for build error, revert commit + investigar. Se for runtime, rollback via dashboard.

## E.2 "E se o backend Railway dormir (free tier)?"

Tier atual paid. Mas se cair, primeiro request demora ~30s pra acordar. App v3 já tem timeout no AbortController (28s). Pode dar erro no primeiro fetch — UX aceita, retry funciona.

## E.3 "E se um paciente de teste virar 'celebridade' do banco?"

Lucas tem alguns pacientes reais beta (Alvaro, Daniel). NÃO testar com eles. Sempre criar paciente novo com sufixo timestamp.

## E.4 "E se eu encontrar um endpoint não documentado?"

Logar em `tests/bugs-encontrados.json` como `oportunidade: endpoint não usado`. Não usar até Lucas avaliar.

## E.5 "E se um teste passar local mas falhar prod?"

99% das vezes é cache. Tentar:
1. Hard refresh (Ctrl+Shift+R no browser)
2. Aguardar 5min
3. Re-rodar
4. Se ainda falhar: investigar diff de env var, CORS, ou Vercel edge cache

## E.6 "Quanto tempo guardar `tests/credenciais-lotes.json`?"

Manter durante toda execução (não commitar — adicionar em .gitignore). No fim, deletar.

## E.7 "Posso commitar `tests/bugs-encontrados.json`?"

Sim. É registro do trabalho. Comitar junto com docs no fim.

## E.8 "Posso commitar screenshots?"

`tests/shots/lote-N/*.png` são úteis. Mas pesados (vários MB). Sugestão:
- Manter local pra debug
- NÃO commitar (adicionar `tests/shots/` em .gitignore)
- Capturar uns 5-10 PNG significativos pra anexar em PRs futuros (manual)

## E.9 "Como Lucas vai revisar?"

Lucas vai abrir cada lote no celular dele e checar visualmente. Plus rodar `node tests/lote-N-X.js --prod` localmente pra confirmar.

## E.10 "Quando posso considerar Lote X 'realmente pronto'?"

Quando o Playwright dele passou 100% local + prod + Lucas validou. Antes disso é "implementado", não "pronto".

---

# APÊNDICE F — Notas Finais

## F.1 Estilo de código

- Indentação: 2 espaços
- Aspas: simples em JS, duplas em HTML attrs
- Ponto-vírgula: sim, sempre
- Trailing comma: sim em arrays/objects
- Arrow function: preferir em callbacks
- `let` para variáveis que mudam, `const` pro resto
- `async/await` em vez de `.then().then()`

## F.2 Comentários em PT-BR

Comentários em código: PT-BR mas SEM acento (compatibilidade ASCII).

```javascript
// Helper: formata data dd/mm/yyyy
// CRITICO: nao mudar sem alinhar com backend
```

## F.3 Commits PT-BR

Mensagem de commit em PT-BR, formato 0.3.

## F.4 PR (Pull Request)

Cada lote NÃO precisa de PR. Push direto na branch `feat-app-v3-paciente`. Lucas faz PR final pra `main` no cutover.

## F.5 Tags Git

Após cada lote, criar tag opcional:
```powershell
git tag -a "v3-lote-N" -m "Lote N completo"
git push origin v3-lote-N
```

Útil pra rollback granular.

## F.6 Comunicação com Lucas durante execução

Quando precisa intervenção:
1. Salvar em `tests/perguntas-lucas.md`
2. Tirar screenshot do contexto
3. Aguardar Lucas reabrir terminal

NÃO usar push notification — Lucas dorme ou tá em aula.

## F.7 Backups antes de cada lote

```powershell
git stash list
# Se vazio, criar tag de backup
git tag -a "backup-pre-lote-N" -m "Estado antes do Lote N"
```

Rollback fácil: `git reset --hard backup-pre-lote-N`.

## F.8 Não modificar áreas proibidas

Lista explícita de pastas/arquivos NÃO TOCAR (mesmo se parecer útil):

```
backend/                      # backend tem seu próprio repo
frontend/                     # Next.js abandonado
server/                       # wearable abandonado
desktop/                      # app médico (futura phase)
00-escolha.html              # raiz, app antigo
01-splash.html               # raiz
... (todas as telas raiz que não tem app-v3 equivalente)
api.js                        # versão raiz (usar app-v3/api-real.js)
package.json                  # cuidado com deps
```

Se PRECISAR mexer, **PARAR e perguntar**.

## F.9 Sentry, Mixpanel, Analytics

Não configurar nesta rodada. Lote 10 só adiciona window.onerror minimal.

## F.10 Última palavra

Este plano é EXPLÍCITO. Se algum lote tiver ambiguidade, fazer a opção mais CONSERVADORA (menos risco). Quando em dúvida, perguntar.

Sucesso = paciente novo abre app v3 e usa sem perceber que foi reescrito.

---

**FIM DO PLANO**

Tamanho-alvo: 200-400 KB. Tamanho real: ver `wc -c` ao salvar.
Linhas-alvo: 5000-10000. Ver `wc -l`.

Aprovação: Lucas Borelli @ 2026-05-14.
Execução prevista: 30-40h em sessões de 6h.
Resultado esperado: cutover do app paciente vita id pra rota `/app-v3/`.
