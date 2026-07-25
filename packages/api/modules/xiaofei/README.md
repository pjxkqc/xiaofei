# Xiaofei API module

This module is the application boundary between the public customer channel,
authenticated support operations, the Xiaofei domain kernel, AI adapters, and
persistence.

## Procedures

| Procedure                   | Route                                               | Responsibility                                                       |
| --------------------------- | --------------------------------------------------- | -------------------------------------------------------------------- |
| `status`                    | `GET /xiaofei/status`                               | Return a public, allowlisted, database-free service status contract  |
| `getConfig`                 | `GET /xiaofei/config`                               | Load or create the tenant workspace snapshot                         |
| `saveConfig`                | `PUT /xiaofei/config`                               | Rebuild Markdown KU, run Mastra governance, and persist the snapshot |
| `reviewCapability`          | `POST /xiaofei/capability/review`                   | Review or revoke the capability plan derived from released KUs       |
| `runEval`                   | `POST /xiaofei/eval`                                | Run deterministic P0 assertions and update release gates             |
| `resetConversation`         | `DELETE /xiaofei/conversations/{conversationId}`    | Delete the selected demonstration conversation                       |
| `startSupportConversation`  | `POST /xiaofei/public/conversations`                | Start a token-scoped public customer conversation                    |
| `getPublicConversation`     | `GET /xiaofei/public/conversations/{id}`            | Poll messages and update the customer's online heartbeat             |
| `sendPublicMessage`         | `POST /xiaofei/public/conversations/{id}/messages`  | Route a customer message to Xiaofei or the current human owner       |
| `listAgentConversations`    | `GET /xiaofei/support/conversations`                | List recent conversations for an authenticated support role          |
| `setAgentConversationOwner` | `POST /xiaofei/support/conversations/{id}/owner`    | Transfer ownership between Xiaofei and a human agent                 |
| `sendAgentMessage`          | `POST /xiaofei/support/conversations/{id}/messages` | Persist a human support reply                                        |

Conversation streaming remains in `modules/ai/procedures/stream-message.ts`
because it is the existing AI SDK transport. That procedure now loads the
Xiaofei workspace, runs the governed runtime, persists state and traces, and
emits customer-visible text only after final authorization.

## Channel and role boundary

The current Flyranking validation slice uses one stable
`channel:public-support` workspace so the no-login customer page, support
inbox, and knowledge governance operate on the same state.

Customers receive a random UUID conversation token; they cannot list
conversations or choose a workspace. Inbox and governance procedures use
`supportProcedure`, which accepts the existing Supa `user` role, an explicit
future `support` role, or `admin`. Flyranking/LoopDesk tenant and channel
mapping remains a future adapter concern.

## Persistence boundary

The service validates JSON snapshots with schemas from `@repo/xiaofei` before
and after persistence. New workspaces start from the domain default. New
conversations start from `createConversationState`; existing state and traces
must parse successfully before use.

Knowledge changes regenerate the capability plan and clear stale Eval evidence.
The API refuses to run Eval before the current capability plan is reviewed.

P0 keeps Agent and runtime aggregates as JSON. Conversation status, assignment,
last-seen/message timestamps, and message history are persisted on
`XiaofeiConversation` because the support inbox queries those lifecycle fields.

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
