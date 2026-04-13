# vita id — Documento Central

> Atualizado em: 09/04/2026
> Fundador: Lucas Borelli, 18 anos, Americana-SP
> Status: MVP funcional — 31 telas prontas, backend rodando, 4 arquivos faltando

---

## O que e a vita id?

Um **RG Digital de Saude** para brasileiros. O paciente guarda num lugar so: exames, medicamentos, alergias, consultas, score de saude. O medico consegue ver um resumo do paciente em 1 minuto antes da consulta.

**Origem pessoal:** Lucas foi internado por crise alergica (Dipirona + Penicilina). Nenhum sistema avisou o medico. O vita id nasceu pra resolver isso — seu historico de saude sempre acessivel, em qualquer emergencia.

**Proposta de valor:**
- Para o paciente: "Seu historico de saude inteiro no bolso. Compartilhe com qualquer medico em 1 segundo via QR Code."
- Para o medico: "Saiba tudo do seu paciente em 1 minuto antes da consulta. Sem papel, sem esquecimento."

---

## Mapa do Vault

| Nota | O que tem |
|------|-----------|
| [[01-IDENTIDADE]] | Cores, fontes, logo, tom de voz, regras visuais |
| [[02-TELAS]] | Todas as 38 telas e o que cada uma faz |
| [[03-FLUXOS]] | Como o usuario navega entre as telas |
| [[04-BACKEND]] | O que o servidor faz, quais servicos usa |
| [[05-BANCO-DE-DADOS]] | As 17 tabelas e o que cada uma guarda |
| [[06-PROBLEMAS]] | Bugs conhecidos, coisas que faltam, dividas tecnicas |
| [[07-REGRAS-IA]] | Regras pra qualquer IA seguir no projeto |
| [[08-DECISOES]] | Historico de por que cada coisa foi feita assim |
| [[09-ROADMAP]] | O que falta fazer, prioridades, futuro |
| [[10-SESSOES]] | Log de cada sessao de trabalho |

---

## Servicos Ativos

| Servico | Pra que | Status |
|---------|---------|--------|
| Railway | Hospeda o servidor | Ativo |
| Supabase | Banco de dados + Storage | Ativo |
| Anthropic (Claude) | Leitura de exames + resumos | Ativo |
| Google (Gemini) | Scan de receitas | Ativo |
| Twilio | SMS de verificacao | Ativo |
| Resend | Email de reset de senha | Ativo |
| GitHub | Codigo fonte | Ativo |

---

## Acesso Rapido

- **Projeto:** `d:\vitae-app-github\`
- **Backend produção:** vitae-app-production.up.railway.app
- **GitHub:** vitaehealth2906-ops/vitae-app
- **Identidade visual (tela):** `identidade-visual.html`
- **Mapa de fluxo (tela):** `mapa-fluxo-completo.html`
