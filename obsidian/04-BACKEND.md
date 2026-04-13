# Backend — vita id

> Voltar pra [[00-CENTRAL]] | Banco de dados em [[05-BANCO-DE-DADOS]]

---

## Onde roda

| Item | Valor |
|------|-------|
| Servidor | Railway (nuvem) |
| Endereco | vitae-app-production.up.railway.app |
| Porta local | 3002 |
| Banco de dados | PostgreSQL via Supabase |
| Armazenamento de arquivos | Supabase Storage |
| Pasta no projeto | `backend/` |

---

## O que o servidor faz

### Autenticacao (cadastro, login, verificacao)
- Paciente ou medico cria conta com nome, email, celular, senha
- Senha e criptografada (nunca guardada em texto)
- Login retorna um "token" que dura 30 dias (o app guarda no celular)
- Token de renovacao dura 90 dias (nao precisa logar de novo)
- Google Sign-In tambem funciona
- Verificacao por SMS: Twilio envia codigo de 6 digitos
- Reset de senha: Resend envia email com link

### Upload e Analise de Exames
1. Paciente envia foto ou PDF do exame
2. Arquivo vai pro Supabase Storage
3. Claude (IA da Anthropic) le o documento inteiro
4. Extrai todos os parametros (hemoglobina, glicose, colesterol, etc.)
5. Classifica cada parametro: NORMAL, ATENCAO ou CRITICO
6. Gera resumo em linguagem simples
7. Gera recomendacoes personalizadas
8. Recalcula o score de saude

### Scan de Receita
1. Paciente tira foto da receita medica
2. Gemini (IA do Google) analisa a imagem
3. Identifica medicamentos, dosagens, frequencia
4. Cruza com alergias do paciente (alerta se tiver conflito)
5. Retorna lista pra paciente confirmar

### Score de Saude
Calcula uma nota de 0 a 100 baseada em 4 pilares:
| Pilar | Peso | De onde vem os dados |
|-------|------|---------------------|
| Sono | 20% | Check-in semanal |
| Atividade Fisica | 20% | Check-in semanal |
| Produtividade | 20% | Check-in semanal |
| Exames | 40% | Resultados dos exames enviados |

### Pre-Consulta (fluxo medico)
1. Medico cria template com perguntas
2. Pode usar IA pra gerar perguntas automaticamente
3. Gera um link unico
4. Envia pro paciente via WhatsApp/email
5. Paciente abre o link, responde as perguntas, pode gravar audio
6. IA gera resumo de 1 minuto pro medico

### Outras funcionalidades
| Funcao | O que faz |
|--------|-----------|
| CRUD Medicamentos | Adicionar, editar, listar, deletar medicamentos |
| CRUD Alergias | Adicionar, editar, listar, deletar alergias |
| Agendamentos | Criar e listar consultas marcadas |
| Autorizacoes | Paciente autoriza medico a ver seus dados |
| Notificacoes | Sistema de notificacoes internas |
| PDF | Gerar PDF do perfil de saude |
| Consentimento | Registrar aceite de termos e LGPD |

---

## Servicos Externos

| Servico | Empresa | Pra que |
|---------|---------|---------|
| Claude API | Anthropic | Ler exames, gerar resumos, estruturar dados |
| Claude Vision | Anthropic | OCR — extrair texto de PDFs e imagens |
| Gemini | Google | Reconhecer medicamentos em fotos de receita |
| Twilio | Twilio | Enviar SMS de verificacao |
| Resend | Resend | Enviar email de reset de senha |
| Supabase | Supabase | Banco de dados + armazenamento de arquivos |
| Railway | Railway | Hospedar o servidor |

---

## Como as telas falam com o servidor

Todas as telas HTML usam um arquivo chamado `api.js` que:
- Detecta se esta rodando local (localhost:3002) ou producao (Railway)
- Envia o token de acesso em toda requisicao
- Renova o token automaticamente se expirar
- Sanitiza dados contra ataques (XSS)
- Faz transicao animada entre paginas

---

## Pasta backend/ — Estrutura

```
backend/
├── src/
│   ├── index.js          ← ponto de entrada do servidor
│   ├── routes/           ← 16 arquivos, um pra cada funcionalidade
│   │   ├── auth.js       ← cadastro, login, verificacao, reset
│   │   ├── perfil.js     ← ver/editar perfil
│   │   ├── exames.js     ← upload, listar, ver, deletar exames
│   │   ├── medicamentos.js ← CRUD + scan de receita
│   │   ├── alergias.js   ← CRUD + scan
│   │   ├── scores.js     ← score atual, historico, melhorias
│   │   ├── medico.js     ← perfil e dashboard do medico
│   │   ├── pre-consulta.js ← fluxo completo de pre-consulta
│   │   ├── templates.js  ← templates de perguntas (IA)
│   │   ├── agendamento.js
│   │   ├── autorizacao.js
│   │   ├── notificacoes.js
│   │   ├── pdf.js
│   │   ├── checkin.js
│   │   ├── consentimento.js
│   │   └── timeline.js
│   ├── services/
│   │   ├── ai.js         ← Claude API (exames + resumos)
│   │   ├── ocr.js        ← Claude Vision (ler documentos)
│   │   ├── score-engine.js ← calcular os 4 pilares
│   │   ├── storage.js    ← Supabase Storage
│   │   ├── sms.js        ← Twilio
│   │   ├── email.js      ← Resend
│   │   └── transcription.js ← transcrever audio
│   ├── middleware/
│   │   ├── auth.js       ← verificar se usuario esta logado
│   │   ├── validate.js   ← validar dados das requisicoes
│   │   └── errorHandler.js
│   └── utils/
│       └── prisma.js     ← conexao com banco de dados
├── prisma/
│   └── schema.prisma     ← definicao das 17 tabelas
├── .env                  ← credenciais (NAO sobe pro GitHub)
├── package.json          ← dependencias
└── railway.json          ← config de deploy
```
