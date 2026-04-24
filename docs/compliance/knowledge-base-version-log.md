# Changelog da Base de Conhecimento Médico

Registro imutável de todas as alterações na base `backend/knowledge/`. Requisito ANVISA SaMD — rastreabilidade de versões da base de evidência.

---

## 2026-04-23 — v1.0 (inauguração)

### Pipeline
- Pipeline Padrões Observados v2.0 — inauguração
- Feature flag `PADROES_V2_ENABLED=false` (desativado por padrão)

### Base farmacológica
- `_farmacologia/classes.json` — 23 classes farmacológicas BR com princípios ativos e alergias cruzadas. Fonte: RENAME 2022 + Formulário Terapêutico Nacional + ANVISA.
- `_farmacologia/sinonimos.json` — ~70 mapeamentos nome comercial → princípio ativo → classe. Fonte: CMED + bulário ANVISA.

### Queixa: cefaleia (v1.0)
- `cefaleia/tensional_cronica.json` — Evidência B, fonte PCDT 2020 + SBCef 2022
- `cefaleia/enxaqueca_sem_aura.json` — Evidência A, fonte SBCef 2022 / ICHD-3
- `cefaleia/enxaqueca_com_aura.json` — Evidência A, fonte SBCef 2022 / ICHD-3
- `cefaleia/cluster.json` — Evidência A, fonte SBCef 2022
- `cefaleia/cefaleia_secundaria.json` — Evidência A, consolidador de red flags SNOOP

Todas as 5 condições revisadas contra ICHD-3 (International Classification of Headache Disorders, 3ª edição).

### Queixas pendentes (fase 2)
- dor_toracica (prioridade alta — próxima a popular)
- dor_abdominal
- febre
- tosse
- dispneia
- dor_lombar
- tontura
- dor_articular
- diarreia
- vomito
- fadiga
- perda_peso
- palpitacao
- edema
- disuria
- prurido
- lesao_pele
- ansiedade
- insonia

Cada queixa pendente precisa de:
- Leitura da diretriz SBCef/SBC/SBD/SBP/etc correspondente
- Estruturação de 4-6 condições principais em JSON padrão
- Fonte prioridade 1 ou 2 (diretriz sociedade médica BR ou PCDT MS)
- Revisão clínica (Conselho Consultivo — pendente formalização)

---

## Processo para adicionar nova condição

1. Ler diretriz brasileira (Sociedade Médica ou PCDT)
2. Criar `backend/knowledge/{queixa}/{condicao}.json` no formato canônico
3. Atualizar `backend/knowledge/{queixa}/_version.json`
4. Atualizar `backend/knowledge/_version.json` global
5. Atualizar este changelog
6. Commit com mensagem `feat(base): +{queixa}/{condicao} — fonte {X}`
7. Rodar teste de sanidade automático (pipeline não deve quebrar)
8. Peer review (quando Conselho Consultivo estiver formalizado)

---

## Processo para atualizar condição existente

1. Arquivar versão antiga: copiar para `_archive/{queixa}_{condicao}_v{old}.json`
2. Incrementar campo `versao` no JSON principal
3. Atualizar `data_revisao`
4. Registrar mudança neste changelog
5. Commit com mensagem `base(update): {queixa}/{condicao} v{old}→v{new} — motivo`

---

## Auditoria

Para reconstruir qualquer card histórico:
1. Buscar `PreConsulta.summaryJson.padroesObservados_v2[i].base_version` (ex: `cefaleia/enxaqueca_sem_aura_v2.0`)
2. Buscar arquivo exato em `backend/knowledge/` ou `_archive/`
3. Revalidar matching

**Todo card gerado em produção é rastreável até a versão exata da diretriz usada.**
