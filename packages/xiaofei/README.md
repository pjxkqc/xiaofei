# `@repo/xiaofei`

`@repo/xiaofei` is the vendor-neutral product kernel. It contains the contracts
and deterministic decisions that must remain stable if the UI, database,
workflow engine, model provider, or customer-service channel changes.

It may depend on validation and pure utility libraries, but it must not import
Next.js, oRPC, Prisma, Mastra, LangGraph, or a channel SDK.

## File map

| File              | Responsibility                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `contracts.ts`    | Zod schemas and TypeScript types for Agent, KU, policy, tools, state, handoff, trace, and workspace snapshots |
| `conversation.ts` | Conversation creation, owner transitions, lease validation, and slot updates                                  |
| `knowledge.ts`    | Deterministic Markdown parsing, KU validation, and knowledge selection                                        |
| `runtime.ts`      | P0 turn preparation, risk decisions, candidate finalization, Guardrail, handoff, and trace creation           |
| `eval.ts`         | Four deterministic P0 release assertions                                                                      |
| `defaults.ts`     | Default workspace plus deterministic KU capability plans, review transitions, and release gates               |
| `ports.ts`        | Product-owned channel adapter interface                                                                       |

`index.ts` is the public package boundary. Consumers should import from
`@repo/xiaofei`, not from internal files.

## Hard invariants

1. Every owner transition increments `ownerEpoch`.
2. An AI reply can be sent only when its captured lease still matches the
   current owner and epoch.
3. A customer-visible reply is authorized only after candidate generation and
   final Guardrail evaluation.
4. Missing released knowledge, high risk, conflicting information, exhausted
   follow-ups, or a configured handoff condition must fail safely.
5. Automatic handling requires an explicitly reviewed capability plan, and the
   runtime may only select KUs listed in that plan.
6. High-risk business actions may be described in the tool registry but remain
   blocked until an explicit policy and audited adapter authorize them.
7. Trace events describe business decisions without storing credentials.

## Turn lifecycle

```text
message
  → require reviewed capability plan
  → select only KUs admitted by that plan
  → update slots and risk
  → choose reply / follow-up / handoff / stop
  → run selected model adapter when permitted
  → inspect complete candidate
  → authorize safe send or replace with fallback
  → persist state and business trace
```

The domain returns decisions and evidence. It does not write to the database or
send a customer message itself.

## Knowledge Unit source

The P0 parser treats each Markdown `##` section as one KU. A callable unit needs
scenario keywords, forbidden output, handoff conditions, standard reply policy,
and fallback text. Required slots are optional for pure knowledge answers and
mandatory for collection flows.

Parsing is deterministic so configuration review and Eval results are
reproducible. Embeddings, vector stores, and document ingestion belong in a
future retrieval adapter, not in these P0 contracts.

Saving knowledge regenerates the capability plan and invalidates its previous
review and Eval evidence. Review admits the exact KU IDs and field matrices;
Eval then asserts KU matching together with Action and Owner behavior.

## Tests

```bash
pnpm --filter @repo/xiaofei test
pnpm --filter @repo/xiaofei type-check
```

When changing an invariant, add a focused unit test and update
[`../../docs/xiaofei-foundation.md`](../../docs/xiaofei-foundation.md).
