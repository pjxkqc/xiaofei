# SaaS application

`apps/saas` is the Next.js product surface. It hosts the public customer
support channel, authenticated support operations, and the account and
organization features inherited from supastarter.

## Xiaofei surface

The product surface is deliberately kept to small, focused pages:

- `/support` is a public, no-login customer conversation page;
- `/inbox` is the authenticated support-agent inbox for online state, ownership,
  takeover, and human replies;
- `/knowledge` is the single **知识与托管** workbench: it guides a merchant
  through platform fallback and document ingestion, a durable multi-turn Test
  CA session with answer-bound correction, then explicit human acceptance and
  hosting. The sidebar has no separate Chatbot or Agent settings entry.
- `/knowledge/entries`, `/knowledge/units`, `/knowledge/capabilities`,
  `/knowledge/documents`, `/chatbot`, and `/agent-settings/**` remain safe
  compatibility redirects into the applicable workbench stage or its collapsed
  advanced governance section;
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
- The workbench's default knowledge-preparation stage accepts one document and
  shows its parsed entry summary. Its single **准备 Test CA** action safely
  activates current source entries, reuses or generates KUs, publishes valid
  units, and creates a Test CA without changing Active. Source details, web and
  manual entry intake, KU lifecycle editing, capability/Eval evidence, and
  Agent/fallback diagnostics remain in collapsed advanced governance.
- Long workbench actions acknowledge the browser request immediately, then show
  the honest states “request submitted”, “server processing”, and “waiting for
  the durable result”. The browser does not pretend to know an internal server
  sub-step that has not been streamed; after knowledge preparation succeeds it
  displays the actual server-recorded activation, generation/reuse, publish,
  Test-CA, and session timings.
- If preparation stops after durable progress, the workbench shows the failed
  stage, committed stages, partial count, and safe retry key returned by the
  server. Retrying the same selected entries does not rely on browser session
  state.

The authenticated workbench uses three merchant-readable stages: knowledge
preparation → Test CA conversation and correction → acceptance and hosting.
KU lifecycle forms and Eval remain available as advanced governance evidence,
not a second mandatory navigation flow. The active organization only affects
inherited Supa surfaces; it does not change this P0 public-support channel's
knowledge.

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
- submit every public or Inbox semantic mutation with the displayed revision,
  owner, and owner epoch. A concurrent takeover, reply, or AI completion keeps
  the newer state; the UI refreshes it and asks the user to retry instead of
  overwriting it. Presence polling does not advance the semantic revision.
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
advanced governance / eval
  AgentGeneralSettings / FallbackSettings / AgentStatus
    → same-origin /api/rpc
    → protected xiaofei.* procedure
    → shared P0 `channel:public-support` snapshot in PostgreSQL / Neon

knowledge and hosting workbench
  KnowledgeEntries → Test CA → human acceptance → hosting
    → support-role /api/rpc procedures
    → normalized source/entry/KU rows in the same `channel:public-support` workspace
    → reviewed capability + current Eval evidence in the shared snapshot

Test CA conversation
  KnowledgeVersioningPanel
    → same-origin /api/rpc `runVersionedTest`
    → saved testSessionId and TestTurn history
    → immutable Test CA manifest and guarded runtime
    → merchant hit: answer-bound KU Revision correction
    → platform/no-hit: new merchant-owned KU supplement
    → new Test CA / same-question rerun / new session

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
`/knowledge` as the support role. Begin on the knowledge-preparation stage to
add a UTF-8
`.md`/`.txt` file, a provider-parsed PDF/DOCX/XLSX, one public webpage, or a
manual Q&A entry. Provider-only formats and webpages require server-side
Firecrawl configuration; manual Q&A and MD/TXT do not.

In a Vercel PR Preview only (`VERCEL_ENV=preview`), the knowledge-preparation
stage and its advanced source-document details display a **Preview 测试文件** selector with the
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
