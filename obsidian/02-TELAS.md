# Todas as Telas — vita id

> Voltar pra [[00-CENTRAL]] | Navegacao em [[03-FLUXOS]]

---

## Resumo

- **31 telas funcionais** do app
- **4 telas faltando** (referenciadas mas arquivo nao existe)
- **7 telas internas/dev** (nao sao do app, sao ferramentas)
- **2 telas estaticas** (termos, lgpd)

---

## Entrada e Onboarding

| # | Arquivo | O que faz | Status |
|---|---------|-----------|--------|
| — | index.html | Redireciona pro splash automaticamente | Pronto |
| 01 | 01-splash.html | Tela de abertura animada (8s). Se ja logado, vai pro perfil | Pronto |
| 00 | 00-escolha.html | "Voce e Paciente ou Medico?" — primeira decisao | Pronto |
| 02 | 02-slides-paciente.html | 3 slides explicando o vita id pro paciente | Pronto |
| 02 | 02-slides-medico.html | Slides explicando o vita id pro medico | Pronto |
| 03 | 03-cadastro.html | Criar conta (nome, tel, email, senha) ou fazer login | Pronto |
| 04 | 04-verificacao.html | Codigo SMS de 6 digitos pra verificar telefone | Pronto |
| 05 | 05-quiz.html | Quiz multi-etapa: nascimento, sangue, genero, CPF, altura, peso | Pronto |
| 06 | 06-concluido.html | Tela de celebracao com confetti e check animado | Pronto |

---

## Telas do Paciente

| # | Arquivo | O que faz | Status |
|---|---------|-----------|--------|
| 08 | 08-perfil.html | **HOME PRINCIPAL.** RG da Saude com sangue, idade, alergias, medicamentos | Pronto |
| 09 | 09-dados-pessoais.html | Editar nome, CPF, tipo sanguineo, contato emergencia | Pronto |
| 10 | 10-score.html | Pontuacao de saude (0-100) com 4 pilares | Pronto |
| 11 | 11-exames-lista.html | Lista de todos os exames + upload de novos. Tema escuro | Pronto |
| 15 | 15-bioage-sem-dados.html | Idade biologica — tela "sem dados ainda" com CTA pra adicionar exames | Pronto |
| 16 | 16-medicamentos.html | Lista de medicamentos. Adicionar manual ou scan de receita | Pronto |
| 17 | 17-alergias.html | Lista de alergias por categoria. Adicionar manual ou scan | Pronto |
| 21 | 21-qrcode.html | QR Code compartilhavel do RG da Saude | Pronto |
| 22 | 22-autorizacao.html | Gerenciar quem pode ver seus dados | Pronto |
| 23 | 23-agendamentos.html | Consultas marcadas | Pronto |
| 30 | 30-lembretes.html | Lembretes de medicamentos (manha/noite, adesao) | Pronto |
| 31 | 31-revisao-alergias.html | Revisar alergias extraidas do scan antes de salvar | Pronto |

---

## Telas de Senha

| # | Arquivo | O que faz | Status |
|---|---------|-----------|--------|
| 14 | 14-esqueci-senha.html | Digitar email pra receber link de reset | Pronto |
| 15 | 15-nova-senha.html | Definir nova senha usando token do email | Pronto |

> Problema: 15-bioage e 15-nova-senha usam o mesmo numero. Ver [[06-PROBLEMAS]].

---

## Telas do Medico

| # | Arquivo | O que faz | Status |
|---|---------|-----------|--------|
| 20 | 20-medico-cadastro.html | CRM, UF, especialidade, clinica | Pronto |
| 20 | 20-medico-dashboard.html | **HUB DO MEDICO.** Pre-consultas, templates, pacientes, perfil | Pronto |
| 25 | 25-summary.html | Resumo de 1 minuto do paciente (gerado por IA) | Pronto |
| — | pre-consulta.html | Formulario que paciente preenche antes da consulta (link do medico) | Pronto |

---

## Telas Publicas (sem login)

| Arquivo | O que faz | Status |
|---------|-----------|--------|
| rg-publico.html | Versao publica do RG da Saude (quem escaneia o QR ve isso) | Pronto |
| exame-publico.html | Ver um exame especifico compartilhado | Pronto |
| termos.html | Termos de uso (texto estatico) | Pronto |
| lgpd.html | Politica de privacidade LGPD (texto estatico) | Pronto |

---

## Telas que FALTAM (nao existem)

| Arquivo | O que deveria fazer | Quem chama |
|---------|-------------------|------------|
| 26-scan-receita.html | Abrir camera ou galeria pra escanear receita/bula | 16-medicamentos, 17-alergias |
| 27-processando.html | Tela de loading enquanto processa o scan | 16-medicamentos, 17-alergias |
| quiz-preconsulta.html | Quiz que paciente responde na pre-consulta | pre-consulta.html |
| 01-login.html | Tela de login separada (botao de logout do medico aponta pra ca) | 20-medico-dashboard |

> Detalhe em [[06-PROBLEMAS]]

---

## Telas Internas / Dev (nao sao do app)

| Arquivo | O que faz |
|---------|-----------|
| mapa-telas.html | Mapa visual de todas as telas (cards com status) |
| mapa-fluxo-completo.html | Diagrama interativo de fluxo entre telas |
| identidade-visual.html | Documentacao visual completa (cores, componentes, telas) |
| fluxo-medicamentos-alergias.html | Diagrama do fluxo de scan |
| dashboard-scan.html | Tracker de progresso de implementacao |
| teste-scan.html | Teste direto de scan (debug, sem auth) |
| diag-scan.html | Diagnostico do fluxo de scan (debug) |
| summary-demo.html | Demo do resumo em tema escuro (abandonado) |
