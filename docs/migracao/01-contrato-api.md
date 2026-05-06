# Contrato de API — Backend VITAE (Fase 2 da migração)

**Data:** 2026-05-05
**Versão:** 1.0
**Fonte:** mapeamento exaustivo de `backend/src/routes/*.js` + `backend/src/services/ai.js`
**Uso:** referência normativa para o frontend novo (`desktop/app.html`) plugar nas rotas existentes nas fases 4-6 e identificar gaps a implementar nas fases 8-11.

---

## Sumário

1. [Auth](#1-auth)
2. [Perfil](#2-perfil)
3. [Exames](#3-exames)
4. [Medicamentos](#4-medicamentos)
5. [Alergias](#5-alergias)
6. [Scores](#6-scores)
7. [Checkin](#7-checkin)
8. [Notificações](#8-notificacoes)
9. [PDF](#9-pdf)
10. [Médico](#10-medico)
11. [Pré-consulta](#11-pre-consulta)
12. [Templates](#12-templates)
13. [Agendamento (legado)](#13-agendamento)
14. [Autorização / RG público](#14-autorizacao)
15. [Consentimento](#15-consentimento)
16. [Timeline](#16-timeline)
17. [Admin](#17-admin)
18. [Agenda v2 (slots, secretaria, Google Calendar, push)](#18-agenda-v2)
19. [Estrutura `summaryJson`](#19-summaryjson)
20. [Padrões de auth](#20-padroes-auth)
21. [Discrepâncias preview vs backend (gaps a fechar)](#21-discrepancias)

---

## 1. Auth

| Método | Path | Auth | Body | Resposta |
|---|---|---|---|---|
| POST | `/auth/cadastro` | público | `{ nome, email, celular, senha, tipo: PACIENTE\|MEDICO }` | 201 `{ token, refreshToken, usuario }` · 409 duplicado |
| POST | `/auth/verificar-sms` | público | `{ celular, codigo }` | 200 `{ token, refreshToken, usuario }` · 400 inválido |
| POST | `/auth/login` | público | `{ email, senha }` | 200 `{ token, refreshToken, usuario }` · 401 · 403 inativa |
| POST | `/auth/login-social` | público | `{ provider, providerToken, nome, email }` | 200 `{ token, refreshToken, usuario }` |
| POST | `/auth/refresh` | público | `{ refreshToken }` | 200 `{ token, refreshToken }` · 401 |
| POST | `/auth/esqueci-senha` | público | `{ email }` | 200 `{ mensagem }` (sempre 200) |
| POST | `/auth/resetar-senha` | público | `{ token, novaSenha }` | 200 `{ mensagem }` · 400 |
| DELETE | `/auth/conta` | obrigatório | — | 200 `{ mensagem }` |

---

## 2. Perfil

| Método | Path | Auth | Body / Query | Resposta |
|---|---|---|---|---|
| GET | `/perfil` | obrigatório | — | 200 `{ usuario, perfil }` |
| PUT | `/perfil` | obrigatório | `{ ...campos PerfilSaude }` | 200 `{ perfil }` |
| PATCH | `/perfil/conta` | obrigatório | `{ nome?, email?, celular? }` | 200 `{ usuario }` |
| POST | `/perfil/foto` | obrigatório | `{ fotoUrl }` | 200 `{ fotoUrl }` |

Campos editáveis: `genero`, `dataNascimento`, `alturaCm`, `pesoKg`, `tipoSanguineo`, `historicoFamiliar`, `nivelAtividade`, `horasSono`, `fuma`, `alcool`, `cpf`, `cirurgias`, `planoSaude`, `carteirinhaPlano`, `condicoes`, `contatoEmergenciaNome`, `contatoEmergenciaTel`, `apelido`, `nomeSocial`, `estadoCivil`, `corEtnia`, `limitacoesAcessibilidade`.

---

## 3. Exames

| Método | Path | Auth | Body / Query | Resposta |
|---|---|---|---|---|
| POST | `/exames/upload` | obrigatório | multipart `file` (PDF/JPG/PNG, ≤20MB) + `dataExame?` | 201 `{ mensagem, exameId }` · 413 |
| GET | `/exames` | obrigatório | — | 200 `{ exames[] }` |
| GET | `/exames/:id` | obrigatório (dono OU médico vinculado) | — | 200 `{ exame }` · 403 · 404 |
| DELETE | `/exames/:id` | obrigatório (dono) | — | 200 `{ mensagem }` |

Cada `exame`: `{ id, nomeArquivo, tipoArquivo, tipoExame, laboratorio, dataExame, status, statusGeral, parametros[], textoExtraido, resumoIA, melhoriasIA, arquivoUrl }`.

---

## 4. Medicamentos

| Método | Path | Auth | Body | Resposta |
|---|---|---|---|---|
| GET | `/medicamentos` | obrigatório | — | 200 `{ medicamentos[] }` |
| POST | `/medicamentos` | obrigatório | `{ nome, dosagem?, frequencia?, horario?, motivo?, observacao?, medicoPrescritor?, duracaoDias?, quantidadeEstoque?, quantidadePorDose?, dataInicio?, dataFim? }` | 201/200 `{ medicamento, duplicadoAtualizado }` |
| PUT | `/medicamentos/:id` | obrigatório (dono) | parcial | 200 `{ medicamento }` |
| DELETE | `/medicamentos/:id` | obrigatório (dono) | — | 200 `{ mensagem }` |
| GET | `/medicamentos/info/:nome` | obrigatório | — | 200 `{ info }` (gerado por IA) |
| POST | `/medicamentos/scan` | obrigatório | multipart `file` (≤10MB) | 200 `{ tipo: "receita", medico?, data?, medicamentos[], totalAlertasAlergia }` |

---

## 5. Alergias

| Método | Path | Auth | Body | Resposta |
|---|---|---|---|---|
| GET | `/alergias` | obrigatório | — | 200 `{ alergias[] }` |
| POST | `/alergias` | obrigatório | `{ nome, tipo?, gravidade? }` | 201/200 `{ alergia }` (dedupe por nome normalizado) |
| DELETE | `/alergias/:id` | obrigatório (dono) | — | 200 `{ mensagem }` |
| GET | `/alergias/info/:nome` | obrigatório | — | 200 `{ info }` |
| POST | `/alergias/scan` | obrigatório | multipart `file` | 200 `{ tipo: "exame_alergico", alergias[], totalNovas, totalExistentes }` |

Tipos: `MEDICAMENTO`, `ALIMENTO`, `AMBIENTAL`, `CONTATO`, `OUTRO`. Gravidade: `LEVE`, `MODERADA`, `GRAVE`, `ANAFILAXIA`.

---

## 6. Scores

| Método | Path | Auth | Resposta |
|---|---|---|---|
| GET | `/scores/atual` | obrigatório | 200 `{ score \| null }` |
| GET | `/scores/historico` | obrigatório | 200 `{ historico[] }` |
| GET | `/scores/melhorias` | obrigatório | 200 `{ melhorias[] }` |
| POST | `/scores/recalcular` | obrigatório | 200 `{ score }` |

`score`: `{ scoreGeral, scoreSono, scoreAtividade, scoreProdutividade, scoreExame, idadeBiologica, idadeCronologica, confianca, criadoEm }`.

---

## 7. Checkin

| Método | Path | Auth | Body | Resposta |
|---|---|---|---|---|
| POST | `/checkin` | obrigatório | `{ sonoQualidade: 1-5, atividadeFisica, humor: 1-5, dor?, produtividade: 1-5, notas? }` | 201 `{ checkin }` · 409 já feito |
| GET | `/checkin/historico` | obrigatório | — | 200 `{ checkins[] }` (12 sem) |

---

## 8. Notificações

| Método | Path | Auth | Query / Body | Resposta |
|---|---|---|---|---|
| GET | `/notificacoes` | obrigatório | `pagina=1, limite=20, apenasNaoLidas?` | 200 `{ notificacoes, total, naoLidas, pagina, totalPaginas }` |
| PUT | `/notificacoes/:id/ler` | obrigatório | — | 200 `{ notificacao }` · 403 · 404 |
| PUT | `/notificacoes/config` | obrigatório | TBD | 200 `{ mensagem }` |

---

## 9. PDF

| Método | Path | Auth | Resposta |
|---|---|---|---|
| POST | `/pdf/gerar` | obrigatório | 200 `{ usuario, perfil, score, exames[], medicamentos, alergias, geradoEm }` (frontend monta o PDF) |

---

## 10. Médico

| Método | Path | Auth | Body / Query | Resposta |
|---|---|---|---|---|
| POST | `/medico` | obrigatório | `{ crm, ufCrm, especialidade, clinica, enderecoClinica, telefoneClinica, valorConsulta }` | 201 `{ medico }` · 409 |
| GET | `/medico` | obrigatório | — | 200 `{ medico }` · 404 |
| PUT | `/medico` | obrigatório | parcial | 200 `{ medico }` |
| GET | `/medico/pacientes` | obrigatório (médico) | — | 200 `{ pacientes[] }` |
| GET | `/medico/pacientes/buscar` | obrigatório | `q` (≥2 chars) | 200 `{ pacientes[] }` |
| GET | `/medico/pacientes/:pacienteId` | obrigatório + RBAC | — | 200 `{ paciente, preConsultas[] }` · 403 |
| GET | `/medico/dashboard` | obrigatório | — | 200 `{ totalPacientes, preConsultasPendentes, preConsultasRespondidas, totalPreConsultas }` |
| POST | `/medico/limpeza-antigas` | obrigatório | — | 200 `{ ok, apagadas, nomes[] }` |
| GET | `/medico/diagnostico-pre-consulta` | obrigatório | — | 200 `{ total, preConsultas[] }` |
| POST | `/medico/migrar-autorizacoes` | obrigatório | — | 200 `{ ok, criadas, atualizadas, totalPacientes }` |

`paciente` no detalhe: `{ id, nome, email, celular, fotoUrl, perfilSaude, medicamentos[], alergias[], exames[] }`. Auditoria automática `VIEW_PACIENTE`.

---

## 11. Pré-consulta

| Método | Path | Auth | Body | Resposta |
|---|---|---|---|---|
| POST | `/pre-consulta` | médico | `{ pacienteNome, pacienteTel?, pacienteEmail?, templateId? }` | 201 `{ preConsulta, link, whatsappLink? }` |
| GET | `/pre-consulta/t/:token` | opcional | — | 200 `{ id, pacienteNome, medicoNome, especialidade, status, perfilPaciente, templatePerguntas, permitirAudio }` |
| POST | `/pre-consulta/t/:token/responder` | opcional | `{ respostas, transcricao?, audioBase64?, fotoBase64? }` | 200 `{ ok, audioConfirmado, fotoConfirmada, transcricaoValida, statusPosterior }` · 409 · 410 · 422 |
| POST | `/pre-consulta/t/:token/responder-audio` | opcional | multipart audio+foto + JSON | 200 `{ preConsulta }` |
| POST | `/pre-consulta/t/:token/classificar-resposta` | público | multipart audioChunk + pergunta | 200 `{ respondeu, valor, confianca, motivo, transcricao, audioUrl, ... }` |
| GET | `/pre-consulta/t/:token/estado` | opcional | — | 200 `{ preConsultaId, perguntaAtual?, respostas?, cobertura? }` |
| POST | `/pre-consulta/t/:token/responder-pergunta` | opcional | multipart audioChunk + dados (V4) | 200 `{ modo, respondeu, valor, ... }` |
| POST | `/pre-consulta/t/:token/finalizar` | opcional | — | 200 `{ ok, cobertura, statusBriefing }` · 400 cobertura |
| POST | `/pre-consulta/t/:token/verificar` | público | `{ transcricao }` | 200 `{ completude, topicos[] }` |
| GET | `/pre-consulta` | médico | — | 200 `{ preConsultas[] }` |
| GET | `/pre-consulta/:id` | médico | — | 200 `{ preConsulta }` (auditoria `VIEW_BRIEFING`) |
| POST | `/pre-consulta/:id/regenerar` | médico | — | 200 `{ ok, summary }` · 429 debounce 15s |
| POST | `/pre-consulta/:id/tts` | médico | `force?` | audio MP3 ou JSON com URL · 422 |
| DELETE | `/pre-consulta/by-patient` | médico | `{ pacienteNome, pacienteTel? }` | 200 `{ ok, deletedCount }` |
| DELETE | `/pre-consulta/:id` | médico | — | 200 `{ ok }` |

Side-effects do `/responder` e `/finalizar`:
- HEAD validation nas URLs de áudio/foto antes de retornar 200
- Geração de summary IA enfileirada em `TarefaPendente`
- Vinculação automática paciente↔médico via auto-link tel/email (cria `AutorizacaoAcesso` + `Consentimento`)
- Disparo de TTS em background

---

## 12. Templates

| Método | Path | Auth | Body | Resposta |
|---|---|---|---|---|
| GET | `/templates/preview-publico/:id` | público | — | 200 `{ nome, perguntas }` |
| POST | `/templates/gerar` | médico | `{ instrucao }` | 200 `{ perguntas[] }` (IA) |
| POST | `/templates/classificar` | médico | `{ texto }` | 200 `{ perguntas[] }` |
| GET | `/templates` | médico | — | 200 `{ templates[] }` |
| GET | `/templates/:id` | médico | — | 200 `{ template }` |
| POST | `/templates` | médico | `{ nome, perguntas: 4-25, permitirAudio? }` | 200 `{ template }` |
| PUT | `/templates/:id` | médico | parcial | 200 `{ template }` |
| DELETE | `/templates/:id` | médico | — | 200 `{ ok, aviso? }` |

Tipos de pergunta: `scale`, `select`, `text`, `upload`, `date`.

---

## 13. Agendamento

Legado (mantido por retrocompat). Usar Agenda v2 (seção 18) para novos fluxos.

| Método | Path | Auth | Body | Resposta |
|---|---|---|---|---|
| POST | `/agendamento` | obrigatório | `{ titulo, tipo: EXAME\|CONSULTA\|RETORNO, local?, medico?, observacoes?, dataHora, lembrete? }` | 201 `{ agendamento }` |
| GET | `/agendamento` | obrigatório | — | 200 `{ agendamentos[] }` |
| GET | `/agendamento/proximo` | obrigatório | — | 200 `{ agendamento }` |
| PUT | `/agendamento/:id` | obrigatório | parcial | 200 `{ mensagem }` |
| DELETE | `/agendamento/:id` | obrigatório | — | 200 `{ mensagem }` |

---

## 14. Autorização

| Método | Path | Auth | Body | Resposta |
|---|---|---|---|---|
| GET | `/autorizacao/rg-publico/:userId` | público | — | 200 `{ usuario, perfil, alergias, medicamentos, examesRecentes }` (auditoria) |
| GET | `/autorizacao/exame-publico/:userId/:examId` | público | — | 200 `{ exame }` |
| POST | `/autorizacao` | obrigatório | `{ medicoCrm, tipoAcesso: LEITURA\|COMPLETO, categorias?, duracaoDias? }` | 201 `{ autorizacao }` · 404 · 409 |
| GET | `/autorizacao` | obrigatório | — | 200 `{ autorizacoes[] }` |
| DELETE | `/autorizacao/:id` | obrigatório | — | 200 `{ mensagem }` |
| GET | `/autorizacao/qr-data` | obrigatório | — | 200 `{ usuario, perfil, medicamentos, alergias, ultimoExame }` |

---

## 15. Consentimento

| Método | Path | Auth | Body | Resposta |
|---|---|---|---|---|
| POST | `/consentimento` | obrigatório | `{ tipo: TERMOS_USO\|POLITICA_PRIVACIDADE\|COMPARTILHAMENTO_MEDICO\|PROCESSAMENTO_IA, aceito, versao? }` | 201 `{ consentimento }` (captura IP+UA) |
| GET | `/consentimento` | obrigatório | — | 200 `{ consentimentos[] }` |
| DELETE | `/consentimento/:id` | obrigatório | — | 200 `{ mensagem }` |
| GET | `/consentimento/status` | obrigatório | — | 200 `{ status }` |

---

## 16. Timeline

| Método | Path | Auth | Resposta |
|---|---|---|---|
| GET | `/timeline` | obrigatório | 200 `{ timeline[] }` (`tipo: EXAME\|MEDICAMENTO\|ALERGIA\|AGENDAMENTO\|CHECKIN`, ordenado data DESC) |

---

## 17. Admin

Todas as rotas exigem header `x-admin-token`.

| Método | Path | Resposta |
|---|---|---|
| GET | `/admin/health` | `{ ok, db, observability }` |
| GET | `/admin/queue` | `{ pendentes, mortas, processadas_24h, por_tipo, stuck_30min_ou_mais }` |
| GET | `/admin/stats` | `{ usuarios, medicos, pacientes, preConsultas_24h, preConsultas_total, exames_total }` |
| GET | `/admin/audit` | `{ total, eventos[] }` (`limit?`, max 500) |
| POST | `/admin/backfill-nivel` | `{ ok, encontradas, atualizadas }` |
| POST | `/admin/queue/:id/retry` | `{ ok, updated }` |

---

## 18. Agenda v2

Configuração, slots, retornos, lista de espera, Google Calendar, push web, secretaria multi-user.

### Config
- `GET /agenda/config` (médico) → `{ ok, data }`
- `PUT /agenda/config` (médico) — `duracaoPadraoMin, visaoPadrao, diasAtendimento, horarioInicio, horarioFim, almocoInicio, almocoFim, bufferMin, lembrete24h, lembrete2h, videochamadaTipo, noShowAuto, feriadosAuto, timezone, tourCompleto`

### Locais
- CRUD `/agenda/locais` (médico cria/edita; secretaria lê)

### Slots
- `GET /agenda/slots?inicio&fim&incluirCanceladas`
- `POST /agenda/slots` — `{ pacienteId?, pacienteNomeLivre?, pacienteTelLivre?, localId?, inicio, fim, duracaoMin, tipo: CONSULTA_NOVA\|RETORNO\|ONLINE\|BLOQUEIO, motivo?, observacoes?, videoUrl?, attemptId? }`
- `PUT /agenda/slots/:id`, `DELETE /agenda/slots/:id`
- `POST /agenda/slots/:id/comparecer | /falta | /desfazer`

### Confirmação pública
- `GET /agenda/slots/:id/confirmar-presenca?token` (HTML)
- `GET /agenda/slots/:id/recusar?token` (HTML)

### Retorno
- `GET /agenda/sugestoes-retorno?pacienteId&prazoDias`

### Slots do paciente
- `GET /agenda/meus-slots`, `GET /agenda/proximo-meu`

### Finalizar atendimento
- `POST /agenda/finalizar/:preConsultaId` — `{ comRetorno, slotInicio?, slotFim?, slotDuracaoMin?, slotLocalId?, slotMotivo?, attemptId? }`
- `POST /agenda/finalizar/:preConsultaId/desfazer`

### Lista de espera
- CRUD `/agenda/lista-espera`
- `POST /agenda/lista-espera/:id/oferecer`
- `GET /agenda/lista-espera/aceitar?token&usuarioId` (público)

### Stats
- `GET /agenda/stats?mes=YYYY-MM` → `{ totalSlots, comparecimentos, faltas, retornosMarcados, finalizadas, taxaPresenca, taxaRetorno, noShowEvitado, economiaRS }`

### Google Calendar
- `GET /agenda/google/auth`, `GET /agenda/google/callback` (público), `POST /agenda/google/sync`, `DELETE /agenda/google/desconectar`, `GET /agenda/google/status`

> **Importante para Fase 10:** já existe integração Google Calendar parcial nessas rotas. Reaproveitar ao invés de criar do zero.

### Push web
- `GET /agenda/push/vapid-public-key` (público)
- `POST /agenda/push/subscribe`, `DELETE /agenda/push/subscribe`

### Secretaria
- CRUD `/agenda/secretarias`, convite por token, aceitar via auth.

---

## 19. summaryJson

Estrutura serializada dentro de `PreConsulta.summaryJson` (campo Json livre, sem schema rígido).

```json
{
  "descricaoBreve": "string (1-2 frases simples)",
  "summaryTexto": "string (3-5 frases clínicas interpretativas)",
  "textoVoz": "string (~150-180 palavras, briefing áudio)",
  "queixaPrincipal": "[Sintoma] há [duração] em paciente de [idade] anos",
  "pontosAtencao": [
    { "titulo": "string", "mensagem": "string", "gravidade": "baixa|media|alta|urgente" }
  ],
  "identificaPadroes": [
    { "hipotese": "Considere|Padrao compativel com|Vale cogitar|Pode haver", "evidencia": "string" }
  ],
  "blocos": [
    { "titulo": "string", "conteudo": "string", "prioridade": "alta|media|baixa" }
  ],
  "alertas": [
    { "tipo": "URGENTE|ATENCAO|INFO", "titulo": "string", "mensagem": "string" }
  ],
  "anamneseEstruturada": {
    "queixaPrincipal":      { "valor": "string|null", "fonte": "audio|formulario|null" },
    "tempoEvolucao":        { "valor": "...", "fonte": "..." },
    "intensidade":          { "valor": "7/10 | leve|moderada|intensa", "fonte": "..." },
    "fatoresAgravantes":    { "valor": "...", "fonte": "..." },
    "fatoresAtenuantes":    { "valor": "...", "fonte": "..." },
    "sintomasAssociados":   { "valor": "lista vírgula", "fonte": "..." },
    "tratamentoPrevio":     { "valor": "...", "fonte": "..." },
    "antecedentesPessoais": { "valor": "...", "fonte": "..." },
    "antecedentesFamiliares": { "valor": "...", "fonte": "..." },
    "habitos":              { "valor": "Não fuma · não bebe · sedentária", "fonte": "..." },
    "sono":                 { "valor": "6h/noite · qualidade ruim", "fonte": "..." }
  },
  "padroesObservados_v2": [ /* multi-agent pipeline */ ],
  "alertasFarmacologicos": [ /* conflitos med×alergia */ ],
  "pipeline_version": "string",
  "base_versions": { /* fontes da base de conhecimento */ }
}
```

Defensivo: nem todo summary tem todos os campos. Frontend deve renderizar só o que existir.

---

## 20. Padrões de auth

| Categoria | Auth | Nota |
|---|---|---|
| Cadastro/login/reset | público | LGPD: captura IP+UA em consentimentos |
| Perfil/Exames/Meds/Alergias/Scores/Checkin/Notif/PDF | `verificarAuth` | Paciente acessa seus próprios dados |
| Médico (CRUD/pacientes/dashboard) | `verificarAuth` + `usuario.tipo === MEDICO` | RBAC implícito |
| Pré-consulta criar/listar/regenerar | médico | RBAC |
| Pré-consulta `/t/:token/*` | `authOpcional` | Paciente anônimo ou logado |
| RG público / exame público | público | Auditoria automática |
| Admin | `x-admin-token` header | — |
| Agenda v2 | role-based (médico / secretaria / paciente) | Multi-tenant via convite |

---

## 21. Discrepâncias

Comparando o que `preview-app-reformulado.html` consome vs o que o backend hoje oferece:

### ✅ Já cobertas (Fases 4-6 plugam direto)

| Feature do preview | Rota existente |
|---|---|
| Lista PCs · filtro · busca | `GET /pre-consulta` |
| Abrir PC · ver summary | `GET /pre-consulta/:id` |
| Regenerar resumo | `POST /pre-consulta/:id/regenerar` |
| TTS | `POST /pre-consulta/:id/tts` |
| Lista pacientes | `GET /medico/pacientes` |
| Detalhe paciente · 7 abas (Resumo/Exames/Meds/Alergias/Condições/Timeline/PCs) | `GET /medico/pacientes/:id` (já retorna tudo agregado) |
| Templates CRUD | `GET/POST/PUT/DELETE /templates` |
| Perfil médico (CRUD básico) | `GET/PUT /medico` |
| Agenda do dia (Hoje) | `GET /agenda/slots?inicio&fim` |
| Google Calendar conectar/desconectar | `/agenda/google/*` |

### ⚠️ Parcialmente cobertas (precisam extensão na Fase 8-11)

| Feature | Gap |
|---|---|
| Painel Tempo & Receita (configurações financeiras) | `Medico` precisa dos campos `tempoMedioConsulta`, `tempoAnamneseAtual`, `valorConsulta`, `mensagemLembretePadrao` (Fase 7 schema + Fase 8 PUT estendido). `valorConsulta` já existe; resto é novo. |
| Modos persona (simples/volume/SUS) | Schema `Medico.modoSimples/modoVolume/modoSUS` (Fase 7) + persistir no `PUT /medico` |
| Toggles IA (`iaCollabAtivado`, `analiseProsodicaAtivada`) | Schema (Fase 7) + persistir |
| Mensagem WhatsApp padrão | Schema `Medico.mensagemLembretePadrao` (Fase 7) |
| Foto de perfil | Já existe `POST /perfil/foto` mas exige `{ fotoUrl }` pronta — frontend precisa de upload pra Supabase antes (ou criar `POST /medico/foto` com multipart) |
| Disparar lembrete em massa | **Não existe.** Precisa `POST /notificacoes/lembrete-massa` (Fase 10) |
| Histórico de disparos | **Não existe.** Precisa `GET /notificacoes/historico` (Fase 10) |
| Exportar dados LGPD (PDF/CSV) | `POST /pdf/gerar` retorna estrutura básica — precisa endpoint dedicado `/medico/exportar-dados-lgpd?formato=pdf\|csv` (Fase 11) |
| Exportar iClinic | **Não existe.** `/medico/exportar-iclinic?periodo` (Fase 11) |
| Excluir conta com janela 30 dias | `DELETE /auth/conta` é hard-delete imediato. Precisa `DELETE /medico/me` com soft-delete + agendamento (Fase 11) |

### ❌ Não cobertas (totalmente novas — Fase 9-10)

| Feature | Fase | Rota nova |
|---|---|---|
| IA Collab (cruzar anamneses) | 9 | `POST /pre-consulta/:id/ia-collab` body `{ outrosPCs: id[] }` → `{ narrativa }` |
| Análise Prosódica (gravar features+hash, retornar alerta) | 9 | `POST /pre-consulta/:id/analise-prosodica` |
| Auditoria prosódica | 9 | `GET /analise-prosodica/:id` (médico dono) |
| Tabela `AnaliseProsodicaArquive` | 7 (schema) | n/a |
| Lembrete WhatsApp Business | 10 | `POST /notificacoes/lembrete-massa` |
| Histórico disparos | 10 | `GET /notificacoes/historico` |

### 🔍 Pontos de atenção

1. **Schema migration (Fase 7):** já listado — 12 colunas em `Medico` + tabela nova `AnaliseProsodicaArquive`. `valorConsulta` já existe; conferir se `Decimal(10,2)` bate com o que o frontend manda.
2. **`summaryJson`:** preview lê 11 campos da `anamneseEstruturada` + `padroesObservados_v2` + `alertaProsodico`. Backend hoje já gera `anamneseEstruturada` e `padroesObservados_v2`. **`alertaProsodico` é gap — entra na Fase 9.**
3. **Auth opcional vs obrigatória:** `/responder*` aceita `authOpcional` por design (paciente anônimo). Manter no app novo — fluxo do médico **nunca** toca essas rotas.
4. **Auditoria automática:** `VIEW_PACIENTE` e `VIEW_BRIEFING` já são registradas. Para padrões prosódicos exigir `VIEW_ANALISE_PROSODICA` na Fase 9.
5. **Rate limit:** `/pre-consulta/:id/regenerar` tem debounce 15s server-side. Frontend deve respeitar 429. Replicar em `/notificacoes/lembrete-massa` (Fase 10) com 10 req/min por médico.
6. **Agenda v2 já tem Google Calendar:** `/agenda/google/auth`, `/agenda/google/callback`, `/agenda/google/status`. **Reaproveitar na Fase 10** — não criar `/medico/me/calendar/*` paralelo.

### Decisão sobre Fase 10 (revisão de plano)

O plano mestre listava `GET /medico/me/calendar/connect` etc como rotas novas. Após este mapeamento, **a Fase 10 vai estender as rotas `/agenda/google/*` existentes** ao invés de criar paralelas. Isso reduz a quantidade de rotas novas de **14 para ~9** sem perder funcionalidade. Atualizar plano mestre quando Lucas validar este contrato.

---

**Próximo passo:** Fase 3 — andaime do `desktop/app.html` novo + auth gate + `desktop/01-login.html`.
