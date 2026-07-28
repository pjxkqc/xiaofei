# `@repo/xiaofei`

`@repo/xiaofei` is the vendor-neutral product kernel. It contains the contracts
and deterministic decisions that must remain stable if the UI, database,
workflow engine, model provider, or customer-service channel changes.

It may depend on validation and pure utility libraries, but it must not import
Next.js, oRPC, Prisma, Mastra, LangGraph, or a channel SDK.

## File map

| File              | Responsibility                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `contracts.ts`    | Zod schemas and TypeScript types for Agent, KU, policy, tools, state, handoff, trace, support messages, and workspace snapshots |
| `conversation.ts` | Conversation creation, owner transitions, lease validation, and slot updates                                                    |
| `knowledge.ts`    | Deterministic Markdown parsing, KU validation, and knowledge selection                                                          |
| `runtime.ts`      | P0 turn preparation, risk decisions, candidate finalization, Guardrail, handoff, and trace creation                             |
| `eval.ts`         | Deterministic P0 release assertions for every admitted KU plus risk and fallback behavior                                       |
| `defaults.ts`     | Default workspace plus deterministic KU capability plans, review transitions, and release gates                                 |
| `ports.ts`        | Product-owned channel adapter interface                                                                                         |

`index.ts` is the public package boundary. Consumers should import from
`@repo/xiaofei`, not from internal files.

## Hard invariants

1. Every owner transition increments `ownerEpoch`.
2. An AI reply can be sent only when its captured lease still matches the
   current owner and epoch.
3. A customer-visible reply is authorized only after candidate generation and
   final Guardrail evaluation.
4. Missing released knowledge must not be invented: the runtime first uses the
   configured clarification budget while AI keeps ownership, then performs a
   soft handoff. High risk, conflicting information, exhausted collection
   follow-ups, or an explicit handoff condition still exits immediately.
5. Automatic handling requires an explicitly reviewed capability plan, and the
   runtime may only select KUs listed in that plan.
6. High-risk business actions may be described in the tool registry but remain
   blocked until an explicit policy and audited adapter authorize them.
7. Trace events describe business decisions without storing credentials.
8. Public customer messages and human replies share the same conversation
   owner state; the customer surface cannot change ownership.

## Turn lifecycle

```text
message
  → require reviewed capability plan
  → select only KUs admitted by that plan using exact product terms or bounded related-text matching
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

The P0 parser treats each Markdown `##` section as one KU. The enhanced default
set covers nine common presales and aftersales categories without inventing
prices, stock, order state, or business-action results. A callable unit needs
scenario keywords, forbidden output, handoff conditions, standard reply policy,
and fallback text. Required slots are optional for pure knowledge answers and
mandatory for collection flows.

For generated source-backed knowledge, the domain deterministically keeps
`PRESALES` slots optional even if a model candidate marks them required. This
prevents an ordinary FAQ or recommendation from entering the
collect-then-handoff path while preserving required slots for explicit
aftersales collection flows and hand-authored KUs.

Parsing and matching are deterministic so configuration review and Eval results
are reproducible. Matching preserves explicit Latin product phrases such as
`C-Air`, `Wi-Fi`, and `CADR` inside generated composite fields, prefers exact
phrases, and allows only bounded character-pair similarity; an unrelated
question does not become model input. Embeddings and vector stores remain
future retrieval-adapter work.

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
