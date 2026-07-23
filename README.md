# Xiaofei

Xiaofei is an Agent control plane built on the supastarter Next.js monorepo. The
current P0 slice proves a controlled customer-service Agent: tenant-owned
configuration, structured Knowledge Units, stateful conversations, guarded
model output, deterministic evaluation, human handoff, and business-readable
traces.

This branch intentionally provides a complete framework with a small product
surface. It is ready for architecture and workflow validation, but it is not a
production-complete Agent Center.

## What works in P0

- configure an Agent instruction, runtime, follow-up limit, and Markdown
  knowledge source;
- parse each Markdown section into a governed `KnowledgeUnit`;
- run Mastra Agent and governance Workflow adapters;
- run a LangGraph state graph for multi-turn slot collection;
- persist tenant snapshots, conversation state, and trace events in PostgreSQL
  or Neon;
- prevent stale AI output with `ownerEpoch`;
- guard the complete candidate reply before it becomes customer-visible;
- transfer high-risk, incomplete, or exhausted conversations to a human;
- run four deterministic release assertions from the same control page.

The authenticated control page is available at `/chatbot`.

## Architecture

```mermaid
flowchart TD
  UI["Next.js /chatbot control page"] --> API["Protected oRPC boundary"]
  API --> GOVERN["Mastra governance Workflow"]
  API --> RUNTIME{"Selected runtime"}
  RUNTIME --> MASTRA["Mastra Agent"]
  RUNTIME --> LANGGRAPH["LangGraph StateGraph"]
  GOVERN --> DOMAIN["@repo/xiaofei domain kernel"]
  MASTRA --> DOMAIN
  LANGGRAPH --> DOMAIN
  DOMAIN --> MODEL["OpenAI-compatible Chat Completions"]
  DOMAIN --> DB["PostgreSQL / Neon snapshots"]
  DOMAIN --> SEND["Guarded channel adapter boundary"]
```

The domain kernel owns Agent, KU, ownership, policy, evaluation, handoff, and
trace contracts. Mastra and LangGraph are replaceable adapters; neither is
allowed to become the product data model.

## Repository map

| Path                                                                       | Responsibility                                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [`apps/saas`](./apps/saas/README.md)                                       | Authenticated SaaS application and the minimal Xiaofei control page            |
| [`packages/xiaofei`](./packages/xiaofei/README.md)                         | Vendor-neutral domain contracts and deterministic P0 runtime                   |
| [`packages/ai`](./packages/ai/README.md)                                   | Model provider plus Mastra and LangGraph adapters                              |
| [`packages/api/modules/xiaofei`](./packages/api/modules/xiaofei/README.md) | Tenant authorization, configuration, evaluation, and persistence orchestration |
| [`packages/database/prisma`](./packages/database/prisma/README.md)         | Prisma schema, generated client, and Xiaofei persistence                       |
| [`docs`](./docs/README.md)                                                 | Architecture decisions and PR Preview operating guides                         |
| [`.github/workflows`](./.github/workflows)                                 | Quality gate and Neon Preview cleanup                                          |
| [`scripts`](./scripts)                                                     | Vercel schema/build orchestration and Neon cleanup implementation              |

The remaining apps and packages are inherited supastarter capabilities for
marketing, authentication, organizations, billing, email, storage, UI, and
shared tooling.

## Local development

### Prerequisites

- Node.js 22 or newer;
- pnpm 11.3.0 through Corepack;
- PostgreSQL, either local/Docker or a reachable Neon database;
- an OpenAI API key or an OpenAI-compatible Chat Completions endpoint.

### Start the workspace

```bash
corepack enable
pnpm install
cp .env.local.example .env
```

For the bundled local PostgreSQL and MinIO services:

```bash
docker compose up -d postgres minio minio-setup
```

Use the local database URL documented in `.env.local.example`, then initialize
the schema and generated Prisma client:

```bash
pnpm --filter @repo/database push
pnpm --filter @repo/database generate
pnpm dev
```

Development services:

| Service           | URL                     |
| ----------------- | ----------------------- |
| SaaS and Xiaofei  | `http://localhost:3000` |
| Marketing         | `http://localhost:3001` |
| Documentation app | `http://localhost:3002` |
| Mail preview      | `http://localhost:3003` |
| MinIO console     | `http://localhost:9001` |

Create a password account, complete onboarding, and open
`http://localhost:3000/chatbot`. Signup email verification is disabled in
`packages/auth/config.ts`; password users are signed in immediately.

## Environment

Start from [`.env.local.example`](./.env.local.example). The smallest useful
Xiaofei setup is:

| Variable                                | Required              | Purpose                                        |
| --------------------------------------- | --------------------- | ---------------------------------------------- |
| `DATABASE_URL`                          | Yes                   | Runtime PostgreSQL connection                  |
| `DATABASE_URL_UNPOOLED` or `DIRECT_URL` | Vercel                | Direct schema connection for Preview builds    |
| `BETTER_AUTH_SECRET`                    | Yes                   | Signs authentication data                      |
| `NEXT_PUBLIC_SAAS_URL`                  | Yes locally           | Auth callbacks and absolute application URLs   |
| `MAIL_PROVIDER=console`                 | Recommended locally   | Prevents real email delivery                   |
| `OPENAI_API_KEY`                        | Yes for model replies | Server-only model credential                   |
| `OPENAI_BASE_URL`                       | Optional              | OpenAI-compatible `/v1` endpoint               |
| `OPENAI_MODEL`                          | Yes for model replies | Exact model identifier exposed by the endpoint |

GitHub and Google OAuth variables are optional for password-based local testing,
but both client ID and client secret must be configured before using the
corresponding social-login button. Never prefix model or database credentials
with `NEXT_PUBLIC_`.

## Validation

Run the same core checks used by the pull-request quality gate:

```bash
pnpm lint
pnpm format:check
pnpm type-check
pnpm test
pnpm build
```

Focused checks are also available:

```bash
pnpm --filter @repo/xiaofei test
pnpm --filter @repo/ai test
pnpm --filter @repo/api test
pnpm --filter saas test
```

The manual P0 smoke path is:

1. save the default configuration and confirm the Mastra governance Workflow
   leaves the Agent review-ready;
2. run P0 Eval and confirm `4/4` assertions pass;
3. select LangGraph and send a damaged-item message;
4. provide an order ID and then a damage-photo reference across separate turns;
5. confirm the owner changes from AI to human only after the required
   information is complete;
6. reset, select Mastra, ask about service scope, and confirm runtime, KU,
   ownership, next-action, and trace evidence are displayed;
7. send a refund or complaint request and confirm no business action is
   executed and the conversation exits to a human.

## Delivery

Pull requests run GitHub quality checks and create an isolated Vercel + Neon
Preview. Closing a same-repository PR triggers explicit cleanup of the exact
matching Neon Preview branch, while the repository separately deletes merged
source branches. Vercel immutable deployments follow Vercel's retention policy
and are not the database-isolation boundary.

See [GitHub → Vercel → Neon PR Preview CI/CD](./docs/pr-preview-setup.md) for
configuration, required evidence, cleanup semantics, and troubleshooting.

## Documentation

- [Documentation index](./docs/README.md)
- [P0 framework architecture](./docs/xiaofei-p0-framework.md)
- [Domain foundation and invariants](./docs/xiaofei-foundation.md)
- [PR Preview CI/CD](./docs/pr-preview-setup.md)
- [Coding agent guidelines](./agents.md)

## Deliberate P0 limits

The current slice uses deterministic Markdown parsing, keyword/state matching,
JSON aggregate snapshots, deterministic evaluation, and adapter stubs for real
customer-service delivery. Vector retrieval, document ingestion, normalized
versioned releases, model judges, production channel SDKs, and high-risk
business writes remain deferred until the framework is validated.

The original SaaS foundation is [supastarter for Next.js](https://supastarter.dev).
