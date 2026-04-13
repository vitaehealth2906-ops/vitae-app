# Banco de Dados — vita id

> Voltar pra [[00-CENTRAL]] | Servidor em [[04-BACKEND]]

---

## Visao Geral

- **Tipo:** PostgreSQL
- **Hospedagem:** Supabase
- **ORM:** Prisma
- **Total de tabelas:** 17
- **Arquivo de definicao:** `backend/prisma/schema.prisma`

---

## Tabelas — O que cada uma guarda

### Usuario
Dados basicos de quem usa o app.

| Campo | O que guarda |
|-------|-------------|
| nome | Nome completo |
| email | Email (unico) |
| celular | Telefone (unico) |
| senhaHash | Senha criptografada |
| tipo | PACIENTE ou MEDICO |
| status | PENDENTE ou ATIVO |
| fotoUrl | Foto de perfil |
| provider / providerId | Se fez login com Google |

---

### PerfilSaude
Informacoes de saude do paciente. Ligado ao Usuario.

| Campo | O que guarda |
|-------|-------------|
| genero | Masculino, feminino, outro |
| dataNascimento | Data de nascimento |
| alturaCm | Altura em centimetros |
| pesoKg | Peso em quilos |
| tipoSanguineo | A+, O-, AB+, etc |
| cpf | CPF do paciente |
| historicoFamiliar | Lista de condicoes na familia |
| nivelAtividade | Sedentario, leve, moderado, intenso |
| horasSono | Horas de sono por noite |
| fuma / alcool | Se fuma ou bebe |
| contatoEmergencia | Nome e telefone pra emergencia |
| nomeMae / nomePai | Nomes dos pais |
| condicoes | Condicoes de saude existentes |
| cirurgias | Lista de cirurgias |
| planoSaude | Nome do plano |
| apelido / nomeSocial | Nome social |
| estadoCivil / corEtnia | Dados demograficos |
| limitacoesAcessibilidade | Necessidades especiais (formato livre) |

---

### Exame
Cada exame que o paciente envia (PDF ou foto).

| Campo | O que guarda |
|-------|-------------|
| arquivo / tipo / tamanho | Info do arquivo enviado |
| tipoExame | Hemograma, glicemia, etc |
| laboratorio | Nome do lab |
| dataExame | Quando foi feito |
| status | ENVIADO → PROCESSANDO → CONCLUIDO ou ERRO |
| textoExtraido | Texto que a IA leu do documento |
| dadosEstruturados | Todos os dados organizados (JSON) |
| resumoIA | Resumo em linguagem simples |
| impactosIA | O que os resultados significam |
| melhoriasIA | Recomendacoes personalizadas |
| scoreContribuicao | Quanto esse exame afeta o score |

---

### ParametroExame
Cada valor individual dentro de um exame (ex: hemoglobina 14.2 g/dL).

| Campo | O que guarda |
|-------|-------------|
| nome | Nome do parametro (ex: Hemoglobina) |
| valor | Valor encontrado (ex: "14.2") |
| unidade | Unidade (ex: "g/dL") |
| valorReferencia | Faixa de referencia (ex: "12-16") |
| valorNumerico | Valor como numero (pra comparar) |
| referenciaMin / referenciaMax | Limites da faixa |
| status | NORMAL, ATENCAO ou CRITICO |
| classificacao | Mesma coisa que status (redundante) |
| percentualFaixa | Onde o valor cai dentro da faixa (%) |

---

### Medicamento
Cada medicamento que o paciente toma.

| Campo | O que guarda |
|-------|-------------|
| nome | Nome do remedio |
| dosagem | Ex: "50mg" |
| frequencia | Ex: "1x ao dia" |
| horario | Ex: "08:00" |
| motivo | Por que toma |
| dataInicio / dataFim | Periodo de uso |
| duracaoDias | Quantos dias de tratamento |
| quantidadeEstoque | Quantos comprimidos tem |
| quantidadePorDose | Quantos toma por vez |
| medicoPrescritor | Quem receitou |
| ativo | Se ainda esta tomando |
| fonte | "manual" ou "scan" |

---

### Alergia
Cada alergia do paciente.

| Campo | O que guarda |
|-------|-------------|
| nome | Nome da substancia (ex: Dipirona) |
| tipo | Tipo de alergia |
| gravidade | Nivel de gravidade |
| fonte | "manual" ou "scan" |

---

### HealthScore
Pontuacao de saude calculada.

| Campo | O que guarda |
|-------|-------------|
| scoreGeral | Nota final (0-100) |
| scoreSono | Nota do pilar sono |
| scoreAtividade | Nota do pilar atividade |
| scoreProdutividade | Nota do pilar produtividade |
| scoreExame | Nota do pilar exames |
| idadeBiologica | Idade que o corpo aparenta ter |
| idadeCronologica | Idade real |
| fontesDados | De onde vieram os dados |
| confianca | baixa, media ou alta |
| fatores | Detalhes do calculo (JSON) |

---

### CheckinSemanal
Paciente responde semanalmente sobre como esta se sentindo.

| Campo | O que guarda |
|-------|-------------|
| sonoQualidade | 1 a 5 |
| atividadeFisica | nenhuma, leve, moderada, intensa |
| humor | 1 a 5 |
| dor | Descricao de dor |
| produtividade | 1 a 5 |
| notas | Observacoes livres |

---

### Medico
Dados profissionais do medico.

| Campo | O que guarda |
|-------|-------------|
| crm | Numero do CRM |
| ufCrm | Estado do CRM |
| especialidade | Cardiologista, clinico geral, etc |
| clinica | Nome da clinica |
| enderecoClinica | Endereco |
| telefoneClinica | Telefone |

---

### FormTemplate
Templates de perguntas que o medico cria pra pre-consulta.

| Campo | O que guarda |
|-------|-------------|
| nome | Nome do template |
| perguntas | Lista de perguntas (JSON) |
| permitirAudio | Se paciente pode gravar resposta |
| versao | Versao do template |
| vezesUsado | Quantas vezes foi usado |

---

### PreConsulta
Cada pre-consulta criada por um medico.

| Campo | O que guarda |
|-------|-------------|
| medicoId / templateId | Quem criou e qual template |
| pacienteNome / Tel / Email | Dados do paciente |
| linkToken | Link unico pra paciente acessar |
| status | PENDENTE → ABERTO → RESPONDIDA ou EXPIRADA |
| respostas | Respostas do paciente (JSON) |
| pacienteFotoUrl | Foto do paciente |
| audioUrl | Audio gravado |
| transcricao | Texto do audio |
| summaryIA | Resumo gerado pela IA |
| summaryJson | Resumo estruturado |
| expiraEm | Quando o link expira |

---

### Outras Tabelas

| Tabela | O que guarda |
|--------|-------------|
| Notificacao | Avisos pro usuario (tipo, titulo, mensagem, se foi lida) |
| CodigoVerificacao | Codigos SMS e de reset (hash, tentativas, expiracao) |
| RefreshToken | Tokens de renovacao de acesso (rotacao automatica) |
| AutorizacaoAcesso | Qual paciente autorizou qual medico, categorias, expiracao |
| Agendamento | Consultas marcadas (titulo, tipo, local, medico, data, lembrete) |
| Consentimento | Aceites legais (termos, LGPD, compartilhamento, IA) |
