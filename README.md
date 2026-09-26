# Foccus Car

**Sua frota. Seus clientes. Suas locações. Seu controle.**

Plataforma SaaS web para gestão e locação de veículos: uma aplicação responsiva (celular, tablet e desktop), instalável como app (PWA), com backend, banco multiempresa, autenticação e permissões.

- Arquitetura completa: [docs/ARQUITETURA.md](docs/ARQUITETURA.md)
- Plano por etapas: [docs/PLANO.md](docs/PLANO.md)

## Rodando localmente

Requisitos: Node 22+, pnpm 10+, Docker (ou um PostgreSQL 16).

```bash
pnpm install
docker compose up -d                 # Postgres + MinIO (cria papéis e banco de desenvolvimento)
cp .env.example apps/web/.env.local  # ajuste os valores
export DATABASE_MIGRATION_URL=postgres://foccus_owner:foccus_owner_dev@localhost:5432/foccus
pnpm db:migrate                      # migrations + RLS + restrições
pnpm db:seed                         # empresa Foccus Car e veículos de exemplo
pnpm dev                             # http://localhost:3000
```

Primeiro administrador (depois de criar a conta pelo site):

```bash
pnpm db:grant-role foccus-car seu@email.com ADMIN
```

## Testes

```bash
pnpm test               # regras de negócio e integrações
pnpm test:integration   # + isolamento multiempresa e cadastro contra o Postgres real
pnpm typecheck
```

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `apps/web` | Next.js: vitrine, login, cadastro, rotas `/api`, PWA |
| `packages/core` | Regras de negócio: perfis, permissões, status, elegibilidade, reservas |
| `packages/db` | Esquema (65 tabelas), migrations, RLS, seed |
| `packages/services` | Casos de uso do backend: cadastro do cliente, documentos, análise |
| `packages/auth` | Better Auth: Google, Microsoft, Apple, e-mail/senha |
| `packages/integrations` | Pagamentos (Mercado Pago, Asaas), telemetria, storage, notificações |
| `packages/ui` | Tokens do design system derivados da logo |
