# Xiaofei P0 framework

This increment implements the smallest complete vertical framework described by
the historical `xiaofei-harness` P0 requirements. It demonstrates the product
boundaries and one safe customer-service flow without importing the exploration
demos wholesale.

## Architecture

```text
Single Agent page
  ├─ configuration + Markdown knowledge source
  ├─ parsed KnowledgeUnit and release gates
  ├─ deterministic P0 Eval
  └─ governed Chatbot + business traces
          │
          ▼
protected oRPC boundary
          │
          ├─ Mastra governance Workflow
          ├─ Mastra Agent adapter
          └─ LangGraph StateGraph adapter
                    │
                    ▼
@repo/xiaofei domain kernel
  Agent / KU / Owner / Slot / Policy / Guardrail / Eval / Handoff / Trace
                    │
                    ▼
Neon JSON snapshots
  XiaofeiWorkspace + XiaofeiConversation
```

`@repo/xiaofei` is vendor-neutral and remains authoritative. Mastra and
LangGraph are replaceable runtime adapters in `@repo/ai`; neither framework
owns tenant configuration, handling rights, knowledge, guardrails or release
decisions.

## Implementation map

| Boundary                             | Guide                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| Product domain and invariants        | [`../packages/xiaofei/README.md`](../packages/xiaofei/README.md)                         |
| Mastra, LangGraph and model adapters | [`../packages/ai/README.md`](../packages/ai/README.md)                                   |
| Tenant API and orchestration         | [`../packages/api/modules/xiaofei/README.md`](../packages/api/modules/xiaofei/README.md) |
| Prisma and Neon persistence          | [`../packages/database/prisma/README.md`](../packages/database/prisma/README.md)         |
| Minimal SaaS surface                 | [`../apps/saas/README.md`](../apps/saas/README.md)                                       |

## Implemented P0 path

1. The tenant edits an Agent instruction, runtime choice, follow-up limit and a
   compact Markdown knowledge source.
2. Saving deterministically parses each `##` section into a `KnowledgeUnit`.
   Missing keywords, forbidden outputs, handoff rules, reply policy or fallback
   blocks that unit.
3. A Mastra Workflow checks the knowledge and policy boundary.
4. The tenant can run four deterministic business assertions covering slot
   collection, high-risk handoff, knowledge missing and safe knowledge reply.
5. Chat turns run through either a Mastra Agent or LangGraph StateGraph using
   the same domain kernel.
6. The complete candidate reply is generated before it becomes customer
   visible. The final Guardrail can replace it with a safe fallback and transfer
   ownership to a human.
7. `ownerEpoch` changes on handoff, invalidating stale AI work. Conversation
   state and business-readable traces are stored in Neon.

## Tool and adapter boundary

The initial registry deliberately exposes only the boundary:

- customer-message delivery is available only after final authorization;
- private-note/handoff summaries are a low-risk observer capability;
- refund execution is registered but blocked;
- concrete LookDesk, Chatwoot or other customer-service integrations implement
  `XiaofeiChannelAdapter` later.

No model or workflow can directly call a vendor SDK or write a high-risk
business action.

## Deliberate limits

This is a framework slice, not a production-complete Agent Center:

- one page replaces separate Agent, Knowledge, Eval and Trace workspaces;
- workspace and conversation aggregates use JSON snapshots instead of fully
  normalized tables;
- Markdown parsing is deterministic; PDF, URL, Feishu and Excel ingestion are
  deferred;
- KU matching is keyword/state based; embeddings, vector search and reranking
  are deferred;
- the LangGraph graph uses Neon as the product persistence boundary rather than
  adding a second production checkpointer;
- no real customer-service send, private-note or refund API is called;
- Eval currently uses deterministic business assertions, not model graders;
- no release versioning, rollback UI, scheduling or multi-channel hosting UI.

## Preview acceptance

The complete slice has been exercised in an isolated Vercel + Neon Preview:

- password signup continued to onboarding without email verification;
- configuration save executed the Mastra governance Workflow;
- all four deterministic P0 assertions passed;
- LangGraph collected an order ID and damage-photo reference across separate
  turns, then transferred ownership to a human;
- Mastra produced a real model response for a released service-scope KU;
- runtime, KU, owner, action and trace evidence were visible in the control
  page;
- a refund/complaint scenario exited to human handling without executing a
  business action.

The next iteration can split product pages and normalize storage only where
review of this working slice identifies a real need.
