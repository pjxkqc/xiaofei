# Xiaofei P0 framework

This increment implements the smallest complete vertical framework described by
the historical `xiaofei-harness` P0 requirements. It demonstrates the product
boundaries and one safe customer-service flow without importing the exploration
demos wholesale.

## Architecture

```text
Minimal SaaS surface
  ├─ /support (public)
  │    └─ customer messages ↔ Xiaofei or human owner
  ├─ /inbox (support role)
  │    └─ online state + takeover + human reply
  ├─ /agent-settings/{general,fallback,status}
  │    └─ Agent behavior + read-only release status
  ├─ /knowledge/{entries,units,capabilities}
  │    └─ source → KU → capability review + P0 Eval
  ├─ /chatbot
  │    └─ governed conversation + business traces
  └─ /integrations/email*
       └─ Worker contract + Inbox projection + reply Outbox
          │
          ▼
public token / protected support-role oRPC boundaries
          │
          ├─ Mastra governance Workflow
          └─ LangGraph StateGraph
                 └─ Mastra Agent candidate generation
                    │
                    ▼
@repo/xiaofei domain kernel
  Agent / KU / Owner / Slot / Policy / Guardrail / Eval / Handoff / Trace
                    │
                    ▼
Neon persistence
  JSON runtime snapshots + normalized Email ledger/jobs/Outbox
```

`@repo/xiaofei` is vendor-neutral and remains authoritative. LangGraph owns
conversation sequencing while Mastra owns Agent generation and the separate
configuration-governance Workflow. Neither framework owns tenant
configuration, handling rights, knowledge, guardrails, or release decisions.

## Implementation map

| Boundary                             | Guide                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| Product domain and invariants        | [`../packages/xiaofei/README.md`](../packages/xiaofei/README.md)                         |
| Mastra, LangGraph and model adapters | [`../packages/ai/README.md`](../packages/ai/README.md)                                   |
| Tenant API and orchestration         | [`../packages/api/modules/xiaofei/README.md`](../packages/api/modules/xiaofei/README.md) |
| Prisma and Neon persistence          | [`../packages/database/prisma/README.md`](../packages/database/prisma/README.md)         |
| Minimal SaaS surface                 | [`../apps/saas/README.md`](../apps/saas/README.md)                                       |

## Implemented P0 path

1. A support operator edits Agent instructions and collection follow-up limits
   on `/agent-settings/general`, and the bounded knowledge-miss
   clarification/operator-attention policy on `/agent-settings/fallback`.
   `/agent-settings/status` summarizes release gates without duplicating
   knowledge governance actions. File, webpage, and manual-Q&A sources remain
   on `/knowledge/entries`.
2. MD/TXT content is normalized locally; PDF/DOCX/XLSX and one public webpage
   are parsed through the server-side Firecrawl provider. Operators generate,
   review, and publish source-backed `KnowledgeUnit`s on `/knowledge/units`.
   Generated presales context fields remain optional so ordinary FAQ and model
   recommendations cannot accidentally enter the collect-then-handoff path.
3. The domain derives a capability plan from released KUs: callable KU IDs,
   takeover/reject boundaries, field matrices, action boundaries, and Eval
   suggestions. A human must review it before automatic handling is admitted.
4. A Mastra Workflow checks the knowledge and policy boundary.
5. The support operator can run deterministic business assertions for every currently
   admitted KU plus fixed high-risk and knowledge-miss cases. They cover
   matching, slot collection, clarification, high-risk handoff, Action, and
   Owner. Saving KU or changing capability review invalidates old Eval evidence.
6. Chat turns always enter the LangGraph StateGraph. Only reviewed capability
   KUs are callable. Matching preserves explicit product phrases inside
   generated composite fields, prefers exact configured phrases, then a
   bounded related-text score, and only the safe reply branch invokes Mastra
   Agent.
7. The complete candidate reply is generated before it becomes customer
   visible. The final Guardrail can replace it with a safe fallback and transfer
   ownership to a human.
8. A knowledge miss uses the configured deterministic clarification budget,
   marks the conversation for operator attention, and retains AI ownership.
   Exhausting the budget changes the safe reply without exiting, so a later
   reviewed-KU match can recover automatically. An explicit human request,
   complaint, legal/safety risk, or high-risk action request still exits
   immediately.
9. `ownerEpoch` changes on handoff, invalidating stale AI work. Conversation
   state and business-readable traces are stored in Neon.
10. A no-login customer receives a random conversation token. The public page
    polls messages and online presence; authenticated support users see the same
    conversation in `/inbox`, can take ownership, reply, and return it to
    Xiaofei.
11. An external Email Worker can post strict `email.message.v1` events through
    a service-authenticated boundary. Xiaofei resolves the Organization from a
    Channel Binding, atomically stores the event/message/conversation/Mirror
    Job, and projects readable content into the same `/inbox` surface. A
    Preview/UAT operator can explicitly run the job; the governed reply and
    `xiaofei.email.delivery.v1` Outbox record commit before the built-in Mock or
    configured HTTPS Receiver is called. See
    [`email-worker-integration.md`](./email-worker-integration.md).

## Tool and adapter boundary

## Knowledge entry ingestion

Authenticated operators use `/knowledge/entries` to add source-backed, editable
knowledge entries. Files are limited to 4 MB and must have a matching MIME type
and extension. UTF-8 MD and TXT are normalized directly in the API process;
PDF, DOCX, XLSX, and exactly one public HTTP(S) webpage URL are parsed only by
the server-side Firecrawl provider. Web ingestion is a single scrape, never a
recursive crawl. Manual Q&A (up to 20 pairs per submission) bypasses Firecrawl.
Provider configuration failures are safe errors, so manual Q&A and MD/TXT
remain available without a provider key. See the [API module guide](../packages/api/modules/xiaofei/README.md)
for the protected procedure boundary.

Knowledge sources, entries, KUs, capability admission, Chatbot validation, and
public conversations retain their documented workspace mapping. Email uses the
active Organization workspace resolved from an explicit company/mailbox
binding; callers never select a Workspace. The repository exposes a separate
four-step Email flow: handoff/binding, inbound validation, Inbox consumption,
and reply delivery. WhatsApp and full LoopDesk tenant mapping remain future
adapter work.

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

- four minimal pages separate public chat, support inbox, configuration, and
  runtime evidence without yet
  introducing full Agent, Knowledge, Eval, and Trace workspaces;
- workspace and conversation aggregates use JSON snapshots instead of fully
  normalized tables;
- MD/TXT parsing is local and deterministic; PDF/DOCX/XLSX and single-page web
  ingestion use Firecrawl. OCR, image-derived knowledge, Feishu ingestion, and
  recursive site crawling are deferred;
- KU matching is deterministic exact plus bounded character-pair similarity;
  semantic embeddings, vector search and reranking are deferred;
- P0 does not directly integrate SAG as a knowledge-governance or runtime
  system; the [SAG and Harness decision](./xiaofei-sag-harness-decision.md)
  limits it to isolated research until a separately authorized Feature meets
  the recorded adoption gates;
- capability plans are deterministically derived and reviewed as part of the
  workspace snapshot; LLM planning, version history, and rollback are deferred;
- the LangGraph graph uses Neon as the product persistence boundary rather than
  adding a second production checkpointer;
- the built-in public channel is a validation adapter. Email exposes an HTTPS
  Worker bridge and reply Receiver contract, but the Kafka consumer, automatic
  background job runner, production Receiver authentication, WhatsApp,
  LoopDesk private-note APIs, and realtime sockets are not yet connected;
- Eval currently uses deterministic business assertions, not model graders;
- no release versioning, rollback UI, scheduling or multi-channel hosting UI.

## Preview acceptance

FLY-140 迭代 2 的三阶段反馈与延迟预算、模型兼容实验、服务端 Test CA 历史、
Organization-scoped 合成 Support 会话、冻结 32 场景题集和报告模板统一以
[`acceptance/fly-140-preview.md`](./acceptance/fly-140-preview.md) 为准。本文不复制该契约，
也不把尚待实现或尚待 Preview 实测的项目描述为当前能力。

The complete slice has been exercised in an isolated Vercel + Neon Preview:

- password signup continued to onboarding without email verification;
- configuration save executed the Mastra governance Workflow;
- every admitted KU assertion plus the fixed risk/fallback assertions passed;
- LangGraph collected an order ID and damage-photo reference across separate
  turns, then transferred ownership to a human;
- the LangGraph safe-reply path asked Mastra Agent for a real model response
  using a released service-scope KU;
- LangGraph/Mastra execution, KU, owner, action, and trace evidence were visible
  in the Chatbot;
- a refund/complaint scenario exited to human handling without executing a
  business action.

The next iteration can further split specialized workspaces and normalize
storage only where review of this working slice identifies a real need.
