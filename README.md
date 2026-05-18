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
pnpm run ci          # Run the full local CI gate
pnpm lint            # Lint all packages
pnpm typecheck       # Type-check all packages
pnpm test:unit       # Run Vitest unit and integration tests
pnpm test:coverage   # Run Vitest with V8 coverage
pnpm test:e2e        # Run Playwright browser tests
pnpm test:all        # Type-check, lint, coverage, and E2E checks
pnpm format          # Format the repo
pnpm format:check    # Check formatting
```

## Testing Architecture

The production testing pipeline is configured at the monorepo root.

- Vitest runs TypeScript unit and integration tests in `apps/web` and `packages`.
- React Testing Library validates client components with the shared Next.js test setup in `apps/web/test/setup.ts`.
- Playwright runs responsive E2E checks against the Next.js app with an automatic dev server.
- AI response validation tests cover citation requirements, risk-aware uncertainty language, and hallucination guardrails.
- Coverage reports are written to `coverage/` as text, lcov, and JSON summary outputs.

Install Playwright browsers once on a new machine:

```bash
pnpm exec playwright install chromium
```

## CI/CD And Deployment

GitHub Actions owns the production delivery pipeline.

- `.github/workflows/ci.yml` runs on pull requests and `main` pushes with formatting, linting, type-checking, Vitest coverage, and Playwright E2E tests.
- `.github/workflows/deploy.yml` runs the pre-deployment gate, creates Vercel preview deployments for pull requests, and deploys production from `main`.
- `.github/workflows/rollback.yml` provides a manual production rollback flow through Vercel CLI.
- `vercel.json` pins the Vercel build and install commands for the monorepo.

Required GitHub repository secrets:

```bash
VERCEL_TOKEN=...
VERCEL_ORG_ID=...
VERCEL_PROJECT_ID=...
```

Configure GitHub Environments named `preview` and `production`. Put deployment-specific application secrets in Vercel Environment Variables, not in GitHub Actions, so `vercel pull --environment=preview|production` hydrates the correct values during deployment.

Production environment variables must include:

```bash
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
DATABASE_URL=...
ENCRYPTION_KEY=...
OPENAI_API_KEY=...
```

Deployment behavior:

- Pull requests run CI and publish an isolated Vercel preview URL.
- Merges to `main` run the same quality gate and publish production.
- Manual workflow dispatch can deploy either preview or production.
- Rollbacks are manual and require the target previous Vercel deployment URL.

## Pages

- `/` landing page
- `/dashboard` dashboard shell and overview
- `/dashboard/admin` enterprise admin platform
- `/dashboard/chat` streaming RAG chat workspace
- `/dashboard/knowledge-base` document management and upload workspace
- `/dashboard/connectors` enterprise source connector management
- `/dashboard/workflows` AI workflow automation builder and run history
- `/dashboard/observability` AI, retrieval, usage, and performance telemetry
- `/dashboard/security` audit logs, governance settings, rate limits, and GDPR controls
- `/dashboard/settings` workspace and profile settings

## Environment

The web app validates environment variables with Zod in `apps/web/lib/env.ts`.

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=RAG Knowledge Assistant
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_replace_me
CLERK_SECRET_KEY=sk_test_replace_me
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_knowledge_assistant?schema=public
ENCRYPTION_KEY=replace_with_32_plus_character_key
```

## Authentication And Database

Authentication is powered by Clerk. Enable Organizations in the Clerk Dashboard, set membership as required for multi-tenant workspaces, and configure the sign-in and sign-up URLs as `/sign-in` and `/sign-up`.

Prisma uses PostgreSQL and includes the initial RBAC schema:

- `users`
- `organizations`
- `memberships`

Useful commands:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:deploy
pnpm db:studio
pnpm db:seed
```

Protected app routes are enforced in `apps/web/middleware.ts`. API routes perform their own session, organization, role, and input validation before mutating data.

## Enterprise Admin Platform

The admin dashboard is available at `/dashboard/admin` for organization admins.

- User management table with roles, statuses, invitations, and active seats.
- Workspace management metrics for documents, indexed content, connectors, workflows, and retrieval quality.
- Usage analytics with daily message and token charting.
- AI monitoring for calls, tokens, provider breakdown, latency, errors, and recent events.
- Billing metrics with plan estimate, seat count, base subscription, token overage, and projected monthly total.
- Admin data is exposed through `GET /api/admin/metrics` and remains scoped to the active organization.

## Performance

Production performance optimizations include:

- Private tenant-keyed TTL caching for expensive admin and observability analytics.
- Cache-control headers for authenticated analytics APIs and immutable CDN headers for static assets.
- Dynamic imports for heavyweight dashboard modules to reduce initial dashboard bundle pressure.
- RAG retrieval result caching with `RAG_RETRIEVAL_CACHE_SECONDS`.
- Bounded retrieved context chunks and `AI_MAX_OUTPUT_TOKENS` to reduce token spend and latency.
- Streaming responses disable proxy buffering with `X-Accel-Buffering: no`.

## Security And Governance

The enterprise security layer spans `apps/web/lib/security`, Prisma audit tables, guarded API routes, and `/dashboard/security`.

- RBAC permissions are centralized in `apps/web/lib/rbac.ts` and shared through `packages/types`.
- `enforceApiSecurity` applies tenant checks, permission checks, DB-backed rate limits, prompt injection scanning, and content moderation.
- `audit_logs` records sensitive reads, writes, blocked requests, GDPR actions, uploads, embeddings, chat, agents, and invitations.
- `rate_limit_buckets` stores fixed-window request counters per tenant/user/route.
- Prompt injection protection and moderation are configurable through validated environment variables.
- `SecretManager` provides AES-256-GCM encryption/decryption for server-side secret handling.
- GDPR-ready services support tenant-scoped user export and soft deletion.
- Organization governance settings include data region and retention days for data isolation policy.

Security configuration:

```bash
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_REQUESTS=60
AI_RATE_LIMIT_REQUESTS=20
SECURITY_BLOCK_PROMPT_INJECTION=true
SECURITY_ENABLE_MODERATION=true
DATA_RETENTION_DAYS=365
CONNECTOR_WEBHOOK_SECRET=replace_with_connector_webhook_secret
```

## Enterprise Source Connectors

The connector framework lives under `apps/web/lib/connectors` and supports Google Drive, Notion, Confluence, Slack, and GitHub.

- `ConnectorAdapter` defines a provider-neutral contract for sync, verification, webhook handling, and document normalization.
- Provider adapters map remote records into tenant-scoped `documents` and `document_chunks`.
- `connectors` stores encrypted provider credentials, sync settings, cursors, status, webhook timestamps, and soft-delete state.
- `connector_sync_jobs` stores manual, scheduled, and webhook-triggered sync history.
- `ConnectorSyncQueue` provides an in-process background job boundary that can be replaced with BullMQ, Inngest, Trigger.dev, or a managed worker.
- Incremental sync is cursor-ready through `syncCursor` and `cursorBefore`/`cursorAfter` job fields.
- Webhook updates are accepted at `POST /api/connectors/webhooks` and protected by `CONNECTOR_WEBHOOK_SECRET` when configured.
- Connector management is exposed at `/dashboard/connectors`.

Connector APIs:

```bash
GET /api/connectors
POST /api/connectors
PATCH /api/connectors/:connectorId
DELETE /api/connectors/:connectorId
GET /api/connectors/sync
POST /api/connectors/sync
POST /api/connectors/webhooks
```

## AI Workflow Automation

The workflow engine lives under `apps/web/lib/workflows` and provides tenant-scoped orchestration for AI and ingestion operations.

- `workflows` stores workflow definitions, trigger configuration, action graphs, run status, and scheduling metadata.
- `workflow_runs` and `workflow_run_steps` store execution history with step-level outputs and errors.
- `WorkflowService` creates, updates, schedules, triggers, and executes workflows.
- `WorkflowQueue` provides the background execution boundary for manual and scheduled runs.
- Supported triggers include manual, scheduled, connector webhook, and document-created events.
- Supported actions include syncing one connector, syncing all due connectors, ingesting pending documents, and generating AI document summaries.
- Connector webhooks can launch matching active workflows after provider sync jobs are queued.
- Workflow management is exposed at `/dashboard/workflows`.

Workflow APIs:

```bash
GET /api/workflows
POST /api/workflows
PATCH /api/workflows/:workflowId
DELETE /api/workflows/:workflowId
GET /api/workflows/run
POST /api/workflows/run
```

## RAG Database Architecture

The PostgreSQL schema includes pgvector-backed retrieval infrastructure:

- `documents` stores tenant-scoped source records with metadata, status, soft delete, and audit timestamps.
- `document_chunks` stores normalized text chunks, token counts, character offsets, and chunk metadata.
- `embeddings` stores `vector(1536)` embeddings with provider/model metadata and an HNSW cosine index.
- `conversations` and `messages` store chat history per organization.
- `conversation_summaries` stores compressed tenant-scoped conversation state.
- `memory_items` stores semantic long-term assistant memory with optional pgvector embeddings.
- `prompts` stores versioned prompt templates per organization.
- `retrieval_logs` stores query, ranking, similarity, latency, and source trace telemetry.

The migration `prisma/migrations/20260511090000_rag_vector_infrastructure/migration.sql` enables `pgvector` and `pgcrypto`, creates the RAG tables, and adds tenant-aware indexes and foreign keys.

Application data access is organized under `apps/web/lib/db`:

- `repositories` provide tenant-scoped CRUD and raw vector search methods.
- `services` compose repository calls into transactional workflows.
- `transaction.ts` exposes a typed transaction helper around Prisma.
- `types` contains shared input and result contracts for RAG operations.

## Document Upload Pipeline

The upload infrastructure supports PDF, DOCX, TXT, and Markdown files through `/dashboard/knowledge-base/upload`.

- Drag-and-drop and multi-file upload dashboard
- Client-side upload progress using `XMLHttpRequest`
- Upload queue with retry support
- Server-side file validation and metadata extraction
- Local storage adapter under `storage/uploads`
- Parser abstraction for PDF, DOCX, and text/Markdown
- Async in-process processing queue
- Chunk generation persisted to `document_chunks`
- LangChain recursive text splitting with configurable chunk size and overlap
- Async OpenAI embedding generation persisted to pgvector
- Upload history powered by the tenant-scoped `documents` table

The implementation lives under `apps/web/lib/uploads`:

- `storage` defines the storage abstraction and local adapter.
- `parsers` contains document parser adapters.
- `queue` contains the upload queue.
- `services` contains processing and chunking services.
- `validation` contains file type and size checks.

## Embedding Pipeline

The embedding pipeline is implemented under `apps/web/lib/embeddings`.

- `providers` defines a provider abstraction and OpenAI implementation.
- `services/chunking-service.ts` uses LangChain `RecursiveCharacterTextSplitter`.
- `services/embedding-service.ts` batches chunks, retries provider calls, validates vector dimensions, and writes vectors to pgvector.
- `queue/embedding-queue.ts` provides an in-process queue-ready boundary that can later be swapped for BullMQ, Inngest, or a managed worker.

Configuration:

```bash
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
SENTRY_DSN=
SENTRY_ENVIRONMENT=development
POSTHOG_KEY=
POSTHOG_HOST=https://us.i.posthog.com
LANGSMITH_TRACING=false
LANGSMITH_API_KEY=
LANGSMITH_PROJECT=rag-knowledge-assistant
ENCRYPTION_KEY=replace_with_32_plus_character_key
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_REQUESTS=60
AI_RATE_LIMIT_REQUESTS=20
SECURITY_BLOCK_PROMPT_INJECTION=true
SECURITY_ENABLE_MODERATION=true
DATA_RETENTION_DAYS=365
CONNECTOR_WEBHOOK_SECRET=replace_with_connector_webhook_secret
OPENAI_API_KEY=sk-proj_replace_me
ANTHROPIC_API_KEY=sk-ant_replace_me
GOOGLE_API_KEY=replace_me
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
EMBEDDING_BATCH_SIZE=64
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
OPENAI_CHAT_MODEL=gpt-4.1
ANTHROPIC_CHAT_MODEL=claude-sonnet-4-5-20250929
GEMINI_CHAT_MODEL=gemini-2.5-flash
AI_PRIMARY_PROVIDER=openai
AI_ROUTING_STRATEGY=balanced
AI_FALLBACK_ORDER=openai,anthropic,gemini
AI_REQUEST_TIMEOUT_MS=45000
AGENT_MAX_STEPS=6
WEB_SEARCH_ENDPOINT=https://api.duckduckgo.com/
RAG_RETRIEVAL_LIMIT=8
RAG_MIN_SIMILARITY=0.2
RAG_MULTI_QUERY_LIMIT=4
RAG_CANDIDATE_MULTIPLIER=4
RAG_CONTEXT_MAX_TOKENS=3200
RAG_RETRIEVAL_CACHE_SECONDS=60
AI_MAX_OUTPUT_TOKENS=1600
ANALYTICS_CACHE_SECONDS=30
MEMORY_RECENT_MESSAGE_LIMIT=10
MEMORY_RETRIEVAL_LIMIT=6
MEMORY_MAX_CONTEXT_TOKENS=1800
MEMORY_SUMMARY_TRIGGER_TOKENS=2400
```

## LLM Orchestration

The multi-model orchestration layer lives under `apps/web/lib/ai`.

- `ModelRegistry` describes OpenAI, Anthropic, and Gemini model profiles with estimated cost, latency, quality, and streaming support.
- `ModelRouter` selects a provider dynamically using `balanced`, `cost`, `latency`, or `quality` routing.
- `AiProviderFactory` adapts provider SDKs into a unified LangChain chat model interface.
- `LlmOrchestrator` provides unified `stream` and `invoke` methods with ordered fallback models.
- RAG chat uses streaming orchestration, and conversation summarization uses cost-optimized orchestration.
- Assistant messages persist selected model and routing metadata for observability.

## Observability

The production observability layer spans `apps/web/lib/observability`, Sentry config files, and `/dashboard/observability`.

- Sentry captures server/client exceptions and API failures.
- PostHog captures browser page/user analytics and server-side product events.
- LangSmith receives AI, retrieval, and model traces when `LANGSMITH_TRACING=true`.
- `observability_events` stores tenant-scoped telemetry for in-product metrics even when external tools are not configured.
- AI calls capture provider, model, token estimates, latency, and estimated cost.
- Retrieval captures latency, result counts, quality evaluation, and tracing metadata.
- Agent and tool runs capture execution traces, latency, failures, and step counts.

Metrics are exposed at:

```bash
GET /api/observability/metrics
```

## Agent Framework

The enterprise agent layer lives under `apps/web/lib/agents`.

- `ToolRegistry` registers typed server-side tools with zod input validation.
- `AgentPlanner` uses the unified LLM orchestrator to produce provider-neutral JSON tool calls.
- `AgentOrchestrator` runs multi-step workflows with a configurable step limit and execution trace.
- Default tools include `knowledge_retrieval`, `web_search`, `calculator`, and `file_analysis`.
- Knowledge retrieval uses the advanced RAG engine and preserves citations.
- File analysis inspects tenant-scoped uploaded documents, metadata, chunks, and processing status.
- Calculator uses a deterministic arithmetic parser instead of evaluating arbitrary code.

Agent execution is exposed at:

```bash
POST /api/agents/run
```

## RAG Retrieval Engine

The retrieval engine lives under `apps/web/lib/rag`.

- Semantic search uses pgvector cosine similarity over stored embeddings.
- Hybrid retrieval combines pgvector semantic search with BM25-style PostgreSQL full-text ranking.
- Metadata filtering is supported through chunk JSONB metadata.
- Query preprocessing normalizes user input, extracts keywords, decomposes compound questions, and creates multi-query variants.
- Retrieval runs through pluggable stages under `pipeline`, then uses reciprocal rank fusion across vector and keyword candidates.
- Context ranking uses a pluggable reranker interface with diversity-aware scoring.
- Context deduplication removes overlapping chunks before final prompt assembly.
- Retrieval evaluation scores groundedness, coverage, diversity, and hallucination risk.
- Citation support assigns source ids like `[S1]` and carries document/chunk provenance.
- `PgVectorRetriever` implements a LangChain `BaseRetriever`.
- `RagChatService` orchestrates retrieval, memory context assembly, multi-provider streaming, conversation persistence, and retrieval logs.

## Conversation Memory

The memory architecture lives under `apps/web/lib/memory`.

- Short-term memory comes from the latest persisted conversation messages.
- Long-term memory is stored in `memory_items` with vector embeddings for semantic recall.
- Conversation summarization writes compressed state into `conversation_summaries`.
- Context window management ranks summary, semantic memory, and recent turns against a token budget.
- Automatic summarization runs after assistant responses once the configured token trigger is reached.
- Semantic memory retrieval is tenant-isolated and can combine organization-wide memories with conversation-specific memories.

Streaming chat is exposed at:

```bash
POST /api/chat
```

Manual embedding retry is exposed at:

```bash
POST /api/embeddings/:documentId
```

## Architecture Notes

- Feature-oriented app code lives under `apps/web/features`.
- Shared visual primitives live in `packages/ui` and are consumed through workspace imports.
- Shared contracts live in `packages/types`.
- Tooling defaults live in `packages/config`.
- The dashboard shell includes responsive sidebar navigation, top navigation, loading states, error boundaries, and dark/light theme support.
- Clerk session context is synchronized into Prisma on dashboard access so app data can be joined to authenticated users and active organizations.

## Production Expansion

Recommended next layers:

- Managed background workers for ingestion, embeddings, memory summarization, and retention jobs
- External object storage and signed upload URLs
- Fine-grained document-level ACLs
- Production retrieval evaluation suites
