# Xiaofei domain foundation

This is the first intentionally small extraction from the historical
`xiaofei-harness` requirements. It establishes owned product contracts without
copying the exploration demos or choosing a workflow engine prematurely.

## Product boundary

The long-term product is an Agent control plane. Customer support is its first
validation scenario, not the whole platform. The stable core is:

```text
Agent configuration
  → conversation admission and ownership
  → session state
  → knowledge and policy decisions
  → guarded response or human handoff
  → business-readable trace and evaluation
```

Frameworks such as Mastra or LangGraph will implement runtime adapters behind
these contracts. Next.js and oRPC expose product surfaces. None of those
frameworks owns the domain model.

## Included in this increment

`@repo/xiaofei` now owns the first contracts:

- `AgentProfile`: tenant-scoped identity, lifecycle, language and safety bounds;
- `ConversationState`: owner, owner epoch, stage, slots, risk and next action;
- `AiRunLease`: the ownership epoch captured when an AI run starts;
- `HandoffPackage`: the minimum context delivered to a human operator;
- `TraceEvent`: a business-readable event envelope for future persistence;
- pure ownership and handoff transitions.

The hard invariant is that every owner change increments `ownerEpoch`. An AI run
may send a reply only when its lease still matches the conversation. Human
takeover or conversation closure therefore invalidates stale model output
without depending on a prompt.

Knowledge admission is equally fail-closed: the authenticated outer layer must
resolve a channel and conversation to a tenant `KnowledgeWorkspaceBinding`; the
kernel verifies that binding against the conversation tenant and workspace
snapshot before selecting a KU. Automatic handling additionally requires one
reviewed capability plan whose admitted IDs exactly match the current released,
eligible KUs and a passing Eval suite recorded for that exact plan version.
Changing a source or normalized entry deterministically revokes KU eligibility,
capability review, and Eval evidence. This does not replace the final Guardrail
or `ownerEpoch` lease check; those remain the customer-visible send authority.

Knowledge absence is fail-safe without being an automatic ownership transfer.
The kernel may send only a configured, deterministic clarification reply while
keeping AI ownership; it never asks a model to invent missing facts. Every miss
creates an operator-visible attention state. Reaching the configured
clarification budget changes the deterministic customer reply but does not
transfer ownership, so a later message that matches reviewed knowledge can
clear the attention state and resume a governed reply. Explicit human requests,
complaints, legal or safety risk, conflicting evidence, high-risk
business-action requests, and required human-permission actions still bypass
clarification and hand off immediately.

This maps to the source requirements for session state, admission and handling
rights, human handoff, response blocking, and execution records.

The next vertical slice described here is implemented by
[`xiaofei-p0-framework.md`](./xiaofei-p0-framework.md). The domain ownership
rules remain the authority even though Mastra, LangGraph, Neon persistence and
the first product surface now exist around them.
