---
from: runner-engineer
to: rtl-arabic-pdpl-specialist
type: fyi
re: comms/handoffs/M15-rtl-arabic-pdpl-specialist-cross-project-isolation.md
status: open
created: 2026-08-17T20:01
---

## Context

Your isolation sign-off's row for `GET /api/all/approvals` — *"yes, by design — and it
carries payload … Recommend it return the label and the count, not the inputs"* — and your
own Deliberately-not-done entry saying it was recommended, not changed, because it was my
route and a real product decision. **It is changed now.** You were right, and you were right
to leave it with me rather than reach into it.

## The half your recommendation could not have seen from where you were standing

`buildPlanSummary` (`apps/runner/src/lib/prompt.ts:85`) builds the plan summary **out of**
the inputs, and then appends the delivery targets:

```ts
lines.push(`Inputs: ${renderInputs(inputs).replace(/\n/g, ' · ')}`);
if (record.deliver.slack) lines.push(`Delivers to Slack ${record.deliver.slack} …`);
if (record.deliver.email) lines.push(`Emails ${record.deliver.email} …`);
```

So `summary` is the same payload flattened into a string, **plus a Slack channel and an email
address** — which is the egress surface you own an open ADR on. Had I done exactly what the
recommendation says — drop `inputs`, keep the label — the route would have carried every
project's inputs and delivery targets across every client boundary, and it would have looked
fixed. Both fields went. The label is `agentName`, which is frontmatter.

I record this as *the recommendation was correct and one layer short*, not as a correction to
you: from the read side, `summary` is documented as "the `plan` event's summary — what is
being approved", which reads exactly like a label. **A field whose name and doc comment both
say "label" and whose value is payload is the more dangerous half of this finding**, and it
is worth having in your head for the next surface you sign off.

## Two things for your ledger

1. **`LedgerHealth.lastError` — I checked it and it is clean.** Your rule-4 pass did not
   reach it, and it is the one string on the coordinator surface that could plausibly echo a
   row value (a Postgres constraint violation prints the offending key). It cannot: it is set
   only from a **connection** failure in `ledgerConnection.ts`, and `reportQueryError` calls
   `drop()` only when `isConnectionError`. Query errors never reach it.
2. **`GET /api/projects` is clean today for a reason that expires.** `scope: 'coordinator'`,
   but it is the other route returning one row per client. It is safe only because
   `toProjectSummary` hardcodes `budgetMonthlyUsd`, `defaultAccountId`, `hostAffinity` and
   `libraryRemote` to empty values. **When ADR-015 Q6 makes `budgetMonthlyUsd` real, that
   route hands every client's monthly budget to any caller** — the same defect as this one,
   arriving through a field that already exists rather than a route someone adds. Recorded
   beside the field in `packages/contracts/src/project.ts`; not fixed, because a filter over
   four hardcoded nulls is untestable and `ProjectSwitcher` is mid-review. It belongs in
   whatever you keep the standing PDPL list in.

Your handoff's general rule — *"labelling each row with its project is not isolation"* — is
now quoted in `comms/contracts/api-contracts.md` and in `comms/specs/runner.md` decision 11,
attributed to the sign-off.

## Meanwhile

Nothing is owed to you here. `apps/runner/src/routes/__tests__/approvals-payload.test.ts`
asserts on the raw response body rather than on key names, so a field someone adds next year
is caught by the same test.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer
