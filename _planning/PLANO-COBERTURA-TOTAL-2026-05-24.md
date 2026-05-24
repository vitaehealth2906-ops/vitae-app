# PLANO MESTRE — COBERTURA TOTAL DAS 55 ESPECIALIDADES + 60 ÁREAS DE ATUAÇÃO

> **Autor**: Claude (sessão 24/mai/2026, paciente Lucas Borelli aprovou execução autônoma)
> **Escopo**: backend apenas — ZERO mudança em frontend (app médico, app paciente, pré-consulta, templates, qualquer feature visual). Só o que está atrás do áudio.
> **Aprovação**: aguardando "vai" do Lucas. Após "vai", executo do início ao deploy autônomo, sem pausar, sem perguntar.
> **Este documento é a fonte da verdade durante implementação. Cada arquivo a tocar, cada regra a implementar, cada teste a passar está aqui.**

---

## ÍNDICE

- [PARTE 0 — PRINCÍPIOS NÃO-VIOLÁVEIS](#parte-0)
- [PARTE 1 — INVENTÁRIO COMPLETO 55+60](#parte-1)
- [PARTE 2 — 28 CLUSTERS COMPORTAMENTAIS](#parte-2)
- [PARTE 3 — ARQUITETURA EM 7 CAMADAS](#parte-3)
- [PARTE 4 — PROMPT V4 ADAPTATIVO (TEXTO LITERAL)](#parte-4)
- [PARTE 5 — VALIDADOR PÓS-IA (12 CHECKS)](#parte-5)
- [PARTE 6 — FILTROS DE CADASTRO](#parte-6)
- [PARTE 7 — SEGURANÇA LGPD](#parte-7)
- [PARTE 8 — SUITE DE TESTES (15 CASOS)](#parte-8)
- [PARTE 9 — ORDEM DE IMPLEMENTAÇÃO](#parte-9)
- [PARTE 10 — DEFINIÇÃO DE "PRONTO"](#parte-10)
- [PARTE 11 — DEPLOY](#parte-11)
- [PARTE 12 — ROLLBACK](#parte-12)
- [PARTE 13 — RISCOS E MITIGAÇÕES](#parte-13)
- [PARTE 14 — MONITORAMENTO PÓS-DEPLOY](#parte-14)

---

<a id="parte-0"></a>
## PARTE 0 — PRINCÍPIOS NÃO-VIOLÁVEIS

Estes 12 princípios não podem ser quebrados em momento algum durante a implementação.

1. **ZERO mudança em frontend.** Não toco em nenhum HTML do app médico (`desktop/`), app paciente (`app-v3/`), pré-consulta (`pre-consulta.html`), templates, splash, login, cadastro, ou qualquer outra tela.
2. **ZERO mudança em schema do banco.** Tudo persiste em campos JSON existentes (`summaryJson`, `respostas`). Nenhum `prisma migrate` autônomo. Se algum filtro exigir nova coluna, paro e te aviso.
3. **ZERO uso de `--accept-data-loss`** (regra de ouro pós-incidente 17/abr).
4. **Provenance obrigatória** — toda afirmação rastreada à fonte (áudio P{N} ou cadastro).
5. **Silêncio melhor que invenção** — IA cala quando não sabe.
6. **Fato e hipótese segregados** — hipóteses NÃO entram no áudio.
7. **Red flags nunca somem** — adaptados por especialidade via catálogo.
8. **Banco limpo antes da IA** — filtros prévios.
9. **Médico é juiz** — IA propõe, médico dispõe.
10. **Áudio = cirúrgico**, ~55-78s, sem cara de IA, com marca VITAE institucional.
11. **CFM 2.454/2026** — IA identificada na tela visual + PDF, NÃO no áudio.
12. **Reversibilidade total** — 1 env var (`PROMPT_V4_ENABLED=false`) desliga tudo e volta pro V3 atual em segundos.

---

<a id="parte-1"></a>
## PARTE 1 — INVENTÁRIO COMPLETO

### 55 ESPECIALIDADES MÉDICAS (CFM Resolução 2.221/2018 + atualizações)

1. Acupuntura
2. Alergia e Imunologia
3. Anestesiologia
4. Angiologia
5. Cardiologia
6. Cirurgia Cardiovascular
7. Cirurgia da Mão
8. Cirurgia de Cabeça e Pescoço
9. Cirurgia do Aparelho Digestivo
10. Cirurgia Geral
11. Cirurgia Pediátrica
12. Cirurgia Plástica
13. Cirurgia Torácica
14. Cirurgia Vascular
15. Clínica Médica
16. Coloproctologia
17. Dermatologia
18. Endocrinologia e Metabologia
19. Endoscopia
20. Gastroenterologia
21. Genética Médica
22. Geriatria
23. Ginecologia e Obstetrícia
24. Hematologia e Hemoterapia
25. Homeopatia
26. Infectologia
27. Mastologia
28. Medicina de Emergência
29. Medicina de Família e Comunidade
30. Medicina do Trabalho
31. Medicina do Tráfego
32. Medicina Esportiva
33. Medicina Física e Reabilitação
34. Medicina Intensiva
35. Medicina Legal e Perícia Médica
36. Medicina Nuclear
37. Medicina Preventiva e Social
38. Nefrologia
39. Neurocirurgia
40. Neurologia
41. Nutrologia
42. Oftalmologia
43. Oncologia Clínica
44. Ortopedia e Traumatologia
45. Otorrinolaringologia
46. Patologia
47. Patologia Clínica/Medicina Laboratorial
48. Pediatria
49. Pneumologia
50. Psiquiatria
51. Radiologia e Diagnóstico por Imagem
52. Radioterapia
53. Reumatologia
54. Urologia
55. Cancerologia

### 60 ÁREAS DE ATUAÇÃO (sub-especialidades — agrupadas pra leitura)

**Pediátricas (10):** Cardiologia Pediátrica, Endocrinologia Pediátrica, Gastroenterologia Pediátrica, Hematologia/Hemoterapia Pediátrica, Hepatologia Pediátrica, Infectologia Pediátrica, Nefrologia Pediátrica, Neurologia Pediátrica, Pneumologia Pediátrica, Reumatologia Pediátrica.

**Cirúrgicas (8):** Cirurgia Crânio-Maxilo-Facial, Cirurgia da Coluna, Cirurgia do Ombro e Cotovelo, Cirurgia do Quadril, Cirurgia do Joelho, Cirurgia do Pé e Tornozelo, Cirurgia Videolaparoscópica, Microcirurgia Reconstrutiva.

**Diagnósticas (8):** Citopatologia, Densitometria Óssea, Ecocardiografia, Ecografia Vascular, Hemodinâmica e Cardiologia Intervencionista, Medicina Nuclear (área), Neurofisiologia Clínica, Ultrassonografia.

**Cardiovasculares (4):** Eletrofisiologia Clínica Invasiva, Ergometria, Cardiogeriatria, Cardiologia Intervencionista.

**Cuidados (5):** Medicina Paliativa, Medicina do Sono, Dor (área), Medicina de Urgência, Medicina Hiperbárica.

**Reprodutiva/sexual (4):** Sexologia, Reprodução Humana, Mastologia (área), Medicina Fetal.

**Ocupacionais/Estilo de vida (5):** Medicina Aeroespacial, Medicina do Adolescente, Medicina Tropical, Toxicologia Médica, Nutrição Parenteral e Enteral.

**Outras (16):** Administração em Saúde, Alergia Pediátrica, Angiorradiologia, Cirurgia Bariátrica, Cirurgia do Trauma, Endoscopia Digestiva, Endoscopia Ginecológica, Endoscopia Respiratória, Foniatria, Hansenologia, Hepatologia, Mamografia, Medicina de Família (área), Neonatologia, Oncologia Pediátrica, Psicogeriatria.

**Total: 55 + 60 = 115 entidades cobertas.**

---

<a id="parte-2"></a>
## PARTE 2 — 28 CLUSTERS COMPORTAMENTAIS (a chave da arquitetura)

Em vez de manter config separada pra 115 entidades (manutenção infernal), agrupo elas em **28 clusters comportamentais** — cada cluster compartilha red flags, gaps prioritários e vocabulário.

Cada cluster tem `id`, `nome`, `especialidades` (lista de match), `redFlags`, `gapsPrioritarios`, `vocabulario`, `modoEspecial` (se aplicável).

### Tabela mestre de clusters

| ID | Cluster | Especialidades/áreas que caem aqui (match por nome) |
|----|---------|----------------------------------------------------|
| C01 | **dor_toracica_cardio** | Cardiologia, Cirurgia Cardiovascular, Cardiogeriatria, Cardiologia Intervencionista, Eletrofisiologia, Hemodinâmica, Ecocardiografia, Ergometria |
| C02 | **dor_abdominal_visceral** | Gastroenterologia, Cirurgia do Aparelho Digestivo, Coloproctologia, Cirurgia Bariátrica, Hepatologia, Endoscopia, Endoscopia Digestiva |
| C03 | **dor_osteomuscular** | Ortopedia e Traumatologia, Cirurgia da Mão, Cirurgia Coluna/Quadril/Joelho/Ombro/Pé, Reumatologia, Medicina Esportiva, Medicina Física e Reabilitação |
| C04 | **dor_neuro** | Neurologia, Neurocirurgia, Neurologia Pediátrica, Neurofisiologia Clínica, área Dor |
| C05 | **dermato_lesoes** | Dermatologia, Hansenologia |
| C06 | **respiratorio** | Pneumologia, Pneumologia Pediátrica, Cirurgia Torácica, Endoscopia Respiratória, Foniatria |
| C07 | **endocrino_metabolico** | Endocrinologia, Endocrinologia Pediátrica, Nutrologia, Nutrição Parenteral, Cirurgia Bariátrica |
| C08 | **uro_renal** | Urologia, Nefrologia, Nefrologia Pediátrica, Angiorradiologia |
| C09 | **ginecologia_obstetricia** | Ginecologia e Obstetrícia, Mastologia, Reprodução Humana, Medicina Fetal, Endoscopia Ginecológica |
| C10 | **psiquiatria_saudemental** | Psiquiatria, Medicina do Sono, Psicogeriatria, Foniatria (parcial) |
| C11 | **pediatria_geral** | Pediatria, Medicina do Adolescente, Alergia Pediátrica |
| C12 | **neonatologia** | Neonatologia |
| C13 | **geriatria** | Geriatria, Cardiogeriatria, Psicogeriatria |
| C14 | **oncologia** | Oncologia Clínica, Cancerologia, Radioterapia, Oncologia Pediátrica, Medicina Paliativa |
| C15 | **infecto** | Infectologia, Infectologia Pediátrica, Hansenologia, Medicina Tropical |
| C16 | **hemato** | Hematologia e Hemoterapia, Hematologia/Hemoterapia Pediátrica |
| C17 | **otorrino_voz** | Otorrinolaringologia, Foniatria, Cirurgia de Cabeça e Pescoço |
| C18 | **oftalmo** | Oftalmologia |
| C19 | **alergia_imuno** | Alergia e Imunologia, Alergia Pediátrica |
| C20 | **anestesia_preop** | Anestesiologia, Cirurgia Geral (pré-op), Medicina Hiperbárica |
| C21 | **vascular_perif** | Angiologia, Cirurgia Vascular, Ecografia Vascular |
| C22 | **emergencia_urgencia** | Medicina de Emergência, Medicina de Urgência, Cirurgia do Trauma, Medicina Intensiva |
| C23 | **clinica_geral_familia** | Clínica Médica, Medicina de Família e Comunidade, Medicina Preventiva e Social, Administração em Saúde |
| C24 | **ocupacional_pericia** | Medicina do Trabalho, Medicina do Tráfego, Medicina Legal e Perícia Médica, Medicina Aeroespacial |
| C25 | **diagnostico_imagem_labor** | Radiologia, Patologia, Patologia Clínica, Citopatologia, Densitometria, Ultrassonografia, Mamografia, Medicina Nuclear |
| C26 | **alternativa_integrativa** | Acupuntura, Homeopatia |
| C27 | **plastica_reconstrutiva** | Cirurgia Plástica, Cirurgia Crânio-Maxilo-Facial, Microcirurgia Reconstrutiva |
| C28 | **toxicologia_intoxicacao** | Toxicologia Médica |

**Cluster fallback `C00` = `clinica_geral_familia` (=C23)** — quando nada bate.

### Detalhamento de cada cluster

Estrutura JSON definitiva (vai em `backend/src/services/v4/clusters.json`):

#### C01 — dor_toracica_cardio
```
{
  "id": "C01",
  "nome": "Dor torácica / Cardiovascular",
  "match": ["cardio", "cardiol", "cardíaco", "coração", "hemodinâmica", "eletrofisiologia", "ecocardio", "ergometria"],
  "redFlags": [
    "intensidade da dor (escala 0-10)",
    "duração por episódio",
    "fator esforço/repouso",
    "irradiação verbalizada (braço, mandíbula, pescoço, costas)",
    "sintomas associados (sudorese, náusea, dispneia, síncope, palpitação)"
  ],
  "gapsPrioritarios": [
    "pressão arterial atual",
    "frequência cardíaca",
    "ECG prévio",
    "tabagismo/etilismo",
    "histórico familiar cardiovascular precoce"
  ],
  "vocabulario": ["angina", "pré-cordialgia", "dispneia", "síncope", "claudicação"],
  "modoEspecial": null
}
```

#### C02 — dor_abdominal_visceral
```
{
  "redFlags": ["localização do quadrante", "irradiação (costas, ombro, virilha)", "relação com alimentação", "ritmo intestinal (frequência, consistência, sangue, muco)", "vômito (presença, conteúdo, frequência)"],
  "gapsPrioritarios": ["sinais peritoneais", "icterícia", "perda de peso involuntária", "uso de AINE/álcool", "viagem recente"],
  "vocabulario": ["epigastralgia", "cólica", "tenesmo", "hematêmese", "melena", "esteatorreia"],
  "modoEspecial": null
}
```

#### C03 — dor_osteomuscular
```
{
  "redFlags": ["localização exata", "mecanismo de início (trauma/atraumático)", "fator esforço/repouso", "rigidez matinal e duração", "limitação funcional"],
  "gapsPrioritarios": ["déficit neurológico associado", "edema/calor/eritema local", "história prévia de trauma", "atividade ocupacional/esportiva"],
  "vocabulario": ["lombalgia", "cervicalgia", "ciatalgia", "artralgia", "mialgia", "claudicação neurogênica"],
  "modoEspecial": null
}
```

#### C04 — dor_neuro
```
{
  "redFlags": ["localização (frontal/temporal/occipital/holocraniana)", "intensidade (0-10)", "característica (pulsátil/aperto/em peso)", "fatores desencadeantes/aliviantes", "déficit neurológico associado"],
  "gapsPrioritarios": ["sinais de alarme SNOOP (idade >50, neurológico, início súbito, padrão progressivo)", "uso de analgésico (frequência)", "padrão de sono", "fotofobia/fonofobia"],
  "vocabulario": ["cefaleia", "enxaqueca", "aura", "parestesia", "paresia", "afasia", "ataxia", "tontura rotatória"],
  "modoEspecial": null
}
```

#### C05 — dermato_lesoes
```
{
  "redFlags": ["localização e área aproximada", "tempo de evolução", "prurido (sim/não/noturno)", "fatores ambientais (sol, produto novo, contato)", "lesões similares no passado"],
  "gapsPrioritarios": ["foto da lesão", "história de atopia familiar", "exposição ocupacional/solar", "tratamentos tópicos prévios"],
  "vocabulario": ["mácula", "pápula", "vesícula", "pústula", "escama", "crosta", "liquenificação", "ulceração", "atópico", "eritema"],
  "modoEspecial": null
}
```

#### C06 — respiratorio
```
{
  "redFlags": ["tipo de tosse (seca/produtiva)", "dispneia em decúbito (ortopneia)", "hemoptise", "sibilância", "duração do quadro"],
  "gapsPrioritarios": ["tabagismo (anos-maço)", "exposição ocupacional", "vacinação respiratória recente", "spirometria/RX prévio"],
  "vocabulario": ["dispneia", "ortopneia", "hemoptise", "sibilância", "estridor", "expectoração", "broncoespasmo"],
  "modoEspecial": null
}
```

#### C07 — endocrino_metabolico
```
{
  "redFlags": ["poliúria/polidipsia/polifagia", "perda ou ganho de peso (quanto, em quanto tempo)", "sintomas tireoidianos (calor/frio/tremor/agitação/lentidão)", "fadiga/sonolência diurna"],
  "gapsPrioritarios": ["HbA1c/glicemia recente", "TSH/T4L recente", "perfil lipídico", "circunferência abdominal"],
  "vocabulario": ["poliúria", "polidipsia", "bócio", "hipoglicemia", "cetose", "amenorreia"],
  "modoEspecial": null
}
```

#### C08 — uro_renal
```
{
  "redFlags": ["disúria/polaciúria/urgência", "hematúria visível", "dor lombar (cólica?)", "alteração no jato urinário", "edema MMII/periorbitário"],
  "gapsPrioritarios": ["creatinina/ureia recente", "EAS recente", "PSA (homens >50)", "diabetes/HAS"],
  "vocabulario": ["disúria", "polaciúria", "hematúria", "nictúria", "incontinência", "oligúria", "anúria"],
  "modoEspecial": "sensivel_parcial"
}
```

#### C09 — ginecologia_obstetricia
```
{
  "redFlags": ["DUM (data da última menstruação)", "padrão menstrual (ciclo, fluxo, duração)", "dor pélvica", "sangramento anormal", "secreção vaginal anormal"],
  "gapsPrioritarios": ["paridade (G/P/A)", "uso de contraceptivo", "vida sexual ativa (sim/não)", "última citologia/mamografia"],
  "vocabulario": ["amenorreia", "menorragia", "dispareunia", "leucorreia", "DUM", "menarca", "menopausa"],
  "modoEspecial": "sensivel_parcial"
}
```

#### C10 — psiquiatria_saudemental
```
{
  "redFlags": ["humor predominante (na fala do paciente — palavra literal)", "ideação suicida (se mencionada literal)", "padrão de sono", "uso de substâncias", "duração dos sintomas"],
  "gapsPrioritarios": ["medicações psicotrópicas atuais", "psicoterapia atual ou prévia", "internação psiquiátrica prévia"],
  "vocabulario": ["anedonia", "insônia terminal", "ideação", "ruminação", "compulsão"],
  "modoEspecial": "sensivel"
}
```

#### C11 — pediatria_geral
```
{
  "redFlags": ["febre (temperatura máxima, duração)", "alteração de comportamento (sonolência, irritabilidade)", "ingesta hídrica/alimentar", "eliminações (urina, fezes)", "marcos de desenvolvimento (se idade < 5a)"],
  "gapsPrioritarios": ["calendário vacinal", "peso/altura recente (percentil)", "exposições recentes (creche, doentes)", "amamentação (se lactente)"],
  "vocabulario": ["lactente", "pré-escolar", "escolar", "regurgitação", "cólica do lactente"],
  "modoEspecial": "cuidador"
}
```

#### C12 — neonatologia
```
{
  "redFlags": ["icterícia (dia de vida, zona corporal)", "padrão alimentar", "eliminações (mecônio, urina)", "perda/ganho ponderal", "letargia/hipotonia"],
  "gapsPrioritarios": ["idade gestacional", "tipo de parto", "APGAR", "triagem neonatal (teste do pezinho/orelhinha/coraçãozinho/olhinho)"],
  "vocabulario": ["icterícia neonatal", "RN", "termo/pré-termo", "BPN", "Apgar"],
  "modoEspecial": "cuidador"
}
```

#### C13 — geriatria
```
{
  "redFlags": ["quedas (frequência, mecanismo)", "alteração cognitiva (memória, confusão)", "polifarmácia (≥5 medicamentos)", "incontinência urinária ou fecal", "fragilidade (perda de peso, fadiga, sarcopenia)"],
  "gapsPrioritarios": ["MEEM ou outra avaliação cognitiva", "vacinação (influenza/pneumo/herpes zoster)", "rede de apoio", "atividades de vida diária"],
  "vocabulario": ["sarcopenia", "fragilidade", "delirium", "polifarmácia", "iatrogenia"],
  "modoEspecial": "cuidador_parcial"
}
```

#### C14 — oncologia
```
{
  "redFlags": ["sintomas B (febre, sudorese noturna, perda peso ≥10%)", "dor (localização, intensidade, padrão)", "fadiga", "alteração de funcionamento de órgão", "histórico de neoplasia prévia"],
  "gapsPrioritarios": ["estadiamento atual", "última imagem/marcador tumoral", "esquema terapêutico em curso", "performance status (ECOG/Karnofsky)"],
  "vocabulario": ["neoplasia", "metástase", "estadiamento", "ECOG", "Karnofsky", "QT", "RT", "remissão"],
  "modoEspecial": "sensivel_parcial"
}
```

#### C15 — infecto
```
{
  "redFlags": ["febre (curva, duração)", "fonte presumida (respiratório, urinário, abdominal, pele)", "uso recente de ATB", "viagem recente", "contato com doentes"],
  "gapsPrioritarios": ["hemograma/PCR recente", "calendário vacinal", "sorologia HIV/hepatites se aplicável", "comorbidades imunossupressoras"],
  "vocabulario": ["febre intermitente/contínua/remitente", "exantema", "linfadenopatia", "petéquia", "DST/IST"],
  "modoEspecial": "sensivel_parcial"
}
```

#### C16 — hemato
```
{
  "redFlags": ["sangramento espontâneo (gengival, epistaxe, equimoses)", "palidez/fadiga", "linfadenopatia", "sintomas B", "infecções recorrentes"],
  "gapsPrioritarios": ["hemograma recente", "ferritina/B12/folato", "TP/TTPA", "esplenomegalia"],
  "vocabulario": ["equimose", "petéquia", "linfadenopatia", "esplenomegalia", "anisocitose", "blastos"],
  "modoEspecial": null
}
```

#### C17 — otorrino_voz
```
{
  "redFlags": ["hipoacusia uni ou bilateral", "vertigem (rotatória vs desequilíbrio)", "rouquidão prolongada (>2 semanas)", "obstrução nasal persistente", "epistaxe recorrente"],
  "gapsPrioritarios": ["audiometria recente", "exposição a ruído", "tabagismo (rouquidão)", "trauma craniano prévio"],
  "vocabulario": ["hipoacusia", "vertigem", "zumbido", "disfonia", "disfagia", "odinofagia"],
  "modoEspecial": null
}
```

#### C18 — oftalmo
```
{
  "redFlags": ["perda visual súbita ou progressiva", "dor ocular", "hiperemia conjuntival com fotofobia", "diplopia", "halos coloridos ao redor de luzes"],
  "gapsPrioritarios": ["acuidade visual atual", "uso de óculos/lentes", "diabetes/HAS", "histórico de glaucoma familiar"],
  "vocabulario": ["acuidade visual", "fotofobia", "diplopia", "ambliopia", "glaucoma", "catarata"],
  "modoEspecial": null
}
```

#### C19 — alergia_imuno
```
{
  "redFlags": ["agente desencadeante suspeito", "tipo de reação (cutânea, respiratória, sistêmica, anafilaxia)", "tempo entre exposição e reação", "tratamento usado", "história de anafilaxia prévia"],
  "gapsPrioritarios": ["IgE específica recente", "história familiar de atopia", "outras alergias documentadas", "uso prévio de corticoide/adrenalina"],
  "vocabulario": ["urticária", "angioedema", "anafilaxia", "rinite", "broncoespasmo", "atopia"],
  "modoEspecial": null
}
```

#### C20 — anestesia_preop
```
{
  "redFlags": ["alergias medicamentosas (especialmente anestésicos)", "doenças cardiovasculares (IAM/AVC prévio)", "DPOC/asma", "diabetes (controle)", "anticoagulação"],
  "gapsPrioritarios": ["jejum atual", "última refeição", "última dose de anticoagulante", "via aérea (Mallampati se possível)"],
  "vocabulario": ["pré-operatório", "ASA", "Mallampati", "via aérea difícil"],
  "modoEspecial": null
}
```

#### C21 — vascular_perif
```
{
  "redFlags": ["claudicação intermitente (distância)", "dor em repouso", "alteração de cor/temperatura do membro", "úlceras", "edema (uni vs bilateral)"],
  "gapsPrioritarios": ["pulsos periféricos (se descrito)", "ITB recente", "tabagismo (anos-maço)", "TVP prévia"],
  "vocabulario": ["claudicação", "isquemia", "trombose", "varizes", "úlcera vasculogênica"],
  "modoEspecial": null
}
```

#### C22 — emergencia_urgencia
```
{
  "redFlags": ["dor aguda intensa (>7/10)", "alteração de consciência", "dispneia aguda", "sangramento ativo", "trauma recente"],
  "gapsPrioritarios": ["sinais vitais (PA, FC, FR, SatO2, T)", "glicemia capilar", "ECG", "exame físico dirigido"],
  "vocabulario": ["agudização", "instabilidade hemodinâmica", "rebaixamento de consciência"],
  "modoEspecial": "urgencia"
}
```

#### C23 — clinica_geral_familia (FALLBACK)
```
{
  "redFlags": ["dor (localização, intensidade, duração)", "febre", "perda de peso", "fadiga persistente", "sintomas há mais de 2 semanas"],
  "gapsPrioritarios": ["sinais vitais", "antecedentes pessoais", "última avaliação de rotina", "vacinação atual"],
  "vocabulario": [],
  "modoEspecial": null
}
```

#### C24 — ocupacional_pericia
```
{
  "redFlags": ["exposição ocupacional (agente, tempo, EPI)", "nexo causal com sintoma", "afastamento prévio", "incapacidade funcional (descrição)"],
  "gapsPrioritarios": ["função/cargo atual", "tempo na função", "ASO anteriores", "afastamentos prévios"],
  "vocabulario": ["nexo causal", "incapacidade", "EPI", "ASO", "LER/DORT"],
  "modoEspecial": "pericia"
}
```

#### C25 — diagnostico_imagem_labor
```
{
  "redFlags": ["motivo da solicitação (descrito pelo médico solicitante)", "sintoma relacionado pelo paciente", "alergia a contraste", "claustrofobia (RM)", "gestação"],
  "gapsPrioritarios": ["função renal (se contraste IV)", "TSH (se contraste iodado)", "exames prévios"],
  "vocabulario": [],
  "modoEspecial": "rastreio_ou_solicitado"
}
```

#### C26 — alternativa_integrativa (Acupuntura/Homeopatia)
```
{
  "redFlags": ["queixa principal (literal do paciente, SEM tradução pra alopática)", "tempo de evolução", "tratamentos prévios tentados"],
  "gapsPrioritarios": ["histórico de saúde geral", "padrões emocionais (literal)", "padrões alimentares e de sono"],
  "vocabulario": ["energia", "fluxo", "yin/yang", "meridiano", "miasma", "constituição", "potência"],
  "modoEspecial": "alternativa"
}
```

#### C27 — plastica_reconstrutiva
```
{
  "redFlags": ["motivo (estético/reconstrutivo)", "expectativa do paciente (literal)", "cirurgia prévia na área", "comorbidades (DM, HAS, tabagismo)", "uso de medicação anticoagulante/AAS"],
  "gapsPrioritarios": ["foto pré (se enviada)", "exames pré-op", "BMI", "tabagismo (impacto cicatrização)"],
  "vocabulario": ["lipoaspiração", "abdominoplastia", "rinoplastia", "enxerto", "retalho"],
  "modoEspecial": null
}
```

#### C28 — toxicologia_intoxicacao
```
{
  "redFlags": ["agente suspeito (nome, classe)", "via (oral, inalatória, cutânea, ocular)", "quantidade", "tempo desde exposição", "sintomas iniciais"],
  "gapsPrioritarios": ["uso concomitante de álcool/drogas", "tentativa intencional vs acidental", "tratamento já realizado"],
  "vocabulario": ["intoxicação aguda/crônica", "DL50", "antídoto", "anion gap"],
  "modoEspecial": "urgencia"
}
```

### Modos especiais explicados

| modoEspecial | Comportamento |
|---|---|
| `cuidador` | Áudio começa com "Pré-consulta respondida pelo responsável pelo paciente". Substitui "paciente refere" por "responsável refere". |
| `cuidador_parcial` | Detecta dinamicamente — se paciente respondeu em 1ª pessoa ("eu sinto"), normal; se 3ª pessoa ("ele sente"), aplica `cuidador`. |
| `sensivel` | NÃO lista "Não foi colhido" (paciente pode ter omitido propositalmente). Só cita o que foi colhido. |
| `sensivel_parcial` | Lista "Não foi colhido" reduzida (max 2 itens, só os clinicamente vitais — ex: alergia a contraste em uro). |
| `urgencia` | Áudio cai pra 30s. Estrutura simplificada: identificação + queixa + 1 red flag mais grave + "colher PA/FC/SatO2/glicemia em consulta". |
| `pericia` | Áudio adicional cita nexo causal e descreve incapacidade conforme paciente. Tom mais documental. |
| `rastreio_ou_solicitado` | Pula bloco "queixa principal". Foca em motivo da solicitação + exames prévios + preparo. |
| `alternativa` | Mantém vocabulário do paciente literal (energia, meridiano, miasma). NÃO traduz pra termo alopático. |

---

<a id="parte-3"></a>
## PARTE 3 — ARQUITETURA EM 7 CAMADAS

```
[PIPELINE V4]

  pré-consulta finalizada (status=RESPONDIDA)
      ↓
  ┌───────────────────────────────────────────────────────────┐
  │ CAMADA Z0 — HIGIENIZAÇÃO DE INPUT                        │
  │  filtros de cadastro (M1-M6, veja PARTE 6)               │
  │  • meds com dataFim < hoje                               │
  │  • exames com status=ERRO                                │
  │  • meds lixo (soro fisiológico, sem dose)                │
  │  • idade calculada                                       │
  │  • alergias vazias != "nega"                             │
  │  • hábitos null != "não fuma"                            │
  └───────────────────────────────────────────────────────────┘
      ↓
  ┌───────────────────────────────────────────────────────────┐
  │ CAMADA Z1 — DETECÇÃO DE CLUSTER                          │
  │  1. Match exato no nome do template (regex contra match[])│
  │  2. Match heurístico nas perguntas (palavras-chave)      │
  │  3. Fallback IA Haiku classifica → cluster ID            │
  │  4. Se tudo falha → C23 (clínica_geral)                  │
  └───────────────────────────────────────────────────────────┘
      ↓
  ┌───────────────────────────────────────────────────────────┐
  │ CAMADA Z2 — DETECÇÃO DE MODO                             │
  │  • herda modoEspecial do cluster                         │
  │  • detecta override por contexto:                        │
  │    - idade < 12 ou > 75 → cuidador (se não setado)       │
  │    - paciente respondeu em 3ª pessoa → cuidador          │
  │    - >50% respostas vazias → reforça sensivel             │
  │    - queixa contém "agora/já/forte/emergência" → urgência │
  └───────────────────────────────────────────────────────────┘
      ↓
  ┌───────────────────────────────────────────────────────────┐
  │ CAMADA Z3 — MONTAGEM DO CONTEXTO ESTRUTURADO             │
  │  bloco passado pra IA contém:                            │
  │  • SEÇÃO A — Identificação (do cadastro filtrado)        │
  │  • SEÇÃO B — Respostas do paciente (12 perguntas + áudio)│
  │  • SEÇÃO C — Cadastro filtrado (sem meds vencidos etc.)  │
  │  • SEÇÃO D — Contradições detectadas (algoritmo)         │
  │  • SEÇÃO E — Contexto (template + médico + cluster + modo)│
  │  • SEÇÃO F — Catálogo do cluster (red flags, gaps, vocab)│
  │  • SEÇÃO G — PROIBIDO (campos não disponíveis)           │
  └───────────────────────────────────────────────────────────┘
      ↓
  ┌───────────────────────────────────────────────────────────┐
  │ CAMADA Z4 — GERAÇÃO DO ÁUDIO (PROMPT V4 — veja PARTE 4)  │
  │  • Claude (fallback Gemini se falhar)                    │
  │  • Output: textoVoz + pontos_consolidados + exclusoes +  │
  │    contradicoes + red_flags + nao_capturado +            │
  │    summary_visual (pro JSON do médico)                    │
  └───────────────────────────────────────────────────────────┘
      ↓
  ┌───────────────────────────────────────────────────────────┐
  │ CAMADA Z5 — VALIDADOR PÓS-IA (PARTE 5)                   │
  │  12 checks. Falha → retry com correção apontada.         │
  │  Máx 3 retries. Se persiste → marca REVISAR_MANUAL.      │
  └───────────────────────────────────────────────────────────┘
      ↓
  ┌───────────────────────────────────────────────────────────┐
  │ CAMADA Z6 — TTS (ElevenLabs)                             │
  │  • pré-processa números/datas pra falar limpo            │
  │  • salva MP3 em storage privado (signed URL)             │
  │  • persiste em PreConsulta.audioSummaryUrl               │
  └───────────────────────────────────────────────────────────┘
      ↓
  ┌───────────────────────────────────────────────────────────┐
  │ CAMADA Z7 — PERSISTÊNCIA + AUDITORIA                     │
  │  • salva summaryJson novo (com summary_visual rico)      │
  │  • salva summaryIA (texto) e textoVoz                    │
  │  • mantém summaryIA_v1 antigo num campo paralelo no JSON │
  │  • registra em auditoria_acesso: cluster, modo, retries  │
  └───────────────────────────────────────────────────────────┘
```

### Onde cada camada vive no código

| Camada | Arquivo | Função principal |
|---|---|---|
| Z0 | `backend/src/services/v4/higienizacao.js` (NOVO) | `higienizarCadastro(usuarioId)` |
| Z1 | `backend/src/services/v4/detectorCluster.js` (NOVO) | `detectarCluster(template, perguntas)` |
| Z2 | `backend/src/services/v4/detectorModo.js` (NOVO) | `detectarModo(cluster, paciente, respostas)` |
| Z3 | `backend/src/services/v4/montagemContexto.js` (NOVO) | `montarContexto(pc, paciente, cluster, modo)` |
| Z4 | `backend/src/services/v4/promptV4.js` (NOVO) | `gerarTextoVoz(contexto)` |
| Z5 | `backend/src/services/v4/validador.js` (NOVO) | `validarOutput(output, contexto)` |
| Z6 | `backend/src/services/v4/tts.js` (NOVO, wrap do existente) | `gerarTTSV4(textoVoz)` |
| Z7 | `backend/src/services/v4/persistencia.js` (NOVO) | `persistirV4(pcId, resultado)` |
| Orchestrador | `backend/src/services/v4/pipeline.js` (NOVO) | `executarPipelineV4(preConsultaId)` |
| Feature flag | `backend/src/services/ai.js` (MODIFICA) | `if (process.env.PROMPT_V4_ENABLED === 'true') return executarPipelineV4(...)` |
| Catálogo | `backend/src/services/v4/clusters.json` (NOVO) | dados |

**Total: 9 arquivos novos + 1 modificação cirúrgica em `ai.js`.**

---

<a id="parte-4"></a>
## PARTE 4 — PROMPT V4 ADAPTATIVO (TEXTO LITERAL)

### SYSTEM PROMPT (vai como `system` da API)

```
Voce e o RELATOR CLINICO da plataforma VITAE. Voce relata o que foi capturado na pre-consulta. Voce NAO interpreta, NAO cruza dados pra gerar hipotese, NAO emite juizo clinico. O medico decide.

═══ REGRAS DURAS (zero-tolerancia) ═══

R1. PROIBIDO emitir hipotese diagnostica. Nada de "padrao compativel com", "vale cogitar", "considere", "sugere", "pode indicar", "componente de", "destoa de", "dialoga com".
R2. PROIBIDO emitir conduta. Nada de "descartar", "investigar", "rastrear", "merece avaliacao", "sugiro atencao", "vale a pena".
R3. PROIBIDO hipotese psiquiatrica (ansiedade, estresse, depressao, transtorno) sem o paciente ter falado a palavra LITERALMENTE.
R4. PROIBIDO conectar sintomas independentes. Cada sintoma fica isolado a nao ser que o paciente diga LITERALMENTE que um irradia/causa o outro.
R5. PROIBIDO inferir cronologia/frequencia que nao foi dita.
R6. PROIBIDO suavizar/amplificar linguagem do paciente.
R7. OBRIGATORIO citar red flags fornecidos em SECAO F (cluster-especifico) que estejam presentes nas respostas. Os ausentes nao mencione.
R8. OBRIGATORIO narrar contradicao interna se houver (vem em SECAO D).
R9. OBRIGATORIO sinalizar divergencia cadastro x audio (vem em SECAO D).
R10. OBRIGATORIO consolidar todos os pontos pendentes (contradicoes + divergencias) numa UNICA frase formato "Pontos pra confirmar: (1) X; (2) Y; (3) Z."
R11. OBRIGATORIO terminar com "Nao foi colhido: [no maximo 3 itens da lista gapsPrioritarios da SECAO F]. Fim." — EXCETO se modo=sensivel (omite) ou modo=urgencia (substitui por "Colher PA, FC, SatO2, glicemia em consulta. Fim.") ou modo=rastreio_ou_solicitado (substitui por "Proximos passos sugeridos pelo solicitante: ler na requisicao. Fim.").
R12. OBRIGATORIO comecar com EXATAMENTE: "VITAE Briefing."
R13. Termos mal-transcritos (elticaria/Danvisa/CDB-ol) — usar o termo correto SEM sinalizar no audio. EXCETO se cluster=alternativa_integrativa (manter vocabulario do paciente literal).
R14. PROIBIDO falar "recente" sem data absoluta.
R15. PROIBIDO citar medicamento com dataFim < hoje. Citar uma linha "[Med] descontinuado em [data]" e pronto.
R16. PROIBIDO contar exames status=ERRO como existentes.
R17. PROIBIDO usar lixo do cadastro (Soro Fisiologico como tratamento, plano "piwi") em interpretacao.
R18. PROIBIDO mencionar "IA", "inteligencia artificial", "algoritmo", "sistema", "resumo gerado", "automatizado". Voce e VITAE Briefing, institucional.
R19. HARD LIMIT: textoVoz tem NO MAXIMO 180 palavras (modos padrao/cuidador/pericia/alternativa). NO MAXIMO 90 palavras (modo=urgencia). NO MAXIMO 140 palavras (modo=sensivel). Se passar, voce ESTA FALHANDO. Reescreva mais curto.
R20. Modo=cuidador: trocar TODAS as ocorrencias de "paciente refere/relata/cita" por "responsavel refere/relata/cita". Abertura inclui "Pre-consulta respondida pelo responsavel."

═══ ESTRUTURA FIXA DO textoVoz ═══

Ordem (omite blocos vazios — silencio melhor que invencao):

1. "VITAE Briefing." + (se modo=cuidador) "Pre-consulta respondida pelo responsavel."
2. Identificacao: nome completo, idade, especialidade do template.
3. Queixa principal (1 frase, citacao limpa do audio). EXCETO se modo=rastreio_ou_solicitado (pula).
4. Caracterizacao da queixa: 1 frase juntando OS red flags PRESENTES da SECAO F.
5. Alergias (1 frase, so o que foi dito).
6. Medicamentos: cadastro filtrado em 1 frase. Se descontinuado relevante: 1 linha "[X] descontinuado em [data]".
7. Pontos pra confirmar (CONSOLIDADO): 1 frase numerada (1)(2)(3).
8. Antecedentes + familiar: 1 frase curta. EXCETO se modo=urgencia.
9. Exames concluidos: 1 frase com datas absolutas. EXCETO se modo=urgencia.
10. Fechamento conforme R11.

VOZ: tom profissional institucional. Telegrafico. Sem narrativa fluida.
```

### USER PROMPT (vai como `messages[0].content` da API — montado dinamicamente)

```
[SECAO A — IDENTIFICACAO]
Nome: {paciente.nome}
Idade calculada: {idadeAnos} anos
Sexo: {sexo}
Hoje: {dataHoje}

[SECAO B — RESPOSTAS DO PACIENTE]
{para cada pergunta:}
P{N} [{modo: audio|texto|escala|sim-nao|lista}] "{textoPergunta}":
  {valor}
  {se transcricao original difere: "transcricao original: {original} → normalizado: {normalizado}"}

[SECAO C — CADASTRO PREVIO (filtrado)]
Medicamentos ATIVOS hoje (apos filtro de validade):
  {lista}
Medicamentos DESCONTINUADOS recentemente (dataFim entre hoje-90d e hoje):
  {lista}
Alergias registradas: {lista ou "NENHUMA REGISTRADA NO CADASTRO"}
Cirurgias: {lista}
Historico familiar autorrelatado: {lista}
Exames CONCLUIDOS ultimos 90 dias: {N + datas absolutas}
Exames CONCLUIDOS 91-365 dias: {N + datas}
Exames CONCLUIDOS > 365 dias: {N + datas}

[SECAO D — CONTRADICOES DETECTADAS PELO SISTEMA]
{lista de contradicoes algorítmicas: P{X} vs P{Y}, ou cadastro vs audio}
{se vazia: "Nenhuma contradicao detectada."}

[SECAO E — CONTEXTO]
Template: {template.nome}
Medico solicitante: {medico.nome ou "nao identificado"}
Cluster detectado: {clusterId} — {clusterNome}
Modo detectado: {modo}
Razao da deteccao: {match exato | match heuristico | IA classificou}

[SECAO F — CATALOGO DO CLUSTER]
Red flags obrigatorios (cite os PRESENTES nas respostas, omita os ausentes):
{redFlags formatados como lista numerada}
Gaps prioritarios (escolha ate 3 dos AUSENTES nas respostas pro "Nao foi colhido"):
{gapsPrioritarios formatados}
Vocabulario da especialidade (NAO traduzir/corrigir esses termos):
{vocabulario}

[SECAO G — PROIBIDO]
Nao esta disponivel nesta PC: sinais vitais aferidos (PA, FC, FR, SatO2, T), exame fisico, exames laboratoriais em tempo real, sintomas neurovegetativos nao perguntados.
NUNCA inferir nenhum desses como presente ou ausente.

INSTRUCOES DE PROCESSAMENTO:
A. Aplique as 20 regras duras.
B. Conte palavras do textoVoz antes de enviar. Respeite o HARD LIMIT do R19.
C. Retorne JSON:
{
  "textoVoz": "string MAX {limitePalavras} palavras",
  "palavras_textoVoz": numero exato,
  "pontos_consolidados": ["string", ...],
  "exclusoes_aplicadas": ["string", ...],
  "red_flags_capturados": ["string", ...],
  "nao_capturado": ["string", ...] (max 3, ou [] se modo=sensivel),
  "summary_visual": {
    "queixaPrincipal": "string limpa",
    "tempoEvolucao": "string ou null",
    "intensidade": "string ou null",
    "fatoresAgravantes": "string ou null",
    "fatoresAtenuantes": "string ou null",
    "sintomasAssociados": "string ou null",
    "tratamentoPrevio": "string ou null",
    "antecedentesPessoais": "string ou null",
    "antecedentesFamiliares": "string ou null",
    "habitos": "string ou null",
    "sono": "string ou null",
    "fontePorCampo": {"campo": "audio|formulario|cadastro|null"}
  }
}

Apenas JSON. Sem markdown.
```

### Detecção algorítmica de contradições (alimenta SEÇÃO D)

Implementar em `backend/src/services/v4/detectorContradicoes.js`:

```
detectarContradicoes(respostas, cadastro):
  contradicoes = []

  // 1. Sim/não vs descrição livre
  para cada pergunta tipo "yesno":
    se resposta_yesno = "não" E pergunta_subsequente_descreve_sintoma_relacionado:
      contradicoes.push("P{X}='Nenhuma' vs P{Y}+ descreve sintoma")

  // 2. Med no áudio vs cadastro
  meds_audio = extrair_meds_da_transcricao(audio_p_medicamentos)
  meds_cadastro_ativos = cadastro.meds.filter(ativo && dataFim_ok)
  divergencia_audio_extra = meds_audio.filter(m => not in meds_cadastro)
  divergencia_cadastro_extra = meds_cadastro_ativos.filter(m => not in meds_audio)
  se ambos != []: contradicoes.push("divergencia meds: audio cita {X} nao registrados; cadastro lista {Y} nao citados")

  // 3. Alergia no áudio vs cadastro vazio
  se audio_p_alergias contem urticaria/anafilaxia/etc E cadastro.alergias = []:
    contradicoes.push("cadastro sem alergias mas audio relata {X}")

  // 4. Intensidade alta sem queixa correspondente
  se P_intensidade >= 7 E P_queixa_principal = "Nenhuma"/"Nada":
    contradicoes.push("intensidade 7+ sem queixa principal")

  return contradicoes
```

---

<a id="parte-5"></a>
## PARTE 5 — VALIDADOR PÓS-IA (12 CHECKS)

Implementar em `backend/src/services/v4/validador.js`. Cada check é função booleana que recebe `output` e `contexto`, retorna `{ok: bool, motivo: string}`.

| # | Check | Lógica | Falha → |
|---|---|---|---|
| V1 | Palavras proibidas | Procura "descartar/investigar/rastrear/prescrever/tratar/merece avaliacao/sugiro" no textoVoz. Se modo=alternativa, vocabulário expandido | Retry com aviso "remova palavras proibidas: [lista]" |
| V2 | Hipótese psiquiátrica órfã | Procura "ansiedade/estresse/depressao/transtorno" no textoVoz. Se NÃO está na transcrição literal, falha | Retry com "remova [palavra] — paciente não falou literal" |
| V3 | Red flags presentes citados | Pra cada red flag do cluster.redFlags: se valor extraível das respostas, deve aparecer no textoVoz | Retry com lista de red flags faltando |
| V4 | Contradições narradas | Se context.contradicoes.length > 0, output.pontos_consolidados.length deve ser ≥ length | Retry com "narre as N contradições detectadas" |
| V5 | Hard limit de palavras | output.palavras_textoVoz contado de novo. Se > limite do modo, falha | Retry com "reduza pra MAX X palavras" |
| V6 | Disclaimer institucional | textoVoz começa com "VITAE Briefing." | Retry com "comece com 'VITAE Briefing.'" |
| V7 | Bloco "Não foi colhido" presente | Modos padrão: termina com "Não foi colhido: ... Fim." | Retry com "adicione bloco 'Não foi colhido'" |
| V8 | Med inventado | Pra cada med citado no textoVoz: deve estar em context.cadastro.medsAtivos ou context.respostas.audio | Retry com "remova med não-fonte: [X]" |
| V9 | Data específica em exames | Procura "recente" "antigo" "tempos" sem data. Falha se encontrar | Retry com "use datas absolutas" |
| V10 | Divergência sinalizada | Se context tem divergência cadastro×áudio, textoVoz deve mencionar (busca por "não registrado" ou "não citado") | Retry com "sinalize divergência" |
| V11 | Modo cuidador respeitado | Se modo=cuidador, textoVoz não pode ter "paciente refere/relata/cita" — só "responsável" | Retry com "troque por 'responsável'" |
| V12 | Estrutura JSON válida | Parse JSON. Todos os campos obrigatórios presentes? Tipos certos? | Retry com "retorne JSON conforme schema" |

**Lógica de retry**:
- Máx 3 tentativas
- Cada falha → adiciona ao user prompt: `CORREÇÃO REQUERIDA: [lista de motivos]. Refaça respeitando todas as regras.`
- Se 3 tentativas falharem → output marcado `requer_revisao_manual=true`, salvo no banco, e médico vê alerta na tela visual (sem áudio gerado).

---

<a id="parte-6"></a>
## PARTE 6 — FILTROS DE CADASTRO

Implementar em `backend/src/services/v4/higienizacao.js`.

```
higienizarCadastro(usuarioId, hoje=new Date()):
  paciente = await db.usuario.findUnique({usuarioId, include:{perfilSaude:true}})
  meds = await db.medicamento.findMany({where:{usuarioId}})
  alergias = await db.alergia.findMany({where:{usuarioId}})
  exames = await db.exame.findMany({where:{usuarioId}})

  return {
    identificacao: {
      nome: paciente.nome,
      sexo: paciente.perfilSaude?.genero,
      idadeAnos: calcularIdade(paciente.perfilSaude?.dataNascimento, hoje),
      altura: paciente.perfilSaude?.alturaCm,
      peso: paciente.perfilSaude?.pesoKg
    },
    medsAtivos: meds
      .filter(m => m.ativo)
      .filter(m => !m.dataFim || new Date(m.dataFim) >= hoje)
      .filter(m => !isMedLixo(m.nome))   // soro fisiologico, agua, vitamina sem dose etc
      .filter(m => m.dosagem || isMedSemDoseAceitavel(m.nome)),  // sem dose só passa pra meds onde faz sentido
    medsDescontinuadosRecentes: meds
      .filter(m => m.dataFim && new Date(m.dataFim) < hoje && diffDias(hoje, m.dataFim) <= 90)
      .filter(m => !isMedLixo(m.nome)),
    alergias: alergias.length > 0 ? alergias : null,
    alergiasMarcador: alergias.length === 0 ? "NENHUMA REGISTRADA NO CADASTRO (paciente pode ter alergias nao informadas)" : null,
    cirurgias: paciente.perfilSaude?.cirurgias || [],
    historicoFamiliar: paciente.perfilSaude?.historicoFamiliar || [],
    examesConcluidos: {
      ultimos90d: filtrarExames(exames, 'CONCLUIDO', 0, 90, hoje),
      ate365d: filtrarExames(exames, 'CONCLUIDO', 91, 365, hoje),
      acima365d: filtrarExames(exames, 'CONCLUIDO', 366, null, hoje)
    },
    examesIgnorados: exames.filter(e => e.status !== 'CONCLUIDO').length,
    habitos: {
      fuma: paciente.perfilSaude?.fuma,
      alcool: paciente.perfilSaude?.alcool,
      sono: paciente.perfilSaude?.horasSono,
      atividade: paciente.perfilSaude?.nivelAtividade
    }
  }

isMedLixo(nome):
  lixoExato = ["soro fisiologico", "soro fisiológico", "agua", "água", "vitamina c", "vitamina d"]
  if nome in lixoExato sem dose: return true
  if nome.trim() = "": return true
  if nome.length < 3: return true
  if /^[A-Z]+$/.test(nome) && nome.length > 8: return true  // strings tipo "ASDFGHJK"
  return false

isMedSemDoseAceitavel(nome):
  // suplementos onde "sem dose" é OK
  return ["creatina", "whey protein", "creatina monohidratada"].includes(nome.toLowerCase())
```

---

<a id="parte-7"></a>
## PARTE 7 — SEGURANÇA LGPD

### Storage privado pra novos áudios

`backend/src/services/v4/storageSeguro.js` (NOVO):

```
async uploadAudioSeguro(buffer, fileName, metadata):
  // 1. Upload pro bucket vitae-audio-priv (criar se não existe)
  await supabase.storage.from('vitae-audio-priv').upload(fileName, buffer, {
    contentType: metadata.contentType,
    metadata: { tipo: 'audio_pre_consulta_v4', criado_em: now() }
  })
  // 2. NÃO retorna URL pública — só o path
  return { storagePath: 'vitae-audio-priv/' + fileName }

async gerarSignedUrl(storagePath, expirationMinutes=30):
  const { data, error } = await supabase.storage.from('vitae-audio-priv').createSignedUrl(
    storagePath.replace('vitae-audio-priv/', ''),
    expirationMinutes * 60
  )
  return data.signedUrl
```

Modifica `backend/src/services/ai.js` `gerarAudioElevenLabs`:
- Se feature flag V4 ativa, salva em `vitae-audio-priv` em vez de `vitae`
- Persiste `audioSummaryStoragePath` no `summaryJson.storage_seguro`
- Endpoint novo `GET /pre-consulta/:id/audio-summary` gera signed URL on-demand pra médico ouvir
- **Áudios antigos do bucket `vitae` (público) NÃO são migrados** — seguem como estão (risco R6 documentado)

### Logs limpos

`backend/src/utils/log.js` (NOVO ou modifica existente):
- Função `logSeguro(level, msg, meta)` que **filtra campos sensíveis** antes de logar:
  - Remove: respostas.transcricao, respostas.valor (qualquer key), audioSummaryUrl, audioUrl
  - Mantém: ids, timestamps, status, contadores
- Substitui `console.log` em todo o pipeline V4 por `logSeguro`

### Auditoria de acesso

Já existe tabela `auditoria_acesso`. Adicionar entradas em:
- Cada vez que pipeline V4 roda → entrada tipo `IA_V4_EXECUTADA`, com `recursoTipo=PRECONSULTA`, `recursoId=pcId`, `acao=GERAR_BRIEFING`, `meta={cluster, modo, retries, palavras}`
- Cada vez que médico abre signed URL de áudio → entrada tipo `VIEW_AUDIO_BRIEFING`

---

<a id="parte-8"></a>
## PARTE 8 — SUITE DE TESTES (15 CASOS)

Implementar em `backend/_test-prompt/suite-v4.js`. Cada caso é input sintético + expectativas binárias.

| # | Caso | Cluster | Modo | Expectativas |
|---|---|---|---|---|
| T01 | Lucas Borelli — caso real cardio | C01 | padrão | ✅ Prednisolona descontinuada flag; ✅ contradição P4 narrada; ✅ red flags 8/10 + 20-30min + esforço-repouso; ✅ "VITAE Briefing"; ✅ ≤ 180 palavras |
| T02 | Dermato — manchas no braço | C05 | padrão | ✅ red flags área/evolução/prurido; ✅ vocabulário dermato preservado; ❌ NÃO usa red flags cardio |
| T03 | Pediatria — mãe respondendo por filho 4a | C11 | cuidador | ✅ "responsável refere" 100% das ocorrências; ✅ abertura "Pré-consulta respondida pelo responsável"; ✅ red flags peds (febre, ingesta) |
| T04 | Check-up adulto sem queixa | C23/rastreio | rastreio | ✅ pula bloco queixa; ✅ foco em antecedentes/exames; ✅ "Próximos passos sugeridos pelo solicitante" no fim |
| T05 | Psiquiatria — paciente parco | C10 | sensível | ✅ "Não foi colhido" OMITIDO; ✅ não menciona "ansiedade" se paciente não falou |
| T06 | UPA — dor torácica aguda 9/10 | C22 | urgência | ✅ ≤ 90 palavras; ✅ termina "colher PA/FC/SatO2/glicemia em consulta"; ✅ sem bloco antecedentes |
| T07 | Acupuntura — "energia parada no fígado" | C26 | alternativa | ✅ vocabulário do paciente preservado literal; ✅ NÃO traduz pra alopático |
| T08 | Geriatria — paciente 82a com 8 meds | C13 | cuidador_parcial | ✅ red flags geriatria (quedas, cognição, polifarmácia); ✅ se detector dispara cuidador, áudio adapta |
| T09 | Ginecologia — DUM relatada | C09 | sensível_parcial | ✅ cita DUM; ✅ "Não foi colhido" reduzido a max 2 itens |
| T10 | Oncologia — paciente em QT | C14 | sensível_parcial | ✅ red flags sintomas B; ✅ vocabulário onco preservado |
| T11 | Template "Avaliação Geral" sem nome de especialidade | C23 (fallback) | padrão | ✅ usa clinica_geral; ✅ funciona sem erro |
| T12 | Cadastro com Prednisolona vencida + 11 exames ERRO | qualquer | qualquer | ✅ Prednisolona aparece só como descontinuada; ✅ exames ERRO ignorados; ✅ exames CONCLUIDOS citados com data |
| T13 | Paciente jovem com histórico familiar de depressão (caso Lucas) | C01 | padrão | ❌ NUNCA cita "componente ansioso/estresse"; ✅ histórico familiar listado factual |
| T14 | Áudio com termos errados (elticaria/Danvisa) | qualquer | qualquer | ✅ usa "urticária"/"Anvisa" no textoVoz SEM sinalizar |
| T15 | Detector retry — IA gera com palavra proibida na 1ª, corrige na 2ª | C01 | padrão | ✅ retry funciona; ✅ máx 3 tentativas; ✅ se persiste, marca REVISAR_MANUAL |

### Comando único pra rodar suite

`npm run test:v4` (adicionar ao package.json):
- Executa todos os 15 casos
- Gera relatório `_test-prompt/relatorio-suite-v4-{timestamp}.md` com:
  - Para cada caso: input + output + expectativas marcadas ✅/❌
  - Score geral (X/15)
  - Lista de falhas com motivo
- Suite passa se **15/15** verdes. < 15 → não deploya, investigo o porquê.

---

<a id="parte-9"></a>
## PARTE 9 — ORDEM DE IMPLEMENTAÇÃO (sequência atômica)

**Cada step abaixo é commit independente. Não pulo step. Se um falhar, paro e investigo (não invento solução).**

### BLOCO 1 — Catálogo + filtros (zero IA)
1. **STEP 01** — Criar `backend/src/services/v4/clusters.json` com 28 clusters detalhados (PARTE 2)
2. **STEP 02** — Criar `backend/src/services/v4/higienizacao.js` (PARTE 6)
3. **STEP 03** — Criar `backend/src/services/v4/detectorCluster.js` (PARTE 3 Z1)
4. **STEP 04** — Criar `backend/src/services/v4/detectorModo.js` (PARTE 3 Z2)
5. **STEP 05** — Criar `backend/src/services/v4/detectorContradicoes.js` (PARTE 4)
6. **STEP 06** — Testes unitários em `_test-prompt/unit-deteccao.js`: rodar Z1+Z2+Z3 em 15 templates diferentes e validar match correto

### BLOCO 2 — Prompt + IA
7. **STEP 07** — Criar `backend/src/services/v4/montagemContexto.js` (PARTE 3 Z3)
8. **STEP 08** — Criar `backend/src/services/v4/promptV4.js` (PARTE 4 — system + user)
9. **STEP 09** — Criar `backend/src/services/v4/validador.js` com os 12 checks (PARTE 5)
10. **STEP 10** — Rodar T01 (caso Lucas) manualmente, comparar com baseline V3, ajustar

### BLOCO 3 — TTS + Storage + Persistência
11. **STEP 11** — Criar `backend/src/services/v4/storageSeguro.js` (PARTE 7) — incluindo criação do bucket privado `vitae-audio-priv` no Supabase via SDK
12. **STEP 12** — Criar `backend/src/services/v4/tts.js` (wrap do `gerarAudioElevenLabs` existente + pré-processamento de números/datas)
13. **STEP 13** — Criar `backend/src/services/v4/persistencia.js`
14. **STEP 14** — Criar endpoint novo `GET /pre-consulta/:id/audio-summary` que gera signed URL on-demand

### BLOCO 4 — Pipeline + Feature Flag
15. **STEP 15** — Criar `backend/src/services/v4/pipeline.js` orchestrando Z0→Z7
16. **STEP 16** — Modificar `backend/src/services/ai.js` `gerarSummary` pra checar `process.env.PROMPT_V4_ENABLED === 'true'` e desviar pro pipeline V4
17. **STEP 17** — Modificar `backend/src/routes/pre-consulta.js` finalizacao: tudo continua igual, só o serviço chamado adicionou desvio

### BLOCO 5 — Suite de testes
18. **STEP 18** — Implementar 15 casos da suite em `_test-prompt/suite-v4.js`
19. **STEP 19** — Rodar suite completa. Esperado: 15/15 ✅. Se < 15, investigo cada falha e ajusto.

### BLOCO 6 — Reprocessamento (opcional, autorizado se Lucas disser S)
20. **STEP 20** — Script `backend/scripts/reprocessar-pcs-v4.js` que:
    - Pega todas PCs com `respostas != null && transcricao != null && summaryIA != null`
    - Pra cada uma: roda pipeline V4
    - Salva resultado em `summaryJson.v4 = {...}` (campo paralelo)
    - **NÃO sobrescreve** `summaryIA`/`textoVoz` originais
    - Gera relatório comparativo

### BLOCO 7 — Deploy
21. **STEP 21** — Commit final + push pro main
22. **STEP 22** — Aguardar Railway deployar (auto)
23. **STEP 23** — Smoke test pós-deploy: GET /health → 200, e simular 1 PC nova end-to-end (manual)
24. **STEP 24** — Habilitar feature flag em Railway: `PROMPT_V4_ENABLED=true`
25. **STEP 25** — Validação final: gerar 1 PC nova em produção, ouvir áudio, comparar com expectativa

### BLOCO 8 — Monitoramento (24-48h)
26. **STEP 26** — Adicionar monitoramento em `auditoria_acesso` pra rastrear:
    - Quantas PCs rodaram V4
    - Quantos retries em média
    - Quantas marcaram REVISAR_MANUAL
    - Distribuição de clusters detectados
27. **STEP 27** — Documentar em `_planning/POS-DEPLOY-V4-2026-05-24.md` resultados das primeiras 48h

---

<a id="parte-10"></a>
## PARTE 10 — DEFINIÇÃO DE "PRONTO"

**Só chamo "feito" quando TODOS estes 14 critérios estão ✅:**

| # | Critério | Como verifico |
|---|---|---|
| D1 | Catálogo de 28 clusters criado e validado | Abrir clusters.json, contar 28 entradas, cada uma com schema completo |
| D2 | Detector Z1 acerta 13/15 templates em teste sintético | Rodar unit-deteccao.js |
| D3 | Filtros Z0 funcionam em 3 PCs reais (Lucas, Daniel, Alvaro) | Rodar pipeline em modo dry-run e inspecionar saída |
| D4 | Prompt V4 + validador rejeitam outputs ruins em ≥80% dos casos sintéticos negativos | Suite de testes |
| D5 | Suite de 15 testes passa 15/15 | npm run test:v4 |
| D6 | Storage privado funcional (upload + signed URL) | Smoke test isolado |
| D7 | Endpoint signed URL responde HTTP 200 com URL válida | Curl pós-deploy |
| D8 | Pipeline end-to-end roda em <30s pra PC média | Métrica do step 25 |
| D9 | Feature flag desabilitada (PROMPT_V4_ENABLED=false) faz cair no V3 sem erro | Smoke test |
| D10 | Endpoints existentes não quebraram | Suite de regressão (rodar smoke-master.js existente) |
| D11 | Deploy Railway OK + health endpoint 200 | Curl pós-deploy |
| D12 | 1 PC nova gerada em prod com V4 e validada manualmente | Eu mesmo simulo, ouço o áudio, comparo |
| D13 | Áudio começa com "VITAE Briefing" — não "Resumo por IA" | Ouvir o MP3 |
| D14 | Nenhuma PC em prod foi corrompida (summaryIA antigo preservado em campo paralelo) | Query no banco verificando que summaryIA_legacy existe em todas que foram reprocessadas |

**Se ANY um falhar: marco como não-pronto, te aviso, continuo trabalhando.**

---

<a id="parte-11"></a>
## PARTE 11 — DEPLOY

### Pré-deploy (no PC local)
1. `cd backend && node --check src/services/v4/*.js src/services/ai.js src/routes/pre-consulta.js` — todos OK
2. `cd backend && npm run test:v4` — 15/15 ✅
3. Git status limpo + commit + push

### Deploy Railway (auto)
- Railway detecta push, builda, deploya em ~3-5 min
- Vou monitorar logs via `railway logs --tail` se acessível, ou via dashboard

### Env vars novas no Railway (eu seto via CLI ou peço pra Lucas)
- `PROMPT_V4_ENABLED=false` (deploy em dark launch — não ativa pra produção real ainda)
- `V4_BUCKET_PRIVADO=vitae-audio-priv` (nome do bucket privado)
- Demais (ANTHROPIC_API_KEY, OPENAI_API_KEY, ELEVENLABS_API_KEY, DATABASE_URL) já existem

### Bucket privado no Supabase
- Criar via SDK no STEP 11 OU via Supabase Dashboard manualmente se SDK não der
- Permissões: somente service_role lê/escreve. Anon NEGADO.

### Cutover (ativar V4 pra produção)
- Após STEP 25 validar, eu seto `PROMPT_V4_ENABLED=true` no Railway
- Railway redeploya automático
- Próxima PC respondida já roda V4
- Médico recebe áudio novo

---

<a id="parte-12"></a>
## PARTE 12 — ROLLBACK

**Cenário 1 — V4 saiu defeituoso em produção**:
1. Railway → Environment Variables → `PROMPT_V4_ENABLED=false`
2. Railway redeploya em ~1 min
3. Pipeline volta pro V3 atual
4. PCs já geradas com V4 ficam intactas (não precisam ser regeneradas — médico só vê o output V4 antigo que já tá no banco)

**Cenário 2 — V4 corrompeu PCs antigas (reprocessamento errado)**:
1. Reprocessamento NÃO sobrescreve campo original — sempre adiciona em `summaryJson.v4`
2. Se algo der errado, rodar script `restaurar-original.js` que deleta o sub-campo `v4` do summaryJson
3. Médico volta a ver V3 original

**Cenário 3 — Storage privado quebrou e médicos não ouvem áudio**:
1. Áudios antigos (em bucket público) seguem funcionando
2. PCs novas geradas em V4 com áudio em bucket privado: endpoint `GET /pre-consulta/:id/audio-summary` falhando
3. Fallback: temporariamente fazer pipeline V4 cair pra bucket público enquanto investigo
4. Setar `V4_STORAGE_FALLBACK_PUBLICO=true` (env var nova)

**Cenário 4 — Custo Anthropic disparou**:
- Validador V5 (hard limit palavras) reduz output
- Retry máx 3 vezes (não loops infinitos)
- Se ainda assim cresce demais, desabilitar V4 e investigar

**Cenário 5 — Deploy quebrou backend inteiro**:
- Railway tem rollback nativo: dashboard → Deployments → versão anterior → "Rollback to this deployment"
- Backup tag git criada antes do push (`pre-v4-2026-05-24`)

---

<a id="parte-13"></a>
## PARTE 13 — RISCOS E MITIGAÇÕES

| # | Risco | Prob | Impacto | Mitigação |
|---|---|---|---|---|
| RA | Catálogo de cluster sub-cobre especialidade rara | Média | Médio | Fallback automático pra C23. Adicionar novos clusters = 5 min |
| RB | Detector Z1 erra cluster (heurística falha) | Média | Médio | 3 etapas em cascata (exato→heurística→IA). Log do que decidiu pra eu auditar depois |
| RC | Validador rejeita output legítimo (false positive) | Média | Alto | Cada check tem motivo claro no retry. Máx 3. Persistente → REVISAR_MANUAL não áudio quebrado |
| RD | IA não cumpre regras (LLM não-determinístico) | Alta | Médio | Validador pega 80%+. Resto vira REVISAR_MANUAL |
| RE | Storage privado quebra produção | Baixa | Alto | Fallback env var. Áudios antigos seguem em bucket público |
| RF | Custo Claude API sobe demais | Média | Baixo | Hard limit palavras + max retries. Monitorar custo nas primeiras 48h |
| RG | Reprocessar 24 PCs antigas corrompe summaryIA original | Baixa | Crítico | Nunca sobrescreve — só adiciona em campo paralelo `summaryJson.v4` |
| RH | Médico estranha o áudio novo | Média | Médio | Documento "antes vs depois" pra você mostrar; áudios antigos continuam acessíveis |
| RI | Modo cuidador detecta errado (criança que respondeu sozinha) | Baixa | Médio | Default seguro: idade < 12 = cuidador. Médico vê na tela visual |
| RJ | Modo sensível omite gap clinicamente vital | Baixa | Alto | Lista restrita: só psiq + sexo. Outros caem em sensivel_parcial (max 2 gaps) |
| RK | Cluster alternativa preserva termo perigoso ("megadose vitamina C") | Baixa | Médio | Validador faz check extra: termos de alta dose ainda passam por R7 (red flag obrigatório). Médico vê |
| RL | Endpoint signed URL gera URL expirada na hora do médico ouvir | Baixa | Médio | Expiração 30 min, com auto-renovação se médico clicar de novo |
| RM | Cluster pediatria erra pra adolescente 13a | Baixa | Baixo | Idade > 12 não vira cuidador automático — depende do template |
| RN | Suite de teste passa mas produção comporta diferente | Média | Alto | Caso T01 usa dado real do banco — produção≅teste |
| RO | Race condition pipeline V4 + V3 rodando paralelo | Baixa | Crítico | Feature flag é checada uma vez no início da função. Sem corrida |

---

<a id="parte-14"></a>
## PARTE 14 — MONITORAMENTO PÓS-DEPLOY

Nas primeiras **48h após cutover**, vou rodar query SQL toda 2h pra acompanhar:

```sql
-- distribuição de clusters detectados
SELECT meta->>'cluster' AS cluster, COUNT(*) FROM auditoria_acesso
WHERE acao='GERAR_BRIEFING' AND criado_em > NOW() - INTERVAL '48 hours'
GROUP BY 1 ORDER BY 2 DESC;

-- taxa de retry
SELECT
  AVG((meta->>'retries')::int) as retries_medio,
  MAX((meta->>'retries')::int) as retries_max,
  COUNT(*) FILTER (WHERE meta->>'requer_revisao_manual'='true') as revisao_manual
FROM auditoria_acesso
WHERE acao='GERAR_BRIEFING' AND criado_em > NOW() - INTERVAL '48 hours';

-- duração média do áudio (palavras)
SELECT AVG((meta->>'palavras')::int) FROM auditoria_acesso
WHERE acao='GERAR_BRIEFING' AND criado_em > NOW() - INTERVAL '48 hours';
```

Alertas pra eu agir:
- Retries médios > 1.5 → ajustar prompt
- Revisão manual > 10% → investigar caso por caso
- Palavras médias > 200 → revisar hard limit no prompt
- Cluster `desconhecida` > 5% → adicionar especialidades ao catálogo

---

## RESUMO EXECUTIVO

**Vai mudar frontend?** NÃO. Zero arquivo em `desktop/`, `app-v3/`, `pre-consulta.html`, `templates`, `*.html` tocado.

**Arquivos novos (todos no backend)**: 11
**Arquivos modificados (backend)**: 2 (`ai.js` desvio + `pre-consulta.js` se necessário)
**Schema do banco**: 0 mudanças (tudo em campos JSON existentes)
**Migrations**: 0
**Env vars novas**: 2 (`PROMPT_V4_ENABLED`, `V4_BUCKET_PRIVADO`)
**Bucket Supabase novo**: 1 (`vitae-audio-priv`)
**Suite de testes**: 15 casos, exige 15/15 verde antes do deploy
**Tempo estimado de implementação**: 5-7h autônomas
**Reversibilidade**: 1 env var desliga tudo
**Cobertura**: 55 especialidades + 60 áreas = 115 entidades, agrupadas em 28 clusters comportamentais
