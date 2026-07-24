# Xiaofei documentation

This directory contains cross-cutting architecture and operating guides. Code
that owns a specific boundary also has a nearby README so that implementation
rules remain visible where changes are made.

## Start here

| Document                                               | Use it when                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| [`../README.md`](../README.md)                         | Setting up the repository or understanding the full system         |
| [`xiaofei-p0-framework.md`](./xiaofei-p0-framework.md) | Reviewing the current P0 architecture, flow, and deliberate limits |
| [`xiaofei-foundation.md`](./xiaofei-foundation.md)     | Changing ownership, state, handoff, or trace invariants            |
| [`pr-preview-setup.md`](./pr-preview-setup.md)         | Operating GitHub, Vercel, Neon, Preview databases, or CI/CD        |
| [`repository-structure.md`](./repository-structure.md) | Finding code ownership, allowed dependencies, and validation scope |
| [`multica/README.md`](./multica/README.md)             | Importing this repository into a Multica project and Agent squad   |

## Boundary documentation

| Boundary            | Local guide                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------- |
| SaaS application    | [`../apps/saas/README.md`](../apps/saas/README.md)                                       |
| Domain kernel       | [`../packages/xiaofei/README.md`](../packages/xiaofei/README.md)                         |
| AI runtime adapters | [`../packages/ai/README.md`](../packages/ai/README.md)                                   |
| Xiaofei API module  | [`../packages/api/modules/xiaofei/README.md`](../packages/api/modules/xiaofei/README.md) |
| Prisma persistence  | [`../packages/database/prisma/README.md`](../packages/database/prisma/README.md)         |

## Documentation rules

- Put stable product invariants in `packages/xiaofei/README.md` or the
  foundation document.
- Put provider-specific behavior in the AI adapter guide.
- Put deployment credentials, Preview lifecycle, and cloud setup only in the
  CI/CD guide; never include credential values.
- Update the P0 framework document when a change alters the system boundary or
  a deliberate limit.
- Keep the Multica blueprint aligned with `AGENTS.md` and the repository
  ownership map; it describes coordination, not a second architecture.
- Prefer links to the owning guide over copying the same explanation into
  multiple files.
