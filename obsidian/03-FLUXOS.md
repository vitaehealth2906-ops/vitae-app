# Fluxos de Navegacao — vita id

> Voltar pra [[00-CENTRAL]] | Lista completa em [[02-TELAS]]

---

## Fluxo Principal — Primeiro Acesso

```
Usuario abre o app
    |
index.html (redirect automatico)
    |
01-splash.html (animacao 8s)
    |
    +-- JA LOGADO? --> 08-perfil.html (home do paciente)
    |                  20-medico-dashboard.html (home do medico)
    |
    +-- NAO LOGADO? --> 00-escolha.html
                            |
                    +-------+-------+
                    |               |
              "Paciente"       "Medico"
                    |               |
          02-slides-paciente  02-slides-medico
                    |               |
                    +-------+-------+
                            |
                    03-cadastro.html
                            |
              +-------------+-------------+
              |             |             |
         Novo Paciente  Novo Medico   Login
              |             |             |
         05-quiz.html  20-med-cadastro  (verifica tipo)
              |             |             |
         06-concluido  20-med-dash    08-perfil ou
              |                       20-med-dash
         08-perfil.html
```

---

## Hub do Paciente — Todas as Saidas

```
                    08-perfil.html
                    (HOME CENTRAL)
                         |
    +----+----+----+----+----+----+----+----+----+
    |    |    |    |    |    |    |    |    |    |
  dados score exames qr  meds alerg autor agend lemb bioage
   09    10    11   21   16   17    22   23    30   15
```

Cada tela de feature tem botao "voltar" que retorna pro 08-perfil.

---

## Fluxo de Scan (Medicamentos e Alergias)

```
16-medicamentos.html  ou  17-alergias.html
         |
    "Escanear receita"
         |
26-scan-receita.html (FALTANDO)
    Camera ou Galeria
         |
27-processando.html (FALTANDO)
    Loading enquanto IA analisa
         |
    +----+----+
    |         |
  Se MEDS   Se ALERGIAS
    |         |
  (volta    31-revisao-alergias.html
   pro 16)   Revisar antes de salvar
              |
         17-alergias.html
```

---

## Fluxo de Senha

```
03-cadastro.html (modo login)
         |
    "Esqueci minha senha"
         |
14-esqueci-senha.html
    Digita email
         |
    (email enviado)
         |
15-nova-senha.html
    Define nova senha (via token do link)
         |
03-cadastro.html (volta pro login)
```

---

## Fluxo do Medico

```
20-medico-dashboard.html
    (HUB DO MEDICO)
         |
    +----+----+----+
    |         |    |
  Clicar   Templates  Perfil
  pre-consulta        Pacientes
    |
25-summary.html
    Resumo IA de 1 minuto
    do paciente
```

**Pre-consulta (lado do paciente):**
```
Medico gera link no dashboard
         |
Envia pro paciente via WhatsApp/email
         |
Paciente abre pre-consulta.html
    Preenche formulario
    Grava audio (opcional)
         |
quiz-preconsulta.html (FALTANDO)
         |
Medico ve resultado em 25-summary.html
```

---

## Fluxo QR Code (compartilhamento publico)

```
21-qrcode.html
    Paciente gera QR
         |
    Medico escaneia com celular
         |
rg-publico.html
    Ve o RG da Saude do paciente (sem login)
         |
    "Ver exame"
         |
exame-publico.html
    Ve detalhes de um exame especifico
```

---

## Tab Bar — Navegacao Fixa

Presente em quase todas as telas do paciente. 5 itens:

| Posicao | Nome | Destino |
|---------|------|---------|
| 1 | Meu RG | 08-perfil.html |
| 2 | Score | 10-score.html |
| 3 | Exames | 11-exames-lista.html |
| 4 | QR Code | 21-qrcode.html |
| 5 | Editar | 09-dados-pessoais.html |

---

## Mapa Visual Interativo

Abrir o arquivo `mapa-fluxo-completo.html` no navegador pra ver o diagrama completo com:
- Todas as telas posicionadas em fileiras
- Linhas de conexao entre elas
- Preview real de cada tela
- Clique pra destacar conexoes
- Duplo clique pra ver a tela em tamanho grande
