# Prisma persistence

This directory contains the shared Prisma schema, generated client, Zod output,
and query modules. It serves the inherited SaaS data model and the Xiaofei P0
aggregates.

## Xiaofei models

`XiaofeiWorkspace` stores one validated snapshot per personal or organization
tenant. `XiaofeiConversation` stores state and trace events for an external
conversation ID within that workspace. `XiaofeiKnowledgeDocument` stores
uploaded source metadata and extracted text in PostgreSQL.

```text
XiaofeiWorkspace
  tenantKey unique
  snapshot JSON
  └─ XiaofeiConversation
       externalId unique within workspace
       state JSON
       traceEvents JSON
  └─ XiaofeiKnowledgeDocument
       originalFileName + MIME type + file type
       presales or postsales category
       extracted body text + lifecycle status
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
- scoped conversation reset.
- document create, list, get, update, and delete by workspace.

Document reads and mutations require `workspaceId`. The compound
`workspaceId_id` selector makes a document from another workspace
indistinguishable from a missing document at the query boundary. Callers must
resolve the authenticated tenant to a Xiaofei workspace before using these
queries.

The document contract exports these Prisma enums through `@repo/database`:

- file type: `MARKDOWN`, `TEXT`, or `DOCX`;
- category: `PRESALES` or `POSTSALES`.

Upload parsing and MIME/extension validation belong to the API boundary. The
database contract accepts only the normalized type/category and the already
extracted plain text. Status is a durable string defaulting to `draft`; the API
contract owns any additional lifecycle validation rather than persistence
inventing product policy.

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
generates the client, restores the pooled runtime URL, and then builds the SaaS
application.

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
