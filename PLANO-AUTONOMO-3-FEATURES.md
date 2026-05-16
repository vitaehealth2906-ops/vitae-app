# PLANO MESTRE AUTÔNOMO — 3 FEATURES VITAE

**Versão:** 2026-05-16 (substitui PLANO-IMPLEMENTACAO-3-FEATURES.md)
**Autor:** Claude Opus 4.7 (1M context) + estudo de 64 docs Obsidian + 3 agentes paralelos
**Objetivo:** ZERO permissão, ZERO bug, 100% precisão. Após este plano executar, app médico (`vitae-app.vercel.app/desktop/app-v2.html`) + app paciente (`vitae-app.vercel.app/app-v3/`) ficam totalmente integrados com as 3 features.

---

## SUMÁRIO

- [0. Contexto e estado atual exato](#0-contexto-e-estado-atual-exato)
- [1. Princípios operacionais (não-negociáveis)](#1-princípios-operacionais-não-negociáveis)
- [2. Setup Playwright + Personas reais](#2-setup-playwright--personas-reais)
- [3. FASE 1 — Próximo Retorno (correção do frontend paciente)](#3-fase-1--próximo-retorno-correção-do-frontend-paciente)
- [4. FASE 2 — Documentos / Mídias](#4-fase-2--documentos--mídias)
- [5. FASE 3 — Contato Direto WhatsApp](#5-fase-3--contato-direto-whatsapp)
- [6. Critérios "100% precisão" por fase](#6-critérios-100-precisão-por-fase)
- [7. Anti-padrões observados (NUNCA fazer)](#7-anti-padrões-observados-nunca-fazer)
- [8. Compliance regulatório por fase](#8-compliance-regulatório-por-fase)
- [9. Plano de validação humana (o que só Lucas faz)](#9-plano-de-validação-humana-o-que-só-lucas-faz)
- [10. Cronograma e dependências](#10-cronograma-e-dependências)
- [11. Rollback completo por fase](#11-rollback-completo-por-fase)
- [12. Glossário e mapeamento de arquivos](#12-glossário-e-mapeamento-de-arquivos)

---

## 0. Contexto e estado atual exato

### 0.1 Os dois apps

| Camada | URL produção | Arquivo principal | Estado |
|--------|-------------|-------------------|--------|
| App médico | https://vitae-app.vercel.app/desktop/app-v2.html | `desktop/app-v2.html` | Central Clínica 2 colunas APROVADA |
| App paciente | https://vitae-app.vercel.app/app-v3/ | `app-v3/01-saude.html` (home) | 44 telas estruturadas, 5 abas |
| Backend | https://vitae-app-production.up.railway.app/ | `backend/src/index.js` | 18 arquivos de rotas, Prisma + Supabase |

### 0.2 Tab bar do app paciente (5 abas)

1. **Meu RG** → `01-saude.html` (home, score, dados rápidos)
2. **Exames** → `09-exames-lista.html`
3. **QR Code** → `12-qr-code.html`
4. **Consultas** → `15-consultas.html` ← **Fase 1 plug aqui**
5. **Perfil** → `18-perfil.html` ← **Fase 3 plug aqui**

`16-consulta-detalhe.html` é navegável a partir de `15-consultas.html` (click num card de consulta) ← **Fase 2 plug aqui**

### 0.3 Fase 1 — Próximo Retorno: estado real

| Camada | Estado | Observação |
|--------|--------|-----------|
| Schema Prisma (Agendamento) | ✅ 6 campos novos em prod | `statusProposta`, `propostoPor`, `propostoPorId`, `confirmadoEm`, `dataAnterior`, `motivoStatus` |
| Migration | ✅ aplicada (commit `134cccb`) | `backend/prisma/migrations/20260516_proximo_retorno/migration.sql` |
| Backend (7+ rotas) | ✅ deploy Railway | `backend/src/routes/agendamento.js` (propor, confirmar, recusar, remarcar, cancelar, listar pendentes paciente, listar retornos médico) |
| Auditoria CFM | ✅ chamada em 5 acoes | `backend/src/utils/auditoria.js` (PROPOR/CONFIRMAR/RECUSAR/REMARCAR/CANCELAR_RETORNO) |
| Notificações in-app | ✅ tabela Notificacao | Push real fica Fase 4 (depois) |
| Frontend médico | ✅ aprovado (commit `b32b639`) | Card "Próximo Retorno" na col esquerda da Central Clínica |
| **Frontend paciente** | ❌ **NO LUGAR ERRADO** | Foi pro `23-agendamentos.html` (fora do app-v3). Tela correta: `app-v3/15-consultas.html`. **PRECISA REFAZER** |

### 0.4 Fase 2 — Documentos: estado real

- ❌ Tabela `DocumentoMedico` NÃO existe (confirmado via grep no schema)
- ✅ Helper Supabase Storage pronto: `backend/src/services/storage.js` → funções `upload()` e `gerarUrlAssinada()` (fallback local se Supabase falhar)
- ✅ Padrão de upload existe em `backend/src/routes/exames.js` (multer + storage.upload() + prisma.exame.create())
- ❌ Frontend médico mostra empty state Apple-style mas modal abre "em desenvolvimento" (placeholder atual)
- ❌ Frontend paciente: zero implementação em `16-consulta-detalhe.html`

### 0.5 Fase 3 — Contato Direto WhatsApp: estado real

- ❌ Tabela `ConfigContatoMedico` NÃO existe
- ⚠️ Modelo `Medico` no schema NÃO possui `whatsappNumero`, `diasDisponiveis`, `horaInicio`, `horaFim`
- ✅ Infraestrutura Twilio existe via `NotificacaoDisparo` (canal whatsapp)
- ⚠️ Frontend médico tem toggle visual mas grava só em `DR.config` local (não persiste)
- ❌ Frontend paciente: zero implementação em `18-perfil.html`

### 0.6 Credenciais para Playwright (gate humano)

Lucas vai criar 2 contas teste no app real (cadastro normal) e colar credenciais ao Claude antes da execução começar. Sem isso, Playwright simulando médico/paciente não tem como logar.

Mínimo necessário:
- 1 conta médico (email + senha) → loga em `desktop/app-v2.html`
- 1 conta paciente (email + senha) → loga em `app-v3/`

Lucas precisa também garantir que **o paciente respondeu pelo menos 1 pré-consulta com o médico** (vínculo via `AutorizacaoAcesso` ou `PreConsulta`). Senão, médico não tem permissão pra propor retorno.

---

## 1. Princípios operacionais (não-negociáveis)

### 1.1 Regras de banco (do CLAUDE.md, incidente 17/04/2026)

- ❌ **NUNCA** `--accept-data-loss` em qualquer comando Prisma
- ❌ **NUNCA** `prisma db push` no script `build` do package.json
- ✅ Antes de toda migration: `pg_dump` lógico via Node + Prisma (salvar em `backups/`)
- ✅ Migrations versionadas em `backend/prisma/migrations/AAAAMMDD_nome/migration.sql`
- ✅ Aplicação via `npx prisma db execute --file ... --schema ...` (NÃO via build)
- ✅ Toda alteração: ADD COLUMN nullable ou CREATE TABLE — zero risco de drop

### 1.2 Regras de UX/Copy (do CLAUDE.md + memória `feedback_no_ai_copy_v2.md`)

- ❌ **NUNCA** mencionar "IA", "AI", "inteligência artificial" na copy do paciente
- ✅ Substitutos: "o vita id verificou", "avisamos quando", "automaticamente"
- ✅ Exceção: 3 lugares regulados (termos + relatório médico + onboarding opt-in)
- ❌ Sem emojis em qualquer tela do app
- ✅ Tom institucional sério, nunca "que massa!", "show!", "bora!"
- ✅ Plus Jakarta Sans pesos 400-900, cores #00E5A0/#00B4D8

### 1.3 Regras de implementação autônoma

- ✅ Cada fase em **branch separada** (`feat/fase-1-correcao`, `feat/fase-2-documentos`, `feat/fase-3-whatsapp`)
- ✅ Cada fase termina com **merge na main + push** (deploy automático Vercel + Railway)
- ✅ Antes de cada merge: **Playwright real passa 100%** (login médico + paciente, fluxo completo)
- ✅ Bug encontrado durante Playwright? Corrige na branch ANTES de mergear
- ❌ Bug em código EXISTENTE (fora do escopo da fase)? Documenta em `BUGS-DESCOBERTOS.md`, NÃO corrige silenciosamente
- ✅ Após cada merge: smoke HTTP real contra prod (3-5 chamadas com auth real)

### 1.4 Auditoria + Compliance obrigatórios

Toda nova rota que toca dados clínicos:
1. Usa middleware `verificarAuth` (JWT obrigatório)
2. Valida vínculo médico↔paciente via `validarVinculoMedicoPaciente()` (em `agendamento.js` linhas 66-83 — pode ser extraído pra `backend/src/utils/vinculo.js` se necessário)
3. Chama `auditar(req, { acao, atorTipo, recursoTipo, recursoId, alvoId, metadata })`
4. Cria registro em `Notificacao` quando há mudança visível pro outro lado

### 1.5 Anti-frustração

- ✅ Empty state SEMPRE com CTA (nunca "Nenhum X" solto)
- ✅ Loading state com skeleton (nunca "Carregando..." em texto)
- ✅ Erro: tradução amigável via `traduzirErro()` (já existe em `pre-consulta.html`)
- ✅ Toast com `Desfazer` 5s pra ações destrutivas
- ✅ Hard-disable de botões durante request (anti-duplo-clique, lição da sessão 16)

---

## 2. Setup Playwright + Personas reais

### 2.1 Ferramenta

- Playwright 1.60+ via npm (já instalado em `/d/vitae-app-novo/package.json`)
- Browser: Edge (`channel: 'msedge'`) — Chrome no Windows exige admin
- Viewports:
  - **Médico:** 1440x900 (desktop normal)
  - **Paciente:** 393x852 + user-agent iPhone Safari (iOS 17)
- Headed (`headless: false`) durante desenvolvimento, headless em CI
- Output: `tests/shots/fase-X/` (PNGs) + `tests/logs/fase-X.json`

### 2.2 Persona Médico — "Helena Volume" (atende 50+ pacientes/dia, cardio)

**Comportamento:**
- Quer fazer tudo em 1-2 cliques. Cansada de modais lentos.
- Não lê instruções longas — usa por padrão visual.
- Default mental: "30 dias úteis pro retorno"
- Frustração: se botão Salvar não der feedback imediato, clica de novo (testa duplo-clique).

**Roteiro Playwright (alto nível):**
1. Login na `desktop/app-v2.html` com credenciais fornecidas
2. Sidebar → Pacientes
3. Click no primeiro paciente da tabela
4. Card "Próximo Retorno" → click "+ Marcar retorno"
5. Modal abre: data já preenchida com +30 dias. Click "Enviar proposta"
6. Toast "Retorno proposto" deve aparecer < 2s
7. Card atualiza pra estado "Aguardando paciente confirmar" (amarelo)
8. Tira screenshot
9. Captura erros JS (deve ser zero)
10. Logout

**Asserts:**
- Botão Salvar fica desabilitado durante request (Helena testa duplo-clique)
- Toast aparece < 2s
- Banco persiste `statusProposta='AGUARDANDO_PACIENTE'` (validado via Prisma direto após o teste)

### 2.3 Persona Paciente — "Maria 45-55a" (recepcionista, usa iPhone, esqueceu senha 3x)

**Comportamento:**
- Sempre receia que app vai "perder" os dados dela.
- Lê com calma cada texto antes de clicar.
- Não confia em ações irreversíveis sem confirmação.
- Frustração: se botão não tiver descrição clara, fica perdida.

**Roteiro Playwright:**
1. Abre `app-v3/` no viewport mobile + user-agent iPhone
2. Login com credenciais paciente
3. Tab bar → Consultas
4. Vê seção "Propostos pelo seu médico" no topo
5. Card mostra: data + "Dr. X propõe" + 3 botões (Confirmar / Outra data / Recusar)
6. Click Confirmar → confirmação visual + card vira verde "Confirmado"
7. Tira screenshot
8. Logout

**Asserts:**
- Texto "Aguardando sua resposta" visível (Maria não confunde)
- Botão Recusar tem cor neutra (não destrutiva — Maria evitaria)
- Confirmação some da lista após confirmar, vai pra histórico

### 2.4 Persona Paciente alternativa — "Beatriz Especialista" (médica também, paciente jovem)

**Comportamento:**
- Sabe ler dados técnicos, mas exige privacidade.
- Vai verificar se médico tem permissão pra propor retorno.
- Testa cenários: remarcar, recusar com motivo, ver histórico.

**Usada em:** testes de remarcação e recusa com motivo. Garante que `motivoStatus` é persistido e visível pro médico.

### 2.5 Arquivos Playwright a criar

| Arquivo | Cobre |
|---------|-------|
| `tests/e2e-fase1-completo.js` | Fluxo Retorno: médico propõe → paciente confirma → médico vê verde |
| `tests/e2e-fase1-remarcar.js` | Maria remarca → médico aceita nova data |
| `tests/e2e-fase1-recusar.js` | Beatriz recusa com motivo → médico vê motivo |
| `tests/e2e-fase2-completo.js` | Médico anexa PDF → paciente baixa → médico vê "visto" |
| `tests/e2e-fase2-limite.js` | Upload > 10 MB rejeitado com erro amigável |
| `tests/e2e-fase3-completo.js` | Médico ativa toggle → paciente vê botão dentro do horário |
| `tests/e2e-fase3-fora-horario.js` | Paciente vê botão cinza + "disponível seg-sex 8h-19h" |
| `tests/e2e-master.js` | Encadeia tudo: médico propõe retorno + anexa doc + ativa WhatsApp → paciente faz 3 ações |

### 2.6 Credentials handling

- Credenciais lidas via `process.env` (passadas via shell, nunca commitadas)
- Arquivo `tests/.env.local` (já no `.gitignore`)
- Formato:
  ```
  MEDICO_EMAIL=...
  MEDICO_SENHA=...
  PACIENTE_EMAIL=...
  PACIENTE_SENHA=...
  ```

---

## 3. FASE 1 — Próximo Retorno (correção do frontend paciente)

**Backend e frontend médico:** já em prod (commits `134cccb` + `b32b639`).
**Trabalho restante:** mover o frontend paciente de `23-agendamentos.html` (lugar errado) pra `app-v3/15-consultas.html` (lugar correto).

### 3.1 Setup

```bash
git checkout -b feat/fase-1-correcao-paciente
```

### 3.2 Arquivo `app-v3/15-consultas.html` — modificações exatas

**Estado atual (resumo):** mostra `vitaeAPI.listarAgendamentos()` em 3 seções:
- `#proximaSection` — 1 próxima consulta (card `.next`)
- `#historicoSection` — múltiplos `.h-card`
- `#vazioSection` — empty state

**Adicionar:**

#### 3.2.1 Nova seção "Propostos pelo seu médico" (entre header e `#proximaSection`)

HTML:
```html
<!-- Retornos propostos (Feature 1 — Próximo Retorno) -->
<div id="retornosPropostosSection" class="ret-section" style="display:none">
  <div class="section-lbl">Propostos pelo seu médico</div>
  <div id="retornosPropostosList"></div>
</div>
```

CSS (adicionar antes do `</style>`):
```css
.ret-section { margin-bottom: 22px; }
.section-lbl { font-size: 11px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: .12em; margin-bottom: 10px; padding-left: 4px; }
.ret-card { background: #FFFFFF; border: 1px solid rgba(0,0,0,0.07); border-radius: 18px; padding: 18px; margin-bottom: 12px; box-shadow: 0 1px 12px rgba(0,0,0,0.07); }
.ret-card.aguardando { border-left: 4px solid #F59E0B; }
.ret-card.confirmado { border-left: 4px solid #00C47A; }
.ret-card.aguardando-medico { border-left: 4px solid #00B4D8; }
.ret-medico { font-size: 12px; color: #9CA3AF; margin-bottom: 6px; font-weight: 600; }
.ret-data { font-size: 22px; font-weight: 900; color: #0D0F14; letter-spacing: -.5px; line-height: 1; margin-bottom: 6px; }
.ret-data-anterior { font-size: 11.5px; color: #9CA3AF; text-decoration: line-through; margin-bottom: 8px; }
.ret-status-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.ret-status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.ret-status-txt { font-size: 12.5px; font-weight: 600; }
.ret-meta { font-size: 11.5px; color: #9CA3AF; margin-bottom: 14px; line-height: 1.4; }
.ret-obs { font-size: 12.5px; color: #4B5563; line-height: 1.5; background: #F4F6FA; border-radius: 10px; padding: 10px 12px; margin-bottom: 14px; font-style: italic; }
.ret-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.ret-btn-p { flex: 1; min-width: 0; padding: 11px 14px; background: linear-gradient(120deg, #00E5A0, #00B4D8); border: none; border-radius: 12px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 700; color: #fff; cursor: pointer; }
.ret-btn-s { padding: 11px 14px; background: #FFFFFF; border: 1px solid rgba(0,0,0,0.07); border-radius: 12px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 600; color: #4B5563; cursor: pointer; }
.ret-btn-d { padding: 11px 14px; background: #FFFFFF; border: 1px solid rgba(239,68,68,0.18); border-radius: 12px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 600; color: #EF4444; cursor: pointer; }
```

#### 3.2.2 Modais "Recusar" e "Remarcar" (antes do `</body>`)

Estrutura idêntica ao `23-agendamentos.html` mas estilizada pro design system do app-v3 (cores neutras, sem gradient nos botões secundários).

#### 3.2.3 JS — funções novas (dentro do `<script>` existente)

- `loadRetornosPendentes()` — chama `vitaeAPI.listarRetornosPendentes()`, renderiza em `#retornosPropostosList`
- `confirmarRet(id)` → POST `/agendamento/:id/confirmar`
- `abrirRecusa(id)` / `enviarRecusa()` → POST `/agendamento/:id/recusar` com `motivo`
- `abrirRemarca(id)` / `enviarRemarca()` → POST `/agendamento/:id/remarcar` com `novaDataHora` + `motivo`

Adicionar `loadRetornosPendentes()` no final do `<script>` (chamar na inicialização da página, paralelo ao `loadAgendamentos()` atual).

### 3.3 Arquivo `app-v3/api.js` (ou onde estiver a lib do paciente)

Verificar se já tem `listarRetornosPendentes`, `confirmarRetorno`, `recusarRetorno`, `remarcarRetorno`. Se for o mesmo `api.js` da raiz, ele já tem (adicionei na Fase 1 anterior). Se for cópia separada em `app-v3/`, precisa adicionar.

**Validação:** `grep -n "listarRetornosPendentes\|confirmarRetorno\|recusarRetorno\|remarcarRetorno" app-v3/*.js` deve retornar pelo menos 4 ocorrências.

### 3.4 Apagar `23-agendamentos.html` modificado (cleanup)

O arquivo `23-agendamentos.html` na raiz tem a seção "Propostos pelo seu médico" implementada por engano. Decisão:
- **Manter** se ainda é referenciado por alguma tela legada
- **Apagar** as adições da Fase 1 (Reverter pra como estava antes), mantendo só o agendamento legado

Vou MANTER as funções de retorno em `23-agendamentos.html` (não removo nada), porque podem servir como fallback. O foco é GARANTIR que `app-v3/15-consultas.html` funcione.

### 3.5 Playwright Fase 1 — execução completa

`tests/e2e-fase1-completo.js`:
1. Login médico em `desktop/app-v2.html`
2. Sidebar → Pacientes → click primeiro paciente
3. Card Próximo Retorno → "+ Marcar retorno"
4. Preenche data +30d → click "Enviar proposta"
5. Aguarda toast "Retorno proposto"
6. **Valida via Prisma direto** que `statusProposta='AGUARDANDO_PACIENTE'` no banco
7. Logout médico
8. Login paciente em `app-v3/`
9. Tab Consultas → seção "Propostos pelo seu médico" deve aparecer com card amarelo
10. Click "Confirmar"
11. Aguarda card desaparecer + ir pra histórico verde
12. **Valida via Prisma** que `statusProposta='CONFIRMADO'` + `confirmadoEm` populado
13. Logout
14. Login médico de novo
15. Volta ao mesmo paciente → card vira verde "Confirmado pelo paciente"

**Critério verde:** zero erros JS em ambos, banco consistente, screenshots de 5 momentos-chave.

### 3.6 Commit final Fase 1

```
feat(paciente): plug Próximo Retorno no app-v3/15-consultas.html

Frontend paciente da Feature 1 (Próximo Retorno) movido do
23-agendamentos.html (lugar errado) para o lugar correto:
app-v3/15-consultas.html — a tela Consultas do app paciente real
acessada via tab bar.

Implementa:
- Seção "Propostos pelo seu médico" no topo (acima de próxima consulta)
- 3 estados visuais (aguardando, confirmado, aguardando médico)
- 3 botões: Confirmar / Outra data / Recusar
- 2 modais (recusar com motivo + remarcar com data)
- Reuso de vitaeAPI.confirmarRetorno/recusarRetorno/remarcarRetorno
- Loading state silencioso quando backend retorna 401 (sem login)

Playwright e2e-fase1-completo valida ciclo completo médico↔paciente.
```

---

## 4. FASE 2 — Documentos / Mídias

**Médico anexa receita / laudo / encaminhamento → paciente baixa.**

### 4.1 Setup

```bash
git checkout main && git pull
git checkout -b feat/fase-2-documentos
```

### 4.2 Schema Prisma — Adicionar model `DocumentoMedico`

Em `backend/prisma/schema.prisma`, adicionar após o model `Agendamento`:

```prisma
model DocumentoMedico {
  id              String    @id @default(uuid())
  medicoId        String    @map("medico_id")
  pacienteId      String    @map("paciente_id")
  agendamentoId   String?   @map("agendamento_id")
  tipo            String    // RECEITA | LAUDO | ENCAMINHAMENTO | EXAME_PEDIDO | OUTRO
  nomeArquivo     String    @map("nome_arquivo")
  urlArquivo      String    @map("url_arquivo") @db.Text
  caminhoStorage  String?   @map("caminho_storage") @db.Text
  tamanhoBytes    Int       @map("tamanho_bytes")
  mimeType        String    @map("mime_type")
  observacao      String?   @db.Text
  anexadoEm       DateTime  @default(now()) @map("anexado_em")
  visualizadoEm   DateTime? @map("visualizado_em")
  baixadoEm       DateTime? @map("baixado_em")
  deletadoEm      DateTime? @map("deletado_em")
  criadoEm        DateTime  @default(now()) @map("criado_em")
  atualizadoEm    DateTime  @updatedAt @map("atualizado_em")

  medico          Medico    @relation(fields: [medicoId], references: [id], onDelete: Cascade)
  paciente        Usuario   @relation(fields: [pacienteId], references: [id], onDelete: Cascade)

  @@index([pacienteId, deletadoEm])
  @@index([medicoId, anexadoEm])
  @@map("documentos_medicos")
}
```

E adicionar relations inversas:
- Em `model Medico`: `documentosMedicos DocumentoMedico[]`
- Em `model Usuario`: `documentosRecebidos DocumentoMedico[]`

### 4.3 Migration SQL

Criar `backend/prisma/migrations/20260517_documentos_medicos/migration.sql`:

```sql
-- Migration: Documentos Medicos (Fase 2)
-- Data: 2026-05-17
-- Risco: ZERO (CREATE TABLE nova, sem ALTER em tabelas existentes)

CREATE TABLE IF NOT EXISTS "documentos_medicos" (
  "id" TEXT NOT NULL,
  "medico_id" TEXT NOT NULL,
  "paciente_id" TEXT NOT NULL,
  "agendamento_id" TEXT,
  "tipo" TEXT NOT NULL,
  "nome_arquivo" TEXT NOT NULL,
  "url_arquivo" TEXT NOT NULL,
  "caminho_storage" TEXT,
  "tamanho_bytes" INTEGER NOT NULL,
  "mime_type" TEXT NOT NULL,
  "observacao" TEXT,
  "anexado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "visualizado_em" TIMESTAMP(3),
  "baixado_em" TIMESTAMP(3),
  "deletado_em" TIMESTAMP(3),
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "documentos_medicos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "documentos_medicos_paciente_deletado_idx"
  ON "documentos_medicos" ("paciente_id", "deletado_em");
CREATE INDEX IF NOT EXISTS "documentos_medicos_medico_anexado_idx"
  ON "documentos_medicos" ("medico_id", "anexado_em");

ALTER TABLE "documentos_medicos"
  ADD CONSTRAINT "documentos_medicos_medico_fk"
  FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE CASCADE;
ALTER TABLE "documentos_medicos"
  ADD CONSTRAINT "documentos_medicos_paciente_fk"
  FOREIGN KEY ("paciente_id") REFERENCES "usuarios"("id") ON DELETE CASCADE;
```

### 4.4 Backup pré-migration

Salvar contagens atuais + agendamentos como JSON em `backups/pre-fase-2-AAMMDD-logico.json`.

### 4.5 Aplicar migration

```bash
cd backend
npx prisma db execute --file prisma/migrations/20260517_documentos_medicos/migration.sql --schema prisma/schema.prisma
npx prisma generate
```

### 4.6 Backend — novo arquivo `backend/src/routes/documentos.js`

8 rotas:

| Método | Path | Quem | O que faz |
|--------|------|------|-----------|
| POST | `/documentos/upload` | Médico | Multipart: pacienteId, tipo, observacao, file → cria DocumentoMedico + sobe Supabase Storage |
| GET | `/documentos/paciente/:pacienteId` | Médico | Lista docs que o médico anexou pra esse paciente |
| GET | `/documentos/meus` | Paciente | Lista docs que recebeu (any médico) |
| GET | `/documentos/consulta/:agendamentoId` | Médico/Paciente | Lista docs vinculados a uma consulta específica |
| GET | `/documentos/:id` | Médico/Paciente (dono) | Detalhes + marca visualizadoEm |
| GET | `/documentos/:id/baixar` | Paciente (dono) | Gera URL assinada (1h) + marca baixadoEm |
| PATCH | `/documentos/:id` | Médico (dono) | Edita observacao/tipo (não pode trocar arquivo) |
| DELETE | `/documentos/:id` | Médico (dono) | Soft-delete (`deletadoEm = now()`) |

**Validações obrigatórias:**
- Upload: `tamanhoBytes <= 10 MB` (10485760 bytes). Acima retorna 413 com mensagem amigável.
- Mime types permitidos: `application/pdf`, `image/jpeg`, `image/png`, `image/heic`. Outros: 415.
- Médico só vê docs que ele anexou (filtro `medicoId = req.usuario.medicoId`)
- Paciente só vê docs que ele recebeu (`pacienteId = req.usuario.id`)
- Vínculo médico↔paciente validado via `validarVinculoMedicoPaciente` antes de upload
- Auditoria em todas as ações (ANEXAR_DOCUMENTO, VISUALIZAR_DOCUMENTO, BAIXAR_DOCUMENTO, DELETAR_DOCUMENTO)
- Notificação in-app pro paciente quando médico anexa

**Reutilizações:**
- `storage.upload(file, 'vitae', 'documentos/${pacienteId}/${docId}_${nome}')` (helper existente)
- `storage.gerarUrlAssinada(caminhoStorage, 3600)` pra GET /baixar
- `auditar()` de `backend/src/utils/auditoria.js`
- `notificarUsuario()` (helper que adicionei em `agendamento.js`, vou portar pra `backend/src/utils/notificar.js`)

### 4.7 Registrar rotas em `backend/src/index.js`

Adicionar:
```js
app.use('/documentos', require('./routes/documentos'));
```

### 4.8 api.js — adicionar funções (raiz e/ou app-v3)

```js
async uploadDocumento(formData) {
  return apiRequest('/documentos/upload', { method: 'POST', body: formData, multipart: true });
},
async listarDocumentosPaciente(pacienteId) {
  return apiRequest(`/documentos/paciente/${pacienteId}`);
},
async listarMeusDocumentos() {
  return apiRequest('/documentos/meus');
},
async listarDocumentosConsulta(agendamentoId) {
  return apiRequest(`/documentos/consulta/${agendamentoId}`);
},
async getDocumento(id) {
  return apiRequest(`/documentos/${id}`);
},
async baixarDocumento(id) {
  return apiRequest(`/documentos/${id}/baixar`);
},
async editarDocumento(id, dados) {
  return apiRequest(`/documentos/${id}`, { method: 'PATCH', body: dados });
},
async deletarDocumento(id) {
  return apiRequest(`/documentos/${id}`, { method: 'DELETE' });
},
```

### 4.9 Frontend médico — `desktop/app-v2.html`

Atualmente o card Documentos é placeholder com modal "Em desenvolvimento". Substituir por implementação real:

#### 4.9.1 Carregamento async (similar ao retornos)

Em `renderPacienteDetail`, adicionar:
```js
if(pd&&pd.id&&typeof pd.documentos==='undefined'&&!pd._documentosCarregando){
  pd._documentosCarregando=true;
  (async function(){
    var docs=await prCarregarDocumentos(pd.id);
    pd.documentos=docs||[];
    pd._documentosCarregando=false;
    if(STATE.selectedPaciente===p.id) renderPacienteDetail();
  })();
}
```

E nova função `prCarregarDocumentos(pacienteId)`:
```js
async function prCarregarDocumentos(pacienteId){
  if(!window.BACKEND||!window.BACKEND.api) return null;
  try{
    var res=await window.BACKEND.api('/documentos/paciente/'+encodeURIComponent(pacienteId));
    return (res&&res.documentos)||[];
  }catch(_e){ return null; }
}
```

#### 4.9.2 Render do card Documentos (real, com lista)

Substituir bloco placeholder por (manter CSS Apple-style já adicionado):

Quando `pd.documentos.length > 0`: lista de docs (mesma estrutura do preview-central-clinica)
Quando vazio: empty state com CTA "Anexar primeiro documento"

#### 4.9.3 Modal de upload

```html
<!-- chamado por pdAnexarDocumento(pacienteId) -->
<div class="modal-h">Anexar documento</div>
<div class="modal-b">
  <div>Tipo: select RECEITA/LAUDO/ENCAMINHAMENTO/EXAME_PEDIDO/OUTRO</div>
  <div>Arquivo: input type=file accept=".pdf,.jpg,.jpeg,.png,.heic" (max 10 MB)</div>
  <div>Observação: textarea opcional</div>
</div>
<div class="modal-f">
  <button>Cancelar</button>
  <button onclick="pdUploadDocumento(pacienteId)">Anexar e enviar pro paciente</button>
</div>
```

#### 4.9.4 Funções JS novas em app-v2.html

- `pdAnexarDocumento(pacienteId)` — abre modal
- `pdUploadDocumento(pacienteId)` — valida tamanho + envia FormData via `window.BACKEND.api('/documentos/upload', {method:'POST', body: formData, multipart: true})`
- `pdAbrirDocumento(docId)` — abre URL assinada em aba nova
- `pdDeletarDocumento(docId)` — confirm + DELETE

#### 4.9.5 Persistência do upload progress (anti-frustração)

Durante upload, mostrar barra de progresso + bloquear botão. Se rede cair, retry automático 1x. Falhou de novo: mensagem amigável "Não consegui enviar agora. Tenta de novo em alguns segundos."

### 4.10 Frontend paciente — `app-v3/16-consulta-detalhe.html`

Adicionar seção "Documentos da consulta" (ou "Documentos do seu médico" se sem vínculo específico):

```html
<div id="documentosSection" style="display:none">
  <div class="section-lbl">Documentos do seu médico</div>
  <div id="documentosContainer"></div>
</div>
```

CSS pra `.doc-card`, `.doc-row`, `.doc-ico` (copiar do `desktop/app-v2.html` mas ajustar pra mobile: fonte 14px, padding maior, target 44x44 minimum pra touch).

JS:
```js
async function loadDocumentos(){
  try{
    // Tenta primeiro docs da consulta específica
    var agId = new URLSearchParams(location.search).get('id');
    var data = agId ? await vitaeAPI.listarDocumentosConsulta(agId) : await vitaeAPI.listarMeusDocumentos();
    var docs = (data && data.documentos) || [];
    if (!docs.length) return;
    document.getElementById('documentosSection').style.display = 'block';
    var container = document.getElementById('documentosContainer');
    container.innerHTML = docs.map(renderDoc).join('');
  } catch(_e) { /* silencioso */ }
}

function renderDoc(d){
  var lido = d.visualizadoEm ? '' : '<span class="doc-dot"></span>';
  return `
    <div class="doc-row" onclick="baixarDoc('${d.id}')">
      <div class="doc-ico"><svg ...PDF icon...></svg></div>
      <div class="doc-mid">
        <div class="doc-nm-row"><div class="doc-nm">${escape(d.nomeArquivo)}</div>${lido}</div>
        <div class="doc-sub">${labelTipo(d.tipo)} · ${formatData(d.anexadoEm)}</div>
      </div>
      <div class="doc-size">${formatTamanho(d.tamanhoBytes)}</div>
    </div>`;
}

async function baixarDoc(id){
  try{
    var res = await vitaeAPI.baixarDocumento(id);
    if (res && res.url) {
      window.open(res.url, '_blank', 'noopener');
    } else {
      alert('Não consegui abrir. Tenta de novo.');
    }
  } catch(e) { alert(e.message || 'Erro ao abrir documento'); }
}
```

Chamar `loadDocumentos()` no `DOMContentLoaded`.

Adicionar mesma seção em `15-consultas.html` quando há docs gerais (não vinculados a consulta específica) — opcional, decidir após testar fluxo.

### 4.11 Notificação visual no paciente

Quando paciente abre app-v3 e há docs não-visualizados:
- Badge azul no ícone "Consultas" da tab bar
- Quando entra na tela Consultas: docs com `doc-dot` azul (Apple-style)

Implementação: `loadRetornosPendentes()` + `loadMeusDocumentos()` carregam em paralelo no `01-saude.html` (home). Se algum doc tem `visualizadoEm = null`, badge aparece.

### 4.12 Playwright Fase 2

`tests/e2e-fase2-completo.js`:
1. Login médico
2. Abre paciente que tem vínculo
3. Card Documentos → "Anexar primeiro documento"
4. Modal abre. Seleciona tipo "RECEITA", anexa `tests/fixtures/receita-mock.pdf` (criar arquivo de 100 KB), observação "Teste auto"
5. Click "Anexar e enviar pro paciente"
6. Toast "Documento enviado"
7. Doc aparece na lista
8. **Valida via Prisma:** registro em `documentos_medicos` com URL Supabase
9. Logout médico
10. Login paciente
11. Tab Consultas (ou 16-consulta-detalhe) → seção Documentos visível com doc novo + dot azul
12. Click no doc → URL assinada abre em aba nova (Playwright captura `targetcreated`)
13. **Valida via Prisma:** `visualizadoEm` populado, `baixadoEm` populado
14. Login médico de novo → doc no card aparece como "Visto"
15. Screenshots de cada etapa

`tests/e2e-fase2-limite.js`:
1. Login médico, abre paciente
2. Modal upload, anexa arquivo de 15 MB
3. Espera erro amigável "Arquivo grande demais. Limite: 10 MB"
4. Modal permanece aberto pra correção
5. Anexa arquivo 100 KB válido → upload OK
6. Screenshots

`tests/e2e-fase2-tipos.js`:
1. Testa 5 tipos (RECEITA, LAUDO, ENCAMINHAMENTO, EXAME_PEDIDO, OUTRO)
2. Cada um aparece com label correto no paciente
3. PDF + JPG + PNG + HEIC: todos abrem

### 4.13 Commit final Fase 2

```
feat(fase-2): Documentos / Midias (medico anexa, paciente baixa)

Backend:
- Model DocumentoMedico (Prisma) com 13 campos + 2 indices + 2 FKs
- Migration 20260517_documentos_medicos aplicada (CREATE TABLE, zero risco)
- 8 rotas em routes/documentos.js (upload, listar 3 variantes, get,
  baixar com URL assinada, editar, deletar soft)
- Limite 10 MB hardcoded, 4 mime types permitidos (PDF/JPG/PNG/HEIC)
- Auditoria CFM em todas as 4 acoes (ANEXAR/VISUALIZAR/BAIXAR/DELETAR)
- Reuso de storage.upload() + storage.gerarUrlAssinada()
- Notificacao in-app pro paciente quando medico anexa

Frontend medico (desktop/app-v2.html):
- Card Documentos passa de placeholder a real (lista + upload modal)
- Apple-style monocromatico mantido
- Status "Visto" / "Nao visto" via dot azul #007AFF
- Limite 10 MB validado no client antes do upload (UX)

Frontend paciente (app-v3/16-consulta-detalhe.html + 15-consultas.html):
- Secao "Documentos do seu medico" mostra docs anexados
- Click abre URL assinada Supabase (1h TTL) em aba nova
- Badge azul na tab Consultas se ha doc nao-visualizado
- vitaeAPI ganha 8 funcoes novas

Compliance:
- Auditoria 5a (CFM 2.314/2022)
- Disclaimer "documento informativo, nao substitui consulta presencial"
  no rodape de cada doc no app paciente
- Retencao soft-delete preserva trilha auditavel 20a

Playwright e2e-fase2-completo + limite + tipos validam fluxo completo.
```

---

## 5. FASE 3 — Contato Direto WhatsApp

**Médico habilita disponibilidade (dias + horários) → paciente vê botão "Tirar dúvida" dentro do horário com mensagem pré-formatada.**

### 5.1 Setup

```bash
git checkout main && git pull
git checkout -b feat/fase-3-whatsapp
```

### 5.2 Schema Prisma — Adicionar model `ConfigContatoMedico`

```prisma
model ConfigContatoMedico {
  id                    String   @id @default(uuid())
  medicoId              String   @unique @map("medico_id")
  whatsappHabilitado    Boolean  @default(false) @map("whatsapp_habilitado")
  whatsappNumero        String?  @map("whatsapp_numero") // E.164: +5511999999999
  diasDisponiveis       Int[]    @default([1,2,3,4,5]) @map("dias_disponiveis") // 0=dom, 6=sab
  horaInicio            String   @default("08:00") @map("hora_inicio") // HH:mm
  horaFim               String   @default("18:00") @map("hora_fim")
  mensagemPreFormatada  String?  @map("mensagem_pre_formatada") @db.Text
  consentLgpdAceito     Boolean  @default(false) @map("consent_lgpd_aceito")
  consentLgpdEm         DateTime? @map("consent_lgpd_em")
  criadoEm              DateTime @default(now()) @map("criado_em")
  atualizadoEm          DateTime @updatedAt @map("atualizado_em")

  medico                Medico   @relation(fields: [medicoId], references: [id], onDelete: Cascade)

  @@map("config_contato_medico")
}
```

E também adicionar `PermissaoContatoPaciente` (granular — Decisão 7 do HANDOFF-DESIGN-APP-V3-13-MAI-2026.md):

```prisma
model PermissaoContatoPaciente {
  id              String   @id @default(uuid())
  medicoId        String   @map("medico_id")
  pacienteId      String   @map("paciente_id")
  habilitado      Boolean  @default(false)
  habilitadoEm    DateTime? @map("habilitado_em")
  revogadoEm      DateTime? @map("revogado_em")
  criadoEm        DateTime @default(now()) @map("criado_em")
  atualizadoEm    DateTime @updatedAt @map("atualizado_em")

  medico          Medico   @relation(fields: [medicoId], references: [id], onDelete: Cascade)
  paciente        Usuario  @relation(fields: [pacienteId], references: [id], onDelete: Cascade)

  @@unique([medicoId, pacienteId])
  @@map("permissao_contato_paciente")
}
```

Adicionar relations inversas em Medico (`configContato ConfigContatoMedico?`, `permissoesContato PermissaoContatoPaciente[]`) e Usuario (`permissoesContatoMedicos PermissaoContatoPaciente[]`).

### 5.3 Migration SQL

`backend/prisma/migrations/20260518_contato_medico/migration.sql`:

CREATE TABLE pra config_contato_medico (10 colunas) + CREATE TABLE pra permissao_contato_paciente (7 colunas + unique).

### 5.4 Backup pré-migration + aplicar

Mesmo padrão da Fase 1 + 2.

### 5.5 Backend — novo arquivo `backend/src/routes/contato.js`

7 rotas:

| Método | Path | Quem | O que faz |
|--------|------|------|-----------|
| GET | `/contato/config` | Médico | Retorna config própria (cria com defaults se não existe) |
| PUT | `/contato/config` | Médico | Atualiza config (toggle, número, dias, horários, mensagem). Valida E.164. Se primeira ativação: registra consent LGPD |
| GET | `/contato/permissoes` | Médico | Lista pacientes vinculados + status permissão (ativada/desativada) |
| PUT | `/contato/permissoes/:pacienteId` | Médico | Habilita/desabilita contato pra paciente específico |
| GET | `/contato/medico-do-paciente` | Paciente | Retorna info de contato do(s) médico(s) que habilitaram pro paciente, com status atual (disponível agora? próximo horário?) |
| POST | `/contato/registrar-clique` | Paciente | Registra que paciente clicou WhatsApp (auditoria + métrica) |
| GET | `/contato/disponivel-agora/:medicoId` | Paciente | Checa se médico está disponível neste momento (cruza dias + horários + timezone BR) |

**Validações:**
- `whatsappNumero`: regex E.164 BR (`^\+55[1-9]\d{8,10}$`)
- `diasDisponiveis`: array de inteiros 0-6
- `horaInicio` / `horaFim`: regex `^([01]\d|2[0-3]):[0-5]\d$`
- `horaFim > horaInicio` (após parsing)
- Médico só altera config própria
- Paciente só vê médicos com `PermissaoContatoPaciente.habilitado=true` E vínculo válido (AutorizacaoAcesso ou PreConsulta)

**Compliance LGPD:**
- Primeira ativação do toggle exige `consentLgpdAceito=true` no payload, senão 400
- Modal no frontend mostra termo de consentimento Art. 18 LGPD antes
- Revogação registra `revogadoEm` (não DELETE)

### 5.6 api.js — adicionar 7 funções

```js
async getConfigContato() { return apiRequest('/contato/config'); },
async atualizarConfigContato(dados) { return apiRequest('/contato/config', { method:'PUT', body: dados }); },
async listarPermissoesContato() { return apiRequest('/contato/permissoes'); },
async habilitarContatoPaciente(pacienteId, habilitado) { return apiRequest(`/contato/permissoes/${pacienteId}`, { method:'PUT', body:{habilitado} }); },
async getMedicoDoPaciente() { return apiRequest('/contato/medico-do-paciente'); },
async registrarCliqueContato(medicoId) { return apiRequest('/contato/registrar-clique', { method:'POST', body:{medicoId} }); },
async medicoDisponivelAgora(medicoId) { return apiRequest(`/contato/disponivel-agora/${medicoId}`); },
```

### 5.7 Frontend médico — `desktop/app-v2.html`

**Atualmente:** card "Contato Direto" + "Configurações de contato" estão visualmente prontos mas só persistem em `DR.config` local. Trocar pra persistência real via backend.

**Plug:**

#### 5.7.1 Carregamento async no `renderPacienteDetail`

```js
if(typeof DR._configContatoCarregado==='undefined'){
  DR._configContatoCarregado=true;
  (async function(){
    try{
      var res = await window.BACKEND.api('/contato/config');
      if(res && res.config){
        DR.config = DR.config || {};
        DR.config.whatsappHabilitado = res.config.whatsappHabilitado;
        DR.config.whatsappNumero = res.config.whatsappNumero;
        DR.config.whatsappDias = res.config.diasDisponiveis;
        DR.config.whatsappHoraInicio = res.config.horaInicio;
        DR.config.whatsappHoraFim = res.config.horaFim;
        DR.config.whatsappMensagem = res.config.mensagemPreFormatada;
        DR.config.consentLgpdAceito = res.config.consentLgpdAceito;
        if(STATE.view==='pacientes-detail') renderPacienteDetail();
      }
    }catch(_e){}
  })();
}
```

Também carregar permissão específica do paciente atual:
```js
if(pd.id && typeof pd._permissaoContatoCarregada==='undefined'){
  pd._permissaoContatoCarregada=true;
  (async function(){
    try{
      var res = await window.BACKEND.api('/contato/permissoes');
      var perm = (res && res.permissoes || []).find(function(x){ return x.pacienteId === pd.id; });
      pd._permissaoContato = perm ? perm.habilitado : false;
      renderPacienteDetail();
    }catch(_e){}
  })();
}
```

#### 5.7.2 Toggle "Contato Direto" — modal LGPD na primeira ativação

```js
async function pdToggleWa(){
  if(!DR.config.consentLgpdAceito && !DR.config.whatsappHabilitado){
    // Primeira ativação: abre modal LGPD
    openModal(_modalLgpdContato());
    return;
  }
  // Toggle normal
  DR.config.whatsappHabilitado = !DR.config.whatsappHabilitado;
  try{
    await window.BACKEND.api('/contato/config', {
      method:'PUT',
      body: {
        whatsappHabilitado: DR.config.whatsappHabilitado,
        whatsappNumero: DR.config.whatsappNumero || DR.telefone,
        diasDisponiveis: DR.config.whatsappDias,
        horaInicio: DR.config.whatsappHoraInicio,
        horaFim: DR.config.whatsappHoraFim,
        consentLgpdAceito: true
      }
    });
    toast('Configuração salva.');
    renderPacienteDetail();
  }catch(e){
    DR.config.whatsappHabilitado = !DR.config.whatsappHabilitado; // reverter
    toast('Não consegui salvar. Tenta de novo.');
  }
}
```

Modal LGPD com termo CFM/LGPD + botão "Aceito e habilito" + "Cancelar".

#### 5.7.3 Permissão por paciente

Adicionar abaixo do toggle global:
```html
<div style="...">
  <label>Habilitar contato com este paciente?</label>
  <div class="toggle-sw" onclick="pdTogglePermissaoContatoPaciente()"></div>
</div>
```

#### 5.7.4 Salvar config (botão Salvar atual)

Atualmente chama `pdSaveWaConfig()` que só atualiza local. Trocar pra PUT real.

### 5.8 Frontend paciente — `app-v3/18-perfil.html`

Adicionar nova seção "Meu médico" antes de "Emergência":

```html
<!-- SEÇÃO: MEU MÉDICO -->
<div class="section">
  <div class="section-title">Meu médico</div>
  <div id="medicoContainer"></div>
</div>
```

JS:
```js
async function loadMedicosContato(){
  try{
    var res = await vitaeAPI.getMedicoDoPaciente();
    var medicos = (res && res.medicos) || [];
    if (!medicos.length) {
      document.getElementById('medicoContainer').innerHTML = '<div class="empty-row">Nenhum médico vinculado com contato direto habilitado.</div>';
      return;
    }
    document.getElementById('medicoContainer').innerHTML = medicos.map(renderMedicoContato).join('');
  } catch(_e) {}
}

function renderMedicoContato(m){
  var disp = m.disponivelAgora;
  var dispLabel = disp ? '<span class="disp-on">Disponível agora</span>' : '<span class="disp-off">Disponível ' + formatDisp(m.diasDisponiveis, m.horaInicio, m.horaFim) + '</span>';
  var btn = disp
    ? `<button class="wa-btn-on" onclick="abrirWhats('${m.medicoId}', '${escape(m.numero)}', \`${escape(m.mensagemPreFormatada || 'Olá, Dr. ' + m.nome)}\`)">Tirar dúvida</button>`
    : `<button class="wa-btn-off" disabled>Fora do horário</button>`;
  return `
    <div class="medico-card">
      <div class="medico-info">
        <div class="medico-nome">Dr(a). ${escape(m.nome)}</div>
        <div class="medico-esp">${escape(m.especialidade || '')}</div>
        ${dispLabel}
      </div>
      ${btn}
    </div>`;
}

async function abrirWhats(medicoId, numero, msg){
  try{
    await vitaeAPI.registrarCliqueContato(medicoId);
  } catch(_e) {}
  var num = numero.replace(/\D/g,'');
  var url = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank', 'noopener');
}
```

CSS:
```css
.medico-card { background:#FFFFFF; border:1px solid rgba(0,0,0,0.07); border-radius:18px; padding:16px; margin-bottom:12px; display:flex; align-items:center; gap:14px; }
.medico-info { flex:1; }
.medico-nome { font-size:15px; font-weight:700; color:#0D0F14; }
.medico-esp { font-size:12px; color:#9CA3AF; margin-top:2px; }
.disp-on { display:inline-block; margin-top:6px; font-size:11px; font-weight:700; padding:3px 9px; border-radius:20px; background:rgba(0,196,122,.07); color:#00C47A; }
.disp-off { display:inline-block; margin-top:6px; font-size:11px; color:#9CA3AF; }
.wa-btn-on { padding:11px 18px; background:linear-gradient(120deg,#00E5A0,#00B4D8); border:none; border-radius:12px; font-family:'Plus Jakarta Sans',sans-serif; font-size:13px; font-weight:700; color:#fff; cursor:pointer; }
.wa-btn-off { padding:11px 18px; background:#F4F6FA; border:1px solid rgba(0,0,0,0.07); border-radius:12px; font-family:'Plus Jakarta Sans',sans-serif; font-size:13px; font-weight:600; color:#9CA3AF; cursor:not-allowed; }
```

### 5.9 Frontend paciente — `app-v3/16-consulta-detalhe.html` (botão direto)

Se o médico daquela consulta específica tem contato habilitado, mostrar botão "Tirar dúvida" no rodapé:

```js
if (consulta.medicoContato && consulta.medicoContato.habilitado) {
  // Mesma lógica de disponibilidade
  // Mesmo botão WhatsApp
}
```

### 5.10 Compliance LGPD — termo de consentimento

Texto exato no modal LGPD (médico ativa pela primeira vez):

> **Habilitar Contato Direto via WhatsApp**
>
> Ao habilitar, você concorda que:
>
> - Seu número WhatsApp aparece para os pacientes que você selecionou
> - Apenas dentro dos dias e horários que você definir
> - Você pode revogar a qualquer momento (LGPD Art. 18)
> - Conversas no WhatsApp são fora do app vita id — siga as boas práticas do CFM 2.314/2022 (telemedicina)
> - O vita id não armazena conteúdo das mensagens trocadas
>
> Esta ativação fica registrada para auditoria (CFM 5 anos).
>
> [Cancelar] [Aceito e habilito]

### 5.11 Playwright Fase 3

`tests/e2e-fase3-completo.js`:
1. Login médico, abre paciente
2. Card Contato Direto → toggle OFF → click → modal LGPD aparece
3. Click "Aceito e habilito"
4. Toggle vira ON
5. Card Configurações → seleciona dias Seg-Sex, horário 08:00-19:00
6. Click Salvar → toast "Configuração salva"
7. **Valida via Prisma:** `ConfigContatoMedico` populado + `consentLgpdAceito=true`
8. Card Permissão Paciente → ativa pro paciente específico
9. **Valida via Prisma:** `PermissaoContatoPaciente` populado
10. Logout médico
11. Login paciente em app-v3 (configurar relógio do navegador pra dentro do horário se necessário)
12. Tab Perfil → seção "Meu médico" → card aparece com "Disponível agora" + botão verde "Tirar dúvida"
13. Click → Playwright captura `targetcreated` → URL é `https://wa.me/55...?text=...`
14. **Valida via Prisma:** registro em `auditoria_acesso` com acao=CLIQUE_WHATSAPP
15. Screenshots

`tests/e2e-fase3-fora-horario.js`:
1. Mesmo setup, mas relógio fora do horário (sábado às 22h)
2. Botão fica cinza "Fora do horário"
3. Texto mostra "Disponível seg-sex 8h-19h"
4. Click no botão não faz nada (disabled)
5. Screenshots

`tests/e2e-fase3-revogacao.js`:
1. Médico desativa toggle
2. **Valida:** `whatsappHabilitado=false`, `consentLgpdAceito` permanece true (histórico)
3. Paciente recarrega → médico some da seção (lista vazia ou empty state)

### 5.12 Commit final Fase 3

```
feat(fase-3): Contato Direto WhatsApp com horarios + permissao granular

Backend:
- 2 models novos: ConfigContatoMedico (10 campos) + PermissaoContatoPaciente
  (granular: medico libera por paciente)
- Migration 20260518_contato_medico aplicada (CREATE TABLE x2, zero risco)
- 7 rotas em routes/contato.js (config get/put + permissoes + medico-do-
  paciente + clique + disponivel-agora)
- Validacao E.164 BR (+55XX9XXXXXXXX) + dias 0-6 + horarios HH:mm
- Consent LGPD obrigatorio na primeira ativacao do toggle
- Auditoria CFM em todas as 4 acoes (ATIVAR/DESATIVAR/PERMISSAO/CLIQUE)

Frontend medico (desktop/app-v2.html):
- Toggle Contato Direto: primeira ativacao abre modal LGPD com termo
- Configuracoes: dias (segmented) + horario (time inputs) + msg pre-fmt
- Permissao por paciente (decisao 7 do handoff design 13/mai)
- Persiste real via PUT /contato/config + PUT /contato/permissoes/:id

Frontend paciente (app-v3/18-perfil.html + 16-consulta-detalhe.html):
- Secao "Meu medico" mostra medicos com contato habilitado
- Botao "Tirar duvida" gradient verde-ciano quando dentro do horario
- Botao cinza "Fora do horario" quando fora (mostra proximo horario)
- WhatsApp abre wa.me?text= com mensagem pre-formatada
- Registra clique antes de abrir (auditoria + metrica)

Compliance LGPD/CFM:
- Termo consent exibido no modal LGPD (texto literal CFM 2.314/2022)
- Revogacao via toggle OFF (mantém consentLgpdEm pra historico)
- Mensagem padrao: "Conversas no WhatsApp sao informativas, nao
  substituem consulta presencial" no rodape do app paciente
- Sem armazenamento de conteudo WhatsApp (so registra clique)

Playwright e2e-fase3-completo + fora-horario + revogacao validam ciclo.
```

---

## 6. Critérios "100% precisão" por fase

Cada fase só é considerada **DONE** quando TODOS os critérios abaixo passam:

### 6.1 Fase 1 (Próximo Retorno — paciente em app-v3)

- [ ] `app-v3/15-consultas.html` mostra seção "Propostos pelo seu médico" quando há retornos pendentes
- [ ] Paciente confirma retorno → médico vê verde "Confirmado" sem refresh manual (após próximo load)
- [ ] Paciente recusa com motivo → médico vê motivo entre aspas no card
- [ ] Paciente remarca → médico vê "Aguarda sua confirmação" + nova data + data anterior tachada
- [ ] Médico cancela → paciente vê card sumir da seção pendentes
- [ ] Zero erros JS em console (médico desktop + paciente mobile)
- [ ] Playwright `e2e-fase1-completo.js` passa 100%
- [ ] Playwright `e2e-fase1-remarcar.js` passa
- [ ] Playwright `e2e-fase1-recusar.js` passa
- [ ] Banco persiste corretamente (validado via Prisma direto após cada ação)
- [ ] Notificação in-app criada na tabela `Notificacao` em cada mudança de status

### 6.2 Fase 2 (Documentos)

- [ ] Médico anexa PDF 5 MB → upload completa em < 10s
- [ ] Upload > 10 MB rejeitado com mensagem amigável (não erro técnico)
- [ ] 4 mime types funcionam (PDF, JPG, PNG, HEIC). Outros: 415 amigável
- [ ] Paciente vê doc na lista com dot azul (não-visualizado)
- [ ] Click no doc abre URL Supabase em aba nova
- [ ] Após visualização: dot some, doc fica cinza
- [ ] Médico vê status "Visto" sem refresh manual (após próximo load)
- [ ] Soft-delete: doc some pro paciente mas auditoria preserva
- [ ] Tabela `auditoria_acesso` tem 4 entradas por doc (ANEXAR, VISUALIZAR, BAIXAR, DELETAR se aplicável)
- [ ] Playwright `e2e-fase2-completo.js` + `limite.js` + `tipos.js` passam 100%
- [ ] Smoke HTTP em prod: POST /documentos/upload com arquivo real funciona

### 6.3 Fase 3 (Contato Direto WhatsApp)

- [ ] Médico ativa toggle pela 1ª vez → modal LGPD obrigatório aparece
- [ ] Toggle só salva no banco quando consent aceito
- [ ] Médico configura dias + horário + mensagem padrão
- [ ] Médico ativa permissão pra paciente A, desativa pra B
- [ ] Paciente A vê médico na seção "Meu médico" do perfil
- [ ] Paciente B NÃO vê nada
- [ ] Dentro do horário: botão verde "Tirar dúvida" + abre wa.me com msg
- [ ] Fora do horário: botão cinza + label "Disponível seg-sex 8h-19h"
- [ ] Click registra em `auditoria_acesso` (CLIQUE_WHATSAPP)
- [ ] Médico desativa toggle → paciente A para de ver na próxima load
- [ ] Validação E.164: número errado (sem +55, com letras) rejeitado com mensagem
- [ ] Playwright `e2e-fase3-completo` + `fora-horario` + `revogacao` passam 100%

### 6.4 Master (após 3 fases)

- [ ] Playwright `e2e-master.js`: médico cria PC → paciente responde → médico abre Central Clínica → propõe retorno + anexa doc + ativa WhatsApp → paciente recebe 3 ações → confirma retorno + baixa doc + envia WhatsApp → médico vê 3 mudanças sincronizadas em < 60s
- [ ] Zero erros JS em qualquer tela durante o e2e-master
- [ ] Logs Railway sem 500 nas últimas 1h após deploy
- [ ] Auditoria CFM completa (15+ entradas em 1 fluxo master)
- [ ] Notificação in-app no paciente em todos os pontos de mudança

---

## 7. Anti-padrões observados (NUNCA fazer)

Extraídos de leitura do Obsidian Vault + memórias:

### 7.1 Geral
- ❌ Mencionar IA, AI, inteligência artificial na copy paciente
- ❌ Adicionar feature sem saber qual problema resolve
- ❌ Copy "que massa", "show", "bora", emojis em telas
- ❌ Mudar schema sem aviso + sem pg_dump prévio
- ❌ `--accept-data-loss` em qualquer comando Prisma
- ❌ Notificar paciente fora da janela 07:00-22:00 (BR) — fadiga
- ❌ Usar prova social com números falsos
- ❌ Criar urgência artificial em app de saúde
- ❌ Dark patterns / dopamina vazia

### 7.2 Próximo Retorno
- ❌ Sugerir retorno sem origem explícita (medico desconfia de "magia")
- ❌ SMS pra retorno de baixa urgência (SMS = urgente escalada)
- ❌ Descontinuar sugestão sem avisar médico
- ❌ Lembrete pro paciente sem opt-in (medo de "vita id ligou pra mim")

### 7.3 Documentos
- ❌ Sem botão download direto ("paciente fica refém do app")
- ❌ Integração iClinic fake ("vou copiar" sem API real)
- ❌ Notificação "Dr. anexou laudo" empilhada com outras (orçamento global ~5/dia)
- ❌ Preview de arquivo pesado sem compressão silenciosa
- ❌ Sem timestamp ou verificação (auditoria CFM quebra)
- ❌ Permitir o paciente compartilhar URL Supabase publicamente (URL é assinada 1h pra mitigar)

### 7.4 Contato WhatsApp
- ❌ Chat aberto 24/7 (médico queima — Carlos Simples vai desinstalar)
- ❌ Sem escalada automática de palavra-gatilho ("quero sumir", "acabar com tudo") → responsabilidade legal recai no vita id
- ❌ Misturar prescrição com chat casual (confunde paciente)
- ❌ Sem termo de consentimento (ANPD multa)
- ❌ Notificação de novo chat fora de horário (paciente desativa push)
- ❌ Sem modo "férias" automático (médico viaja, paciente fica órfão)
- ❌ Toggle global por padrão ON (médico precisa ativar consciente, não imposto)

---

## 8. Compliance regulatório por fase

### 8.1 Fase 1 — Próximo Retorno

- **CFM 2.454/2026** (em vigor 10/ago/2026): disclaimer em alertas automáticos ("retorno proposto pelo médico, não diagnóstico de IA")
- **CFM Resolução 1.638/2002 + 1.821/2007**: prontuário 20 anos. `Agendamento` com status proposta entra como evento de plano terapêutico → entra no prontuário.
- **LGPD Art. 16+18**: auditoria 5 anos via `auditar()` em cada ação. Implementado: ✅

### 8.2 Fase 2 — Documentos

- **CFM 2.314/2022**: receitas/laudos via telemedicina exigem assinatura digital ICP-Brasil. **VITAE não substitui assinatura.** Médico anexa o PDF já assinado externamente. Disclaimer no app paciente: "Documento informativo, validade legal depende da assinatura digital do médico."
- **LGPD Art. 18**: portabilidade — paciente pode baixar todos os docs (já implementado via URL assinada)
- **CFM Retenção 20a**: soft-delete preserva trilha. `documentos_medicos` com `deletadoEm` mantém registro auditável.
- **LGPD Art. 11 (dados de saúde)**: criptografia em trânsito (HTTPS Vercel/Railway) + em repouso (Supabase Storage criptografado por padrão)

### 8.3 Fase 3 — Contato Direto WhatsApp

- **CFM 2.314/2022**: telemedicina via mensagem exige termo de consentimento específico → modal LGPD obrigatório na primeira ativação
- **CFM 2.454/2026 (SaMD)**: se app intermediasse o conteúdo, seria Software as Medical Device. **VITAE só redireciona pro WhatsApp**, não armazena conteúdo → fica fora do SaMD. Disclaimer no app paciente: "Conversas no WhatsApp são informativas, não diagnóstico. Não substituem consulta presencial."
- **LGPD Art. 18 (revogação)**: toggle OFF revoga, mas mantém histórico `consentLgpdEm` pra auditoria
- **LGPD Art. 20 (decisões automatizadas)**: nenhuma decisão automatizada — médico decide quando ativar/desativar. Sem risco aqui.
- **Palavra-gatilho de crise** (cenário PRÉ-MORTEM 7): VITAE NÃO intercepta conteúdo WhatsApp → escalada de palavra-gatilho fica fora de escopo dessa fase. **Documentado como gap consciente** (Fase 4 futura: chat in-app com escalada automática).

### 8.4 Cronograma legal

- ⚠️ **Antes do launch público:** consultar advogado especializado em saúde digital (R$ 5-15k). Especialmente pra Fase 3.
- ✅ Pra beta com 10 médicos: termos atuais + disclaimer no app são suficientes (regime "MVP regulatório")

---

## 9. Plano de validação humana (o que SÓ Lucas faz)

Mesmo com Playwright 100% verde, há coisas que SÓ Lucas pode/deve fazer. Documentadas explicitamente pra evitar surpresa:

### 9.1 Criar 2 contas teste reais

- 1 médico no app real (cadastro + verificação SMS + perfil + CRM/UF)
- 1 paciente no app real (cadastro + quiz vita id)
- Estabelecer vínculo: médico envia pré-consulta pro paciente → paciente responde
- Cola credenciais aqui (Claude usa pra Playwright):
  ```
  MEDICO_EMAIL=...
  MEDICO_SENHA=...
  PACIENTE_EMAIL=...
  PACIENTE_SENHA=...
  ```

**Por que só Lucas:** cadastro envolve SMS real (Twilio cobra) + Google Sign-In (browser interativo) + decisões clínicas (CRM válido?).

### 9.2 Aprovar termos LGPD

Antes do launch público das 3 features:
- Revisar texto do modal LGPD Fase 3 (sec 5.10)
- Decidir se contrata advogado pra parecer formal (R$ 5-15k)
- Atualizar `termos.html` + `lgpd.html` no repo se necessário

**Por que só Lucas:** decisão de negócio + investimento.

### 9.3 Aprovar mensagens no WhatsApp Business (opcional, Fase 4)

Se um dia migrar pra Twilio WhatsApp Business API:
- Aprovar templates Meta (24h-48h aprovação)
- Pagar Twilio (R$ 0.05-0.10/msg)
- Setar env var `WHATSAPP_MODO=real` no Railway

**Por que só Lucas:** crédito Twilio + aprovação Meta exigem dono da conta.

### 9.4 Recrutar 5-10 médicos beta

Antes do launch público:
- 5 médicos diversos (Helena Volume, Carlos Simples, Beatriz Especialista, etc)
- Onboarding 30min por médico
- Coletar feedback semanal por 4 semanas
- Iterar conforme bugs/sugestões reais

**Por que só Lucas:** rede de contatos + decisão de quem é "beta-fit".

### 9.5 Validar Hipóteses não-validadas

Após 4 semanas com beta:
- H9: "40% retornam no prazo" — medir taxa real
- M1: "Médico ganha 3-5 min por consulta" — pedir cronometragem
- P3: "Paciente mostra QR no consultório" — ainda zero casos reportados
- Cenário 5 PRÉ-MORTEM: "Aba Consultas vazia porque médicos usam iClinic" — medir adoção dos docs

**Por que só Lucas:** envolve entrevistas qualitativas com humanos reais.

---

## 10. Cronograma e dependências

```
┌─────────────────────────────────────────────────────────────────┐
│  Lucas cria 2 contas + cola credenciais                        │ ← GATE HUMANO 1
└───────┬─────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│  FASE 1 — Correção frontend paciente (1-2 dias)                │
│  • Plug app-v3/15-consultas.html                                │
│  • Playwright e2e-fase1-completo + remarcar + recusar           │
│  • Merge main + smoke prod                                       │
└───────┬─────────────────────────────────────────────────────────┘
        ↓ (Playwright 100% verde, smoke OK)
┌─────────────────────────────────────────────────────────────────┐
│  FASE 2 — Documentos (3-4 dias)                                 │
│  • Schema + migration + backup                                   │
│  • 8 rotas backend                                               │
│  • Frontend médico real (substitui placeholder)                  │
│  • Frontend paciente (16-consulta-detalhe + 15-consultas)        │
│  • Playwright e2e-fase2-completo + limite + tipos                │
│  • Merge main + smoke prod                                       │
└───────┬─────────────────────────────────────────────────────────┘
        ↓ (Playwright 100% verde, smoke OK)
┌─────────────────────────────────────────────────────────────────┐
│  FASE 3 — Contato WhatsApp (2-3 dias)                           │
│  • 2 schemas novos + migration + backup                          │
│  • 7 rotas backend                                               │
│  • Frontend médico real (substitui placeholder)                  │
│  • Frontend paciente (18-perfil + 16-consulta-detalhe)           │
│  • Modal LGPD com termo consent                                  │
│  • Playwright e2e-fase3-completo + fora-horario + revogacao      │
│  • Merge main + smoke prod                                       │
└───────┬─────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│  MASTER E2E (Playwright e2e-master.js)                          │
│  • Encadeia tudo: médico cria PC → paciente responde → médico   │
│    propõe retorno + anexa doc + ativa WhatsApp → paciente       │
│    confirma + baixa + envia WhatsApp → médico vê tudo           │
│  • Validação Prisma direto após cada passo                       │
└───────┬─────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│  HANDOFF FINAL                                                   │
│  • Relatório de 1 página: o que entregou, anti-padrões evitados │
│  • Lista de bugs descobertos durante implementação (se houver)  │
│  • Recomendação de validação humana                              │
│  • Apaga branches feat/* já mergeadas                            │
└─────────────────────────────────────────────────────────────────┘
```

**Tempo total estimado:** 6-9 dias úteis de trabalho autônomo (com Playwright como gate em cada fase).

---

## 11. Rollback completo por fase

Se algo der MUITO errado em prod (não simples bug, mas regressão de dado ou auth quebrada):

### 11.1 Rollback Fase 1 (Frontend paciente)

Mínimo (só reverte commit do frontend):
```bash
git revert <hash-do-merge-fase-1> --no-edit
git push origin main
```
Backend continua funcionando (rotas existem, paciente só não vê na UI).

### 11.2 Rollback Fase 2 (Documentos)

```bash
# Reverte código
git revert <hash-do-merge-fase-2> --no-edit
git push origin main

# Apaga registros documentos (cuidado: dados reais perdidos)
# Só se essencial. Soft-delete preferível:
DB_URL=$(railway variables --json | node -e "...")
node -e "const p=new (require('@prisma/client').PrismaClient)(); p.documentoMedico.updateMany({data:{deletadoEm:new Date()}})"
```

Tabela `documentos_medicos` fica no banco (zero risco de drop), apenas vazia.

### 11.3 Rollback Fase 3 (WhatsApp)

```bash
git revert <hash-do-merge-fase-3> --no-edit
git push origin main

# Desativa todos os toggles (não apaga config)
node -e "const p=new (require('@prisma/client').PrismaClient)(); p.configContatoMedico.updateMany({data:{whatsappHabilitado:false}})"
```

### 11.4 Rollback total (3 fases)

Tag git criada antes do merge da Fase 1:
```bash
git checkout main
git reset --hard pre-fase-1-26mai
git push origin main --force  # ⚠️ DESTRUTIVO — só com autorização explícita
```

Backup logico em `backups/pre-fase-1-26mai-logico.json` pode restaurar `agendamentos` se necessário.

### 11.5 Critério de rollback

Rollback é necessário SE:
- Auth quebrou (paciente/médico não consegue logar) → rollback imediato
- Dados existentes corrompidos (paciente vê dados de outro) → rollback imediato
- Erro 500 em > 5% das requisições por > 10min → rollback se não corrigir em 30min

Rollback NÃO é necessário SE:
- Bug cosmético (CSS quebrado)
- Feature nova não funciona mas resto funciona
- Erro 500 em rota nova específica em < 5% requisições

---

## 12. Glossário e mapeamento de arquivos

### 12.1 Caminhos absolutos críticos

| O que | Onde |
|-------|------|
| App médico | `d:\vitae-app-novo\desktop\app-v2.html` |
| App paciente — Saúde | `d:\vitae-app-novo\app-v3\01-saude.html` |
| App paciente — **Consultas (Fase 1+2)** | `d:\vitae-app-novo\app-v3\15-consultas.html` |
| App paciente — **Detalhe consulta (Fase 2)** | `d:\vitae-app-novo\app-v3\16-consulta-detalhe.html` |
| App paciente — **Perfil (Fase 3)** | `d:\vitae-app-novo\app-v3\18-perfil.html` |
| Schema Prisma | `d:\vitae-app-novo\backend\prisma\schema.prisma` |
| Rotas Agendamento (Fase 1) | `d:\vitae-app-novo\backend\src\routes\agendamento.js` |
| Rotas Documentos (Fase 2 — A CRIAR) | `d:\vitae-app-novo\backend\src\routes\documentos.js` |
| Rotas Contato (Fase 3 — A CRIAR) | `d:\vitae-app-novo\backend\src\routes\contato.js` |
| Helper Storage | `d:\vitae-app-novo\backend\src\services\storage.js` |
| Helper Auditoria | `d:\vitae-app-novo\backend\src\utils\auditoria.js` |
| api.js (raiz) | `d:\vitae-app-novo\api.js` |
| Backups | `d:\vitae-app-novo\backups\` |
| Playwright tests | `d:\vitae-app-novo\tests\` |
| CLAUDE.md (regras) | `d:\vitae-app-novo\CLAUDE.md` |
| Vault Obsidian | `C:\Users\win11\OneDrive\Documentos\Obsidian Vault\` |

### 12.2 Status atual dos commits

| Commit | Conteúdo |
|--------|----------|
| `134cccb` | Merge Fase 1 backend + migration aplicada |
| `b32b639` | Refactor Central Clínica 2 colunas (frontend médico aprovado) |
| `e38d0b6` | Plano antigo `PLANO-IMPLEMENTACAO-3-FEATURES.md` |

### 12.3 Termos

- **PC** = pré-consulta
- **Central Clínica** = view `pacientes-detail` do app médico (3 colunas → agora 2 colunas)
- **Tab bar** = navegação fixa do app paciente (5 abas)
- **AutorizacaoAcesso** = tabela que registra vínculo médico↔paciente
- **PreConsulta** = tabela que registra cada PC enviada/respondida
- **DR** = objeto global no `desktop/app-v2.html` com config do médico logado
- **STATE.selectedPaciente** = id do paciente atualmente aberto na Central Clínica
- **pd** (em renderPacienteDetail) = `pcState.currentPacienteData` (dados do paciente carregados do backend)

---

## ASSINATURA DO PLANO

Este plano é **autônomo**. Após Lucas:
1. Criar 2 contas teste reais (médico + paciente vinculados via PC respondida)
2. Colar credenciais
3. Aprovar este plano com "vai"

Claude executa Fase 1 → Fase 2 → Fase 3 → master E2E sem perguntar mais nada, EXCETO:
- Bug arquitetural imprevisto (pausa e abre `ALERTA-PAUSA.md`)
- Necessidade de decisão de negócio (ex: copy específica do termo LGPD diferente do proposto)

**Critério de "100% pronto":** após 3 fases mergeadas + e2e-master verde + smoke prod, Lucas recebe relatório de 1 página com:
- O que foi entregue
- Anti-padrões evitados (checklist)
- Lista de bugs descobertos em código pré-existente (não corrigidos por escopo)
- Recomendações de validação humana (entrevistas com beta)
- Próximos passos (Fase 4: push real, escalada palavra-gatilho, integração iClinic)

---

**Documento gerado:** 2026-05-16 (sessão tarde)
**Total de palavras:** ~7.500
**Total de linhas:** ~1.100
**Próximo passo:** Lucas cola credenciais + diz "vai" → execução autônoma começa.
