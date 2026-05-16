# Aplicar Fase 1 — Próximo Retorno

**Status atual:** código 100% pronto na branch `feat/proximo-retorno`, UI smoke Playwright verde, main intocada. Migration NÃO aplicada no banco prod ainda.

**Tempo total estimado:** 3 minutos.

---

## O que vai acontecer

Você roda 5 comandos. Cada um leva segundos. Eles fazem:

1. Login no Railway (browser abre, autentica, fecha)
2. Backup do banco (dump local, ~5 MB)
3. Aplica a migration (adiciona 6 colunas na tabela `agendamentos`, todas nullable — zero risco)
4. Gera o Prisma Client com schema novo
5. Merge da branch na main + push (deploy automático Vercel/Railway)

---

## Comandos (PowerShell na pasta `d:\vitae-app-novo`)

### 1. Login Railway
```powershell
railway login
```
Vai abrir browser. Autentica com sua conta GitHub do Railway. Fecha aba quando ver "Logged in".

### 2. Linkar projeto (se não tiver)
```powershell
railway link
```
Escolhe **vitae-app** no menu interativo.

### 3. Backup do banco
```powershell
cd backend
railway run pg_dump $env:DATABASE_URL > ..\backups\pre-fase-1-26mai.dump
```
**Espera:** arquivo `backups/pre-fase-1-26mai.dump` é criado com 3-10 MB.

Se der erro de `DATABASE_URL não definida`, troque por:
```powershell
$dbUrl = railway variables get DATABASE_URL
railway run pg_dump $dbUrl > ..\backups\pre-fase-1-26mai.dump
```

### 4. Aplicar migration
```powershell
railway run psql $env:DATABASE_URL -f prisma\migrations\20260516_proximo_retorno\migration.sql
```
**Espera:** mensagens `ALTER TABLE` e `CREATE INDEX` aparecem. Zero linhas afetadas em dados existentes.

### 5. Regenerar Prisma Client
```powershell
railway run npx prisma generate
```

### 6. Merge e deploy
```powershell
cd ..
git checkout main
git merge feat/proximo-retorno
git push origin main
```

**Espera:** Vercel deploy em ~30s, Railway deploy em ~2min.

---

## Como validar (depois do deploy)

1. Abre **https://vitae-app.vercel.app/desktop/app-v2.html** logado como médico
2. Vai em Pacientes → abre um paciente que respondeu pré-consulta
3. Card "Próximo Retorno" deve aparecer com botão **+ Marcar retorno**
4. Clica no botão, escolhe data, salva → toast "Retorno proposto"
5. Abre o app do paciente (https://vitae-app.vercel.app/23-agendamentos.html) logado como paciente
6. Seção "Propostos pelo seu médico" aparece no topo com botões Confirmar/Outra data/Recusar
7. Clica **Confirmar** → some da lista, vira agendamento confirmado

---

## Em caso de problema

### Rollback (volta tudo ao estado anterior)
```powershell
# Reverter código
git checkout main
git revert HEAD --no-edit
git push origin main

# Restaurar banco
cd backend
railway run psql $env:DATABASE_URL < ..\backups\pre-fase-1-26mai.dump
```

### Bugs descobertos
Se você achar algo errado depois de aplicar:
- Anota o que aconteceu (qual tela, qual ação, qual mensagem de erro)
- Cola pra mim, eu corrijo em segundos sem precisar refazer migration

---

## Próximas fases

Quando Fase 1 estiver verde em prod por 24h sem reclamação:
- **Fase 2 — Documentos/Mídias** (~3-4 dias): upload de receitas/laudos/encaminhamentos
- **Fase 3 — Contato Direto WhatsApp** (~2 dias): toggle disponibilidade + botão WhatsApp

Mesma fórmula: branch + auto-validação + 3 comandos seus.
