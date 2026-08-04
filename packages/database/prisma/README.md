# Prisma persistence

This directory contains the shared Prisma schema, generated client, Zod output,
and query modules. It serves the inherited SaaS data model and the Xiaofei P0
aggregates.

## Xiaofei models

`XiaofeiOrganizationConfig` is the one-to-one Xiaofei extension of Better Auth's
Organization (the merchant). Its nullable `externalMerchantId` is unique when
configured. `XiaofeiCustomer` stores an external customer identity only within
one Organization. `XiaofeiWorkspace` stores one validated snapshot per personal
or organization tenant. `XiaofeiConversation` stores state and trace events for
an external conversation ID within that workspace. `XiaofeiKnowledgeDocument` is the
single durable knowledge-source record for files, webpages, and manual content;
`XiaofeiKnowledgeEntry` stores editable normalized question-and-answer entries.

```text
Organization
  └─ XiaofeiOrganizationConfig (one-to-one)
  └─ XiaofeiCustomer (external ID unique within Organization)
       └─ XiaofeiConversation (optional customer link; SetNull preserves audit)

XiaofeiWorkspace (tenant key `organization:{organizationId}` for merchants)
  tenantKey unique
  snapshot JSON
  └─ XiaofeiConversation
       externalId unique within workspace
       state JSON
       traceEvents JSON
  └─ XiaofeiKnowledgeDocument
       source type (file/web/manual), optional file or URL metadata
       provider/parser metadata + parse status and redacted error state
       presales or postsales category
       normalized body + SHA-256 content hash + fetch time + lifecycle status
       └─ XiaofeiKnowledgeEntry
            question + answer + optional similar queries/category/tags
            source hash/version snapshot + lifecycle status
            └─ XiaofeiKnowledgeUnit
                 generated KU JSON plus workspace/source/entry lineage,
                 draft eligibility, and stale reason
```

The JSON aggregate design for workspace and conversation state is deliberate
for P0: domain schemas evolve quickly, while queries currently load one
complete workspace or conversation. Knowledge documents use columns because
their metadata and lifecycle are independently listed and edited. File bytes
are not retained; `bodyText` is the durable extracted content.

## Query layer

`queries/xiaofei.ts` contains the only Xiaofei Prisma reads and writes:

- workspace lookup and upsert by tenant key;
- conversation lookup and upsert by workspace/external ID;
- scoped conversation reset;
- document create, list, get, update, and delete by workspace.
- inbound event acceptance, workspace-scoped metadata lists, and full detail reads.
- Organization-scoped Active/Test hosting bindings, exact runtime materialization,
  immutable feedback interventions, and durable TestTurn records.

### Governed answer-feedback-rerun bridge

`getXiaofeiOrganizationHostingBinding` and
`loadXiaofeiRuntimeHostingCapability` are the only persistence boundary for
the App's governed hosting snapshot. They return exact ordered M:N revision
members and rebuild the `@repo/xiaofei` domain hashes from persisted content;
the persistence `contentHash` and `manifestHash` are never passed through as
domain hashes. Active and Test are selected only from their respective
Organization-local hosting pointers.

`XiaofeiTestTurn` retains one actual test answer, immutable `ConversationState`
snapshot, runtime metadata, and optional normalized evidence revision. A session
loads its newest snapshot only through the compound Organization + session query
and is pinned to its initial Test CA; a CA switch requires a new session rather
than mixing evidence. Writes prove the referenced CA is that
Organization's current Active/Test hosting pointer and that evidence is an
exact member; no-hit evidence remains null. Feedback derives all before facts
from the saved source turn, writes only the Test pointer, and a real rerun may
fill an intervention's initially-null after response only after it is saved
against the intervention result CA. These records are additive and do not
migrate conversation history. The multi-record feedback transaction keeps its
atomic scope and explicitly uses a 5-second acquisition wait and 15-second
execution timeout for cold Neon Preview paths; this override is local to that
operation and does not change global Prisma defaults.

### Email mirror ledger

`acceptMirroredEmailMessage` is the email persistence boundary and accepts only
the kernel's `EmailMessageIngestV1` DTO. It resolves an active binding by
`companyId + email + channelAccount.id/address` before opening its write
transaction. Missing, disabled, or split ID/address bindings are typed failures
and write no ledger rows. The transaction creates the inbound event, customer,
conversation, normalized message, monotonic conversation projection, and only
for customer inbound traffic one `mirrored` job. A replay returns the existing
locators; a changed stable business payload fails closed.

The email business hash canonicalizes object keys and lowercases email addresses.
It includes the immutable envelope, routing account, conversation, and message
facts, but excludes `source.topic`, `source.partition`, `source.offset`, and
`source.workerVersion`. Those fields remain tracing data and may differ during a
replay without becoming a conflict. Message list projections intentionally omit
body, raw HTML, and attachment URLs; those are available only through a
workspace-scoped detail read.

The same transaction also projects a bounded, readable support message into
`XiaofeiConversation.messages`, under a per-conversation advisory lock. This is
the bridge that makes a Worker-delivered Email immediately visible in `/inbox`
without weakening the normalized message ledger; raw HTML and attachment URLs
remain in the restricted detail record.

`XiaofeiOutboundDelivery` is the reply/status Outbox. The guarded reply and
trace, immutable `xiaofei.email.delivery.v1` payload, destination mode, and
`delivery_pending` job transition are committed before any Receiver HTTP call.
Every attempt stores only status, attempt count, HTTP status, timestamps, and a
safe error. A failed row is retained and can be retargeted to the Organization's
current Receiver setting; a delivered row is not replayed by the operator UI.
The Organization config stores only `mock`/`webhook` mode and the validated
callback URL—P0 does not persist callback credentials.

Organization query helpers are the merchant boundary for new Xiaofei work:

- configuration and customer get/list/create/update calls take `organizationId`;
- organization conversation and Inbox helpers (including event acceptance) resolve only the fixed
  `organization:{organizationId}` workspace tenant key;
- `upsertXiaofeiOrganizationConversation` checks the compound
  `organizationId_id` customer selector before binding `customerId`, so a caller
  cannot attach another Organization's customer;
- `updateXiaofeiInboundEventStatus` and its Organization wrapper can update only
  processor state (`processing`, `processed`, or `failed`) plus processed/error
  metadata. They cannot rewrite the accepted inbound payload.

Legacy public-support conversations remain valid: `customerId` is nullable and
`channel` defaults to `public_support`. Customer deletion sets the conversation
link to null, retaining conversation audit history.

`acceptInboundEvent(workspaceId, input)` is the Inbox write boundary. The authenticated
caller supplies `workspaceId` separately; event input cannot select a tenant. It creates a
record for a new `(workspaceId, source, eventId)`, increments only `deliveryCount` and
`lastReceivedAt` for a canonical-payload replay, and throws
`XiaofeiInboundEventConflictError` for the same ID with a different payload hash. Payload
and redacted error details are returned only from `getInboundEvent`; `listInboundEvents`
uses a stable `(createdAt, id)` cursor and never selects payload, safe headers, or last error.
Kafka offsets are persisted as strings to avoid JavaScript integer loss.

Source and entry reads and mutations require `workspaceId`. The compound
`workspaceId_id` selector makes a record from another workspace indistinguishable
from a missing record at the query boundary. Callers must resolve the
authenticated tenant to a Xiaofei workspace before using these queries.
Entry activation revalidates the entry status and source hash/version while
holding the workspace advisory lock, so a concurrent source update cannot leave
a stale entry marked active.

Source lists return metadata only; `bodyText` is available only from the
workspace-scoped get query. Source and entry lists use a stable `(createdAt, id)`
order and return `{ items, nextCursor }`. The default page size is 25 and callers
may request 1–50 records. A cursor is resolved through the compound
`workspaceId_id` key so another workspace's ID cannot become a list cursor.

For FLY-59 compatibility, source list/get queries always return non-null legacy
display fields: `originalFileName`, `mimeType`, and `fileType` (`MARKDOWN`,
`TEXT`, or `DOCX`). Web and manual sources receive deterministic display names
and MIME fallbacks; PDF/XLSX and no-file sources project to legacy `TEXT` while
the raw nullable value remains available as `sourceFileType`. This keeps older
API/UI consumers stable without erasing the source type or durable metadata.

`createXiaofeiKnowledgeEntry` snapshots the selected source's content hash and
version. Entry list/get results add `eligible`: it is true only while the source
still exists and has exactly that hash and version. Every source update increments
its version, and source deletion sets dependent entry source IDs to null. This
makes dependent entries ineligible synchronously, without a worker or cascade
delete. `updateXiaofeiKnowledgeEntry` refreshes that snapshot only when callers
explicitly change `sourceId`.

Knowledge-unit rows retain the source and entry IDs plus their exact content
hash/version and entry version. `createXiaofeiKnowledgeUnit` reads that lineage
inside the workspace transaction and rejects a stale or cross-workspace entry;
the caller cannot supply lineage independently. New rows default to `draft` and
`ineligible` unless an outer lifecycle use case changes them. Every source or
entry update/delete invalidates matching KUs in the same transaction by setting
them to `draft`, `stale`, and a durable redacted reason. The lineage IDs are
plain durable values rather than cascading relations so deleting an upstream
record does not erase the audit trail.

The query boundary also enforces fixed per-workspace ceilings:

- at most 100 knowledge documents;
- at most 20 MiB of UTF-8 encoded `bodyText` across those documents.
- at most 500 knowledge entries;
- at most 4 MiB of UTF-8 encoded question, answer, and similar-query content.

Source and entry create, update, and delete acquire the same PostgreSQL
transaction-scoped advisory lock derived from `workspaceId`. Quota usage and
the write therefore execute atomically for one workspace even when requests
arrive concurrently. Multi-entry ingestion uses
`createXiaofeiKnowledgeDocumentWithEntries` to validate both quotas and create
the source plus all derived entries in one transaction and one bulk insert; it
must not fan out workspace-locked writes with `Promise.all`. A rejected
create/update throws
`XiaofeiKnowledgeDocumentQuotaError` with `quota` set to `document_count` or
`stored_body_bytes` and a numeric `limit`; callers should map that typed error
to their transport contract without exposing database errors.

The document contract exports these Prisma enums through `@repo/database`:

- file type: `MARKDOWN`, `TEXT`, or `DOCX`;
- category: `PRESALES` or `POSTSALES`.

Upload parsing and MIME/extension validation belong to the API boundary. The
database contract accepts normalized plain text and calculates its SHA-256
content hash; provider errors must already be redacted before `parseError` is
persisted. Status and parse status are durable strings (`draft` and `parsed` by
default); the API contract owns any additional lifecycle validation rather than
persistence inventing product policy.

API and UI code should import query functions through `@repo/database`, not
instantiate another Prisma client.

## Local schema workflow

From the repository root:

```bash
pnpm --filter @repo/database generate
pnpm --filter @repo/database push
pnpm --filter @repo/database studio
```

`generate` refreshes the Prisma client and tracked Zod output. Review generated
changes before committing them.

Use `push` for the current local and disposable Preview workflow. Introduce
reviewed migrations before production data requires forward-only schema
history.

## Vercel and Neon

Preview builds use a pooled `DATABASE_URL` for runtime traffic and
`DATABASE_URL_UNPOOLED` or `DIRECT_URL` for schema work.
`scripts/vercel-build.mjs` temporarily supplies the direct URL to Prisma,
applies the known lossless Email-mirror compatibility step, runs the normal
schema push, generates the client, restores the pooled runtime URL, and then
builds the SaaS application. The compatibility step can recover the final
`eventId` from its durable inbound event and add composite indexes; it never
deletes a row. PostgreSQL fails the deployment if a row cannot be mapped or
violates a new unique key. Do not replace this guard with a broad
`--accept-data-loss` flag.

Never print a connection string in build output. See
[`../../../docs/pr-preview-setup.md`](../../../docs/pr-preview-setup.md) for the
full branch-isolation and cleanup lifecycle.

## Schema-change checklist

1. Update `schema.prisma`.
2. Run Prisma generation.
3. Run database and API type checks.
4. Run the repository tests and application build.
5. Confirm a PR Preview creates and uses its own Neon branch.
6. After merge, confirm the cleanup workflow deletes the matching disposable
   branch.
