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

1. The owner restates outcome, paths, risk, and validation before editing.
2. The owner checks `AGENTS.md`, this protocol, and the local boundary README.
3. A cross-boundary dependency becomes a child issue or an explicit handoff;
   Agents do not race in shared files.
4. The owner implements the smallest acceptance-complete change and records
   focused evidence.
5. Required-risk categories go to `xiaofei-quality` for independent review.
6. The owner addresses findings and opens or updates one PR.
7. A human merges unless the project explicitly enables an automated merge
   policy.
8. Platform evidence confirms Preview creation/cleanup or production delivery
   when the issue affects those lifecycles.

## GitHub convention

Put the Multica issue key in the branch, PR title, and PR body so the GitHub
integration can associate the pull request reliably.

```text
branch:   agent/XF-123-short-outcome
title:    [XF-123] Short outcome
PR body:  Multica issue: XF-123
```

Use the actual workspace issue prefix in place of `XF`. Keep one PR focused on
one parent outcome even when it integrates several already-reviewed child
issues. Delete merged source branches; Preview database cleanup is handled by
the repository workflow described in `docs/pr-preview-setup.md`.

## Handoff format

Post this compact handoff on the issue before changing ownership:

```markdown
### Handoff

- Outcome:
- Changed files/contracts:
- Validation and result:
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
- required independent review is resolved;
- canonical docs match the new behavior;
- the PR links to the Multica issue;
- Preview evidence is present when behavior is externally observable;
- production or Preview cleanup status is known when delivery was in scope;
- deferred work is an explicit issue, not a hidden TODO.
