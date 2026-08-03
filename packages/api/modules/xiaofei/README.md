# Xiaofei API module

This module is the application boundary between the public customer channel,
authenticated support operations, the Xiaofei domain kernel, AI adapters, and
persistence.

## Procedures

| Procedure                                  | Route                                               | Responsibility                                                                                                        |
| ------------------------------------------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `status`                                   | `GET /xiaofei/status`                               | Return a public, allowlisted, database-free service status contract                                                   |
| `POST /xiaofei/integrations/events`        | External HTTP route                                 | Bearer-authenticated durable ChannelEnvelope v1 ingress; fixed public workspace, 202 create, 200 replay, 409 conflict |
| `list/get/simulateIntegrationEvent`        | Authenticated `/xiaofei` RPC                        | Support monitor metadata/detail reads and Preview-safe sample ingress                                                 |
| `getConfig`                                | `GET /xiaofei/config`                               | Load or create the active Organization workspace snapshot                                                             |
| `saveAgentSettings`                        | `PATCH /xiaofei/agent-settings`                     | Update Agent/fallback behavior and revoke stale Eval evidence                                                         |
| `saveConfig`                               | `PUT /xiaofei/config`                               | Legacy Markdown rebuild plus Agent and managed-KU reconciliation                                                      |
| `reviewCapability`                         | `POST /xiaofei/capability/review`                   | Review or revoke the capability plan derived from released KUs                                                        |
| `runEval`                                  | `POST /xiaofei/eval`                                | Run deterministic P0 assertions and update release gates                                                              |
| `resetConversation`                        | `DELETE /xiaofei/conversations/{conversationId}`    | Delete the selected demonstration conversation                                                                        |
| `startSupportConversation`                 | `POST /xiaofei/public/conversations`                | Start a token-scoped public customer conversation                                                                     |
| `getPublicConversation`                    | `GET /xiaofei/public/conversations/{id}`            | Poll messages and update the customer's online heartbeat                                                              |
| `sendPublicMessage`                        | `POST /xiaofei/public/conversations/{id}/messages`  | Route a customer message to Xiaofei or the current human owner                                                        |
| `listAgentConversations`                   | `GET /xiaofei/support/conversations`                | List recent conversations for an authenticated support role                                                           |
| `list/get/create/update/archiveCustomer`   | Authenticated `/xiaofei` RPC                        | Organization-scoped customer lifecycle and customer-linked conversation history                                       |
| `setAgentConversationOwner`                | `POST /xiaofei/support/conversations/{id}/owner`    | Transfer ownership between Xiaofei and a human agent                                                                  |
| `sendAgentMessage`                         | `POST /xiaofei/support/conversations/{id}/messages` | Persist a human support reply                                                                                         |
| `createKnowledgeDocument`                  | `POST /xiaofei/knowledge/documents`                 | Validate, extract, and persist a public-channel source document                                                       |
| `listKnowledgeDocuments`                   | `GET /xiaofei/knowledge/documents`                  | Page through metadata-only public-channel source summaries                                                            |
| `getKnowledgeDocument`                     | `GET /xiaofei/knowledge/documents/{id}`             | Read one public-channel source document                                                                               |
| `updateKnowledgeDocument`                  | `PUT /xiaofei/knowledge/documents/{id}`             | Edit document metadata, body, category, or lifecycle status                                                           |
| `deleteKnowledgeDocument`                  | `DELETE /xiaofei/knowledge/documents/{id}`          | Delete one public-channel source document                                                                             |
| `createKnowledgeWeb`                       | `POST /xiaofei/knowledge/web`                       | Scrape one public webpage and create its source and normalized entry                                                  |
| `createManualKnowledgeEntries`             | `POST /xiaofei/knowledge/manual`                    | Create up to 20 manual Q&A entries without a provider                                                                 |
| `list/get/update/deleteKnowledgeEntry`     | `/xiaofei/knowledge/entries`                        | Manage public-channel normalized entries and eligibility                                                              |
| `generate/list/update/deleteKnowledgeUnit` | `/xiaofei/knowledge/units`                          | Generate Draft KUs and support human review/publish/revoke operations                                                 |

Conversation streaming remains in `modules/ai/procedures/stream-message.ts`
because it is the existing AI SDK transport. That procedure now loads the
Xiaofei workspace, runs the governed runtime, persists state and traces, and
emits customer-visible text only after final authorization.

## Organization, channel, and role boundary

Authenticated Xiaofei pages require an active Organization and a verified
membership. They resolve only `organization:{id}` on the server; the browser
cannot provide a workspace identifier. Members can read the Organization's
Agent, knowledge, Chatbot, Inbox, and event-monitor state and operate Inbox
conversations. Owners and Organization admins are additionally required for
Agent settings, capability review, Eval, and any knowledge mutation. Global
admin status does not bypass this Organization membership boundary.

`/customers` follows the same server-selected Organization boundary. Members
may read their Organization's customers and customer-linked conversation
history; only Organization owners/admins can create, edit, or archive a
customer. Customer IDs are resolved with the Organization selector before any
conversation query, so a customer from another Organization cannot be bound or
read. Legacy conversations with a null customer remain visible in `/inbox`.

The current product UI can create and maintain customers, but it intentionally
does not manufacture a customer-bound channel conversation. Preview acceptance
therefore verifies the history API/render contract with an existing
same-Organization binding; real channel-to-customer binding belongs to the
separately scoped FLY-101 Mock Worker.

Customers receive a random UUID conversation token; they cannot list
conversations or choose a workspace. Inbox and governance procedures use
`supportProcedure`, which accepts the existing Supa `user` role, an explicit
future `support` role, or `admin`. Flyranking/LoopDesk tenant and channel
mapping remains a future adapter concern.

Knowledge sources, normalized entries, generated KUs, capability review, Eval,
authenticated Chatbot validation, Inbox, and event-monitor reads use the same
server-selected Organization workspace. The unauthenticated `/support` flow
and external event ingress deliberately remain on legacy
`channel:public-support`; those conversations never appear in an Organization
Inbox. Every authenticated procedure starts with `supportProcedure`, then
resolves membership server-side; row reads and mutations remain scoped to that
resolved workspace.

## Persistence boundary

The service validates JSON snapshots with schemas from `@repo/xiaofei` before
and after persistence. New workspaces start from the domain default. New
conversations start from `createConversationState`; existing state and traces
must parse successfully before use. Older JSON snapshots that predate fallback
policy and consecutive knowledge-miss fields receive domain-owned defaults
during schema parsing; no database migration or destructive rewrite is needed.

`saveAgentSettings` accepts one explicit page section per request, so a stale
fallback tab cannot overwrite newer general settings (or the reverse). The
general section contains Agent instructions and the collection follow-up limit.
The fallback section contains zero to ten knowledge-miss clarification turns, a
clarification reply, an operator-attention reply, and a true handoff reply. A
knowledge miss is projected into the support conversation summary so `/inbox`
can prioritize it without transferring ownership. The API only validates and
persists these values; matching, risk classification, Owner transitions, and
Guardrail decisions remain in `@repo/xiaofei`.

Built-in Markdown KUs and source-managed database KUs coexist in the runtime
snapshot. Saving Agent settings preserves both KU collections and the reviewed
capability plan, but clears Eval evidence because instructions or fallback
behavior can change conversation results. Knowledge changes keep built-in KUs
visible while revoking capability admission, then merge current managed rows,
regenerate the capability plan, and clear stale Eval evidence. The legacy
`saveConfig` Markdown rebuild remains available for compatibility and also
re-synchronizes managed KUs instead of silently replacing product-specific
knowledge. The API refuses to run Eval before the current capability plan is
reviewed.

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

## External event ingress

## Email mirror ingress (mirror-only)

`POST /api/xiaofei/integrations/v1/email/messages` is the Worker-facing Email
mirror boundary. It accepts only `application/json`, reads at most 1 MiB before
JSON parsing, and requires `Authorization: Bearer <XIAOFEI_EMAIL_INGEST_API_KEY>`.
This is a distinct service credential; it is compared in constant time and is
never persisted, logged, or sent to a browser. `Idempotency-Key` is required
and must exactly equal the parsed `eventId`.

The body must be `EmailMessageIngestV1Schema`; caller-selected workspace,
ownership, AI, and provider fields are rejected by that strict schema. The
route calls `acceptMirroredEmailMessage` only. It returns `202 accepted` after
the transaction commits, `200 duplicate`, and `409 event_conflict`. Stable safe
errors are `401 unauthorized`, `400 invalid_json|invalid_request|idempotency_key_mismatch`,
`413 payload_too_large`, `415 unsupported_media_type`, `404 binding_not_found`,
and `409 binding_disabled|binding_conflict|conversation_conflict`. Unexpected
failures return only `500 internal_error`.

```bash
curl --fail-with-body -X POST "$XIAOFEI_API_URL/api/xiaofei/integrations/v1/email/messages" \
  -H 'Authorization: Bearer <XIAOFEI_EMAIL_INGEST_API_KEY>' \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: email:42:example' \
  --data @email-message.v1.json
```

Mirror mode persists events/messages and may create a durable mirrored job for
customer inbound mail, but starts no consumer, model, sender, or provider call.
Organization Email bindings are available at `/integrations/email-bindings`:
members read them, while owners/admins create, edit, enable, or disable them.
The active Organization is resolved on the server and no binding request has a
workspace field.

The browser Email mirror simulator first resolves an active-Organization scoped
binding and requires an exact company/account/address match before it calls the
persistence service. Foreign or fabricated tuples fail before any write. The
event monitor's Email list selects metadata only; body and attachment metadata
are available only through an Organization-scoped detail read.

`POST /api/xiaofei/integrations/events` accepts at most 1 MiB of JSON with a
`ChannelEnvelope v1` body and `Authorization: Bearer <XIAOFEI_INGEST_API_KEY>`.
The caller never chooses a workspace. Metadata headers are optional correlation data;
only `content-type`, `traceparent`, `tracestate`, `x-correlation-id`, `x-message-id`,
and `x-request-id` are persisted. Authentication, cookies, API keys, and all other
header names are discarded before event detail can be read.

### Kafka worker contract

This API is the P0 durable Inbox boundary only: it does not consume records, create a
conversation, call AI, or write LoopDesk. Run Kafka in the external worker, with
`enable.auto.commit=false`; Kafka is responsible for retaining records while the API
is unavailable. Use a deterministic `eventId` for a source record (for example,
`<topic>:<partition>:<offset>`) and send the original envelope on every retry.

```json
{
	"schemaVersion": "v1",
	"source": "flyranking-kafka",
	"eventId": "inbound.events:4:9812",
	"transport": {
		"kind": "kafka",
		"topic": "inbound.events",
		"partition": 4,
		"offset": "9812"
	},
	"eventType": "message.received",
	"payload": { "messageId": "upstream-123", "body": "example" },
	"metadata": { "headers": { "x-request-id": "worker-request-123" } }
}
```

```bash
curl --fail-with-body \
  -X POST "$XIAOFEI_API_URL/api/xiaofei/integrations/events" \
  -H "Authorization: Bearer $XIAOFEI_INGEST_API_KEY" \
  -H "Content-Type: application/json" \
  --data @channel-envelope.json
```

Commit the record's contiguous Kafka offset only after the API has durably returned
`202` (new event) or `200` (identical replay). A timeout or `5xx` has an unknown
outcome: retry the same envelope without committing. `400`, `409`, and `413` are
non-retryable input failures: quarantine the record and alert an operator; do not
commit it as a successful delivery. This is at-least-once delivery with idempotent
Inbox acceptance, not exactly-once Kafka processing.

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
