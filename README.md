# CIFHER Plataforma

Plataforma premium de rifas online com React, TypeScript, Vite, TailwindCSS, React Query, Zustand, Supabase e um servidor mock Express para desenvolvimento local.

## Status

Este repositório já possui um frontend funcional, dashboard admin, fluxo de compra simulado, cotas premiadas, caixinhas, stories, galeria de ganhadores e serviços mockados. A versão atual roda localmente sem Supabase real; para produção, conecte Supabase Auth, PostgreSQL, RLS, Storage, Realtime e Edge Functions usando as migrations como base.

## Stack

- React 19 + TypeScript
- Vite 6
- TailwindCSS 4
- React Router
- React Query
- Zustand
- Lucide React
- Motion
- Supabase JS
- Express mock server

## Rodando Localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Scripts

```bash
npm run dev      # servidor Express + Vite em middleware mode
npm run lint     # TypeScript sem emitir arquivos
npm run build    # build frontend + bundle ESM do servidor
npm run start    # executa dist/server.js
```

## Ambiente

Copie `.env.example` para `.env.local` e preencha:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPERADMIN_EMAIL`
- `SUPERADMIN_PASSWORD`
- `JWT_SECRET`
- `DEFAULT_TENANT_ID`
- `GEMINI_API_KEY`, se recursos de IA forem usados

Sem Supabase configurado, a API local mantém os dados em memória. O acesso administrativo exige o superadmin configurado no ambiente e usa senha bcrypt com JWT assinado.

O seed multitenant inicial contém `principal` (Plataforma Principal), `cliente-a` e `cliente-b`. O tenant `principal` permanece associado aos dados legados enquanto a persistência operacional é migrada para `tenant_id`.

## Rotas Principais

- `/` home premium com rifas, stories e ganhadores
- `/raffle/:id` compra, PIX mock, revelação de números e caixinhas
- `/auth` login/cadastro
- `/dashboard` dashboard do usuário
- `/afiliados` dashboard de afiliados
- `/caixinhas` abertura de lootboxes
- `/admin` dashboard administrativo protegido por autenticação mock/role

## Supabase

As migrations em `supabase/migrations` devem evoluir para ser a fonte de verdade do banco. O schema precisa conter:

- usuarios/profiles com role
- premios/rifas
- compras com arrays de números
- afiliados e comissões
- caixinhas e histórico
- stories
- ganhadores
- premios instantâneos
- configurações
- RLS e policies
- funções transacionais para alocação de cotas

## Deploy Vercel

Para frontend estático, use o output `dist`. Para produção com Supabase, mova a lógica sensível do Express mock para Edge Functions ou API routes serverless, mantendo secrets fora do cliente.

```bash
npm run build
```

Configure as variáveis no painel da Vercel antes do deploy.

## Auditoria Atual

Pontos já tratados:

- rate limiter limitado às rotas `/api`
- build do servidor ajustado para ESM
- `import.meta.env` tipado via `vite/client`
- checkout envia `refCode`
- endpoints admin faltantes para rifas e cotas premiadas
- media type inferido automaticamente por URL em cadastros admin
- Auth store preparado para Supabase real com fallback mock

Próximos pontos críticos:

- substituir backend mock por Supabase Edge Functions
- proteger todas as rotas sensíveis com RLS real
- migrar estado em memória para PostgreSQL
- criar testes automatizados
- adicionar virtualização e code splitting por rota
- revisar UX mobile de todo admin
