# FLY-99 Preview acceptance

## Verdict

**PASS WITH FOLLOW-UP**

This record captures acceptance of the application head
`a2b10ee4214cdb3daf89c6ce02e9acf6b2519a1b`. The commit that adds this file is
evidence-only; it does not change the accepted application behavior.

## Delivery evidence

- Pull request: [#33](https://github.com/pjxkqc/xiaofei/pull/33)
- Base: `uat`
- Branch: `agent/FLY-99-customer-conversations`
- GitHub Quality: run `30778037181` — success
- Vercel deployment: `61U3JD7osH4znkSJ8Y7EyAVxDVex` — success
- Stable Preview alias:
  `https://xiaofei-preview-git-agent-fly-99-customer-c-0955d5-flyranking16.vercel.app`
- Neon Preview branch: `preview/agent/FLY-99-customer-conversations`
  (`br-jolly-resonance-az8ssz3i`), state `ready`

Production was not touched.

## Test access / 验收访问

Follow the global [Test access](../releases/README.md#test-access) rules. The
listed Preview/UAT fixture passwords are public synthetic-data credentials, not
secrets. Do not put real, Production, or personal passwords, session cookies,
tokens, or database URLs in Git, the PR, or Multica.

- Login URL:
  [Preview login](https://xiaofei-preview-git-agent-fly-99-customer-c-0955d5-flyranking16.vercel.app/login)
- Select **Continue as Preview operator** to create or reuse the Preview
  acceptance account and sign in.
- Account identifier: `preview-operator@xiaofei.invalid`. Password: **Not
  required / 无需密码**. This is Preview-only one-click login, not a shared
  password stored in the repository.
- After sign-in, use the left Organization switcher to select `FLY-99 验收商户
A` and `FLY-99 验收商户 B`. This operator is the owner for both acceptance
  Organizations and can verify customer creation, editing, archiving, and
  isolation.
- In Organization A, the accepted customer is
  `fly99-demo-customer-a`: `王小明（FLY-99 已编辑）`,
  `fly99.customer@example.com`, WhatsApp `+8613800000099`, archived.
- `/support` is the public customer entry point and does not require login.
  A normal signup user may register with a disposable email and choose a
  private password; FLY-99 did not create or use a fixed-password account.
- Member read-only behavior and API authorization are covered by automated
  tests. The real Preview manual acceptance used the owner operator; no member
  or admin account is asserted here.
- If the current login session is incorrect, sign out, then return to `/login`
  and use the one-click operator again.
- One-click initialization is idempotent: it repairs only these fixture users,
  roles, Organizations, and customers while preserving unrelated data. Then
  sign out and use the ordinary email/password form for Owner A
  (`preview-owner@xiaofei.invalid` / `PreviewOnly-Owner-2026!`), Admin A
  (`preview-admin@xiaofei.invalid` / `PreviewOnly-Admin-2026!`), Member A
  (`preview-member@xiaofei.invalid` / `PreviewOnly-Member-2026!`), or Owner B
  (`preview-owner-b@xiaofei.invalid` / `PreviewOnly-OwnerB-2026!`). These are
  public Preview/UAT-only fixtures; Production has no shared test account.

## Preview acceptance data

- Organization A: `FLY-99 验收商户 A`
- Organization B: `FLY-99 验收商户 B`
- Customer external ID: `fly99-demo-customer-a`
- Final name: `王小明（FLY-99 已编辑）`
- Email: `fly99.customer@example.com`
- WhatsApp: `+8613800000099`
- Status: archived

## Passed scenarios

- Organization owner/admin edits customer details and the changes persist.
- Archiving preserves the customer record and audit history.
- Inbox shows the filtered count and does not render stale detail after the
  selected conversation is filtered out.
- Switching A to B, or to no selection, does not retain prior conversation
  detail.
- Organization B's customer list and Inbox cannot see Organization A data.
- Organization B cannot retrieve Organization A's customer detail or its real
  profile fields.
- Legacy conversations without a customer can still render in the Inbox.

## Limits and follow-up

The real customerId conversation-binding entry point is intentionally deferred
to FLY-101. The accepted customer therefore has zero current history entries;
this PR covers the same-Organization history API contract with an automated
test.

Non-blocking follow-up: an inaccessible or nonexistent customer detail may
currently render the not-found notice alongside generic active/unprovided
profile placeholders. It does not disclose customer data, but the wording can
mislead and should be corrected in a later focused change.
