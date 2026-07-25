# SaaS application

`apps/saas` is the Next.js product surface. It hosts the public customer
support channel, authenticated support operations, and the account and
organization features inherited from supastarter.

## Xiaofei surface

The product surface is deliberately kept to six small pages:

- `/support` is a public, no-login customer conversation page;
- `/inbox` is the authenticated support-agent inbox for online state, ownership,
  takeover, and human replies;
- `/chatbot` renders `XiaofeiChatConsole.tsx` for conversation and trace
  validation;
- `/agent-settings` renders `XiaofeiAgentSettings.tsx` for Agent, Knowledge
  Unit, release-gate, and Eval configuration;
- `/api-demo` is an authenticated comparison of the public OpenAPI status route
  and the typed browser oRPC client;
- `/knowledge/documents` manages tenant-scoped Markdown, TXT, and DOCX source
  documents through authenticated oRPC procedures, with bounded metadata pages
  and full document bodies loaded only when a document is opened.

The pages can:

- edit Agent instructions and follow-up limits, or import/edit Markdown
  knowledge;
- save configuration through the protected Xiaofei oRPC module;
- review the capability plan derived from released KUs;
- run deterministic KU-match, Action, and Owner release assertions;
- stream guarded replies through the existing `ai.stream` procedure;
- display LangGraph/Mastra execution, KU, owner, next-action, and trace
  evidence;
- reset the server-side demonstration conversation.
- persist public customer/human messages and poll the shared channel without
  introducing a second realtime stack.
- upload, inspect, edit, change lifecycle status, and delete source documents.
- page through bounded metadata-only document lists while loading body text
  only for the selected document.

The browser never receives model keys or database credentials.

## Request paths

```text
configuration / eval
  XiaofeiAgentSettings
    → same-origin /api/rpc
    → protected xiaofei.* procedure
    → tenant snapshot in PostgreSQL / Neon

conversation
  AiChat
    → same-origin /api/rpc
    → protected ai.stream procedure
    → LangGraph state orchestration
    → Mastra Agent generation when the graph permits it
    → final UI message only after Guardrail authorization

public support loop
  PublicSupportChat (/support)
    → public UUID-scoped xiaofei procedure
    → shared XiaofeiWorkspace + XiaofeiConversation
    ↔ SupportInbox (/inbox, authenticated support role)

status communication demo
  ApiStatusDemo (/api-demo, authenticated page)
    → GET /api/xiaofei/status (public OpenAPI HTTP route)
    → orpcClient.xiaofei.status() (typed same-origin /api/rpc transport)
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

The app listens on `http://localhost:3000`. Use `/support` without logging in.
Create a password user, complete onboarding, then use `/inbox` and
`/agent-settings` as the support role. Use `/knowledge/documents` to upload a
UTF-8 `.md` or `.txt` file, or a `.docx` containing ordinary paragraphs; DOCX
images, OCR, and complex tables are intentionally not supported.

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
