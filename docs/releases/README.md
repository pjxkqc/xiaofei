# Xiaofei release status

> Last verified: 2026-07-29 (Asia/Shanghai)

This page is the repository source of truth for the currently deployed version,
environment differences, stable URLs, demo capabilities, and safe test access.
Architecture and deployment internals remain in the linked owning guides; this
page records what a reviewer can use now.

## Release model

| Record                               | Purpose                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| This page                            | Current Production, UAT, active demo candidate, URLs, access, and feature delta    |
| [`CHANGELOG.md`](../../CHANGELOG.md) | Chronological repository changes                                                   |
| GitHub Release + `vX.Y.Z` tag        | Immutable history for a version that has actually been promoted to Production      |
| Multica issue                        | Owner, acceptance criteria, validation evidence, and the work needed for a release |

There is no tagged Xiaofei GitHub Release yet. The current P0 demo is still a
candidate in [PR #22](https://github.com/pjxkqc/xiaofei/pull/22), so publishing
it as a Production release would be misleading. The first GitHub Release should
be created only after an explicitly authorized UAT-to-Production promotion.

## Current candidate

**P0 demo candidate — FLY-77 / FLY-85**

- Status: Draft PR, ready for human review; not yet in UAT or Production.
- Source: [PR #22](https://github.com/pjxkqc/xiaofei/pull/22),
  `agent/fly-77-fallback-capability → uat`.
- Stable branch Preview:
  [xiaofei-preview-git-agent-fly-77-fallback-c-8af6c1-flyranking16.vercel.app](https://xiaofei-preview-git-agent-fly-77-fallback-c-8af6c1-flyranking16.vercel.app).
- Validation: use the checks and current head shown on PR #22; every push
  replaces the branch alias target and invalidates older exact-head evidence.
- Intended next step: merge to `uat` after human acceptance, verify durable UAT,
  then prepare a separately authorized promotion PR when Production release is
  desired.

## Environments

| Environment       | Source and current revision                                                                                | Stable base URL                                                                                              | Data boundary                                     | Login and lifecycle                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Production        | [`main@eb0b275`](https://github.com/pjxkqc/xiaofei/commit/eb0b2759cd3614409985f6892418f90709d34795)        | [xiaofei-preview.vercel.app](https://xiaofei-preview.vercel.app)                                             | Neon `main`                                       | Normal login/signup only; persistent. Preview one-click login is disabled.                                      |
| UAT               | [`uat@6b8cce7`](https://github.com/pjxkqc/xiaofei/commit/6b8cce7f2d1d69c9a638a43a0da38d299ccda302)         | [xiaofei-preview-git-uat-flyranking16.vercel.app](https://xiaofei-preview-git-uat-flyranking16.vercel.app)   | Neon `preview/uat`                                | Preview one-click login; durable shared test data. Do not delete or force-push the `uat` branch.                |
| PR #22 candidate  | [current PR head](https://github.com/pjxkqc/xiaofei/pull/22/commits) on `agent/fly-77-fallback-capability` | [stable PR branch alias](https://xiaofei-preview-git-agent-fly-77-fallback-c-8af6c1-flyranking16.vercel.app) | Neon `preview/agent/fly-77-fallback-capability`   | Preview one-click login; disposable. The database branch is removed after the PR closes and its branch is gone. |
| Local development | Current checkout                                                                                           | [localhost:3000](http://localhost:3000)                                                                      | Developer-selected PostgreSQL/Docker or test Neon | Create a local user. Preview one-click login is disabled outside Vercel Preview.                                |

Production and UAT are currently built by Vercel with Node.js 24.x. GitHub
quality runs Node.js 22, and the repository declares Node.js 22 or newer.

### What differs today

| Capability                                                                                    | Production | UAT | PR #22 candidate |
| --------------------------------------------------------------------------------------------- | ---------- | --- | ---------------- |
| Supastarter auth, signup, organizations, account surfaces                                     | Yes        | Yes | Yes              |
| Public `/support` customer page and authenticated `/inbox`                                    | Yes        | Yes | Yes              |
| Mastra generation, LangGraph state, Guardrail, ownership, and Neon persistence                | Yes        | Yes | Yes              |
| MD/TXT, PDF/DOCX/XLSX, one-page web, and manual-Q&A ingestion                                 | Yes        | Yes | Yes              |
| Entry CRUD, KU generation/review/publish, capability review, and deterministic Eval           | Yes        | Yes | Yes              |
| Preview fixture selectors and one-click operator                                              | Hidden     | Yes | Yes              |
| Flyranking/LoopDesk target architecture documentation                                         | No         | Yes | Yes              |
| Reusable Multica `xiaofei-pr-delivery` skill                                                  | No         | Yes | Yes              |
| Nine-category default knowledge, bounded clarification, and explicit-risk handoff             | No         | No  | Yes              |
| Shared public-support governance workspace and four-step knowledge-to-conversation navigation | No         | No  | Yes              |
| Presales slots kept non-blocking and generated `C-Air`/`Wi-Fi` product terms preserved        | No         | No  | Yes              |
| Immediate customer-message display and readable Markdown in `/support` and `/inbox`           | No         | No  | Yes              |
| Contextual short follow-ups plus operator-visible knowledge-miss attention without auto-exit  | No         | No  | Yes              |

The table describes deployed revisions, not merely code that exists somewhere
in the repository. UAT currently adds delivery and target-architecture
documentation to the Production baseline; the PR #22 runtime delta is not
available in UAT until that PR is merged.

## Demo URLs

Use the stable PR #22 branch alias for the current demo:

| Surface                     | URL                                                                                                                                    | Access                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Public customer support     | [`/support`](https://xiaofei-preview-git-agent-fly-77-fallback-c-8af6c1-flyranking16.vercel.app/support)                               | No login                 |
| Login                       | [`/login`](https://xiaofei-preview-git-agent-fly-77-fallback-c-8af6c1-flyranking16.vercel.app/login)                                   | Preview one-click button |
| Sources and entries         | [`/knowledge/entries`](https://xiaofei-preview-git-agent-fly-77-fallback-c-8af6c1-flyranking16.vercel.app/knowledge/entries)           | Authenticated            |
| Knowledge Units             | [`/knowledge/units`](https://xiaofei-preview-git-agent-fly-77-fallback-c-8af6c1-flyranking16.vercel.app/knowledge/units)               | Authenticated            |
| Capability review and Eval  | [`/knowledge/capabilities`](https://xiaofei-preview-git-agent-fly-77-fallback-c-8af6c1-flyranking16.vercel.app/knowledge/capabilities) | Authenticated            |
| Conversation validation     | [`/chatbot`](https://xiaofei-preview-git-agent-fly-77-fallback-c-8af6c1-flyranking16.vercel.app/chatbot)                               | Authenticated            |
| Support inbox               | [`/inbox`](https://xiaofei-preview-git-agent-fly-77-fallback-c-8af6c1-flyranking16.vercel.app/inbox)                                   | Authenticated            |
| Agent and fallback settings | [`/agent-settings`](https://xiaofei-preview-git-agent-fly-77-fallback-c-8af6c1-flyranking16.vercel.app/agent-settings)                 | Authenticated            |
| API communication demo      | [`/api-demo`](https://xiaofei-preview-git-agent-fly-77-fallback-c-8af6c1-flyranking16.vercel.app/api-demo)                             | Authenticated            |

The same paths apply to the UAT and Production base URLs. Immutable Vercel
deployment URLs belong in PR acceptance evidence, not in this maintained page,
because every push creates a new one.

## Test access

| Use case              | Environment        | Account or method                                                                                                                                   |
| --------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer conversation | All                | No account. Open `/support`, enter an optional display name, and start a new conversation.                                                          |
| Preview operator      | PR Preview and UAT | Click **Continue as Preview operator** on `/login`. The isolated account is `preview-operator@xiaofei.invalid`; no password is exposed or required. |
| Normal test user      | Any environment    | Register a disposable email at `/signup`; email verification is disabled. Keep the chosen password private.                                         |
| Production operator   | Production         | Use an individually owned account. No shared Production password or bypass account is maintained.                                                   |
| Local developer       | Local              | Create a local user against the selected local database.                                                                                            |

The Preview operator is created independently inside each Preview database
branch. Its email is a public identifier, not a credential. Never add a
password, API key, session cookie, database URL, real customer data, or copied
authorization header to this page, a GitHub Release, or a Multica issue.

## Recommended demo path

1. Open the PR Preview `/login` and continue as the Preview operator.
2. Open `/knowledge/entries`, select one of the fictional Preview fixtures, and
   create or review normalized entries.
3. Continue through `/knowledge/units` and `/knowledge/capabilities`; publish
   only reviewed KUs and require passing current-version Eval evidence.
4. Use `/chatbot` to verify a governed answer, provenance, contextual follow-up,
   and knowledge-miss attention without automatic exit.
5. Open `/support` in a signed-out browser, send a customer question, and
   confirm the same conversation and owner state in `/inbox`.

For the current accepted fixture, a useful grounded question is:

> C-Air Pro 适合 40 平方米会议室并且支持 Wi-Fi 吗？

The expected behavior is to match the released C-Air KU, state which facts the
FAQ actually confirms, and avoid inventing C-Air Pro specifications.

## Maintenance workflow

1. Update this page in the same PR when an environment, stable URL, test-access
   method, or demo-visible capability changes.
2. After a feature merges into `uat`, replace the UAT revision and environment
   delta only after its stable alias, `preview/uat` data, quality workflow, and
   smoke test are verified.
3. For a Production promotion, choose the SemVer version and update this page
   plus `CHANGELOG.md` on the temporary `promote/uat-*` branch.
4. After the promotion is merged and Production is verified, create a GitHub
   Release whose `vX.Y.Z` tag targets the exact released `main` SHA. Use the
   changelog as the summary and link back to this page for environments and
   access.
5. Fast-forward `uat` to the released `main`, re-verify UAT, and update its
   revision here if required.
6. Track the work and evidence in one Multica release issue owned by the
   platform/delivery boundary. Multica coordinates the release; it does not
   replace this repository record or the immutable GitHub Release.

See [PR Preview CI/CD](../pr-preview-setup.md) for deployment mechanics and the
[Xiaofei PR delivery skill](../multica/skills/xiaofei-pr-delivery/SKILL.md) for
the exact promotion protocol.
