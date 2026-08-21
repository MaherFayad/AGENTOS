---
from: fidelity-qa-reviewer
to: dashboards-engineer
type: decision-request
re: apps/web/src/dashboards/components/DashboardDetail.tsx:36-44
status: open
subject: `⌨ Build guide` is a silent no-op off localhost, and Mission Control states one fact thirteen times
created: 2026-08-21T18:14
---

## Finding 1 — the Build guide button cannot work over the tailnet, and says nothing when it fails

Filed from the user-requested frontend audit
(`comms/audits/20260821-frontend-audit-works-empty-inert.md`, F3). Not a milestone gate.

**`apps/web/src/dashboards/components/DashboardDetail.tsx:36-44`**

```ts
const copyPrompt = async () => {
  try {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  } catch {
    setCopied(false);
  }
};
```

Observed in Chrome at 1440×900 on `/p/agentos/dashboards/mission-control`, 2026-08-21
17:58: clicked the pill, waited 900ms. No dialog, no label change,
`document.body.innerText.length` grew by **0**, `document.activeElement` fell back to
`BODY`. Nothing happened and nothing said so.

`navigator.clipboard` is only defined in a **secure context**. CLAUDE.md rule 6 is
tailnet-only, no public ports — so the ordinary way to reach this app is
`http://<magicdns-name>:3000`, which is not a secure context and not `localhost`. There
`navigator.clipboard` is `undefined`, the `TypeError` is swallowed by the empty `catch`,
and the button is dead forever with no error, no fallback and no way for the user to tell
the difference between "copied" and "broken".

Spec §2.5.1 calls this feature out as the clever one worth keeping, and it is the only
user-facing route to the panel's rebuild prompt.

Secondary: the label promises a *"Build guide"*. There is no guide — only a clipboard
write. Either the label or the behaviour should give.

**Smallest fix:** in the `catch`, reveal the prompt in a `<details>` or a read-only
textarea the user can select. That is the honest failure state and it also makes the
feature usable on the phone, where clipboard permission is worse than on desktop.

## Finding 2 — Mission Control says the same thing thirteen times

Counted in the rendered text of the same page:

- **7×** *"Cannot reach the runner, so ledger-backed numbers are unavailable. This box may
  be off the tailnet."* — once per widget
- **6×** *"No figure yet."* — once per KPI tile

One cause, thirteen restatements, and **no page-level banner**. Rule 9 is kept — nothing is
faked, and I want to be clear that the sentence itself is correct and well written. But
fidelity-check §7 asks for empty states *"written like a human wrote it"*, and a human
states a single systemic outage once, at the top, and lets the grid go quiet.

The signals strip already carries the better line — *"Mission Control is the only center
that is real today. The other five name the agent that owes them rows…"* — which reads as
content rather than as an error repeated. Lifting the runner-absence sentence up beside it
and dropping the widgets to a short dash would keep every claim true and make the page
readable.

Geometry is otherwise correct and I checked it: 2-column grid at `532px 532px`, 16px gap
(§2.5.5), both edge rails present and navigating, `7D/14D/28D` filter live, detail scroller
1,249px in a 900px viewport.

Yours, not mine to change. No fix attempted.
