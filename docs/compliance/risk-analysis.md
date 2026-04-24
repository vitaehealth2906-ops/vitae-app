# Análise de Risco — Componente Padrões Observados v2

**Norma de referência:** ISO 14971 — Medical devices — Application of risk management to medical devices
**Versão:** 1.0
**Data:** 2026-04-23
**Classificação estimada ANVISA:** SaMD Classe I (apoio à decisão clínica, risco baixo)

---

## 1. Descrição do componente

Software de apoio à decisão clínica que analisa pre-consulta respondida por paciente (áudio transcrito + dados estruturados) e sugere ao médico:
- Alertas farmacológicos críticos (cruzamento medicamento × alergia)
- Detecção de auto-medicação
- Diferenciais diagnósticos compatíveis com quadro
- Red flags (sinais de alarme para investigação imediata)

**Finalidade:** apoiar raciocínio clínico do médico. **Não é ferramenta diagnóstica.**

---

## 2. Mapa de riscos

| ID | Risco | Severidade | Probabilidade | Mitigação implementada |
|----|-------|------------|----------------|------------------------|
| R01 | Sistema sugere diagnóstico que médico aceita sem questionar, resultando em conduta errada | Alta | Baixa | Disclaimer CFM em cada card; threshold mínimo de score; linguagem não-diagnóstica obrigatória; botão rejeitar sempre visível |
| R02 | Alerta farmacológico falso positivo gera rejeição do sistema por médico | Média | Média | Cruzamento 100% determinístico por classe farmacológica; tabela validada contra CMED/ANVISA; match exato por princípio ativo |
| R03 | Alerta farmacológico falso negativo (sistema não detecta alergia × medicamento) | Alta | Baixa | Tabela de classes cobre os 20+ princípios ativos mais prescritos BR; classes com alergia cruzada documentadas; teste unitário para cada par crítico |
| R04 | Sistema usa diretriz desatualizada sem perceber | Média | Baixa | Versionamento imutável da base; cron semanal `verificaDiretrizes()` alerta quando fonte passa de 3 anos; changelog em `knowledge-base-version-log.md` |
| R05 | Vazamento de dados sensíveis do paciente ao LLM externo | Crítica | Baixa | Pseudonimização obrigatória antes de qualquer chamada (CPF, nome, telefone, email removidos); teste automático detecta vazamentos |
| R06 | Red flag grave (ex: AVC) não é detectado | Crítica | Baixa | Red flags transversais SNOOP embutidos em todas as queixas; sempre em bloco separado visível; linguagem direta sem atenuação |
| R07 | Sistema trava/demora e impede médico de atender paciente | Baixa | Média | Circuit breaker global de 15s; cada agente com try/catch isolado; fallback para sistema legado automático |
| R08 | Conflito entre diferenciais (duas condições sugerindo ações opostas) | Média | Baixa | Agente Integrador detecta contradição; banner "Diferenciais conflitam — avaliação clínica crítica"; log da contradição |
| R09 | Sugestão inadequada em paciente gestante | Alta | Baixa | Campo `contraindicacao_gestacao` em cada condição; banner específico quando `perfil.gestante=true`; Farmacologista suprime categoria C/D/X |
| R10 | Médico confia em sugestão e paciente é prejudicado | Crítica | Baixa | Log imutável de cada sugestão + disclaimer + ID auditoria visível; médico sempre pode rejeitar; responsabilidade final é do médico (CFM Res. 2.299/2021) |

---

## 3. Controles de mitigação

### Controles técnicos (embutidos no código)

1. **Threshold duro de score mínimo (60)** — condições com score menor não renderizam
2. **Sinais bateram mínimos (3)** — evita sugestão frágil com 1-2 critérios
3. **Fonte obrigatória** — agente Compliance rejeita card sem fonte válida
4. **Linguagem não-diagnóstica** — regex bloqueia "paciente tem", "diagnóstico de", "é X"
5. **Ranking por prevalência** (não gravidade) — evita alarme falso com doenças raras
6. **Red flags em bloco separado** — sempre visível, nunca misturado com diferenciais comuns
7. **Circuit breaker** — erro em qualquer agente não derruba o pipeline
8. **Pseudonimização** — nenhum dado identificável sai do backend
9. **Feature flag** — sistema pode ser desativado em segundos via env var
10. **Versionamento imutável** — auditoria pode reconstruir qualquer card histórico

### Controles administrativos (processo)

1. **Conselho Consultivo Médico** (pendente de formalização) — revisão mensal de 5% dos cards gerados
2. **Auditoria trimestral automática** — endpoint gera relatório
3. **Revisão de diretrizes a cada 3 anos** — alerta automático
4. **Documento de consentimento** do médico usuário confirma responsabilidade clínica

---

## 4. Risco residual

Após aplicação dos controles acima, o risco residual é avaliado como **aceitável** para operação em regime piloto/beta com médicos cadastrados e cientes do caráter de apoio à decisão.

Risco residual mais alto: **R01 (médico aceitar sugestão sem questionar)**. Controles embutidos reduzem mas não eliminam. Monitoramento contínuo via métrica "taxa de aceitação sem ressalva" pode disparar revisão.

---

## 5. Monitoramento pós-implantação

Endpoint `/admin/padroes-v2-stats` expõe em tempo real:
- Taxa de sucesso/falha do pipeline
- Distribuição de scores
- Taxa de aceitação vs rejeição por médico
- Rejeições de compliance (motivos)
- Tempo P50/P99
- Cards por fonte de diretriz

Se métricas indicarem anomalia (ex: rejeição >50% ou tempo médio >10s), o sistema alerta automaticamente e pode ser desligado com `PADROES_V2_ENABLED=false`.

---

## 6. Revisão

Este documento deve ser revisado:
- A cada atualização major da base de conhecimento
- A cada adição de nova queixa
- Após incidente clínico reportado
- Anualmente, no mínimo

**Próxima revisão programada:** 2027-04-23
