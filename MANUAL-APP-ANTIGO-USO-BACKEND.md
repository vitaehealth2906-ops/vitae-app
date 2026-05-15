# Manual do App Paciente Antigo — Como Usa o Backend

> Documento exaustivo, em PT-BR, sem código, para Lucas + Claude usarem como base de replicação no app v3.
> Base: `d:\vitae-app-novo\api.js` (621 linhas) + 24 telas HTML na raiz.
> Atualizado: 14/05/2026.

---

## SUMARIO

1. Inventário do `api.js` (todas as funções `vitaeAPI.*`)
2. Tela-por-tela (24 telas) — propósito, chamadas API, botões, estados, hardcoded
3. Jornadas completas (cadastro, login, scan, QR, pré-consulta, etc)
4. Auth flow (JWT + refresh token)
5. Detecção de URL local vs produção
6. localStorage usado pelo app (todas as chaves)
7. Tradutor de erros centralizado
8. Sanitização XSS
9. Transições (vitaeNav)
10. Cache / otimizações
11. Componentes hardcoded a virar reais no v3

---

## 1. INVENTÁRIO DO `api.js` (621 linhas)

> Caminho: `d:\vitae-app-novo\api.js`. Tudo é exposto em `window.vitaeAPI`.
> Função base: `apiRequest(path, options)` — sempre manda `Authorization: Bearer JWT`, faz refresh automático em 401, sanitiza body.

### 1.1 Helpers globais (não são `vitaeAPI.*` mas estão no arquivo)

| Função | O que faz |
|---|---|
| `sanitize(str)` | Escapa `<`, `>`, `&`, `"`, `'` para evitar XSS |
| `disableBtn(btn)` / `enableBtn(btn, text)` | Trava botão durante request (anti-duplo-clique) |
| `vitaeNav(target)` | Navegação animada — overlay fade + redirect após 400ms. Rotas: perfil/score/exames/qrcode/editar/medicamentos/alergias/agendamentos/autorizacao/bioage |
| `getToken()` / `setTokens(t, r)` | Lê/escreve `vitae_token` + `vitae_refresh_token` no localStorage |
| `getUsuario()` / `setUsuario(u)` | Lê/escreve `vitae_usuario` (JSON) |
| `logout()` | Remove os 3 itens + `window.location.href = '03-cadastro.html'` |
| `isLoggedIn()` | `!!getToken()` |
| `requireAuth()` | Se não logado, redireciona pra `03-cadastro.html` e retorna `false` |
| `apiRequest(path, opts)` | Wrapper de `fetch`. Anexa JWT. Trata FormData. Detecta 401 → chama `refreshTokens()` → retry. Senão, `logout()` |
| `handleResponse(resp)` | Parseia JSON. Em erro, joga `Error(erro + detalhes)` |
| `refreshTokens()` | `POST /auth/refresh` com refresh token. Atualiza tokens. Retorna `boolean` |

### 1.2 Tabela completa de `vitaeAPI.*` (~80 funções)

| # | Função | Método + endpoint | Parâmetros | Retorna | Telas que usam |
|---|---|---|---|---|---|
| 1 | `cadastro` | POST `/auth/cadastro` | `nome, email, celular, senha, tipo` | `{ token, refreshToken, usuario }` | 03-cadastro |
| 2 | `verificarSms` | POST `/auth/verificar-sms` | `celular, codigo` | `{ token, refreshToken, usuario }` (salva no localStorage) | 04-verificacao |
| 3 | `login` | POST `/auth/login` | `email, senha` | `{ token, refreshToken, usuario }` (salva) | 03-cadastro, desktop/login, desktop/01-login |
| 4 | `loginSocial` | POST `/auth/login-social` | `provider, providerToken, nome, email` | `{ token, refreshToken, usuario }` (salva) | 03-cadastro (Google) |
| 5 | `getPerfil` | GET `/perfil` | — | `{ usuario, perfil }` | 03-cadastro, 08-perfil, 05-quiz, 09-dados-pessoais |
| 6 | `buscarPerfil` | GET `/perfil` | — (alias) | igual ao getPerfil | 09-dados-pessoais |
| 7 | `atualizarPerfil` | PUT `/perfil` | objeto com campos do PerfilSaude | `{ perfil }` | 05-quiz, 09-dados-pessoais |
| 8 | `atualizarConta` | PATCH `/perfil/conta` | `{ nome \| email \| celular }` | `{ usuario }` | 09-dados-pessoais |
| 9 | `uploadFoto` | POST `/perfil/foto` | `{ fotoUrl: base64 }` | `{ fotoUrl }` | 05-quiz, 09-dados-pessoais, quiz-preconsulta |
| 10 | `listarExames` | GET `/exames` | — | `{ exames: [...] }` | 08-perfil, 10-score, 11-exames-lista |
| 11 | `getExame` | GET `/exames/:id` | `id` | `{ exame, parametros }` | 11-exames-lista |
| 12 | `uploadExame` | POST `/exames/upload` (FormData) | `file, dataExame?` | `{ exame }` | 11-exames-lista |
| 13 | `deletarExame` | DELETE `/exames/:id` | `id` | `{ ok }` | 11-exames-lista |
| 14 | `listarMedicamentos` | GET `/medicamentos` | — | `{ medicamentos: [...] }` | 08-perfil, 16-medicamentos, 30-lembretes |
| 15 | `adicionarMedicamento` | POST `/medicamentos` | `{ nome, dosagem?, frequencia?, horario?, ... }` | `{ medicamento }` | 16-medicamentos |
| 16 | `removerMedicamento` | DELETE `/medicamentos/:id` | `id` | `{ ok }` | 16-medicamentos |
| 17 | `atualizarMedicamento` | PUT `/medicamentos/:id` | `id, dados` | `{ medicamento }` | 16-medicamentos |
| 18 | `infoMedicamento` | GET `/medicamentos/info/:nome` | `nome` (URL encoded) | `{ info }` | (não usada no app antigo, disponível) |
| 19 | `scanReceita` | POST `/medicamentos/scan` (FormData) | `file` (AbortController 28s) | `{ medicamentos: [...] }` | 27-processando |
| 20 | `listarAlergias` | GET `/alergias` | — | `{ alergias: [...] }` | 08-perfil, 17-alergias, 31-revisao-alergias |
| 21 | `adicionarAlergia` | POST `/alergias` | `{ nome, tipo?, gravidade? }` | `{ alergia }` | 17-alergias, 31-revisao-alergias |
| 22 | `removerAlergia` | DELETE `/alergias/:id` | `id` | `{ ok }` | 17-alergias |
| 23 | `infoAlergia` | GET `/alergias/info/:nome` | `nome` | `{ info }` | (não usada no app antigo) |
| 24 | `scanAlergia` | POST `/alergias/scan` (FormData) | `file` (AbortController 28s) | `{ alergias: [...] }` | 27-processando |
| 25 | `getScoreAtual` | GET `/scores/atual` | — | `{ score, pilares }` | 10-score |
| 26 | `getHistoricoScores` | GET `/scores/historico` | — | `{ historico: [...] }` | 10-score |
| 27 | `getMelhorias` | GET `/scores/melhorias` | — | `{ melhorias: [...] }` | 10-score |
| 28 | `recalcularScores` | POST `/scores/recalcular` | — | `{ score }` | 10-score |
| 29 | `fazerCheckin` | POST `/checkin` | `{ sono, atividade, humor, dor, produtividade }` | `{ checkin }` | (não usada — backend pronto) |
| 30 | `getHistoricoCheckins` | GET `/checkin/historico` | — | `{ historico }` | (não usada) |
| 31 | `getDadosPdf` | POST `/pdf/gerar` | — | `{ pdfUrl }` | (não usada no app antigo) |
| 32 | `getNotificacoes` | GET `/notificacoes` | — | `{ notificacoes }` | (não usada no app antigo) |
| 33 | `cadastroMedico` | POST `/medico` | `{ crm, uf, especialidade, clinica }` | `{ medico }` | 20-medico-cadastro |
| 34 | `getPerfilMedico` | GET `/medico` | — | `{ medico }` | desktop |
| 35 | `atualizarMedico` | PUT `/medico` | dados | `{ medico }` | desktop |
| 36 | `getPacientesMedico` | GET `/medico/pacientes` | — | `{ pacientes }` | desktop |
| 37 | `buscarPacientesMedico` | GET `/medico/pacientes/buscar?q=` | query | `{ pacientes }` | desktop |
| 38 | `getPerfilPacienteMedico` | GET `/medico/pacientes/:id` | `pacienteId` | `{ paciente, perfil, exames, alergias, medicamentos }` | desktop, 11-exames-lista (modo medico) |
| 39 | `migrarAutorizacoes` | POST `/medico/migrar-autorizacoes` | — | `{ ok }` | (admin/manutenção) |
| 40 | `limpezaPreConsultasAntigas` | POST `/medico/limpeza-antigas` | — | `{ ok, removidas }` | desktop |
| 41 | `regenerarSummaryPreConsulta` | POST `/pre-consulta/:id/regenerar` | `preConsultaId` | `{ summary }` | diag-pipeline |
| 42 | `diagnosticoPreConsulta` | GET `/medico/diagnostico-pre-consulta` | — | dados de diagnóstico | diag-pipeline |
| 43 | `getDashboardMedico` | GET `/medico/dashboard` | — | `{ stats }` | desktop |
| 44 | `criarPreConsulta` | POST `/pre-consulta` | dados | `{ preConsulta, link }` | desktop |
| 45 | `listarPreConsultas` | GET `/pre-consulta` | — | `{ preConsultas }` | desktop, diag-pipeline |
| 46 | `getPreConsulta` | GET `/pre-consulta/:id` | `id` | `{ preConsulta }` | desktop, diag-pipeline |
| 47 | `getPreConsultaPorToken` | GET `/pre-consulta/t/:token` | `token` | `{ preConsulta }` | pre-consulta (público) |
| 48 | `responderPreConsulta` | POST `/pre-consulta/t/:token/responder` | `token, dados` | `{ ok }` | pre-consulta (legado) |
| 49 | `responderPreConsultaComAudio` | POST `/pre-consulta/t/:token/responder-audio` (FormData) | `token, { respostas, transcricao, audioBlob, fotoBlob }` | `{ ok }` | pre-consulta (legado) |
| 50 | `deletarPreConsulta` | DELETE `/pre-consulta/:id` | `id` | `{ ok }` | desktop |
| 51 | `deletarPaciente` | DELETE `/pre-consulta/by-patient` | `{ pacienteNome, pacienteTel }` | `{ ok }` | desktop |
| 52 | `verificarTranscricao` | POST `/pre-consulta/t/:token/verificar` | `token, transcricao` | `{ ok, faltam }` | legacy/pre-consulta-backup |
| 53 | `listarTemplates` | GET `/templates` | — | `{ templates }` | desktop |
| 54 | `criarTemplate` | POST `/templates` | dados | `{ template }` | desktop |
| 55 | `editarTemplate` | PUT `/templates/:id` | `id, dados` | `{ template }` | desktop |
| 56 | `apagarTemplate` | DELETE `/templates/:id` | `id` | `{ ok }` | desktop |
| 57 | `classificarPerguntas` | POST `/templates/classificar` | `{ texto }` | `{ perguntas }` | desktop |
| 58 | `gerarPerguntasIA` | POST `/templates/gerar` | `{ instrucao }` | `{ perguntas }` | desktop |
| 59 | `buscarTemplate` | GET `/templates/:id` | `id` | `{ template }` | desktop |
| 60 | `buscarTemplatePublico` | GET `/templates/preview-publico/:id` (sem JWT) | `id` | `{ template }` | legacy |
| 61 | `criarAgendamento` | POST `/agendamento` | dados | `{ agendamento }` | 23-agendamentos |
| 62 | `listarAgendamentos` | GET `/agendamento` | — | `{ agendamentos }` | 23-agendamentos |
| 63 | `getProximoAgendamento` | GET `/agendamento/proximo` | — | `{ agendamento }` | 08-perfil |
| 64 | `atualizarAgendamento` | PUT `/agendamento/:id` | `id, dados` | `{ agendamento }` | (não usada no antigo) |
| 65 | `deletarAgendamento` | DELETE `/agendamento/:id` | `id` | `{ ok }` | 23-agendamentos |
| 66-90 | **Módulo Agenda v1 (médico)** | `/agenda/*` (config, locais, slots, espera, stats, google, secretarias, push) | vários | vários | desktop (médico) + 08-perfil/23-agendamentos (consome `agendaProximoMeu` e `agendaMeusSlots`) |
| 91 | `autorizarMedico` | POST `/autorizacao` | `{ medicoCrm, duracaoDias }` | `{ autorizacao }` | 22-autorizacao |
| 92 | `listarAutorizacoes` | GET `/autorizacao` | — | `{ autorizacoes }` | 22-autorizacao |
| 93 | `revogarAutorizacao` | DELETE `/autorizacao/:id` | `id` | `{ ok }` | 22-autorizacao |
| 94 | `getQrData` | GET `/autorizacao/qr-data` | — | `{ usuario, url, pin }` | 21-qrcode |
| 95 | `registrarConsentimento` | POST `/consentimento` | `{ tipo, aceito }` | `{ consentimento }` | 05-quiz |
| 96 | `listarConsentimentos` | GET `/consentimento` | — | `{ consentimentos }` | (não usada no antigo) |
| 97 | `revogarConsentimento` | DELETE `/consentimento/:id` | `id` | `{ ok }` | (não usada) |
| 98 | `getStatusConsentimentos` | GET `/consentimento/status` | — | `{ status }` | (não usada) |
| 99 | `getTimeline` | GET `/timeline` | — | `{ eventos }` | 08-perfil (shortcut) |
| **Endpoints públicos (fetch direto, NÃO via vitaeAPI)** | | | | | |
| — | RG público | GET `/autorizacao/rg-publico/:userId` (sem JWT) | `userId` | `{ usuario, perfil, alergias, medicamentos, exames }` | rg-publico |
| — | Exame público | GET `/autorizacao/exame-publico/:userId/:examId` | `userId, examId` | `{ exame, parametros }` | exame-publico |
| — | Pré-consulta estado | GET `/pre-consulta/t/:token/estado` (auth opcional) | — | estado V4 | pre-consulta |
| — | Pré-consulta responder | POST `/pre-consulta/t/:token/responder-pergunta` (FormData) | dados | `{ classificacao, motivo }` | pre-consulta (v4) |
| — | Pré-consulta finalizar | POST `/pre-consulta/t/:token/finalizar` | — | `{ ok, summary }` | pre-consulta (v4) |

> **Observação importante:** `vitaeAPI.baseUrl` é exposto pra módulos externos (pre-consulta.html usa `API_BASE` direto pra V4).

---

## 2. TELA-POR-TELA (24 telas)

### TELA: `01-splash.html`

- **Propósito:** abertura animada de 8s. Decide pra onde mandar (perfil ou slides).
- **Init:** `vitaeAPI.isLoggedIn()` no JS (linha ~218). Sem outra chamada API.
- **O que mostra:** logo `vita id` SVG animado, glow pulsante, particles flutuantes, dots de loading, tagline "Know Your Biology".
- **Botões/ações:** nenhum. Auto-redirect em 8.2s.
- **Estados especiais:** sempre o mesmo. Curtain fade-out aos 7s.
- **Hardcoded:** "Know Your Biology" (tagline). Tempo de animação rígido (não configurável). Cor `#0099C4` no logo (não usa o gradiente padrão).
- **Destino:** `08-perfil.html` se logado, senão `02-slides-paciente.html`.

---

### TELA: `02-slides-paciente.html`

- **Propósito:** 3 slides educacionais (Problema → Consequência → Solução). Convence paciente a criar RG.
- **Init:** nenhuma chamada API. Pura UI.
- **O que mostra:**
  - Slide 1 ("O problema"): 4 scatter-cards (exames perdidos, receitas, histórico, medicamentos) + nota "0 lugares onde tudo isso fica junto."
  - Slide 2 ("A consequência"): timeline de 4 consultas repetindo histórico + stat "∞ vezes vai repetir".
  - Slide 3 ("E se fosse diferente?"): contraste antes/depois + CTA card "Seu RG da Saúde · Crie em menos de 5 minutos".
- **Botões/ações:** dots paginação, botão "Próximo" / "Criar meu RG da Saúde" (último slide), "Pular introdução". Swipe horizontal (touch/teclado).
- **Estados especiais:** animações in/out por delay (escalonado por 0.05s).
- **Hardcoded:** todo o texto dos 3 slides. Cor `#0099C4` (não bate com gradiente padrão verde-ciano oficial).
- **Destino:** finish() → `03-cadastro.html` com fade out 350ms.

---

### TELA: `03-cadastro.html`

- **Propósito:** Cadastro novo OU login (toggle). Inclui Google Sign-In.
- **Init:** Se já logado, redireciona automático (linha 549). Lê `vitae_quiz_retorno` da URL (`?retorno=TOKEN` ou `?token=TOKEN`) e salva no localStorage pra voltar pra pré-consulta depois.
- **O que mostra:** Header "Criar conta / Bem-vindo de volta", botão Google grande, divisor "ou", form (nome, celular +55, email, senha), checkbox de termos, CTA gradiente, link "Já tem conta? Entrar".
- **Botões/ações:**
  - "Continuar com Google" → `loginWithGoogle()` → `google.accounts.oauth2.initTokenClient` → `userinfo` → `vitaeAPI.loginSocial('google', sub, name, email)` → redireciona
  - "Criar conta" → `vitaeAPI.cadastro(nome, email, celFormatado, senha, tipoEscolhido)` → salva tokens → redireciona pra `05-quiz.html` (paciente) ou `20-medico-cadastro.html` (médico)
  - "Entrar" → `vitaeAPI.login(email, senha)` → `vitaeAPI.getPerfil()` → se perfil vazio (sem dataNascimento+tipoSanguineo+genero+cpf) → `05-quiz.html`, senão `08-perfil.html`
  - "Esqueci minha senha" → link `14-esqueci-senha.html` (visível só no modo login)
  - Toggle "Já tem conta? Entrar / Não tem conta? Criar conta" → `toggleLogin()` (esconde nome+celular+termos no login)
- **Estados especiais:**
  - Validação inline (botão fica habilitado só com todos os campos + termos aceitos)
  - Máscara de celular automática `(XX) XXXXX-XXXX` via `maskCelular()`
  - Toggle de senha (olho)
  - `errorMsg` aparece em vermelho com detalhes do erro
- **Lógica de retorno:** se veio com `?retorno=TOKEN`, salva em `vitae_quiz_retorno`. Após cadastro/login, `_redirectAfterAuth_perfilOk()` redireciona pra `pre-consulta.html?token=X` se token existe; `_redirectAfterAuth_quizVazio()` vai pra `quiz-preconsulta.html?retorno=X`.
- **Hardcoded:** GOOGLE_CLIENT_ID embutido (linha 452). Bandeira 🇧🇷 emoji. Telefone placeholder `(11) 99999-9999`. Texto dos campos.
- **localStorage:** lê/escreve `vitae_quiz_retorno`, `vitae_tipo_escolhido`. Após sucesso: `vitae_token`, `vitae_refresh_token`, `vitae_usuario`.

---

### TELA: `04-verificacao.html`

- **Propósito:** Digitar código SMS de 6 dígitos.
- **Init:** Lê `vitae_celular_verificacao` do localStorage, formata e exibe.
- **O que mostra:** Ícone 💬, título "Verificação", subtítulo com número, banner "Mensagens · Ver console" (modo DEV), 6 inputs de dígito, timer 60s pra reenviar, botão "Verificar".
- **Botões/ações:**
  - 6 inputs de dígito (auto-foco no próximo, backspace volta) → quando completo, habilita botão
  - "Verificar" → `vitaeAPI.verificarSms(celular, codigo)` → se OK, redireciona (com `vitae_quiz_retorno` se existe → quiz-preconsulta; senão → `05-quiz.html`)
  - "Reenviar código" (após 60s) → ainda TODO (placeholder)
  - Voltar (history.back)
- **Estados especiais:** sucesso → overlay verde com check + auto-redirect em 1.2s. Erro → limpa todos os dígitos + alert.
- **Hardcoded:** Banner DEV "Ver console" (modo Twilio em dev fica no log do backend). Emoji 💬, 📩. Tempo 60s do timer.

---

### TELA: `05-quiz.html` (Quiz vita id — 7 passos + foto)

- **Propósito:** Coleta dados clínicos obrigatórios pra criar o RG da Saúde.
- **Init:** Sem chamada inicial. Lê dados em memória durante o quiz.
- **O que mostra:** Header com progresso (passo X de 4 — atualizar pra 5+ inclusive a tela de foto), 7+ passos (gênero, nascimento, sangue, CPF, altura/peso, contato emergência, condições/cirurgias/plano, foto).
- **Botões/ações:**
  - Botões de cada passo (Continuar/Voltar/Pular)
  - Foto: `<input capture="user">` → comprimir → preview → base64 no `formData.fotoUrl`
  - "Criar meu RG da Saúde" (último passo) → `concluir()`:
    1. `vitaeAPI.atualizarPerfil(profileData)` (genero, dataNascimento, alturaCm, pesoKg, cpf, tipoSanguineo, condicoes, cirurgias, planoSaude, carteirinhaPlano, historicoFamiliar, contatoEmergenciaNome, contatoEmergenciaTel)
    2. `vitaeAPI.uploadFoto(formData.fotoUrl)` (se foto)
    3. `vitaeAPI.registrarConsentimento({ tipo: 'TERMOS_USO', aceito: true })`
    4. `vitaeAPI.registrarConsentimento({ tipo: 'POLITICA_PRIVACIDADE', aceito: true })`
    5. `vitaeAPI.registrarConsentimento({ tipo: 'PROCESSAMENTO_IA', aceito: true })`
    6. setTimeout 800ms → redirect `08-perfil.html`
- **Estados especiais:** se `vitaeAPI.isLoggedIn()` falso, alert + redireciona pra `03-cadastro.html`. Em erro, botão fica vermelho 4s.
- **Hardcoded:** Tipos sanguíneos (8 opções A+/-/B+/-/AB+/-/O+/-). Lista de condições (Diabetes, Hipertensão etc) e cirurgias.

---

### TELA: `06-concluido.html`

- **Propósito:** Celebração após quiz. Confetti, animação check, "Conta criada com sucesso".
- **Init:** Sem chamada API. Lê `vitae_quiz_retorno` no fim.
- **O que mostra:** Check verde grande animado, "Tudo certo, [nome]!", subtítulo "Seu RG da Saúde está pronto", partículas flutuantes.
- **Botões/ações:** Nenhum. Auto-redirect após 5s.
- **Destino:** `pre-consulta.html?token=X` se tinha `vitae_quiz_retorno`, senão `08-perfil.html`.
- **Hardcoded:** Tempo de animação (5s), cores das partículas.

---

### TELA: `08-perfil.html` (HOME — RG da Saúde)

- **Propósito:** Tela principal do paciente. Mostra RG da Saúde (card frente/verso), atalhos rápidos, próxima consulta, alergias, meds, exames count.
- **Init:** 6 chamadas API simultâneas:
  1. `vitaeAPI.getPerfil()` — preenche nome/CPF/sangue/idade/peso/altura/plano/emergência
  2. `vitaeAPI.listarAlergias()` — count + tags no card
  3. `vitaeAPI.listarMedicamentos()` — count + summary
  4. `vitaeAPI.listarExames()` — count concluídos
  5. `vitaeAPI.agendaProximoMeu()` (novo — slot do médico) OU fallback `vitaeAPI.getProximoAgendamento()` (legado)
  6. `vitaeAPI.getTimeline()` — dots da timeline shortcut
- **Auth gate:** se `!vitaeAPI.isLoggedIn()` → `03-cadastro.html`. Se perfil vazio (sem genero+dataNascimento+tipoSanguineo+cpf+contatoEmergenciaNome+planoSaude) → `05-quiz.html`.
- **O que mostra:** RG card 3D flipável (frente: nome+CPF+sangue+idade+alergia+plano; verso: peso+altura+plano+alergias+emergência), atalhos rápidos (Score, Exames, QR, Alergias, Meds, Lembretes, Bio idade, Agendamentos), próxima consulta, timeline shortcut, tab bar 4 itens (Meu RG / Exames / QR / Editar).
- **Botões/ações:** `navigateTo(target)` → routes map → `window.location.href`. Push notifications: `_vitaeSetupPush()` em 2s.
- **Estados especiais:** loading skeleton, erro em cada card individual (não trava tudo). Push opcional (não pede permissão silenciosa).
- **Hardcoded:** "Válido até 03/2028" (fixo no card RG). UF fallback 'BR'. Tab bar (4 itens fixos).

---

### TELA: `09-dados-pessoais.html`

- **Propósito:** Editar perfil + sair da conta.
- **Init:** `vitaeAPI.buscarPerfil()` → preenche todos os campos.
- **O que mostra:** Foto editável, lista de seções (Conta, Dados pessoais, Saúde, Plano, Contato Emergência, Histórico Familiar, Termos), botão Sair.
- **Botões/ações:** Cada campo abre modal de edição. Salva via:
  - `vitaeAPI.atualizarConta({ nome | email | celular })` para campos da Conta
  - `vitaeAPI.atualizarPerfil({ cpf | dataNascimento | genero | tipoSanguineo | alturaCm | pesoKg | condicoes | cirurgias | planoSaude | carteirinhaPlano | contatoEmergenciaNome | contatoEmergenciaTel })`
  - `vitaeAPI.uploadFoto(base64)` ao trocar foto
  - `vitaeAPI.logout()` no botão Sair (redireciona pra `03-cadastro.html`)
- **Estados especiais:** Validação inline (idade entre 1-500kg, etc).
- **Hardcoded:** Lista fixa de tipos sanguíneos, planos de saúde (placeholder).

---

### TELA: `10-score.html`

- **Propósito:** Pontuação de saúde 0-100 com 4 pilares.
- **Init:** 3 chamadas em paralelo:
  1. `vitaeAPI.getScoreAtual()`
  2. `vitaeAPI.listarExames()`
  3. `vitaeAPI.getHistoricoScores()`
- **O que mostra:** Score gigante (anel SVG animado), 4 pilares (Sono/Atividade/Produtividade/Exames com pesos 20/20/20/40%), histórico, dicas de melhoria.
- **Botões/ações:**
  - "Recalcular" → `vitaeAPI.recalcularScores()`
  - "Ver melhorias" → `vitaeAPI.getMelhorias()` → modal/sheet
- **Auth gate:** `!vitaeAPI.isLoggedIn()` → redirect.
- **Estados especiais:** se score=null, mostra "Faça checkin pra calcular". Catch em cada Promise.
- **Hardcoded:** Pesos dos 4 pilares (20/20/20/40), nomes dos pilares.

---

### TELA: `11-exames-lista.html`

- **Propósito:** Lista de exames + upload + detalhe. Suporta modo paciente E modo médico (`?pacienteId=XXX`).
- **Init:**
  - Modo médico: `vitaeAPI.getPerfilPacienteMedico(medicoModePacienteId)` puxa exames do paciente
  - Modo paciente: `vitaeAPI.listarExames()` próprios
- **O que mostra:** Tema escuro. Lista agrupada por ano. Cada card: nome, data, status (CONCLUIDO/PROCESSANDO/ERRO), parâmetros alterados como chips (↑/↓). Botão "Adicionar exame".
- **Botões/ações:**
  - "Adicionar exame" → `<input file>` → `vitaeAPI.uploadExame(file)` → polling de status
  - Click no card → `vitaeAPI.getExame(id)` → modal de detalhe com parâmetros (nome/valor/unidade/referência/status NORMAL/ATENCAO/CRITICO/percentual)
  - "Deletar" → `vitaeAPI.deletarExame(id)`
- **Estados especiais:** Loading shimmer, empty state, modo médico mostra "Voltando para paciente" no botão voltar. Sem JWT mas com pacienteId → permite leitura.
- **Hardcoded:** Lista de tipos de exame (Hemograma, Lipidograma, Tireoide...) com mapeamento de "amigáveis". Cores por status.

---

### TELA: `15-bioage-sem-dados.html`

- **Propósito:** Tela "sem dados" para Idade Biológica (feature ainda não implementada).
- **Init:** Nenhuma chamada API.
- **O que mostra:** Ícone, mensagem "Faça mais exames pra calcular sua idade biológica", CTA "Adicionar exame".
- **Botões/ações:** CTA → `11-exames-lista.html`. Voltar → `08-perfil.html`.
- **Estados especiais:** Sempre o mesmo (estado "sem dados").
- **Hardcoded:** Tudo é estático (sem integração).

---

### TELA: `16-medicamentos.html`

- **Propósito:** CRUD de medicamentos + scan de receita.
- **Init:** `vitaeAPI.listarMedicamentos()` → renderiza lista.
- **O que mostra:** Cards de medicamentos (ícone, nome, dosagem, frequência, horário em badge verde, motivo, prescritor). Botão "+ Adicionar manual" e "Escanear receita".
- **Botões/ações:**
  - "Adicionar" → modal com campos (nome, dosagem, frequência, horário) → se editing: `vitaeAPI.atualizarMedicamento(id, dados)`; senão: `vitaeAPI.adicionarMedicamento(dados)`
  - "Escanear receita" → `26-scan-receita.html`
  - Lixeira → `vitaeAPI.removerMedicamento(id)` (com confirm)
- **Estados especiais:** Empty state acolhedor. Skeleton loading.
- **Hardcoded:** Placeholder "Ex: Rivotril, Losartana..." (linha 428). Frequências sugeridas.

---

### TELA: `17-alergias.html`

- **Propósito:** CRUD de alergias + scan.
- **Init:** `vitaeAPI.listarAlergias()`.
- **O que mostra:** Pills de alergias agrupadas por gravidade (grave/moderada/leve), por categoria (medicamento/alimento/ambiental). Botão "+ Adicionar" e "Escanear".
- **Botões/ações:**
  - "Adicionar" → input nome → `vitaeAPI.adicionarAlergia({ nome })` (sem tipo/gravidade nesse fluxo simples)
  - X na pill → `vitaeAPI.removerAlergia(id)`
  - "Escanear" → `26-scan-receita.html?tipo=alergia`
- **Estados especiais:** Empty state. Pills vermelhas semanticas.
- **Hardcoded:** Sugestões comuns (Penicilina, Dipirona) em UI.

---

### TELA: `21-qrcode.html`

- **Propósito:** QR Code do RG da Saúde para compartilhar com médico.
- **Init:**
  - `vitaeAPI.getUsuario()` → pega `id` do usuário
  - Monta URL: `window.location.origin + 'rg-publico.html?id=' + userId`
  - Gera QR via lib `QRCode` (lado client)
  - Tenta `vitaeAPI.getQrData()` para dados extras de compartilhamento (não bloqueia QR)
- **O que mostra:** QR Code 240x240 centralizado, nome do usuário, botões Download e WhatsApp.
- **Botões/ações:**
  - "Download" → `downloadQR()` extrai canvas → toDataURL → link download "vitae-rg-saude.png"
  - "WhatsApp" → `shareWhatsApp()` → `https://wa.me/?text=...`
  - "Copiar link" → `copyLink()` → `navigator.clipboard.writeText(publicUrl)`
- **Estados especiais:** Sem login → "Faça login para ver seu QR Code".
- **Hardcoded:** Cores do QR (`#0D0F14` dark, `#fff` light). correctLevel `M`.

---

### TELA: `22-autorizacao.html`

- **Propósito:** Gerenciar autorizações ativas a médicos (vincular por CRM + duração).
- **Init:** `vitaeAPI.listarAutorizacoes()` → renderiza cards.
- **O que mostra:** Cards de médicos autorizados (nome, especialidade, status Ativo/Revogado), botão "+ Autorizar médico", modal de CRM + duração.
- **Botões/ações:**
  - "Autorizar" → modal → `vitaeAPI.autorizarMedico({ medicoCrm, duracaoDias })` (default 30 dias) → alert sucesso
  - "Revogar acesso" → confirm → `vitaeAPI.revogarAutorizacao(id)`
- **Estados especiais:** Empty state. Avatar `⚕️` emoji genérico.
- **Hardcoded:** Emoji ⚕️ (linha 139). Duração default 30 dias.

---

### TELA: `23-agendamentos.html`

- **Propósito:** Lista de consultas marcadas (do paciente).
- **Init:**
  - Tenta `vitaeAPI.agendaMeusSlots()` (novo — slots do médico via Agenda v1)
  - Fallback: `vitaeAPI.listarAgendamentos()` (legado)
- **O que mostra:** Cards com ícone (consulta/exame/retorno), título, data/hora, local, X pra cancelar (só futuros).
- **Botões/ações:**
  - "Criar agendamento" → modal título + data → `vitaeAPI.criarAgendamento({ titulo, tipo: 'EXAME', dataHora })`
  - X → confirm → `vitaeAPI.deletarAgendamento(id)`
- **Estados especiais:** Empty state. Slots passados ficam opacity 0.5.
- **Hardcoded:** Tipo default `'EXAME'`. Ícones por tipo (SVG hardcoded).

---

### TELA: `26-scan-receita.html`

- **Propósito:** Câmera/galeria pra escanear receita (medicamentos) ou alergia.
- **Init:** `vitaeAPI.requireAuth()` (redirect se não logado).
- **O que mostra:** 2 botões grandes: "Tirar foto da receita" (capture="environment") e "Escolher da galeria".
- **Botões/ações:**
  - File input → `enviarArquivo(input)`:
    1. `URL.createObjectURL(file)` → blob URL
    2. `sessionStorage.setItem('vitae_scan_blob', blobUrl)`
    3. `sessionStorage.setItem('vitae_scan_name', file.name)`
    4. `sessionStorage.setItem('vitae_scan_type', file.type)`
    5. `window.location.href = '27-processando.html'` (preserva `?tipo=alergia`)
- **Estados especiais:** Apenas estado inicial. Sem preview.
- **Hardcoded:** Texto da call-to-action. Aceita JPG/PNG/PDF.

---

### TELA: `27-processando.html`

- **Propósito:** Loading enquanto IA processa scan.
- **Init:** `vitaeAPI.requireAuth()`. Lê `?tipo=receita|alergia` da URL.
- **O que mostra:** Spinner, título "Processando...", subtítulo dinâmico ("Lendo texto da imagem"), barra de progresso textual com checks.
- **Botões/ações:**
  - `processar()`:
    1. Lê blob do sessionStorage
    2. Valida formato (rejeita HEIC/HEIF com mensagem amigável pra iPhone)
    3. `comprimirImagem(file, 1600, 2400, 0.75)` (canvas com timeout 8s de safety net)
    4. Chama `vitaeAPI.scanAlergia(file)` ou `vitaeAPI.scanReceita(file)`
    5. Salva resultado em `sessionStorage.vitae_scan_result`
    6. Redireciona `31-revisao-alergias.html` (sempre — usa essa tela pra medicamentos também)
  - "Tentar novamente" → `26-scan-receita.html`
- **Estados especiais:** `mensagemErroAmigavel()` mapeia erros (network → "Sem conexão", 413 → "Foto muito grande", timeout/504 → "Demorou demais", 503/credit/quota → "Serviço indisponível", 401 → "Sessão expirada"). HEIC do iPhone tem mensagem específica "Ajustes > Câmera > Formatos > Mais Compatível".
- **Hardcoded:** Mensagens dos passos ("Identificando medicamentos..."). Limites compressão (1600x2400, 0.75). Timeout 8s safety net + 28s AbortController.

---

### TELA: `30-lembretes.html`

- **Propósito:** Lembretes de doses de medicamento (manhã/tarde/noite) + adesão diária.
- **Init:** `vitaeAPI.listarMedicamentos()` → constrói schedule a partir do `horario` de cada med.
- **O que mostra:** Anel SVG de adesão (% de doses tomadas hoje), próxima dose pendente, slots agrupados em "Já tomados" e "Pendentes".
- **Botões/ações:**
  - Click slot pendente → `takeDose(id)` → adiciona ID a `vitae_taken_today` (localStorage) + render
  - Click slot tomado → `untakeDose(id)` → remove ID
  - Voltar → `08-perfil.html?from=nav`
  - Nav tab → routes map
- **Estados especiais:** Lista de "tomados" zera a cada novo dia (`vitae_taken_date` !== todayKey). Empty state se zero meds.
- **Hardcoded:** Lógica de período baseada na hora (manhã <12, tarde <18, noite). Persistência só client-side (lista de IDs no localStorage — backend não rastreia adesão).

---

### TELA: `31-revisao-alergias.html`

- **Propósito:** Revisar alergias/medicamentos extraídos do scan ANTES de salvar.
- **Init:** `vitaeAPI.listarAlergias()` para marcar quais já existem (`existing=true`).
- **O que mostra:** Lista agrupada por categoria (medicamento vermelho / alimento amarelo / substância verde). Cada item: ícone, nome, detalhe ("Já registrada", "Confirmada manualmente", etc), toggle ON/OFF ou edit pencil (para incertos).
- **Botões/ações:**
  - Toggle → `toggleAllergy(i)` → flip `enabled`
  - Edit (incerto) → confirm → marca como `uncertain=false`
  - "Confirmar X alergias novas" → loop `vitaeAPI.adicionarAlergia({ nome, tipo: 'MEDICAMENTO|ALIMENTO|AMBIENTAL', gravidade: 'MODERADA' })` → redirect `17-alergias.html`
- **Estados especiais:** Tratamento de scan inválido (foto borrada) → tela alternativa "Foto não reconhecida" com 2 botões.
- **Hardcoded:** Gravidade fixa `'MODERADA'` (ignora classificação da IA — bug conhecido). Tipos mapeados: medicamento → `MEDICAMENTO`, alimento → `ALIMENTO`, substancia → `AMBIENTAL`. Mensagem "Dipirona já constava no seu perfil" se 1 existente.

---

### TELA: `rg-publico.html` (sem login — quem escaneia o QR)

- **Propósito:** Versão pública do RG. Médico vê dados do paciente direto.
- **Init:** Lê `?id=USER_ID` da URL. `fetch direto`: `GET ${API_URL}/autorizacao/rg-publico/${userId}` (sem JWT, endpoint público).
- **O que mostra:** Cartão RG estilizado (frente nome+CPF+sangue, verso peso/altura/plano/alergias/emergência), bloco "ALERGIAS" (pills vermelhas, GRAVE com warn-box), MEDICAMENTOS (pills azuis, GLP-1 com alert), CONDIÇÕES, CIRURGIAS, HISTÓRICO FAMILIAR, CONTATOS EMERGÊNCIA, EXAMES (cards com score 0-10 + chips de status).
- **Botões/ações:** Click em card de exame → `exame-publico.html?user=USER_ID&exam=EXAM_ID`.
- **Estados especiais:** Sem login (modo público). Detecta GLP-1 (Ozempic/Mounjaro) → alert "jejum 24-48h para anestesia".
- **Hardcoded:** "Validade até [ano]" calculado. Detecção GLP-1 por nome. Lista de cores `--green:#00E5A0`. Mapping de nomes amigáveis pra exames.
- **NÃO usa `vitaeAPI`** — usa fetch direto.

---

### TELA: `exame-publico.html` (sem login)

- **Propósito:** Detalhe de um exame específico compartilhado.
- **Init:** Lê `?user=&exam=` da URL. `fetch direto`: `GET ${API_URL}/autorizacao/exame-publico/${EXAM_USER_ID}/${EXAM_ID}`.
- **O que mostra:** Hero card com nome amigável (Painel Completo, Perfil do Coração, Função Tireoide, etc), data, score 0-10, narrativa IA, status boxes (NORMAL/ATENCAO/CRITICO), parâmetros detalhados com gauge/needle, recomendações.
- **Botões/ações:** Voltar → `rg-publico.html?id=USER_ID`. Sem auth.
- **Estados especiais:** Stack de screens com push/pop (deep navigation). Toast 2.8s.
- **Hardcoded:** Mapping de nomes técnicos pra amigáveis (`toNomeAmigavel`). Meses PT-BR. Cálculo score (% de normais).
- **NÃO usa `vitaeAPI`** — usa fetch direto.

---

### TELA: `quiz-preconsulta.html`

- **Propósito:** Quiz vita id que paciente faz vindo do link de pré-consulta (quando perfil está vazio).
- **Init:** Lê `?retorno=TOKEN` ou `?token=TOKEN` da URL. Salva em `vitae_pre_consulta_token` + `vitae_quiz_retorno`. Carrega Air Datepicker pra data de nascimento.
- **O que mostra:** 7 passos espelhando `05-quiz.html` + tela de foto obrigatória no final.
- **Botões/ações:**
  - Anti-duplo-clique: flag `_concluindo` + `btn.disabled` no primeiro click
  - `vitaeAPI.atualizarPerfil(profileData)`
  - `vitaeAPI.uploadFoto(formData.fotoUrl)`
  - `vitaeAPI.adicionarAlergia({ nome })` para alergias listadas no quiz (loop)
  - `vitaeAPI.adicionarMedicamento({ nome })` para meds listados (loop)
  - `vitaeAPI.registrarConsentimento` x3 (TERMOS_USO, POLITICA_PRIVACIDADE, DADOS_SAUDE)
  - `vitaeAPI.uploadExame(file)` (passo 6 — opcional, dropzone direto)
  - Concluir → marca `vitae_quiz_completo=1` → remove `vitae_pre_consulta_token` + `vitae_quiz_retorno` → redirect `pre-consulta.html?token=X&voltei=quizvid`
- **Estados especiais:** Datepicker PT-BR (mês português completo). Botão "Salvando…" durante request. Em erro, libera de novo.
- **Hardcoded:** Lista de meses PT-BR no datepicker. Limite 1200px de foto.

---

### TELA: `pre-consulta.html` (V4 hibrido — paciente responde)

- **Propósito:** Paciente abre link do médico, faz onboarding, login (se preciso), quiz, grava áudio por pergunta OU responde por texto, revisa e envia.
- **Init:** Não usa `vitaeAPI` diretamente em todas as chamadas (V4 usa `fetch` direto pra `${API_BASE}/pre-consulta/t/${TOKEN}/...`). API_BASE = `vitaeAPI.baseUrl`.
- **State machine FLUXO:** Consolidada em 3 chaves localStorage por token: `vitae_pc_state_TOKEN`, `vitae_onb_v2_TOKEN`, `vitae_bv_visto_TOKEN`. Decide via `rotearProximaTela()` qual tela mostrar.
- **Telas internas:**
  - `screen-loading` (decide rota inicial)
  - `screen-erro` (404/410/409 com mensagens traduzidas)
  - `screen-onb1` (3 slides pré-login)
  - `screen-login` / `screen-esqueci-senha` / `screen-email-enviado` / `screen-nova-senha`
  - `screen-onb2` (3 slides pós-login antes do quiz)
  - `screen-quiz-vid` (redireciona pra `quiz-preconsulta.html` se perfil vazio — não inlineado)
  - `screen-questao` (pergunta atual com modo áudio OU texto, toggle persistente)
  - `screen-revisao` (lista de 11+ respostas com edit/refazer)
  - `screen-enviado` (sucesso)
  - `screen-sair-sem-enviar` / `screen-sessao-expirou` / `screen-servidor-caiu`
- **Lógica de áudio:**
  - MediaRecorder.start(1000) chunks a 1s
  - Detector RMS local (threshold 0.006 — calibrado pra voz natural)
  - 5s silêncio = fim de fala (envia automaticamente)
  - Wake Lock (iOS 16.4+)
  - Limite 5min com alerta visual (timer amarelo 4min, vermelho 4:30)
  - Cap 3 pausas manuais
  - Visibility change auto-pausa
- **Endpoints (fetch direto com `authHeaders()`):**
  - `GET /pre-consulta/t/:token/estado` — carrega progresso V4
  - `GET /pre-consulta/t/:token` — info do template
  - `POST /pre-consulta/t/:token/responder-pergunta` (FormData) — envia áudio/texto da pergunta atual
  - `POST /pre-consulta/t/:token/finalizar` — fecha pré-consulta + dispara summary IA
  - `vitaeAPI.cadastro` / `vitaeAPI.login` / `vitaeAPI.loginSocial` / `vitaeAPI.esqueciSenha` (login gate inline)
  - `vitaeAPI.getPerfil()` — checa se perfil completo (retry 4x com 800ms se `?voltei=quizvid`)
- **Estados especiais:**
  - 5 tipos de falha de áudio: `sem_voz` (blob <500 bytes), `rede` (offline), `servidor` (5xx), `backend` (4xx), `transcricao_falhou` (200 mas sem texto)
  - Banner offline com validação real (fetch /health antes de gritar)
  - In-app browser detector (WhatsApp/IG/FB) → tela "Abra no navegador"
  - Sheet permissão mic (1ª vez vs 2ª+)
  - Tradutor de erros: `traduzirErro(erro)` + dicionário `CAMPOS_AMIGAVEIS` (cpf → CPF, dataNascimento → Data de nascimento, etc)
- **Hardcoded:** Threshold RMS 0.006. Threshold confiança 0.85 (autônomo) / 0.60 (ambíguo). Mínimo 7/11 respostas. Tempo silêncio 5s. Limite 5min. Cap 3 pausas.

---

## 3. JORNADAS COMPLETAS (fluxo end-to-end)

### Jornada A — Primeiro cadastro de paciente
```
01-splash (8s) → 02-slides-paciente (3 slides) →
03-cadastro (form + termos) → vitaeAPI.cadastro() → JWT salvo →
[SMS NÃO é usado pelo backend de prod hoje — usa Twilio mas verificação SMS ainda obrigatória] →
04-verificacao (digita código) → vitaeAPI.verificarSms() →
05-quiz (7 passos: gênero/nascimento/sangue/CPF/altura/peso/condições/cirurgias/plano/emergência/foto) →
vitaeAPI.atualizarPerfil() + vitaeAPI.uploadFoto() + 3x vitaeAPI.registrarConsentimento() →
06-concluido (5s confetti) → 08-perfil
```

### Jornada B — Login retorno
```
01-splash → isLoggedIn=true → 08-perfil
(direto, sem passar por slides nem cadastro)
```

### Jornada C — Esqueci senha
```
03-cadastro (modo login) → "Esqueci minha senha" →
14-esqueci-senha (digita email) → vitaeAPI.esqueciSenha(email) →
[paciente recebe email Resend com link] →
15-nova-senha?token=X (nova senha) → 03-cadastro
```

### Jornada D — Upload de exame
```
08-perfil → "Exames" tab → 11-exames-lista →
"+ Adicionar exame" → file picker → vitaeAPI.uploadExame(file) →
backend processa via Claude API (extrai parâmetros) →
status PROCESSANDO → CONCLUIDO (polling no frontend ou refresh) →
click no card → vitaeAPI.getExame(id) → modal detalhe
```

### Jornada E — Scan receita
```
16-medicamentos → "Escanear receita" → 26-scan-receita →
file input (capture=environment ou galeria) → blob no sessionStorage →
27-processando → comprimirImagem(1600x2400, 0.75) →
vitaeAPI.scanReceita(file) → Gemini identifica meds →
31-revisao-alergias (mesma tela pra meds e alergias — usa categoria) →
toggle ON/OFF cada item → "Confirmar X" → loop vitaeAPI.adicionarMedicamento/Alergia →
17-alergias (ou 16-medicamentos)
```

### Jornada F — QR + médico escaneia
```
08-perfil → "QR Code" tab → 21-qrcode →
gera QR client-side (lib QRCode) com URL pública rg-publico.html?id=USER_ID →
médico escaneia com câmera do celular → abre rg-publico.html →
fetch direto /autorizacao/rg-publico/:userId (SEM JWT) →
mostra dados públicos (RG + alergias + meds + condições + exames) →
click exame → exame-publico.html?user=&exam= → detalhe
```

### Jornada G — Autorizar médico
```
08-perfil → atalho "Autorizações" → 22-autorizacao →
vitaeAPI.listarAutorizacoes() → cards existentes →
"+ Autorizar médico" → modal CRM + duração →
vitaeAPI.autorizarMedico({ medicoCrm, duracaoDias: 30 }) →
backend cria AutorizacaoAcesso → médico passa a ver paciente no dashboard
```

### Jornada H — Responder pré-consulta (paciente novo)
```
WhatsApp do médico → link pre-consulta.html?token=X →
FLUXO.decidir() → screen-erro se 404/410, senão screen-onb1 →
3 slides intro → screen-login →
vitaeAPI.cadastro(nome, email, '+55' + cel, senha, 'PACIENTE') →
salva vitae_quiz_retorno=TOKEN →
screen-onb2 → quiz-preconsulta.html?retorno=TOKEN (perfil vazio) →
vitaeAPI.atualizarPerfil + uploadFoto + adicionarAlergia x N + adicionarMedicamento x N + registrarConsentimento x 3 →
volta pra pre-consulta.html?token=X&voltei=quizvid →
retry getPerfil() 4x → screen-questao (V4 quiz pergunta-por-pergunta) →
áudio ou texto por pergunta → POST /responder-pergunta (FormData) →
screen-revisao (11+ respostas) → POST /finalizar →
screen-enviado → médico recebe summary IA
```

### Jornada I — Responder pré-consulta (paciente já cadastrado)
```
WhatsApp do médico → link pre-consulta.html?token=X →
FLUXO.decidir() → autoLogin via JWT existente →
vitaeAPI.getPerfil() → completo → pula quiz →
screen-questao direto → resto igual
```

### Jornada J — Ver score
```
08-perfil → "Score" atalho → 10-score →
3 chamadas paralelas (atual + exames + historico) →
anel SVG anima → 4 pilares com pesos →
"Ver melhorias" → vitaeAPI.getMelhorias() → modal
```

### Jornada K — Ver/editar perfil
```
08-perfil → tab "Editar" → 09-dados-pessoais →
vitaeAPI.buscarPerfil() → preenche →
click campo → modal → vitaeAPI.atualizarConta() OU atualizarPerfil() →
salva → toast → "Sair da conta" → vitaeAPI.logout() → 03-cadastro
```

### Jornada L — Lembrete medicamento
```
08-perfil → atalho "Lembretes" → 30-lembretes →
vitaeAPI.listarMedicamentos() → constrói schedule por horário →
anel adesão (% client-side) → click pendente → marca local (vitae_taken_today) →
zera todo dia (vitae_taken_date)
```

### Jornada M — Ver agendamento
```
08-perfil → "Agenda" → 23-agendamentos →
tenta vitaeAPI.agendaMeusSlots() (novo) → fallback listarAgendamentos() →
cards futuros (clicável X) + passados (opacity 0.5) →
"+ Criar" → modal título + data → vitaeAPI.criarAgendamento({ tipo: 'EXAME', ... })
```

### Jornada N — Login com Google
```
03-cadastro → "Continuar com Google" → loginWithGoogle() →
google.accounts.oauth2.initTokenClient → popup →
fetch userinfo (googleapis.com/oauth2/v3/userinfo) →
vitaeAPI.loginSocial('google', userInfo.sub, userInfo.name, userInfo.email) →
salva tokens → vitaeAPI.getPerfil() → vazio → 05-quiz; completo → 08-perfil
```

### Jornada O — Ver RG público (médico/emergência)
```
Câmera escaneia QR → URL rg-publico.html?id=USER_ID →
fetch direto API_URL/autorizacao/rg-publico/USER_ID →
RG card frente/verso → blocos: ALERGIAS → MEDICAMENTOS (com GLP-1 warn) → CONDIÇÕES → CIRURGIAS → HISTÓRICO FAMILIAR → CONTATOS EMERGÊNCIA → EXAMES (clicáveis)
```

### Jornada P — Ver exame público
```
rg-publico → click card exame → exame-publico.html?user=X&exam=Y →
fetch /autorizacao/exame-publico/X/Y →
hero (score 0-10) + narrativa IA + parâmetros com gauge + recomendações
```

---

## 4. AUTH FLOW (JWT + refresh token)

### Chaves no localStorage
- `vitae_token` — JWT de acesso (30 dias)
- `vitae_refresh_token` — Refresh token (90 dias)
- `vitae_usuario` — JSON com `{ id, nome, email, tipo, fotoUrl, ... }`

### Como api.js detecta 401
```
apiRequest():
  fetch com Authorization: Bearer JWT
  se response.status === 401 && getRefreshToken():
    refreshTokens():
      POST /auth/refresh com { refreshToken }
      se OK → setTokens(novo, novo) → return true
      senão → return false
    se refreshed:
      retry fetch com novo JWT
      return handleResponse(retry)
    senão:
      logout() → '03-cadastro.html'
      throw 'Sessao expirada'
```

### Cenário refresh expirou
1. JWT antigo expira → 401 na próxima chamada
2. Tenta refresh → backend retorna 401 (refresh também expirou)
3. `logout()` é chamado: remove os 3 itens + redirect pra `03-cadastro.html`
4. Paciente vê tela de cadastro/login do zero

### `requireAuth()` em telas
Telas como `26-scan-receita`, `27-processando` chamam `vitaeAPI.requireAuth()` no topo do script. Se falso, redireciona imediatamente.

---

## 5. DETECÇÃO URL LOCAL vs PRODUÇÃO

### Lógica em api.js (linha 59)
```
const API_URL = ['localhost','127.0.0.1'].includes(window.location.hostname) || window.location.protocol === 'file:'
  ? 'http://localhost:3002'
  : 'https://vitae-app-production.up.railway.app';
```

### Override
- `window.API_URL` pode ser sobrescrito antes de carregar api.js (não usado no app antigo)
- `?api=local` na URL NÃO é suportado no app antigo (não há lógica)
- Em `rg-publico.html` e `exame-publico.html`, a detecção é **duplicada** (mesmo código copiado, sem usar `vitaeAPI`)
- `vitaeAPI.baseUrl` é exposto pra outros módulos (usado por `pre-consulta.html` V4)

---

## 6. localStorage USADO PELO APP

| Chave | Quem escreve | Quem lê | Pra que |
|---|---|---|---|
| `vitae_token` | api.js + 03-cadastro + 04-verificacao | api.js (todas as chamadas) | JWT de acesso |
| `vitae_refresh_token` | api.js | api.js (refresh) | Refresh token |
| `vitae_usuario` | api.js + 03-cadastro + 04-verificacao + desktop | quase todas as telas | JSON do usuário logado |
| `vitae_celular_verificacao` | 03-cadastro | 04-verificacao | Mostrar número formatado |
| `vitae_quiz_retorno` | 03-cadastro + pre-consulta + quiz-preconsulta + 04-verificacao | 03-cadastro + 04-verificacao + 06-concluido + quiz-preconsulta | Voltar pra pré-consulta após cadastro/quiz |
| `vitae_pre_consulta_token` | quiz-preconsulta | quiz-preconsulta + 30-quiz (v3) | Token do link de pré-consulta |
| `vitae_tipo_escolhido` | (escolha paciente/médico antes do cadastro) | 03-cadastro | Define `tipo` no cadastro (PACIENTE/MEDICO) |
| `vitae_taken_today` | 30-lembretes | 30-lembretes | Array de IDs de medicamentos tomados hoje |
| `vitae_taken_date` | 30-lembretes | 30-lembretes | Data atual (YYYY-MM-DD) — pra zerar lista diariamente |
| `vitae_bv_visto_TOKEN` | pre-consulta + slides | pre-consulta | Marca onboarding 1 visto por token |
| `vitae_onb_v2_TOKEN` | pre-consulta v2 | pre-consulta v2 | Marca onboarding 2 visto |
| `vitae_pc_state_TOKEN` | pre-consulta (state machine FLUXO) | pre-consulta | Estado consolidado do paciente nessa pré-consulta |
| `vitae_quiz_completo` | quiz-preconsulta + app-v3 | app-v3 | Marca quiz vitalício concluído |
| `vitae_onb_quiz_visto` | app-v3 onboarding | app-v3 | Marca onboarding quiz visto |
| `vitae_admin_token` | dashboard-admin | dashboard-admin | Token admin separado |
| `vitae_usar_legacy` | desktop/app-v2 | desktop | Toggle modo legacy do desktop |
| `vitae_theme` | desktop/app.html | desktop | Tema dark/light no desktop |

> **Não tem `vitae_tpl_onboarding_visto` no app antigo** — essa é do desktop médico (`vitae_tour_visto`).

---

## 7. TRADUTOR DE ERROS CENTRALIZADO

> Implementado em `pre-consulta.html` como `traduzirErro(erro)` e replicado como `qpTraduzirErro` em `quiz-preconsulta.html`. NÃO está em `api.js`.

### Mapeamento por categoria
| Padrão no erro | Mensagem traduzida |
|---|---|
| `409` ou "duplicado" | "Ja existe conta com esses dados. Tenta entrar." |
| `401` ou "unauthoriz" | "Sua sessao expirou. Faz login de novo." |
| `500`/`502`/`503`/`504` | "Servidor com problema temporario. Suas respostas estao salvas. Tenta de novo em segundos." |
| `network`/`fetch`/`failed` | "Sem conexao com o servidor. Verifica internet." |
| `404` | "Link nao encontrado. Pede outro pro medico." |
| `410` | "Link expirado. Pede um novo pro medico." |
| `413` ou "too large" | "Foto muito grande" |
| Zod `campo: msg` | Lista traduzida (usa CAMPOS_AMIGAVEIS) |
| "cobertura insuficiente" | "Volta e responde — pode dizer 'nao sei'" |

### Dicionário `CAMPOS_AMIGAVEIS` (~20 campos)
```
cpf → "CPF"
dataNascimento → "Data de nascimento"
alturaCm → "Altura"
pesoKg → "Peso"
contatoEmergenciaNome → "Nome do contato de emergência"
contatoEmergenciaTel → "Telefone do contato de emergência"
genero → "Gênero"
tipoSanguineo → "Tipo sanguíneo"
condicoes → "Condições"
cirurgias → "Cirurgias"
planoSaude → "Plano de saúde"
carteirinhaPlano → "Número da carteirinha"
historicoFamiliar → "Histórico familiar"
nome → "Nome"
email → "Email"
celular → "Celular"
senha → "Senha"
```

### Em `27-processando.html` há outro mapeamento separado (`mensagemErroAmigavel`) específico pra scan — mais simples (network → "Sem conexão", 413 → "Foto muito grande", 504 → "Demorou demais", 503/credit/quota → "Serviço indisponível", 401 → "Sessão expirada", default → "Tente com mais luz e sem reflexos").

---

## 8. SANITIZAÇÃO XSS

### Função `sanitize(str)` em api.js (linhas 8-16)
```
Escapa: & → &amp;, < → &lt;, > → &gt;, " → &quot;, ' → &#039;
Trata null/undefined → ''
```

### Onde é usada
- `08-perfil.html` — `sanitize(usuario.fotoUrl)`, `sanitize(i.nome)`, `sanitize(a.nome)` em todo rendering de campos do usuário/exames/alergias
- Quase todas as telas que usam template strings com dados do usuário (`${sanitize(x)}`)
- Telas públicas (rg-publico, exame-publico) **NÃO usam** `sanitize` (não importam api.js) — esse é um gap

---

## 9. TRANSIÇÕES (vitaeNav)

### Função `vitaeNav(target)` em api.js (linhas 39-57)
```
1. Pega elemento #exitOverlay (se existir) → adiciona class 'active' (fade overlay branco)
2. setTimeout 400ms → window.location.href = routes[target]
```

### Rotas mapeadas
```
perfil      → 08-perfil.html?from=nav
score       → 10-score.html
exames      → 11-exames-lista.html
qrcode      → 21-qrcode.html
editar      → 09-dados-pessoais.html
medicamentos → 16-medicamentos.html
alergias    → 17-alergias.html
agendamentos → 23-agendamentos.html
autorizacao → 22-autorizacao.html
bioage      → 15-bioage-sem-dados.html
default     → 08-perfil.html
```

### Quem usa
- A tab bar usa `navigateTo(target)` próprio em vez de `vitaeNav` (cada tela implementa próprio)
- Botões de atalho no `08-perfil` usam `navigateTo(target, param)`
- `vitaeNav` é o helper genérico, mas a implementação real é por tela

---

## 10. CACHE / OTIMIZAÇÕES

### Cache em memória (variáveis JS)
- `08-perfil.html` mantém `usuario`, `perfil`, `alergias`, `meds`, `exames` em variáveis JS após primeiro load
- `11-exames-lista.html` cacheia exames em `currentExams` (lista)
- `30-lembretes.html` cacheia `schedule` (derivado de medicamentos)

### Cache em localStorage
- `vitae_taken_today` (lembretes) — persiste entre sessões
- Desktop (`app-v2.html`) tem cache real com `vitae_cache_dr`, `vitae_cache_pacientes`, `vitae_cache_pcs`, `vitae_cache_templates` com timestamp (1 hora) — **app antigo paciente NÃO tem cache em localStorage**

### Chamadas em paralelo
- `08-perfil.html` dispara 6 chamadas em paralelo no init (não bloqueia uma na outra)
- `10-score.html` 3 chamadas paralelas (Promise.all com `.catch` individual)

### Otimizações de scan
- `comprimirImagem()` em canvas (1600x2400 max, JPEG 0.75) reduz ~70% do tamanho antes de subir
- Safety net 8s no compressor (se imagem corrompida, fallback pro original)
- `AbortController` 28s no scan (antes do timeout 30s do Railway)
- HEIC rejeitado client-side (não desperdiça upload)

### Lazy loading
- Push subscription só após 2s (`setTimeout(_vitaeSetupPush, 2000)`)
- Google GIS script carregado dinamicamente (createElement('script') após pageload)

---

## 11. COMPONENTES HARDCODED QUE PRECISAM VIRAR REAIS NO V3

> Lista limitada ao **app antigo (raiz `*.html`, números 01-31)**. Mockups (`redesign-v2/`, `redesign-v3/`, `app-v3/`) e desktop estão FORA do escopo desse manual.

### No app antigo paciente (raiz)
- **`02-slides-paciente.html`** — todo o texto dos 3 slides está hardcoded em PT-BR (não tem i18n). Cor `#0099C4` (linha 73, 89, 213) diverge do gradient padrão `#00E5A0 → #00B4D8`.
- **`03-cadastro.html`** — `GOOGLE_CLIENT_ID = '797358115254-rdlqi8dta9n7jvcvajeq4ubu20976te5.apps.googleusercontent.com'` (linha 452). Bandeira 🇧🇷 +55 hardcoded. Placeholder `(11) 99999-9999`.
- **`04-verificacao.html`** — Phone fallback `+5511999999999` (linha 281). Banner "Ver console" linha 299 — DEV mode visível em prod.
- **`08-perfil.html`** — "Válido até 03/2028" hardcoded (linha 875). UF fallback `'SP'` se planoSaude, senão `'BR'` (linha 861).
- **`21-qrcode.html`** — Cor QR `#0D0F14` dark / `#fff` light (linhas 218-219). Correção `M` (medium).
- **`22-autorizacao.html`** — Avatar `⚕️` emoji (linha 139). Duração default `30 dias` (linha 159).
- **`23-agendamentos.html`** — Tipo default `'EXAME'` (linha 171). 3 ícones SVG hardcoded por tipo.
- **`26-scan-receita.html`** — Aceita `image/*,application/pdf` (linha 72). Sem preview da foto antes de enviar.
- **`27-processando.html`** — Limites compressão `1600x2400, 0.75` (linha 72). Timeout safety net 8s (linha 78). Mensagens de erro 9 cenários hardcoded.
- **`31-revisao-alergias.html`** — **BUG: gravidade fixa `'MODERADA'`** (linha 280), ignora classificação da IA. Tipo mapping `medicamento → MEDICAMENTO, alimento → ALIMENTO, substancia → AMBIENTAL` (linha 276). Mensagem "Dipirona já constava no seu perfil" (linha 208) — exemplo hardcoded.
- **`30-lembretes.html`** — Lógica período baseada em hora (manhã <12, tarde <18, noite ≥18) — não configurável. Persistência só client (não rastreia adesão no backend).
- **`rg-publico.html`** — Detecção GLP-1 por nome (Ozempic/Mounjaro) — linha ~422. Aviso "jejum 24-48h para anestesia" hardcoded. "Válido até [ano]" calculado client-side.
- **`exame-publico.html`** — Mapping `toNomeAmigavel(nome)` (linha 413+) — lista de 14 substituições hardcoded (hemograma → "Exame de Sangue Completo", lipidograma → "Perfil do Coração", etc).

### Limpos (não tem dado fictício de Lucas/Marina/Penicilina/Losartana)
- 01-splash, 02-slides-paciente, 03-cadastro, 04-verificacao, 05-quiz, 06-concluido, 08-perfil, 09-dados-pessoais, 10-score, 11-exames-lista, 14-esqueci-senha, 15-bioage-sem-dados, 15-nova-senha, 16-medicamentos, 17-alergias, 20-medico-cadastro, 21-qrcode, 22-autorizacao, 23-agendamentos, 25-summary, 26-scan-receita, 27-processando, 30-lembretes, 31-revisao-alergias, rg-publico, exame-publico, quiz-preconsulta, pre-consulta

> **Nota:** `16-medicamentos.html:428` tem placeholder "Ex: Rivotril, Losartana..." — é apenas exemplo no input vazio, não dado fictício salvo.

### Onde a sujeira está (FORA DO ESCOPO desse manual mas Lucas precisa saber)
- **`app-v3/01-saude.html`** — Lucas Borelli (linha 219), `(11) 98765-4321` (linha 258), Dipirona/Penicilina/Losartana hardcoded como exemplo (linhas 275-368). Esse é o app v3 mockup que precisa virar dinâmico.
- **`app-v3/16-consulta-detalhe.html`, `04-med-detalhe.html`, `07-alergia-detalhe.html`** — Dra. Renata Cardoso hardcoded.
- **`app-v3/app-spa-quebrado.html`** — versão SPA quebrada com todos esses hardcoded (não usa, mas existe).
- **`redesign-v2/`, `redesign-v3/`** — todos os mockups antigos com Lucas Borelli, (11) 98765-4321, Marina Borelli, etc. NÃO são páginas reais — são protótipos visuais.
- **`identidade-visual.html:462,523`** — Lucas Borelli + Losartana usados como placeholder do design system.
- **`desktop/preview-*.html`** — Dr. Lucas Borelli como médico fictício.

---

## RESUMO DE ARQUITETURA

```
┌─────────────────────────────────────────────────────────────┐
│  PACIENTE (app antigo — raiz *.html)                        │
├─────────────────────────────────────────────────────────────┤
│  01-splash → 02-slides → 03-cadastro → 04-verificacao →     │
│  05-quiz → 06-concluido → 08-perfil (HOME)                  │
│                                                              │
│  HOME atalhos: 09 (editar), 10 (score), 11 (exames),        │
│  16 (meds), 17 (alergias), 21 (QR), 22 (autorização),       │
│  23 (agenda), 30 (lembretes)                                │
│                                                              │
│  Scan flow: 16/17 → 26-scan → 27-processando → 31-revisao   │
│                                                              │
│  Esqueci senha: 14 → email → 15-nova-senha                  │
│                                                              │
│  Pré-consulta: WhatsApp → pre-consulta.html?token=X         │
│    novo: cadastro → quiz-preconsulta → V4 quiz              │
│    velho: V4 quiz direto                                    │
│                                                              │
│  Público (QR): rg-publico → exame-publico (SEM JWT)         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  COMUNICAÇÃO COM BACKEND                                    │
├─────────────────────────────────────────────────────────────┤
│  Todas as telas autenticadas → api.js → vitaeAPI.*          │
│    └─ apiRequest() → fetch + JWT + refresh automático       │
│                                                              │
│  Telas públicas (rg-publico, exame-publico, pre-consulta V4)│
│    └─ fetch direto pro endpoint público                     │
│                                                              │
│  localStorage: vitae_token, vitae_refresh_token,            │
│                vitae_usuario, vitae_quiz_retorno, +6        │
│                                                              │
│  URL: local (3002) ou Railway prod, detectado automaticamente│
└─────────────────────────────────────────────────────────────┘
```

---

**Fim do Manual.**
Total: 24 telas mapeadas + ~80 funções `vitaeAPI.*` + 14 chaves localStorage + 16 jornadas end-to-end + tradutor de erros + sanitização + transições + cache.
