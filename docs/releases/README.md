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

The current Xiaofei P0 demo release is
[`v0.1.0`](https://github.com/pjxkqc/xiaofei/releases/tag/v0.1.0). The tag is
created only after the exact `main` revision is deployed and verified in
Production.

## Current release

**Xiaofei P0 demo — `v0.1.0`**

- Scope: Supastarter auth and roles, public customer support, support inbox,
  governed knowledge ingestion, KU review, capability admission, Eval, Mastra
  reply generation, LangGraph orchestration, and persisted Neon conversations.
- Release source:
  [`v0.1.0`](https://github.com/pjxkqc/xiaofei/releases/tag/v0.1.0).
- Stable Production URL:
  [xiaofei-preview.vercel.app](https://xiaofei-preview.vercel.app).
- Stable UAT URL:
  [xiaofei-preview-git-uat-flyranking16.vercel.app](https://xiaofei-preview-git-uat-flyranking16.vercel.app).
- UAT acceptance: 11 eligible KUs, current capability review, deterministic
  Eval `13/13`, and two clean persisted conversations covering product
  follow-up and knowledge-miss recovery.
- Production acceptance: verify the same two conversation paths after the
  release deployment; Production and UAT remain separate persistent data
  boundaries.

## Environments

| Environment       | Release source                                                             | Stable base URL                                                                                            | Data boundary                                     | Login and lifecycle                                                                              |
| ----------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Production        | [`v0.1.0`](https://github.com/pjxkqc/xiaofei/releases/tag/v0.1.0) (`main`) | [xiaofei-preview.vercel.app](https://xiaofei-preview.vercel.app)                                           | Neon `main`                                       | Normal login/signup only; persistent. Preview one-click login is disabled.                       |
| UAT               | [`v0.1.0`](https://github.com/pjxkqc/xiaofei/releases/tag/v0.1.0) (`uat`)  | [xiaofei-preview-git-uat-flyranking16.vercel.app](https://xiaofei-preview-git-uat-flyranking16.vercel.app) | Neon `preview/uat`                                | Preview one-click login; durable shared test data. Do not delete or force-push the `uat` branch. |
| Local development | Current checkout                                                           | [localhost:3000](http://localhost:3000)                                                                    | Developer-selected PostgreSQL/Docker or test Neon | Create a local user. Preview one-click login is disabled outside Vercel Preview.                 |

Production and UAT are currently built by Vercel with Node.js 24.x. GitHub
quality runs Node.js 22, and the repository declares Node.js 22 or newer.

### What differs today

| Capability                                                                                    | Production | UAT |
| --------------------------------------------------------------------------------------------- | ---------- | --- |
| Supastarter auth, signup, organizations, account surfaces                                     | Yes        | Yes |
| Public `/support` customer page and authenticated `/inbox`                                    | Yes        | Yes |
| Mastra generation, LangGraph state, Guardrail, ownership, and Neon persistence                | Yes        | Yes |
| MD/TXT, PDF/DOCX/XLSX, one-page web, and manual-Q&A ingestion                                 | Yes        | Yes |
| Entry CRUD, KU generation/review/publish, capability review, and deterministic Eval           | Yes        | Yes |
| Nine-category default knowledge and source-grounded generated KUs                             | Yes        | Yes |
| Contextual short follow-ups plus operator-visible knowledge-miss attention without auto-exit  | Yes        | Yes |
| Direct scenario-evidence ranking for overlapping product KUs                                  | Yes        | Yes |
| Shared public-support governance workspace and four-step knowledge-to-conversation navigation | Yes        | Yes |
| Immediate customer-message display and readable Markdown in `/support` and `/inbox`           | Yes        | Yes |
| Split Agent general, fallback/handoff, and runtime-status settings pages                      | Yes        | Yes |
| Preview fixtures and one-click operator                                                       | Hidden     | Yes |

Production and UAT run the same release code. Their users, workspaces,
knowledge, Eval evidence, and conversations are intentionally independent.

## Demo URLs

Use Production for the released demo and UAT for safe operator validation. The
same paths apply to both stable base URLs:

| Surface                     | URL                                                                                                           | Access                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Public customer support     | [`/support`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/support)                                 | No login                 |
| Login                       | [`/login`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/login)                                     | Preview one-click button |
| Sources and entries         | [`/knowledge/entries`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/knowledge/entries)             | Authenticated            |
| Knowledge Units             | [`/knowledge/units`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/knowledge/units)                 | Authenticated            |
| Capability review and Eval  | [`/knowledge/capabilities`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/knowledge/capabilities)   | Authenticated            |
| Conversation validation     | [`/chatbot`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/chatbot)                                 | Authenticated            |
| Support inbox               | [`/inbox`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/inbox)                                     | Authenticated            |
| Agent general settings      | [`/agent-settings/general`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/agent-settings/general)   | Authenticated            |
| Fallback and handoff policy | [`/agent-settings/fallback`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/agent-settings/fallback) | Authenticated            |
| Agent runtime status        | [`/agent-settings/status`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/agent-settings/status)     | Authenticated            |
| API communication demo      | [`/api-demo`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/api-demo)                               | Authenticated            |

Immutable Vercel deployment URLs belong in PR acceptance evidence, not in this
maintained page, because every push creates a new one.

## Test access

| Use case              | Environment        | Account or method                                                                                                                                                                                                  |
| --------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Customer conversation | All                | No account. Open `/support`, enter an optional display name, and start a new conversation.                                                                                                                         |
| Preview operator      | PR Preview and UAT | Click **Continue as Preview operator** on `/login` to idempotently initialize synthetic fixtures. `preview-operator@xiaofei.invalid` needs no password; then sign out and use the documented public fixture roles. |
| Normal test user      | Any environment    | Register a disposable email at `/signup`; email verification is disabled. Keep the chosen password private.                                                                                                        |
| Production operator   | Production         | Use an individually owned account. No shared Production password or bypass account is maintained.                                                                                                                  |
| Local developer       | Local              | Create a local user against the selected local database.                                                                                                                                                           |

The Preview operator is created independently inside each Preview database
branch. Its email is a public identifier, not a credential. Only the explicitly
documented Preview/UAT synthetic fixture passwords may be published; never add
real, Production, or personal passwords, API keys, session cookies, database
URLs, real customer data, or copied authorization headers to this page, a
GitHub Release, or a Multica issue. Production has no shared test account.

## Recommended demo path

1. Open the UAT `/login` and continue as the Preview operator.
2. Open `/knowledge/entries`, select one of the fictional Preview fixtures, and
   create or review normalized entries.
3. Continue through `/knowledge/units` and `/knowledge/capabilities`; publish
   only reviewed KUs and require passing current-version Eval evidence.
4. Use `/chatbot` to verify a governed answer, provenance, contextual follow-up,
   and knowledge-miss attention without automatic exit.
5. Open `/support` in a signed-out browser, send a customer question, and
   confirm the same conversation and owner state in `/inbox`.

For the current accepted fixture, useful grounded questions are:

> C-Air Mini 适合多大的房间？

Then continue with:

> 20 平方，需要联网。

To verify fallback recovery, ask two unsupported store-hours questions, then:

> C-Air Mini 的保修期限是多久？

The expected recovery answer states 24 months for the complete unit and 36
months for the fan motor, keeps AI ownership, and clears operator attention.

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
