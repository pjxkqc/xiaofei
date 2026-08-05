# Xiaofei documentation

This directory contains cross-cutting architecture and operating guides. Code
that owns a specific boundary also has a nearby README so that implementation
rules remain visible where changes are made.

## Start here

| Document                                                                               | Use it when                                                        |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [`../README.md`](../README.md)                                                         | Setting up the repository or understanding the full system         |
| [`xiaofei-p0-framework.md`](./xiaofei-p0-framework.md)                                 | Reviewing the current P0 architecture, flow, and deliberate limits |
| [`xiaofei-sag-harness-decision.md`](./xiaofei-sag-harness-decision.md)                 | 了解 P0 继续使用 Harness、并行评估 SAG 类知识治理的决策            |
| [`xiaofei-foundation.md`](./xiaofei-foundation.md)                                     | Changing ownership, state, handoff, or trace invariants            |
| [`xiaofei-loopdesk-target-architecture.md`](./xiaofei-loopdesk-target-architecture.md) | Reviewing the proposed Xiaofei control plane and its P0 boundary   |
| [`xiaofei-loopdesk-integration-plan.md`](./xiaofei-loopdesk-integration-plan.md)       | Planning the proposed Flyranking / LoopDesk integration            |
| [`email-worker-integration.md`](./email-worker-integration.md)                         | Integrating and accepting the implemented Email Worker loop        |
| [`pr-preview-setup.md`](./pr-preview-setup.md)                                         | Operating GitHub, Vercel, Neon, Preview databases, or CI/CD        |
| [`releases/README.md`](./releases/README.md)                                           | Finding the current version, environments, URLs, and test access   |
| [`acceptance/UAT-2026-08-03.md`](./acceptance/UAT-2026-08-03.md)                       | Reviewing the latest exact-head UAT acceptance evidence            |
| [`repository-structure.md`](./repository-structure.md)                                 | Finding code ownership, allowed dependencies, and validation scope |
| [`multica/README.md`](./multica/README.md)                                             | Importing this repository into a Multica project and Agent squad   |
| [`multica/codex-parallel-handoff.md`](./multica/codex-parallel-handoff.md)             | Starting a parallel Codex Feature stream safely through Multica    |
| [`acceptance/FLY-99.md`](./acceptance/FLY-99.md)                                       | Reviewing the durable FLY-99 Preview acceptance evidence           |

## Boundary documentation

| Boundary            | Local guide                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------- |
| SaaS application    | [`../apps/saas/README.md`](../apps/saas/README.md)                                       |
| Domain kernel       | [`../packages/xiaofei/README.md`](../packages/xiaofei/README.md)                         |
| AI runtime adapters | [`../packages/ai/README.md`](../packages/ai/README.md)                                   |
| Xiaofei API module  | [`../packages/api/modules/xiaofei/README.md`](../packages/api/modules/xiaofei/README.md) |
| Prisma persistence  | [`../packages/database/prisma/README.md`](../packages/database/prisma/README.md)         |

## Target architecture and integrations (not current P0)

Read the current-state guides first: [`xiaofei-foundation.md`](./xiaofei-foundation.md),
[`xiaofei-p0-framework.md`](./xiaofei-p0-framework.md), and the owning package
READMEs remain the canonical source for implemented behavior and invariants.

The following documents describe reviewed target direction; they deliberately do
not claim that the Flyranking connectors, LoopDesk integration API, distributed
fencing, or channel persistence exist today.

1. [`xiaofei-loopdesk-target-architecture.md`](./xiaofei-loopdesk-target-architecture.md) explains
   the product control plane, target boundaries, and migration views.
2. [`xiaofei-loopdesk-integration-plan.md`](./xiaofei-loopdesk-integration-plan.md)
   records the bounded legacy-code observations and the proposed Email,
   WhatsApp, and LoopDesk integration contracts.

## Documentation rules

- Put stable product invariants in `packages/xiaofei/README.md` or the
  foundation document.
- Put provider-specific behavior in the AI adapter guide.
- Put deployment credentials, Preview lifecycle, and cloud setup only in the
  CI/CD guide; never include credential values.
- Keep current deployed revisions, stable URLs, environment differences, and
  non-secret test-access methods in the Release status page.
- Update the P0 framework document when a change alters the system boundary or
  a deliberate limit.
- Keep the Multica blueprint aligned with `AGENTS.md` and the repository
  ownership map; it describes coordination, not a second architecture.
- Prefer links to the owning guide over copying the same explanation into
  multiple files.
