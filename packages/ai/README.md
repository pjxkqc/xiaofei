# `@repo/ai`

`@repo/ai` owns model-provider and workflow-engine adapters. Xiaofei domain
contracts come from `@repo/xiaofei`; provider-specific types must not leak back
into the product kernel.

## Current adapters

| Path                        | Responsibility                                                        |
| --------------------------- | --------------------------------------------------------------------- |
| `model.ts`                  | Creates the server-side OpenAI-compatible Chat Completions model      |
| `lib/xiaofei/governance.ts` | Mastra Workflow that validates knowledge and policy readiness on save |
| `lib/xiaofei/mastra.ts`     | Mastra Agent conversation adapter                                     |
| `lib/xiaofei/langgraph.ts`  | LangGraph StateGraph conversation adapter                             |
| `lib/xiaofei/runtime.ts`    | Dispatches a turn to the configured runtime                           |

Mastra governance runs when configuration is saved even when LangGraph is the
selected conversation runtime. Both conversation adapters use the same domain
preparation and finalization functions, so ownership and Guardrail behavior do
not depend on the engine.

## Model configuration

The model is created on the server from:

| Variable          | Purpose                                   |
| ----------------- | ----------------------------------------- |
| `OPENAI_API_KEY`  | Provider credential                       |
| `OPENAI_BASE_URL` | Optional OpenAI-compatible `/v1` base URL |
| `OPENAI_MODEL`    | Exact model identifier                    |

Chat Completions mode is explicit because compatible gateways are not required
to implement the OpenAI Responses API. Credential values must never be passed
to React components, traces, test snapshots, or logs.

## Adapter contract

Each runtime receives a message, current `ConversationState`, and validated
`XiaofeiWorkspaceSnapshot`, and returns a `RuntimeTurnResult`.

An adapter may generate a candidate response, but it cannot:

- change ownership outside domain transition functions;
- bypass lease or `ownerEpoch` validation;
- directly send a customer-visible message;
- execute refund, compensation, reshipment, or another high-risk write;
- decide that an unreleased KU is safe.

## Adding a runtime

1. Implement an adapter behind the existing `RuntimeTurnResult` contract.
2. Reuse domain preparation and finalization instead of cloning safety logic.
3. Add the runtime literal to the domain schema and configuration UI.
4. Add adapter tests for safe reply, handoff, and Guardrail replacement.
5. Keep PostgreSQL/Neon as the product persistence boundary unless a separate
   checkpointer has an explicit lifecycle and consistency design.

## Tests

```bash
pnpm --filter @repo/ai test
pnpm --filter @repo/ai type-check
```

See [`../../docs/xiaofei-p0-framework.md`](../../docs/xiaofei-p0-framework.md)
for the end-to-end architecture.
