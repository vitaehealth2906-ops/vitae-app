# Mapa de Implementacao Final - App v3 Paciente

> Documento mestre que consolida os 3 manuais existentes + estado real do app v3 num plano acionavel.
> Leitor-alvo: Lucas Borelli (fundador, nao-programador). Le e aprova antes da implementacao comecar.
> Data: 14/05/2026. Versao 1 do mapa.
>
> Insumos consolidados aqui:
> - `MANUAL-BACKEND-COMPLETO.md` (94 KB, 2054 linhas) — o que o backend oferece
> - `MANUAL-APP-ANTIGO-USO-BACKEND.md` (58 KB) — como o app antigo consome
> - `MANUAL-FEATURES-ESPECIAIS.md` (122 KB, 3635 linhas) — formulas internas
> - `app-v3/` — 41 arquivos HTML (38 telas reais + 3 sandbox)
> - `tests/shots/auditoria/auditoria.json` — 32 screenshots + analise de hardcodes

---

## 1. Resumo Executivo

### O que e o app v3

O app v3 e a REESCRITA visual do app paciente, em rota separada (`/app-v3/`) na mesma Vercel. Foi desenhado em maio/2026 pra substituir as 24 telas antigas (raiz do projeto) por uma experiencia mais limpa:

- 4 abas na tab-bar (Meu RG, Exames, QR Code, Consultas) — uma a menos que o antigo (sem Score por agora; ver secao 9)
- Onboarding mais convincente em 2 telas (boas-vindas + slides) + quiz vita id mais curto
- Telas dedicadas pra cada tipo de dado (medicamento, alergia, exame, consulta) com sub-telas de detalhe e adicao
- Estados vazios formais (40, 41, 42, 43, 44) e estados de erro/loading (52, 60)
- Tudo na pasta `d:\vitae-app-novo\app-v3\`

Visualmente esta TODO PRONTO. Falta: trocar dados hardcoded por chamadas reais ao backend que ja existe e funciona em producao (`vitae-app-production.up.railway.app`).

### O que esta pronto / o que falta

| Status | Telas | Comentario |
|---|---:|---|
| OK (auth/quiz/onboarding ja chama backend) | 9 | 20-splash, 21-boas-vindas, 23-login, 24-esqueci-senha, 25-nova-senha, 26-cadastro, 27-sms, 28-onboarding, 30-quiz |
| OK estado vazio (sem dado mostrar) | 5 | 40, 41, 42, 43, 44 |
| OK utilitarias (loading/offline/pronto/menu) | 6 | 31-pronto, 52-loading-home, 60-erro-offline, index, mapa-v3, app/app-galeria/app-esqueleto/app-shell-backup/app-spa-quebrado (sandbox - nao da pra contar como producao) |
| Visual OK + Backend ja conectado (alguma forma) | 4 | 09-exames-lista, 12-qr-code, 18-perfil, 71-privacidade |
| Visual OK + hardcoded (precisa trocar) | 13 | 01-saude, 03-medicamentos, 04-med-detalhe, 05-add-medicamento, 06-alergias, 07-alergia-detalhe, 08-add-alergia, 10-exame-detalhe, 14-rg-publico, 15-consultas, 16-consulta-detalhe, pre-consulta, quiz-preconsulta |
| Faltando ou nao funcional | 2 | 18-perfil (parcial: ja carrega, falta foto upload com camera + secao de pacientes filtrada), e algumas pre-consulta/quiz-preconsulta que so tem rotas estaticas |

**Total de telas reais em producao: 38 arquivos HTML** (excluindo 3 sandbox: app.html, app-galeria.html, app-shell-backup.html, app-spa-quebrado.html, app-esqueleto.html, mapa-v3.html — apenas index conta como redirect util).

### Quantos lotes de implementacao

**10 lotes** (numerados 1-10). Cada lote e independente o suficiente pra ser feito em uma sessao Claude unica (1h-4h), commitado e deployado isoladamente.

### Tempo estimado total

**26-34 horas** de trabalho Claude, distribuidas em 10 sessoes. Lucas valida cada lote antes de o proximo comecar.

| Lote | Tempo | Risco |
|---|---|---|
| 1. Tela Saude HOME | 3-4h | Medio (muitos pontos de leitura simultanea) |
| 2. Lista medicamentos + CRUD | 3-4h | Baixo |
| 3. Lista alergias + CRUD | 2-3h | Baixo |
| 4. Lista exames + detalhe biomarcadores | 3-4h | Alto (parametros + classificacao) |
| 5. Aba Consultas (estado vazio + lista) | 2-3h | Medio (agendamentos + pre-consultas misturadas) |
| 6. QR + RG publico | 2h | Baixo (ja ta quase la) |
| 7. Perfil editavel | 3h | Baixo (ja chama backend) |
| 8. Privacidade + autorizacoes | 1-2h | Baixo (ja ta funcional) |
| 9. Quiz com formulario estruturado de medicamento | 2-3h | Medio |
| 10. Polimento + edge cases + bugs | 3-4h | Sempre alto (e onde aparece o que nao previmos) |

### Criterio de cutover

App v3 substitui o antigo quando:
1. Os 10 lotes estao com Lucas validando "funciona" (nao "tem bug menor")
2. Paciente novo consegue: cadastrar, quiz, ver home com dados reais, escanear QR e medico ver
3. Paciente existente (do banco antigo) abre e ve seus dados sem perder nada
4. Sentry sem erro novo apos 48h
5. Lucas e mais 2-3 betatesters pacientes confirmam que esta melhor que o antigo

Detalhamento na secao 8.

---

## 2. Estado Atual do App v3 - Tela por Tela

Cobertura completa dos 38 arquivos HTML em `d:\vitae-app-novo\app-v3\` (mais 3 sandbox marcados explicitamente).

Legenda:
- OK = pronta visualmente E backend conectado
- VISUAL = visual ok mas dados sao fake (precisa trocar pra API)
- QUEBRADA = falha logica ou faltando
- SANDBOX = arquivo de teste/desenho — NAO ENTRA EM PRODUCAO

| # | Arquivo | Status | Backend conectado? | Hardcoded restantes | Funcoes vitaeAPI usadas | Falta |
|---|---|---|---|---|---|---|
| 1 | index.html | OK | N/A (so redirect) | — | — | — |
| 2 | 01-saude.html | VISUAL | Parcial (auth gate) | Nome "Lucas Borelli", RG #001234567, dataNasc 12/03/2008, tel 98765-4321, Marina Borelli, 3 meds, 3 alergias, "2 de 3 tomados", "2 criticas · 1 leve" | isLoggedIn, jaTemRG | Conectar getPerfil + listarAlergias + listarMedicamentos + getProximoAgendamento. Substituir cards estaticos. |
| 3 | 03-medicamentos.html | VISUAL | NAO | 3 meds (Losartana/Omeprazol/Vitamina D), badges Pressao/Refluxo, calendario semana hardcoded em maio | — | Conectar listarMedicamentos. Marcar adesao real. Date dinamico. |
| 4 | 04-med-detalhe.html | VISUAL | NAO | Losartana 50mg, Dra. Renata Cardoso, motivo "controlar pressao alta", 2 meses em uso, % adesao | — | Receber id por query, chamar listarMedicamentos + filtrar. Conectar grafico adesao real. |
| 5 | 05-add-medicamento.html | VISUAL | NAO | Placeholders "Ex: Losartana 50mg" (ok) | — | Submit chamar adicionarMedicamento. Validar form. Adicionar campos estruturados. |
| 6 | 06-alergias.html | VISUAL | NAO | Dipirona/Penicilina/Camarao, Dr. Renata 12/03/2024, Hospital Albert Einstein 28/06/2023, Novalgina/Magnopyrol/Metamizol, Amoxicilina/Ampicilina/Cefalexina | — | Conectar listarAlergias. Agrupar por gravidade real. Mostrar reacoes cruzadas (CMED) via backend. |
| 7 | 07-alergia-detalhe.html | VISUAL | NAO | Dipirona, anafilaxia, 12/03/2024, Dra. Renata Cardoso, Hospital Albert Einstein, Novalgina/Magnopyrol/Metamizol | — | Receber id por query. Conectar listarAlergias + infoAlergia. |
| 8 | 08-add-alergia.html | VISUAL | NAO | Placeholders "Ex: Dipirona, Camarao..." (ok) | — | Submit chamar adicionarAlergia. Sugerir cruzamento com meds atuais. |
| 9 | 09-exames-lista.html | OK | SIM (listarExames, uploadExame, getExame, getPerfilPacienteMedico) | Pouco — visualizacao quase toda real. Algumas labels de demo | listarExames, getExame, uploadExame, getPerfilPacienteMedico | Falta: tela vazia se 0 exames. Modo medico (?pacienteId=) verificar. |
| 10 | 10-exame-detalhe.html | VISUAL | NAO | Hemoglobina/glicose hardcoded, biomarcadores demo | — | Receber id por query, chamar getExame. Renderizar parametros reais. Status NORMAL/ATENCAO/CRITICO real. |
| 11 | 12-qr-code.html | OK | SIM (getQrData, getUsuario) | Mensagem WhatsApp tem "Paciente" fallback. Tudo dinamico | getUsuario, getQrData | URL publica usa userId real. OK. |
| 12 | 14-rg-publico.html | VISUAL | NAO (faz fetch direto?) | Possivelmente dados hardcoded — precisa verificar JS | fetch direto pra /autorizacao/rg-publico/:userId | Confirmar leitura de `?id=` real. Renderizar perfil + alergias + meds + exames do paciente do QR. |
| 13 | 15-consultas.html | VISUAL | NAO | "Ola, Lucas" hardcoded, Dra. Renata Cardoso 21 de maio 14h30, CRM-SP 145.232, Dr. Bruno Lima derma 22 abril, Dra. Marina Ferreira clinica geral 12 abril, Clinica Vitae Itaim | — | Conectar listarAgendamentos + listarPreConsultas. Renderizar lista real. Estado vazio se 0. |
| 14 | 16-consulta-detalhe.html | VISUAL | NAO | Dra. Renata Cardoso, Cardiologia, Quarta 05 maio 14h30, Clinica Vitae R. dos Pinheiros 1456, Losartana 50mg (receita), Laudo cardiologico PDF | — | Receber id por query, chamar atualizarAgendamento ou getPreConsulta. Vincular documentos do exame. |
| 15 | 18-perfil.html | OK | SIM (buscarPerfil, atualizarConta, atualizarPerfil, uploadFoto, logout) | Foto avatar mostra iniciais se vazio — ok | buscarPerfil, atualizarConta, atualizarPerfil, uploadFoto, logout | Falta: validacao de inputs, mascaras, upload de camera ao vivo (atualmente so base64). Subsecao Privacidade nao linkada. |
| 16 | 20-splash.html | OK | SIM (isLoggedIn, jaTemRG) | — | isLoggedIn, jaTemRG | OK |
| 17 | 21-boas-vindas.html | OK | NAO | Texto motivacional (ok, e copy) | — | OK |
| 18 | 23-login.html | OK | SIM | — | isLoggedIn, getUsuario | OK |
| 19 | 24-esqueci-senha.html | OK | NAO (?) | — | (a verificar) | Conectar com endpoint esqueciSenha do api.js |
| 20 | 25-nova-senha.html | OK | NAO (?) | — | (a verificar) | Conectar redefinirSenha |
| 21 | 26-cadastro.html | OK | SIM (cadastro, login, loginSocial, getPerfil) | "Maria Teste" auto-cadastro pra demo? | cadastro, login, loginSocial, getPerfil | OK |
| 22 | 27-sms.html | OK | SIM (verificarSms) | — | verificarSms | OK |
| 23 | 28-onboarding.html | OK | SIM | — | — | OK |
| 24 | 30-quiz.html | OK PARCIAL | SIM (atualizarPerfil, uploadFoto, adicionarAlergia, adicionarMedicamento, registrarConsentimento, uploadExame) | "Caso Lucas-Dipirona" no comentario (ok). Cruzamento alergia-med ja implementado | atualizarPerfil, uploadFoto, adicionarAlergia, adicionarMedicamento, registrarConsentimento, uploadExame, getPerfil | Falta: formulario estruturado de medicamento (hoje so digita nome). Ver Lote 9. |
| 25 | 31-pronto.html | OK | NAO | "0 RESPOSTAS · 100% COMPLETO" (deveria contar) | — | Conectar pra mostrar quantas respostas reais. |
| 26 | 40-saude-vazia.html | OK estado vazio | NAO (decoracao) | Lucas Borelli, #001234567, 12/03/2008, 98765-4321 — porque mockup. NAO deve mostrar nada disso se for de verdade | — | Trocar pra hero "Bem-vindo, [Nome real]" + RG vazio. Sem hardcode. |
| 27 | 41-medicamentos-vazia.html | OK estado vazio | NAO (decoracao) | — | — | OK (so visual estado vazio) |
| 28 | 42-alergias-vazia.html | OK estado vazio | NAO (decoracao) | — | — | OK |
| 29 | 43-exames-vazia.html | OK estado vazio | NAO (decoracao) | — | — | OK |
| 30 | 44-consultas-vazia.html | OK estado vazio | NAO (decoracao) | — | — | OK |
| 31 | 52-loading-home.html | OK | NAO | — | — | OK (skeleton) |
| 32 | 60-erro-offline.html | VISUAL estado erro | NAO | Lucas Borelli, #001234567 — porque mockup | — | Em uso real, ler do localStorage o nome+RG do usuario salvo. |
| 33 | 71-privacidade.html | OK | SIM (listarAutorizacoes, autorizarMedico, revogarAutorizacao) | — | listarAutorizacoes, autorizarMedico, revogarAutorizacao | OK. Pode adicionar Termos+LGPD links. |
| 34 | pre-consulta.html | OK | SIM (cadastro, login, getPerfil, esqueciSenha, fetch /pre-consulta/t/:token/*) | — | cadastro, login, loginSocial, getPerfil, esqueciSenha, fetch publico | OK (e a tela onde o paciente responde). Mantida do app antigo. |
| 35 | quiz-preconsulta.html | OK | SIM (mesma do quiz V3) | — | mesma do 30-quiz | OK |
| 36 | app.html | SANDBOX | — | — | — | NAO ENTRA EM PRODUCAO |
| 37 | app-esqueleto.html | SANDBOX | — | — | — | NAO ENTRA |
| 38 | app-galeria.html | SANDBOX | — | — | — | NAO ENTRA |
| 39 | app-shell-backup.html | SANDBOX | — | — | — | NAO ENTRA |
| 40 | app-spa-quebrado.html | SANDBOX | — | Muitos (clone da raiz) | — | NAO ENTRA — pasta de cemiterio |
| 41 | mapa-v3.html | SANDBOX | NAO | — | — | NAO ENTRA — so ajuda dev |

**Resumo:** 5 telas com hardcoded critico precisando trocar pra API: 01-saude, 03-medicamentos, 04-med-detalhe, 06-alergias, 07-alergia-detalhe, 10-exame-detalhe, 14-rg-publico, 15-consultas, 16-consulta-detalhe. Mais 4 sub-telas de adicao/edicao que ja tem o visual mas precisam plugar nos endpoints (05-add-med, 08-add-alergia). Mais 40-saude-vazia e 60-erro-offline precisam ler dados do usuario real (nao mocked).

---

## 3. Inventario do que o Backend Oferece

Resumo extraido dos manuais. Pra cada categoria: endpoints + funcoes vitaeAPI + telas v3 que vao usar.

### Auth (cadastro/login/refresh)

- POST /auth/cadastro -> `vitaeAPI.cadastro(nome, email, celular, senha, tipo)`
- POST /auth/verificar-sms -> `vitaeAPI.verificarSms(celular, codigo)`
- POST /auth/login -> `vitaeAPI.login(email, senha)`
- POST /auth/login-social -> `vitaeAPI.loginSocial(provider, providerToken, nome, email)`
- POST /auth/refresh -> `refreshTokens()` (interno)
- POST /auth/esqueci-senha, POST /auth/redefinir-senha — pra esqueci+nova senha

Telas v3: 23-login, 24-esqueci-senha, 25-nova-senha, 26-cadastro, 27-sms, pre-consulta (login inline)

### Perfil (ver/editar/foto)

- GET /perfil -> `vitaeAPI.getPerfil()`, `vitaeAPI.buscarPerfil()` retorna `{ usuario, perfil }`
- PUT /perfil -> `vitaeAPI.atualizarPerfil(dados)` (PerfilSaude inteiro)
- PATCH /perfil/conta -> `vitaeAPI.atualizarConta({ nome | email | celular })`
- POST /perfil/foto -> `vitaeAPI.uploadFoto({ fotoUrl: base64 })`

Telas v3: 01-saude (header avatar), 18-perfil (todos os campos), 40-saude-vazia (hero), 60-erro-offline (cache), 30-quiz (escreve), quiz-preconsulta (escreve)

### Medicamentos (CRUD + scan)

- GET /medicamentos -> `vitaeAPI.listarMedicamentos()`
- POST /medicamentos -> `vitaeAPI.adicionarMedicamento(dados)`
- PUT /medicamentos/:id -> `vitaeAPI.atualizarMedicamento(id, dados)`
- DELETE /medicamentos/:id -> `vitaeAPI.removerMedicamento(id)`
- GET /medicamentos/info/:nome -> `vitaeAPI.infoMedicamento(nome)` (info CMED)
- POST /medicamentos/scan -> `vitaeAPI.scanReceita(file)` (Gemini Vision)

Telas v3: 01-saude (preview 3 ultimos), 03-medicamentos (lista completa + calendario), 04-med-detalhe (detalhe), 05-add-medicamento (form manual + scan), 30-quiz/quiz-preconsulta (cadastra no onboarding)

### Alergias (CRUD + scan)

- GET /alergias -> `vitaeAPI.listarAlergias()`
- POST /alergias -> `vitaeAPI.adicionarAlergia(dados)`
- DELETE /alergias/:id -> `vitaeAPI.removerAlergia(id)`
- GET /alergias/info/:nome -> `vitaeAPI.infoAlergia(nome)` (familia farmacologica + sinonimos)
- POST /alergias/scan -> `vitaeAPI.scanAlergia(file)` (Gemini)

Telas v3: 01-saude (preview), 06-alergias (lista por gravidade), 07-alergia-detalhe, 08-add-alergia, 30-quiz/quiz-preconsulta

### Exames (upload + ver + deletar + OCR Claude)

- GET /exames -> `vitaeAPI.listarExames()`
- GET /exames/:id -> `vitaeAPI.getExame(id)` (com parametros)
- POST /exames/upload -> `vitaeAPI.uploadExame(file, dataExame?)` (multipart, Claude analisa)
- DELETE /exames/:id -> `vitaeAPI.deletarExame(id)`

Telas v3: 01-saude (count), 09-exames-lista (lista + upload), 10-exame-detalhe (biomarcadores), 30-quiz (envia se tem)

### Score (4 pilares)

- GET /scores/atual -> `vitaeAPI.getScoreAtual()` (objeto com pilares)
- GET /scores/historico -> `vitaeAPI.getHistoricoScores()`
- GET /scores/melhorias -> `vitaeAPI.getMelhorias()`
- POST /scores/recalcular -> `vitaeAPI.recalcularScores()`

Telas v3: 01-saude (numero do score ring no header — opcional nesta rodada, ver secao 9)

### Checkin (sono/atividade/produtividade)

- POST /checkin -> `vitaeAPI.fazerCheckin(dados)`
- GET /checkin/historico -> `vitaeAPI.getHistoricoCheckins()`

Telas v3: NAO ENTRA NESTA RODADA (app antigo nem usa)

### Agendamento (CRUD)

- POST /agendamento -> `vitaeAPI.criarAgendamento(dados)`
- GET /agendamento -> `vitaeAPI.listarAgendamentos()`
- GET /agendamento/proximo -> `vitaeAPI.getProximoAgendamento()`
- PUT /agendamento/:id -> `vitaeAPI.atualizarAgendamento(id, dados)`
- DELETE /agendamento/:id -> `vitaeAPI.deletarAgendamento(id)`

Telas v3: 01-saude (proximo), 15-consultas, 16-consulta-detalhe

### Autorizacao (medicos)

- POST /autorizacao -> `vitaeAPI.autorizarMedico({ medicoCrm, duracaoDias })`
- GET /autorizacao -> `vitaeAPI.listarAutorizacoes()`
- DELETE /autorizacao/:id -> `vitaeAPI.revogarAutorizacao(id)`
- GET /autorizacao/qr-data -> `vitaeAPI.getQrData()` (RG + url + pin)

Telas v3: 12-qr-code, 71-privacidade

### QR publico (sem auth)

- GET /autorizacao/rg-publico/:userId — fetch direto, sem JWT
- GET /autorizacao/exame-publico/:userId/:examId — idem

Telas v3: 14-rg-publico (publica, escaneado pelo medico)

### Notificacoes

- GET /notificacoes -> `vitaeAPI.getNotificacoes()`

Telas v3: NAO ENTRA NESTA RODADA (sem UI dedicada no v3)

### Pre-consulta (paciente responde)

- GET /pre-consulta/t/:token -> `vitaeAPI.getPreConsultaPorToken(token)` (publico)
- POST /pre-consulta/t/:token/responder (legado), /responder-audio (legado)
- GET /pre-consulta/t/:token/estado (V4)
- POST /pre-consulta/t/:token/responder-pergunta (V4)
- POST /pre-consulta/t/:token/finalizar (V4)

Telas v3: pre-consulta.html, quiz-preconsulta.html (essas duas sao do paciente respondendo)

### Anamnese estruturada / Padroes Observados v2 / Metricas honestas / IA Collab / Prosodica

Sao features do LADO DO MEDICO. NAO ENTRAM nesta rodada do v3 paciente. Documentadas no Manual 1 e 3 pra futura phase 2.

### Lembretes (notificacao local)

NAO TEM rota dedicada — adesao e calculada cliente-side com base em `Medicamento.horario`. Push notifications: rotas `/agenda/push/*` existem mas sao do modulo Agenda medica. NAO ENTRA NESTA RODADA.

### Consentimento

- POST /consentimento -> `vitaeAPI.registrarConsentimento({ tipo, aceito })`

Telas v3: 30-quiz, quiz-preconsulta (ja registra TERMOS_USO + POLITICA_PRIVACIDADE + DADOS_SAUDE)

---

## 4. Comparacao App Antigo vs App v3

Tabela do que cada um faz pra cada feature principal. "Gap" = trabalho a fazer no v3.

| Feature | App antigo | App v3 atual | Gap |
|---|---|---|---|
| HOME — RG card | 08-perfil.html: chama getPerfil + listarAlergias + listarMedicamentos. RG mostra sangue+idade calculada+alergias criticas+meds em uso. | 01-saude.html: card mostra "LUCAS BORELLI", "#001234567", "12/03/2008", "(11) 98765-4321", "Marina Borelli" — TUDO HARDCODED. | Conectar getPerfil + listarAlergias + listarMedicamentos. Calcular idade. Render RG verso com dados reais. |
| HOME — Greeting | 08-perfil.html: "Ola, {primeiroNome}" do getUsuario | 01-saude.html: "Ola, Lucas Borelli" hardcoded | Ler usuario.nome do localStorage e pegar primeiro nome. |
| HOME — Medicamentos preview | 08-perfil.html: 3 ultimos meds via listarMedicamentos, calcula horario, mostra ativos | 01-saude.html: 3 cards Losartana/Omeprazol/Vitamina D + "2 de 3 tomados" | Substituir todos. Contar adesao real (campo `quantidadeEstoque` ou flag de tomada local). |
| HOME — Alergias preview | 08-perfil.html: pills agrupadas por gravidade real | 01-saude.html: 3 cards Dipirona/Penicilina/Camarao + "2 criticas · 1 leve" | Substituir. Renderizar so as cadastradas. Mostrar count por gravidade. |
| HOME — Score 0-100 | 10-score.html chama getScoreAtual + getMelhorias | NAO existe tela equivalente em v3 (sem aba Score na tab-bar) | NAO ENTRA NESTA RODADA. Score so como numero pequeno opcional na home. Decisao Lucas. |
| HOME — Estado vazio | 08-perfil.html: render condicional, se sem dados mostra CTA cards | 40-saude-vazia.html: tela inteira separada, mas com nome+RG hardcoded | Unificar: 01-saude detecta vazio e mostra CTA cards inline OU redireciona pra 40 (mas 40 ler nome real). |
| HOME — Loading | 08-perfil.html: skeleton inline durante fetch | 52-loading-home.html: tela inteira separada de skeleton | Decidir: usa 52 como redirect durante carregamento, ou inline em 01-saude. Recomendado inline (mais rapido). |
| Medicamentos lista | 16-medicamentos.html: chama listarMedicamentos, agrupa por horario, marca tomados | 03-medicamentos.html: calendario semana + 3 cards hardcoded em 14 de maio | Conectar. Calendario dinamico (Date hoje). Adesao real via dia/horario. |
| Medicamentos adicionar manual | 16-medicamentos.html: form simples (nome + dosagem + frequencia + horario + motivo) | 05-add-medicamento.html: form com nome+dose+via+horarios | Submit chamar adicionarMedicamento. Validar. |
| Medicamentos detalhe | Inline em 16-medicamentos.html (modal/sheet) | 04-med-detalhe.html: dedicada com Losartana hardcoded | Receber `?id=X`, filtrar de listarMedicamentos, renderizar. |
| Medicamentos scan | 26-scan-receita.html + 27-processando.html (telas dedicadas — antigas) | NAO existe no v3 | NAO ENTRA NESTA RODADA. Adicionar botao "Escanear" em 05-add-med mas faz so chamada vitaeAPI.scanReceita e mostra retorno. |
| Alergias lista | 17-alergias.html: agrupa por gravidade, mostra cross-match com meds | 06-alergias.html: 3 alergias hardcoded com "Evitar tambem" hardcoded | Conectar listarAlergias. Cross-match via infoAlergia (familia). |
| Alergias adicionar | 17-alergias.html: form | 08-add-alergia.html: form com substancia + gravidade | Submit chamar adicionarAlergia. Sugerir cruzamento via infoAlergia. |
| Alergias detalhe | Inline em 17-alergias | 07-alergia-detalhe.html: Dipirona hardcoded | Receber id, renderizar. |
| Exames lista | 11-exames-lista.html (tema escuro) | 09-exames-lista.html (clonado do antigo, mesmo arquivo) | OK — JA conectado. Validar modo `?pacienteId=` (medico) e estado vazio. |
| Exames detalhe | Inline em 11-exames-lista (modal) | 10-exame-detalhe.html: tela dedicada, biomarcadores hardcoded | Conectar getExame, renderizar parametros + status + classificacao real. |
| Exames upload | 11-exames-lista.html chama uploadExame | 09-exames-lista.html ja faz (legado) | OK |
| QR Code | 21-qrcode.html chama getQrData | 12-qr-code.html chama getQrData | OK |
| QR publico (RG view) | rg-publico.html: fetch direto sem JWT | 14-rg-publico.html: parece estatico, ler JS | Confirmar que faz `fetch /autorizacao/rg-publico/:userId` real. |
| Autorizacoes | 22-autorizacao.html chama listar/autorizar/revogar | 71-privacidade.html chama listar/autorizar/revogar | OK |
| Consultas / Agendamentos | 23-agendamentos.html: listarAgendamentos + criar | 15-consultas.html: hardcoded com Dra. Renata + Bruno Lima + Marina Ferreira | Conectar listarAgendamentos + listarPreConsultas. Mostrar pre-consulta pendente em destaque. Estado vazio. |
| Consulta detalhe | Inline em 23-agendamentos | 16-consulta-detalhe.html: Dra. Renata Cardoso hardcoded com documentos hardcoded | Receber id, chamar atualizarAgendamento ou listarAgendamentos. Vincular exames atuais. |
| Perfil editavel | 08-perfil.html: header com avatar; 09-dados-pessoais.html: edicao | 18-perfil.html: ja chama buscarPerfil + atualizarPerfil/Conta | OK. Falta: validacoes mais fortes + camera upload (hoje so seleciona). |
| Privacidade | 22-autorizacao.html | 71-privacidade.html | OK. Adicionar links Termos+LGPD. |
| Scan receita | 26+27+28 (antigo) | NAO existe em v3 | NAO ENTRA NESTA RODADA. |
| Pre-consulta | pre-consulta.html | pre-consulta.html (igual) | OK |
| Lembretes | 30-lembretes.html (antigo) | NAO existe em v3 | NAO ENTRA NESTA RODADA. |
| Onboarding/Quiz | 02-slides-paciente + 05-quiz + 06-concluido | 21-boas-vindas + 28-onboarding + 30-quiz + 31-pronto | OK + falta formulario estruturado de medicamento no quiz (Lote 9). |
| Logout | api.js logout() — apaga tokens + redireciona | api.js logout() em 18-perfil | OK |
| Foto upload | 05-quiz + 09-dados-pessoais (base64) | 18-perfil (base64) + 30-quiz/quiz-preconsulta | OK funcional. Falta camera live em 18-perfil. |

---

## 5. Hardcoded a Remover (lista completa)

Resultado exato do grep em `d:\vitae-app-novo\app-v3\` (excluindo `app-spa-quebrado.html` que e sandbox). Total: **65 ocorrencias em 12 arquivos reais**.

### Nome "Lucas Borelli" / "LUCAS BORELLI"

- `01-saude.html:219` — header `Lucas Borelli` (greeting)
- `01-saude.html:245` — RG card frente `LUCAS BORELLI`
- `40-saude-vazia.html:54` — header `Lucas Borelli`
- `40-saude-vazia.html:79` — RG card frente `LUCAS BORELLI`
- `60-erro-offline.html:122` — RG card frente offline cache `LUCAS BORELLI`

### Medicamento "Losartana 50mg"

- `01-saude.html:279` — RG verso "Losartana 50mg · Omeprazol 20mg"
- `01-saude.html:309` — card med preview "Losartana 50mg"
- `03-medicamentos.html:235` — lista med "Losartana 50mg"
- `04-med-detalhe.html:6` — page title `<title>vita id — Losartana</title>`
- `04-med-detalhe.html:120` — hero `Losartana 50mg`
- `04-med-detalhe.html:165` — alert farmacologico "Combinar Losartana com ibuprofeno..."
- `16-consulta-detalhe.html:368` — doc-name "Losartana 50mg" (receita)
- `05-add-medicamento.html:137` — placeholder "Ex: Losartana 50mg" (manter — e placeholder)

### Medicamento "Omeprazol 20mg"

- `01-saude.html:279` (junto com Losartana)
- `01-saude.html:321` — card med preview
- `03-medicamentos.html:253` — lista med

### Medicamento "Vitamina D 2000UI"

- `01-saude.html:333` — card med preview
- `03-medicamentos.html:271` — lista med

### Alergia "Dipirona"

- `01-saude.html:275` — RG verso "Dipirona · Penicilina"
- `01-saude.html:359` — card alergia preview
- `06-alergias.html:98` — sev-name
- `07-alergia-detalhe.html:6` — page title `<title>vita id — Dipirona</title>`
- `07-alergia-detalhe.html:83` — hero-name
- `08-add-alergia.html:86` — placeholder (manter)

### Alergia "Penicilina"

- `01-saude.html:275` (com Dipirona)
- `01-saude.html:368` — card preview
- `06-alergias.html:112` — sev-name

### Alergia "Camarao"

- `01-saude.html:377` — card preview
- `06-alergias.html:129` — sev-name
- `08-add-alergia.html:86` — placeholder (manter)

### Medico "Dra. Renata Cardoso" / "Dr. Renata"

- `04-med-detalhe.html:153` — Prescritor
- `06-alergias.html:101` — "Dr. Renata · 12/03/2024"
- `07-alergia-detalhe.html:95` — "Diagnosticada por: Dra. Renata Cardoso"
- `15-consultas.html:303` — pre-consulta title
- `15-consultas.html:319` — proxima consulta nome
- `15-consultas.html:343` — historico
- `16-consulta-detalhe.html:318` — doctor-name
- `16-consulta-detalhe.html:346` — section "Documentos da Dra. Renata"
- `16-consulta-detalhe.html:391` — "Tire duvidas direto com a Dra. Renata"

### Medicos secundarios

- `15-consultas.html:352` — "Dr. Bruno Lima · Dermatologia"
- `15-consultas.html:361` — "Dra. Marina Ferreira · Clinica geral"

### Sinonimos de alergia "Evitar tambem" (familia farmacologica)

- `06-alergias.html:104-106` — "Novalgina · Magnopyrol · Metamizol" (Dipirona)
- `06-alergias.html:118-120` — "Amoxicilina · Ampicilina · Cefalexina" (Penicilina cruzada)
- `07-alergia-detalhe.html:104,108,112` — mesmos sinonimos hardcoded

Esses deveriam vir de `vitaeAPI.infoAlergia(nome)` (backend tem mapa CMED com 23 classes).

### Datas / endereco / IDs ficticios

- `01-saude.html:246` — `RG da Saude · #001234567`
- `01-saude.html:254` — Nascimento `12/03/2008`
- `01-saude.html:258` — Emergencia `(11) 98765-4321`
- `01-saude.html:283` — "Marina Borelli (mae) · (11) 98765-4321"
- `40-saude-vazia.html:80,83,84` — mesmos campos hardcoded
- `60-erro-offline.html:123,126,127` — mesmos
- `06-alergias.html:101` — "12/03/2024" (data alergia)
- `06-alergias.html:115` — "Hospital Albert Einstein · 28/06/2023"
- `07-alergia-detalhe.html` — data e local

### Status agregado

- `01-saude.html:297` — "2 de 3 tomados"
- `01-saude.html:347` — "2 criticas · 1 leve"
- `06-alergias.html:91` — "3 cadastradas · 2 criticas"
- `03-medicamentos.html:179` — "87% de adesao esta semana"

### Consultas hardcoded

- `15-consultas.html:289` — "Ola, Lucas"
- `15-consultas.html:304` — "Responda 4 perguntas antes de quarta-feira"
- `15-consultas.html:320` — "Cardiologia · CRM-SP 145.232"
- `15-consultas.html:325` — "Quarta, 21 de maio · 14h30"
- `15-consultas.html:331` — "Clinica Vitae · Itaim"
- `15-consultas.html:333` — "EM 7 DIAS"
- `15-consultas.html:344,353,362` — datas das consultas historicas

### Consulta detalhe hardcoded

- `16-consulta-detalhe.html:318-391` — todos os campos: Quarta 05 de maio 14h30, R. dos Pinheiros 1456, Laudo PDF 245 KB

### Comentarios (NAO sao bugs — sao docs no codigo)

- `30-quiz.html:911` — comentario "CRITICO: cruza alergia digitada com medicamento. Caso Lucas-Dipirona." (ok manter)
- `app-shell-backup.html:821` — desc dev "Lista por gravidade · pills vermelhas (Lucas-Dipirona)." (sandbox, ok)

---

## 6. Os 10 Lotes (ordem aprovada)

Cada lote: telas afetadas + funcoes vitaeAPI + endpoints + o que muda + hardcoded a remover + criterio de pronto + tempo + dependencias.

### LOTE 1: Tela Saude HOME (3-4h)

**Telas afetadas:** `01-saude.html`, `40-saude-vazia.html`, `52-loading-home.html`

**Funcoes vitaeAPI:** `getPerfil()`, `listarAlergias()`, `listarMedicamentos()`, `getProximoAgendamento()`

**Endpoints backend chamados:**
- GET /perfil
- GET /alergias
- GET /medicamentos
- GET /agendamento/proximo (opcional — pode adiar pra Lote 5)

**O que muda:**
- Header greeting: trocar "Lucas Borelli" por `usuario.nome.split(' ')[0]` (primeiro nome) do `vitaeAPI.getUsuario()`
- RG card frente: trocar nome, RG #, dataNascimento (formatar dd/mm/yyyy), tipo sanguineo (mapear A_POS -> A+), telefone emergencia
- RG card verso: alergias criticas (filtrar `gravidade=ALTA`), medicamentos em uso (filtrar `ativo=true`), contato emergencia nome+tel
- Cards "Medicamentos de hoje": tirar 3 hardcoded e iterar sobre os primeiros 3 de listarMedicamentos com `proximoHorario` calculado client-side com base em `horario` campo string ("08:00"). Contagem "X de Y tomados" calcula localStorage (paciente marca check manual) OU somenta meds com `quantidadeEstoque > 0`. Decisao: implementar como ja esta (marca via click, salva localStorage) — adesao server-side fica pra Lote 10.
- Cards "Alergias": iterar listarAlergias agrupando por gravidade. Contagem "X criticas · Y leves" dinamica.
- Estado vazio: se sem perfil completo (sem dataNascimento E sem tipoSanguineo) -> redirect pra `40-saude-vazia.html`. Senao, mesmo se sem meds e sem alergias, mostra cards "Adicionar primeiro medicamento" / "Adicionar primeira alergia" inline.
- Loading: enquanto `Promise.all([getPerfil, listarAlergias, listarMedicamentos])` nao retornou, mostra skeleton inline (NAO usa 52-loading-home como redirect — muito visual). 52-loading-home so pra primeira vez (apos quiz).
- 40-saude-vazia: substituir os hardcoded de nome/RG/data/emergencia por leitura do `getUsuario()` local + `getPerfil()`. Se ainda nao tem perfil, mostrar "Bem-vindo, [primeiroNome]. Complete seu RG da Saude" + CTA pra 30-quiz.

**Hardcoded a remover:**
- `01-saude.html:219` Lucas Borelli (header)
- `01-saude.html:245` LUCAS BORELLI (RG frente)
- `01-saude.html:246` #001234567
- `01-saude.html:254` 12/03/2008
- `01-saude.html:258` 98765-4321
- `01-saude.html:275` "Dipirona · Penicilina"
- `01-saude.html:279` "Losartana 50mg · Omeprazol 20mg"
- `01-saude.html:283` Marina Borelli
- `01-saude.html:297` "2 de 3 tomados"
- `01-saude.html:309,321,333` 3 cards med hardcoded
- `01-saude.html:347` "2 criticas · 1 leve"
- `01-saude.html:359,368,377` 3 cards alergia hardcoded
- `40-saude-vazia.html:54,79,80,83,84` mesmos campos pessoais
- `60-erro-offline.html:122,123,126,127` (vai entrar no Lote 10 polimento — ler de localStorage cache)

**Criterio de pronto:**
- Paciente novo (sem perfil) entra: ve estado vazio com nome dele + CTA pra completar quiz
- Paciente com perfil completo + 0 meds + 0 alergias: ve home com RG card preenchido + 2 CTAs "Adicionar primeiro..."
- Paciente com 3 meds e 3 alergias: ve preview dos 3 mais relevantes + counters corretos
- Header avatar nao quebra se foto vazia (mostra iniciais)
- Loading <500ms aparece skeleton; >500ms continua skeleton (nao tela em branco)

**Dependencias:** Nenhum lote anterior necessario. Pode ser feito primeiro.

---

### LOTE 2: Lista medicamentos + CRUD (3-4h)

**Telas afetadas:** `03-medicamentos.html`, `04-med-detalhe.html`, `05-add-medicamento.html`, `41-medicamentos-vazia.html`

**Funcoes vitaeAPI:** `listarMedicamentos()`, `adicionarMedicamento()`, `atualizarMedicamento(id, dados)`, `removerMedicamento(id)`, `infoMedicamento(nome)` (autocomplete CMED — opcional)

**Endpoints backend:**
- GET /medicamentos
- POST /medicamentos
- PUT /medicamentos/:id
- DELETE /medicamentos/:id
- GET /medicamentos/info/:nome (busca CMED — opcional pra autocomplete)

**O que muda:**
- 03-medicamentos: substituir 3 cards hardcoded. Iterar listarMedicamentos. Calendario semana usa Date hoje (renderizar SEG TER QUA QUI SEX SAB DOM). Click no dia filtra meds tomados naquele dia (localStorage flag `med_taken_DDMMYY_idMed`). Subtitle "X% de adesao" calcula dos ultimos 7 dias.
- 04-med-detalhe: receber `?id=X` por query string. Achar med por id em listarMedicamentos. Renderizar nome, dose, frequencia, horario, motivo, via, prescritor (campo `medicoPrescritor`), inicio (campo `dataInicio`). Calculo "Em uso ha X meses" do `dataInicio`. Grafico adesao ultimos 7 dias.
- 05-add-medicamento: submit -> adicionarMedicamento({ nome, dosagem, frequencia, horario, motivo, via, dataInicio }). Modo edit se vem com `?id=X` -> atualizarMedicamento. Botao deletar so em modo edit.
- Estado vazio: redirecionar pra 41-medicamentos-vazia se 0 resultados.

**Hardcoded a remover:**
- `03-medicamentos.html:179` "87% de adesao esta semana" (recalcular)
- `03-medicamentos.html:188-223` calendario com dias 12-18 maio (dinamico)
- `03-medicamentos.html:227` "Hoje, quarta · 14 de maio" (dinamico)
- `03-medicamentos.html:235,253,271` 3 cards
- `04-med-detalhe.html:6` page title (vai virar dinamico via JS)
- `04-med-detalhe.html:120,153,165` Losartana + Renata + alert

**Criterio de pronto:**
- 0 meds -> redirect 41-vazia
- 1+ med -> aparecem em cards, agrupados por horario (manha/tarde/noite)
- Click num card -> abre 04-med-detalhe com dados corretos
- 05-add manual -> POST + volta pra 03 com novo med na lista
- Edit em 04 ou voltando -> PUT + atualiza
- Calendario hoje destacado, sem indicador de futuro
- Adesao 7 dias calcula real (mesmo que paciente nao tenha checado nada, mostra "Sem dados — comece a marcar suas doses")

**Dependencias:** Nenhum.

---

### LOTE 3: Lista alergias + CRUD (2-3h)

**Telas afetadas:** `06-alergias.html`, `07-alergia-detalhe.html`, `08-add-alergia.html`, `42-alergias-vazia.html`

**Funcoes vitaeAPI:** `listarAlergias()`, `adicionarAlergia()`, `removerAlergia(id)`, `infoAlergia(nome)`

**Endpoints backend:**
- GET /alergias
- POST /alergias
- DELETE /alergias/:id
- GET /alergias/info/:nome (familia farmacologica + sinonimos do CMED)

**O que muda:**
- 06-alergias: substituir 3 cards. Iterar listarAlergias agrupando por `gravidade` (ALTA -> Criticas, MEDIA, LEVE). Pra cada alergia, chamar `infoAlergia(nome)` lazy e renderizar pills "Evitar tambem" (campo `sinonimos[]` + `familia[]` que o backend retorna).
- 07-alergia-detalhe: `?id=X`. Filtrar listarAlergias. Mostrar reacao registrada (campo `tipo`), gravidade, data, diagnosticada por. Chamar infoAlergia(nome) pra mostrar "Evitar tambem" com explicacao "Mesmo principio" / "Reacao cruzada".
- 08-add-alergia: submit adicionarAlergia({ nome, tipo, gravidade }). Apos submit, chamar infoAlergia(nome) pra mostrar alerta "Voce ja toma X que tem o mesmo principio".
- Subtitle "X cadastradas · Y criticas" dinamico.
- Estado vazio -> redirect 42-vazia.

**Hardcoded a remover:**
- `06-alergias.html:91` "3 cadastradas · 2 criticas"
- `06-alergias.html:98,101,104-106,112,115,118-120,129` dados Dipirona/Penicilina/Camarao + sinonimos
- `07-alergia-detalhe.html:6,83,95,104,108,112` Dipirona + Dra. Renata + sinonimos
- `08-add-alergia.html:86` placeholder (manter)

**Criterio de pronto:**
- 0 alergias -> redirect 42-vazia
- 1+ alergia -> aparecem agrupadas por gravidade
- Click numa alergia -> abre 07 com sinonimos do CMED reais
- Adicionar alergia "Dipirona" -> backend retorna familia + 12 sinonimos -> pill ficam visiveis no detalhe
- Subtitle conta certo

**Dependencias:** Nenhum.

---

### LOTE 4: Lista exames + detalhe biomarcadores (3-4h)

**Telas afetadas:** `09-exames-lista.html`, `10-exame-detalhe.html`, `43-exames-vazia.html`

**Funcoes vitaeAPI:** `listarExames()`, `getExame(id)`, `uploadExame(file, dataExame?)`, `deletarExame(id)`

**Endpoints backend:**
- GET /exames
- GET /exames/:id
- POST /exames/upload (multipart, Claude analisa)
- DELETE /exames/:id

**O que muda:**
- 09-exames-lista: VERIFICAR que ja esta chamando listarExames (parece sim). Garantir estado vazio quando 0 exames -> mostra cards "Envie seu primeiro exame".
- 10-exame-detalhe: hoje hardcoded. Receber `?id=X`. Chamar getExame(id). Renderizar:
  - Hero: tipoExame ("Hemograma completo"), data (formatada), laboratorio
  - Score: statusGeral ("NORMAL"/"ATENCAO"/"CRITICO") com cor
  - Resumo IA: campo `resumoIA`
  - Biomarcadores (parametros[]): iterar com nome + valor + unidade + status (NORMAL/ALTO/BAIXO/CRITICO)
  - Pra cada parametro, mostrar valorReferenciaMin-Max e percentualFaixa visual (barra com posicao do valor)
  - Impactos (impactosIA): array de objetos {icone, titulo, texto}
  - Melhorias (melhoriasIA): array similar
  - Botao deletar -> deletarExame + volta pra 09
- Modo medico: `?pacienteId=X` -> chama `getPerfilPacienteMedico(pacienteId).exames` em vez de listarExames. Linguagem na 3a pessoa (mas mantemos "voce" porque medico ve o que paciente ve).

**Hardcoded a remover:**
- `10-exame-detalhe.html` — tudo (hemoglobina/glicose etc hardcoded)
- 09-exames-lista vai limpar dados de demo se tiver (verificar)

**Criterio de pronto:**
- 0 exames -> 43-vazia com CTA upload
- 1+ exame -> lista cronologica em 09 com badge status
- Click num exame -> 10 mostra biomarcadores reais com valor numerico, faixa de referencia visual, status colorido
- Modo medico abre exames do paciente correto
- Upload de foto -> processa Claude (espera ~10s) -> exame aparece com biomarcadores extraidos

**Dependencias:** Nenhum.

---

### LOTE 5: Aba Consultas (estado vazio + lista) (2-3h)

**Telas afetadas:** `15-consultas.html`, `16-consulta-detalhe.html`, `44-consultas-vazia.html`

**Funcoes vitaeAPI:** `listarAgendamentos()`, `getProximoAgendamento()`, `listarPreConsultas()` (lado paciente), `getPreConsultaPorToken(token)` (publica — usada em pre-consulta.html)

**Endpoints backend:**
- GET /agendamento
- GET /agendamento/proximo
- GET /pre-consulta (autenticado — retorna pre-consultas do paciente logado)

**O que muda:**
- 15-consultas:
  - Greeting "Ola, [primeiroNome]"
  - Card de Pre-consulta PENDENTE no topo (status ABERTO ou PENDENTE, nao respondida): mostra nome do medico, data limite, CTA "Iniciar agora" -> abre pre-consulta.html?token=X
  - Card "Proxima consulta" (proximo agendamento futuro): nome medico, especialidade, CRM, data, local
  - Lista historico: agendamentos passados + pre-consultas respondidas, ordenados desc por data
  - Estado vazio: 0 agendamentos + 0 pre-consultas -> redirect 44-vazia
- 16-consulta-detalhe: receber `?id=X&tipo=agendamento|pre-consulta`. Buscar correspondente. Mostrar dados do medico, local, data, e DOCUMENTOS — se for pre-consulta respondida, mostrar resumo de 1 minuto + audio (se gerado).
- 44-vazia: mostra CTA "Como o medico te encontra" explicando que pre-consulta chega por WhatsApp.

**Hardcoded a remover:**
- `15-consultas.html:289` "Ola, Lucas"
- `15-consultas.html:303,304` Dra. Renata + descricao
- `15-consultas.html:319,320` nome + CRM
- `15-consultas.html:325,331,333` data + local + countdown
- `15-consultas.html:343,344,352,353,361,362` 3 historicos
- `16-consulta-detalhe.html:318-391` tudo

**Criterio de pronto:**
- 0 agendamentos e 0 pre-consultas -> 44-vazia
- 1 pre-consulta PENDENTE -> destaque amarelo
- 1 agendamento futuro -> "Proxima consulta" card
- 2+ no historico -> lista cronologica desc
- Click numa consulta -> detalhe com info do medico
- Click numa pre-consulta respondida -> ve resumo + audio

**Dependencias:** Lote 1 (so pra ter greeting consistente — mas pode fazer paralelo).

---

### LOTE 6: QR + RG publico (2h)

**Telas afetadas:** `12-qr-code.html`, `14-rg-publico.html`

**Funcoes vitaeAPI:** `getQrData()`, `getUsuario()` (publica em rg-publico: fetch direto)

**Endpoints backend:**
- GET /autorizacao/qr-data (autenticado)
- GET /autorizacao/rg-publico/:userId (publico, sem JWT)

**O que muda:**
- 12-qr-code: JA esta funcional. Verificar 2 coisas:
  - URL do QR aponta pra `{origin}/app-v3/14-rg-publico.html?id={userId}` (atualmente parece OK)
  - WhatsApp share inclui o link e nome real
- 14-rg-publico: ler `?id=X` da query, fazer `fetch /autorizacao/rg-publico/X` direto (sem JWT). Renderizar:
  - Nome, idade, tipo sanguineo, contato emergencia
  - Alergias criticas em destaque vermelho
  - Medicamentos em uso
  - Condicoes cronicas
  - Cirurgias passadas
  - Ultimos exames (status + data)
  - Link "Ver exame X" -> abre `exame-publico.html?userId=X&examId=Y` (talvez nao tem v3 dessa, pode usar legado)
  - Banner aviso "Voce esta vendo o RG da Saude de [Nome]"

**Hardcoded a remover:**
- 12-qr-code: nenhum visivel (codigo ja dinamico)
- 14-rg-publico: verificar JS — se tiver dados demo, trocar pelo fetch real

**Criterio de pronto:**
- Paciente logado abre 12-qr-code -> ve QR funcional
- Outro celular escaneia QR -> abre 14-rg-publico com dados do paciente (sem precisar logar)
- 14-rg-publico mostra: nome, alergias, meds, exames recentes, contato emergencia — em 2 segundos (S1 puro pra emergencia)
- Sem dados pessoais sensiveis nao autorizados (CPF nao aparece — ok)

**Dependencias:** Nenhum.

---

### LOTE 7: Perfil editavel (3h)

**Telas afetadas:** `18-perfil.html`

**Funcoes vitaeAPI:** `buscarPerfil()`, `atualizarPerfil(dados)`, `atualizarConta({...})`, `uploadFoto({ fotoUrl })`, `logout()`

**Endpoints backend:**
- GET /perfil
- PUT /perfil
- PATCH /perfil/conta
- POST /perfil/foto

**O que muda:**
- 18-perfil JA esta funcional na major. Polir:
  - Mascara CPF, telefone, peso/altura
  - Validacao cliente: CPF valido (dig verificadores), email valido, telefone +55 formato
  - Upload foto: hoje aceita arquivo + base64. Adicionar opcao "Tirar foto" (camera) com `<input accept="image/*" capture="user">` no mobile
  - Subsecao "Privacidade" com link pra 71-privacidade.html (e pra os termos e LGPD — paginas estaticas)
  - Botao "Excluir minha conta" (LGPD Art. 18) com modal de confirmacao + chamada DELETE /perfil (existe?)
  - Logout JA esta OK
- Edge cases: input vazio salva NULL (nao "—" como string). Confirmar.

**Hardcoded a remover:**
- 18-perfil.html nao tem hardcode critico (so labels e helpers de demo)

**Criterio de pronto:**
- Edicao inline (bottom sheet) salva no backend a cada confirm
- Toast "Salvo" verde
- Foto upload via camera funciona no iPhone
- Logout sai e limpa tokens
- Sem reload completo (SPA-like)

**Dependencias:** Nenhum.

---

### LOTE 8: Privacidade + autorizacoes (1-2h)

**Telas afetadas:** `71-privacidade.html`

**Funcoes vitaeAPI:** `listarAutorizacoes()`, `autorizarMedico({ medicoCrm, duracaoDias })`, `revogarAutorizacao(id)`, `listarConsentimentos()` (opcional)

**Endpoints backend:**
- GET /autorizacao
- POST /autorizacao
- DELETE /autorizacao/:id
- GET /consentimento

**O que muda:**
- 71-privacidade JA funcional. Adicionar:
  - Subsecao "Consentimentos LGPD" — lista os 3 consentimentos (TERMOS_USO, POLITICA_PRIVACIDADE, DADOS_SAUDE) com data de aceite. Link pra revogar.
  - Botao "Ver Termos de Uso" -> abre `/termos.html` (pagina antiga, reusar)
  - Botao "Ver Politica LGPD" -> abre `/lgpd.html`
  - Botao "Baixar meus dados" (LGPD Art. 18) -> POST /pdf/gerar -> retorna URL PDF
  - Estado vazio melhor: hoje mostra "Voce ainda nao autorizou..." com emoji — trocar por SVG

**Hardcoded a remover:**
- Emoji 🔐 e ⚕️ — trocar por SVG (CLAUDE.md regra: zero emoji)

**Criterio de pronto:**
- Paciente autoriza medico por CRM
- Aparece na lista com status Ativo
- Revoga -> some
- Acesso aos termos LGPD funciona
- Baixar PDF retorna arquivo dos dados pessoais

**Dependencias:** Nenhum.

---

### LOTE 9: Quiz com formulario estruturado de medicamento (2-3h)

**Telas afetadas:** `30-quiz.html`, `quiz-preconsulta.html`

**Funcoes vitaeAPI:** ja usadas (`adicionarMedicamento`, `infoMedicamento`)

**Endpoints backend:**
- POST /medicamentos (CRUD existente)
- GET /medicamentos/info/:nome (CMED — opcional autocomplete)

**O que muda:**
- Hoje no quiz, paciente digita medicamentos como string ("Losartana 50mg, Omeprazol 20mg") -> backend parseia simples por virgula. Resultado pobre — sem dose, sem frequencia, sem motivo.
- Mudanca: ao detectar entrada de medicamento, abrir mini-formulario inline (sheet) pra cada med:
  - Nome (com autocomplete CMED via infoMedicamento)
  - Dosagem
  - Frequencia (Todo dia / 2x ao dia / Quando precisar / Outro)
  - Horario (so se "Todo dia")
  - Motivo (Pressao / Refluxo / Vitamina / Outro — string livre)
  - Via (Oral / Sublingual / Outro)
  - Botao "Adicionar mais um" empilhando.
- Mesma logica pra alergias mas mais simples (so substancia + gravidade)

**Hardcoded a remover:** Nenhum (so adicao de UI)

**Criterio de pronto:**
- Paciente no quiz adiciona 3 meds estruturados
- Ao concluir, backend recebe 3 POST /medicamentos com campos preenchidos
- Volta pra 01-saude e ve os 3 com dose, horario e motivo (nao so nome)
- Mesma logica em quiz-preconsulta

**Dependencias:** Lote 2 (precisa do form ja existir).

---

### LOTE 10: Polimento + edge cases + bugs descobertos (3-4h)

**Telas afetadas:** todas as 13 telas restantes do mapa + as novas que o Lucas tiver criado durante o trajeto

**Funcoes vitaeAPI:** todas

**O que muda:**
- Tela 60-erro-offline: ler nome+RG do localStorage cache (vitae_usuario, vitae_perfil_cache) em vez de hardcoded. Mostrar ultima sync.
- Tela 31-pronto: contar respostas reais do quiz e mostrar `X RESPOSTAS` (hoje hardcoded "0")
- Tela 52-loading-home: usar SO durante primeira carga pos-quiz (nao em todo refresh — UX ruim)
- Tela 40-saude-vazia: ler nome real do usuario logado, nao hardcoded
- Mascara CPF/tel em formularios faltantes
- Validacoes: senha forte no cadastro, telefone +55 no quiz, email pattern
- Acessibilidade: alt em todas as imagens, aria-label em botoes icone
- Performance: lazy-load de 09-exames-lista (so carrega exames quando entra na aba)
- Sentry config: incluir api-real.js + adicionar window.onerror handler
- Audit de TODOS os hardcodes que sobraram (rodar grep final)
- Testes manuais: 10 cenarios obrigatorios (cadastro novo, login, quiz, home vazia, home cheia, adicionar med, scan, upload exame, ver QR, paciente antigo do banco antigo)

**Hardcoded a remover:**
- Todo restante que aparecer no grep final

**Criterio de pronto:**
- Grep "Lucas Borelli|LUCAS BORELLI" retorna ZERO no `app-v3/` (excluindo sandbox)
- Grep meds/alergias hardcoded ZERO
- Paciente novo + paciente antigo testados sem erro
- Lighthouse mobile > 85 nas 5 telas principais
- Console clean (sem warning de proptype/key undefined/etc)

**Dependencias:** Lotes 1-9.

---

## 7. Riscos e Pegadinhas Conhecidas

### Tecnicas

1. **API URL hardcoded vs detecao dinamica** (`api-real.js` linha 59-64): pra rodar local, abre com `?api=local`. NAO MUDAR isso porque outras telas dependem. CLAUDE.md regra: "Conexao via api.js — nunca fazer fetch direto" (excecao: rg-publico e exame-publico).

2. **CORS**: app v3 em rota `/app-v3/` na MESMA Vercel (`vitae-app.vercel.app`). NAO precisa adicionar origem no Railway — o origin e o mesmo do app antigo. Mas verificar no boot de cada deploy.

3. **JWT key**: app antigo usa `vitae_token`. App v3 DEVE usar a MESMA chave pra interoperar (paciente logado no antigo ja entra logado no v3). JA esta usando — manter.

4. **Foto cadastrada via quiz v3**: aparece em 18-perfil OK porque ambos leem `usuario.fotoUrl`. Validar tambem que `01-saude.html:header-icon-btn` carrega a foto (hoje so SVG generico).

5. **Quiz helper `quizDetectarCruzamentoAlergiaMed`**: foi escrito em `30-quiz.html` (linha 911) mas NAO existe no app antigo. Lucas mencionou na sessao 14-mai. Se a logica e importante, replicar em `quiz-preconsulta.html` tambem (e ja esta — `quiz-preconsulta.html` tem o mesmo bloco).

6. **Pseudonimizacao de exames**: gap LGPD documentado mas nao implementado no backend. Manual 1 e Manual 3 mencionam. NAO ENTRA NESTA RODADA — feature de phase 2.

7. **Limite 15 scans/dia**: nao implementado. Risco de abuso de Gemini (custo). Phase 2.

8. **Page title dinamico**: 04-med-detalhe.html e 07-alergia-detalhe.html tem `<title>` hardcoded. Trocar via JS no `init()` (ex: `document.title = 'vita id - ' + med.nome`).

9. **Lista de medicamentos sem horario**: backend permite `horario=null`. UI tem que tratar como "Quando precisar" (nao tentar parsear "null" como string).

10. **Calendario semana em 03-medicamentos**: hoje hardcoded em maio. Trocar pra Date hoje + 7 dias com `toLocaleDateString('pt-BR', { weekday: 'short' })`.

### UX

11. **Estado vazio de cada secao**: tem TELAS SEPARADAS (40, 41, 42, 43, 44) pra estados vazios. Decisao: ainda usa-las ou render inline em cada tela cheia? Recomendado: 01-saude usa inline (porque tem RG card), 03/06/09/15 redirecionam pra a tela vazia (porque sem dados nao tem o que mostrar).

12. **Loading first time**: usar 52-loading-home so apos `31-pronto` (transicao do quiz pra home) — nao em todo refresh.

13. **Foto camera mobile**: `<input capture="user">` so funciona em mobile. Em desktop, pula direto pra file picker. OK.

14. **Datas em PT-BR**: usar `Date.toLocaleDateString('pt-BR')` em tudo. Nunca hardcoded.

### Estrategicas

15. **Aba Score removida**: o v3 nao tem Score na tab-bar. CLAUDE.md menciona que foi removida na Sessao 6. Decisao mantida — paciente nao precisa ver Score 0-100, e mais util pro medico.

16. **IA, IA, IA**: CLAUDE.md regra absoluta — nunca usar "IA" na copy. Trocar "IA analisa exame" por "Sistema le seu exame". Manter em comentarios de codigo.

17. **Zero emoji**: 71-privacidade tem 🔐 e ⚕️. Trocar por SVG no Lote 8.

18. **Tom institucional**: "Olá, Lucas" -> "Ola, [Primeiro nome]" e formal (nao "E ai, Lucas").

### Operacionais

19. **Deploy isolado**: cada lote = 1 commit = 1 deploy automatico Vercel. Reduz risco. Lucas testa apos cada um.

20. **Rollback**: se algum lote quebrar, reverter o commit. App v3 esta em rota separada — antigo continua funcionando paralelo (Lote 10 do antigo nao precisa morrer ainda).

21. **Cutover so quando 10 lotes verdes**: NAO acelerar. Lucas precisa validar.

---

## 8. Criterio de Cutover (Fase 9)

Pra app v3 substituir o antigo, todas as condicoes abaixo precisam ser TRUE:

### Tecnicas

- [ ] 10 lotes commitados e deployados
- [ ] Bateria Playwright passa em todas as 13 telas com hardcoded removido
- [ ] Grep final no `app-v3/`: `Lucas Borelli|Losartana 50mg|Dipirona.*Renata|001234567|98765-4321` retorna ZERO (exceto placeholders e comentarios)
- [ ] Sentry: 0 erro novo nas 48h apos Lote 10
- [ ] Lighthouse mobile > 85 em 5 telas principais (01, 03, 06, 09, 15)
- [ ] Mesmo paciente logado no antigo entra logado no v3 (interop JWT)

### Funcionais

- [ ] Paciente NOVO consegue: cadastrar + receber SMS + quiz + ver home com seu nome + adicionar med + adicionar alergia + escanear QR
- [ ] Paciente EXISTENTE (do banco) abre v3 e ve seus dados sem perder nada
- [ ] Medico autorizado abre QR do paciente e ve dados em < 3s
- [ ] Foto cadastrada no quiz aparece em 01-saude, 18-perfil, 14-rg-publico

### UX

- [ ] Lucas + 2 betatesters pacientes confirmam que esta "melhor que o antigo"
- [ ] Zero feedback "onde clico pra fazer X" (intuitividade)
- [ ] Nenhum elemento mais lento que no antigo

### Metricas a medir

- Tempo medio pra completar quiz (alvo: < 4min)
- % paciente que conclui onboarding sem desistir (alvo: > 80%)
- Tempo de carregamento 01-saude com dados (alvo: < 1.5s)
- Erros de fetch nas primeiras 24h (alvo: < 5 por paciente)
- NPS perguntado depois de 1 semana (alvo: >= 8)

### Plano A/B

Vercel rewrite condicional:
- Dia 1-3: 10% do trafego -> `/app-v3/` (resto vai pra `/`)
- Dia 4-7: 50% se metricas estaveis
- Dia 8+: 100% (rota `/` redireciona pra `/app-v3/`)

### Rollback rapido

Em `vercel.json`:

```json
{
  "rewrites": [
    { "source": "/((?!app-v3).*)", "destination": "/$1" }
  ]
}
```

Se v3 quebrar: muda `vercel.json` pra direcionar tudo pra raiz e rebuild = 60 segundos. Lucas pode executar isso sozinho.

---

## 9. O Que NAO Vai Entrar Nesta Rodada

Features que existem no app antigo mas ficam pra phase 2 (nao cabem em 10 lotes):

### Telas que NAO migram pro v3 nesta rodada

- **10-score.html**: aba Score 0-100 com 4 pilares + idade biologica. Decisao Sessao 6: removida. Score sera so um numero pequeno opcional no header da 01-saude (se Lucas pedir).
- **15-bioage-sem-dados.html**: Idade biologica — tela "sem dados" com CTA. NAO migra.
- **23-agendamentos.html (paciente)**: agendamentos do paciente. Substituido por 15-consultas do v3 que ja agrega.
- **30-lembretes.html**: lembretes de medicamento. Push notifications nao implementado. Adesao calculada client-side por enquanto.
- **31-revisao-alergias.html**: revisar alergias extraidas do scan. Scan nao entra (ver abaixo).
- **medico-exames/alergias/meds/condicoes**: foram apagadas na Sessao 6. NAO existem mais.

### Features que existem mas NAO entram

- **Scan de receita** (26-scan-receita + 27-processando + 28+ no antigo): camera/galeria + IA Gemini. NAO entra. Substituicao: botao "Escanear" em 05-add-med chama vitaeAPI.scanReceita e mostra retorno bruto pro usuario completar manual. Sem UX de revisao.
- **Scan de alergia**: similar — adicionar manual no Lote 3 e fim.
- **Check-in semanal**: backend pronto, sem UI no antigo. NAO entra.
- **PDF gerar**: backend pronto. Botao "Baixar dados LGPD" em 71-privacidade chama mas sem UX de preview.
- **Notificacoes**: backend pronto, sem UI no antigo. NAO entra.
- **Score detalhado com 4 pilares + bonus exames**: NAO entra. Backend continua calculando — so nao mostra.
- **Modo medico em 09-exames-lista**: ja existe na implementacao atual mas precisa testar visualmente. Pode ficar pra Lote 10.

### Features do lado do medico (NAO ENTRAM no v3 paciente)

Sao features existentes mas NO LADO DO MEDICO — paciente nem ve:

- **IA Collab**: comparativo entre anamneses do mesmo paciente em consultas diferentes. So aparece no `desktop/app-v2.html` do medico.
- **Analise prosodica**: deteccao de sinais sutis na voz. CFM 2.314/2022. So medico ve resultado.
- **Metricas honestas**: tempo economizado, receita possivel. Dashboard do medico.
- **Templates de pre-consulta**: criar/editar/disparar template. So medico.
- **Anamnese estruturada 11 campos**: aparece no 25-summary.html (medico) — paciente nem ve esse texto.
- **Padroes Observados v2**: 5 agentes que cruzam dados clinicos. Medico ve resultado.

### Considerar pra phase 2 (apos cutover)

- Push notification de lembretes
- Modo offline com IndexedDB cache
- Tela Score detalhada
- Scan receita + revisao + cadastro estruturado
- Tela Idade Biologica
- Backups automaticos pelo paciente
- Compartilhamento de exame especifico (link unico)
- Apple Health / Google Fit integration
- Plano pago

---

## 10. Resumo de Tempo + Pedido de Aprovacao

Total estimado: **26-34 horas** distribuidas em **10 sessoes Claude**.

Cada sessao:
1. Lucas valida no inicio que o lote anterior funciona ("ok, parte X")
2. Claude executa o lote completo (com testes manuais)
3. Commit + push + deploy Vercel
4. Lucas testa em ~5min
5. Se OK, avanca pro proximo. Se ruim, ajusta antes.

Lucas: leia este documento. Se quiser:
- Mudar a ORDEM dos lotes (priorizar diferente)
- Adicionar/remover lotes
- Mudar criterio de cutover
- Adicionar uma feature pra phase 1
- Tirar uma feature pra phase 2

Avise antes de comecar o Lote 1.

---
