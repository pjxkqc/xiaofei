# `@repo/ai`

`@repo/ai` owns model-provider and workflow-engine adapters. Xiaofei domain
contracts come from `@repo/xiaofei`; provider-specific types must not leak back
into the product kernel.

## Current adapters

| Path                        | Responsibility                                                        |
| --------------------------- | --------------------------------------------------------------------- |
| `model.ts`                  | Creates the server-side OpenAI-compatible Chat Completions model      |
| `lib/xiaofei/governance.ts` | Mastra Workflow that validates knowledge and policy readiness on save |
| `lib/xiaofei/mastra.ts`     | Mastra Agent candidate-reply generator                                |
| `lib/xiaofei/langgraph.ts`  | Canonical LangGraph conversation state machine                        |
| `lib/xiaofei/runtime.ts`    | Stable entry point into the unified graph                             |

Mastra governance runs when configuration is saved. At conversation time,
LangGraph is the single orchestrator: it runs domain admission, knowledge,
slot, and routing decisions, asks the Mastra Agent for a candidate only on the
safe reply path, then returns to the domain kernel for final Guardrail and
ownership authorization.

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

## Generation contract

The graph receives a message, current `ConversationState`, and validated
`XiaofeiWorkspaceSnapshot`, and returns a `RuntimeTurnResult`. The Mastra Agent
implements the smaller `ReplyGenerator` boundary.

An adapter may generate a candidate response, but it cannot:

- change ownership outside domain transition functions;
- bypass lease or `ownerEpoch` validation;
- directly send a customer-visible message;
- execute refund, compensation, reshipment, or another high-risk write;
- decide that an unreleased KU is safe.

Structured KU generation also treats ordinary FAQ and presales context fields
as optional. The vendor-neutral domain layer enforces that rule again before a
Draft is created; aftersales collection fields retain their explicit required
semantics.

## Extending the conversation flow

1. Add or refine LangGraph nodes behind the existing `RuntimeTurnResult`
   contract.
2. Reuse domain preparation and finalization instead of cloning safety logic.
3. Add alternative model behavior behind `ReplyGenerator`, without exposing a
   product-facing Runtime selector.
4. Add tests for safe reply, handoff, and Guardrail replacement.
5. Keep PostgreSQL/Neon as the product persistence boundary unless a separate
   checkpointer has an explicit lifecycle and consistency design.

## Tests

```bash
pnpm --filter @repo/ai test
pnpm --filter @repo/ai type-check
```

See [`../../docs/xiaofei-p0-framework.md`](../../docs/xiaofei-p0-framework.md)
for the end-to-end architecture.
