# Multi-Agent collaboration protocol

This protocol keeps Multica coordination predictable as the repository grows.
The squad adds routing; it does not remove code ownership or human merge
control.

## Unit of work

Every implementation issue must contain:

- **Outcome** — one observable result;
- **Scope** — owned paths or boundaries;
- **Non-goals** — tempting work intentionally deferred;
- **Acceptance** — executable or observable completion criteria;
- **Validation** — focused commands and any manual/Preview path;
- **Risk** — public access, authorization, owner state, model send, data,
  schema, secrets, cleanup, or production effects.

If one issue requires multiple owning rows from the repository structure map,
the lead splits it into ordered child issues. The parent describes the
end-to-end contract and closes only after integration evidence exists.

## Codex session ownership

Agent assignment answers who implements a boundary; it does not identify the
Codex conversation that proposed or coordinates the Feature. Every independent
Codex Feature controller therefore has two identities:

- **Origin session** — the immutable Codex thread that first proposed and
  claimed the parent outcome;
- **Managing session** — the Codex thread currently authorized to coordinate
  the parent Issue, child routing, PR, Preview, and handoff.

Use the current `CODEX_THREAD_ID` as the exact identifier and derive a readable
tag from its first UUID segment, for example `CX-019fc9d9`. A thread ID is a
coordination identifier, not a credential, but it must never be substituted
with an API token or session cookie.

Before creating or claiming a parent Issue, inspect active Issue metadata and
open PR bodies for target/path overlap. After human confirmation, set these
metadata keys on the one Multica parent Issue:

```text
codex_origin_thread_id     immutable full CODEX_THREAD_ID
codex_origin_tag           immutable CX-xxxxxxxx tag
codex_manager_thread_id    current full CODEX_THREAD_ID
codex_manager_tag          current CX-xxxxxxxx tag
codex_manager_updated_at   UTC RFC3339 timestamp
```

Child Issues inherit the controller identity from their parent and keep their
own Multica Agent assignee; do not copy session metadata to every child. A
direct documentation PR without a Multica Issue records the same origin and
manager fields in its PR body.

A manager transfer requires the user or current managing session to approve
the handoff. The receiving session verifies the current Issue, branch, PR head,
checks, worktree, and protected paths, then updates only the three manager
fields and posts a handoff comment naming the old manager, new manager, exact
head, and remaining action. Never rewrite the origin fields.

## Routing

| Work                                                       | Primary Agent                              | Required coordination                                   |
| ---------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------- |
| Ambiguous, architectural, or cross-boundary                | `xiaofei-lead` or `Xiaofei Delivery` squad | Lead decomposes before implementation                   |
| Domain contracts, KU, policy, owner state, Eval, Guardrail | `xiaofei-runtime`                          | App consumes an explicit stable contract                |
| LangGraph, Mastra, provider adapter                        | `xiaofei-runtime`                          | Quality reviews send/Guardrail changes                  |
| SaaS UI, public support, inbox, settings, oRPC, auth       | `xiaofei-app`                              | Runtime supplies contracts; platform owns schema        |
| Prisma, Neon, Vercel, Actions, Preview lifecycle           | `xiaofei-platform`                         | Human authorization for production mutations            |
| Review, acceptance evidence, security and docs consistency | `xiaofei-quality`                          | Reviewer does not concurrently implement the same issue |

Assign a well-scoped issue directly to its primary Agent. Assign uncertain work
to the squad so the leader can route it.

## Execution lifecycle

1. The controller announces its `CX-xxxxxxxx` tag and verifies or claims the
   parent Issue session metadata before any edit.
2. The owner restates outcome, paths, risk, and validation before editing.
3. The owner checks `AGENTS.md`, this protocol, and the local boundary README.
4. The owner uses `$xiaofei-pr-delivery`, checks out the repository with
   `multica repo checkout https://github.com/pjxkqc/xiaofei --ref uat`, and
   creates the task branch from the current `origin/uat`.
5. The owner runs `pnpm delivery:identity` before the first commit and fixes the
   effective identity if it is not approved.
6. A cross-boundary dependency becomes a child issue or an explicit handoff;
   Agents do not race in shared files.
7. The owner implements the smallest acceptance-complete change and records
   focused evidence.
8. The owner runs `pnpm delivery:check` before push or handoff.
9. After the final commit, the owner runs `pnpm delivery:head` and records the
   exact head SHA. New commits, amendments, rebases, and merges invalidate prior
   head and quality evidence.
10. Required-risk categories go to `xiaofei-quality` for independent review.
11. The owner addresses findings and opens or updates one Draft PR to `uat`.
12. A human merges unless the project explicitly enables an automated merge
    policy.
13. Platform evidence confirms Preview creation/cleanup or production delivery
    when the issue affects those lifecycles.

## Delivery preflight

Repository commands are the source of truth; a prompt saying that checks were
run is not evidence.

```bash
# Before the first commit
pnpm delivery:identity

# After focused checks and before push/handoff
pnpm delivery:check

# After the final commit or amended commit
pnpm delivery:head
git rev-parse HEAD
```

`delivery:check` supplies non-secret placeholder configuration only when a
validation variable is absent. It does not start a database, mutate Preview or
production data, or replace the real PostgreSQL and browser checks in GitHub
Actions.

The lead must not route work to Quality until the owner supplies the full gate
result and exact head SHA. Quality must verify that same head with
`pnpm delivery:head` and inspect current GitHub and Vercel checks; cached
evidence from an older commit is invalid. If the identity gate fails, amend the
bad commit before handoff instead of appending an empty repair commit.

## GitHub convention

Put the Multica issue key and short session tag in the branch, and put the
Issue plus complete session ownership block in the PR body. This keeps GitHub,
Multica, the Codex task list, worktrees, Vercel, and Neon searchable by the same
identities.

```text
branch:   agent/XF-123-cx-019fc9d9-short-outcome
base:     uat
title:    [XF-123] Short outcome
PR body:
  ## Coordination ownership
  - Origin Codex session: CX-019fc9d9 (full thread ID)
  - Managing Codex session: CX-019fc9d9 (full thread ID)
  - Multica parent issue: XF-123
  - Implementation owner: Xiaofei App
```

Use the actual workspace issue prefix in place of `XF`. Keep one PR focused on
one parent outcome even when it integrates several already-reviewed child
issues. The title stays outcome-focused; do not create one GitHub label per
session. Existing open branches must not be renamed just to add a tag because
that would replace their Preview and Neon identities; backfill the Issue
metadata and PR ownership block instead. Delete merged source branches; Preview
database cleanup is handled by the repository workflow described in
`docs/pr-preview-setup.md`.

Ordinary implementation and documentation PRs target the durable `uat` branch.
Do not open `uat → main` directly. An explicitly authorized production
promotion creates `promote/uat-YYYYMMDD-<short-slug>` from the accepted UAT head
and opens that temporary branch to `main`. After release, fast-forward `uat` to
the released `main` head. GitHub Free cannot enforce these private-repository
branch rules, so the Lead and Quality Agent must reject a wrong base.

## Handoff format

Post this compact handoff on the issue before changing ownership:

```markdown
### Handoff

- Origin Codex session:
- Managing Codex session:
- Outcome:
- Changed files/contracts:
- Validation and result:
- Exact head SHA:
- Preview/manual evidence:
- Risks or unresolved decisions:
- Next owner and requested action:
```

Do not hand off credentials, copied environment files, production data, or
unredacted logs.

## Conflict policy

- First owner keeps the shared file; the second Agent pauses and comments on
  the issue.
- The lead resolves scope by sequencing, extracting a contract, or assigning a
  different file boundary.
- Never solve conflict by force-pushing another Agent's branch, discarding
  unknown changes, or creating a parallel implementation without a decision.
- If acceptance criteria conflict with `AGENTS.md` safety rules or product
  invariants, stop and escalate with the exact conflict.

## Definition of done

An issue is done only when:

- acceptance criteria are met;
- focused checks and the repository quality gate pass;
- the final PR head has an approved author and committer, and validation
  evidence names that exact SHA;
- required independent review is resolved;
- canonical docs match the new behavior;
- the PR links to the Multica issue;
- the parent Issue metadata and PR body identify the same origin and managing
  Codex sessions;
- an ordinary PR targets `uat`, or an explicitly authorized promotion uses a
  temporary `promote/uat-*` branch to `main`;
- Preview evidence is present when behavior is externally observable;
- production or Preview cleanup status is known when delivery was in scope;
- deferred work is an explicit issue, not a hidden TODO.
