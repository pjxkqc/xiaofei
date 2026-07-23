# SaaS application

`apps/saas` is the authenticated Next.js application. It hosts account and
organization features from supastarter and the current Xiaofei P0 control
surface.

## Xiaofei surface

The protected `/chatbot` route renders
`modules/ai/components/XiaofeiAgentConsole.tsx`. The page deliberately combines
the first Agent configuration, Knowledge Unit, release-gate, Eval, Chatbot, and
trace views so the framework can be validated before the product is split into
specialized workspaces.

The console can:

- select `langgraph` or `mastra` as the conversation runtime;
- edit Agent instructions, follow-up limits, and Markdown knowledge;
- save configuration through the protected Xiaofei oRPC module;
- run deterministic P0 release assertions;
- stream guarded replies through the existing `ai.stream` procedure;
- display runtime, KU, owner, next-action, and trace evidence;
- reset the server-side demonstration conversation.

The browser never receives model keys or database credentials.

## Request paths

```text
configuration / eval
  XiaofeiAgentConsole
    → same-origin /api/rpc
    → protected xiaofei.* procedure
    → tenant snapshot in PostgreSQL / Neon

conversation
  AiChat
    → same-origin /api/rpc
    → protected ai.stream procedure
    → governed Xiaofei runtime
    → final UI message only after Guardrail authorization
```

## Local use

Run the entire workspace from the repository root:

```bash
pnpm dev
```

Or run this app after Prisma generation:

```bash
pnpm --filter @repo/database generate
pnpm --filter saas dev
```

The app listens on `http://localhost:3000`. Create a password user, complete
onboarding, then open `/chatbot`.

## Tests

```bash
pnpm --filter saas test
pnpm --filter saas type-check
pnpm --filter saas build
pnpm --filter saas e2e:ci
```

The repository-level GitHub workflow is the authority for the complete test
matrix.

## Change boundaries

- UI-only state belongs under `modules/ai`.
- Product contracts and deterministic decisions belong in `@repo/xiaofei`.
- Mastra, LangGraph, and model-provider code belongs in `@repo/ai`.
- Tenant authorization and database orchestration belong in `@repo/api`.
- Do not call a model provider, Prisma client, or future channel SDK directly
  from a client component.

See the [P0 framework architecture](../../docs/xiaofei-p0-framework.md) for the
full flow.
