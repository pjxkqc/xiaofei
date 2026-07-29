---
name: xiaofei-pr-delivery
description: Deliver Xiaofei implementation and documentation changes through the durable UAT flow. Use when starting a Multica coding task, creating or updating a Xiaofei pull request, validating an exact PR head, checking Vercel and Neon Preview evidence, cleaning up a closed PR, or preparing an explicitly authorized UAT-to-production promotion.
---

# Xiaofei PR delivery

Keep ordinary development isolated from Production: branch from `uat`, open a
Draft PR to `uat`, and require evidence for the exact head SHA. Treat promotion
to `main` as a separate, human-authorized operation.

## Choose the path

- **Ordinary issue:** use `uat` as the checkout ref and PR base.
- **Production promotion:** proceed only when the issue and a human explicitly
  authorize it. Create `promote/uat-YYYYMMDD-<slug>` from the reviewed UAT head
  and open it to `main`.
- **Hotfix or other base:** stop and request an explicit branch decision. Never
  infer permission to bypass UAT.

Never open `uat → main` directly. Repository source-branch deletion is enabled,
so that merge could delete the durable `uat` branch.

## Deliver an ordinary issue

1. Read `AGENTS.md`, `docs/multica/collaboration.md`, the issue, and the
   nearest boundary README.
2. Resolve the issue key and one implementation owner. Split competing file
   ownership before editing.
3. Start from the current durable UAT branch:

   ```bash
   multica repo checkout https://github.com/pjxkqc/xiaofei --ref uat
   git fetch origin --prune
   git switch -c agent/<issue-key>-<short-slug> origin/uat
   ```

   If an isolated worktree already exists, verify its base instead of discarding
   changes. Do not reset, overwrite, or stage unrelated work.

4. Run `pnpm delivery:identity` before the first commit. Fix the effective
   author and committer before proceeding.
5. Implement the smallest acceptance-complete change and run focused checks.
6. Run `pnpm delivery:check`, commit intentionally, then run
   `pnpm delivery:head`. Record the exact final SHA. Any amendment, rebase,
   merge, or new commit invalidates earlier head evidence.
7. Push the branch and open one Draft PR with:

   ```text
   base:  uat
   head:  agent/<issue-key>-<short-slug>
   title: [<issue-key>] <outcome>
   body:  Multica issue: <issue-key>
   ```

   The body must also state scope, risk, exact head SHA, validation results, and
   the manual Preview acceptance path.

8. Confirm GitHub Quality and Vercel belong to that exact head. For
   data-bearing work, confirm Neon created the exact
   `preview/<head-branch>` branch and did not use `main`.
9. Route required-risk changes to `xiaofei-quality`. Keep the PR Draft until
   human review says otherwise. Never auto-merge.

## Verify merge and cleanup

After an authorized merge to `uat`:

- verify the `uat` push Quality run and stable Vercel UAT alias;
- verify Neon `preview/uat` remains present and UAT data persists;
- verify the disposable source branch and its exact Neon Preview branch are
  deleted after PR close;
- verify Vercel Production and Neon `main` did not change.

An open PR may legitimately keep its Preview deployment and Neon branch.

## Promote an accepted UAT head

Only after explicit human authorization:

1. Record the exact accepted `uat` SHA and its passing evidence.
2. Create `promote/uat-YYYYMMDD-<slug>` from that SHA.
3. Choose the SemVer version and update `docs/releases/README.md` plus
   `CHANGELOG.md` on the temporary branch.
4. Open a Draft PR from the temporary branch to `main`.
5. Re-run all gates for the promotion head and require human merge approval.
6. After merge and Production verification, create a GitHub Release whose
   `vX.Y.Z` tag targets the exact released `main` SHA.
7. Fast-forward `uat` to the released `main` head, re-verify the stable UAT
   environment, and update the Release status page if its recorded revision
   changed.

Do not change Vercel Production settings, Neon `main`, secrets, branch
protection, or deployment access controls unless the issue separately and
explicitly authorizes that mutation.

## Report evidence

Return the issue and PR links, base/head refs, exact head SHA, commands and
results, GitHub/Vercel/Neon state, cleanup status, residual risks, and the next
human decision. Redact credentials and never copy connection strings, tokens,
session cookies, or production data.

Use [`../../../releases/README.md`](../../../releases/README.md) as the current
environment and test-access record. GitHub Releases remain the immutable
Production history; Multica issues contain coordination and evidence.
