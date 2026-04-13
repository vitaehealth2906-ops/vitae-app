# Historico de Decisoes — vita id

> Voltar pra [[00-CENTRAL]]

---

## Como usar esta nota

Toda vez que uma decisao importante for tomada no projeto, registre aqui. Isso evita que no futuro alguem (ou uma IA) pergunte "por que isso foi feito assim?" e ninguem saiba responder.

Formato: Data | Decisao | Por que | Alternativa descartada

---

## Decisoes Fundamentais

| Data | Decisao | Por que | Alternativa descartada |
|------|---------|---------|----------------------|
| Inicio | HTML puro em vez de React/Next.js | Velocidade de prototipacao, Lucas nao programa, menos complexidade | React, Flutter, React Native |
| Inicio | Supabase pra banco + storage | PostgreSQL + Storage + Auth tudo junto, gratuito pra comecar | Firebase (NoSQL, menos flexivel pra dados de saude) |
| Inicio | Claude API pra leitura de exames | Melhor compreensao de documentos medicos complexos | GPT-4 (testado, menos preciso em documentos medicos BR) |
| Inicio | Railway pra hospedar backend | Simples, deploy automatico via git push | Vercel (limitacoes de serverless), Render (mais lento) |
| Inicio | JWT com refresh tokens | Usuario nao precisa logar toda hora (30 dias), seguro | Sessao no servidor (mais complexo de escalar) |
| Inicio | Tom institucional serio | Saude e assunto serio, confianca e fundamental | Tom casual de startup (nao transmite confianca medica) |
| Inicio | ZERO emojis | Profissionalismo, icones SVG sao mais controlaveis | Emojis (parecem amadores em contexto de saude) |
| Inicio | Nunca mencionar IA | Usuario nao confia em "IA fazendo diagnostico", medo | Destacar IA como diferencial (assusta mais do que atrai) |

---

## Decisoes de Design

| Data | Decisao | Por que |
|------|---------|---------|
| Recente | Tema claro (#F4F6FA) como padrao | Mais legivel pra informacoes medicas, mais profissional |
| Recente | Plus Jakarta Sans como fonte unica | Moderna sem ser casual, legivel em tamanhos pequenos |
| Recente | Gradiente 120deg green→cyan | Diferencia da concorrencia (todos usam azul medico) |
| Recente | Titulos com italico verde | Assinatura visual unica do vita id, chama atencao pro conteudo |
| Recente | Frame de celular 393x852 | Simula iPhone 14/15, tamanho mais comum no Brasil |
| Recente | Tab bar com 5 itens fixos | Cobre as acoes mais frequentes sem sobrecarregar |

---

## Decisoes Tecnicas Recentes

| Data | Decisao | Por que |
|------|---------|---------|
| Recente | Gemini pra scan de receita (em vez de Claude) | Melhor reconhecimento visual de medicamentos em fotos |
| Recente | Claude Vision pra OCR (em vez de Google Cloud Vision) | Uma dependencia a menos, Claude ja estava no projeto |
| Recente | api.js como modulo unico compartilhado | Todas as telas falam com o backend do mesmo jeito, menos bugs |
| Recente | vitae-core.css como "fonte unica de verdade" | Evita estilos duplicados, tudo em um lugar |
| 09/04/2026 | Criar mapa de fluxo visual | Projeto cresceu, precisava visualizar tudo antes de continuar |
| 09/04/2026 | Documentar identidade visual em tela HTML | Garantir que proximas telas sigam o padrao sem depender de memoria |
| 09/04/2026 | Criar vault Obsidian | Organizar conhecimento do projeto fora do codigo, acessivel pra Lucas e pra IAs |

---

## Decisoes Pendentes

| Decisao | Opcoes | Impacto |
|---------|--------|---------|
| Manter ou deletar pasta frontend/ (Next.js) | Manter pra futuro OU deletar pra limpar | Se manter, precisa sincronizar design. Se deletar, simplifica |
| Manter ou deletar pasta vitae-app-git/ | Arquivar OU deletar | 29 commits de historico que podem ter valor |
| Manter ou deletar pasta server/ (wearable) | Deletar agora OU manter pra futuro | WHOOP/Oura e feature futura? |
| Converter HTML pra app nativo | PWA, React Native, Flutter | Grande decisao de futuro — quando o MVP validar no mercado |
| Push notifications | Firebase, OneSignal, Expo | Necessario pra lembretes de medicamento funcionarem de verdade |

---

## Como registrar nova decisao

Copie este template:

```
| DD/MM/AAAA | [O que foi decidido] | [Por que — qual problema resolve] | [O que foi descartado e por que] |
```
