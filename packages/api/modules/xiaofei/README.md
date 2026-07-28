# Xiaofei API module

This module is the application boundary between the public customer channel,
authenticated support operations, the Xiaofei domain kernel, AI adapters, and
persistence.

## Procedures

| Procedure                                  | Route                                               | Responsibility                                                        |
| ------------------------------------------ | --------------------------------------------------- | --------------------------------------------------------------------- |
| `status`                                   | `GET /xiaofei/status`                               | Return a public, allowlisted, database-free service status contract   |
| `getConfig`                                | `GET /xiaofei/config`                               | Load or create the tenant workspace snapshot                          |
| `saveConfig`                               | `PUT /xiaofei/config`                               | Persist Agent/fallback policy, rebuild KU, and run Mastra governance  |
| `reviewCapability`                         | `POST /xiaofei/capability/review`                   | Review or revoke the capability plan derived from released KUs        |
| `runEval`                                  | `POST /xiaofei/eval`                                | Run deterministic P0 assertions and update release gates              |
| `resetConversation`                        | `DELETE /xiaofei/conversations/{conversationId}`    | Delete the selected demonstration conversation                        |
| `startSupportConversation`                 | `POST /xiaofei/public/conversations`                | Start a token-scoped public customer conversation                     |
| `getPublicConversation`                    | `GET /xiaofei/public/conversations/{id}`            | Poll messages and update the customer's online heartbeat              |
| `sendPublicMessage`                        | `POST /xiaofei/public/conversations/{id}/messages`  | Route a customer message to Xiaofei or the current human owner        |
| `listAgentConversations`                   | `GET /xiaofei/support/conversations`                | List recent conversations for an authenticated support role           |
| `setAgentConversationOwner`                | `POST /xiaofei/support/conversations/{id}/owner`    | Transfer ownership between Xiaofei and a human agent                  |
| `sendAgentMessage`                         | `POST /xiaofei/support/conversations/{id}/messages` | Persist a human support reply                                         |
| `createKnowledgeDocument`                  | `POST /xiaofei/knowledge/documents`                 | Validate, extract, and persist a public-channel source document       |
| `listKnowledgeDocuments`                   | `GET /xiaofei/knowledge/documents`                  | Page through metadata-only public-channel source summaries            |
| `getKnowledgeDocument`                     | `GET /xiaofei/knowledge/documents/{id}`             | Read one public-channel source document                               |
| `updateKnowledgeDocument`                  | `PUT /xiaofei/knowledge/documents/{id}`             | Edit document metadata, body, category, or lifecycle status           |
| `deleteKnowledgeDocument`                  | `DELETE /xiaofei/knowledge/documents/{id}`          | Delete one public-channel source document                             |
| `createKnowledgeWeb`                       | `POST /xiaofei/knowledge/web`                       | Scrape one public webpage and create its source and normalized entry  |
| `createManualKnowledgeEntries`             | `POST /xiaofei/knowledge/manual`                    | Create up to 20 manual Q&A entries without a provider                 |
| `list/get/update/deleteKnowledgeEntry`     | `/xiaofei/knowledge/entries`                        | Manage public-channel normalized entries and eligibility              |
| `generate/list/update/deleteKnowledgeUnit` | `/xiaofei/knowledge/units`                          | Generate Draft KUs and support human review/publish/revoke operations |

Conversation streaming remains in `modules/ai/procedures/stream-message.ts`
because it is the existing AI SDK transport. That procedure now loads the
Xiaofei workspace, runs the governed runtime, persists state and traces, and
emits customer-visible text only after final authorization.

## Channel and role boundary

The current Flyranking validation slice uses one stable
`channel:public-support` workspace so the no-login customer page, support
inbox, Agent settings, capability review, deterministic Eval, and authenticated
validation Chatbot operate on the same state. This prevents an operator from
approving one tenant snapshot while the public customer channel continues to
run against an unreviewed default snapshot.

Customers receive a random UUID conversation token; they cannot list
conversations or choose a workspace. Inbox and governance procedures use
`supportProcedure`, which accepts the existing Supa `user` role, an explicit
future `support` role, or `admin`. Flyranking/LoopDesk tenant and channel
mapping remains a future adapter concern.

Knowledge sources, normalized entries, generated KUs, capability review, Eval,
authenticated Chatbot validation, and public conversations all use that same
server-selected public workspace. Changing the active organization or support
user does not silently switch the governed knowledge behind the customer
channel. Every knowledge procedure still starts with `supportProcedure`; the
browser cannot choose a workspace ID, and row reads or mutations remain scoped
to the server-resolved workspace.

## Persistence boundary

The service validates JSON snapshots with schemas from `@repo/xiaofei` before
and after persistence. New workspaces start from the domain default. New
conversations start from `createConversationState`; existing state and traces
must parse successfully before use. Older JSON snapshots that predate fallback
policy and consecutive knowledge-miss fields receive domain-owned defaults
during schema parsing; no database migration or destructive rewrite is needed.

`saveConfig` accepts the Agent's collection follow-up limit plus a bounded
fallback policy: zero to three knowledge-miss clarification turns, one
clarification reply, and one final soft-handoff reply. The API only validates
and persists these values; matching, risk classification, Owner transitions,
and Guardrail decisions remain in `@repo/xiaofei`.

Knowledge changes regenerate the capability plan and clear stale Eval evidence.
The API refuses to run Eval before the current capability plan is reviewed.

P0 keeps Agent and runtime aggregates as JSON. Conversation status, assignment,
last-seen/message timestamps, and message history are persisted on
`XiaofeiConversation` because the support inbox queries those lifecycle fields.

Knowledge ingestion limits and source handling are documented in the canonical
[P0 framework guide](../../../docs/xiaofei-p0-framework.md#knowledge-entry-ingestion).
The browser accepts files up to 4 MB with matching MIME and extension. MD/TXT
are normalized locally in the API process; PDF, DOCX, XLSX, and one public
webpage URL use the server-only Firecrawl parser.

Office-document and webpage ingestion is prepared behind the server-only
`KnowledgeContentParser` contract. Its Firecrawl adapter uses
`FIRECRAWL_API_KEY` only in the API process and returns normalized Markdown;
provider failures are mapped to safe, user-facing errors. Live provider smoke
evidence remains credential-gated. One ingested source and its bounded derived
entries are committed atomically so a failed batch cannot leave a partial
source or serialize many competing workspace-lock transactions.

Literal IP URLs are classified with `ipaddr.js`, including IPv4-mapped IPv6
forms, before Firecrawl is called. Hostname DNS resolution and rebinding remain
a provider-egress boundary to resolve in FLY-69; this API does not directly
connect to the submitted URL.

List accepts a validated optional cursor and a 1–50 limit (25 by default), and
never returns body text; `getKnowledgeDocument` is the only full-body read.
Database document-count and UTF-8 storage quota exceptions are translated to
clear `BAD_REQUEST` messages without exposing database details.

## Adding a procedure

- Start operator APIs with `supportProcedure`; public customer APIs must use
  unguessable conversation tokens and expose no list operation.
- Keep channel and workspace selection on the server.
- Validate all inputs and persisted snapshots.
- Keep product decisions in `@repo/xiaofei`.
- Keep engine/provider code in `@repo/ai`.
- Keep Prisma queries in `@repo/database`.
- Do not return secrets, provider headers, or raw connection errors.

## Status communication paths

The `status` procedure is intentionally public and side-effect-free. The OpenAPI
handler exposes it as `GET /api/xiaofei/status` and includes it in `/api/docs`.
Authenticated browser pages can call the identical contract through
`orpcClient.xiaofei.status()` on the same-origin `/api/rpc` transport.

## Tests

```bash
pnpm --filter @repo/api test
pnpm --filter @repo/api type-check
```

See the [domain guide](../../../xiaofei/README.md) before changing ownership,
handoff, or release behavior.
