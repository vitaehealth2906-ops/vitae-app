# Biblioteca de Disclaimers — Padrões Observados v2

Repositório canônico dos textos de disclaimer usados no produto. Controle editorial centralizado pra evitar drift.

---

## 1. Disclaimer CFM padrão (curto, usado em todos os cards)

**Texto canônico:**
> "Sugestão de apoio à decisão baseada em literatura clínica. Não constitui diagnóstico. Ato médico privativo (CFM Resolução 2.299/2021)."

**Onde aparece:** rodapé de cada card de Padrão Observado, cada Alerta Farmacológico, cada card de Auto-medicação.

---

## 2. Disclaimer CFM padrão (variante específica)

Para cards com fonte específica citada:

**Template:**
> "Sugestão de apoio à decisão baseada em {FONTE}. Não constitui diagnóstico. Ato médico privativo."

**Exemplo com SBCef:**
> "Sugestão de apoio à decisão baseada em SBCef 2022. Não constitui diagnóstico. Ato médico privativo."

---

## 3. Disclaimer do alerta farmacológico crítico

**Texto:**
> "Cruzamento determinístico baseado em classes farmacológicas (CMED/ANVISA). Não constitui diagnóstico. Ato médico privativo."

---

## 4. Disclaimer global do Resumo de 1 Minuto

**Texto (aparece no rodapé da tela):**
> "Aviso CFM. Este resumo é ferramenta de apoio à decisão clínica. Nenhuma das sugestões apresentadas constitui diagnóstico ou prescrição. O exercício da Medicina é privativo do médico habilitado (CFM Resolução 2.299/2021). Todo o raciocínio acima é auditável via Log de Sugestões desta pre-consulta."

---

## 5. Disclaimer do bloco Red Flags

**Texto:**
> "Diferenciais raros mas críticos — investigar somente se sinal de alarme presente. Lista não é exaustiva. Avaliação clínica sempre obrigatória."

---

## 6. Banner em situações especiais

### 6.1 Paciente gestante

> "Paciente gestante — considerações obstétricas aplicam. Medicações categoria C/D/X suprimidas das sugestões."

### 6.2 Paciente pediátrico

> "Paciente pediátrico — considerar encaminhamento a especialista se quadro persistir."

### 6.3 Polifarmácia em idoso

> "Paciente idoso com ≥ 5 medicamentos ativos — revisar conforme Critérios de Beers."

### 6.4 Contexto insuficiente

> "Contexto insuficiente para sugestões específicas. Confie no seu julgamento clínico."

---

## 7. Disclaimer de Auto-medicação

**Texto:**
> "Detecção baseada em cruzamento determinístico entre transcrição e perfil. Confirmar com paciente."

---

## 8. Texto do consentimento (paciente, onboarding)

### Checkbox principal

> "Autorizo o uso dos meus dados de saúde para gerar insights ao meu médico durante minhas pre-consultas, nos termos da LGPD (Art. 11, II, f). Posso revogar este consentimento a qualquer momento nas configurações do app."

### Checkbox opcional 1 — Melhoria do sistema

> "Autorizo o uso dos meus dados anonimizados para melhorar a qualidade das sugestões geradas pelo sistema. Os dados não serão compartilhados com terceiros."

### Checkbox opcional 2 — Pesquisa

> "Autorizo o uso dos meus dados anonimizados para pesquisa científica em saúde, em parcerias com universidades ou centros de pesquisa brasileiros."

---

## 9. Tooltip do botão "Aceitar como relevante"

> "Marca este padrão como útil para a sua decisão clínica. Ajuda a calibrar o sistema. Não implica concordância com diagnóstico."

## 10. Tooltip do botão "Rejeitar"

> "Remove esta sugestão desta pre-consulta. Opcionalmente explique por quê para calibrar o sistema."

---

## 11. Regras editoriais

- **Nunca** usar: "IA", "inteligência artificial", "algoritmo", "machine learning"
- **Nunca** usar: "paciente tem", "diagnóstico de", "é X", "sofre de"
- **Sempre** mencionar: "apoio à decisão", "sugestão", "compatível com", "considerar"
- **Sempre** citar: fonte quando aplicável, CFM quando disclaimer, data quando relevante
- **Tom:** institucional, preciso, sem diminutivos, sem emojis

---

## 12. Controle de versão

Qualquer mudança nos textos acima passa por:
1. Revisão do CTO (produto)
2. Revisão jurídica (se houver disclaimer CFM/LGPD afetado)
3. Incremento de versão neste arquivo
4. Commit com mensagem clara

**Versão atual:** 1.0 — 2026-04-23
