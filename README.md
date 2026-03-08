# VITAE — Know Your Biology

App de saude inteligente que analisa exames reais com IA, calcula scores de saude e gera recomendacoes personalizadas.

## Estrutura do Projeto

```
vitae-app/
├── backend/                  # API Node.js + Express
│   ├── prisma/
│   │   └── schema.prisma     # Schema do banco (PostgreSQL)
│   ├── src/
│   │   ├── index.js          # Entry point do servidor
│   │   ├── middleware/
│   │   │   ├── auth.js       # JWT authentication
│   │   │   ├── validate.js   # Validacao com Zod
│   │   │   └── errorHandler.js
│   │   ├── routes/
│   │   │   ├── auth.js       # Cadastro, login, SMS, JWT
│   │   │   ├── perfil.js     # Dados pessoais e perfil de saude
│   │   │   ├── exames.js     # Upload, processamento, listagem
│   │   │   ├── medicamentos.js
│   │   │   ├── alergias.js
│   │   │   ├── scores.js     # Health score, bio age, melhorias
│   │   │   ├── checkin.js    # Check-in semanal
│   │   │   ├── notificacoes.js
│   │   │   └── pdf.js        # Geracao de PDF compartilhavel
│   │   ├── services/
│   │   │   ├── ai.js         # Claude API (analise de exames, scores, melhorias)
│   │   │   ├── ocr.js        # Google Cloud Vision (leitura de imagens)
│   │   │   ├── sms.js        # Twilio (verificacao por SMS)
│   │   │   ├── score-engine.js # Motor de calculo dos 4 pilares
│   │   │   └── storage.js    # Supabase Storage (arquivos de exame)
│   │   └── utils/
│   │       └── prisma.js     # Prisma client singleton
│   ├── .env.example
│   └── package.json
│
├── frontend/                 # Next.js + React + TypeScript
│   ├── src/
│   │   ├── app/              # Pages (App Router)
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx      # Splash
│   │   │   ├── onboarding/   # Slides iniciais
│   │   │   ├── cadastro/     # Cadastro + Login
│   │   │   ├── verificacao/  # Verificacao SMS
│   │   │   ├── quiz/         # Quiz de saude (onboarding)
│   │   │   ├── perfil/       # Tela principal (hub)
│   │   │   ├── exames/       # Lista + detalhe de exames
│   │   │   ├── melhorias/    # Recomendacoes personalizadas
│   │   │   └── dados-pessoais/ # Configuracoes e dados
│   │   ├── components/
│   │   │   ├── ui/           # TabBar, Modal, StatusBadge, etc.
│   │   │   └── layout/       # PageWrapper
│   │   ├── lib/
│   │   │   ├── api.ts        # Axios client com interceptors
│   │   │   └── auth.ts       # Helpers de autenticacao
│   │   ├── stores/           # Zustand stores
│   │   │   ├── auth.ts
│   │   │   ├── perfil.ts
│   │   │   ├── exames.ts
│   │   │   ├── scores.ts
│   │   │   ├── medicamentos.ts
│   │   │   └── alergias.ts
│   │   └── styles/
│   │       └── globals.css   # Tailwind + design system VITAE
│   ├── .env.example
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── package.json
│
└── *.html                    # Prototipos visuais (referencia)
```

## Setup Rapido

### 1. Criar contas necessarias

| Servico | Para que | Link |
|---------|----------|------|
| Supabase | Banco de dados + Storage | https://supabase.com |
| Anthropic | IA (Claude API) | https://console.anthropic.com |
| Twilio | SMS de verificacao | https://twilio.com |
| Google Cloud | OCR de imagens | https://console.cloud.google.com |

### 2. Backend

```bash
cd vitae-app/backend

# Copiar e preencher variaveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais

# Instalar dependencias
npm install

# Gerar Prisma client e criar tabelas
npx prisma generate
npx prisma db push

# Rodar servidor
npm run dev
# Backend rodando em http://localhost:3001
```

### 3. Frontend

```bash
cd vitae-app/frontend

# Copiar variaveis de ambiente
cp .env.example .env.local

# Instalar dependencias
npm install

# Rodar frontend
npm run dev
# Frontend rodando em http://localhost:3000
```

## Os 4 Pilares

| Pilar | Cor | Peso | Fontes |
|-------|-----|------|--------|
| Sono | #4A9FD9 (azul) | 20% | Check-ins, perfil, exames hormonais |
| Atividade Fisica | #4AD9A4 (verde) | 20% | Check-ins, perfil, exames cardiovasculares |
| Produtividade | #B482FF (roxo) | 20% | Check-ins, exames (tireoide, vitaminas, glicemia) |
| Exame | #C5A55A (dourado) | 40% | Todos os biomarcadores dos exames |

## Health Score

```
score_geral = (score_exame * 0.40) + (score_sono * 0.20) + (score_atividade * 0.20) + (score_produtividade * 0.20)
```

## APIs

### Auth
- `POST /auth/cadastro` — Criar conta
- `POST /auth/verificar-sms` — Verificar codigo SMS
- `POST /auth/login` — Login
- `POST /auth/refresh` — Renovar token

### Dados
- `GET/PUT /perfil` — Perfil de saude
- `CRUD /medicamentos` — Medicamentos
- `CRUD /alergias` — Alergias

### Exames
- `POST /exames/upload` — Enviar exame (foto/PDF)
- `GET /exames` — Listar exames
- `GET /exames/:id` — Detalhe com analise da IA

### Scores
- `GET /scores/atual` — Score atual + bio age
- `GET /scores/historico` — Historico para graficos
- `GET /scores/melhorias` — Recomendacoes da IA
- `POST /scores/recalcular` — Recalcular scores

### Outros
- `POST /checkin` — Check-in semanal
- `GET /notificacoes` — Notificacoes
- `POST /pdf/gerar` — Gerar PDF compartilhavel

## Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS, Zustand, Framer Motion, Recharts
- **Backend**: Node.js, Express, Prisma, Zod
- **Banco**: PostgreSQL (Supabase)
- **IA**: Claude API (Anthropic)
- **OCR**: Google Cloud Vision
- **SMS**: Twilio
- **Storage**: Supabase Storage
