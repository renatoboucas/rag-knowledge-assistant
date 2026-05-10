# RAG Knowledge Assistant

Production-grade monorepo foundation for an enterprise retrieval-augmented knowledge assistant.

## Stack

- Next.js 15 App Router
- TypeScript with strict workspace defaults
- Tailwind CSS with shared theme preset
- shadcn/ui-style shared components in `packages/ui`
- Framer Motion
- ESLint, Prettier, Husky, lint-staged
- pnpm workspaces
- Zod environment validation

## Structure

```txt
apps/
  web/                    Next.js application
packages/
  config/                 Shared ESLint, Prettier, Tailwind config
  types/                  Shared TypeScript contracts
  ui/                     Shared UI primitives
```

## Getting Started

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

Open `http://localhost:3000`.

## Available Scripts

```bash
pnpm dev             # Run the web app
pnpm build           # Build all workspace packages
pnpm lint            # Lint all packages
pnpm typecheck       # Type-check all packages
pnpm format          # Format the repo
pnpm format:check    # Check formatting
```

## Pages

- `/` landing page
- `/dashboard` dashboard shell and overview
- `/dashboard/chat` chat placeholder
- `/dashboard/knowledge-base` knowledge base placeholder
- `/dashboard/settings` settings placeholder

## Environment

The web app validates public environment variables with Zod in `apps/web/lib/env.ts`.

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=RAG Knowledge Assistant
```

## Architecture Notes

- Feature-oriented app code lives under `apps/web/features`.
- Shared visual primitives live in `packages/ui` and are consumed through workspace imports.
- Shared contracts live in `packages/types`.
- Tooling defaults live in `packages/config`.
- The dashboard shell includes responsive sidebar navigation, top navigation, loading states, error boundaries, and dark/light theme support.

## Production Expansion

Recommended next layers:

- Authentication and role-aware source permissions
- Document ingestion pipeline
- Vector store and embedding provider integration
- Streaming chat API
- Citation and answer quality evaluation
- Observability, rate limiting, and audit logging
