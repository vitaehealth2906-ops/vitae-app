# Plano de Execução Autônoma Final — VITAE Desktop Médico

**Data:** 2026-05-05
**Autorização:** Lucas Borelli, mensagem datada 2026-05-05 21:30
**Mandato:** "rode tudo até acabar, sem pausas, sem pedir autorizações, sem se esquecer de nada"

---

## INVENTÁRIO COMPLETO (do plano mestre · 14 fases)

### ✅ JÁ ENTREGUE
- **Fase 1** — Escopo congelado, backup app-legacy-2026-05-05.html (7570 linhas), tag git
- **Fase 2** — Contrato API completo (18 grupos de rotas, summaryJson, gaps)
- **Fase 3** — Andaime: `01-login.html`, `02-cadastro.html`, `03-quiz-medico.html` (5 passos), `auth-errors.js`
- **Fase 4-6 (frontend)** — `app-v2.html` é cópia literal do preview validado + 7 plugs no backend (DR, PACIENTES, PCS, TEMPLATES, AGENDA, perfil edit, abrir paciente, summary, regenerar, criar PC)
- **Pré-Fase 7** — Backup pg_dump 2.6MB MD5 53697cb7 + baseline 27 tabelas / 1.175 linhas

### 🔧 EXECUTAR AGORA (autonomamente)

#### Fase 7 — Schema Migration
**Schema changes:**
- Tabela `medicos` (atual): adicionar 8 colunas novas (4 já existem: googleTokenEnc, googleEmail, googleConectadoEm, valorConsulta)
  - `tempoMedioConsulta` Int default 30
  - `tempoAnamneseAtual` Int default 7
  - `mensagemLembretePadrao` Text default '<template institucional>'
  - `iaCollabAtivado` Boolean default false
  - `analiseProsodicaAtivada` Boolean default false
  - `modoSimples` Boolean default false
  - `modoVolume` Boolean default false
  - `modoSUS` Boolean default false
- Tabela nova `analise_prosodica_arquive`: id (UUID), pre_consulta_id (FK), medico_id (FK), paciente_id (FK), criado_em (DateTime), features (Json), thresholds (Json), trecho_inicio_ms (Int), trecho_fim_ms (Int), hash_audio (Text), retencao_ate (DateTime, criado_em + 20 anos CFM)
- Índices: (medico_id, criado_em) e (paciente_id, criado_em)

**Comando:** SQL direto via psql (NÃO `prisma db push --accept-data-loss`)

#### Fase 8 — Configurações persistidas
- Rota `PUT /medico` aceitar todos os 8 campos novos com validação Zod
- Frontend: `salvarEditField` no app-v2 já está plugado, só destrava
- Toast confirmação ao salvar

#### Fase 9 — IA Collab + Análise Prosódica
- Service `backend/src/services/iaCollab.js`: Claude prompt comparando 2-N PCs do mesmo paciente
- Service `backend/src/services/prosodica.js`: extração de features (jitter, shimmer, F0, pausa) — modo MOCK determinístico inicialmente, com hash SHA-256 do áudio
- Rota `POST /pre-consulta/:id/ia-collab` body: { outrosPCs[] } → { narrativa }
- Rota `POST /pre-consulta/:id/analise-prosodica` body: { audioRef } → { alerta, registroId }
- Rota `GET /analise-prosodica/:id` (médico dono) → registro completo
- Frontend: pluga animação IA Collab 3 estágios (já existe no preview) na rota real
- Disclaimer institucional CFM 2.314/2022 acima de todo alerta prosódico

#### Fase 10 — WhatsApp em massa
- Service `backend/src/services/whatsapp.js` em **modo simulação** (loga cada envio sem chamar Twilio real)
- Rota `POST /notificacoes/lembrete-massa` body: { destinatarios[], mensagem, dataEnvio? } → { jobId, count, modo: 'simulacao' }
- Rota `GET /notificacoes/historico?periodo` → disparos[]
- Rate limit: 10 req/min por médico
- Quando Lucas tiver Twilio aprovado, troca o modo de 'simulacao' pra 'real' (variável de ambiente)
- Frontend: animação Disparar 3 estágios já está no preview, pluga na rota real

#### Fase 11 — LGPD + iClinic + Soft delete
- Rota `GET /medico/me/exportar-dados-lgpd?formato=pdf|csv` retorna arquivo completo (todos os dados do médico)
- Rota `GET /medico/me/exportar-iclinic?periodo` formato CSV compatível iClinic
- Rota `DELETE /medico/me` soft-delete + agenda hard-delete em 30 dias (campo `excluidoEm` na tabela)
- Modal multi-passo no frontend (digitar "EXCLUIR" + senha)

#### Fase 12 — Hardening
- 25 edge cases (lista no plano mestre)
- Mobile responsive (preview já adapta, validar)
- Atalhos teclado documentados em modal "?"
- Performance: boot < 2s, paint < 1s
- Detector offline/online (preview já tem)
- Lighthouse audit: Performance ≥ 80, Accessibility ≥ 90

#### Fase 13 — Preparação cutover
**O que EU posso fazer:**
- Configurar `vercel.json` com A/B routing por hash de userId
- Toggle "voltar pro antigo" em Meu Perfil (lê localStorage ou query param)
- Documentação de suporte (FAQ pro betatester)
- Runbook de rollback documentado
- Configurar Sentry alertas (se Lucas me der `SENTRY_DSN`)
- Comunicado preparado pra 100%
- Bateria Playwright master `node tests/run.js`

**O que SÓ Lucas pode fazer:**
- Recrutar médico betatester
- 5 dias de uso real
- Avaliar NPS ≥ 8
- Acompanhar canário 10% → 50% → 100%

#### Fase 14 — Pós-launch documentação
- `docs/runbook-vitae.md` com rollback, restauração, debugging
- CLAUDE.md atualizado com Sessão 19
- README refeito
- Plano de evolução próximos 90 dias

---

## ORDEM DE EXECUÇÃO

1. ⚡ Fase 7 — Migration SQL aplicada
2. ⚡ Schema.prisma atualizado + prisma generate
3. ⚡ Fase 8 — Backend rotas + frontend plug
4. ⚡ Fase 9 — Serviços + rotas + frontend plug
5. ⚡ Fase 10 — WhatsApp simulação + frontend plug
6. ⚡ Fase 11 — LGPD/iClinic/Excluir + frontend plug
7. ⚡ Fase 12 — Hardening + Lighthouse
8. ⚡ Fase 13 — Vercel A/B + runbook + bateria Playwright
9. ⚡ Fase 14 — docs finais + CLAUDE.md

**Sem pausas. Sem perguntar. Documentando cada passo neste arquivo.**
