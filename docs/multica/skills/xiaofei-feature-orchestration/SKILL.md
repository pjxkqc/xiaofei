---
name: xiaofei-feature-orchestration
description: Govern a cross-machine Xiaofei Feature from conflict audit through one shared branch and one Draft PR to uat.
---

# Xiaofei Feature orchestration

Use this Skill for a new cross-machine Feature. The managing Codex session is
the coordinator; repository Agents implement only their assigned boundary.
Read [`../../cross-machine-feature-operations.md`](../../cross-machine-feature-operations.md)
for the canonical Mac/Windows preparation, capability matrix, daily prompt,
state machine, protected-path audit, and host-to-host handoff contract. Use
`xiaofei-pr-delivery` for PR, Preview, UAT, cleanup, and promotion mechanics;
do not duplicate them here.

## Immutable ownership

At intake, record the parent Issue's immutable Origin session and current
Managing session (`codex_origin_*`, `codex_manager_*`). Every ordinary Feature
uses one shared integration branch and one Draft PR whose base is `uat`.
The PR body must identify the current FLY issue, origin/manager sessions,
branch, accepted baseline and protected paths. A manager transfer changes only
the manager fields and adds an audit comment.

## Ordered flow

1. Read the parent, metadata and bounded comment threads. Inspect open PRs and
   related Issues for ownership/path overlap before editing. Declare the exact
   `CODEX_THREAD_ID`, `CX-xxxxxxxx` tag, and current host capability profile.
2. From the exact accepted `uat` baseline, create the planned shared branch.
   Lead owns `AGENTS.md` and `docs/multica/**` and writes the contract first.
3. Split cross-boundary work into ordered child Issues. Platform waits for the
   Lead's exact SHA and path handoff, then owns only preflight scripts/tests and
   package wiring. No Agent edits another Agent's protected paths.
4. Windows smoke and Quality read the final head only. Windows validates core
   repo/GitHub/Multica/Node/pnpm/Git capability on the approved standard
   Runtime; Vercel, Neon and Chrome are optional capability profiles.
5. The managing session performs live Agent/Runtime/Skill reconciliation. The
   implementation Agent reports repository truth and exact mapping only; it
   never copies or overwrites `custom_env`, production, or cloud settings.
6. Run focused checks, `pnpm delivery:check`, then `pnpm delivery:head` after
   the final commit. Open or update the single Draft PR to `uat`; do not merge,
   promote to `main`, or touch unrelated PRs.

At each new day, machine, or Owner handoff, rerun the read-only audit. Stop
writing if the remote shared-branch SHA differs from the accepted handoff SHA,
the worktree is unexpectedly dirty, or changed paths overlap another Owner's
protected boundary. Ask Lead to sequence or split the boundary.

## Handoff record

Each boundary handoff names the exact head SHA, changed paths, owner, tests,
remaining risks and next decision. Any new commit invalidates prior evidence.
Never include tokens, cookies, connection strings, custom environment values,
or private host data in Issues, PRs or logs.
