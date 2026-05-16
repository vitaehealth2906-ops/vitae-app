# Implementação — Data e hora da consulta + lista por horário

**Data:** 09/05/2026 (Sessão 22)
**Autorização Lucas:** "VAI COM AS RECOMENDACOES" (autônomo, do começo ao deploy)

---

## Resumo executivo

Adicionado o campo `dataConsulta` (data + hora) na tabela `pre_consultas`. A criação manual de pré-consulta agora **exige** data e hora preenchidas. A lista de pré-consultas e o painel "Hoje" passaram a ser ordenados pela proximidade da consulta — quem é mais próximo aparece em cima. Slots do Google Calendar entram na mesma lista com botões "Disparar pré-consulta" e "Excluir". Bloco "Automações" da aba Hoje foi removido e substituído por "Pra disparar pré-consulta — próximas 36 horas".

---

## Estado pré-mudança

- Backup completo: `backups/vitae-pre-data-consulta-2026-05-09.dump` (2.7 MB)
- Tag git de retorno: `pre-data-consulta-2026-05-09`
- Baseline de contagens: `backups/vitae-pre-data-consulta-2026-05-09.baseline.txt`
  - usuarios: 57
  - medicos: 7
  - pre_consultas: 40
  - agenda_slots: 4
  - form_templates: 4
  - exames: 55
  - medicamentos: 29
  - alergias: 18

---

## Mudanças no banco

### Migration aplicada

`backend/prisma/migrations/20260509_add_data_consulta_pc/migration.sql`:

```sql
ALTER TABLE pre_consultas
  ADD COLUMN IF NOT EXISTS data_consulta TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS pre_consultas_data_consulta_idx
  ON pre_consultas (data_consulta);
```

Aplicada via psql direto. **NUNCA** `--accept-data-loss`.

### Schema Prisma

`backend/prisma/schema.prisma`:

```prisma
model PreConsulta {
  // ...campos existentes...
  dataConsulta DateTime? @map("data_consulta")
  // ...
  @@index([dataConsulta], map: "pre_consultas_data_consulta_idx")
}
```

### Soft-delete das PCs órfãs antigas

```sql
UPDATE pre_consultas
SET deletado_em = NOW()
WHERE paciente_id IS NULL AND deletado_em IS NULL;
-- Resultado: UPDATE 30 (30 órfãs sem pacienteId marcadas como deletadas)
```

### Verificação pós

```
ativas | soft_deletadas | total
-------+----------------+------
    10 |             30 |    40
```

**Zero perda de dados.** As 30 PCs antigas continuam recuperáveis (deletadoEm setado, registros íntegros).

---

## Mudanças no backend

`backend/src/routes/pre-consulta.js`:

1. **Schema Zod do POST** ganha `dataConsulta` obrigatório (aceita ISO 8601).
2. **Body do POST** persiste `dataConsulta` parseado como Date.
3. **GET / (listar PCs)** filtra `deletadoEm: null` e ordena por:
   - `dataConsulta asc nulls last` (prioridade)
   - `criadoEm desc` (desempate)

---

## Mudanças no frontend desktop (`desktop/app-v2.html`)

### Estado e abertura da tela criar PC

- `CRIAR_PC_STATE` ganha campos: `dataConsulta`, `horaConsulta`, `origemSlotId`.
- `abrirCriarPC` aceita objeto `{pacienteId, nome, telefone, email, dataConsulta, horaConsulta, slotId}` além do antigo `pacienteId` string.

### Form criar PC

- Dois inputs novos no card "Consulta": `<input type="date">` e `<input type="time">` (obrigatórios).
- Selo azul institucional "Veio da sua agenda Google" quando `origemSlotId` presente.
- Botão "Gerar link" só ativa com nome **e** data **e** hora preenchidos.

### Validação e payload em `cpcGerarEEnviar`

- Bloqueia envio se `dataConsulta` ou `horaConsulta` vazios.
- Adiciona `payload.dataConsulta = dataConsulta + 'T' + horaConsulta + ':00'`.
- Mensagem WhatsApp default agora inclui "Sua consulta é {dataFmt} às {hora}".
- Vincula slot do Calendar à PC criada (sets `slotVinc.pcId = pc.id`).

### Aba Hoje

- Bloco **Automações** (3 cards) removido.
- Bloco novo **"Pra disparar pré-consulta"** mostra slots das próximas 36h sem PC, com botões "Disparar pré-consulta" e "✕ Excluir".

### Aba Pré-Consultas

- `renderPC` reescrita: combina PCs existentes + slots Calendar sem PC numa lista única.
- Ordenação: `dataConsulta` asc (PC) ou `inicio` (slot), mais próxima primeiro.
- Coluna "Criada" virou "Consulta", mostra "Hoje 09:00", "Amanhã 14:30", etc.
- Filtro novo "Pra disparar".
- Slots: linha azul, badge "Pra disparar", botão verde "Disparar" + ícone excluir.

### Funções novas

- `dispararSlot(slotId)`: autopreenche tela criar PC com nome+telefone+data+hora vindos do slot Calendar.
- `excluirSlot(slotId)`: chama `POST /agenda/slots/:id/ignorar` (otimista + rollback se backend falhar). Toast com botão Desfazer 5s.

### CSS

- `.pd-card`, `.pd-row`, `.pd-btn-p`, `.pd-btn-x` (bloco aba Hoje).
- `.pcn-tr-disparar` (botão verde gradiente da tabela).
- Override `.pcn-trow` grid pra coluna 200px + `.pcn-tr-act{opacity:1}` (botões sempre visíveis).

### BACKEND.loadPCS

Adicionado `dataConsulta: p.dataConsulta || null` no objeto adaptado pro frontend.

### Mensagem padrão (`DR.config.mensagemLembrete`)

Atualizada pra:
> "Olá {nome}, sou da equipe do Dr. {medico}. Sua consulta é {data} às {hora}. Antes do atendimento, gravei essa pré-consulta de 4 minutos pra entender melhor o que você está sentindo: {link}"

---

## Commits

1. `2ecc0ba` — `feat(backend): adiciona dataConsulta na PreConsulta + ordem por horario`
2. `6e68312` — `feat(desktop): data/hora obrigatorias + lista unificada por horario`

Push em `main` → Railway + Vercel auto-deploy.

---

## Rollback (se precisar)

### Frontend ruim
```bash
cd d:/vitae-app-novo
git revert 6e68312 --no-edit
git push origin main
# Vercel volta em 30s
```

### Backend ruim
```bash
cd d:/vitae-app-novo
git revert 2ecc0ba 6e68312 --no-edit
git push origin main
# Railway redeploya em 1-2 min
```

### Banco com problema (worst case)
```bash
# 1. Reset git
cd d:/vitae-app-novo
git reset --hard pre-data-consulta-2026-05-09
git push origin main --force-with-lease

# 2. Restaurar banco
"C:/Program Files/PostgreSQL/18/bin/pg_restore.exe" \
  --clean --no-owner --no-acl \
  -d "postgresql://postgres.zkpilzhyrhsptoujhflz:Saopaulovitae2026@aws-0-us-west-2.pooler.supabase.com:5432/postgres" \
  backups/vitae-pre-data-consulta-2026-05-09.dump

# 3. Verificar contagens batem com baseline
"C:/Program Files/PostgreSQL/18/bin/psql.exe" "<DATABASE_URL>" \
  -c "SELECT 'pre_consultas', count(*) FROM pre_consultas UNION ALL SELECT 'medicos', count(*) FROM medicos;"
# Esperado: 40 PCs, 7 medicos
```

---

## Pegadinhas pra próximas sessões

1. **PCs antigas (10 ainda ativas, 30 soft-deletadas)** continuam sem `dataConsulta`. Aparecem no fim da lista (nulls last). Médico pode editar manualmente se quiser ordenar.
2. **Mensagem padrão WhatsApp** só atualiza pra quem usa o template default. Quem já customizou não muda.
3. **`excluirSlot` é otimista**: se Railway falhar, faz rollback local + toast erro. Médico não fica com lista inconsistente.
4. **Conflito de nome no Calendar** (3 Marias) ainda não tratado — fica pra próxima sessão.
5. **Cancelamento de consulta no Calendar** ainda não sincroniza automaticamente — médico precisa clicar "✕" manualmente.

---

## Próximos passos sugeridos

1. Lucas testar end-to-end em produção: criar PC manual, disparar slot do Calendar, ver lista ordenada.
2. Recrutar médico betatester real (gate humano da Sessão 13).
3. Tratamento de cancelamento Calendar (next session).
4. Edge case: paciente com vários nomes possíveis no Calendar (ambíguo).
