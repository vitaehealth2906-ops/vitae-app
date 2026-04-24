# Mapa de Fluxo de Dados — LGPD/ANPD

**Norma de referência:** LGPD (Lei 13.709/2018), especialmente Art. 11 (dados sensíveis de saúde)
**Versão:** 1.0
**Data:** 2026-04-23

---

## 1. Categorias de dados tratados

Dados de saúde são classificados como **sensíveis** (Art. 5º, II + Art. 11). Tratamento exige:
- Consentimento específico e destacado **OU**
- Proteção da vida/saúde do titular **OU**
- Exercício regular de direitos em processo

O vita id se ampara em **consentimento específico** obtido no onboarding.

---

## 2. Mapa detalhado — Componente Padrões Observados v2

### 2.1 Dados de entrada (o que o pipeline recebe)

| Dado | Origem | Identificável? | Onde armazenado | Por quanto tempo |
|------|--------|----------------|-----------------|------------------|
| Transcrição do áudio | Paciente (Whisper) | Sim (pode conter nome próprio na fala) | Tabela `PreConsulta.transcricao` | 20 anos (Lei 13.787) |
| Respostas do formulário | Paciente | Sim | `PreConsulta.respostas` (JSON) | 20 anos |
| Idade, sexo | Perfil vita id | Pseudo-identificável | `PerfilSaude` | Até conta ativa ou pedido apagamento |
| Medicamentos do perfil | Paciente | Identificável | `Medicamento` (vinculada a Usuario) | Até conta ativa |
| Alergias do perfil | Paciente | Identificável | `Alergia` (vinculada a Usuario) | Até conta ativa |
| Condições crônicas | Paciente | Identificável | `PerfilSaude.condicoes` | Até conta ativa |

### 2.2 Fluxo durante execução do pipeline

```
Paciente envia pre-consulta
         ↓
[Backend Railway] recebe dados identificáveis
         ↓
[Agente Anamnesista]
  - Recebe: transcrição (pode ter PII)
  - Antes de chamar Claude: aplicar pseudonimizar()
    que remove: CPF, telefone, email
  - Envia ao Claude APENAS:
    • idade (número)
    • sexo (string)
    • transcrição pseudonimizada
    • respostas JSON pseudonimizadas
  - Claude recebe dados sem identificação direta
  - Retorna: JSON estruturado sem PII
         ↓
[Agente Farmacologista] — 100% local, sem LLM
  - Lê medicamentos, alergias do perfil
  - NÃO envia dados pra fora
  - Retorna: cards de alerta
         ↓
[Agente Epidemiologista] — 100% local, sem LLM
  - Lê base de conhecimento (arquivos JSON locais)
  - Calcula score
  - NÃO envia dados pra fora
  - Retorna: candidatos
         ↓
[Agente Compliance] — 100% local
  - Valida output
  - Retorna: cards aprovados + trilha auditoria
         ↓
Salva em PreConsulta.summaryJson (banco Supabase)
         ↓
Médico abre tela → vê cards
```

### 2.3 Dados que SAEM do backend pro LLM externo (Claude/Anthropic)

Apenas na Etapa do Anamnesista. Payload enviado:

```
{
  "idade": 34,
  "sexo": "feminino",
  "transcricao": "...dor de cabeça há 2 semanas..." (pseudonimizada),
  "respostas": { ... } (pseudonimizadas)
}
```

**Não são enviados:** nome, CPF, RG, telefone, email, endereço, foto, data exata de nascimento.

### 2.4 Dados armazenados no banco

Após pipeline, `PreConsulta.summaryJson` recebe:
- `padroesObservados_v2`: cards gerados
- `alertasFarmacologicos`: cards críticos
- `auditoria_padroes_v2`: trilha de qual agente fez o quê
- `base_versions`: versão da base usada (imutável)
- `pipeline_version`: versão do código

Todos esses dados são **pseudonimizados** na saída — não contêm PII.

---

## 3. Direitos do titular (LGPD Art. 18)

### 3.1 Consentimento

No onboarding, paciente aceita separadamente:
- `[ ]` Uso dos meus dados para gerar insights ao meu médico em pre-consultas
- `[ ]` Uso dos meus dados anonimizados para melhorar o sistema
- `[ ]` Uso dos meus dados para pesquisa científica (opcional)

Cada checkbox é registrado em `Consentimento` com timestamp + IP + versão do termo.

### 3.2 Direito de apagamento (Art. 18, VI)

Endpoint: `DELETE /lgpd/esquecer/:pacienteId` (protegido por autenticação do próprio paciente)

Ação:
1. Apaga dados identificáveis de `Usuario`, `PerfilSaude`, `Alergia`, `Medicamento`, `Exame`
2. Apaga campo `transcricao` de pre-consultas passadas (retém estrutura sem PII)
3. Mantém `summaryJson.auditoria_padroes_v2` anonimizado por 20 anos (Lei 13.787 — prontuário eletrônico)
4. Envia e-mail de confirmação ao paciente
5. Log em `LogApagamento` com hash SHA-256 da solicitação

Tempo máximo de resposta: **15 dias úteis** (padrão ANPD).

### 3.3 Revogação de consentimento

Paciente pode revogar no app. Consequência imediata: **pipeline v2 não roda mais para essa pessoa**. Dados históricos ficam intactos (não são retroativamente apagados) mas não são mais usados.

### 3.4 Portabilidade (Art. 18, V)

Endpoint `GET /lgpd/exportar/:pacienteId` retorna ZIP com todos os dados em formato JSON estruturado.

---

## 4. Medidas técnicas (Art. 46)

- **Pseudonimização** automática antes de chamadas externas
- **Criptografia em trânsito** (HTTPS obrigatório em produção)
- **Criptografia em repouso** (Supabase encripta dados PostgreSQL automaticamente)
- **Logs de acesso** a dados sensíveis registrados em `auditLog`
- **Princípio do menor privilégio** — cada função tem acesso só ao que precisa
- **Backup encriptado** — retenção 90 dias

---

## 5. Base legal

- **Art. 11, II, alínea f** — proteção da saúde, em procedimento realizado por profissionais de saúde (quando médico está envolvido)
- **Art. 7º, I** — consentimento específico (para uso pra melhoria do sistema)

---

## 6. Encarregado de Dados (DPO)

**Nome:** [a definir quando empresa formalizar]
**Contato:** [a definir]

Paciente pode entrar em contato para exercer qualquer direito LGPD.

---

## 7. Incidentes de segurança

Se ocorrer vazamento ou incidente:
1. Contenção imediata (desligar feature flag se for componente Padrões v2)
2. Análise de escopo em 24h
3. Notificação ANPD em até 48h (conforme Art. 48)
4. Comunicação aos titulares afetados
5. Plano de remediação documentado

---

## 8. Revisão

Documento revisado a cada:
- Nova versão major do pipeline
- Incidente de segurança
- Atualização legislativa
- Anualmente no mínimo

**Próxima revisão:** 2027-04-23
