# Especificação — Trilha de Auditoria Padrões Observados v2

**Data:** 2026-04-23
**Versão:** 1.0

---

## 1. Objetivo

Registrar, de forma imutável e rastreável, todas as sugestões clínicas geradas pelo pipeline Padrões Observados v2, em conformidade com:
- **CFM Resolução 2.299/2021** — apoio à decisão clínica com rastreabilidade
- **Lei 13.787/2018** — prontuário eletrônico, retenção 20 anos
- **LGPD Art. 37** — obrigação de manter registros

---

## 2. Estrutura do log

Cada pipeline execution gera trilha completa armazenada em `PreConsulta.summaryJson.auditoria_padroes_v2`:

```json
[
  {
    "agente": "anamnesista",
    "status": "ok",
    "tempo_ms": 3240,
    "timestamp": "2026-04-23T22:58:01.234Z"
  },
  {
    "agente": "farmacologista",
    "status": "ok",
    "alertas": 1,
    "auto_medicacao": 1,
    "tempo_ms": 12,
    "timestamp": "..."
  },
  {
    "agente": "epidemiologista",
    "status": "ok",
    "queixa": "cefaleia",
    "candidatos": 2,
    "red_flags": [],
    "tempo_ms": 45,
    "timestamp": "..."
  },
  {
    "agente": "compliance",
    "status": "ok",
    "aprovados": 4,
    "rejeitados": 1,
    "rejeicoes_detalhe": [...]
  }
]
```

Adicionalmente, cada **card individual** tem:
- `id` — ID único (formato `AUD-YYYYMMDDHHmmss-XXXX`)
- `base_version` — versão exata da base usada
- `fonte` — diretriz citada
- `disclaimer` — texto CFM anexado

---

## 3. Eventos adicionais registrados

Além da trilha do pipeline, estes eventos ficam em `auditLog`:

| Evento | Campos registrados |
|--------|-------------------|
| Médico abre pre-consulta | `pacienteId`, `medicoId`, `preConsultaId`, `timestamp`, `ip`, `userAgent` |
| Médico clica "Aceitar" em card | `cardId`, `medicoId`, `timestamp`, `preConsultaId` |
| Médico clica "Rejeitar" em card | `cardId`, `medicoId`, `timestamp`, `preConsultaId`, `motivo?` |
| Pipeline executado | `preConsultaId`, `pipelineVersion`, `resultadoResumo`, `tempoMs` |
| Erro no pipeline | `preConsultaId`, `agente`, `mensagemErro`, `timestamp` |

---

## 4. Retenção

- **Dados identificáveis**: enquanto conta ativa + 15 dias após solicitação de apagamento
- **Logs de auditoria anonimizados**: **20 anos** (exigência prontuário eletrônico Lei 13.787)
- **Versões da base de conhecimento**: **permanente** (imutável, arquivada em `backend/knowledge/_archive/`)

---

## 5. Chain of custody (integridade)

Para prevenir adulteração retroativa de sugestões:

1. Cada card gerado tem hash SHA-256 calculado no momento da geração
2. Hash armazenado em `PreConsulta.summaryJson.auditoria_padroes_v2[i].hash`
3. Qualquer modificação posterior do card é detectável via verificação de hash
4. Ferramenta de auditoria `/admin/auditar-padroes/:preConsultaId` permite revalidação

---

## 6. Acesso aos logs

| Quem | O que pode ver |
|------|---------------|
| Paciente | Só os próprios logs (via exportação LGPD) |
| Médico da pre-consulta | Trilha daquela consulta específica |
| Admin vita id | Todos, mas apenas para fins de auditoria |
| Autoridade fiscalizadora (ANVISA, CFM) | Mediante requisição formal |

---

## 7. Exportação para auditoria externa

Endpoint admin `/admin/audit-export?de=YYYY-MM-DD&ate=YYYY-MM-DD&preConsultaId=X` gera CSV/JSON com:
- Trilha completa de todos os pipelines no período
- Cards gerados e versões da base
- Taxa de aceitação/rejeição

Formato compatível com auditoria ANVISA SaMD Classe I.

---

## 8. Integridade das versões da base de conhecimento

A cada atualização de qualquer JSON em `backend/knowledge/`:

1. Versão antiga é arquivada em `backend/knowledge/_archive/{queixa}_{condicao}_v{old}.json`
2. Changelog em `docs/compliance/knowledge-base-version-log.md` é atualizado
3. `_version.json` incrementa
4. Deploy não sobe se versão não foi incrementada (pre-commit hook)

---

## 9. Revisão

Este documento é atualizado sempre que:
- Novo campo for adicionado à trilha
- Novo evento for registrado
- Mudança em retenção
- Incidente de segurança
