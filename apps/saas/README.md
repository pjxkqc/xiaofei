# SaaS application

`apps/saas` is the Next.js product surface. It hosts the public customer
support channel, authenticated support operations, and the account and
organization features inherited from supastarter.

## Xiaofei surface

The product surface is deliberately kept to small, focused pages:

- `/support` is a public, no-login customer conversation page;
- `/inbox` is the authenticated support-agent inbox for online state, ownership,
  takeover, and human replies;
- `/chatbot` renders `XiaofeiChatConsole.tsx` for conversation and trace
  validation;
- `/agent-settings` renders `XiaofeiAgentSettings.tsx` for Agent, Knowledge
  Unit, release-gate, and Eval configuration;
- `/api-demo` is an authenticated comparison of the public OpenAPI status route
  and the typed browser oRPC client;
- `/knowledge/entries` adds and manages normalized entries for the shared
  public-support workspace from a file, one public webpage, or manual Q&A.
  `/knowledge/documents` remains the source-document view with bounded metadata
  pages and full bodies loaded only when a document is opened.
- `/knowledge/units` generates Draft KUs from current normalized entries and
  provides the minimal human review, edit, publish/revoke, and delete surface.
- `/knowledge/capabilities` reviews the derived capability plan and runs the
  deterministic Eval gate before conversation use.

The authenticated knowledge and Chatbot pages share a four-step navigation:
source/entry ingestion → KU generation/review → capability review/Eval →
conversation testing. The active organization only affects inherited Supa
surfaces; it does not change this P0 public-support channel's knowledge.

The pages can:

- edit Agent instructions, collection follow-up limits, and the bounded
  knowledge-miss clarification/operator-attention policy;
- load the enhanced nine-category default knowledge into the current draft, or
  import/edit Markdown knowledge without silently overwriting persisted tenant
  customization;
- save configuration through the protected Xiaofei oRPC module;
- review the capability plan derived from released KUs;
- run deterministic KU-match, Action, and Owner release assertions;
- stream guarded replies through the existing `ai.stream` procedure;
- display LangGraph/Mastra execution, KU, owner, next-action, and trace
  evidence;
- reset the server-side demonstration conversation.
- persist public customer/human messages and poll the shared channel without
  introducing a second realtime stack.
- prioritize knowledge-miss conversations in `/inbox` with a visible
  **待人工关注** state while Xiaofei retains ownership and keeps matching later
  customer messages.
- upload, scrape, or manually add knowledge; inspect, edit, change lifecycle
  status, and delete normalized entries and source documents.
- page through bounded metadata-only document lists while loading body text
  only for the selected document.

The browser never receives model keys or database credentials.

## Preview one-click login

The `/login` page can show a Preview-only `Continue as Preview operator` button
for an authorized deployment smoke test. It is disabled by default and the
server endpoint fails closed unless **both** deployment variables are set:

```text
VERCEL_ENV=preview
PREVIEW_ONE_CLICK_LOGIN_ENABLED=true
```

Set `PREVIEW_ONE_CLICK_LOGIN_ENABLED=true` only in Vercel's Preview environment,
then redeploy the intended Preview. The button calls same-origin
`POST /api/auth/preview-one-click-login`; it creates or reuses the isolated
Preview operator and uses Better Auth to set the normal session cookie. It does
not expose a password, API key, or session token to the browser.

To roll back immediately, remove the Preview variable or set it to any value
other than `true`, then redeploy. Production and development deployments stay
disabled even if the flag is present.

The long-lived `uat` Git branch is also a Vercel Preview deployment, so it uses
this same one-click login contract. Its stable branch alias and Neon
`preview/uat` database are the shared UAT environment; short-lived feature
Previews remain disposable.

## Request paths

```text
configuration / eval
  XiaofeiAgentSettings
    → same-origin /api/rpc
    → protected xiaofei.* procedure
    → shared P0 `channel:public-support` snapshot in PostgreSQL / Neon

knowledge governance
  KnowledgeEntries → KnowledgeUnits → KnowledgeCapabilities
    → support-role /api/rpc procedures
    → normalized source/entry/KU rows in the same `channel:public-support` workspace
    → reviewed capability + current Eval evidence in the shared snapshot

conversation
  AiChat
    → same-origin /api/rpc
    → protected ai.stream procedure
    → shared P0 `channel:public-support` snapshot
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
`/agent-settings` as the support role. Use the four-step navigation beginning
at `/knowledge/entries` to add a UTF-8
`.md`/`.txt` file, a provider-parsed PDF/DOCX/XLSX, one public webpage, or a
manual Q&A entry. Provider-only formats and webpages require server-side
Firecrawl configuration; manual Q&A and MD/TXT do not.

In a Vercel PR Preview only (`VERCEL_ENV=preview`), `/knowledge/entries` and
`/knowledge/documents` also display a **Preview 测试文件** selector with the
five fictional materials committed in `public/knowledge-test`. `/knowledge/entries`
adds a same-origin HTML fixture selector for the webpage flow. A selection only
prepares the normal input; the existing upload or scrape action remains the
step that creates a record. The selectors are hidden in Production and local
development; ordinary inputs remain available everywhere.

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
