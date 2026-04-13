# Problemas Conhecidos — vita id

> Voltar pra [[00-CENTRAL]]

---

## Criticos (impedem funcionalidade)

### 1. Quatro telas faltando
Existem 4 arquivos que sao referenciados por outras telas mas **nao existem** no projeto:

| Arquivo | Impacto | Quem chama |
|---------|---------|------------|
| 26-scan-receita.html | Paciente nao consegue escanear receita | 16-medicamentos, 17-alergias |
| 27-processando.html | Nao tem tela de loading do scan | 16-medicamentos, 17-alergias |
| quiz-preconsulta.html | Paciente nao finaliza pre-consulta | pre-consulta.html |
| 01-login.html | Botao logout do medico quebrado | 20-medico-dashboard |

**Consequencia:** O fluxo de scan de receita esta quebrado. O botao "Escanear" nos medicamentos e alergias leva pra tela que nao existe.

---

### 2. Duas pastas do projeto
| Pasta | Status | Commits |
|-------|--------|---------|
| d:\vitae-app-github\ | **ATIVA** — sendo desenvolvida | 320 |
| d:\vitae-app-git\ | Antiga — divergiu | 349 |

Nao sao duplicatas exatas. A antiga tem 29 commits a mais e arquivos que foram deletados na nova. A nova tem arquivos que a antiga nao tem (vitae-core.css, scan flow, etc).

**Risco:** Confusao sobre qual e a "verdade". Alguem pode editar a pasta errada.

---

## Organizacao

### 3. Numeracao confusa de telas
- `15-bioage-sem-dados.html` e `15-nova-senha.html` usam o **mesmo numero 15**
- `20-medico-cadastro.html` e `20-medico-dashboard.html` usam o **mesmo numero 20**
- Nao existe tela 07, 12, 13, 18, 19, 24, 26, 27, 28, 29

### 4. Arquivos de dev misturados com telas reais
Na raiz do projeto, 7 arquivos internos/dev ficam junto com as 31 telas do app:
- mapa-telas.html, mapa-fluxo-completo.html, identidade-visual.html
- fluxo-medicamentos-alergias.html, dashboard-scan.html
- teste-scan.html, diag-scan.html, summary-demo.html

### 5. Documentos de planejamento soltos
6 arquivos `.md` de planejamento na raiz:
- diagnostico-completo.md, mapa-implementacao-completo.md
- mapeamento-completo-scan.md, objetivo-implementacao.md
- planejamento-scan-definitivo.md, plano-fase-3-4-definitivo.md
- plano-foto-medicamento-definitivo.md, plano-world-class.md

### 6. Frontend Next.js incompleto
A pasta `frontend/` tem um app React/Next.js com apenas 12 telas:
- Design **diferente** (tema escuro vs tema claro das HTMLs)
- Porta **errada** (aponta pra 3001, backend roda na 3002)
- **NAO e o frontend ativo** — as telas HTML sao o frontend real
- Gera confusao sobre qual interface e a "oficial"

---

## Tecnicos

### 7. Porta inconsistente
- Backend `.env`: porta 3002
- Next.js `next.config.js`: aponta pra 3001
- HTML `api.js`: aponta pra 3002 (correto)

### 8. Credenciais no .env
O arquivo `backend/.env` tem chaves reais (API Anthropic, Supabase, Twilio). Esta protegido pelo `.gitignore` (nao sobe pro GitHub), mas se alguem clonar e rodar o projeto, precisa criar o proprio `.env`.

### 9. Pasta server/ abandonada
Tentativa de integrar WHOOP e Oura Ring. Sem credenciais configuradas, sem conexao com o backend principal. Pode ser deletada.

---

## Prioridades de Resolucao

| Prioridade | Problema | Esforco |
|-----------|---------|---------|
| Alta | Criar as 4 telas faltando | Medio |
| Alta | Limpar/arquivar pasta vitae-app-git | Baixo |
| Media | Reorganizar numeracao das telas | Medio (muitas referencias cruzadas) |
| Media | Separar arquivos dev das telas do app | Baixo |
| Baixa | Mover .md de planejamento pra pasta docs/ | Baixo |
| Baixa | Decidir futuro do Next.js (manter ou deletar) | Decisao |
| Baixa | Deletar pasta server/ | Baixo |
