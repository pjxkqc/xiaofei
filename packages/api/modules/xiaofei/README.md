# Xiaofei API module

This module is the protected application boundary between the SaaS UI, the
Xiaofei domain kernel, AI adapters, and persistence.

## Procedures

| Procedure           | Route                                            | Responsibility                                                       |
| ------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| `getConfig`         | `GET /xiaofei/config`                            | Load or create the tenant workspace snapshot                         |
| `saveConfig`        | `PUT /xiaofei/config`                            | Rebuild Markdown KU, run Mastra governance, and persist the snapshot |
| `runEval`           | `POST /xiaofei/eval`                             | Run deterministic P0 assertions and update release gates             |
| `resetConversation` | `DELETE /xiaofei/conversations/{conversationId}` | Delete the selected demonstration conversation                       |

Conversation streaming remains in `modules/ai/procedures/stream-message.ts`
because it is the existing AI SDK transport. That procedure now loads the
Xiaofei workspace, runs the governed runtime, persists state and traces, and
emits customer-visible text only after final authorization.

## Tenant boundary

`service.ts` derives one stable tenant key:

- `organization:<organizationId>` when the session has an active organization
  and the user has verified membership;
- `user:<userId>` for a personal account.

The client cannot submit a tenant key. Organization membership is checked
server-side before a workspace is read or written.

## Persistence boundary

The service validates JSON snapshots with schemas from `@repo/xiaofei` before
and after persistence. New workspaces start from the domain default. New
conversations start from `createConversationState`; existing state and traces
must parse successfully before use.

P0 intentionally stores aggregates as JSON. Normalize a field only when a real
query, lifecycle, or consistency requirement justifies the extra schema.

## Adding a procedure

- Start with `protectedProcedure`.
- Derive tenant identity from the authenticated context.
- Validate all inputs and persisted snapshots.
- Keep product decisions in `@repo/xiaofei`.
- Keep engine/provider code in `@repo/ai`.
- Keep Prisma queries in `@repo/database`.
- Do not return secrets, provider headers, or raw connection errors.

## Tests

```bash
pnpm --filter @repo/api test
pnpm --filter @repo/api type-check
```

See the [domain guide](../../../xiaofei/README.md) before changing ownership,
handoff, or release behavior.
