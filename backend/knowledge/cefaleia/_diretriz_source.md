# Cefaleia — Base de conhecimento vita id

**Versão:** 1.0
**Última atualização:** 2026-04-23

## Fontes usadas (ordem de prioridade)

### Prioridade 1 — Diretrizes brasileiras
- **Sociedade Brasileira de Cefaleia (SBCef)** — Diretrizes brasileiras para o tratamento das cefaleias primárias, 2022. https://sbcefaleia.com.br
- **Academia Brasileira de Neurologia (ABN)** — Recomendações para o diagnóstico e tratamento das cefaleias primárias, 2021.

### Prioridade 2 — Ministério da Saúde
- **PCDT - Cefaleias crônicas** (atualização 2020) — Comissão Nacional de Incorporação de Tecnologias no SUS (CONITEC). https://www.gov.br/conitec

### Prioridade 3 — Internacional (referência)
- **ICHD-3 (International Classification of Headache Disorders)** — International Headache Society, 3ª edição, 2018. https://ichd-3.org
- Critérios diagnósticos usados mundialmente. SBCef adota integralmente.

## Condições cobertas nesta base

| Arquivo | Condição | CID-10 | Evidência |
|---------|----------|--------|-----------|
| `tensional_cronica.json` | Cefaleia tensional crônica | G44.2 | B |
| `enxaqueca_sem_aura.json` | Enxaqueca sem aura | G43.0 | A |
| `enxaqueca_com_aura.json` | Enxaqueca com aura | G43.1 | A |
| `cluster.json` | Cefaleia em salvas (cluster) | G44.0 | A |
| `cefaleia_secundaria.json` | Cefaleia secundária (sinal de alarme) | G44.8 | A |

## Red flags transversais (critérios SNOOP)

Todas as condições desta base compartilham a checagem de red flags. Se qualquer um presente, o sistema emite alerta para investigação adicional — independentemente do score da condição primária:

- **S** — Systemic symptoms (febre, perda de peso)
- **N** — Neurologic signs/symptoms (déficit focal, papiledema)
- **O** — Onset sudden (thunderclap, 100% intensidade em segundos)
- **O** — Older than 50 (primeira crise após 50 anos)
- **P** — Pattern change (mudança do padrão habitual)

Red flags adicionais:
- Cefaleia progressiva ao longo de semanas
- Piora com manobra de Valsalva
- Rigidez de nuca
- Alteração de consciência

## Nota de escopo

Esta base v1.0 cobre **cefaleias primárias comuns + red flags básicos de cefaleia secundária**. Não substitui avaliação neurológica especializada. Casos duvidosos ou persistentes devem ser encaminhados.

## Revisão

Base validada por critérios ICHD-3. Revisão clínica formal pendente de parceria acadêmica (ver docs/compliance/risk-analysis.md).
