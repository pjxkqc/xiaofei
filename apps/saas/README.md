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
- `/agent-settings/general`, `/agent-settings/fallback`, and
  `/agent-settings/status` separate Agent instructions, knowledge-miss/handoff
  policy, and read-only release status. `/agent-settings` redirects to the
  general page;
- `/api-demo` is an authenticated comparison of the public OpenAPI status route
  and the typed browser oRPC client;
- `/integrations/events` is an authenticated monitor for durable S2S ingress. It
  shows metadata by default, loads raw JSON only for a selected event, and its
  Preview simulator uses a protected server procedure rather than an ingest key.
- `/integrations/mock-worker` runs an authenticated Organization-scoped Email or
  WhatsApp simulator. It resolves the configured external merchant server-side,
  binds the customer/conversation, and records the Xiaofei delivery plus its
  ignored echo in the same event monitor.
- `/integrations/email` is the page version of the Worker handoff: current
  setup status, exact endpoints/headers, a complete request example, Preview
  defaults, and links through the four-step bidirectional flow.
- `/integrations/email-inbound` selects only bindings returned for the active
  Organization and exposes labeled Worker fields plus the equivalent
  `email.message.v1` JSON. It exercises inbound, outbound, duplicate, conflict,
  missing, and disabled-binding outcomes through the same persistence service;
  it never receives an ingest credential or calls the public HTTP route.
- `/integrations/events` includes an Email mirror metadata list (event,
  normalized direction/sender, conversation/job locators, and receipt times).
  It does not load payload, body, or attachment references until a scoped detail
  row is selected.
- `/integrations/email-bindings` lists the active Organization's Email company,
  account, address, and status. Members are read-only; owner/admin mutations
  are enforced on the server. No browser receives the Email ingest service key.
- `/inbox` displays the readable projection of normalized Email messages and
  the Mirror Job state. Preview/UAT users can explicitly run an AI-owned job;
  the governed reply is persisted before delivery is attempted.
- `/integrations/email-delivery` configures the built-in Receiver Mock or a
  public HTTPS callback, sends a status-event test, lists reply/status Outbox
  attempts, loads payload only on demand, and retries failed rows with the
  current setting. Only Organization owners/admins change the destination.
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
- save Agent behavior without rebuilding or replacing source-managed KUs;
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
`POST /api/auth/preview-one-click-login`; it idempotently creates or corrects
synthetic FLY-99 role fixtures and uses Better Auth to set the normal operator
session cookie. The operator and tenant-scoped role fixtures start with their
documented default Organization selected (Organization A for the operator), so
a fresh Preview does not initially look like an empty Personal account. The
fixture transaction allows for a cold Neon Preview compute, and the client
retries one transient server/connection failure. After signing out, reviewers
can use the Preview-only public
fixture credentials documented in `docs/releases/README.md`; they are not
secrets and must never be reused for real systems. Production has no shared
test account, and API keys/session tokens are never exposed to the browser.

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
  AgentGeneralSettings / FallbackSettings / AgentStatus
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
`/agent-settings/general` as the support role. Use the three Agent settings
pages for behavior and status, and the four-step navigation beginning at
`/knowledge/entries` to add a UTF-8
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
