# Xiaofei release status

> Last verified: 2026-08-03 (Asia/Shanghai)
>
> Production revision: `ecb44a7baa27f109701fdbd3450cba42c4dc2878`
>
> Accepted UAT application revision: `afe89ef60a3715005a110d22e60b3266c47ab07d`

This page is the repository source of truth for deployed versions, environment
differences, stable URLs, demo paths, and safe test access. Exact delivery and
manual evidence for the current UAT candidate is recorded in
[`UAT-2026-08-03.md`](../acceptance/UAT-2026-08-03.md).

## Release snapshot

| Environment | Status                           | Source                  | Revision                                                                                       | Stable URL                                                                                                 | Data boundary                |
| ----------- | -------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Production  | Released `v0.1.0`                | `main` and tag `v0.1.0` | [`ecb44a7`](https://github.com/pjxkqc/xiaofei/commit/ecb44a7baa27f109701fdbd3450cba42c4dc2878) | [xiaofei-preview.vercel.app](https://xiaofei-preview.vercel.app)                                           | Neon `main`                  |
| UAT         | Accepted post-`v0.1.0` candidate | durable `uat` branch    | [`afe89ef`](https://github.com/pjxkqc/xiaofei/commit/afe89ef60a3715005a110d22e60b3266c47ab07d) | [xiaofei-preview-git-uat-flyranking16.vercel.app](https://xiaofei-preview-git-uat-flyranking16.vercel.app) | Neon `preview/uat`           |
| PR Preview  | Review only                      | `agent/*` PR to `uat`   | exact PR head                                                                                  | generated per PR                                                                                           | Neon `preview/<head-branch>` |

Production and UAT do not currently run the same code. UAT contains the next
candidate capabilities described below; they are not Production features until
an explicitly authorized promotion is accepted and released.

## Production — `v0.1.0`

The released P0 demo includes Supastarter authentication and roles, public
customer support, the authenticated support inbox, governed knowledge
ingestion, KU review and publishing, capability admission and deterministic
Eval, Mastra reply generation, LangGraph orchestration, Guardrail decisions,
and persisted Neon conversations.

- GitHub Release: [Xiaofei P0 Demo v0.1.0](https://github.com/pjxkqc/xiaofei/releases/tag/v0.1.0)
- Exact revision: [`ecb44a7`](https://github.com/pjxkqc/xiaofei/commit/ecb44a7baa27f109701fdbd3450cba42c4dc2878)
- Chinese release note: [`v0.1.0-zh.md`](./v0.1.0-zh.md)
- Production has normal login/signup only. Preview one-click accounts and
  synthetic shared role passwords are disabled.

## Accepted UAT candidate

UAT adds the first Organization-centered business loop on top of `v0.1.0`:

- durable S2S event intake and an event monitor with delivery timestamps,
  replay visibility, and raw payload loading only on demand;
- Organization-scoped Xiaofei configuration, knowledge, customers,
  conversations, events, and authorization boundaries;
- customer list/detail and Organization Inbox views;
- Global Admin Xiaofei overview and per-Organization read/configuration;
- Preview/UAT synthetic Global Admin, owner, admin, member, and second-merchant
  fixtures;
- Email and WhatsApp Mock Worker ingress, idempotent external message handling,
  Xiaofei reply persistence, and echo suppression.

The 2026-08-03 acceptance verified the exact application revision `afe89ef`:

- GitHub Quality passed for the exact revision;
- Vercel UAT deployment is Ready and the stable UAT alias points to it;
- Neon `preview/uat` is ready and remains separate from Neon `main`;
- the public support flow passed product question, contextual follow-up,
  knowledge miss without auto-exit, and later grounded recovery;
- Organization A has 9 published KUs, capability version
  `cap-20260803123038` is reviewed, and Eval passes;
- a new Email Mock Worker message produced durable inbound and echo events,
  created the Organization customer/conversation, and remained under Xiaofei
  ownership after admission;
- the Global Admin overview loaded cross-Organization counters and recent event
  summaries without changing the active Organization.

The concise Chinese candidate note is
[`uat-2026-08-03-zh.md`](./uat-2026-08-03-zh.md).

## Environment differences

| Capability                                                                       | Production `v0.1.0` | Accepted UAT candidate |
| -------------------------------------------------------------------------------- | ------------------- | ---------------------- |
| Public `/support`, governed Chatbot, fallback recovery, and knowledge governance | Yes                 | Yes                    |
| PDF/DOCX/XLSX, MD/TXT, one-page web, and manual-Q&A ingestion                    | Yes                 | Yes                    |
| Organization-scoped Xiaofei configuration and knowledge                          | No                  | Yes                    |
| Organization customers and channel conversations                                 | No                  | Yes                    |
| Durable S2S event inbox and delivery-time monitor                                | No                  | Yes                    |
| Email/WhatsApp Mock Worker observable loop                                       | No                  | Yes                    |
| Global Admin Xiaofei overview                                                    | No                  | Yes                    |
| Preview one-click login and synthetic role fixtures                              | Hidden              | Yes                    |
| Real Kafka worker or real Email/WhatsApp sender                                  | No                  | No                     |

## Two UAT demo paths

### 1. Public P0 support flow

This is the fastest way to demonstrate conversational quality and the complete
knowledge-governance loop.

1. Open public [`/support`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/support).
2. Ask `C-Air Mini 适合多大的房间？`.
3. Follow with `20 平方，需要联网。` and confirm the reply preserves product
   context and distinguishes Mini, S Connect, and Pro.
4. Ask an unsupported store-hours question and confirm Xiaofei keeps ownership
   while returning a soft knowledge-miss response.
5. Ask `C-Air Mini 的保修期限是多久？` and confirm recovery to the grounded
   24-month complete-unit and 36-month fan-motor warranty answer.

The retained browser-side acceptance conversation is named
`UAT-Release验收-20260803`.

### 2. Organization business-ingress flow

This demonstrates the merchant → customer → conversation hierarchy and the
future LoopDesk/worker boundary.

1. Open UAT [`/login`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/login)
   and click **Continue as Preview operator**.
2. Select `FLY-99 验收商户 A`.
3. Confirm [`/knowledge/capabilities`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/knowledge/capabilities)
   is reviewed and Eval passes. Re-run review/Eval after changing knowledge.
4. Open [`/integrations/mock-worker`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/integrations/mock-worker),
   enter `uat-fly101-merchant-a`, and send an Email or WhatsApp test message.
5. Inspect the durable event and ignored echo in
   [`/integrations/events`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/integrations/events).
6. Confirm the customer and conversation in
   [`/customers`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/customers)
   and [`/inbox`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/inbox).

The retained release evidence uses customer
`uat-release-customer-20260803` and conversations
`uat-release-conversation-20260803` (fail-closed before refreshed Eval) and
`uat-release-conversation-ai-20260803` (Xiaofei-owned after refreshed Eval).

The public support flow still uses its shared P0 workspace. It is not yet bound
to an Organization customer record. Organization knowledge and channel
conversations are isolated and are exercised through the Mock Worker path.

## Demo URLs

| Surface                 | Production                                                                             | UAT                                                                                                             | Access                            |
| ----------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Public customer support | [`/support`](https://xiaofei-preview.vercel.app/support)                               | [`/support`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/support)                                   | No login                          |
| Login                   | [`/login`](https://xiaofei-preview.vercel.app/login)                                   | [`/login`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/login)                                       | UAT has one-click fixtures        |
| Knowledge documents     | [`/knowledge/documents`](https://xiaofei-preview.vercel.app/knowledge/documents)       | [`/knowledge/documents`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/knowledge/documents)           | Authenticated                     |
| Knowledge entries       | [`/knowledge/entries`](https://xiaofei-preview.vercel.app/knowledge/entries)           | [`/knowledge/entries`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/knowledge/entries)               | Authenticated                     |
| Knowledge Units         | [`/knowledge/units`](https://xiaofei-preview.vercel.app/knowledge/units)               | [`/knowledge/units`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/knowledge/units)                   | Authenticated                     |
| Capability and Eval     | [`/knowledge/capabilities`](https://xiaofei-preview.vercel.app/knowledge/capabilities) | [`/knowledge/capabilities`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/knowledge/capabilities)     | Authenticated                     |
| Conversation test       | [`/chatbot`](https://xiaofei-preview.vercel.app/chatbot)                               | [`/chatbot`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/chatbot)                                   | Authenticated                     |
| Organization customers  | Not released                                                                           | [`/customers`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/customers)                               | Authenticated Organization member |
| Support inbox           | [`/inbox`](https://xiaofei-preview.vercel.app/inbox)                                   | [`/inbox`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/inbox)                                       | Authenticated                     |
| Integration events      | Not released                                                                           | [`/integrations/events`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/integrations/events)           | Authenticated Organization member |
| Mock Worker             | Not released                                                                           | [`/integrations/mock-worker`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/integrations/mock-worker) | Authenticated Organization member |
| Global Xiaofei Admin    | Not released                                                                           | [`/admin/xiaofei`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/admin/xiaofei)                       | Application `admin` only          |
| API demo                | [`/api-demo`](https://xiaofei-preview.vercel.app/api-demo)                             | [`/api-demo`](https://xiaofei-preview-git-uat-flyranking16.vercel.app/api-demo)                                 | Authenticated                     |

## Test access

| Use case                     | Environment        | Account or method                                                                                                                                                                         |
| ---------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer conversation        | All                | No account; open `/support`.                                                                                                                                                              |
| Preview operator             | PR Preview and UAT | Click **Continue as Preview operator**. `preview-operator@xiaofei.invalid` requires no password.                                                                                          |
| Multi-role tenant validation | PR Preview and UAT | Use the public synthetic Global Admin, Owner A, Admin A, Member A, and Owner B fixtures listed in [`FLY-99.md`](../acceptance/FLY-99.md#test-access--验收访问) and on the UAT login page. |
| Normal test user             | Any environment    | Register a disposable email; email verification is disabled. Keep the chosen password private.                                                                                            |
| Production operator          | Production         | Use an individually owned account. Production has no shared bypass account.                                                                                                               |

Only the explicitly documented Preview/UAT fixture credentials may be public.
Never commit real or Production passwords, API keys, session cookies, database
URLs, customer data, or copied authorization headers.

## Data and lifecycle rules

- Production data persists in Neon `main`.
- UAT data persists independently in Neon `preview/uat`; do not delete or
  force-push the durable `uat` branch.
- Each ordinary PR gets a disposable Neon `preview/<head-branch>` branch and a
  Vercel Preview. Closing or merging the PR triggers cleanup.
- Knowledge changes invalidate current capability/Eval evidence. Review and run
  Eval again before interpreting a safe handoff as a runtime failure.
- The application is still in pre-launch demo status. UAT demo data may be
  reset and rebuilt with explicit release-owner approval; Production cleanup
  always requires separate authorization.

See [PR Preview CI/CD](../pr-preview-setup.md) and the
[Xiaofei PR delivery skill](../multica/skills/xiaofei-pr-delivery/SKILL.md) for
the delivery and cleanup protocol.

## Release maintenance

1. Update this page after an exact UAT head, stable alias, Neon branch, and
   manual smoke path are verified.
2. Keep exact deployment IDs and detailed evidence in a dated document under
   `docs/acceptance/`.
3. Choose the next SemVer only when UAT promotion to Production is explicitly
   authorized; do not tag an unreleased UAT candidate.
4. Promote through a temporary `promote/uat-*` branch, never directly from
   `uat` to `main`.
5. After Production verification, create the immutable GitHub Release/tag and
   update this page plus `CHANGELOG.md`.
