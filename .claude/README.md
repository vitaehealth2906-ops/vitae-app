# Configuracao Claude Code — Projeto VITAE

## O que esta aqui

`settings.json` configura um **hook SessionStart** que injeta automaticamente os 5 arquivos vivos do vault Obsidian no contexto do Claude **toda vez que uma conversa nova comeca**.

## Como funciona

```
Voce abre Claude Code
  → Hook SessionStart dispara
  → Roda: load-vault-for-claude.ps1
  → Script le 5 arquivos do vault Obsidian
  → Imprime JSON com additionalContext
  → Claude le no system prompt
  → Claude ja chega sabendo: estado atual + CONSTITUICAO + erros aprendidos + padroes vencedores + briefing projeto
```

## Arquivos lidos (~18K tokens total)

1. `_LLM/CONTEXTO-ATUAL.md` — estado vivo do projeto (data, tarefas, decisoes recentes)
2. `CONSTITUICAO-JARVIS.md` — DNA do agente (32 regras absolutas)
3. `14 — RETROSPECTIVAS/ERROS-IA-APRENDIDOS.md` — erros que IA cometeu (NAO repetir)
4. `14 — RETROSPECTIVAS/PADROES-VENCEDORES.md` — o que funcionou (REPLICAR)
5. `_LLM/BRIEFING-PROJETO.md` — sumario completo do projeto

## Quanto custa

- ~$0.10 por sessao nova (vs ~$0.00 sem hook)
- ~1-2s de latencia adicional no inicio da sessao
- Sem custo nas conversas subsequentes (so dispara em sessao NOVA)

## Como TESTAR se esta funcionando

Pergunte ao Claude no inicio de uma sessao nova:
> "Resume em 3 frases o estado atual do projeto VITAE conforme o CONTEXTO-ATUAL.md."

Se Claude responder com dados do dia atual = hook funcionando.
Se Claude responder generico ou desatualizado = hook nao disparou.

## Como ATUALIZAR os arquivos vivos

Toda vez que tomar decisao estrategica, descobrir erro novo, ou mudar fase:
- Edita `_LLM/CONTEXTO-ATUAL.md` (manual ou peca pro Claude)
- Edita `14 — RETROSPECTIVAS/ERROS-IA-APRENDIDOS.md` se erro novo
- Edita `14 — RETROSPECTIVAS/PADROES-VENCEDORES.md` se padrao novo

Proxima sessao Claude ja le a versao nova.

## Como DESLIGAR o hook temporariamente

Renomeie `settings.json` para `settings.json.disabled`. Reabra Claude Code. Hook nao dispara.

## Como ESTENDER (Fase 3 — auto-learn)

Adicionar hook `PostToolUse` ou similar que detecta:
- Build falhou
- Lucas corrigiu o Claude
- Decisao foi tomada
- → Atualiza ERROS-IA-APRENDIDOS ou PADROES-VENCEDORES automaticamente

Roadmap em `_SISTEMA/AUTOMACOES.md`.

## Como ESTENDER (Fase 4 — RAG)

Quando vault tiver 100+ diaries acumulados:
- Vetorizar tudo com OpenAI embeddings
- Indexar em Chroma local
- Adicionar funcao `mcp__vault__busca("...")` que Claude chama em prompts grandes
- Custo: ~$5-15/mes

## Arquivos relacionados

- Script: `C:/Users/valve/OneDrive/Documentos/Obsidian Vault/_SISTEMA/load-vault-for-claude.ps1`
- Hook config: `d:/vitae-app-novo/.claude/settings.json`
- Regra no CLAUDE.md: secao 3 "LEITURA ATIVA DO VAULT OBSIDIAN"
