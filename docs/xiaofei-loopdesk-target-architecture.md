# Xiaofei target architecture

Xiaofei is a governed customer-service Agent control plane. It is not a channel
adapter and it is not a model that receives send authority by producing text.
This document shows the proposed architecture around the implemented P0 and the
Flyranking/LoopDesk target integration. For canonical current behavior, follow
[the foundation](./xiaofei-foundation.md), [the P0 framework](./xiaofei-p0-framework.md),
[`@repo/xiaofei`](../packages/xiaofei/README.md), and
[`@repo/ai`](../packages/ai/README.md).

**Legend:** solid nodes named “P0” are implemented boundaries; nodes marked
“target” require future delivery. Arrows represent dependency or event direction,
not permission to write another system’s database.

## Non-negotiable send gate

`@repo/xiaofei` remains the vendor-neutral domain kernel. LangGraph is the sole
conversation-state orchestrator; Mastra and a model generate only a constrained
candidate. Knowledge eligibility, reviewed Capability, same-version passing
Eval, final Guardrail, and owner reauthorization fail closed. A candidate is
never customer-visible authorization. The target external integration adds
LoopDesk’s authoritative send-time fencing; see
[the integration design](./xiaofei-loopdesk-integration-plan.md).

## 1. System context

```mermaid
flowchart LR
    Customer[Customer] --> Source[Channel source]
    Operator[Support operator] --> Loop[LoopDesk]
    Source --> XF[Xiaofei control plane]
    XF --> Loop
    Loop --> Provider[Channel provider]
    Operator --> XF
    Admin[Knowledge operator] --> XF
```

Xiaofei decides whether a reply may be proposed and authorized; LoopDesk owns
human collaboration and the final channel delivery; channel sources own source
events. No system directly writes another system’s private data.

## 2. Container view

```mermaid
flowchart TB
    User[Customers and operators] --> Web[P0: Xiaofei web application]
    Web --> Store[P0: Xiaofei product store]
    Source[Email and WhatsApp sources] --> Worker[target: channel worker]
    Worker --> Store
    Worker --> Loop[target: LoopDesk S2S API]
    Loop --> Channels[existing channel senders]
```

These are deployable/runtime and data-store boundaries only. The worker is a
target always-on runtime; Vercel-style request handlers must not hold Kafka or
RabbitMQ consumer connections. Package-level dependency direction appears only
in the component view below.

## 3. Xiaofei brain component view

```mermaid
flowchart LR
    Binding[target binding] --> Admission[domain admission]
    Knowledge[P0: knowledge and KU] --> Capability[P0: reviewed capability]
    Capability --> Eval[P0: matching Eval]
    Eval --> Admission
    Admission --> Graph[P0: LangGraph]
    Graph --> Candidate[P0: Mastra candidate]
    Candidate --> Guardrail[P0: final Guardrail]
    Guardrail --> Lease[P0: owner reauthorization]
    Lease --> Intent[target ReplyIntent]
    Domain[P0: @repo/xiaofei] --> Admission
    Domain --> Guardrail
    Runtime[P0: @repo/ai] --> Graph
    Runtime --> Candidate
```

Only the domain’s finalization path can create a target `ReplyIntent`; neither
the model nor a channel adapter may skip the gate.

## 4. Email inbound view

```mermaid
sequenceDiagram
    participant Mail as CcituService.Mail
    participant Kafka as Kafka
    participant Worker as target worker
    participant Store as target channel store
    Mail->>Kafka: email event
    Kafka->>Worker: dedicated consumer group
    Worker->>Store: validate, bind, deduplicate, persist cursor
    Store-->>Worker: commit
    Worker-->>Kafka: acknowledge
    Worker->>Mail: read-only history reconciliation
```

The dedicated group prevents competition with LoopDesk. Actual topic names,
ACLs, and completeness semantics remain operations confirmations.

## 5. WhatsApp inbound view

```mermaid
sequenceDiagram
    participant Gateway as WhatsApp source gateway
    participant Relay as target fan-out or relay
    participant LQ as LoopDesk queue
    participant XQ as Xiaofei queue
    participant Worker as target worker
    Gateway->>Relay: normalized source event
    Relay->>LQ: independent copy
    Relay->>XQ: independent copy
    XQ->>Worker: Xiaofei delivery
```

`CRMWhatsAppMsg` is an observed competing-consumer queue, so it is never the
Xiaofei input. Replay capability and the real gateway topology are unresolved.

## 6. Reply, receipt, and human takeover

```mermaid
sequenceDiagram
    participant X as Xiaofei
    participant O as Xiaofei command Outbox
    participant L as LoopDesk dispatcher
    participant P as Provider
    participant E as LoopDesk owner event Outbox
    X->>X: Guardrail and ownerEpoch reauthorization
    X->>O: ReplyIntent plus command transaction
    O->>L: command with idempotency and expected versions
    alt local owner version remains valid
        L->>L: repeat local fencing check
        L->>P: channel send
        P-->>L: result
        L-->>X: receipt event
    else takeover, transfer, or close
        L->>L: atomically block and increment loopOwnerVersion
        L->>E: owner event transaction
        E-->>X: owner event
        X->>X: advance ownerEpoch and invalidate lease
    end
```

LoopDesk’s `loopOwnerVersion` is the final distributed fence. Xiaofei’s
`ownerEpoch` protects its AI lease but cannot close the asynchronous propagation
window by itself. Receipts belong to LoopDesk’s event outbox until Xiaofei
durably consumes them; each side owns its own reliability records.

## 7. Deployment view

```mermaid
flowchart TB
    Users[Customers and operators] --> Web[P0: web/API runtime]
    Web --> DB[P0: Neon/PostgreSQL]
    Worker[target: container worker] --> DB
    Mail[CcituService.Mail] --> Kafka[Kafka]
    WA[WhatsApp gateway] --> Broker[RabbitMQ fan-out]
    Kafka --> Worker
    Broker --> Worker
    Worker --> Loop[target: LoopDesk integration API]
    Loop --> Provider[Email / WhatsApp providers]
```

Each environment isolates broker credentials, data, queues, groups, and S2S
clients. Deployment platform, networking, retention, and observability controls
are target operational decisions, not documented as completed infrastructure.

## 8. Migration and automatic-reply owner

```mermaid
stateDiagram-v2
    [*] --> Mirror
    Mirror: persist and reconcile only
    Mirror --> Shadow
    Shadow: candidates only
    Shadow --> Assist
    Assist: human sends suggestion
    Assist --> LimitedAuto
    LimitedAuto: Xiaofei only for enabled scope
    LimitedAuto --> Cutover
    Cutover: legacy automatic reply disabled
    LimitedAuto --> Assist: kill switch or rollback
    Cutover --> Assist: rollback
```

For every company/channel/conversation scope, the automatic-reply owner is one
of `none`, `legacy`, or `Xiaofei`; it is never both. Mirror, shadow, and assist
have no Xiaofei customer-visible automatic send.

## Target boundaries to implement separately

The next work should be independently owned: versioned channel/receipt/owner
contracts; persistence for binding, cursors, messages, outbox and receipt inbox;
worker runtime; Email connector; WhatsApp fan-out; LoopDesk S2S API and unified
dispatcher; owner event outbox; UI projections; migration controls; and legacy
retirement. See the integration document for acceptance cases and production
questions. This documentation adds no code, deployment, authorization change,
or cloud resource.
