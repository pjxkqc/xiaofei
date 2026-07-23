# Prisma persistence

This directory contains the shared Prisma schema, generated client, Zod output,
and query modules. It serves the inherited SaaS data model and the Xiaofei P0
aggregates.

## Xiaofei models

`XiaofeiWorkspace` stores one validated snapshot per personal or organization
tenant. `XiaofeiConversation` stores state and trace events for an external
conversation ID within that workspace.

```text
XiaofeiWorkspace
  tenantKey unique
  snapshot JSON
  └─ XiaofeiConversation
       externalId unique within workspace
       state JSON
       traceEvents JSON
```

The JSON aggregate design is deliberate for P0: domain schemas evolve quickly,
while queries currently load one complete workspace or conversation. Product
data is always parsed with `@repo/xiaofei` schemas in the API service.

## Query layer

`queries/xiaofei.ts` contains the only Xiaofei Prisma reads and writes:

- workspace lookup and upsert by tenant key;
- conversation lookup and upsert by workspace/external ID;
- scoped conversation reset.

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
