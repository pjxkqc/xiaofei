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
