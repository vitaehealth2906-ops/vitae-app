# PLANO COMPLETO — Scan de Medicamentos vita id

> Gerado: 10/04/2026
> Status: PLANEJADO (nada implementado ainda)
> Total: 26 itens mapeados → 8 fases de execucao
> Todos os 4 especialistas concluiram a analise

---

## RESUMO EXECUTIVO

O scan de medicamentos hoje esta **100% quebrado** pro paciente. O backend funciona perfeitamente — o servidor sabe receber foto, identificar remedios, cruzar com alergias. Mas faltam 3 telas no app e 8 melhorias no cerebro por tras.

O plano esta dividido em **8 fases**, da mais urgente pra menos urgente. Cada fase pode ser executada independente.

---

## FASE 1 — Tela de Camera (26-scan-receita.html)
**Prioridade: CRITICA | Sem isso nada funciona**

### O que faz
Quando o paciente clica "Tirar foto" ou "Escolher da galeria" nos medicamentos ou alergias, esta tela abre.

### Como funciona
1. Pagina abre e automaticamente aciona a camera do celular (ou galeria)
2. Paciente tira foto da receita, caixa do remedio, ou bula
3. Ve um preview da foto que tirou
4. Indicador de qualidade: "Boa qualidade" (verde) ou "Qualidade razoavel" (amarelo)
5. Dois botoes: "Enviar e identificar" ou "Tirar outra"
6. Se foto muito escura/pequena/borrada: avisa antes de enviar
7. Comprime a foto automaticamente (de 5MB pra ~300KB) pra nao travar
8. Guarda a foto comprimida e vai pra tela de processamento

### Cenarios de erro tratados
- Camera sem permissao → avisa e oferece galeria como alternativa
- Foto muito pequena (<50KB) → "Foto com pouca qualidade, tente novamente"
- Foto muito grande (>10MB) → "Arquivo muito grande"
- Celular nao tem camera → oferece galeria
- Paciente cancelou → volta pra tela de instrucoes com botoes manuais

### Funciona pra ambos
- Medicamentos: recebe `?tipo=receita` → titulo "Escanear receita"
- Alergias: recebe `?tipo=alergia` → titulo "Escanear alergias"

---

## FASE 2 — Tela de Processamento (27-processando.html)
**Prioridade: CRITICA | Sem isso nada funciona**

### O que faz
Tela de loading enquanto o servidor analisa a foto. Visual escuro (como a tela de "Perfil Criado!").

### Como funciona
1. Le a foto que a tela anterior guardou
2. Mostra animacao bonita com 3 etapas visuais:
   - "Enviando foto..." (1.5s)
   - "Identificando medicamentos..." (2s)
   - "Verificando interacoes..." (1s)
3. Por tras, envia a foto pro servidor numa unica chamada
4. Se demorar mais de 15 segundos: "Demorando mais que o esperado..."
5. Se demorar mais de 30 segundos: timeout com opcao de tentar novamente
6. Se deu certo: animacao de check (igual tela de perfil criado) → vai pra revisao
7. Se deu erro: mostra mensagem amigavel + "Tentar novamente" (sem perder a foto)

### Cenarios de erro tratados
| Erro | Mensagem pro paciente |
|------|----------------------|
| Sem internet | "Verifique sua internet e tente novamente" |
| Timeout (30s) | "Demorou mais que o esperado. Tente com foto mais simples" |
| Nao e receita | "Nao conseguimos identificar uma receita nesta foto" |
| Foto muito grande | "Tente com uma foto menor" |
| Servidor fora | "Servico indisponivel, tente em alguns minutos" |
| Erro generico | "Algo deu errado. Tente novamente" |

### Retry inteligente
Se der erro, a foto continua guardada. "Tentar novamente" reenvia a mesma foto sem precisar tirar outra.

### Destino apos sucesso
- Se era medicamento → vai pra 28-revisao-receita.html
- Se era alergia → vai pra 31-revisao-alergias.html (ja existe)

---

## FASE 3 — Tela de Revisao de Medicamentos (28-revisao-receita.html)
**Prioridade: CRITICA | Sem isso nada funciona**

### O que faz
Mostra todos os medicamentos encontrados na foto pra o paciente confirmar antes de salvar.

### Como funciona

**Topo da tela:**
- Titulo: "Receita identificada"
- Se tem nome do medico/data na receita: mostra card com "Dr. Fulano — 10/04/2026"
- Se algum medicamento conflita com alergia: banner vermelho "⚠ 2 medicamentos com conflito de alergia"

**Card de medicamento normal:**
```
┌──────────────────────────────────────────┐
│ [icone pilula]  Losartana      [liga/des]│
│                 50mg — 1x ao dia         │
│                 ● alta  · ANVISA ✓       │
│                          Losartana       │
│                          Potassica       │
│                               [editar ✎] │
└──────────────────────────────────────────┘
```

**Card de medicamento COM CONFLITO DE ALERGIA:**
```
┌─ BORDA VERMELHA ────────────────────────┐
│ [⚠ icone]  Novalgina       [DESLIGADO] │
│             500mg — 6/6h                │
│  ┌─────────────────────────────────┐    │
│  │ ⚠ Conflito com alergia         │    │
│  │ Novalgina contem Dipirona       │    │
│  │ Voce tem alergia a Dipirona     │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**Card de medicamento JA CADASTRADO:**
```
┌──────────────────────────────────────────┐
│ [icone]  Metformina        [Existente]  │
│          850mg — 2x ao dia              │
└──────────────────────────────────────────┘
```

### Funcionalidades
- **Toggle liga/desliga** pra cada medicamento (paciente escolhe quais salvar)
- **Conflitos com alergia vem DESLIGADOS** por padrao (seguranca)
- **Indicador de confianca**: bolinha verde (alta), amarela (media), vermelha (baixa)
- **Badge ANVISA**: se o remedio foi encontrado na tabela oficial, mostra "ANVISA ✓" + nome do principio ativo
- **Duplicata detectada**: se ja tem no perfil, mostra "Existente" e nao permite adicionar de novo
- **Editar antes de salvar**: botao de lapis abre formulario pra corrigir nome, dosagem, frequencia
- **Botao de confirmar**: muda de cor — verde (normal) ou VERMELHO (se algum conflito esta ligado)

### Botao confirmar
- Salva cada medicamento selecionado no servidor, um por um
- Passa o nome do medico da receita automaticamente
- Marca como fonte "scan" (nao "manual")
- Mostra toast "3 medicamentos adicionados"
- Volta pra tela de medicamentos

---

## FASE 4 — Padronizar Resposta da IA
**Prioridade: ALTA | Sem isso a tela 28 recebe dados inconsistentes**

### O problema
O servidor usa Gemini (Google) como IA principal e Claude como backup. Cada um retorna campos diferentes:

| Campo | Gemini retorna? | Claude retorna? |
|-------|----------------|-----------------|
| Nome | SIM | SIM |
| Dosagem | SIM | SIM |
| Frequencia | SIM | SIM |
| Principio ativo | SIM | NAO |
| Forma (comprimido, gotas) | SIM | NAO |
| Laboratorio | SIM | NAO |
| Quantidade | SIM | NAO |
| Confianca (alta/media/baixa) | SIM | NAO |
| Horario | NAO | SIM |
| Via (oral, injetavel) | NAO | SIM |
| Observacao | NAO | SIM |

### A solucao
Criar uma camada de "traducao" que pega a resposta de qualquer IA e transforma num formato unico. Assim a tela 28 sempre recebe os mesmos campos, independente de qual IA respondeu.

### Validacao
Tambem verifica se a resposta faz sentido:
- Nome do medicamento nao pode estar vazio
- Se o nome parece uma frase ("O medicamento e..."), descarta
- Se nao tem nenhum medicamento mas disse que era receita, corrige pra "nao e receita"
- Campos com mais de 200 caracteres sao cortados

---

## FASE 5 — Deteccao Inteligente de Conflito com Alergia
**Prioridade: CRITICA (risco de vida) | O problema que criou o vita id**

### O problema atual
O sistema so compara TEXTOS. Se o paciente registrou alergia a "Dipirona" e a receita tem "Novalgina", o sistema NAO alerta — porque "dipirona" nao aparece na palavra "novalgina".

Mas Novalgina E Dipirona. Mesmo principio ativo. Mesmo risco de vida.

### A solucao: 3 camadas de protecao

**Camada 1 — Tabela CMED (marca → principio ativo)**
O sistema ja tem uma tabela com 52 remedios oficiais da ANVISA. Cada remedio tem o nome comercial E o principio ativo. Entao:
- Novalgina → Dipirona Sodica
- Dorflex → Dipirona Sodica + Orfenadrina + Cafeina
- Advil → Ibuprofeno

Se o paciente tem alergia a "Dipirona" e a receita tem "Novalgina":
1. Sistema busca "Novalgina" na tabela CMED
2. Encontra: principio ativo = Dipirona Sodica
3. Compara "Dipirona Sodica" com "Dipirona" → MATCH → ALERTA!

**Camada 2 — Familias de medicamentos (reacoes cruzadas)**
Alguns remedios sao de familias que causam reacao cruzada. Mapa fixo:

| Familia | Membros |
|---------|---------|
| Penicilinas | Amoxicilina, Ampicilina, Piperacilina, Oxacilina |
| Dipirona/Pirazolona | Dipirona Sodica, Metamizol, Novalgina, Dorflex |
| Anti-inflamatorios (AINEs) | Ibuprofeno, Nimesulida, Diclofenaco, Naproxeno, Aspirina |
| Sulfonamidas | Sulfametoxazol, Sulfadiazina |
| Cefalosporinas | Cefalexina, Ceftriaxona (reacao cruzada com penicilinas em ~2%) |
| Estatinas | Sinvastatina, Atorvastatina, Rosuvastatina |

Se paciente tem alergia a "Penicilina" e receita tem "Amoxicilina":
1. Sistema busca "Amoxicilina" no mapa de familias
2. Encontra: pertence a familia "Penicilinas"
3. Busca "Penicilina" → e o nome da familia
4. MATCH → ALERTA: "Amoxicilina pertence a familia das Penicilinas"

**Camada 3 — Comparacao de texto (fallback)**
Se o remedio nao esta na tabela CMED nem no mapa de familias, usa a comparacao de texto atual (compara nomes). E o minimo, mas melhor que nada.

### Resultado pro paciente
Em vez de so "Conflito com alergia", o sistema agora explica:
- "Novalgina contem Dipirona Sodica — voce tem alergia a Dipirona registrada"
- "Amoxicilina pertence a familia das Penicilinas — voce tem alergia a Penicilina"

---

## FASE 6 — Correcoes no Banco de Dados
**Prioridade: ALTA | Dados salvos incompletos**

### 6.1 — Fonte "scan" nunca e marcada
**Hoje:** Todo medicamento salva como fonte "manual", mesmo vindo de scan.
**Correcao:** Aceitar campo "fonte" com valor "scan" quando vem da tela de revisao.

### 6.2 — Medicamento duplicado nao e detectado
**Hoje:** Pode adicionar "Losartana 50mg" 10 vezes.
**Correcao:** Antes de salvar, verificar se ja existe um medicamento ativo com mesmo nome e dosagem. Se sim, avisar "Voce ja tem este medicamento cadastrado".

### 6.3 — Gravidade da alergia e ignorada
**Hoje:** IA detecta "Dipirona — GRAVE (anafilaxia)" mas salva como "MODERADA".
**Correcao:** Usar a gravidade que a IA detectou. Mostrar pro paciente na revisao.

### 6.4 — Medico prescritor nao e guardado
**Hoje:** Scan identifica "Dr. Fulano" na receita mas nao salva no banco.
**Correcao:** Passar o nome do medico da receita quando salvar cada medicamento.

### 6.5 — Data da receita nao e guardada
**Hoje:** Scan identifica "05/04/2026" mas nao salva.
**Correcao:** Converter a data pra formato padrao e salvar como data de inicio.

---

## FASE 7 — Tabela CMED (expandir)
**Prioridade: MEDIA | Funciona com 52 mas seria melhor com mais**

### Situacao atual
52 medicamentos na tabela. Cobre os mais comuns (Losartana, Dipirona, Amoxicilina, etc).

### O ideal
A tabela CMED real da ANVISA tem ~20.000 medicamentos. Com mais dados:
- Mais remedios seriam validados ("ANVISA ✓")
- Mais conflitos de alergia seriam detectados
- Mais principios ativos seriam resolvidos

### Abordagem
Buscar a tabela CMED completa (publica, disponivel no site da ANVISA) e converter pro formato JSON.

---

## FASE 8 — Melhorias de Experiencia e Seguranca
**Prioridade: MEDIA/BAIXA | Polimento**

### 8.1 — Limite de scans por dia
15 scans por usuario por dia. Cada scan custa dinheiro (API do Gemini). Sem limite, um usuario pode gastar todo o credito.

### 8.2 — Comprimir foto antes de enviar
Ja planejado na tela 26. Reduz foto de 5MB pra ~300KB. Menos custo de API, mais rapido.

### 8.3 — Limpar foto do armazenamento apos uso
A foto fica guardada no navegador temporariamente. Apos processamento com sucesso, apagar.

### 8.4 — Atalhos pra medicamentos comuns
Igual as alergias tem bolinhas rapidas (Amendoim, Lactose, Gluten), medicamentos poderia ter: Losartana, Metformina, Omeprazol, Sinvastatina, Levotiroxina.

### 8.5 — Mostrar foto original na revisao
Na tela 28, ter um botao pra ver a foto que tirou, pra conferir se a IA leu certo.

---

## ORDEM DE EXECUCAO RECOMENDADA

```
FASE 4 — Padronizar resposta da IA (backend)
  ↓ (necessario pra fase 3 funcionar direito)
FASE 5 — Deteccao inteligente de alergias (backend)
  ↓ (necessario pra fase 3 mostrar alertas corretos)
FASE 6 — Correcoes no banco (backend)
  ↓ (necessario pra fase 3 salvar corretamente)
FASE 1 — Tela de camera (26)
  ↓ (necessario pra fase 2 ter foto)
FASE 2 — Tela de processamento (27)
  ↓ (necessario pra fase 3 ter resultado)
FASE 3 — Tela de revisao (28)
  ↓ (agora tudo funciona ponta a ponta)
FASE 7 — Expandir CMED
FASE 8 — Polimento
```

Backend primeiro → Telas depois → Polimento por ultimo.

---

## ARQUIVOS QUE SERAO CRIADOS

| Arquivo | O que e |
|---------|---------|
| 26-scan-receita.html | Tela de camera/galeria |
| 27-processando.html | Tela de processamento |
| 28-revisao-receita.html | Tela de revisao de medicamentos |
| backend/src/services/drugConflict.js | Deteccao inteligente de conflito com alergia |
| backend/src/data/cmed.json | Tabela CMED no servidor |
| backend/src/middleware/scanLimit.js | Limite de scans por dia |

## ARQUIVOS QUE SERAO MODIFICADOS

| Arquivo | O que muda |
|---------|-----------|
| backend/src/services/ai.js | Camada de normalizacao + validacao das respostas |
| backend/src/routes/medicamentos.js | Aceitar "fonte", detectar duplicata, usar conflito inteligente, limite de scan |
| backend/src/routes/alergias.js | Aceitar "fonte", limite de scan |
| 31-revisao-alergias.html | Usar gravidade real da IA + marcar fonte "scan" |
