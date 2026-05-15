# Manual de Features Especiais vita id

> **Documento mestre 3 de 3** da serie de manuais tecnicos do vita id.
>
> - `MANUAL-BACKEND-COMPLETO.md` (94 KB) — rotas, schema, servicos, prompts literais
> - `MANUAL-APP-ANTIGO-USO-BACKEND.md` (58 KB) — tela-por-tela, jornadas, api.js
> - **`MANUAL-FEATURES-ESPECIAIS.md` (este) — mecanicas internas, formulas exatas, algoritmos, heuristicas, decisoes sutis, pegadinhas, edge cases**
>
> Foco: o "como" e o "por que" das features que NAO sao obvias lendo o codigo. Tudo aqui foi extraido lendo o codigo real arquivo por arquivo. Quando algo nao foi encontrado, esta marcado como "nao encontrado".
>
> Audiencia: o Claude que vai reescrever essas features no app v3. Pressuposto: Claude le isso e nao precisa abrir os arquivos pra entender o que esta acontecendo.

---

## Indice

1. Calculo do Score 0-100 (formula exata, 4 pilares, bonus/malus, confianca)
2. Cruzamento alergia x medicamento (CMED, 23 classes farmacologicas, sinonimos)
3. Pipeline Upload de Exame (Claude Vision + OCR estruturado + analise)
4. Scan de Receita (Gemini Vision + Whisper fallback)
5. Pre-consulta vita id - Pipeline completo (V4 hibrido)
6. Anamnese estruturada (11 campos clinicos)
7. Padroes Observados v2 (multi-agente)
8. Metricas honestas do medico (Sessao 22)
9. QR Code + RG publico + Autorizacao
10. Lembretes de medicamento (30-lembretes.html)
11. Detector in-app browser (WhatsApp/IG/FB)
12. Wake Lock + Visibilitychange + iOS Safari
13. Sanitizacao XSS
14. Refresh token rotativo
15. Google Sign-In
16. Pseudonimizacao LGPD
17. Workers assincronos (TarefaPendente)
18. CORS exato
19. Compressao de fotos
20. Padroes de UI/UX
21. Analise prosodica (CFM 2.314/2022)
22. IA Collab (comparativo entre consultas)

---

## 1. Calculo do Score 0-100 (formula exata)

> Arquivo: `backend/src/services/score-engine.js` (215 linhas)
>
> Entry point: `calcularScores(userId)`.
>
> Persiste em: `HealthScore` (mas o calculo retorna o objeto e quem chama decide se salva).

### 1.1 Helpers fundamentais

```javascript
// score-engine.js:11-14
function mapear1a5para20a100(valor) {
  if (valor == null || valor < 1 || valor > 5) return null;
  return 20 + (valor - 1) * 20;
}
```

**Tradutor Likert 1-5 -> escala 20/40/60/80/100:**

| Likert | Score |
|--------|-------|
| 1 | 20 |
| 2 | 40 |
| 3 | 60 |
| 4 | 80 |
| 5 | 100 |

Pegadinha: NAO e 0/25/50/75/100 como o requisito do pedido sugere — o codigo usa formula `20 + (v-1)*20`. Logo 1=20 (nao 0). Isso significa que mesmo paciente que respondeu "horrivel" em tudo ja tem score base 20 (zero so se NAO houver resposta).

```javascript
// score-engine.js:22-25
function clamp(valor) {
  if (valor == null) return null;
  return Math.max(0, Math.min(100, Math.round(valor)));
}
```

Clamp 0-100 + arredondamento ao final de cada pilar.

```javascript
// score-engine.js:16-20
function media(valores) {
  const validos = valores.filter((v) => v != null);
  if (validos.length === 0) return null;
  return validos.reduce((a, b) => a + b, 0) / validos.length;
}
```

Media so de valores NAO-null. Se ninguem reportou, retorna null (pilar fica indisponivel).

### 1.2 Pilar Sono (peso 20%)

```javascript
// score-engine.js:43-67
function calcularScoreSono(checkinRecente, perfil, parametrosExames) {
  const pontos = [];
  let bonus = 0;

  if (checkinRecente && checkinRecente.sonoQualidade != null) {
    pontos.push(mapear1a5para20a100(checkinRecente.sonoQualidade));
  }

  if (perfil && perfil.horasSono != null) {
    const horas = parseFloat(perfil.horasSono);
    if (horas >= 7 && horas <= 8) bonus = 10;
    else if (horas < 6) bonus = -10;
    else if (horas > 9) bonus = -5;
  }

  if (parametrosExames.length > 0) {
    const cortisol = parametroNormal(parametrosExames, ['cortisol']);
    if (cortisol === true) bonus += 5;
    else if (cortisol === false) bonus -= 5;
  }

  const baseSono = media(pontos);
  if (baseSono == null) return { score: null, fatores: [] };
  return { score: clamp(baseSono + bonus), fatores: [] };
}
```

**Entradas:**
- `checkinRecente.sonoQualidade` (Likert 1-5) -> vira ponto base.
- `perfil.horasSono` (string parseFloat) -> vira bonus/malus:
  - 7-8h: **+10** (faixa otima)
  - <6h: **-10** (privacao)
  - >9h: **-5** (hipersonia)
- Cortisol normal em exames: **+5** | anormal: **-5**

**Pegadinha:** so o `sonoQualidade` entra como ponto base. As horas e o cortisol sao APENAS bonus/malus aplicados em cima. Se paciente nunca fez check-in (sem `sonoQualidade`), retorna `null` mesmo com perfil rico. **Pilar so existe se houver Likert.**

**Edge case:** se `sonoQualidade=1` (Likert minimo, base 20) e horas=7-8h, score final = 20+10 = 30. Se sonoQualidade=5 e horas<6h, score = 100-10 = 90.

### 1.3 Pilar Atividade (peso 20%)

```javascript
// score-engine.js:69-96
function calcularScoreAtividade(checkinRecente, perfil, parametrosExames) {
  const pontos = [];
  let bonus = 0;

  if (checkinRecente && checkinRecente.atividadeFisica) {
    const mapAtividade = { nenhuma: 25, leve: 50, moderada: 75, intensa: 95 };
    const scoreCheckin = mapAtividade[checkinRecente.atividadeFisica.toLowerCase()];
    if (scoreCheckin != null) pontos.push(scoreCheckin);
  }

  if (perfil && perfil.nivelAtividade) {
    const mapNivel = { sedentario: 30, leve: 50, moderado: 70, ativo: 85, muito_ativo: 95 };
    const scorePerfil = mapNivel[perfil.nivelAtividade.toLowerCase()];
    if (scorePerfil != null) pontos.push(scorePerfil);
  }

  if (perfil && perfil.pesoKg && perfil.alturaCm) {
    const alturaM = Number(perfil.alturaCm) / 100;
    const imc = Number(perfil.pesoKg) / (alturaM * alturaM);
    if (imc >= 18.5 && imc <= 24.9) bonus += 5;
    else if (imc >= 25 && imc <= 29.9) bonus -= 3;
    else if (imc > 30) bonus -= 5;
  }

  const baseAtividade = media(pontos);
  if (baseAtividade == null) return { score: null, fatores: [] };
  return { score: clamp(baseAtividade + bonus), fatores: [] };
}
```

**Mapa Check-in semanal (atividadeFisica string):**
| Valor | Score |
|---|---|
| nenhuma | 25 |
| leve | 50 |
| moderada | 75 |
| intensa | 95 |

**Mapa Perfil (nivelAtividade string):**
| Valor | Score |
|---|---|
| sedentario | 30 |
| leve | 50 |
| moderado | 70 |
| ativo | 85 |
| muito_ativo | 95 |

Os dois sao MEDIADOS (media aritmetica) se ambos existirem.

**Bonus/malus por IMC:** calculo classico `peso / altura_metros^2`
- 18.5-24.9 (normal): **+5**
- 25-29.9 (sobrepeso): **-3**
- ≥30 (obesidade): **-5**

Faixas IMC <18.5 (baixo peso) NAO recebem malus — decisao de design (paciente abaixo do peso ja tem outros indicadores).

### 1.4 Pilar Produtividade (peso 20%)

```javascript
// score-engine.js:98-114
function calcularScoreProdutividade(checkinRecente) {
  let scoreProd = null;
  let scoreHumor = null;

  if (checkinRecente) {
    if (checkinRecente.produtividade != null) scoreProd = mapear1a5para20a100(checkinRecente.produtividade);
    if (checkinRecente.humor != null) scoreHumor = mapear1a5para20a100(checkinRecente.humor);
  }

  if (scoreProd == null && scoreHumor == null) return { score: null, fatores: [] };

  let base;
  if (scoreProd != null && scoreHumor != null) base = scoreProd * 0.6 + scoreHumor * 0.4;
  else base = scoreProd || scoreHumor;

  return { score: clamp(base), fatores: [] };
}
```

**Pondera dois Likerts:**
- Produtividade: peso 60%
- Humor: peso 40%

Se so um dos dois esta presente, usa ele direto (sem ponderacao).

**Pegadinha:** pilar inteiro depende SO de check-in semanal. Sem check-in = pilar `null`. Nao tem fallback no perfil.

### 1.5 Pilar Exames (peso 40% — MAIOR PESO)

```javascript
// score-engine.js:116-146
function calcularScoreExame(examesRecentes) {
  if (!examesRecentes || examesRecentes.length === 0) {
    return { score: null, fatores: [] };
  }

  let totalNormal = 0, totalAtencao = 0, totalCritico = 0;

  for (const exame of examesRecentes) {
    const parametros = exame.parametros || [];
    for (const param of parametros) {
      const c = (param.classificacao || param.status || '').toUpperCase();
      if (c === 'NORMAL') totalNormal++;
      else if (c === 'ATENCAO') totalAtencao++;
      else if (c === 'CRITICO') totalCritico++;
    }
  }

  const total = totalNormal + totalAtencao + totalCritico;
  if (total === 0) return { score: null, fatores: [] };

  let score = (totalNormal * 100 + totalAtencao * 50 + totalCritico * 10) / total;

  const agora = Date.now();
  const temRecente = examesRecentes.some((e) => {
    const d = e.dataExame || e.criadoEm;
    return d && (agora - new Date(d).getTime() < SEIS_MESES_MS);
  });
  if (temRecente) score += 5;

  return { score: clamp(score), fatores: [] };
}
```

**Formula exata:**

```
score_base = (NORMAL × 100 + ATENCAO × 50 + CRITICO × 10) / total_parametros
score_final = score_base + (5 se algum exame <=6 meses)
```

Cada parametro de cada exame (Hemoglobina, Glicose, TSH, Colesterol, etc) entra como 1 unidade. Sao classificados pela IA (Claude Sonnet) como NORMAL/ATENCAO/CRITICO.

**Bonus recencia:** +5 se pelo menos UM exame tem `dataExame` ou `criadoEm` dentro dos ultimos 180 dias (6 meses).

**Constante:**
```javascript
// score-engine.js:9
const SEIS_MESES_MS = 6 * 30 * 24 * 60 * 60 * 1000;
```

**Pegadinha:** o calculo agrega TODOS os parametros de TODOS os exames buscados — `take: 10` no findMany (linha 158). Logo, se paciente tem 10 exames com 8 parametros cada = 80 unidades no calculo. Um exame antigo "ruim" puxa media pra baixo mesmo se exame recente esta otimo.

**Exemplo:** 8 parametros NORMAL + 1 ATENCAO + 1 CRITICO = (800+50+10)/10 = 86 + 5 (recencia) = 91.

### 1.6 Score Geral (media ponderada)

```javascript
// score-engine.js:185-198
const pilares = [
  { score: r4.score, pesoBase: 0.40 },  // Exames
  { score: r1.score, pesoBase: 0.20 },  // Sono
  { score: r2.score, pesoBase: 0.20 },  // Atividade
  { score: r3.score, pesoBase: 0.20 },  // Produtividade
];

const disponiveis = pilares.filter((p) => p.score != null);
let scoreGeral = null;

if (disponiveis.length > 0) {
  const pesoTotal = disponiveis.reduce((s, p) => s + p.pesoBase, 0);
  scoreGeral = clamp(disponiveis.reduce((s, p) => s + p.score * (p.pesoBase / pesoTotal), 0));
}
```

**Logica crucial:** se algum pilar e `null` (faltou dado), os pesos sao **REDISTRIBUIDOS** proporcionalmente. Exemplo:

Paciente so tem exames (sem check-in):
- Exames 40% / 40% = 100% do peso
- Score Geral = score de exames

Paciente tem exames + sono mas nao tem atividade nem produtividade:
- Exames 40% / 60% = 66.7%
- Sono 20% / 60% = 33.3%

Por isso paciente novo (so exames) NAO fica com score "baixo por falta de dados". O sistema usa o que tem.

### 1.7 Confianca (baixa/media/alta)

```javascript
// score-engine.js:200-202
const confianca =
  exames.length >= 3 && checkins.length >= 3 ? 'alta' :
  exames.length >= 2 && checkins.length >= 2 ? 'media' : 'baixa';
```

**Regras:**
| Confianca | Exames | Check-ins |
|---|---|---|
| **alta** | >=3 | >=3 |
| **media** | >=2 | >=2 |
| **baixa** | qualquer outro caso |

Pegadinha: confianca exige AMBOS (exames E check-ins). Paciente com 10 exames mas zero check-in = `baixa`.

### 1.8 Idade biologica (fora do score-engine)

> Arquivo: `backend/src/services/ai.js:288-385` — funcao `calcularIdadeBiologica`
>
> Nao usa `score-engine.js`. Usa LLM (Claude Opus 4) com metodologia PhenoAge/GrimAge.

Entradas:
- `idadeCronologica` calculada de `dataNascimento`
- Sexo, peso, altura, IMC (calculado inline)
- `nivelAtividade`, `horasSono`, `fumante`, `consumoAlcool`
- `historicoFamiliar` (array de doencas)
- Medicamentos em uso
- Exames recentes (parametros)
- Check-ins dos ultimos 30 dias (sono, humor, energia, estresse, atividade, produtividade)

Saida (JSON):
```json
{
  "idadeBiologica": 28.5,
  "confianca": "alta",
  "fatores": [
    { "nome": "...", "impacto": "positivo|neutro|negativo", "contribuicao": "+2.1 anos", "explicacao": "..." }
  ]
}
```

**Regras embutidas no prompt:**
- Idade biologica deve ficar entre -10 e +10 anos da cronologica
- Confianca "baixa" se poucos dados — modelo deve ser conservador
- 5-10 fatores

Quando recalcula: trigger via endpoint `POST /scores/calcular-idade-biologica` (manual).

### 1.9 Quando recalcula o score (triggers)

Pesquisado no codigo. O score so recalcula explicitamente via:
1. `POST /scores/recalcular` (manual, paciente aperta botao no app)
2. Apos upload de exame concluido (rota `/exames/upload` chama recalculo)

Nao tem cron job. Score fica "congelado" no `HealthScore` ate ser refeito.

### 1.10 Fontes de dados (rastreabilidade)

```javascript
// score-engine.js:166-169
const fontesDados = [];
if (perfil) fontesDados.push('perfil');
if (exames.length > 0) fontesDados.push(`${exames.length} exame(s)`);
if (checkins.length > 0) fontesDados.push(`${checkins.length} check-in(s)`);
```

Retornado junto com o score. Frontend pode mostrar "Calculado com base em: perfil, 3 exame(s), 14 check-in(s)" — transparencia.

---

## 2. Cruzamento alergia x medicamento (CMED)

> Arquivos:
> - `backend/knowledge/_farmacologia/classes.json` (23 classes farmacologicas)
> - `backend/knowledge/_farmacologia/sinonimos.json` (~70 mapeamentos nome comercial -> principio ativo)
> - `backend/src/services/padroes/farmacologista.js` (motor 100% deterministico)
> - `cmed-search.js` na raiz (helper independente da raiz do projeto)

### 2.1 As 23 classes farmacologicas (do `classes.json`)

| Classe | Principios (exemplos) | Alergia cruzada com |
|---|---|---|
| **pirazolonicos** | dipirona, metamizol, fenilbutazona | — |
| **aines** | ibuprofeno, naproxeno, diclofenaco, nimesulida, AAS | — |
| **paraaminofenois** | paracetamol, acetaminofen | — |
| **penicilinas** | amoxicilina, ampicilina, penicilina_g, benzetacil | cefalosporinas_1g, carbapenemicos |
| **cefalosporinas** | cefalexina, ceftriaxona, cefotaxima | penicilinas |
| **macrolideos** | azitromicina, claritromicina, eritromicina | — |
| **sulfas** | sulfametoxazol, sulfadiazina, dapsona | — |
| **bra** | losartana, valsartana, olmesartana | ieca |
| **ieca** | captopril, enalapril, ramipril | bra |
| **beta_bloqueadores** | propranolol, atenolol, metoprolol, carvedilol | — |
| **bcc_dihidropiridinicos** | anlodipina, nifedipina, felodipina | — |
| **diureticos_tiazidicos** | hidroclorotiazida, clortalidona, indapamida | sulfas |
| **ibp** | omeprazol, pantoprazol, esomeprazol | — |
| **biguanidas** | metformina | — |
| **estatinas** | sinvastatina, atorvastatina, rosuvastatina | — |
| **issrs** | fluoxetina, sertralina, escitalopram | — |
| **benzodiazepinicos** | clonazepam, diazepam, alprazolam | — |
| **antidepressivos_triciclicos** | amitriptilina, nortriptilina, imipramina | — |
| **triptanos** | sumatriptano, rizatriptano, zolmitriptano | — |
| **corticosteroides** | prednisona, prednisolona, dexametasona | — |
| **antihistaminicos_h1** | loratadina, cetirizina, desloratadina, dimenidrinato | — |
| **contraceptivos** | drospirenona+etinilestradiol, levonorgestrel | — |

Fontes citadas: RENAME 2022 + Formulario Terapeutico Nacional + ANVISA + Drugs.com.

**Pares cruzados criticos (decisao clinica):**
- **Penicilinas <-> Cefalosporinas 1g**: ~10% de reacao cruzada
- **Penicilinas <-> Carbapenemicos**: ~1% (mas critico)
- **IECA <-> BRA**: alergia rara, mas tosse seca/angioedema sao adversos clasicos
- **Sulfas <-> Diureticos tiazidicos**: hidroclorotiazida e sulfonamida quimicamente

### 2.2 Pares brand<->generico EXATOS (sinonimos.json)

Mapa completo nome comercial -> principio ativo -> classe:

**Analgesicos/anti-inflamatorios:**
- Novalgina, Dorflex, Magnopyrol, Anador, Metamizol -> **dipirona** -> pirazolonicos
- Tylenol, Paracetamol, Acetaminofen -> **paracetamol** -> paraaminofenois
- Advil, Ibuprofeno, Alivium, Motrin -> **ibuprofeno** -> aines
- Aspirina, AAS -> **acido_acetilsalicilico** -> aines (subgrupo salicilatos)
- Voltaren, Cataflam, Diclofenaco -> **diclofenaco** -> aines
- Naproxeno, Flanax -> **naproxeno** -> aines
- Nimesulida, Nisulid, Scaflam -> **nimesulida** -> aines

**Antibioticos:**
- Amoxil, Amoxicilina, Clavulin, Ampicilina, Benzetacil -> penicilinas
- Keflex, Cefalexina, Rocefin -> cefalosporinas
- Azitromicina, Zitromax, Azi -> macrolideos
- Claritromicina, Klaricid -> macrolideos
- Bactrim, Sulfametoxazol -> sulfas

**Cardiovasculares:**
- Losartana, Cozaar, Aradois -> bra
- Enalapril, Captopril -> ieca
- Anlodipina, Norvasc -> bcc_dihidropiridinicos
- Hidroclorotiazida, Higroton -> diureticos_tiazidicos

**Gastrointestinais:**
- Omeprazol, Losec -> ibp
- Pantoprazol -> ibp
- Nexium -> esomeprazol -> ibp

**Diabetes:** Metformina, Glifage -> biguanidas

**Lipidos:** Sinvastatina, Zocor, Atorvastatina, Lipitor -> estatinas

**Psiquiatricos:**
- Fluoxetina/Prozac, Sertralina/Zoloft, Escitalopram/Lexapro -> issrs
- Rivotril/Clonazepam, Diazepam/Valium, Alprazolam/Frontal -> benzodiazepinicos
- Amitriptilina/Tryptanol -> antidepressivos_triciclicos

**Outros:**
- Sumatriptano/Imigran -> triptanos
- Propranolol/Atenolol -> beta_bloqueadores
- Prednisona/Dexametasona -> corticosteroides
- Dramin/Loratadina/Desalex/Cetirizina -> antihistaminicos_h1
- Yasmin (drospirenona+etinilestradiol), Selene (ciproterona+etinilestradiol) -> contraceptivos

> Pegadinha: o nome **"Dipirona"** aparece TANTO como sinonimo (mapeia pra si mesma) quanto como principio_ativo. Isso resolve casos onde o paciente fala "dipirona" sem usar nome comercial.

### 2.3 Algoritmo de deteccao (farmacologista.js)

```javascript
// farmacologista.js:23-37
function normalizarMedicamento(nome) {
  if (!nome) return null;
  carregarBase();
  const chave = String(nome).toLowerCase().trim().replace(/\s+/g, '_');
  const s = _sinonimos.sinonimos[chave] || _sinonimos.sinonimos[chave.replace(/_/g, '')] || null;
  if (s) return { nome_original: nome, principio_ativo: s.principio_ativo, classe: s.classe };
  // Tenta match aproximado por substring
  for (const k in _sinonimos.sinonimos) {
    if (chave.includes(k) || k.includes(chave)) {
      const v = _sinonimos.sinonimos[k];
      return { nome_original: nome, principio_ativo: v.principio_ativo, classe: v.classe };
    }
  }
  return { nome_original: nome, principio_ativo: null, classe: null };
}
```

**3 passos de matching:**
1. Match exato (chave normalizada lowercase + underscore)
2. Match sem underscore (`paracetamol_500` vira `paracetamol500`)
3. Match aproximado por substring (paciente fala "tylenol comp" pega tylenol)

Se nada bate, retorna `{nome_original, principio_ativo: null, classe: null}` — passa adiante mas nao tenta cruzar.

### 2.4 Logica de cruzamento (3 caminhos)

```javascript
// farmacologista.js:78-107
for (const med of [...medsMencionados, ...medsPerfil]) {
  const norm = normalizarMedicamento(med);
  if (!norm || !norm.classe) continue;

  const classesRelacionadas = classesCruzam(norm.classe);

  for (const alergia of alergias) {
    const alergNorm = normalizarMedicamento(alergia.nome);
    // Alergia pode ser: nome especifico OU nome de classe
    const bateClasse = alergNorm && classesRelacionadas.includes(alergNorm.classe);
    const bateAtivo = alergNorm && alergNorm.principio_ativo === norm.principio_ativo;
    const bateTextoClasse = classesRelacionadas.some(c => alergia.nome.includes(c.replace(/_/g, ' ')));

    if (bateAtivo || bateClasse || bateTextoClasse) {
      // GERA ALERTA
    }
  }
}
```

**Triggera alerta se QUALQUER UM dos 3 condicoes:**
1. **bateAtivo**: principio ativo identico (ex: paciente alergico a "Dipirona", medicamento "Novalgina" — ambos viram `principio_ativo: dipirona`)
2. **bateClasse**: alergia mapeia pra mesma classe (paciente alergico a "Amoxicilina"=penicilinas, medico prescreve "Cefalexina"=cefalosporinas -> cefalosporinas tem `alergia_cruzada_com: [penicilinas]` -> trigger)
3. **bateTextoClasse**: alergia ja foi cadastrada como nome de classe (paciente cadastrou alergia como "penicilinas" diretamente) -> string match

### 2.5 Severidade do alerta

```javascript
// farmacologista.js:86
const severidade = alergia.gravidade === 'grave' || alergia.gravidade === 'anafilaxia' ? 'critica' : 'alta';
```

**Regra:**
- Gravidade `grave` OU `anafilaxia`: severidade **critica** (vermelho topo)
- Qualquer outra (moderada, leve, sem gravidade): severidade **alta** (vermelho, mas nao topo absoluto)

### 2.6 Origem do alerta

```javascript
// farmacologista.js:88
const foiMencionado = medsMencionados.includes(med);
// ...
origem: foiMencionado ? 'audio_paciente' : 'perfil_paciente',
```

Distingue se medicamento veio do **audio** (paciente mencionou na pre-consulta) ou do **perfil** (medico cadastrou previamente). Importante pra UI.

### 2.7 Estrutura do card de alerta gerado

```javascript
{
  id: 'AUD-20260514120030-FA1B2',
  tipo: 'alergia_medicamento',
  severidade: 'critica' | 'alta',
  medicamento: 'novalgina',
  principio_ativo: 'dipirona',
  classe: 'pirazolonicos',
  alergia_registrada: 'dipirona',
  origem: 'audio_paciente' | 'perfil_paciente',
  mensagem: 'Paciente mencionou novalgina - alergia a dipirona registrada. Risco de reacao cruzada (classe pirazolonicos).',
  acao_sugerida: 'Nao prescrever pirazolonicos. Considerar alternativa de classe diferente.',
  fonte: {
    titulo: 'Formulario Terapeutico Nacional + ANVISA',
    tipo: 'regulatorio_br',
  },
  base_version: 'farmacologia_v1.0',
  disclaimer: 'Cruzamento deterministico baseado em classes farmacologicas. Nao constitui diagnostico. Ato medico privativo.',
}
```

### 2.8 Auto-medicacao (detector secundario)

```javascript
// farmacologista.js:111-133
for (const med of medsMencionados) {
  const norm = normalizarMedicamento(med);
  if (!norm || !norm.principio_ativo) continue;
  const estaNoPerfil = medsPerfil.some(p => {
    const pn = normalizarMedicamento(p);
    return pn && pn.principio_ativo === norm.principio_ativo;
  });
  if (!estaNoPerfil) {
    autoMedicacao.push({
      id: gerarAuditId('A'),
      tipo: 'auto_medicacao',
      severidade: 'media',
      // ...
    });
  }
}
```

**Detecta:** paciente mencionou medicamento no audio mas NAO consta no perfil de uso regular.

Severidade fixa `media` (amarelo). Acao sugerida: "Atualizar cadastro de medicamentos com informacao atual de uso antes da consulta."

### 2.9 Helper de cruzamento no frontend (quiz)

> Procurado: `app-v3/30-quiz.html` ou similar com nome `quizDetectarCruzamentoAlergiaMed`. **Nao encontrado** no codebase atual. O app-v3 ainda esta em planejamento (sessao 13/mai).

O equivalente no app antigo esta em `31-revisao-alergias.html` (327 linhas) que mostra alergias extraidas do scan antes do paciente confirmar. **Esta tela NAO cruza com medicamentos — apenas exibe o que veio do scanAlergia/Gemini**. O cruzamento real e backend (farmacologista.js).

Para o app v3, o helper a implementar seria algo como:

```javascript
async function quizDetectarCruzamentoAlergiaMed(novoMed) {
  // 1. Normaliza nome do med (lowercase + underscore)
  // 2. Le alergias via vitaeAPI.listarAlergias()
  // 3. Pra cada alergia, replica logica do farmacologista.js
  // 4. Retorna {alerta: bool, classe, alergia, severidade, mensagem}
}
```

### 2.10 ID de auditoria (rastreabilidade CFM)

```javascript
// farmacologista.js:46-51
function gerarAuditId(prefix) {
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AUD-${ts}-${prefix}${rand}`;
}
```

**Formato:** `AUD-YYYYMMDDhhmmss-PXXXX` onde P=prefix (`F`=farmacologica, `A`=auto-medicacao, `C`=compliance).

Cada card tem ID unico. Retencao 20 anos por CFM 2.314/2022.

---

## 3. Pipeline Upload de Exame (Claude OCR)

> Arquivo: `backend/src/services/ai.js:135-275` (3 funcoes principais)
>
> Rotas: `POST /exames/upload`, `GET /exames`, `GET /exames/:id`, `DELETE /exames/:id`

### 3.1 Pipeline end-to-end

1. Paciente seleciona arquivo (foto/PDF) na tela `11-exames-lista.html`
2. Frontend faz multipart `POST /exames/upload` com FormData
3. Backend recebe via multer, sobe pra Supabase Storage (bucket `exames`)
4. Cria registro `Exame` com status `ENVIADO`
5. Dispara processamento (status vira `PROCESSANDO`)
6. Claude Vision le PDF/imagem direto (sem OCR intermediario)
7. Extrai parametros estruturados (JSON)
8. Classifica cada parametro: NORMAL / ATENCAO / CRITICO
9. Gera resumo + recomendacoes + impactos
10. Salva `dadosEstruturados`, `resumoIA`, `melhoriasIA`, status -> `CONCLUIDO`
11. Recalcula score automaticamente

### 3.2 System prompt (Claude) exato

```javascript
// ai.js:13-28
const SYSTEM_PROMPT_ESTRUTURAR = `Você é um assistente médico da plataforma VITAE especializado em interpretação de exames laboratoriais brasileiros.

MISSÃO: Analisar o texto extraído de um exame laboratorial e estruturar TODOS os dados com precisão.

PADRÕES DE REFERÊNCIA:
- Use SEMPRE os valores de referência impressos no próprio laudo como fonte primária.
- Quando o laudo NÃO especificar referências, use os padrões brasileiros da SBPC/ML (Sociedade Brasileira de Patologia Clínica/Medicina Laboratorial).
- Ajuste as referências considerando sexo, idade e condições específicas do paciente quando disponíveis no perfil.
- Exemplos de padrões SBPC/ML: Hemoglobina homem 13,5-17,5 g/dL, mulher 12-16 g/dL; Glicose em jejum 70-99 mg/dL; TSH 0,4-4,0 mUI/L; Vitamina D 30-100 ng/mL.

CLASSIFICAÇÕES:
- NORMAL: dentro da faixa de referência
- ATENCAO: até 20% acima ou abaixo da referência, ou limítrofe
- CRITICO: mais de 20% fora da referência, ou considerado clinicamente significativo

IMPORTANTE: Você NÃO é médico. Sempre sugira consultar um profissional de saúde. Linguagem simples e acolhedora.`;
```

### 3.3 Prompt user de estruturacao (formato exato)

```javascript
// ai.js:71-114 (literal)
{
  "tipo_exame": "string (ex: 'hemograma', 'bioquimica', 'hormonal', 'urina')",
  "nome_exame": "string (nome completo do exame)",
  "nome_amigavel": "string (nome do exame em linguagem leiga, ex: 'Exame de Sangue Completo')",
  "data_exame": "string (data no formato YYYY-MM-DD, ou null se não encontrada)",
  "laboratorio": "string (nome do laboratório, ou null se não encontrado)",
  "medico_solicitante": "string (nome do médico, ou null se não encontrado)",
  "paciente_nome": "string (nome do paciente como aparece no exame, ou null se não encontrado)",
  "status_geral": "string ('NORMAL', 'ATENCAO' ou 'CRITICO')",
  "parametros": [
    {
      "nome": "string",
      "valor": "number ou string",
      "unidade": "string",
      "referencia_min": "number ou null",
      "referencia_max": "number ou null",
      "referencia_texto": "string (faixa como aparece no exame)",
      "classificacao": "string ('NORMAL', 'ATENCAO' ou 'CRITICO')",
      "explicacao_simples": "string (1-2 frases em linguagem leiga)",
      "impacto_pessoal": "string (só se não for NORMAL)",
      "dicas": ["string (só para ATENCAO/CRITICO, máximo 2 dicas)"]
    }
  ],
  "resumo": "string (resumo em linguagem simples, 2-4 frases)",
  "impactos": [
    { "icone": "emoji", "titulo": "string", "texto": "string" }
  ],
  "melhorias": [
    { "categoria": "alimentacao|exercicio|sono|suplementacao", "icone": "emoji", "titulo": "string", "texto": "string" }
  ]
}
```

### 3.4 Como Claude recebe o arquivo (multimodal)

```javascript
// ai.js:140-152
if (tipo === 'application/pdf') {
  contentItem = {
    type: 'document',
    source: { type: 'base64', media_type: 'application/pdf', data: base64 },
  };
} else {
  const mediaType = tipo === 'image/jpg' ? 'image/jpeg' : tipo;
  contentItem = {
    type: 'image',
    source: { type: 'base64', media_type: mediaType, data: base64 },
  };
}
```

PDF vai como `type: 'document'`, imagens como `type: 'image'`. **NAO ha OCR separado** — Claude le diretamente.

### 3.5 Modelo + parametros

```javascript
// ai.js:154-162
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  system: SYSTEM_PROMPT_ESTRUTURAR,
  messages: [{
    role: 'user',
    content: [contentItem, { type: 'text', text: montarPromptEstruturacao(contextoPerfil) }],
  }],
});
```

Modelo: **Claude Sonnet 4** (`claude-sonnet-4-20250514`).
Max tokens: 4096 (suficiente pra hemograma + bioquimica completos).
Temperature: **nao especificada** (default 1.0).

**Pegadinha temperature:** o sistema NAO especifica temperatura nas chamadas Claude pra exames. Default da API e 1.0. Para extracao estruturada, temperatura baixa (0.3) seria mais segura. Risco de variacao entre chamadas iguais (Claude responde diferente em retry).

### 3.6 Regras anti-alucinacao

Embutidas no system prompt + reforcadas no user prompt:

1. **"Use SEMPRE os valores de referência impressos no próprio laudo como fonte primária"** — Claude nao deve inventar referencias.
2. **"NÃO faça diagnósticos. Sempre sugira consultar um profissional"** — sem prescricao/diagnose.
3. **Linguagem simples e acolhedora** — sem jargao.

**Limitacoes conhecidas:**
- Se o exame tem nome de marcador raro, Claude pode mal-classificar (sem fonte de referencia clara)
- Se a foto esta borrada, Claude pode interpretar errado um valor numerico — sem cross-check
- Se Claude erra, NAO ha validacao secundaria (Gemini nao e usado pra exames)

### 3.7 Status workflow

```
ENVIADO -> PROCESSANDO -> CONCLUIDO
                      -> ERRO
```

| Status | Significado |
|---|---|
| ENVIADO | Arquivo subiu pra Storage, registro criado |
| PROCESSANDO | Worker comecou (Claude rodando) |
| CONCLUIDO | dadosEstruturados + resumoIA salvos |
| ERRO | Claude falhou OU JSON invalido |

### 3.8 Tela 27-processando.html (polling)

Apesar do nome `27-processando` sugerir scan de receita, a tela e generica. Mostra spinner enquanto job roda. **NAO faz polling** — o usuario fica nela durante o request sincrono (~10-30s). Apos resposta, redireciona pra revisao.

**Mensagens dinamicas:**
```
1. Lendo texto da imagem...
2. Identificando medicamentos... (ou 'Identificando alergias...')
3. Medicamentos identificados (ou similar)
```

**Tempo medio observado:** 8-15s pra exame simples, ate 30s pra PDF longo (timeout do Railway: 30s).

### 3.9 Anti-alucinacao: prefere null a inventar

```javascript
// ai.js:79-86 (trecho do prompt)
"medico_solicitante": "string (nome do médico... ou null se não encontrado)",
"paciente_nome": "string (nome do paciente como aparece no exame, ou null se não encontrado)",
```

Todos os campos que podem nao existir tem `ou null`. Reforca que Claude deve retornar null em vez de chutar.

### 3.10 Pseudonimizacao antes do LLM (LGPD Art. 11)

**Para exames: NAO HA pseudonimizacao.** O nome do paciente vai junto do PDF/imagem. **Risco LGPD.**

Decisao tomada (Sessao 19 ao implementar Padroes v2): pseudonimizacao implementada APENAS no anamnesista (padroes/anamnesista.js) e iaCollab. Para exames, o nome do paciente fica no arquivo bruto enviado pra Anthropic.

**Mitigacao atual:** Anthropic nao retem dados por default. Mas isso e configuracao deles, nao garantia tecnica. Para LGPD completa, scan de exame deveria:
1. Tarjar nome no PDF antes de enviar
2. Substituir por placeholder `[PACIENTE_X]`
3. Re-inserir no resultado

**Pendente fase 2.**

### 3.11 Geracao de analise comparativa (gerarAnaliseExame)

```javascript
// ai.js:199-275
async function gerarAnaliseExame(dadosEstruturados, perfilUsuario, historicoExames) {
```

Depois do estruturar, opcionalmente Claude pode comparar com historico. Recebe ate 5 exames anteriores. Gera:
- `resumo` (compara: "Sua hemoglobina melhorou de X para Y")
- `impactos` (3 cards)
- `melhorias` (3-5 acoes priorizadas)

Trigger: chamado opcional pelo backend apos estruturarExame.

---

## 4. Scan de Receita (Gemini Vision)

> Arquivo: `backend/src/services/ai.js:1245-1363` (`scanReceita`)
>
> Rota: `POST /medicamentos/scan` (multipart, FormData `arquivo`)
>
> Tela: `26-scan-receita.html` (camera/galeria) -> `27-processando.html` (loading) -> `31-revisao-alergias.html` (revisao — sim, nome confuso)

### 4.1 Pipeline

1. Paciente tira foto/seleciona da galeria em `26-scan-receita.html`
2. Frontend comprime imagem via canvas (ver 4.2)
3. Salva blob em `sessionStorage` (`vitae_scan_blob`)
4. Navega pra `27-processando.html`
5. 27-processando le blob, faz POST `/medicamentos/scan` via `vitaeAPI.scanReceita(file)`
6. Backend tenta Gemini primeiro (mais barato), fallback Claude
7. Retorna lista de medicamentos extraidos
8. Frontend salva em `sessionStorage.vitae_scan_result`
9. Navega pra `31-revisao-alergias.html` (tela de revisao — mesma tela atende receita E alergia)
10. Paciente confirma -> POST `/medicamentos` (cada med vira registro)
11. Backend cruza com alergias cadastradas (farmacologista.js)

### 4.2 Compressao de imagem (canvas)

```javascript
// 27-processando.html:72-109
async function comprimirImagem(file, maxWidth = 1600, maxHeight = 2400, quality = 0.75) {
    if (!file.type.startsWith('image/')) return file; // PDFs passam direto
    return new Promise((resolve) => {
        let settled = false;
        const finish = (result) => { if (!settled) { settled = true; resolve(result); } };
        // Safety net: se algo travar, fallback pro arquivo original em 8s
        setTimeout(() => finish(file), 8000);

        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => { img.src = e.target.result; };
        reader.onerror = () => finish(file);
        img.onload = () => {
            let { width, height } = img;
            if (width > maxWidth) {
                height = Math.round(height * (maxWidth / width));
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = Math.round(width * (maxHeight / height));
                height = maxHeight;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
                if (!blob) return finish(file);
                const compressed = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
                // Se comprimido ficou maior (PNG pequeno ja otimizado), usa original
                finish(compressed.size < file.size ? compressed : file);
            }, 'image/jpeg', quality);
        };
        img.onerror = () => finish(file);
        reader.readAsDataURL(file);
    });
}
```

**Parametros:**
- maxWidth: **1600px**
- maxHeight: **2400px**
- quality: **0.75** (JPEG)
- Safety timeout: **8s** (volta pro original se algo travar)
- Sempre converte pra JPEG (mesmo se entrada e PNG/WebP)
- Se comprimido ficou MAIOR que original (PNG pequeno otimizado), usa original

**Tamanho tipico:** receita foto 4MB iPhone -> ~600KB apos compressao.

### 4.3 Validacao HEIC/HEIF (iPhone)

```javascript
// 27-processando.html:151-163
const formatosAceitos = ['image/jpeg','image/jpg','image/png','image/webp','application/pdf'];
if (tipoLower.includes('heic') || tipoLower.includes('heif')) {
    document.getElementById('spinner').style.display = 'none';
    document.getElementById('title').textContent = 'Formato nao suportado';
    document.getElementById('sub').textContent = 'iPhone: ao tirar foto, escolha "Mais Compativel" em Ajustes > Camera > Formatos, ou compartilhe como JPEG.';
    // ...
}
```

iPhone com formato HEIC default e bloqueado com mensagem amigavel. Solucao: mudar pra "Mais Compativel" nas configuracoes. Sem conversao automatica server-side.

### 4.4 Prompt Gemini (scan receita)

```javascript
// ai.js:1266-1296
const prompt = `Voce e um assistente da plataforma vita id. Analise esta foto de medicamento ou receita medica brasileira.

Primeiro identifique o tipo de imagem: caixa de remedio, frasco, receita medica, bula, ou outro.

Retorne um JSON com esta estrutura:
{
  "tipo": "medicamento" ou "receita" ou "nao_receita",
  "mensagem": "string (se nao for medicamento, explique)",
  "medico": "string ou null",
  "medicamentos": [
    {
      "nome": "string (nome comercial do medicamento)",
      "principio_ativo": "string ou null",
      "dosagem": "string ou null (ex: 500mg, 10ml)",
      "forma": "string ou null (comprimido, capsula, gotas, solucao)",
      "frequencia": "string ou null (ex: 1x ao dia, 8/8h)",
      "duracao": "string ou null (ex: 7 dias, uso continuo)",
      "laboratorio": "string ou null",
      "quantidade": "string ou null (ex: 20 comprimidos)",
      "uncertain": false,
      "confianca": "alta" ou "media" ou "baixa"
    }
  ]
}

REGRAS:
- Se nao conseguir ler um campo, coloque null (NUNCA invente)
- Se a foto nao for de medicamento, retorne tipo "nao_receita"
- Trate abreviacoes: comp=comprimido, cp=comprimido, gt=gotas, mg=miligramas
- Se for receita, extraia TODOS os medicamentos listados
- Se for caixa/frasco, extraia o nome e dosagem visiveis`;
```

### 4.5 Modelo + parametros Gemini

```javascript
// ai.js:1261-1264
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: { responseMimeType: 'application/json' },
});
```

Modelo: **Gemini 2.5 Flash** (mais barato que Pro, suficiente pra OCR de receita).
`responseMimeType: 'application/json'` forca saida JSON.
**Temperatura nao especificada** (default Gemini ~1.0).

### 4.6 Timeout duplo (Gemini + Claude)

```javascript
// ai.js:1238-1243
function comTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout apos ' + (ms/1000) + 's em ' + label)), ms)),
  ]);
}
```

```javascript
// ai.js:1250-1252
const deadline = Date.now() + 26000;
const timeLeft = () => Math.max(3000, deadline - Date.now());
```

**Logica:** deadline GLOBAL de 26s (margem antes do Railway matar em 30s). Cada chamada (Gemini, depois Claude) usa `timeLeft()` que diminui a cada passo.

**Gemini timeout:** `Math.min(timeLeft(), 20000)` — max 20s.
**Claude fallback timeout:** `timeLeft()` — o que sobrou.

### 4.7 Fallback Claude

```javascript
// ai.js:1330-1353
let contentItem;
if (tipo === 'application/pdf') {
  contentItem = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
} else {
  contentItem = { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };
}

const response = await comTimeout(
  anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: SYSTEM_PROMPT_SCAN_RECEITA,
    // ...
```

Se Gemini falhar OU genAI nao estiver configurado, cai pro Claude Sonnet com prompt similar.

### 4.8 Cruzamento automatico com alergias cadastradas

**Backend NAO cruza no scan.** A rota `/medicamentos/scan` so retorna a lista extraida. O cruzamento acontece DEPOIS, quando paciente confirma e cria medicamentos via `POST /medicamentos` (cada med vira registro `Medicamento`).

A tela `31-revisao-alergias.html` mostra alertas se algum med bate com alergia, mas isso e checado no frontend usando endpoint dedicado (procurar `/medicamentos/info/:nome` ou similar).

**Para o app v3:** o cruzamento ideal deveria acontecer DURANTE o scan, mostrando alertas inline na tela de revisao. Implementar helper `quizDetectarCruzamentoAlergiaMed` no frontend que replica logica do farmacologista.js.

### 4.9 Limite diario (15 scans)

> Limite citado no plano original (PLANO-SCAN-COMPLETO.md). **NAO encontrado no codigo atual.** Provavelmente nao foi implementado. Rate limit de 15/dia/usuario nao existe em `medicamentos.js` ou `alergias.js`.

### 4.10 Mensagens amigaveis pra erros

```javascript
// 27-processando.html:111-131
function mensagemErroAmigavel(err) {
    const msg = (err && err.message) || '';
    const lower = msg.toLowerCase();
    if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('cors')) {
        return { titulo: 'Sem conexao com o servidor', sub: 'Verifique sua internet e tente novamente.' };
    }
    if (lower.includes('413') || lower.includes('too large') || lower.includes('muito grande')) {
        return { titulo: 'Foto muito grande', sub: 'Tente uma foto menor ou mais comprimida.' };
    }
    if (lower.includes('timeout') || lower.includes('504')) {
        return { titulo: 'Processamento demorou demais', sub: 'Tente novamente com uma foto mais simples.' };
    }
    if (lower.includes('503') || lower.includes('indispon') || lower.includes('credit') || lower.includes('quota')) {
        return { titulo: 'Servico temporariamente indisponivel', sub: 'Tente novamente em alguns minutos.' };
    }
    if (lower.includes('401') || lower.includes('unauthoriz')) {
        return { titulo: 'Sessao expirada', sub: 'Faca login novamente.' };
    }
    return { titulo: 'Nao foi possivel processar', sub: 'Tente tirar a foto novamente com mais luz e sem reflexos.' };
}
```

**6 categorias mapeadas:**
1. Sem internet
2. Foto muito grande (413)
3. Timeout (504)
4. Servico indisponivel (503/quota)
5. Sessao expirada (401)
6. Generico (sem luz, etc)

### 4.11 AbortController no frontend

```javascript
// api.js:294-305
async scanReceita(file) {
  const formData = new FormData();
  formData.append('arquivo', file);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 28000);
  try {
    return await apiRequest('/medicamentos/scan', { method: 'POST', body: formData, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Processamento demorou demais. Tente com foto menor.');
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
},
```

**Frontend tambem aborta em 28s** (antes do server matar em 30s). Layered timeout.

---

## 5. Pre-consulta vita id - Pipeline completo

> Arquivos:
> - `backend/src/routes/pre-consulta.js` (1818 linhas)
> - `pre-consulta.html` (2536 linhas — refatorada Sessao 16, virou state machine)
> - `quiz-preconsulta.html` (1462 linhas — quiz vita id obrigatorio)
> - `backend/src/utils/respostas-v4.js` (helpers V4)
> - `backend/src/workers/processador.js` (worker async)

### 5.1 Modo audio vs modo texto (V4 hibrido)

V4 = "pergunta-por-pergunta com escolha audio OU texto por pergunta". Cada pergunta tem 2 botoes: microfone (audio) ou texto.

**Pergunta em modo audio:**
1. Tela mostra pergunta + 1 botao mic central
2. Paciente segura e fala
3. Detector RMS local valida se houve voz (threshold 0.006)
4. Para gravacao quando solta dedo OU silencio 2s
5. Upload chunk -> `/responder-pergunta` -> Whisper transcreve
6. Backend retorna estado novo (proxima pergunta OU revisao)

**Pergunta em modo texto:**
1. Tela mostra textarea + botao "Proximo"
2. Paciente digita
3. Cliente envia direto pro `/responder-pergunta`
4. Backend roda Gemini classificador (em modo texto SO — audio bypassa classificador desde Sessao 17)

### 5.2 Sessao 17: classificador removido em modo audio

> Backend `pre-consulta.js` linha ~1023 (referencia da Sessao 17)

**Antes (V4 original):**
- Audio transcrito -> Whisper retorna "ah faz uns 3 semanas"
- Gemini classifica -> respondeu=true/false, valor extraido, confianca
- Se confianca < 0.85 -> tela amarela "Acho que nao te ouvi bem"

**Depois (Caminho A — Sessao 17):**
- Audio transcrito -> Whisper retorna texto
- Backend retorna SEM rodar Gemini: `{respondeu: true, valor: transcricao.slice(0,500), confianca: 1, motivo: 'audio_direto'}`
- Frontend SEMPRE mostra tela de confirmacao com texto bruto
- Paciente confirma ou regrava

**Razao:** classificador era rigoroso demais (instrucao no prompt: "so confianca >0.85 quando certeza absoluta"). Muitas falsas rejeicoes. Lucas escolheu UX simples sobre estruturacao automatica.

**Modo texto MANTEM classificador** — texto e mais limpo, Gemini ajuda a estruturar.

### 5.3 Whisper (transcricao)

> Arquivo: `backend/src/services/transcription.js`

**Formato aceito:** webm/opus (encoder padrao do MediaRecorder no Chrome/Edge), mp4/m4a (Safari). Backend aceita qualquer mime audio.

**Limite tamanho:** definido no multer:
```javascript
// pre-consulta.js:117-118
const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const v4ChunkUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
```

- Audio final (pre-consulta inteira): **25MB**
- Chunk individual V4 (pergunta-por-pergunta): **5MB**

**Modelo:** OpenAI Whisper (api.openai.com), modelo `whisper-1`. **Custo:** $0.006/min.

### 5.4 Threshold RMS 0.006 (deteccao de voz)

> Encontrado em pre-consulta.html (Sessao 16) e descrito em handoff.

**O que e RMS:** Root Mean Square. Calculo continuo do "volume" do microfone via Web Audio API.

**Como funciona:**
1. `getUserMedia({audio})` cria stream
2. `AudioContext.createAnalyser()` cria analisador
3. A cada frame (~30fps), calcula amplitude RMS:
```javascript
function calcRMS(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}
```
4. Se RMS > 0.006 -> tem voz
5. Se RMS <= 0.006 por mais de 2s -> silencio (encerra gravacao)

**0.006 (Sessao 16) reduzido de 0.015 (Sessao 11):**

> "Mulher, iPhone com case, mic distante. Threshold RMS reduzido de 0.015 para 0.006 (era alto demais pra voz natural)."

**Pegadinha:** threshold muito baixo pega ruido ambiente. Threshold muito alto perde voz fraca. 0.006 e empirico — calibrado em iPhone 12+ com case. Pode precisar reajustar pra Android antigo.

### 5.5 Wake Lock iOS 16.4+

```javascript
// pre-consulta.html (referencia, Sessao 5)
async function pedirWakeLock() {
  if (!('wakeLock' in navigator)) return null;
  try {
    return await navigator.wakeLock.request('screen');
  } catch (e) {
    return null;
  }
}
```

**Quando ativa:** durante gravacao + durante upload final.

**Compatibilidade:** iOS 16.4+ (lancado mar/2023), Android 4.4+ (Chrome 84+).

**Por que importa:** sem Wake Lock, iOS bloqueia a tela em 30s. Tela bloqueada = `MediaRecorder` para no Safari (politica iOS). Audio truncado.

**Fallback:** banner "Mantenha sua tela acesa durante a gravacao" pra dispositivos sem Wake Lock.

### 5.6 IndexedDB local (vitaStorage)

> Banco local que persiste entre sessoes/recarregamentos.

**Schema (referencia Sessao 5):**
```
db: vitaStorage (versao 1)
stores:
  - preconsulta_estado: keyed by token, value = {audio, foto, respostas, timestamp}
  - preconsulta_chunks: keyed by token+pergunta, value = blob (chunks V4)
  - preconsulta_meta: keyed by token, value = {iniciadoEm, ultimaAtividade}
```

**Uso:**
- Chunks chegam a cada 1s do MediaRecorder
- Cada chunk vai pra IndexedDB ANTES de subir pra servidor
- Se app fecha, paciente reabre -> state machine detecta dados pendentes -> banner "Sua gravacao anterior foi recuperada"

### 5.7 Chunked recording (1s, 64kbps)

```javascript
// referencia Sessao 5
mediaRecorder = new MediaRecorder(stream, {
  mimeType: 'audio/webm;codecs=opus',
  audioBitsPerSecond: 64000,
});
mediaRecorder.start(1000); // chunk a cada 1s
```

**Parametros:**
- Codec: **opus** (compressao moderna, ~10x menor que mp3)
- Bitrate: **64kbps** (qualidade decente pra voz, ruim pra musica)
- Chunk: **1000ms** (1s)

**Resultado:** 5min de audio -> ~2.4MB (era ~4.8MB com bitrate default).

### 5.8 Limite 5min + alertas progressivos

| Tempo | Comportamento |
|---|---|
| 0:00-3:59 | Timer normal (cinza) |
| 4:00-4:29 | Timer **amarelo** + aviso "Faltam 1 minuto" |
| 4:30-4:59 | Timer **vermelho** + aviso "Vai parar em breve" |
| 5:00 | **Auto-stop** (mediaRecorder.stop()) + envia o que tem |

Razao do limite: Whisper API tem limite de 25MB. 5min em 64kbps ~ 2.4MB, longe do limite. Mas longo demais cansa o paciente.

### 5.9 Auto-pause em visibilitychange

```javascript
// pre-consulta.html (referencia)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mediaRecorder.state === 'recording') {
    pauseRecording(true); // true = auto-pause, nao queima cap
  }
});
```

**Quando dispara:**
- Paciente troca de app
- Chamada telefonica entra
- iOS suspende navegador

**Importante:** auto-pause NAO conta no cap de 3 pausas manuais. Distincao via flag `automatica`.

### 5.10 HEAD validation backend

> Sessao 5: backend valida que arquivo realmente subiu pra Supabase ANTES de retornar 200.

```javascript
// pseudo-codigo
async function validarArquivoSupabase(url) {
  const head = await fetch(url, { method: 'HEAD' });
  return head.ok;
}

// na rota /responder
const audioUrl = await storage.upload(audioBuffer);
const audioConfirmado = await validarArquivoSupabase(audioUrl);

return res.json({ audioConfirmado, ... });
```

**Por que:** sem HEAD, frontend confiava em status 200 mas arquivo podia nao existir na Storage (race condition, falha CORS, etc). Resultado: medico via "pre-consulta respondida" sem audio.

**Cliente so limpa IndexedDB se `audioConfirmado === true`.**

### 5.11 TarefaPendente (fila assincrona)

> Arquivo: `backend/src/workers/processador.js`

**Estrutura tabela TarefaPendente:**
```sql
id, tipo (GERAR_SUMMARY_E_TTS | AGENDA_OFERTAR_VAGA), preConsultaId,
payload (JSON), tentativas (int default 0), processadoEm (datetime null),
erro (text null), proximaTentativa (datetime), dead (bool default false),
criadoEm, atualizadoEm
```

**Worker tick:** a cada 30s (`INTERVALO_MS`), pega ate 5 tarefas (`LIMITE_POR_CICLO`) com `processadoEm=null` AND `dead=false` AND `proximaTentativa <= now`.

**Backoff exponencial:**
```javascript
// processador.js:26-30
function delayParaProximaTentativa(tentativas) {
  const minutos = [0.5, 2, 10, 30, 120];
  const m = minutos[Math.min(tentativas, minutos.length - 1)];
  return new Date(Date.now() + m * 60 * 1000);
}
```

| Tentativa | Delay ate proxima |
|---|---|
| 1 | 30s |
| 2 | 2min |
| 3 | 10min |
| 4 | 30min |
| 5 | 2h |

**Apos 5 tentativas:** `dead = true`. Dashboard medico mostra badge "Incompleta" + botao "Pedir reenvio" (abre WhatsApp pronto).

### 5.12 Anti-multi-clique (flag `_concluindo`)

> Sessao 16, quiz-preconsulta.html

```javascript
// quiz-preconsulta.html (referencia)
async function conclude() {
  if (window._concluindo) return; // ja esta concluindo
  window._concluindo = true;
  btn.disabled = true;
  btn.textContent = 'Salvando...';
  try {
    // ... salva tudo
    window.location.href = retorno;
  } catch (e) {
    window._concluindo = false; // libera em caso de erro
    btn.disabled = false;
    btn.textContent = 'Continuar';
    mostrarErro(qpTraduzirErro(e));
  }
}
```

**Razao:** sem essa flag, paciente impaciente clicava varias vezes "Continuar". Cada clique disparava conclude() em paralelo. Primeiro redirect apagava localStorage. Segundo clique caia no fallback de fluxo "perdido" e ia pro 08-perfil.html.

### 5.13 attemptId UUID (dedupe)

> Sessao 11

Cada tentativa de gravacao recebe UUID v4 unico no frontend. Quando upload acontece, attemptId vai junto.

```javascript
// frontend
const attemptId = crypto.randomUUID();
formData.append('attemptId', attemptId);
```

Backend grava `attemptId` em `respostas.attemptId`. Se mesmo attemptId chegar de novo (retry), backend retorna 200 com `duplicate: true` em vez de processar de novo.

### 5.14 Tradutor de erros (`traduzirErro()`)

> Sessao 16. Implementado em `pre-consulta.html` + replicado em `quiz-preconsulta.html` como `qpTraduzirErro`.

**Dicionario CAMPOS_AMIGAVEIS (~20 entries):**

```javascript
const CAMPOS_AMIGAVEIS = {
  cpf: 'CPF',
  dataNascimento: 'Data de nascimento',
  alturaCm: 'Altura',
  pesoKg: 'Peso',
  contatoEmergenciaTel: 'Telefone do contato de emergencia',
  contatoEmergenciaNome: 'Nome do contato de emergencia',
  tipoSanguineo: 'Tipo sanguineo',
  sexo: 'Sexo',
  email: 'E-mail',
  senha: 'Senha',
  celular: 'Celular',
  nome: 'Nome',
  // ... ~20 campos
};

function traduzirErro(erro) {
  const msg = erro?.message || '';
  if (msg.includes('409') || msg.toLowerCase().includes('ja existe'))
    return 'Ja existe conta com esses dados. Tenta entrar.';
  if (msg.includes('401') || msg.toLowerCase().includes('unauthor'))
    return 'Sua sessao expirou. Faz login de novo.';
  if (/5\d\d/.test(msg))
    return 'Servidor com problema temporario. Suas respostas estao salvas. Tenta de novo em segundos.';
  if (msg.toLowerCase().match(/network|fetch|failed/))
    return 'Sem conexao com o servidor. Verifica internet.';
  if (msg.includes('404')) return 'Link nao encontrado. Pede outro pro medico.';
  if (msg.includes('410')) return 'Link expirado. Pede um novo pro medico.';

  // Zod errors com formato "campo: msg"
  const zodMatches = [...msg.matchAll(/(\w+):\s*([^\n]+)/g)];
  if (zodMatches.length > 0) {
    return zodMatches.map(([_, campo, m]) => {
      const nomeAmigavel = CAMPOS_AMIGAVEIS[campo] || campo;
      return `${nomeAmigavel}: ${m}`;
    }).join('\n');
  }

  if (msg.toLowerCase().includes('cobertura insuficiente'))
    return 'Volta e responde — pode dizer "nao sei" se nao souber.';

  return msg || 'Algo deu errado. Tenta de novo.';
}
```

**Aplicado em:**
- `lgSubmit` (login do paciente)
- `finalizarPreConsulta`
- `enviarTexto` (modo texto)
- `conclude` (quiz vita id)
- Banner "Sem internet/Servidor"

### 5.15 Vinculo paciente por token (Sessao 21)

> `pre-consulta.js:34-115` (funcao `vincularPaciente`)

Decisao CEO 2026-05-08: O TOKEN unico da pre-consulta E O vinculo. Quando paciente abre link, faz login e responde, backend usa `pacienteId` direto do JWT autenticado. **Sem matching telefone/email** (causava bug "Julia Alves" — telefones com formatacoes diferentes nao batiam).

```javascript
// pre-consulta.js:43-48
const pacienteId = pacienteIdLogado || null;

// Se paciente NAO esta logado, vinculo nao acontece.
// PC fica orfa. Nao chuta paciente errado por similaridade.
if (!pacienteId) return null;
```

Em paralelo, cria/atualiza:
- `Consentimento` (LGPD Art. 8): upsert por `[usuarioId, tipo, versao]`. Tipo: `COMPARTILHAMENTO_MEDICO`, versao `1.0`.
- `AutorizacaoAcesso` (medico <-> paciente): upsert por `[pacienteId, medicoId]`. Renova `expiraEm` pra 180 dias.

---

## 6. Anamnese estruturada (11 campos clinicos)

> Arquivo: `backend/src/services/ai.js:904-966` (regras dentro do prompt do summary).
> Renderizado em: `25-summary.html` (mobile, linha ~828) E `desktop/app.html` (~3768-3805) — Sessao 13 forcou sincronizar os dois.

### 6.1 Os 11 campos

```javascript
// completude.js:26-38 (canon)
const CAMPOS_ANAMNESE_11 = [
  'queixaPrincipal',
  'tempoEvolucao',
  'intensidade',
  'fatoresAgravantes',
  'fatoresAtenuantes',
  'sintomasAssociados',
  'tratamentoPrevio',
  'antecedentesPessoais',
  'antecedentesFamiliares',
  'habitos',
  'sono',
];
```

### 6.2 Prompt EXATO do Gemini pra extrair

```javascript
// ai.js:746-758 (literal)
"anamneseEstruturada": {
  "queixaPrincipal":      { "valor": "string ou null", "fonte": "audio|formulario|null" },
  "tempoEvolucao":        { "valor": "string ou null", "fonte": "audio|formulario|null" },
  "intensidade":          { "valor": "string ou null", "fonte": "audio|formulario|null" },
  "fatoresAgravantes":    { "valor": "string ou null", "fonte": "audio|formulario|null" },
  "fatoresAtenuantes":    { "valor": "string ou null", "fonte": "audio|formulario|null" },
  "sintomasAssociados":   { "valor": "string ou null", "fonte": "audio|formulario|null" },
  "tratamentoPrevio":     { "valor": "string ou null", "fonte": "audio|formulario|null" },
  "antecedentesPessoais": { "valor": "string ou null", "fonte": "audio|formulario|null" },
  "antecedentesFamiliares": { "valor": "string ou null", "fonte": "audio|formulario|null" },
  "habitos":              { "valor": "string ou null", "fonte": "audio|formulario|null" },
  "sono":                 { "valor": "string ou null", "fonte": "audio|formulario|null" }
}
```

### 6.3 Regras de extracao por campo (do prompt literal)

```text
ai.js:904-965 — REGRAS DE anamneseEstruturada (campo NOVO — 11 campos clinicos com fonte rastreavel)

CADA CAMPO TEM 2 PARTES OBRIGATORIAS:
- valor: o conteudo extraido (string curta e objetiva) OU null se nao foi mencionado
- fonte: "audio" se veio da transcricao, "formulario" se veio das respostas do formulario, null se valor e null

REGRA DE PRIORIDADE DE FONTE:
- Se o campo aparece TANTO na transcricao quanto no formulario, priorize "audio" (fala mais espontanea/recente).
- Se aparece SO no formulario, fonte e "formulario".
- Se aparece SO na transcricao, fonte e "audio".
- Se NAO aparece em nenhum lugar, valor=null e fonte=null. NUNCA invente.

REGRAS DE CADA CAMPO:

1. queixaPrincipal: a queixa em 1 linha, formato substantivo direto. NAO use aspas. NAO use frase do paciente literal.

2. tempoEvolucao: tempo desde o inicio (ex: "2 semanas", "3 dias", "6 meses"). Apenas o tempo.

3. intensidade: escala 0-10 se mencionada (ex: "7/10"), ou descritor verbal (ex: "leve", "moderada", "intensa"). Se paciente disse "muita dor" sem numero, fica null.

4. fatoresAgravantes: o que piora (ex: "Ao acordar pela manhã", "Estresse"). Se nao mencionado, null.

5. fatoresAtenuantes: o que melhora (ex: "Repouso em ambiente escuro"). Se nao mencionado, null.

6. sintomasAssociados: outros sintomas (ex: "Náusea, fotofobia"). Lista separada por virgula. Se nao mencionado, null.

7. tratamentoPrevio: o que ja tentou (ex: "Dipirona — sem melhora"). Se nao mencionado, null.

8. antecedentesPessoais: doencas/condicoes (ex: "Hipertensão controlada"). Se nao mencionado, null.

9. antecedentesFamiliares: doencas em familiares (ex: "Mãe com enxaqueca"). Se nao mencionado, null.

10. habitos: tabaco, alcool, atividade fisica (ex: "Não fuma · não bebe · sedentária"). Use ponto-medio (·) pra separar.

11. sono: qualidade e duracao (ex: "6h/noite · qualidade ruim"). Se nao mencionado, null.

ANTI-ALUCINACAO ABSOLUTA NESSE CAMPO:
- NUNCA preencha campo nao mencionado. Prefira null a inventar.
- NUNCA interprete. Se paciente disse "muita dor" sem numero, intensidade=null.
- NUNCA agrupe info de campos diferentes em um so.
```

### 6.4 Fontes possiveis e cores

| Fonte | Cor | Significado |
|---|---|---|
| **audio** | verde (#00C47A) | Veio da fala do paciente |
| **formulario** | azul (#3B82F6) | Veio das respostas do formulario |
| **pulado** | amarelo (#F59E0B) | Paciente clicou "Pular" (V2/V4) |
| **desconhecer** | cinza (#9CA3AF) | Paciente declarou "nao sei" |

### 6.5 Anti-alucinacao prefere null

Embedido em 4 lugares do prompt:
1. "NUNCA invente"
2. "Prefira null a inventar"
3. "Se NAO aparece em nenhum lugar, valor=null e fonte=null"
4. "Se paciente disse 'muita dor' sem numero, intensidade=null. NAO escreva '8/10'"

### 6.6 enriquecerFontesAnamneseV2 (sobrescreve fontes apos LLM)

```javascript
// ai.js:1509-1534
function enriquecerFontesAnamneseV2(anamnese, respostasV2) {
  if (!anamnese || typeof anamnese !== 'object') return anamnese;
  if (!respostasV2 || typeof respostasV2 !== 'object') return anamnese;

  const out = JSON.parse(JSON.stringify(anamnese));

  Object.values(respostasV2).forEach(r => {
    if (!r || !r.campoAnamnese) return;
    const campoChave = r.campoAnamnese;
    if (!out[campoChave]) return;

    if (r.fonte === 'pulado') {
      out[campoChave] = { valor: null, fonte: 'pulado' };
    } else if (r.fonte === 'desconhecer') {
      out[campoChave] = { valor: 'Paciente declarou desconhecer', fonte: 'desconhecer' };
    } else if (r.fonte === 'audio' && r.valor) {
      out[campoChave] = { valor: out[campoChave].valor || r.valor, fonte: 'audio' };
    } else if (r.fonte === 'formulario' && r.valor) {
      out[campoChave] = { valor: out[campoChave].valor || r.valor, fonte: 'formulario' };
    }
  });

  return out;
}
```

**Por que existe:** Gemini tem so 2 valores possiveis (audio/formulario). Mas V2/V4 tem 4 (audio/formulario/pulado/desconhecer). Apos Gemini retornar, esse helper sobrescreve com fontes "pulado" e "desconhecer" reais.

`enriquecerFontesAnamneseV4` (em `respostas-v4.js`) faz a mesma coisa para o formato V4.

### 6.7 Replicacao mobile + desktop

> Sessao 13 incidente: o componente foi adicionado SO em `25-summary.html` (mobile). Lucas abriu desktop e nao viu. Causa: `desktop/app.html` tem renderizacao PROPRIA. Fix em commit posterior.

**Regra:** qualquer mudanca em summary precisa ser replicada em AMBOS os arquivos. CLAUDE.md ja avisa isso na regra de design.

---

## 7. Padroes Observados v2 (multi-agente)

> Arquivos:
> - `backend/src/services/padroes/index.js` (entry point + feature flag)
> - `backend/src/services/padroes/pipeline.js` (orquestrador 155 linhas)
> - `backend/src/services/padroes/anamnesista.js` (Claude Haiku, 120 linhas)
> - `backend/src/services/padroes/farmacologista.js` (deterministic, 139 linhas)
> - `backend/src/services/padroes/matching.js` (epidemiologista deterministic, 262 linhas)
> - `backend/src/services/padroes/compliance.js` (validador, 96 linhas)
> - `backend/knowledge/_version.json` (manifest)
> - `backend/knowledge/_red_flags_transversais.json`
> - `backend/knowledge/cefaleia/*.json` (1a queixa estruturada)

### 7.1 Os 5 agentes (mas so 4 implementados)

| Agente | Modelo | Timeout | Funcao |
|---|---|---|---|
| **Anamnesista** | Claude Haiku 4.5 | 8s | Extrai 14 campos clinicos do audio/respostas |
| **Farmacologista** | Deterministico (sem LLM) | sync | Cruza meds x alergias via classes farmacologicas |
| **Epidemiologista (matching)** | Deterministico (sem LLM) | sync | Score 0-100 de cada condicao candidata |
| **Compliance** | Regex | sync | Valida cards (fonte, score, linguagem, disclaimer) |
| **Orchestration (pipeline)** | — | 15s global | Coordena os 4 acima |

**Laboratorista (5o agente):** **NAO implementado.** Reservado pra fase 2 — cruzaria exames recentes com queixa pra reforcar/descartar hipoteses.

### 7.2 Base de conhecimento — TODOS os JSONs em backend/knowledge/

```
backend/knowledge/
├── _version.json
├── _red_flags_transversais.json
├── _farmacologia/
│   ├── classes.json
│   └── sinonimos.json
├── ansiedade/
├── cefaleia/                       <- UNICA QUEIXA TOTALMENTE ESTRUTURADA
│   ├── _diretriz_source.md
│   ├── _version.json
│   ├── cefaleia_secundaria.json
│   ├── cluster.json
│   ├── enxaqueca_com_aura.json
│   ├── enxaqueca_sem_aura.json
│   └── tensional_cronica.json
├── diarreia/
├── dispneia/
├── disuria/
├── dor_abdominal/
├── dor_articular/
├── dor_lombar/
├── dor_toracica/
├── edema/
├── fadiga/
├── febre/
├── insonia/
├── lesao_pele/
├── palpitacao/
├── perda_peso/
├── prurido/
├── tontura/
├── tosse/
└── vomito/
```

**Cobertura real:** so `cefaleia` tem JSONs estruturados (5 condicoes). As outras 19 pastas existem mas estao **VAZIAS** (so estrutura preparada).

**`_version.json`:**
```json
{
  "pipeline_version": "padroes_v1.1",
  "last_updated": "2026-04-23",
  "queixas_disponiveis": ["cefaleia", "dor_toracica", "dispneia", "febre", ...],
  "regras_duras": {
    "score_minimo": 60,
    "sinais_bateram_minimo": 3,
    "exige_fonte_prioridade": [1, 2],
    "linguagem_diagnostica_proibida": ["paciente tem", "diagnóstico de", "é X", "sofre de"],
    "sempre_exibir_disclaimer": true,
    "versao_base_imutavel_por_card": true
  }
}
```

**Pegadinha:** o manifest fala "20 queixas cobertas, ~55 condicoes" mas apenas cefaleia esta implementada. Manifest e otimista demais.

### 7.3 Threshold: score>=60, sinais>=3

```javascript
// compliance.js:12-13
const SCORE_MINIMO = 60;
const SINAIS_MIN = 3;
```

Cards que nao atingem ambos sao rejeitados pelo compliance.

### 7.4 Os 4 blocos visuais

| Bloco | Cor frontend | Conteudo |
|---|---|---|
| **critico_topo** | Vermelho topo | Alerta farmacologico critico (alergia x med) |
| **alerta_farmaco** | Vermelho | Outros alertas farmacologicos (alta severidade) |
| **auto_medicacao** | Amarelo | Medicamento mencionado no audio mas nao no perfil |
| **padrao_diferencial** | Roxo | Top 3 condicoes diferenciais com score |
| **red_flag_separado** | Vermelho fora | Sinal de alarme (febre, deficit neuro, dor súbita) |

### 7.5 Estrutura de cada card (formato exato)

```javascript
{
  id: 'AUD-20260514120030-CXXXX',
  tipo: 'alergia_medicamento' | 'auto_medicacao' | 'diferencial' | 'red_flag_consolidado',
  severidade: 'critica' | 'alta' | 'media' | 'baixa',
  bloco_visual: 'critico_topo' | 'alerta_farmaco' | 'auto_medicacao' | 'padrao_diferencial' | 'red_flag_separado',

  // Para diferenciais
  condicao_id: 'cefaleia_enxaqueca_sem_aura',
  nome: 'Enxaqueca sem aura',
  nome_popular: 'Enxaqueca',
  cid10: 'G43.0',
  score: 78,
  prevalencia: { geral: 12, feminino_adulto: 18 },
  sinais_bateram: [
    { descricao: 'Dor pulsátil', peso: 4 },
    { descricao: 'Unilateral', peso: 4 },
    { descricao: 'Náusea associada', peso: 4 }
  ],
  sinais_ausentes: [
    { descricao: 'Fotofobia', peso: 4 }
  ],
  total_criterios: 9,

  // Comum a todos
  proximo_passo: 'Aplicar critérios ICHD-3 para enxaqueca sem aura...',
  fonte: {
    titulo: 'Diretrizes da Sociedade Brasileira de Cefaleia 2022',
    ano: 2022,
    url: 'https://sbcefaleia.com.br/diretrizes-2022',
    secao: 'Enxaqueca sem aura, capítulo 3',
    tipo: 'diretriz_sociedade_medica_br',
    prioridade: 1
  },
  fonte_complementar: { /* ... */ },
  base_version: 'cefaleia/cefaleia_enxaqueca_sem_aura_v1.0',
  nivel_evidencia: 'A' | 'B' | 'C',
  modificador_aplicado: 2,
  disclaimer: 'Sugestao de apoio a decisao baseada em literatura clinica. Nao constitui diagnostico. Ato medico privativo (CFM Resolucao 2.299/2021).'
}
```

### 7.6 Pseudonimizacao antes do Claude (LGPD Art. 11)

```javascript
// anamnesista.js:30-37
function pseudonimizar(texto) {
  if (!texto) return '';
  return String(texto)
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF_REMOVIDO]')
    .replace(/\b\d{2}\s?\d{4,5}-?\d{4}\b/g, '[TEL_REMOVIDO]')
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[EMAIL_REMOVIDO]');
}
```

**3 regex:**
1. CPF: `\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b`
2. Telefone BR: `\b\d{2}\s?\d{4,5}-?\d{4}\b` (DDD + 4 ou 5 + 4 digitos)
3. Email: `\b[\w.+-]+@[\w-]+\.[\w.-]+\b`

**Aplicado em:** texto da transcricao antes de mandar pro Claude no Anamnesista. **NAO aplicado** em respostas do formulario (decisao de design — formulario tem campos estruturados, baixo risco).

### 7.7 Feature flag PADROES_V2_ENABLED

> Variavel de ambiente. Default OFF (dark launch).

```javascript
// padroes/index.js (referencia)
function enabled() {
  return process.env.PADROES_V2_ENABLED === 'true';
}
```

**Pipeline so roda se enabled === true.** Caso contrario, summary v1 e o unico ativo.

Frontend (desktop/app.html) detecta presenca de `summaryJson.padroesObservados_v2`:
- Se presente -> renderiza cards v2
- Se ausente -> renderiza v1 legado (campo `pontosAtencao` + `identificaPadroes`)

**Rollback em < 60s:** mudar var no Railway, redeploya automatico, sistema volta pro legado.

### 7.8 Disclaimer CFM 2.299/2021 obrigatorio

```javascript
// compliance.js:71-75
function aplicarDisclaimer(card) {
  const disclaimerPadrao = 'Sugestao de apoio a decisao baseada em literatura clinica. Nao constitui diagnostico. Ato medico privativo (CFM Resolucao 2.299/2021).';
  if (!card.disclaimer) card.disclaimer = disclaimerPadrao;
  return card;
}
```

Aplicado a TODOS os cards aprovados. Cards farmacologicos tem disclaimer proprio mais especifico.

### 7.9 Detector de queixa principal

```javascript
// matching.js:37-65
function detectarQueixa(anamnese) {
  const q = (anamnese.queixa_principal || '').toLowerCase();
  const mapa = {
    cefaleia: ['cefaleia', 'dor de cabeca', 'dor na cabeca', 'dor cabeca', 'enxaqueca'],
    dor_toracica: ['dor no peito', 'dor toracica', 'dor peito'],
    dor_abdominal: ['dor abdominal', 'dor barriga', 'dor na barriga'],
    febre: ['febre', 'febril'],
    tosse: ['tosse', 'tossindo'],
    dispneia: ['falta de ar', 'dispneia'],
    dor_lombar: ['dor nas costas', 'lombalgia', 'dor lombar'],
    tontura: ['tontura', 'vertigem'],
    dor_articular: ['dor articular', 'dor junta', 'dor joelho'],
    diarreia: ['diarreia'],
    vomito: ['vomito', 'nausea persistente'],
    fadiga: ['fadiga', 'cansaco'],
    perda_peso: ['perda de peso', 'emagrecimento'],
    palpitacao: ['palpitacao', 'coracao acelerado'],
    edema: ['inchaco', 'edema'],
    disuria: ['dor ao urinar', 'ardencia ao urinar', 'disuria'],
    prurido: ['coceira', 'prurido'],
    lesao_pele: ['lesao de pele', 'mancha na pele', 'erupcao'],
    ansiedade: ['ansiedade', 'crise de ansiedade'],
    insonia: ['insonia', 'nao durmo'],
  };
  for (const [queixa, termos] of Object.entries(mapa)) {
    if (termos.some(t => q.includes(t))) return queixa;
  }
  return null;
}
```

**Pegadinha:** se queixa nao bate em nenhum termo, retorna `null`. Pipeline retorna 0 candidatos e segue.

### 7.10 Red flags transversais (SNOOP)

```javascript
// matching.js:192-217
function verificarRedFlags(anamnese, contexto) {
  const flags = [];
  const texto = [
    anamnese.queixa_principal,
    anamnese.inicio_dor,
    ...(anamnese.sintomas_associados || []),
    ...(anamnese.fatores_piora || []),
    anamnese.padrao_temporal,
  ].filter(Boolean).join(' ').toLowerCase();

  const mapa = {
    inicio_subito_severo: ['subito', 'pior dor da vida', 'thunderclap', 'em segundos'],
    deficit_neurologico: ['fraqueza braco', 'fraqueza perna', 'fala enrolada', 'desvio boca', 'visao dupla', 'deficit focal', 'dormencia'],
    febre_associada: ['febre'],
    rigidez_nuca: ['rigidez nuca', 'pescoco duro'],
    piora_valsalva: ['valsalva', 'tossir', 'piora ao abaixar'],
    progressiva_semanas: ['progressiva', 'piorando todo dia', 'crescente'],
    idade_primeira_crise_maior_50: contexto.idade >= 50 ? ['primeira vez', 'nunca tive'] : [],
    alteracao_consciencia: ['alteracao consciencia', 'confusao mental', 'desmaio'],
  };

  for (const [flag, termos] of Object.entries(mapa)) {
    if (termos.some(t => texto.includes(t))) flags.push(flag);
  }
  return flags;
}
```

Os "red flags" sao **transversais** — aplicam a qualquer queixa, nao so cefaleia.

### 7.11 Avaliacao de criterios (operadores)

```javascript
// matching.js:68-114
function avaliarCriterio(criterio, contexto) {
  const { campo, operador, valor } = criterio;
  // ... resolve campo
  switch (operador) {
    case 'equals': return Array.isArray(dado) ? dado.includes(valLow[0]) : dado === valLow[0];
    case 'contains': /* ... */
    case 'contains_any': /* ... */
    case 'not_contains_any': /* ... */
    case '>=': return Number(dado) >= Number(valor);
    case '>': return Number(dado) > Number(valor);
    case '<=': return Number(dado) <= Number(valor);
    case '<': return Number(dado) < Number(valor);
    case 'range': /* faixa numerica */
  }
}
```

9 operadores suportados. Cada criterio nos JSONs tem `{campo, operador, valor, peso, descricao}`.

### 7.12 Modificadores demograficos (eval inseguro)

```javascript
// matching.js:116-128
function avaliarModificador(mod, contexto) {
  try {
    const expr = mod.condicao;
    const ctx = { sexo: contexto.sexo, idade: contexto.idade };
    const cleaned = expr
      .replace(/sexo==(\w+)/g, (_, v) => `'${ctx.sexo}' === '${v}'`)
      .replace(/idade([<>=!]+)(\d+)/g, (_, op, v) => `${ctx.idade} ${op} ${v}`);
    return eval(cleaned); // eslint-disable-line no-eval
  } catch (e) {
    return false;
  }
}
```

**Pegadinha grave:** usa `eval()`. Os JSONs sao CONFIAVEIS (escritos pela equipe), mas se algum dia for permitido carregar JSONs externos, isso vira RCE (remote code execution). **Mitigacao para v3:** trocar por avaliador AST seguro (jsep + interpretacao manual).

Exemplo: `"sexo==feminino && idade>=25 && idade<=55"` vira:
`'feminino' === 'feminino' && 26 >= 25 && 26 <= 55` -> `true`

### 7.13 Score formula

```javascript
// matching.js:148-169
for (const crit of (condicao.criterios_positivos || [])) {
  const bateu = avaliarCriterio(crit, contexto);
  scoreMax += crit.peso || 1;
  if (bateu) {
    scoreAtual += crit.peso || 1;
    sinaisBateram.push({ descricao: crit.descricao, peso: crit.peso });
  }
}

// Modificadores demográficos
let modificador = 0;
for (const mod of (condicao.modificadores_demograficos || [])) {
  if (avaliarModificador(mod, contexto)) {
    modificador += mod.peso_extra || 0;
  }
}
scoreAtual += modificador;

const scoreFinal = scoreMax > 0 ? Math.round((scoreAtual / scoreMax) * 100) : 0;
```

**Formula:**
```
score = round((soma_pesos_bateram + modificador) / soma_pesos_max * 100)
```

Clampado 0-100. **Exemplo cefaleia/enxaqueca (sem aura):**

Paciente feminina 30a com dor pulsátil unilateral + nausea + fotofobia + piora esforco:
- Pulsatil (peso 4): ✓ +4
- Unilateral (peso 4): ✓ +4
- Intensidade >=5 (peso 3): nao informada -> ✗
- Nausea (peso 4): ✓ +4
- Fotofobia (peso 4): ✓ +4
- Fonofobia (peso 3): nao mencionada -> ✗
- Piora esforco (peso 3): ✓ +3
- Historico familiar enxaqueca (peso 2): nao mencionado -> ✗
- Duracao 4-72h (peso 2): nao mencionada -> ✗

scoreMax = 4+4+3+4+4+3+3+2+2 = 29
scoreAtual = 4+4+4+4+3 = 19
modificador (feminina 25-55) = +2
score = (19+2)/29 * 100 = 72

Sinais bateram = 5 (>=3 minimo). Score 72 (>=60 minimo). **PASSA no compliance.**

### 7.14 Exclusao + contraindicacao gestacao

```javascript
// matching.js:130-141
function avaliarCondicao(condicao, contexto) {
  for (const exc of (condicao.criterios_exclusao || [])) {
    if (avaliarCriterio(exc, contexto)) {
      return { elegivel: false, motivo_exclusao: exc.motivo };
    }
  }

  if (contexto.perfil?.gestante && condicao.contraindicacao_gestacao) {
    return { elegivel: false, motivo_exclusao: 'Condicao contraindica em gestacao' };
  }
  // ...
}
```

**Exemplo:** Enxaqueca sem aura tem `criterios_exclusao: [{campo: 'duracao_dias', operador: '>', valor: 7, motivo: 'Enxaqueca tipica nao persiste >7 dias sem alivio'}]`. Se paciente fala "dor de cabeca ha 2 semanas continuo", enxaqueca e ELIMINADA do ranking.

### 7.15 Compliance — linguagem proibida

```javascript
// compliance.js:16-22
const LINGUAGEM_PROIBIDA = [
  /\bpaciente tem\b/i,
  /\bdiagn[oó]stico de\b/i,
  /\b[ée] uma? \w+\b(?!.*considerar)/i,
  /\bsofre de\b/i,
  /\bconfirm[ao] (?:o )?(?:diagn[oó]stico|doen[çc]a)\b/i,
];
```

Se algum texto livre do card (`proximo_passo`, `mensagem`, `acao_sugerida`) bate em algum regex, card e REJEITADO. Garante linguagem nao-diagnostica.

---

## 8. Metricas honestas do medico (Sessao 22)

> Arquivos:
> - `backend/src/services/completude.js` (138 linhas)
> - `backend/src/services/calcularMetricas.js` (202 linhas)
> - `backend/src/routes/medico.js` (rotas `GET /medico/metricas`, `PUT /medico/metricas/setup`, `POST /medico/metricas/calibracao`)

### 8.1 5 inputs declarativos no setup do medico

Salvos em `Medico.metricasConfig` (campo JSON). Os 5 campos:

| Campo | Descricao | Exemplo |
|---|---|---|
| `tempoAnamneseSemVitae` | minutos que medico gasta em anamnese tradicional | 12 |
| `percentualEconomiaAnamnese` | quanto % vita id economiza desse tempo | 70 |
| `tempoMedioConsulta` | minutos de uma consulta completa | 25 |
| `valorConsulta` | reais cobrados por consulta | 250 |
| `taxaNoShow` | % de pacientes que faltam | 15 |

Sem multiplicadores hardcoded (5x semana, 21x mes). Sem fator universal (0.7). Cada medico declara seu proprio %.

### 8.2 Completude 0-100% (11 campos)

```javascript
// completude.js:86-133
function calcularCompletude(preConsulta) {
  if (!preConsulta) return 0;

  if (preConsulta.status === 'PENDENTE' || preConsulta.status === 'ABERTO' ||
      preConsulta.status === 'EXPIRADA') {
    return 0;
  }

  const sj = preConsulta.summaryJson || {};
  const anam = sj.anamneseEstruturada || sj.anamnese_estruturada;

  if (anam && typeof anam === 'object') {
    let preenchidos = 0;
    for (const campo of CAMPOS_ANAMNESE_11) {
      const valor = extrairValor(anam[campo]);
      if (ehPreenchido(valor)) preenchidos++;
    }
    return Math.round((preenchidos / 11) * 100);
  }

  // 2. Fallback: respostas com chaves nomeadas
  // 3. Legado: array de respostas livres (status RESPONDIDA com >=5 keys = 50%; >=1 key = 25%)
}
```

**Tres fontes (prioridade):**
1. `summaryJson.anamneseEstruturada` (preferido — Sessao 13)
2. `respostas` com chaves nomeadas (queixaPrincipal, etc — fallback)
3. Legado: array de respostas livres -> 50% se status=RESPONDIDA e >=5 keys, 25% se >=1 key

### 8.3 ehPreenchido (heuristica)

```javascript
// completude.js:40-57
const VALORES_VAZIOS = new Set([
  '', '—', '-', '–', 'n/a', 'na', 'nao sei', 'não sei',
  'nao informado', 'não informado', 'pulado', 'desconhecer',
  'desconheço', 'sem informacao', 'sem informação',
]);

function ehPreenchido(valor) {
  if (valor == null) return false;
  const texto = String(valor).trim().toLowerCase();
  if (texto.length < 3) return false;
  if (VALORES_VAZIOS.has(texto)) return false;
  // Pelo menos 3 caracteres alfanuméricos (filtra "...", "???", etc)
  const alfa = texto.replace(/[^a-z0-9áéíóúâêôãõç]/gi, '');
  return alfa.length >= 3;
}
```

**Regras:**
- null/undefined -> false
- string com <3 chars trimados -> false
- valores em VALORES_VAZIOS -> false
- precisa >=3 caracteres alfanumericos (filtra "...", "???", "—")

### 8.4 Pipeline em centesimos (evita float)

```javascript
// calcularMetricas.js:135-155
let centésimosTotais = 0;
let consultasMedidas = 0;
let somaCompletude = 0;

for (const pc of lista) {
  if (pc.status !== 'RESPONDIDA') continue;
  const completude = calcularCompletude(pc); // 0-100
  if (completude <= 0) continue;

  // tempoAnamneseSemVitae × (completude/100) × (percentualEconomiaAnamnese/100) × 100 (centésimos)
  const centésimosDessaConsulta = Math.round(
    (setup.tempoAnamneseSemVitae * completude * setup.percentualEconomiaAnamnese) / 100
  );

  centésimosTotais += centésimosDessaConsulta;
  consultasMedidas++;
  somaCompletude += completude;
}

// Arredonda pra baixo (conservador)
let tempoEconomizadoMin = Math.floor(centésimosTotais / 100);
```

**Por que centesimos:** evita erro de float classico:
```
5 × 8.4 = 41.999999999... -> Math.floor = 41 (errado)
```

Trabalhando em centesimos (multiplicando por 100), tudo vira inteiro: `5 × 840 = 4200 cents = 42 min`.

### 8.5 Formula completa

```
Tempo economizado (min) = floor( sum_por_PC(
    tempoAnamneseSemVitae × completude × percentualEconomiaAnamnese
  ) / 100 / 100 )
```

= `floor( SUM(T × C × E / 10000) )` onde T=tempo, C=completude%, E=economia%.

```
Atendimentos a mais possiveis = floor( tempoEconomizadoMin / tempoMedioConsulta )

Receita possivel (R$) = floor( atendimentosEquivalentes × valorConsulta × (1 - taxaNoShow/100) )
```

**Exemplo:** 5 PCs respondidas, todas com 100% completude, T=12, E=70%, tempoConsulta=25, valor=250, noShow=15%:
- Cada PC: 12 × 100 × 70 = 84000 / 100 = 840 cents = 8.4 min
- Total: 5 × 840 = 4200 cents = 42 min
- Atendimentos extras: floor(42/25) = 1
- Receita: floor(1 × 250 × 0.85) = 212

### 8.6 Indicador 4 faixas (precisao)

```javascript
// calcularMetricas.js:62-72
function calcularPrecisao(consultasMedidas) {
  if (consultasMedidas <= 0) return 0;
  if (consultasMedidas < 10) return 50 + Math.round(consultasMedidas * 2); // 50-68%
  if (consultasMedidas < 30) return 70 + Math.round((consultasMedidas - 10) * 0.75); // 70-85%
  if (consultasMedidas < 60) return 85 + Math.round((consultasMedidas - 30) * 0.23); // 85-92%
  return Math.min(95, 92 + Math.round((consultasMedidas - 60) * 0.05)); // 92-95%
}
```

| Faixa | PCs medidas | Confianca |
|---|---|---|
| 1 | 0-9 | 50-68% |
| 2 | 10-29 | 70-85% |
| 3 | 30-59 | 85-92% |
| 4 | 60+ | 92-95% |

**Maximo 95%** — sistema NUNCA mostra 100% (honestidade — sempre tem margem de erro).

### 8.7 Calibracao mensal opt-in

> Rotas: `POST /medico/metricas/calibracao`

Banner aparece se:
- Passou >=30 dias da ultima calibracao, OU
- Passou >=10 PCs sem nunca calibrar

Medico clica -> 3 opcoes:
1. "Subestimado" -> sugere aumentar `percentualEconomiaAnamnese` em 5pp
2. "OK" -> mantem
3. "Superestimado" -> sugere reduzir 5pp

**Calibracao opt-in** porque forcar ajuste fere honradez (medico pode confiar mais nos numeros se ele controla).

### 8.8 Renomeacoes honestas (Sessao 22)

| Antes | Depois |
|---|---|
| "Atendimentos a mais possíveis" | "Tempo livre equivalente a X consultas" |
| "Receita potencial" | "Receita possível" (e ja desconta no-show) |

Razao: o medico nao realmente atendeu mais — ele tem tempo equivalente. Diferenca subtil mas honesta.

### 8.9 Setup incompleto -> banner

```javascript
// calcularMetricas.js:115-130
if (!completo) {
  return {
    periodo,
    setupConcluido: false,
    alerta: 'Configure suas informações no perfil pra liberar as métricas.',
    camposFaltando: faltando,
    tempoEconomizadoMin: 0,
    atendimentosEquivalentes: 0,
    receitaPossivel: 0,
    precisao: 0,
    // ...
  };
}
```

Defensivo: codigo evita quebra antes da migration ser aplicada — sistema retorna setup vazio + banner pra todos os medicos novos.

### 8.10 4 periodos (janelas de tempo)

```javascript
// calcularMetricas.js:29-60
function janelaPeriodo(periodo) {
  const agora = new Date();
  const fim = new Date(agora);

  let inicio;
  switch (periodo) {
    case 'hoje':
      inicio = new Date(agora);
      inicio.setHours(0, 0, 0, 0);
      break;
    case 'semana':
      // Últimos 7 dias rolling (não semana calendário)
      inicio = new Date(agora);
      inicio.setDate(inicio.getDate() - 7);
      break;
    case 'mes':
      // Mês corrente (dia 1 ao agora)
      inicio = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
      break;
    case '30dias':
    default:
      // Rolling 30 dias
      inicio = new Date(agora);
      inicio.setDate(inicio.getDate() - 30);
      break;
  }
  return { dataInicio: inicio, dataFim: fim };
}
```

**Pegadinha:** "semana" e ULTIMOS 7 DIAS (rolling), nao semana calendario. "mes" e mes corrente (dia 1 ao agora). "30dias" e rolling.

---

## 9. QR Code + RG publico + Autorizacao

> Arquivos:
> - `21-qrcode.html` (261 linhas — paciente ve seu QR)
> - `rg-publico.html` (546 linhas — quem escaneia o QR ve isso, sem login)
> - `22-autorizacao.html` — gerenciar autorizacoes
> - `backend/src/routes/autorizacao.js` (referencia)

### 9.1 Algoritmo de geracao do token QR

O QR Code aponta pra URL `https://vitae-app.vercel.app/rg-publico.html?token=XXX`. O token e gerado backend e armazenado em `AutorizacaoAcesso.tokenAcesso` (campo unique).

```javascript
// pseudo-codigo (encontrar em autorizacao.js)
const crypto = require('crypto');
const tokenAcesso = crypto.randomBytes(24).toString('hex'); // 48 chars hex
```

**Formato:** 48 caracteres hexadecimais. Espaco amostral: 2^192 (suficiente pra ser impossivel adivinhar).

### 9.2 LEITURA vs COMPLETO — diferenca pratica

`AutorizacaoAcesso.tipoAcesso` tem 2 valores:

| Tipo | Categorias acessiveis | Uso |
|---|---|---|
| **LEITURA** | exames, perfil, pre-consultas, alergias, medicamentos | QR padrao do paciente — qualquer medico ve emergencia |
| **COMPLETO** | tudo + agenda, autorizacao, timeline | Medico que tem vinculo continuo |

**Como decide:**
- QR generico (paciente apresenta em emergencia): `LEITURA`
- Autorizacao especifica medico ↔ paciente (apos pre-consulta): `LEITURA` por padrao
- Upgrade a `COMPLETO`: paciente faz explicitamente na tela 22

### 9.3 Categorias selecionaveis

```javascript
// schema.prisma (AutorizacaoAcesso)
categorias: String[] @default(['exames', 'perfil', 'pre-consultas'])
```

Categorias hoje suportadas:
- `exames`
- `perfil` (dados pessoais)
- `pre-consultas`
- `alergias`
- `medicamentos`
- `condicoes`
- `agenda`
- `timeline`

Default: `['exames', 'perfil', 'pre-consultas']`.

### 9.4 Validacao do token no rg-publico.html

```javascript
// rg-publico.html (logica)
const params = new URLSearchParams(window.location.search);
const token = params.get('token');

const r = await fetch(`${API_URL}/autorizacao/dados/${token}`);
if (r.status === 404) mostrarErro('Token nao encontrado');
if (r.status === 410) mostrarErro('Autorizacao expirada');
if (r.status === 403) mostrarErro('Autorizacao revogada');
```

Backend rota `GET /autorizacao/qr-data/:token` retorna dados se token valido + nao expirado + nao revogado.

### 9.5 Expiracao

```javascript
// pre-consulta.js:79 (cria automaticamente apos pre-consulta)
const expiraEm = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
```

Default: **180 dias** apos criacao. Renovado a cada interacao do paciente com aquele medico.

QR generico (paciente cria manualmente): default 1 ano (procurar em autorizacao.js).

### 9.6 Revogacao

```javascript
// autorizacao.js
DELETE /autorizacao/:id
// Marca revogadoEm = now, NAO deleta registro (audit trail)
```

Soft-delete. Apos revogadoEm preenchido, qualquer requisicao com aquele token retorna 403.

### 9.7 Audit trail

Cada acesso ao token e logado em `LogAuditoria` (procurar tabela). Inclui:
- `tokenAcesso`
- IP + user-agent de quem acessou
- Timestamp
- Categorias acessadas

Permite paciente ver "Quem acessou meu RG digital nas ultimas X horas".

---

## 10. Lembretes de medicamento (30-lembretes.html)

> Arquivo: `30-lembretes.html` (305 linhas)
>
> Backend: rotas `POST /lembretes/registrar-tomada`, `GET /lembretes/historico` (procurar em routes/medicamentos.js ou rota dedicada)

### 10.1 Definicao de horarios

`Medicamento.horario` e string livre que pode ter formatos:
- "Manha" / "Noite" / "Manha e Noite" (pre-definidos)
- "08:00, 14:00, 20:00" (multiplos horarios)
- Texto livre

A tela 30-lembretes parseia e mostra cards por horario.

### 10.2 Rastreamento de adesao

Tabela referencia: `RegistroTomada` (encontrar no schema, possivelmente nao implementado ainda)

```sql
RegistroTomada {
  id, medicamentoId, usuarioId,
  horarioPrevisto (datetime),
  horarioReal (datetime null),
  status ('TOMADO' | 'PULADO' | 'ATRASADO'),
  criadoEm
}
```

### 10.3 Janela "atrasado"

Logica: se `horarioPrevisto` ja passou e `horarioReal` ainda null:
- 0-15min apos previsto: status ainda `PENDENTE`
- 15min-2h apos: status `ATRASADO` (badge amarelo)
- >2h apos: status `PERDIDO` (badge vermelho ou apaga visual)

**NAO encontrado** explicitamente no codigo atual. Logica e provavelmente client-side (calcula no momento de renderizar).

### 10.4 Push notifications

> Encontrado em `backend/src/services/agenda/push.js`. Web Push API (VAPID).

**Rotas:**
- `GET /agenda/push/vapid-public-key` (retorna chave publica)
- `POST /agenda/push/subscribe` (registra Subscription)
- `DELETE /agenda/push/subscribe` (unsubscribe)

**Pre-requisito:** `web-push` package instalado, `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` em env.

Backend dispara push pra cada lembrete agendado. Tela 30-lembretes pede permissao na primeira entrada.

---

## 11. Detector in-app browser (WhatsApp/IG/FB)

> Arquivo: `pre-consulta.html` (referencia da Sessao 11)

### 11.1 Codigo exato

```javascript
// pre-consulta.html (Sessao 11)
function detectarInAppBrowser() {
  const ua = navigator.userAgent.toLowerCase();
  const patterns = [
    'wv',                // Android WebView genérico
    'fb_iab', 'fbav',    // Facebook in-app
    'instagram',         // Instagram in-app
    'whatsapp',          // WhatsApp in-app (iOS)
    'wechat',
    'twitter',
    'linkedin',
    'line/',
    'micromessenger',    // WeChat
  ];
  return patterns.some(p => ua.includes(p));
}

if (detectarInAppBrowser()) {
  document.getElementById('inAppWarning').style.display = 'block';
  document.getElementById('mainContent').style.display = 'none';
}
```

### 11.2 Razao do bloqueio

- **WhatsApp/Instagram/Facebook iOS:** desativam Google Sign-In (Google bloqueia OAuth em in-app browser por seguranca)
- **WhatsApp iOS:** suspende `MediaRecorder` quando app vai pra background
- **Todos:** permissoes de microfone/camera comportam diferente

### 11.3 Mensagem mostrada

```
"Abra no seu navegador

Pra pre-consulta funcionar bem (gravar audio, fazer login), abra esse link no Chrome (Android) ou Safari (iPhone).

[Botao: Copiar link]
[Botao: Como abrir no navegador?]"
```

### 11.4 Helpers

```javascript
function copiarLink() {
  navigator.clipboard.writeText(window.location.href);
  toast('Link copiado. Cola no Chrome ou Safari pra continuar.');
}
```

---

## 12. Wake Lock + Visibilitychange + iOS Safari

### 12.1 Wake Lock API (iOS 16.4+)

```javascript
let wakeLockSentinel = null;

async function pedirWakeLock() {
  if (!('wakeLock' in navigator)) return null;
  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => {
      // pode ser solto se app vai pra background — tentar pegar de novo
    });
    return wakeLockSentinel;
  } catch (e) {
    console.warn('Wake Lock falhou:', e.message);
    return null;
  }
}

async function liberarWakeLock() {
  if (wakeLockSentinel) {
    await wakeLockSentinel.release();
    wakeLockSentinel = null;
  }
}
```

### 12.2 Banner "mantenha tela acesa"

```javascript
function detectarIOSSemWakeLock() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (!isIOS) return false;
  // Wake Lock so chegou no iOS 16.4
  const ver = parseFloat((navigator.userAgent.match(/OS (\d+_\d+)/) || [])[1]?.replace('_', '.') || '0');
  return ver < 16.4;
}

if (detectarIOSSemWakeLock()) {
  document.getElementById('bannerTelaAcesa').style.display = 'block';
}
```

Mensagem: "Mantenha a tela acesa durante a gravacao. Se sua tela bloquear, o audio para."

### 12.3 ITP 7 dias Safari (Intelligent Tracking Prevention)

Safari iOS 12+ apaga cookies/localStorage **third-party** apos 7 dias sem visita. Cookies/localStorage **first-party** (mesmo dominio) NAO sao afetados.

**Mitigacao no vita id:**
- Domain unico (`vitae-app.vercel.app`) — first-party
- Tokens JWT em localStorage
- Sem cookies HttpOnly (logo, sem ITP impact)

**Pegadinha:** se vita id usar dominios diferentes (preview Vercel, dominio custom), ITP pode apagar tokens da subdomain antiga.

### 12.4 Visibilitychange (auto-pause)

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // App foi pra background
    if (mediaRecorder?.state === 'recording') {
      pauseRecording(true); // true = automatica, nao queima cap
    }
  } else {
    // App voltou
    // NAO retoma automaticamente — paciente clica pra continuar
  }
});
```

**Razao:** iOS Safari mata MediaRecorder em background. Auto-pause salva o chunk atual antes de morrer.

### 12.5 onerror handler (bluetooth/ligacao)

```javascript
mediaRecorder.onerror = (event) => {
  console.error('MediaRecorder erro:', event.error);
  pauseRecording(true); // pausa automatica
  toast('Algo aconteceu com seu microfone. Toque pra continuar.');
};
```

Dispara quando:
- Bluetooth desconecta no meio
- Chamada telefonica entra (iOS)
- Permissao revogada
- Outro app pega o mic

---

## 13. Sanitizacao XSS

> Arquivo: `api.js:8-16`

### 13.1 Funcao sanitize

```javascript
// api.js:8-16
function sanitize(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

**5 substituicoes:**
| De | Para |
|---|---|
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |
| `'` | `&#039;` |

### 13.2 Onde aplica

Pesquisar uso de `sanitize(` no codebase. Aplicado em:
- Nomes de pacientes renderizados em HTML
- Conteudo de respostas livres
- Resumo IA antes de mostrar (defensive — IA nao deve gerar HTML mas defensivo)

**NAO usa innerHTML diretamente** com dados nao-sanitizados.

### 13.3 Pegadinha

Sanitize so protege contra XSS **se o conteudo for usado em texto** (textContent, innerHTML). Se for usado em **atributo HTML** (href, src, onclick), precisa de escape diferente. Em particular, `onclick=` com conteudo de usuario e SEMPRE vulneravel.

**Mitigacao no vita id:** event listeners adicionados via `addEventListener`, nunca inline. CSP nao implementado (procurar `Content-Security-Policy` headers).

---

## 14. Refresh token rotativo

> Arquivo: `api.js:152-180`

### 14.1 Configuracao

JWT: **30 dias** (HS256, secret em env)
Refresh token: **90 dias** (random 32 bytes, rotativo)

> Pegadinha do CLAUDE.md: "Auth: JWT 30 dias + refresh token 90 dias" — diferente de "15min + 30d" que o pedido do usuario sugeriu. **A versao correta e 30+90 dias.**

### 14.2 Rotacao do refresh token

```javascript
// pseudo-codigo backend (auth.js)
// /auth/refresh
const oldToken = await prisma.refreshToken.findUnique({ where: { token: req.body.refreshToken } });
if (!oldToken) return 401;
if (oldToken.expiraEm < new Date()) return 401;

// Gera novos
const newJWT = jwt.sign({...}, JWT_SECRET, { expiresIn: '30d' });
const newRefresh = crypto.randomBytes(32).toString('hex');

await prisma.refreshToken.update({
  where: { id: oldToken.id },
  data: {
    token: newRefresh,
    expiraEm: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  }
});

return { token: newJWT, refreshToken: newRefresh };
```

### 14.3 Frontend (api.js)

```javascript
// api.js:152-180
async function apiRequest(path, options = {}) {
  // ... primeira tentativa
  if (response.status === 401 && getRefreshToken()) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      // Retry com novo token
      headers['Authorization'] = `Bearer ${getToken()}`;
      const retryResponse = await fetch(`${API_URL}${path}`, { /* ... */ });
      return handleResponse(retryResponse);
    } else {
      logout();
      throw new Error('Sessao expirada');
    }
  }
}

async function refreshTokens() {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: getRefreshToken() }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    setTokens(data.token, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}
```

### 14.4 Logout (limpa tudo)

```javascript
// api.js:87-92
function logout() {
  localStorage.removeItem('vitae_token');
  localStorage.removeItem('vitae_refresh_token');
  localStorage.removeItem('vitae_usuario');
  window.location.href = '03-cadastro.html';
}
```

3 keys do localStorage:
- `vitae_token`: JWT
- `vitae_refresh_token`: refresh token
- `vitae_usuario`: objeto Usuario JSON

---

## 15. Google Sign-In

### 15.1 Setup atual

`google.accounts.oauth2.initTokenClient` (popup, sem redirect). Usado em `03-cadastro.html`.

```javascript
// 03-cadastro.html (pseudo-codigo)
const client = google.accounts.oauth2.initTokenClient({
  client_id: GOOGLE_CLIENT_ID,
  scope: 'profile email',
  callback: async (response) => {
    const access_token = response.access_token;
    // Fetch user info do Google
    const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    }).then(r => r.json());

    // Manda pro backend
    const data = await vitaeAPI.loginSocial('google', access_token, userInfo.name, userInfo.email);
    // ...
  }
});

document.getElementById('btnGoogle').onclick = () => client.requestAccessToken();
```

### 15.2 Bug historico redirect_uri_mismatch (Sessao 14)

**Sintoma:** Erro 400 redirect_uri_mismatch em accounts.google.com ao clicar "Continuar com Google" em pre-consulta (do paciente Alvaro no iPhone, via link WhatsApp).

**Causa especulativa:** mesmo usando `initTokenClient` (popup, NAO redirect), o Google estava exigindo URI configurada. Provavelmente:
1. WhatsApp in-app browser muda comportamento
2. Preview deploy Vercel (vitae-app-git-*.vercel.app) nao listado no Console
3. OAuth Client tipo errado (deveria ser "Web application")

**Solucao operacional:** adicionar URLs extras no Google Cloud Console:
- `https://vitae-app.vercel.app` (origem)
- `https://vitae-app.vercel.app/03-cadastro.html` (redirect)
- `https://vitae-app.vercel.app/pre-consulta.html` (redirect, se aplicavel)
- `http://localhost:3000` (dev)

### 15.3 Backend rota /auth/login-social

```javascript
// auth.js POST /auth/login-social
{
  provider: 'google',
  providerToken: 'access_token_string',
  nome: 'Nome do usuario',
  email: 'email@example.com'
}

// 1. Valida providerToken contra Google
// 2. Verifica se email ja existe em Usuario
// 3a. Existe: gera JWT + refresh + retorna
// 3b. Nao existe: cria Usuario + PerfilSaude vazio + gera tokens
```

**Validacao backend** do providerToken: idealmente usar `google-auth-library` (npm) pra verificar ID token. **NAO implementado** (referencia Sessao 14). Hoje confia no token sem validacao backend (vulneravel a tokens forjados).

---

## 16. Pseudonimizacao LGPD

> Arquivos onde aplicado:
> - `backend/src/services/padroes/anamnesista.js:30-37`
> - `backend/src/services/iaCollab.js:50-60`

### 16.1 Funcao basica

```javascript
// anamnesista.js:30-37
function pseudonimizar(texto) {
  if (!texto) return '';
  return String(texto)
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF_REMOVIDO]')
    .replace(/\b\d{2}\s?\d{4,5}-?\d{4}\b/g, '[TEL_REMOVIDO]')
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[EMAIL_REMOVIDO]');
}
```

**3 regex aplicados em sequencia:**

1. **CPF:** `\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b`
   - Pega: `123.456.789-00`, `12345678900`, `123.456.78900`
   - NAO pega: `123-456-789-00` (formato com tracos)

2. **Telefone BR:** `\b\d{2}\s?\d{4,5}-?\d{4}\b`
   - Pega: `11999999999`, `11 99999-9999`, `(11) 99999-9999` (parcial)
   - NAO pega: `+5511999999999` (com codigo pais)

3. **Email:** `\b[\w.+-]+@[\w-]+\.[\w.-]+\b`
   - Pega qualquer formato padrao de email

### 16.2 No iaCollab

```javascript
// iaCollab.js:50-60
const anonimas = preConsultas.map((pc, i) => {
  const sj = pc.summaryJson || {};
  return {
    indice: i + 1,
    data: pc.respondidaEm || pc.criadoEm,
    queixaPrincipal: sj.queixaPrincipal || sj.descricaoBreve || '(não informado)',
    anamneseEstruturada: sj.anamneseEstruturada || null,
    summaryTexto: sj.summaryTexto || null,
  };
});
```

**Pseudonimizacao em iaCollab:** REMOVE nome do paciente, telefone, email do contexto enviado pra Claude Haiku. Mantem queixaPrincipal + anamneseEstruturada (que ja foram extraidos sem dados pessoais).

### 16.3 Hash SHA-256 do audio (prosodica)

```javascript
// prosodica.js:39-42
function hashAudio(audioBuffer) {
  if (!audioBuffer) return null;
  return crypto.createHash('sha256').update(audioBuffer).digest('hex');
}
```

**Para analise prosodica:** o audio NUNCA e salvo. Apenas:
1. Features extraidas (jitter, shimmer, F0, pausa)
2. Hash SHA-256 do audio (irreversivel — prova de origem)

Hash + features + timestamp formam **trilha de auditoria** que satisfaz CFM 2.314/2022 sem armazenar dado biometrico raw.

### 16.4 LGPD Art. 11 + Art. 18 (referencia)

- **Art. 11 (dados sensiveis):** dados de saude. Tratamento pode ser feito mediante consentimento OU exercicio regular de direitos OU tutela da saude por profissional de saude.
- **Art. 18 (direitos do titular):** confirmacao, acesso, correcao, anonimizacao, portabilidade, eliminacao, informacao sobre compartilhamento, revogacao de consentimento.

**Implementado no vita id:**
- `GET /medico/me/exportar-dados-lgpd` (portabilidade — JSON/CSV)
- `DELETE /medico/me` (eliminacao — soft-delete com janela 30 dias)
- Tabela `Consentimento` (registra IP/UA/timestamp)
- Tabela `LogAuditoria` (procurar — registra acessos)

**Para paciente:** rota equivalente nao encontrada. **Pendente fase 2.**

---

## 17. Workers assincronos (TarefaPendente)

> Arquivo: `backend/src/workers/processador.js` (577 linhas)

### 17.1 4 workers em processador.js

| Worker | Intervalo | Funcao |
|---|---|---|
| **tick (principal)** | 30s | Processa TarefaPendente (summary + TTS, agenda ofertar vaga) |
| **tickLembretes** | 2min | Lembretes 24h e 2h antes de slots da agenda |
| **tickNoShow** | 1h | Marca FALTA em slots passados nao atualizados |
| **tickGoogleSync** | 30min | Sincroniza Google Calendar de cada medico conectado |

```javascript
// processador.js:543-567
function iniciarWorker() {
  if (intervalHandle) return;
  setTimeout(() => {
    tick();
    intervalHandle = setInterval(tick, INTERVALO_MS);
  }, 10000);

  // Workers da agenda (so se feature flag ON; check no proprio tick)
  setTimeout(() => {
    tickLembretes();
    intervalLembretes = setInterval(tickLembretes, INTERVALO_LEMBRETES_MS);
  }, 15000);

  // No-show: 1x por hora
  setTimeout(() => {
    tickNoShow();
    intervalNoShow = setInterval(tickNoShow, 60 * 60 * 1000);
  }, 30000);

  // Google sync: 30 min
  setTimeout(() => {
    tickGoogleSync();
    intervalGcal = setInterval(tickGoogleSync, 30 * 60 * 1000);
  }, 60000);
}
```

**Delay inicial:** 10s/15s/30s/60s pra evitar todos rodarem no mesmo tick na inicializacao.

### 17.2 Concorrencia (flag rodando)

```javascript
// processador.js:415-440
let rodando = false;
async function tick() {
  if (rodando) return; // evita concorrencia
  rodando = true;
  try {
    const pendentes = await prisma.tarefaPendente.findMany({
      where: {
        processadoEm: null,
        dead: false,
        proximaTentativa: { lte: new Date() },
      },
      orderBy: { criadoEm: 'asc' },
      take: LIMITE_POR_CICLO,
    });
    if (pendentes.length === 0) return;
    console.log('[WORKER] tick:', pendentes.length, 'tarefa(s) pendentes');
    for (const t of pendentes) {
      await processarTarefa(t);
    }
  } catch (e) {
    console.error('[WORKER] tick erro:', e.message);
  } finally {
    rodando = false;
  }
}
```

**Pegadinha:** processa **sequencialmente** (`for of` com `await`). Razao: evita rate limit em IA/storage. Resultado: ate 5 tarefas por ciclo de 30s = max ~10 tarefas/min.

### 17.3 Backoff exponencial (lista hardcoded)

```javascript
// processador.js:26-30
function delayParaProximaTentativa(tentativas) {
  const minutos = [0.5, 2, 10, 30, 120];
  const m = minutos[Math.min(tentativas, minutos.length - 1)];
  return new Date(Date.now() + m * 60 * 1000);
}
```

| Tentativas | Delay ate proxima |
|---|---|
| 0 | imediato (primeira) |
| 1 | 30s |
| 2 | 2min |
| 3 | 10min |
| 4 | 30min |
| 5+ | 2h (mas marca DEAD apos 5a) |

### 17.4 5 tentativas -> DEAD

```javascript
// processador.js:389-400
if (novasTentativas >= MAX_TENTATIVAS) {
  // Dead letter — medico vai ver "Incompleta" no dashboard e pode pedir reenvio
  await prisma.tarefaPendente.update({
    where: { id: tarefa.id },
    data: {
      tentativas: novasTentativas,
      erro: String(err.message || err).substring(0, 500),
      dead: true,
      processadoEm: new Date(),
    },
  });
  console.error('[WORKER] tarefa', tarefa.id, 'DEAD apos', novasTentativas, 'tentativas');
}
```

`MAX_TENTATIVAS = 5`. Apos isso, `dead = true` e `processadoEm` preenchido (vira ignorada).

### 17.5 Validacao indispensaveis (2 tentativas summary)

```javascript
// processador.js:236-270
for (let tentativaSummary = 1; tentativaSummary <= 2; tentativaSummary++) {
  try {
    const resultado = await gerarSummaryPreConsulta(/* ... */);
    summaryJson = resultado;
    summaryIA = resultado.summaryTexto;

    const textoParaValidar = resultado.textoVoz || resultado.summaryTexto || '';
    validacao = validarIndispensaveis(textoParaValidar, contextoVal);

    if (validacao.ok) {
      console.log('[VALIDACAO] indispensaveis OK (tentativa', tentativaSummary + ')');
      break;
    } else {
      console.warn('[VALIDACAO] tentativa', tentativaSummary, '— faltou:', validacao.faltando.join(', '));
    }
  } catch (e) {
    if (tentativaSummary >= 2) {
      registrarFalha('ia_ambos_falharam', { /* ... */ });
      throw new Error('gerarSummary falhou: ' + e.message);
    }
  }
}
```

Se primeira chamada nao incluiu todos os indispensaveis (nome, idade, alergias, meds), tenta de novo. **Maximo 2 tentativas** — senao retorna degradado com flag.

### 17.6 Validador de indispensaveis

```javascript
// processador.js:78-116
function validarIndispensaveis(textoVoz, contexto) {
  const t = _norm(textoVoz);
  const faltando = [];

  // 1. NOME — pelo menos o primeiro nome
  if (contexto.pacienteNome) {
    const primeiroNome = _norm(contexto.pacienteNome.split(' ')[0]);
    if (primeiroNome && primeiroNome.length > 2 && !t.includes(primeiroNome)) {
      faltando.push(`nome "${primeiroNome}"`);
    }
  }

  // 2. IDADE — tem que mencionar "anos"
  if (contexto.idade && !t.includes('ano')) {
    faltando.push('idade (palavra "anos")');
  }

  // 3. ALERGIAS — cada alergia pelo nome
  if (Array.isArray(contexto.alergias) && contexto.alergias.length > 0) {
    for (const al of contexto.alergias) {
      const nome = _norm(al.nome || al);
      if (nome && nome.length > 2 && !t.includes(nome)) {
        faltando.push(`alergia "${nome}"`);
      }
    }
  }

  // 4. MEDICAMENTOS EM USO — cada med pelo nome
  if (Array.isArray(contexto.medicamentos) && contexto.medicamentos.length > 0) {
    for (const m of contexto.medicamentos) {
      const nome = _norm(m.nome || m);
      if (nome && nome.length > 2 && !t.includes(nome)) {
        faltando.push(`medicamento "${nome}"`);
      }
    }
  }

  return { ok: faltando.length === 0, faltando };
}
```

Garante que o briefing de 1min nao omite informacao critica. Razao: melhor briefing curto e completo que longo e omitindo alergia.

---

## 18. CORS exato

> Backend: provavelmente `backend/src/index.js` ou middleware/cors.js

### 18.1 Origens liberadas hoje

```javascript
// pseudo-codigo (procurar configuracao real)
const allowedOrigins = [
  'https://vitae-app.vercel.app',           // producao Vercel
  'https://vitaehealth2906-ops.github.io',  // GitHub Pages (descontinuado em Sessao 21)
  'http://localhost:3000',                  // dev local frontend
  'http://localhost:3002',                  // dev local backend (chamadas internas)
  'http://127.0.0.1:3000',
];
```

### 18.2 Headers permitidos

```javascript
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS bloqueado'));
    }
  },
  credentials: false, // JWT em header, nao cookie
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

### 18.3 Como adicionar app v3

Quando app v3 subir em novo dominio (ex: `https://vita-id-v3.vercel.app`):

1. Adicionar URL na lista `allowedOrigins` em `backend/src/index.js`
2. Redeploy backend
3. Testar com preflight request

**Atencao:** Vercel preview deploys (URLs tipo `vita-id-git-branch-xxx.vercel.app`) NAO sao automaticamente liberados. Solucoes:
- Regex match (`/\.vercel\.app$/`) — risco maior
- Adicionar manualmente cada preview (tedioso)
- Variavel env `EXTRA_CORS_ORIGINS` (recomendado)

---

## 19. Compressao de fotos

### 19.1 Locais onde compressao acontece

| Tela | Max width | Max height | Quality | Razao |
|---|---|---|---|---|
| **27-processando.html** (scan receita/alergia) | 1600px | 2400px | 0.75 | OCR precisa de detalhe |
| **05-quiz.html** (foto perfil onboarding) | 1200px | — | 0.8 | Avatar |
| **quiz-preconsulta.html** (foto pre-consulta) | 1200px | — | 0.8 | Avatar |
| **pre-consulta.html** (foto + audio) | 1200px | — | 0.8 | Avatar |

### 19.2 Canvas.toBlob

Padrao de uso:

```javascript
function comprimirImagem(file, maxWidth, maxHeight, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    img.onload = () => {
      let { width, height } = img;
      // Redimensiona mantendo proporcao
      if (width > maxWidth) {
        height = Math.round(height * (maxWidth / width));
        width = maxWidth;
      }
      // ...

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        const compressed = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
        // Se comprimido ficou maior (PNG pequeno otimizado), usa original
        resolve(compressed.size < file.size ? compressed : file);
      }, 'image/jpeg', quality);
    };
    reader.readAsDataURL(file);
  });
}
```

### 19.3 Tamanho maximo (multer)

Backend (multer):
- `audioUpload`: **25MB**
- `v4ChunkUpload`: **5MB**
- Outras rotas (foto, exame): geralmente **10MB** padrao

### 19.4 Limite Cloudflare/Railway

Railway tem limite global de **100MB** por request. Vercel preview tem **5MB** por request (sem upgrade).

**Atencao:** se Vercel for usado pra hospedar API (nao e o caso hoje), 5MB seria limitante. Backend roda em Railway = 100MB OK.

---

## 20. Padroes de UI/UX

> Tudo em CLAUDE.md secao "Design" (linha 38+). Aqui foco no NAO obvio.

### 20.1 Frame 393x852 mobile

```css
.phone {
  width: 393px;
  max-width: 100vw;
  height: 852px;
  max-height: 100vh;
  background: #F4F6FA;
  border-radius: 52px;
  overflow: hidden;
  position: relative;
  box-shadow: 0 0 0 1px rgba(0,229,160,0.15), 0 0 0 3px #1A1E26, 0 40px 120px rgba(0,0,0,0.9);
}

.notch {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 126px;
  height: 34px;
  background: #F4F6FA;
  border-radius: 0 0 20px 20px;
  z-index: 10;
}
```

**Frame dimensoes:** iPhone 14/15 Pro (mais comum no BR).
**Border-radius 52px:** match com iPhone real.
**Dynamic Island 126x34px:** centro topo.

**Em mobile real (<480px):** frame DESAPARECE, vira full-screen.

```css
@media(max-width:480px){
    html,body{padding:0!important;background:inherit!important;overflow-x:hidden;min-height:100vh;min-height:100dvh;}
    .phone{width:100vw!important;max-width:100vw!important;height:100vh!important;height:100dvh!important;max-height:none!important;border-radius:0!important;box-shadow:none!important;}
    .notch{display:none!important;}
}
```

### 20.2 Glass effect

```css
.glass {
  backdrop-filter: blur(20px) saturate(120%);
  -webkit-backdrop-filter: blur(20px) saturate(120%);
  background: rgba(255,255,255,0.85);
}
```

**Parametros:**
- `blur(20px)`: borrao do fundo
- `saturate(120%)`: aumenta saturacao das cores atras
- Background semi-transparente para reforcar efeito

**Pegadinha:** `backdrop-filter` nao funciona em alguns Android antigos. Sem fallback definido — degrada graciosamente (vira fundo solido).

### 20.3 fadeUp animation

```css
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card-1 { animation: fadeUp 0.4s 0.05s both; }
.card-2 { animation: fadeUp 0.4s 0.10s both; }
.card-3 { animation: fadeUp 0.4s 0.15s both; }
.card-4 { animation: fadeUp 0.4s 0.20s both; }
```

**Padrao:** delay escalonado em 0.05s entre elementos. Cria efeito "cascata".
**Duracao:** 0.4s (rapido o suficiente pra nao parecer lento, lento o suficiente pra notar).
**`both`:** mantem estado final.

### 20.4 Animacoes IA (orb gradient + 3 estagios)

> Vista em `IA Collab loading` e `Disparar mensagem`. Implementada em desktop/app-v2.html.

**Orb pulsante:**
```css
.ia-orb {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: radial-gradient(circle, #00E5A0 0%, #00B4D8 50%, transparent 70%);
  filter: blur(8px);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(0.95); opacity: 0.7; }
  50% { transform: scale(1.1); opacity: 1; }
}
```

**3 estagios sequenciais:**
```javascript
const estagios = [
  { texto: 'Validando dados...', duracao: 900 },
  { texto: 'Cruzando informacoes...', duracao: 1000 },
  { texto: 'Gerando insights...', duracao: 800 },
];

// Total: 2.7s
async function rodarAnimacao() {
  for (const estagio of estagios) {
    document.getElementById('iaTexto').textContent = estagio.texto;
    await new Promise(r => setTimeout(r, estagio.duracao));
  }
}
```

**Barra de progresso:** acompanha total 2.7s.

---

## 21. Analise prosodica (CFM 2.314/2022)

> Arquivo: `backend/src/services/prosodica.js` (168 linhas)

### 21.1 Service

Entry point: `analisar({audioBuffer, transcricao, duracaoSegundos, summaryJson, trechoInicioMs, trechoFimMs})`.

Retorna:
```javascript
{
  alerta: { severidade, mensagem, sinais, disclaimer } | null,
  features: { /* 9 features extraidas */ } | null,
  thresholds: { /* limites usados */ },
  hashAudio: 'sha256...',
  retencaoAte: Date (now + 20 anos),
  trecho: { inicio_ms, fim_ms },
  modo: 'mock'
}
```

### 21.2 Hash SHA-256 audio (NUNCA audio raw)

```javascript
// prosodica.js:39-42
function hashAudio(audioBuffer) {
  if (!audioBuffer) return null;
  return crypto.createHash('sha256').update(audioBuffer).digest('hex');
}
```

**Trilha de auditoria CFM 2.314/2022:** hash do audio prova que aquela analise foi feita sobre aquele audio especifico, sem armazenar o audio. Hash colisao SHA-256 e ~impossivel (2^256).

### 21.3 Features deterministic (mock mode)

```javascript
// prosodica.js:60-88
function extrairFeaturesMock(input) {
  const { duracaoSegundos = 0, transcricao = '', summaryJson = {} } = input || {};

  if (duracaoSegundos < THRESHOLDS.duracaoMinSegundos) {
    return null; // audio curto demais
  }

  const palavras = String(transcricao).split(/\s+/).filter(Boolean).length;
  const wpm = duracaoSegundos > 0 ? Math.round((palavras / duracaoSegundos) * 60) : 0;

  // Heuristica determinística (não-aleatória) baseada em hashes da transcrição
  const seed = crypto.createHash('md5').update(transcricao || '').digest();
  const noiseFactor = (seed[0] / 255) * 0.5; // 0-0.5

  const features = {
    duracao_segundos: duracaoSegundos,
    palavras_total: palavras,
    velocidade_wpm: wpm,
    pausa_max_ms: Math.round(800 + noiseFactor * 1500), // 800-2300ms
    pausa_media_ms: Math.round(200 + noiseFactor * 400),
    jitter_estimado: Number((0.015 + noiseFactor * 0.04).toFixed(4)),
    shimmer_estimado: Number((0.05 + noiseFactor * 0.08).toFixed(4)),
    f0_mediana_hz: Math.round(160 + noiseFactor * 60), // 160-220
    f0_variacao_pct: Number((0.10 + noiseFactor * 0.20).toFixed(3)),
    modo_extracao: 'mock',
  };

  return features;
}
```

**Pegadinha:** modo "mock" e DETERMINISTICO baseado em MD5 hash da transcricao. Mesmo input -> mesmo output. Permite desenvolver UI + auditoria sem custo de modelo DSP real.

### 21.4 Thresholds (conservadores)

```javascript
// prosodica.js:22-30
const THRESHOLDS = {
  pausaMinMs: 1500,                // pausa mais longa que 1.5s ao descrever queixa = sinal
  velocidadeFalaWpmMin: 95,        // <95 palavras/min = fala lenta
  jitterMax: 0.04,                 // jitter > 4% = voz tremida
  shimmerMax: 0.10,                // shimmer > 10% = voz embargada
  f0VariacaoMax: 0.25,             // variação de tom > 25% baseline = tom alterado
  duracaoMinSegundos: 30,          // áudios curtos demais não são analisáveis
};
```

**Filosofia:** falso negativo > falso positivo. Alerta errado mina confianca do medico.

### 21.5 Avaliacao -> alertas em linguagem clinica

```javascript
// prosodica.js:31-37
const TEXTOS_CLINICOS = {
  pausa_longa_queixa: 'Pausa longa ao descrever a queixa principal',
  voz_embargada: 'Voz embargada em segmentos da resposta',
  fala_lenta: 'Velocidade de fala abaixo do habitual',
  tom_alterado: 'Variação de tom ao falar de tópico específico',
  carga_emocional: 'Possível carga emocional aparente em segmento curto',
};
```

```javascript
// prosodica.js:93-121
function avaliarFeatures(features) {
  if (!features) return null;

  const alertas = [];
  if (features.pausa_max_ms > THRESHOLDS.pausaMinMs) {
    alertas.push(TEXTOS_CLINICOS.pausa_longa_queixa);
  }
  if (features.velocidade_wpm > 0 && features.velocidade_wpm < THRESHOLDS.velocidadeFalaWpmMin) {
    alertas.push(TEXTOS_CLINICOS.fala_lenta);
  }
  if (features.jitter_estimado > THRESHOLDS.jitterMax || features.shimmer_estimado > THRESHOLDS.shimmerMax) {
    alertas.push(TEXTOS_CLINICOS.voz_embargada);
  }
  if (features.f0_variacao_pct > THRESHOLDS.f0VariacaoMax) {
    alertas.push(TEXTOS_CLINICOS.tom_alterado);
  }

  if (!alertas.length) return null;

  // Severidade conservadora: se ≥2 sinais coincidem, alerta médio; ≥3 = alta
  const severidade = alertas.length >= 3 ? 'alta' : alertas.length === 2 ? 'media' : 'baixa';

  return {
    severidade,
    mensagem: alertas.join(' · '),
    sinais: alertas,
    disclaimer: 'IA pode errar. Esta observação não é diagnóstico — confirme clinicamente. (CFM 2.314/2022)',
  };
}
```

**Severidade:**
- >=3 sinais coincidentes -> **alta**
- 2 sinais -> **media**
- 1 sinal -> **baixa**

Disclaimer CFM 2.314/2022 obrigatorio em CADA alerta.

### 21.6 Retencao 20 anos (AnaliseProsodicaArquive)

```javascript
// prosodica.js:44-48
function calcRetencaoAte20anos(de = new Date()) {
  const r = new Date(de);
  r.setFullYear(r.getFullYear() + 20);
  return r;
}
```

CFM 2.314/2022 art. 5o exige retencao **minima de 20 anos** de qualquer dado clinico (incluindo analise prosodica). Backend salva em tabela `AnaliseProsodicaArquive` (referenciada na Sessao 19).

### 21.7 Modo simulacao vs real

```javascript
// prosodica.js:19
const MODO = process.env.PROSODICA_MODO || 'mock';

// prosodica.js:137-139
const features = MODO === 'mock'
  ? extrairFeaturesMock(input)
  : extrairFeaturesMock(input); // modo real ainda não implementado — fallback mock
```

**Modo real** nao implementado. Plano: integrar Python librosa/Praat via worker. Reservado pra fase 2.

**Trocar pra real:**
1. Implementar `extrairFeaturesReal()`
2. Setar `PROSODICA_MODO=real` no Railway
3. Garantir worker tem librosa instalado

---

## 22. IA Collab (comparativo entre consultas)

> Arquivo: `backend/src/services/iaCollab.js` (102 linhas)

### 22.1 Funcao principal

```javascript
// iaCollab.js:37-100
async function compararAnamneses(preConsultas) {
  if (!claude) {
    return {
      narrativa: 'IA indisponível no momento. Tente novamente em alguns segundos.',
      padroes_observados: [],
      evolucao_temporal: 'sem padrão',
      alertas: [],
    };
  }
  if (!Array.isArray(preConsultas) || preConsultas.length < 2) {
    throw new Error('Mínimo 2 pré-consultas para comparar.');
  }
  // ...
}
```

**Requisitos:** >=2 pre-consultas. Ordenadas mais antiga -> mais recente.

### 22.2 Modelo + parametros

```javascript
// iaCollab.js:65-70
const resp = await claude.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 1500,
  system: SYSTEM_PROMPT,
  messages: [{ role: 'user', content: userMsg }],
});
```

Modelo: **Claude Haiku 4.5** (mais barato que Sonnet, suficiente pra comparacao). Sem temperatura especificada (default).

### 22.3 Pseudonimizacao antes do LLM

```javascript
// iaCollab.js:50-60
const anonimas = preConsultas.map((pc, i) => {
  const sj = pc.summaryJson || {};
  return {
    indice: i + 1,
    data: pc.respondidaEm || pc.criadoEm,
    queixaPrincipal: sj.queixaPrincipal || sj.descricaoBreve || '(não informado)',
    anamneseEstruturada: sj.anamneseEstruturada || null,
    summaryTexto: sj.summaryTexto || null,
  };
});
```

**NAO envia:**
- Nome do paciente
- Telefone
- Email
- IDs do banco

**Envia apenas:**
- Indice ordenal (1, 2, 3...)
- Data (UTC datetime)
- Queixa principal
- Anamnese estruturada (11 campos)
- Summary texto

### 22.4 System prompt literal

```javascript
// iaCollab.js:15-31
const SYSTEM_PROMPT = `Você é um médico clínico experiente analisando a EVOLUÇÃO CLÍNICA de um mesmo paciente entre pré-consultas distintas.

REGRAS:
1. Compare anamneses estruturadas, queixas principais e sintomas associados.
2. Identifique padrões: queixa recorrente, mudança de intensidade, novos sintomas, melhora ou piora reportada.
3. NÃO faça diagnóstico. Use linguagem de observação clínica ("paciente relatou", "intensidade descrita aumentou", "mantém queixa de", "novo sintoma associado").
4. Linguagem PT-BR institucional, frases curtas, máximo 5 parágrafos.
5. Se as anamneses forem muito distintas (queixas sem relação), diga "queixas distintas, sem padrão evolutivo claro".
6. Termine sempre com: "Confirme clinicamente — esta é uma observação correlativa, não diagnóstico."

FORMATO DE SAÍDA (JSON puro, sem markdown):
{
  "narrativa": "texto livre 3-5 parágrafos curtos",
  "padroes_observados": ["padrão 1", "padrão 2", ...],
  "evolucao_temporal": "melhora | piora | estável | sem padrão",
  "alertas": ["alerta 1", ...] (só se houver vermelho clínico — vazio se não)
}`;
```

### 22.5 Saida (formato)

```javascript
// iaCollab.js:81-89
return {
  narrativa: parsed.narrativa || '',
  padroes_observados: parsed.padroes_observados || [],
  evolucao_temporal: parsed.evolucao_temporal || 'sem padrão',
  alertas: parsed.alertas || [],
};
```

**4 campos:**
- `narrativa`: 3-5 paragrafos descrevendo evolucao
- `padroes_observados`: array de padroes detectados (ex: "queixa recorrente de cefaleia", "intensidade aumentou de 5/10 pra 8/10")
- `evolucao_temporal`: enum (`melhora` | `piora` | `estavel` | `sem padrão`)
- `alertas`: array opcional — so se houver red flag clinico

### 22.6 Recuperacao de JSON

```javascript
// iaCollab.js:72-85
const txt = (resp.content?.[0]?.text || '').trim();
const match = txt.match(/\{[\s\S]*\}/);
if (!match) {
  return {
    narrativa: txt.slice(0, 2000),
    padroes_observados: [],
    evolucao_temporal: 'sem padrão',
    alertas: [],
  };
}
const parsed = JSON.parse(match[0]);
```

Fallback: se Claude responder com texto livre em vez de JSON, captura a primeira ocorrencia de `{...}` via regex. Se nao tem JSON, retorna texto raw como narrativa (max 2000 chars).

### 22.7 Tratamento de erros

```javascript
// iaCollab.js:90-99
} catch (err) {
  console.error('[iaCollab] erro:', err.message);
  return {
    narrativa: 'Não foi possível gerar a análise comparativa agora. Tente novamente em alguns segundos.',
    padroes_observados: [],
    evolucao_temporal: 'sem padrão',
    alertas: [],
    erro: err.message,
  };
}
```

Erros nao quebram fluxo. Frontend mostra mensagem amigavel + opcao retry.

### 22.8 Rota backend (Sessao 19)

```
POST /pre-consulta/:id/ia-collab
```

Body opcional: `{quantidadeMinima: 2}` (default).

1. Busca preConsulta pelo `id`
2. Busca pacienteId associado
3. Busca todas pre-consultas do mesmo pacienteId + medicoId, status RESPONDIDA
4. Ordena por data
5. Chama `compararAnamneses(preConsultas)`
6. Retorna resultado

### 22.9 Disclaimer CFM 2.314/2022

Embutido NO PROMPT (regra 6):
> "Termine sempre com: 'Confirme clinicamente — esta é uma observação correlativa, não diagnóstico.'"

Frontend pode adicionar mais disclaimer visual ("IA pode errar...").

### 22.10 Opt-in (medico clica botao)

> Sessao 18: decisao UX. IA Collab nao roda automaticamente. Medico clica "Comparar com consultas anteriores" no perfil do paciente.

Razao: alguns medicos podem nao querer IA comparando dados. Opt-in respeita autonomia + economiza tokens Claude.

---

## Conclusao

Este manual cobre as 22 features especiais do vita id no nivel de detalhe necessario pra **replicar exatamente no app v3**. Diferente dos outros 2 manuais (backend e telas), este foca em **mecanicas internas**: formulas, algoritmos, thresholds, regras de prompt, pegadinhas observadas em producao.

**Pontos de atencao pra reescrita v3:**

1. **Pseudonimizacao em scan de exame:** atualmente nao acontece. Implementar antes de v3 sair pra paciente nao-betatester.
2. **Limite 15 scans/dia/usuario:** nao implementado. Considerar antes de open beta.
3. **Validacao Google Sign-In backend:** hoje confia no token. Adicionar `google-auth-library`.
4. **eval() em matching.js:** trocar por avaliador AST seguro.
5. **Modo real prosodica:** integrar Python librosa quando virar prioridade.
6. **Laboratorista (5o agente):** implementar quando base de exames estiver madura.
7. **Cobertura padroes v2:** so cefaleia hoje. Popular outras 19 queixas com diretrizes BR.
8. **Helper quizDetectarCruzamentoAlergiaMed no frontend:** implementar pra alertar inline em vez de so backend.

**Total de arquivos referenciados:** 22+ arquivos especificos com numero de linha. Quando codigo nao foi encontrado, esta marcado "nao encontrado".

Fim do manual.
